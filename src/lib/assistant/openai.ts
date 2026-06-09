import { TOOL_DECLARATIONS, executeTool } from "./tools";
import { AssistantError, MAX_STEPS, SYSTEM_PROMPT, type ChatMessage } from "./shared";

/**
 * OpenAI-compatible chat-completions backend (works with Qwen, Llama, etc. via
 * OpenRouter, Alibaba DashScope, Groq, Together, and similar gateways).
 * Configured with: OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL.
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
type OAMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function baseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

async function callChat(messages: OAMessage[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AssistantError("OPENAI_API_KEY belum dikonfigurasi di server.", "no_key");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      // Optional headers some gateways (e.g. OpenRouter) like to see.
      "HTTP-Referer": process.env.OPENAI_REFERER || "https://pms-voltra.vercel.app",
      "X-Title": "Voltra PMS",
    },
    body: JSON.stringify({
      model,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.4,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.error ||
      `Provider error (${res.status}). Periksa OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL.`;
    throw new AssistantError(typeof msg === "string" ? msg : JSON.stringify(msg), "upstream");
  }
  const choice = json?.choices?.[0]?.message;
  if (!choice) throw new AssistantError("Model tidak mengembalikan jawaban.", "upstream");
  return choice as { content: string | null; tool_calls?: ToolCall[] };
}

export async function runOpenAICompatible(
  history: ChatMessage[],
): Promise<{ reply: string; toolsUsed: string[] }> {
  const messages: OAMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content })),
  ];

  const toolsUsed: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const choice = await callChat(messages);
    const calls = choice.tool_calls ?? [];

    if (calls.length === 0) {
      return { reply: (choice.content ?? "").trim() || "Maaf, saya tidak punya jawaban untuk itu.", toolsUsed };
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
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ result }),
      });
    }
  }

  return {
    reply:
      "Permintaan ini butuh terlalu banyak langkah. Coba persempit atau pecah menjadi pertanyaan yang lebih spesifik.",
    toolsUsed,
  };
}
