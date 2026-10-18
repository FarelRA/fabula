import { describe, expect, test } from "vitest";
import { checkCast, tierPolicy, type CastRoleLite } from "../../convex/domain/castConstraints";

function role(name: string, overrides: Partial<CastRoleLite> = {}): CastRoleLite {
  return {
    name,
    hook: `Carries a ${name.toLowerCase()} token.`,
    tier: "spotlight",
    relations: [],
    voice: {
      register: `register-${name}`,
      rhythm: `rhythm-${name}`,
      sampleLines: [`I am ${name} and I worry.`, `Ask ${name} again later.`],
    },
    ...overrides,
  };
}

function chainCast(names: string[]): CastRoleLite[] {
  return names.map((name, index) =>
    role(name, {
      relations:
        index < names.length - 1
          ? [
              {
                toName: names[index + 1] ?? "",
                dynamic: index === 0 ? "ally" : index === 1 ? "rival" : "stranger",
                tension: index === 1 ? 0.8 : 0.2,
              },
            ]
          : [],
    }),
  );
}

describe("checkCast", () => {
  test("accepts a connected cast with alliance and friction", () => {
    expect(checkCast(chainCast(["Aster", "Bramble", "Cinder"]))).toEqual([]);
  });

  test("flags duplicate names", () => {
    const cast = chainCast(["Aster", "Bramble"]);
    cast[1] = role("Aster", { relations: [{ toName: "Aster", dynamic: "ally", tension: 0.2 }] });
    const codes = checkCast(cast).map((violation) => violation.code);
    expect(codes).toContain("duplicate-names");
  });

  test("flags unknown relation targets", () => {
    const cast = [role("Aster", { relations: [{ toName: "Ghost", dynamic: "ally", tension: 0.2 }] })];
    expect(checkCast(cast).map((v) => v.code)).toContain("unknown-relation");
  });

  test("flags a disconnected graph", () => {
    const cast = [
      role("Aster", { relations: [{ toName: "Bramble", dynamic: "ally", tension: 0.2 }] }),
      role("Bramble", { relations: [{ toName: "Aster", dynamic: "ally", tension: 0.2 }] }),
      role("Cinder", { relations: [{ toName: "Dune", dynamic: "ally", tension: 0.2 }] }),
      role("Dune", { relations: [{ toName: "Cinder", dynamic: "ally", tension: 0.2 }] }),
    ];
    expect(checkCast(cast).map((v) => v.code)).toContain("disconnected-graph");
  });

  test("flags a missing alliance", () => {
    const cast = [
      role("Aster", { relations: [{ toName: "Bramble", dynamic: "stranger", tension: 0.9 }] }),
      role("Bramble", { relations: [{ toName: "Aster", dynamic: "stranger", tension: 0.9 }] }),
    ];
    const codes = checkCast(cast).map((v) => v.code);
    expect(codes).toContain("no-alliance");
    expect(codes).not.toContain("no-friction");
  });

  test("flags missing friction", () => {
    const cast = [
      role("Aster", { relations: [{ toName: "Bramble", dynamic: "ally", tension: 0.2 }] }),
      role("Bramble", { relations: [{ toName: "Aster", dynamic: "ally", tension: 0.2 }] }),
    ];
    expect(checkCast(cast).map((v) => v.code)).toContain("no-friction");
  });

  test("flags near-duplicate hooks", () => {
    const hook = "A debt collector knocks on the wrong door every night.";
    const cast = chainCast(["Aster", "Bramble"]).map((entry) => ({ ...entry, hook }));
    expect(checkCast(cast).map((v) => v.code)).toContain("similar-hooks");
  });

  test("flags indistinguishable voices", () => {
    const cast = chainCast(["Aster", "Bramble"]).map((entry) => ({
      ...entry,
      voice: { register: "low", rhythm: "clipped", sampleLines: ["Fine.", "Later."] },
    }));
    const codes = checkCast(cast).map((v) => v.code);
    expect(codes).toContain("similar-voices");
  });

  test("enforces the tier policy by cast size", () => {
    const six = chainCast(["A", "Bram", "Cind", "Dune", "Embe", "Fabl"]);
    const codes = checkCast(six).map((v) => v.code);
    expect(codes).toContain("tier-policy"); // 6 spotlight > max 4
  });

  test("accepts the fake generator's 6-role shape (4/2 split)", () => {
    const six = chainCast(["Aster", "Brambl", "Cinder", "Dunett", "Emberl", "Fablet"]).map(
      (entry, index) => ({ ...entry, tier: index < 4 ? ("spotlight" as const) : ("supporting" as const) }),
    );
    expect(checkCast(six)).toEqual([]);
  });
});

describe("tierPolicy", () => {
  test("2 to 4: everyone can be spotlight", () => {
    expect(tierPolicy(3)).toEqual({ maxSpotlight: 3, maxSupporting: 3 });
  });
  test("5 to 6: max 4 spotlight", () => {
    expect(tierPolicy(5)).toEqual({ maxSpotlight: 4, maxSupporting: 5 });
  });
  test("7+: max 3 spotlight, 2 supporting", () => {
    expect(tierPolicy(8)).toEqual({ maxSpotlight: 3, maxSupporting: 2 });
  });
});
