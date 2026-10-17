/**
 * Control markers understood ONLY by the deterministic fake model + fake
 * gateway (tests, CI, E2E — PLAN §11.1). They travel inside the *system
 * prompt* (e.g. via the scene premise or a director note), so tests can steer
 * fake behavior without any global state or injection seam. The real gateway
 * ignores them entirely; they are inert text.
 */

export const FAKE_FAIL_BEFORE = "[[fake:fail-before]]";
export const FAKE_FAIL_MID_RE = /\[\[fake:fail-mid:(\d+)\]\]/;
export const FAKE_CHUNKS_RE = /\[\[fake:chunks:([^\]]+)\]\]/;
export const FAKE_DELAY_RE = /\[\[fake:delay:(\d+)\]\]/;
export const FAKE_NO_DECISION = "[[fake:no-decision]]";
export const FAKE_ENDING = "[[fake:ending]]";
export const FAKE_NO_FACTS = "[[fake:no-facts]]";
export const FAKE_OPTIONS_BAD = "[[fake:options-bad]]";

export type FakeStreamScript = {
  chunks: string[] | null;
  delayMs: number;
  failBefore: boolean;
  failMidAfter: number | null;
};

export function parseFakeStreamScript(requestText: string): FakeStreamScript {
  const chunksMarker = FAKE_CHUNKS_RE.exec(requestText);
  const delayMarker = FAKE_DELAY_RE.exec(requestText);
  const failMid = FAKE_FAIL_MID_RE.exec(requestText);
  return {
    chunks: chunksMarker?.[1] ? chunksMarker[1].split("|") : null,
    delayMs: delayMarker?.[1] ? Number(delayMarker[1]) : 0,
    failBefore: requestText.includes(FAKE_FAIL_BEFORE),
    failMidAfter: failMid?.[1] ? Number(failMid[1]) : null,
  };
}
