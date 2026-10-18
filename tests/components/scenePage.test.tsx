// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { ScenePage } from "@/components/scene/ScenePage";
import { saveFixtureScene } from "@/lib/cast/fixtures";
import type { CastBeat } from "@/lib/cast/types";
import { makeFixtureScene } from "./castFixtures";
import { installDomShims } from "./testUtils";

beforeEach(() => {
  installDomShims();
  process.env.NEXT_PUBLIC_FIXTURES = "1";
  delete process.env.NEXT_PUBLIC_CONVEX_URL;
  window.sessionStorage.clear();
});

function playableScene() {
  const scene = makeFixtureScene();
  const text =
    "Rain hadn't stopped for three days when the wrong door opened.";
  const beat: CastBeat = {
    id: "fixture_beat_opening",
    seq: 1,
    text,
    origin: "opening",
    status: "finished",
    speakerRoleId: scene.roles[0]?.id,
    createdAt: 1,
  };
  const playable = {
    ...scene,
    status: "playing" as const,
    beats: [beat],
    openingDraft: undefined,
  };
  saveFixtureScene(playable);
  return { scene: playable, text };
}

describe("scene handoff", () => {
  test("renders the committed opening beat and the cast strip", async () => {
    const { scene, text } = playableScene();
    render(<ScenePage sceneId={scene.id} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: scene.title })).toBeInTheDocument();
    expect(screen.getByText("Opening")).toBeInTheDocument();
    for (const role of scene.roles) {
      expect(screen.getAllByText(role.card.identity.name).length).toBeGreaterThan(0);
    }
  });

  test("shows a designed missing state for an unknown scene", async () => {
    render(<ScenePage sceneId="fixture_scene_missing" />);
    expect(
      await screen.findByText(/This scene could not be found/i),
    ).toBeInTheDocument();
  });
});
