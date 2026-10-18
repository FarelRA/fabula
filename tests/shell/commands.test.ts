import { describe, expect, test, vi } from "vitest";
import { buildShellCommands } from "@/lib/commands";

/**
 * Shell command registry. Later surfaces append commands; the ids
 * are stable so tests and analytics can rely on them.
 */

function makeIO() {
  return {
    navigate: vi.fn(),
    setTheme: vi.fn(),
    openShortcuts: vi.fn(),
    platform: "other" as const,
  };
}

describe("buildShellCommands", () => {
  test("exposes navigation, appearance and help commands", () => {
    const commands = buildShellCommands(makeIO());
    const ids = commands.map((command) => command.id);
    expect(ids).toEqual([
      "nav.new-scene",
      "nav.home",
      "nav.guided-setup",
      "nav.templates",
      "theme.dark",
      "theme.light",
      "theme.system",
      "help.shortcuts",
    ]);
    const groups = new Set(commands.map((command) => command.group));
    expect(groups).toEqual(new Set(["Navigate", "Appearance", "Help"]));
  });

  test("running commands calls the injected IO", () => {
    const io = makeIO();
    const commands = buildShellCommands(io);
    commands.find((command) => command.id === "nav.new-scene")?.run();
    expect(io.navigate).toHaveBeenCalledWith("/new");
    commands.find((command) => command.id === "theme.dark")?.run();
    expect(io.setTheme).toHaveBeenCalledWith("dark");
    commands.find((command) => command.id === "help.shortcuts")?.run();
    expect(io.openShortcuts).toHaveBeenCalledTimes(1);
  });

  test("shortcut labels come from the keymap registry", () => {
    const other = buildShellCommands(makeIO()).find(
      (command) => command.id === "help.shortcuts",
    );
    expect(other?.shortcut).toBe("?");
    const mac = buildShellCommands({ ...makeIO(), platform: "mac" }).find(
      (command) => command.id === "help.shortcuts",
    );
    expect(mac?.shortcut).toBe("?");
  });

  test("commands carry search keywords", () => {
    const commands = buildShellCommands(makeIO());
    for (const command of commands) {
      expect((command.keywords ?? []).length).toBeGreaterThan(0);
    }
  });
});
