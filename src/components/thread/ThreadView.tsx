"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleAvatar } from "@/components/cast/RoleAvatar";
import { BeatRow } from "@/components/thread/BeatRow";
import { BranchGutter } from "@/components/thread/BranchGutter";
import { useKeymap } from "@/hooks/useKeymap";
import { usePlatform } from "@/hooks/usePlatform";
import { formatKey, DEFAULT_KEYMAP } from "@/lib/keymap";
import {
  isNearBottom,
  optionsForBeat,
  roleById,
} from "@/lib/play/helpers";
import type {
  PlayBeat,
  PlayOption,
  PlayRun,
  PlayScene,
} from "@/lib/play/types";
import type { GutterMarker } from "@/lib/branches/gutter";
import { EmptyState } from "@/components/shell/states";

type Row =
  | { kind: "beat"; beat: PlayBeat; options: PlayOption[] }
  | { kind: "pending"; beat: PlayBeat }
  | { kind: "optimistic"; beat: PlayBeat; options: PlayOption[] }
  | { kind: "cue"; run: PlayRun };

function useThrottledValue<T>(value: T, delay: number): T {
  const [throttled, setThrottled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setThrottled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return throttled;
}

/**
 * Virtualized active-path thread.
 *
 * TanStack Virtual keeps 200+ beats smooth. Finished text comes from beats;
 * only the in-flight row uses streamed Agent deltas. Autoscroll sticks to the
 * bottom unless the director has scrolled up, in which case a Jump-to-latest
 * pill appears (⌘J / Ctrl+J).
 */
export function ThreadView({
  scene,
  run,
  streamingText,
  optimisticPick,
  pendingPickId,
  busy,
  gutterMarkers = [],
  selectedBeatId,
  focusBeatId,
  readOnly = false,
  onPick,
  onPin,
  onEdit,
  onRegenerate,
  onRetry,
  onInspectBeat,
  onSwitchBranch,
}: {
  scene: PlayScene;
  run: PlayRun | null;
  streamingText: string;
  optimisticPick: PlayOption | null;
  pendingPickId: string | null;
  busy?: boolean;
  gutterMarkers?: GutterMarker[];
  selectedBeatId?: string;
  focusBeatId?: string;
  /** Shared viewers: strips every mutate affordance from rows. */
  readOnly?: boolean;
  onPick: (option: PlayOption) => void;
  onPin: (beat: PlayBeat, pinned: boolean) => void;
  onEdit: (beat: PlayBeat) => void;
  onRegenerate: (beat: PlayBeat) => void;
  onRetry: (beat: PlayBeat) => void;
  onInspectBeat?: (beat: PlayBeat) => void;
  onSwitchBranch?: (marker: GutterMarker) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);
  const platform = usePlatform();
  const jumpBinding = DEFAULT_KEYMAP.find((binding) => binding.action === "thread.jumpToLatest");
  const jumpHint = jumpBinding ? formatKey(jumpBinding, platform) : "";

  const rows = useMemo<Row[]>(() => {
    const next: Row[] = [];
    for (const beat of scene.beats) {
      next.push({
        kind: "beat",
        beat,
        options: optionsForBeat(scene.options, beat.id),
      });
    }
    for (const beat of scene.pending) {
      if (scene.beats.some((pathBeat) => pathBeat.id === beat.id)) continue;
      next.push({ kind: "pending", beat });
    }
    if (optimisticPick) {
      const parent = scene.beats.find(
        (beat) => beat.id === optimisticPick.parentBeatId,
      );
      const optimisticBeat: PlayBeat = {
        id: `optimistic-${optimisticPick.id}`,
        seq: (parent?.seq ?? scene.beats.length) + 1,
        branchId: scene.activeBranchId ?? "optimistic",
        parentBeatId: optimisticPick.parentBeatId,
        speakerRoleId: optimisticPick.speakerRoleId,
        origin: "option",
        status: "finished",
        isArtifact: false,
        isPinned: false,
        text: optimisticPick.text,
        createdAt: Date.now(),
        optimistic: true,
      };
      next.push({ kind: "optimistic", beat: optimisticBeat, options: [] });
    }
    const streamingAlready = next.some(
      (row) => row.kind !== "cue" && row.beat.status === "streaming",
    );
    if (run && run.mode === "turn" && !streamingAlready) {
      next.push({ kind: "cue", run });
    }
    return next;
  }, [scene, optimisticPick, run]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 240,
    overscan: 5,
    getItemKey: (index) => {
      const row = rows[index];
      if (!row) return index;
      if (row.kind === "cue") return `cue-${row.run.id}`;
      return row.beat.id;
    },
  });

  const streamingId = useMemo(() => {
    for (let index = scene.beats.length - 1; index >= 0; index -= 1) {
      const beat = scene.beats[index];
      if (beat?.status === "streaming") return beat.id;
    }
    for (let index = scene.pending.length - 1; index >= 0; index -= 1) {
      const beat = scene.pending[index];
      if (beat?.status === "streaming") return beat.id;
    }
    return null;
  }, [scene.beats, scene.pending]);

  const tipCount = useMemo(
    () => scene.options.filter((option) => option.parentIsTip).length,
    [scene.options],
  );
  const lastPathBeat = scene.beats[scene.beats.length - 1];

  const scrollToBottom = useCallback(() => {
    if (rows.length === 0) return;
    virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    const node = scrollRef.current;
    if (node) {
      node.scrollTo({
        top: node.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [rows.length, virtualizer]);

  const scrollToBeat = useCallback(
    (beatId: string) => {
      const index = rows.findIndex(
        (row) => row.kind !== "cue" && row.beat.id === beatId,
      );
      if (index < 0) return;
      setStick(false);
      virtualizer.scrollToIndex(index, { align: "center" });
    },
    [rows, virtualizer],
  );

  useEffect(() => {
    if (!focusBeatId) return;
    scrollToBeat(focusBeatId);
  }, [focusBeatId, scrollToBeat]);

  useKeymap([
    { scope: "play", action: "thread.jumpToLatest", handler: scrollToBottom },
  ]);

  const onScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setStick(
      isNearBottom({
        scrollTop: node.scrollTop,
        scrollHeight: node.scrollHeight,
        clientHeight: node.clientHeight,
      }),
    );
  }, []);

  useEffect(() => {
    if (!stick || rows.length === 0) return;
    const timer = setTimeout(() => {
      virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
      const node = scrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    }, 80);
    return () => clearTimeout(timer);
  }, [
    rows.length,
    stick,
    virtualizer,
    lastPathBeat?.text,
    lastPathBeat?.status,
    tipCount,
  ]);

  const throttledStream = useThrottledValue(streamingText, 700);
  const lastStreamLength = useRef(0);
  useEffect(() => {
    if (streamingText.length === 0) {
      lastStreamLength.current = 0;
      return;
    }
    if (!stick) return;
    if (streamingText.length - lastStreamLength.current < 24) return;
    lastStreamLength.current = streamingText.length;
    const timer = setTimeout(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    }, 120);
    return () => clearTimeout(timer);
  }, [stick, streamingText]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        data-testid="beat-scroll"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 lg:pr-10"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="The stage is quiet"
            description="Offer a path, steer the cast, or write the first line yourself."
          />
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
            className="mx-auto w-full max-w-3xl"
          >
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              if (!row) return null;
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                  className="w-full pb-3"
                >
                  {row.kind === "cue" ? (
                    <div
                      className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
                      role="status"
                    >
                      {row.run.roleId ? (
                        <RoleAvatar
                          name={row.run.roleName ?? "Role"}
                          monogram={row.run.roleMonogram}
                          accentColor={row.run.roleAccent}
                          size="sm"
                          className="size-9 text-xs"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-sm font-medium">
                          {row.run.roleName ?? "The cast"} takes the stage…
                        </p>
                        <Skeleton className="h-3 w-4/5" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ) : (
                    <BeatRow
                      beat={row.beat}
                      speaker={roleById(scene.roles, row.beat.speakerRoleId)}
                      style={scene.settings.presentationStyle}
                      roles={scene.roles}
                      isTip={row.beat.id === scene.activeTipBeatId}
                      options={row.kind === "pending" ? [] : row.options}
                      streamingText={
                        row.beat.id === streamingId ? streamingText : undefined
                      }
                      pendingPickId={pendingPickId}
                      disabled={busy}
                      readOnly={readOnly}
                      selected={selectedBeatId === row.beat.id}
                      onPick={onPick}
                      onPin={(pinned) => onPin(row.beat, pinned)}
                      onEdit={onEdit}
                      onRegenerate={onRegenerate}
                      onRetry={onRetry}
                      onInspect={readOnly ? undefined : onInspectBeat}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BranchGutter
        markers={gutterMarkers}
        selectedBeatId={selectedBeatId}
        onScrollToBeat={scrollToBeat}
        onSwitchBranch={(marker) => onSwitchBranch?.(marker)}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {throttledStream}
      </p>

      {!stick ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pointer-events-auto gap-2 shadow-md"
            onClick={scrollToBottom}
          >
            <ArrowDownIcon />
            Jump to latest
            <kbd className="rounded border border-border bg-background px-1 py-0.5 font-sans text-[10px]">
              {jumpHint}
            </kbd>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
