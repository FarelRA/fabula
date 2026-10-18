import { describe, expect, test } from "vitest";
import { RoleCardSchema } from "@convex/shared/contracts";
import {
  avatarGradient,
  hashSeed,
  monogramFor,
  roleAccent,
} from "@/lib/cast/avatar";
import { blankRoleCard, deriveTitle, duplicateRole } from "@/lib/cast/roles";
import { moveRoleIds } from "@/lib/cast/reorder";
import type { CastRole } from "@/lib/cast/types";

function makeRole(): CastRole {
  return {
    id: "role_linh",
    kind: "ai",
    status: "active",
    draftLocks: ["hook"],
    card: blankRoleCard(0, "protagonist"),
    sampleLines: ["You came to the wrong door."],
  };
}

describe("avatar helpers", () => {
  test("hashSeed is stable and differs by seed", () => {
    expect(hashSeed("Linh")).toBe(hashSeed("Linh"));
    expect(hashSeed("Linh")).not.toBe(hashSeed("Đức"));
  });

  test("roleAccent falls back deterministically", () => {
    expect(roleAccent("amber")).toBe("amber");
    const fallback = roleAccent("not-a-token");
    expect(roleAccent("not-a-token")).toBe(fallback);
    expect(fallback).toMatch(/^(amber|teal|violet|rose|sky|lime|orange|indigo)$/);
  });

  test("monogramFor handles unicode names", () => {
    expect(monogramFor("linh")).toBe("L");
    expect(monogramFor("Đức")).toBe("Đ");
    expect(monogramFor("   ")).toBe("?");
  });

  test("avatar gradients are deterministic, accent-driven and valid CSS", () => {
    const first = avatarGradient("Linh", "amber");
    expect(first).toBe(avatarGradient("Linh", "amber"));
    expect(first).toContain("linear-gradient(");
    expect(first).toContain("var(--role-amber)");
    expect(avatarGradient("Linh", "violet")).toContain("var(--role-violet)");
  });
});

describe("roles", () => {
  test("blank role cards satisfy the frozen RoleCard contract", () => {
    for (let index = 0; index < 9; index += 1) {
      expect(RoleCardSchema.safeParse(blankRoleCard(index)).success).toBe(true);
    }
  });

  test("deriveTitle clips a premise into a readable title", () => {
    expect(deriveTitle("a debt collector knocks on the wrong door in Saigon.")).toBe(
      "A debt collector knocks on the wrong",
    );
    expect(deriveTitle("   ")).toBe("Untitled scene");
  });

  test("duplicateRole suffixes the name, clears locks, drops self-relations", () => {
    const role = makeRole();
    role.card.relations = [
      {
        toRoleId: role.id,
        dynamic: "ally",
        tension: 0.2,
        historyNote: "self",
        knowsAbout: "self",
      },
      {
        toRoleId: "role_other",
        dynamic: "rival",
        tension: 0.7,
        historyNote: "history",
        knowsAbout: "hook",
      },
    ];
    const copy = duplicateRole(role, "role_copy");
    expect(copy.id).toBe("role_copy");
    expect(copy.card.identity.name).toMatch(/\(copy\)$/);
    expect(copy.draftLocks).toEqual([]);
    expect(copy.card.relations).toHaveLength(1);
    expect(copy.card.relations[0]?.toRoleId).toBe("role_other");
    expect(copy.card).not.toBe(role.card);
    expect(copy.card.relations[0]).not.toBe(role.card.relations[1]);
    expect(RoleCardSchema.safeParse(copy.card).success).toBe(true);
  });
});

describe("moveRoleIds", () => {
  test("moves an id before its target", () => {
    expect(moveRoleIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveRoleIds(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  });

  test("returns a copy for unknown ids", () => {
    const ids = ["a", "b"];
    expect(moveRoleIds(ids, "a", "nope")).toEqual(ids);
    expect(moveRoleIds(ids, "a", "nope")).not.toBe(ids);
  });
});
