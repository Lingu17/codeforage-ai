"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, XCircle, RefreshCw, Server } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getApiUrl } from "@/utils/api";
import { parseStages, STAGE_DEFS, stageView, type ScanStages } from "@/utils/scanStages";

interface ScanStatusTrackerProps {
  repoId: string;
  onComplete: () => void;
}

export function ScanStatusTracker({ repoId, onComplete }: ScanStatusTrackerProps) {
  const [status, setStatus] = useState<string>("queued");
  const [progress, setProgress] = useState<number>(5);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [stages, setStages] = useState<ScanStages>(parseStages(null));
  const supabase = createClient();
  const lastJobStateRef = useRef<{ id?: string; status: string; progress: number; started_at?: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(getApiUrl(`/api/repos/${repoId}/status`), { headers });
      if (res.ok) {
        const data = await res.json();
        const newId = data.id;
        const newStatus = data.status || "queued";
        const newProgress = data.progress ?? 100;
        const newStartedAt = data.started_at;

        // Guard against regressions
        if (lastJobStateRef.current) {
          const current = lastJobStateRef.current;
          if (current.id && newId && current.id !== newId) {
            const currentStart = new Date(current.started_at || 0).getTime();
            const newStart = new Date(newStartedAt || 0).getTime();
            if (newStart < currentStart) {
              // Ignore stale older job status update
              return;
            }
          } else if (current.id === newId || (!current.id && !newId)) {
            // Same job
            if (current.status === "completed" && newStatus !== "completed") {
              return;
            }
            if (newProgress < current.progress) {
              return;
            }
          }
        }

        // Update ref and local state
        lastJobStateRef.current = { id: newId, status: newStatus, progress: newProgress, started_at: newStartedAt };
        setStatus(newStatus);
        setProgress(newProgress);
        setErrorMessage(data.error_message || null);
        setStages(parseStages(data));

        if (newStatus === "completed") {
          onComplete();
        }
      }
    } catch (e) {
      console.error("Error polling scan status:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [repoId]);

  const handleRetry = async () => {
    setRetrying(true);
    setErrorMessage(null);
    try {
      // Find the repository details first
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const providerToken = sessionData.session?.provider_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (providerToken) {
        headers["X-Github-Token"] = providerToken;
      }
      
      const reposRes = await fetch(getApiUrl("/api/repos"), { headers });
      if (reposRes.ok) {
        const repos = await reposRes.json();
        const repo = repos.find((r: any) => r.id === repoId);
        if (repo) {
          // Re-trigger analysis
          const analyzeHeaders = { ...headers, "Content-Type": "application/json" };
          const response = await fetch(getApiUrl("/api/repos/analyze"), {
            method: "POST",
            headers: analyzeHeaders,
            body: JSON.stringify({
              github_id: Number(repo.id),
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              language: repo.language,
              owner_username: repo.full_name.split("/")[0],
              repo_url: repo.repo_url
            })
          });
          if (response.ok) {
            setStatus("queued");
            setProgress(5);
            fetchStatus();
          }
        }
      }
    } catch (e) {
      console.error("Failed to retry analysis:", e);
    } finally {
      setRetrying(false);
    }
  };

  if (status === "failed") {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC] min-h-[75vh] font-sans">
        <Card className="w-full max-w-xl bg-white border-2 border-rose-200 p-8 rounded-2xl shadow-sm text-left flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-250 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-mono uppercase font-bold w-fit">
                Pipeline Failure
              </Badge>
              <h3 className="text-base font-bold text-zinc-900 mt-2">Scan Analysis Failed</h3>
              <p className="text-xs text-rose-650 leading-relaxed mt-1 font-sans">
                The code analysis pipeline encountered an error during parsing:
              </p>
              <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-xl font-mono text-[10px] text-rose-700 mt-3 whitespace-pre-wrap leading-relaxed break-all">
                {errorMessage || "AST parsing timeout or Git authentication token invalid."}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-rose-100 pt-4 mt-2 shrink-0">
            <Button 
              onClick={handleRetry}
              disabled={retrying}
              className="bg-rose-600 hover:bg-rose-750 text-white text-xs font-semibold cursor-pointer h-9 px-4 rounded-lg shadow-sm flex items-center gap-1.5"
            >
              {retrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Retry Ingest Analysis
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  let statusTitle = "Analyzing Repository Structure";
  let statusDesc = "Please wait. CodeForge AI background systems are scanning files, calculating health, and extracting modules.";
  
  if (status === "queued") {
    statusTitle = "Repository Queued for Analysis";
    statusDesc = "Waiting for an execution worker slot to begin pipeline ingestion.";
  } else if (status === "cloning") {
    statusTitle = "Cloning Repository Codebase";
    statusDesc = "Pulling code nodes and files from GitHub via authenticated OAuth session.";
  } else if (status === "scanning") {
    statusTitle = "Indexing Code Dependencies";
    statusDesc = "Analyzing language imports and mapping package boundaries.";
  } else if (status === "embedding") {
    statusTitle = "Generating Code Embeddings";
    statusDesc = "Splitting source modules into semantic chunks and indexing vector spaces.";
  } else if (status === "analyzing") {
    statusTitle = "Building Repository Intelligence";
    statusDesc = "Running architecture, security and health analysis in parallel.";
  } else if (status === "completed") {
    statusTitle = "Scan Complete";
    statusDesc = "All repository intelligence stages have finished.";
  }

  const runningEmbed = stages.embed?.status === "running";
  const runningAny = Object.values(stages).some((s) => s?.status === "running");
  const failedAny = Object.values(stages).some((s) => s?.status === "failed");

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC] min-h-[75vh] font-sans">
      <Card className="w-full max-w-xl bg-white border border-[#E5E7EB] p-8 rounded-2xl shadow-sm text-left flex flex-col gap-6 relative overflow-hidden">
        {/* Soft Background Bloom */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-[96px] pointer-events-none" />

        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1 flex-1 pr-4">
            <Badge className="bg-primary/5 text-primary border border-primary/10 animate-pulse text-[9px] font-mono uppercase font-bold w-fit">
              {status.toUpperCase()} ({progress}%)
            </Badge>
            <h3 className="text-base font-bold text-zinc-900 mt-2">{statusTitle}</h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{statusDesc}</p>
          </div>
          
          <div className="relative w-12 h-12 flex items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-primary shrink-0 animate-pulse">
            <Server className="w-5 h-5" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-500 rounded-full" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps Checklist */}
        <div className="border border-[#E5E7EB] rounded-xl bg-[#F8FAFC] p-5 flex flex-col gap-4 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-2 font-semibold">
            <span className="text-[10px] uppercase font-bold text-slate-400">Ingestion Stage</span>
            <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
          </div>

          {STAGE_DEFS.map((def) => {
            const view = stageView(stages[def.key]);
            return (
              <div key={def.key} className="flex justify-between items-center gap-3">
                <span className="text-slate-600">{def.label}</span>
                {view.tone === "done" && (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Complete
                  </span>
                )}
                {view.tone === "err" && (
                  <span className="text-rose-600 font-bold flex items-center gap-1.5" title={view.error}>
                    <XCircle className="w-3.5 h-3.5 text-rose-500" /> Failed
                  </span>
                )}
                {view.tone === "run" && (
                  <span className="text-primary font-bold animate-pulse flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {def.key === "embed" && runningEmbed ? `Embedding ${stages.embed?.progress}%` : "Running"}
                  </span>
                )}
                {view.tone === "idle" && (
                  <span className="text-slate-400 font-bold">○ Pending</span>
                )}
              </div>
            );
          })}

          {/* Scan Complete */}
          <div className="flex justify-between items-center border-t border-[#E5E7EB] pt-2">
            <span className="text-slate-800 font-bold">Scan Complete</span>
            {status === "completed" ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Complete</span>
            ) : failedAny && !runningAny ? (
              <span className="text-rose-600 font-bold flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-rose-500" /> Failed</span>
            ) : (
              <span className="text-slate-400 font-bold">○ Waiting</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
