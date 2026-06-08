"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, MessageSquare, Send, Plus, 
  FileCode, Check, ShieldAlert, Sparkles, Terminal, X
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const queryId = searchParams.get("repo_id");
    const localId = localStorage.getItem("selected_repo_id");
    
    if (!queryId && localId) {
      router.replace(`${pathname}?repo_id=${localId}`);
      return;
    }
    
    const id = queryId || localId;
    if (!id) {
      setActiveRepoId(null);
      setLoading(false);
      return;
    }
    setActiveRepoId(id);
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (activeRepoId) {
      setSessions([]);
      setCurrentSessionId(null);
      setMessages([]);
      setError(false);
      setLoading(true);
      fetchSessions();
    }
  }, [activeRepoId]);

  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchSessions = async () => {
    if (!activeRepoId) return;
    setLoading(true);
    setError(false);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`http://127.0.0.1:8000/api/repos/${activeRepoId}/chat/sessions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        if (data.length > 0 && !currentSessionId) {
          setCurrentSessionId(data[0].id);
        }
      } else {
        setError(true);
      }
    } catch (e) {
      console.error("Error fetching chat sessions:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`http://127.0.0.1:8000/api/chat/sessions/${sessionId}/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error("Error fetching chat messages:", e);
    }
  };

  const handleStartNewSession = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending || !activeRepoId) return;

    const userMsg = inputMessage;
    setInputMessage("");
    setSending(true);

    // Optimistically add user message
    const tempUserMsg = {
      id: "temp-user",
      role: "user",
      content: userMsg,
      citations: [],
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`http://127.0.0.1:8000/api/repos/${activeRepoId}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMsg,
          session_id: currentSessionId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (!currentSessionId) {
          setCurrentSessionId(data.session_id);
          fetchSessions();
        } else {
          fetchMessages(currentSessionId);
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.filter(m => m.id !== "temp-user"));
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!loading && !activeRepoId) {
    return (
      <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen">
        <header className="h-16 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push("/dashboard")}
              className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 font-semibold text-lg">
              <MessageSquare className="w-5 h-5 text-primary" />
              <span>Codebase Chat</span>
            </div>
          </div>
        </header>
        <EmptyState 
          title="No Repository Connected" 
          description="Import a repository to start chatting and semantic querying." 
          action="Import Repository" 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-[#E5E7EB] bg-white z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push(`/dashboard`)}
            className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 font-semibold text-lg">
            <MessageSquare className="w-5 h-5 text-primary" />
            <span>Codebase Chat</span>
          </div>
        </div>
        
        <Button 
          onClick={handleStartNewSession}
          className="bg-primary hover:bg-primary/95 text-white text-xs gap-1.5 cursor-pointer font-semibold shadow-xs"
        >
          <Plus className="w-4 h-4" /> New Conversation
        </Button>
      </header>

      {/* Main Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Sessions List */}
        <aside className="w-64 border-r border-[#E5E7EB] bg-white flex flex-col hidden md:flex shrink-0">
          <div className="p-4 border-b border-[#E5E7EB]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Conversations</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {loading ? (
              <div className="flex flex-col gap-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 w-full bg-slate-50 border border-[#E5E7EB] rounded-lg" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-[#6B7280] text-center py-6 italic font-sans">No chats started.</p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-semibold transition-all truncate border cursor-pointer ${
                    currentSessionId === s.id 
                      ? "bg-slate-50 text-primary border-primary/20 shadow-xs" 
                      : "text-slate-600 hover:text-zinc-900 hover:bg-slate-50 border-transparent"
                  }`}
                >
                  {s.title}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right Side: Chat Console */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC] relative min-w-0">
          {/* Messages Flow */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 bg-[#F8FAFC] animate-pulse">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <h3 className="text-sm font-semibold text-zinc-850">Preparing embeddings...</h3>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-6 bg-[#F8FAFC]">
                <ShieldAlert className="w-12 h-12 text-rose-500 mb-4 opacity-70" />
                <h3 className="text-sm font-semibold text-[#111827]">Embeddings not generated yet.</h3>
                <p className="text-xs text-[#6B7280] max-w-xs mt-1.5 leading-relaxed font-sans text-center">
                  The RAG search system requires a completed repository analysis scan before chatting. Please wait for the scan to finish or retry.
                </p>
                <Button onClick={fetchSessions} variant="outline" size="sm" className="mt-4 border-[#E5E7EB] text-xs cursor-pointer font-bold bg-white">
                  Retry Loading Conversations
                </Button>
              </div>
            ) : messages.length === 0 && !sending ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-10 w-full">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-4 border border-primary/10 animate-pulse">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#111827]">Repository Intelligence Chat</h3>
                <p className="text-xs text-[#6B7280] mt-2 leading-relaxed max-w-md">
                  Query architectural imports, structural code components, security weaknesses, database layouts, or generate developer guides with vector citations.
                </p>
                
                {/* 8 Starter prompt cards */}
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                  {[
                    { label: "Explain Repository Structure", query: "Can you explain the overall repository structure and high-level folders?" },
                    { label: "Generate Onboarding Guide", query: "Please generate a developer onboarding and setup guide for this codebase." },
                    { label: "Find Authentication Flow", query: "Where is the authentication flow defined and how does it work?" },
                    { label: "Analyze Database Schema", query: "What is the database schema or structure and what models are used?" },
                    { label: "Find Security Risks", query: "Are there any obvious security risks or vulnerability patterns in the codebase?" },
                    { label: "Explain Dependencies", query: "What are the primary external dependencies and how are they used in this repo?" },
                    { label: "Review Technical Debt", query: "What are the primary technical debt issues or code smells in this project?" },
                    { label: "Generate Architecture Summary", query: "Can you generate a comprehensive architecture summary of this codebase?" }
                  ].map((card, i) => (
                    <button 
                      key={i}
                      type="button"
                      onClick={() => setInputMessage(card.query)}
                      className="p-3.5 bg-white border border-[#E5E7EB] rounded-xl text-left text-xs text-zinc-800 hover:border-primary hover:shadow-xs transition-all cursor-pointer font-semibold flex items-center justify-between group"
                    >
                      <span className="truncate pr-2">{card.label}</span>
                      <span className="text-primary text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">&rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
                {messages.map((m, idx) => {
                  const isUser = m.role === "user";
                  return (
                    <div 
                      key={m.id || idx} 
                      className={`flex flex-col max-w-[85%] ${
                        isUser ? "self-end items-end animate-in slide-in-from-bottom-2 duration-150" : "self-start items-start animate-in fade-in duration-200"
                      }`}
                    >
                      <div className={`p-4 rounded-2xl text-sm leading-relaxed border text-left ${
                        isUser 
                          ? "bg-primary border-primary text-white rounded-br-none shadow-xs font-semibold" 
                          : "bg-white border-[#E5E7EB] text-[#111827] rounded-bl-none shadow-xs font-normal font-sans"
                      }`}>
                        <div className="space-y-2 whitespace-pre-wrap">
                          {m.content}
                        </div>
                      </div>
                      
                      {/* Citations Badges */}
                      {!isUser && m.citations && m.citations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 items-center text-left">
                          <span className="text-[10px] text-[#6B7280] font-mono flex items-center gap-1 font-semibold">
                            <FileCode className="w-3 h-3 text-primary" /> Based on:
                          </span>
                          {m.citations.map((c: string, cIdx: number) => (
                            <Badge 
                              key={cIdx} 
                              variant="outline" 
                              className="bg-white hover:bg-slate-50 border-[#E5E7EB] text-[10px] text-[#6B7280] font-mono py-0.5 px-2 select-all cursor-pointer rounded-md shadow-2xs"
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Typing Loader */}
                {sending && (
                  <div className="self-start flex flex-col items-start max-w-[85%] animate-pulse">
                    <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] text-[#6B7280] rounded-bl-none flex items-center gap-2 shadow-xs">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <span className="text-xs font-mono">Gemini is searching chunks & reasoning...</span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Form Input */}
          <div className="p-6 border-t border-[#E5E7EB] bg-white shrink-0 z-10">
            <form 
              onSubmit={handleSendMessage}
              className="max-w-4xl mx-auto flex gap-3"
            >
              <input 
                type="text" 
                placeholder="Ask a question about the codebase (e.g. 'Where is the main API setup?')"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 bg-slate-50 border border-[#E5E7EB] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white text-zinc-900 placeholder:text-zinc-400"
                disabled={sending}
              />
              <Button 
                type="submit" 
                disabled={sending || !inputMessage.trim()}
                className="bg-primary hover:bg-primary/95 text-white h-11 px-5 rounded-xl cursor-pointer shadow-xs font-semibold"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
