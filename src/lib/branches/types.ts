import type { Doc } from "@convex/_generated/dataModel";

/**
 * UI view models for branch & meta surfaces. These are mapped
 * from the frozen queries (`branches.list`, `branches.tree`) so pure helpers
 * and presentational components stay Convex-free and unit-testable.
 */

export type BranchInfo = {
  id: string;
  label: string;
  colorIndex: number;
  parentBranchId?: string;
  forkedFromBeatId?: string;
  forkReason?: string;
  tipBeatId?: string;
  beatCount: number;
  isActive: boolean;
  createdAt: number;
};

export type TreeBeat = {
  id: string;
  branchId: string;
  parentBeatId?: string;
  seq: number;
  depth: number;
  speakerRoleId?: string;
  origin: string;
  status: string;
  isArtifact: boolean;
  isPinned: boolean;
  textPreview: string;
  textChars: number;
  editedFromBeatId?: string;
  regenerateOfBeatId?: string;
  createdAt: number;
};

export type TreeCandidate = {
  id: string;
  parentBeatId: string;
  label: string;
  optionIndex: number;
  speakerRoleId?: string;
  status: string;
  pickedBeatId?: string;
};

export type StoryTree = {
  branches: BranchInfo[];
  beats: TreeBeat[];
  candidates: TreeCandidate[];
  activeBranchId?: string;
  activeTipBeatId?: string;
  activeBeatIds: string[];
};

type BranchDoc = Doc<"branches">;
type BranchListRow = BranchDoc & { beatCount: number; isActive: boolean };

export function mapBranchRows(rows: readonly BranchListRow[]): BranchInfo[] {
  return rows.map((row) => ({
    id: row._id,
    label: row.label,
    colorIndex: row.colorIndex,
    parentBranchId: row.forkedFromBranchId,
    forkedFromBeatId: row.forkedFromBeatId,
    forkReason: row.forkReason,
    tipBeatId: row.tipBeatId,
    beatCount: row.beatCount,
    isActive: row.isActive,
    createdAt: row.createdAt,
  }));
}

type TreeRow = {
  branches: BranchDoc[];
  beats: Array<{
    _id: Doc<"beats">["_id"];
    branchId: Doc<"beats">["branchId"];
    parentBeatId?: Doc<"beats">["parentBeatId"];
    seq: number;
    depth: number;
    speakerRoleId?: Doc<"beats">["speakerRoleId"];
    origin: string;
    status: string;
    isArtifact: boolean;
    isPinned: boolean;
    textPreview: string;
    textChars: number;
    editedFromBeatId?: Doc<"beats">["editedFromBeatId"];
    regenerateOfBeatId?: Doc<"beats">["regenerateOfBeatId"];
    createdAt: number;
  }>;
  candidates: Array<{
    _id: Doc<"candidates">["_id"];
    parentBeatId: Doc<"candidates">["parentBeatId"];
    label: string;
    optionIndex: number;
    speakerRoleId?: Doc<"candidates">["speakerRoleId"];
    status: string;
    pickedBeatId?: Doc<"candidates">["pickedBeatId"];
  }>;
  activeBranchId?: Doc<"scenes">["activeBranchId"];
  activeTipBeatId?: Doc<"scenes">["activeTipBeatId"];
  activeBeatIds: string[];
};

export function mapStoryTree(row: TreeRow): StoryTree {
  return {
    branches: row.branches
      .map((branch) => ({
        id: branch._id,
        label: branch.label,
        colorIndex: branch.colorIndex,
        parentBranchId: branch.forkedFromBranchId,
        forkedFromBeatId: branch.forkedFromBeatId,
        forkReason: branch.forkReason,
        tipBeatId: branch.tipBeatId,
        beatCount: 0,
        isActive: branch._id === row.activeBranchId,
        createdAt: branch.createdAt,
      }))
      .map((branch) => ({
        ...branch,
        beatCount: row.beats.filter((beat) => beat.branchId === branch.id).length,
      })),
    beats: row.beats.map((beat) => ({
      id: beat._id,
      branchId: beat.branchId,
      parentBeatId: beat.parentBeatId,
      seq: beat.seq,
      depth: beat.depth,
      speakerRoleId: beat.speakerRoleId,
      origin: beat.origin,
      status: beat.status,
      isArtifact: beat.isArtifact,
      isPinned: beat.isPinned,
      textPreview: beat.textPreview,
      textChars: beat.textChars,
      editedFromBeatId: beat.editedFromBeatId,
      regenerateOfBeatId: beat.regenerateOfBeatId,
      createdAt: beat.createdAt,
    })),
    candidates: row.candidates.map((candidate) => ({
      id: candidate._id,
      parentBeatId: candidate.parentBeatId,
      label: candidate.label,
      optionIndex: candidate.optionIndex,
      speakerRoleId: candidate.speakerRoleId,
      status: candidate.status,
      pickedBeatId: candidate.pickedBeatId,
    })),
    activeBranchId: row.activeBranchId,
    activeTipBeatId: row.activeTipBeatId,
    activeBeatIds: row.activeBeatIds,
  };
}
