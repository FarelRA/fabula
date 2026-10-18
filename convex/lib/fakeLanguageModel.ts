import { mockModel } from "@convex-dev/agent";
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { parseFakeStreamScript } from "./fakeMarkers";

/**
 * Deterministic scripted LanguageModelV4 for tests/CI/E2E.
 * Behavior is steered by control markers that reach the system prompt (see
 * fakeMarkers.ts); without markers it produces a stable default turn text.
 */

export const FAKE_TURN_TEXT = "The rain keeps falling on the wrong door.";
export const FAKE_STREAM_ERROR = "Fake stream failure";

/** Same usage shape the agent package's own mock emits. */
const FAKE_USAGE = {
  inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};

const MODE_RE = /MODE:\s*([A-Za-z][A-Za-z-]*)/;

function promptText(options: LanguageModelV4CallOptions): string {
  return options.prompt
    .map((message) => {
      if (typeof message.content === "string") return message.content;
      return message.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("");
    })
    .join("\n");
}

export function buildFakeLanguageModel(): LanguageModelV4 {
  return mockModel({
    doStream: async (options) => {
      const text = promptText(options);
      const script = parseFakeStreamScript(text);
      const fullText = script.chunks ? script.chunks.join(" ") : FAKE_TURN_TEXT;
      const words = fullText.split(" ").filter((word) => word.length > 0);

      const chunks: LanguageModelV4StreamPart[] = [{ type: "stream-start", warnings: [] }];
      if (!script.failBefore) {
        chunks.push({ type: "text-start", id: "txt-0" });
        for (const [index, word] of words.entries()) {
          if (script.failMidAfter !== null && index >= script.failMidAfter) break;
          chunks.push({
            type: "text-delta",
            id: "txt-0",
            delta: index === 0 ? word : ` ${word}`,
          });
        }
        chunks.push({ type: "text-end", id: "txt-0" });
      }
      const failed = script.failBefore || script.failMidAfter !== null;
      if (failed) {
        chunks.push({ type: "error", error: FAKE_STREAM_ERROR });
      }
      chunks.push({
        type: "finish",
        finishReason: { unified: failed ? "error" : "stop", raw: undefined },
        usage: FAKE_USAGE,
      });

      // The mode marker is only used for diagnostics in the request body.
      const mode = MODE_RE.exec(text)?.[1]?.toLowerCase() ?? "turn";
      return {
        stream: simulateReadableStream({
          chunks,
          chunkDelayInMs: script.delayMs,
          initialDelayInMs: 0,
        }),
        request: { body: { fakeMode: mode } },
        response: { headers: {} },
      };
    },
  });
}
