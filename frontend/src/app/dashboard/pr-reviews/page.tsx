"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, GitBranch, Terminal, ShieldAlert, 
  CheckCircle2, Sparkles, Send, FileCode
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApiUrl } from "@/utils/api";

function PRReviewsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [loadingRepo, setLoadingRepo] = useState(true);

  useEffect(() => {
    const queryId = searchParams.get("repo_id");
    const localId = localStorage.getItem("selected_repo_id");
    
    if (!queryId && localId) {
      router.replace(`${pathname}?repo_id=${localId}`);
      return;
    }
    
    const id = queryId || localId;
    if (!id) {
      setActiveRepoId(null);
      setLoadingRepo(false);
      return;
    }
    setActiveRepoId(id);
    setLoadingRepo(false);
  }, [searchParams, pathname, router]);

  const [diffContent, setDiffContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);

  useEffect(() => {
    setReviewResult(null);
    setDiffContent("");
  }, [activeRepoId]);

  const handleRunReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diffContent.trim() || loading) return;

    setLoading(true);
    setReviewResult(null);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(getApiUrl("/api/pr/review"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          diff_content: diffContent,
          repository_id: activeRepoId || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReviewResult(data);
      } else {
        alert("Failed to review diff. Verify model configurations.");
      }
    } catch (e) {
      console.error(e);
      alert("Error reviewing PR diff.");
    } finally {
      setLoading(false);
    }
  };

  if (!loadingRepo && !activeRepoId) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen">
        <header className="h-16 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push("/dashboard")}
              className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 font-semibold text-lg">
              <GitBranch className="w-5 h-5 text-primary" />
              <span>PR Review Agent</span>
            </div>
          </div>
        </header>
        <EmptyState 
          title="No Repository Connected" 
          description="Import a repository to start performing automated PR diff code reviews." 
          action="Import Repository" 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push(`/dashboard`)}
            className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 font-semibold text-lg">
            <GitBranch className="w-5 h-5 text-primary" />
            <span>PR Review Agent</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-8 flex-1 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col gap-8">
        <div className="text-left">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-1">Automate Code Inspections</h2>
          <p className="text-xs text-[#6B7280]">Paste your git diff below to trigger a logical, security, and performance review by Gemini Pro.</p>
        </div>

        {/* Diff input form */}
        <Card className="bg-white border-[#E5E7EB] p-6 shadow-sm">
          <form onSubmit={handleRunReview} className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-primary" /> Git Diff Input
              </label>
              <button 
                type="button"
                onClick={() => setDiffContent(`diff --git a/src/services/auth.ts b/src/services/auth.ts
index b34fd91..a398fe2 100644
--- a/src/services/auth.ts
+++ b/src/services/auth.ts
@@ -10,6 +10,12 @@ export function generateToken(user: User) {
-  return jwt.sign({ id: user.id }, "SUPER_SECRET_KEY_12345", { expiresIn: '1h' });
+  const secret = process.env.JWT_SECRET;
+  if (!secret) {
+    throw new Error("JWT secret key missing from environmental configurations");
+  }
+  return jwt.sign({ id: user.id }, secret, { expiresIn: '1d' });
+}`)}
                className="text-[10px] text-primary hover:underline cursor-pointer font-semibold"
              >
                Load Example Diff
              </button>
            </div>
            
            <textarea
              placeholder="diff --git a/file.ts b/file.ts..."
              value={diffContent}
              onChange={(e) => setDiffContent(e.target.value)}
              rows={10}
              className="bg-slate-50 border border-[#E5E7EB] rounded-xl p-4 font-mono text-xs text-zinc-850 focus:outline-none focus:ring-1 focus:ring-primary h-64 resize-y leading-relaxed focus:bg-white"
              required
            />
            
            <Button 
              type="submit" 
              disabled={loading || !diffContent.trim()}
              className="bg-primary hover:bg-primary/95 text-white gap-2 h-11 self-end font-semibold cursor-pointer shadow-xs rounded-xl"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing Diff...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" /> Run Gemini Pro Review
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Results */}
        {loading && (
          <div className="flex flex-col gap-6 animate-pulse select-none font-sans text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Reviewing Diff...</h3>
            
            {/* Summary card skeleton */}
            <div className="bg-white border border-[#E5E7EB] p-6 rounded-xl flex flex-col md:flex-row justify-between gap-6 shadow-sm">
              <div className="flex-1 flex flex-col gap-3">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3.5 w-full bg-slate-150 rounded" />
                <div className="h-3.5 w-[85%] bg-slate-150 rounded" />
              </div>
              <div className="w-24 h-10 bg-slate-200 rounded-lg shrink-0" />
            </div>

            {/* Recommendations skeleton */}
            <div className="flex flex-col gap-4">
              <div className="h-3.5 w-40 bg-slate-200 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white border border-[#E5E7EB] p-5 flex flex-col gap-3 rounded-xl shadow-xs">
                    <div className="h-3.5 w-32 bg-slate-200 rounded" />
                    <div className="h-3 w-full bg-slate-150 rounded" />
                    <div className="h-3 w-[60%] bg-slate-150 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {reviewResult && (
          <div className="flex flex-col gap-6 animate-fade-in text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Review Report</h3>
            
            {/* Summary card */}
            <Card className="bg-white border border-[#E5E7EB] p-6 flex flex-col md:flex-row justify-between gap-6 shadow-sm">
              <div className="flex-1 flex flex-col gap-2">
                <h4 className="text-base font-bold text-zinc-900">Analysis Summary</h4>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">{reviewResult.summary}</p>
              </div>

              {/* Risk Badge */}
              <div className="flex flex-col items-start md:items-end justify-center gap-1.5 min-w-[150px] shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-[#6B7280] font-bold">Risk Level</span>
                <Badge className={`text-xs py-1 px-3 border font-semibold ${
                  reviewResult.risk_level === 'High' 
                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                    : reviewResult.risk_level === 'Medium'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {reviewResult.risk_level} Risk
                </Badge>
              </div>
            </Card>

            {/* Recommendations */}
            <div className="flex flex-col gap-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Code Optimization Cards</h4>
              {reviewResult.recommendations.length === 0 ? (
                <div className="p-6 border border-dashed border-[#E5E7EB] bg-white rounded-xl text-center text-xs text-[#6B7280] flex items-center justify-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Git diff meets all design and performance guidelines.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviewResult.recommendations.map((rec: any, idx: number) => (
                    <Card key={idx} className="bg-white border border-[#E5E7EB] p-5 flex flex-col gap-3 shadow-xs">
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-xs font-semibold font-mono text-zinc-900 truncate flex items-center gap-1.5">
                          <FileCode className="w-4 h-4 text-primary shrink-0" /> {rec.file}
                        </span>
                        <Badge variant="secondary" className="bg-slate-100 border-none text-[10px] text-[#6B7280] px-2 py-0.5 rounded-md">
                          {rec.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-sans">{rec.description}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PRReviewsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <PRReviewsPageContent />
    </Suspense>
  );
}
