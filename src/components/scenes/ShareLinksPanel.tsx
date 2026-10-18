"use client";

import { CheckIcon, CopyIcon, Link2Icon, Trash2Icon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  permissionDescription,
  permissionLabel,
  shareStatus,
  shareStatusLabel,
  shareUrl,
  type SharePermission,
} from "@/lib/share/links";

export type ShareLinkRowView = {
  id: string;
  token: string;
  permission: SharePermission;
  createdAt: number;
  revokedAt?: number;
  expiresAt?: number;
};

/**
 * Share-link list (PLAN §12 Phase 7.4): presentational — the live dialog owns
 * queries/mutations, this owns the markup and the copy/revoke affordances so
 * component tests stay Convex-free.
 */
export function ShareLinksPanel({
  rows,
  origin,
  now,
  copiedToken,
  busy,
  disabled,
  onCreate,
  onCopy,
  onRevoke,
}: {
  rows: ShareLinkRowView[];
  origin: string;
  now: number;
  copiedToken?: string | null;
  busy?: boolean;
  disabled?: boolean;
  onCreate: (permission: SharePermission) => void;
  onCopy: (row: ShareLinkRowView) => void;
  onRevoke: (row: ShareLinkRowView) => void;
}) {
  const active = rows.filter((row) => shareStatus(row, now) === "active");

  return (
    <div data-testid="share-links" className="space-y-4">
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <PermissionCard
            permission="viewer"
            disabled={disabled || busy}
            onCreate={onCreate}
          />
          <PermissionCard
            permission="director"
            disabled={disabled || busy}
            onCreate={onCreate}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Links are the only credential a visitor needs. Revoke one any time —
          the scene itself is untouched.
        </p>
      </div>

      <section aria-label="Share links" className="space-y-1.5">
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          Active links
          <Badge variant="outline" className="ml-2 font-normal">
            {active.length}
          </Badge>
        </h3>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active links yet. Create one above.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {active.map((row) => (
              <li
                key={row.id}
                data-testid="share-link-row"
                className="flex items-center gap-2 rounded-lg border border-border bg-card/60 p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <Link2Icon className="size-3.5 text-muted-foreground" aria-hidden />
                    {permissionLabel(row.permission)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {shareUrl(origin, row.token)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    created {formatDistanceToNow(row.createdAt, { addSuffix: true })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={disabled}
                  aria-label={`Copy ${permissionLabel(row.permission)} link`}
                  onClick={() => onCopy(row)}
                >
                  {copiedToken === row.token ? <CheckIcon /> : <CopyIcon />}
                  {copiedToken === row.token ? "Copied" : "Copy"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={disabled}
                  aria-label={`Revoke ${permissionLabel(row.permission)} link`}
                  onClick={() => onRevoke(row)}
                >
                  <Trash2Icon />
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.length > active.length ? (
        <section aria-label="Inactive links" className="space-y-1.5">
          <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Inactive
          </h3>
          <ul className="space-y-1">
            {rows
              .filter((row) => shareStatus(row, now) !== "active")
              .map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground"
                >
                  <span>{permissionLabel(row.permission)}</span>
                  <Badge variant="outline" className="font-normal">
                    {shareStatusLabel(shareStatus(row, now))}
                  </Badge>
                  <span className="ml-auto truncate">{shareUrl(origin, row.token)}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PermissionCard({
  permission,
  disabled,
  onCreate,
}: {
  permission: SharePermission;
  disabled?: boolean;
  onCreate: (permission: SharePermission) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5">
      <p className="text-xs font-medium">{permissionLabel(permission)}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {permissionDescription(permission)}
      </p>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="mt-2"
        disabled={disabled}
        onClick={() => onCreate(permission)}
      >
        Create {permissionLabel(permission).toLowerCase()} link
      </Button>
    </div>
  );
}
