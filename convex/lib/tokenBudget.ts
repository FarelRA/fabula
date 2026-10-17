/**
 * Token budget policy (PLAN §7.6).
 *
 * Target: system ≤ 25% of usable context. Compaction order:
 *   1. drop oldest context beats (never below `minContextBeats`)
 *   2. compact memory first, then world / relations / identity
 *   3. flag overBudget for the caller (retry with halved context)
 *
 * Contract/boundaries/director/mode blocks are NEVER shrunk.
 */

export function estimateTokens(text: string): number {
  // Provider tokenizers arrive with the real gateway in Phase 2; chars/4 is
  // the documented fallback (PLAN §19.1 item 7).
  return Math.ceil(text.length / 4);
}

export type Block = { key: string; text: string };

export const SYSTEM_TARGET_PCT = 0.25;

export const NEVER_SHRINK: ReadonlySet<string> = new Set([
  "contract",
  "boundaries",
  "directorNotes",
  "mode",
]);

const SHRINK_ORDER = ["memory", "world", "relations", "identity"] as const;
const MIN_BLOCK_CHARS = 200;

export function computeUsable(
  contextWindow: number,
  outputReserve: number,
  protocolOverhead = 512,
): number {
  return Math.max(0, contextWindow - outputReserve - protocolOverhead);
}

export function systemTokenBudget(usable: number): number {
  return Math.floor(usable * SYSTEM_TARGET_PCT);
}

export type FitResult = {
  blocks: Block[];
  context: Block[];
  systemTokens: number;
  targetTokens: number;
  droppedContext: number;
  shrunkBlocks: string[];
  overBudget: boolean;
};

function renderSystem(blocks: Block[]): string {
  return blocks.map((b) => `${b.key}:\n${b.text}`).join("\n\n");
}

export function fitToBudget(args: {
  blocks: Block[];
  context: Block[];
  contextWindow: number;
  outputReserve: number;
  minContextBeats?: number;
}): FitResult {
  const minContext = args.minContextBeats ?? 4;
  const usable = computeUsable(args.contextWindow, args.outputReserve);
  const target = systemTokenBudget(usable);

  const blocks = args.blocks.map((b) => ({ ...b }));
  const context = args.context.slice();
  let droppedContext = 0;
  const shrunkBlocks: string[] = [];

  const tokens = (): number => estimateTokens(renderSystem(blocks));

  // (1) drop oldest context beats first.
  while (tokens() > target && context.length > minContext) {
    context.shift();
    droppedContext += 1;
  }

  // (2) shrink compactable blocks (memory → world → relations → identity).
  for (const key of SHRINK_ORDER) {
    if (tokens() <= target) break;
    const index = blocks.findIndex((b) => b.key === key);
    const original = blocks[index];
    if (index === -1 || !original) continue;
    let text = original.text;
    while (tokens() > target && text.length > MIN_BLOCK_CHARS) {
      text = text.slice(0, Math.max(MIN_BLOCK_CHARS, Math.floor(text.length / 2)));
      blocks[index] = { key, text: `${text} …` };
      if (!shrunkBlocks.includes(key)) shrunkBlocks.push(key);
    }
  }

  // (3) Never touch protected blocks — report overBudget for the caller.
  const systemTokens = tokens();
  return {
    blocks,
    context,
    systemTokens,
    targetTokens: target,
    droppedContext,
    shrunkBlocks,
    overBudget: systemTokens > target,
  };
}
