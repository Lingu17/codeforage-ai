"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-foreground selection:bg-primary/30 relative overflow-hidden font-sans pb-20">
      {/* Background Gradients */}
      <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-zinc-900/40 to-black pointer-events-none -z-10" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[128px] pointer-events-none -z-10" />

      {/* Header */}
      <nav className="border-b border-white/5 bg-black/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
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
      <main className="max-w-3xl mx-auto px-6 pt-16 flex flex-col gap-10 text-left">
        <div>
          <Badge variant="outline" className="mb-4 border-zinc-800 text-zinc-500 bg-zinc-900/5">Legal Policies</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Terms of Service</h1>
          <p className="text-xs text-zinc-500 font-mono">Last updated: June 7, 2026</p>
        </div>

        <div className="flex flex-col gap-8 text-xs text-zinc-400 leading-relaxed font-sans">
          {/* Section 1 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Scale className="w-4 h-4 text-primary" /> 1. Acceptable Use</h2>
            <p className="text-justify">
              By utilizing the CodeForge AI platform, you agree to submit only codebases and repositories for which you have explicit access permissions. You must not attempt to use the automated scanner to ingest unauthorized software, circular-scan large scale systems maliciously, or bypass model token limitations using scraping wrappers.
            </p>
          </div>

          {/* Section 2 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Scale className="w-4 h-4 text-primary" /> 2. Account Responsibility</h2>
            <p className="text-justify">
              You are entirely responsible for maintaining the confidentiality of your Supabase and GitHub session credentials. Any repository analyses, chats history queries, or PR reviews executed under your connected profile will be considered your authorized actions. You can revoke token access permissions directly via your GitHub Developer settings at any time.
            </p>
          </div>

          {/* Section 3 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Scale className="w-4 h-4 text-primary" /> 3. Service Limitations & Disclaimer</h2>
            <p className="text-justify">
              CodeForge AI utilizes static parsers and Generative AI (Google Gemini APIs) to compile code metrics, security warnings, and RAG answers. While we strive for accuracy, AI models can produce hallucinations, wrong architecture maps, or false security warnings. All generated reports, quality grades, and PR review comments are provided &quot;as is&quot; and should be reviewed by qualified software engineers before merge.
            </p>
          </div>

          {/* Section 4 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Scale className="w-4 h-4 text-primary" /> 4. Beta Features Disclaimer</h2>
            <p className="text-justify">
              CodeForge AI is currently offered in active Beta. Certain features, paid subscription cards, pricing structures, and SLA response limits are under construction and subject to change without notice. We do not guarantee uninterrupted system access or lifetime storage of historical scan data during this development period.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
