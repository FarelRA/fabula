// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { installDomShims } from "./testUtils";

beforeEach(() => {
  installDomShims();
  document.documentElement.classList.remove("dark", "light");
});

afterEach(() => {
  document.documentElement.classList.remove("dark", "light");
});

describe("ThemeToggle", () => {
  test("switches the document theme to dark", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).not.toHaveClass("dark");

    await user.click(screen.getByRole("button", { name: "Change theme" }));
    await user.click(await screen.findByText("Dark"));

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
  });

  test("switches back to light", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));

    await user.click(screen.getByRole("button", { name: "Change theme" }));
    await user.click(await screen.findByText("Light"));

    await waitFor(() => expect(document.documentElement).toHaveClass("light"));
  });
});
