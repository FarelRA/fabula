import type { Metadata } from "next";
import { Suspense } from "react";
import { CastProgress } from "@/components/cast/CastProgress";
import { QuickStartPage } from "@/components/cast/QuickStartPage";

export const metadata: Metadata = {
  title: "Quick start",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sceneId = typeof params.scene === "string" ? params.scene : undefined;
  return (
    <Suspense fallback={<CastProgress label="Preparing quick start…" />}>
      <QuickStartPage initialSceneId={sceneId} />
    </Suspense>
  );
}
