"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Layers, ArrowLeft, Users, ShieldAlert, GitPullRequest, FileText, BarChart3, Radio } from "lucide-react";
import Link from "next/link";

export default function RoadmapPage() {
  const roadmapItems = [
    {
      title: "Team Workspaces & Shared Chats",
      desc: "Invite team members, run shared chat logs, compare codebase analysis notes across developers, and collaboratively review security reports.",
      icon: <Users className="w-5 h-5 text-primary" />,
      timeline: "Q3 2026",
      status: "Planned"
    },
    {
      title: "Private Repository Support",
      desc: "Secure OAuth tokens scope extensions to claim and run indexing scans on private GitHub/GitLab repositories with local codebase caches.",
      icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
      timeline: "Q3 2026",
      status: "Planned"
    },
    {
      title: "CI/CD Pipeline Audits Integration",
      desc: "GitHub Actions step to trigger security audits, token checks, and health scores changes evaluations on every pull request automatically.",
      icon: <GitPullRequest className="w-5 h-5 text-purple-400" />,
      timeline: "Q4 2026",
      status: "Planned"
    },
    {
      title: "AI Automated Release Notes",
      desc: "Generate structured, user-facing markdown release summaries and changelogs automatically on new tag cuts by analyzing merged pull request diffs.",
      icon: <FileText className="w-5 h-5 text-blue-400" />,
      timeline: "Q4 2026",
      status: "Planned"
    },
    {
      title: "Repository Comparison Charts",
      desc: "Compare file complexity logs, health scores, circular imports trends, and code maintainability metrics side-by-side across project packages.",
      icon: <BarChart3 className="w-5 h-5 text-emerald-400" />,
      timeline: "Q1 2027",
      status: "Planned"
    },
    {
      title: "Active Dependency Monitoring",
      desc: "Continuously scan package locks and third-party modules to flag outdated packages, vulnerability warnings, and license violations in real time.",
      icon: <Radio className="w-5 h-5 text-pink-400 animate-pulse" />,
      timeline: "Q1 2027",
      status: "Planned"
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
          <Badge variant="outline" className="mb-4 border-pink-500/20 text-pink-400 bg-pink-500/5">SaaS Roadmap</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Product Roadmap</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Our upcoming integrations focus on developer collaboration, CI/CD pipelines integration, and deeper security dependency tracking.
          </p>
        </div>

        {/* Roadmap Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roadmapItems.map((item, idx) => (
            <Card key={idx} className="bg-zinc-900/20 border-white/5 p-6 flex flex-col justify-between hover:border-white/10 transition-colors backdrop-blur-sm">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    {item.icon}
                  </div>
                  <div className="flex gap-1.5 font-mono text-[9px]">
                    <Badge variant="outline" className="border-zinc-800 text-zinc-500 uppercase">{item.timeline}</Badge>
                    <Badge className="bg-zinc-900 text-primary border-primary/20 uppercase font-semibold">{item.status}</Badge>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-white text-sm leading-relaxed">{item.title}</h3>
                  <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed text-justify">{item.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
