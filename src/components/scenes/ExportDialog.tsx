"use client";

import { DownloadIcon, FileJsonIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  downloadTextFile,
  JSON_MIME,
  MARKDOWN_MIME,
} from "@/lib/export/download";
import { exportFilename, serializeSceneToJson } from "@/lib/export/json";
import { serializeSceneToMarkdown } from "@/lib/export/markdown";
import type { ExportBundle } from "@/lib/export/types";

/**
 * Export dialog (PLAN §12 Phase 7.3 / §10): markdown for reading, JSON for
 * `jq` and round-trips. Files are generated in the browser from the bundle —
 * no server storage involved. Presentational: the parent owns the query.
 */
export function ExportDialog({
  open,
  onOpenChange,
  bundle,
  sceneTitle,
  includeSnapshots,
  onIncludeSnapshotsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: ExportBundle | null;
  sceneTitle: string;
  includeSnapshots: boolean;
  onIncludeSnapshotsChange: (value: boolean) => void;
}) {
  const ready = bundle !== null;

  const handleMarkdown = () => {
    if (!bundle) return;
    downloadTextFile(
      exportFilename(sceneTitle, "md"),
      serializeSceneToMarkdown(bundle),
      MARKDOWN_MIME,
    );
    toast.success("Markdown export downloaded");
  };

  const handleJson = () => {
    if (!bundle) return;
    downloadTextFile(
      exportFilename(sceneTitle, "json"),
      serializeSceneToJson(bundle),
      JSON_MIME,
    );
    toast.success("JSON export downloaded", {
      description: includeSnapshots
        ? "Includes prompt snapshots."
        : "Turn on snapshots to include compiled prompts.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export this scene</DialogTitle>
          <DialogDescription>
            Every branch, beat, ghost path, fact and note is included. Files
            download straight from your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 p-2.5">
            <FileTextIcon className="size-4 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">Markdown</p>
              <p className="text-[11px] text-muted-foreground">
                Screenplay-ish read: mainline first, then branch deltas.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!ready}
              onClick={handleMarkdown}
            >
              <DownloadIcon />
              .md
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-2.5">
            <div className="flex items-center gap-2">
              <FileJsonIcon className="size-4 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">JSON</p>
                <p className="text-[11px] text-muted-foreground">
                  Lossless tree — ids, branch links, candidates, facts.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!ready}
                onClick={handleJson}
              >
                <DownloadIcon />
                .json
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
              <Label htmlFor="export-snapshots" className="text-[11px] text-muted-foreground">
                Include prompt snapshots (compiled blocks)
              </Label>
              <Switch
                id="export-snapshots"
                checked={includeSnapshots}
                onCheckedChange={onIncludeSnapshotsChange}
              />
            </div>
          </div>

          {!ready ? (
            <p className="text-[11px] text-muted-foreground">
              Preparing the export…
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
