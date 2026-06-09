import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AssistantError, runAssistant, type Attachment, type ChatMessage } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

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
        text: o.text.slice(0, 8000),
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

  let body: { chatId?: string; content?: string; attachments?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : "";
  const attachments = sanitizeAttachments(body.attachments);
  if (!content.trim() && attachments.length === 0) {
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
    title = titleFrom(content, attachments);
    const chat = await db.assistantChat.create({ data: { ownerId, title }, select: { id: true } });
    chatId = chat.id;
  }

  // Persist the user message.
  await db.assistantMessage.create({
    data: {
      chatId,
      role: "user",
      content,
      attachments: attachments.length ? (attachments as unknown as object) : undefined,
    },
  });

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

  // Stream live progress (NDJSON lines) while the agent works, ending with a
  // "done" (or "error") event. The UI shows each step as it happens.
  const isNewChat = !body.chatId;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // client disconnected — keep running so the result is still persisted
        }
      };

      try {
        const result = await runAssistant(history, (ev) => send({ type: "status", ...ev }));

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
            data: { chatId, role: "assistant", content: result.reply, toolsUsed: result.toolsUsed },
          });
        }
        await db.assistantChat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });

        const { type: resultType, ...rest } = result;
        send({ type: "done", chatId, title, resultType, ...rest });
      } catch (e) {
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
      } finally {
        try {
          controller.close();
        } catch {}
      }
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
