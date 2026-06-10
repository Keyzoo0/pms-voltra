"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  Check,
  Copy,
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
  Pencil,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
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
  id?: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  attachments?: Attachment[];
  options?: string[];
  error?: boolean;
  stopped?: boolean;
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
  get_employee: "Detail karyawan",
  suggest_employees: "Rekomendasi karyawan",
  list_clients: "Daftar klien",
  list_taxonomy: "Kategori & role",
  create_project: "Buat proyek",
  update_project: "Ubah proyek",
  set_project_status: "Ubah status",
  set_project_progress: "Set progress",
  delete_project: "Hapus proyek",
  create_client: "Buat klien",
  update_client: "Ubah klien",
  delete_client: "Hapus klien",
  create_employee: "Buat karyawan",
  update_employee: "Ubah karyawan",
  set_employee_status: "Status karyawan",
  delete_employee: "Hapus karyawan",
  assign_employee: "Assign tim",
  update_assignment: "Ubah penugasan",
  unassign_employee: "Lepas penugasan",
  add_item: "Tambah BOM",
  update_item: "Ubah BOM",
  delete_item: "Hapus BOM",
  add_cost: "Tambah biaya",
  delete_cost: "Hapus biaya",
  add_payment_term: "Tambah termin",
  set_payment_term_status: "Status termin",
  delete_payment_term: "Hapus termin",
  create_role: "Buat role",
  create_category: "Buat kategori",
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

function mapStored(m: {
  id: string;
  role: string;
  content: string;
  toolsUsed: string[];
  attachments: unknown;
}): Msg {
  const att = m.attachments;
  let attachments: Attachment[] | undefined;
  let options: string[] | undefined;
  if (Array.isArray(att)) attachments = att as Attachment[];
  else if (att && typeof att === "object" && (att as { kind?: string }).kind === "question") {
    options = ((att as { options?: unknown }).options as string[]) ?? [];
  }
  return {
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    toolsUsed: m.toolsUsed,
    attachments,
    options,
  };
}

type SendOpts = {
  /** Re-send an edited user message: replaces it and everything after it. */
  replaceFromId?: string;
  replaceIdx?: number;
  /** Re-run the last user message (regenerate the answer). */
  regenerate?: boolean;
  /** Explicit attachments (edit flow) — bypasses the pending uploads. */
  attachments?: Attachment[];
};

export function AssistantWorkspace({ initialChats }: { initialChats: ChatListItem[] }) {
  const [chats, setChats] = useState<ChatListItem[]>(initialChats);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState("");
  const [streamText, setStreamText] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

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
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const atBottomRef = useRef(true);
  // Bumped when switching/clearing chats so an aborted in-flight turn can't
  // leak its partial answer into the newly opened conversation.
  const epochRef = useRef(0);

  // Auto-scroll only while the reader is following the bottom of the chat.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: streamText ? "auto" : "smooth" });
  }, [messages, loading, streamText, reasonText]);

  // Auto-grow the composer with its content (capped via max-h class).
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  async function copyMessage(idx: number, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1500);
    } catch {}
  }

  // Group chats by recency for the history sidebar.
  const chatGroups = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const groups: { label: string; items: ChatListItem[] }[] = [
      { label: "Hari Ini", items: [] },
      { label: "Kemarin", items: [] },
      { label: "7 Hari Terakhir", items: [] },
      { label: "Lebih Lama", items: [] },
    ];
    for (const c of chats) {
      const t = new Date(c.updatedAt).getTime();
      if (t >= startOfDay) groups[0].items.push(c);
      else if (t >= startOfDay - 86_400_000) groups[1].items.push(c);
      else if (t >= startOfDay - 6 * 86_400_000) groups[2].items.push(c);
      else groups[3].items.push(c);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [chats]);

  function startNewChat() {
    abortRef.current?.abort();
    epochRef.current++;
    setActiveId(null);
    setMessages([]);
    setPending([]);
    setInput("");
    setEditingIdx(null);
    setShowSidebar(false);
    localStorage.removeItem("voltra_ai_last_chat");
    taRef.current?.focus();
  }

  async function openChat(id: string) {
    if (id === activeId) return setShowSidebar(false);
    abortRef.current?.abort();
    epochRef.current++;
    setActiveId(id);
    setShowSidebar(false);
    setEditingIdx(null);
    localStorage.setItem("voltra_ai_last_chat", id);
    setLoadingChat(true);
    setMessages([]);
    try {
      const stored = await getChatMessages(id);
      setMessages(stored.map(mapStored));
    } finally {
      setLoadingChat(false);
    }
  }

  // Restore the last open session when returning to this page.
  useEffect(() => {
    const last = localStorage.getItem("voltra_ai_last_chat");
    if (last && initialChats.some((c) => c.id === last)) void openChat(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Re-read the chat from the server (gains message ids, heals any drift). */
  async function syncMessages(chatId: string) {
    try {
      const stored = await getChatMessages(chatId);
      if (loadingRef.current) return; // a new turn started — don't clobber it
      if (stored.length > 0) setMessages(stored.map(mapStored));
    } catch {}
  }

  async function refreshChats() {
    try {
      setChats(await listChats());
    } catch {}
  }

  async function removeChat(id: string) {
    if (!confirm("Hapus percakapan ini?")) return;
    await deleteChat(id);
    setChats((c) => c.filter((x) => x.id !== id));
    if (localStorage.getItem("voltra_ai_last_chat") === id) {
      localStorage.removeItem("voltra_ai_last_chat");
    }
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

  async function send(text: string, opts: SendOpts = {}) {
    const content = text.trim();
    const atts =
      opts.attachments ??
      (pending.filter((p) => p.status === "done" && p.att).map((p) => p.att!) as Attachment[]);
    if (loading || uploading) return;
    if (!opts.regenerate && !content && atts.length === 0) return;

    // Optimistic local state for each flow.
    if (opts.regenerate) {
      setMessages((m) => {
        let i = m.length - 1;
        while (i >= 0 && m[i].role === "assistant") i--;
        return m.slice(0, i + 1);
      });
    } else if (opts.replaceFromId && opts.replaceIdx != null) {
      const idx = opts.replaceIdx;
      setMessages((m) => [
        ...m.slice(0, idx),
        { role: "user", content, attachments: atts.length ? atts : undefined },
      ]);
    } else {
      setMessages((m) => [...m, { role: "user", content, attachments: atts.length ? atts : undefined }]);
      setInput("");
      setPending([]);
    }
    setEditingIdx(null);
    setLoading(true);
    loadingRef.current = true;
    setLiveStatus("");
    setStreamText("");
    setReasonText("");

    const ac = new AbortController();
    abortRef.current = ac;
    const epoch = ++epochRef.current;

    let chatIdNow = activeId;
    let metaTitle = "";
    let streamed = ""; // mirror of streamText for non-stale access in catch
    let syncAfter: string | null = null;

    const fail = (msg: string) =>
      setMessages((m) => [...m, { role: "assistant", error: true, content: `⚠️ ${msg}` }]);

    const commitChat = (id: string, title: string) => {
      setActiveId(id);
      localStorage.setItem("voltra_ai_last_chat", id);
      setChats((c) => {
        const prev = c.find((x) => x.id === id);
        const without = c.filter((x) => x.id !== id);
        return [{ id, title: title || prev?.title || "Percakapan baru", updatedAt: new Date().toISOString() }, ...without];
      });
    };

    const handleDone = (data: {
      chatId: string;
      title: string;
      resultType: string;
      reply?: string;
      question?: string;
      options?: string[];
      toolsUsed?: string[];
    }) => {
      commitChat(data.chatId, data.title);
      setStreamText("");
      setReasonText("");
      setLiveStatus("");
      if (data.resultType === "question") {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.question ?? "", options: data.options, toolsUsed: data.toolsUsed },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "", toolsUsed: data.toolsUsed }]);
      }
      syncAfter = data.chatId;
    };

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          chatId: activeId,
          content,
          attachments: atts,
          replaceFromId: opts.replaceFromId,
          regenerate: opts.regenerate,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        fail(
          data?.code === "no_key"
            ? "API key AI belum dikonfigurasi di server."
            : data?.error ?? "Gagal menghubungi asisten.",
        );
        return;
      }

      // Stream NDJSON: meta → status / deltas / reasoning → done | aborted | error.
      const reader = res.body?.getReader();
      if (!reader) {
        fail("Browser tidak mendukung streaming respons.");
        return;
      }
      const decoder = new TextDecoder();
      let buf = "";
      let finished = false;
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(line);
        } catch {
          return;
        }
        if (ev.type === "meta") {
          chatIdNow = String(ev.chatId);
          metaTitle = String(ev.title ?? "");
        } else if (ev.type === "delta") {
          const t = String(ev.text ?? "");
          streamed += t;
          setStreamText((s) => s + t);
        } else if (ev.type === "reasoning") {
          setReasonText((s) => (s + String(ev.text ?? "")).slice(-400));
        } else if (ev.type === "status") {
          // A new agent round starts — pre-tool commentary is superseded.
          streamed = "";
          setStreamText("");
          setReasonText("");
          if (ev.kind === "thinking") setLiveStatus("Berpikir…");
          else if (ev.kind === "tools" && Array.isArray(ev.tools)) {
            const labels = [...new Set(ev.tools.map((t) => TOOL_LABELS[String(t)] ?? String(t)))];
            setLiveStatus(labels.join(" · ") + "…");
          }
        } else if (ev.type === "done") {
          finished = true;
          handleDone(ev as Parameters<typeof handleDone>[0]);
        } else if (ev.type === "aborted") {
          finished = true;
        } else if (ev.type === "error") {
          finished = true;
          fail(
            ev.code === "no_key"
              ? "API key AI belum dikonfigurasi di server."
              : String(ev.error ?? "Gagal menghubungi asisten."),
          );
          if (ev.rolledBack === true && !activeId) {
            chatIdNow = null;
            localStorage.removeItem("voltra_ai_last_chat");
          }
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          handleLine(buf.slice(0, idx));
          buf = buf.slice(idx + 1);
        }
      }
      handleLine(buf);
      if (!finished) {
        fail("Respons terputus. Coba muat ulang percakapan — hasil mungkin sudah tersimpan.");
        if (chatIdNow) syncAfter = chatIdNow;
      }
    } catch {
      if (ac.signal.aborted) {
        // User pressed stop — keep whatever was streamed as the answer.
        // If the abort came from switching chats, leave the new chat alone.
        if (epochRef.current === epoch) {
          const partial = streamed.trim();
          if (partial) {
            setMessages((m) => [...m, { role: "assistant", content: partial, stopped: true }]);
          }
          if (chatIdNow) {
            commitChat(chatIdNow, metaTitle);
            syncAfter = chatIdNow;
          }
        }
      } else {
        fail("Koneksi gagal. Coba lagi.");
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setLoading(false);
      loadingRef.current = false;
      setLiveStatus("");
      setStreamText("");
      setReasonText("");
      if (epochRef.current === epoch) {
        if (syncAfter) void syncMessages(syncAfter);
        taRef.current?.focus();
      }
      void refreshChats();
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
  }

  function beginEdit(idx: number, m: Msg) {
    if (loading || !m.id) return;
    setEditingIdx(idx);
    setEditText(m.content);
  }

  function saveEdit(idx: number, m: Msg) {
    const t = editText.trim();
    if (!t && !(m.attachments?.length)) return;
    void send(t, { replaceFromId: m.id, replaceIdx: idx, attachments: m.attachments ?? [] });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const lastIdx = messages.length - 1;
  const canRegenerate = !loading && !loadingChat && !!activeId && messages.length > 0;

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] min-h-[28rem] overflow-hidden lg:h-dvh">
      {/* Sidebar: recent chats */}
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-20 flex w-64 shrink-0 flex-col border-r border-border/60 bg-card md:static md:z-auto",
          showSidebar ? "flex" : "hidden",
          historyCollapsed ? "md:hidden" : "md:flex",
        )}
      >
        <div className="p-3">
          <Button onClick={startNewChat} className="w-full" size="sm">
            <MessageSquarePlus /> Chat baru
          </Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-2 pb-3">
          {chats.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">Belum ada percakapan.</p>
          )}
          {chatGroups.map((g) => (
            <div key={g.label}>
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {g.label}
              </p>
              <div className="space-y-0.5">
                {g.items.map((c) => (
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
            </div>
          ))}
        </div>
      </aside>

      {/* Chat pane */}
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
        }}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-primary/60 bg-primary/5 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-sm font-medium text-primary shadow-lg">
              <UploadCloud className="size-4" /> Lepaskan file untuk dilampirkan
            </div>
          </div>
        )}
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
              <p className="text-[11px] text-muted-foreground">
                Agen operasional PMS · Qwen3.7 Max
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={startNewChat} className="text-muted-foreground">
            <MessageSquarePlus /> Baru
          </Button>
        </div>

        {/* messages */}
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="flex-1 overflow-y-auto px-4 py-5"
        >
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4">
          {loadingChat ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Memuat percakapan…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
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
              <Fragment key={m.id ?? `local-${i}`}>
                {m.role === "user" ? (
                  editingIdx === i ? (
                    <div className="flex justify-end">
                      <div className="w-full max-w-[85%] rounded-2xl border border-primary/40 bg-background p-2 shadow-sm">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit(i, m);
                            }
                            if (e.key === "Escape") setEditingIdx(null);
                          }}
                          rows={Math.min(6, Math.max(2, editText.split("\n").length))}
                          autoFocus
                          className="w-full resize-none bg-transparent px-1.5 py-1 text-sm outline-none"
                        />
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>
                            Batal
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(i, m)}
                            disabled={!editText.trim() && !(m.attachments?.length)}
                          >
                            <CornerDownLeft className="size-3.5" /> Kirim ulang
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="group/u flex flex-col items-end gap-1.5">
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
                      {(m.content || m.id) && (
                        <div className="flex max-w-[85%] items-end gap-1.5">
                          {m.id && !loading && (
                            <button
                              type="button"
                              onClick={() => beginEdit(i, m)}
                              title="Edit & kirim ulang"
                              className="mb-1 shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/u:opacity-100"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                          {m.content && (
                            <div className="min-w-0 whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                              {m.content}
                            </div>
                          )}
                        </div>
                      )}
                      {i === lastIdx && canRegenerate && (
                        <button
                          type="button"
                          onClick={() => send("", { regenerate: true })}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <RefreshCw className="size-3" /> Lanjutkan respons
                        </button>
                      )}
                    </div>
                  )
                ) : (
                  <div className="group flex gap-2.5">
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
                          "relative rounded-2xl rounded-tl-sm border px-3.5 py-2.5",
                          m.error ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-background",
                        )}
                      >
                        <Markdown text={m.content} />
                        {m.stopped && (
                          <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                            ⏹ Dihentikan — jawaban belum selesai.
                          </p>
                        )}
                        {!m.error && (
                          <button
                            type="button"
                            onClick={() => copyMessage(i, m.content)}
                            title="Salin jawaban"
                            className="absolute -right-2 -top-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
                          >
                            {copiedIdx === i ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        )}
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
                      {i === lastIdx && canRegenerate && (
                        <button
                          type="button"
                          onClick={() => send("", { regenerate: true })}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <RefreshCw className="size-3" /> {m.error ? "Coba lagi" : "Ulangi respons"}
                        </button>
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
              <div className="min-w-0 max-w-[85%]">
                <div className="rounded-2xl rounded-tl-sm border border-border bg-background px-3.5 py-2.5">
                  {streamText ? (
                    <>
                      <Markdown text={streamText} />
                      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse rounded bg-primary align-text-bottom" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3.5 shrink-0 animate-spin" />
                        <span className="animate-pulse">{liveStatus || "Menganalisa…"}</span>
                      </div>
                      {reasonText && (
                        <p className="mt-1.5 line-clamp-2 break-words text-xs italic text-muted-foreground/70">
                          {reasonText}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* composer */}
        <div className="border-t border-border/60 p-3">
          <div className="mx-auto w-full max-w-4xl">
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
              onPaste={(e) => {
                const files = e.clipboardData?.files;
                if (files?.length) {
                  e.preventDefault();
                  uploadFiles(files);
                }
              }}
              rows={1}
              placeholder="Tanya atau lampirkan file…"
              className="max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading ? (
              <Button
                size="icon"
                variant="outline"
                onClick={stopGeneration}
                title="Hentikan respons"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => send(input)}
                disabled={uploading || (!input.trim() && pending.length === 0)}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
              </Button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            Enter kirim · Shift+Enter baris baru · ⏹ hentikan respons · ✏️ edit pesan untuk kirim ulang · Voltra AI bisa keliru.
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
