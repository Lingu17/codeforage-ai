"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, Activity, ShieldAlert, 
  CheckCircle2, Flame, Award, Heart, BookOpen
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";

function HealthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);

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
      setLoading(false);
      return;
    }
    setActiveRepoId(id);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (activeRepoId) {
      setSummaryData(null);
      setError(false);
      setLoading(true);
      fetchSummary();
    }
  }, [activeRepoId]);

  const fetchSummary = async () => {
    if (!activeRepoId) return;
    setLoading(true);
    setError(false);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`http://127.0.0.1:8000/api/repos/${activeRepoId}/summary`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error("Error fetching repository summary:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen animate-pulse select-none font-sans text-left">
        {/* Header Skeleton */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            <span className="text-xs font-mono text-[#6B7280]">Loading health report...</span>
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded" />
        </header>

        {/* Content Skeleton */}
        <div className="p-8 flex-1 max-w-4xl mx-auto w-full flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-64 bg-slate-150 rounded" />
          </div>

          {/* Large gauge skeleton */}
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl flex flex-col md:flex-row items-center gap-8 h-48 justify-between shadow-sm">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full border-4 border-slate-100 bg-slate-50" />
              <div className="flex flex-col gap-2.5">
                <div className="h-5 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-48 bg-slate-150 rounded" />
              </div>
            </div>
            <div className="h-8 w-32 bg-slate-200 rounded-lg" />
          </div>

          {/* Category sliders skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white border border-[#E5E7EB] p-5 rounded-xl flex flex-col gap-3 h-28 justify-between shadow-xs">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                  <div className="h-3.5 w-12 bg-slate-150 rounded" />
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full" />
                <div className="h-3 w-40 bg-slate-150 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white">
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
              <Activity className="w-5 h-5 text-primary" />
              <span>Engineering Health Score</span>
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#F8FAFC]">
          <ShieldAlert className="w-12 h-12 text-rose-500 mb-3 opacity-60" />
          <h4 className="text-sm font-semibold text-zinc-900">Unable to load analysis. Please retry.</h4>
          <p className="text-xs text-[#6B7280] max-w-xs mt-1">
            Ensure the repository has completed scanning successfully before fetching health report details.
          </p>
          <Button onClick={fetchSummary} variant="outline" size="sm" className="mt-4 border-[#E5E7EB] text-xs gap-1.5 cursor-pointer font-semibold bg-white">
            Retry Loading Health
          </Button>
        </div>
      </div>
    );
  }

  const breakdown = summaryData?.health_breakdown || {};
  const score = breakdown.overall_score ?? 80;

  // Define score rating color & text
  let letterGrade = "B";
  let ratingColor = "text-indigo-650";
  let ratingDesc = "The codebase is healthy, maintainable, and shows proper structural partitioning.";
  
  if (score >= 90) {
    letterGrade = "A";
    ratingColor = "text-emerald-650";
    ratingDesc = "Excellent quality! Highly structured, minor debt, and secure configuration profiles.";
  } else if (score >= 80) {
    letterGrade = "B";
    ratingColor = "text-indigo-650";
    ratingDesc = "Good quality. Maintainable structure with minimal architectural anomalies.";
  } else if (score >= 70) {
    letterGrade = "C";
    ratingColor = "text-amber-600";
    ratingDesc = "Codebase has moderate chunks of refactoring debt. Circular references are detected.";
  } else if (score >= 60) {
    letterGrade = "D";
    ratingColor = "text-amber-700";
    ratingDesc = "Poor codebase structure. Significant refactoring is recommended.";
  } else {
    letterGrade = "F";
    ratingColor = "text-rose-600";
    ratingDesc = "Crucial architectural anomalies and security risks found. Comprehensive overhaul required.";
  }

  if (!loading && !activeRepoId) {
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
              <Activity className="w-5 h-5 text-primary" />
              <span>Engineering Health Score</span>
            </div>
          </div>
        </header>
        <EmptyState 
          title="No Repository Connected" 
          description="Import a repository to start checking your engineering health score." 
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
          <div className="flex items-center gap-2 font-semibold text-lg text-left">
            <Activity className="w-5 h-5 text-primary" />
            <span>Engineering Health Score</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-8 flex-1 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col gap-8 animate-in fade-in duration-300">
        
        {/* Core Rating Card */}
        <Card className="bg-white border-[#E5E7EB] p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-[64px] pointer-events-none" />
          <div className="flex-1 flex flex-col gap-3 text-left">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Overall Grade</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900">
              Codebase Health Grade: <span className={ratingColor}>{letterGrade}</span> ({score}/100)
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-lg font-sans">
              {ratingDesc}
            </p>
          </div>

          <div className="flex flex-col items-center shrink-0">
            <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-8 border-slate-100 bg-slate-50 shadow-inner">
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle 
                  cx="64" 
                  cy="64" 
                  r="52" 
                  fill="transparent" 
                  stroke="#4F46E5" 
                  strokeWidth="8" 
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - score / 100)}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold font-mono text-primary">{score}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold font-mono">Score</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Categories breakdown grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <HealthCategoryCard title="Architecture (25%)" score={breakdown.architecture_score ?? 80} color="bg-indigo-500" />
          <HealthCategoryCard title="Security (25%)" score={breakdown.security_score ?? 80} color="bg-rose-500" />
          <HealthCategoryCard title="Maintainability (20%)" score={breakdown.maintainability_score ?? 80} color="bg-emerald-500" />
          <HealthCategoryCard title="Testing (15%)" score={breakdown.testing_score ?? 80} color="bg-purple-500" />
          <HealthCategoryCard title="Performance (15%)" score={breakdown.performance_score ?? 80} color="bg-amber-500" />
        </div>

        {/* Explanatory Summaries */}
        <div className="flex flex-col gap-4 mt-4 text-left">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Analysis Breakdown & Recommendations</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailItem title="Architecture Layout" description={breakdown.breakdown?.architecture || "Separation layers meet standards. Verify import structures."} />
            <DetailItem title="Security Vulnerabilities" description={breakdown.breakdown?.security || "API keys, credentials, and connection strings are correctly isolated."} />
            <DetailItem title="Code Maintainability" description={breakdown.breakdown?.maintainability || "File line counts and class/function sizing look healthy."} />
            <DetailItem title="Testing & Verification" description={breakdown.breakdown?.testing || "Verify test suite coverage and assertions regularly."} />
            <DetailItem title="Runtime Performance" description={breakdown.breakdown?.performance || "Good layout structure. Optimization of critical render pathways is suggested."} />
          </div>
        </div>

      </div>
    </div>
  );
}

function HealthCategoryCard({ title, score, color }: { title: string, score: number, color: string }) {
  return (
    <Card className="bg-white border border-[#E5E7EB] p-6 flex flex-col justify-between h-32 shadow-xs text-left">
      <span className="text-xs font-semibold text-slate-500">{title}</span>
      <div className="flex justify-between items-baseline mt-1">
        <span className="text-2xl font-bold font-mono text-zinc-900">{score}</span>
        <span className="text-[10px] text-slate-400 font-mono">/100</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
        <div 
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </Card>
  );
}

function DetailItem({ title, description }: { title: string, description: string }) {
  return (
    <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl flex flex-col gap-1.5 leading-relaxed shadow-xs text-left">
      <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
        <Heart className="w-4 h-4 text-primary shrink-0" />
        {title}
      </h4>
      <p className="text-xs text-slate-650 leading-relaxed font-sans">{description}</p>
    </div>
  );
}

export default function HealthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <HealthPageContent />
    </Suspense>
  );
}
