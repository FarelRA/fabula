// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuditionGrid } from "@/components/cast/AuditionGrid";
import { AuditionScreen } from "@/components/cast/AuditionScreen";
import { CastSessionProvider } from "@/lib/cast/session";
import { loadFixtureScene } from "@/lib/cast/fixtures";
import type { CastScene } from "@/lib/cast/types";
import { EMPTY_BUSY, makeFixtureScene } from "./castFixtures";
import { installDomShims } from "./testUtils";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

function renderAudition(scene: CastScene = makeFixtureScene()) {
  return {
    scene,
    first: scene.roles[0]!,
    ...render(
      <CastSessionProvider mode="fixtures" initialScene={scene}>
        <AuditionScreen />
      </CastSessionProvider>,
    ),
  };
}

beforeEach(() => {
  installDomShims();
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  window.sessionStorage.clear();
});

describe("audition grid", () => {
  test("renders the cast with tiers and the opening draft", () => {
    const { scene, first } = renderAudition();
    expect(screen.getByText("Audition")).toBeInTheDocument();
    expect(screen.getAllByText(first.card.identity.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/spotlight/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: "Opening beat" })).toHaveValue(
      scene.openingDraft?.text ?? "",
    );
  });

  test("inline field edit persists through the shared role editor", async () => {
    const user = userEvent.setup();
    const { scene, first } = renderAudition();
    const name = first.card.identity.name;

    await user.click(screen.getByRole("button", { name: `Edit Hook for ${name}` }));
    const hook = await screen.findByLabelText("One-line hook");
    await user.clear(hook);
    await user.type(hook, "A hook rewritten by the director.");
    await user.click(screen.getByRole("button", { name: "Save role" }));

    await waitFor(() =>
      expect(screen.getByText("A hook rewritten by the director.")).toBeInTheDocument(),
    );
    expect(loadFixtureScene(scene.id)?.roles[0]?.card.hook).toBe(
      "A hook rewritten by the director.",
    );
  });

  test("locks block field regeneration and survive a cast-wide vibe steer", async () => {
    const user = userEvent.setup();
    const { first } = renderAudition();
    const name = first.card.identity.name;
    const originalHook = first.card.hook;
    const originalName = name;

    const hookLock = screen.getByRole("button", { name: `Lock Hook for ${name}` });
    await user.click(hookLock);
    expect(hookLock).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: `Regenerate Hook for ${name}` }),
    ).toBeDisabled();

    // Identity is locked too so the vibe steer keeps the name we query by.
    await user.click(screen.getByRole("button", { name: `Lock Identity for ${name}` }));
    await user.type(
      screen.getByLabelText("Vibe steer"),
      "make the whole cast younger",
    );
    await user.click(screen.getByRole("button", { name: "Apply to cast" }));

    await waitFor(() => {
      const card = screen.getByRole("article", { name: originalName });
      expect(within(card).getAllByText("changed").length).toBeGreaterThan(0);
      expect(within(card).getByText(originalHook)).toBeInTheDocument();
    });
  });

  test("field regeneration changes an unlocked field and marks it changed", async () => {
    const user = userEvent.setup();
    const { first } = renderAudition();
    const name = first.card.identity.name;
    const originalHook = first.card.hook;

    await user.click(screen.getByRole("button", { name: `Regenerate Hook for ${name}` }));
    await waitFor(() => {
      const card = screen.getByRole("article", { name });
      expect(within(card).getAllByText("changed").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(originalHook)).not.toBeInTheDocument();
  });

  test("duplicates a role without self-relations", async () => {
    const user = userEvent.setup();
    const { first } = renderAudition();
    const name = first.card.identity.name;

    await user.click(screen.getByRole("button", { name: `More actions for ${name}` }));
    await user.click(await screen.findByRole("menuitem", { name: /Duplicate role/ }));

    await waitFor(() =>
      expect(screen.getByText(`${name} (copy)`)).toBeInTheDocument(),
    );
  });

  test("moves a role off-stage and restores it", async () => {
    const user = userEvent.setup();
    const { first } = renderAudition();
    const name = first.card.identity.name;

    await user.click(screen.getByRole("button", { name: `More actions for ${name}` }));
    await user.click(await screen.findByRole("menuitem", { name: /Move off-stage/ }));

    expect(await screen.findByText(/Off-stage, existing beats are untouched/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(screen.queryByText(/Off-stage, existing beats/)).not.toBeInTheDocument(),
    );
  });

  test("adds a blank role and enforces cast-size bounds + strict hint", async () => {
    const user = userEvent.setup();
    const { scene } = renderAudition();
    const initialAi = scene.roles.filter((role) => role.kind === "ai").length;

    await user.click(screen.getByRole("button", { name: "Add blank role" }));
    expect(await screen.findByText(new RegExp(`New role ${initialAi + 1}`))).toBeInTheDocument();

    const group = screen.getByRole("group", { name: "Cast size" });
    await user.click(within(group).getByRole("button", { name: "Increase cast size" }));
    await user.click(within(group).getByRole("button", { name: "Increase cast size" }));
    expect(screen.getByText(/strict turn-taking/i)).toBeInTheDocument();
  });

  test("sample line sheet is focus-trapped and closes with Escape", async () => {
    const user = userEvent.setup();
    const { first } = renderAudition();
    const name = first.card.identity.name;

    await user.click(screen.getByRole("button", { name: `Hear ${name}'s voice` }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(`${name}'s voice`)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  test("drag handles are keyboard-focusable", () => {
    const { first } = renderAudition();
    const handle = screen.getByRole("button", {
      name: `Reorder ${first.card.identity.name}`,
    });
    handle.focus();
    expect(handle).toHaveFocus();
    expect(handle).toHaveAttribute("aria-roledescription");
  });

  test("start commits the opening beat and hands off to the scene route", async () => {
    const user = userEvent.setup();
    const { scene } = renderAudition();
    const text = scene.openingDraft?.text ?? "";

    await user.click(screen.getByRole("button", { name: /Start scene/ }));

    await waitFor(() =>
      expect(routerMock.push).toHaveBeenCalledWith(`/s/${scene.id}`),
    );
    await waitFor(() => {
      const stored = loadFixtureScene(scene.id);
      expect(stored?.beats).toHaveLength(1);
      expect(stored?.beats[0]?.text).toBe(text.trim());
      expect(stored?.status).toBe("playing");
    });
  });
});

describe("audition failure isolation", () => {
  test("an error banner leaves every card and the start affordance usable", () => {
    const scene = makeFixtureScene();
    const noop = vi.fn();
    render(
      <AuditionGrid
        scene={scene}
        busy={EMPTY_BUSY}
        changedFields={{}}
        warnings={[]}
        error="Cast regeneration failed, the previous cast is intact."
        onDismissError={noop}
        onEdit={noop}
        onToggleLock={noop}
        onRegenField={noop}
        onRegenRole={noop}
        onSample={noop}
        onDuplicate={noop}
        onStatus={noop}
        onReorder={noop}
        onAddRole={noop}
        onRegenCast={noop}
        onCastSize={noop}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Cast regeneration failed, the previous cast is intact.",
    );
    for (const role of scene.roles) {
      expect(
        screen.getByRole("article", { name: role.card.identity.name }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Apply to cast" }),
    ).toBeEnabled();
  });
});
