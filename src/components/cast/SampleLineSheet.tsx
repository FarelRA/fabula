"use client";

import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import type { CastRole } from "@/lib/cast/types";

/**
 * Sample-line sheet (PLAN §9.5 / Phase 4.4): bottom sheet on every viewport,
 * focus-trapped by Radix. Cached lines render instantly; "Write another"
 * forces a fresh standard-tier generation.
 */
export function SampleLineSheet({
  role,
  open,
  onOpenChange,
  lines,
  cached,
  loading,
  onRegenerate,
}: {
  role: CastRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: readonly string[];
  cached: boolean;
  loading: boolean;
  onRegenerate: () => void;
}) {
  if (!role) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <RoleAvatar
              name={role.card.identity.name}
              monogram={role.card.identity.monogram}
              accentColor={role.card.identity.accentColor}
              size="sm"
            />
            {role.card.identity.name}&apos;s voice
          </SheetTitle>
          <SheetDescription>
            {cached
              ? "Cached for this version of the role card."
              : "Freshly generated for this audition."}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {loading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
              <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
              Finding the voice…
            </p>
          ) : (
            <ul className="space-y-3 py-2">
              {lines.map((line, index) => (
                <li
                  key={`${index}-${line}`}
                  className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-serif text-base leading-relaxed"
                >
                  “{line}”
                </li>
              ))}
            </ul>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={loading}
            className="mt-3"
          >
            <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
            Write another
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
