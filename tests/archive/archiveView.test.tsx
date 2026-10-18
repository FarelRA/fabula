// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ArchiveLedger } from "@/components/archive/ArchiveLedger";
import { ArchiveReplay } from "@/components/archive/ArchiveReplay";
import { BranchExplorer } from "@/components/archive/BranchExplorer";
import { makeExportBundle } from "../export/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

describe("archive replay (PLAN Phase 7.2)", () => {
  test("renders the chain read-only with speaker names, origins and ghosts", async () => {
    const user = userEvent.setup();
    const bundle = makeExportBundle();
    const chain = [bundle.beats[0]!, bundle.beats[1]!];
    const candidatesByParent = new Map([
      ["b2", bundle.candidates],
    ]);

    render(
      <ArchiveReplay
        chain={chain}
        roles={bundle.roles}
        candidatesByParent={candidatesByParent}
      />,
    );

    expect(screen.getAllByTestId("archive-beat")).toHaveLength(2);
    expect(screen.getByText("Narration")).toBeInTheDocument();
    expect(screen.getByText("Linh")).toBeInTheDocument();
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("Turn")).toBeInTheDocument();
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();

    // Ghosts stay visible as "paths not taken", expanded on demand.
    await user.click(screen.getByText("1 path not taken"));
    expect(screen.getByText("Push inside")).toBeInTheDocument();
    expect(screen.getByText("She pushes the door.")).toBeInTheDocument();

    // No mutate affordances anywhere in the replay.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/Take this path/)).toBeNull();
    expect(screen.queryByText(/Actions for beat/)).toBeNull();
  });

  test("branch explorer selects branches and disables empty ones", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <BranchExplorer
        branches={[
          { _id: "branch_main", label: "Main", colorIndex: 0, tipBeatId: "b3" },
          { _id: "branch_alt", label: "Alternate · beat 2", colorIndex: 3, tipBeatId: "b4" },
          { _id: "branch_empty", label: "Empty", colorIndex: 5 },
        ]}
        selectedId="branch_main"
        beatCounts={{ branch_main: 3, branch_alt: 1 }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("button", { name: /Main/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: /Alternate/ }));
    expect(onSelect).toHaveBeenCalledWith("branch_alt");
    expect(screen.getByRole("button", { name: /Empty/ })).toBeDisabled();
  });

  test("ledger tags global pins and mutes explicitly", () => {
    const bundle = makeExportBundle();
    render(
      <ArchiveLedger
        facts={bundle.facts}
        summaries={bundle.summaries}
        notes={bundle.notes}
        warnings={bundle.warnings}
      />,
    );
    expect(screen.getByText("global")).toBeInTheDocument();
    expect(screen.getByText("muted")).toBeInTheDocument();
    expect(screen.getByText(/covers beats 1–2/)).toBeInTheDocument();
    expect(screen.getByText(/Raise the stakes/)).toBeInTheDocument();
    expect(screen.getByText(/Timeline is ambiguous/)).toBeInTheDocument();
  });
});
