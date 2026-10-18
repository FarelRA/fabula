// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { installDomShims } from "./testUtils";

beforeEach(() => {
  installDomShims();
});

describe("Dialog focus management", () => {
  test("focus traps inside the dialog, Escape closes, focus returns to trigger", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open dialog</button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Focus trap</DialogTitle>
          <DialogDescription>Focus stays inside this dialog.</DialogDescription>
          <input aria-label="First field" />
          <button type="button">Second action</button>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    // Tab through more than the number of focusables: focus must not escape.
    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("Sheet primitive", () => {
  test("bottom sheets (mobile panels) render with the bottom side", async () => {
    render(
      <Sheet open>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Cast</SheetTitle>
            <SheetDescription className="sr-only">Cast panel</SheetDescription>
          </SheetHeader>
          <p>Sheet body</p>
        </SheetContent>
      </Sheet>,
    );

    expect(await screen.findByText("Sheet body")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-side", "bottom");
  });

  test("side sheets render on the right for the inspector", async () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Inspector</SheetTitle>
            <SheetDescription className="sr-only">Inspector panel</SheetDescription>
          </SheetHeader>
          <p>Inspector body</p>
        </SheetContent>
      </Sheet>,
    );

    expect(await screen.findByText("Inspector body")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("data-side", "right");
  });
});
