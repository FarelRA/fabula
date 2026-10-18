import { finalizeSingleBlock } from "./blocks";
import type { CompileResult, ModelRef, TemplateMap } from "./types";

/**
 * Casting-agent prompts: full cast, cast regen (locks + vibe),
 * field regen (locks respected, locked fields are EXCLUDED from the prompt
 * and re-applied by the action).
 */

export function compileCastingPrompt(args: {
  templates: TemplateMap;
  model: ModelRef;
  premise: string;
  genre: string;
  settingEra: string;
  castSize: number;
  vibeSteer: string;
  humanRoleNote: string;
  contextWindow: number;
  outputReserve: number;
}): CompileResult {
  return finalizeSingleBlock({
    templates: args.templates,
    templateKey: "meta.casting",
    vars: {
      premise: args.premise,
      genre: args.genre,
      settingEra: args.settingEra,
      castSize: args.castSize,
      vibeSteer: args.vibeSteer.length > 0 ? args.vibeSteer : "none.",
      humanRoleNote: args.humanRoleNote.length > 0 ? ` ${args.humanRoleNote}` : "",
    },
    messages: [{ role: "user", content: "Produce the cast now." }],
    mode: "casting",
    model: args.model,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
  });
}

export function compileCastRegenPrompt(args: {
  templates: TemplateMap;
  model: ModelRef;
  castSize: number;
  locks: string[];
  vibe: string;
  castSummary: string;
  scene: string;
  contextWindow: number;
  outputReserve: number;
}): CompileResult {
  return finalizeSingleBlock({
    templates: args.templates,
    templateKey: "meta.castRegen",
    vars: {
      castSize: args.castSize,
      locks: args.locks.length > 0 ? args.locks.join(", ") : "none.",
      vibe: args.vibe.length > 0 ? args.vibe : "none.",
      castSummary: args.castSummary,
      scene: args.scene,
    },
    messages: [{ role: "user", content: "Produce the regenerated cast now." }],
    mode: "castRegen",
    model: args.model,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
  });
}

export function compileFieldRegenPrompt(args: {
  templates: TemplateMap;
  model: ModelRef;
  fields: string[];
  locks: string[];
  roleJson: string;
  scene: string;
  contextWindow: number;
  outputReserve: number;
}): CompileResult {
  return finalizeSingleBlock({
    templates: args.templates,
    templateKey: "meta.fieldRegen",
    vars: {
      fields: args.fields.join(", "),
      locks: args.locks.length > 0 ? args.locks.join(", ") : "none.",
      roleJson: args.roleJson,
      scene: args.scene,
    },
    messages: [{ role: "user", content: "Produce the regenerated field values now." }],
    mode: "fieldRegen",
    model: args.model,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
  });
}
