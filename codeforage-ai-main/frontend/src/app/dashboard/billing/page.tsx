"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import { 
  CreditCard, Check, ArrowLeft,
  Zap, Building2, User
} from "lucide-react";
import { getApiUrl } from "@/utils/api";

export default function BillingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [reposCount, setReposCount] = useState(0);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      
      if (!data.session) {
        router.push("/");
      } else {
        setUser(data.session.user);
        // Fetch active repos count
        const token = data.session?.access_token;
        const headers: any = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        try {
          const res = await fetch(getApiUrl("/api/repos"), { headers });
          if (res.ok) {
            const data = await res.json();
            setReposCount(data.length || 0);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    };
    fetchSession();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background font-mono text-xs text-zinc-400 animate-pulse">
        Loading Billing details...
      </div>
    );
  }

  // Calculate quotas
  const maxRepos = 5;
  const activeReviews = reposCount * 4; // Mocked dynamic usage
  const maxReviews = 50;
  const storageUsed = reposCount > 0 ? (reposCount * 1.8).toFixed(1) : "0.0";
  const maxStorage = 100;

  return (
    <div className="flex flex-col h-full bg-background text-foreground min-h-screen font-sans p-8 gap-8">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border pb-6 shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/dashboard")}
            className="text-zinc-500 hover:text-zinc-900 cursor-pointer rounded-lg border border-border bg-white shadow-sm"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Button>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 font-sans">Billing & Quota</h1>
          </div>
        </div>
      </header>

      {/* Current Plan Overview Card */}
      <div className="max-w-4xl w-full mx-auto flex flex-col gap-6">
        <Card className="bg-white border-border shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <CardHeader className="pb-4 text-left">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-sm font-bold text-zinc-900">Current Active Plan</CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">Resource quotas for your workspace tier.</CardDescription>
              </div>
              <Badge className="bg-zinc-100 text-zinc-650 border-border text-[9px] font-mono font-bold">
                FREE PLAN
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="flex flex-col gap-6 border-t border-border pt-6 text-left">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Repos usage */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-500">Repositories</span>
                  <span className="text-zinc-900 font-mono">{reposCount} / {maxRepos} Active</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-500 rounded-full" 
                    style={{ width: `${(reposCount / maxRepos) * 100}%` }}
                  />
                </div>
              </div>

              {/* AI Reviews usage */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-500">AI PR Reviews</span>
                  <span className="text-zinc-900 font-mono">{activeReviews} / {maxReviews} Completed</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-500 rounded-full" 
                    style={{ width: `${(activeReviews / maxReviews) * 100}%` }}
                  />
                </div>
              </div>

              {/* Storage usage */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-500">Semantic Vector Storage</span>
                  <span className="text-zinc-900 font-mono">{storageUsed} MB / {maxStorage} MB</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500 rounded-full" 
                    style={{ width: `${(parseFloat(storageUsed) / maxStorage) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border my-1" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-semibold">
              <span className="text-zinc-500 font-sans">Need higher vector limits and private repositories scan?</span>
              <Button 
                onClick={() => setShowWaitlistModal(true)}
                className="bg-primary hover:bg-primary/95 text-white font-bold h-9 px-4 rounded-lg cursor-pointer shadow-sm"
              >
                Upgrade to Pro Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Pricing Matrix */}
        <div className="flex flex-col gap-4 text-left">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Available Packages</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plan 1: Hobby */}
            <Card className="bg-white border-border shadow-sm flex flex-col justify-between p-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-450 font-bold">Hobby Developer</span>
                  <User className="w-4 h-4 text-zinc-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold text-zinc-900 font-mono">$0</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5 font-semibold">Free forever / community access</span>
                </div>
                <div className="h-px bg-border" />
                <ul className="flex flex-col gap-2.5 text-[10px] text-zinc-550">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Up to 5 Active Repositories
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> 50 AI PR Reviews / mo
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> 100 MB Vector Database Storage
                  </li>
                </ul>
              </div>
              <Button disabled className="w-full bg-zinc-100 text-zinc-400 text-xs font-bold mt-6 h-9 cursor-not-allowed border border-border rounded-lg">
                Active Tier
              </Button>
            </Card>

            {/* Plan 2: Pro */}
            <Card className="bg-white border-2 border-primary shadow-md flex flex-col justify-between p-6 relative">
              <div className="absolute top-4 right-4 bg-primary/5 text-primary border border-primary/15 rounded-full px-2.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider animate-pulse">
                Recommended
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Pro Developer</span>
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold text-zinc-900 font-mono">$19 <span className="text-xs text-zinc-550">/ mo</span></span>
                  <span className="text-[9px] text-zinc-550 mt-0.5 font-semibold">For active software builders</span>
                </div>
                <div className="h-px bg-border" />
                <ul className="flex flex-col gap-2.5 text-[10px] text-zinc-650">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Unlimited Public & Private Repos
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Unlimited AI Code Reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Deep Architecture Indexing
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Priority Support (Slack & Email)
                  </li>
                </ul>
              </div>
              <Button 
                onClick={() => setShowWaitlistModal(true)}
                className="w-full bg-primary hover:bg-primary/95 text-white text-xs font-bold mt-6 h-9 cursor-pointer shadow-sm rounded-lg"
              >
                Upgrade to Pro
              </Button>
            </Card>

            {/* Plan 3: Enterprise */}
            <Card className="bg-white border-border shadow-sm flex flex-col justify-between p-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-450 font-bold">Enterprise Team</span>
                  <Building2 className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-extrabold text-zinc-900 font-mono">$99 <span className="text-xs text-zinc-550">/ mo</span></span>
                  <span className="text-[9px] text-zinc-550 mt-0.5 font-semibold">For companies and engineering teams</span>
                </div>
                <div className="h-px bg-border" />
                <ul className="flex flex-col gap-2.5 text-[10px] text-zinc-550">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Multi-Seat Workspace Members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> Self-Hosted DB Connection
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> SSO / SAML Authentication
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" /> 1-on-1 Engineering SLA Support
                  </li>
                </ul>
              </div>
              <Button 
                onClick={() => setShowWaitlistModal(true)}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold mt-6 h-9 cursor-pointer shadow-sm rounded-lg"
              >
                Contact Sales
              </Button>
            </Card>
          </div>
        </div>
      </div>

      {/* Coming Soon Waitlist modal */}
      <ComingSoonModal isOpen={showWaitlistModal} onClose={() => setShowWaitlistModal(false)} />
    </div>
  );
}
