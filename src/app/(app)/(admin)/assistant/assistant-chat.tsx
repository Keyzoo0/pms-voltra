"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bot,
  CornerDownLeft,
  FolderSearch,
  Loader2,
  RefreshCw,
  Sparkles,
  UserPlus,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Msg = {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  error?: boolean;
};

const TOOL_LABELS: Record<string, string> = {
  get_overview: "Analisa menyeluruh",
  list_projects: "Cari proyek",
  get_project: "Detail proyek",
  list_employees: "Daftar karyawan",
  suggest_employees: "Rekomendasi karyawan",
  list_clients: "Daftar klien",
  list_taxonomy: "Kategori & role",
  create_project: "Buat proyek",
};

const SUGGESTIONS = [
  { icon: BarChart3, text: "Analisa kondisi seluruh proyek & keuangan saat ini" },
  { icon: FolderSearch, text: "Proyek mana saja yang sedang berjalan?" },
  { icon: UserPlus, text: "Sarankan karyawan untuk proyek firmware IoT" },
  { icon: Wand2, text: "Bantu saya buat proyek baru" },
];

// ── tiny markdown renderer (bold, code, links, bullets, headings) ──
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
      const internal = href.startsWith("/");
      nodes.push(
        internal ? (
          <Link key={key} href={href} className="font-medium text-primary hover:underline">
            {label}
          </Link>
        ) : (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
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

function Markdown({ text }: { text: string }) {
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

export function AssistantChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((p) => [
          ...p,
          {
            role: "assistant",
            error: true,
            content:
              data?.code === "no_key"
                ? "⚠️ API key Gemini belum dikonfigurasi di server (GEMINI_API_KEY)."
                : `⚠️ ${data?.error ?? "Gagal menghubungi asisten."}`,
          },
        ]);
      } else {
        setMessages((p) => [
          ...p,
          { role: "assistant", content: data.reply, toolsUsed: data.toolsUsed },
        ]);
      }
    } catch {
      setMessages((p) => [
        ...p,
        { role: "assistant", error: true, content: "⚠️ Koneksi gagal. Coba lagi." },
      ]);
    } finally {
      setLoading(false);
      taRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Voltra AI</p>
            <p className="text-[11px] text-muted-foreground">Asisten analisa & manajemen proyek</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            disabled={loading}
            className="text-muted-foreground"
          >
            <RefreshCw /> Reset
          </Button>
        )}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="size-6" />
            </span>
            <h3 className="text-base font-semibold">Halo! Saya Voltra AI 👋</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Tanya apa saja tentang proyek, keuangan, dan karyawan — atau minta saya membuat
              proyek baru dan merekomendasikan tim.
            </p>
            <div className="mt-5 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => send(s.text)}
                  className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <s.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <Fragment key={i}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      m.error ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
                    )}
                  >
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="min-w-0 max-w-[85%]">
                    <div
                      className={cn(
                        "rounded-2xl rounded-tl-sm border px-3.5 py-2.5",
                        m.error
                          ? "border-destructive/30 bg-destructive/5 text-destructive"
                          : "border-border bg-background",
                      )}
                    >
                      <Markdown text={m.content} />
                    </div>
                    {m.toolsUsed && m.toolsUsed.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                        {[...new Set(m.toolsUsed)].map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            <Wand2 className="size-2.5" />
                            {TOOL_LABELS[t] ?? t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Fragment>
          ))
        )}

        {loading && (
          <div className="flex gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </span>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-background px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Menganalisa…
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 focus-within:border-primary/40">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Tanya tentang proyek, keuangan, atau karyawan…"
            className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button size="icon" onClick={() => send(input)} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          Enter untuk kirim · Shift+Enter baris baru · Voltra AI bisa keliru — verifikasi
          keputusan penting.
        </p>
      </div>
    </div>
  );
}
