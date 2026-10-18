"use client";

import { useEffect } from "react";
import { isTypingTarget, resolveKey, DEFAULT_KEYMAP } from "@/lib/keymap";
import type { KeymapActionId, KeymapScope } from "@/lib/keymap";

/**
 * Bind registry actions to handlers for the lifetime of a component
 *. Only registered actions fire; typing in text fields swallows
 * bare-key bindings (⌘/Ctrl chords and `allowInInput` still work).
 */

export type KeyRegistration = {
  scope: KeymapScope;
  action: KeymapActionId;
  handler: () => void;
};

export function useKeymap(
  registrations: readonly KeyRegistration[],
  options: { enabled?: boolean } = {},
): void {
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled || registrations.length === 0) return;

    const activeScopes = [...new Set(registrations.map((registration) => registration.scope))];
    const byKey = new Map(
      registrations.map((registration) => [
        `${registration.scope}:${registration.action}`,
        registration,
      ]),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      const binding = resolveKey(DEFAULT_KEYMAP, activeScopes, event);
      if (!binding) return;
      const registration = byKey.get(`${binding.scope}:${binding.action}`);
      if (!registration) return;

      if (isTypingTarget(event.target) && !binding.mod && !binding.allowInInput) {
        return;
      }
      event.preventDefault();
      registration.handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, registrations]);
}
