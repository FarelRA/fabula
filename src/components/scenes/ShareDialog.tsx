"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shareUrl, type SharePermission } from "@/lib/share/links";
import { ShareLinksPanel, type ShareLinkRowView } from "./ShareLinksPanel";

/**
 * Share dialog (PLAN §12 Phase 7.4 / E2E-07): create viewer/director links,
 * copy them, revoke them. Creation copies to the clipboard immediately; the
 * URL stays visible in the list either way.
 */
export function ShareDialog({
  sceneId,
  open,
  onOpenChange,
}: {
  sceneId: Id<"scenes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = useQuery(api.shares.listForScene, open ? { sceneId } : "skip");
  const createLink = useMutation(api.shares.create);
  const revokeLink = useMutation(api.shares.revoke);
  const [busy, setBusy] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const viewRows: ShareLinkRowView[] = (rows ?? []).map((row) => ({
    id: row._id,
    token: row.token,
    permission: row.permission,
    createdAt: row._creationTime ?? 0,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
  }));

  const copyToken = async (token: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(shareUrl(origin, token));
      setCopiedToken(token);
      return true;
    } catch {
      return false;
    }
  };

  const handleCreate = (permission: SharePermission) => {
    setBusy(true);
    void createLink({ sceneId, permission })
      .then(async ({ token }) => {
        const copied = await copyToken(token);
        toast.success(
          copied ? "Link created and copied" : "Link created",
          {
            description:
              permission === "director"
                ? "Anyone with it can pick path options."
                : "Anyone with it can watch, read-only.",
          },
        );
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Could not create the link",
        );
      })
      .finally(() => setBusy(false));
  };

  const handleCopy = (row: ShareLinkRowView) => {
    void copyToken(row.token).then((copied) => {
      if (copied) toast.success("Link copied");
      else toast.error("Copy failed — select the link text instead");
    });
  };

  const handleRevoke = (row: ShareLinkRowView) => {
    setBusy(true);
    void revokeLink({ shareId: row.id as Id<"shareLinks"> })
      .then(() => toast.success("Link revoked", { description: "The visitor sees a closed door." }))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not revoke");
      })
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this scene</DialogTitle>
          <DialogDescription>
            Watch links stream the scene live, read-only. Direct links can pick
            path options. Nothing else is ever editable through a link.
          </DialogDescription>
        </DialogHeader>
        <ShareLinksPanel
          rows={viewRows}
          origin={origin}
          now={Date.now()}
          copiedToken={copiedToken}
          busy={busy}
          onCreate={handleCreate}
          onCopy={handleCopy}
          onRevoke={handleRevoke}
        />
      </DialogContent>
    </Dialog>
  );
}
