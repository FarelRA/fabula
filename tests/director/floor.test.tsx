// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DirectorBar } from "@/components/director/DirectorBar";
import { FloorIndicator } from "@/components/director/FloorIndicator";
import { makeBeat, makeOption, makeScene } from "../play/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

function floorProps(overrides: Partial<React.ComponentProps<typeof FloorIndicator>> = {}) {
  const scene = makeScene();
  const handlers = {
    onPauseToggle: vi.fn(),
    onAbort: vi.fn(),
    onOffer: vi.fn(),
  };
  render(
    <FloorIndicator
      scene={scene}
      run={null}
      nextSpeaker={scene.roles[1]}
      queuedCount={0}
      onPauseToggle={handlers.onPauseToggle}
      onAbort={handlers.onAbort}
      onOffer={handlers.onOffer}
      {...overrides}
    />,
  );
  return { scene, ...handlers };
}

describe("floor indicator (PLAN Phase 5.3)", () => {
  test("previews the next speaker and burst counter", () => {
    const { scene } = floorProps();
    expect(
      screen.getByText(`Next: ${scene.roles[1]?.card.identity.name}`),
    ).toBeInTheDocument();
    expect(screen.getByText(/Burst 0\/2/)).toBeInTheDocument();
  });

  test("shows the streaming speaker with an abort control", async () => {
    const user = userEvent.setup();
    const scene = makeScene({
      beats: [
        ...makeScene().beats,
        makeBeat({ id: "turn", seq: 2, origin: "turn", speakerRoleId: "role_0" }),
      ],
    });
    const run = {
      id: "run",
      mode: "turn",
      roleId: scene.roles[0]?.id,
      roleName: scene.roles[0]?.card.identity.name,
      roleAccent: "amber",
      roleMonogram: "L",
      startedAt: 1,
      abortRequested: false,
    };
    const onAbort = vi.fn();
    render(
      <FloorIndicator
        scene={scene}
        run={run}
        queuedCount={2}
        onPauseToggle={vi.fn()}
        onAbort={onAbort}
        onOffer={vi.fn()}
      />,
    );
    expect(screen.getByText(/is speaking/)).toBeInTheDocument();
    expect(screen.getByText(/2 queued/)).toBeInTheDocument();
    expect(screen.getByText(/Burst 1\/2/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Abort/ }));
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  test("paused and open options are announced", async () => {
    const user = userEvent.setup();
    const scene = makeScene({ status: "paused" });
    const onPause = vi.fn();
    render(
      <FloorIndicator
        scene={scene}
        run={null}
        nextSpeaker={scene.roles[0]}
        queuedCount={0}
        onPauseToggle={onPause}
        onAbort={vi.fn()}
        onOffer={vi.fn()}
      />,
    );
    expect(screen.getByText(/Paused — auto-floor is off/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Resume/ }));
    expect(onPause).toHaveBeenCalled();

    const withOptions = makeScene({
      options: [
        makeOption({ id: "a", optionIndex: 1 }),
        makeOption({ id: "b", optionIndex: 2, label: "Wait outside" }),
      ],
    });
    render(
      <FloorIndicator
        scene={withOptions}
        run={null}
        nextSpeaker={withOptions.roles[0]}
        queuedCount={0}
        onPauseToggle={vi.fn()}
        onAbort={vi.fn()}
        onOffer={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 paths open/)).toBeInTheDocument();
  });
});

describe("director bar (PLAN Phase 5.6)", () => {
  test("wires undo, offer, pause and end-scene", async () => {
    const user = userEvent.setup();
    const handlers = {
      onUndo: vi.fn(),
      onOffer: vi.fn(),
      onPauseToggle: vi.fn(),
      onEndScene: vi.fn(),
    };
    render(
      <DirectorBar
        scene={makeScene({ activeTipBeatId: "beat_opening" })}
        canUndo
        onUndo={handlers.onUndo}
        onOffer={handlers.onOffer}
        onPauseToggle={handlers.onPauseToggle}
        onEndScene={handlers.onEndScene}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Undo/ }));
    await user.click(screen.getByRole("button", { name: /Offer paths/ }));
    await user.click(screen.getByRole("button", { name: /Pause/ }));
    await user.click(screen.getByRole("button", { name: /End scene/ }));
    expect(handlers.onUndo).toHaveBeenCalledTimes(1);
    expect(handlers.onOffer).toHaveBeenCalledTimes(1);
    expect(handlers.onPauseToggle).toHaveBeenCalledTimes(1);
    expect(handlers.onEndScene).toHaveBeenCalledTimes(1);
  });

  test("undo is disabled when there is no action", () => {
    render(
      <DirectorBar
        scene={makeScene()}
        canUndo={false}
        onUndo={vi.fn()}
        onOffer={vi.fn()}
        onPauseToggle={vi.fn()}
        onEndScene={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Undo/ })).toBeDisabled();
  });

  test("archived scenes freeze the controls", () => {
    render(
      <DirectorBar
        scene={makeScene({ status: "archived" })}
        canUndo={false}
        onUndo={vi.fn()}
        onOffer={vi.fn()}
        onPauseToggle={vi.fn()}
        onEndScene={vi.fn()}
      />,
    );
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Offer paths/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Pause/ })).toBeDisabled();
  });
});
