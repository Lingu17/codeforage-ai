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
from datetime import datetime, timezone
from pathlib import Path
from database import get_supabase_client
from validation import github_repository_url
from embedding import embed_batch, valid_vector, retry_count
import logging
import base64
import stat
logger = logging.getLogger("codeforge.scan")

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
                _genai_client = Client(api_key=os.getenv("GEMINI_API_KEY"), http_options=types.HttpOptions(timeout=int(os.getenv("AI_TIMEOUT_SECONDS", "60")) * 1000, retry_options=types.HttpRetryOptions(attempts=1)))
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
EMBED_WORKERS = int(os.getenv("EMBED_WORKERS", "2"))
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "16"))
CHUNK_INSERT_BATCH = 100
STAGE_PERSIST_INTERVAL = 1.0  # seconds between progress writes to the DB


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


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
        elif status in ("running", "failed", "partial"):
            # A failed stage keeps its last real progress so the aggregate never regresses.
            pct = st.get("progress")
            if pct is None or pct < 5:
                pct = 5
            total += STAGE_WEIGHTS[stage] * (pct / 100.0)

    if any(stages.get(s, {}).get('status') == 'failed' for s in ('clone', 'index')):
        return 'failed', min(int(total), 99)
    if any(s == 'cancelled' for s in statuses):
        return 'cancelled', min(int(total), 99)

    if all(s == "completed" for s in statuses):
        return "completed", 100

    if all(s in ("completed", "failed", "partial", "cancelled") for s in statuses):
        completed_any = any(s == "completed" for s in statuses)
        if not completed_any:
            return "failed", min(int(total), 99)
        return "partial", min(int(total), 99)

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
        self._lock = threading.RLock()
        self.cancel = threading.Event()
        self._last_persist_ts = 0.0

    def set_stage(self, stage, status, progress=None, message=None, error=None):
        with self._lock:
            st = self.stages.setdefault(stage, {})
            if status == "failed":
                # Keep a monotonic floor for the aggregate so the UI never sees regressions.
                if st.get("progress") is None:
                    st["progress"] = 5
                if error:
                    st["error"] = "This stage failed. Retry the scan or contact the administrator."
                    logger.error("scan_id=%s stage=%s error_type=%s", self.job_id, stage, type(error).__name__)
            st["status"] = status
            if progress is not None:
                st["progress"] = int(progress)
            if message is not None:
                st["message"] = message
            if status == "completed":
                st.pop("error", None)
                st.pop("progress", None)

            agg_status, agg_progress = compute_aggregate(self.stages)
            now = time.time()
            terminal = agg_status in ("completed", "failed", "partial", "cancelled")
            # Persist immediately on terminal states / failures, otherwise throttle.
            if terminal or status == "failed" or (now - self._last_persist_ts) >= STAGE_PERSIST_INTERVAL:
                self._last_persist_ts = now
                self._persist(agg_status, agg_progress)

    def _persist(self, status, progress):
        payload = {
            "status": status,
            "progress": int(round(progress)),
            "current_step": json.dumps(self.stages, default=str),
            "heartbeat_at": _now_iso(),
        }
        if status in ("completed", "failed", "partial", "cancelled"):
            payload["completed_at"] = _now_iso()
        result = self.supabase.table('repository_scans').update({**payload, 'stages': self.stages}).eq('id', self.job_id).in_(
            'status', ['queued','cloning','scanning','embedding','analyzing']).execute()
        if not result.data:
            self.cancel.set()  # Never revive a cancelled/recovered terminal job.


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
    except SyntaxError as exc:
        logger.warning("python_parse_error_line=%s", exc.lineno)
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

def chunk_records(text: str, chunk_size: int = 1500, overlap: int = 200):
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError('Invalid chunk size or overlap')
    import bisect
    newlines = [i for i, c in enumerate(text) if c == '\n']
    for index, start in enumerate(range(0, len(text), chunk_size - overlap)):
        end = min(start + chunk_size, len(text))
        yield {'chunk_index': index, 'chunk_text': text[start:end],
               'line_start': bisect.bisect_left(newlines, start) + 1,
               'line_end': bisect.bisect_left(newlines, max(start, end - 1)) + 1}


def generate_chunks(text: str, chunk_size: int = 1500, overlap: int = 200) -> list[str]:
    return [c['chunk_text'] for c in chunk_records(text, chunk_size, overlap)]


def generate_embedding(text: str) -> list[float]:
    return embed_batch(get_genai_client(), [text], query=True)[0]


def embed_chunks_batch(chunks: list[str], cancel=None):
    return embed_batch(get_genai_client(), chunks, cancel=cancel)


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
    import_str_clean = re.sub(r'\.(?:py|tsx?|jsx?)$', '', import_str)

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
    possible_matches = set()
    for p_no_ext, actual_p in path_lookup.items():
        if p_no_ext == clean_alias or p_no_ext.endswith("/" + clean_alias) or p_no_ext == python_path or p_no_ext.endswith("/" + python_path):
            possible_matches.add(actual_p)

    if len(possible_matches) == 1:
        return next(iter(possible_matches))

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

    edges = list(unique_edges)
    adjacency = {n['id']: [] for n in nodes}
    reverse = {n['id']: [] for n in nodes}
    for edge in edges:
        adjacency[edge['source']].append(edge['target'])
        reverse[edge['target']].append(edge['source'])
    cycles = []
    visited, active = set(), set()
    # Iterative DFS avoids recursion limits on large import chains.
    for origin in adjacency:
        if origin in visited:
            continue
        stack = [(origin, iter(adjacency[origin]))]
        path = [origin]
        active.add(origin)
        visited.add(origin)
        while stack:
            current, children = stack[-1]
            target = next(children, None)
            if target is None:
                stack.pop(); path.pop(); active.discard(current)
            elif target in active:
                if len(cycles) < 100:
                    cycles.append(path[path.index(target):] + [target])
            elif target not in visited:
                visited.add(target); active.add(target); path.append(target)
                stack.append((target, iter(adjacency[target])))
    cycle_pairs = {(a, b) for cycle in cycles for a, b in zip(cycle, cycle[1:])}
    file_map = {f['file_path']: f for f in scanned_files}
    for node in nodes:
        f = file_map[node['id']]
        node['data'].update(file_path=node['id'], language=f['language'],
                            kind='internal',
                            imports=f['imports'], imported_by=reverse[node['id']],
                            dependency_count=len(adjacency[node['id']]),
                            external_imports=[i for i in f['imports'] if resolve_import_path(node['id'], i, file_paths) is None])
    for edge in edges:
        edge['data'] = {'circular': (edge['source'], edge['target']) in cycle_pairs}
        if edge['data']['circular']:
            edge['style']['stroke'] = '#dc2626'
    # Only imports observed in source become external nodes. Unresolved relative
    # imports and common local aliases are excluded; no infrastructure is inferred.
    external_nodes = {}
    for f in scanned_files:
        for imported in f['imports']:
            if resolve_import_path(f['file_path'], imported, file_paths) or imported.startswith(('.', '/', '@/', '~/')):
                continue
            package = imported.split('.')[0] if f['language'] == 'python' else '/'.join(imported.split('/')[:2]) if imported.startswith('@') else imported.split('/')[0]
            external_id = f"external:{f['language']}:{package}"
            if external_id not in external_nodes:
                external_nodes[external_id] = {
                    'id': external_id, 'type': 'default',
                    'data': {'label': package + '\n(external import)', 'kind': 'external',
                             'language': f['language'], 'package_name': package, 'imported_by': []},
                    'position': {'x': 1100, 'y': 80 + len(external_nodes) * 90},
                    'style': {'background': '#eef2ff', 'color': '#312e81', 'border': '2px dashed #6366f1'},
                }
            external_nodes[external_id]['data']['imported_by'].append(f['file_path'])
            edges.append({'id': f"external-edge:{f['file_path']}:{external_id}:{imported}",
                          'source': f['file_path'], 'target': external_id,
                          'data': {'external': True, 'import': imported, 'circular': False},
                          'style': {'stroke': '#6366f1', 'strokeDasharray': '4 4'}})
    nodes.extend(external_nodes.values())
    return {'nodes': nodes, 'edges': edges, 'cycles': cycles}


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

def run_ai_security_analysis(scanned_files):
    from quality import security_report
    return security_report(scanned_files)


def run_ai_health_analysis(scanned_files):
    from quality import health_report
    return health_report(scanned_files, resolve_dependency_graph(scanned_files))


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

    clone_url = github_repository_url(repo_url)
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GIT_CONFIG_NOSYSTEM='1')
    git = shutil.which('git')
    if not git:
        raise RuntimeError('Git executable is unavailable')
    args = [git, '-c', 'credential.helper=', '-c', 'core.hooksPath=/dev/null']
    if github_token:
        # Git reads the private header from the environment, never argv/URL.
        encoded = base64.b64encode(f'x-access-token:{github_token}'.encode()).decode()
        env.update(GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='http.https://github.com/.extraheader',
                   GIT_CONFIG_VALUE_0=f'Authorization: Basic {encoded}')
    try:
        subprocess.run(args + ['clone', '--depth', '1', '--', clone_url, temp_dir],
                       env=env, check=True, capture_output=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        runner.set_stage('clone', 'failed', error='Repository clone failed')
        raise RuntimeError('Repository could not be cloned') from exc

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
    total_bytes = 0
    for root, dirs, files in os.walk(temp_dir):
        dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', 'venv', '.venv', '__pycache__', '.next', 'dist', 'build'}
                   and not os.path.islink(os.path.join(root, d))]

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
                if os.path.islink(file_path) or not Path(file_path).resolve().is_relative_to(Path(temp_dir).resolve()):
                    continue
                size = os.path.getsize(file_path)
                if size > MAX_EMBED_FILE_SIZE:
                    raise RuntimeError('Repository contains a file exceeding the 1 MiB analysis limit')
                if len(scanned_files) >= 5000 or total_bytes + size > 50 * 1024 * 1024:
                    raise RuntimeError('Repository exceeds analysis limits (5000 files / 50 MiB)')
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
                total_bytes += size
            except Exception as file_err:
                raise RuntimeError("Repository file discovery failed") from file_err

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
    if isinstance(vec, (list, tuple)):
        return not valid_vector(vec)
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
            .select("file_path,embedding") \
            .eq("repository_id", repository_id) \
            .range(offset, offset + 499) \
            .execute().data
        for r in rows:
            if _vector_is_zero(r.get("embedding")):
                bad.add(r["file_path"])
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

    existing = []
    offset = 0
    while True:
        batch = supabase.table("repository_files").select("id,file_path,hash").eq("repository_id", repository_id).order("id").range(offset, offset + 999).execute().data
        existing.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    existing_map = {r["file_path"]: r for r in existing}

    chunk_counts = {}
    offset = 0
    while True:
        batch = supabase.table('code_chunks').select('file_path').eq('repository_id', repository_id).range(offset, offset + 999).execute().data
        for row in batch:
            chunk_counts[row['file_path']] = chunk_counts.get(row['file_path'], 0) + 1
        if len(batch) < 1000:
            break
        offset += 1000
    chunked_paths = set(chunk_counts)
    stale_paths = set()
    offset = 0
    while True:
        batch = supabase.table('code_chunks').select('file_path,embedding_model,line_start').eq('repository_id', repository_id).range(offset, offset + 999).execute().data
        stale_paths.update(row['file_path'] for row in batch if row.get('embedding_model') != EMBED_MODEL or row.get('line_start') is None)
        if len(batch) < 1000:
            break
        offset += 1000
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
        elif f["file_path"] in zero_embedded or f["file_path"] in stale_paths:
            # File unchanged but cached embeddings are zero vectors → re-embed.
            to_embed.append(f)
            changed_ids.append(prev["id"])
        elif should_embed(f) and chunk_counts.get(f["file_path"], 0) != len(generate_chunks(f["code_content"])):
            # Retry missing chunks while retaining valid successful chunks.
            to_embed.append(f)
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
    total_expected = sum(len(generate_chunks(f['code_content'])) for f in scanned_files if should_embed(f))
    changed = {f['file_path'] for f in to_embed}
    cached_chunks = sum(chunk_counts.get(f['file_path'], 0) for f in scanned_files if should_embed(f) and f['file_path'] not in changed)
    cached_files = sum(1 for f in scanned_files if should_embed(f) and f['file_path'] not in changed)
    runner.stages['embed'].update(chunks_expected=total_expected, chunks_indexed=cached_chunks,
                                 chunks_failed=0, files_discovered=len(scanned_files), files_indexed=cached_files)
    return file_id_map, to_embed


# ---------------------------------------------------------------------------
# Stage 3: Embeddings (batched, concurrent, cached for unchanged files)
# ---------------------------------------------------------------------------
def _embed_one(repository_id: str, f: dict, file_id: str, token: str, cancel=None):
    if not token:
        raise RuntimeError('Authenticated scan token required')
    chunks = list(chunk_records(f['code_content']))
    client = get_supabase_client(token)
    cached = client.table('code_chunks').select('chunk_index,chunk_text,embedding_model,line_start,line_end').eq('repository_id', repository_id).eq('file_id', file_id).execute().data
    cached_by_index = {row['chunk_index']: row for row in cached}
    pending = []
    for chunk in chunks:
        row = cached_by_index.get(chunk['chunk_index'])
        if not row or row.get('embedding_model') != EMBED_MODEL or any(row.get(key) != chunk[key] for key in ('chunk_text','line_start','line_end')):
            pending.append(chunk)
    indexed = len(chunks) - len(pending)
    failed = 0
    for offset in range(0, len(pending), EMBED_BATCH_SIZE):
        if cancel is not None and cancel.is_set():
            break
        batch = pending[offset:offset + EMBED_BATCH_SIZE]
        try:
            vectors = embed_chunks_batch([c['chunk_text'] for c in batch], cancel)
            rows = [{**c, 'repository_id': repository_id, 'file_id': file_id,
                     'file_path': f['file_path'], 'embedding': vector, 'language': f['language'],
                     'embedding_model': EMBED_MODEL}
                    for c, vector in zip(batch, vectors)]
            client.table('code_chunks').insert(rows).execute()
            indexed += len(rows)
        except Exception as exc:
            logger.warning('repository_id=%s embedding_batch_failed=%s error_type=%s', repository_id, len(batch), type(exc).__name__)
            failed += len(batch)
    return {'expected': len(chunks), 'indexed': indexed, 'failed': len(chunks) - indexed}


def run_embed_stage(runner: ScanRunner, token, repository_id: str, file_id_map: dict, to_embed: list[dict]):
    runner.set_stage('embed', 'running', progress=0, message='Generating embeddings')
    targets = [f for f in to_embed if should_embed(f)]
    stats = {key: runner.stages['embed'].get(key, 0) for key in
             ('chunks_expected', 'chunks_indexed', 'chunks_failed', 'files_discovered', 'files_indexed')}
    if not stats['chunks_expected']:
        stats['chunks_expected'] = sum(len(generate_chunks(f['code_content'])) for f in targets)
    start = time.monotonic()
    retries_before = retry_count()
    with concurrent.futures.ThreadPoolExecutor(max_workers=EMBED_WORKERS) as pool:
        # Keep the submission queue bounded for large repositories.
        for offset in range(0, len(targets), EMBED_WORKERS):
            pending = {pool.submit(_embed_one, repository_id, f, file_id_map[f['file_path']], token, runner.cancel): f
                       for f in targets[offset:offset + EMBED_WORKERS]}
            for future in concurrent.futures.as_completed(pending):
                f = pending[future]
                try:
                    result = future.result()
                except Exception as exc:
                    logger.error('scan_id=%s embedding_worker_error=%s', runner.job_id, type(exc).__name__)
                    result = {'indexed': 0, 'failed': len(generate_chunks(f['code_content']))}
                stats['chunks_indexed'] += result['indexed']
                stats['chunks_failed'] += result['failed']
                stats['files_indexed'] += int(result['failed'] == 0)
                with runner._lock:
                    runner.stages['embed'].update(stats)
                pct = int(100 * (stats['chunks_indexed'] + stats['chunks_failed']) / max(stats['chunks_expected'], 1))
                runner.set_stage('embed', 'running', progress=pct, message=f"{stats['chunks_indexed']} chunks indexed; {stats['chunks_failed']} failed")
            if runner.cancel.is_set():
                break
    with runner._lock:
        runner.stages['embed'].update(coverage_percentage=round(100 * stats['chunks_indexed'] / stats['chunks_expected'], 1) if stats['chunks_expected'] else None, duration_seconds=round(time.monotonic() - start, 2),
                                      retry_count=retry_count() - retries_before)
    status = 'cancelled' if runner.cancel.is_set() else ('partial' if stats['chunks_indexed'] else 'failed') if stats['chunks_failed'] else 'completed'
    runner.set_stage('embed', status, progress=100,
                     message=f"{stats['chunks_indexed']} chunks indexed; {stats['chunks_failed']} failed")


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
            "security_score": report["security_score"],
            "scope": report["scope"],
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

        arch_score = health_info['architecture_score']
        sec_score = health_info['security_score']
        maint_score = health_info['maintainability_score']
        test_score = health_info['testing_score']
        perf_score = health_info['performance_score']
        overall_score = health_info['overall_score']

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
            "debt_score": tech_debt["debt_score"],
            "critical_count": tech_debt.get("critical_count", 0),
            "major_count": tech_debt.get("major_count", 0),
            "minor_count": tech_debt.get("minor_count", 0),
            "issues": tech_debt.get("issues", [])
        }).execute()

        runner.set_stage("health", "completed", progress=100, message=f"Partial source health {overall_score}/100" if overall_score is not None else "Health score unavailable")
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
    monitor_stop = threading.Event()
    try:
        supabase = get_supabase_client(token)
        state = supabase.table('repository_scans').select('status,cancel_requested').eq('id', job_id).limit(1).execute().data
        if not state or state[0].get('cancel_requested') or state[0]['status'] not in ('queued','cloning','scanning','embedding','analyzing'):
            return
        runner = ScanRunner(supabase, job_id, token)
        def heartbeat():
            while not monitor_stop.wait(5):
                try:
                    state = get_supabase_client(token).table('repository_scans').select('cancel_requested,status').eq('id', job_id).execute().data
                    if not state or state[0].get('cancel_requested') or state[0]['status'] in ('cancelled', 'failed'):
                        runner.cancel.set()
                        return
                    get_supabase_client(token).table('repository_scans').update({'heartbeat_at': _now_iso()}).eq('id', job_id).execute()
                except Exception as exc:
                    logger.error('scan_id=%s heartbeat_failed=%s', job_id, type(exc).__name__)
                    runner.cancel.set()
                    return
        threading.Thread(target=heartbeat, daemon=True).start()

        # Stage 1 (serial): clone the repository
        clone_repository(runner, repo_url, github_token, temp_dir)

        # Stage 2 (serial): parse + index files; cache embeddings for unchanged content
        commit = subprocess.run([shutil.which('git'), '-C', temp_dir, 'rev-parse', 'HEAD'], check=True, capture_output=True, text=True, timeout=10).stdout.strip()
        if not re.fullmatch('[a-f0-9]{40,64}', commit):
            raise RuntimeError('Invalid repository revision')
        supabase.table('repositories').update({'scan_commit': commit}).eq('id', repository_id).execute()
        scanned_files = collect_files(temp_dir)
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

        logger.info("scan_id=%s status=%s", job_id, compute_aggregate(runner.stages)[0])

    except Exception as e:
        logger.error("repository_id=%s scan_error_type=%s", repository_id, type(e).__name__)
        if runner is not None:
            # Fail the first non-terminal stage (clone/index failures are already marked).
            with runner._lock:
                for stage in STAGE_ORDER:
                    if runner.stages.get(stage, {}).get("status") in ("pending", "running"):
                        runner.set_stage(stage, "failed", error=str(e))
                        break

    finally:
        monitor_stop.set()
        def writable_remove(function, path, exc):
            os.chmod(path, stat.S_IWRITE)
            function(path)
        try:
            shutil.rmtree(temp_dir, onexc=writable_remove)
        except OSError as exc:
            logger.warning('scan_temp_cleanup_failed=%s', type(exc).__name__)
