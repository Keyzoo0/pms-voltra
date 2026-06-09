import { TOOL_DECLARATIONS, executeTool } from "./tools";
import {
  AssistantError,
  asQuestion,
  buildSystemPrompt,
  MAX_STEPS,
  type AssistantResult,
  type Attachment,
  type ChatMessage,
} from "./shared";

/**
 * Qwen execution engine (OpenAI-compatible chat completions via DashScope).
 * Features: multi-round tool loop, parallel tool calls, transient-error
 * retries with backoff, tool-result compaction, vision-model switching, and
 * the ask_user interactive-question flow.
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

const MAX_TOOL_RESULT_CHARS = 24_000;

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

function compactResult(result: unknown): string {
  let json: string;
  try {
    json = JSON.stringify({ result });
  } catch {
    json = JSON.stringify({ result: String(result) });
  }
  if (json.length > MAX_TOOL_RESULT_CHARS) {
    json =
      json.slice(0, MAX_TOOL_RESULT_CHARS) +
      `…"} [hasil dipotong — terlalu besar; persempit query (filter/limit) bila butuh detail lebih]`;
  }
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callChat(model: string, messages: OAMessage[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AssistantError("OPENAI_API_KEY belum dikonfigurasi di server.", "no_key");

  let lastErr: AssistantError | null = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 1000 : 3000);

    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.OPENAI_REFERER || "https://pms-voltra.vercel.app",
          "X-Title": "Voltra PMS",
        },
        body: JSON.stringify({
          model,
          messages,
          tools: TOOLS,
          tool_choice: "auto",
          parallel_tool_calls: true,
          temperature: 0.3,
        }),
      });
    } catch {
      lastErr = new AssistantError("Tidak bisa menghubungi penyedia AI (jaringan).", "upstream");
      continue;
    }

    const json = await res.json().catch(() => null);
    if (res.ok) {
      const choice = json?.choices?.[0]?.message;
      if (!choice) throw new AssistantError("Model tidak mengembalikan jawaban.", "upstream");
      return choice as { content: string | null; tool_calls?: ToolCall[] };
    }

    const e = json?.error;
    const msg =
      (typeof e === "string" ? e : e?.message) ||
      `Provider error (${res.status}). Periksa OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL.`;
    lastErr = new AssistantError(typeof msg === "string" ? msg : JSON.stringify(msg), "upstream");
    // Retry only transient failures (rate limit / server side).
    if (res.status !== 429 && res.status < 500) break;
  }
  throw lastErr ?? new AssistantError("Gagal menghubungi penyedia AI.", "upstream");
}

export async function runOpenAICompatible(history: ChatMessage[]): Promise<AssistantResult> {
  const usable = history.filter((m) => m.content.trim() || (m.attachments?.length ?? 0) > 0);
  const hasImage = usable.some((m) => (m.attachments ?? []).some((a) => a.kind === "image"));
  const model = hasImage
    ? process.env.OPENAI_VISION_MODEL || "qwen3-vl-plus"
    : process.env.OPENAI_MODEL || "qwen3.7-plus";

  const messages: OAMessage[] = [{ role: "system", content: buildSystemPrompt() }];
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
    // Execute independent calls of one round in parallel.
    const results = await Promise.all(
      calls.map(async (call) => {
        toolsUsed.push(call.function.name);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        try {
          return await executeTool(call.function.name, args);
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      }),
    );
    calls.forEach((call, i) => {
      messages.push({ role: "tool", tool_call_id: call.id, content: compactResult(results[i]) });
    });
  }

  return {
    type: "answer",
    reply:
      "Permintaan ini butuh terlalu banyak langkah dalam satu giliran. Sebagian mungkin sudah dieksekusi — cek hasilnya, lalu lanjutkan dengan permintaan yang lebih spesifik.",
    toolsUsed,
  };
}
