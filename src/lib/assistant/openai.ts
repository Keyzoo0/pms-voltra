import { TOOL_DECLARATIONS, executeTool } from "./tools";
import {
  AssistantAborted,
  AssistantError,
  asQuestion,
  buildSystemPrompt,
  MAX_STEPS,
  type AssistantResult,
  type Attachment,
  type ChatMessage,
  type RunOptions,
} from "./shared";

/**
 * Qwen execution engine (OpenAI-compatible chat completions via DashScope).
 * Features: token-level SSE streaming (deltas + reasoning), multi-round tool
 * loop, parallel tool calls, abort/interrupt support, transient-error retries
 * with backoff, tool-result compaction, vision-model switching, and the
 * ask_user interactive-question flow.
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

type StreamCallbacks = {
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
  signal?: AbortSignal;
};

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

/** Parse an OpenAI-style SSE stream, emitting deltas and assembling tool calls. */
async function readStream(
  res: Response,
  cb: StreamCallbacks,
  state: { emitted: boolean },
): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const reader = res.body?.getReader();
  if (!reader) throw new AssistantError("Provider tidak mengirim stream.", "upstream");

  const decoder = new TextDecoder();
  let buf = "";
  let content = "";
  const calls: { id: string; name: string; arguments: string }[] = [];

  const handle = (line: string) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let json: {
      choices?: {
        delta?: {
          content?: string | null;
          reasoning_content?: string | null;
          tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
        };
      }[];
    };
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }
    const delta = json?.choices?.[0]?.delta;
    if (!delta) return;
    if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
      state.emitted = true;
      cb.onReasoning?.(delta.reasoning_content);
    }
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      state.emitted = true;
      cb.onDelta?.(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const i = typeof tc.index === "number" ? tc.index : calls.length;
        while (calls.length <= i) calls.push({ id: "", name: "", arguments: "" });
        if (tc.id) calls[i].id = tc.id;
        if (tc.function?.name) calls[i].name = tc.function.name;
        if (tc.function?.arguments) calls[i].arguments += tc.function.arguments;
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      handle(buf.slice(0, idx));
      buf = buf.slice(idx + 1);
    }
  }
  handle(buf);

  const tool_calls: ToolCall[] | undefined = calls.length
    ? calls
        .filter((c) => c.name)
        .map((c, i) => ({
          id: c.id || `call_${i}`,
          type: "function" as const,
          function: { name: c.name, arguments: c.arguments },
        }))
    : undefined;
  return { content: content || null, tool_calls: tool_calls?.length ? tool_calls : undefined };
}

async function callChat(model: string, messages: OAMessage[], cb: StreamCallbacks = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AssistantError("OPENAI_API_KEY belum dikonfigurasi di server.", "no_key");

  let lastErr: AssistantError | null = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await sleep(attempt === 1 ? 1000 : 3000);

    let res: Response;
    try {
      res = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        signal: cb.signal,
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
          stream: true,
        }),
      });
    } catch (e) {
      if (cb.signal?.aborted) throw e;
      lastErr = new AssistantError("Tidak bisa menghubungi penyedia AI (jaringan).", "upstream");
      continue;
    }

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      const e = json?.error;
      const msg =
        (typeof e === "string" ? e : e?.message) ||
        `Provider error (${res.status}). Periksa OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL.`;
      lastErr = new AssistantError(typeof msg === "string" ? msg : JSON.stringify(msg), "upstream");
      // Retry only transient failures (rate limit / server side).
      if (res.status !== 429 && res.status < 500) break;
      continue;
    }

    const state = { emitted: false };
    try {
      return await readStream(res, cb, state);
    } catch (e) {
      if (cb.signal?.aborted) throw e;
      lastErr = new AssistantError("Koneksi ke penyedia AI terputus.", "upstream");
      // Tokens may already be on screen — retrying would duplicate them.
      if (state.emitted) break;
    }
  }
  throw lastErr ?? new AssistantError("Gagal menghubungi penyedia AI.", "upstream");
}

export async function runOpenAICompatible(
  history: ChatMessage[],
  opts: RunOptions = {},
): Promise<AssistantResult> {
  const { onEvent, signal } = opts;
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
    onEvent?.({ kind: "thinking" });
    let roundText = "";
    let choice: { content: string | null; tool_calls?: ToolCall[] };
    try {
      choice = await callChat(model, messages, {
        signal,
        onDelta: (text) => {
          roundText += text;
          onEvent?.({ kind: "delta", text });
        },
        onReasoning: (text) => onEvent?.({ kind: "reasoning", text }),
      });
    } catch (e) {
      if (signal?.aborted) throw new AssistantAborted(roundText, toolsUsed);
      throw e;
    }
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
    onEvent?.({ kind: "tools", tools: calls.map((c) => c.function.name) });
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
    if (signal?.aborted) throw new AssistantAborted("", toolsUsed);
  }

  return {
    type: "answer",
    reply:
      "Permintaan ini butuh terlalu banyak langkah dalam satu giliran. Sebagian mungkin sudah dieksekusi — cek hasilnya, lalu lanjutkan dengan permintaan yang lebih spesifik.",
    toolsUsed,
  };
}
