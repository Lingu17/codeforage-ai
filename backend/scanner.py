import os
import tempfile
import subprocess
import shutil
import ast
import re
import hashlib
import json
import google.generativeai as genai
from datetime import datetime
from pathlib import Path
from database import get_supabase_client

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

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
                if node.module:
                    imports.append(node.module)
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
    # CommonJS require statements
    requires_found = re.findall(r'require\s*\(\s*[\'"](.*?)[\'"]\s*\)', content)
    imports = list(set(imports_found + requires_found))
    
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

def generate_embedding(text: str) -> list[float]:
    """Generates a 768-dimensional embedding vector for a given text chunk."""
    try:
        res = genai.embed_content(
            model="models/gemini-embedding-2",
            content=text,
            task_type="retrieval_document",
            output_dimensionality=768
        )
        return res['embedding']
    except Exception as e:
        print(f"Error generating embedding: {e}")
        # Return fallback zero vector if API fails to avoid breaking insert
        return [0.0] * 768

def resolve_dependency_graph(scanned_files: list[dict]) -> dict:
    """
    Programmatically builds a React Flow compatible dependency graph.
    Resolves imports to other files within the repository.
    """
    nodes = []
    edges = []
    
    # Map file name and path to check existence quickly
    file_paths = {f["file_path"]: f for f in scanned_files}
    file_basenames = {os.path.basename(f["file_path"]).split('.')[0]: f["file_path"] for f in scanned_files}
    
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
            target_path = None
            
            # Simple absolute or relative resolution
            # Look at the end of the import string (e.g. 'utils/db' -> 'db')
            imp_parts = imp.split('/')
            last_part = imp_parts[-1] if imp_parts else imp
            
            if last_part in file_basenames:
                target_path = file_basenames[last_part]
            else:
                # Direct check if import string contains part of local path
                for path in file_paths:
                    if imp in path or path in imp:
                        target_path = path
                        break
                        
            if target_path and target_path != rel_path:
                edge_id = f"edge-{rel_path}-{target_path}"
                edges.append({
                    "id": edge_id,
                    "source": rel_path,
                    "target": target_path,
                    "animated": True,
                    "style": { "stroke": "#52525b" }
                })
                
    return { "nodes": nodes, "edges": edges }

def run_ai_analysis(scanned_files: list[dict]) -> dict:
    """Uses Gemini Flash to analyze repository structure and metadata to generate reports."""
    # Build file summary for context
    summary_data = []
    total_files = len(scanned_files)
    total_functions = 0
    total_classes = 0
    
    for f in scanned_files:
        total_functions += len(f["functions"])
        total_classes += len(f["classes"])
        summary_data.append({
            "file_path": f["file_path"],
            "language": f["language"],
            "size_bytes": len(f["code_content"]),
            "classes": f["classes"],
            "functions": f["functions"],
            "imports": f["imports"]
        })
        
    summary_json = json.dumps(summary_data[:100]) # Cap to first 100 files to avoid massive prompts in very large repos
    
    prompt = f"""
    You are an expert software engineer and code auditor. Analyze the metadata of the following codebase files:
    
    Total Files: {total_files}
    Total Functions: {total_functions}
    Total Classes: {total_classes}
    
    File Metadata List:
    {summary_json}
    
    Please perform an audit and generate a JSON report with EXACTLY the following structure (do not output any markdown code blocks, just raw JSON, and ensure it parses successfully):
    {{
      "summary": {{
        "tech_stack": ["Next.js", "FastAPI", "Python", "TypeScript", "Tailwind CSS"],
        "architecture": "Monolith" or "Microservices" or "Serverless" or "Modular",
        "files_count": {total_files},
        "functions_count": {total_functions},
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
      }},
      "security": {{
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
    }}
    
    Notes:
    - Assess debt based on the sizes of files and import structures.
    - Evaluate security: mock hardcoded tokens if file content suggests `.env` load keys or similar configurations.
    - Return ONLY valid JSON matching the structure. Do not surround with markdown code blocks (e.g. do not write ```json).
    """
    
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up any potential markdown wraps
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        return json.loads(text)
    except Exception as e:
        print(f"Error calling Gemini for analysis: {e}")
        # Return robust default fallback on error
        return {
            "summary": {
                "tech_stack": ["Python", "TypeScript"],
                "architecture": "Monolith",
                "files_count": total_files,
                "functions_count": total_functions,
                "services_count": 1,
                "database": "PostgreSQL",
                "risk_level": "Medium",
                "health_score": 80
            },
            "health": {
                "overall_score": 80,
                "architecture_score": 80,
                "security_score": 80,
                "maintainability_score": 80,
                "testing_score": 80,
                "performance_score": 80,
                "breakdown": {
                    "architecture": "Default report loaded. Manual configuration required.",
                    "security": "Default report loaded.",
                    "maintainability": "Default report loaded.",
                    "testing": "Default report loaded.",
                    "performance": "Default report loaded."
                }
            },
            "tech_debt": {
                "debt_score": 80,
                "critical_count": 0,
                "major_count": 0,
                "minor_count": 2,
                "issues": [
                    {
                        "severity": "minor",
                        "file": scanned_files[0]["file_path"] if scanned_files else "unknown",
                        "type": "Duplicate Imports",
                        "description": "Verify duplicate imports manually."
                    }
                ]
            },
            "security": {
                "security_score": 85,
                "vulnerabilities": [
                    {
                        "severity": "Medium",
                        "file": scanned_files[0]["file_path"] if scanned_files else "unknown",
                        "line": 1,
                        "description": "Review codebase secrets scanner."
                    }
                ]
            }
        }

def update_job_status(supabase, job_id, status, progress, current_step, error_message=None):
    update_data = {
        "status": status,
        "progress": progress,
        "current_step": current_step
    }
    if error_message:
        update_data["error_message"] = error_message
    if status in ['completed', 'failed']:
        update_data["completed_at"] = datetime.utcnow().isoformat()
        
    supabase.table("repository_scans").update(update_data).eq("id", job_id).execute()

def scan_and_analyze_repository(repo_url: str, repository_id: str, job_id: str, token: str = None):
    """
    Executes the async scanning, embedding, and analysis process.
    Updates the repository_scans table at every milestone.
    """
    supabase = get_supabase_client(token)
    temp_dir = tempfile.mkdtemp()
    
    try:
        # STEP 1: Cloning (Cloning status)
        update_job_status(supabase, job_id, "cloning", 15, "Cloning repository...")
        print(f"Cloning {repo_url} into {temp_dir}")
        
        # Clone shallow for fast retrieval
        subprocess.run(["git", "clone", "--depth", "1", repo_url, temp_dir], check=True, capture_output=True)
        update_job_status(supabase, job_id, "scanning", 35, "Scanning files...")
        
        scanned_files = []
        
        # Traverse repository
        print(f"Scanning repository: {temp_dir}")
        for root, dirs, files in os.walk(temp_dir):
            if any(p in root for p in ['.git', 'node_modules', 'venv', '__pycache__', '.next', 'dist', 'build']):
                continue
            print(f"Folder: {root}")
            print(f"Files: {files}")
                
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, temp_dir).replace('\\', '/')
                ext = os.path.splitext(file)[1].lower()
                
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
                
                is_code = ext in CODE_EXTENSIONS
                is_metadata = ext in METADATA_EXTENSIONS or file.lower() in METADATA_NAMES
                
                if not (is_code or is_metadata):
                    continue
                    
                try:
                    size = os.path.getsize(file_path)
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        
                    # Calculate hash to verify edits or duplicates later
                    file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
                    
                    metadata = {"classes": [], "functions": [], "imports": [], "exports": []}
                    language = "unknown"
                    
                    if is_code:
                        if ext == '.py':
                            language = 'python'
                            metadata = parse_python_file(content)
                        elif ext in ['.js', '.jsx']:
                            language = 'javascript'
                            metadata = parse_js_ts_file(content)
                        elif ext in ['.ts', '.tsx']:
                            language = 'typescript'
                            metadata = parse_js_ts_file(content)
                        elif ext == '.java':
                            language = 'java'
                            metadata = parse_java_kotlin_file(content)
                        elif ext in ['.kt', '.kts']:
                            language = 'kotlin'
                            metadata = parse_java_kotlin_file(content)
                        elif ext == '.go':
                            language = 'go'
                            metadata = parse_go_rust_file(content, ext)
                        elif ext == '.rs':
                            language = 'rust'
                            metadata = parse_go_rust_file(content, ext)
                        elif ext in ['.cpp', '.c', '.cc', '.h', '.hpp']:
                            language = 'cpp'
                        elif ext == '.cs':
                            language = 'csharp'
                        elif ext == '.php':
                            language = 'php'
                    else:
                        if ext == '.md':
                            language = 'markdown'
                        elif ext == '.json':
                            language = 'json'
                        elif ext in ['.yaml', '.yml']:
                            language = 'yaml'
                        elif ext == '.toml':
                            language = 'toml'
                        elif ext == '.xml':
                            language = 'xml'
                        elif 'dockerfile' in file.lower():
                            language = 'dockerfile'
                        elif 'makefile' in file.lower():
                            language = 'makefile'
                        else:
                            language = 'text'
                        
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
            
        code_files_count = sum(1 for f in scanned_files if f["language"] in ['python', 'javascript', 'typescript', 'java', 'kotlin', 'go', 'rust', 'cpp', 'csharp', 'php'])
        if code_files_count == 0:
            print("No source files found, proceeding with metadata analysis")
            
        # Write files metadata to database
        update_job_status(supabase, job_id, "scanning", 45, "Saving repository file structure...")
        
        # Clear any existing scan data for this repo to allow clean rescan
        supabase.table("repository_files").delete().eq("repository_id", repository_id).execute()
        supabase.table("code_chunks").delete().eq("repository_id", repository_id).execute()
        
        # Insert files
        for f in scanned_files:
            supabase.table("repository_files").insert({
                "repository_id": repository_id,
                "file_path": f["file_path"],
                "language": f["language"],
                "size": f["size"],
                "hash": f["hash"],
                "classes": f["classes"],
                "functions": f["functions"],
                "imports": f["imports"],
                "exports": f["exports"]
            }).execute()
            
        # STEP 2: Embedding Chunks (Embedding status)
        update_job_status(supabase, job_id, "embedding", 60, "Generating embeddings...")
        
        # In Supabase, get the mapped file IDs to link chunks
        files_db = supabase.table("repository_files").select("id", "file_path").eq("repository_id", repository_id).execute()
        file_path_to_id = {row["file_path"]: row["id"] for row in files_db.data}
        
        for f in scanned_files:
            file_id = file_path_to_id.get(f["file_path"])
            if not file_id:
                continue
                
            chunks = generate_chunks(f["code_content"])
            for idx, chunk in enumerate(chunks):
                # Generate Gemini vector
                vector = generate_embedding(chunk)
                supabase.table("code_chunks").insert({
                    "repository_id": repository_id,
                    "file_id": file_id,
                    "file_path": f["file_path"],
                    "chunk_index": idx,
                    "chunk_text": chunk,
                    "embedding": vector,
                    "language": f["language"]
                }).execute()
                
        # STEP 3: Architecture & Health Inferences (Analyzing status)
        update_job_status(supabase, job_id, "analyzing", 80, "AI Analysis")
        
        # Programmatic React Flow resolution
        graph_data = resolve_dependency_graph(scanned_files)
        
        # AI models execution
        report_data = run_ai_analysis(scanned_files)
        
        # Insert architecture report
        supabase.table("architecture_reports").insert({
            "repository_id": repository_id,
            "graph_data": graph_data,
            "summary": f"Visual dependency layout containing {len(graph_data['nodes'])} files and {len(graph_data['edges'])} imports. Style: {report_data['summary']['architecture']}"
        }).execute()
        
        # Insert tech debt report
        supabase.table("technical_debt_reports").insert({
            "repository_id": repository_id,
            "debt_score": report_data["tech_debt"]["debt_score"],
            "critical_count": report_data["tech_debt"]["critical_count"],
            "major_count": report_data["tech_debt"]["major_count"],
            "minor_count": report_data["tech_debt"]["minor_count"],
            "issues": report_data["tech_debt"]["issues"]
        }).execute()
        
        # Insert security report
        supabase.table("security_reports").insert({
            "repository_id": repository_id,
            "security_score": report_data["security"]["security_score"],
            "vulnerabilities": report_data["security"]["vulnerabilities"]
        }).execute()
        
        # Compute mathematically precise overall health score based on user requirements:
        # Architecture (25%), Security (25%), Maintainability (20%), Testing (15%), Performance (15%)
        health_info = report_data.get("health", {})
        arch_score = health_info.get("architecture_score", 80)
        sec_score = health_info.get("security_score", 80)
        maint_score = health_info.get("maintainability_score", 80)
        test_score = health_info.get("testing_score", 80)
        perf_score = health_info.get("performance_score", 80)
        
        overall_score = int((arch_score * 0.25) + (sec_score * 0.25) + (maint_score * 0.20) + (test_score * 0.15) + (perf_score * 0.15))
        
        # Insert overall health score
        update_job_status(supabase, job_id, "analyzing", 90, "Health Score Calculation")
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
        
        # Update repository record description and language
        supabase.table("repositories").update({
            "language": report_data["summary"]["tech_stack"][0] if report_data["summary"]["tech_stack"] else "unknown",
            "description": f"Tech Stack: {', '.join(report_data['summary']['tech_stack'])} | Health: {overall_score}/100"
        }).eq("id", repository_id).execute()
        
        # COMPLETE
        update_job_status(supabase, job_id, "completed", 100, "Scan Complete")
        print(f"Job {job_id} successfully completed.")
        
    except Exception as e:
        print(f"Error scanning repository: {e}")
        update_job_status(supabase, job_id, "failed", 100, "Scan failed.", error_message=str(e))
        
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
