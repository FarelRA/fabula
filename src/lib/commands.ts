import { DEFAULT_KEYMAP, formatKey, type KeymapActionId, type Platform } from "@/lib/keymap";

/**
 * Command palettes are registry-driven: later surfaces append
 * scene-specific commands (offer paths, toggle map, …) to the same list.
 */

export type ShellCommandGroup = "Navigate" | "Appearance" | "Help";

export type ShellCommand = {
  id: string;
  title: string;
  group: ShellCommandGroup;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
};

export type ShellCommandIO = {
  navigate: (href: string) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  openShortcuts: () => void;
  platform?: Platform;
};

function shortcutLabel(action: KeymapActionId, platform: Platform): string | undefined {
  const binding = DEFAULT_KEYMAP.find((candidate) => candidate.action === action);
  return binding ? formatKey(binding, platform) : undefined;
}

export function buildShellCommands(io: ShellCommandIO): ShellCommand[] {
  const platform = io.platform ?? "other";
  return [
    {
      id: "nav.new-scene",
      title: "Start a scene",
      group: "Navigate",
      keywords: ["create", "cast", "new", "premise"],
      run: () => io.navigate("/new"),
    },
    {
      id: "nav.home",
      title: "Go home",
      group: "Navigate",
      keywords: ["landing", "start", "scenes"],
      run: () => io.navigate("/"),
    },
    {
      id: "nav.guided-setup",
      title: "Guided scene setup",
      group: "Navigate",
      keywords: ["wizard", "tone", "world", "cast size"],
      run: () => io.navigate("/new/wizard"),
    },
    {
      id: "nav.templates",
      title: "Browse templates",
      group: "Navigate",
      keywords: ["preset", "noir", "court", "space", "tavern"],
      run: () => io.navigate("/new/templates"),
    },
    {
      id: "theme.dark",
      title: "Dark theme",
      group: "Appearance",
      keywords: ["night", "stage", "dark mode"],
      run: () => io.setTheme("dark"),
    },
    {
      id: "theme.light",
      title: "Light theme",
      group: "Appearance",
      keywords: ["day", "parchment", "light mode"],
      run: () => io.setTheme("light"),
    },
    {
      id: "theme.system",
      title: "System theme",
      group: "Appearance",
      keywords: ["auto", "os"],
      run: () => io.setTheme("system"),
    },
    {
      id: "help.shortcuts",
      title: "Keyboard shortcuts",
      group: "Help",
      keywords: ["keys", "keymap", "help", "hotkeys"],
      shortcut: shortcutLabel("shortcuts.dialog", platform),
      run: io.openShortcuts,
    },
  ];
}
