import type { GenerationRequest, ModelGateway, ObjectRequest } from "./gateway";
import { DEFAULT_CONTEXT_WINDOW } from "./gateway";

/**
 * FakeGateway — deterministic, scripted model responses for unit tests, CI
 * and E2E (PLAN §11.1). Streams are matched by the "MODE: <name>" marker that
 * the prompt compiler places in system prompts; structured objects are
 * matched by `schemaName` and validated against the caller's schema exactly
 * like a real provider response would be.
 */

export type FakeScript = {
  streamChunks?: Record<string, string[]>;
  objects?: Record<string, unknown>;
  contextWindow?: number;
};

export const DEFAULT_FAKE_SCRIPT: FakeScript = {
  streamChunks: {
    turn: ["The ", "rain ", "keeps ", "falling."],
  },
  objects: {},
};

export function modeMarker(req: GenerationRequest): string {
  const match = /MODE:\s*([A-Za-z][A-Za-z-]*)/.exec(req.system);
  const marker = match?.[1];
  return marker ? marker.toLowerCase() : "turn";
}

export class FakeGateway implements ModelGateway {
  private readonly script: FakeScript;

  constructor(script: FakeScript = DEFAULT_FAKE_SCRIPT) {
    this.script = script;
  }

  async *stream(req: GenerationRequest): AsyncIterable<string> {
    const key = modeMarker(req);
    const chunks = this.script.streamChunks?.[key];
    if (!chunks) {
      throw new Error(`FakeGateway: no stream script for mode "${key}"`);
    }
    for (const chunk of chunks) {
      await Promise.resolve();
      yield chunk;
    }
  }

  async object<T>(req: ObjectRequest<T>): Promise<T> {
    const raw = this.script.objects?.[req.schemaName];
    if (raw === undefined) {
      throw new Error(`FakeGateway: no object script for "${req.schemaName}"`);
    }
    return req.schema.parse(raw);
  }

  contextWindow(): number {
    return this.script.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  }
}
