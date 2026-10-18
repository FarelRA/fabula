import type { Doc } from "@convex/_generated/dataModel";

/**
 * Share-link helpers. Pure: given a token, a browser
 * origin and a row, produce what the dialog renders, linkable URLs and a
 * four-state status that the owner can act on.
 */

export type SharePermission = "viewer" | "director";

export function shareUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/share/${token}`;
}

export function permissionLabel(permission: SharePermission): string {
  return permission === "director" ? "Can direct" : "View only";
}

export function permissionDescription(permission: SharePermission): string {
  return permission === "director"
    ? "Anyone with this link can pick path options in the scene."
    : "Anyone with this link can watch the scene live, read-only.";
}

export type ShareStatus = "active" | "revoked" | "expired";

export function shareStatus(
  row: Pick<Doc<"shareLinks">, "revokedAt" | "expiresAt">,
  now: number,
): ShareStatus {
  if (row.revokedAt !== undefined) return "revoked";
  if (row.expiresAt !== undefined && row.expiresAt <= now) return "expired";
  return "active";
}

export function shareStatusLabel(status: ShareStatus): string {
  if (status === "revoked") return "Revoked";
  if (status === "expired") return "Expired";
  return "Active";
}
