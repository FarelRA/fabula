// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import RootRouteError from "@/app/error";
import NewSceneError from "@/app/new/error";
import ShareError from "@/app/share/[token]/error";
import SceneError from "@/app/s/[sceneId]/error";
import NotFound from "@/app/not-found";
import { installDomShims } from "./testUtils";

installDomShims();

/**
 * Route boundaries (Phase 8.3): every surface recovers with a retry wired to
 * Next's `reset`, plus a way home. Copy never implies story data was lost.
 */

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

type BoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

async function renderBoundary(
  Component: (props: BoundaryProps) => React.ReactElement,
) {
  const user = userEvent.setup();
  const reset = vi.fn();
  render(<Component error={new Error("boom")} reset={reset} />);
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledTimes(1);
}

describe("route error boundaries", () => {
  test("root boundary retries in place and links home", async () => {
    await renderBoundary(RootRouteError);
    expect(
      screen.getByText("Something went wrong on this page"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the lobby" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("casting boundary reassures that drafts survive", async () => {
    await renderBoundary(NewSceneError);
    expect(screen.getByText("The casting room hit a snag")).toBeInTheDocument();
    expect(screen.getByText(/cast drafts are safe/i)).toBeInTheDocument();
  });

  test("shared-scene boundary matches visitor expectations", async () => {
    await renderBoundary(ShareError);
    expect(
      screen.getByText("This shared scene could not open"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start your own scene" }),
    ).toHaveAttribute("href", "/");
  });

  test("scene boundary covers play and archive", async () => {
    await renderBoundary(SceneError);
    expect(screen.getByText("This scene could not open")).toBeInTheDocument();
    expect(screen.getByText(/Every branch and beat is safe/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the lobby" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("not-found surface offers a way forward", () => {
    render(<NotFound />);
    expect(screen.getByText("This page doesn't exist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a new scene" })).toHaveAttribute(
      "href",
      "/new",
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
