// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";
import { SteerComposer } from "@/components/director/SteerComposer";
import { makeScene } from "../play/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

const scene = makeScene();
const roles = scene.roles;

function renderComposer(overrides: Partial<ComponentProps<typeof SteerComposer>> = {}) {
  const handlers = {
    onSteer: vi.fn(),
    onWrite: vi.fn(),
    onMention: vi.fn(),
    onResolveNote: vi.fn(),
  };
  render(
    <SteerComposer
      scene={scene}
      roles={roles}
      notes={[]}
      run={null}
      onSteer={handlers.onSteer}
      onWrite={handlers.onWrite}
      onMention={handlers.onMention}
      onResolveNote={handlers.onResolveNote}
      {...overrides}
    />,
  );
  return handlers;
}

describe("steer composer (PLAN Phase 5.5)", () => {
  test("sends a steer with the send button and clears the input", async () => {
    const user = userEvent.setup();
    const { onSteer } = renderComposer();

    const input = screen.getByLabelText("Steer note");
    await user.type(input, "Make her suspicious of the ledger.");
    await user.click(screen.getByRole("button", { name: "Send steer" }));

    expect(onSteer).toHaveBeenCalledWith("Make her suspicious of the ledger.");
    expect(input).toHaveValue("");
  });

  test("⌘/Ctrl+Enter sends exactly once through the keymap", async () => {
    const user = userEvent.setup();
    const { onSteer } = renderComposer();
    const input = screen.getByLabelText("Steer note");
    await user.type(input, "Raise the stakes");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(onSteer).toHaveBeenCalledTimes(1);
    expect(onSteer).toHaveBeenCalledWith("Raise the stakes");
  });

  test("quick chips create steer notes directly", async () => {
    const user = userEvent.setup();
    const { onSteer } = renderComposer();
    await user.click(screen.getByRole("button", { name: "Faster pace" }));
    expect(onSteer).toHaveBeenCalledWith("Faster pace");
  });

  test("in-character mode writes as the default role", async () => {
    const user = userEvent.setup();
    const { onWrite } = renderComposer();
    await user.click(screen.getByRole("button", { name: "In-character" }));
    expect(screen.getByLabelText("Write as role")).toBeInTheDocument();
    await user.type(screen.getByLabelText("In-character line"), "I know who left the ledger.");
    await user.click(screen.getByRole("button", { name: "Write" }));
    expect(onWrite).toHaveBeenCalledWith(roles[0]?.id, "I know who left the ledger.");
  });

  test("in-character writing is blocked while a beat is streaming", async () => {
    const user = userEvent.setup();
    const run = {
      id: "run",
      mode: "turn",
      roleId: roles[0]?.id,
      roleName: roles[0]?.card.identity.name,
      roleAccent: "amber",
      roleMonogram: "L",
      startedAt: 1,
      abortRequested: false,
    };
    const { onWrite } = renderComposer({ run });
    await user.click(screen.getByRole("button", { name: "In-character" }));
    await user.type(screen.getByLabelText("In-character line"), "Too soon");
    expect(screen.getByRole("button", { name: "Write" })).toBeDisabled();
    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.getByText(/Wait for the current beat/)).toBeInTheDocument();
  });

  test("mention uses cmdk and forces the chosen role", async () => {
    const user = userEvent.setup();
    const { onMention } = renderComposer();
    await user.click(screen.getByRole("button", { name: "Mention a role" }));
    const search = await screen.findByPlaceholderText("Force a role to speak…");
    await user.type(search, "Mai");
    await user.click(await screen.findByRole("option", { name: /@Mai/ }));
    expect(onMention).toHaveBeenCalledWith(roles[2]?.id);
  });

  test("active notes are visible and resolvable", async () => {
    const user = userEvent.setup();
    const { onResolveNote } = renderComposer({
      notes: [
        {
          id: "note_1",
          kind: "steer",
          text: "Keep the pace tight",
          appliesFromSeq: 2,
        },
      ],
    });
    expect(screen.getByText("Keep the pace tight")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Resolve note: Keep the pace tight" }),
    );
    expect(onResolveNote).toHaveBeenCalledWith("note_1");
  });
});
