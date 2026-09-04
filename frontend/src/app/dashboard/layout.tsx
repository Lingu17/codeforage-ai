"use client";

import { useState, useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  Layers, GitBranch, MessageSquare, ShieldAlert, Activity, 
  LogOut, Home, Settings, CreditCard, Menu, X 
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getModuleUrl } from "@/utils/navigation";
import { Button } from "@/components/ui/button";

// Extend global window object types for mock databases
declare global {
  interface Window {
    __mockRepos: any[];
    __mockJobs: Record<string, any>;
    __mockChatSessions: Record<string, any[]>;
    __mockChatMessages: Record<string, any[]>;
  }
}

// Global fetch interceptor for Demo Mode
if (typeof window !== "undefined") {
  if (!window.__mockRepos) {
    window.__mockRepos = [
      {
        id: "1",
        name: "codeforge-ai",
        display_name: "CodeForge AI",
        full_name: "Lingu17/codeforge-ai",
        status: "completed",
        progress: 100,
        language: "TypeScript",
        description: "Next.js & Supabase repository intelligence dashboard platform.",
        repo_url: "https://github.com/Lingu17/codeforge-ai",
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: "2",
        name: "fastapi-backend",
        display_name: "FastAPI Backend",
        full_name: "Lingu17/fastapi-backend",
        status: "completed",
        progress: 100,
        language: "Python",
        description: "FastAPI semantic indexing engine using AST parsing and pgvector.",
        repo_url: "https://github.com/Lingu17/fastapi-backend",
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      }
    ];
  }
  
  if (!window.__mockJobs) {
    window.__mockJobs = {};
  }

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input && typeof input === "object") {
      if ("url" in input && typeof (input as any).url === "string") {
        url = (input as any).url;
      } else {
        url = input.toString();
      }
    }
    const isDemo = localStorage.getItem("demo_mode") === "true";

    if (isDemo && url && (url.includes("127.0.0.1:8000/api") || url.includes("/api/"))) {
      if (url.endsWith("/api/repos")) {
        return new Response(JSON.stringify(window.__mockRepos), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/repos/github")) {
        const githubMockRepos = [
          {
            id: 101,
            name: "react-flow-viz",
            full_name: "Lingu17/react-flow-viz",
            description: "Custom diagrammatic representations of React components.",
            language: "TypeScript",
            stargazers_count: 12,
            forks_count: 2,
            owner: { login: "Lingu17" }
          },
          {
            id: 102,
            name: "pgvector-helper",
            full_name: "Lingu17/pgvector-helper",
            description: "Python wrapper for managing vector distance calculations and index tuning.",
            language: "Python",
            stargazers_count: 8,
            forks_count: 1,
            owner: { login: "Lingu17" }
          },
          {
            id: 103,
            name: "nextjs-light-theme",
            full_name: "Lingu17/nextjs-light-theme",
            description: "Personal B2B SaaS template tailored for Next.js 15.",
            language: "TypeScript",
            stargazers_count: 45,
            forks_count: 5,
            owner: { login: "Lingu17" }
          }
        ];
        return new Response(JSON.stringify(githubMockRepos), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/repos/analyze")) {
        let body: any = {};
        try {
          if (init && init.body) {
            body = JSON.parse(init.body as string);
          }
        } catch {}

        const newId = (window.__mockRepos.length + 1).toString();
        const newRepo = {
          id: newId,
          name: body.name || "imported-repo",
          display_name: body.name || "Imported Repo",
          full_name: body.full_name || `Lingu17/${body.name || "imported-repo"}`,
          status: "queued",
          progress: 5,
          language: body.language || "TypeScript",
          description: body.description || "Imported repository currently scanning.",
          repo_url: body.repo_url || `https://github.com/${body.full_name || "owner/repo"}`,
          created_at: new Date().toISOString()
        };

        window.__mockRepos.push(newRepo);
        window.__mockJobs[newId] = {
          status: "queued",
          progress: 5,
          completed_at: null,
          error_message: null
        };

        return new Response(JSON.stringify({ repository_id: newId, status: "queued" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const deleteMatch = url.match(/\/api\/repos\/([^/]+)$/);
      if (deleteMatch && init?.method === "DELETE") {
        const repoId = deleteMatch[1];
        window.__mockRepos = window.__mockRepos.filter((r: any) => r.id !== repoId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const patchMatch = url.match(/\/api\/repos\/([^/]+)$/);
      if (patchMatch && init?.method === "PATCH") {
        const repoId = patchMatch[1];
        let body: any = {};
        try {
          if (init && init.body) {
            body = JSON.parse(init.body as string);
          }
        } catch {}
        window.__mockRepos = window.__mockRepos.map((r: any) => {
          if (r.id === repoId) {
            return { ...r, display_name: body.display_name || r.display_name };
          }
          return r;
        });
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const statusMatch = url.match(/\/api\/repos\/([^/]+)\/status$/);
      if (statusMatch) {
        const repoId = statusMatch[1];
        const job = window.__mockJobs[repoId] || { status: "completed", progress: 100, completed_at: new Date().toISOString(), error_message: null };
        
        if (job.status !== "completed" && job.status !== "failed") {
          if (job.status === "queued") {
            job.status = "cloning";
            job.progress = 15;
          } else if (job.status === "cloning") {
            job.status = "scanning";
            job.progress = 40;
          } else if (job.status === "scanning") {
            job.status = "embedding";
            job.progress = 70;
          } else if (job.status === "embedding") {
            job.status = "analyzing";
            job.progress = 90;
          } else if (job.status === "analyzing") {
            job.status = "completed";
            job.progress = 100;
            job.completed_at = new Date().toISOString();
            window.__mockRepos = window.__mockRepos.map((r: any) => {
              if (r.id === repoId) {
                return { ...r, status: "completed", progress: 100 };
              }
              return r;
            });
          }
          window.__mockJobs[repoId] = { ...job };
        }

        return new Response(JSON.stringify(job), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const summaryMatch = url.match(/\/api\/repos\/([^/]+)\/summary$/);
      if (summaryMatch) {
        const repoId = summaryMatch[1];
        const repo = window.__mockRepos.find((r: any) => r.id === repoId) || window.__mockRepos[0];
        
        const mockSummary = {
          repository: repo,
          files_count: repoId === "1" ? 24 : 18,
          functions_count: repoId === "1" ? 148 : 82,
          size_bytes: repoId === "1" ? 456200 : 256800,
          architecture: repo.language === "Python" ? "MVC/FastAPI structure" : "Next.js pages/components layout",
          health_score: repoId === "1" ? 92 : 85,
          health_breakdown: {
            overall_score: repoId === "1" ? 92 : 85,
            architecture_score: repoId === "1" ? 95 : 88,
            security_score: repoId === "1" ? 88 : 90,
            maintainability_score: repoId === "1" ? 94 : 82,
            testing_score: repoId === "1" ? 90 : 78,
            performance_score: repoId === "1" ? 92 : 88,
            breakdown: {
              architecture: repoId === "1" 
                ? "Clean layering. Pages are separate from client utility libraries, and folder paths are properly compartmentalized." 
                : "MVC structure. Routes are correctly separated from database models. Some modules have tight coupling.",
              security: repoId === "1" 
                ? "Minor vulnerability: one of the development config files contains a placeholder key, but no actual secrets are exposed."
                : "Secure configuration. All credentials load exclusively from system environment variables.",
              maintainability: repoId === "1"
                ? "Excellent maintainability. Functions are short, descriptive, and follow unified naming patterns."
                : "Moderate code size. Several helper methods exceed recommended line length limits.",
              testing: repoId === "1"
                ? "Good code coverage (>80%). Key authentication paths and navigation routines are covered."
                : "Standard test coverage (65%). Missing validation checks for chat input sanitization.",
              performance: repoId === "1"
                ? "Fast client rendering. Dynamic routes utilize Next.js Suspense boundaries correctly."
                : "Fast execution. Vector queries use HNSW index to minimize response latency."
            }
          },
          security: {
            security_score: repoId === "1" ? 88 : 90,
            vulnerabilities: repoId === "1" ? [
              {
                file: "src/utils/supabase/client.ts",
                severity: "Medium",
                description: "Supabase key loaded via client environment variable is visible to browsers. Ensure Row Level Security (RLS) is strictly enabled on tables.",
                line: 5
              }
            ] : [
              {
                file: "app/api/auth.py",
                severity: "Medium",
                description: "Session token expires in 30 days. Consider reducing the token lifetime to 24 hours to mitigate session hijacking risks.",
                line: 42
              }
            ]
          }
        };

        return new Response(JSON.stringify(mockSummary), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const secMatch = url.match(/\/api\/repos\/([^/]+)\/security$/);
      if (secMatch) {
        const repoId = secMatch[1];
        const secData = {
          security_score: repoId === "1" ? 88 : 90,
          vulnerabilities: repoId === "1" ? [
            {
              file: "src/utils/supabase/client.ts",
              severity: "Medium",
              description: "Supabase key loaded via client environment variable is visible to browsers. Ensure Row Level Security (RLS) is strictly enabled on tables.",
              line: 5
            }
          ] : [
            {
              file: "app/api/auth.py",
              severity: "Medium",
              description: "Session token expires in 30 days. Consider reducing the token lifetime to 24 hours to mitigate session hijacking risks.",
              line: 42
            }
          ]
        };
        return new Response(JSON.stringify(secData), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const debtMatch = url.match(/\/api\/repos\/([^/]+)\/debt$/);
      if (debtMatch) {
        const repoId = debtMatch[1];
        const debtData = {
          debt_score: repoId === "1" ? 94 : 82,
          critical_count: repoId === "1" ? 0 : 1,
          major_count: repoId === "1" ? 1 : 2,
          minor_count: repoId === "1" ? 3 : 4,
          issues: repoId === "1" ? [
            {
              file: "src/app/dashboard/page.tsx",
              type: "Code Size",
              description: "File has 1689 lines which makes it difficult to read and maintain. Refactoring logic into reusable hook components is suggested.",
              severity: "major"
            },
            {
              file: "src/app/globals.css",
              type: "Unused CSS",
              description: "Several styling classes are declared but never used in rendering.",
              severity: "minor"
            }
          ] : [
            {
              file: "app/services/parser.py",
              type: "Complex Code",
              description: "Method 'parse_ast' has high cyclomatic complexity (24). Break down parser rules into smaller class modules.",
              severity: "critical"
            },
            {
              file: "app/api/repos.py",
              type: "Duplicated Logic",
              description: "Token lookup is repeated across multiple endpoints instead of utilizing a dependency injection guard.",
              severity: "major"
            }
          ]
        };
        return new Response(JSON.stringify(debtData), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const archMatch = url.match(/\/api\/repos\/([^/]+)\/architecture$/);
      if (archMatch) {
        const repoId = archMatch[1];
        
        const mockArch = repoId === "2" ? {
          summary: "Python backend coordinates FastAPI routing endpoints and AST parser systems.",
          nodes: [
            { id: "app/main.py", position: { x: 100, y: 150 }, data: { label: "main.py" } },
            { id: "app/api/repos.py", position: { x: 300, y: 50 }, data: { label: "api/repos.py" } },
            { id: "app/api/chat.py", position: { x: 300, y: 150 }, data: { label: "api/chat.py" } },
            { id: "app/api/reviews.py", position: { x: 300, y: 250 }, data: { label: "api/reviews.py" } },
            { id: "app/services/parser.py", position: { x: 500, y: 50 }, data: { label: "services/parser.py" } },
            { id: "app/services/vector_db.py", position: { x: 500, y: 150 }, data: { label: "services/vector_db.py" } },
            { id: "app/db/session.py", position: { x: 500, y: 280 }, data: { label: "db/session.py" } }
          ],
          edges: [
            { id: "e21", source: "app/main.py", target: "app/api/repos.py", animated: true },
            { id: "e22", source: "app/main.py", target: "app/api/chat.py", animated: true },
            { id: "e23", source: "app/main.py", target: "app/api/reviews.py", animated: true },
            { id: "e24", source: "app/api/repos.py", target: "app/services/parser.py" },
            { id: "e25", source: "app/api/chat.py", target: "app/services/vector_db.py" },
            { id: "e26", source: "app/services/vector_db.py", target: "app/db/session.py" },
            { id: "e27", source: "app/api/repos.py", target: "app/db/session.py" }
          ]
        } : {
          summary: "Frontend codebase contains Next.js route components, layout matrices, and dashboard visualizers.",
          nodes: [
            { id: "src/app/page.tsx", position: { x: 100, y: 150 }, data: { label: "page.tsx" } },
            { id: "src/app/layout.tsx", position: { x: 100, y: 50 }, data: { label: "layout.tsx" } },
            { id: "src/app/dashboard/layout.tsx", position: { x: 300, y: 50 }, data: { label: "dashboard/layout.tsx" } },
            { id: "src/app/dashboard/page.tsx", position: { x: 300, y: 150 }, data: { label: "dashboard/page.tsx" } },
            { id: "src/app/dashboard/architecture/page.tsx", position: { x: 500, y: 50 }, data: { label: "architecture/page.tsx" } },
            { id: "src/app/dashboard/chat/page.tsx", position: { x: 500, y: 150 }, data: { label: "chat/page.tsx" } },
            { id: "src/app/dashboard/security/page.tsx", position: { x: 500, y: 250 }, data: { label: "security/page.tsx" } },
            { id: "src/utils/supabase/client.ts", position: { x: 300, y: 300 }, data: { label: "supabase/client.ts" } },
            { id: "src/middleware.ts", position: { x: 100, y: 300 }, data: { label: "middleware.ts" } }
          ],
          edges: [
            { id: "e1", source: "src/app/layout.tsx", target: "src/app/page.tsx", animated: true },
            { id: "e2", source: "src/app/dashboard/layout.tsx", target: "src/app/dashboard/page.tsx", animated: true },
            { id: "e3", source: "src/app/dashboard/layout.tsx", target: "src/app/dashboard/architecture/page.tsx" },
            { id: "e4", source: "src/app/dashboard/layout.tsx", target: "src/app/dashboard/chat/page.tsx" },
            { id: "e5", source: "src/app/dashboard/layout.tsx", target: "src/app/dashboard/security/page.tsx" },
            { id: "e6", source: "src/app/dashboard/page.tsx", target: "src/utils/supabase/client.ts" },
            { id: "e7", source: "src/app/dashboard/chat/page.tsx", target: "src/utils/supabase/client.ts" },
            { id: "e8", source: "src/app/dashboard/security/page.tsx", target: "src/utils/supabase/client.ts" },
            { id: "e9", source: "src/middleware.ts", target: "src/utils/supabase/client.ts" }
          ]
        };

        return new Response(JSON.stringify(mockArch), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const sessionsMatch = url.match(/\/api\/repos\/([^/]+)\/chat\/sessions$/);
      if (sessionsMatch) {
        const repoId = sessionsMatch[1];
        if (!window.__mockChatSessions) window.__mockChatSessions = {};
        if (!window.__mockChatSessions[repoId]) {
          window.__mockChatSessions[repoId] = [
            { id: `s1-${repoId}`, title: "Overall Architecture Walkthrough" },
            { id: `s2-${repoId}`, title: "Security & Vulnerability Audits" }
          ];
        }
        return new Response(JSON.stringify(window.__mockChatSessions[repoId]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const messagesMatch = url.match(/\/api\/chat\/sessions\/([^/]+)\/messages$/);
      if (messagesMatch) {
        const sessionId = messagesMatch[1];
        if (!window.__mockChatMessages) window.__mockChatMessages = {};
        if (!window.__mockChatMessages[sessionId]) {
          window.__mockChatMessages[sessionId] = [
            {
              id: "m1",
              role: "user",
              content: "Can you explain the overall repository structure and high-level folders?",
              created_at: new Date(Date.now() - 3600000).toISOString()
            },
            {
              id: "m2",
              role: "assistant",
              content: sessionId.includes("-2")
                ? "Certainly! The FastAPI backend is structured as follows:\n\n- `/app/main.py`: Main API setup coordinating routers.\n- `/app/api`: Request handlers (`repos.py`, `chat.py`, `reviews.py`).\n- `/app/services`: Internal engines (`parser.py` AST parsing, `vector_db.py` vector calculations).\n- `/app/db`: Database session management."
                : "Certainly! The repository is structured as a modern full-stack web application:\n\n- `/frontend`: Next.js application using React components and tailwindcss.\n- `/backend`: FastAPI service coordinating python AST parsers and PostgreSQL pgvector connectivity.\n- `/supabase`: Config files and migrations setup.\n\nKey entry points include `/frontend/src/app/page.tsx` for the landing page and `/backend/app/main.py` for API routing.",
              citations: sessionId.includes("-2") ? ["app/main.py", "app/services/parser.py"] : ["frontend/src/app/page.tsx", "backend/app/main.py"],
              created_at: new Date(Date.now() - 3500000).toISOString()
            }
          ];
        }
        return new Response(JSON.stringify(window.__mockChatMessages[sessionId]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const postChatMatch = url.match(/\/api\/repos\/([^/]+)\/chat$/);
      if (postChatMatch) {
        const repoId = postChatMatch[1];
        let body: any = {};
        try {
          if (init && init.body) {
            body = JSON.parse(init.body as string);
          }
        } catch {}

        const userMsg = body.message || "";
        let sessionId = body.session_id;

        if (!window.__mockChatSessions) window.__mockChatSessions = {};
        if (!window.__mockChatSessions[repoId]) window.__mockChatSessions[repoId] = [];

        if (!sessionId) {
          sessionId = `s-temp-${Date.now()}`;
          const newSessionTitle = userMsg.substring(0, 30) + (userMsg.length > 30 ? "..." : "");
          window.__mockChatSessions[repoId].unshift({ id: sessionId, title: newSessionTitle });
        }

        if (!window.__mockChatMessages) window.__mockChatMessages = {};
        if (!window.__mockChatMessages[sessionId]) window.__mockChatMessages[sessionId] = [];

        window.__mockChatMessages[sessionId].push({
          id: `m-u-${Date.now()}`,
          role: "user",
          content: userMsg,
          created_at: new Date().toISOString()
        });

        let responseContent = "I've analyzed your question relative to the code indexing context. ";
        let citations = ["frontend/src/app/page.tsx"];
        if (userMsg.toLowerCase().includes("auth") || userMsg.toLowerCase().includes("login")) {
          responseContent += "Authentication in CodeForge AI is handled via GitHub OAuth with Supabase. You can find the main routing configuration in `/frontend/src/app/auth/callback` and session hooks in `dashboard/layout.tsx`. In addition, client-side route redirects are performed in the dashboard home and settings sub-pages.";
          citations = ["src/app/dashboard/layout.tsx", "src/middleware.ts"];
        } else if (userMsg.toLowerCase().includes("database") || userMsg.toLowerCase().includes("schema") || userMsg.toLowerCase().includes("model")) {
          responseContent += "The database uses PostgreSQL. Standard tables include `repositories` (metadata, git config), `repository_files` (source code indexing status), `health_scores` (calculated metrics breakdown), and `chat_sessions`/`chat_messages` (RAG persistence). Check `/supabase/migrations` for SQL details.";
          citations = ["supabase/migrations/schema.sql"];
        } else if (userMsg.toLowerCase().includes("architecture")) {
          responseContent += "The overall architecture follows a clean decoupling layer pattern. The frontend Next.js routing connects to the FastAPI backend asynchronously. Code files are mapped to React Flow nodes, representing dependency connections and import chains.";
          citations = ["src/app/dashboard/architecture/page.tsx"];
        } else if (userMsg.toLowerCase().includes("debt")) {
          responseContent += "Technical debt reports evaluate code sizing, cyclomatic complexity of functions, and circular dependency maps. Refactoring debt is tracked and indexed for each repository file in the `technical_debt_reports` table.";
          citations = ["src/app/dashboard/security/page.tsx"];
        } else {
          responseContent += "CodeForge AI parses source code into an Abstract Syntax Tree (AST) using Python's `ast` module, projects files as nodes on the architecture visualization graph, and saves code chunk embeddings via the OpenAI/Gemini embedding APIs to power this RAG assistant.";
          citations = ["app/services/parser.py"];
        }

        window.__mockChatMessages[sessionId].push({
          id: `m-a-${Date.now()}`,
          role: "assistant",
          content: responseContent,
          citations,
          created_at: new Date().toISOString()
        });

        return new Response(JSON.stringify({ session_id: sessionId }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/api/pr/review")) {
        const mockReview = {
          summary: "This pull request modifies `generateToken` in `src/services/auth.ts` to fetch the secret key from environment variables (`process.env.JWT_SECRET`) instead of hardcoding a placeholder value. It also increases the token expiration from 1 hour to 1 day.",
          risk_level: "Medium",
          recommendations: [
            {
              file: "src/services/auth.ts",
              type: "Security Guard",
              description: "Great security upgrade. Removing hardcoded key mitigates secret leakage. However, extending token expiration to 1 day increases vulnerability window. Consider using a refresh token rotation pattern instead."
            },
            {
              file: "src/services/auth.ts",
              type: "Validation Rules",
              description: "Ensure `process.env.JWT_SECRET` is checked during system startup to fail fast if config is missing."
            }
          ]
        };
        return new Response(JSON.stringify(mockReview), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return originalFetch(input, init);
  };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (typeof window !== "undefined" && localStorage.getItem("demo_mode") === "true") {
        setUser({
          id: "demo-user-id",
          email: "guest.developer@codeforge.ai",
          user_metadata: {
            user_name: "guest_developer",
            avatar_url: "https://github.com/github.png"
          }
        });
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        // Cache credentials for the landing page account chooser
        localStorage.setItem("saved_github_username", data.user.user_metadata?.user_name || "");
        localStorage.setItem("saved_github_avatar", data.user.user_metadata?.avatar_url || "");
        localStorage.setItem("saved_github_email", data.user.email || "");
      }
    };
    fetchUser();
  }, [supabase]);

  const handleSignOut = () => {
    setShowSignOutModal(true);
    setShowMobileDrawer(false);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  const avatarUrl = user?.user_metadata?.avatar_url;
  const username = user?.user_metadata?.user_name || "Developer";

  // Close mobile drawer when route changes
  useEffect(() => {
    setShowMobileDrawer(false);
  }, [pathname]);

  const renderSidebarContent = (isMobile: boolean = false) => {
    return (
      <div className="flex flex-col h-full bg-white select-none">
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter text-zinc-900 hover:opacity-90 transition-opacity cursor-pointer">
            <Layers className="w-5 h-5 text-primary" />
            <span>CodeForge<span className="text-zinc-500 font-medium">AI</span></span>
          </Link>
          {isMobile && (
            <button 
              onClick={() => setShowMobileDrawer(false)}
              className="p-1.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer border border-border"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Sidebar Main Links */}
        <nav className="flex-1 py-6 px-4 flex flex-col gap-1.5 overflow-y-auto">
          <Suspense fallback={<div className="text-zinc-400 text-xs font-mono p-4">Loading navigation...</div>}>
            <SidebarNavigation pathname={pathname} />
          </Suspense>
        </nav>
        
        {/* Sidebar Footer Section */}
        <div className="p-4 border-t border-border flex flex-col gap-3.5 shrink-0">
          {/* Founder Branding Card */}
          <div className="flex flex-col gap-2 p-3 bg-zinc-50 border border-border rounded-xl min-w-0 select-none text-left">
            <div className="flex items-center gap-2.5">
              <img 
                src="https://github.com/Lingu17.png" 
                alt="Lingraj Malipatil" 
                className="w-8 h-8 rounded-full border border-border shrink-0" 
              />
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-bold text-zinc-900 truncate">Lingraj Malipatil</span>
                <span className="text-[9px] text-zinc-550 leading-none mt-0.5 font-medium">Founder & AI Engineer</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-[#6B7280] border-t border-border/60 pt-2 mt-1">
              <a href="https://github.com/Lingu17" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-center gap-1 font-semibold">
                GitHub: @Lingu17
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors text-primary font-bold">
                LinkedIn Profile &rarr;
              </a>
            </div>
          </div>

          {/* User profile identifier */}
          <div className="flex items-center justify-between p-2 bg-zinc-50 border border-border rounded-xl min-w-0 text-left">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full border border-border shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center border border-border text-zinc-650 shrink-0 font-mono text-[9px] font-bold">
                  {username.substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-[10px] font-bold text-zinc-650 truncate">@{username}</span>
            </div>
            
            <button 
              onClick={handleSignOut}
              className="text-[10px] text-rose-600 hover:text-rose-500 cursor-pointer font-bold select-none pl-2 border-l border-border shrink-0"
            >
              Sign Out
            </button>
          </div>

          {/* Product metadata */}
          <div className="flex flex-col gap-0.5 text-center text-[9px] text-zinc-400 font-mono leading-none border-t border-border pt-3.5 select-none">
            <div className="flex justify-between items-center text-zinc-500 font-bold mb-1">
              <span>CodeForge AI</span>
              <span className="text-[8px] bg-zinc-100 px-1.5 py-0.5 rounded border border-border font-mono text-zinc-600">v1.0.0</span>
            </div>
            <span className="text-left text-[8px] text-zinc-400">Built with Next.js 15 • Supabase • Gemini • PostgreSQL</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex relative font-sans">
      {/* Desktop Sidebar (Persistent) */}
      <aside className="w-64 border-r border-border bg-white flex flex-col hidden md:flex shrink-0 z-20">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Sidebar Navigation Drawer Overlay */}
      {showMobileDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden flex justify-start">
          {/* Backdrop Touch Dismiss */}
          <div className="absolute inset-0" onClick={() => setShowMobileDrawer(false)} />
          {/* Drawer Menu */}
          <div className="relative w-64 h-full border-r border-border shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Global Dashboard Main Shell */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden bg-background">
        {/* Mobile View Top Navigation Header */}
        <header className="h-14 md:hidden flex items-center justify-between px-6 border-b border-border bg-white/80 backdrop-blur-md z-30 shrink-0 select-none">
          <Link href="/" className="flex items-center gap-2 font-bold text-md tracking-tighter">
            <Layers className="w-4.5 h-4.5 text-primary" />
            <span>CodeForge<span className="text-zinc-500 font-medium">AI</span></span>
          </Link>
          <button 
            onClick={() => setShowMobileDrawer(true)}
            className="p-1.5 hover:bg-zinc-50 rounded text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer border border-border"
            aria-label="Toggle Navigation Drawer"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* Dynamic Page Routes Content */}
        <main className="flex-1 overflow-y-auto bg-background min-h-0 flex flex-col">
          {children}
        </main>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-5 text-left animate-in fade-in zoom-in-95 duration-200 font-sans">
            <div>
              <h3 className="text-base font-bold text-zinc-900 mb-2 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-rose-500" /> Sign Out
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Are you sure you want to sign out of CodeForge AI?
              </p>
            </div>
            <div className="flex gap-3 justify-end mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSignOutModal(false)}
                className="text-zinc-500 hover:text-zinc-900 cursor-pointer h-9 px-4 text-xs font-semibold hover:bg-zinc-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmSignOut}
                className="bg-rose-600 hover:bg-rose-500 text-white cursor-pointer h-9 px-4 text-xs font-semibold rounded-lg shadow-sm"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function SidebarNavigation({ pathname }: { pathname: string }) {
  return (
    <div className="flex flex-col gap-6 text-left">
      {/* WORKSPACE SECTION */}
      <div className="flex flex-col gap-1">
        <span className="px-3 text-[9px] uppercase tracking-widest text-zinc-400 font-bold block mb-1.5 select-none">Workspace</span>
        <SidebarItem href="/dashboard" icon={<Home className="w-4 h-4" />} label="Repositories" active={pathname === "/dashboard"} />
        <SidebarItem href="/dashboard/architecture" icon={<Layers className="w-4 h-4" />} label="Architecture" active={pathname === "/dashboard/architecture"} />
        <SidebarItem href="/dashboard/chat" icon={<MessageSquare className="w-4 h-4" />} label="Codebase Chat" active={pathname === "/dashboard/chat"} />
      </div>

      {/* ANALYSIS SECTION */}
      <div className="flex flex-col gap-1">
        <span className="px-3 text-[9px] uppercase tracking-widest text-zinc-400 font-bold block mb-1.5 select-none">Analysis</span>
        <SidebarItem href="/dashboard/pr-reviews" icon={<GitBranch className="w-4 h-4" />} label="PR Reviews" active={pathname === "/dashboard/pr-reviews"} />
        <SidebarItem href="/dashboard/security" icon={<ShieldAlert className="w-4 h-4" />} label="Security & Debt" active={pathname === "/dashboard/security"} />
        <SidebarItem href="/dashboard/health" icon={<Activity className="w-4 h-4" />} label="Health Score" active={pathname === "/dashboard/health"} />
      </div>

      {/* ACCOUNT & BILLING SECTION */}
      <div className="flex flex-col gap-1">
        <span className="px-3 text-[9px] uppercase tracking-widest text-zinc-400 font-bold block mb-1.5 select-none">Management</span>
        <SidebarItem href="/dashboard/billing" icon={<CreditCard className="w-4 h-4" />} label="Billing" active={pathname === "/dashboard/billing"} />
        <SidebarItem href="/dashboard/settings" icon={<Settings className="w-4 h-4" />} label="Settings" active={pathname === "/dashboard/settings"} />
      </div>
    </div>
  );
}

function SidebarItem({ href, icon, label, active }: SidebarItemProps) {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const repoId = searchParams?.get("repo_id") || (mounted && typeof window !== "undefined" ? localStorage.getItem("selected_repo_id") : null);
  const targetHref = href === "/dashboard" || href === "/dashboard/settings" || href === "/dashboard/billing"
    ? href 
    : getModuleUrl(href.split("/").pop() || "", repoId);

  return (
    <Link 
      href={targetHref}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
        active 
          ? "bg-primary/5 text-primary border-primary/10 font-bold shadow-sm" 
          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
