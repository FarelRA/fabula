import { generateObject, jsonSchema as aiJsonSchema, streamText } from "ai";
import { z } from "zod";
import { assertPromptMessages } from "./gateway";
import type { GenerationRequest, ModelGateway, ObjectRequest } from "./gateway";
import { contextWindowFor, resolveLanguageModel } from "./modelRegistry";
import { isStrictCompatible, stripOptionalNulls, toStrictJsonSchema } from "./strictJsonSchema";

/**
 * Real ModelGateway on the Vercel AI SDK. Provider-agnostic:
 * the ref string ("openai/gpt-4.1", "anthropic/claude-sonnet-4.5", …) is
 * resolved by lib/modelRegistry.ts. Structured outputs are validated twice:
 * by the provider (JSON schema) and by us (zod) before anything is persisted.
 * Provider schemas are rewritten for strict structured outputs (see
 * strictJsonSchema.ts); free-form records fall back to non-strict JSON.
 */

export class AiSdkGateway implements ModelGateway {
  async *stream(req: GenerationRequest): AsyncIterable<string> {
    assertPromptMessages(req.messages);
    const result = streamText({
      model: resolveLanguageModel(req.model),
      system: req.system,
      messages: req.messages,
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
    });
    for await (const delta of result.textStream) {
      yield delta;
    }
  }

  async object<T>(req: ObjectRequest<T>): Promise<T> {
    assertPromptMessages(req.messages);
    const jsonSchema = toStrictJsonSchema(
      z.toJSONSchema(req.schema, { io: "output" }),
    ) as Record<string, unknown>;
    const { object } = await generateObject({
      model: resolveLanguageModel(req.model),
      system: req.system,
      messages: req.messages,
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
      // Strict schemas cannot express free-form records (e.g. the field regen
      // patch object); those calls use relaxed JSON output and rely on zod.
      providerOptions: isStrictCompatible(jsonSchema)
        ? undefined
        : { openai: { strictJsonSchema: false } },
      schema: aiJsonSchema(jsonSchema, {
        validate: (value: unknown) => {
          const parsed = req.schema.safeParse(stripOptionalNulls(jsonSchema, value));
          return parsed.success
            ? { success: true as const, value: parsed.data }
            : {
                success: false as const,
                error: new Error("Model output failed schema validation"),
              };
        },
      }),
    });
    return req.schema.parse(object);
  }

  contextWindow(model: string): number {
    return contextWindowFor(model);
  }
}
