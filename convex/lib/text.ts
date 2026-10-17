/**
 * Text utilities for voice/fact similarity (token overlap heuristics).
 * Deterministic, dependency-free, unit-tested.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "by",
  "for", "with", "is", "are", "was", "were", "be", "it", "its", "this",
  "that", "as", "from", "i", "you", "he", "she", "they", "we", "not", "no",
]);

export function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((token) => (token.length > 2 || /\d/.test(token)) && !STOPWORDS.has(token));
  return new Set(tokens);
}

/** Jaccard similarity over token sets, in [0, 1]. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function similarText(a: string, b: string, threshold: number): boolean {
  return jaccard(tokenize(a), tokenize(b)) >= threshold;
}

export function normalizedEqual(a: string, b: string): boolean {
  return a.toLowerCase().replace(/\s+/g, " ").trim() === b.toLowerCase().replace(/\s+/g, " ").trim();
}
