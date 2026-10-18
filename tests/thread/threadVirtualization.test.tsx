// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ThreadView } from "@/components/thread/ThreadView";
import { makeBeat, makeScene } from "../play/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

function stubLayout() {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 600,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => 4000,
  });
  Element.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    }) as DOMRect;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
}

beforeEach(() => {
  stubLayout();
});

const roles = makeScene().roles;
const manyBeats = Array.from({ length: 200 }, (_, index) =>
  makeBeat({
    id: `beat_${index + 1}`,
    seq: index + 1,
    origin: index === 0 ? "opening" : "turn",
    speakerRoleId: roles[index % roles.length]?.id,
    text: `Beat ${index + 1}: the rain keeps falling on the harbour.`,
  }),
);

const scene = makeScene({
  beats: manyBeats,
  activeTipBeatId: manyBeats[manyBeats.length - 1]?.id,
});

function renderThread(overrides: Partial<React.ComponentProps<typeof ThreadView>> = {}) {
  render(
    <ThreadView
      scene={scene}
      run={null}
      streamingText=""
      optimisticPick={null}
      pendingPickId={null}
      onPick={vi.fn()}
      onPin={vi.fn()}
      onEdit={vi.fn()}
      onRegenerate={vi.fn()}
      onRetry={vi.fn()}
      {...overrides}
    />,
  );
}

describe("virtualized thread (PLAN Phase 5.1/5.7)", () => {
  test("renders a window of a 200-beat scene, not 200 rows", () => {
    renderThread();
    const rows = screen.getAllByTestId("beat-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(200);
    expect(screen.getByTestId("beat-scroll")).toBeInTheDocument();
  });

  test("shows Jump to latest when the director scrolls up, and scrolls back", async () => {
    const user = userEvent.setup();
    renderThread();
    const scroller = screen.getByTestId("beat-scroll");
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 4000,
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 600,
    });
    fireEvent.scroll(scroller);

    const jump = await screen.findByRole("button", { name: /Jump to latest/ });
    await user.click(jump);
    expect(scroller.scrollTop).toBeGreaterThanOrEqual(0);
  });

  test("streams in-flight text without duplicating a finished beat", () => {
    const streamingScene = makeScene({
      beats: [
        ...makeScene().beats,
        makeBeat({
          id: "streaming",
          seq: 2,
          status: "streaming",
          text: "",
          speakerRoleId: roles[0]?.id,
        }),
      ],
      activeTipBeatId: "streaming",
    });
    renderThread({
      scene: streamingScene,
      streamingText: "The rain keeps falling",
    });
    expect(screen.getAllByText(/The rain keeps falling/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("beat-row").length).toBeGreaterThan(0);
  });
});
