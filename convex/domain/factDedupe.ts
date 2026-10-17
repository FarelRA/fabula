import { jaccard, normalizedEqual, tokenize } from "../lib/text";

/**
 * Fact dedupe (PLAN §3.4): candidates are compared against the existing
 * ledger and against each other; near-duplicates are dropped before insert.
 */

export const FACT_DUPLICATE_THRESHOLD = 0.8;

export function isDuplicateFact(
  candidate: string,
  existing: string[],
  threshold = FACT_DUPLICATE_THRESHOLD,
): boolean {
  const candidateTokens = tokenize(candidate);
  for (const text of existing) {
    if (normalizedEqual(candidate, text)) return true;
    if (jaccard(candidateTokens, tokenize(text)) >= threshold) return true;
  }
  return false;
}

export function dedupeFactCandidates(
  candidates: string[],
  existing: string[],
  threshold = FACT_DUPLICATE_THRESHOLD,
): string[] {
  const kept: string[] = [];
  const seen = [...existing];
  for (const candidate of candidates) {
    if (isDuplicateFact(candidate, seen, threshold)) continue;
    kept.push(candidate);
    seen.push(candidate);
  }
  return kept;
}
