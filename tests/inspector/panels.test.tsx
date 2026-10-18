// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PromptInspector } from "@/components/inspector/PromptInspector";
import { UsageMeter } from "@/components/inspector/UsageMeter";
import { CompareView } from "@/components/inspector/CompareView";
import { BranchGutter } from "@/components/thread/BranchGutter";
import type { SnapshotDetailView } from "@/components/inspector/types";
import { alignBranches, type CompareBeat } from "@/lib/branches/compare";
import { makeBranch } from "../branches/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

const snapshot: SnapshotDetailView = {
  id: "snap_1",
  mode: "turn",
  createdAt: Date.now() - 60_000,
  model: { provider: "fake", modelId: "fake-turn" },
  tokenCounts: { system: 900, context: 300, outputReserve: 200, total: 1400 },
  budget: { contextWindow: 128000, systemTargetPct: 25, overBudgetAction: "droppedOldestContext" },
  blocks: [
    {
      key: "contract",
      templateKey: "contract.roleplay",
      templateVersion: 2,
      text: "ROLEPLAY CONTRACT: stay in character.",
      hash: "deadbeefcafe",
      tokens: 40,
      chars: 36,
    },
    {
      key: "mode",
      templateKey: "mode.turn",
      templateVersion: 1,
      text: "Write one beat.",
      hash: "cafebabe1234",
      tokens: 12,
      chars: 14,
    },
  ],
};

describe("prompt inspector (PLAN Phase 6.6)", () => {
  test("shows compiled block text, template versions and budget action", () => {
    render(<PromptInspector snapshots={[snapshot]} contextLabel="beat 3" />);
    expect(screen.getByText(/Prompts · beat 3/)).toBeInTheDocument();
    expect(screen.getByText(/contract\.roleplay v2/)).toBeInTheDocument();
    expect(screen.getByText("ROLEPLAY CONTRACT: stay in character.")).toBeInTheDocument();
    expect(screen.getByText(/Budget action: droppedOldestContext/)).toBeInTheDocument();
    expect(screen.getAllByTestId("prompt-block")).toHaveLength(2);
    expect(screen.getByText("1400 total · 900 system · 300 context")).toBeInTheDocument();
  });

  test("switches between generations and handles empty history", async () => {
    const user = userEvent.setup();
    const other: SnapshotDetailView = {
      ...snapshot,
      id: "snap_2",
      mode: "options",
      blocks: [
        {
          key: "mode",
          text: "Offer three paths.",
          hash: "feedface",
          tokens: 9,
          chars: 17,
        },
      ],
    };
    const { unmount } = render(
      <PromptInspector snapshots={[snapshot, other]} contextLabel="beat 3" />,
    );
    await user.click(screen.getByRole("button", { name: /options/ }));
    expect(screen.getByText("Offer three paths.")).toBeInTheDocument();
    unmount();

    render(<PromptInspector snapshots={[]} contextLabel="beat 9" />);
    expect(screen.getByText(/No compiled snapshot for beat 9/)).toBeInTheDocument();
  });
});

describe("usage meter (PLAN Phase 6.7)", () => {
  const usage = {
    tokensIn: 12_400,
    tokensOut: 3_600,
    costEstimateUsd: 0.85,
    byTier: [
      { tier: "spotlight", tokensIn: 10_000, tokensOut: 3_000, costEstimateUsd: 0.8 },
      { tier: "cheap", tokensIn: 2_400, tokensOut: 600, costEstimateUsd: 0.05 },
    ],
  };

  test("shows totals, tier rows and warns at 80% of the cap", () => {
    render(<UsageMeter usage={usage} softCapUsd={1} />);
    expect(screen.getByText("$0.85")).toBeInTheDocument();
    expect(screen.getByText("12.4k")).toBeInTheDocument();
    expect(screen.getByText("spotlight")).toBeInTheDocument();
    expect(screen.getByText("85% of the soft cap")).toBeInTheDocument();
    expect(screen.getByTestId("budget-bar")).toHaveAttribute("data-level", "warn");
    expect(screen.getByText(/approaching the soft cap/)).toBeInTheDocument();
  });

  test("flags over-budget and honors the no-cap state", () => {
    const { unmount } = render(
      <UsageMeter usage={{ ...usage, costEstimateUsd: 1.6 }} softCapUsd={1} />,
    );
    expect(screen.getByTestId("budget-bar")).toHaveAttribute("data-level", "over");
    expect(screen.getByText(/over the soft cap/)).toBeInTheDocument();
    unmount();

    render(<UsageMeter usage={usage} />);
    expect(screen.getByText(/No soft cap set for this scene/)).toBeInTheDocument();
  });
});

describe("compare view (PLAN Phase 6.4)", () => {
  const beat = (depth: number, text: string): CompareBeat => ({
    id: `b${depth}`,
    seq: depth + 1,
    depth,
    text,
    speakerName: "Linh",
    origin: "turn",
    status: "finished",
  });

  test("aligns rows and stays read-only", () => {
    const left = makeBranch({ id: "l", label: "Main" });
    const right = makeBranch({ id: "r", label: "Alternate" });
    const rows = alignBranches([beat(0, "Shared opener"), beat(1, "She knocks")], [
      beat(0, "Shared opener"),
      beat(1, "He knocks"),
    ]);
    render(
      <CompareView
        left={left}
        right={right}
        leftBeats={[beat(0, "Shared opener"), beat(1, "She knocks")]}
        rightBeats={[beat(0, "Shared opener"), beat(1, "He knocks")]}
      />,
    );
    expect(rows[1]?.divergence).toBe(true);
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Alternate")).toBeInTheDocument();
    expect(screen.getByText("She knocks")).toBeInTheDocument();
    expect(screen.getByText("He knocks")).toBeInTheDocument();
    expect(screen.getByText(/1 divergence/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("branch gutter (PLAN Phase 6.1)", () => {
  test("scrolls for path markers and switches for fork markers", async () => {
    const user = userEvent.setup();
    const onScrollToBeat = vi.fn();
    const onSwitchBranch = vi.fn();
    render(
      <BranchGutter
        markers={[
          {
            key: "beat:b1",
            kind: "beat",
            beatId: "b1",
            branchId: "branch_main",
            label: "Beat 1",
            colorIndex: 0,
            fraction: 0,
            isTip: false,
            isPinned: false,
            isFailed: false,
            candidateCount: 0,
            onActivePath: true,
          },
          {
            key: "beat:b2",
            kind: "decision",
            beatId: "b2",
            branchId: "branch_main",
            label: "Beat 2",
            colorIndex: 0,
            fraction: 0.5,
            isTip: true,
            isPinned: false,
            isFailed: false,
            candidateCount: 3,
            onActivePath: true,
          },
          {
            key: "fork:alt",
            kind: "fork",
            branchId: "branch_alt",
            label: "Alternate · beat 2",
            colorIndex: 3,
            fraction: 0.5,
            isTip: false,
            isPinned: false,
            isFailed: false,
            candidateCount: 0,
            onActivePath: false,
          },
        ]}
        selectedBeatId="b2"
        onScrollToBeat={onScrollToBeat}
        onSwitchBranch={onSwitchBranch}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Story branches" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Beat 2, 3 path options" }));
    expect(onScrollToBeat).toHaveBeenCalledWith("b2");
    await user.click(screen.getByRole("button", { name: "Switch to branch Alternate · beat 2" }));
    expect(onSwitchBranch).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: "branch_alt" }),
    );
  });
});
