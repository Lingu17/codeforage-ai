"use client";

import { memo, useState } from "react";
import { Check, Copy, FileCode, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MarkdownView from "./Markdown";
import { createClient } from "@/utils/supabase/client";
import { getApiUrl } from "@/utils/api";

export type StreamMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: string[];
  created_at: string;
  error?: string;
  streaming?: boolean;
};

type Props = {
  message: StreamMessage;
  copied: boolean;
  onCopy: (content: string, id: string) => void;
  onRetry: () => void;
};

const MessageBubble = memo(function MessageBubble({ message, copied, onCopy, onRetry }: Props) {
  const [sourceError, setSourceError] = useState<string | null>(null);
  const openSource = async (citation: string) => {
    const repoId = new URLSearchParams(window.location.search).get("repo_id");
    const match = citation.match(/^(.*?):(\d+)(?:[–-](\d+))?$/);
    const path = match ? match[1] : citation;
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!repoId || !token) { setSourceError("Select a repository and sign in to open sources."); return; }
    try {
      const params = new URLSearchParams({ file_path: path });
      if (match) params.set("line", match[2]);
      const response = await fetch(getApiUrl(`/api/repos/${repoId}/source?${params}`), { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Source unavailable. Rescan the repository and retry.");
      const result = await response.json();
      window.open(result.url, "_blank", "noopener,noreferrer");
      setSourceError(null);
    } catch { setSourceError("Source unavailable. Rescan the repository and retry."); }
  };
  const isUser = message.role === "user";

  return (
    <div
      className={`flex flex-col max-w-[85%] ${
        isUser
          ? "self-end items-end animate-in slide-in-from-bottom-2 duration-150"
          : "self-start items-start animate-in fade-in duration-200"
      }`}
    >
      <div
        className={`p-4 rounded-2xl text-sm leading-relaxed border text-left ${
          isUser
            ? "bg-primary border-primary text-white rounded-br-none shadow-xs font-semibold"
            : "bg-white border-[#E5E7EB] text-[#111827] rounded-bl-none shadow-xs font-normal font-sans"
        }`}
      >
        {isUser ? (
          <div className="space-y-2 whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="space-y-2">
            {message.streaming ? (
              message.content ? (
                <>
                  <MarkdownView content={message.content} />
                  <span className="inline-block w-2 h-4 bg-primary/60 align-text-bottom animate-pulse ml-0.5" />
                </>
              ) : (
                <span className="inline-flex items-center gap-2 text-[#6B7280] font-mono text-xs">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  Analyzing repository...
                </span>
              )
            ) : message.error ? (
              <span className="text-[#B45309]">{message.error}</span>
            ) : (
              <MarkdownView content={message.content} />
            )}
          </div>
        )}
      </div>

      {!isUser && !message.streaming && !!message.content && (
        <div className="mt-2 flex flex-wrap gap-2 items-center text-left">
          <button
            type="button"
            onClick={() => onCopy(message.content, message.id)}
            className="flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#111827] font-mono cursor-pointer font-semibold"
            aria-label="Copy answer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {message.citations.length > 0 && (
            <>
              <span className="text-[10px] text-[#B45309] font-mono flex items-center gap-1 font-semibold">
                <FileCode className="w-3 h-3" /> Based on:
              </span>
              {message.citations.map((c: string, cIdx: number) => (
                <button type="button" onClick={() => openSource(c)} aria-label={`Open source ${c}`} key={cIdx}><Badge
                  variant="outline"
                  className="bg-white hover:bg-slate-50 border-[#E5E7EB] text-[10px] text-[#6B7280] font-mono py-0.5 px-2 select-all cursor-pointer rounded-md shadow-2xs"
                >
                  {c}
                </Badge></button>
              ))}
            </>
          )}
        </div>
      )}

      {sourceError && <p role="alert" className="text-xs text-amber-700">{sourceError}</p>}
      {!isUser && !message.streaming && !!message.error && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-2 border-[#E5E7EB] text-xs gap-1.5 cursor-pointer font-bold bg-white"
        >
          <RotateCcw className="w-3 h-3" /> Retry
        </Button>
      )}
    </div>
  );
});

export default MessageBubble;
