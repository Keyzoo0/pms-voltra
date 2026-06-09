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
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
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

function splitRow(line: string): string[] {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const isTableSeparator = (line: string) => /^\|?[\s:|-]+\|?$/.test(line) && line.includes("-");

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];

  const flushLists = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-1.5 ml-1 space-y-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-50" />
              <span className="min-w-0">{renderInline(b, `li-${out.length}-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      bullets = [];
    }
    if (numbered.length) {
      out.push(
        <ol key={`ol-${out.length}`} className="my-1.5 ml-1 space-y-1">
          {numbered.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-4 shrink-0 text-right text-xs font-medium tabular-nums opacity-60">
                {i + 1}.
              </span>
              <span className="min-w-0">{renderInline(b, `ni-${out.length}-${i}`)}</span>
            </li>
          ))}
        </ol>,
      );
      numbered = [];
    }
  };

  let idx = 0;
  while (idx < lines.length) {
    const raw = lines[idx];
    const t = raw.trim();

    // Fenced code block.
    if (t.startsWith("```")) {
      flushLists();
      const code: string[] = [];
      idx++;
      while (idx < lines.length && !lines[idx].trim().startsWith("```")) {
        code.push(lines[idx]);
        idx++;
      }
      idx++; // skip closing fence
      out.push(
        <pre
          key={`code-${out.length}`}
          className="my-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/60 p-3 font-mono text-xs leading-relaxed"
        >
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Table: header row + separator row.
    if (t.startsWith("|") && idx + 1 < lines.length && isTableSeparator(lines[idx + 1].trim())) {
      flushLists();
      const header = splitRow(t);
      idx += 2;
      const rows: string[][] = [];
      while (idx < lines.length && lines[idx].trim().startsWith("|")) {
        rows.push(splitRow(lines[idx].trim()));
        idx++;
      }
      out.push(
        <div key={`tbl-${out.length}`} className="my-2 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/50">
                {header.map((h, i) => (
                  <th key={i} className="px-2.5 py-1.5 text-left font-semibold">
                    {renderInline(h, `th-${out.length}-${i}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-border/40 last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 align-top">
                      {renderInline(c, `td-${out.length}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)/.exec(t);
    const num = /^\d+[.)]\s+(.*)/.exec(t);
    const heading = /^(#{1,4})\s+(.*)/.exec(t);

    if (bullet) {
      if (numbered.length) flushLists();
      bullets.push(bullet[1]);
    } else if (num) {
      if (bullets.length) flushLists();
      numbered.push(num[1]);
    } else {
      flushLists();
      if (heading) {
        out.push(
          <p key={`h-${idx}`} className="mt-2.5 mb-1 text-sm font-semibold">
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
    }
    idx++;
  }
  flushLists();
  return <div className="space-y-1.5 text-sm">{out}</div>;
}
