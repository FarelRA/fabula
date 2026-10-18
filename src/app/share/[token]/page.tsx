import type { Metadata } from "next";
import { SharePageClient } from "./SharePageClient";

export const metadata: Metadata = {
  title: "Shared scene · Fabula",
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharePageClient token={token} />;
}
