/**
 * Structural view of `exportScene.getBundle` rows.
 * Only the fields the serializers read are named; the query's richer rows are
 * assignable to these shapes, and the export stays lossless because the JSON
 * serializer writes the bundle as received.
 */

export type ExportSceneRow = {
  _id: string;
  title: string;
  premise: string;
  status: string;
  endedAt?: number;
  _creationTime?: number;
};

export type ExportSettingsRow = {
  genre: string;
  settingEra: string;
  presentationStyle: string;
  playLanguage: string;
  lengthTarget?: string;
} | null;

export type ExportTone = {
  comedicGrim?: number;
  groundedFantastical?: number;
  romanceRivalry?: number;
};

export type ExportRoleRow = {
  _id: string;
  kind: string;
  status: string;
  sortKey: string;
  hook?: string;
  identity: { name: string; monogram?: string; accentColor?: string };
  meta?: { storyRole?: string; tier?: string };
};

export type ExportBranchRow = {
  _id: string;
  label: string;
  forkedFromBeatId?: string;
  forkReason?: string;
  tipBeatId?: string;
  colorIndex?: number;
  createdAt: number;
};

export type ExportBeatRow = {
  _id: string;
  branchId: string;
  parentBeatId?: string;
  seq: number;
  depth: number;
  speakerRoleId?: string;
  origin: string;
  status: string;
  isArtifact: boolean;
  isPinned: boolean;
  text: string;
  editedFromBeatId?: string;
  regenerateOfBeatId?: string;
  createdAt: number;
};

export type ExportCandidateRow = {
  _id: string;
  parentBeatId: string;
  optionIndex: number;
  label: string;
  text: string;
  strategy: string;
  status: string;
  pickedBeatId?: string;
  speakerRoleId?: string;
};

export type ExportFactRow = {
  _id: string;
  nodeId: string;
  text: string;
  status: string;
  isPinned: boolean;
  createdAt: number;
};

export type ExportSummaryRow = {
  _id: string;
  coveredFromSeq: number;
  coveredThroughSeq: number;
  text: string;
};

export type ExportWarningRow = {
  _id: string;
  beatId: string;
  text: string;
  severity: string;
  status: string;
};

export type ExportNoteRow = {
  _id: string;
  kind: string;
  text: string;
  appliesFromSeq: number;
  status: string;
};

export type ExportSnapshotRow = {
  _id: string;
  mode: string;
  blocks: Array<{ key: string; text: string; tokens: number }>;
  createdAt: number;
};

export type ExportBundle = {
  format: "fabula.scene" | string;
  version: number;
  scene: ExportSceneRow;
  settings: ExportSettingsRow;
  roles: ExportRoleRow[];
  branches: ExportBranchRow[];
  beats: ExportBeatRow[];
  candidates: ExportCandidateRow[];
  facts: ExportFactRow[];
  summaries: ExportSummaryRow[];
  warnings: ExportWarningRow[];
  notes: ExportNoteRow[];
  snapshots?: ExportSnapshotRow[];
};
