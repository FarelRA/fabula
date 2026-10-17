// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CommandMenu } from "@/components/cmdk/CommandMenu";
import { useUiStore } from "@/stores/ui";
import { installDomShims } from "./testUtils";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

function renderPalette(commands?: Parameters<typeof CommandMenu>[0]["commands"]) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <CommandMenu commands={commands} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  installDomShims();
  routerMock.push.mockClear();
  useUiStore.setState({ paletteOpen: true, shortcutsOpen: false, activePanel: null });
});

describe("CommandMenu (Phase 3.5)", () => {
  test("filters commands as the director types", async () => {
    const user = userEvent.setup();
    renderPalette([
      { id: "test.run", title: "Run the thing", group: "Navigate", keywords: ["execute"], run: vi.fn() },
      { id: "test.theme", title: "Toggle theme", group: "Appearance", keywords: ["dark"], run: vi.fn() },
    ]);

    const input = await screen.findByPlaceholderText("Type a command or search…");
    await user.type(input, "execute");
    expect(screen.getByText("Run the thing")).toBeInTheDocument();
    expect(screen.queryByText("Toggle theme")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "zzz-nothing");
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  test("selecting a command runs it and closes the palette", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    renderPalette([
      { id: "test.run", title: "Run the thing", group: "Navigate", keywords: ["execute"], run },
    ]);

    const item = await screen.findByText("Run the thing");
    await user.click(item);
    expect(run).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  test("default registry navigates via the router", async () => {
    const user = userEvent.setup();
    renderPalette();

    const item = await screen.findByText("Start a scene");
    await user.click(item);
    expect(routerMock.push).toHaveBeenCalledWith("/new");
  });

  test("help command hands off to the shortcuts dialog", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.click(await screen.findByText("Keyboard shortcuts"));
    expect(useUiStore.getState().paletteOpen).toBe(false);
    expect(useUiStore.getState().shortcutsOpen).toBe(true);
  });
});
