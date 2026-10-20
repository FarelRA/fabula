"use client";

import type { ReactNode } from "react";
import {
  CopyIcon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  UnlockIcon,
  UserMinusIcon,
  MoreVerticalIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { ChangedBadge, StoryRoleBadge, TierBadge } from "@/components/cast/CastMeta";
import type { CastRole } from "@/lib/cast/types";
import { isLocked } from "@/lib/cast/fields";
import { roleAccent } from "@/lib/cast/avatar";
import { cn } from "cn";

type RoleCardViewProps = {
  role: CastRole;
  changed?: readonly string[];
  busyField?: string | null;
  busyRole?: boolean;
  busySample?: boolean;
  compact?: boolean;
  disabled?: boolean;
  dragHandle?: ReactNode;
  roleNameById?: Record<string, string>;
  onEdit: (field?: string) => void;
  onToggleLock: (field: string) => void;
  onRegenField: (field: string) => void;
  onRegenRole: () => void;
  onSample: () => void;
  onDuplicate: () => void;
  onOffstage: () => void;
  onRestore: () => void;
};

function FieldSection({
  role,
  field,
  label,
  busy,
  locked,
  changed,
  disabled,
  hideControls,
  onEdit,
  onToggleLock,
  onRegen,
  children,
}: {
  role: CastRole;
  field: string;
  label: string;
  busy: boolean;
  locked: boolean;
  changed: boolean;
  disabled?: boolean;
  hideControls?: boolean;
  onEdit: (field: string) => void;
  onToggleLock: (field: string) => void;
  onRegen: (field: string) => void;
  children: ReactNode;
}) {
  const name = role.card.identity.name;
  return (
    <section
      aria-label={`${label}, ${name}`}
      className={cn(
        "border-t border-border/55 pt-2.5 first:border-t-0 first:pt-0",
        changed && "border-primary/35",
      )}
    >
      <header className="mb-1 flex min-h-6 items-center gap-1">
        <h4
          className={cn(
            "cue text-[0.55rem]",
            changed ? "text-primary" : "text-muted-foreground/80",
          )}
        >
          {label}
        </h4>
        {changed ? <ChangedBadge fields={[field]} /> : null}
        {hideControls ? null : (
          <div className="ml-auto flex items-center opacity-80 transition-opacity group-hover/card:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Regenerate ${label} for ${name}`}
              title={locked ? "Unlock to regenerate this field" : `Regenerate ${label}`}
              disabled={disabled || busy || locked}
              onClick={() => onRegen(field)}
            >
              <RefreshCwIcon className={cn(busy && "animate-spin motion-reduce:animate-none")} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`${locked ? "Unlock" : "Lock"} ${label} for ${name}`}
              aria-pressed={locked}
              onClick={() => onToggleLock(field)}
            >
              {locked ? <LockIcon /> : <UnlockIcon />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Edit ${label} for ${name}`}
              disabled={disabled}
              onClick={() => onEdit(field)}
            >
              <PencilIcon />
            </Button>
          </div>
        )}
      </header>
      <div className="text-[13px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * One auditioner card. Every field group has edit, lock and regenerate
 * affordances; changed groups from the last regeneration carry a diff badge.
 * Off-stage roles collapse but are never deleted.
 */
export function RoleCardView({
  role,
  changed = [],
  busyField,
  busyRole,
  busySample,
  compact = false,
  disabled,
  dragHandle,
  roleNameById,
  onEdit,
  onToggleLock,
  onRegenField,
  onRegenRole,
  onSample,
  onDuplicate,
  onOffstage,
  onRestore,
}: RoleCardViewProps) {
  const card = role.card;
  const name = card.identity.name;
  const isHuman = role.kind === "human";
  const offstage = role.status !== "active";
  const changedSet = new Set(changed);
  const accent = roleAccent(card.identity.accentColor);

  if (offstage) {
    return (
      <article
        aria-label={`${name}, off-stage`}
        className="flex items-center gap-3 rounded-lg border border-dashed border-border/80 bg-card/35 p-3"
      >
        <RoleAvatar
          name={name}
          monogram={card.identity.monogram}
          accentColor={card.identity.accentColor}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg">{name}</p>
          <p className="text-xs text-muted-foreground">
            Off-stage, existing beats are untouched.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRestore}>
          <RotateCcwIcon />
          Restore
        </Button>
      </article>
    );
  }

  return (
    <article
      aria-label={`${name}${isHuman ? ", your role" : ""}`}
      className="group/card flex flex-col gap-3 overflow-hidden rounded-lg border border-border/80 bg-card p-4 shadow-[var(--panel-shadow)] border-t-2"
      style={{ borderTopColor: `var(--role-${accent})` }}
    >
      <header className="flex items-start gap-3">
        <RoleAvatar
          name={name}
          monogram={card.identity.monogram}
          accentColor={card.identity.accentColor}
          imageUrl={role.avatarUrl}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-serif text-xl leading-tight">{name}</h3>
            {isHuman ? <Badge variant="outline" className="border-primary/30 text-primary">You</Badge> : null}
            {changed.length > 0 ? <ChangedBadge fields={changed} /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {card.identity.occupation} · {card.identity.pronouns}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <StoryRoleBadge storyRole={card.meta.storyRole} />
            <TierBadge tier={card.meta.tier} />
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {isHuman ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`${isLocked(role, "identity") ? "Unlock" : "Lock"} Identity for ${name}`}
              aria-pressed={isLocked(role, "identity")}
              title={
                isLocked(role, "identity")
                  ? "Identity is locked against regeneration"
                  : "Lock the name and identity against regeneration"
              }
              onClick={() => onToggleLock("identity")}
            >
              {isLocked(role, "identity") ? <LockIcon /> : <UnlockIcon />}
            </Button>
          )}
          {dragHandle}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${name}`}>
                <MoreVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit()}>
                <PencilIcon />
                Edit card
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSample}>
                <PlayIcon />
                Hear a sample line
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDuplicate}>
                <CopyIcon />
                Duplicate role
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onRegenRole} disabled={isHuman || busyRole}>
                <RefreshCwIcon className={cn(busyRole && "animate-spin")} />
                Regenerate role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOffstage} variant="destructive">
                <UserMinusIcon />
                Move off-stage
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="space-y-2.5">
        <FieldSection
          role={role}
          field="hook"
          label="Hook"
          busy={busyField === `${role.id}:hook`}
          locked={isLocked(role, "hook")}
          changed={changedSet.has("hook")}
          disabled={disabled}
          hideControls={isHuman}
          onEdit={onEdit}
          onToggleLock={onToggleLock}
          onRegen={onRegenField}
        >
          <p className="text-foreground/85">{card.hook}</p>
        </FieldSection>

        <FieldSection
          role={role}
          field="psychology"
          label="Personality"
          busy={busyField === `${role.id}:psychology`}
          locked={isLocked(role, "psychology")}
          changed={changedSet.has("psychology")}
          disabled={disabled}
          hideControls={isHuman}
          onEdit={onEdit}
          onToggleLock={onToggleLock}
          onRegen={onRegenField}
        >
          <p>{card.psychology.traits.join(" · ")}</p>
          <p className="mt-1 text-xs italic text-muted-foreground/85">
            Secret: {card.psychology.secret}
          </p>
        </FieldSection>

        {compact ? null : (
          <>
            <FieldSection
              role={role}
              field="voice"
              label="Voice"
              busy={busyField === `${role.id}:voice`}
              locked={isLocked(role, "voice")}
              changed={changedSet.has("voice")}
              disabled={disabled}
              hideControls={isHuman}
              onEdit={onEdit}
              onToggleLock={onToggleLock}
              onRegen={onRegenField}
            >
              {card.voice.register}, {card.voice.rhythm}
            </FieldSection>

            <FieldSection
              role={role}
              field="drives"
              label="Goals"
              busy={busyField === `${role.id}:drives`}
              locked={isLocked(role, "drives")}
              changed={changedSet.has("drives")}
              disabled={disabled}
              hideControls={isHuman}
              onEdit={onEdit}
              onToggleLock={onToggleLock}
              onRegen={onRegenField}
            >
              Wants {card.drives.publicGoal.toLowerCase()}
            </FieldSection>
          </>
        )}
      </div>

      {card.relations.length > 0 ? (
        <details className="border-t border-border/55 pt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            Relationships ({card.relations.length})
          </summary>
          <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
            {card.relations.map((relation) => (
              <li key={`${role.id}:${relation.toRoleId}`}>
                <span className="text-foreground">
                  {roleNameById?.[relation.toRoleId] ?? "Another role"}
                </span>{" "}
                · {relation.dynamic} (tension {relation.tension.toFixed(1)})
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="flex items-center gap-1.5 border-t border-border/55 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSample}
          disabled={busySample}
          aria-label={`Hear ${name}'s voice`}
        >
          <PlayIcon className={cn(busySample && "animate-pulse")} />
          Sample line
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit()}>
          <PencilIcon />
          Edit
        </Button>
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">
          {isHuman ? "human · you" : "AI · editable"}
        </span>
      </div>
    </article>
  );
}
