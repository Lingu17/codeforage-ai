"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiUrl } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FolderGit2, Search, Plus, Star, GitFork, Clock, 
  Activity, Play, Loader2, ArrowRight, CheckCircle2, 
  XCircle, Layers, MessageSquare, ShieldAlert, BookOpen,
  Trash2, RefreshCw, MoreVertical, ExternalLink, Copy, Check, FileText,
  Edit2, X, Sparkles, Server, Info, Terminal, TrendingUp, TrendingDown
} from "lucide-react";
import { navigateToModule } from "@/utils/navigation";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  
  // Repos lists
  const [scannedRepos, setScannedRepos] = useState<any[]>([]);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Ingest states
  const [importUrl, setImportUrl] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [analyzingRepoId, setAnalyzingRepoId] = useState<string | null>(null);
  const [jobStatuses, setJobStatuses] = useState<Record<string, any>>({});
  const [importVisibility, setImportVisibility] = useState<"public" | "private">("public");
  const [importScanDepth, setImportScanDepth] = useState<"quick" | "standard" | "deep">("standard");
  
  // Selected repo for AI Summary
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [repoSummary, setRepoSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // GitHub loader errors and sync states
  const [githubLoadError, setGithubLoadError] = useState(false);
  const [loadingGithubRepos, setLoadingGithubRepos] = useState(false);

  // Repository actions UI states
  const [activeActionsMenu, setActiveActionsMenu] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null); // holds repoId to delete
  const [showRenameModal, setShowRenameModal] = useState<any>(null); // { id, name }
  const [newDisplayName, setNewDisplayName] = useState("");
  const [copiedRepoId, setCopiedRepoId] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [globalStats, setGlobalStats] = useState({
    totalFiles: 0,
    averageHealth: 80,
    criticalIssues: 0,
    aiConversations: 0
  });

  const fetchGlobalStats = async () => {
    try {
      const { count: filesCount } = await supabase
        .from("repository_files")
        .select("id", { count: "exact", head: true });
      
      const { data: healthData } = await supabase
        .from("health_scores")
        .select("overall_score");
        
      const { data: debtData } = await supabase
        .from("technical_debt_reports")
        .select("critical_count");
        
      const { count: chatCount } = await supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true });
        
      const totalFiles = filesCount || 0;
      const aiConversations = chatCount || 0;
      
      let averageHealth = 80;
      if (healthData && healthData.length > 0) {
        const sum = healthData.reduce((acc, curr) => acc + curr.overall_score, 0);
        averageHealth = Math.round(sum / healthData.length);
      }
      
      let criticalIssues = 0;
      if (debtData && debtData.length > 0) {
        criticalIssues = debtData.reduce((acc, curr) => acc + curr.critical_count, 0);
      }
      
      setGlobalStats({
        totalFiles,
        averageHealth,
        criticalIssues,
        aiConversations
      });
    } catch (e) {
      console.error("Error fetching global stats:", e);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveActionsMenu(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (scannedRepos.length > 0) {
      fetchGlobalStats();
    }
  }, [scannedRepos]);

  useEffect(() => {
    async function getSession() {
      const isDemo = typeof window !== "undefined" && localStorage.getItem("demo_mode") === "true";
      const { data } = await supabase.auth.getSession();
      
      if (isDemo) {
        setSession({
          user: {
            id: "demo-user-id",
            email: "guest.developer@codeforge.ai",
            user_metadata: {
              user_name: "guest_developer",
              avatar_url: "https://github.com/github.png"
            }
          }
        });
        setUsername("guest_developer");
        fetchScannedRepos();
        fetchGithubRepos("guest_developer");
      } else if (!data.session) {
        router.push("/");
      } else {
        const user = data.session.user;
        const name = user.user_metadata?.user_name || user.user_metadata?.preferred_username || "Developer";
        setUsername(name);
        fetchScannedRepos();
        if (name) {
          fetchGithubRepos(name, data.session?.provider_token);
        }
      }
      setLoading(false);
    }
    getSession();
  }, []);

  const fetchScannedRepos = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(getApiUrl("/api/repos"), { headers });
      if (res.ok) {
        const data = await res.json();
        setScannedRepos(data);
        
        // Auto-select first repo if none selected
        if (data.length > 0 && !selectedRepoId) {
          const queryId = searchParams?.get("repo_id");
          const localId = localStorage.getItem("selected_repo_id");
          const idToSelect = queryId || localId || data[0].id;
          const exists = data.some((r: any) => r.id === idToSelect);
          if (exists) {
            setSelectedRepoId(idToSelect);
          } else {
            setSelectedRepoId(data[0].id);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGithubRepos = async (name: string, providerToken?: string | null) => {
    setLoadingGithubRepos(true);
    setGithubLoadError(false);
    try {
      const url = getApiUrl(`/api/repos/github?username=${name}`) + (providerToken ? `&token=${providerToken}` : "");
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setGithubRepos(data);
      } else {
        setGithubLoadError(true);
      }
    } catch (e) {
      console.error(e);
      setGithubLoadError(true);
    } finally {
      setLoadingGithubRepos(false);
    }
  };

  // Poll scan jobs
  useEffect(() => {
    if (scannedRepos.length === 0) return;

    const interval = setInterval(() => {
      scannedRepos.forEach(async (repo) => {
        try {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: any = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
          const res = await fetch(getApiUrl(`/api/repos/${repo.id}/status`), { headers });
          if (res.ok) {
            const statusData = await res.json();
            setJobStatuses(prev => ({
              ...prev,
              [repo.id]: statusData
            }));

            // Refresh summary if it just finished
            if (statusData.status === "completed" && (!jobStatuses[repo.id] || jobStatuses[repo.id].status !== "completed")) {
              fetchGlobalStats();
              if (repo.id === selectedRepoId) {
                fetchRepoSummary(repo.id);
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [scannedRepos, selectedRepoId, repoSummary]);

  // Fetch summary when selected repo changes
  useEffect(() => {
    if (selectedRepoId) {
      localStorage.setItem("selected_repo_id", selectedRepoId);
      fetchRepoSummary(selectedRepoId);
      
      const currentQueryId = searchParams?.get("repo_id");
      if (currentQueryId !== selectedRepoId) {
        router.replace(`/dashboard?repo_id=${selectedRepoId}`);
      }
    } else {
      setRepoSummary(null);
      
      const currentQueryId = searchParams?.get("repo_id");
      if (currentQueryId) {
        router.replace(`/dashboard`);
      }
    }
  }, [selectedRepoId, searchParams, router]);

  // Open import modal if query param import=true is present
  useEffect(() => {
    if (searchParams?.get("import") === "true") {
      setShowImportModal(true);
    }
  }, [searchParams]);

  const fetchRepoSummary = async (repoId: string) => {
    setLoadingSummary(true);
    setRepoSummary(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(getApiUrl(`/api/repos/${repoId}/summary`), { headers });
      if (res.ok) {
        const data = await res.json();
        setRepoSummary(data);
      } else {
        setRepoSummary(null);
      }
    } catch (e) {
      setRepoSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleAnalyze = async (repo: any) => {
    setAnalyzingRepoId(repo.id.toString());
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      let githubIdToSend: number;
      if (repo.id === "custom") {
        githubIdToSend = Math.floor(Math.random() * 10000000);
      } else if (repo.github_id) {
        githubIdToSend = Number(repo.github_id);
      } else {
        githubIdToSend = Number(repo.id);
      }

      const response = await fetch(getApiUrl("/api/repos/analyze"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          github_id: githubIdToSend,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          language: repo.language,
          owner_username: repo.owner?.login || repo.owner_username || username,
          repo_url: repo.clone_url || repo.repo_url || `https://github.com/${repo.full_name}`
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        setShowImportModal(false);
        fetchScannedRepos();
        setSelectedRepoId(result.repository_id);
      } else {
        const errText = await response.text();
        console.error("Analysis request failed:", errText);
        alert(`Failed to start analysis: ${errText}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error connecting to backend API: ${e.message || e}`);
    } finally {
      setAnalyzingRepoId(null);
    }
  };

  const handleDirectUrlAnalyze = async () => {
    if (!importUrl) return;
    
    const regex = /github\.com\/([^/]+)\/([^/]+)/;
    const match = importUrl.match(regex);
    if (!match) {
      alert("Please enter a valid GitHub repository URL.");
      return;
    }
    
    const owner = match[1];
    const repoName = match[2].replace(".git", "");
    
    const mockRepo = {
      id: "custom",
      name: repoName,
      full_name: `${owner}/${repoName}`,
      description: "Custom URL Imported Repository",
      language: "TypeScript",
      owner: { login: owner },
      clone_url: importUrl
    };
    
    handleAnalyze(mockRepo);
  };

  const handleDeleteRepository = async (repoId: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(getApiUrl(`/api/repos/${repoId}`), {
        method: "DELETE",
        headers
      });
      
      if (response.ok) {
        setShowDeleteModal(null);
        // Clean active repo state if active was deleted
        if (selectedRepoId === repoId) {
          const remaining = scannedRepos.filter(r => r.id !== repoId);
          if (remaining.length > 0) {
            setSelectedRepoId(remaining[0].id);
          } else {
            setSelectedRepoId(null);
            localStorage.removeItem("selected_repo_id");
          }
        }
        fetchScannedRepos();
      } else {
        alert("Failed to delete repository.");
      }
    } catch (e) {
      console.error("Error deleting repository:", e);
    }
  };

  const handleRenameRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRenameModal || !newDisplayName) return;
    
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(getApiUrl(`/api/repos/${showRenameModal.id}`), {
        method: "PATCH",
        headers,
        body: JSON.stringify({ display_name: newDisplayName })
      });
      
      if (response.ok) {
        setShowRenameModal(null);
        setNewDisplayName("");
        fetchScannedRepos();
        if (selectedRepoId === showRenameModal.id && selectedRepoId) {
          fetchRepoSummary(selectedRepoId);
        }
      }
    } catch (e) {
      console.error("Error renaming repository:", e);
    }
  };

  const copyToClipboard = (text: string, repoId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRepoId(repoId);
    setTimeout(() => setCopiedRepoId(null), 2000);
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Calculations for dynamic analytics widgets
  const totalReposCount = scannedRepos.length;
  
  // Try to sum and compute metrics
  const filesIndexed = scannedRepos.reduce((acc, curr) => {
    // If a summary is loaded for this repo we can estimate, or sum based on files_count or placeholder
    return acc + (curr.id === selectedRepoId && repoSummary ? repoSummary.files_count : 15);
  }, 0);

  const averageHealthScore = scannedRepos.length > 0
    ? Math.round(scannedRepos.reduce((acc, curr) => {
        return acc + (curr.id === selectedRepoId && repoSummary ? repoSummary.health_score : 80);
      }, 0) / scannedRepos.length)
    : 0;

  const criticalIssuesCount = scannedRepos.reduce((acc, curr) => {
    if (curr.id === selectedRepoId && repoSummary) {
      return acc + (repoSummary.security?.vulnerabilities?.filter((v: any) => v.severity === "High").length || 0);
    }
    return acc + 0;
  }, 0);

  const mockAiQueries = totalReposCount * 12 + 4; // Mock queries sum

  // Get last scan time representation
  const getLastScanStr = () => {
    const job = selectedRepoId ? jobStatuses[selectedRepoId] : null;
    if (job && job.completed_at) {
      return "2 minutes ago";
    }
    return "Not Scanned";
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background text-foreground min-h-screen relative animate-pulse select-none font-sans">
        {/* Top Header Skeleton */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-card">
          <div className="flex flex-col gap-2">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-48 bg-slate-100 rounded" />
          </div>
          <div className="h-9 w-28 bg-slate-200 rounded-lg" />
        </header>
 
        {/* Content Skeleton */}
        <div className="p-8 flex-1 flex flex-col gap-8">
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-card border border-border p-4 rounded-xl h-20 flex flex-col justify-between">
                <div className="h-2 w-16 bg-slate-200 rounded" />
                <div className="h-5 w-24 bg-slate-350 rounded mt-2" />
              </div>
            ))}
          </div>
 
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar list skeleton */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card h-20 flex flex-col justify-between">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-2.5 w-16 bg-slate-150 rounded mt-2" />
                </div>
              ))}
            </div>
 
            {/* Workspace details skeleton */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="border border-border rounded-2xl bg-card p-6 h-60 flex flex-col justify-between">
                <div className="flex flex-col gap-3">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                  <div className="h-6 w-48 bg-slate-305 rounded" />
                  <div className="h-3 w-full bg-slate-200 rounded mt-2" />
                </div>
                <div className="grid grid-cols-4 gap-4 mt-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="h-2 w-12 bg-slate-200 rounded" />
                      <div className="h-3.5 w-20 bg-slate-150 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground min-h-screen relative">
      
      {/* Top Header */}
      <header className="h-auto md:h-16 flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-8 py-3 sm:py-0 border-b border-border bg-card/85 backdrop-blur-md z-10 shrink-0 gap-3">
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Welcome, {username}</h1>
          <span className="text-[10px] text-muted-foreground font-mono">
            {totalReposCount} Repositories | Last Scan: {getLastScanStr()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => setShowImportModal(true)}
            className="bg-primary hover:bg-primary/95 text-white gap-2 cursor-pointer font-bold text-xs h-11 px-4"
          >
            <Plus className="w-4 h-4" /> Import Repository
          </Button>
        </div>
      </header>
 
      {/* Main Container */}
      <div className="p-4 sm:p-8 flex-1 overflow-y-auto flex flex-col gap-8">
        
        {/* Dynamic Analytics Widget Banner */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <AnalyticsCard title="Repositories" value={`${totalReposCount} Active`} trend={<span className="text-[10px] text-primary flex items-center font-mono font-semibold"><TrendingUp className="w-3 h-3 mr-0.5" /> Connected</span>} />
          <AnalyticsCard title="Architecture Maps" value={`${totalReposCount > 0 ? 1 : 0} Generated`} trend={<span className="text-[10px] text-primary flex items-center font-mono font-semibold"><TrendingUp className="w-3 h-3 mr-0.5" /> Parsed</span>} />
          <AnalyticsCard title="Files Indexed" value={globalStats.totalFiles} trend={<span className="text-[10px] text-muted-foreground font-mono">Total Chunks</span>} />
          <AnalyticsCard title="Security Findings" value={`${globalStats.criticalIssues} Open`} trend={<span className="text-[10px] text-muted-foreground font-mono">Real-time</span>} />
          <AnalyticsCard className="col-span-2 md:col-span-1" title="PR Reviews" value={`${globalStats.aiConversations} Completed`} trend={<span className="text-[10px] text-muted-foreground font-mono">Sessions</span>} />
        </div>
 
        {/* Dashboard Content Grid */}
        {scannedRepos.length === 0 ? (
          /* Empty State Onboarding Experience (Full Page) */
          <div className="flex-1 border border-dashed border-border rounded-2xl bg-white p-12 text-center flex flex-col items-center justify-center gap-8 relative overflow-hidden font-sans shadow-sm max-w-4xl mx-auto w-full min-h-[500px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="w-16 h-16 rounded-2xl bg-primary/5 text-primary flex items-center justify-center border border-primary/15 animate-pulse">
              <FolderGit2 className="w-8 h-8" />
            </div>
            
            <div className="text-center max-w-lg">
              <h2 className="font-extrabold text-2xl text-zinc-900 mb-2">Connect Your First Repository</h2>
              <p className="text-sm text-zinc-500 leading-relaxed mt-1">
                Import a codebase to start mapping imports, checking vulnerabilities, auditing engineering health, and reviewing pull requests.
              </p>
            </div>

            {/* Premium Onboarding Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full text-left mt-2">
              <div className="p-4 border border-border bg-zinc-55/30 rounded-xl flex gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-800">Architecture Graph</h4>
                  <p className="text-[10px] text-zinc-500 mt-1">Trace import paths and local structures in an interactive visual map.</p>
                </div>
              </div>
              <div className="p-4 border border-border bg-zinc-55/30 rounded-xl flex gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-800">Codebase Chat (RAG)</h4>
                  <p className="text-[10px] text-zinc-500 mt-1">Query code logic and find flows instantly with file citations.</p>
                </div>
              </div>
              <div className="p-4 border border-border bg-zinc-55/30 rounded-xl flex gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-800">Security & Debt</h4>
                  <p className="text-[10px] text-zinc-500 mt-1">Scan for exposed keys, SQL vulnerabilities, and circular dependency loops.</p>
                </div>
              </div>
              <div className="p-4 border border-border bg-zinc-55/30 rounded-xl flex gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-800">PR Review Agent</h4>
                  <p className="text-[10px] text-zinc-500 mt-1">Submit git diff logs to generate lead-engineer quality safety checks.</p>
                </div>
              </div>
              <div className="p-4 border border-border bg-zinc-55/30 rounded-xl flex gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">5</div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-800">Health Analysis</h4>
                  <p className="text-[10px] text-zinc-500 mt-1">Grade codebase maintainability index on an enterprise 0-100 gauge.</p>
                </div>
              </div>
              <div className="p-4 border border-border bg-zinc-55/30 rounded-xl flex gap-3 shadow-xs">
                <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">6</div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-800">Developer API</h4>
                  <p className="text-[10px] text-zinc-500 mt-1">Generate live API tokens to query scanned metadata programmatically.</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setShowImportModal(true)}
              className="bg-primary hover:bg-primary/95 text-white font-bold h-11 px-8 rounded-xl shadow-md cursor-pointer mt-4 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Import Your First Repository
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Repository Cards */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              <h3 className="text-xs font-bold tracking-widest uppercase text-slate-500">Scanned Projects</h3>
              
              <div className="flex flex-col gap-3">
                {scannedRepos.map((repo) => {
                  const job = jobStatuses[repo.id];
                  const status = job?.status || repo.status || "completed";
                  const progress = job?.progress ?? repo.progress ?? 100;
                  const isSelected = selectedRepoId === repo.id;

                  return (
                    <div 
                      key={repo.id}
                      onClick={() => setSelectedRepoId(repo.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col gap-3 relative group ${
                        isSelected 
                          ? "bg-card border-primary shadow-sm ring-1 ring-primary/25" 
                          : "bg-card border-border hover:border-slate-350"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="truncate pr-6">
                          <h4 className="font-semibold text-sm text-foreground truncate">
                            {repo.display_name || repo.name}
                          </h4>
                          <span className="text-[10px] text-muted-foreground font-mono">{repo.full_name}</span>
                        </div>
                        
                        {/* Settings Dropdown Button */}
                        <div className="absolute top-4 right-4 z-20">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionsMenu(activeActionsMenu === repo.id ? null : repo.id);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
  
                          {/* Dropdown Options Popup */}
                          {activeActionsMenu === repo.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-30 py-1 font-sans text-xs">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionsMenu(null);
                                  setSelectedRepoId(repo.id);
                                }}
                                className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-700 hover:bg-slate-50 hover:text-foreground"
                              >
                                <Info className="w-3.5 h-3.5" /> View Details
                              </button>
                              <a 
                                href={`https://github.com/${repo.full_name}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-700 hover:bg-slate-50 hover:text-foreground"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Open on GitHub
                              </a>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionsMenu(null);
                                  copyToClipboard(`https://github.com/${repo.full_name}`, repo.id);
                                }}
                                className="flex items-center justify-between px-3 py-2 w-full text-left text-slate-700 hover:bg-slate-50 hover:text-foreground"
                              >
                                <span className="flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copy URL</span>
                                {copiedRepoId === repo.id && <Check className="w-3 h-3 text-emerald-650" />}
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionsMenu(null);
                                  setShowRenameModal({ id: repo.id, name: repo.display_name || repo.name });
                                  setNewDisplayName(repo.display_name || repo.name);
                                }}
                                className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-700 hover:bg-slate-50 hover:text-foreground"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Rename Display
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionsMenu(null);
                                  handleAnalyze(repo);
                                }}
                                className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-700 hover:bg-slate-50 hover:text-foreground border-t border-border"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Re-scan Repo
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionsMenu(null);
                                  handleExportPDF();
                                }}
                                className="flex items-center gap-2 px-3 py-2 w-full text-left text-slate-700 hover:bg-slate-50 hover:text-foreground"
                              >
                                <FileText className="w-3.5 h-3.5" /> Export Report (PDF)
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionsMenu(null);
                                  setShowDeleteModal(repo.id);
                                }}
                                className="flex items-center gap-2 px-3 py-2 w-full text-left text-rose-650 hover:bg-rose-50 hover:text-rose-700 border-t border-border"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete Repository
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
  
                      {/* Status Badges & Info */}
                      <div className="flex justify-between items-center text-xs mt-1">
                        {status === "completed" && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-mono">
                            Scan Complete
                          </Badge>
                        )}
                        {status === "failed" && (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] font-mono">
                            Failed
                          </Badge>
                        )}
                        {status === "queued" && (
                          <Badge className="bg-slate-50 text-slate-600 border-slate-200 text-[9px] font-mono">
                            Queued
                          </Badge>
                        )}
                        {status === "cloning" && (
                          <Badge className="bg-primary/5 text-primary border-primary/15 text-[9px] font-mono animate-pulse flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Cloning Repository
                          </Badge>
                        )}
                        {status === "scanning" && (
                          <Badge className="bg-primary/5 text-primary border-primary/15 text-[9px] font-mono animate-pulse flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Scanning Files
                          </Badge>
                        )}
                        {status === "embedding" && (
                          <Badge className="bg-primary/5 text-primary border-primary/15 text-[9px] font-mono animate-pulse flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Generating Embeddings
                          </Badge>
                        )}
                        {status === "analyzing" && (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-mono animate-pulse flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> AI Analysis
                          </Badge>
                        )}
                      </div>
  
                      {/* Scan Progress Timeline */}
                      {status !== "completed" && status !== "failed" && (
                        <div className="w-full bg-slate-50 border border-border rounded-xl p-3 flex flex-col gap-2 font-sans text-[10px] text-left">
                          <div className="flex justify-between items-center text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                            <span>Scan Progress</span>
                            <span className="font-mono text-primary animate-pulse">{progress}%</span>
                          </div>
                          
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-1">
                            <div 
                              className="bg-primary h-full transition-all duration-500 rounded-full" 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Columns: AI Ingestion Details Panel */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {selectedRepoId ? (
                (() => {
                  const selectedRepo = scannedRepos.find(r => r.id === selectedRepoId);
                  const activeJob = jobStatuses[selectedRepoId] || selectedRepo;
                  const scanStatus = activeJob?.status || "completed";
                  const isScanCompleted = scanStatus === "completed";
                  const progressValue = activeJob?.progress ?? 100;

                  if (scanStatus === "failed") {
                    return (
                      <div className="flex-1 flex flex-col gap-6 select-none font-sans">
                        <Card className="bg-white border-rose-200 border-2 shadow-md p-6 flex flex-col gap-5 text-left">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                              <XCircle className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col flex-1">
                              <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-mono uppercase font-bold w-fit">
                                Pipeline Failure
                              </Badge>
                              <h3 className="text-base font-bold text-zinc-900 mt-2">Scan Analysis Failed</h3>
                              <p className="text-xs text-rose-650 leading-relaxed mt-1 font-sans">
                                The code analysis pipeline encountered a compilation or parsing error:
                              </p>
                              <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-lg font-mono text-[10px] text-rose-700 mt-3 whitespace-pre-wrap leading-relaxed">
                                {activeJob?.error_message || "AST parsing timeout or Git authentication token invalid."}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-3 border-t border-rose-100 pt-4 mt-2">
                            <Button 
                              onClick={() => handleAnalyze(selectedRepo)}
                              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer h-9 px-4 rounded-lg shadow-sm"
                            >
                              Retry Ingest Analysis
                            </Button>
                          </div>
                        </Card>
                      </div>
                    );
                  }

                  if (loadingSummary || !isScanCompleted) {
                    /* Show Skeletons and Live Ingestion Checklist */
                    let statusTitle = "Analyzing Repository Structure";
                    let statusDesc = "Please wait. CodeForge AI background systems are scanning files, calculating health, and extracting modules.";
                    
                    if (scanStatus === "queued") {
                      statusTitle = "Repository Queued for Analysis";
                      statusDesc = "Waiting for an execution worker slot to begin pipeline ingestion.";
                    } else if (scanStatus === "cloning") {
                      statusTitle = "Cloning Repository Codebase";
                      statusDesc = "Pulling code nodes and files from GitHub via authenticated OAuth session.";
                    } else if (scanStatus === "analyzing") {
                      statusTitle = "Building Repository Intelligence";
                      statusDesc = "Parsing Abstract Syntax Trees (ASTs), mapping references, and resolving circular dependencies.";
                    }

                    return (
                      <div className="flex-1 flex flex-col gap-6 select-none font-sans">
                        <Card className="bg-white border-border shadow-sm p-6 flex flex-col gap-6 text-left">
                          <div>
                            <Badge className="bg-primary/5 text-primary border border-primary/10 animate-pulse text-[9px] font-mono uppercase font-bold">
                              {scanStatus.toUpperCase()} ({progressValue}%)
                            </Badge>
                            <h3 className="text-base font-bold text-zinc-900 mt-2">{statusTitle}</h3>
                            <p className="text-xs text-zinc-500 mt-1">{statusDesc}</p>
                          </div>

                          {/* Steps checklist */}
                          <div className="border border-border rounded-xl bg-zinc-50/50 p-4 flex flex-col gap-3.5 font-mono text-xs text-left">
                            <div className="flex justify-between items-center border-b border-border pb-2">
                              <span className="text-[10px] uppercase font-bold text-zinc-400">Ingestion Stage</span>
                              <span className="text-[10px] uppercase font-bold text-zinc-400">Status</span>
                            </div>
                            
                            {/* 1. Repository Cloned */}
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-650">Repository Cloned</span>
                              {["queued", "cloning"].includes(scanStatus) ? (
                                <span className="text-primary font-bold animate-pulse">⟳ Cloning</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">✓ Complete</span>
                              )}
                            </div>

                            {/* 2. Dependencies Indexed */}
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-650">Dependencies Indexed</span>
                              {["queued", "cloning"].includes(scanStatus) ? (
                                <span className="text-zinc-400 font-bold">○ Pending</span>
                              ) : scanStatus === "scanning" ? (
                                <span className="text-primary font-bold animate-pulse">⟳ Indexing</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">✓ Complete</span>
                              )}
                            </div>

                            {/* 3. Generating Embeddings */}
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-650">Generating Embeddings</span>
                              {["queued", "cloning", "scanning"].includes(scanStatus) ? (
                                <span className="text-zinc-400 font-bold">○ Pending</span>
                              ) : scanStatus === "embedding" ? (
                                <span className="text-primary font-bold animate-pulse">⟳ Embedding</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">✓ Complete</span>
                              )}
                            </div>

                            {/* 4. Building Architecture Graph */}
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-650">Building Architecture Graph</span>
                              {["queued", "cloning", "scanning", "embedding"].includes(scanStatus) ? (
                                <span className="text-zinc-400 font-bold">○ Pending</span>
                              ) : scanStatus === "analyzing" && progressValue < 80 ? (
                                <span className="text-primary font-bold animate-pulse">⟳ Building</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">✓ Complete</span>
                              )}
                            </div>

                            {/* 5. Security Analysis */}
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-650">Security Analysis</span>
                              {["queued", "cloning", "scanning", "embedding"].includes(scanStatus) ? (
                                <span className="text-zinc-400 font-bold">○ Pending</span>
                              ) : scanStatus === "analyzing" && progressValue >= 80 && progressValue < 90 ? (
                                <span className="text-primary font-bold animate-pulse">⟳ Auditing</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">✓ Complete</span>
                              )}
                            </div>

                            {/* 6. Health Calculation */}
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-650">Health Calculation</span>
                              {["queued", "cloning", "scanning", "embedding"].includes(scanStatus) ? (
                                <span className="text-zinc-400 font-bold">○ Pending</span>
                              ) : scanStatus === "analyzing" && progressValue >= 90 && progressValue < 100 ? (
                                <span className="text-primary font-bold animate-pulse">⟳ Calculating</span>
                              ) : (
                                <span className="text-emerald-600 font-bold">✓ Complete</span>
                              )}
                            </div>

                            {/* 7. Scan Complete */}
                            <div className="flex justify-between items-center border-t border-border pt-2">
                              <span className="text-zinc-800 font-bold">Scan Complete</span>
                              {isScanCompleted ? (
                                <span className="text-emerald-600 font-bold">✓ Done</span>
                              ) : (
                                <span className="text-zinc-400 font-bold">○ Waiting</span>
                              )}
                            </div>
                          </div>
                        </Card>

                        {/* Lock skeletons for navigation pages */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="bg-white border border-border rounded-xl p-6 h-32 flex gap-4 opacity-50 relative select-none">
                              <div className="w-12 h-12 bg-slate-200 rounded-lg shrink-0 flex items-center justify-center text-zinc-400">
                                <Clock className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col gap-2 flex-1 mt-1">
                                <div className="h-3 w-32 bg-slate-200 rounded" />
                                <div className="h-2.5 w-full bg-slate-150 rounded" />
                                <div className="h-2.5 w-[70%] bg-slate-150 rounded" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (!repoSummary) return null;

                  return (
                    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                      {/* AI Summary Card */}
                      <Card className="bg-card border-border shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[64px] pointer-events-none" />
                        <CardHeader className="border-b border-border pb-4 text-left">
                          <div className="flex justify-between items-center">
                            <div>
                              <Badge variant="outline" className="border-primary/30 text-primary mb-2 text-[10px] font-mono">
                                Active AI Analysis
                              </Badge>
                              <CardTitle className="text-xl text-foreground font-bold tracking-tight">
                                {repoSummary.repository.display_name || repoSummary.repository.name}
                              </CardTitle>
                              <CardDescription className="text-muted-foreground mt-1 text-xs line-clamp-2">
                                {repoSummary.repository.description || "No description loaded."}
                              </CardDescription>
                            </div>
                            
                            {/* Health Circle */}
                            <div 
                              onClick={() => router.push(`/dashboard/health?repo_id=${selectedRepoId}`)}
                              className="flex flex-col items-center gap-1 cursor-pointer hover:opacity-90 transition-opacity"
                            >
                              <div className="relative w-16 h-16 flex items-center justify-center rounded-full border-4 border-slate-100 bg-white">
                                <svg className="absolute w-full h-full transform -rotate-90">
                                  <circle 
                                    cx="32" 
                                    cy="32" 
                                    r="26" 
                                    fill="transparent" 
                                    stroke="#4F46E5" 
                                    strokeWidth="4" 
                                    strokeDasharray={`${2 * Math.PI * 26}`}
                                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - repoSummary.health_score / 100)}`}
                                    className="transition-all duration-1000"
                                  />
                                </svg>
                                <span className="text-base font-bold font-mono text-primary">{repoSummary.health_score}</span>
                              </div>
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Health Score</span>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-xs text-left">
                          {/* Tech Stack */}
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Tech Stack</span>
                            <span className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" /> 
                              {repoSummary.tech_stack?.join(", ") || "TypeScript"}
                            </span>
                          </div>
                          {/* Architecture */}
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Architecture</span>
                            <span className="font-semibold text-foreground truncate">{repoSummary.architecture}</span>
                          </div>
                          {/* Size */}
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">File Metrics</span>
                            <span className="font-semibold text-foreground truncate">
                              {repoSummary.files_count} files / {repoSummary.functions_count} funcs
                            </span>
                          </div>
                          {/* Risk level */}
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Risk Assessment</span>
                            <span className={`font-semibold ${
                              repoSummary.risk_level === 'High' ? 'text-rose-600' : 'text-emerald-600'
                            }`}>{repoSummary.risk_level} Risk</span>
                          </div>
                        </CardContent>
                        
                        <div className="px-6 pb-4 flex justify-between border-t border-border pt-4 text-xs">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setShowDrawer(true)}
                            className="text-slate-600 hover:text-foreground text-xs gap-1.5 cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5 text-primary" /> View Details Drawer
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleExportPDF}
                            className="text-slate-600 hover:text-foreground text-xs gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" /> Export PDF Summary
                          </Button>
                        </div>
                      </Card>
     
                      {/* Dynamic Nav Features Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Architecture Link */}
                        <Card 
                          onClick={() => navigateToModule(router, "architecture", selectedRepoId)}
                          className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group p-6 flex gap-4 items-start shadow-sm"
                        >
                          <div className="p-3 bg-indigo-50 rounded-lg text-primary group-hover:bg-indigo-100 transition-colors shrink-0">
                            <Layers className="w-6 h-6" />
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 text-sm flex items-center gap-1">
                              Architecture Intelligence <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Explore project structures and import connection paths using interactive React Flow nodes.
                            </p>
                          </div>
                        </Card>
     
                        {/* Codebase Chat Link */}
                        <Card 
                          onClick={() => navigateToModule(router, "chat", selectedRepoId)}
                          className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group p-6 flex gap-4 items-start shadow-sm"
                        >
                          <div className="p-3 bg-indigo-50 rounded-lg text-primary group-hover:bg-indigo-100 transition-colors shrink-0">
                            <MessageSquare className="w-6 h-6" />
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 text-sm flex items-center gap-1">
                              Codebase Chat (RAG) <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Ask natural language queries and pinpoint exact logic setups using vector citation chunks.
                            </p>
                          </div>
                        </Card>
     
                        {/* Security & Debt Link */}
                        <Card 
                          onClick={() => navigateToModule(router, "security", selectedRepoId)}
                          className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group p-6 flex gap-4 items-start shadow-sm"
                        >
                          <div className="p-3 bg-rose-50 rounded-lg text-rose-600 group-hover:bg-rose-100 transition-colors shrink-0">
                            <ShieldAlert className="w-6 h-6" />
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 text-sm flex items-center gap-1">
                              Security & Tech Debt <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Audit security warnings, exposed tokens, circular imports, and review technical debt issues.
                            </p>
                          </div>
                        </Card>
     
                        {/* PR Review Agent */}
                        <Card 
                          onClick={() => navigateToModule(router, "pr-reviews", selectedRepoId)}
                          className="bg-card border-border hover:border-primary/30 transition-all cursor-pointer group p-6 flex gap-4 items-start shadow-sm"
                        >
                          <div className="p-3 bg-indigo-50 rounded-lg text-primary group-hover:bg-indigo-100 transition-colors shrink-0">
                            <GitFork className="w-6 h-6" />
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 text-sm flex items-center gap-1">
                              PR Review Agent <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Submit git diff logs to generate deep audits and safety optimizations using Gemini Pro.
                            </p>
                          </div>
                        </Card>
                      </div>
     
                      {/* Recent Activity Log & Future Roadmap Side-by-Side */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Recent Activity Log */}
                        <Card className="bg-card border border-border p-6 shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5 text-left">
                            <Clock className="w-3.5 h-3.5 text-primary animate-pulse" /> Recent Activity Log
                          </h4>
                          <div className="flex flex-col gap-3.5 font-sans text-xs">
                            <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border text-left">
                              <div className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-primary shrink-0 mt-0.5 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">Codebase indexed</span>
                                <span className="text-[10px] text-muted-foreground">45 sec ago • Gemini generated 768-dim embeddings</span>
                              </div>
                            </div>
         
                            <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border text-left">
                              <div className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-primary shrink-0 mt-0.5 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">PR review generated</span>
                                <span className="text-[10px] text-muted-foreground">1 min ago • Code audit completed on recent Git diff</span>
                              </div>
                            </div>
      
                            <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border text-left">
                              <div className="w-3.5 h-3.5 rounded-full bg-emerald-50 border border-emerald-500 shrink-0 mt-0.5 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">Security scan completed</span>
                                <span className="text-[10px] text-muted-foreground">2 min ago • Vulnerabilities audited successfully</span>
                              </div>
                            </div>
         
                            <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border text-left">
                              <div className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-primary shrink-0 mt-0.5 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">Architecture generated</span>
                                <span className="text-[10px] text-muted-foreground">3 min ago • Local file import relationships mapped</span>
                              </div>
                            </div>
         
                            <div className="flex gap-3 items-start text-left">
                              <div className="w-3.5 h-3.5 rounded-full bg-slate-100 border border-border shrink-0 mt-0.5 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-foreground font-semibold">Repository imported</span>
                                <span className="text-[10px] text-muted-foreground">4 min ago • Cloned via GitHub OAuth</span>
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Future SaaS Roadmap & Features Teaser */}
                        <Card className="bg-slate-50 border border-border p-6 shadow-sm">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5 text-left">
                            <Sparkles className="w-3.5 h-3.5 text-pink-500 animate-pulse" /> SaaS Features Roadmap
                          </h4>
                          <div className="grid grid-cols-1 gap-4 text-left font-sans text-xs">
                            <div className="flex gap-2">
                              <Badge className="bg-white text-slate-650 border border-border h-5 shrink-0">Roadmap</Badge>
                              <div>
                                <strong className="text-zinc-800 font-bold">Team Collaboration</strong>
                                <p className="text-[10px] text-slate-500 mt-0.5">Invite teammates, run cross-developer chat threads, and sync reviews.</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Badge className="bg-white text-slate-650 border border-border h-5 shrink-0">Roadmap</Badge>
                              <div>
                                <strong className="text-zinc-800 font-bold">GitHub Actions Trigger</strong>
                                <p className="text-[10px] text-slate-500 mt-0.5">Run security audits and code grading automatically on every push.</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Badge className="bg-white text-slate-650 border border-border h-5 shrink-0">Roadmap</Badge>
                              <div>
                                <strong className="text-zinc-800 font-bold">Slack & Discord Alerts</strong>
                                <p className="text-[10px] text-slate-500 mt-0.5">Notify channels when scan grades drop or critical secrets leak.</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Repos exist but none is selected yet -> show default welcome and activity feed */
                <div className="flex-1 flex flex-col gap-6 text-left">
                  <Card className="bg-card border-border p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-primary animate-pulse" /> Welcome to CodeForge AI
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Select a repository from the scanned projects list on the left to explore its architecture, chat with the codebase, check security debt, and audit health scores.
                    </p>
                  </Card>
   
                  {/* Default Recent Activity Feed */}
                  <Card className="bg-card border-border p-6 shadow-sm">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" /> Recent Activity Log
                    </h4>
                    <div className="flex flex-col gap-3.5 font-sans text-xs">
                      <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border">
                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-primary shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-foreground font-semibold">Codebase indexed</span>
                          <span className="text-[10px] text-muted-foreground">45 sec ago • Gemini generated 768-dim embeddings</span>
                        </div>
                      </div>
   
                      <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border">
                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-primary shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-foreground font-semibold">PR review generated</span>
                          <span className="text-[10px] text-muted-foreground">1 min ago • Code audit completed on recent Git diff</span>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-50 border border-emerald-500 shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-foreground font-semibold">Security scan completed</span>
                          <span className="text-[10px] text-muted-foreground">2 min ago • Vulnerabilities audited successfully</span>
                        </div>
                      </div>
   
                      <div className="flex gap-3 items-start relative pb-3 before:absolute before:left-1.5 before:top-4 before:bottom-0 before:w-px before:bg-border">
                        <div className="w-3.5 h-3.5 rounded-full bg-indigo-50 border border-primary shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-foreground font-semibold">Architecture generated</span>
                          <span className="text-[10px] text-muted-foreground">3 min ago • Local file import relationships mapped</span>
                        </div>
                      </div>
   
                      <div className="flex gap-3 items-start">
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-100 border border-border shrink-0 mt-0.5 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-foreground font-semibold">Repository imported</span>
                          <span className="text-[10px] text-muted-foreground">4 min ago • Cloned via GitHub OAuth</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
 
      {/* GitHub Repo Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-card border border-border rounded-2xl w-full max-w-[95vw] md:max-w-2xl p-6 shadow-xl flex flex-col gap-6 max-h-[85vh]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Import Repository</h3>
                <p className="text-xs text-muted-foreground">Import directly via clone URL or select one of your public GitHub repositories.</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowImportModal(false)}
                className="text-slate-500 hover:text-foreground cursor-pointer"
              >
                Cancel
              </Button>
            </div>
 
            {/* Custom URL Import Form */}
            <div className="flex flex-col gap-4 text-xs font-sans text-left border-b border-border pb-5">
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">GitHub URL</span>
                <input 
                  type="text" 
                  placeholder="https://github.com/owner/repo" 
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="bg-white border border-border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-full"
                />
              </div>
 
              <div className="grid grid-cols-2 gap-4">
                {/* Visibility */}
                <div className="flex flex-col gap-1.5 flex-1">
                  <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Visibility</span>
                  <div className="bg-zinc-100 rounded-lg p-1 flex w-full border border-zinc-200">
                    <button 
                      type="button"
                      onClick={() => setImportVisibility("public")}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        importVisibility === 'public' 
                          ? 'bg-white border border-zinc-200 text-zinc-900 font-semibold shadow-sm' 
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full border transition-all ${
                        importVisibility === 'public' ? 'bg-primary border-primary' : 'bg-transparent border-zinc-400'
                      }`} />
                      Public
                    </button>
                    <button 
                      type="button"
                      onClick={() => setImportVisibility("private")}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        importVisibility === 'private' 
                          ? 'bg-white border border-zinc-200 text-zinc-900 font-semibold shadow-sm' 
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full border transition-all ${
                        importVisibility === 'private' ? 'bg-primary border-primary' : 'bg-transparent border-zinc-400'
                      }`} />
                      Private
                    </button>
                  </div>
                </div>
 
                {/* Scan Depth */}
                <div className="flex flex-col gap-1.5 flex-1">
                  <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Scan Depth</span>
                  <div className="bg-zinc-100 rounded-lg p-1 flex w-full border border-zinc-200 gap-1">
                    <button 
                      type="button"
                      onClick={() => setImportScanDepth("quick")}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex flex-col items-center justify-center transition-all cursor-pointer ${
                        importScanDepth === 'quick' 
                          ? 'bg-white border border-zinc-200 text-zinc-900 font-semibold shadow-sm' 
                          : 'text-zinc-550 hover:text-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full border transition-all ${
                          importScanDepth === 'quick' ? 'bg-primary border-primary' : 'bg-transparent border-zinc-400'
                        }`} />
                        <span className="font-semibold">Quick</span>
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">~30 sec</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setImportScanDepth("standard")}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex flex-col items-center justify-center transition-all cursor-pointer ${
                        importScanDepth === 'standard' 
                          ? 'bg-white border border-zinc-200 text-zinc-900 font-semibold shadow-sm' 
                          : 'text-zinc-550 hover:text-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full border transition-all ${
                          importScanDepth === 'standard' ? 'bg-primary border-primary' : 'bg-transparent border-zinc-400'
                        }`} />
                        <span className="font-semibold">Standard</span>
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">~2 min</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setImportScanDepth("deep")}
                      className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium flex flex-col items-center justify-center transition-all cursor-pointer ${
                        importScanDepth === 'deep' 
                          ? 'bg-white border border-zinc-200 text-zinc-900 font-semibold shadow-sm' 
                          : 'text-zinc-550 hover:text-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full border transition-all ${
                          importScanDepth === 'deep' ? 'bg-primary border-primary' : 'bg-transparent border-zinc-400'
                        }`} />
                        <span className="font-semibold">Deep</span>
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">~5 min</span>
                    </button>
                  </div>
                </div>
              </div>
 
              <Button 
                onClick={handleDirectUrlAnalyze} 
                disabled={analyzingRepoId !== null || !importUrl.trim()}
                className="bg-primary hover:bg-primary/95 text-white cursor-pointer font-bold text-xs h-11 w-full rounded-xl mt-2 flex items-center justify-center gap-1.5"
              >
                {analyzingRepoId === 'custom' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {analyzingRepoId === 'custom' ? "Analyzing Repository..." : "Analyze Repository"}
              </Button>
            </div>
 
            <div className="border-t border-border pt-4 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Your GitHub Repositories</span>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input 
                    type="text" 
                    placeholder="Filter repos..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white border border-border rounded-md pl-8 pr-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full text-foreground"
                  />
                </div>
              </div>
 
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                {loadingGithubRepos ? (
                  /* Loading Skeletons */
                  <div className="flex flex-col gap-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 bg-slate-55 border border-border rounded-lg flex items-center justify-between h-14">
                        <div className="flex flex-col gap-1.5 flex-1 pr-4">
                          <div className="h-3.5 w-32 bg-slate-200 rounded" />
                          <div className="h-2.5 w-48 bg-slate-150 rounded" />
                        </div>
                        <div className="h-8 w-20 bg-slate-200 rounded shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : githubLoadError ? (
                  /* GitHub Load Error State with Retry Button */
                  <div className="py-6 text-center flex flex-col items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-rose-500 opacity-80" />
                    <div className="text-center font-sans">
                      <h5 className="font-semibold text-xs text-foreground">GitHub repositories could not be loaded.</h5>
                      <div className="text-[10px] text-slate-550 mt-2 flex flex-col gap-1 items-center bg-slate-50 border border-border p-3 rounded-lg leading-relaxed">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-slate-400 mb-1">Possible reasons:</span>
                        <span>• GitHub permissions missing</span>
                        <span>• Username unavailable</span>
                        <span>• API rate limit exceeded</span>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => fetchGithubRepos(username, session?.provider_token)}
                      className="bg-slate-100 hover:bg-primary hover:text-white border border-border text-[10px] h-8 px-4 mt-1 font-bold cursor-pointer rounded-lg transition-colors text-slate-700"
                    >
                      Retry
                    </Button>
                  </div>
                ) : githubRepos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground font-sans">
                    No repositories found. Ensure your GitHub username is public.
                  </div>
                ) : (
                  githubRepos.filter(repo => repo.name.toLowerCase().includes(searchQuery.toLowerCase())).map((repo) => (
                    <div 
                      key={repo.id}
                      className="p-3 bg-slate-50 border border-border rounded-lg flex items-center justify-between hover:border-primary/50 transition-colors"
                    >
                      <div className="truncate pr-4 text-left">
                        <span className="font-medium text-sm text-foreground truncate block">{repo.name}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{repo.description || "No description."}</span>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleAnalyze(repo)}
                        disabled={analyzingRepoId !== null}
                        className="bg-primary hover:bg-primary/95 text-white text-xs px-3 h-8 flex items-center gap-1 font-semibold transition-colors cursor-pointer rounded-lg"
                      >
                        {analyzingRepoId === repo.id.toString() ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )} 
                        {analyzingRepoId === repo.id.toString() ? "Queuing..." : "Analyze"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
 
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-card border border-rose-200 rounded-2xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-xl flex flex-col gap-5 text-left font-sans">
            <div>
              <h3 className="text-base font-bold text-foreground mb-2 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" /> Delete Repository?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete this repository and all associated scans, file indices, embeddings, and chat histories? This action is permanent and cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="ghost" 
                onClick={() => setShowDeleteModal(null)}
                className="text-slate-500 hover:text-foreground text-xs cursor-pointer h-9 px-4"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleDeleteRepository(showDeleteModal)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer h-9 px-4"
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
 
      {/* Rename Display Name Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <form onSubmit={handleRenameRepository} className="bg-card border border-border rounded-2xl w-full max-w-[95vw] sm:max-w-md p-6 shadow-xl flex flex-col gap-5 text-left font-sans">
            <div>
              <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" /> Rename Custom Display Name
              </h3>
              <p className="text-[10px] text-slate-500">Update the label displayed on your dashboard scanned projects cards.</p>
            </div>
            <input 
              type="text" 
              placeholder="Display Name" 
              required
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="bg-white border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground w-full"
            />
            <div className="flex gap-3 justify-end">
              <Button 
                type="button"
                variant="ghost" 
                onClick={() => setShowRenameModal(null)}
                className="text-slate-500 hover:text-foreground text-xs cursor-pointer h-9 px-4"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-primary hover:bg-primary/95 text-white text-xs font-semibold cursor-pointer h-9 px-4"
              >
                Save Rename
              </Button>
            </div>
          </form>
        </div>
      )}
 
      {/* Repository Details sliding panel / Drawer */}
      {showDrawer && repoSummary && (
        <div className="fixed inset-0 z-40 flex justify-end font-sans">
          {/* Overlay background */}
          <div 
            onClick={() => setShowDrawer(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" 
          />
          {/* Drawer container */}
          <div className="relative w-full max-w-md bg-card h-full shadow-2xl border-l border-border flex flex-col p-6 overflow-y-auto text-left gap-6 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-start border-b border-border pb-4">
              <div>
                <Badge variant="outline" className="border-primary/20 text-primary text-[9px] font-mono mb-1">
                  Metadata Ingestion Details
                </Badge>
                <h3 className="text-lg font-bold text-foreground">{repoSummary.repository.display_name || repoSummary.repository.name}</h3>
                <span className="text-[10px] text-muted-foreground font-mono">{repoSummary.repository.full_name}</span>
              </div>
              <button 
                onClick={() => setShowDrawer(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
 
            <div className="flex flex-col gap-4 text-xs text-slate-700">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Owner / Author</span>
                <span className="text-slate-800 font-medium">{repoSummary.repository.owner_username}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Primary Language</span>
                <span className="text-slate-800 font-medium">{repoSummary.repository.language}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Architecture Partition</span>
                <span className="text-slate-800 font-medium">{repoSummary.architecture}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Files Count</span>
                <span className="text-slate-850 font-mono font-medium">{repoSummary.files_count}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Functions Extracted</span>
                <span className="text-slate-850 font-mono font-medium">{repoSummary.functions_count}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Scan Storage Size</span>
                <span className="text-slate-850 font-mono font-medium">
                  {Math.round(repoSummary.size_bytes / 1024)} KB
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Health Index Grade</span>
                <span className="text-emerald-600 font-mono font-bold">{repoSummary.health_score} / 100</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Security Score</span>
                <span className="text-emerald-600 font-mono font-bold">
                  {repoSummary.security?.security_score || 80} / 100
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-slate-500">Vulnerabilities Detected</span>
                <span className="text-rose-600 font-mono font-bold">
                  {repoSummary.security?.vulnerabilities?.length || 0}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Import Date</span>
                <span className="text-slate-650">
                  {new Date(repoSummary.repository.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
 
            <Button 
              onClick={() => {
                setShowDrawer(false);
                handleExportPDF();
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-border w-full text-xs font-semibold cursor-pointer h-9 mt-4"
            >
              Export Detail Audit Sheet (PDF)
            </Button>
          </div>
        </div>
      )}
 
    </div>
  );
}
 
function AnalyticsCard({ title, value, trend, className }: { title: string; value: string | number; trend?: React.ReactNode; className?: string }) {
  return (
    <Card className={`bg-card border-border p-4 flex flex-col justify-between h-20 text-left relative overflow-hidden shadow-sm ${className || ""}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
      <div className="flex justify-between items-baseline mt-1">
        <span className="text-lg font-bold font-mono text-foreground leading-none">{value}</span>
        {trend}
      </div>
    </Card>
  );
}
 
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background text-foreground flex items-center justify-center font-mono text-xs animate-pulse">Loading CodeForge AI Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
