"use client";

import { memo, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

// Register the languages code fences commonly use, including the grammars the
// extends (e.g. typescript -> javascript, shell -> bash, markdown -> xml).
const LANGUAGE_MODULES: Array<[string, Parameters<typeof hljs.registerLanguage>[1]]> = [
  ["bash", bash],
  ["c", c],
  ["cpp", cpp],
  ["csharp", csharp],
  ["css", css],
  ["go", go],
  ["java", java],
  ["javascript", javascript],
  ["json", json],
  ["markdown", markdown],
  ["php", php],
  ["plaintext", plaintext],
  ["python", python],
  ["ruby", ruby],
  ["rust", rust],
  ["shell", shell],
  ["sql", sql],
  ["typescript", typescript],
  ["xml", xml],
  ["yaml", yaml],
];

for (const [name, module] of LANGUAGE_MODULES) {
  hljs.registerLanguage(name, module);
}

const ALIASES: Record<string, string> = {
  cs: "csharp",
  "c#": "csharp",
  html: "xml",
  htm: "xml",
  svg: "xml",
  mdx: "markdown",
  md: "markdown",
  sh: "bash",
  zsh: "bash",
  py: "python",
  rb: "ruby",
  rs: "rust",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  tsx: "typescript",
  ts: "typescript",
  js: "javascript",
  yml: "yaml",
  txt: "plaintext",
  text: "plaintext",
  dockerfile: "bash",
  console: "shell",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlight(code: string, language?: string | null) {
  const requested = language?.trim().toLowerCase();
  const normalized = requested && (ALIASES[requested] || requested);
  if (normalized && hljs.getLanguage(normalized)) {
    try {
      return {
        html: hljs.highlight(code, { language: normalized, ignoreIllegals: true }).value,
        label: normalized,
      };
    } catch {
      // fall back to auto-detection
    }
  }
  try {
    return { html: hljs.highlightAuto(code).value, label: requested || "text" };
  } catch {
    return { html: escapeHtml(code), label: requested || "text" };
  }
}

const CodeBlock = memo(function CodeBlock({
  code,
  language,
}: {
  code: string;
  language?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(() => highlight(code, language), [code, language]);

  const copy = () => {
    try {
      void navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="group/code my-3 overflow-hidden rounded-xl border border-[#E5E7EB] bg-slate-50 font-sans">
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] bg-white px-3 py-1.5">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#6B7280]">
          {highlighted.label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-[10px] font-mono font-semibold text-[#6B7280] hover:text-[#111827] cursor-pointer"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code
          className="hljs block whitespace-pre font-mono text-[#1F2937]"
          dangerouslySetInnerHTML={{ __html: highlighted.html }}
        />
      </pre>
    </div>
  );
});

export default CodeBlock;