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

  try {
    const result = await runAssistant(history);

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

    return NextResponse.json({ chatId, title, ...result });
  } catch (e) {
    // Roll back the empty chat if the very first turn failed.
    if (!body.chatId) {
      await db.assistantChat.delete({ where: { id: chatId } }).catch(() => {});
    }
    if (e instanceof AssistantError) {
      const status = e.code === "no_key" ? 503 : e.code === "input" ? 400 : 502;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[assistant] error:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server asisten." }, { status: 500 });
  }
}
