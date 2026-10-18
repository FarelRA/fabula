import type { Metadata } from "next";
import { ArchiveRouteClient } from "./ArchiveRouteClient";

export const metadata: Metadata = {
  title: "Scene archive · Fabula",
};

export default async function Page({
  params,
}: {
  params: Promise<{ sceneId: string }>;
}) {
  const { sceneId } = await params;
  return <ArchiveRouteClient sceneId={sceneId} />;
}
