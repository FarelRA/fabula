// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { ShortcutsDialog } from "@/components/cmdk/ShortcutsDialog";
import { useUiStore } from "@/stores/ui";
import { installDomShims } from "./testUtils";

beforeEach(() => {
  installDomShims();
  useUiStore.setState({ paletteOpen: false, shortcutsOpen: true, activePanel: null });
});

describe("ShortcutsDialog (Appendix B)", () => {
  test("renders every registry group with formatted keys", async () => {
    render(<ShortcutsDialog />);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Command palette")).toBeInTheDocument();
    expect(screen.getByText("Undo last action")).toBeInTheDocument();
    expect(screen.getByText("Jump to latest")).toBeInTheDocument();
    expect(screen.getByText("Pick path 1")).toBeInTheDocument();
    expect(screen.getByText("Send")).toBeInTheDocument();

    // Non-mac jsdom platform renders Ctrl-style hints.
    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
    expect(screen.getByText("?")) .toBeInTheDocument();
  });

  test("Escape closes the dialog through the store", async () => {
    const user = userEvent.setup();
    render(<ShortcutsDialog />);

    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(useUiStore.getState().shortcutsOpen).toBe(false));
  });
});
