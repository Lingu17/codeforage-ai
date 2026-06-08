"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Layers, ArrowLeft, Clock, Check } from "lucide-react";
import Link from "next/link";

export default function ChangelogPage() {
  const releases = [
    {
      version: "v1.0.0",
      date: "June 2026",
      title: "Initial Production Release",
      badge: "Major Release",
      features: [
        "GitHub OAuth integration for secure user claiming and sessions.",
        "Repository Import supporting both raw git clone URLs and user repository listing.",
        "Interactive React Flow Architecture maps plotting file import hierarchies.",
        "Automated Security Audits auditing exposed credentials and circular import blocks.",
        "Weighted letter-grade Health Scores compiling architecture, security, maintainability, testing, and performance metrics.",
        "Context-aware Codebase Chat utilizing pgvector embedding chunks and citations."
      ]
    }
  ];

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
      <main className="max-w-3xl mx-auto px-6 pt-16 flex flex-col gap-12 text-left">
        <div>
          <Badge variant="outline" className="mb-4 border-purple-500/20 text-purple-400 bg-purple-500/5">Changelog</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Product Changelog</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Stay up to date with updates and technical releases for the CodeForge AI codebase intelligence platform.
          </p>
        </div>

        {/* Releases List */}
        <div className="flex flex-col gap-8">
          {releases.map((rel) => (
            <div key={rel.version} className="flex flex-col md:flex-row gap-6 items-start">
              {/* Date/Version Marker */}
              <div className="md:w-36 flex flex-row md:flex-col items-center md:items-start gap-2 shrink-0 font-mono">
                <span className="text-sm font-extrabold text-white">{rel.version}</span>
                <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {rel.date}</span>
              </div>

              {/* Release Details Card */}
              <Card className="flex-1 bg-zinc-900/30 border-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                  <h3 className="font-bold text-white text-base">{rel.title}</h3>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 font-mono text-[8px] uppercase">{rel.badge}</Badge>
                </div>
                <div className="h-px bg-white/5 mb-4" />
                <ul className="flex flex-col gap-3 font-sans text-xs text-zinc-400">
                  {rel.features.map((feat, i) => (
                    <li key={i} className="flex gap-2.5 items-start leading-relaxed">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
