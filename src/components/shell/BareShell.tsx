"use client";

import { useMemo, type ReactNode } from "react";
import { CommandMenu } from "@/components/cmdk/CommandMenu";
import { ShortcutsDialog } from "@/components/cmdk/ShortcutsDialog";
import { OfflineBanner, ReconnectingBanner } from "@/components/shell/states";
import { useConnectionState } from "@/hooks/useConnectionState";
import { useKeymap, type KeyRegistration } from "@/hooks/useKeymap";
import { useUiStore } from "@/stores/ui";
import { cn } from "cn";

/**
 * Chromeless shell for focused flows and stage surfaces.
 *
 * Keeps the invisible essentials (skip link, connection banners, command
 * palette, shortcuts dialog) without spending a full navigation bar on pages
 * that already have their own context bar.
 */
export function BareShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const connection = useConnectionState();
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

  return (
    <div className="flex h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {connection === "offline" ? <OfflineBanner /> : null}
      {connection === "reconnecting" ? <ReconnectingBanner /> : null}

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "pt-safe pb-safe flex min-h-0 flex-1 flex-col overflow-y-auto outline-none",
          className,
        )}
      >
        {children}
      </main>

      <CommandMenu />
      <ShortcutsDialog />
    </div>
  );
}
