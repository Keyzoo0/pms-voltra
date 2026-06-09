"use client";

import Link from "next/link";

function renderInline(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      const [, label, href] = mm;
      nodes.push(
        href.startsWith("/") ? (
          <Link key={key} href={href} className="font-medium text-primary hover:underline">
            {label}
          </Link>
        ) : (
          <a key={key} href={href} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
            {label}
          </a>
        ),
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-1.5 ml-1 space-y-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-50" />
              <span>{renderInline(b, `li-${out.length}-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  lines.forEach((line, idx) => {
    const t = line.trim();
    const bullet = /^[-*]\s+(.*)/.exec(t);
    const heading = /^(#{1,4})\s+(.*)/.exec(t);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush();
    if (heading) {
      out.push(
        <p key={`h-${idx}`} className="mt-2 mb-1 text-sm font-semibold">
          {renderInline(heading[2], `h-${idx}`)}
        </p>,
      );
    } else if (t) {
      out.push(
        <p key={`p-${idx}`} className="leading-relaxed">
          {renderInline(t, `p-${idx}`)}
        </p>,
      );
    }
  });
  flush();
  return <div className="space-y-1.5 text-sm">{out}</div>;
}
