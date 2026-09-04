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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
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
