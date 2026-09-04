"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Loader2, ArrowLeft, MessageSquare, Send, Plus, Square,
  ShieldAlert, Sparkles, X, Menu, ArrowDown,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApiUrl } from "@/utils/api";
import MessageBubble, { type StreamMessage } from "@/components/chat/MessageBubble";

type ChatSession = {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
};

type ChatStatus = "idle" | "submitting" | "streaming" | "completed" | "error" | "cancelled";

const SCROLL_PIN_THRESHOLD = 96;

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

function normalizeMessage(m: { id: string; role: string; content: string; citations?: string[]; created_at: string }): StreamMessage {
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    citations: m.citations || [],
    created_at: m.created_at,
  };
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
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showSessionsDrawer, setShowSessionsDrawer] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatStatus, setChatStatus] = useState<ChatStatus>("idle");
  const [nearBottom, setNearBottom] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  // Monotonic token so a slow /messages response from a previously selected
  // conversation can never overwrite the currently viewed conversation.
  const messagesLoadRef = useRef(0);
  // Per-session message cache so switching conversations is instant (network
  // is only used to refresh in the background). In-flight tracking prevents a
  // double click from firing two requests for the same session.
  const messagesCacheRef = useRef<Map<string, StreamMessage[]>>(new Map());
  const messagesLoadingRef = useRef<string | null>(null);
  // Mirrors of render state, read by stable async callbacks.
  const messagesRef = useRef<StreamMessage[]>([]);
  const currentSessionIdRef = useRef<string | null>(null);
  // Scroll pinning: while pinned we keep the newest content in view with an
  // O(1) scroll set (no per-token smooth scrollIntoView churn). If the user
  // scrolls up we release the pin and show a "jump to latest" affordance.
  const stickToBottomRef = useRef(true);
  const copyTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const scrollToLatest = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Pin to the newest message whenever the conversation grows while the user
  // is near the bottom (the common case during streaming). One assignment per
  // delta is far cheaper and smoother than scrollIntoView({ behavior: "smooth" }),
  // which forces a layout + animated scroll on every token.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToLatest();
  }, [messages, scrollToLatest]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const pinned = distance < SCROLL_PIN_THRESHOLD;
    stickToBottomRef.current = pinned;
    setNearBottom((prev) => (prev === pinned ? prev : pinned));
  }, []);

  const startNewSession = useCallback(() => {
    stickToBottomRef.current = true;
    setNearBottom(true);
    abortRef.current?.abort();
    activeRequestIdRef.current = null;
    currentSessionIdRef.current = null;
    setCurrentSessionId(null);
    setMessages([]);
    setChatStatus("idle");
  }, []);

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

  const loadMessages = useCallback(async (sessionId: string) => {
    if (messagesLoadingRef.current === sessionId) return; // already in-flight
    messagesLoadingRef.current = sessionId;
    // Only apply the result if this is still the newest requested load; a slow
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
        const fetched = (await res.json()) as Array<{ id: string; role: string; content: string; citations?: string[]; created_at: string }>;
        const normalized = (fetched || []).map(normalizeMessage);
        messagesCacheRef.current.set(sessionId, normalized);
        // Only swap into view when the user is still looking at this session.
        if (currentSessionIdRef.current === sessionId) {
          stickToBottomRef.current = true;
          setMessages(normalized);
        }
      }
    } catch (e) {
      console.error("Error fetching chat messages:", e);
    } finally {
      if (messagesLoadRef.current === loadId) {
        messagesLoadRef.current = 0;
        messagesLoadingRef.current = null;
      }
    }
  }, []);

  const fetchMessages = useCallback((sessionId: string) => {
    // Instant switch: render from the per-session cache when we have it, then
    // refresh in the background so DB updates still show up.
    if (messagesCacheRef.current.has(sessionId)) {
      setMessages(messagesCacheRef.current.get(sessionId) || []);
      stickToBottomRef.current = true;
      setNearBottom(true);
    }
    void loadMessages(sessionId);
  }, [loadMessages]);

  const selectSession = useCallback((sessionId: string) => {
    // A synchronous ref guard (not state) so the initial duplicate click that
    // arrives before React re-renders is ignored.
    if (sendingRef.current) return;
    currentSessionIdRef.current = sessionId;
    stickToBottomRef.current = true;
    setNearBottom(true);
    setCurrentSessionId(sessionId);
    fetchMessages(sessionId);
  }, [fetchMessages]);

  useEffect(() => {
    if (!activeRepoId) return;
    // Intentional: reset conversation state when the repository changes so we
    // never mix conversations across repos. This is a one-time external-sync
    // reset tied to activeRepoId, so synchronous setState is correct here.
    /* eslint-disable react-hooks/set-state-in-effect */
    abortRef.current?.abort();
    activeRequestIdRef.current = null;
    sendingRef.current = false;
    messagesCacheRef.current.clear();
    messagesRef.current = [];
    messagesLoadingRef.current = null;
    currentSessionIdRef.current = null;
    stickToBottomRef.current = true;
    setSessions([]);
    setMessages([]);
    setError(false);
    setChatStatus("idle");
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    (async () => {
      const data = await fetchSessions();
      if (data && data.length > 0 && data[0].id) {
        currentSessionIdRef.current = data[0].id;
        setCurrentSessionId(data[0].id);
        fetchMessages(data[0].id);
      }
      setLoading(false);
    })();
  }, [activeRepoId, fetchSessions, fetchMessages]);

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
    const userMsg: StreamMessage = {
      id: `user-${requestId}`,
      role: "user",
      content: text,
      citations: [],
      created_at: new Date().toISOString(),
    };
    const assistantId = `assistant-${requestId}`;
    const assistantMsg: StreamMessage = {
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
    let gotSessionId = currentSessionId;

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
      let assistantCitations: string[] = [];

      const finishFinalMessage = (streaming: boolean, error?: string) => {
        // Belt-and-suspenders: also persist the final state into the per-session
        // cache so a quick switch away and back never shows a stuck spinner.
        const sid = gotSessionId;
        if (sid) {
          const base = messagesRef.current;
          messagesCacheRef.current.set(
            sid,
            base.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    streaming,
                    error: error || m.error,
                    content: reply || m.content,
                    citations: assistantCitations,
                  }
                : m
            )
          );
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming, error: error || m.error, content: reply || m.content, citations: assistantCitations }
              : m
          )
        );
      };

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
            if (!currentSessionId && j.session_id) {
              currentSessionIdRef.current = j.session_id;
              setCurrentSessionId(j.session_id);
            }
          } catch {}
          return;
        }

        if (event === "error") {
          let friendly = "Unable to generate a response right now.";
          try {
            const j = JSON.parse(jsonData);
            friendly = j.message || friendly;
          } catch {}
          if (isCurrent()) finishFinalMessage(false, friendly);
          setChatStatus("error");
          return;
        }

        if (event === "done") {
          try {
            const j = JSON.parse(jsonData);
            gotSessionId = j.session_id || gotSessionId;
            if (j.citations && Array.isArray(j.citations)) assistantCitations = j.citations;
            if (j.content) reply = j.content;
            if (j.session_id && !currentSessionId) {
              currentSessionIdRef.current = j.session_id;
              setCurrentSessionId(j.session_id);
            }
          } catch {}
          finishFinalMessage(false);
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
        finishFinalMessage(false);
        if (chatStatus !== "error") setChatStatus("completed");
        if (gotSessionId && gotSessionId !== currentSessionId) {
          currentSessionIdRef.current = gotSessionId;
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
          if (gotSessionId) {
            messagesCacheRef.current.set(gotSessionId, messagesRef.current.map((m) =>
              m.id === assistantId ? { ...m, streaming: false } : m
            ));
          }
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

  // Stable handlers passed into memoized bubbles so only the changed message
  // re-renders while the stream is producing deltas.
  const copyMessage = useCallback((content: string, id: string) => {
    void navigator.clipboard?.writeText(content);
    setCopiedId(id);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleRetry = useCallback(() => {
    const current = messagesRef.current;
    const last = current[current.length - 1];
    if (last && last.role === "assistant" && last.error) {
      const userMsg = [...current].reverse().find((m) => m.role === "user");
      if (userMsg) {
        const retryId = userMsg.id.startsWith("user-") ? userMsg.id.slice("user-".length) : undefined;
        setMessages((prev) => prev.filter((m) => m.role !== "assistant" || !m.error));
        setChatStatus("idle");
        submitStream(userMsg.content, { requestId: retryId, reuseUser: true });
      }
    }
  }, [submitStream]);

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
          onClick={startNewSession}
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
                  onClick={() => selectSession(s.id)}
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
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6 relative"
          >
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
                {messages.map((m, idx) => (
                  <MessageBubble
                    key={m.id || idx}
                    message={m}
                    copied={copiedId === m.id}
                    onCopy={copyMessage}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
            )}

            {!nearBottom && (
              <button
                type="button"
                onClick={() => {
                  stickToBottomRef.current = true;
                  setNearBottom(true);
                  scrollToLatest();
                }}
                className="absolute bottom-6 right-6 z-10 grid h-9 w-9 place-items-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] shadow-lg hover:text-[#111827] transition-transform cursor-pointer"
                aria-label="Scroll to latest messages"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
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
                      setShowSessionsDrawer(false);
                      selectSession(s.id);
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