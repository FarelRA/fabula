// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ExportDialog } from "@/components/scenes/ExportDialog";
import { makeExportBundle } from "../export/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

vi.mock("@/lib/export/download", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/export/download")>();
  return {
    ...original,
    downloadTextFile: vi.fn(),
  };
});

const { downloadTextFile } = await import("@/lib/export/download");

describe("export dialog", () => {
  test("downloads markdown and JSON from the bundle with dated filenames", async () => {
    const user = userEvent.setup();
    const bundle = makeExportBundle();
    render(
      <ExportDialog
        open
        onOpenChange={vi.fn()}
        bundle={bundle}
        sceneTitle="The Glass Harbor"
        includeSnapshots={false}
        onIncludeSnapshotsChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: ".md" }));
    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [filename, text, mime] = vi.mocked(downloadTextFile).mock.calls[0]!;
    expect(filename).toMatch(/^the-glass-harbor-\d{4}-\d{2}-\d{2}\.md$/);
    expect(text).toContain("# The Glass Harbor");
    expect(text).toContain("She slid the ledger back.");
    expect(mime).toMatch(/text\/markdown/);

    await user.click(screen.getByRole("button", { name: ".json" }));
    expect(downloadTextFile).toHaveBeenCalledTimes(2);
    const jsonCall = vi.mocked(downloadTextFile).mock.calls[1]!;
    expect(jsonCall[0]).toMatch(/\.json$/);
    const parsed = JSON.parse(jsonCall[1]) as { beats: unknown[] };
    expect(parsed.beats).toHaveLength(4);
  });

  test("snapshot toggle is a controlled switch and downloads are disabled while loading", async () => {
    const user = userEvent.setup();
    const onIncludeSnapshotsChange = vi.fn();
    const { rerender } = render(
      <ExportDialog
        open
        onOpenChange={vi.fn()}
        bundle={null}
        sceneTitle="Scene"
        includeSnapshots={false}
        onIncludeSnapshotsChange={onIncludeSnapshotsChange}
      />,
    );
    for (const button of screen.getAllByRole("button", { name: /\.(md|json)/ })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByText("Preparing the export…")).toBeInTheDocument();

    rerender(
      <ExportDialog
        open
        onOpenChange={vi.fn()}
        bundle={makeExportBundle()}
        sceneTitle="Scene"
        includeSnapshots
        onIncludeSnapshotsChange={onIncludeSnapshotsChange}
      />,
    );
    await user.click(screen.getByRole("switch", { name: /Include prompt snapshots/ }));
    expect(onIncludeSnapshotsChange).toHaveBeenCalledWith(false);
  });
});
