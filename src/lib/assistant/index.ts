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
import { runOpenAICompatible } from "./openai";

export { AssistantError };
export type { ChatMessage, AssistantResult, Attachment };

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function provider(): "gemini" | "openai" {
  const p = process.env.AI_PROVIDER?.toLowerCase().trim();
  if (p === "openai" || p === "qwen" || p === "openrouter") return "openai";
  if (p === "gemini") return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "gemini";
}

// ── Gemini (generateContent + function calling) ───────────────
type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function geminiUserParts(m: ChatMessage): GeminiPart[] {
  let text = m.content ?? "";
  const atts = m.attachments ?? [];
  for (const a of atts) {
    if (a.kind === "document") text += `\n\n--- Dokumen terlampir: ${a.name} ---\n${a.text}\n--- akhir dokumen ---`;
  }
  const images = atts.filter((a) => a.kind === "image").length;
  if (images > 0) text += `\n\n[${images} gambar dilampirkan]`;
  return [{ text: text || "(tanpa teks)" }];
}

async function callGemini(contents: GeminiContent[]): Promise<GeminiContent> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AssistantError("GEMINI_API_KEY belum dikonfigurasi di server.", "no_key");
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json?.error?.message || `Gemini API error (${res.status}). Periksa GEMINI_API_KEY / GEMINI_MODEL.`;
    throw new AssistantError(msg, "upstream");
  }
  const content = json?.candidates?.[0]?.content as GeminiContent | undefined;
  if (!content) {
    const blocked = json?.promptFeedback?.blockReason;
    throw new AssistantError(
      blocked ? `Permintaan diblokir (${blocked}).` : "Model tidak mengembalikan jawaban.",
      "upstream",
    );
  }
  return content;
}

async function runGemini(history: ChatMessage[]): Promise<AssistantResult> {
  const contents: GeminiContent[] = history
    .filter((m) => m.content.trim() || (m.attachments?.length ?? 0) > 0)
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: geminiUserParts(m) }));

  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const content = await callGemini(contents);
    const parts = content.parts ?? [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);

    if (calls.length === 0) {
      const reply = parts.map((p) => p.text).filter(Boolean).join("\n").trim();
      return { type: "answer", reply: reply || "Maaf, saya tidak punya jawaban untuk itu.", toolsUsed };
    }

    const ask = calls.find((c) => c.name === "ask_user");
    if (ask) return asQuestion(ask.args ?? {}, toolsUsed);

    contents.push({ role: "model", parts });
    const responseParts: GeminiPart[] = [];
    for (const call of calls) {
      toolsUsed.push(call.name);
      let result: unknown;
      try {
        result = await executeTool(call.name, call.args ?? {});
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    type: "answer",
    reply: "Permintaan ini butuh terlalu banyak langkah. Coba persempit pertanyaannya.",
    toolsUsed,
  };
}

/** Run a full chat turn (resolving tool calls / questions) via the configured provider. */
export async function runAssistant(history: ChatMessage[]): Promise<AssistantResult> {
  if (history.filter((m) => m.content.trim() || (m.attachments?.length ?? 0) > 0).length === 0) {
    throw new AssistantError("Pesan kosong.", "input");
  }
  return provider() === "openai" ? runOpenAICompatible(history) : runGemini(history);
}
