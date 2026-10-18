// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { OptionCards } from "@/components/options/OptionCards";
import { makeOption, makeRoles } from "../play/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

const roles = makeRoles();

describe("inline path options", () => {
  test("renders 2 to 4 non-modal cards with strategy, speaker and shortcut hints", () => {
    const options = [
      makeOption({ id: "a", optionIndex: 1, label: "Push inside" }),
      makeOption({
        id: "b",
        optionIndex: 2,
        label: "Wait outside",
        strategy: "deflect",
        speakerRoleId: roles[1]?.id,
      }),
    ];
    render(
      <OptionCards options={options} roles={roles} activeTipId="beat_1" onPick={vi.fn()} />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Push inside")).toBeInTheDocument();
    expect(screen.getByText("Wait outside")).toBeInTheDocument();
    expect(screen.getByText("Escalate")).toBeInTheDocument();
    expect(screen.getByText("Deflect")).toBeInTheDocument();
    expect(screen.getByText(/Alt\+1 to 2 picks/)).toBeInTheDocument();
  });

  test("picking is explicit and disabled while another pick is pending", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const options = [makeOption({ id: "a" }), makeOption({ id: "b", label: "Wait outside" })];
    const { rerender } = render(
      <OptionCards options={options} roles={roles} activeTipId="beat_1" onPick={onPick} />,
    );
    await user.click(screen.getAllByRole("button", { name: /Take this path/ })[0]!);
    expect(onPick).toHaveBeenCalledTimes(1);

    rerender(
      <OptionCards
        options={options}
        roles={roles}
        activeTipId="beat_1"
        pendingPickId="a"
        onPick={onPick}
      />,
    );
    for (const button of screen.getAllByRole("button", { name: /Taking…/ })) {
      expect(button).toBeDisabled();
    }
  });

  test("ghost candidates carry a later-pick fork warning", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const ghost = makeOption({
      id: "ghost",
      parentBeatId: "beat_3",
      parentSeq: 3,
      parentIsTip: false,
      label: "Call the bluff",
    });
    render(
      <OptionCards
        options={[ghost]}
        roles={roles}
        activeTipId="beat_9"
        onPick={onPick}
      />,
    );

    expect(screen.queryByText(/Offered at beat 3/)).toBeNull();
    await user.click(screen.getByRole("button", { name: /unused path.*Review/i }));
    expect(
      screen.getByText(/Offered at beat 3\. Taking it now forks the story/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Fork from here/ }));
    expect(onPick).toHaveBeenCalledWith(ghost);
  });
});
