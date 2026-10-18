// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  ReconnectingBanner,
} from "@/components/shell/states";
import "./testUtils"; // registers RTL cleanup between tests

/**
 * States catalog: every surface composes loading,
 * empty, error, offline and reconnecting states from these primitives.
 */

describe("EmptyState", () => {
  test("renders title, description and an optional action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Create your first scene"
        description="Pick a premise and we'll cast the troupe."
        action={
          <button type="button" onClick={onClick}>
            Start a scene
          </button>
        }
      />,
    );

    expect(screen.getByText("Create your first scene")).toBeInTheDocument();
    expect(screen.getByText(/cast the troupe/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start a scene" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorState", () => {
  test("announces as an alert and retries", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState description="The stream dropped." onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("alert")).toHaveTextContent("The stream dropped.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("works without a retry affordance", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  test("is a polite busy status with an accessible label", () => {
    render(<LoadingState label="Casting the troupe…" rows={2} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Casting the troupe…");
  });
});

describe("connection banners", () => {
  test("offline banner explains the paused story actions", () => {
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });

  test("reconnecting banner is polite and customisable", () => {
    render(<ReconnectingBanner message="Reconnecting to your scene…" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Reconnecting to your scene…");
  });
});
