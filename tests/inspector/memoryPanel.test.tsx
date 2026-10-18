// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { MemoryPanel } from "@/components/inspector/MemoryPanel";
import type {
  MemoryFactView,
  MemorySummaryView,
  MemoryWarningView,
} from "@/components/inspector/types";
import { installDomShims } from "../components/testUtils";

installDomShims();

function fact(overrides: Partial<MemoryFactView> & Pick<MemoryFactView, "id" | "text">): MemoryFactView {
  return {
    nodeId: "beat_2",
    beatSeq: 2,
    status: "active",
    isPinned: false,
    onPath: true,
    inContext: true,
    subjectNames: ["Linh"],
    createdAt: 1,
    ...overrides,
  };
}

const facts: MemoryFactView[] = [
  fact({ id: "f1", text: "FACT_ON_PATH the ledger is a forgery." }),
  fact({
    id: "f2",
    text: "FACT_GLOBAL everyone wants the ledger.",
    isPinned: true,
  }),
  fact({
    id: "f3",
    text: "FACT_OFF_PATH the harbour master lied.",
    onPath: false,
    inContext: false,
    beatSeq: undefined,
    nodeId: "beat_9",
  }),
  fact({ id: "f4", text: "FACT_MUTED a sealed envelope exists.", status: "muted" }),
];

const summaries: MemorySummaryView[] = [
  { id: "s1", text: "Linh arrived and the rain never stopped.", coveredFromSeq: 1, coveredThroughSeq: 4 },
];

const warnings: MemoryWarningView[] = [
  { id: "w1", text: "WARNING_TOKEN the timeline is ambiguous.", severity: "medium", status: "open", beatSeq: 3 },
];

describe("memory panel", () => {
  test("shows path facts and marks global pins distinctly", () => {
    render(
      <MemoryPanel
        facts={facts}
        summaries={summaries}
        warnings={warnings}
        onPin={vi.fn()}
        onMute={vi.fn()}
        onUnmute={vi.fn()}
        onDismissWarning={vi.fn()}
      />,
    );
    expect(screen.getByText("FACT_ON_PATH the ledger is a forgery.")).toBeInTheDocument();
    const globalRow = screen.getByText("FACT_GLOBAL everyone wants the ledger.").closest("li");
    expect(globalRow).toHaveAttribute("data-global", "true");
    expect(screen.getByText("Global · crosses branches")).toBeInTheDocument();
    expect(screen.getByText("WARNING_TOKEN the timeline is ambiguous.")).toBeInTheDocument();
    expect(screen.getByText(/covers beats 1 to 4/)).toBeInTheDocument();
  });

  test("off-path and muted facts are disclosed, never silently hidden", async () => {
    const user = userEvent.setup();
    const onUnmute = vi.fn();
    render(
      <MemoryPanel
        facts={facts}
        summaries={[]}
        warnings={[]}
        onPin={vi.fn()}
        onMute={vi.fn()}
        onUnmute={onUnmute}
        onDismissWarning={vi.fn()}
      />,
    );
    expect(screen.queryByText(/FACT_OFF_PATH/)).toBeNull();
    await user.click(screen.getByRole("button", { name: /1 off-path fact excluded from context/ }));
    expect(screen.getByText(/FACT_OFF_PATH/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /1 muted fact$/ }));
    const unmute = screen.getByRole("button", { name: /Unmute fact: FACT_MUTED/ });
    await user.click(unmute);
    expect(onUnmute).toHaveBeenCalledTimes(1);
  });

  test("pin, mute and warning dismiss are wired", async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    const onMute = vi.fn();
    const onDismissWarning = vi.fn();
    render(
      <MemoryPanel
        facts={[facts[0]!]}
        summaries={[]}
        warnings={[warnings[0]!]}
        onPin={onPin}
        onMute={onMute}
        onUnmute={vi.fn()}
        onDismissWarning={onDismissWarning}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Pin fact: FACT_ON_PATH/ }));
    expect(onPin).toHaveBeenCalledWith(facts[0], true);
    await user.click(screen.getByRole("button", { name: /Mute fact: FACT_ON_PATH/ }));
    expect(onMute).toHaveBeenCalledWith(facts[0]);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismissWarning).toHaveBeenCalledWith(warnings[0]);
  });
});
