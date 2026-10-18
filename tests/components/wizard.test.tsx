// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { WizardFlow } from "@/components/cast/WizardFlow";
import { CastSessionProvider } from "@/lib/cast/session";
import type { NewSceneStep } from "@/lib/cast/wizard";
import { installDomShims } from "./testUtils";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));

beforeEach(() => {
  installDomShims();
  process.env.NEXT_PUBLIC_FIXTURES = "1";
  delete process.env.NEXT_PUBLIC_CONVEX_URL;
  window.sessionStorage.clear();
});

function renderWizard(
  step: NewSceneStep,
  options: { templateId?: string; onStepChange?: (step: NewSceneStep) => void; onCreated?: (id: string) => void } = {},
) {
  const onStepChange = options.onStepChange ?? vi.fn();
  const onCreated = options.onCreated ?? vi.fn();
  render(
    <CastSessionProvider mode="fixtures">
      <WizardFlow
        step={step}
        initialTemplateId={options.templateId}
        onStepChange={onStepChange}
        onCreated={onCreated}
      />
    </CastSessionProvider>,
  );
  return { onStepChange, onCreated };
}

describe("guided wizard (PLAN §9.4 / Phase 4.1)", () => {
  test("premise step validates before advancing", async () => {
    const user = userEvent.setup();
    const { onStepChange } = renderWizard("premise");

    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(
      await screen.findByText(/Give us at least a full sentence/i),
    ).toBeInTheDocument();
    expect(onStepChange).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("Premise"),
      "A salvage crew wakes something in the hold of an abandoned freighter.",
    );
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith("world"));
  });

  test("template preseed fills the world step", () => {
    renderWizard("world", { templateId: "noir" });
    expect(screen.getByLabelText("Genre")).toHaveValue("noir");
    expect(screen.getByLabelText("Setting / era")).toHaveValue(
      "1948, a rain-soaked city precinct",
    );
    expect(screen.getByText(/Template: Noir interrogation/)).toBeInTheDocument();
  });

  test("you step requires a name only when playing a role", async () => {
    const user = userEvent.setup();
    const { onStepChange } = renderWizard("you");

    await user.click(screen.getByRole("radio", { name: /A role in the scene/i }));
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByText(/Give your role a name/i)).toBeInTheDocument();
    expect(onStepChange).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Your character's name/i), "Linh");
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    await waitFor(() => expect(onStepChange).toHaveBeenCalledWith("cast"));
  });

  test("cast step generates the troupe and hands off to the audition", async () => {
    const user = userEvent.setup();
    const { onCreated } = renderWizard("cast", { templateId: "noir" });

    expect(screen.getByText(/4 AI roles/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Generate cast/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Audition")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Opening beat" })).toBeInTheDocument();
  });

  test("step 1 can go back to premise but not before it", async () => {
    const user = userEvent.setup();
    const { onStepChange } = renderWizard("world");
    await user.click(screen.getByRole("button", { name: /Back/ }));
    expect(onStepChange).toHaveBeenCalledWith("premise");
  });
});
