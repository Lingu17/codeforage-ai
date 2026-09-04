"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, ShieldAlert, AlertCircle, 
  Terminal, ShieldCheck, Zap, Activity, Bug
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApiUrl } from "@/utils/api";

function SecurityPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [securityData, setSecurityData] = useState<any>(null);
  const [debtData, setDebtData] = useState<any>(null);

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
      setSecurityData(null);
      setDebtData(null);
      setError(false);
      setLoading(true);
      fetchReports();
    }
  }, [activeRepoId]);

  const fetchReports = async () => {
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
      const [secRes, debtRes] = await Promise.all([
        fetch(getApiUrl(`/api/repos/${activeRepoId}/security`), { headers }),
        fetch(getApiUrl(`/api/repos/${activeRepoId}/debt`), { headers })
      ]);

      if (secRes.ok && debtRes.ok) {
        setSecurityData(await secRes.json());
        setDebtData(await debtRes.json());
      } else {
        setError(true);
      }
    } catch (e) {
      console.error("Error fetching reports:", e);
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
            <span className="text-xs font-mono text-[#6B7280]">Running security analysis...</span>
          </div>
          <div className="h-8 w-24 bg-slate-200 rounded" />
        </header>

        {/* Content Skeleton */}
        <div className="p-8 flex-1 flex flex-col md:flex-row gap-8">
          <div className="flex-1 flex flex-col gap-6">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            
            {/* Mock security issues list skeleton */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#E5E7EB] p-5 flex flex-col gap-3 rounded-xl shadow-xs">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-64 bg-slate-200 rounded" />
                  <div className="h-5 w-16 bg-slate-150 rounded" />
                </div>
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3.5 w-32 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
          
          <div className="w-full md:w-80 flex flex-col gap-6 shrink-0">
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="border border-[#E5E7EB] rounded-2xl bg-white p-5 h-44 flex flex-col justify-between shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="h-3 w-16 bg-slate-200 rounded" />
                <div className="h-5 w-36 bg-slate-150 rounded mt-1" />
              </div>
              <div className="h-8 w-full bg-slate-200 rounded-lg mt-4" />
            </div>
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
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Security & Debt Audit</span>
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#F8FAFC]">
          <ShieldAlert className="w-12 h-12 text-rose-500 mb-3 opacity-60" />
          <h4 className="text-sm font-semibold text-zinc-900">Security scan not available.</h4>
          <p className="text-xs text-[#6B7280] max-w-xs mt-1">
            Unable to load analysis. Please retry.
          </p>
          <Button onClick={fetchReports} variant="outline" size="sm" className="mt-4 border-[#E5E7EB] text-xs gap-1.5 cursor-pointer font-semibold bg-white">
            Retry Scan Audit
          </Button>
        </div>
      </div>
    );
  }

  const hasSecurityIssues = securityData?.vulnerabilities?.length > 0;
  const hasDebtIssues = debtData?.issues?.length > 0;

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
              <ShieldAlert className="w-5 h-5 text-primary" />
              <span>Security & Debt Audit</span>
            </div>
          </div>
        </header>
        <EmptyState 
          title="No Repository Connected" 
          description="Import a repository to start performing security vulnerability audits." 
          action="Import Repository" 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white z-10 shrink-0 animate-in fade-in duration-200">
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
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <span>Security & Debt Audit</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-8 flex-1 overflow-y-auto max-w-7xl mx-auto w-full flex flex-col gap-8 animate-in fade-in duration-350">
        
        {/* Score Summary Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security Score */}
          <Card className="bg-white border-[#E5E7EB] p-6 flex items-center justify-between shadow-sm">
            <div className="flex flex-col gap-1.5 text-left">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Security Health</span>
              <h3 className="text-xl font-extrabold text-zinc-900">Vulnerability Guard</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Aggregated code safety metrics scanning for hardcoded secrets, database injection risks, and auth guards.
              </p>
            </div>
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="w-20 h-20 rounded-full border-4 border-emerald-100 bg-emerald-50 flex items-center justify-center">
                <span className="text-2xl font-bold font-mono text-emerald-600">{securityData?.security_score ?? 100}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-mono">Score / 100</span>
            </div>
          </Card>

          {/* Technical Debt Score */}
          <Card className="bg-white border-[#E5E7EB] p-6 flex items-center justify-between shadow-sm">
            <div className="flex flex-col gap-1.5 text-left">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Maintainability Index</span>
              <h3 className="text-xl font-extrabold text-zinc-900">Technical Debt</h3>
              <div className="flex gap-2 mt-1.5">
                <Badge variant="secondary" className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] rounded-md font-semibold">
                  Critical: {debtData?.critical_count ?? 0}
                </Badge>
                <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] rounded-md font-semibold">
                  Major: {debtData?.major_count ?? 0}
                </Badge>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none text-[10px] rounded-md font-semibold">
                  Minor: {debtData?.minor_count ?? 0}
                </Badge>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="w-20 h-20 rounded-full border-4 border-indigo-100 bg-indigo-50 flex items-center justify-center">
                <span className="text-2xl font-bold font-mono text-primary">{debtData?.debt_score ?? 100}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-mono">Score / 100</span>
            </div>
          </Card>
        </div>

        {/* Detailed Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
          
          {/* Security Log */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Bug className="w-4 h-4 text-rose-500" /> Security Vulnerabilities
            </h3>
            
            {!hasSecurityIssues ? (
              <div className="p-8 border border-dashed border-[#E5E7EB] bg-white rounded-xl text-center flex flex-col items-center gap-2 shadow-sm">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                <h4 className="text-xs font-bold text-zinc-900">No vulnerabilities found</h4>
                <p className="text-[10px] text-[#6B7280] max-w-xs">
                  We didn&apos;t detect any immediate hardcoded tokens, API keys, or unescaped query configurations.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {securityData.vulnerabilities.map((vuln: any, idx: number) => (
                  <div key={idx} className="p-4 bg-white border border-[#E5E7EB] rounded-xl flex flex-col gap-2 shadow-xs">
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-xs font-semibold font-mono text-zinc-900 truncate max-w-[70%]">{vuln.file}</span>
                      <Badge className={`text-[10px] font-semibold border ${
                        vuln.severity === 'High' 
                          ? 'bg-rose-55 text-rose-700 border-rose-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {vuln.severity} Risk
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">{vuln.description}</p>
                    {vuln.line && (
                      <span className="text-[10px] text-slate-400 font-mono">Line Number: L{vuln.line}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Technical Debt Log */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-primary" /> Refactoring & Code Debt
            </h3>
            
            {!hasDebtIssues ? (
              <div className="p-8 border border-dashed border-[#E5E7EB] bg-white rounded-xl text-center flex flex-col items-center gap-2 shadow-sm">
                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                <h4 className="text-xs font-bold text-zinc-900">Codebase is highly maintainable</h4>
                <p className="text-[10px] text-[#6B7280] max-w-xs">
                  Files sizes are within standard parameters and import layouts are clean.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {debtData.issues.map((issue: any, idx: number) => (
                  <div key={idx} className="p-4 bg-white border border-[#E5E7EB] rounded-xl flex flex-col gap-2 shadow-xs">
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-xs font-semibold font-mono text-zinc-900 truncate max-w-[70%]">{issue.file}</span>
                      <Badge className="bg-slate-100 text-slate-700 border-none text-[10px] font-semibold rounded-md">
                        {issue.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-650 leading-relaxed font-sans">{issue.description}</p>
                    <div className="flex justify-between items-center mt-1.5 border-t border-slate-50 pt-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Severity</span>
                      <span className={`text-[10px] font-extrabold uppercase ${
                        issue.severity === 'critical' ? 'text-rose-600' : issue.severity === 'major' ? 'text-amber-600' : 'text-slate-500'
                      }`}>{issue.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <SecurityPageContent />
    </Suspense>
  );
}
