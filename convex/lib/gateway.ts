import type { ZodType } from "zod";

/**
 * ModelGateway, the single seam between Fabula and any model provider
 *. Real implementations wrap the Vercel AI SDK; tests and
 * E2E runs use FakeGateway so the whole backend is deterministic offline.
 *
 * Structured outputs carry their zod schema: the fake gateway parses with it,
 * the real gateway converts it to a JSON Schema for the provider and
 * re-validates the response.
 */

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type GenerationRequest = {
  /** "provider/model", e.g. "openai/gpt-4.1" */
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type ObjectRequest<T> = GenerationRequest & {
  schema: ZodType<T>;
  /** Stable name of the structured task, e.g. "options" | "casting". */
  schemaName: string;
};

/** Real providers reject prompts that carry no messages at all. */
export const EMPTY_PROMPT_ERROR =
  "Model prompts need at least one message; the provider rejects empty message lists.";

/** Fails loudly before a request can go out with an empty message list. */
export function assertPromptMessages(messages: ChatMessage[]): void {
  if (messages.length === 0) throw new Error(EMPTY_PROMPT_ERROR);
}

/**
 * The compiled beat chain doubles as the message list, so context-free
 * prompts (a fresh scene has no beats yet: the opening draft, sample lines)
 * would go out empty and the AI SDK rejects those with InvalidPromptError
 * while streaming nothing. Hand the model a short cue instead.
 */
export function ensurePromptMessages(messages: ChatMessage[], cue: string): ChatMessage[] {
  return messages.length > 0 ? messages : [{ role: "user", content: cue }];
}

export interface ModelGateway {
  /** Yields text deltas in order (streaming turn output). */
  stream(req: GenerationRequest): AsyncIterable<string>;
  /** Requests a structured object and validates it against the schema. */
  object<T>(req: ObjectRequest<T>): Promise<T>;
  /** Context window in tokens, for budget math. */
  contextWindow(model: string): number;
}

export const DEFAULT_CONTEXT_WINDOW = 128_000;
