import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { buildFakeLanguageModel } from "./fakeLanguageModel";

/**
 * Model resolution (PLAN §3.3, §13.4).
 *
 * Tiers resolve to "provider/model" refs in `lib/models.ts`; this module turns
 * a ref into an AI SDK LanguageModel. When the deterministic fake is active
 * (FABULA_MODEL_FAKE=1, or no process env at all — the test simulator), every
 * ref resolves to the scripted FakeLanguageModel.
 */

export function isFakeMode(): boolean {
  if (typeof process === "undefined") return true;
  return process.env.FABULA_MODEL_FAKE === "1";
}

export function splitModelRef(ref: string): { provider: string; modelId: string } {
  const slash = ref.indexOf("/");
  if (slash <= 0 || slash === ref.length - 1) {
    throw new Error(`Invalid model ref "${ref}" (expected "provider/model")`);
  }
  return { provider: ref.slice(0, slash), modelId: ref.slice(slash + 1) };
}

function readKey(name: string): string {
  const value = typeof process === "undefined" ? undefined : process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it on the Convex deployment, or use the deterministic fake (FABULA_MODEL_FAKE=1).`,
    );
  }
  return value;
}

export function resolveLanguageModel(ref: string): LanguageModel {
  if (isFakeMode()) return buildFakeLanguageModel();
  const { provider, modelId } = splitModelRef(ref);
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: readKey("OPENAI_API_KEY") }).chat(modelId);
    case "anthropic":
      return createAnthropic({ apiKey: readKey("ANTHROPIC_API_KEY") })(modelId);
    default:
      throw new Error(
        `Unknown model provider "${provider}" — add it in convex/lib/modelRegistry.ts`,
      );
  }
}

const CONTEXT_WINDOWS: Array<[string, number]> = [
  ["gpt-4.1", 1_000_000],
  ["gpt-5", 400_000],
  ["claude", 200_000],
  ["gemini", 1_000_000],
];

export function contextWindowFor(ref: string): number {
  const { modelId } = splitModelRef(ref);
  for (const [prefix, window] of CONTEXT_WINDOWS) {
    if (modelId.includes(prefix)) return window;
  }
  return 128_000;
}
