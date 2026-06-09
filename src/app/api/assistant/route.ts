import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { AssistantError, runAssistant, type ChatMessage } from "@/lib/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });
  }

  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "messages wajib berupa array." }, { status: 400 });
  }

  const messages: ChatMessage[] = raw
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-20); // keep recent context only

  if (messages.length === 0) {
    return NextResponse.json({ error: "Tidak ada pesan." }, { status: 400 });
  }

  try {
    const { reply, toolsUsed } = await runAssistant(messages);
    return NextResponse.json({ reply, toolsUsed });
  } catch (e) {
    if (e instanceof AssistantError) {
      const status = e.code === "no_key" ? 503 : e.code === "input" ? 400 : 502;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    console.error("[assistant] error:", e);
    return NextResponse.json({ error: "Terjadi kesalahan pada server asisten." }, { status: 500 });
  }
}
