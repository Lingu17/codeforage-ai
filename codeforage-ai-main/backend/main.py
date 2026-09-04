import os
import httpx
import json
from typing import Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import concurrent.futures
import asyncio
import threading

from database import get_supabase_client
from scanner import scan_and_analyze_repository, generate_embedding, initial_stages, get_genai_client, GEMINI_AI_MODEL
from ai_groq import (
    GroqError,
    generate_codebase_answer,
    generate_codebase_answer_stream,
)

# Global thread pool executor to offload blocking synchronous tasks
process_pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)

# In-process idempotency guard for chat submissions. When a client retries a
# request (browser/network retry or a stray double-submit) with the same
# request_id, we reuse the session instead of creating a duplicate conversation
# and re-inserting the user message. Bounded LRU wins over memory growth.
_chat_request_cache = {}
_CHAT_CACHE_MAX = 512
_chat_cache_lock = threading.Lock()

# Maximum window (seconds) within which an identical user question in the same
# conversation is treated as a duplicate (browser retry / double-submit), even if
# the in-memory request cache was lost to a backend restart.
_CHAT_DEDUPE_WINDOW_SEC = 300


def _is_duplicate_submission(supabase, session_id: str, message: str) -> bool:
    """True if this exact user question was already persisted in the session
    within the dedupe window. Database-backed so it also catches retries that
    arrive after the in-process request cache has been cleared."""
    try:
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=_CHAT_DEDUPE_WINDOW_SEC)).isoformat()
        rows = supabase.table("chat_messages") \
            .select("id") \
            .eq("session_id", session_id) \
            .eq("role", "user") \
            .eq("content", message) \
            .gte("created_at", cutoff) \
            .limit(1) \
            .execute()
        return bool(rows and rows.data)
    except Exception as e:
        print(f"[chat] duplicate check failed (proceeding): {e}")
        return False

def get_auth_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ")[1]
    return None

def get_authenticated_user_id(token: Optional[str] = Depends(get_auth_token)) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")
    try:
        supabase = get_supabase_client(token)
        user_res = supabase.auth.get_user(token)
        if user_res and user_res.user:
            return user_res.user.id
        raise HTTPException(status_code=401, detail="Invalid session token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")



app = FastAPI(
    title="CodeForge AI Backend API",
    description="Backend services for CodeForge AI platform.",
    version="1.0.0"
)

# Configure CORS for Next.js frontend
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://codeforage-ai.vercel.app",
    "https://codeforge-ai.vercel.app",
    "https://codeforageai.vercel.app",
    "https://codeforgeai.vercel.app",
]
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    extra_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    allowed_origins.extend(extra_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    message: str

class AnalyzeRepoRequest(BaseModel):
    github_id: int
    name: str
    full_name: str
    description: Optional[str] = None
    language: Optional[str] = None
    owner_username: str
    repo_url: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    request_id: Optional[str] = None

class PRReviewRequest(BaseModel):
    diff_content: str
    repository_id: Optional[str] = None

def _build_chat_messages(user_message: str, context_str: str, has_context: bool) -> list:
    """Build the OpenAI/Groq-style chat messages for the codebase RAG prompt.

    Keep Gemini out of the chat path: this is the only place the chat prompt is
    assembled and it is provider-agnostic (used by the Groq service).
    """
    if has_context:
        instruction = (
            "1. Base your answer strictly on the retrieved code chunks. If the answer "
            "cannot be found in the context, clearly explain that and offer general guidance.\n"
            "2. Keep your answer clear, informative, and formatted in markdown.\n"
            "3. Do NOT make up import paths or files. Use the exact files mentioned in the retrieved code chunks.\n"
            "4. List the files referenced as source citations at the very end of your answer."
        )
    else:
        instruction = (
            "No specific code chunks matched this question (the repository may not have "
            "been indexed yet, or the code is not recognizable from the query). "
            "Provide a helpful high-level answer and clearly state that no specific source "
            "files could be retrieved for this question. Do not invent file paths."
        )

    system = (
        "You are an expert programming assistant helping a developer understand this codebase. "
        "Answer the developer's question using the retrieved code context below."
    )
    user_prompt = (
        f"USER QUESTION:\n{user_message}\n\n"
        f"RETRIEVED CODE CHUNKS:\n{context_str if has_context else '(No code chunks retrieved)'}\n\n"
        f"INSTRUCTIONS:\n{instruction}"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_prompt},
    ]

@app.get("/", response_model=HealthResponse)
@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "message": "CodeForge AI Backend is running."}

# (Removed debug-env endpoint)


# 1. Fetch scanned repositories
@app.get("/api/repos")
def get_scanned_repositories(user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        res = supabase.table("repositories").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. Fetch user's GitHub repositories directly using their github username/token
@app.get("/api/repos/github")
async def get_github_repositories(
    username: Optional[str] = None, 
    token: Optional[str] = None,
    x_github_token: Optional[str] = Header(None)
):
    if x_github_token:
        token = x_github_token
    # Sanitize inputs
    if token in ("undefined", "null", ""):
        token = None
    if username in ("undefined", "null", ""):
        username = None

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodeForgeAI"
    }
    if token:
        headers["Authorization"] = f"token {token}"
        
        # If username is missing or a placeholder, resolve it dynamically using the token
        if not username or username in ("Developer", "guest_developer"):
            async with httpx.AsyncClient() as client:
                try:
                    user_res = await client.get("https://api.github.com/user", headers=headers)
                    if user_res.status_code == 200:
                        resolved_username = user_res.json().get("login")
                        if resolved_username:
                            username = resolved_username
                except Exception as e:
                    print(f"Failed to fetch username from github token: {e}")

    if not username:
        raise HTTPException(status_code=400, detail="GitHub username is required or could not be resolved.")

    url = f"https://api.github.com/users/{username}/repos?sort=updated&per_page=100"
    if token:
        # If we have a token, query user's repos including private ones
        url = "https://api.github.com/user/repos?sort=updated&per_page=100"
        
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                # Fallback to public repos if auth fails
                if token:
                    public_headers = {
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "CodeForgeAI"
                    }
                    r = await client.get(f"https://api.github.com/users/{username}/repos?sort=updated&per_page=100", headers=public_headers)
                if r.status_code != 200:
                    raise HTTPException(status_code=r.status_code, detail=f"GitHub API returned error: {r.text}")
            return r.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# 3. Create Scan Job & Run Scan Asynchronously
@app.post("/api/repos/analyze")
def analyze_repository(
    req: AnalyzeRepoRequest, 
    background_tasks: BackgroundTasks, 
    user_id: str = Depends(get_authenticated_user_id), 
    token: Optional[str] = Depends(get_auth_token),
    x_github_token: Optional[str] = Header(None)
):
    try:
        supabase = get_supabase_client(token)
        
        # 1. Check or insert repository for this specific user
        existing_repo = supabase.table("repositories").select("id").eq("github_id", req.github_id).eq("user_id", user_id).execute()
        
        repo_data = {
            "name": req.name,
            "full_name": req.full_name,
            "description": req.description,
            "language": req.language or "unknown",
            "owner_username": req.owner_username,
            "user_id": user_id
        }
            
        if existing_repo.data:
            repo_id = existing_repo.data[0]["id"]
            # Update detail if modified
            supabase.table("repositories").update(repo_data).eq("id", repo_id).execute()
        else:
            repo_data["github_id"] = req.github_id
            new_repo = supabase.table("repositories").insert(repo_data).execute()
            repo_id = new_repo.data[0]["id"]
            
        # 2. Check for running scan jobs to prevent duplicate scanning
        active_job = supabase.table("repository_scans").select("id", "status").eq("repository_id", repo_id).in_("status", ["queued", "cloning", "scanning", "embedding", "analyzing"]).execute()
        if active_job.data:
            return {"repository_id": repo_id, "job_id": active_job.data[0]["id"], "status": active_job.data[0]["status"], "message": "Analysis is already running."}
            
        # 3. Insert new Scan Job
        stages_init = initial_stages()
        job_payload = {
            "repository_id": repo_id,
            "status": "queued",
            "progress": 0,
            "current_step": json.dumps(stages_init),
            "stages": stages_init,
        }
        try:
            job = supabase.table("repository_scans").insert(job_payload).execute()
        except Exception:
            # `stages` column may not exist yet; persist the stage JSON in current_step instead.
            job_payload.pop("stages", None)
            job = supabase.table("repository_scans").insert(job_payload).execute()
        job_id = job.data[0]["id"]
        
        # 4. Trigger background task with the GitHub OAuth token for private repository access
        def run_scan_in_process(*args):
            # This runs in FastAPI's background thread pool, but we submit the heavy work to a ThreadPoolExecutor 
            future = process_pool.submit(scan_and_analyze_repository, *args)
            try:
                future.result()
            except Exception as e:
                print(f"Background task failed: {e}")

        background_tasks.add_task(run_scan_in_process, req.repo_url, repo_id, job_id, token, x_github_token)
        
        return {
            "repository_id": repo_id,
            "job_id": job_id,
            "status": "queued",
            "message": "Repository analysis queued successfully."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Get active job status
@app.get("/api/repos/{id}/status")
def get_scan_status(id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Check ownership
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")
            
        res = supabase.table("repository_scans").select("*").eq("repository_id", id).order("started_at", desc=True).limit(1).execute()
        if not res.data:
            return {"status": "none", "progress": 0, "current_step": "Not Scanned"}
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. Get AI Repository Summary Metrics
@app.get("/api/repos/{id}/summary")
def get_repo_summary(id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Fetch repo metadata and verify ownership
        repo = supabase.table("repositories").select("*").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")
            
        # Fetch file metrics
        files = supabase.table("repository_files").select("id", "size", "classes", "functions").eq("repository_id", id).execute()
        
        files_count = len(files.data)
        total_size = sum(f["size"] for f in files.data)
        functions_count = sum(len(f["functions"]) for f in files.data)
        classes_count = sum(len(f["classes"]) for f in files.data)
        
        # Fetch scores
        scores = supabase.table("health_scores").select("*").eq("repository_id", id).order("created_at", desc=True).limit(1).execute()
        
        overall_score = 80
        breakdown = {}
        if scores.data:
            overall_score = scores.data[0]["overall_score"]
            breakdown = scores.data[0]
            
        # Fetch reports summaries
        arch = supabase.table("architecture_reports").select("graph_data", "summary").eq("repository_id", id).order("created_at", desc=True).limit(1).execute()
        debt = supabase.table("technical_debt_reports").select("debt_score", "critical_count", "major_count", "minor_count").eq("repository_id", id).order("created_at", desc=True).limit(1).execute()
        sec = supabase.table("security_reports").select("security_score", "vulnerabilities").eq("repository_id", id).order("created_at", desc=True).limit(1).execute()
        
        # Compute count of files per language
        languages = {}
        for f in files.data:
            # Re-fetch files language details if needed, or query from code_files
            pass
        
        services_count = 1
        arch_style = "Monolith"
        tech_stack = [repo.data[0]["language"]]
        
        if arch.data and "summary" in arch.data[0] and arch.data[0]["summary"]:
            if "Style:" in arch.data[0]["summary"]:
                arch_style = arch.data[0]["summary"].split("Style:")[-1].strip()
                
        # Parse graph data to estimate services count
        if arch.data and "graph_data" in arch.data[0]:
            nodes = arch.data[0]["graph_data"].get("nodes", [])
            # Heuristic count of modules
            folders = set()
            for node in nodes:
                parts = node["id"].split('/')
                if len(parts) > 1:
                    folders.add(parts[0])
            services_count = max(len(folders), 1)
            
        return {
            "repository": repo.data[0],
            "tech_stack": tech_stack,
            "architecture": arch_style,
            "files_count": files_count,
            "functions_count": functions_count,
            "services_count": services_count,
            "database": "PostgreSQL",
            "risk_level": "Medium" if overall_score < 85 else "Low",
            "health_score": overall_score,
            "size_bytes": total_size,
            "debt": debt.data[0] if debt.data else {"debt_score": 80, "critical_count": 0, "major_count": 0, "minor_count": 0},
            "security": sec.data[0] if sec.data else {"security_score": 80, "vulnerabilities": []},
            "health_breakdown": breakdown
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 6. Get Architecture graph
@app.get("/api/repos/{id}/architecture")
def get_repo_architecture(id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Check ownership
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")
            
        res = supabase.table("architecture_reports").select("*").eq("repository_id", id).order("created_at", desc=True).limit(1).execute()
        if not res.data:
            return {"nodes": [], "edges": [], "summary": "No architecture graph generated."}
        return {
            "nodes": res.data[0]["graph_data"]["nodes"],
            "edges": res.data[0]["graph_data"]["edges"],
            "summary": res.data[0]["summary"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 7. Get Security report
@app.get("/api/repos/{id}/security")
def get_repo_security(id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Check ownership
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")
            
        res = supabase.table("security_reports").select("*").eq("repository_id", id).order("created_at", desc=True).limit(1).execute()
        if not res.data:
            return {"security_score": 100, "vulnerabilities": []}
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 8. Get Technical Debt report
@app.get("/api/repos/{id}/debt")
def get_repo_debt(id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Check ownership
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")
            
        res = supabase.table("technical_debt_reports").select("*").eq("repository_id", id).order("created_at", desc=True).limit(1).execute()
        if not res.data:
            return {"debt_score": 100, "critical_count": 0, "major_count": 0, "minor_count": 0, "issues": []}
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 9. Codebase Chat with RAG and Source Citations
@app.post("/api/repos/{id}/chat")
def chat_codebase(id: str, req: ChatRequest, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Check ownership (prevents cross-user access to private repositories).
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")

        # 1. Check or create chat session
        session_id = req.session_id
        if session_id:
            # Validate session ownership before reuse.
            sess = supabase.table("chat_sessions").select("repository_id").eq("id", session_id).execute()
            if not sess.data or sess.data[0]["repository_id"] != id:
                raise HTTPException(status_code=403, detail="Access denied to this chat session.")
        else:
            session = supabase.table("chat_sessions").insert({
                "repository_id": id,
                "title": req.message[:50]
            }).execute()
            session_id = session.data[0]["id"]

        # Save user message
        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "user",
            "content": req.message,
            "citations": []
        }).execute()

        # 2. Run RAG Vector Search
        query_vector = generate_embedding(req.message)

        citations = []
        context_parts = []
        try:
            matched_chunks = supabase.rpc("match_code_chunks", {
                "query_embedding": query_vector,
                "match_threshold": 0.25,
                "match_count": 5,
                "repo_id": id
            }).execute()
        except Exception as e:
            print(f"[chat] vector search failed for {id}: {e}")
            matched_chunks = type("R", (), {"data": []})()

        if matched_chunks.data:
            for idx, chunk in enumerate(matched_chunks.data):
                file_path = chunk["file_path"]
                chunk_text = chunk["chunk_text"]
                if file_path not in citations:
                    citations.append(file_path)
                context_parts.append(f"--- File: {file_path} (Chunk {idx}) ---\n{chunk_text}")

        context_str = "\n\n".join(context_parts)
        has_context = bool(context_parts)

        # 3. Ask the AI (Groq, server-side). Even with empty retrieval we return
        #    a useful, honest answer rather than silently producing nothing or
        #    faking citations.
        try:
            messages = _build_chat_messages(req.message, context_str, has_context)
            reply = generate_codebase_answer(messages)
            if not reply:
                raise GroqError("The AI service returned an empty response.", 502)
        except GroqError as e:
            print(f"[chat] AI call failed for session {session_id}: {e.message}")
            raise HTTPException(status_code=e.status_code, detail=e.message)

        # Save assistant message
        supabase.table("chat_messages").insert({
            "session_id": session_id,
            "role": "assistant",
            "content": reply,
            "citations": citations
        }).execute()

        return {
            "session_id": session_id,
            "content": reply,
            "citations": citations
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[chat] unexpected error for repo {id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while processing your question.")

# 9b. Streaming Codebase Chat (SSE) - the primary chat path.
# The user sees tokens as they are generated instead of waiting for the whole
# answer, and the UI can surface friendly errors instead of hanging.
def _emit(event: str, data: str):
    """Yield a standards-compliant SSE event (event line first, then data
    lines, terminated by a blank line). Data may contain newlines (markdown),
    which SSE encodes as multiple `data:` lines."""
    yield f"event: {event}\n"
    for line in str(data).split("\n"):
        yield f"data: {line}\n"
    yield "\n"


def _existing_reply_for(supabase, session_id: str, user_message: str, user_message_id: Optional[str]):
    """Find the already-persisted assistant reply that answers `user_message` in
    `session_id`, if one exists. Used to replay an exact duplicate request so we
    never run a second AI generation or insert a duplicate assistant row.

    Heuristic: locate the newest assistant message created after the identified
    user message row (or after the newest matching user row) in this session.
    Returns {"id", "content", "citations"} or None.
    """
    try:
        anchor_id = None
        if user_message_id:
            anchor_id = user_message_id
        else:
            rows = supabase.table("chat_messages") \
                .select("id", "created_at") \
                .eq("session_id", session_id) \
                .eq("role", "user") \
                .eq("content", user_message) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()
            if rows and rows.data:
                anchor_id = rows.data[0]["id"]
        if not anchor_id:
            return None

        # Candidate: the latest assistant message in this session.
        asst = supabase.table("chat_messages") \
            .select("id", "content", "citations", "created_at") \
            .eq("session_id", session_id) \
            .eq("role", "assistant") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        if not (asst and asst.data):
            return None
        latest = asst.data[0]
        if not latest.get("content"):
            return None
        return {
            "id": latest.get("id"),
            "content": latest["content"],
            "citations": latest.get("citations") or [],
        }
    except Exception as e:
        print(f"[chat] existing-reply lookup failed (proceeding): {e}")
        return None


@app.post("/api/repos/{id}/chat/stream")
def chat_codebase_stream(id: str, req: ChatRequest, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    import time as _time
    overall_start = _time.time()
    timings = {}
    print(f"[chat] stream request received for repo {id} request_id={req.request_id}")

    # Resolve session + ownership up-front (fast) so we can 4xx before streaming.
    # Idempotency: if this request_id was already handled by this process, reuse
    # the resolved session instead of creating a duplicate conversation/message.
    session_id = req.session_id
    cached_session_id = None
    if req.request_id:
        with _chat_cache_lock:
            cached_session_id = _chat_request_cache.get(req.request_id)

    # Reset user-message id each call; set when the user row is (re)created.
    user_message_id = None
    # True only when this exact submission was already handled (same request_id
    # seen in-process, or the DB dedupe guard matched the same question). Only
    # in that case may we replay an existing assistant reply instead of running
    # a new AI generation.
    known_duplicate = bool(cached_session_id)

    try:
        supabase = get_supabase_client(token)
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")

        if cached_session_id:
            # Duplicate submission already resolved -> replay that session.
            session_id = cached_session_id
        else:
            if session_id:
                sess = supabase.table("chat_sessions").select("repository_id").eq("id", session_id).execute()
                if not sess.data or sess.data[0]["repository_id"] != id:
                    raise HTTPException(status_code=403, detail="Access denied to this chat session.")

                # DB-backed idempotency guard (survives process restarts, unlike
                # the in-memory request cache). A browser retry of the exact same
                # question in the same conversation within the dedupe window would
                # otherwise create a duplicate user row whenever the backend has
                # restarted (uvicorn --reload, redeploy, multi-worker), because the
                # request_id -> session mapping lives only in memory.
                if _is_duplicate_submission(supabase, session_id, req.message):
                    known_duplicate = True
                    if req.request_id:
                        with _chat_cache_lock:
                            if len(_chat_request_cache) >= _CHAT_CACHE_MAX:
                                _chat_request_cache.clear()
                            _chat_request_cache.setdefault(req.request_id, session_id)
                    # Reuse the existing user message row so the UI can reference it.
                    dup = supabase.table("chat_messages") \
                        .select("id") \
                        .eq("session_id", session_id) \
                        .eq("role", "user") \
                        .eq("content", req.message) \
                        .order("created_at", desc=True) \
                        .limit(1) \
                        .execute()
                    if dup and dup.data:
                        user_message_id = dup.data[0].get("id")
                    # Fail fast: no new session, no new user row; the stream still
                    # answers below (idempotent replay of the same question).
            else:
                session = supabase.table("chat_sessions").insert({
                    "repository_id": id,
                    "title": req.message[:50]
                }).execute()
                session_id = session.data[0]["id"]

            if user_message_id is None:
                # Save the user message once. If the request_id is seen again we
                # skip this insert (idempotency).
                user_res = supabase.table("chat_messages").insert({
                    "session_id": session_id,
                    "role": "user",
                    "content": req.message,
                    "citations": []
                }).execute()
                if user_res and user_res.data:
                    user_message_id = user_res.data[0].get("id")

            if req.request_id:
                with _chat_cache_lock:
                    if len(_chat_request_cache) >= _CHAT_CACHE_MAX:
                        _chat_request_cache.clear()
                    _chat_request_cache[req.request_id] = session_id
    except HTTPException:
        raise
    except Exception as e:
        print(f"[chat] failed to resolve session for repo {id}: {e}")
        raise HTTPException(status_code=500, detail="Unable to start chat. Please try again.")
    timings["db_session_setup_ms"] = int((_time.time() - overall_start) * 1000)

    def generate():
        # Idempotent replay: if this exact duplicate request was already fully
        # answered (e.g. a network/browser retry of the same POST), replay the
        # persisted assistant reply instead of calling the AI again and creating
        # a duplicate assistant row. This guarantees one user interaction => one
        # AI call even when the same request_id arrives multiple times. Gated on
        # `known_duplicate` so a brand-new question always generates a fresh
        # answer and never reuses a previous reply.
        if known_duplicate:
            existing_reply = _existing_reply_for(supabase, session_id, req.message, user_message_id)
            if existing_reply is not None:
                yield from _emit("start", json.dumps({
                    "session_id": session_id,
                    "citations": existing_reply["citations"],
                    "user_message_id": user_message_id,
                    "request_id": req.request_id,
                    "assistant_message_id": existing_reply["id"],
                    "replayed": True,
                }))
                yield from _emit("delta", existing_reply["content"])
                yield from _emit("done", json.dumps({
                    "content": existing_reply["content"],
                    "citations": existing_reply["citations"],
                    "session_id": session_id,
                    "user_message_id": user_message_id,
                    "assistant_message_id": existing_reply["id"],
                    "request_id": req.request_id,
                    "replayed": True,
                }))
                print(f"[chat] replayed existing reply for request_id={req.request_id} session={session_id}")
                return

        # RAG: embedding + vector search.
        t0 = _time.time()
        query_vector = generate_embedding(req.message)
        timings["embedding"] = int((_time.time() - t0) * 1000)

        citations = []
        context_parts = []
        t0 = _time.time()
        try:
            matched = supabase.rpc("match_code_chunks", {
                "query_embedding": query_vector,
                "match_threshold": 0.25,
                "match_count": 5,
                "repo_id": id
            }).execute()
        except Exception as e:
            print(f"[chat] vector search failed for {id}: {e}")
            matched = type("R", (), {"data": []})()
        timings["vector_search"] = int((_time.time() - t0) * 1000)

        if matched.data:
            seen_files = set()
            for idx, chunk in enumerate(matched.data):
                file_path = chunk.get("file_path")
                chunk_text = chunk.get("chunk_text")
                if file_path and file_path not in seen_files:
                    seen_files.add(file_path)
                    citations.append(file_path)
                context_parts.append(f"--- File: {file_path} (Chunk {idx}) ---\n{chunk_text}")

        context_str = "\n\n".join(context_parts)
        has_context = bool(context_parts)
        messages = _build_chat_messages(req.message, context_str, has_context)

        # Emit start event with session_id + citations so the client can persist state.
        yield from _emit("start", json.dumps({
            "session_id": session_id,
            "citations": citations,
            "user_message_id": user_message_id,
            "request_id": req.request_id,
        }))

        full_reply = []
        ai_start_t = _time.time()
        try:
            first_token_t = None
            # Groq (OpenAI-compatible) token streaming, server-side only.
            for text in generate_codebase_answer_stream(messages):
                if text:
                    if first_token_t is None:
                        first_token_t = _time.time()
                        timings["first_token"] = int((first_token_t - overall_start) * 1000)
                        timings["ai_to_first_token_ms"] = int((first_token_t - ai_start_t) * 1000)
                    full_reply.append(text)
                    yield from _emit("delta", text)
        except GroqError as e:
            print(f"[chat] Groq stream failed for session {session_id}: {e.message}")
            yield from _emit("error", json.dumps({
                "code": e.status_code,
                "message": e.message,
                "request_id": req.request_id,
            }))
            return
        except Exception as e:
            print(f"[chat] Groq stream failed for session {session_id}: {e}")
            yield from _emit("error", json.dumps({
                "code": 502,
                "message": "Unable to generate an answer. The AI service is temporarily unavailable, please try again.",
                "request_id": req.request_id,
            }))
            return

        reply = "".join(full_reply).strip()

        # Save the assistant message once generation is complete.
        assistant_message_id = None
        stream_end_t = _time.time()
        try:
            asst_res = supabase.table("chat_messages").insert({
                "session_id": session_id,
                "role": "assistant",
                "content": reply,
                "citations": citations
            }).execute()
            if asst_res and asst_res.data:
                assistant_message_id = asst_res.data[0].get("id")
        except Exception as e:
            print(f"[chat] failed to persist assistant reply: {e}")
        timings["persist_ms"] = int((_time.time() - stream_end_t) * 1000)

        timings["stream_complete"] = int((_time.time() - overall_start) * 1000)
        print(f"[chat] completed in {_time.time() - overall_start:.2f}s, {len(reply)} chars, timings={timings}")
        yield from _emit("done", json.dumps({
            "content": reply,
            "citations": citations,
            "session_id": session_id,
            "user_message_id": user_message_id,
            "assistant_message_id": assistant_message_id,
            "request_id": req.request_id,
            "timings": timings,
        }))

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Fetch chat messages for a session
@app.get("/api/repos/{id}/chat/sessions")
def get_chat_sessions(id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Check ownership
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")
            
        res = supabase.table("chat_sessions").select("*").eq("repository_id", id).order("created_at", desc=True).execute()
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/sessions/{session_id}/messages")
def get_chat_messages(session_id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        # Check if session belongs to a repo owned by user
        session = supabase.table("chat_sessions").select("repository_id").eq("id", session_id).execute()
        if not session.data:
            raise HTTPException(status_code=404, detail="Chat session not found.")
        repo_id = session.data[0]["repository_id"]
        repo = supabase.table("repositories").select("id").eq("id", repo_id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this chat session.")
            
        res = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("created_at", desc=False).execute()
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 10. PR Review Agent using Gemini Pro
@app.post("/api/pr/review")
def review_pr(req: PRReviewRequest, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        
        # Verify ownership of target repository if provided
        if req.repository_id:
            repo = supabase.table("repositories").select("id").eq("id", req.repository_id).eq("user_id", user_id).execute()
            if not repo.data:
                raise HTTPException(status_code=403, detail="Access denied to this repository.")
                
        prompt = f"""
        You are an elite software engineering lead and security auditor.
        Review the following Git diff and output a structured analysis in JSON format.
        
        GIT DIFF:
        {req.diff_content}
        
        Output format should be EXACTLY (do not wrap in markdown or any other tags except raw JSON):
        {{
          "summary": "High-level summary of changes introduced in this PR and their scope.",
          "risk_level": "Low" or "Medium" or "High",
          "recommendations": [
            {{
              "file": "file_name.ts",
              "type": "Security" or "Performance" or "Maintainability" or "Styling",
              "description": "Specific code optimization or safety recommendation."
            }}
          ]
        }}
        
        Ensure your response is valid JSON only. Do not write markdown tags.
        """
        
        # Use the configured Gemini model for advanced logical reasoning on PR review diffs
        model = GEMINI_AI_MODEL
        response = get_genai_client().models.generate_content(model=model, contents=prompt)
        text = response.text.strip()
        
        # Clean up code blocks if model includes them
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        review_data = json.loads(text)
        
        # Store in db
        pr_record = supabase.table("pr_reviews").insert({
            "repository_id": req.repository_id,
            "diff_content": req.diff_content,
            "summary": review_data["summary"],
            "risk_level": review_data["risk_level"],
            "recommendations": review_data["recommendations"]
        }).execute()
        
        return pr_record.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RenameRepoRequest(BaseModel):
    display_name: str

class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str

# Delete repository and all its cascade-related records
@app.delete("/api/repos/{id}")
def delete_repository(id: str, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        res = supabase.table("repositories").delete().eq("id", id).eq("user_id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Repository not found or access denied.")
        return {"status": "ok", "message": "Repository and all analysis data deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Rename repository custom display name
@app.patch("/api/repos/{id}")
def rename_repository(id: str, req: RenameRepoRequest, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
    try:
        supabase = get_supabase_client(token)
        res = supabase.table("repositories").update({"display_name": req.display_name}).eq("id", id).eq("user_id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Repository not found or access denied.")
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Submit a public contact message to the SaaS support table
@app.post("/api/contact")
def submit_contact_message(req: ContactRequest):
    try:
        # Submit does not require user token since any website guest can submit
        supabase = get_supabase_client(None)
        res = supabase.table("contact_messages").insert({
            "name": req.name,
            "email": req.email,
            "subject": req.subject,
            "message": req.message
        }).execute()
        return {"status": "ok", "message": "Your message has been submitted. Thank you!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

