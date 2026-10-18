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
import { cn } from "cn";
import { MoreVerticalIcon } from "lucide-react";

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
      aria-label={`${label} — ${name}`}
      className={cn(
        "rounded-lg border border-border/60 px-2.5 py-2",
        changed && "border-primary/50 bg-primary/5",
      )}
    >
      <header className="mb-1 flex min-h-6 items-center gap-1">
        <h4 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </h4>
        {changed ? <ChangedBadge fields={[field]} /> : null}
        {hideControls ? null : (
          <div className="ml-auto flex items-center">
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
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * One auditioner card (PLAN §9.5). Every field group has edit, lock and
 * regenerate affordances; changed groups from the last regeneration carry a
 * diff badge. Off-stage roles collapse but are never deleted.
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

  if (offstage) {
    return (
      <article
        aria-label={`${name}, off-stage`}
        className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-3"
      >
        <RoleAvatar
          name={name}
          monogram={card.identity.monogram}
          accentColor={card.identity.accentColor}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            Off-stage — existing beats are untouched.
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
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm"
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
            <h3 className="truncate font-heading text-base font-semibold">{name}</h3>
            {isHuman ? <Badge variant="outline">You</Badge> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {card.identity.occupation} · {card.identity.pronouns}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <StoryRoleBadge storyRole={card.meta.storyRole} />
            <TierBadge tier={card.meta.tier} />
            {changed.length > 0 ? <ChangedBadge fields={changed} /> : null}
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
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`More actions for ${name}`}
              >
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
        {card.hook}
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
        <p className="mt-1 text-xs italic">Secret: {card.psychology.secret}</p>
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
            {card.voice.register} — {card.voice.rhythm}
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

      {card.relations.length > 0 ? (
        <details className="rounded-lg border border-border/60 px-2.5 py-1.5">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Relationships ({card.relations.length})
          </summary>
          <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
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

      <div className="flex items-center gap-1.5 pt-0.5">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit()}
        >
          <PencilIcon />
          Edit
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {isHuman ? "Human · you" : `${card.meta.modelTier} model`}
        </span>
      </div>
    </article>
  );
}
