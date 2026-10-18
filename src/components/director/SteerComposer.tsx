"use client";

import { useMemo, useRef, useState } from "react";
import { AtSignIcon, LoaderCircleIcon, PenLineIcon, SendIcon, SlidersHorizontalIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useKeymap } from "@/hooks/useKeymap";
import { usePlatform } from "@/hooks/usePlatform";
import type { CastRole } from "@/lib/cast/types";
import type { PlayNote, PlayRun, PlayScene } from "@/lib/play/types";

const STEER_CHIPS = ["Faster pace", "Raise the stakes", "Cut to the chase"];

const NOTE_KIND_LABELS: Record<PlayNote["kind"], string> = {
  steer: "steer",
  constraint: "constraint",
  doNot: "do not",
};

/**
 * Three-mode composer: steer, write in-character, and
 * quick steer chips. Mention uses cmdk. Notes persist as directorNotes and
 * feed block 7 of the next prompt.
 */
export function SteerComposer({
  scene,
  roles,
  notes,
  run,
  busy,
  onSteer,
  onWrite,
  onMention,
  onResolveNote,
}: {
  scene: PlayScene;
  roles: CastRole[];
  notes: PlayNote[];
  run: PlayRun | null;
  busy?: boolean;
  onSteer: (text: string, mode?: "continue" | "regenerate") => void;
  onWrite: (roleId: string, text: string) => void;
  onMention: (roleId: string) => void;
  onResolveNote: (noteId: string) => void;
}) {
  const platform = usePlatform();
  const [mode, setMode] = useState<"steer" | "write">("steer");
  const [text, setText] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const archived = scene.status === "archived";

  const writableRoles = useMemo(
    () => roles.filter((role) => role.status === "active"),
    [roles],
  );
  const defaultRole =
    writableRoles.find((role) => role.kind === "human") ??
    writableRoles.find((role) => role.card.meta.tier === "spotlight") ??
    writableRoles[0];
  const selectedRoleId =
    roleId && writableRoles.some((role) => role.id === roleId)
      ? roleId
      : (defaultRole?.id ?? "");
  const selectedRole = writableRoles.find((role) => role.id === selectedRoleId);

  useKeymap([
    {
      scope: "composer",
      action: "composer.send",
      handler: () => formRef.current?.requestSubmit(),
    },
  ]);

  function submit(): void {
    const trimmed = text.trim();
    if (!trimmed || archived) return;
    if (mode === "write" && run) {
      return;
    }
    if (mode === "steer") {
      onSteer(trimmed);
    } else if (selectedRoleId) {
      onWrite(selectedRoleId, trimmed);
    }
    setText("");
  }

  function sendAndRegenerate(): void {
    const trimmed = text.trim();
    if (!trimmed || archived || run) return;
    onSteer(trimmed, "regenerate");
    setText("");
  }

  const hint = platform === "mac" ? "⌘⏎" : "Ctrl+Enter";

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur">
      {notes.length > 0 ? (
        <ul className="flex flex-wrap gap-1 px-2 pt-2" aria-label="Active director notes">
          {notes.slice(0, 6).map((note) => (
            <li key={note.id}>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-0.5 pr-1 pl-2 text-[11px] text-primary">
                <span className="tracking-wide uppercase opacity-70">
                  {NOTE_KIND_LABELS[note.kind]}
                </span>
                <span className="max-w-48 truncate">{note.text}</span>
                <button
                  type="button"
                  aria-label={`Resolve note: ${note.text}`}
                  className="ml-0.5 rounded-full px-1 text-primary/70 hover:bg-primary/15 hover:text-primary"
                  onClick={() => onResolveNote(note.id)}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 px-2 pt-2">
        <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Composer mode">
          <Button
            type="button"
            size="xs"
            variant={mode === "steer" ? "secondary" : "ghost"}
            aria-pressed={mode === "steer"}
            onClick={() => setMode("steer")}
          >
            <SlidersHorizontalIcon />
            Steer
          </Button>
          <Button
            type="button"
            size="xs"
            variant={mode === "write" ? "secondary" : "ghost"}
            aria-pressed={mode === "write"}
            onClick={() => setMode("write")}
          >
            <PenLineIcon />
            In-character
          </Button>
        </div>

        {mode === "write" ? (
          <Select value={selectedRoleId} onValueChange={setRoleId}>
            <SelectTrigger size="sm" className="h-7 w-40 text-xs" aria-label="Write as role">
              <SelectValue placeholder="Choose role" />
            </SelectTrigger>
            <SelectContent>
              {writableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.card.identity.name}
                  {role.kind === "human" ? " (you)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="xs" variant="ghost" aria-label="Mention a role">
                <AtSignIcon />
                Mention
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <Command>
                <CommandInput placeholder="Force a role to speak…" />
                <CommandList>
                  <CommandEmpty>No active role.</CommandEmpty>
                  <CommandGroup heading="Give floor">
                    {writableRoles
                      .filter((role) => role.kind === "ai")
                      .map((role) => (
                        <CommandItem
                          key={role.id}
                          value={`${role.card.identity.name} ${role.id}`}
                          onSelect={() => {
                            onMention(role.id);
                            setMentionOpen(false);
                          }}
                        >
                          @{role.card.identity.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {mode === "steer"
            ? STEER_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onSteer(chip)}
                >
                  {chip}
                </button>
              ))
            : null}
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 p-2"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <Textarea
            aria-label={mode === "steer" ? "Steer note" : "In-character line"}
            rows={2}
            value={text}
            disabled={archived}
            placeholder={
              mode === "steer"
                ? "Steer from the wings, “make her suspicious”, “skip to the duel”…"
                : selectedRole
                  ? `Write a line as ${selectedRole.card.identity.name}…`
                  : "Choose a role to write as…"
            }
            onChange={(event) => setText(event.target.value)}
            className="min-h-14 resize-none text-sm"
          />
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            {mode === "steer"
              ? "Out-of-character; applies to upcoming beats."
              : run
                ? "Wait for the current beat to finish (or abort) before writing."
                : "In-fiction line; the cast reacts to it."}
            <span className="ml-auto">{hint} to send</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-1 pb-4 sm:flex-row sm:items-center sm:pb-0">
          {mode === "steer" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={sendAndRegenerate}
              disabled={!text.trim() || archived || Boolean(run) || busy}
              title="Add the note and fork a rewritten last beat"
            >
              <SparklesIcon />
              <span className="hidden md:inline">Steer &amp; regenerate</span>
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={
              !text.trim() ||
              archived ||
              busy ||
              (mode === "write" && (Boolean(run) || !selectedRole))
            }
          >
            {busy ? (
              <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
            ) : (
              <SendIcon />
            )}
            {mode === "steer" ? "Send steer" : "Write"}
          </Button>
        </div>
      </form>
      {archived ? (
        <p className="px-3 pb-2 text-[11px] text-muted-foreground">
          This scene is archived. The tree is preserved; direct actions are frozen.
        </p>
      ) : null}
    </div>
  );
}
