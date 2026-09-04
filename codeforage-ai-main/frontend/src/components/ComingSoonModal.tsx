"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, X, Mail } from "lucide-react";
import { useState } from "react";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComingSoonModal({ isOpen, onClose }: ComingSoonModalProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div 
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5 text-left relative animate-in fade-in zoom-in-95 duration-200 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-white">Coming Soon</h3>
        </div>

        <div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Thank you for your interest in CodeForge AI.
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed mt-2">
            Subscriptions, paid plans, team workspaces, advanced repository analysis, and enterprise features are currently under development.
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed mt-2">
            Join the waitlist and we will notify you when they become available.
          </p>
        </div>

        {submitted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
            <span className="text-xs text-emerald-400 font-medium">🎉 You&apos;ve been successfully added to the waitlist!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input 
              type="email" 
              required
              placeholder="Enter your email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-white"
            />
            <Button 
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 px-4 shrink-0 cursor-pointer"
            >
              Notify Me
            </Button>
          </form>
        )}

        <div className="flex justify-end border-t border-white/5 pt-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="text-zinc-400 hover:text-white cursor-pointer h-9 px-4 text-xs font-semibold"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
