import { TOOL_DECLARATIONS, executeTool } from "./tools";
import {
  AssistantError,
  asQuestion,
  MAX_STEPS,
  SYSTEM_PROMPT,
  type AssistantResult,
  type Attachment,
  type ChatMessage,
} from "./shared";

/**
 * OpenAI-compatible chat-completions backend (Qwen via DashScope, OpenRouter,
 * Groq, etc.). Supports tool calling, the ask_user interactive question flow,
 * document text context, and image (vision) input.
 * Env: OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_VISION_MODEL.
 */

const TOOLS = TOOL_DECLARATIONS.map((d) => ({
  type: "function" as const,
  function: {
    name: d.name,
    description: d.description,
    parameters: "parameters" in d ? d.parameters : { type: "object", properties: {} },
  },
}));

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type OAMessage =
  | { role: "system" | "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function baseUrl(): string {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function userContent(m: ChatMessage): string | ContentPart[] {
  const atts = m.attachments ?? [];
  const docs = atts.filter((a): a is Extract<Attachment, { kind: "document" }> => a.kind === "document");
  const images = atts.filter((a): a is Extract<Attachment, { kind: "image" }> => a.kind === "image");

  let text = m.content ?? "";
  for (const d of docs) {
    text += `\n\n--- Dokumen terlampir: ${d.name} ---\n${d.text}\n--- akhir dokumen ---`;
  }

  if (images.length === 0) return text || "(tanpa teks)";

  const parts: ContentPart[] = [
    { type: "text", text: text.trim() || "Tolong analisa gambar terlampir." },
  ];
  for (const img of images) parts.push({ type: "image_url", image_url: { url: img.url } });
  return parts;
}

async function callChat(model: string, messages: OAMessage[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AssistantError("OPENAI_API_KEY belum dikonfigurasi di server.", "no_key");

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      "HTTP-Referer": process.env.OPENAI_REFERER || "https://pms-voltra.vercel.app",
      "X-Title": "Voltra PMS",
    },
    body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.4 }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    const msg =
      (typeof e === "string" ? e : e?.message) ||
      `Provider error (${res.status}). Periksa OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL.`;
    throw new AssistantError(typeof msg === "string" ? msg : JSON.stringify(msg), "upstream");
  }
  const choice = json?.choices?.[0]?.message;
  if (!choice) throw new AssistantError("Model tidak mengembalikan jawaban.", "upstream");
  return choice as { content: string | null; tool_calls?: ToolCall[] };
}

export async function runOpenAICompatible(history: ChatMessage[]): Promise<AssistantResult> {
  const usable = history.filter((m) => m.content.trim() || (m.attachments?.length ?? 0) > 0);
  const hasImage = usable.some((m) => (m.attachments ?? []).some((a) => a.kind === "image"));
  const model = hasImage
    ? process.env.OPENAI_VISION_MODEL || "qwen3-vl-plus"
    : process.env.OPENAI_MODEL || "qwen-plus";

  const messages: OAMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const m of usable) {
    if (m.role === "user") messages.push({ role: "user", content: userContent(m) });
    else messages.push({ role: "assistant", content: m.content });
  }

  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const choice = await callChat(model, messages);
    const calls = choice.tool_calls ?? [];

    if (calls.length === 0) {
      return {
        type: "answer",
        reply: (choice.content ?? "").trim() || "Maaf, saya tidak punya jawaban untuk itu.",
        toolsUsed,
      };
    }

    // Interactive question takes priority — stop and ask the user.
    const ask = calls.find((c) => c.function.name === "ask_user");
    if (ask) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(ask.function.arguments || "{}");
      } catch {
        args = {};
      }
      return asQuestion(args, toolsUsed);
    }

    messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: calls });
    for (const call of calls) {
      toolsUsed.push(call.function.name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      let result: unknown;
      try {
        result = await executeTool(call.function.name, args);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ result }) });
    }
  }

  return {
    type: "answer",
    reply: "Permintaan ini butuh terlalu banyak langkah. Coba persempit pertanyaannya.",
    toolsUsed,
  };
}
