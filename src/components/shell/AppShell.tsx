"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CommandIcon, KeyboardIcon, PanelLeftIcon, PanelRightIcon, SparkleIcon } from "lucide-react";
import { CommandMenu } from "@/components/cmdk/CommandMenu";
import { ShortcutsDialog } from "@/components/cmdk/ShortcutsDialog";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { OfflineBanner, ReconnectingBanner } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useKeymap, type KeyRegistration } from "@/hooks/useKeymap";
import { usePlatform } from "@/hooks/usePlatform";
import { useViewportMode } from "@/hooks/useViewportMode";
import { DEFAULT_KEYMAP, formatKey } from "@/lib/keymap";
import { useUiStore } from "@/stores/ui";

/**
 * Responsive app shell (PLAN §9.7, Phase 3.2).
 *
 * Desktop (≥1201px): left | main | right panes inline.
 * Tablet (≥769px):   left pane inline; the right pane opens as a sheet.
 * Phone:             both panes open as sheets from header triggers.
 *
 * Skip link first in DOM; panes are labeled landmarks; the thread column
 * keeps its reading measure via the `reading-measure` utility.
 */

export type ConnectionState = "online" | "reconnecting" | "offline";

type AppShellProps = {
  children: React.ReactNode;
  leftPane?: React.ReactNode;
  rightPane?: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  connection?: ConnectionState;
};

export function AppShell({
  children,
  leftPane,
  rightPane,
  leftLabel = "Cast",
  rightLabel = "Inspector",
  connection = "online",
}: AppShellProps) {
  const mode = useViewportMode();
  const platform = usePlatform();
  const activePanel = useUiStore((state) => state.activePanel);
  const setActivePanel = useUiStore((state) => state.setActivePanel);
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen);

  const registrations = useMemo<KeyRegistration[]>(
    () => [
      { scope: "global", action: "palette.open", handler: () => setPaletteOpen(true) },
      { scope: "global", action: "shortcuts.dialog", handler: () => setShortcutsOpen(true) },
    ],
    [setPaletteOpen, setShortcutsOpen],
  );
  useKeymap(registrations);

  const paletteBinding = DEFAULT_KEYMAP.find((binding) => binding.action === "palette.open");
  const paletteHint = paletteBinding ? formatKey(paletteBinding, platform) : "";

  const leftInline = Boolean(leftPane) && mode !== "single";
  const rightInline = Boolean(rightPane) && mode === "three";
  const leftSheet = Boolean(leftPane) && mode === "single";
  const rightSheet = Boolean(rightPane) && mode !== "three";

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="pt-safe sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="flex h-14 items-center gap-1.5 px-3 sm:px-4">
          <Link
            href="/"
            className="mr-1 flex items-center gap-2 rounded-md font-serif text-lg font-semibold tracking-tight"
          >
            <SparkleIcon aria-hidden className="size-4 text-primary" />
            Fabula
          </Link>

          {leftSheet ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Open ${leftLabel}`}
              onClick={() => setActivePanel("left")}
            >
              <PanelLeftIcon />
            </Button>
          ) : null}
          {rightSheet ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Open ${rightLabel}`}
              onClick={() => setActivePanel("right")}
            >
              <PanelRightIcon />
            </Button>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground"
              aria-label="Open command palette"
              onClick={() => setPaletteOpen(true)}
            >
              <CommandIcon className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="hidden rounded-sm border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground md:inline">
                {paletteHint}
              </kbd>
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
            >
              <KeyboardIcon />
            </Button>
          </div>
        </div>

        {connection === "offline" ? <OfflineBanner /> : null}
        {connection === "reconnecting" ? <ReconnectingBanner /> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {leftInline ? (
          <aside aria-label={leftLabel} className="w-64 shrink-0 border-r border-border">
            {leftPane}
          </aside>
        ) : null}

        <main id="main" tabIndex={-1} className="pb-safe min-w-0 flex-1 outline-none">
          {children}
        </main>

        {rightInline ? (
          <aside aria-label={rightLabel} className="w-80 shrink-0 border-l border-border">
            {rightPane}
          </aside>
        ) : null}
      </div>

      {leftPane && leftSheet ? (
        <Sheet
          open={activePanel === "left"}
          onOpenChange={(open) => setActivePanel(open ? "left" : null)}
        >
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{leftLabel}</SheetTitle>
              <SheetDescription className="sr-only">{leftLabel} panel</SheetDescription>
            </SheetHeader>
            {leftPane}
          </SheetContent>
        </Sheet>
      ) : null}

      {rightPane && rightSheet ? (
        <Sheet
          open={activePanel === "right"}
          onOpenChange={(open) => setActivePanel(open ? "right" : null)}
        >
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{rightLabel}</SheetTitle>
              <SheetDescription className="sr-only">{rightLabel} panel</SheetDescription>
            </SheetHeader>
            {rightPane}
          </SheetContent>
        </Sheet>
      ) : null}

      <CommandMenu />
      <ShortcutsDialog />
    </div>
  );
}
