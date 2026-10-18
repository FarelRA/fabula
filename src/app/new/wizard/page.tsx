import type { Metadata } from "next";
import { Suspense } from "react";
import { CastProgress } from "@/components/cast/CastProgress";
import { WizardPage } from "@/components/cast/WizardPage";

export const metadata: Metadata = {
  title: "Guided setup · Fabula",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const templateId = typeof params.template === "string" ? params.template : undefined;
  const sceneId = typeof params.scene === "string" ? params.scene : undefined;
  return (
    <Suspense fallback={<CastProgress label="Opening guided setup…" />}>
      <WizardPage initialTemplateId={templateId} initialSceneId={sceneId} />
    </Suspense>
  );
}
