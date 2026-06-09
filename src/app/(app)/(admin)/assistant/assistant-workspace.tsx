"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  CornerDownLeft,
  FileImage,
  FileText,
  FolderSearch,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Trash2,
  UserPlus,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { deleteChat, getChatMessages, listChats, type ChatListItem } from "./actions";

type Attachment =
  | { kind: "image"; name: string; url: string; mime?: string }
  | { kind: "document"; name: string; text: string; mime?: string };

type Msg = {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  attachments?: Attachment[];
  options?: string[];
  error?: boolean;
};

type Pending = {
  id: string;
  name: string;
  kind: "image" | "document";
  status: "uploading" | "done" | "error";
  att?: Attachment;
  previewUrl?: string;
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

// Accept everything — the server validates & extracts (images, PDF, Word,
// Excel, CSV, JSON, and any text/code file).
const ACCEPT = "*/*";

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} hr`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function mapStored(m: { role: string; content: string; toolsUsed: string[]; attachments: unknown }): Msg {
  const att = m.attachments;
  let attachments: Attachment[] | undefined;
  let options: string[] | undefined;
  if (Array.isArray(att)) attachments = att as Attachment[];
  else if (att && typeof att === "object" && (att as { kind?: string }).kind === "question") {
    options = ((att as { options?: unknown }).options as string[]) ?? [];
  }
  return {
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    toolsUsed: m.toolsUsed,
    attachments,
    options,
  };
}

export function AssistantWorkspace({ initialChats }: { initialChats: ChatListItem[] }) {
  const [chats, setChats] = useState<ChatListItem[]>(initialChats);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  useEffect(() => {
    setHistoryCollapsed(localStorage.getItem("voltra_ai_history_collapsed") === "1");
  }, []);

  function toggleHistory() {
    setHistoryCollapsed((c) => {
      const next = !c;
      localStorage.setItem("voltra_ai_history_collapsed", next ? "1" : "0");
      return next;
    });
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setPending([]);
    setInput("");
    setShowSidebar(false);
    taRef.current?.focus();
  }

  async function openChat(id: string) {
    if (id === activeId) return setShowSidebar(false);
    setActiveId(id);
    setShowSidebar(false);
    setLoadingChat(true);
    setMessages([]);
    try {
      const stored = await getChatMessages(id);
      setMessages(stored.map(mapStored));
    } finally {
      setLoadingChat(false);
    }
  }

  async function removeChat(id: string) {
    if (!confirm("Hapus percakapan ini?")) return;
    await deleteChat(id);
    setChats((c) => c.filter((x) => x.id !== id));
    if (id === activeId) startNewChat();
  }

  async function uploadFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      const kind: "image" | "document" = file.type.startsWith("image/") ? "image" : "document";
      const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
      setPending((p) => [...p, { id, name: file.name, kind, status: "uploading", previewUrl }]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/assistant/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPending((p) => p.map((x) => (x.id === id ? { ...x, status: "error", name: data?.error ?? x.name } : x)));
        } else {
          setPending((p) => p.map((x) => (x.id === id ? { ...x, status: "done", att: data.attachment } : x)));
        }
      } catch {
        setPending((p) => p.map((x) => (x.id === id ? { ...x, status: "error" } : x)));
      }
    }
  }

  const uploading = pending.some((p) => p.status === "uploading");

  async function send(text: string) {
    const content = text.trim();
    const atts = pending.filter((p) => p.status === "done" && p.att).map((p) => p.att!) as Attachment[];
    if ((!content && atts.length === 0) || loading || uploading) return;

    setMessages((m) => [...m, { role: "user", content, attachments: atts.length ? atts : undefined }]);
    setInput("");
    setPending([]);
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId: activeId, content, attachments: atts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            error: true,
            content:
              data?.code === "no_key"
                ? "⚠️ API key AI belum dikonfigurasi di server."
                : `⚠️ ${data?.error ?? "Gagal menghubungi asisten."}`,
          },
        ]);
      } else {
        const newChat = !activeId;
        if (newChat) setActiveId(data.chatId);
        setChats((c) => {
          const without = c.filter((x) => x.id !== data.chatId);
          return [{ id: data.chatId, title: data.title, updatedAt: new Date().toISOString() }, ...without];
        });
        if (data.type === "question") {
          setMessages((m) => [
            ...m,
            { role: "assistant", content: data.question, options: data.options, toolsUsed: data.toolsUsed },
          ]);
        } else {
          setMessages((m) => [...m, { role: "assistant", content: data.reply, toolsUsed: data.toolsUsed }]);
        }
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", error: true, content: "⚠️ Koneksi gagal. Coba lagi." }]);
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
    <div className="flex h-[calc(100vh-12rem)] min-h-[30rem] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Sidebar: recent chats */}
      <aside
        className={cn(
          "absolute z-20 flex h-[calc(100vh-12rem)] w-64 shrink-0 flex-col border-r border-border/60 bg-card md:static md:z-auto md:h-auto",
          showSidebar ? "flex" : "hidden",
          historyCollapsed ? "md:hidden" : "md:flex",
        )}
      >
        <div className="p-3">
          <Button onClick={startNewChat} className="w-full" size="sm">
            <MessageSquarePlus /> Chat baru
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Riwayat
          </p>
          {chats.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">Belum ada percakapan.</p>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
                c.id === activeId ? "bg-accent" : "hover:bg-accent/60",
              )}
            >
              <button
                type="button"
                onClick={() => openChat(c.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate font-medium">{c.title}</span>
                <span className="text-[11px] text-muted-foreground">{relTime(c.updatedAt)}</span>
              </button>
              <button
                type="button"
                onClick={() => removeChat(c.id)}
                title="Hapus"
                className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSidebar((s) => !s)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent md:hidden"
              title="Riwayat"
            >
              <PanelLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={toggleHistory}
              className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent md:inline-flex"
              title={historyCollapsed ? "Tampilkan riwayat" : "Sembunyikan riwayat"}
            >
              {historyCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Voltra AI</p>
              <p className="text-[11px] text-muted-foreground">Asisten analisa & manajemen proyek</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={startNewChat} className="text-muted-foreground">
            <MessageSquarePlus /> Baru
          </Button>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {loadingChat ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Memuat percakapan…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="size-6" />
              </span>
              <h3 className="text-base font-semibold">Halo! Saya Voltra AI 👋</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Tanya soal proyek, keuangan, & karyawan, lampirkan gambar/laporan untuk dianalisa,
                atau minta saya membuat proyek baru.
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
                  <div className="flex flex-col items-end gap-1.5">
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                        {m.attachments.map((a, j) =>
                          a.kind === "image" ? (
                            <a key={j} href={a.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={a.url} alt={a.name} className="h-24 w-24 rounded-lg border border-border object-cover" />
                            </a>
                          ) : (
                            <span key={j} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                              <FileText className="size-3.5 text-primary" /> {a.name}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                    {m.content && (
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                        {m.content}
                      </div>
                    )}
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
                          m.error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-background",
                        )}
                      >
                        <Markdown text={m.content} />
                      </div>
                      {m.options && m.options.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-0.5">
                          {m.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={loading}
                              onClick={() => send(opt)}
                              className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.toolsUsed && m.toolsUsed.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-1">
                          {[...new Set(m.toolsUsed)].map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <Wand2 className="size-2.5" /> {TOOL_LABELS[t] ?? t}
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
                <Loader2 className="size-3.5 animate-spin" /> Menganalisa…
              </div>
            </div>
          )}
        </div>

        {/* composer */}
        <div className="border-t border-border/60 p-3">
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((p) => (
                <span
                  key={p.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs",
                    p.status === "error" ? "border-destructive/40 text-destructive" : "border-border bg-background",
                  )}
                >
                  {p.status === "uploading" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : p.kind === "image" ? (
                    <FileImage className="size-3.5 text-primary" />
                  ) : (
                    <FileText className="size-3.5 text-primary" />
                  )}
                  <span className="max-w-[12rem] truncate">{p.name}</span>
                  <button type="button" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}>
                    <X className="size-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 focus-within:border-primary/40">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Lampirkan gambar / dokumen"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Paperclip className="size-4" />
            </button>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Tanya atau lampirkan file…"
              className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button size="icon" onClick={() => send(input)} disabled={loading || uploading || (!input.trim() && pending.length === 0)}>
              {loading || uploading ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            Enter kirim · Shift+Enter baris baru · lampirkan gambar/PDF/Excel/CSV · Voltra AI bisa keliru.
          </p>
        </div>
      </div>
    </div>
  );
}
