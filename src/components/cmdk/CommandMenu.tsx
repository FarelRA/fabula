"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { usePlatform } from "@/hooks/usePlatform";
import { buildShellCommands, type ShellCommand, type ShellCommandGroup } from "@/lib/commands";
import { useUiStore } from "@/stores/ui";

/**
 * Command palette (⌘K, Phase 3.5, PLAN Appendix B). Command lists are
 * registry-driven: later phases append play/scene commands to the same menu.
 */

const GROUP_ORDER: ShellCommandGroup[] = ["Navigate", "Appearance", "Help"];

export function CommandMenu({ commands }: { commands?: ShellCommand[] }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const platform = usePlatform();
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);

  const items = useMemo(
    () =>
      commands ??
      buildShellCommands({
        navigate: (href) => router.push(href),
        setTheme: (theme) => setTheme(theme),
        openShortcuts: () => {
          setOpen(false);
          useUiStore.getState().setShortcutsOpen(true);
        },
        platform,
      }),
    [commands, router, setTheme, setOpen, platform],
  );

  const groups = useMemo(() => {
    const byGroup = new Map<ShellCommandGroup, ShellCommand[]>();
    for (const item of items) {
      const bucket = byGroup.get(item.group) ?? [];
      bucket.push(item);
      byGroup.set(item.group, bucket);
    }
    return GROUP_ORDER.filter((group) => byGroup.has(group)).map(
      (group) => [group, byGroup.get(group) ?? []] as const,
    );
  }, [items]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {groups.map(([group, groupItems]) => (
            <CommandGroup key={group} heading={group}>
              {groupItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${(item.keywords ?? []).join(" ")}`}
                  onSelect={() => {
                    setOpen(false);
                    item.run();
                  }}
                >
                  {item.title}
                  {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
