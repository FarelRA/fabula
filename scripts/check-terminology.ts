import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Terminology lint (PLAN §11.6): the words "thread" and "agent" never appear
 * in user-facing strings. We scan string literals and JSX text in src/ and
 * fail the build on any hit.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");

const STRING_PATTERNS = [
  /"[^"\n]*\b(thread|agent)s?\b[^"\n]*"/i,
  /'[^'\n]*\b(thread|agent)s?\b[^'\n]*'/i,
  /`[^`\n]*\b(thread|agent)s?\b[^`\n]*`/i,
  />[^<>{}\n]*\b(thread|agent)s?\b[^<>{}\n]*</i,
];

// Frozen keymap action IDs (Appendix B) are internal identifiers, never
// rendered. The user-facing label for this action is "Jump to latest".
const ALLOWED_IDENTIFIERS = [/\bthread\.jumpToLatest\b/];

const findings: string[] = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    const lines = readFileSync(full, "utf8").split("\n");
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
        return;
      }
      if (ALLOWED_IDENTIFIERS.some((pattern) => pattern.test(line))) {
        return;
      }
      if (STRING_PATTERNS.some((pattern) => pattern.test(line))) {
        findings.push(`${full.replace(root + "/", "")}:${index + 1}  ${trimmed}`);
      }
    });
  }
}

walk(srcDir);

if (findings.length > 0) {
  console.error(
    `Forbidden user-facing terms ("thread"/"agent") found in src/:\n${findings.join("\n")}`,
  );
  process.exit(1);
}
console.log("Terminology check passed: no internal jargon in user-facing strings.");
