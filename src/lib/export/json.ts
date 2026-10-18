import type { ExportBundle } from "./types";

/**
 * JSON export: the bundle is written exactly as read, so ids, branch links,
 * candidates and facts all survive `JSON.parse`/`jq` without transformation.
 * `exportedAt` is injected here so the query stays pure.
 */
export function serializeSceneToJson(
  bundle: ExportBundle,
  options: { exportedAt?: string } = {},
): string {
  return JSON.stringify(
    {
      ...bundle,
      exportedAt: options.exportedAt ?? new Date().toISOString(),
    },
    null,
    2,
  );
}

export function exportFilename(
  title: string,
  extension: "md" | "json",
  date: Date = new Date(),
): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const day = date.toISOString().slice(0, 10);
  return `${slug || "scene"}-${day}.${extension}`;
}
