"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layers, ArrowLeft, Calendar, Clock, ArrowRight, X, Sparkles, Database, Cpu, Network, Mail, GitFork, BookOpen } from "lucide-react";
import Link from "next/link";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryColor: string;
  icon: React.ReactNode;
  date: string;
  readTime: string;
  summary: string;
  fullOverview: string;
  keyInsights: string[];
}

export default function BlogPage() {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  const posts: BlogPost[] = [
    {
      id: "repo-intel-scale",
      title: "Repository Intelligence at Scale",
      slug: "repository-intelligence-at-scale",
      category: "Architecture Mapping",
      categoryColor: "text-primary border-primary/20 bg-primary/5",
      icon: <Network className="w-5 h-5 text-primary" />,
      date: "June 4, 2026",
      readTime: "8 min read",
      summary: "How CodeForge maps complex dependencies and file structures across large, multi-language codebases using FastAPI and abstract syntax tree parsers.",
      fullOverview: "Engineering legacy software introduces significant overhead, primarily due to circular import paths, undocumented call chains, and complex dependencies. To solve this, CodeForge AI builds dynamic syntax maps. This article explores how we map imports, parse class structures asynchronously in the FastAPI backend, and translate raw file paths into interactive React Flow representations. We outline our parsing architecture, how we solve circular dependency visualization, and how we handle symbol resolution across JavaScript, TypeScript, Python, and Go.",
      keyInsights: [
        "Asynchronous AST parsing pipelines reduce repository index time by over 60%.",
        "Circular import loops are dynamically detected using custom Tarjan strongly connected components algorithms.",
        "Interactive React Flow layouts translate nested module relations into human-scannable architectures."
      ]
    },
    {
      id: "ai-code-reviews",
      title: "Building AI-Powered Code Reviews",
      slug: "building-ai-powered-code-reviews",
      category: "AI Code Reviews",
      categoryColor: "text-purple-600 border-purple-250 bg-purple-50",
      icon: <GitFork className="w-5 h-5 text-purple-600" />,
      date: "May 30, 2026",
      readTime: "7 min read",
      summary: "Contextual prompt design and semantic Git diff auditing using Gemini Pro to check codebase vulnerability issues and performance smells.",
      fullOverview: "Automating pull request audits requires more than just general linting; it requires understanding the contextual modifications of code changes. In this piece, we detail how CodeForge AI structures contextual prompting patterns, maps code diff payloads to LLM windows, and uses Gemini Pro to run deep, lead-engineer level code reviews for security flaws and performance smells.",
      keyInsights: [
        "Contextual prompting inputs class structures around git diff lines to preserve local syntax logic.",
        "Automated PR reviews pinpoint security leaks, exposed tokens, and SQL injections instantly.",
        "Semantic diff auditing reduces human peer review load, speeding up PR merges."
      ]
    },
    {
      id: "optimizing-pgvector-search",
      title: "Optimizing pgvector for Source Code Search",
      slug: "optimizing-pgvector-for-source-code-search",
      category: "Database & RAG",
      categoryColor: "text-blue-600 border-blue-200 bg-blue-50/60",
      icon: <Database className="w-5 h-5 text-blue-600" />,
      date: "May 15, 2026",
      readTime: "11 min read",
      summary: "Lessons learned from building CodeForge AI's search engine: partitioning postgres schemas, tuning HNSW parameters, and scaling semantic RAG queries.",
      fullOverview: "Retrieving relevant code blocks across thousands of source files is incredibly challenging due to syntax density. CodeForge AI uses pgvector to index 768-dimensional embeddings of parsed code chunks. We dive into the specific Postgres indexes we built, our experiences tuning Hierarchical Navigable Small World (HNSW) graphs, and why combining classic BM25 keyword matching with vector cosine similarity results in far more accurate code search queries.",
      keyInsights: [
        "Tuning pgvector HNSW parameters (m=16, ef_construction=64) balanced search precision and index velocity.",
        "Hybrid search (BM25 + Cosine Distance) ensures exact function name queries match alongside semantic conceptual queries.",
        "Schema partitioning based on Repository ID keeps search queries isolated and sub-millisecond fast."
      ]
    },
    {
      id: "architecture-mapping-static-analysis",
      title: "Architecture Mapping with Static Analysis",
      slug: "architecture-mapping-with-static-analysis",
      category: "Static Analysis",
      categoryColor: "text-pink-600 border-pink-200 bg-pink-50/65",
      icon: <Layers className="w-5 h-5 text-pink-600" />,
      date: "May 10, 2026",
      readTime: "9 min read",
      summary: "Resolving dynamic import statements and detecting dependency cycles in large software codebases using custom AST scanners.",
      fullOverview: "Undocumented dependency cycles and nested imports degrade codebase maintainability. CodeForge AI uses static analysis scanners to resolve dynamic imports and trace circular paths in source files. This post covers the design of our cyclic path detection, our import resolving algorithms, and how we map complex dependency paths dynamically.",
      keyInsights: [
        "Resolving dynamic import statements uncovers hidden dependency paths and imports.",
        "Cyclic dependency chains are mathematically detected using Tarjan's strongly connected components algorithm.",
        "Mapping directory paths reveals file clustering and local architectural anomalies."
      ]
    },
    {
      id: "ai-powered-developer-onboarding",
      title: "AI-Powered Developer Onboarding",
      slug: "ai-powered-developer-onboarding",
      category: "Onboarding & Q&A",
      categoryColor: "text-emerald-650 border-emerald-200 bg-emerald-50",
      icon: <Cpu className="w-5 h-5 text-emerald-650" />,
      date: "May 02, 2026",
      readTime: "6 min read",
      summary: "Using contextual codebase indexing and RAG-driven models to synthesize folder layouts and generate developer onboarding walkthroughs.",
      fullOverview: "Onboarding developers to a new repository traditionally takes weeks of manual explanation. CodeForge AI automates this process by indexing code chunk embeddings and synthesizing structured codebase guides. We share our RAG-driven QA models, onboarding walkthrough generation pipelines, and case studies proving new developer time-to-first-commit speed increases.",
      keyInsights: [
        "Contextual codebase indexing maps directory roles, API modules, and config settings.",
        "RAG-driven QA models generate onboarding guides with direct file citations.",
        "Walkthrough engines draft interactive system flow maps for new engineering hires."
      ]
    }
  ];

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      setNewsletterSubscribed(true);
      setNewsletterEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 relative flex flex-col justify-between overflow-hidden font-sans pb-16">
      {/* Background Gradients */}
      <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-zinc-100/40 to-background pointer-events-none -z-10" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none -z-10" />
      <div className="absolute top-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[128px] pointer-events-none -z-10" />

      {/* Header */}
      <nav className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
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
      <main className="max-w-5xl mx-auto px-6 flex-1 pt-12 flex flex-col gap-10 text-left w-full">
        <div className="flex flex-col gap-3">
          <Badge variant="outline" className="w-fit border-primary/20 text-primary bg-primary/5">
            Publications & Technical Writing
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 font-sans">Engineering Blog</h1>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl font-sans">
            In-depth guides, architectural analyses, and engineering lessons from building CodeForge AI's code indexing and RAG systems.
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Card key={post.id} className="bg-white border-border shadow-sm flex flex-col justify-between hover:border-zinc-350 transition-all duration-300">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <Badge variant="outline" className={`text-[10px] py-0.5 px-2 font-semibold ${post.categoryColor}`}>
                    {post.category}
                  </Badge>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="bg-slate-100 border-none text-[9px] text-[#6B7280] font-mono font-bold px-1.5 py-0.5 rounded">
                      Coming Soon
                    </Badge>
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-border flex items-center justify-center">
                      {post.icon}
                    </div>
                  </div>
                </div>
                <CardTitle className="text-base text-zinc-900 font-bold tracking-tight line-clamp-2 min-h-[48px]">
                  {post.title}
                </CardTitle>
                <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-mono mt-2">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime}</span>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 flex flex-col gap-4">
                <CardDescription className="text-zinc-500 text-xs leading-relaxed line-clamp-3">
                  {post.summary}
                </CardDescription>
                <Button 
                  onClick={() => setSelectedPost(post)} 
                  variant="ghost" 
                  size="sm" 
                  className="w-fit p-0 h-auto text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer font-bold text-xs mt-2"
                >
                  Read Summary <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Newsletter Callout */}
        <div className="border-t border-border pt-10 mt-6">
          <Card className="bg-white border-border p-6 md:p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
            <div className="text-left flex flex-col gap-1 max-w-md">
              <h3 className="font-bold text-zinc-800 text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Subscribe to Updates
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Stay updated on platform engineering updates, technical articles, and pgvector performance checklists. No spam, ever.
              </p>
            </div>
            
            <form onSubmit={handleSubscribe} className="flex gap-2 w-full md:w-auto shrink-0 max-w-sm">
              {newsletterSubscribed ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-2.5 rounded-lg text-xs font-semibold w-full text-center">
                  Successfully Subscribed!
                </div>
              ) : (
                <>
                  <input 
                    type="email" 
                    required 
                    placeholder="name@company.com" 
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="bg-white border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900 flex-1 md:w-56"
                  />
                  <Button type="submit" size="sm" className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs h-9 px-4 cursor-pointer shadow-sm">
                    Subscribe
                  </Button>
                </>
              )}
            </form>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-zinc-400 text-[10px] border-t border-border mt-16">
        &copy; {new Date().getFullYear()} CodeForge AI. All rights reserved.
      </footer>

      {/* Article Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white border border-border rounded-2xl w-full max-w-xl p-6 shadow-2xl flex flex-col gap-6 text-left animate-in fade-in zoom-in-95 duration-200 font-sans max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className={`w-fit text-[9px] py-0.5 px-2 font-semibold ${selectedPost.categoryColor}`}>
                  {selectedPost.category}
                </Badge>
                <h3 className="text-lg font-bold text-zinc-900 mt-1 leading-snug">
                  {selectedPost.title}
                </h3>
                <div className="flex items-center gap-4 text-[10px] text-zinc-400 font-mono mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {selectedPost.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedPost.readTime}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPost(null)}
                className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-px bg-border" />

            <div className="flex flex-col gap-4 text-xs leading-relaxed text-zinc-650">
              <div>
                <span className="block font-bold text-zinc-800 mb-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">Overview</span>
                <p className="text-zinc-500 leading-relaxed">{selectedPost.fullOverview}</p>
              </div>

              <div className="mt-2">
                <span className="block font-bold text-zinc-800 mb-2 font-mono text-[10px] uppercase tracking-wider text-primary">Key Engineering Insights</span>
                <ul className="flex flex-col gap-2">
                  {selectedPost.keyInsights.map((insight, idx) => (
                    <li key={idx} className="flex gap-2 items-start bg-zinc-50 p-2.5 rounded-lg border border-border">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-zinc-650">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-border pt-4 mt-2">
              <span className="text-[10px] text-zinc-400 font-mono italic">Full article release: Coming Q3 2026</span>
              <Button 
                onClick={() => {
                  setSelectedPost(null);
                  setNewsletterSubscribed(false);
                }}
                className="bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold px-4 h-8 cursor-pointer shadow-sm rounded-lg"
              >
                Close Summary
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
