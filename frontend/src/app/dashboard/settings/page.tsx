"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, User, KeyRound, ShieldCheck, 
  ArrowLeft, Users, ShieldAlert, Key, Plus, Trash2,
  CreditCard, Puzzle, Sparkles
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

type SettingsTab = "account" | "workspace" | "integrations" | "security" | "billing" | "developer_api";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  // Mock workspace states
  const [workspaceName, setWorkspaceName] = useState("My Workspace");
  const [inviteEmail, setInviteEmail] = useState("");
  const [teamMembers, setTeamMembers] = useState([
    { name: "Lingraj Malipatil", email: "lingrajmalipatil1@gmail.com", role: "Owner" }
  ]);

  // Security & keys states
  const [apiKeys, setApiKeys] = useState<string[]>(["cf_live_8a3f9e2b1c4d7f5a6b0c"]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    const fetchSession = async () => {
      const isDemo = typeof window !== "undefined" && localStorage.getItem("demo_mode") === "true";
      const { data } = await supabase.auth.getSession();
      
      if (isDemo) {
        setUser({
          id: "demo-user-id",
          email: "guest.developer@codeforge.ai",
          user_metadata: {
            user_name: "guest_developer",
            avatar_url: "https://github.com/github.png"
          }
        });
      } else if (!data.session) {
        router.push("/");
      } else {
        setUser(data.session.user);
      }
      setLoading(false);
    };
    fetchSession();
  }, [router, supabase]);

  const handleGenerateKey = () => {
    const rand = Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const generated = `cf_live_${rand}`;
    setApiKeys([...apiKeys, generated]);
    setNewKey(generated);
    setShowNewKey(true);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setTeamMembers([...teamMembers, { name: inviteEmail.split("@")[0], email: inviteEmail, role: "Member" }]);
    setInviteEmail("");
    alert("Developer invitation sent successfully!");
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background font-mono text-xs text-zinc-400 animate-pulse">
        Loading Account Settings...
      </div>
    );
  }

  const username = user?.user_metadata?.user_name || "Developer";
  const avatarUrl = user?.user_metadata?.avatar_url || "https://github.com/Lingu17.png";
  const email = user?.email || "lingrajmalipatil1@gmail.com";

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
            <Settings className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Console Settings</h1>
          </div>
        </div>
      </header>

      {/* Tabbed settings container */}
      <div className="flex flex-col lg:flex-row gap-8 items-start max-w-5xl w-full mx-auto">
        {/* Navigation Sidebar */}
        <nav className="w-full lg:w-64 flex flex-row lg:flex-col gap-1 border-b lg:border-b-0 lg:border-r border-border pb-4 lg:pb-0 lg:pr-6 shrink-0 overflow-x-auto text-left">
          <button 
            type="button"
            onClick={() => setActiveTab("account")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "account" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <User className="w-4 h-4" /> Account Settings
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "workspace" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <Users className="w-4 h-4" /> Workspace Settings
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("integrations")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "integrations" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <Puzzle className="w-4 h-4" /> Integrations
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "security" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <KeyRound className="w-4 h-4" /> Security & Access
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("billing")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "billing" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Billing & Quotas
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab("developer_api")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors shrink-0 w-auto lg:w-full text-left border ${
              activeTab === "developer_api" ? "bg-primary/5 text-primary border-primary/10 shadow-sm" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
            }`}
          >
            <Key className="w-4 h-4" /> Developer API
          </button>
        </nav>

        {/* Dynamic content card depending on activeTab */}
        <div className="flex-1 w-full flex flex-col gap-6 text-left">
          {/* ACCOUNT TAB */}
          {activeTab === "account" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <User className="w-4 h-4 text-primary" /> Account Settings
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">Manage your connected developer identity and email settings.</CardDescription>
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
                      defaultValue="Lingraj Malipatil" 
                      className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">GitHub Account ID</span>
                    <input 
                      type="text" 
                      defaultValue={username} 
                      className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">GitHub Connection Status</span>
                    <div className="flex items-center justify-between bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-800">
                      <span className="flex items-center gap-1.5 font-bold text-zinc-700"><GithubIcon className="w-4 h-4 text-zinc-550" /> Connected as @{username}</span>
                      <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-mono font-bold">✓ Active Link</Badge>
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

          {/* WORKSPACE TAB */}
          {activeTab === "workspace" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <Settings className="w-4 h-4 text-primary" /> Workspace Configuration
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">Configure workspace context and active limits.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">Workspace Name</span>
                    <input 
                      type="text" 
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-zinc-500 text-[10px] uppercase tracking-wider">Repository Limits</span>
                    <div className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-700 flex justify-between items-center font-semibold">
                      <span>Limit per Workspace</span>
                      <Badge className="bg-primary/5 text-primary border border-primary/10 font-bold text-[10px]">5 Repositories Max</Badge>
                    </div>
                  </div>
                </div>

                {/* Team Members List */}
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider">Team Developers ({teamMembers.length})</span>
                  <div className="flex flex-col gap-2 bg-zinc-50 border border-border rounded-xl p-3">
                    {teamMembers.map((member, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2 rounded hover:bg-white transition-all border border-transparent hover:border-border hover:shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-zinc-200 border border-border flex items-center justify-center font-mono text-[10px] text-zinc-650 font-bold">
                            {member.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-zinc-800 font-bold">{member.name}</span>
                            <span className="text-[10px] text-zinc-500">{member.email}</span>
                          </div>
                        </div>
                        <Badge className={`text-[9px] font-mono font-bold border ${
                          member.role === 'Owner' ? 'bg-primary/5 text-primary border-primary/10' : 'bg-white text-zinc-500 border-border'
                        }`}>
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invite Developers */}
                <form onSubmit={handleInvite} className="flex flex-col gap-3 border-t border-border pt-4">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider">Invite Developer</span>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      placeholder="developer@company.com" 
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Button type="submit" className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs h-9 cursor-pointer rounded-lg px-4 flex items-center gap-1 shadow-sm">
                      <Plus className="w-3.5 h-3.5" /> Invite
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === "integrations" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <Puzzle className="w-4 h-4 text-primary" /> Connected Integrations
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">Connect third-party VCS platforms and developer messaging alert channels.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                  {/* GitLab */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 border border-border rounded-xl shadow-sm">
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-zinc-800 font-bold">GitLab Integration</span>
                      <span className="text-[10px] text-zinc-500">Sync GitLab commit audits</span>
                    </div>
                    <Button variant="outline" size="sm" className="text-[10px] border-border bg-white hover:bg-zinc-50 text-zinc-700 h-8 px-3 cursor-pointer shadow-sm rounded-lg">Connect</Button>
                  </div>
                  {/* Bitbucket */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 border border-border rounded-xl shadow-sm">
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-zinc-800 font-bold">Bitbucket Sync</span>
                      <span className="text-[10px] text-zinc-500">Analyze Bitbucket repositories</span>
                    </div>
                    <Button variant="outline" size="sm" className="text-[10px] border-border bg-white hover:bg-zinc-50 text-zinc-700 h-8 px-3 cursor-pointer shadow-sm rounded-lg">Connect</Button>
                  </div>
                  {/* Slack */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 border border-border rounded-xl shadow-sm">
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-zinc-800 font-bold">Slack Webhooks</span>
                      <span className="text-[10px] text-zinc-500">Alert Slack on completed scans</span>
                    </div>
                    <Button variant="outline" size="sm" className="text-[10px] border-border bg-white hover:bg-zinc-50 text-zinc-700 h-8 px-3 cursor-pointer shadow-sm rounded-lg">Connect</Button>
                  </div>
                  {/* Discord */}
                  <div className="flex items-center justify-between p-4 bg-zinc-50 border border-border rounded-xl shadow-sm">
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-zinc-800 font-bold">Discord Alerts</span>
                      <span className="text-[10px] text-zinc-500">Deliver findings alerts to channels</span>
                    </div>
                    <Button variant="outline" size="sm" className="text-[10px] border-border bg-white hover:bg-zinc-50 text-zinc-700 h-8 px-3 cursor-pointer shadow-sm rounded-lg">Connect</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <KeyRound className="w-4 h-4 text-primary" /> Security & Access Control
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">Configure login parameters, review active sessions, or wipe credentials.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                {/* Active Sessions */}
                <div className="flex flex-col gap-3">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider">Active browser logins</span>
                  <div className="flex justify-between items-center bg-zinc-50 border border-border rounded-xl p-3.5 text-xs shadow-sm">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="text-zinc-800 font-bold">Windows PC • Bengaluru, IN</span>
                        <span className="text-[9px] text-zinc-400">Chrome Browser • Active session</span>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-250 text-[9px] font-mono font-bold">Current</Badge>
                  </div>
                </div>

                {/* Password reset details */}
                <div className="flex flex-col gap-3 border-t border-border pt-4 text-xs text-zinc-550 font-sans">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider block">Change Password</span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed max-w-md">Your credentials are managed securely via GitHub Single Sign-On (OAuth). Password reset features are disabled for connected third-party identities.</p>
                </div>

                {/* Danger Zone */}
                <div className="flex flex-col gap-3 border-t border-rose-100 pt-4 mt-2">
                  <span className="font-bold text-rose-600 text-[10px] uppercase tracking-wider flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Danger Zone</span>
                  <div className="flex justify-between items-center p-4 bg-rose-50/50 border border-rose-100 rounded-xl text-xs shadow-sm">
                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="text-zinc-800 font-bold">Permanently Delete Account</span>
                      <span className="text-[10px] text-zinc-500">Wipe all cloned indexing files, metadata, and keys.</span>
                    </div>
                    <Button className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs h-9 cursor-pointer rounded-lg px-4 flex items-center gap-1.5 shadow-sm">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BILLING TAB */}
          {activeTab === "billing" && (
            <Card className="bg-white border-border shadow-sm">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                  <CreditCard className="w-4 h-4 text-primary" /> Billing & Active Quotas
                </CardTitle>
                <CardDescription className="text-[10px] text-zinc-500">Review subscription packages, limits, and usage balances.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-6">
                {/* Active Plan Card */}
                <div className="flex justify-between items-center p-4 bg-zinc-50 border border-border rounded-xl shadow-sm">
                  <div className="flex flex-col text-left">
                    <span className="text-zinc-500 font-bold text-[9px] uppercase tracking-wider">Current Tier</span>
                    <span className="text-sm font-extrabold text-zinc-900 mt-1">Free Tier</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">Basic scanning and RAG enabled.</span>
                  </div>
                  <Button onClick={() => router.push("/dashboard/billing")} className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs h-8 px-4 cursor-pointer shadow-sm rounded-lg">
                    Upgrade Console Plan
                  </Button>
                </div>

                {/* Quota Indicators */}
                <div className="flex flex-col gap-4">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase tracking-wider">Workspace Usage Quotas</span>
                  
                  {/* Repositories */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-zinc-650">Active Mapped Repositories</span>
                      <span className="text-zinc-900 font-mono">0 / 5</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[0%]" />
                    </div>
                  </div>

                  {/* PR reviews */}
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-zinc-650">Monthly AI PR Reviews</span>
                      <span className="text-zinc-900 font-mono">0 / 50</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[0%]" />
                    </div>
                  </div>

                  {/* Vector Database Storage */}
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

          {/* DEVELOPER API TAB */}
          {activeTab === "developer_api" && (
            <div className="flex flex-col gap-6 w-full">
              {/* API Keys Panel */}
              <Card className="bg-white border-border shadow-sm">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900">
                        <Key className="w-4 h-4 text-primary" /> API Keys
                      </CardTitle>
                      <CardDescription className="text-[10px] text-zinc-500 text-left mt-1">Authenticate workspace tasks programmatically.</CardDescription>
                    </div>
                    <Button onClick={handleGenerateKey} className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-[10px] h-7 cursor-pointer rounded-lg px-3 flex items-center gap-1 shadow-sm">
                      <Plus className="w-3 h-3" /> Generate Key
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-6 text-left">
                  <div className="flex flex-col gap-2">
                    {apiKeys.map((key, index) => (
                      <div key={index} className="flex justify-between items-center bg-zinc-50 border border-border rounded-xl p-3 font-mono text-xs">
                        <div className="flex items-center gap-2 text-zinc-650">
                          <Key className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{key.substring(0, 12)}••••••••••••••••</span>
                        </div>
                        <Badge className="bg-primary/5 text-primary border-primary/10 text-[9px] font-mono font-bold">cf_live</Badge>
                      </div>
                    ))}
                  </div>

                  {showNewKey && (
                    <div className="p-3.5 bg-indigo-50/50 border border-indigo-150 rounded-xl flex flex-col gap-1.5 text-xs">
                      <span className="font-bold text-zinc-900 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" /> New Live API Key Generated</span>
                      <span className="text-[10px] text-zinc-500 leading-relaxed">Ensure you copy this secret now. It will not be shown again:</span>
                      <code className="bg-white p-2 rounded border border-border text-primary text-[10px] break-all select-all font-mono shadow-sm">{newKey}</code>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
