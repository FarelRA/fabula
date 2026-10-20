import type { Metadata } from "next";
import { Suspense } from "react";
import { SceneLibrary } from "@/components/scenes/SceneLibrary";

export const metadata: Metadata = {
  title: "Your repertoire",
};

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <SceneLibrary />
    </Suspense>
  );
}
