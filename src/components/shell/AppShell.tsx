"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BookOpenIcon,
  CommandIcon,
  KeyboardIcon,
  LibraryIcon,
  MenuIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { CommandMenu } from "@/components/cmdk/CommandMenu";
import { ShortcutsDialog } from "@/components/cmdk/ShortcutsDialog";
import { Wordmark } from "@/components/brand/Wordmark";
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
import { useConnectionState, type ConnectionState } from "@/hooks/useConnectionState";
import { useKeymap, type KeyRegistration } from "@/hooks/useKeymap";
import { usePlatform } from "@/hooks/usePlatform";
import { useViewportMode } from "@/hooks/useViewportMode";
import { DEFAULT_KEYMAP, formatKey } from "@/lib/keymap";
import { useUiStore } from "@/stores/ui";

/**
 * Responsive app shell.
 *
 * The public studio chrome is a single quiet proscenium bar: the house mark,
 * the four rooms of the product, a search affordance and the director's
 * utility controls. Play and share surfaces keep their own stage furniture
 * inside the main landmark.
 *
 * Desktop (≥1201px): left | main | right panes inline.
 * Tablet (≥769px):   left pane inline; the right pane opens as a sheet.
 * Phone:             both panes open as sheets from header triggers.
 */

export type { ConnectionState };

type AppShellProps = {
  children: React.ReactNode;
  leftPane?: React.ReactNode;
  rightPane?: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  /** Test/override seam, by default the shell detects its own connection. */
  connection?: ConnectionState;
};

const NAV_ITEMS = [
  { href: "/library", label: "Scenes", icon: LibraryIcon },
  { href: "/new", label: "New scene", icon: PlusIcon },
  { href: "/new/templates", label: "Templates", icon: BookOpenIcon },
  { href: "/help", label: "How to direct", icon: SparklesIcon },
] as const;

export function AppShell({
  children,
  leftPane,
  rightPane,
  leftLabel = "Cast",
  rightLabel = "Inspector",
  connection: connectionOverride,
}: AppShellProps) {
  const detected = useConnectionState();
  const connection = connectionOverride ?? detected;
  const mode = useViewportMode();
  const platform = usePlatform();
  const [menuOpen, setMenuOpen] = useState(false);
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

      <header className="pt-safe sticky top-0 z-40 border-b border-border/80 bg-background/88 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-1.5 px-3 sm:px-5">
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

          <Wordmark />

          <nav aria-label="Primary" className="ml-4 hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Link href={item.href}>
                    <Icon aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden items-center gap-1.5 sm:flex">
              <Button
                variant="outline"
                size="sm"
                className="max-w-64 gap-2 text-muted-foreground"
                onClick={() => setPaletteOpen(true)}
              >
                <CommandIcon className="size-3.5" aria-hidden />
                <span className="truncate">Search the studio</span>
              </Button>
              <kbd
                aria-hidden
                className="hidden rounded-sm border border-border/80 bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground xl:inline"
              >
                {paletteHint}
              </kbd>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="sm:hidden"
              aria-label="Open command palette"
              onClick={() => setPaletteOpen(true)}
            >
              <CommandIcon />
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
              className="hidden sm:inline-flex"
            >
              <KeyboardIcon />
            </Button>
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/new">
                <PlusIcon aria-hidden />
                Start a scene
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open menu"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <MenuIcon />
            </Button>
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
          </div>
        </div>

        {connection === "offline" ? <OfflineBanner /> : null}
        {connection === "reconnecting" ? <ReconnectingBanner /> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {leftInline ? (
          <aside aria-label={leftLabel} className="w-64 shrink-0 border-r border-border/80">
            {leftPane}
          </aside>
        ) : null}

        <main id="main" tabIndex={-1} className="pb-safe min-w-0 flex-1 outline-none">
          {children}
        </main>

        {rightInline ? (
          <aside aria-label={rightLabel} className="w-80 shrink-0 border-l border-border/80">
            {rightPane}
          </aside>
        ) : null}
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xs">
          <SheetHeader>
            <SheetTitle className="sr-only">Studio menu</SheetTitle>
            <SheetDescription className="sr-only">
              Move between the library, a new scene, templates and the director&apos;s guide.
            </SheetDescription>
          </SheetHeader>
          <div className="px-1 pb-4">
            <Wordmark ornate />
            <nav aria-label="Mobile primary" className="mt-6 grid gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:border-border/60 hover:bg-muted/60 hover:text-foreground"
                  >
                    <Icon className="size-4 text-primary" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-6 border-t border-border/70 pt-4">
              <Button asChild className="w-full">
                <Link href="/new" onClick={() => setMenuOpen(false)}>
                  <PlusIcon aria-hidden />
                  Start a scene
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Your scenes live in this browser session until you claim an account.
            </p>
          </div>
        </SheetContent>
      </Sheet>

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
