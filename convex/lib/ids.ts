/**
 * Id + token helpers. Kept dependency-free and defensive: the Convex default
 * runtime does not guarantee the full Web Crypto surface, so we fall back.
 */

export function randomToken(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Lexicographically stable sort key for role ordering (spotlight priority). */
export function sortKeyFor(index: number): string {
  return String(index).padStart(6, "0");
}
