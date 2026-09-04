import os
import tempfile
import subprocess
import shutil
import ast
import re
import hashlib
import json
import time
import threading
import concurrent.futures
from google.genai import Client, types
from datetime import datetime
from pathlib import Path
from database import get_supabase_client

# Gemini is accessed through the supported `google.genai` SDK. The legacy
# `google.generativeai` package is deprecated (support has ended) and must not
# be used. A single shared client is cached and reused across threads.
_genai_client = None
_genai_lock = threading.Lock()


def get_genai_client() -> Client:
    global _genai_client
    if _genai_client is None:
        with _genai_lock:
            if _genai_client is None:
                _genai_client = Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _genai_client


GEMINI_AI_MODEL = os.getenv("GEMINI_AI_MODEL", "gemini-3.5-flash")
EMBED_MODEL = os.getenv("EMBED_MODEL", "models/gemini-embedding-2")
EMBED_DIM = int(os.getenv("EMBED_DIM", "768"))

# Independent scan stages (in execution order). Each reports its own real state.
STAGE_ORDER = ["clone", "index", "embed", "architecture", "security", "health"]
STAGE_WEIGHTS = {
    "clone": 10,
    "index": 20,
    "embed": 25,
    "architecture": 15,
    "security": 15,
    "health": 15,
}

# Files that produce huge numbers of noisy chunks but add little RAG value.
LOCK_FILE_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "pnpm-lock.yml",
    "shrinkwrap.yaml", "npm-shrinkwrap.json", "bun.lockb", "bun.lock",
    "cargo.lock", "go.sum", "composer.lock", "gemfile.lock", "flake.lock",
    "poetry.lock", "pip.lock", "pipfile.lock", "uv.lock",
}
MAX_EMBED_FILE_SIZE = 1024 * 1024

# Embedding pipeline knobs
EMBED_WORKERS = 4
CHUNK_INSERT_BATCH = 100
STAGE_PERSIST_INTERVAL = 1.0  # seconds between progress writes to the DB


def _now_iso():
    return datetime.utcnow().isoformat()


def initial_stages():
    return {stage: {"status": "pending"} for stage in STAGE_ORDER}


def compute_aggregate(stages):
    """Derive the overall job status + a monotonic progress number from real per-stage states."""
    total = 0.0
    statuses = []
    for stage in STAGE_ORDER:
        st = stages.get(stage) or {}
        status = st.get("status", "pending")
        statuses.append(status)
        if status == "completed":
            total += STAGE_WEIGHTS[stage]
        elif status in ("running", "failed"):
            # A failed stage keeps its last real progress so the aggregate never regresses.
            pct = st.get("progress")
            if pct is None or pct < 5:
                pct = 5
            total += STAGE_WEIGHTS[stage] * (pct / 100.0)

    if all(s == "completed" for s in statuses):
        return "completed", 100

    if all(s in ("completed", "failed") for s in statuses):
        completed_any = any(s == "completed" for s in statuses)
        if not completed_any:
            return "failed", min(int(total), 99)
        return "completed", min(int(total), 99)

    # Fatal stages: if cloning or indexing failed there is nothing to analyse.
    if any(stages.get(s, {}).get("status") == "failed" for s in ("clone", "index")):
        return "failed", min(int(total), 99)

    if all(s == "pending" for s in statuses):
        return "queued", 0

    active = "analyzing"
    for stage in STAGE_ORDER:
        st = stages.get(stage) or {}
        status = st.get("status", "pending")
        if status == "completed":
            continue
        if status == "pending":
            if stage in ("clone", "index"):
                active = {"clone": "queued", "index": "cloning"}[stage]
            break
        active = {
            "clone": "cloning",
            "index": "scanning",
            "embed": "embedding",
            "architecture": "analyzing",
            "security": "analyzing",
            "health": "analyzing",
        }[stage]
        break

    return active, min(int(total), 99)


class ScanRunner:
    """Thread-safe per-scan state that persists each stage's real status + aggregate progress."""

    def __init__(self, supabase, job_id, token=None):
        self.supabase = supabase
        self.job_id = job_id
        self.token = token
        self.stages = initial_stages()
        self._lock = threading.Lock()
        self._last_persist_ts = 0.0

    def set_stage(self, stage, status, progress=None, message=None, error=None):
        with self._lock:
            st = self.stages.setdefault(stage, {})
            if status == "failed":
                # Keep a monotonic floor for the aggregate so the UI never sees regressions.
                if st.get("progress") is None:
                    st["progress"] = 5
                if error:
                    st["error"] = str(error)[:1000]
            st["status"] = status
            if progress is not None:
                st["progress"] = int(progress)
            if message is not None:
                st["message"] = message
            if status == "completed":
                st.pop("error", None)
                st.pop("message", None)
                st.pop("progress", None)

            agg_status, agg_progress = compute_aggregate(self.stages)
            now = time.time()
            terminal = agg_status in ("completed", "failed")
            # Persist immediately on terminal states / failures, otherwise throttle.
            if terminal or status == "failed" or (now - self._last_persist_ts) >= STAGE_PERSIST_INTERVAL:
                self._last_persist_ts = now
                self._persist(agg_status, agg_progress)

    def _persist(self, status, progress):
        payload = {
            "status": status,
            "progress": int(round(progress)),
            "current_step": json.dumps(self.stages, default=str),
        }
        if status in ("completed", "failed"):
            payload["completed_at"] = _now_iso()
        try:
            self.supabase.table("repository_scans").update({**payload, "stages": self.stages}).eq("id", self.job_id).execute()
        except Exception as e:
            # `stages` column may not exist in the DB yet; mirror the JSON in current_step instead.
            print(f"[scan] stages column unavailable, using current_step mirror: {e}")
            try:
                self.supabase.table("repository_scans").update(payload).eq("id", self.job_id).execute()
            except Exception as persist_err:
                print(f"[scan] failed to persist job status for {self.job_id}: {persist_err}")


def parse_python_file(content: str):
    classes = []
    functions = []
    imports = []
    try:
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                classes.append(node.name)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                functions.append(node.name)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                prefix = "." * node.level if getattr(node, "level", 0) > 0 else ""
                if node.module:
                    imports.append(prefix + node.module)
                else:
                    for alias in node.names:
                        imports.append(prefix + alias.name)
    except Exception:
        pass
    return {"classes": classes, "functions": functions, "imports": imports, "exports": []}

def parse_js_ts_file(content: str):
    # Regex-based parser for JavaScript/TypeScript
    classes = re.findall(r'class\s+([A-Za-z0-9_]+)', content)
    functions = re.findall(r'function\s+([A-Za-z0-9_]+)', content)
    
    # Arrow functions assigned to const/let/var
    arrow_funcs = re.findall(r'(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*=>', content)
    functions.extend(arrow_funcs)
    
    # Standard ES module imports
    imports_found = re.findall(r'import\s+.*?\s+from\s+[\'"](.*?)[\'"]', content)
    side_effects = re.findall(r'import\s+[\'"](.*?)[\'"]', content)
    exports_from = re.findall(r'export\s+.*?\s+from\s+[\'"](.*?)[\'"]', content)
    dynamic = re.findall(r'import\s*\(\s*[\'"](.*?)[\'"]\s*\)', content)
    # CommonJS require statements
    requires_found = re.findall(r'require\s*\(\s*[\'"](.*?)[\'"]\s*\)', content)
    
    all_imports = set(imports_found + side_effects + exports_from + dynamic + requires_found)
    imports = [i for i in all_imports if i and not i.startswith('from ')]
    
    exports = re.findall(r'export\s+(?:default\s+)?(?:class|function|const|let|var)\s+([A-Za-z0-9_]+)', content)
    
    return {"classes": classes, "functions": functions, "imports": imports, "exports": exports}

def parse_java_kotlin_file(content: str):
    # Find classes/interfaces/objects
    classes = re.findall(r'\b(?:class|interface|object)\s+([A-Za-z0-9_]+)', content)
    
    # Kotlin functions
    kotlin_funcs = re.findall(r'\bfun\s+([A-Za-z0-9_]+)', content)
    # Java methods
    java_funcs = re.findall(r'(?:public|protected|private|static|\s)\s+[\w\<\>\[\]]+\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?:\{|throws|\b)', content)
    
    # Remove Java keywords that might be matched accidentally as methods
    java_keywords = {'if', 'for', 'while', 'switch', 'catch', 'synchronized', 'return', 'new', 'throw', 'else'}
    functions = [f for f in list(set(kotlin_funcs + java_funcs)) if f not in java_keywords]
    
    imports = re.findall(r'\bimport\s+([A-Za-z0-9_.]+)', content)
    
    return {"classes": classes, "functions": functions, "imports": imports, "exports": []}

def parse_go_rust_file(content: str, ext: str):
    classes = []
    functions = []
    imports = []
    
    if ext == '.go':
        # Go structs and interfaces as "classes"
        classes = re.findall(r'\btype\s+([A-Za-z0-9_]+)\s+(?:struct|interface)\b', content)
        # Go functions
        functions = re.findall(r'\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z0-9_]+)\s*\(', content)
        # Go imports (both single line and multi-line block)
        single_imports = re.findall(r'\bimport\s+"([^"]+)"', content)
        multi_imports_block = re.findall(r'\bimport\s*\(\s*([\s\S]*?)\s*\)', content)
        for block in multi_imports_block:
            imports.extend(re.findall(r'"([^"]+)"', block))
        imports.extend(single_imports)
        
    elif ext == '.rs':
        # Rust structs, traits, and enums as "classes"
        classes = re.findall(r'\b(?:struct|trait|enum)\s+([A-Za-z0-9_]+)', content)
        # Rust functions
        functions = re.findall(r'\bfn\s+([A-Za-z0-9_]+)', content)
        # Rust use statements
        use_statements = re.findall(r'\buse\s+([A-Za-z0-9_::*{}]+);', content)
        imports = list(set(use_statements))
        
    return {"classes": classes, "functions": list(set(functions)), "imports": list(set(imports)), "exports": []}

def generate_chunks(text: str, chunk_size: int = 1500, overlap: int = 200) -> list[str]:
    """Splits a file into overlapping chunks for RAG."""
    chunks = []
    if not text:
        return chunks
        
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += (chunk_size - overlap)
        
    return chunks

def _embed_text(text: str) -> list[float]:
    """Generates one embedding vector for a single text chunk."""
    res = get_genai_client().models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="retrieval_document",
            output_dimensionality=EMBED_DIM,
        ),
    )
    embeddings = res.embeddings
    if embeddings and embeddings[0].values:
        return list(embeddings[0].values)
    raise ValueError("Empty embedding response from Gemini")


def generate_embedding(text: str) -> list[float]:
    """Generates a single embedding vector for a given text chunk (used by chat RAG)."""
    try:
        return _embed_text(text)
    except Exception as e:
        print(f"Error generating embedding: {e}")
        # Return fallback zero vector if API fails to avoid breaking insert
        return [0.0] * EMBED_DIM


def embed_chunks_batch(chunks: list[str]) -> list[list[float] | None]:
    """
    Embeds many chunks, preserving order and alignment with the input list.
    Important: with `gemini-embedding-2` the current SDK returns ONE embedding
    when given a list of contents, so we embed each chunk individually.
    A chunk that fails to embed maps to `None` so the caller can skip it
    instead of persisting a meaningless zero vector that would poison RAG.
    """
    vectors: list[list[float] | None] = []
    for c in chunks:
        try:
            vectors.append(_embed_text(c))
        except Exception as e:
            print(f"Embedding a chunk failed: {e}")
            vectors.append(None)
    return vectors

def resolve_import_path(source_rel_path: str, import_str: str, file_paths: list) -> str:
    # Build a lookup for fast resolution without extensions
    path_lookup = {}
    for p in file_paths:
        path_without_ext = os.path.splitext(p)[0]
        path_lookup[path_without_ext] = p
        path_lookup[p] = p
        # Also index files: folder/index.ts -> folder
        if os.path.basename(p).startswith("index."):
            folder = os.path.dirname(p)
            if folder:
                path_lookup[folder] = p
            
    # Remove extensions from import_str if present for TS/JS
    import_str_clean = os.path.splitext(import_str)[0]
    
    # 1. Relative paths
    if import_str.startswith('.'):
        source_dir = os.path.dirname(source_rel_path)
        # Normalize the relative path
        target = os.path.normpath(os.path.join(source_dir, import_str_clean)).replace('\\', '/')
        if target in path_lookup:
            return path_lookup[target]
            
    # 2. Absolute or alias paths (e.g. @/components/Button, src/components/Button)
    # Strip common alias prefixes if any
    clean_alias = import_str_clean.replace('@/', '')
    clean_alias = clean_alias.replace('~/', '')
    
    # Direct match
    if clean_alias in path_lookup:
        return path_lookup[clean_alias]
        
    # Python style import paths: 'app.services.auth' -> 'app/services/auth.py'
    python_path = import_str_clean.replace('.', '/')
    if python_path in path_lookup:
        return path_lookup[python_path]
        
    # Search for suffix match as a last resort
    possible_matches = []
    for p_no_ext, actual_p in path_lookup.items():
        if p_no_ext.endswith(clean_alias) or p_no_ext.endswith(python_path):
            possible_matches.append(actual_p)
            
    if len(possible_matches) == 1:
        return possible_matches[0]
        
    return None

def resolve_dependency_graph(scanned_files: list[dict]) -> dict:
    """
    Programmatically builds a React Flow compatible dependency graph.
    Resolves imports to other files within the repository.
    """
    nodes = []
    edges = []
    
    # Track all valid node IDs
    file_paths = [f["file_path"] for f in scanned_files]
    
    # 1. Create Nodes (layout in a circle/spiral)
    import math
    num_nodes = len(scanned_files)
    for i, file_info in enumerate(scanned_files):
        # Calculate visual positions in a spiral layout for React Flow
        angle = i * (2 * math.pi / max(num_nodes, 1))
        radius = 150 + (i * 15)
        x = 400 + radius * math.cos(angle)
        y = 300 + radius * math.sin(angle)
        
        rel_path = file_info["file_path"]
        basename = os.path.basename(rel_path)
        
        # Color nodes by language
        color = "#3b82f6"  # Blue for TS/JS
        if file_info["language"] == "python":
            color = "#22c55e"  # Green
        elif rel_path.endswith(('.ts', '.tsx')):
            color = "#60a5fa"
            
        nodes.append({
            "id": rel_path,
            "type": "default",
            "data": { 
                "label": f"{basename}\n({file_info['language']})"
            },
            "position": { "x": int(x), "y": int(y) },
            "style": {
                "background": "#18181b",
                "color": "#ffffff",
                "border": f"2px solid {color}",
                "borderRadius": "8px",
                "padding": "10px",
                "fontSize": "11px",
                "width": 150,
                "textAlign": "center"
            }
        })
        
        # 2. Match imports to files to create Edges
        for imp in file_info["imports"]:
            target_path = resolve_import_path(rel_path, imp, file_paths)
                        
            if target_path and target_path != rel_path:
                edge_id = f"edge-{rel_path}-{target_path}"
                edges.append({
                    "id": edge_id,
                    "source": rel_path,
                    "target": target_path,
                    "animated": True,
                    "style": { "stroke": "#52525b" }
                })
                
    # Deduplicate edges
    unique_edges = {e["id"]: e for e in edges}.values()
                
    return { "nodes": nodes, "edges": list(unique_edges) }

def _build_file_summary(scanned_files: list[dict], cap: int = 100):
    total_functions = 0
    total_classes = 0
    summary_data = []
    for f in scanned_files:
        total_functions += len(f["functions"])
        total_classes += len(f["classes"])
        if len(summary_data) < cap:
            summary_data.append({
                "file_path": f["file_path"],
                "language": f["language"],
                "size_bytes": len(f["code_content"]),
                "classes": f["classes"],
                "functions": f["functions"],
                "imports": f["imports"]
            })
    return {
        "total_files": len(scanned_files),
        "total_functions": total_functions,
        "total_classes": total_classes,
        "summary_json": json.dumps(summary_data),
    }

def _generate_ai_json(prompt: str) -> dict:
    response = get_genai_client().models.generate_content(model=GEMINI_AI_MODEL, contents=prompt)
    text = response.text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())

def run_ai_security_analysis(scanned_files: list[dict]) -> dict:
    """Independent AI stage that only produces the security report."""
    info = _build_file_summary(scanned_files)
    prompt = f"""
    You are an elite security auditor. Analyze the metadata of the following codebase files:

    Total Files: {info['total_files']}
    Total Functions: {info['total_functions']}
    Total Classes: {info['total_classes']}

    File Metadata List:
    {info['summary_json']}

    Perform a security audit and return EXACTLY the following JSON (no markdown code blocks, raw JSON only):
    {{
      "security_score": 90,
      "vulnerabilities": [
        {{
          "severity": "High" or "Medium" or "Low",
          "file": "path/to/file",
          "line": 45,
          "description": "Short description of potential security warning."
        }}
      ]
    }}

    Notes:
    - Flag exposed tokens, injection risks, unsafe deserialization, and missing input validation.
    - Mock hardcoded tokens if file metadata suggests .env loaded keys or similar configurations.
    - Return ONLY valid JSON matching the structure above.
    """
    return _generate_ai_json(prompt)

def run_ai_health_analysis(scanned_files: list[dict]) -> dict:
    """Independent AI stage that produces summary, health breakdown and tech debt."""
    info = _build_file_summary(scanned_files)
    prompt = f"""
    You are an expert software engineer and code auditor. Analyze the metadata of the following codebase files:

    Total Files: {info['total_files']}
    Total Functions: {info['total_functions']}
    Total Classes: {info['total_classes']}

    File Metadata List:
    {info['summary_json']}

    Please perform an audit and generate a JSON report with EXACTLY the following structure (do not output any markdown code blocks, just raw JSON, and ensure it parses successfully):
    {{
      "summary": {{
        "tech_stack": ["Next.js", "FastAPI", "Python", "TypeScript", "Tailwind CSS"],
        "architecture": "Monolith" or "Microservices" or "Serverless" or "Modular",
        "files_count": {info['total_files']},
        "functions_count": {info['total_functions']},
        "services_count": 5,
        "database": "PostgreSQL" or "SQLite" or "MongoDB" or "None",
        "risk_level": "Low" or "Medium" or "High",
        "health_score": 82
      }},
      "health": {{
        "architecture_score": 85,
        "security_score": 90,
        "maintainability_score": 78,
        "testing_score": 80,
        "performance_score": 85,
        "breakdown": {{
          "architecture": "Clean separation of layers, but some cyclic references found.",
          "security": "Generally secure. Low risk of injections.",
          "maintainability": "Large files found in routes, should be broken down.",
          "testing": "Testing coverage and mock suites are present.",
          "performance": "Good query layouts, minor resource bottlenecks."
        }}
      }},
      "tech_debt": {{
        "debt_score": 75,
        "critical_count": 1,
        "major_count": 3,
        "minor_count": 6,
        "issues": [
          {{
            "severity": "critical" or "major" or "minor",
            "file": "path/to/file",
            "type": "Large Function" or "Circular Dependency" or "Dead Code" or "Duplicate Imports",
            "description": "Short explanation of the issue."
          }}
        ]
      }}
    }}

    Notes:
    - Assess debt based on the sizes of files and import structures.
    - Return ONLY valid JSON matching the structure. Do not surround with markdown code blocks (e.g. do not write ```json).
    """
    return _generate_ai_json(prompt)

def should_embed(f: dict) -> bool:
    if not f.get("code_content") or not f["code_content"].strip():
        return False
    name = os.path.basename(f["file_path"]).lower()
    if name in LOCK_FILE_NAMES or name.endswith(".lock") or name.endswith(".map"):
        return False
    if ".min." in name:
        return False
    if f.get("size", 0) > MAX_EMBED_FILE_SIZE:
        return False
    return True


# ---------------------------------------------------------------------------
# Stage 1: Clone
# ---------------------------------------------------------------------------
def clone_repository(runner: ScanRunner, repo_url: str, github_token, temp_dir: str):
    runner.set_stage("clone", "running", progress=10, message="Cloning repository...")

    clone_url = repo_url
    if github_token:
        # Inject OAuth token for cloning private repository safely
        if "github.com" in clone_url:
            clone_url = clone_url.replace("https://github.com/", f"https://x-access-token:{github_token}@github.com/")
            clone_url = clone_url.replace("http://github.com/", f"https://x-access-token:{github_token}@github.com/")

    print(f"Cloning {repo_url}")
    try:
        # Clone shallow for fast retrieval
        subprocess.run(["git", "clone", "--depth", "1", clone_url, temp_dir], check=True, capture_output=True)
    except subprocess.CalledProcessError as err:
        err_msg = str(err)
        stderr_decoded = err.stderr.decode('utf-8', errors='ignore') if err.stderr else ""
        if github_token:
            err_msg = err_msg.replace(github_token, "MASKED_TOKEN")
            stderr_decoded = stderr_decoded.replace(github_token, "MASKED_TOKEN")
        runner.set_stage("clone", "failed", error=f"Git clone failed: {err_msg}. Details: {stderr_decoded}")
        raise

    runner.set_stage("clone", "completed", progress=100, message="Repository cloned")


# ---------------------------------------------------------------------------
# Stage 2: Index / parse files
# ---------------------------------------------------------------------------
CODE_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx',
    '.java', '.kt', '.kts', '.go', '.rs',
    '.cpp', '.c', '.cc', '.h', '.hpp', '.cs', '.php'
}
METADATA_EXTENSIONS = {
    '.md', '.txt', '.json', '.yaml', '.yml',
    '.toml', '.xml', '.gradle', '.conf', '.ini'
}
METADATA_NAMES = {
    'dockerfile', 'makefile', 'jenkinsfile', 'cargo.toml', 'package.json',
    'requirements.txt', 'pom.xml', 'build.gradle', 'docker-compose.yml', '.env.example'
}

def _parse_file(content: str, ext: str, file: str) -> tuple:
    if ext == '.py':
        return 'python', parse_python_file(content)
    if ext in ['.js', '.jsx']:
        return 'javascript', parse_js_ts_file(content)
    if ext in ['.ts', '.tsx']:
        return 'typescript', parse_js_ts_file(content)
    if ext == '.java':
        return 'java', parse_java_kotlin_file(content)
    if ext in ['.kt', '.kts']:
        return 'kotlin', parse_java_kotlin_file(content)
    if ext == '.go':
        return 'go', parse_go_rust_file(content, ext)
    if ext == '.rs':
        return 'rust', parse_go_rust_file(content, ext)
    if ext in ['.cpp', '.c', '.cc', '.h', '.hpp']:
        return 'cpp', {"classes": [], "functions": [], "imports": [], "exports": []}
    if ext == '.cs':
        return 'csharp', {"classes": [], "functions": [], "imports": [], "exports": []}
    if ext == '.php':
        return 'php', {"classes": [], "functions": [], "imports": [], "exports": []}

    if ext == '.md':
        return 'markdown', {"classes": [], "functions": [], "imports": [], "exports": []}
    if ext == '.json':
        return 'json', {"classes": [], "functions": [], "imports": [], "exports": []}
    if ext in ['.yaml', '.yml']:
        return 'yaml', {"classes": [], "functions": [], "imports": [], "exports": []}
    if ext == '.toml':
        return 'toml', {"classes": [], "functions": [], "imports": [], "exports": []}
    if ext == '.xml':
        return 'xml', {"classes": [], "functions": [], "imports": [], "exports": []}
    if 'dockerfile' in file.lower():
        return 'dockerfile', {"classes": [], "functions": [], "imports": [], "exports": []}
    if 'makefile' in file.lower():
        return 'makefile', {"classes": [], "functions": [], "imports": [], "exports": []}
    return 'text', {"classes": [], "functions": [], "imports": [], "exports": []}


def collect_files(temp_dir: str) -> list[dict]:
    scanned_files = []
    for root, dirs, files in os.walk(temp_dir):
        if any(p in root for p in ['.git', 'node_modules', 'venv', '__pycache__', '.next', 'dist', 'build']):
            continue

        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, temp_dir).replace('\\', '/')
            ext = os.path.splitext(file)[1].lower()
            lower_name = file.lower()

            if lower_name in LOCK_FILE_NAMES or lower_name.endswith(('.lock', '.map')):
                continue

            is_code = ext in CODE_EXTENSIONS
            is_metadata = ext in METADATA_EXTENSIONS or lower_name in METADATA_NAMES
            if not (is_code or is_metadata):
                continue

            try:
                size = os.path.getsize(file_path)
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

                language = "unknown"
                metadata = {"classes": [], "functions": [], "imports": [], "exports": []}
                if is_code:
                    language, metadata = _parse_file(content, ext, file)
                elif is_metadata:
                    language, metadata = _parse_file(content, ext, file)

                scanned_files.append({
                    "file_path": rel_path,
                    "language": language,
                    "size": size,
                    "hash": file_hash,
                    "code_content": content,  # Used locally for chunking and prompts, NOT stored in code_files table
                    "classes": metadata["classes"],
                    "functions": metadata["functions"],
                    "imports": metadata["imports"],
                    "exports": metadata["exports"]
                })
            except Exception as file_err:
                print(f"Failed to read file {rel_path}: {file_err}")

    return scanned_files


def build_file_row(f: dict, repository_id: str) -> dict:
    return {
        "repository_id": repository_id,
        "file_path": f["file_path"],
        "language": f["language"],
        "size": f["size"],
        "hash": f["hash"],
        "classes": f["classes"],
        "functions": f["functions"],
        "imports": f["imports"],
        "exports": f["exports"]
    }


def get_chunked_file_paths(supabase, repository_id) -> set:
    paths = set()
    offset = 0
    while True:
        rows = supabase.table("code_chunks") \
            .select("file_path") \
            .eq("repository_id", repository_id) \
            .range(offset, offset + 999) \
            .execute().data
        if not rows:
            break
        paths.update(r["file_path"] for r in rows)
        if len(rows) < 1000:
            break
        offset += 1000
    return paths


def _vector_is_zero(vec: str) -> bool:
    """PostgREST returns a pgvector as a string like '[0.0,0.0,...]'."""
    if not vec:
        return True
    s = vec.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            if abs(float(part)) > 1e-9:
                return False
        except ValueError:
            continue
    return True


def get_zero_embedded_paths(supabase, repository_id) -> set:
    """Returns file paths that already have chunks but all are zero vectors.

    Zero vectors are silently written when an embedding API call fails (e.g. the
    deprecated SDK used to fall back to a zero vector). They break RAG cosine
    similarity, so such files must be re-embedded on the next scan.
    """
    bad = set()
    offset = 0
    file_has_nonzero = {}
    while True:
        rows = supabase.table("code_chunks") \
            .select("file_path", "embedding") \
            .eq("repository_id", repository_id) \
            .range(offset, offset + 499) \
            .execute().data
        for r in rows:
            if _vector_is_zero(r.get("embedding")):
                file_has_nonzero.setdefault(r["file_path"], False)
            else:
                file_has_nonzero[r["file_path"]] = True
        if len(rows) < 500:
            break
        offset += 500
    for path, is_good in file_has_nonzero.items():
        if not is_good:
            bad.add(path)
    return bad


def index_repository(runner: ScanRunner, token, repository_id: str, scanned_files: list[dict]):
    """Writes file metadata and decides which files need fresh embeddings (caches unchanged ones)."""
    runner.set_stage("index", "running", progress=10, message="Saving repository file structure...")
    supabase = get_supabase_client(token)

    existing = supabase.table("repository_files") \
        .select("id", "file_path", "hash") \
        .eq("repository_id", repository_id) \
        .execute().data
    existing_map = {r["file_path"]: r for r in existing}

    chunked_paths = get_chunked_file_paths(supabase, repository_id)
    # Files that were embedded but only hold zero vectors must be re-embedded.
    zero_embedded = get_zero_embedded_paths(supabase, repository_id)

    current_paths = {f["file_path"] for f in scanned_files}

    # Files that no longer exist in the repository
    removed_paths = [p for p in existing_map if p not in current_paths]
    if removed_paths:
        supabase.table("repository_files").delete() \
            .eq("repository_id", repository_id) \
            .in_("file_path", removed_paths) \
            .execute()

    new_files = []
    to_embed = []
    changed_ids = []
    for f in scanned_files:
        prev = existing_map.get(f["file_path"])
        if prev is None:
            new_files.append(f)
            to_embed.append(f)
        elif prev.get("hash") != f["hash"]:
            to_embed.append(f)
            changed_ids.append(prev["id"])
        elif f["file_path"] not in chunked_paths:
            # File content unchanged but chunks are missing → (re)embed it.
            to_embed.append(f)
        elif f["file_path"] in zero_embedded:
            # File unchanged but cached embeddings are zero vectors → re-embed.
            to_embed.append(f)
            changed_ids.append(prev["id"])
        # else: unchanged and already chunked → reuse cached embeddings.

    # Drop stale chunks for changed files (they get re-embedded below).
    if changed_ids:
        supabase.table("code_chunks").delete() \
            .eq("repository_id", repository_id) \
            .in_("file_id", changed_ids) \
            .execute()

    # Update metadata rows for changed files.
    for f in scanned_files:
        prev = existing_map.get(f["file_path"])
        if prev is not None and prev.get("hash") != f["hash"]:
            supabase.table("repository_files").update(build_file_row(f, repository_id)) \
                .eq("id", prev["id"]) \
                .execute()

    # Bulk-insert brand new files (single request instead of one per file).
    file_id_map = {p: rec["id"] for p, rec in existing_map.items() if p in current_paths}
    if new_files:
        inserted = supabase.table("repository_files").insert(
            [build_file_row(f, repository_id) for f in new_files]
        ).execute()
        for row in inserted.data:
            file_id_map[row["file_path"]] = row["id"]
        # Fallback: pull any ids the bulk insert did not return.
        for f in new_files:
            if f["file_path"] not in file_id_map:
                got = supabase.table("repository_files") \
                    .select("id") \
                    .eq("repository_id", repository_id) \
                    .eq("file_path", f["file_path"]) \
                    .execute().data
                if got:
                    file_id_map[f["file_path"]] = got[0]["id"]

    runner.set_stage("index", "completed", progress=100, message=f"Indexed {len(scanned_files)} files")
    return file_id_map, to_embed


# ---------------------------------------------------------------------------
# Stage 3: Embeddings (batched, concurrent, cached for unchanged files)
# ---------------------------------------------------------------------------
def _embed_one(repository_id: str, f: dict, file_id: str) -> str:
    if not should_embed(f):
        return "skipped"

    chunks = generate_chunks(f["code_content"])
    if not chunks:
        return "empty"

    client = get_supabase_client()
    vectors = embed_chunks_batch(chunks)

    rows = []
    for i, chunk in enumerate(chunks):
        vec = vectors[i] if i < len(vectors) else None
        if not vec:
            # Skip chunks that failed to embed instead of persisting a zero
            # vector (which would silently break RAG cosine similarity).
            continue
        rows.append({
            "repository_id": repository_id,
            "file_id": file_id,
            "file_path": f["file_path"],
            "chunk_index": i,
            "chunk_text": chunk,
            "embedding": vec,
            "language": f["language"]
        })

    for i in range(0, len(rows), CHUNK_INSERT_BATCH):
        client.table("code_chunks").insert(rows[i:i + CHUNK_INSERT_BATCH]).execute()
    return "embedded"


def run_embed_stage(runner: ScanRunner, token, repository_id: str, file_id_map: dict, to_embed: list[dict]):
    runner.set_stage("embed", "running", progress=2, message="Generating embeddings...")

    targets = [f for f in to_embed if f["file_path"] in file_id_map]
    total = len(targets)
    if total == 0:
        runner.set_stage("embed", "completed", progress=100, message="No new chunks to embed")
        return

    done = 0
    skipped = 0
    failures = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=EMBED_WORKERS) as pool:
        futures = [
            (pool.submit(_embed_one, repository_id, f, file_id_map[f["file_path"]]), f)
            for f in targets
        ]
        for future, f in concurrent.futures.as_completed([t[0] for t in futures]):
            done += 1
            try:
                result = future.result()
                if result == "skipped":
                    skipped += 1
            except Exception as e:
                failures.append(f["file_path"])
                print(f"[scan] embedding failed for {f['file_path']}: {e}")

            pct = int(2 + (done / total) * 96)
            runner.set_stage("embed", "running", progress=pct, message=f"Embedding {done}/{total}")

    if failures and len(failures) >= total:
        runner.set_stage("embed", "failed", progress=100, error=f"Embedding failed for {len(failures)} files: {', '.join(failures[:5])}")
    else:
        note = f"Embedded {done - skipped} files"
        if skipped:
            note += f" ({skipped} skipped)"
        if failures:
            note += f", {len(failures)} errored"
        runner.set_stage("embed", "completed", progress=100, message=note)


# ---------------------------------------------------------------------------
# Stage 4: Architecture graph (local only, no Gemini)
# ---------------------------------------------------------------------------
def run_architecture_stage(runner: ScanRunner, token, repository_id: str, scanned_files: list[dict]):
    runner.set_stage("architecture", "running", progress=10, message="Building import graph...")
    try:
        supabase = get_supabase_client(token)
        graph_data = resolve_dependency_graph(scanned_files)
        summary = f"Visual dependency layout containing {len(graph_data['nodes'])} files and {len(graph_data['edges'])} imports."
        supabase.table("architecture_reports").insert({
            "repository_id": repository_id,
            "graph_data": graph_data,
            "summary": summary
        }).execute()
        runner.set_stage("architecture", "completed", progress=100,
                         message=f"{len(graph_data['nodes'])} files, {len(graph_data['edges'])} edges")
    except Exception as e:
        runner.set_stage("architecture", "failed", error=f"Architecture graph failed: {e}")


# ---------------------------------------------------------------------------
# Stage 5: Security analysis (independent Gemini call)
# ---------------------------------------------------------------------------
def run_security_stage(runner: ScanRunner, token, repository_id: str, scanned_files: list[dict]):
    runner.set_stage("security", "running", progress=10, message="Auditing repository for vulnerabilities...")
    try:
        supabase = get_supabase_client(token)
        report = run_ai_security_analysis(scanned_files)
        supabase.table("security_reports").insert({
            "repository_id": repository_id,
            "security_score": report.get("security_score", 80),
            "vulnerabilities": report.get("vulnerabilities", [])
        }).execute()
        runner.set_stage("security", "completed", progress=100,
                         message=f"{len(report.get('vulnerabilities', []))} findings")
    except Exception as e:
        runner.set_stage("security", "failed", error=f"Security analysis failed: {e}")


# ---------------------------------------------------------------------------
# Stage 6: Health calculation (independent Gemini call)
# ---------------------------------------------------------------------------
def run_health_stage(runner: ScanRunner, token, repository_id: str, scanned_files: list[dict]):
    runner.set_stage("health", "running", progress=10, message="Calculating health score...")
    try:
        supabase = get_supabase_client(token)
        report = run_ai_health_analysis(scanned_files)

        summary = report.get("summary", {})
        health_info = report.get("health", {})
        tech_debt = report.get("tech_debt", {})

        arch_score = health_info.get("architecture_score", 80) or 80
        sec_score = health_info.get("security_score", 80) or 80
        maint_score = health_info.get("maintainability_score", 80) or 80
        test_score = health_info.get("testing_score", 80) or 80
        perf_score = health_info.get("performance_score", 80) or 80

        # Architecture (25%), Security (25%), Maintainability (20%), Testing (15%), Performance (15%)
        overall_score = int((arch_score * 0.25) + (sec_score * 0.25) + (maint_score * 0.20) + (test_score * 0.15) + (perf_score * 0.15))

        supabase.table("health_scores").insert({
            "repository_id": repository_id,
            "overall_score": overall_score,
            "architecture_score": arch_score,
            "security_score": sec_score,
            "maintainability_score": maint_score,
            "testing_score": test_score,
            "performance_score": perf_score,
            "breakdown": health_info.get("breakdown", {})
        }).execute()

        supabase.table("technical_debt_reports").insert({
            "repository_id": repository_id,
            "debt_score": tech_debt.get("debt_score", 80),
            "critical_count": tech_debt.get("critical_count", 0),
            "major_count": tech_debt.get("major_count", 0),
            "minor_count": tech_debt.get("minor_count", 0),
            "issues": tech_debt.get("issues", [])
        }).execute()

        supabase.table("repositories").update({
            "language": summary.get("tech_stack", ["unknown"])[0] if summary.get("tech_stack") else "unknown",
            "description": f"Tech Stack: {', '.join(summary.get('tech_stack', [])) or 'N/A'} | Health: {overall_score}/100"
        }).eq("id", repository_id).execute()

        runner.set_stage("health", "completed", progress=100, message=f"Health {overall_score}/100")
    except Exception as e:
        runner.set_stage("health", "failed", error=f"Health calculation failed: {e}")


# ---------------------------------------------------------------------------
# Orchestrator: inherits async job semantics from FastAPI BackgroundTasks.
# ---------------------------------------------------------------------------
def scan_and_analyze_repository(repo_url: str, repository_id: str, job_id: str, token: str = None, github_token: str = None):
    """
    Executes the async scanning pipeline. Runs the 4 independent analysis stages
    (embeddings, architecture, security, health) concurrently after clone + index.
    Every stage persists its own real status: pending → running → completed/failed.
    """
    temp_dir = tempfile.mkdtemp()
    runner = None
    try:
        supabase = get_supabase_client(token)
        runner = ScanRunner(supabase, job_id, token)

        # Stage 1 (serial): clone the repository
        clone_repository(runner, repo_url, github_token, temp_dir)

        # Stage 2 (serial): parse + index files; cache embeddings for unchanged content
        scanned_files = collect_files(temp_dir)
        if not scanned_files:
            print("No source or metadata files found at all. Creating a placeholder README.md for analysis.")
            placeholder_content = f"# Empty Repository\nThis repository is empty or only contains unsupported file formats."
            scanned_files.append({
                "file_path": "README.md",
                "language": "markdown",
                "size": len(placeholder_content),
                "hash": hashlib.sha256(placeholder_content.encode('utf-8')).hexdigest(),
                "code_content": placeholder_content,
                "classes": [],
                "functions": [],
                "imports": [],
                "exports": []
            })

        file_id_map, to_embed = index_repository(runner, token, repository_id, scanned_files)

        # Stages 3-6 (concurrent): embeddings, architecture, security, health.
        # Architecture (local) and the two AI analysis stages depend only on indexed
        # file metadata, so they run in parallel with embeddings rather than waiting.
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futures = [
                pool.submit(run_embed_stage, runner, token, repository_id, file_id_map, to_embed),
                pool.submit(run_architecture_stage, runner, token, repository_id, scanned_files),
                pool.submit(run_security_stage, runner, token, repository_id, scanned_files),
                pool.submit(run_health_stage, runner, token, repository_id, scanned_files),
            ]
            for future in futures:
                future.result()

        print(f"Job {job_id} finished with stages: {json.dumps(runner.stages, default=str)}")

    except Exception as e:
        print(f"Error scanning repository: {e}")
        if runner is not None:
            # Fail the first non-terminal stage (clone/index failures are already marked).
            with runner._lock:
                for stage in STAGE_ORDER:
                    if runner.stages.get(stage, {}).get("status") in ("pending", "running"):
                        runner.set_stage(stage, "failed", error=str(e))
                        break

    finally:
        # Cleanup temporary files
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            # Fallback on Windows
            try:
                subprocess.run(["cmd", "/c", "rmdir", "/s", "/q", temp_dir], capture_output=True)
            except Exception:
                pass