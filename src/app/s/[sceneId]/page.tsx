import type { Metadata } from "next";
import { ScenePage } from "@/components/scene/ScenePage";

export const metadata: Metadata = {
  title: "Scene · Fabula",
};

export default async function Page({
  params,
}: {
  params: Promise<{ sceneId: string }>;
}) {
  const { sceneId } = await params;
  return <ScenePage sceneId={sceneId} />;
}
