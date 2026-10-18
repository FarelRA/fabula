import { create } from "zustand";

/**
 * Ephemeral UI state only: Convex remains the source of truth for
 * story data. Chrome state lives here; composer and autoscroll intents land
 * with the play loop.
 */

export type PanelSide = "left" | "right";

type UiState = {
  /** Command palette (⌘K) open state. */
  paletteOpen: boolean;
  /** Keyboard shortcuts dialog open state. */
  shortcutsOpen: boolean;
  /** Which side panel is open as a sheet on small viewports. */
  activePanel: PanelSide | null;
  setPaletteOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setActivePanel: (panel: PanelSide | null) => void;
};

export const useUiStore = create<UiState>()((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  activePanel: null,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setActivePanel: (activePanel) => set({ activePanel }),
}));
