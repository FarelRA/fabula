"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { RoleCardView } from "@/components/cast/RoleCardView";
import { CastSizeStepper } from "@/components/cast/CastSizeStepper";
import { EmptyState } from "@/components/shell/states";
import type { CastBusy, CastRole, CastScene, CastRoleStatus } from "@/lib/cast/types";
import { cn } from "cn";

type AuditionGridProps = {
  scene: CastScene;
  busy: CastBusy;
  changedFields: Record<string, string[]>;
  warnings: string[];
  error: string | null;
  compact?: boolean;
  onDismissError: () => void;
  onEdit: (roleId: string, field?: string) => void;
  onToggleLock: (roleId: string, field: string) => void;
  onRegenField: (roleId: string, field: string) => void;
  onRegenRole: (roleId: string) => void;
  onSample: (roleId: string) => void;
  onDuplicate: (roleId: string) => void;
  onStatus: (roleId: string, status: CastRoleStatus) => void;
  onReorder: (roleIds: string[]) => void;
  onAddRole: () => void;
  onRegenCast: (vibe: string) => void;
  onCastSize: (size: number) => void;
};

function SortableCard({
  role,
  dragLabel,
  children,
}: {
  role: CastRole;
  dragLabel: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: role.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const handle = (
    <button
      type="button"
      className="inline-flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:cursor-default"
      aria-label={dragLabel}
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon className="size-3.5" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-10 opacity-70")}
    >
      {children(handle)}
    </div>
  );
}

/**
 * The audition grid: one component for quick-start audition-lite
 * and the full wizard audition. Cards are sortable with @dnd-kit (pointer and
 * keyboard sensors); every destructive-looking action is a soft state.
 */
export function AuditionGrid({
  scene,
  busy,
  changedFields,
  warnings,
  error,
  compact = false,
  onDismissError,
  onEdit,
  onToggleLock,
  onRegenField,
  onRegenRole,
  onSample,
  onDuplicate,
  onStatus,
  onReorder,
  onAddRole,
  onRegenCast,
  onCastSize,
}: AuditionGridProps) {
  const [vibe, setVibe] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const roleNameById = useMemo(
    () =>
      Object.fromEntries(
        scene.roles.map((role) => [role.id, role.card.identity.name]),
      ) as Record<string, string>,
    [scene.roles],
  );
  const orderedIds = scene.roles.map((role) => role.id);
  const activeAi = scene.roles.filter(
    (role) => role.kind === "ai" && role.status === "active",
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = orderedIds.indexOf(String(active.id));
    const to = orderedIds.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = [...orderedIds];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(to, 0, moved);
    onReorder(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="cue text-primary">The ensemble</p>
          <h2 className="mt-1 font-serif text-2xl leading-tight">
            Meet the troupe before the curtain.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lock what you love, regenerate the rest. Drag cards to change
            spotlight priority.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <UsersIcon className="size-4 text-primary" aria-hidden />
          {activeAi.length} active {activeAi.length === 1 ? "role" : "roles"}
          {scene.roles.length !== activeAi.length
            ? ` · ${scene.roles.length - activeAi.length} off-stage`
            : ""}
        </div>
      </div>

      <Surface tone="flat" padding="sm" className="border-border/70">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="vibe-steer" className="cue shrink-0 text-[0.55rem] text-muted-foreground">
            Vibe steer
          </label>
          <Input
            id="vibe-steer"
            value={vibe}
            onChange={(event) => setVibe(event.target.value)}
            placeholder="“make the whole cast younger”, “more pressure, fewer speeches”…"
            className="flex-1 border-transparent bg-background/30"
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy.castRegen}
            onClick={() => onRegenCast(vibe)}
          >
            <SparklesIcon />
            {busy.castRegen ? "Regenerating…" : "Apply to cast"}
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Locked fields survive regeneration; changed cards get a badge. This is
          a suggestion to the casting pass, not a hard instruction.
        </p>
      </Surface>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={onDismissError}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul
          role="status"
          className="space-y-1 rounded-md border border-border/70 bg-card/35 px-3 py-2 text-xs text-muted-foreground"
        >
          {warnings.map((warning) => (
            <li key={warning} className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {scene.roles.length === 0 ? (
        <EmptyState
          title="No roles yet"
          description="Add a blank role or regenerate the cast."
          action={
            <Button variant="outline" size="sm" onClick={onAddRole}>
              <PlusIcon />
              Add blank role
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
            <div
              className={cn(
                "grid gap-3",
                compact ? "sm:grid-cols-2" : "md:grid-cols-2",
                scene.roles.length > 2 && "xl:grid-cols-3",
              )}
            >
              {scene.roles.map((role) => (
                <SortableCard
                  key={role.id}
                  role={role}
                  dragLabel={`Reorder ${role.card.identity.name}`}
                >
                  {(handle) => (
                    <RoleCardView
                      role={role}
                      changed={changedFields[role.id] ?? []}
                      busyField={busy.field}
                      busyRole={busy.role === role.id}
                      busySample={busy.sample === role.id}
                      compact={compact}
                      roleNameById={roleNameById}
                      dragHandle={handle}
                      onEdit={(field) => onEdit(role.id, field)}
                      onToggleLock={(field) => onToggleLock(role.id, field)}
                      onRegenField={(field) => onRegenField(role.id, field)}
                      onRegenRole={() => onRegenRole(role.id)}
                      onSample={() => onSample(role.id)}
                      onDuplicate={() => onDuplicate(role.id)}
                      onOffstage={() => onStatus(role.id, "offstage")}
                      onRestore={() => onStatus(role.id, "active")}
                    />
                  )}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Surface tone="flat" padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <CastSizeStepper
            value={activeAi.length}
            onChange={onCastSize}
            disabled={busy.resize}
            showTierPreview
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="hidden font-normal sm:inline-flex">
            {scene.roles.length} cards
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddRole}
            aria-label="Add blank role"
          >
            <PlusIcon />
            Add blank role
          </Button>
        </div>
      </Surface>
    </div>
  );
}
