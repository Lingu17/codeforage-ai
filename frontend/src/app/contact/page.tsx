"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Layers, ArrowLeft, Mail, MessageSquare } from "lucide-react";
import Link from "next/link";

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

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("sending");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSubmitStatus("success");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        setSubmitStatus("error");
      }
    } catch {
      setSubmitStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 relative overflow-x-hidden font-sans pb-20">
      {/* Background Gradients */}
      <div className="absolute top-0 inset-x-0 h-screen bg-gradient-to-b from-zinc-100/40 to-background pointer-events-none -z-10" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none -z-10" />
      <div className="absolute top-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-[128px] pointer-events-none -z-10" />

      {/* Header */}
      <nav className="border-b border-border bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tighter text-zinc-900 hover:opacity-90">
            <Layers className="w-5 h-5 text-primary" />
            CodeForge<span className="text-zinc-550 font-medium">AI</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 cursor-pointer text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 pt-16 flex flex-col md:flex-row gap-12 text-left items-start">
        {/* Left Side: Text and Social details */}
        <div className="flex-1 flex flex-col gap-6">
          <div>
            <Badge variant="outline" className="mb-4 border-indigo-200 text-indigo-650 bg-indigo-50">Contact Us</Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-4">Get in Touch</h1>
            <p className="text-sm text-zinc-550 leading-relaxed">
              Have questions about repository security audits, parsing support for other languages, or deploying CodeForge AI in your team workspaces? Send us a message and we'll reply as soon as possible.
            </p>
          </div>

          <div className="flex flex-col gap-4 font-mono text-xs text-zinc-500 mt-4">
            <div className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl shadow-sm">
              <Mail className="w-5 h-5 text-primary shrink-0" />
              <div>
                <span className="text-zinc-800 block font-sans font-bold">Email Support</span>
                <a href="mailto:lingrajmalipatil1@gmail.com" className="hover:text-zinc-900 hover:underline transition-colors mt-0.5 block">
                  lingrajmalipatil1@gmail.com
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl shadow-sm">
              <GithubIcon className="w-5 h-5 text-zinc-650 shrink-0" />
              <div>
                <span className="text-zinc-800 block font-sans font-bold">Founder GitHub</span>
                <a href="https://github.com/Lingu17" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 hover:underline transition-colors mt-0.5 block">
                  github.com/Lingu17
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white border border-border rounded-xl shadow-sm">
              <LinkedinIcon className="w-5 h-5 text-indigo-655 shrink-0" />
              <div>
                <span className="text-zinc-800 block font-sans font-bold">Founder LinkedIn</span>
                <a href="https://linkedin.com/in/lingraj-malipatil-a2735a241" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 hover:underline transition-colors mt-0.5 block">
                  linkedin.com/in/lingraj-malipatil-a2735a241
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Contact Form */}
        <div className="w-full md:w-[450px]">
          <Card className="bg-white border-border p-6 backdrop-blur-sm shadow-md">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-primary" /> Send Message</h3>
              <div className="h-px bg-border mb-2" />

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-zinc-400">Your Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="John Doe" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-zinc-400">Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="john@example.com" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-zinc-400">Subject</label>
                <input 
                  type="text" 
                  required
                  placeholder="Inquiry about workspaces" 
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-zinc-400">Message</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Write your message here..." 
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="bg-zinc-50 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-zinc-900"
                />
              </div>

              {submitStatus === "success" && (
                <span className="text-[10px] text-emerald-600 font-mono font-semibold">Your message has been submitted successfully! We will contact you soon.</span>
              )}
              {submitStatus === "error" && (
                <span className="text-[10px] text-rose-600 font-mono font-semibold">Failed to submit message. Please try again.</span>
              )}

              <Button 
                type="submit" 
                disabled={submitStatus === "sending"}
                className="bg-primary hover:bg-primary/90 text-white h-9 text-xs font-semibold cursor-pointer w-full mt-2 shadow-sm rounded-lg"
              >
                {submitStatus === "sending" ? "Sending..." : "Submit Message"}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
