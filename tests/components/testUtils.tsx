import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom shims for Radix/cmdk (pointer capture, ResizeObserver, scrollIntoView)
 * and a matchMedia width stub for the responsive shell tests.
 */

export function installDomShims(): void {
  if (typeof window === "undefined") return;

  // jsdom defines matchMedia on the Window prototype, which vitest's global
  // population does not copy, always install a deterministic stub.
  window.matchMedia = ((query: string) =>
    makeMediaQueryList(query, false)) as typeof window.matchMedia;

  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }

  const proto = Element.prototype as Element & {
    scrollIntoView?: () => void;
    hasPointerCapture?: () => boolean;
    releasePointerCapture?: () => void;
    setPointerCapture?: () => void;
  };
  proto.scrollIntoView ??= () => {};
  proto.hasPointerCapture ??= () => false;
  proto.releasePointerCapture ??= () => {};
  proto.setPointerCapture ??= () => {};
}

function makeMediaQueryList(query: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

/** Stub matchMedia so `(min-width: Npx)` queries answer for the given width. */
export function stubMatchMedia(width: number): void {
  window.matchMedia = ((query: string) => {
    const minWidth = /min-width:\s*(\d+)px/.exec(query);
    const matches = minWidth?.[1] ? width >= Number(minWidth[1]) : false;
    return makeMediaQueryList(query, matches);
  }) as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});
