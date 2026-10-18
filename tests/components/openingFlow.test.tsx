// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuditionScreen } from "@/components/cast/AuditionScreen";
import { CastSessionProvider } from "@/lib/cast/session";
import { loadFixtureScene } from "@/lib/cast/fixtures";
import { makeFixtureScene } from "./castFixtures";
import { installDomShims } from "./testUtils";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

beforeEach(() => {
  installDomShims();
  window.sessionStorage.clear();
  routerMock.push.mockClear();
});

function renderScene() {
  const scene = makeFixtureScene();
  render(
    <CastSessionProvider mode="fixtures" initialScene={scene}>
      <AuditionScreen />
    </CastSessionProvider>,
  );
  return scene;
}

async function storedBeatText(sceneId: string): Promise<string | undefined> {
  let text: string | undefined;
  await waitFor(() => {
    const stored = loadFixtureScene(sceneId);
    expect(stored?.beats).toHaveLength(1);
    text = stored?.beats[0]?.text;
  });
  return text;
}

describe("opening beat — three paths (PLAN Phase 4.6)", () => {
  test("path 1: keep the generated draft and start", async () => {
    const user = userEvent.setup();
    const scene = renderScene();
    const generated = (screen.getByRole("textbox", { name: "Opening beat" }) as HTMLTextAreaElement)
      .value;

    await user.click(screen.getByRole("button", { name: /Start scene/ }));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/s/${scene.id}`),
    );
    expect(await storedBeatText(scene.id)).toBe(generated.trim());
  });

  test("path 2: reroll the opening before starting", async () => {
    const user = userEvent.setup();
    const scene = renderScene();
    const before = (screen.getByRole("textbox", { name: "Opening beat" }) as HTMLTextAreaElement)
      .value;

    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("textbox", { name: "Opening beat" }) as HTMLTextAreaElement).value,
      ).not.toBe(before),
    );
    const rerolled = (screen.getByRole("textbox", { name: "Opening beat" }) as HTMLTextAreaElement)
      .value;
    expect(screen.getByText(/reroll 2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Start scene/ }));
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/s/${scene.id}`),
    );
    expect(await storedBeatText(scene.id)).toBe(rerolled.trim());
  });

  test("path 3: write the opening yourself", async () => {
    const user = userEvent.setup();
    const scene = renderScene();
    const textarea = screen.getByRole("textbox", {
      name: "Opening beat",
    }) as HTMLTextAreaElement;

    await user.clear(textarea);
    expect(screen.getByRole("button", { name: /Start scene/ })).toBeDisabled();

    await user.type(textarea, "The rain came first. The knocking came later.");
    await user.click(screen.getByRole("button", { name: /Start scene/ }));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/s/${scene.id}`),
    );
    expect(await storedBeatText(scene.id)).toBe(
      "The rain came first. The knocking came later.",
    );
  });
});
