import { generateObject, jsonSchema as aiJsonSchema, streamText } from "ai";
import { z } from "zod";
import type { GenerationRequest, ModelGateway, ObjectRequest } from "./gateway";
import { contextWindowFor, resolveLanguageModel } from "./modelRegistry";

/**
 * Real ModelGateway on the Vercel AI SDK (PLAN §3.3, §5). Provider-agnostic:
 * the ref string ("openai/gpt-4.1", "anthropic/claude-sonnet-4.5", …) is
 * resolved by lib/modelRegistry.ts. Structured outputs are validated twice:
 * by the provider (JSON schema) and by us (zod) before anything is persisted.
 */

export class AiSdkGateway implements ModelGateway {
  async *stream(req: GenerationRequest): AsyncIterable<string> {
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
    const jsonSchema = z.toJSONSchema(req.schema, { io: "output" });
    const { object } = await generateObject({
      model: resolveLanguageModel(req.model),
      system: req.system,
      messages: req.messages,
      temperature: req.temperature,
      maxOutputTokens: req.maxTokens,
      schema: aiJsonSchema(jsonSchema as Record<string, unknown>, {
        validate: (value: unknown) => {
          const parsed = req.schema.safeParse(value);
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
