import type { NormalizedTierUsage } from "@/lib/usage/format";

/** Presentational view models for the inspector (Phase 6.5–6.7). */

export type MemoryFactView = {
  id: string;
  text: string;
  nodeId: string;
  beatSeq?: number;
  status: "active" | "muted";
  isPinned: boolean;
  onPath: boolean;
  inContext: boolean;
  subjectNames: string[];
  createdAt: number;
};

export type MemorySummaryView = {
  id: string;
  text: string;
  coveredFromSeq: number;
  coveredThroughSeq: number;
};

export type MemoryWarningView = {
  id: string;
  text: string;
  severity: "low" | "medium" | "high";
  status: "open" | "dismissed";
  beatSeq?: number;
};

export type SnapshotBlockView = {
  key: string;
  templateKey?: string;
  templateVersion?: number;
  text: string;
  hash: string;
  tokens: number;
  chars: number;
};

export type SnapshotDetailView = {
  id: string;
  mode: string;
  createdAt: number;
  beatId?: string;
  candidateId?: string;
  roleId?: string;
  model: { provider: string; modelId: string };
  tokenCounts: { system: number; context: number; outputReserve: number; total: number };
  budget: { contextWindow: number; systemTargetPct: number; overBudgetAction?: string };
  blocks: SnapshotBlockView[];
};

export type SnapshotSummaryView = {
  id: string;
  mode: string;
  createdAt: number;
  blockKeys: string[];
  blockCount: number;
};

export type UsageView = {
  tokensIn: number;
  tokensOut: number;
  costEstimateUsd: number;
  byTier: NormalizedTierUsage[];
};
