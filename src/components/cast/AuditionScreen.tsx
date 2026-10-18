"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuditionGrid } from "@/components/cast/AuditionGrid";
import { CastProgress } from "@/components/cast/CastProgress";
import { OpeningStep } from "@/components/cast/OpeningStep";
import { RoleEditorSheet } from "@/components/cast/RoleEditorSheet";
import { SampleLineSheet } from "@/components/cast/SampleLineSheet";
import { EmptyState } from "@/components/shell/states";
import { useCastSession } from "@/lib/cast/sessionContext";
import { isRoleField, toggleLock, type RoleField } from "@/lib/cast/fields";
import type { RoleCardPatch } from "@/lib/cast/types";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Audition screen container. One component behind all three doors:
 * quick start renders it compact, the wizard renders the full grid. It owns
 * transient UI state (editor/sample sheets) while the cast session owns data.
 */
export function AuditionScreen({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const session = useCastSession();
  const [editorRoleId, setEditorRoleId] = useState<string | null>(null);
  const [editorField, setEditorField] = useState<RoleField | undefined>(undefined);
  const [sampleRoleId, setSampleRoleId] = useState<string | null>(null);
  const [sampleLines, setSampleLines] = useState<string[] | null>(null);
  const [sampleCached, setSampleCached] = useState(true);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const scene = session.scene;
  if (!scene) {
    if (session.busy.casting) return <CastProgress />;
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="No scene on the table"
          description="Start from a premise or a template to cast a troupe."
          action={
            <Link
              href="/new"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Open the three doors
            </Link>
          }
        />
      </div>
    );
  }

  const editorRole = scene.roles.find((role) => role.id === editorRoleId) ?? null;
  const sampleRole = scene.roles.find((role) => role.id === sampleRoleId) ?? null;
  const activeAi = scene.roles.filter(
    (role) => role.kind === "ai" && role.status === "active",
  ).length;
  const you = scene.roles.find((role) => role.kind === "human");
  const draft = scene.openingDraft ?? null;

  function openEditor(roleId: string, field?: string): void {
    setEditorRoleId(roleId);
    setEditorField(field && isRoleField(field) ? field : undefined);
  }

  async function saveRole(patch: RoleCardPatch): Promise<void> {
    if (!editorRole) return;
    await session.updateRole(editorRole.id, patch);
  }

  async function toggleFieldLock(roleId: string, field: string): Promise<void> {
    const role = scene?.roles.find((candidate) => candidate.id === roleId);
    if (!role) return;
    await session.setLocks(roleId, toggleLock(role.draftLocks, field));
  }

  async function openSample(roleId: string, force = false): Promise<void> {
    const role = scene?.roles.find((candidate) => candidate.id === roleId);
    setSampleRoleId(roleId);
    setSampleLoading(true);
    if (!force && role) {
      setSampleLines(role.sampleLines ?? role.card.voice.sampleLines);
      setSampleCached(true);
    }
    try {
      const result = await session.requestSampleLines(roleId, force);
      setSampleLines(result.lines);
      setSampleCached(result.cached);
    } catch (error) {
      setStartError(messageOf(error));
    } finally {
      setSampleLoading(false);
    }
  }

  async function start(text: string): Promise<void> {
    setStarting(true);
    setStartError(null);
    try {
      const { sceneId } = await session.commitOpening({ text });
      router.push(`/s/${sceneId}`);
    } catch (error) {
      setStartError(messageOf(error));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-[0.2em] text-primary uppercase">
            <SparklesIcon className="size-3.5" aria-hidden />
            Audition
          </p>
          <h1 className="font-serif text-2xl leading-tight sm:text-3xl">{scene.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{scene.premise}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{activeAi} AI roles</Badge>
          {you ? <Badge variant="secondary">You: {you.card.identity.name}</Badge> : null}
          <Badge variant="outline">Draft</Badge>
        </div>
      </header>

      <AuditionGrid
        scene={scene}
        busy={session.busy}
        changedFields={session.changedFields}
        warnings={session.warnings}
        error={session.error}
        compact={compact}
        onDismissError={session.clearError}
        onEdit={openEditor}
        onToggleLock={toggleFieldLock}
        onRegenField={session.regenerateField}
        onRegenRole={session.regenerateRole}
        onSample={(roleId) => void openSample(roleId)}
        onDuplicate={session.duplicateRole}
        onStatus={session.setRoleStatus}
        onReorder={session.reorder}
        onAddRole={session.addRole}
        onRegenCast={session.regenerateCast}
        onCastSize={session.setCastSize}
      />

      <div className="mt-6">
        <OpeningStep
          draft={draft}
          drafting={session.busy.opening}
          starting={starting}
          error={startError}
          onGenerate={() => void session.draftOpening()}
          onStart={(text) => void start(text)}
        />
      </div>

      <RoleEditorSheet
        role={editorRole}
        open={editorRole !== null}
        initialField={editorField}
        onOpenChange={(open) => {
          if (!open) {
            setEditorRoleId(null);
            setEditorField(undefined);
          }
        }}
        onSave={saveRole}
      />

      <SampleLineSheet
        role={sampleRole}
        open={sampleRole !== null}
        onOpenChange={(open) => {
          if (!open) setSampleRoleId(null);
        }}
        lines={sampleLines ?? sampleRole?.card.voice.sampleLines ?? []}
        cached={sampleCached}
        loading={sampleLoading}
        onRegenerate={() => {
          if (sampleRoleId) void openSample(sampleRoleId, true);
        }}
      />
    </div>
  );
}
