import { jaccard, tokenize } from "../lib/text";

/**
 * Cast constraint checker (PLAN §7.4) — pure, runs AFTER zod validation, up
 * to 2 repair passes in the casting action, residual violations surface as
 * non-blocking warnings in the audition UI.
 */

export type CastRoleLite = {
  name: string;
  hook: string;
  tier: "spotlight" | "supporting" | "background";
  relations: Array<{ toName: string; dynamic: string; tension: number }>;
  voice: { register: string; rhythm: string; sampleLines: string[] };
};

export type CastViolation = { code: string; message: string };

const ALLIANCE_DYNAMICS = new Set(["ally", "lover", "mentor", "family"]);
const FRICTION_DYNAMICS = new Set(["rival", "enemy"]);
const FRICTION_TENSION = 0.6;
// Token-overlap thresholds tuned for small token sets: boilerplate sharing
// must not flag, near-copies must.
const HOOK_SIMILARITY = 0.7;
const VOICE_SIMILARITY = 0.8;

export function tierPolicy(size: number): { maxSpotlight: number; maxSupporting: number } {
  if (size <= 4) return { maxSpotlight: size, maxSupporting: size };
  if (size <= 6) return { maxSpotlight: 4, maxSupporting: size };
  return { maxSpotlight: 3, maxSupporting: 2 };
}

export function checkCast(roles: CastRoleLite[]): CastViolation[] {
  const violations: CastViolation[] = [];
  const names = roles.map((role) => role.name);
  const nameSet = new Set(names);
  if (nameSet.size !== names.length) {
    violations.push({ code: "duplicate-names", message: "Two roles share the same name." });
  }

  const edges = new Map<string, Set<string>>(names.map((name) => [name, new Set<string>()]));
  let hasAlliance = false;
  let hasFriction = false;
  for (const role of roles) {
    for (const relation of role.relations) {
      if (!nameSet.has(relation.toName)) {
        violations.push({
          code: "unknown-relation",
          message: `${role.name} relates to unknown role "${relation.toName}".`,
        });
        continue;
      }
      if (relation.toName === role.name) {
        violations.push({ code: "self-relation", message: `${role.name} relates to themselves.` });
        continue;
      }
      edges.get(role.name)?.add(relation.toName);
      edges.get(relation.toName)?.add(role.name);
      if (ALLIANCE_DYNAMICS.has(relation.dynamic)) hasAlliance = true;
      if (FRICTION_DYNAMICS.has(relation.dynamic) || relation.tension >= FRICTION_TENSION) {
        hasFriction = true;
      }
    }
  }

  if (roles.length > 1) {
    const start = names[0];
    const visited = new Set<string>();
    if (start) {
      const stack = [start];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current || visited.has(current)) continue;
        visited.add(current);
        for (const neighbor of edges.get(current) ?? []) stack.push(neighbor);
      }
    }
    if (visited.size !== names.length) {
      violations.push({ code: "disconnected-graph", message: "The relationship graph is not connected." });
    }
    if (!hasAlliance) {
      violations.push({ code: "no-alliance", message: "No alliance edge: ≥1 required." });
    }
    if (!hasFriction) {
      violations.push({
        code: "no-friction",
        message: "No friction point: ≥1 rival/enemy or tension ≥ 0.6 required.",
      });
    }
  }

  for (let i = 0; i < roles.length; i += 1) {
    for (let j = i + 1; j < roles.length; j += 1) {
      const a = roles[i];
      const b = roles[j];
      if (!a || !b) continue;
      if (jaccard(tokenize(a.hook), tokenize(b.hook)) >= HOOK_SIMILARITY) {
        violations.push({
          code: "similar-hooks",
          message: `Hooks of ${a.name} and ${b.name} are near-duplicates.`,
        });
      }
      const sameRegister =
        a.voice.register === b.voice.register && a.voice.rhythm === b.voice.rhythm;
      const lineA = a.voice.sampleLines.join(" ");
      const lineB = b.voice.sampleLines.join(" ");
      const similarLines =
        lineA.length > 0 && lineB.length > 0 &&
        jaccard(tokenize(lineA), tokenize(lineB)) >= VOICE_SIMILARITY;
      if (sameRegister || similarLines) {
        violations.push({
          code: "similar-voices",
          message: `Voices of ${a.name} and ${b.name} are not distinct enough.`,
        });
      }
    }
  }

  const { maxSpotlight, maxSupporting } = tierPolicy(roles.length);
  const spotlights = roles.filter((role) => role.tier === "spotlight").length;
  const supportings = roles.filter((role) => role.tier === "supporting").length;
  if (spotlights > maxSpotlight) {
    violations.push({
      code: "tier-policy",
      message: `${spotlights} spotlight roles exceed the policy (max ${maxSpotlight} for a cast of ${roles.length}).`,
    });
  }
  if (supportings > maxSupporting) {
    violations.push({
      code: "tier-policy",
      message: `${supportings} supporting roles exceed the policy (max ${maxSupporting}).`,
    });
  }

  return violations;
}
