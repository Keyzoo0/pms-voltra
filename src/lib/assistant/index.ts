import { TOOL_DECLARATIONS, executeTool } from "./tools";
import {
  AssistantError,
  MAX_STEPS,
  SYSTEM_PROMPT,
  type ChatMessage,
} from "./shared";
import { runOpenAICompatible } from "./openai";

export { AssistantError };
export type { ChatMessage };

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** Which backend to use: explicit AI_PROVIDER, else auto-detect by configured keys. */
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
      json?.error?.message ||
      `Gemini API error (${res.status}). Periksa GEMINI_API_KEY / GEMINI_MODEL.`;
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

async function runGemini(
  history: ChatMessage[],
): Promise<{ reply: string; toolsUsed: string[] }> {
  const contents: GeminiContent[] = history
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const content = await callGemini(contents);
    const parts = content.parts ?? [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);

    if (calls.length === 0) {
      const reply = parts.map((p) => p.text).filter(Boolean).join("\n").trim();
      return { reply: reply || "Maaf, saya tidak punya jawaban untuk itu.", toolsUsed };
    }

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
    reply:
      "Permintaan ini butuh terlalu banyak langkah. Coba persempit atau pecah menjadi pertanyaan yang lebih spesifik.",
    toolsUsed,
  };
}

/** Run a full chat turn (resolving tool calls) using the configured provider. */
export async function runAssistant(
  history: ChatMessage[],
): Promise<{ reply: string; toolsUsed: string[] }> {
  if (history.filter((m) => m.content.trim()).length === 0) {
    throw new AssistantError("Pesan kosong.", "input");
  }
  return provider() === "openai" ? runOpenAICompatible(history) : runGemini(history);
}
