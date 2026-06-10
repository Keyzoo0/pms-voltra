import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  AssistantAborted,
  AssistantError,
  runAssistant,
  type Attachment,
  type ChatMessage,
} from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Postgres rejects \u0000 in text/jsonb — strip control chars defensively. */
function cleanText(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

function sanitizeAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  const out: Attachment[] = [];
  for (const a of raw.slice(0, 8)) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    if (o.kind === "image" && typeof o.url === "string") {
      out.push({ kind: "image", name: String(o.name ?? "gambar"), url: o.url, mime: typeof o.mime === "string" ? o.mime : undefined });
    } else if (o.kind === "document" && typeof o.text === "string") {
      out.push({
        kind: "document",
        name: String(o.name ?? "dokumen"),
        text: cleanText(o.text).slice(0, 8000),
        mime: typeof o.mime === "string" ? o.mime : undefined,
      });
    }
  }
  return out;
}

function titleFrom(content: string, attachments: Attachment[]): string {
  const t = content.trim().replace(/\s+/g, " ");
  if (t) return t.slice(0, 60);
  if (attachments[0]) return `Analisa: ${attachments[0].name}`.slice(0, 60);
  return "Percakapan baru";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }
  const ownerId = session.uid;

  let body: {
    chatId?: string;
    content?: string;
    attachments?: unknown;
    replaceFromId?: string;
    regenerate?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const regenerate = body.regenerate === true;
  const replaceFromId = typeof body.replaceFromId === "string" ? body.replaceFromId : "";
  const content = typeof body.content === "string" ? cleanText(body.content) : "";
  const attachments = sanitizeAttachments(body.attachments);
  if (!regenerate && !content.trim() && attachments.length === 0) {
    return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  }

  // Resolve or create the chat (scoped to the owner).
  let chatId = typeof body.chatId === "string" ? body.chatId : "";
  let title = "";
  if (chatId) {
    const chat = await db.assistantChat.findUnique({ where: { id: chatId }, select: { ownerId: true, title: true } });
    if (!chat || chat.ownerId !== ownerId) {
      return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 404 });
    }
    title = chat.title;
  } else {
    if (regenerate || replaceFromId) {
      return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 400 });
    }
    title = titleFrom(content, attachments);
    const chat = await db.assistantChat.create({ data: { ownerId, title }, select: { id: true } });
    chatId = chat.id;
  }

  // Edit / regenerate: drop the tail of the conversation before re-running.
  if (regenerate || replaceFromId) {
    const msgs = await db.assistantMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true },
    });
    let cut = -1;
    if (regenerate) {
      // Re-run from the last user message: drop trailing assistant replies.
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "user") {
          cut = i + 1;
          break;
        }
      }
      if (cut === -1) {
        return NextResponse.json({ error: "Belum ada pesan untuk diulang." }, { status: 400 });
      }
    } else {
      // Edited message: replace it and everything after it.
      cut = msgs.findIndex((m) => m.id === replaceFromId && m.role === "user");
      if (cut === -1) {
        return NextResponse.json({ error: "Pesan tidak ditemukan." }, { status: 404 });
      }
    }
    const ids = msgs.slice(cut).map((m) => m.id);
    if (ids.length) await db.assistantMessage.deleteMany({ where: { id: { in: ids } } });
    if (replaceFromId && cut === 0) {
      title = titleFrom(content, attachments);
      await db.assistantChat.update({ where: { id: chatId }, data: { title } });
    }
  }

  // Persist the (new or edited) user message.
  if (!regenerate) {
    await db.assistantMessage.create({
      data: {
        chatId,
        role: "user",
        content,
        attachments: attachments.length ? (attachments as unknown as object) : undefined,
      },
    });
  }

  // Build the model history from stored messages.
  const stored = await db.assistantMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const history: ChatMessage[] = stored.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    attachments:
      m.role === "user" && Array.isArray(m.attachments)
        ? (m.attachments as unknown as Attachment[])
        : undefined,
  }));

  // Stream NDJSON: meta → status / token deltas / reasoning → done | error.
  // Aborting the request (stop button / disconnect) interrupts generation and
  // persists whatever partial answer was produced.
  const isNewChat = !body.chatId;
  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal?.addEventListener?.("abort", () => abort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // client disconnected — keep running so the result is still persisted
        }
      };

      // Tell the client which chat this turn belongs to right away, so an
      // interrupted first turn still lands in the right session.
      send({ type: "meta", chatId, title });

      try {
        const result = await runAssistant(history, {
          signal: abort.signal,
          onEvent: (ev) => {
            if (ev.kind === "delta") send({ type: "delta", text: ev.text });
            else if (ev.kind === "reasoning") send({ type: "reasoning", text: ev.text });
            else send({ type: "status", ...ev });
          },
        });

        if (result.type === "question") {
          await db.assistantMessage.create({
            data: {
              chatId,
              role: "assistant",
              content: result.question,
              toolsUsed: result.toolsUsed,
              attachments: { kind: "question", options: result.options } as unknown as object,
            },
          });
        } else {
          await db.assistantMessage.create({
            data: { chatId, role: "assistant", content: cleanText(result.reply), toolsUsed: result.toolsUsed },
          });
        }
        await db.assistantChat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

        const { type: resultType, ...rest } = result;
        send({ type: "done", chatId, title, resultType, ...rest });
      } catch (e) {
        if (e instanceof AssistantAborted) {
          // User pressed stop — keep the partial answer so the session stays intact.
          const partial = cleanText(e.partial).trim();
          if (partial) {
            await db.assistantMessage
              .create({ data: { chatId, role: "assistant", content: partial, toolsUsed: e.toolsUsed } })
              .catch(() => {});
          }
          await db.assistantChat
            .update({ where: { id: chatId }, data: { updatedAt: new Date() } })
            .catch(() => {});
          send({ type: "aborted", chatId });
        } else {
          // Roll back the empty chat if the very first turn failed.
          if (isNewChat) {
            await db.assistantChat.delete({ where: { id: chatId } }).catch(() => {});
          }
          if (e instanceof AssistantError) {
            send({ type: "error", error: e.message, code: e.code });
          } else {
            console.error("[assistant] error:", e);
            send({ type: "error", error: "Terjadi kesalahan pada server asisten." });
          }
        }
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
