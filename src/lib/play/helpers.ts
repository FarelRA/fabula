import type { SceneSettings } from "@convex/shared/contracts";
import { resolveFloor } from "@convex/domain/orchestrate";
import type { CastRole } from "@/lib/cast/types";
import type { PlayBeat, PlayOption, PlayRun, PlayScene } from "./types";

/** Pure play-loop decisions, shared by the UI and its tests (PLAN §8). */

export function activeRoles(roles: readonly CastRole[]): CastRole[] {
  return roles.filter((role) => role.status === "active");
}

export function speakingRoles(roles: readonly CastRole[]): CastRole[] {
  return roles.filter((role) => role.status === "active" && role.kind === "ai");
}

export function roleById(
  roles: readonly CastRole[],
  roleId: string | undefined,
): CastRole | undefined {
  if (!roleId) return undefined;
  return roles.find((role) => role.id === roleId);
}

/**
 * Auto-burst counter (PLAN §8.2): consecutive model turns since the last
 * director action. Picks, edits, writes and opening beats reset the chain.
 */
export function trailingAiBeats(beats: readonly PlayBeat[]): number {
  let count = 0;
  for (let index = beats.length - 1; index >= 0; index -= 1) {
    const origin = beats[index]?.origin;
    if (origin === "turn" || origin === "regenerate") count += 1;
    else break;
  }
  return count;
}

export function burstLabel(beats: readonly PlayBeat[], burstMax: number): string {
  return `${Math.min(burstLabelCount(beats), burstMax)}/${burstMax}`;
}

function burstLabelCount(beats: readonly PlayBeat[]): number {
  return trailingAiBeats(beats);
}

export function tipOptions(options: readonly PlayOption[]): PlayOption[] {
  return options
    .filter((option) => option.parentIsTip)
    .sort((a, b) => a.optionIndex - b.optionIndex);
}

export function optionsForBeat(
  options: readonly PlayOption[],
  beatId: string,
): PlayOption[] {
  return options
    .filter((option) => option.parentBeatId === beatId)
    .sort((a, b) => a.optionIndex - b.optionIndex);
}

export function hasPendingWork(
  pending: readonly PlayBeat[],
  run: PlayRun | null,
): boolean {
  return Boolean(run) || pending.some((beat) => beat.status === "streaming");
}

/**
 * The client-side burst driver. Pause and decision points stop the chain; a
 * failed/streaming child or an active run blocks it; manual picks/writes reset
 * the count so the cast reacts to the director.
 */
export function shouldAutoStart(args: {
  scene: PlayScene | null;
  run: PlayRun | null;
  hasTipOptions: boolean;
  pending: readonly PlayBeat[];
}): boolean {
  const { scene, run, hasTipOptions, pending } = args;
  if (!scene || scene.status !== "playing") return false;
  if (run) return false;
  if (hasTipOptions) return false;
  if (pending.some((beat) => beat.status === "streaming" || beat.status === "failed")) {
    return false;
  }
  if (!scene.settings.turnRules.autoBurst) return false;
  const lastBeat = scene.beats[scene.beats.length - 1];
  if (lastBeat && lastBeat.status !== "finished") return false;
  return trailingAiBeats(scene.beats) < scene.settings.turnRules.burstMax;
}

/** Deterministic floor preview (mirrors the server fallback). */
export function nextSpeakerPreview(scene: PlayScene): CastRole | undefined {
  const roles = activeRoles(scene.roles);
  const lastBeat = scene.beats[scene.beats.length - 1];
  const activeIds = new Set(roles.map((role) => role.id));
  const tensions: Record<string, number> = {};
  if (lastBeat?.speakerRoleId) {
    for (const role of roles) {
      if (role.id === lastBeat.speakerRoleId) continue;
      const relation = role.card.relations.find(
        (entry) => entry.toRoleId === lastBeat.speakerRoleId,
      );
      tensions[role.id] = relation?.tension ?? 0;
    }
  }
  const decision = resolveFloor({
    mode: scene.settings.turnRules.mode,
    roles: roles.map((role) => ({
      id: role.id,
      name: role.card.identity.name,
      tier: role.card.meta.tier,
      status: role.status,
    })),
    lastBeat: lastBeat
      ? {
          text: lastBeat.text,
          speakerRoleId: lastBeat.speakerRoleId,
        }
      : undefined,
    factSubjects: [],
    tensions,
  });
  if (decision.skip || !decision.speakerRoleId) return undefined;
  return activeIds.has(decision.speakerRoleId)
    ? roles.find((role) => role.id === decision.speakerRoleId)
    : undefined;
}

/** Scroll intent (PLAN §9.8 smart autoscroll). */
export function isNearBottom(args: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  threshold?: number;
}): boolean {
  const threshold = args.threshold ?? 96;
  return args.scrollHeight - args.scrollTop - args.clientHeight <= threshold;
}

const STRATEGY_LABELS: Record<string, string> = {
  escalate: "Escalate",
  "de-escalate": "De-escalate",
  reveal: "Reveal",
  conceal: "Conceal",
  ally: "Ally",
  confront: "Confront",
  commit: "Commit",
  deflect: "Deflect",
};

export function strategyLabel(strategy: string): string {
  return STRATEGY_LABELS[strategy] ?? strategy;
}

export function originLabel(beat: PlayBeat): string | null {
  if (beat.origin === "opening") return "Opening";
  if (beat.origin === "userInsert") return "You wrote";
  if (beat.origin === "edit") return "Edited fork";
  if (beat.origin === "regenerate") return "Regenerated";
  return null;
}

/** The option list shown inline under a beat; ghosts stay under old beats. */
export function inlineOptionGroups(
  scene: PlayScene,
): Array<{ beat: PlayBeat; options: PlayOption[] }> {
  return scene.beats
    .map((beat) => ({ beat, options: optionsForBeat(scene.options, beat.id) }))
    .filter((group) => group.options.length > 0);
}

export function settingsBurstMax(settings: SceneSettings): number {
  return Math.max(1, settings.turnRules.burstMax);
}
