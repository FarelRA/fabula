import { describe, expect, test } from "vitest";
import { chainForDocs } from "@/lib/branches/chain";
import { serializeSceneToMarkdown } from "@/lib/export/markdown";
import {
  exportFilename,
  serializeSceneToJson,
} from "@/lib/export/json";
import { makeExportBundle } from "./fixtures";

/**
 * Export serializers: markdown structure is
 * golden-locked; JSON is tree-lossless (branch links, candidates, facts) and
 * `jq`-parseable; filenames are deterministic.
 */

describe("markdown export", () => {
  test("golden structure: cast, mainline, alt branch delta, ghosts, ledger", () => {
    const markdown = serializeSceneToMarkdown(makeExportBundle());
    const expected = `
# The Glass Harbor

> A debt collector knocks on the wrong door.

- **Status:** archived
- **Ended:** 2026-10-18
- **Genre:** noir · Saigon, 1975
- **Style:** chat · **Language:** en · **Length:** medium

## Cast

### Linh · protagonist · spotlight
- hook: Collects debts she can never repay.

### Duc · foil · supporting

## Main

### Beat 1 · opening · Narration
Rain hadn't stopped for three days.

### Beat 2 · turn · Linh
She knocked anyway.

_Pinned._

**Paths not taken:**
- **Push inside** (escalate): She pushes the door.

### Beat 3 · option · Duc
He opened the door.

## Alternate · beat 2

### Beat 4 · edit · Linh
She slid the ledger back.

## Facts

- The ledger is a forgery.
- **[global]** Everyone wants the ledger.
- *(muted)* A silenced detail.

## Summaries

- **Beats 1 to 2:** A door, a ledger, rain.

## Director notes

- *(steer, from beat 2)* Raise the stakes.

## Continuity notes

- **medium**: Timeline is ambiguous.
`.trimStart();
    expect(markdown).toBe(expected);
  });

  test("alternate branches only print their divergence delta", () => {
    const markdown = serializeSceneToMarkdown(makeExportBundle());
    const altSection = markdown.slice(markdown.indexOf("## Alternate"));
    expect(altSection).toContain("### Beat 4 · edit · Linh");
    expect(altSection).not.toContain("Rain hadn't stopped");
    expect(altSection).not.toContain("She knocked anyway");
  });
});

describe("JSON export", () => {
  test("round-trips the tree losslessly with an injected timestamp", () => {
    const bundle = makeExportBundle();
    const parsed = JSON.parse(
      serializeSceneToJson(bundle, { exportedAt: "2026-10-18T00:00:00.000Z" }),
    ) as Record<string, unknown>;

    expect(parsed.exportedAt).toBe("2026-10-18T00:00:00.000Z");
    expect(parsed.format).toBe("fabula.scene");
    expect(parsed.version).toBe(1);
    expect(parsed.beats).toEqual(bundle.beats);
    expect(parsed.branches).toEqual(bundle.branches);
    expect(parsed.candidates).toEqual(bundle.candidates);
    expect(parsed.facts).toEqual(bundle.facts);
    // Branch links survive: the forked beat still points at its parent.
    const forked = (parsed.beats as typeof bundle.beats).find(
      (beat) => beat._id === "b4",
    );
    expect(forked?.parentBeatId).toBe("b2");
    expect(forked?.editedFromBeatId).toBe("b3");
  });

  test("snapshots stay out unless requested (bundle stays as received)", () => {
    const bundle = makeExportBundle();
    bundle.snapshots = [
      {
        _id: "snap_1",
        mode: "turn",
        blocks: [{ key: "contract", text: "Stay in character.", tokens: 4 }],
        createdAt: 1,
      },
    ];
    const parsed = JSON.parse(serializeSceneToJson(bundle, { exportedAt: "x" })) as {
      snapshots: unknown[];
    };
    expect(parsed.snapshots).toHaveLength(1);
  });
});

describe("export helpers", () => {
  test("filenames are slugs with a date suffix", () => {
    const date = new Date(Date.UTC(2026, 9, 18));
    expect(exportFilename("The Glass Harbor", "md", date)).toBe(
      "the-glass-harbor-2026-10-18.md",
    );
    expect(exportFilename("!!!", "json", date)).toBe("scene-2026-10-18.json");
  });

  test("chainForDocs walks parent links root→tip and survives cycles", () => {
    const bundle = makeExportBundle();
    const chain = chainForDocs("b4", bundle.beats);
    expect(chain.map((beat) => beat._id)).toEqual(["b1", "b2", "b4"]);
    expect(chainForDocs(undefined, bundle.beats)).toEqual([]);
    const cyclic = [
      { _id: "a", parentBeatId: "b" },
      { _id: "b", parentBeatId: "a" },
    ];
    expect(chainForDocs("a", cyclic).length).toBe(2);
  });
});
