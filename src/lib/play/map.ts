import type { Doc } from "@convex/_generated/dataModel";
import type { SceneSettings } from "@convex/shared/contracts";
import { castRoleFromDoc } from "@/lib/cast/liveMapping";
import type { PlayBeat, PlayNote, PlayOption, PlayRun, PlayScene } from "./types";

type CandidateRow = Doc<"candidates"> & {
  parentSeq?: number;
  parentIsTip?: boolean;
};

type RunRow = {
  _id: string;
  mode: string;
  roleId: string | null;
  roleName: string | null;
  roleAccent: string | null;
  roleMonogram: string | null;
  startedAt: number;
  abortRequested: boolean;
};

export function mapPlayBeat(doc: Doc<"beats">): PlayBeat {
  return {
    id: doc._id,
    seq: doc.seq,
    branchId: doc.branchId,
    parentBeatId: doc.parentBeatId,
    speakerRoleId: doc.speakerRoleId,
    origin: doc.origin,
    status: doc.status,
    isArtifact: doc.isArtifact,
    isPinned: doc.isPinned,
    text: doc.text,
    streamMessageId: doc.streamMessageId,
    createdAt: doc.createdAt,
  };
}

export function mapPlayOption(doc: CandidateRow): PlayOption {
  return {
    id: doc._id,
    parentBeatId: doc.parentBeatId,
    parentSeq: doc.parentSeq ?? 0,
    parentIsTip: doc.parentIsTip ?? false,
    optionIndex: doc.optionIndex,
    label: doc.label,
    text: doc.text,
    strategy: doc.strategy,
    speakerRoleId: doc.speakerRoleId,
  };
}

export function mapPlayRun(doc: RunRow | null | undefined): PlayRun | null {
  if (!doc) return null;
  return {
    id: doc._id,
    mode: doc.mode,
    roleId: doc.roleId ?? undefined,
    roleName: doc.roleName ?? undefined,
    roleAccent: doc.roleAccent ?? undefined,
    roleMonogram: doc.roleMonogram ?? undefined,
    startedAt: doc.startedAt,
    abortRequested: doc.abortRequested,
  };
}

export function buildPlayScene(args: {
  scene: Doc<"scenes">;
  settings: Doc<"sceneSettings">;
  roles: Doc<"roles">[];
  beats: Doc<"beats">[];
  pending: Doc<"beats">[];
  options: CandidateRow[];
  notes: Doc<"directorNotes">[];
}): PlayScene {
  return {
    id: args.scene._id,
    title: args.scene.title,
    premise: args.scene.premise,
    status: args.scene.status,
    settings: args.settings as unknown as SceneSettings,
    roles: args.roles.map((doc) => castRoleFromDoc(doc)),
    beats: args.beats.map(mapPlayBeat),
    pending: args.pending.map(mapPlayBeat),
    options: args.options.map(mapPlayOption),
    notes: args.notes.map(
      (note): PlayNote => ({
        id: note._id,
        kind: note.kind,
        text: note.text,
        appliesFromSeq: note.appliesFromSeq,
      }),
    ),
    activeTipBeatId: args.scene.activeTipBeatId,
    activeBranchId: args.scene.activeBranchId,
    threadId: args.scene.threadId,
    seqCounter: args.scene.seqCounter,
    endingStreak: args.scene.endingStreak,
  };
}
