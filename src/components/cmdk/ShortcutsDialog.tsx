"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlatform } from "@/hooks/usePlatform";
import { DEFAULT_KEYMAP, formatKey, type KeymapScope } from "@/lib/keymap";
import { useUiStore } from "@/stores/ui";

/**
 * Keyboard shortcuts dialog (Appendix B, Phase 3.5). Renders the registry —
 * adding a binding to DEFAULT_KEYMAP automatically documents it here.
 */

const SCOPE_LABELS: Record<KeymapScope, string> = {
  global: "Global",
  play: "Play",
  options: "Path options",
  composer: "Composer",
};

const SCOPE_ORDER: KeymapScope[] = ["global", "play", "options", "composer"];

export function ShortcutsDialog() {
  const open = useUiStore((state) => state.shortcutsOpen);
  const setOpen = useUiStore((state) => state.setShortcutsOpen);
  const platform = usePlatform();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Every action in Fabula is reachable without a mouse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {SCOPE_ORDER.map((scope) => {
            const bindings = DEFAULT_KEYMAP.filter((binding) => binding.scope === scope);
            if (bindings.length === 0) return null;
            return (
              <section key={scope} aria-labelledby={`shortcuts-${scope}`}>
                <h3
                  id={`shortcuts-${scope}`}
                  className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {SCOPE_LABELS[scope]}
                </h3>
                <ul className="space-y-1.5">
                  {bindings.map((binding) => (
                    <li
                      key={`${binding.scope}:${binding.action}`}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-foreground">{binding.label}</span>
                      <kbd className="rounded-sm border border-border bg-muted px-2 py-0.5 font-sans text-xs text-muted-foreground">
                        {formatKey(binding, platform)}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
