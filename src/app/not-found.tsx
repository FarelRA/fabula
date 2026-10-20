import type { Metadata } from "next";
import { RouteError } from "@/components/shell/RouteError";

export const metadata: Metadata = {
  title: "Page not found",
};

/** 404 surface: calm copy, one clear way forward. */
export default function NotFound() {
  return (
    <RouteError
      title="This page doesn't exist"
      description="The link may be old or mistyped. The scenes you made are safe in the lobby."
      homeHref="/new"
      homeLabel="Start a new scene"
    />
  );
}
