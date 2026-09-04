"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft, Cpu, Database, Network, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 relative overflow-hidden font-sans pb-20">
      {/* Background blurs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none -z-10" />
      <div className="absolute top-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[128px] pointer-events-none -z-10" />

      {/* Header */}
      <nav className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter text-zinc-900 hover:opacity-90">
            <Layers className="w-5 h-5 text-primary" />
            CodeForge<span className="text-zinc-500 font-medium">AI</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 cursor-pointer text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 pt-16 flex flex-col gap-10 text-left">
        <div>
          <Badge variant="outline" className="mb-4 border-emerald-200 text-emerald-600 bg-emerald-50">About Us</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-4">Autonomous Repository Intelligence</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            CodeForge AI is a repository intelligence engine built to empower software engineers to comprehend, audit, and maintain large codebases instantly. Legacy software onboarding, security patching, and manual code reviews introduce significant engineering overhead. CodeForge AI automates these processes by indexing repositories, creating structured dependency graphs, auditing quality, and providing an interactive, codebase-aware AI chat.
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white border-border shadow-sm p-5 flex flex-col gap-2">
            <Cpu className="w-6 h-6 text-primary" />
            <h3 className="font-bold text-zinc-800 text-sm">Codebase Comprehension</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We ingest directories, map language structures, and expose symbol calls to onboard developers to codebases in minutes instead of weeks.
            </p>
          </Card>

          <Card className="bg-white border-border shadow-sm p-5 flex flex-col gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            <h3 className="font-bold text-zinc-800 text-sm">Automated Audits</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Automatically identify architectural anomalies, circular imports, hardcoded developer secrets, and outdated dependencies.
            </p>
          </Card>
        </div>

        {/* Tech Stack */}
        <div className="border-t border-border pt-10">
          <h2 className="text-xl font-bold text-zinc-900 mb-4">Our Technology Stack</h2>
          <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
            CodeForge AI is engineered from the ground up using state-of-the-art framework architectures to ensure rapid analysis and robust vector retrieval:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="flex items-center gap-2.5 p-3 bg-white border border-border rounded-xl shadow-sm">
              <Layers className="w-4 h-4 text-zinc-400" />
              <div>
                <span className="text-zinc-800 block font-bold font-sans">Next.js 15 (App Router)</span>
                <span className="text-[10px] text-zinc-450">React Frontend, SSR, Turbopack</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-white border border-border rounded-xl shadow-sm">
              <Cpu className="w-4 h-4 text-zinc-400" />
              <div>
                <span className="text-zinc-800 block font-bold font-sans">FastAPI & Python</span>
                <span className="text-[10px] text-zinc-450">Asynchronous scanner pipelines</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-white border border-border rounded-xl shadow-sm">
              <Database className="w-4 h-4 text-zinc-400" />
              <div>
                <span className="text-zinc-800 block font-bold font-sans">Supabase & PostgreSQL</span>
                <span className="text-[10px] text-zinc-450">Data storage, RLS security, pgvector</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 bg-white border border-border rounded-xl shadow-sm">
              <Network className="w-4 h-4 text-zinc-400" />
              <div>
                <span className="text-zinc-800 block font-bold font-sans">Gemini AI Models</span>
                <span className="text-[10px] text-zinc-450">Code summaries & vector embeddings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Founder & Mission */}
        <div className="border-t border-border pt-10 flex flex-col md:flex-row gap-8 items-start">
          <a 
            href="https://linkedin.com/in/lingraj-malipatil-a2735a241" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="w-16 h-16 rounded-full border border-border shrink-0 overflow-hidden block hover:border-primary/50 transition-colors shadow-sm"
          >
            <img 
              src="https://github.com/Lingu17.png" 
              alt="Lingraj Malipatil" 
              className="w-full h-full object-cover"
            />
          </a>
          <div className="flex-1 text-left">
            <h2 className="text-xl font-bold text-zinc-900 mb-1">Lingraj Malipatil</h2>
            <div className="flex flex-col gap-0.5 mb-4">
              <span className="text-xs text-primary font-mono font-semibold">AI Full-Stack Engineer</span>
              <span className="text-[10px] text-zinc-450 font-mono">Founder, CodeForge AI</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-4">
              CodeForge AI was founded by Lingraj Malipatil out of frustration with legacy onboarding overhead in engineering teams. The mission of CodeForge AI is to remove comprehension barriers from complex software. We believe developers should spend their time writing new features and scaling systems, rather than reading thousands of undocumented files to figure out how code flows.
            </p>
            <a 
              href="https://linkedin.com/in/lingraj-malipatil-a2735a241" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono font-semibold"
            >
              View LinkedIn →
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
