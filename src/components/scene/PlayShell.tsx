"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { useQueryState, parseAsString, parseAsStringEnum } from "nuqs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  PanelLeftIcon,
  PanelRightIcon,
  Share2Icon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CastProgress } from "@/components/cast/CastProgress";
import { CastRail } from "@/components/director/CastRail";
import { ConfirmDialog } from "@/components/director/ConfirmDialog";
import { DirectorBar } from "@/components/director/DirectorBar";
import { EditBeatDialog } from "@/components/director/EditBeatDialog";
import { FloorIndicator } from "@/components/director/FloorIndicator";
import { SteerComposer } from "@/components/director/SteerComposer";
import { InspectorPane } from "@/components/inspector/InspectorPane";
import { ExportDialog } from "@/components/scenes/ExportDialog";
import { ShareDialog } from "@/components/scenes/ShareDialog";
import { ThreadView } from "@/components/thread/ThreadView";
import { useConnectionState } from "@/hooks/useConnectionState";
import { useKeymap } from "@/hooks/useKeymap";
import { useViewportMode } from "@/hooks/useViewportMode";
import { buildPlayScene, mapPlayRun } from "@/lib/play/map";
import {
  nextSpeakerPreview,
  shouldAutoStart,
  tipOptions,
} from "@/lib/play/helpers";
import {
  INSPECTOR_TABS,
  type InspectorTab,
} from "@/lib/inspector/tabs";
import { buildGutterMarkers, type GutterMarker } from "@/lib/branches/gutter";
import { mapBranchRows } from "@/lib/branches/types";
import type { PlayBeat, PlayOption } from "@/lib/play/types";
import type { ExportBundle } from "@/lib/export/types";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type DialogState =
  | { kind: "regenerate"; beat: PlayBeat }
  | { kind: "ghostPick"; option: PlayOption }
  | { kind: "endScene" }
  | null;

/**
 * Live play shell: reactive queries for beats/options/floor,
 * streaming deltas via useUIMessages, optimistic picks, auto-burst, and the
 * three director modes. Beats are the source of truth; streams are transport.
 */
export function PlayShell({ sceneId }: { sceneId: string }) {
  const id = sceneId as Id<"scenes">;
  const [castOpen, setCastOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const connection = useConnectionState();
  const offline = connection === "offline";
  // Offline locks every mutating affordance; the global banner in
  // the app shell explains why. Reconnecting keeps mutations queued by Convex.
  const interactionBusy = busy || offline;
  const [queuedRoleIds, setQueuedRoleIds] = useState<string[]>([]);
  const [forcedSpeaker, setForcedSpeaker] = useState<string | null>(null);
  const [pendingPick, setPendingPick] = useState<PlayOption | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [editBeat, setEditBeat] = useState<PlayBeat | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSnapshots, setExportSnapshots] = useState(false);
  const [wrapDismissed, setWrapDismissed] = useState(false);
  const lastAutoKey = useRef("");
  const startingRef = useRef(false);
  const runRef = useRef<ReturnType<typeof mapPlayRun>>(null);
  const router = useRouter();
  const viewport = useViewportMode();
  const [inspectorTab, setInspectorTab] = useQueryState(
    "inspector",
    parseAsStringEnum<InspectorTab>([...INSPECTOR_TABS]).withOptions({
      history: "replace",
    }),
  );
  const [selectedBeatId, setSelectedBeatId] = useQueryState(
    "beat",
    parseAsString.withOptions({ history: "replace" }),
  );
  const lastInspectorTab = useRef<InspectorTab>("memory");
  useEffect(() => {
    if (inspectorTab) lastInspectorTab.current = inspectorTab;
  }, [inspectorTab]);

  const sceneData = useQuery(api.scenes.get, { sceneId: id });
  const roleDocs = useQuery(api.cast.listRoles, {
    sceneId: id,
    includeInactive: true,
  });
  const path = useQuery(api.beats.listPath, { sceneId: id, limit: 1000 });
  const pendingDocs = useQuery(api.beats.listPending, { sceneId: id });
  const optionDocs = useQuery(api.candidates.listForScene, { sceneId: id });
  const noteDocs = useQuery(api.directorNotes.listActive, { sceneId: id });
  const runDoc = useQuery(api.generation.runs.active, { sceneId: id });
  const lastActions = useQuery(api.actions.list, { sceneId: id, limit: 1 });
  const branchDocs = useQuery(api.branches.list, { sceneId: id });
  const threadId = sceneData?.scene.threadId;
  const exportBundle = useQuery(
    api.exportScene.getBundle,
    exportOpen ? { sceneId: id, includeSnapshots: exportSnapshots } : "skip",
  );

  const { results: uiMessages } = useUIMessages(
    api.thread.listMessages,
    threadId ? { sceneId: id, threadId } : "skip",
    { initialNumItems: 30, stream: true },
  );

  const startTurnAction = useAction(api.generation.turn.start);
  const offerAction = useAction(api.generation.options.offer);
  const regenerateAction = useAction(api.generation.regenerate.beat);
  const pickMutation = useMutation(api.candidates.pick);
  const addNoteMutation = useMutation(api.directorNotes.add);
  const resolveNoteMutation = useMutation(api.directorNotes.resolve);
  const appendUserMutation = useMutation(api.beats.appendUserBeat);
  const editForkMutation = useMutation(api.beats.editFork);
  const pinMutation = useMutation(api.beats.pin);
  const setStatusMutation = useMutation(api.scenes.setStatus);
  const abortMutation = useMutation(api.generation.runs.requestAbort);
  const undoMutation = useMutation(api.actions.undoLast);
  const setActiveMutation = useMutation(api.branches.setActive);
  const endSceneMutation = useMutation(api.scenes.endScene);

  const scene = useMemo(() => {
    if (
      !sceneData?.scene ||
      !sceneData.settings ||
      !roleDocs ||
      !path ||
      !pendingDocs ||
      !optionDocs ||
      !noteDocs
    ) {
      return null;
    }
    return buildPlayScene({
      scene: sceneData.scene,
      settings: sceneData.settings,
      roles: roleDocs,
      beats: path.beats,
      pending: pendingDocs,
      options: optionDocs,
      notes: noteDocs,
    });
  }, [sceneData, roleDocs, path, pendingDocs, optionDocs, noteDocs]);

  const run = mapPlayRun(runDoc);
  runRef.current = run;

  const streamingText = useMemo(() => {
    const streaming = [...(uiMessages ?? [])]
      .filter((message) => message.status === "streaming")
      .sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder);
    return streaming.at(-1)?.text ?? "";
  }, [uiMessages]);

  const canUndo = Boolean(
    lastActions?.[0] && lastActions[0].undoneAt === null,
  );

  const branches = useMemo(
    () => (branchDocs ? mapBranchRows(branchDocs) : []),
    [branchDocs],
  );
  const branchById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch])),
    [branches],
  );

  const gutterMarkers = useMemo<GutterMarker[]>(() => {
    if (!scene || branches.length === 0) return [];
    return buildGutterMarkers({
      beats: scene.beats.map((beat) => ({
        id: beat.id,
        branchId: beat.branchId,
        parentBeatId: beat.parentBeatId,
        seq: beat.seq,
        depth: 0,
        speakerRoleId: beat.speakerRoleId,
        origin: beat.origin,
        status: beat.status,
        isArtifact: beat.isArtifact,
        isPinned: beat.isPinned,
        textPreview: "",
        textChars: 0,
        createdAt: beat.createdAt,
      })),
      branches,
      candidates: scene.options.map((option) => ({
        id: option.id,
        parentBeatId: option.parentBeatId,
        label: option.label,
        optionIndex: option.optionIndex,
        speakerRoleId: option.speakerRoleId,
        status: "offered" as const,
      })),
      activeBeatIds: scene.beats.map((beat) => beat.id),
      activeTipBeatId: scene.activeTipBeatId,
      activeBranchId: scene.activeBranchId,
      maxSeq: scene.seqCounter,
    });
  }, [branches, scene]);

  const switchBranch = useCallback(
    async (branchId: string) => {
      const branch = branchById.get(branchId);
      if (!branch?.tipBeatId || branch.isActive) return;
      try {
        await setActiveMutation({
          sceneId: id,
          tipBeatId: branch.tipBeatId as Id<"beats">,
        });
        toast.success("Context updated", {
          description: `Memory now follows ${branch.label}. Nothing was regenerated.`,
        });
      } catch (error) {
        toast.error(messageOf(error));
      }
    },
    [branchById, id, setActiveMutation],
  );

  const selectBeat = useCallback(
    (beatId: string) => {
      void setSelectedBeatId(beatId || null);
    },
    [setSelectedBeatId],
  );

  const inspectBeat = useCallback(
    (beatId: string) => {
      void setSelectedBeatId(beatId);
      void setInspectorTab("prompts");
    },
    [setInspectorTab, setSelectedBeatId],
  );

  const toggleInspector = useCallback(() => {
    if (inspectorTab) {
      void setInspectorTab(null);
    } else {
      void setInspectorTab(lastInspectorTab.current);
    }
  }, [inspectorTab, setInspectorTab]);

  const closeInspector = useCallback(() => {
    void setInspectorTab(null);
  }, [setInspectorTab]);

  const startTurn = useCallback(
    async (speakerRoleId?: string, opts?: { auto?: boolean }) => {
      if (startingRef.current || runRef.current) return;
      startingRef.current = true;
      try {
        const result = await startTurnAction({
          sceneId: id,
          ...(speakerRoleId
            ? { speakerRoleId: speakerRoleId as Id<"roles"> }
            : {}),
          ...(opts?.auto ? { auto: true } : {}),
        });
        if (result.status === "failed") {
          toast.error(result.error ?? "The cast could not take the beat.");
        }
      } catch (error) {
        if (!/already running/i.test(messageOf(error))) {
          toast.error(messageOf(error));
        }
      } finally {
        startingRef.current = false;
      }
    },
    [id, startTurnAction],
  );

  const undo = useCallback(async () => {
    try {
      const result = await undoMutation({ sceneId: id });
      if (result.undone) {
        toast.success("Undone", {
          description: result.type ? `Reverted ${result.type}` : undefined,
        });
      } else {
        toast.info("Nothing to undo");
      }
    } catch (error) {
      toast.error(messageOf(error));
    }
  }, [id, undoMutation]);

  const performPick = useCallback(
    async (option: PlayOption) => {
      setPendingPick(option);
      try {
        const result = await pickMutation({
          candidateId: option.id as Id<"candidates">,
        });
        toast.success(result.forked ? "Forked the story" : "Path taken", {
          action: { label: "Undo", onClick: () => void undo() },
        });
        window.setTimeout(() => {
          setPendingPick((current) =>
            current?.id === option.id ? null : current,
          );
        }, 1800);
      } catch (error) {
        toast.error(messageOf(error));
        setPendingPick(null);
      }
    },
    [pickMutation, undo],
  );

  useEffect(() => {
    if (!pendingPick || !scene) return;
    const landed = scene.beats.some(
      (beat) =>
        beat.origin === "option" &&
        beat.parentBeatId === pendingPick.parentBeatId &&
        beat.text === pendingPick.text,
    );
    if (landed) setPendingPick(null);
  }, [pendingPick, scene]);

  const requestPick = useCallback(
    (option: PlayOption) => {
      if (!option.parentIsTip) {
        setDialog({ kind: "ghostPick", option });
        return;
      }
      void performPick(option);
    },
    [performPick],
  );

  const performRegenerate = useCallback(
    async (beat: PlayBeat, instruction?: string) => {
      setBusy(true);
      try {
        const result = await regenerateAction({
          beatId: beat.id as Id<"beats">,
          ...(instruction ? { instruction } : {}),
        });
        if (result.status === "done") {
          toast.success("New take", {
            description: "The original branch is untouched.",
            action: { label: "Undo", onClick: () => void undo() },
          });
        } else {
          toast.info(result.error ?? "Regeneration skipped");
        }
      } catch (error) {
        toast.error(messageOf(error));
      } finally {
        setBusy(false);
      }
    },
    [regenerateAction, undo],
  );

  const performEdit = useCallback(
    async (text: string) => {
      if (!editBeat) return;
      setBusy(true);
      try {
        await editForkMutation({
          beatId: editBeat.id as Id<"beats">,
          newText: text,
        });
        toast.success(`Forked from beat ${editBeat.seq}`, {
          description: "The original beat stays on its branch.",
          action: { label: "Undo", onClick: () => void undo() },
        });
      } catch (error) {
        toast.error(messageOf(error));
      } finally {
        setBusy(false);
        setEditBeat(null);
      }
    },
    [editBeat, editForkMutation, undo],
  );

  const steer = useCallback(
    async (text: string, mode: "continue" | "regenerate" = "continue") => {
      try {
        await addNoteMutation({ sceneId: id, kind: "steer", text });
        if (mode === "regenerate") {
          const tip = scene?.beats[scene.beats.length - 1];
          if (tip) {
            await performRegenerate(tip, text);
          } else {
            toast.success("Steer noted");
          }
          return;
        }
        if (runRef.current) {
          toast.success("Steer noted", {
            description: "It applies from the next beat.",
          });
        } else {
          toast.success("Steer noted");
          void startTurn();
        }
      } catch (error) {
        toast.error(messageOf(error));
      }
    },
    [addNoteMutation, id, performRegenerate, scene, startTurn],
  );

  const write = useCallback(
    async (roleId: string, text: string) => {
      try {
        await appendUserMutation({
          sceneId: id,
          speakerRoleId: roleId as Id<"roles">,
          text,
        });
        toast.success("Line written into the scene");
      } catch (error) {
        toast.error(messageOf(error));
      }
    },
    [appendUserMutation, id],
  );

  const resolveNote = useCallback(
    async (noteId: string) => {
      try {
        await resolveNoteMutation({ noteId: noteId as Id<"directorNotes"> });
      } catch (error) {
        toast.error(messageOf(error));
      }
    },
    [resolveNoteMutation],
  );

  const offerPaths = useCallback(async () => {
    const tip = scene?.activeTipBeatId;
    if (!tip) return;
    setBusy(true);
    try {
      const result = await offerAction({
        sceneId: id,
        parentBeatId: tip as Id<"beats">,
      });
      if (result.warnings.length > 0) {
        toast.info(result.warnings[0] ?? "Paths offered with warnings");
      }
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  }, [id, offerAction, scene?.activeTipBeatId]);

  const togglePause = useCallback(async () => {
    if (!scene) return;
    const next = scene.status === "paused" ? "playing" : "paused";
    setBusy(true);
    try {
      await setStatusMutation({ sceneId: id, status: next });
      toast.success(next === "paused" ? "Auto-floor paused" : "Auto-floor resumed");
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  }, [id, scene, setStatusMutation]);

  const endScene = useCallback(async () => {
    setBusy(true);
    try {
      const result = await endSceneMutation({ sceneId: id });
      toast.success(result.archived ? "Scene wrapped and archived" : "Scene already archived", {
        description:
          "A final summary pass runs now. Nothing is deleted, and the archive keeps every branch.",
        action: {
          label: "Open archive",
          onClick: () => router.push(`/s/${id}/archive`),
        },
      });
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(false);
    }
  }, [id, endSceneMutation, router]);

  const abort = useCallback(async () => {
    try {
      const result = await abortMutation({ sceneId: id });
      toast.info(result.aborted ? "Stopping the current beat…" : "No generation is running");
    } catch (error) {
      toast.error(messageOf(error));
    }
  }, [abortMutation, id]);

  const mention = useCallback(
    (roleId: string) => {
      if (runRef.current) {
        setForcedSpeaker(roleId);
        void abortMutation({ sceneId: id }).catch((error) =>
          toast.error(messageOf(error)),
        );
        toast.info("Stealing the floor…");
      } else {
        void startTurn(roleId);
      }
    },
    [abortMutation, id, startTurn],
  );

  const queueRole = useCallback(
    (roleId: string) => {
      setQueuedRoleIds((current) =>
        current.includes(roleId) ? current : [...current, roleId],
      );
      const role = scene?.roles.find((candidate) => candidate.id === roleId);
      toast.success(`Queued ${role?.card.identity.name ?? "role"}`);
    },
    [scene?.roles],
  );

  const pin = useCallback(
    async (beat: PlayBeat, pinned: boolean) => {
      try {
        await pinMutation({
          beatId: beat.id as Id<"beats">,
          pinned,
        });
      } catch (error) {
        toast.error(messageOf(error));
      }
    },
    [pinMutation],
  );

  // Steal-floor handoff: abort, then start with the requested role once idle.
  useEffect(() => {
    if (run || !forcedSpeaker) return;
    const roleId = forcedSpeaker;
    setForcedSpeaker(null);
    void startTurn(roleId);
  }, [forcedSpeaker, run, startTurn]);

  // Auto-burst: pause, decision points, failures and active runs
  // all stop the chain. Queue entries win over the resolved floor.
  useEffect(() => {
    if (!scene || run) return;
    if (scene.status !== "playing") {
      // Pause/archive disarms the burst entirely so resuming always re-arms
      // it, even if the tip state is identical to the pre-pause state.
      lastAutoKey.current = "";
      return;
    }
    const tip = tipOptions(scene.options);
    if (tip.length > 0) return;
    if (
      scene.pending.some(
        (beat) => beat.status === "streaming" || beat.status === "failed",
      )
    ) {
      return;
    }

    const key = [
      scene.activeTipBeatId ?? "none",
      scene.beats.length,
      scene.status,
      scene.roles.length,
      queuedRoleIds.join(","),
    ].join(":");
    if (lastAutoKey.current === key) return;

    if (queuedRoleIds.length > 0) {
      const timer = setTimeout(() => {
        lastAutoKey.current = key;
        const [next, ...rest] = queuedRoleIds;
        setQueuedRoleIds(rest);
        if (next) void startTurn(next, { auto: true });
      }, 350);
      return () => clearTimeout(timer);
    }

    if (!shouldAutoStart({ scene, run, hasTipOptions: false, pending: scene.pending })) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoKey.current = key;
      void startTurn(undefined, { auto: true });
    }, 900);
    return () => clearTimeout(timer);
  }, [scene, run, queuedRoleIds, startTurn]);

  // Keyboard registry: option picks, offer, abort, undo.
  const tipChoices = scene ? tipOptions(scene.options) : [];
  const pickChoice = (index: number) => {
    const option = tipChoices[index];
    // Only a live turn blocks a pick, options/memory bookkeeping runs don't.
    if (!option || busy || (run !== null && run.mode === "turn")) return;
    requestPick(option);
  };
  useKeymap([
    {
      scope: "options",
      action: "options.pick.1",
      handler: () => pickChoice(0),
    },
    {
      scope: "options",
      action: "options.pick.2",
      handler: () => pickChoice(1),
    },
    {
      scope: "options",
      action: "options.pick.3",
      handler: () => pickChoice(2),
    },
    {
      scope: "options",
      action: "options.pick.4",
      handler: () => pickChoice(3),
    },
    {
      scope: "play",
      action: "options.offer",
      handler: () => {
        if (!run && !busy) void offerPaths();
      },
    },
    {
      scope: "play",
      action: "generation.abort",
      handler: () => {
        if (run) void abort();
      },
    },
    {
      scope: "global",
      action: "action.undoLast",
      handler: () => void undo(),
    },
    {
      scope: "play",
      action: "inspector.toggle",
      handler: toggleInspector,
    },
    {
      scope: "play",
      action: "inspector.map.open",
      handler: () => void setInspectorTab("map"),
    },
    {
      scope: "play",
      action: "inspector.memory.open",
      handler: () => void setInspectorTab("memory"),
    },
  ]);

  if (!scene) {
    return <CastProgress label="Opening the scene…" />;
  }

  const tip = scene.beats[scene.beats.length - 1];
  const nextSpeaker = nextSpeakerPreview(scene);
  const archived = scene.status === "archived";
  const endingStreak = scene.endingStreak ?? 0;
  const showWrapOffer = !archived && endingStreak >= 2 && !wrapDismissed;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/" aria-label="Back to the lobby">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="truncate font-serif text-lg leading-tight">
              {scene.title}
            </h1>
            <Badge variant="outline" className="font-normal">
              {scene.status}
            </Badge>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {scene.premise}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setCastOpen(true)}
          aria-label="Open cast"
        >
          <PanelLeftIcon />
          Cast
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShareOpen(true)}
          aria-label="Share scene"
        >
          <Share2Icon />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExportOpen(true)}
          aria-label="Export scene"
        >
          <ArchiveIcon />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <Button
          type="button"
          variant={inspectorTab ? "secondary" : "outline"}
          size="sm"
          onClick={toggleInspector}
          aria-pressed={Boolean(inspectorTab)}
          aria-label="Toggle inspector"
        >
          <PanelRightIcon />
          <span className="hidden sm:inline">Inspector</span>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Cast"
          className="hidden w-60 shrink-0 border-r border-border lg:block"
        >
          <CastRail
            scene={scene}
            run={run}
            queuedRoleIds={queuedRoleIds}
            disabled={archived || offline}
            onMention={mention}
            onQueue={queueRole}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {archived ? (
            <div
              data-testid="archive-banner"
              className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-3 py-1.5 text-xs"
            >
              <ArchiveIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <span>This scene is archived, replay and exports stay available.</span>
              <Link
                href={`/s/${id}/archive`}
                className="ml-auto font-medium underline underline-offset-2"
              >
                Open archive
              </Link>
            </div>
          ) : showWrapOffer ? (
            <div
              data-testid="wrap-offer"
              role="status"
              className="flex flex-wrap items-center gap-2 border-b border-border bg-amber-500/10 px-3 py-1.5 text-xs"
            >
              <SparklesIcon className="size-3.5 text-amber-600 dark:text-amber-300" aria-hidden />
              <span>The story feels resolved. Wrap the scene?</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="ml-auto"
                onClick={() => setDialog({ kind: "endScene" })}
              >
                Wrap scene
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setWrapDismissed(true)}
              >
                Keep playing
              </Button>
            </div>
          ) : null}
          <FloorIndicator
            scene={scene}
            run={run}
            nextSpeaker={nextSpeaker}
            queuedCount={queuedRoleIds.length}
            busy={interactionBusy}
            onPauseToggle={() => void togglePause()}
            onAbort={() => void abort()}
            onOffer={() => void offerPaths()}
          />
          <ThreadView
            scene={scene}
            run={run}
            streamingText={streamingText}
            optimisticPick={pendingPick?.parentIsTip ? pendingPick : null}
            pendingPickId={pendingPick?.id ?? null}
            busy={interactionBusy || Boolean(run)}
            gutterMarkers={gutterMarkers}
            selectedBeatId={selectedBeatId ?? undefined}
            focusBeatId={selectedBeatId ?? undefined}
            onPick={requestPick}
            onPin={(beat, pinned) => void pin(beat, pinned)}
            onEdit={(beat) => setEditBeat(beat)}
            onRegenerate={(beat) => setDialog({ kind: "regenerate", beat })}
            onRetry={(beat) => void performRegenerate(beat)}
            onInspectBeat={(beat) => inspectBeat(beat.id)}
            onSwitchBranch={(marker) => void switchBranch(marker.branchId)}
          />
          <DirectorBar
            scene={scene}
            canUndo={canUndo}
            busy={interactionBusy}
            onUndo={() => void undo()}
            onOffer={() => void offerPaths()}
            onPauseToggle={() => void togglePause()}
            onEndScene={() => setDialog({ kind: "endScene" })}
          />
          <SteerComposer
            scene={scene}
            roles={scene.roles}
            notes={scene.notes}
            run={run}
            busy={interactionBusy}
            onSteer={(text, mode) => void steer(text, mode)}
            onWrite={(roleId, text) => void write(roleId, text)}
            onMention={mention}
            onResolveNote={(noteId) => void resolveNote(noteId)}
          />
        </div>

        {viewport === "three" && inspectorTab ? (
          <aside
            aria-label="Inspector"
            className="w-[22rem] shrink-0 border-l border-border"
          >
            <InspectorPane
              scene={scene}
              sceneId={id}
              tab={inspectorTab}
              beatId={selectedBeatId ?? undefined}
              onTabChange={(next) => void setInspectorTab(next)}
              onClose={closeInspector}
              onSelectBeat={selectBeat}
              onInspectBeat={inspectBeat}
              onSwitchBranch={(branchId) => void switchBranch(branchId)}
            />
          </aside>
        ) : null}
      </div>

      <Sheet
        open={Boolean(inspectorTab) && viewport !== "three"}
        onOpenChange={(open) => {
          if (!open) closeInspector();
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Inspector</SheetTitle>
            <SheetDescription>Memory, prompts, map and usage</SheetDescription>
          </SheetHeader>
          {inspectorTab ? (
            <InspectorPane
              scene={scene}
              sceneId={id}
              tab={inspectorTab}
              beatId={selectedBeatId ?? undefined}
              onTabChange={(next) => void setInspectorTab(next)}
              onClose={closeInspector}
              onSelectBeat={selectBeat}
              onInspectBeat={inspectBeat}
              onSwitchBranch={(branchId) => void switchBranch(branchId)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={castOpen} onOpenChange={setCastOpen}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xs">
          <SheetHeader>
            <SheetTitle>Cast</SheetTitle>
            <SheetDescription className="sr-only">
              Active and off-stage cast for this scene
            </SheetDescription>
          </SheetHeader>
          <CastRail
            scene={scene}
            run={run}
            queuedRoleIds={queuedRoleIds}
            disabled={archived || offline}
            onMention={(roleId) => {
              setCastOpen(false);
              mention(roleId);
            }}
            onQueue={(roleId) => {
              queueRole(roleId);
              setCastOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      <EditBeatDialog
        beat={editBeat}
        open={editBeat !== null}
        onOpenChange={(open) => {
          if (!open) setEditBeat(null);
        }}
        busy={interactionBusy}
        onConfirm={(text) => void performEdit(text)}
      />

      <ConfirmDialog
        open={dialog?.kind === "regenerate"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={
          dialog?.kind === "regenerate"
            ? `Regenerate beat ${dialog.beat.seq}?`
            : "Regenerate beat?"
        }
        description="A new branch will be created from this beat's parent and the same role will take another pass. The original beat and its branch stay intact; undo restores the previous tip."
        confirmLabel="Regenerate"
        onConfirm={() => {
          if (dialog?.kind === "regenerate") {
            const beat = dialog.beat;
            setDialog(null);
            void performRegenerate(beat);
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "ghostPick"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={
          dialog?.kind === "ghostPick"
            ? `Fork from beat ${dialog.option.parentSeq}?`
            : "Fork the story?"
        }
        description={
          dialog?.kind === "ghostPick"
            ? `“${dialog.option.label}” was offered at beat ${dialog.option.parentSeq}, not at the current tip. Taking it now forks a new branch from that point. The current branch, its beats and its memory stay intact.`
            : ""
        }
        confirmLabel="Fork & take this path"
        onConfirm={() => {
          if (dialog?.kind === "ghostPick") {
            const option = dialog.option;
            setDialog(null);
            void performPick(option);
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "endScene"}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title="Wrap & archive this scene?"
        description="Wrapping runs a final summary pass over any uncovered beats, freezes the tree and opens the archive. Nothing is deleted. You can still export, share and replay everything, and undo reopens the scene."
        confirmLabel="Wrap & archive"
        onConfirm={() => {
          setDialog(null);
          void endScene();
        }}
      />

      <ShareDialog sceneId={id} open={shareOpen} onOpenChange={setShareOpen} />
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        bundle={(exportBundle ?? null) as unknown as ExportBundle | null}
        sceneTitle={scene.title}
        includeSnapshots={exportSnapshots}
        onIncludeSnapshotsChange={setExportSnapshots}
      />

      {tip ? <span className="sr-only">Active tip beat {tip.seq}</span> : null}
    </div>
  );
}
