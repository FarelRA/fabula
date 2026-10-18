/**
 * Client-side file download (PLAN §12 Phase 7.3): exports are generated
 * in-browser from the query bundle — no server file storage, no REST layer.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mimeType: string,
): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export const MARKDOWN_MIME = "text/markdown;charset=utf-8";
export const JSON_MIME = "application/json;charset=utf-8";
