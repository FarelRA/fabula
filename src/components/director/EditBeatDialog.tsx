"use client";

import { useEffect, useState } from "react";
import { GitBranchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { PlayBeat } from "@/lib/play/types";

/**
 * Edit-fork confirmation (PLAN §8.4 / Phase 5.6): the copy names the branch
 * law explicitly — editing forks, and the original stays intact.
 */
export function EditBeatDialog({
  beat,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  beat: PlayBeat | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (text: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState(beat?.text ?? "");

  useEffect(() => {
    setText(beat?.text ?? "");
  }, [beat]);

  const canSave = text.trim().length > 0 && text.trim() !== beat?.text.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit beat {beat?.seq}</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="flex items-start gap-1.5">
              <GitBranchIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              Editing forks the story from beat {beat ? Math.max(1, beat.seq - 1) : 0}.
              The original beat and everything after it stay intact on their branch.
            </span>
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Edited beat text"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="font-serif text-base leading-relaxed"
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave || busy}
            onClick={() => {
              onConfirm(text.trim());
              onOpenChange(false);
            }}
          >
            <GitBranchIcon />
            Save &amp; fork
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
