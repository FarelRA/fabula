// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ConfirmDialog } from "@/components/director/ConfirmDialog";
import { EditBeatDialog } from "@/components/director/EditBeatDialog";
import { makeBeat } from "../play/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

const beat = makeBeat({
  id: "beat_2",
  seq: 2,
  text: "Rain hadn't stopped for three days.",
  speakerRoleId: "role_0",
});

describe("edit-fork confirmation", () => {
  test("states the fork law and only saves a changed beat", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <EditBeatDialog
        beat={beat}
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(
      screen.getByText(/Editing forks the story from beat 1/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The original beat and everything after it stay intact/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save & fork/ })).toBeDisabled();

    const input = screen.getByLabelText("Edited beat text");
    await user.clear(input);
    await user.type(input, "Rain stopped, and the door opened.");
    await user.click(screen.getByRole("button", { name: /Save & fork/ }));

    expect(onConfirm).toHaveBeenCalledWith("Rain stopped, and the door opened.");
  });
});

describe("generic confirm dialog", () => {
  test("names the later-pick fork explicitly", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Fork from beat 3?"
        description="“Call the bluff” was offered at beat 3, not at the current tip. The current branch stays intact."
        confirmLabel="Fork & take this path"
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText(/offered at beat 3/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fork & take this path" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
