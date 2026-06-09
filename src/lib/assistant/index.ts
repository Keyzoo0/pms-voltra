import { AssistantError, type AssistantResult, type Attachment, type ChatMessage } from "./shared";
import { runOpenAICompatible } from "./openai";

export { AssistantError };
export type { ChatMessage, AssistantResult, Attachment };

/**
 * Run a full chat turn (resolving tool calls / clarifying questions).
 * The assistant runs entirely on Qwen via the OpenAI-compatible backend
 * (DashScope) — configured by OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL
 * and OPENAI_VISION_MODEL for image input.
 */
export async function runAssistant(history: ChatMessage[]): Promise<AssistantResult> {
  if (history.filter((m) => m.content.trim() || (m.attachments?.length ?? 0) > 0).length === 0) {
    throw new AssistantError("Pesan kosong.", "input");
  }
  return runOpenAICompatible(history);
}
