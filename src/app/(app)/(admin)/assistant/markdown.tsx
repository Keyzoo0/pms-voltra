"use client";

import { memo } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Full GFM renderer for assistant replies (react-markdown + remark-gfm):
 * blockquotes, horizontal rules, em/strong/strikethrough, nested & task
 * lists, tables, fenced code — styled to match the app, Claude/Qwen-grade.
 */

const components: Components = {
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  a: ({ href, children }) => {
    const url = href ?? "#";
    return url.startsWith("/") ? (
      <Link href={url} className="font-medium text-primary underline-offset-2 hover:underline">
        {children}
      </Link>
    ) : (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        {children}
      </a>
    );
  },
  h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-bold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-3 mb-1.5 text-[15px] font-bold first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-2.5 mb-1 text-sm font-semibold first:mt-0">{children}</h5>,
  h4: ({ children }) => <h6 className="mt-2.5 mb-1 text-sm font-semibold first:mt-0">{children}</h6>,
  ul: ({ children }) => (
    <ul className="my-1.5 ml-4 list-disc space-y-1 marker:text-muted-foreground/70">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 ml-4 list-decimal space-y-1 marker:font-medium marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5 leading-relaxed [&>ul]:my-1 [&>ol]:my-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 rounded-r-lg border-l-2 border-primary/50 bg-muted/40 py-2 pl-3 pr-3 text-foreground/90 [&>p]:my-1">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border/60" />,
  del: ({ children }) => <del className="opacity-70">{children}</del>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "") || String(children).includes("\n");
    if (isBlock) return <code className={className}>{children}</code>;
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-xs sm:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border/60 bg-muted/50">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border/40 last:border-0">{children}</tr>,
  th: ({ children }) => <th className="px-2.5 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-2.5 py-1.5 align-top">{children}</td>,
  input: ({ checked }) => (
    <input type="checkbox" checked={!!checked} readOnly className="mr-1.5 size-3.5 accent-primary align-[-2px]" />
  ),
};

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
