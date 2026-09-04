"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Privacy Policy</h1>
          <p className="text-xs text-zinc-500 font-mono">Last updated: June 7, 2026</p>
        </div>

        <div className="flex flex-col gap-8 text-xs text-zinc-400 leading-relaxed font-sans">
          {/* Section 1 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /> 1. GitHub OAuth Authentication</h2>
            <p className="text-justify">
              CodeForge AI uses GitHub OAuth to verify user identities and establish secure sessions. We request read-only permissions for your public user profile and repositories list. Your credentials and auth tokens are handled directly by Supabase Auth and are never exposed to or stored by our own application logs in plaintext.
            </p>
          </div>

          {/* Section 2 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /> 2. Repository Analysis & Code Ingestion</h2>
            <p className="text-justify">
              When you submit a repository URL for indexing, CodeForge clones the files main branch into a temporary workspace. Our scanner walks the directory, parses dependencies, abstracts circular symbol references, and computes vector representations (768 dimensions) using Google Gemini embedding APIs. 
            </p>
            <p className="text-justify mt-2">
              <strong>We do not retain raw source code files in permanent storage.</strong> All temporary directories are fully deleted as soon as code chunks are vectorized and secure analysis reports are compiled.
            </p>
          </div>

          {/* Section 3 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /> 3. Data Storage & Security</h2>
            <p className="text-justify">
              All parsed metadata (file structures, class signatures, security warning cards, circular reference locations, and chat session histories) is stored securely in our Supabase PostgreSQL database. Access to these tables is governed by strict PostgreSQL Row Level Security (RLS) policies, ensuring that only you (the authenticated GitHub user) can read or modify your scanned data.
            </p>
          </div>

          {/* Section 4 */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /> 4. User Deletion Rights</h2>
            <p className="text-justify">
              You retain absolute ownership and control over your repository statistics. Clicking the <strong>Delete Repository</strong> button in the dashboard executes a cascading deletion query inside PostgreSQL. This permanently wipes out all associated scans history, file indices, pgvector chunk embeddings, and chat thread messages instantly.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
