"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  User,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  Users,
  ShieldAlert,
  CreditCard,
  Puzzle,
} from "lucide-react";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4" />
    </svg>
  );
}

type SettingsTab = "account" | "workspace" | "integrations" | "security" | "billing";

const integrationItems = [
  {
    name: "GitLab Integration",
    description: "Repository sync for GitLab projects.",
  },
  {
    name: "Bitbucket Sync",
    description: "Repository import support for Bitbucket workspaces.",
  },
  {
    name: "Slack Notifications",
    description: "Alerts for scan completion and review summaries.",
  },
  {
    name: "Discord Alerts",
    description: "Push engineering notifications to shared channels.",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [workspaceName, setWorkspaceName] = useState("CodeForge Workspace");

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/");
      } else {
        setUser(data.session.user);
      }

      setLoading(false);
    };

    fetchSession();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background font-mono text-xs text-zinc-400 animate-pulse">
        Loading Account Settings...
      </div>
    );
  }

  const username = user?.user_metadata?.user_name || "developer";
  const displayName = user?.user_metadata?.full_name || "CodeForge User";
  const avatarUrl = user?.user_metadata?.avatar_url || "https://github.com/Lingu17.png";
  const email = user?.email || "hello@codeforgeai.dev";

  return (
    <div className="flex flex-col h-full bg-background text-foreground min-h-screen font-sans p-4 md:p-8 gap-8">
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
            <Settings className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Console Settings</h1>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 items-start max-w-5xl w-full mx-auto">
        <nav className="w-full lg:w-64 flex flex-row lg:flex-col gap-1 border-b lg:border-b-0 lg:border-r border-border pb-4 lg:pb-0 lg:pr-6 shrink-0 overflow-x-auto text-left">
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "account" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <User className="w-4 h-4" /> Account Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "workspace" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <Users className="w-4 h-4" /> Workspace Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("integrations")}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "integrations" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <Puzzle className="w-4 h-4" /> Integrations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "security" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <KeyRound className="w-4 h-4" /> Security & Access
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("billing")}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "billing" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Billing & Quotas
          </button>
        </nav>

        <div className="flex-1 w-full flex flex-col gap-6 text-left">
          {activeTab === "account" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <User className="w-4 h-4 text-primary" /> Account Settings
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">
                  Manage your connected developer identity and email settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex items-center gap-5 border-b border-border pb-6">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full border border-border shadow-sm" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-zinc-200 flex items-center justify-center border border-border text-zinc-650 font-mono text-lg font-bold">
                      {username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-zinc-900">@{username}</span>
                    <span className="text-xs text-zinc-500">{email}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">Display Name</span>
                    <input
                      type="text"
                      defaultValue={displayName}
                      className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">Email Address</span>
                    <input
                      type="email"
                      defaultValue={email}
                      className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">GitHub Username</span>
                    <input
                      type="text"
                      defaultValue={username}
                      className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">Password</span>
                    <div className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-700 flex items-center justify-between">
                      <span>Managed through GitHub OAuth</span>
                      <Badge className="bg-zinc-100 text-zinc-600 border border-border text-[9px] font-mono font-bold">
                        External Auth
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">GitHub Connection Status</span>
                    <div className="flex items-center justify-between bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-800">
                      <span className="flex items-center gap-1.5 font-bold text-zinc-700">
                        <GithubIcon className="w-4 h-4 text-zinc-550" /> Connected as @{username}
                      </span>
                      <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-mono font-bold">
                        Active Link
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 flex justify-between items-center text-[9px] text-zinc-400 font-mono">
                  <span>Registered: June 7, 2026</span>
                  <span>Session: Active</span>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <Button className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs h-9 cursor-pointer rounded-lg px-4 shadow-sm">
                    Save Profile Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "workspace" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <Settings className="w-4 h-4 text-primary" /> Workspace Configuration
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">
                  Keep your workspace identity simple while core collaboration features are still rolling out.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col gap-1.5 text-xs">
                  <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">Workspace Name</span>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                  />
                </div>

                <div className="rounded-xl border border-border bg-zinc-50 p-4 text-xs text-zinc-600 leading-relaxed">
                  Team invitations, repository caps, and advanced workspace permissions will appear here once those workflows are fully supported.
                </div>

                <div className="flex justify-end">
                  <Button className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs h-9 cursor-pointer rounded-lg px-4 shadow-sm">
                    Save Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "integrations" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <Puzzle className="w-4 h-4 text-primary" /> Connected Integrations
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">
                  Planned integrations are visible here, but disabled until each flow is fully production-ready.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                  {integrationItems.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-4 bg-zinc-50 border border-border rounded-xl shadow-sm">
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="text-zinc-800 font-bold">{item.name}</span>
                        <span className="text-[10px] text-zinc-500">{item.description}</span>
                      </div>
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-mono font-bold">
                        Coming Soon
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "security" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <KeyRound className="w-4 h-4 text-primary" /> Security & Access Control
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">
                  Review your active session and the authentication model behind your workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex flex-col gap-3">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider">Active browser logins</span>
                  <div className="flex justify-between items-center bg-zinc-50 border border-border rounded-xl p-3.5 text-xs shadow-sm">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="text-zinc-800 font-bold">Windows PC - Bengaluru, IN</span>
                        <span className="text-[9px] text-zinc-400">Chrome Browser - Active session</span>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-mono font-bold">
                      Current
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4 text-xs text-zinc-550 font-sans">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider block">Password</span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed max-w-md">
                    Your credentials are managed securely through GitHub Single Sign-On. Direct password reset inside CodeForge AI is disabled for connected OAuth identities.
                  </p>
                </div>

                <div className="flex flex-col gap-3 border-t border-rose-100 pt-4 mt-2">
                  <span className="font-bold text-rose-600 text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Danger Zone
                  </span>
                  <div className="flex justify-between items-center p-4 bg-rose-50/50 border border-rose-100 rounded-xl text-xs shadow-sm">
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-zinc-800 font-bold">Permanently Delete Account</span>
                      <span className="text-[10px] text-zinc-500">Wipe all cloned indexing files, metadata, and stored workspace artifacts.</span>
                    </div>
                    <Button className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-9 cursor-pointer rounded-lg px-4 shadow-sm">
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "billing" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <CreditCard className="w-4 h-4 text-primary" /> Billing & Active Quotas
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">
                  Review your current plan, workspace quotas, and upgrade path.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex justify-between items-center p-4 bg-zinc-50 border border-border rounded-xl shadow-sm">
                  <div className="flex flex-col text-left">
                    <span className="text-zinc-500 font-bold text-[9px] uppercase tracking-wider">Current Tier</span>
                    <span className="text-sm font-extrabold text-zinc-900 mt-1">Free Tier</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">Basic scanning and repository intelligence enabled.</span>
                  </div>
                  <Button onClick={() => router.push("/dashboard/billing")} className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs h-8 px-4 cursor-pointer shadow-sm rounded-lg">
                    Upgrade Console Plan
                  </Button>
                </div>

                <div className="flex flex-col gap-4">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider">Workspace Usage Quotas</span>

                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-zinc-650">Active Mapped Repositories</span>
                      <span className="text-zinc-900 font-mono">0 / 5</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[0%]" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-zinc-650">Monthly AI PR Reviews</span>
                      <span className="text-zinc-900 font-mono">0 / 50</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[0%]" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-zinc-650">Vector Codebase Index Storage</span>
                      <span className="text-zinc-900 font-mono">0 MB / 100 MB</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[0%]" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
