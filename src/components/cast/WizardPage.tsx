"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { CastSessionProvider } from "@/lib/cast/session";
import { WizardFlow } from "@/components/cast/WizardFlow";
import { NEW_SCENE_STEPS, type NewSceneStep } from "@/lib/cast/wizard";

const stepParser = parseAsStringEnum<NewSceneStep>([...NEW_SCENE_STEPS]).withDefault(
  "premise",
);

export function WizardPage({
  initialTemplateId,
  initialSceneId,
}: {
  initialTemplateId?: string;
  initialSceneId?: string;
}) {
  const [step, setStep] = useQueryState("step", stepParser);
  const [sceneParam, setSceneParam] = useQueryState("scene");
  const sceneId = sceneParam ?? initialSceneId;

  return (
    <CastSessionProvider initialSceneId={sceneId}>
      <WizardFlow
        step={step ?? "premise"}
        initialTemplateId={initialTemplateId}
        onStepChange={(next) => {
          void setStep(next);
        }}
        onCreated={(id) => {
          void setSceneParam(id);
          void setStep("audition");
        }}
      />
    </CastSessionProvider>
  );
}
