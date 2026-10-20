"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuditionGrid } from "@/components/cast/AuditionGrid";
import { CastProgress } from "@/components/cast/CastProgress";
import { OpeningStep } from "@/components/cast/OpeningStep";
import { RoleEditorSheet } from "@/components/cast/RoleEditorSheet";
import { Wordmark } from "@/components/brand/Wordmark";
import { SampleLineSheet } from "@/components/cast/SampleLineSheet";
import { EmptyState } from "@/components/shell/states";
import { useCastSession } from "@/lib/cast/sessionContext";
import { isRoleField, toggleLock, type RoleField } from "@/lib/cast/fields";
import { toneSummary } from "@/lib/cast/presets";
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
    <div className="stage-haze min-h-dvh">
      <div className="studio-shell py-8 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Back to the three doors
          </Link>
          <Wordmark className="shrink-0" />
        </div>

        <header className="mt-5 flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="cue flex items-center gap-2 text-primary">
              <SparklesIcon className="size-3.5" aria-hidden />
              <span>Audition</span>
              <span className="text-muted-foreground/70">· Green room</span>
            </p>
            <h1 className="mt-2 font-serif text-4xl leading-[1.04] tracking-[-0.025em] text-balance sm:text-5xl">
              {scene.title}
            </h1>
            <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
              {scene.premise}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="gap-1">
              <UsersIcon className="size-3" aria-hidden />
              {activeAi} AI roles
            </Badge>
            {you ? (
              <Badge variant="outline" className="border-primary/30 text-primary">
                You: {you.card.identity.name}
              </Badge>
            ) : (
              <Badge variant="outline">Director from the wings</Badge>
            )}
            <Badge variant="secondary">Draft</Badge>
          </div>
        </header>

        <div className="mt-4 grid gap-2 border-b border-border/60 pb-4 text-[11px] text-muted-foreground sm:grid-cols-4">
          <p>
            <span className="cue mr-2 text-[0.55rem] text-muted-foreground/80">Tone</span>
            {toneSummary(scene.settings.tone)}
          </p>
          <p>
            <span className="cue mr-2 text-[0.55rem] text-muted-foreground/80">Style</span>
            {scene.settings.presentationStyle}
          </p>
          <p>
            <span className="cue mr-2 text-[0.55rem] text-muted-foreground/80">World</span>
            {scene.settings.settingEra || scene.settings.genre}
          </p>
          <p>
            <span className="cue mr-2 text-[0.55rem] text-muted-foreground/80">Opening</span>
            {draft ? "drafted" : "not yet written"}
          </p>
        </div>

        <div className="mt-6">
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
        </div>

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
    </div>
  );
}
