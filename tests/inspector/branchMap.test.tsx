// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { BranchMapCanvas } from "@/components/inspector/BranchMapCanvas";
import { makeStoryTree } from "../branches/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

const speakerName = () => "Linh";

describe("branch map (PLAN Phase 6.2)", () => {
  test("lists branches, switches, and exposes a keyboard node list", async () => {
    const user = userEvent.setup();
    const onSwitchBranch = vi.fn();
    const onSelectBeat = vi.fn();
    render(
      <BranchMapCanvas
        tree={makeStoryTree()}
        speakerName={speakerName}
        selectedBeatId="beat_3"
        onSelectBeat={onSelectBeat}
        onSwitchBranch={onSwitchBranch}
      />,
    );

    expect(screen.getByTestId("branch-map")).toHaveAttribute("data-fabula-map", "true");
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(onSwitchBranch).toHaveBeenCalledWith("branch_alt");

    const nodes = screen.getAllByTestId("map-node-item");
    expect(nodes).toHaveLength(4);
    await user.click(nodes[1]!);
    expect(onSelectBeat).toHaveBeenCalledWith("beat_2");
  });

  test("metadata panel answers who/how/when for a selected beat", () => {
    render(
      <BranchMapCanvas
        tree={makeStoryTree()}
        speakerName={speakerName}
        selectedBeatId="beat_4"
        onSelectBeat={vi.fn()}
        onSwitchBranch={vi.fn()}
      />,
    );
    const metadata = screen.getByTestId("map-metadata");
    expect(metadata).toHaveTextContent("Beat 4");
    expect(metadata).toHaveTextContent("Linh");
    expect(metadata).toHaveTextContent("Edited fork");
    expect(metadata).toHaveTextContent(/created/);
  });

  test("compare is flag-gated and read-only when enabled", () => {
    const { unmount } = render(
      <BranchMapCanvas
        tree={makeStoryTree()}
        speakerName={speakerName}
        onSelectBeat={vi.fn()}
        onSwitchBranch={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Compare branches/)).toBeNull();
    unmount();

    render(
      <BranchMapCanvas
        tree={makeStoryTree()}
        speakerName={speakerName}
        compareEnabled
        onSelectBeat={vi.fn()}
        onSwitchBranch={vi.fn()}
      />,
    );
    expect(screen.getByText(/Compare branches/)).toBeInTheDocument();
    expect(screen.getByLabelText("Compare left branch")).toBeInTheDocument();
    expect(screen.getByLabelText("Compare right branch")).toBeInTheDocument();
    expect(screen.queryByTestId("compare-view")).toBeNull();
  });
});
