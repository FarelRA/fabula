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
import { GripVerticalIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      className="inline-flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:cursor-default"
      aria-label={dragLabel}
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon className="size-4" />
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
 * The audition grid (PLAN §9.5): one component for quick-start audition-lite
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
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="vibe-steer" className="text-sm font-medium">
            Vibe steer
          </label>
          <Input
            id="vibe-steer"
            value={vibe}
            onChange={(event) => setVibe(event.target.value)}
            placeholder="“make the whole cast younger”, “more pressure, fewer speeches”…"
            className="flex-1"
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
        <p className="text-xs text-muted-foreground">
          Locked fields survive regeneration; changed cards get a badge.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
          className="space-y-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
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
                compact ? "sm:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3",
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

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
        <CastSizeStepper
          value={activeAi.length}
          onChange={onCastSize}
          disabled={busy.resize}
          showTierPreview
        />
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
    </div>
  );
}
