"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Code2, Network, ShieldAlert, Activity, Layers, Sparkles, 
  Check, Mail, HelpCircle, 
  Server, Cpu, Database, FileText, MessageSquare, GitPullRequest, Settings,
  Menu, X
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { ComingSoonModal } from "@/components/ComingSoonModal";
import ThreeBackground from "@/components/ThreeBackground";
import { getApiUrl } from "@/utils/api";

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

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export default function LandingPage() {
  const supabase = createClient();
  
  // Contact Form State
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const [showAccountChooser, setShowAccountChooser] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogin = () => {
    window.location.href = "/auth/github";
  };

  const triggerLogin = (forceNew: boolean) => {
    window.location.href = "/auth/github";
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: "db913c2f-0a48-4b1c-b8c1-c10beb3c4199",
          ...formData
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitStatus("success");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        setSubmitStatus("error");
      }
    } catch {
      setSubmitStatus("error");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 relative isolate overflow-x-hidden font-sans pb-16">
      <ThreeBackground />
      
      {/* Background soft blurs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none -z-10" />
      <div className="absolute top-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[128px] pointer-events-none -z-10" />

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 border-b border-border bg-white/80 backdrop-blur-md z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter text-zinc-900 shrink-0">
            <Layers className="w-5 h-5 text-primary" />
            CodeForge<span className="text-zinc-550 font-medium">AI</span>
          </Link>
          
          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#about" className="text-xs text-zinc-550 hover:text-zinc-900 transition-colors">About</a>
            <a href="#features" className="text-xs text-zinc-555 hover:text-zinc-900 transition-colors">Features</a>
            <Link href="/pricing" className="text-xs text-zinc-555 hover:text-zinc-900 transition-colors">Pricing</Link>
            <a href="#faq" className="text-xs text-zinc-555 hover:text-zinc-900 transition-colors font-sans font-semibold">FAQ</a>
            <a href="#contact" className="text-xs text-zinc-555 hover:text-zinc-900 transition-colors">Contact</a>
            <Button onClick={handleLogin} className="bg-primary hover:bg-primary/95 text-white gap-2 cursor-pointer text-xs font-bold font-sans shadow-sm h-11 px-5">
              <GithubIcon className="w-4 h-4" /> Sign In
            </Button>
          </div>

          {/* Mobile Menu Button Toggle */}
          <button 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 rounded-lg hover:bg-zinc-100/80 text-zinc-650 hover:text-zinc-900 transition-colors border border-border cursor-pointer focus:outline-none"
            aria-label="Toggle Mobile Menu"
          >
            {showMobileMenu ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-border bg-white p-5 flex flex-col gap-4 shadow-lg animate-in slide-in-from-top-4 duration-200 text-left">
            <a 
              href="#about" 
              onClick={() => setShowMobileMenu(false)}
              className="text-xs font-semibold text-zinc-650 hover:text-zinc-900 transition-colors py-1.5 border-b border-zinc-50"
            >
              About
            </a>
            <a 
              href="#features" 
              onClick={() => setShowMobileMenu(false)}
              className="text-xs font-semibold text-zinc-650 hover:text-zinc-900 transition-colors py-1.5 border-b border-zinc-50"
            >
              Features
            </a>
            <Link 
              href="/pricing" 
              onClick={() => setShowMobileMenu(false)}
              className="text-xs font-semibold text-zinc-650 hover:text-zinc-900 transition-colors py-1.5 border-b border-zinc-50"
            >
              Pricing
            </Link>
            <a 
              href="#faq" 
              onClick={() => setShowMobileMenu(false)}
              className="text-xs font-semibold text-zinc-650 hover:text-zinc-900 transition-colors py-1.5 border-b border-zinc-50 font-sans"
            >
              FAQ
            </a>
            <a 
              href="#contact" 
              onClick={() => setShowMobileMenu(false)}
              className="text-xs font-semibold text-zinc-650 hover:text-zinc-900 transition-colors py-1.5 border-b border-zinc-50"
            >
              Contact
            </a>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => { setShowMobileMenu(false); handleLogin(); }} className="flex-1 bg-primary hover:bg-primary/95 text-white gap-2 cursor-pointer text-xs font-bold font-sans h-11 rounded-lg shadow-sm">
                <GithubIcon className="w-4 h-4" /> Sign In
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-36 pb-20 flex flex-col items-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants}>
            <Badge variant="outline" className="mb-6 py-1.5 px-4 border-primary/20 text-primary bg-primary/5 flex items-center gap-1.5 font-sans">
              <Sparkles className="w-3.5 h-3.5" /> CodeForge SaaS Portal Active
            </Badge>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-4 text-zinc-900 font-sans"
          >
            Understand Any Codebase in Minutes.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-sm md:text-base text-zinc-550 mb-8 max-w-2xl leading-relaxed font-sans mt-2"
          >
            AI-powered repository intelligence for engineering teams. Analyze architecture, uncover technical debt, review pull requests, and onboard developers faster.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
            <Button onClick={handleLogin} size="lg" className="h-12 px-8 text-sm bg-primary hover:bg-primary/95 text-white gap-2 font-bold cursor-pointer rounded-xl font-sans shadow-md">
              Analyze Repository <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>

          {/* Large Dashboard Preview Mockup */}
          <motion.div
            variants={itemVariants}
            className="w-full mt-16 border border-border rounded-2xl bg-white overflow-hidden shadow-xl relative select-none"
          >
            {/* Window Header */}
            <div className="h-10 border-b border-border bg-zinc-50 flex items-center justify-between px-4">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-450/80 border border-rose-500/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-450/80 border border-amber-500/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-450/80 border border-emerald-500/10" />
              </div>
              <span className="text-[9px] font-mono text-zinc-400">production-dashboard-preview.tsx</span>
              <div className="w-10" />
            </div>

            {/* Main Window Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 md:aspect-[16/10] h-auto pb-6 md:pb-0 text-left">
              {/* Sidebar Mockup */}
              <div className="hidden md:flex flex-col border-r border-border bg-white p-4 justify-between font-sans">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                    <Layers className="w-4 h-4 text-primary" /> CodeForge AI
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-7 px-2.5 rounded bg-primary/5 text-primary text-[10px] font-semibold flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5" /> Repositories
                    </div>
                    {["Architecture", "Codebase Chat", "PR Reviews", "Security & Debt", "Health Score"].map((item) => (
                      <div key={item} className="h-7 px-2.5 rounded text-zinc-500 text-[10px] font-medium flex items-center gap-2 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" /> {item}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                  {["Settings", "Billing"].map((item) => (
                    <div key={item} className="h-6 px-2.5 rounded text-zinc-500 text-[10px] font-medium flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" /> {item}
                    </div>
                  ))}
                  <div className="h-px bg-border my-1" />
                  <div className="flex items-center gap-2.5 px-2 py-1 bg-zinc-50 border border-border rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-zinc-200 border border-border flex items-center justify-center text-[8px] text-zinc-650 font-bold">LM</div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-semibold text-zinc-900 truncate">Lingraj Malipatil</span>
                      <span className="text-[7px] text-zinc-400 mt-0.5 leading-none">Owner</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Panel Content Mockup */}
              <div className="col-span-3 p-6 bg-zinc-50/50 flex flex-col gap-6 overflow-y-auto">
                <div className="flex justify-between items-center border-b border-border pb-4 font-sans">
                  <div className="flex flex-col">
                    <h3 className="text-xs font-semibold text-zinc-900">active-repository-scan</h3>
                    <span className="text-[9px] font-mono text-zinc-400">github.com/codeforge-ai/production-service</span>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 text-[9px] font-mono flex items-center gap-1 font-sans font-semibold">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Fully Synced
                  </Badge>
                </div>

                {/* Dashboard Inner Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
                  {/* Health Score Gauge */}
                  <div className="border border-border rounded-xl p-4 bg-white flex flex-col items-center gap-2 text-center shadow-sm">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Health Index</span>
                    <div className="w-14 h-14 rounded-full border-4 border-primary bg-primary/5 flex items-center justify-center shadow-inner">
                      <span className="text-base font-bold font-mono text-primary">92</span>
                    </div>
                    <span className="text-[8px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Grade A-</span>
                  </div>

                  {/* Repository Insights */}
                  <div className="border border-border rounded-xl p-4 bg-white flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Codebase Metrics</span>
                    <div className="flex flex-col gap-1.5 text-[9px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Total Files</span>
                        <span className="text-zinc-800 font-semibold font-mono">148</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Functions</span>
                        <span className="text-zinc-800 font-semibold font-mono">1,124</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Language</span>
                        <span className="text-primary font-semibold">TypeScript</span>
                      </div>
                    </div>
                    <div className="h-1 bg-zinc-100 rounded-full overflow-hidden mt-2">
                      <div className="bg-primary h-full w-[80%]" />
                    </div>
                  </div>

                  {/* Security Scan Alerts */}
                  <div className="border border-border rounded-xl p-4 bg-white flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">Security Audit</span>
                    <div className="flex flex-col gap-1.5 text-[8px] font-mono">
                      <div className="flex items-center justify-between bg-rose-50 border border-rose-100 p-1 rounded">
                        <span className="text-rose-700 truncate w-[70%]">api_key exposed</span>
                        <span className="text-rose-600 font-bold bg-rose-100 px-1 rounded text-[7px]">High</span>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50 border border-amber-100 p-1 rounded">
                        <span className="text-amber-700 truncate w-[70%]">unsafe raw SQL</span>
                        <span className="text-amber-600 font-bold bg-amber-100 px-1 rounded text-[7px]">Med</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Visual: Architecture Graph Mock */}
                <div className="border border-border rounded-xl p-4 bg-white flex-1 flex flex-col gap-3 min-h-[120px] relative overflow-hidden shadow-sm">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block font-sans">Dependency Flow Diagram</span>
                  <div className="flex-1 flex items-center justify-center gap-6 relative">
                    {/* SVG Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                      <path d="M 60,45 Q 120,20 180,45" stroke="#4F46E5" strokeWidth="1" fill="none" strokeDasharray="3,3" />
                      <path d="M 60,45 Q 120,70 180,45" stroke="#4F46E5" strokeWidth="1" fill="none" />
                      <path d="M 180,45 Q 240,20 300,45" stroke="#00bbf9" strokeWidth="1" fill="none" strokeDasharray="3,3" />
                      <path d="M 180,45 Q 240,70 300,45" stroke="#00bbf9" strokeWidth="1" fill="none" />
                    </svg>

                    <div className="z-10 bg-zinc-50 border border-border rounded px-2 py-0.5 text-[8px] font-mono text-zinc-650">db_connector.ts</div>
                    <div className="flex flex-col gap-8 z-10">
                      <div className="bg-white border border-primary/50 rounded px-2 py-0.5 text-[8px] font-mono text-primary shadow-sm">auth_validator.ts</div>
                    </div>
                    <div className="z-10 bg-zinc-50 border border-border rounded px-2 py-0.5 text-[8px] font-mono text-zinc-650">main_server.py</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Built for Modern Engineering Teams feature stats section */}
          <motion.div variants={itemVariants} className="mt-20 flex flex-col items-center gap-6 w-full">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold font-sans">Built For Modern Engineering Teams</span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-8 bg-white border border-border rounded-2xl w-full max-w-4xl shadow-sm">
              <div className="flex flex-col items-center p-2 text-center">
                <Network className="w-5 h-5 text-primary mb-2" />
                <span className="text-xs font-semibold text-zinc-800">Repository Intel</span>
              </div>
              <div className="flex flex-col items-center p-2 text-center border-l border-border">
                <Layers className="w-5 h-5 text-indigo-500 mb-2" />
                <span className="text-xs font-semibold text-zinc-800">Architecture Maps</span>
              </div>
              <div className="flex flex-col items-center p-2 text-center border-l border-border">
                <Sparkles className="w-5 h-5 text-amber-500 mb-2" />
                <span className="text-xs font-semibold text-zinc-800">AI Code Reviews</span>
              </div>
              <div className="flex flex-col items-center p-2 text-center border-l border-border">
                <ShieldAlert className="w-5 h-5 text-rose-500 mb-2" />
                <span className="text-xs font-semibold text-zinc-800">Security Analysis</span>
              </div>
              <div className="flex flex-col items-center p-2 text-center border-l border-border">
                <MessageSquare className="w-5 h-5 text-cyan-550 mb-2" />
                <span className="text-xs font-semibold text-zinc-800">Codebase Chat</span>
              </div>
            </div>
          </motion.div>
        </motion.div>


        {/* Section: About CodeForge AI */}
        <section id="about" className="mt-40 max-w-4xl text-center border-t border-border pt-20">
          <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-600 bg-emerald-50">About the Platform</Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-6 font-sans">Autonomous Repository Intelligence</h2>
          <p className="text-zinc-500 leading-relaxed text-sm md:text-base text-center max-w-3xl mx-auto font-sans">
            CodeForge AI analyzes repositories to uncover architecture, security risks, technical debt, and code insights using AI-powered repository intelligence.
          </p>
        </section>

        {/* Section: Features Section (8 Cards) */}
        <section id="features" className="mt-40 w-full">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-indigo-200 text-indigo-650 bg-indigo-50">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 font-sans">Full Stack Engineering Intelligence</h2>
            <p className="text-xs text-zinc-500 mt-2 font-sans">Everything you need to scan, audit, and understand your codebase.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Network className="w-6 h-6 text-indigo-555" />}
              title="Architecture Intelligence"
              description="Visualize project import chains and structural hierarchies using interactive React Flow node graphs."
            />
            <FeatureCard
              icon={<MessageSquare className="w-6 h-6 text-emerald-555" />}
              title="Codebase Chat (RAG)"
              description="Query code files semantically using vector chunk search and receive answers with precise source file citations."
            />
            <FeatureCard
              icon={<ShieldAlert className="w-6 h-6 text-rose-555" />}
              title="Security Audit"
              description="Scan files for exposed secrets, unsafe SQL parameters, raw shell calls, and vulnerable access methods."
            />
            <FeatureCard
              icon={<Activity className="w-6 h-6 text-purple-555" />}
              title="Technical Debt Tracker"
              description="Audit complex code modules, duplicate import calls, bloated classes, and trace circular imports."
            />
            <FeatureCard
              icon={<GitPullRequest className="w-6 h-6 text-amber-555" />}
              title="PR Review Agent"
              description="Submit git diff strings and receive deep audits, risk levels, and inline optimization feedback using Gemini Pro."
            />
            <FeatureCard
              icon={<Cpu className="w-6 h-6 text-cyan-555" />}
              title="Health Score Engine"
              description="Compute dynamic overall grade scores (A-F) based on Architecture, Security, Maintainability, Testing, and Performance weights."
            />
            <FeatureCard
              icon={<Database className="w-6 h-6 text-indigo-500" />}
              title="Repository Insights"
              description="View file distribution tables, size metrics, structural exports, and class/function lists per language."
            />
            <FeatureCard
              icon={<Settings className="w-6 h-6 text-pink-500" />}
              title="Secure Repository Access"
              description="Connect with GitHub OAuth or analyze public repositories through a guided import flow built for secure scanning."
            />
          </div>
        </section>

        {/* Section: How It Works */}
        <section className="mt-40 w-full max-w-5xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-indigo-200 text-indigo-650 bg-indigo-50">Workflow</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 font-sans">How CodeForge AI Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
            <WorkflowStep step="1" title="Connect" desc="Authenticate securely using GitHub OAuth." />
            <WorkflowStep step="2" title="Import" desc="Select a public repository or paste a clone URL." />
            <WorkflowStep step="3" title="Analyze" desc="FastAPI clones and parses symbols in background." />
            <WorkflowStep step="4" title="Index" desc="Gemini generates 768-dimensional RAG embeddings." />
            <WorkflowStep step="5" title="Explore" desc="Interact with graphs, chat RAG, and audit metrics." />
          </div>
        </section>

        {/* Section: Supported Technologies */}
        <section className="mt-40 text-center">
          <Badge variant="outline" className="mb-4 border-border text-zinc-550">Supported Technologies</Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-8 font-sans">Parse & Ingest Any Language</h2>
          <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
            {["TypeScript", "JavaScript", "React / Next.js", "Python", "Java", "Kotlin", "Go", "Rust", "Node.js", "FastAPI", "Express", "Spring Boot"].map((tech) => (
              <span key={tech} className="bg-white border border-border px-4 py-1.5 rounded-full text-xs text-zinc-650 font-medium shadow-sm">
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* Section: Built With */}
        <section className="mt-40 text-center max-w-4xl border-t border-border pt-20 w-full">
          <Badge variant="outline" className="mb-4 border-primary/20 text-primary bg-primary/5">Platform Architecture</Badge>
          <h2 className="text-3xl font-bold text-zinc-900 mb-4 font-sans">Built With Modern Enterprise Technology</h2>
          <p className="text-xs text-zinc-500 max-w-md mx-auto mb-10 font-sans">CodeForge AI leverages best-in-class tools and infrastructure to deliver instant codebase intelligence.</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-white border border-border rounded-xl flex flex-col items-center gap-2 shadow-sm">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              <span className="text-xs font-semibold text-zinc-800">Gemini AI</span>
              <span className="text-[9px] text-zinc-400 font-mono">Flash & Pro Models</span>
            </div>
            <div className="p-4 bg-white border border-border rounded-xl flex flex-col items-center gap-2 shadow-sm">
              <Server className="w-6 h-6 text-indigo-500" />
              <span className="text-xs font-semibold text-zinc-800">Supabase</span>
              <span className="text-[9px] text-zinc-400 font-mono">Auth & Realtime</span>
            </div>
            <div className="p-4 bg-white border border-border rounded-xl flex flex-col items-center gap-2 shadow-sm">
              <Database className="w-6 h-6 text-blue-500" />
              <span className="text-xs font-semibold text-zinc-800">PostgreSQL</span>
              <span className="text-[9px] text-zinc-400 font-mono">Vector DB (pgvector)</span>
            </div>
            <div className="p-4 bg-white border border-border rounded-xl flex flex-col items-center gap-2 shadow-sm">
              <Layers className="w-6 h-6 text-primary" />
              <span className="text-xs font-semibold text-zinc-800">Next.js 15</span>
              <span className="text-[9px] text-zinc-400 font-mono">React Framework</span>
            </div>
            <div className="p-4 bg-white border border-border rounded-xl flex flex-col items-center gap-2 shadow-sm">
              <Cpu className="w-6 h-6 text-cyan-600" />
              <span className="text-xs font-semibold text-zinc-800">TypeScript</span>
              <span className="text-[9px] text-zinc-400 font-mono">Type-Safe Logic</span>
            </div>
          </div>
        </section>

        {/* Section: Demo Screenshots Visuals */}
        <section className="mt-40 w-full max-w-5xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-indigo-200 text-indigo-650 bg-indigo-50">Interface Preview</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 font-sans">Explore the Core Console</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <DemoScreenCard 
              title="Architecture Visualizer" 
              desc="View local imports mapped to a React Flow canvas with animated connection lines."
              preview={
                <div className="w-full h-40 bg-zinc-50 rounded-lg relative overflow-hidden flex items-center justify-center border border-border">
                  <div className="absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] bg-[size:16px_16px]" />
                  <div className="flex gap-4">
                    <div className="w-16 h-8 rounded bg-white border border-border flex items-center justify-center text-[8px] font-mono text-zinc-650 shadow-sm">db.py</div>
                    <div className="w-16 h-8 rounded bg-white border border-primary/40 flex items-center justify-center text-[8px] font-mono text-primary shadow-sm font-semibold">scanner.py</div>
                    <div className="w-16 h-8 rounded bg-white border border-border flex items-center justify-center text-[8px] font-mono text-zinc-650 shadow-sm">main.py</div>
                  </div>
                </div>
              }
            />
            <DemoScreenCard 
              title="Codebase Chat (RAG)" 
              desc="Ask detailed logical questions and see responsive answers with file citation tokens."
              preview={
                <div className="w-full h-40 bg-zinc-50 rounded-lg p-3 border border-border flex flex-col justify-between text-left font-mono shadow-sm">
                  <div className="text-[10px] text-zinc-500 font-sans">&gt; How are scan statuses updated?</div>
                  <div className="text-[10px] text-zinc-700 leading-relaxed bg-white p-2.5 rounded border border-border shadow-sm">
                    "Scan status updates are managed by the update_job_status function in scanner.py."
                  </div>
                  <div className="flex gap-1.5"><Badge className="bg-primary/10 text-primary border-primary/20 text-[8px]">scanner.py</Badge></div>
                </div>
              }
            />
            <DemoScreenCard 
              title="Security Audits" 
              desc="Inspect vulnerability summaries, severity badges, and file locations instantly."
              preview={
                <div className="w-full h-40 bg-zinc-50 rounded-lg p-3 border border-border flex flex-col gap-2 text-left font-mono text-[9px] shadow-sm">
                  <div className="flex justify-between items-center border-b border-border pb-1 text-zinc-500 font-sans">
                    <span>Vulnerability</span>
                    <span>Severity</span>
                  </div>
                  <div className="flex justify-between items-center bg-rose-50 border border-rose-100 p-1.5 rounded text-xs text-rose-700 font-semibold">
                    <span className="truncate w-[70%]">Exposed Supabase API Key (db.py:12)</span>
                    <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[8px]">High</Badge>
                  </div>
                  <div className="flex justify-between items-center bg-amber-50 border border-amber-100 p-1.5 rounded text-xs text-amber-700 font-semibold">
                    <span className="truncate w-[70%]">Unescaped User Input Query (main.py:82)</span>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[8px]">Medium</Badge>
                  </div>
                </div>
              }
            />
            <DemoScreenCard 
              title="Health Scores & Grades" 
              desc="Evaluate codebase quality through a weighted index of 5 software engineering disciplines."
              preview={
                <div className="w-full h-40 bg-zinc-50 rounded-lg border border-border flex items-center justify-center gap-6 shadow-sm">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center text-emerald-600 font-mono font-bold text-lg bg-emerald-50 shadow-inner">
                    88
                  </div>
                  <div className="text-left flex flex-col gap-1 text-xs">
                    <div className="text-zinc-700 font-semibold">Grade Score: <span className="text-emerald-600 font-bold">B</span></div>
                    <div className="text-[10px] text-zinc-450 font-sans">Architecture (25%), Security (25%), Maintainability (20%)</div>
                  </div>
                </div>
              }
            />
          </div>
        </section>

        {/* Section: Pricing Section */}
        <section id="pricing" className="mt-40 w-full max-w-5xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-indigo-200 text-indigo-650 bg-indigo-50">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 font-sans">Simple, Predictable Pricing</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PricingCard 
              tier="Free" 
              price="$0" 
              desc="Best for open-source analysis & side projects."
              features={[
                "Analyze up to 5 repositories",
                "Basic repository health scan",
                "Codebase Chat RAG (Gemini Flash)",
                "Standard RLS policies active"
              ]}
              cta="Get Started Free"
              action={handleLogin}
            />
            <PricingCard 
              tier="Pro" 
              price="$29" 
              desc="Optimized for professional developers and startup codebases."
              features={[
                "Unlimited repository imports",
                "Advanced AI scans (Gemini Pro integration)",
                "Automated PR reviews",
                "Interactive dependency graph visualizer",
                "Prioritized background queuing"
              ]}
              cta="Upgrade to Pro"
              featured
              action={() => setShowPricingModal(true)}
            />
            <PricingCard 
              tier="Enterprise" 
              price="Custom" 
              desc="Configured for larger engineering teams & custom setups."
              features={[
                "Self-hosted deployment options",
                "Single Sign-On (SSO / SAML)",
                "Custom integrations & SLA support",
                "Exclusive dedicated database partition"
              ]}
              cta="Contact Sales"
              action={() => {
                const el = document.getElementById("contact");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </div>
        </section>

        {/* Section: FAQ */}
        <section id="faq" className="mt-40 w-full max-w-3xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 border-indigo-200 text-indigo-650 bg-indigo-50">FAQ</Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 font-sans">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col gap-4">
            <FaqItem 
              idx={0} 
              question="Is my code secure and private?" 
              answer="Absolutely. CodeForge AI clones your repository into a secure, temporary directory that is deleted immediately after the analysis finishes. We do not store your raw source code files in our database; we only persist metadata and anonymized vector embeddings for the semantic chat."
              active={activeFaq === 0}
              onToggle={() => setActiveFaq(activeFaq === 0 ? null : 0)}
            />
            <FaqItem 
              idx={1} 
              question="Which languages are supported?" 
              answer="We offer fully optimized semantic analysis and symbol parsing for JavaScript, TypeScript, React/Next.js, Python, Java, Kotlin, Go, and Rust. Other file extensions are parsed using standard text chunking fallbacks."
              active={activeFaq === 1}
              onToggle={() => setActiveFaq(activeFaq === 1 ? null : 1)}
            />
            <FaqItem 
              idx={2} 
              question="Does it support private repositories?" 
              answer="Yes. When connecting via GitHub OAuth, we request standard scope access to fetch your private repositories. Your private code is treated with the same strict sandbox isolation as public repositories."
              active={activeFaq === 2}
              onToggle={() => setActiveFaq(activeFaq === 2 ? null : 2)}
            />
            <FaqItem 
              idx={3} 
              question="Can I self-host CodeForge AI?" 
              answer="Yes. The Enterprise license supports self-hosted configurations using Docker containers and your own API keys for Supabase and Gemini AI models."
              active={activeFaq === 3}
              onToggle={() => setActiveFaq(activeFaq === 3 ? null : 3)}
            />
          </div>
        </section>

        {/* Section: Contact Form */}
        <section id="contact" className="mt-40 w-full max-w-xl border-t border-border pt-20 px-4 sm:px-6">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4 border-rose-200 text-rose-600 bg-rose-50">Contact Us</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 font-sans">Get in Touch</h2>
            <p className="text-xs text-zinc-500 mt-2 font-sans">Have a question or looking for a custom enterprise setup? Send us a message.</p>
          </div>

          <form onSubmit={handleContactSubmit} className="flex flex-col gap-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Name" 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-white border border-border rounded-lg px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
              />
              <input 
                type="email" 
                placeholder="Email Address" 
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-white border border-border rounded-lg px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
              />
            </div>
            <input 
              type="text" 
              placeholder="Subject" 
              required
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              className="bg-white border border-border rounded-lg px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
            />
            <textarea 
              placeholder="Your Message..." 
              rows={4}
              required
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              className="bg-white border border-border rounded-lg px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
            />

            {submitStatus === "success" && (
              <span className="text-xs text-emerald-600 font-mono font-semibold">Your message has been submitted successfully. Thank you!</span>
            )}
            {submitStatus === "error" && (
              <span className="text-xs text-rose-600 font-mono font-semibold">Failed to submit message. Please try again.</span>
            )}

            <Button 
              type="submit" 
              disabled={submitStatus === "sending"}
              className="bg-primary hover:bg-primary/90 text-white h-11 text-xs font-semibold cursor-pointer shadow-sm rounded-lg"
            >
              {submitStatus === "sending" ? "Sending..." : "Send Message"}
            </Button>
          </form>

          {/* Social Links & Info */}
          <div className="mt-12 flex flex-col items-center gap-4 text-xs text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> hello@codeforgeai.dev</span>
            <div className="flex gap-4">
              <a href="https://github.com/Lingu17" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 flex items-center gap-1"><GithubIcon className="w-3.5 h-3.5 text-zinc-450" /> GitHub</a>
              <a href="https://linkedin.com/in/lingraj-malipatil-a2735a241" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 flex items-center gap-1"><LinkedinIcon className="w-3.5 h-3.5 text-indigo-500" /> LinkedIn</a>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-16 mt-20 text-zinc-500 text-xs">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-bold text-sm tracking-tighter text-zinc-900">
              <Layers className="w-5 h-5 text-primary" />
              CodeForge<span className="text-zinc-500 font-medium">AI</span>
            </div>
            <p className="text-[10px] text-zinc-450 leading-relaxed">AI-Powered Software Repository Analytics & Intelligence Engine.</p>
            <span className="text-[10px] text-zinc-400 mt-4">© 2026 CodeForge AI. All rights reserved.</span>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <span className="font-semibold text-zinc-800 mb-1">Product</span>
            <Link href="/features" className="hover:text-zinc-900 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-zinc-900 transition-colors">Pricing</Link>
            <a href="https://github.com/Lingu17" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-colors">GitHub</a>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <span className="font-semibold text-zinc-800 mb-1">Company</span>
            <Link href="/about" className="hover:text-zinc-900 transition-colors">About Us</Link>
            <Link href="/contact" className="hover:text-zinc-900 transition-colors">Contact</Link>
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-900 transition-colors">Terms of Service</Link>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <span className="font-semibold text-zinc-800 mb-1">Resources</span>
            <Link href="/blog" className="hover:text-zinc-900 transition-colors">Blog</Link>
            <Link href="/changelog" className="hover:text-zinc-900 transition-colors">Changelog</Link>
            <Link href="/roadmap" className="hover:text-zinc-900 transition-colors">Roadmap</Link>
          </div>
        </div>
      </footer>

      {/* GitHub Account Chooser Modal */}
      {showAccountChooser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white border border-border rounded-2xl w-full max-w-[95vw] sm:max-w-sm p-6 shadow-2xl flex flex-col gap-6 text-left animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-base font-bold text-zinc-900 mb-2 flex items-center gap-2">
                <GithubIcon className="w-5 h-5 text-zinc-700" /> Connect to GitHub
              </h3>
              <p className="text-xs text-zinc-550 leading-relaxed">
                Connect your account to analyze repositories and audit codebase quality.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Option A: Continue as current cached user */}
              <div className="p-3 bg-zinc-50 border border-border rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {typeof window !== "undefined" && localStorage.getItem("saved_github_avatar") ? (
                    <img 
                      src={localStorage.getItem("saved_github_avatar")!} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full border border-border shrink-0" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center border border-border text-zinc-650 shrink-0 font-mono text-xs font-bold">
                      {typeof window !== "undefined" && localStorage.getItem("saved_github_username")?.substring(0, 2).toUpperCase() || "GH"}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-xs font-bold text-zinc-800 truncate">Continue as @{typeof window !== "undefined" ? localStorage.getItem("saved_github_username") : ""}</span>
                    <span className="text-[10px] text-zinc-450 truncate">{typeof window !== "undefined" ? localStorage.getItem("saved_github_email") : ""}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => {
                    setShowAccountChooser(false);
                    triggerLogin(false);
                  }}
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-3 h-8 cursor-pointer shadow-sm"
                >
                  Continue
                </Button>
              </div>

              {/* Option B: Use different account */}
              <button 
                onClick={() => {
                  setShowAccountChooser(false);
                  triggerLogin(true);
                }}
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-border bg-zinc-50/50 text-xs text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50 transition-all text-center cursor-pointer w-full"
              >
                Sign in with a different GitHub account
              </button>
            </div>

            <div className="flex justify-end border-t border-border pt-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAccountChooser(false)}
                className="text-zinc-500 hover:text-zinc-900 cursor-pointer h-9 px-4 text-xs font-semibold hover:bg-zinc-100"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing coming soon waitlist modal */}
      <ComingSoonModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="bg-white border-border shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20">
      <CardHeader className="p-6 pb-4">
        <div className="w-12 h-12 rounded-lg bg-zinc-50 border border-border flex items-center justify-center mb-4">
          {icon}
        </div>
        <CardTitle className="text-sm text-zinc-900 font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <CardDescription className="text-zinc-500 leading-relaxed text-xs">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

function WorkflowStep({ step, title, desc }: { step: string, title: string, desc: string }) {
  return (
    <div className="flex-1 p-5 bg-white border border-border rounded-xl text-left flex flex-col gap-2 relative shadow-sm">
      <div className="w-7 h-7 rounded-full bg-primary/5 border border-primary/20 text-primary text-xs flex items-center justify-center font-mono font-bold">
        {step}
      </div>
      <h4 className="text-sm font-bold text-zinc-900">{title}</h4>
      <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

function DemoScreenCard({ title, desc, preview }: { title: string, desc: string, preview: React.ReactNode }) {
  return (
    <div className="p-6 bg-white border border-border rounded-2xl flex flex-col gap-4 shadow-sm hover:border-primary/20 transition-colors">
      <div className="text-left">
        <h4 className="font-bold text-zinc-900 text-sm">{title}</h4>
        <p className="text-zinc-500 text-xs mt-1">{desc}</p>
      </div>
      {preview}
    </div>
  );
}

function PricingCard({ tier, price, desc, features, cta, featured = false, action }: { tier: string, price: string, desc: string, features: string[], cta: string, featured?: boolean, action?: () => void }) {
  return (
    <Card className={`p-8 flex flex-col justify-between text-left transition-all duration-300 relative overflow-hidden ${
      featured 
        ? "bg-white border-2 border-primary shadow-xl scale-105" 
        : "bg-white border-border shadow-sm hover:border-zinc-350"
    }`}>
      {featured && (
        <div className="absolute top-0 right-0 bg-primary text-white font-mono text-[9px] uppercase tracking-wider font-bold py-1 px-4 rounded-bl">
          Popular
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">{tier}</span>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-4xl font-extrabold text-zinc-900 font-mono">{price}</span>
            {price !== "Custom" && <span className="text-xs text-zinc-500">/month</span>}
          </div>
          <p className="text-zinc-500 text-xs mt-2 leading-relaxed min-h-[40px]">{desc}</p>
        </div>
        <div className="h-px bg-border my-2" />
        <ul className="flex flex-col gap-2.5">
          {features.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5 text-xs text-zinc-650">
              <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button 
        onClick={action}
        className={`w-full mt-8 h-10 text-xs font-semibold cursor-pointer rounded-lg ${
          featured ? "bg-primary hover:bg-primary/90 text-white shadow-sm" : "bg-zinc-900 text-white hover:bg-zinc-800"
        }`}
      >
        {cta}
      </Button>
    </Card>
  );
}

function TestimonialCard({ quote, author, role }: { quote: string, author: string, role: string }) {
  return (
    <Card className="bg-white border-border p-6 flex flex-col justify-between text-left relative shadow-sm">
      <div className="absolute -top-3 left-4 text-3xl font-serif text-zinc-300 pointer-events-none select-none">“</div>
      <p className="text-zinc-650 text-xs leading-relaxed italic z-10">"{quote}"</p>
      <div className="mt-6">
        <span className="block font-semibold text-xs text-zinc-900">{author}</span>
        <span className="text-[10px] text-zinc-450">{role}</span>
      </div>
    </Card>
  );
}

function FaqItem({ idx, question, answer, active, onToggle }: { idx: number, question: string, answer: string, active: boolean, onToggle: () => void }) {
  return (
    <div className="border border-border bg-white rounded-xl overflow-hidden text-left transition-all duration-300 shadow-sm">
      <button 
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors cursor-pointer focus:outline-none"
      >
        <span className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-zinc-400" />
          {question}
        </span>
        <span className={`text-zinc-450 font-mono transition-transform duration-300 ${active ? "rotate-45" : ""}`}>+</span>
      </button>
      <div className={`transition-all duration-300 ease-in-out ${
        active ? "max-h-40 border-t border-border p-5 bg-zinc-50/50" : "max-h-0 overflow-hidden"
      }`}>
        <p className="text-zinc-550 text-xs leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}
