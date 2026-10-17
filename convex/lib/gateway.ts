import type { ZodType } from "zod";

/**
 * ModelGateway — the single seam between Fabula and any model provider
 * (PLAN §3.3, §13.4). Real implementations wrap the Vercel AI SDK; tests and
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

export interface ModelGateway {
  /** Yields text deltas in order (streaming turn output). */
  stream(req: GenerationRequest): AsyncIterable<string>;
  /** Requests a structured object and validates it against the schema. */
  object<T>(req: ObjectRequest<T>): Promise<T>;
  /** Context window in tokens, for budget math. */
  contextWindow(model: string): number;
}

export const DEFAULT_CONTEXT_WINDOW = 128_000;
