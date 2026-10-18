/**
 * Turn orchestration. PURE core.
 *
 * Floor priority: forced mention → director queue → turn mode. Reactive mode
 * (default) answers who is addressed/affected; the deterministic ordering in
 * this module is the always-available fallback for the director meta-agent.
 * Background-tier roles are strictly mention/affected-only (tested with the
 * six-role fixture).
 */

export type OrchestrationRole = {
  id: string;
  name: string;
  tier: "spotlight" | "supporting" | "background";
  status: "active" | "offstage" | "retired";
};

export type FloorInput = {
  mode: "roundRobin" | "reactive" | "directorLed" | "freeform";
  roles: OrchestrationRole[];
  lastBeat?: { text: string; speakerRoleId?: string };
  /** Role ids whose subjects were touched by the latest facts window. */
  factSubjects?: string[];
  /** Tension toward the last speaker, by role id (0..1). */
  tensions?: Record<string, number>;
  /** Higher = spoke less recently (used for fallback rotation). */
  cooldown?: Record<string, number>;
  forcedRoleId?: string;
  queue?: string[];
};

export type FloorDecision = {
  speakerRoleId?: string;
  responders: string[];
  reason: string;
  skip: boolean;
};

const TENSION_THRESHOLD = 0.7;

function isAddressed(name: string, text: string): boolean {
  const needle = name.toLowerCase();
  if (needle.length < 3) return false;
  return text.toLowerCase().includes(needle);
}

export function resolveFloor(input: FloorInput): FloorDecision {
  const active = input.roles.filter((role) => role.status === "active");
  const byId = new Map(active.map((role) => [role.id, role]));

  if (input.forcedRoleId) {
    const forced = byId.get(input.forcedRoleId);
    if (forced) {
      return {
        speakerRoleId: forced.id,
        responders: [forced.id],
        reason: "forced mention",
        skip: false,
      };
    }
  }

  const queuedId = input.queue?.[0];
  if (queuedId && byId.has(queuedId)) {
    return {
      speakerRoleId: queuedId,
      responders: [queuedId],
      reason: "director queue",
      skip: false,
    };
  }

  if (active.length === 0) {
    return { responders: [], reason: "no active roles", skip: true };
  }

  switch (input.mode) {
    case "directorLed":
      return { responders: [], reason: "director-led: awaiting the queue", skip: true };
    case "freeform":
      return { responders: [], reason: "freeform: awaiting an explicit cue", skip: true };
    case "roundRobin": {
      const last = input.lastBeat?.speakerRoleId;
      const index = last ? active.findIndex((role) => role.id === last) : -1;
      const next = active[(index + 1 + active.length) % active.length];
      return next
        ? { speakerRoleId: next.id, responders: [next.id], reason: "round robin", skip: false }
        : { responders: [], reason: "round robin: no roles", skip: true };
    }
    case "reactive":
      return resolveReactive(input, active);
  }
}

function resolveReactive(input: FloorInput, active: OrchestrationRole[]): FloorDecision {
  const text = input.lastBeat?.text ?? "";
  const lastSpeaker = input.lastBeat?.speakerRoleId;

  const addressed = active.filter(
    (role) => role.id !== lastSpeaker && isAddressed(role.name, text),
  );
  const affectedIds = new Set(input.factSubjects ?? []);
  const affected = active.filter(
    (role) => role.id !== lastSpeaker && affectedIds.has(role.id),
  );
  const tensioned = active
    .filter((role) => role.id !== lastSpeaker && (input.tensions?.[role.id] ?? 0) >= TENSION_THRESHOLD)
    .sort((a, b) => (input.tensions?.[b.id] ?? 0) - (input.tensions?.[a.id] ?? 0));

  const responders: string[] = [];
  const seen = new Set<string>();
  const push = (role: OrchestrationRole, allowBackground: boolean): void => {
    if (seen.has(role.id)) return;
    // Law: background roles speak only when addressed or directly affected.
    if (role.tier === "background" && !allowBackground) return;
    seen.add(role.id);
    responders.push(role.id);
  };
  addressed.forEach((role) => push(role, true));
  affected.forEach((role) => push(role, true));
  tensioned.forEach((role) => push(role, false));

  if (responders.length > 0) {
    return {
      speakerRoleId: responders[0],
      responders,
      reason: "reactive: addressed/affected/tension",
      skip: false,
    };
  }

  // Fallback rotation: spotlight roles only, least recently spoken first.
  const pool = active.filter((role) => role.tier === "spotlight" && role.id !== lastSpeaker);
  pool.sort((a, b) => (input.cooldown?.[b.id] ?? 0) - (input.cooldown?.[a.id] ?? 0));
  const next = pool[0];
  if (!next) {
    return {
      responders: [],
      reason: "reactive fallback: no eligible spotlight speaker",
      skip: true,
    };
  }
  return {
    speakerRoleId: next.id,
    responders: [next.id],
    reason: "reactive fallback: spotlight rotation",
    skip: false,
  };
}

/**
 * Auto-burst gate: let 2 to 3 characters exchange before returning
 * the floor, but never past a decision point and never after user direction.
 */
export function shouldAutoBurst(args: {
  autoBurst: boolean;
  burstMax: number;
  consecutiveAiBeats: number;
  decisionPoint: boolean;
  userDirected: boolean;
}): boolean {
  if (!args.autoBurst || args.userDirected || args.decisionPoint) return false;
  return args.consecutiveAiBeats < args.burstMax;
}

/**
 * Stall detection: three consecutive canon beats with no state
 * change (no new facts, no picked options) means the scene is spinning.
 */
export function detectStall(args: { beatsSinceStateChange: boolean[] }): boolean {
  const recent = args.beatsSinceStateChange.slice(-3);
  return recent.length === 3 && recent.every((changed) => changed === false);
}
