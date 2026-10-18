// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { BeatRow } from "@/components/thread/BeatRow";
import { makeBeat, makeOption, makeRoles } from "../play/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

const roles = makeRoles();

function renderBeat(readOnly: boolean) {
  return render(
    <BeatRow
      beat={makeBeat({ id: "beat_9", seq: 9 })}
      speaker={roles[0]}
      style="chat"
      roles={roles}
      isTip
      options={[makeOption({ id: "opt_a", parentIsTip: true })]}
      readOnly={readOnly}
      onPick={vi.fn()}
      onPin={vi.fn()}
      onEdit={vi.fn()}
      onRegenerate={vi.fn()}
      onRetry={vi.fn()}
      onInspect={vi.fn()}
    />,
  );
}

describe("read-only beats for shared viewers", () => {
  test("readOnly strips menus and pick buttons entirely", () => {
    renderBeat(true);
    expect(screen.queryByRole("button", { name: /Actions for beat 9/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Take this path/ })).toBeNull();
    expect(screen.queryByText(/picks$/)).toBeNull();
    expect(screen.queryByText("Full text")).toBeTruthy(); // details summary stays
    expect(screen.getByText("Shared view · read-only")).toBeInTheDocument();
  });

  test("the director view keeps its affordances (regression guard)", () => {
    renderBeat(false);
    expect(
      screen.getByRole("button", { name: /Actions for beat 9/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Take this path/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/picks$/)).toBeInTheDocument();
    expect(screen.queryByText("Shared view · read-only")).toBeNull();
  });
});
