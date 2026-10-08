"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft, Network, MessageSquare, ShieldAlert, GitFork, Activity, FolderGit2, Cpu, Check } from "lucide-react";
import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-black text-foreground selection:bg-primary/30 relative overflow-hidden font-sans pb-20">
      {/* Background Gradients */}
      <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-zinc-900/40 to-black pointer-events-none -z-10" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[128px] pointer-events-none -z-10" />
      <div className="absolute top-40 -left-40 w-96 h-96 bg-blue-500/5 rounded-full blur-[128px] pointer-events-none -z-10" />

      {/* Header */}
      <nav className="border-b border-white/5 bg-black/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter text-white hover:opacity-90">
            <Layers className="w-5 h-5 text-primary" />
            CodeForge<span className="text-zinc-500">AI</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white flex items-center gap-1.5 cursor-pointer text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 pt-16 flex flex-col gap-16 text-left">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-4 border-blue-500/20 text-blue-400 bg-blue-500/5">Platform Features</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Full Stack Codebase Intelligence</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            CodeForge AI integrates direct repository extraction pipelines,pgvector embedding storage, and LLM evaluations to deliver a comprehensive suite of codebase analytics. Explore how each module helps keep your software robust, secure, and clean.
          </p>
        </div>

        {/* Dynamic Feature Blocks */}
        <div className="flex flex-col gap-12">
          {/* Feature 1: Repository Analysis */}
          <div className="flex flex-col md:flex-row gap-8 items-center p-6 bg-zinc-900/10 border border-white/5 rounded-2xl">
            <div className="flex-1 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">1. Asynchronous Repository Analysis</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect your GitHub public profile or clone direct URLs. CodeForge runs asynchronous parsing tasks in the background, walking the files tree, extracting imports, resolving symbol signatures, generating vector representations, and saving reports securely inside PostgreSQL.
              </p>
            </div>
            <div className="w-full md:w-[380px] bg-zinc-950 border border-white/5 p-4 rounded-xl font-mono text-[10px] text-zinc-400 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3 h-3" /> Cloned repository main branch</div>
              <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3 h-3" /> Extracted 142 Go/Rust/TypeScript files</div>
              <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3 h-3" /> Generated 768-dim embeddings via Gemini</div>
              <div className="flex items-center gap-1.5 text-emerald-400"><Check className="w-3 h-3" /> Indexed structural symbol references</div>
            </div>
          </div>

          {/* Feature 2: Architecture Visualization */}
          <div className="flex flex-col md:flex-row gap-8 items-center p-6 bg-zinc-900/10 border border-white/5 rounded-2xl">
            <div className="flex-1 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                <Network className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">2. Architecture & File Dependency Map</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Understand how files import each other without digging through directories. Our dashboard renders interactive dependency graphs powered by React Flow, positioning file nodes dynamically based on import directives and exposing complex code hierarchies visually.
              </p>
            </div>
            <div className="w-full md:w-[380px] bg-zinc-950 border border-white/5 p-4 rounded-xl text-center shrink-0 flex flex-col gap-3">
              <div className="flex justify-around items-center py-2 relative">
                <div className="px-2.5 py-1 bg-zinc-900 border border-white/10 rounded text-[9px] text-white">utils.ts</div>
                <div className="w-8 h-px bg-primary/40" />
                <div className="px-2.5 py-1 bg-zinc-900 border border-white/10 rounded text-[9px] text-white">database.ts</div>
                <div className="w-8 h-px bg-primary/40" />
                <div className="px-2.5 py-1 bg-zinc-900 border border-white/10 rounded text-[9px] text-white">main.ts</div>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">React Flow nodes layout representing import connections</span>
            </div>
          </div>

          {/* Feature 3: Codebase Chat (RAG) */}
          <div className="flex flex-col md:flex-row gap-8 items-center p-6 bg-zinc-900/10 border border-white/5 rounded-2xl">
            <div className="flex-1 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">3. Context-Aware Codebase Chat (RAG)</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ask natural language queries like &quot;Where are authentication headers configured?&quot; and receive highly precise, context-aware answers. CodeForge fetches the most relevant code chunks from pgvector database storage and utilizes them to ground the AI response with concrete file citations.
              </p>
            </div>
            <div className="w-full md:w-[380px] bg-zinc-950 border border-white/5 p-4 rounded-xl shrink-0 flex flex-col gap-2 font-mono text-[9px] text-zinc-500">
              <span className="text-zinc-400">User: How is JWT verified?</span>
              <div className="p-2 bg-zinc-900/50 rounded border border-white/5 text-zinc-400">
                JWT verification happens in <span className="text-primary hover:underline cursor-pointer">auth.py:L24</span> using the PyJWT library. Here is the block...
              </div>
            </div>
          </div>

          {/* Feature 4: Security & Technical Debt Detection */}
          <div className="flex flex-col md:flex-row gap-8 items-center p-6 bg-zinc-900/10 border border-white/5 rounded-2xl">
            <div className="flex-1 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">4. Security Audits & Technical Debt</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Keep secrets and technical debt out of production. Our static analysis pipeline runs audits to flag exposed API tokens, database passwords, circular file imports, dead code structures, duplicate methods, and high complexity scores, organizing findings into low, medium, and high severity cards.
              </p>
            </div>
            <div className="w-full md:w-[380px] bg-zinc-950 border border-white/5 p-4 rounded-xl shrink-0 flex flex-col gap-2">
              <div className="flex items-center justify-between p-2 bg-rose-500/5 border border-rose-500/10 rounded text-[9px]">
                <span className="text-rose-400 font-semibold">Exposed API Key</span>
                <span className="text-zinc-400">config.json:L8</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-yellow-500/5 border border-yellow-500/10 rounded text-[9px]">
                <span className="text-yellow-400 font-semibold">Circular Import Path</span>
                <span className="text-zinc-400">router.ts ➔ helper.ts</span>
              </div>
            </div>
          </div>

          {/* Feature 5: PR Review Agent */}
          <div className="flex flex-col md:flex-row gap-8 items-center p-6 bg-zinc-900/10 border border-white/5 rounded-2xl">
            <div className="flex-1 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                <GitFork className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">5. Automated PR Review Agent</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Run automated visual pull request audits. Paste git diff logs in the review panel and our LLM agent audits safety, flags code style divergence, detects memory leaks or logic bugs, and writes concrete code patch suggestions.
              </p>
            </div>
            <div className="w-full md:w-[380px] bg-zinc-950 border border-white/5 p-4 rounded-xl shrink-0 flex flex-col gap-1.5 font-mono text-[9px] text-zinc-400">
              <div className="text-rose-400 bg-rose-950/20 px-2 py-0.5 rounded">- return conn.execute(query)</div>
              <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded">+ with conn.cursor() as cur: return cur.execute(query)</div>
              <span className="text-zinc-500 mt-1 text-[8px]">Review suggestion: Always use database context managers to avoid resource leaks.</span>
            </div>
          </div>

          {/* Feature 6: Health Score System */}
          <div className="flex flex-col md:flex-row gap-8 items-center p-6 bg-zinc-900/10 border border-white/5 rounded-2xl">
            <div className="flex-1 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">6. Weighted Codebase Health Scores</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Monitor your repository quality using a weighted letter grade (A through F). The score compiles structural evaluations across 5 categories: Architecture, Security, Maintainability, Testing, and Performance, offering clear recommendations to improve ratings.
              </p>
            </div>
            <div className="w-full md:w-[380px] bg-zinc-950 border border-white/5 p-4 rounded-xl shrink-0 flex items-center justify-center gap-6">
              <div className="w-14 h-14 rounded-full border-2 border-emerald-500 flex items-center justify-center text-emerald-400 text-2xl font-bold font-mono">
                A
              </div>
              <div className="flex flex-col text-xs gap-1">
                <div className="text-zinc-400">Architecture: <span className="text-white font-mono font-bold">92%</span></div>
                <div className="text-zinc-400">Security: <span className="text-white font-mono font-bold">88%</span></div>
                <div className="text-zinc-400">Maintainability: <span className="text-white font-mono font-bold">85%</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
