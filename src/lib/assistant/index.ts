import {
  AssistantAborted,
  AssistantError,
  type AssistantResult,
  type Attachment,
  type ChatMessage,
  type OnStatus,
  type RunOptions,
  type StatusEvent,
} from "./shared";
import { runOpenAICompatible } from "./openai";

export { AssistantError, AssistantAborted };
export type { ChatMessage, AssistantResult, Attachment, OnStatus, RunOptions, StatusEvent };

/**
 * Run a full chat turn (resolving tool calls / clarifying questions).
 * The assistant runs entirely on Qwen via the OpenAI-compatible backend
 * (DashScope) — configured by OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL
 * and OPENAI_VISION_MODEL for image input.
 * `opts.onEvent` receives live progress events (status / token deltas /
 * reasoning) for streaming to the UI; `opts.signal` interrupts generation
 * (throws AssistantAborted carrying the partial answer).
 */
export async function runAssistant(
  history: ChatMessage[],
  opts: RunOptions = {},
): Promise<AssistantResult> {
  if (history.filter((m) => m.content.trim() || (m.attachments?.length ?? 0) > 0).length === 0) {
    throw new AssistantError("Pesan kosong.", "input");
  }
  return runOpenAICompatible(history, opts);
}
