import { finalizeSingleBlock } from "./blocks";
import type { CompileResult, ModelRef, TemplateMap } from "./types";

/**
 * Director meta-agent prompt: floor ordering, decision points,
 * pacing, ending detection. Never writes in-fiction content.
 */
export function compileDirectorPrompt(args: {
  templates: TemplateMap;
  model: ModelRef;
  lastBeat: string;
  rolesLines: string;
  tensionsLine: string;
  turnMode: string;
  branchFrequency: string;
  contextWindow: number;
  outputReserve: number;
}): CompileResult {
  return finalizeSingleBlock({
    templates: args.templates,
    templateKey: "meta.director",
    vars: {
      lastBeat: args.lastBeat.length > 0 ? args.lastBeat : "(nothing yet)",
      roles: args.rolesLines.length > 0 ? args.rolesLines : "(none)",
      tensions: args.tensionsLine.length > 0 ? args.tensionsLine : "none",
      turnMode: args.turnMode,
      branchFrequency: args.branchFrequency,
    },
    messages: [{ role: "user", content: "Decide the floor and pacing now." }],
    mode: "directorMeta",
    model: args.model,
    contextWindow: args.contextWindow,
    outputReserve: args.outputReserve,
  });
}
