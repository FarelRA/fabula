// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { QuickStartPage } from "@/components/cast/QuickStartPage";
import { lastFixtureSceneId, loadFixtureScene } from "@/lib/cast/fixtures";
import { installDomShims } from "./testUtils";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

beforeEach(() => {
  installDomShims();
  process.env.NEXT_PUBLIC_FIXTURES = "1";
  delete process.env.NEXT_PUBLIC_CONVEX_URL;
  window.sessionStorage.clear();
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
});

describe("quick start", () => {
  test("premise → audition → start scene with an opening beat", async () => {
    const user = userEvent.setup();
    render(<QuickStartPage />);

    await user.type(
      screen.getByLabelText("Premise"),
      "A debt collector knocks on the wrong door in 1970s Saigon.",
    );
    await user.click(screen.getByRole("button", { name: /Cast & play/ }));

    expect(await screen.findByText("Audition")).toBeInTheDocument();
    const sceneId = await waitFor(() => {
      const id = lastFixtureSceneId();
      expect(id).toMatch(/^fixture_scene_/);
      return id!;
    });

    const opening = screen.getByRole("textbox", { name: "Opening beat" });
    expect((opening as HTMLTextAreaElement).value.length).toBeGreaterThan(20);

    await user.click(screen.getByRole("button", { name: /Start scene/ }));
    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/s/${sceneId}`),
    );
    await waitFor(() => {
      const stored = loadFixtureScene(sceneId);
      expect(stored?.beats).toHaveLength(1);
      expect(stored?.status).toBe("playing");
    });
  });

  test("validation blocks an empty premise before any scene is created", async () => {
    const user = userEvent.setup();
    render(<QuickStartPage />);

    await user.click(screen.getByRole("button", { name: /Cast & play/ }));

    expect(
      await screen.findByText(/Give us at least a full sentence/i),
    ).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /Give me one line/i }),
    ).toBeInTheDocument();
  });

  test("you-in-scene adds a human role card", async () => {
    const user = userEvent.setup();
    render(<QuickStartPage />);

    await user.type(
      screen.getByLabelText("Premise"),
      "Two rival columnists in 1920s Paris share a secret.",
    );
    await user.click(screen.getByRole("radio", { name: /A role in the scene/i }));
    await user.type(screen.getByLabelText(/Your character's name/i), "Margot");
    await user.click(screen.getByRole("button", { name: /Cast & play/ }));

    expect(await screen.findByText("Audition")).toBeInTheDocument();
    expect(screen.getAllByText(/You: Margot/).length).toBeGreaterThan(0);
  });
});
