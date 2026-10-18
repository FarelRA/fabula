"use client";

import { createContext, useContext } from "react";
import type { CastSessionValue } from "./types";

export const CastSessionContext = createContext<CastSessionValue | null>(null);

export function useCastSession(): CastSessionValue {
  const value = useContext(CastSessionContext);
  if (!value) {
    throw new Error("useCastSession must be used inside <CastSessionProvider>");
  }
  return value;
}
