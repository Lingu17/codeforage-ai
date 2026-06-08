# CodeForge AI Main API Entrypoint (Supabase SDK patched)
import os
import httpx
import json
import google.generativeai as genai
from typing import Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_supabase_client
from scanner import scan_and_analyze_repository, generate_embedding

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
    "http://127.0.0.1:3001"
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

class PRReviewRequest(BaseModel):
    diff_content: str
    repository_id: Optional[str] = None

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    return {"status": "ok", "message": "CodeForge AI Backend is running."}

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
async def get_github_repositories(username: Optional[str] = None, token: Optional[str] = None):
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
def analyze_repository(req: AnalyzeRepoRequest, background_tasks: BackgroundTasks, user_id: str = Depends(get_authenticated_user_id), token: Optional[str] = Depends(get_auth_token)):
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
        job = supabase.table("repository_scans").insert({
            "repository_id": repo_id,
            "status": "queued",
            "progress": 0,
            "current_step": "Queued in background task manager"
        }).execute()
        job_id = job.data[0]["id"]
        
        # 4. Trigger background task
        background_tasks.add_task(scan_and_analyze_repository, req.repo_url, repo_id, job_id, token)
        
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
        # Check ownership
        repo = supabase.table("repositories").select("id").eq("id", id).eq("user_id", user_id).execute()
        if not repo.data:
            raise HTTPException(status_code=403, detail="Access denied to this repository.")
            
        # 1. Check or create chat session
        session_id = req.session_id
        if not session_id:
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
        
        # Query pgvector via match_code_chunks RPC helper
        matched_chunks = supabase.rpc("match_code_chunks", {
            "query_embedding": query_vector,
            "match_threshold": 0.25, # lower threshold for MVP flexibility
            "match_count": 5,
            "repo_id": id
        }).execute()
        
        citations = []
        context_parts = []
        
        if matched_chunks.data:
            for idx, chunk in enumerate(matched_chunks.data):
                file_path = chunk["file_path"]
                chunk_text = chunk["chunk_text"]
                
                # Deduplicate citations
                if file_path not in citations:
                    citations.append(file_path)
                    
                context_parts.append(f"--- File: {file_path} (Chunk {idx}) ---\n{chunk_text}")
                
        context_str = "\n\n".join(context_parts)
        
        # 3. Ask Gemini Flash
        prompt = f"""
        You are an expert programming assistant helping a developer understand this codebase.
        Answer the developer's question using the retrieved code context below.
        
        USER QUESTION:
        {req.message}
        
        RETRIEVED CODE CHUNKS:
        {context_str}
        
        INSTRUCTIONS:
        1. Base your answer strictly on the retrieved code chunks. If the answer cannot be found in the context, clearly explain that and offer general guidance.
        2. Keep your answer clear, informative, and formatted in markdown.
        3. Do NOT make up import paths or files. Use the exact files mentioned in the retrieved code chunks.
        4. List the files referenced as source citations at the very end of your answer.
        """
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        reply = response.text
        
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
        raise HTTPException(status_code=500, detail=str(e))

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
        
        # Use Gemini Pro for advanced logical reasoning on PR review diffs
        model = genai.GenerativeModel("gemini-2.5-pro")
        response = model.generate_content(prompt)
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

