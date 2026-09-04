"use client";

import { memo } from "react";
import type { ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components, ExtraProps } from "react-markdown";
import CodeBlock from "./CodeBlock";

type CodeProps = ComponentPropsWithoutRef<"code"> & ExtraProps;
type PreProps = ComponentPropsWithoutRef<"pre"> & ExtraProps;
type AnchorProps = ComponentPropsWithoutRef<"a"> & ExtraProps;

function Code({ className, children, node: _node, ...rest }: CodeProps) {
  const match = /language-([A-Za-z0-9_+-]+)/.exec(className ?? "");
  if (match) {
    return <CodeBlock code={String(children).replace(/\n$/, "")} language={match[1]} />;
  }
  if (String(children).includes("\n")) {
    return <CodeBlock code={String(children).replace(/\n$/, "")} />;
  }
  return (
    <code
      className="rounded-md border border-[#E5E7EB] bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-rose-600"
      {...rest}
    >
      {children}
    </code>
  );
}

const components: Components = {
  pre({ children }: PreProps) {
    return <>{children}</>;
  },
  code: Code,
  a({ href, children, node: _node, ...rest }: AnchorProps) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary underline decoration-primary/30 underline-offset-2"
        {...rest}
      >
        {children}
      </a>
    );
  },
};

const MarkdownView = memo(function MarkdownView({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
});

export default MarkdownView;