// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { useUiStore } from "@/stores/ui";
import { installDomShims, stubMatchMedia } from "./testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// The shell detects its own connection state; tests exercise the banner paths
// through the `connection` override, so the underlying query stands online.
vi.mock("convex/react", () => ({
  useConvexConnectionState: () => ({
    hasEverConnected: true,
    isWebSocketConnected: true,
  }),
}));

function renderShell(connection: "online" | "offline" | "reconnecting" = "online") {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AppShell
        connection={connection}
        leftPane={<div>Cast pane content</div>}
        rightPane={<div>Inspector pane content</div>}
      >
        <div>Scene content</div>
      </AppShell>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  installDomShims();
  useUiStore.setState({ paletteOpen: false, shortcutsOpen: false, activePanel: null });
});

describe("AppShell responsive panes (PLAN §9.7 / Phase 3.2)", () => {
  test("desktop ≥ 1201px renders both panes inline", () => {
    stubMatchMedia(1440);
    renderShell();

    expect(screen.getByRole("complementary", { name: "Cast" })).toHaveTextContent(
      "Cast pane content",
    );
    expect(screen.getByRole("complementary", { name: "Inspector" })).toHaveTextContent(
      "Inspector pane content",
    );
    expect(screen.queryByRole("button", { name: "Open Cast" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Inspector" })).not.toBeInTheDocument();
  });

  test("tablet 769–1200px keeps the left pane inline and sheets the inspector", async () => {
    stubMatchMedia(900);
    const user = userEvent.setup();
    renderShell();

    expect(screen.getByRole("complementary", { name: "Cast" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Inspector" })).not.toBeInTheDocument();

    const openInspector = screen.getByRole("button", { name: "Open Inspector" });
    await user.click(openInspector);
    expect(await screen.findByText("Inspector pane content")).toBeInTheDocument();
  });

  test("phone ≤ 768px sheets both panes from the header", async () => {
    stubMatchMedia(400);
    const user = userEvent.setup();
    renderShell();

    expect(screen.queryByRole("complementary", { name: "Cast" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Inspector" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Cast" }));
    expect(await screen.findByText("Cast pane content")).toBeInTheDocument();

    // Escape closes the sheet and resets the store.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(useUiStore.getState().activePanel).toBeNull());
  });

  test("skip link targets the main landmark (focus order starts there)", () => {
    stubMatchMedia(1440);
    renderShell();

    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#main");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveTextContent("Scene content");
  });

  test("header exposes palette and shortcuts affordances", () => {
    stubMatchMedia(1440);
    renderShell();

    expect(screen.getByRole("button", { name: "Open command palette" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change theme" })).toBeInTheDocument();
  });

  test("connection state surfaces the offline banner", () => {
    stubMatchMedia(1440);
    renderShell("offline");
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });

  test("connection state surfaces the reconnecting banner", () => {
    stubMatchMedia(1440);
    renderShell("reconnecting");
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
  });
});
