import { describe, expect, test } from "vitest";
import {
  bindingMatches,
  DEFAULT_KEYMAP,
  findCollisions,
  formatKey,
  isTypingTarget,
  KEYMAP_ACTION_IDS,
  normalizeKey,
  resolveKey,
  scopesOverlap,
  type KeyBinding,
  type KeyEventLike,
  type KeymapScope,
} from "@/lib/keymap";

/**
 * Keymap registry (PLAN Appendix B / Phase 3.5). The action IDs are frozen at
 * G0; the registry must stay collision-free across overlapping scopes.
 */

function event(partial: Partial<KeyEventLike>): KeyEventLike {
  return {
    key: "k",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...partial,
  };
}

describe("registry completeness", () => {
  test("every Appendix B action id has a binding", () => {
    const bound = new Set(DEFAULT_KEYMAP.map((binding) => binding.action));
    for (const action of KEYMAP_ACTION_IDS) {
      expect(bound.has(action), `missing binding for ${action}`).toBe(true);
    }
  });

  test("bindings declare labels and descriptions for the shortcuts dialog", () => {
    for (const binding of DEFAULT_KEYMAP) {
      expect(binding.label.length).toBeGreaterThan(0);
      expect(binding.description.length).toBeGreaterThan(0);
    }
  });
});

describe("collision detection", () => {
  test("the default keymap has zero collisions", () => {
    const collisions = findCollisions(DEFAULT_KEYMAP);
    const readable = collisions
      .map(([a, b]) => `${a.action} ↔ ${b.action} (${formatKey(a)})`)
      .join(", ");
    expect(collisions, readable).toHaveLength(0);
  });

  test("detects a real collision across overlapping scopes", () => {
    const bindings: KeyBinding[] = [
      { action: "options.offer", scope: "play", key: "k", mod: true, label: "x", description: "x" },
      { action: "palette.open", scope: "global", key: "k", mod: true, label: "y", description: "y" },
    ];
    expect(findCollisions(bindings)).toHaveLength(1);
  });

  test("same chord in unrelated scopes is fine", () => {
    const bindings: KeyBinding[] = [
      { action: "composer.send", scope: "composer", key: "enter", mod: true, label: "x", description: "x" },
      { action: "generation.abort", scope: "play", key: "enter", mod: true, label: "y", description: "y" },
    ];
    // composer overlaps play → this IS a collision by design.
    expect(findCollisions(bindings)).toHaveLength(1);
  });

  test("scope overlap matrix", () => {
    expect(scopesOverlap("global", "play")).toBe(true);
    expect(scopesOverlap("global", "composer")).toBe(true);
    expect(scopesOverlap("play", "options")).toBe(true);
    expect(scopesOverlap("play", "composer")).toBe(true);
    expect(scopesOverlap("options", "composer")).toBe(false);
    expect(scopesOverlap("options", "options")).toBe(true);
  });
});

describe("resolveKey", () => {
  test("mod matches ⌘ or Ctrl", () => {
    expect(resolveKey(DEFAULT_KEYMAP, ["global"], event({ key: "k", metaKey: true }))?.action).toBe(
      "palette.open",
    );
    expect(resolveKey(DEFAULT_KEYMAP, ["global"], event({ key: "k", ctrlKey: true }))?.action).toBe(
      "palette.open",
    );
  });

  test("ignores events from scopes that are not active", () => {
    expect(resolveKey(DEFAULT_KEYMAP, ["play"], event({ key: "k", metaKey: true }))).toBeNull();
  });

  test("narrower scopes win (composer > play > global)", () => {
    const binding = resolveKey(
      DEFAULT_KEYMAP,
      ["global", "play", "composer"],
      event({ key: "Enter", metaKey: true }),
    );
    expect(binding?.action).toBe("composer.send");
  });

  test("alt-pick bindings resolve in the options scope", () => {
    const binding = resolveKey(
      DEFAULT_KEYMAP,
      ["play", "options"],
      event({ key: "3", altKey: true }),
    );
    expect(binding?.action).toBe("options.pick.3");
  });

  test("shift is enforced for letter chords but tolerated on symbol keys", () => {
    // "?" is documented as shift+slash, but symbol events often arrive with
    // shiftKey=false (Playwright, some IMEs) — the glyph itself carries it.
    expect(resolveKey(DEFAULT_KEYMAP, ["global"], event({ key: "?", shiftKey: true }))?.action).toBe(
      "shortcuts.dialog",
    );
    expect(resolveKey(DEFAULT_KEYMAP, ["global"], event({ key: "?", shiftKey: false }))?.action).toBe(
      "shortcuts.dialog",
    );
    // ⌘⇧O (offer paths) is a letter chord: shift is required.
    expect(
      resolveKey(DEFAULT_KEYMAP, ["play"], event({ key: "o", metaKey: true, shiftKey: false })),
    ).toBeNull();
    expect(
      resolveKey(DEFAULT_KEYMAP, ["play"], event({ key: "o", metaKey: true, shiftKey: true }))
        ?.action,
    ).toBe("options.offer");
  });

  test("normalizes keys case-insensitively", () => {
    expect(normalizeKey("K")).toBe("k");
    expect(normalizeKey(" ")).toBe("space");
    expect(bindingMatches(DEFAULT_KEYMAP[0] as KeyBinding, event({ key: "K", metaKey: true }))).toBe(
      true,
    );
  });
});

describe("formatKey", () => {
  const palette = DEFAULT_KEYMAP.find((binding) => binding.action === "palette.open");
  const offer = DEFAULT_KEYMAP.find((binding) => binding.action === "options.offer");
  const close = DEFAULT_KEYMAP.find((binding) => binding.action === "context.close");
  const send = DEFAULT_KEYMAP.find((binding) => binding.action === "composer.send");

  test("mac glyphs", () => {
    expect(formatKey(palette as KeyBinding, "mac")).toBe("⌘K");
    expect(formatKey(offer as KeyBinding, "mac")).toBe("⌘⇧O");
    expect(formatKey(close as KeyBinding, "mac")).toBe("Esc");
    expect(formatKey(send as KeyBinding, "mac")).toBe("⌘↵");
  });

  test("non-mac labels", () => {
    expect(formatKey(palette as KeyBinding, "other")).toBe("Ctrl+K");
    expect(formatKey(offer as KeyBinding, "other")).toBe("Ctrl+Shift+O");
    expect(formatKey(close as KeyBinding, "other")).toBe("Esc");
    expect(formatKey(send as KeyBinding, "other")).toBe("Ctrl+Enter");
  });
});

describe("isTypingTarget", () => {
  test("recognizes text input targets", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" } as unknown as EventTarget)).toBe(true);
    expect(
      isTypingTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  test("scope typing guard data: mod chords are allowed while typing", () => {
    const scopes: KeymapScope[] = ["global"];
    const binding = resolveKey(DEFAULT_KEYMAP, scopes, event({ key: "k", metaKey: true }));
    expect(binding?.mod).toBe(true);
    const question = resolveKey(DEFAULT_KEYMAP, scopes, event({ key: "?", shiftKey: true }));
    expect(question?.mod).toBeUndefined();
  });
});
