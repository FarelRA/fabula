"use client";

import { ListPlusIcon, MicIcon, MoreHorizontalIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { StoryRoleBadge, TierBadge } from "@/components/cast/CastMeta";
import type { PlayRun, PlayScene } from "@/lib/play/types";
import { cn } from "cn";

/** Cast rail (PLAN §9.7): seats, tiers, and director floor controls. */
export function CastRail({
  scene,
  run,
  queuedRoleIds,
  disabled,
  onMention,
  onQueue,
}: {
  scene: PlayScene;
  run: PlayRun | null;
  queuedRoleIds: readonly string[];
  disabled?: boolean;
  onMention: (roleId: string) => void;
  onQueue: (roleId: string) => void;
}) {
  const active = scene.roles.filter((role) => role.status === "active");
  const offstage = scene.roles.filter((role) => role.status !== "active");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="font-heading text-sm font-semibold">Cast</h2>
        <Badge variant="outline" className="ml-auto font-normal">
          {active.length} active
        </Badge>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="Cast">
        {active.map((role) => {
          const speaking = run?.roleId === role.id;
          const queued = queuedRoleIds.includes(role.id);
          const isHuman = role.kind === "human";
          return (
            <li key={role.id}>
              <div
                aria-current={speaking ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5",
                  speaking && "border-primary/40 bg-primary/10",
                )}
              >
                <RoleAvatar
                  name={role.card.identity.name}
                  monogram={role.card.identity.monogram}
                  accentColor={role.card.identity.accentColor}
                  size="sm"
                  imageUrl={role.avatarUrl}
                  className="size-9 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {role.card.identity.name}
                    {isHuman ? " (you)" : ""}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <TierBadge tier={role.card.meta.tier} className="text-[10px]" />
                    <span className="truncate text-[10px] text-muted-foreground">
                      {role.card.meta.storyRole}
                    </span>
                  </div>
                </div>
                {queued ? (
                  <Badge variant="secondary" className="font-normal">
                    queued
                  </Badge>
                ) : null}
                {isHuman ? null : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Floor actions for ${role.card.identity.name}`}
                        disabled={disabled}
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="truncate">
                        {role.card.identity.name}
                      </DropdownMenuLabel>
                      <StoryRoleBadge storyRole={role.card.meta.storyRole} />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => onMention(role.id)}>
                        <MicIcon />
                        Give floor now
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onQueue(role.id)}>
                        <ListPlusIcon />
                        Queue next
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {offstage.length > 0 ? (
        <div className="border-t border-border p-2">
          <p className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
            Off-stage
          </p>
          <ul className="space-y-1">
            {offstage.map((role) => (
              <li
                key={role.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-muted-foreground"
              >
                <RoleAvatar
                  name={role.card.identity.name}
                  monogram={role.card.identity.monogram}
                  accentColor={role.card.identity.accentColor}
                  size="sm"
                  className="size-7 text-[10px]"
                />
                <span className="truncate">{role.card.identity.name}</span>
                <span className="ml-auto text-[10px]">off-stage</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
