/**
 * Token budget policy (PLAN §7.6).
 *
 * Two constraints hold at once:
 *   1. system ≤ 25% of usable context (module blocks stay small)
 *   2. total (system + context + output reserve) ≤ usable window
 *
 * Compaction order:
 *   1. drop oldest context beats (never below `minContextBeats`)
 *   2. compact memory first, then world / relations / identity
 *   3. flag overBudget for the caller (retry / record the action)
 *
 * Contract/boundaries/director/mode blocks are NEVER shrunk.
 */

export function estimateTokens(text: string): number {
  // Provider tokenizers arrive with the real gateway; chars/4 is the
  // documented fallback (PLAN §19.1 item 7).
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

/** Canonical rendering of the system prompt from its blocks. */
export function renderBlocks(blocks: Block[]): string {
  return blocks.map((block) => `${block.key}:\n${block.text}`).join("\n\n");
}

export type FitResult = {
  blocks: Block[];
  context: Block[];
  systemTokens: number;
  targetTokens: number;
  droppedContext: number;
  shrunkBlocks: string[];
  overBudget: boolean;
  totalTokens: number;
};

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

  const blocks = args.blocks.map((block) => ({ ...block }));
  const context = args.context.slice();
  let droppedContext = 0;
  const shrunkBlocks: string[] = [];

  const systemTokens = (): number => estimateTokens(renderBlocks(blocks));
  const contextTokens = (): number =>
    context.reduce((sum, block) => sum + estimateTokens(block.text), 0);
  const totalTokens = (): number => systemTokens() + contextTokens() + args.outputReserve;

  // (1) Drop oldest context while the TOTAL exceeds the usable window.
  while (totalTokens() > usable && context.length > minContext) {
    context.shift();
    droppedContext += 1;
  }

  // (2) Shrink compactable blocks (memory → world → relations → identity)
  //     while either constraint is violated. Protected blocks are untouched.
  for (const key of SHRINK_ORDER) {
    if (systemTokens() <= target && totalTokens() <= usable) break;
    const index = blocks.findIndex((block) => block.key === key);
    const original = blocks[index];
    if (index === -1 || !original) continue;
    let text = original.text;
    while (
      (systemTokens() > target || totalTokens() > usable) &&
      text.length > MIN_BLOCK_CHARS
    ) {
      text = text.slice(0, Math.max(MIN_BLOCK_CHARS, Math.floor(text.length / 2)));
      blocks[index] = { key, text: `${text} …` };
      if (!shrunkBlocks.includes(key)) shrunkBlocks.push(key);
    }
  }

  // (3) Never touch protected blocks — report overBudget for the caller.
  const finalSystem = systemTokens();
  const finalTotal = totalTokens();
  return {
    blocks,
    context,
    systemTokens: finalSystem,
    targetTokens: target,
    droppedContext,
    shrunkBlocks,
    overBudget: finalSystem > target || finalTotal > usable,
    totalTokens: finalTotal,
  };
}
