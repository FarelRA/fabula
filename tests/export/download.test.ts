// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { downloadTextFile } from "@/lib/export/download";
import { installDomShims } from "../components/testUtils";

installDomShims();

afterEach(() => {
  vi.useRealTimers();
});

test("downloadTextFile creates a blob URL and clicks an anchor", () => {
  vi.useFakeTimers();
  const createObjectURL = vi.fn(() => "blob:fabula");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
  });
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});

  downloadTextFile("the-glass-harbor-2026-10-18.md", "# hi", "text/markdown");

  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(click).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1_000);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:fabula");
  click.mockRestore();
});
