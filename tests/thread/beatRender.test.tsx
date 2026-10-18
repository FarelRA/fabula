// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { BeatContent } from "@/components/thread/BeatContent";
import { BeatRow } from "@/components/thread/BeatRow";
import { makeBeat, makeOption, makeRoles } from "../play/fixtures";
import { installDomShims } from "../components/testUtils";

installDomShims();

describe("BeatContent, presentation styles", () => {
  test.each(["chat", "script", "novel"] as const)("%s golden", (style) => {
    const { container } = render(
      <BeatContent
        style={style}
        text={"The rain **kept** falling.\n\n- one\n- two"}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  test("sanitizes model markdown and keeps safe formatting", () => {
    const { container } = render(
      <BeatContent style="chat" text={"**bold** and <script>alert(1)</script>"} />,
    );
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(container.querySelector("script")).toBeNull();
  });

  test("streaming adds a caret but no extra text", () => {
    const { container } = render(
      <BeatContent style="chat" text="Half a" streaming />,
    );
    expect(container.querySelector('[data-streaming="true"]')).not.toBeNull();
    expect(screen.getByText(/Half a/)).toBeInTheDocument();
  });
});

describe("BeatRow", () => {
  const roles = makeRoles();
  const speaker = roles[0]!;

  test("renders speaker, accent border, origin and pin state", () => {
    const beat = makeBeat({
      id: "beat_1",
      seq: 1,
      origin: "opening",
      speakerRoleId: speaker.id,
      text: "Rain hadn't stopped for three days.",
      isPinned: true,
    });
    render(
      <BeatRow
        beat={beat}
        speaker={speaker}
        style="chat"
        roles={roles}
        isTip
        options={[]}
        onPick={vi.fn()}
        onPin={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const article = screen.getByRole("article", {
      name: `Beat 1 from ${speaker.card.identity.name}`,
    });
    expect(article).toBeInTheDocument();
    expect(article.getAttribute("style")).toContain("border-left-color");
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("Rain hadn't stopped for three days.")).toBeInTheDocument();
  });

  test("failed beats stay in place with a retry path", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <BeatRow
        beat={makeBeat({
          id: "beat_2",
          seq: 2,
          status: "failed",
          text: "Partial text",
        })}
        style="chat"
        roles={roles}
        isTip
        options={[]}
        onPick={vi.fn()}
        onPin={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(/attempt failed/)).toBeInTheDocument();
    expect(screen.getByText(/Partial: Partial text/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("inline options are never modal and call pick", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const option = makeOption();
    render(
      <BeatRow
        beat={makeBeat({ id: "beat_1", seq: 1, speakerRoleId: speaker.id })}
        speaker={speaker}
        style="chat"
        roles={roles}
        isTip
        options={[option]}
        onPick={onPick}
        onPin={vi.fn()}
        onEdit={vi.fn()}
        onRegenerate={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Take this path/ }));
    expect(onPick).toHaveBeenCalledWith(option);
  });

  test("the beat menu exposes pin, edit and regenerate", async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    const onEdit = vi.fn();
    render(
      <BeatRow
        beat={makeBeat({ id: "beat_1", seq: 1, speakerRoleId: speaker.id })}
        speaker={speaker}
        style="chat"
        roles={roles}
        isTip
        options={[]}
        onPick={vi.fn()}
        onPin={onPin}
        onEdit={onEdit}
        onRegenerate={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Actions for beat 1" }));
    await user.click(await screen.findByRole("menuitem", { name: /Pin beat/ }));
    expect(onPin).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Actions for beat 1" }));
    await user.click(await screen.findByRole("menuitem", { name: /Edit \(forks\)/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
