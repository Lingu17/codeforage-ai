"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { ComingSoonModal } from "@/components/ComingSoonModal";

export default function PricingPage() {
  const [modalOpen, setModalOpen] = useState(false);

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
      <main className="max-w-5xl mx-auto px-6 pt-16 flex flex-col gap-12 text-center">
        <div className="max-w-2xl mx-auto">
          <Badge variant="outline" className="mb-4 border-primary/20 text-primary bg-primary/5">Pricing Plans</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Flexible Plans for Every Developer</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Select a plan that fits your repository intelligence requirements. Paid plans and team workspace features are currently in beta.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full mt-4">
          {/* Free Plan */}
          <Card className="bg-zinc-900/30 border-white/5 p-6 flex flex-col justify-between text-left hover:border-white/10 transition-all">
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500">Free Starter</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-white font-mono">$0</span>
                  <span className="text-[10px] text-zinc-500">/month</span>
                </div>
                <p className="text-xs text-zinc-400 mt-2 min-h-[35px]">Perfect for exploring repository summaries and testing out basic audits.</p>
              </div>
              <div className="h-px bg-white/5" />
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>3 Public Repositories</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Basic File Dependency Graphs</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>20 AI Chat Messages/day</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Standard Security Audit</span>
                </li>
              </ul>
            </div>
            <Button 
              onClick={() => setModalOpen(true)}
              className="w-full mt-8 bg-zinc-800 text-white hover:bg-zinc-700 font-semibold text-xs h-9 cursor-pointer"
            >
              Get Started
            </Button>
          </Card>

          {/* Pro Plan */}
          <Card className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-primary/50 p-6 flex flex-col justify-between text-left scale-105 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground font-mono text-[8px] uppercase tracking-wider font-bold py-1 px-3 rounded-bl">
              Popular
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-primary flex items-center gap-1"><Sparkles className="w-3 h-3" /> Pro Developer</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-white font-mono">$19</span>
                  <span className="text-[10px] text-zinc-500">/month</span>
                </div>
                <p className="text-xs text-zinc-400 mt-2 min-h-[35px]">For active developers needing deep codebase chat and advanced reviews.</p>
              </div>
              <div className="h-px bg-white/5" />
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>15 Public & Private Repos</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Full Interactive React Flow Graph</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Unlimited AI RAG Chat</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Advanced Security & circular import audits</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>PR Review agent access</span>
                </li>
              </ul>
            </div>
            <Button 
              onClick={() => setModalOpen(true)}
              className="w-full mt-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 cursor-pointer"
            >
              Upgrade to Pro
            </Button>
          </Card>

          {/* Enterprise Plan */}
          <Card className="bg-zinc-900/30 border-white/5 p-6 flex flex-col justify-between text-left hover:border-white/10 transition-all">
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500">Enterprise</span>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-white font-mono">Custom</span>
                </div>
                <p className="text-xs text-zinc-400 mt-2 min-h-[35px]">For engineering organizations requiring custom SLA limits and integrations.</p>
              </div>
              <div className="h-px bg-white/5" />
              <ul className="flex flex-col gap-2">
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Unlimited Repositories</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Team Workspaces & Shared Chats</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>CI/CD Autocomplete actions integration</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-zinc-300">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Custom LLM hosting SLA support</span>
                </li>
              </ul>
            </div>
            <Button 
              onClick={() => setModalOpen(true)}
              className="w-full mt-8 bg-zinc-800 text-white hover:bg-zinc-700 font-semibold text-xs h-9 cursor-pointer"
            >
              Contact Sales
            </Button>
          </Card>
        </div>
      </main>

      {/* Waitlist modal */}
      <ComingSoonModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
