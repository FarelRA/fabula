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
import { roleAccent } from "@/lib/cast/avatar";
import type { PlayRun, PlayScene } from "@/lib/play/types";
import { cn } from "cn";

/** Cast rail: seats, tiers, and director floor controls. */
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
    <div className="flex h-full flex-col bg-card/20">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <UsersIcon className="size-4 text-primary" aria-hidden />
        <h2 className="cue text-[0.6rem] text-muted-foreground">Cast</h2>
        <Badge variant="outline" className="ml-auto font-mono text-[9px]">
          {active.length} on stage
        </Badge>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="Cast">
        {active.map((role) => {
          const speaking = run?.roleId === role.id;
          const queued = queuedRoleIds.includes(role.id);
          const isHuman = role.kind === "human";
          const accent = roleAccent(role.card.identity.accentColor);
          return (
            <li key={role.id}>
              <div
                aria-current={speaking ? "true" : undefined}
                className={cn(
                  "group flex items-start gap-2.5 rounded-md border border-transparent px-2 py-2 transition-colors",
                  speaking && "border-primary/30 bg-primary/8",
                  !speaking && "hover:border-border/60 hover:bg-muted/30",
                )}
                style={speaking ? { boxShadow: `inset 2px 0 0 var(--role-${accent})` } : undefined}
              >
                <div className="relative mt-0.5">
                  <RoleAvatar
                    name={role.card.identity.name}
                    monogram={role.card.identity.monogram}
                    accentColor={role.card.identity.accentColor}
                    size="sm"
                    imageUrl={role.avatarUrl}
                    className="size-8 text-[10px]"
                  />
                  {speaking ? (
                    <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-background bg-primary" aria-hidden />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-serif text-[15px] leading-tight text-foreground">
                      {role.card.identity.name}
                    </p>
                    {isHuman ? (
                      <span className="font-mono text-[8px] tracking-[0.08em] text-primary uppercase">
                        you
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                    {role.card.meta.storyRole} · {role.card.meta.tier}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    {speaking ? (
                      <span className="font-mono text-[8px] tracking-[0.08em] text-primary uppercase">
                        speaking
                      </span>
                    ) : queued ? (
                      <span className="font-mono text-[8px] tracking-[0.08em] text-primary uppercase">
                        queued
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {isHuman ? "your seat" : "ready"}
                      </span>
                    )}
                  </div>
                </div>
                {isHuman ? null : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Floor actions for ${role.card.identity.name}`}
                        disabled={disabled}
                        className="text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground data-[state=open]:text-foreground"
                      >
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="truncate">
                        {role.card.identity.name}
                      </DropdownMenuLabel>
                      <div className="flex gap-1 px-2 pb-1">
                        <StoryRoleBadge storyRole={role.card.meta.storyRole} />
                        <TierBadge tier={role.card.meta.tier} />
                      </div>
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
        <div className="border-t border-border/60 p-2">
          <p className="cue mb-1.5 px-1 text-[0.5rem] text-muted-foreground">Wings</p>
          <ul className="space-y-0.5">
            {offstage.map((role) => (
              <li
                key={role.id}
                className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-xs text-muted-foreground"
              >
                <RoleAvatar
                  name={role.card.identity.name}
                  monogram={role.card.identity.monogram}
                  accentColor={role.card.identity.accentColor}
                  size="sm"
                  className="size-6 text-[9px] opacity-70"
                />
                <span className="truncate">{role.card.identity.name}</span>
                <span className="ml-auto font-mono text-[8px]">off-stage</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="border-t border-border/60 px-3 py-2">
        <p className="font-mono text-[9px] leading-relaxed text-muted-foreground">
          Hover a card for floor actions. Mention to hand over the next beat.
        </p>
      </div>
    </div>
  );
}
