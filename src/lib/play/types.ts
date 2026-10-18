import type { SceneSettings } from "@convex/shared/contracts";
import type { CastRole } from "@/lib/cast/types";

/** UI read models for the play loop (PLAN Phase 5). */

export type PlayBeat = {
  id: string;
  seq: number;
  branchId: string;
  parentBeatId?: string;
  speakerRoleId?: string;
  origin:
    | "opening"
    | "turn"
    | "option"
    | "userInsert"
    | "edit"
    | "regenerate";
  status: "streaming" | "finished" | "failed" | "aborted";
  isArtifact: boolean;
  isPinned: boolean;
  text: string;
  streamMessageId?: string;
  createdAt: number;
  /** Client-only optimistic row; never persisted. */
  optimistic?: boolean;
};

export type PlayOption = {
  id: string;
  parentBeatId: string;
  parentSeq: number;
  parentIsTip: boolean;
  optionIndex: number;
  label: string;
  text: string;
  strategy: string;
  speakerRoleId?: string;
};

export type PlayNote = {
  id: string;
  kind: "steer" | "constraint" | "doNot";
  text: string;
  appliesFromSeq: number;
};

export type PlayRun = {
  id: string;
  mode: string;
  roleId?: string;
  roleName?: string;
  roleAccent?: string;
  roleMonogram?: string;
  startedAt: number;
  abortRequested: boolean;
};

export type PlayScene = {
  id: string;
  title: string;
  premise: string;
  status: "draft" | "playing" | "paused" | "archived";
  settings: SceneSettings;
  roles: CastRole[];
  beats: PlayBeat[];
  pending: PlayBeat[];
  options: PlayOption[];
  notes: PlayNote[];
  activeTipBeatId?: string;
  activeBranchId?: string;
  threadId?: string;
  /** Monotonic scene beat counter; positions the branch gutter. */
  seqCounter: number;
};

export type PlayOptionPick = {
  option: PlayOption;
  optimistic: boolean;
};
