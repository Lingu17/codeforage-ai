"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, MessageSquare, Send, Plus, Square,
  FileCode, Check, ShieldAlert, Sparkles, X, Menu, Copy, RotateCcw
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApiUrl } from "@/utils/api";

type StreamMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: string[];
  created_at: string;
  error?: string;
  streaming?: boolean;
};

type ChatSession = {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
};

type ChatStatus = "idle" | "submitting" | "streaming" | "completed" | "error" | "cancelled";

/**
 * Incrementally parses Server-Sent Events from an arbitrary byte stream.
 *
 * Handles:
 *  - frames split arbitrarily across network chunks (including across the
 *    `\n\n` terminator and even mid-word)
 *  - multi-line `data:` payloads (markdown)
 *  - both standard (`event:` first) and the legacy (`data:` first) framing
 *  - UTF-8 multi-byte characters split across chunk boundaries (std::flush)
 *
 * `feed(chunk, flush)` appends a decoded chunk; when `flush` is true the
 * remaining partial frame is processed as a complete event (valuable when the
 * stream ends without a trailing blank line).
 */
function createSSEParser(onEvent: (event: string, data: string[]) => void) {
  let buffer = "";
  const decoder = new TextDecoder();

  const processBlock = (block: string) => {
    const lines = block.split("\n");
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim().replace(/^ +| +$/g, "");
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
      else if (line.trim() === "" || line.startsWith(":")) continue; // keepalive/comment
    }
    if (dataLines.length > 0) onEvent(event, dataLines);
  };

  return {
    feed(chunk: Uint8Array, flush = false) {
      buffer += decoder.decode(chunk, { stream: !flush });
      if (flush) {
        if (buffer.trim() !== "") processBlock(buffer);
        buffer = "";
        return;
      }
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const block of parts) {
        if (block.trim() !== "") processBlock(block);
      }
    },
  };
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StreamMsg[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  // Synchronous in-flight guard. React state (chatStatus) is only observable
  // after a re-render, so a rapid second activation (double click / Enter+click)
  // could slip past the state-based guard and fire a duplicate POST. A ref is
  // visible to every handler invocation immediately, guaranteeing exactly one
  // request per user submission regardless of render timing.
  const sendingRef = useRef(false);
  // Monotonic token so a slow /messages response from a previously selected
  // conversation can never overwrite the currently viewed conversation.
  const messagesLoadRef = useRef(0);

  useEffect(() => {
    // Intentional: sync activeRepoId to the URL/localStorage source of truth
    // when the router param changes. This is a one-time external-sync init,
    // not derived render state, so synchronous setState here is correct.
    /* eslint-disable react-hooks/set-state-in-effect */
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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams, pathname, router]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    if (messages.length || chatStatus === "streaming") {
      scrollToBottom();
    }
  }, [messages, chatStatus, scrollToBottom]);

  const fetchSessions = useCallback(async (): Promise<ChatSession[] | null> => {
    if (!activeRepoId) return null;
    setError(false);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/api/repos/${activeRepoId}/chat/sessions`), { headers });
      if (res.ok) {
        const data = (await res.json()) as ChatSession[];
        setSessions(data || []);
        return data || [];
      }
      setError(true);
    } catch (e) {
      console.error("Error fetching chat sessions:", e);
      setError(true);
    }
    return null;
  }, [activeRepoId]);

  const fetchMessages = useCallback(async (sessionId: string) => {
    // Only apply the result if this is still the active conversation; a slow
    // /messages response from a previously selected conversation must never
    // overwrite the messages of the one the user is currently viewing.
    const loadId = ++messagesLoadRef.current;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/api/chat/sessions/${sessionId}/messages`), { headers });
      if (messagesLoadRef.current !== loadId) return; // superseded by a newer load
      if (res.ok) {
        const data = await res.json();
        setMessages((data || []).map((m: { id: string; role: string; content: string; citations?: string[]; created_at: string }) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
          citations: m.citations || [],
          created_at: m.created_at,
        })));
      }
    } catch (e) {
      console.error("Error fetching chat messages:", e);
    } finally {
      if (messagesLoadRef.current === loadId) messagesLoadRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!activeRepoId) return;
    // Intentional: reset conversation state when the repository changes so we
    // never mix conversations across repos. This is a one-time external-sync
    // reset tied to activeRepoId, so synchronous setState is correct here.
    /* eslint-disable react-hooks/set-state-in-effect */
    abortRef.current?.abort();
    activeRequestIdRef.current = null;
    setSessions([]);
    setMessages([]);
    setError(false);
    setChatStatus("idle");
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    (async () => {
      const data = await fetchSessions();
      if (data && data.length > 0 && data[0].id) {
        setCurrentSessionId(data[0].id);
        fetchMessages(data[0].id);
      }
      setLoading(false);
    })();
  }, [activeRepoId, fetchSessions, fetchMessages]);

  const handleStartNewSession = () => {
    abortRef.current?.abort();
    activeRequestIdRef.current = null;
    setCurrentSessionId(null);
    setMessages([]);
    setChatStatus("idle");
  };

  const submitStream = useCallback(async (text: string, opts?: { requestId?: string; reuseUser?: boolean }) => {
    if (!activeRepoId || !text.trim()) return;
    // Guard against duplicate submissions (double click / Enter + button).
    // The synchronous ref prevents a second request even when a repeat event
    // fires before React re-renders (when chatStatus would otherwise be stale).
    if (sendingRef.current || chatStatus === "submitting" || chatStatus === "streaming") return;
    sendingRef.current = true;

    // Idempotency: a retry of the SAME question reuses the original request_id
    // and the already-persisted user message row, so neither the backend nor the
    // DB ever sees a duplicate (one submit -> one user + one assistant row).
    const requestId = opts?.requestId || uuid();
    activeRequestIdRef.current = requestId;
    const reuseUser = !!opts?.reuseUser;
    const userMsg: StreamMsg = {
      id: `user-${requestId}`,
      role: "user",
      content: text,
      citations: [],
      created_at: new Date().toISOString(),
    };
    const assistantId = `assistant-${requestId}`;
    const assistantMsg: StreamMsg = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      created_at: new Date().toISOString(),
      streaming: true,
    };

    // Single source of truth: append exactly once, then stream into this row.
    setMessages((prev) =>
      reuseUser ? [...prev, assistantMsg] : [...prev, userMsg, assistantMsg]
    );
    setChatStatus("submitting");

    const controller = new AbortController();
    abortRef.current = controller;

    // No request may hang forever. Hard ceiling ensures the lock always
    // releases and the UI never stays "pending". The stream-facing timeout is
    // generous to the provider but bounded so we can never block re-sending.
    const timeoutMs = 90000;
    const timeout = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

    const isCurrent = () => activeRequestIdRef.current === requestId;
    let reply = "";

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(getApiUrl(`/api/repos/${activeRepoId}/chat/stream`), {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          session_id: currentSessionId,
          request_id: requestId,
        }),
      });

      if (!res.ok || !res.body) {
        let friendly = "Unable to generate a response right now.";
        try {
          const j = await res.json();
          if (j.detail) friendly = typeof j.detail === "string" ? j.detail : friendly;
        } catch {}
        if (isCurrent()) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, streaming: false, error: friendly, content: "" } : m
            )
          );
          setChatStatus("error");
        }
        return;
      }

      setChatStatus("streaming");

      const reader = res.body.getReader();
      let gotSessionId = currentSessionId;
      let assistantCitations: string[] = [];

      const parser = createSSEParser((event, dataLines) => {
        if (!isCurrent()) return;
        const jsonData = dataLines.join("\n");

        if (event === "delta") {
          // Deltas are plain text. Newlines may be split across multiple
          // `data:` lines, so rejoin with newlines to preserve markdown.
          reply += jsonData;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: reply } : m))
          );
          return;
        }

        if (event === "start") {
          try {
            const j = JSON.parse(jsonData);
            if (j.session_id) gotSessionId = j.session_id;
            if (j.citations) assistantCitations = j.citations;
            if (!currentSessionId && j.session_id) setCurrentSessionId(j.session_id);
          } catch {}
          return;
        }

        if (event === "error") {
          let friendly = "Unable to generate a response right now.";
          try {
            const j = JSON.parse(jsonData);
            friendly = j.message || friendly;
          } catch {}
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, streaming: false, error: friendly, content: m.content || "" }
                : m
            )
          );
          setChatStatus("error");
          return;
        }

        if (event === "done") {
          try {
            const j = JSON.parse(jsonData);
            gotSessionId = j.session_id || gotSessionId;
            if (j.citations && Array.isArray(j.citations)) assistantCitations = j.citations;
            if (j.content) reply = j.content;
            if (j.session_id && !currentSessionId) setCurrentSessionId(j.session_id);
          } catch {}
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, streaming: false, content: reply || m.content, citations: assistantCitations }
                : m
            )
          );
          setChatStatus("completed");
        }
      });

      // Read + parse. On a clean stream end we flush any trailing partial frame
      // so the final tokens are never lost.
      for (;;) {
        const { value } = await reader.read();
        if (!value) break;
        parser.feed(value, false);
      }
      parser.feed(new Uint8Array(), true);

      if (isCurrent()) {
        // Belt-and-suspenders: if no terminal event arrived (e.g. the stream
        // closed early), still finalize so we never leave a stuck spinner.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, content: reply || m.content, citations: assistantCitations }
              : m
          )
        );
        if (chatStatus !== "error") setChatStatus("completed");
        if (gotSessionId && gotSessionId !== currentSessionId) {
          setCurrentSessionId(gotSessionId);
          fetchSessions();
        }
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      const timedOut = err?.message === "timeout";
      const aborted = err?.name === "AbortError" && !timedOut;
      if (isCurrent()) {
        if (aborted) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
          );
          setChatStatus("cancelled");
          return;
        }
        const friendly = timedOut
          ? "Generation is taking longer than expected. Please try again."
          : "Unable to generate a response right now.";
        console.error(e);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, error: friendly, content: reply }
              : m
          )
        );
        setChatStatus("error");
      }
    } finally {
      clearTimeout(timeout);
      if (abortRef.current === controller) {
        abortRef.current = null;
        activeRequestIdRef.current = null;
      }
      sendingRef.current = false;
    }
  }, [activeRepoId, currentSessionId, fetchSessions, chatStatus]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;
    if (sendingRef.current || chatStatus === "submitting" || chatStatus === "streaming") return;
    setInputMessage("");
    submitStream(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleRetry = () => {
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.error) {
      // Find the preceding user message and re-send. Reuse the original
      // request_id + user row so one submit always means exactly one user
      // message (deduped end-to-end, even across backend restarts).
      const userMsg = [...messages].reverse().find((m) => m.role === "user");
      if (userMsg) {
        const retryId = userMsg.id.startsWith("user-") ? userMsg.id.slice("user-".length) : undefined;
        setMessages((prev) => prev.filter((m) => m.role !== "assistant" || !m.error));
        setChatStatus("idle");
        submitStream(userMsg.content, { requestId: retryId, reuseUser: true });
      }
    }
  };

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const streamingActive = chatStatus === "submitting" || chatStatus === "streaming";

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] text-[#111827] min-h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 sm:px-8 border-b border-[#E5E7EB] bg-white z-10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push(`/dashboard`)}
            className="text-[#6B7280] hover:text-[#111827] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <button
            type="button"
            onClick={() => setShowSessionsDrawer(true)}
            className="md:hidden p-1.5 border border-[#E5E7EB] hover:bg-slate-50 text-zinc-650 hover:text-zinc-900 rounded transition-colors cursor-pointer"
            aria-label="View Conversations"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          <div className="flex items-center gap-2 font-semibold text-sm sm:text-lg">
            <MessageSquare className="w-4.5 h-4.5 text-primary" />
            <span>Codebase Chat</span>
          </div>
        </div>
        
        <Button 
          onClick={handleStartNewSession}
          disabled={!!streamingActive}
          className="bg-primary hover:bg-primary/95 text-white text-xs gap-1.5 cursor-pointer font-semibold shadow-xs h-9 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Conversation</span>
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
                  onClick={() => {
                    if (streamingActive) return;
                    setCurrentSessionId(s.id);
                    fetchMessages(s.id);
                  }}
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
                <h3 className="text-sm font-semibold text-zinc-850">Loading conversations...</h3>
              </div>
            ) : error && messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-6 bg-[#F8FAFC]">
                <ShieldAlert className="w-12 h-12 text-rose-500 mb-4 opacity-70" />
                <h3 className="text-sm font-semibold text-[#111827]">Could not load conversations.</h3>
                <p className="text-xs text-[#6B7280] max-w-xs mt-1.5 leading-relaxed font-sans text-center">
                  There was a problem reaching the backend. Please try again.
                </p>
                <Button onClick={fetchSessions} variant="outline" size="sm" className="mt-4 border-[#E5E7EB] text-xs cursor-pointer font-bold bg-white">
                  Retry Loading Conversations
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-10 w-full">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center mb-4 border border-primary/10 animate-pulse">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#111827]">Repository Intelligence Chat</h3>
                <p className="text-xs text-[#6B7280] mt-2 leading-relaxed max-w-md">
                  Query architectural imports, structural code components, security weaknesses, database layouts, or generate developer guides with vector citations.
                </p>
                
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
                      onClick={() => { setInputMessage(""); submitStream(card.query); }}
                      disabled={!!streamingActive}
                      className="p-3.5 bg-white border border-[#E5E7EB] rounded-xl text-left text-xs text-zinc-800 hover:border-primary hover:shadow-xs transition-all cursor-pointer font-semibold flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
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
                          {m.streaming ? (
                            m.content ? (
                              <>
                                {m.content}
                                <span className="inline-block w-2 h-4 bg-primary/60 align-text-bottom animate-pulse ml-0.5" />
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-2 text-[#6B7280] font-mono text-xs">
                                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                                Analyzing repository...
                              </span>
                            )
                          ) : m.error ? (
                            <span className="text-[#B45309]">{m.error}</span>
                          ) : (
                            m.content
                          )}
                        </div>
                      </div>
                      
                      {!isUser && !m.streaming && m.content && (
                        <div className="mt-2 flex flex-wrap gap-2 items-center text-left">
                          <button 
                            onClick={() => copyMessage(m.content, m.id)}
                            className="flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#111827] font-mono cursor-pointer font-semibold"
                            aria-label="Copy answer"
                          >
                            {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            {copiedId === m.id ? "Copied" : "Copy"}
                          </button>
                          <span className="text-[10px] text-[#B45309] font-mono flex items-center gap-1 font-semibold">
                            <FileCode className="w-3 h-3" /> Based on:
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

                      {!isUser && !m.streaming && m.error && (
                        <Button 
                          onClick={handleRetry}
                          variant="outline" 
                          size="sm" 
                          className="mt-2 border-[#E5E7EB] text-xs gap-1.5 cursor-pointer font-bold bg-white"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry
                        </Button>
                      )}
                    </div>
                  );
                })}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Form Input */}
          <div className="p-6 border-t border-[#E5E7EB] bg-white shrink-0 z-10">
            <form 
              onSubmit={handleSend}
              className="max-w-4xl mx-auto flex gap-3 items-end"
            >
              <textarea 
                placeholder="Ask a question about the codebase (Enter to send, Shift+Enter for newline)"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex-1 bg-slate-55 border border-[#E5E7EB] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white text-zinc-900 placeholder:text-zinc-400 resize-none"
                disabled={!!streamingActive}
              />
              {streamingActive ? (
                <Button 
                  type="button" 
                  onClick={handleStop}
                  className="bg-rose-600 hover:bg-rose-500 text-white h-11 px-5 rounded-xl cursor-pointer shadow-xs font-semibold"
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={!inputMessage.trim()}
                  className="bg-primary hover:bg-primary/95 text-white h-11 px-5 rounded-xl cursor-pointer shadow-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Mobile Conversations Drawer Overlay */}
      {showSessionsDrawer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden flex justify-start animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowSessionsDrawer(false)} />
          <div className="relative w-64 h-full border-r border-[#E5E7EB] bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-250">
            <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Conversations</span>
              <button 
                type="button"
                onClick={() => setShowSessionsDrawer(false)} 
                className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-900 transition-colors border border-[#E5E7EB] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {sessions.length === 0 ? (
                <p className="text-xs text-[#6B7280] text-center py-6 italic font-sans">No chats started.</p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (streamingActive) return;
                      setCurrentSessionId(s.id);
                      setShowSessionsDrawer(false);
                      fetchMessages(s.id);
                    }}
                    className={`w-full text-left p-3 rounded-xl text-xs font-semibold transition-all truncate border cursor-pointer ${
                      currentSessionId === s.id 
                        ? "bg-slate-50 text-primary border-primary/20 shadow-xs animate-in fade-in" 
                        : "text-slate-600 hover:text-zinc-900 hover:bg-slate-50 border-transparent"
                    }`}
                  >
                    {s.title}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
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
