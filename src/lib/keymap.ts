/**
 * Keymap registry (PLAN Appendix B, Phase 3.5) — action IDs frozen at G0.
 *
 * The registry is data: `resolveKey` powers the useKeymap hook, the shortcuts
 * dialog renders `DEFAULT_KEYMAP` directly, and `findCollisions` is CI-tested
 * so two actions can never fight over the same chord in overlapping scopes.
 */

export const KEYMAP_SCOPES = ["global", "play", "options", "composer"] as const;
export type KeymapScope = (typeof KEYMAP_SCOPES)[number];

export const KEYMAP_ACTION_IDS = [
  "palette.open",
  "shortcuts.dialog",
  "context.close",
  "action.undoLast",
  "thread.jumpToLatest",
  "options.pick.1",
  "options.pick.2",
  "options.pick.3",
  "options.pick.4",
  "options.offer",
  "generation.abort",
  "composer.send",
  "inspector.toggle",
  "inspector.map.open",
  "inspector.memory.open",
] as const;
export type KeymapActionId = (typeof KEYMAP_ACTION_IDS)[number];

export type Platform = "mac" | "other";

export type KeyBinding = {
  action: KeymapActionId;
  scope: KeymapScope;
  /** Normalized key: lowercase letters, digits, ".", "?", "escape", "enter", "space". */
  key: string;
  /** ⌘ on macOS, Ctrl elsewhere. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Bare (non-mod) bindings need this to fire while a text field has focus. */
  allowInInput?: boolean;
  label: string;
  description: string;
};

export const DEFAULT_KEYMAP: readonly KeyBinding[] = [
  {
    action: "palette.open",
    scope: "global",
    key: "k",
    mod: true,
    allowInInput: true,
    label: "Command palette",
    description: "Search and run commands",
  },
  {
    action: "shortcuts.dialog",
    scope: "global",
    key: "?",
    shift: true,
    label: "Keyboard shortcuts",
    description: "Show every shortcut in one place",
  },
  {
    action: "context.close",
    scope: "global",
    key: "escape",
    label: "Close / cancel",
    description: "Close sheets and dialogs, or cancel composing",
  },
  {
    action: "action.undoLast",
    scope: "global",
    key: "z",
    mod: true,
    label: "Undo last action",
    description: "Undo the most recent director action",
  },
  {
    action: "thread.jumpToLatest",
    scope: "play",
    key: "j",
    mod: true,
    label: "Jump to latest",
    description: "Scroll the scene to the newest beat",
  },
  {
    action: "options.pick.1",
    scope: "options",
    key: "1",
    alt: true,
    label: "Pick path 1",
    description: "Choose the first path option",
  },
  {
    action: "options.pick.2",
    scope: "options",
    key: "2",
    alt: true,
    label: "Pick path 2",
    description: "Choose the second path option",
  },
  {
    action: "options.pick.3",
    scope: "options",
    key: "3",
    alt: true,
    label: "Pick path 3",
    description: "Choose the third path option",
  },
  {
    action: "options.pick.4",
    scope: "options",
    key: "4",
    alt: true,
    label: "Pick path 4",
    description: "Choose the fourth path option",
  },
  {
    action: "options.offer",
    scope: "play",
    key: "o",
    mod: true,
    shift: true,
    label: "Offer paths",
    description: "Generate path options at the current tip",
  },
  {
    action: "generation.abort",
    scope: "play",
    key: ".",
    mod: true,
    label: "Abort generation",
    description: "Stop the current streaming beat",
  },
  {
    action: "composer.send",
    scope: "composer",
    key: "enter",
    mod: true,
    allowInInput: true,
    label: "Send",
    description: "Send the composer contents",
  },
  {
    action: "inspector.toggle",
    scope: "play",
    key: "i",
    mod: true,
    label: "Toggle inspector",
    description: "Show or hide the inspector pane",
  },
  {
    action: "inspector.map.open",
    scope: "play",
    key: "b",
    mod: true,
    label: "Open branch map",
    description: "Show the story map on the inspector",
  },
  {
    action: "inspector.memory.open",
    scope: "play",
    key: "m",
    mod: true,
    label: "Open memory",
    description: "Show canon facts and summaries",
  },
];

/** Narrower scopes win when chords overlap (composer > options > play > global). */
const SCOPE_PRIORITY: readonly KeymapScope[] = ["composer", "options", "play", "global"];

export function normalizeKey(key: string): string {
  if (key === " " || key === "Spacebar") return "space";
  if (key.length === 1) return key.toLowerCase();
  return key.toLowerCase();
}

export type KeyEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export function bindingMatches(binding: KeyBinding, event: KeyEventLike): boolean {
  if (normalizeKey(event.key) !== binding.key) return false;
  if (Boolean(binding.mod) !== (event.metaKey || event.ctrlKey)) return false;
  if (Boolean(binding.alt) !== event.altKey) return false;
  // For letters/digits, shift is a real modifier and must match exactly.
  // For symbol keys (".", "?", …) the character itself already encodes shift
  // — some browsers/IMEs/synthetic events deliver "?" with shiftKey=false,
  // so demanding shift there would make the shortcut unreliable.
  const shiftMatters = /^[a-z0-9]$/.test(binding.key);
  if (shiftMatters && Boolean(binding.shift) !== event.shiftKey) return false;
  return true;
}

/** Highest-priority binding among the active scopes that matches the event. */
export function resolveKey(
  bindings: readonly KeyBinding[],
  activeScopes: readonly KeymapScope[],
  event: KeyEventLike,
): KeyBinding | null {
  const scoped = bindings
    .filter((binding) => activeScopes.includes(binding.scope))
    .sort((a, b) => SCOPE_PRIORITY.indexOf(a.scope) - SCOPE_PRIORITY.indexOf(b.scope));
  return scoped.find((binding) => bindingMatches(binding, event)) ?? null;
}

export function scopesOverlap(a: KeymapScope, b: KeymapScope): boolean {
  if (a === b) return true;
  if (a === "global" || b === "global") return true;
  if (a === "play" && (b === "options" || b === "composer")) return true;
  if (b === "play" && (a === "options" || a === "composer")) return true;
  return false;
}

export function sameChord(a: KeyBinding, b: KeyBinding): boolean {
  return (
    a.key === b.key &&
    Boolean(a.mod) === Boolean(b.mod) &&
    Boolean(a.shift) === Boolean(b.shift) &&
    Boolean(a.alt) === Boolean(b.alt)
  );
}

/** Pairs of bindings that would fight over the same chord in overlapping scopes. */
export function findCollisions(bindings: readonly KeyBinding[]): Array<[KeyBinding, KeyBinding]> {
  const collisions: Array<[KeyBinding, KeyBinding]> = [];
  for (let i = 0; i < bindings.length; i += 1) {
    for (let j = i + 1; j < bindings.length; j += 1) {
      const a = bindings[i];
      const b = bindings[j];
      if (!a || !b) continue;
      if (sameChord(a, b) && scopesOverlap(a.scope, b.scope)) {
        collisions.push([a, b]);
      }
    }
  }
  return collisions;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof element.tagName === "string" ? element.tagName : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return element.isContentEditable === true;
}

function keyLabel(key: string, platform: Platform): string {
  if (key === "escape") return "Esc";
  if (key === "enter") return platform === "mac" ? "↵" : "Enter";
  if (key === "space") return "Space";
  return key.toUpperCase();
}

/** Display string, e.g. "⌘K" / "Ctrl+K" / "⌘⇧O" / "Ctrl+Shift+O". */
export function formatKey(binding: KeyBinding, platform: Platform = "other"): string {
  if (platform === "mac") {
    const parts = [
      binding.mod ? "⌘" : "",
      binding.alt ? "⌥" : "",
      // "?" is shift+slash by definition — its glyph already implies shift.
      binding.shift && binding.key !== "?" ? "⇧" : "",
    ].join("");
    return `${parts}${keyLabel(binding.key, platform)}`;
  }
  const parts: string[] = [];
  if (binding.mod) parts.push("Ctrl");
  if (binding.alt) parts.push("Alt");
  if (binding.shift && binding.key !== "?") parts.push("Shift");
  parts.push(keyLabel(binding.key, platform));
  return parts.join("+");
}
