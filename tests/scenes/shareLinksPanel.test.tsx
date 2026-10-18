// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  ShareLinksPanel,
  type ShareLinkRowView,
} from "@/components/scenes/ShareLinksPanel";
import { installDomShims } from "../components/testUtils";

installDomShims();

const now = Date.UTC(2026, 9, 18);

const activeViewer: ShareLinkRowView = {
  id: "share_1",
  token: "tok_viewer",
  permission: "viewer",
  createdAt: now - 60_000,
};

const activeDirector: ShareLinkRowView = {
  id: "share_2",
  token: "tok_director",
  permission: "director",
  createdAt: now - 30_000,
};

describe("share links panel", () => {
  test("offers both permissions and lists active links with copy/revoke", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onCopy = vi.fn();
    const onRevoke = vi.fn();
    render(
      <ShareLinksPanel
        rows={[activeViewer, activeDirector]}
        origin="https://fabula.example"
        now={now}
        copiedToken="tok_viewer"
        onCreate={onCreate}
        onCopy={onCopy}
        onRevoke={onRevoke}
      />,
    );

    expect(screen.getAllByText("View only").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Can direct").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("share-link-row")).toHaveLength(2);
    expect(
      screen.getByText("https://fabula.example/share/tok_viewer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Copied")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Create view only link" }),
    );
    expect(onCreate).toHaveBeenCalledWith("viewer");
    await user.click(
      screen.getByRole("button", { name: "Create can direct link" }),
    );
    expect(onCreate).toHaveBeenCalledWith("director");

    await user.click(
      screen.getByRole("button", { name: "Copy Can direct link" }),
    );
    expect(onCopy).toHaveBeenCalledWith(activeDirector);
    await user.click(
      screen.getByRole("button", { name: "Revoke View only link" }),
    );
    expect(onRevoke).toHaveBeenCalledWith(activeViewer);
  });

  test("revoked and expired links move to the inactive section", () => {
    const rows: ShareLinkRowView[] = [
      activeViewer,
      { id: "share_3", token: "tok_revoked", permission: "viewer", createdAt: now, revokedAt: now },
      { id: "share_4", token: "tok_expired", permission: "director", createdAt: now, expiresAt: now - 1 },
    ];
    render(
      <ShareLinksPanel
        rows={rows}
        origin="https://fabula.example"
        now={now}
        onCreate={vi.fn()}
        onCopy={vi.fn()}
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("share-link-row")).toHaveLength(1);
    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.queryByText("No active links yet")).toBeNull();
  });

  test("empty state is explicit, not blank", () => {
    render(
      <ShareLinksPanel
        rows={[]}
        origin="https://fabula.example"
        now={now}
        onCreate={vi.fn()}
        onCopy={vi.fn()}
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getByText(/No active links yet/)).toBeInTheDocument();
  });
});
