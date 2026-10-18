import type {
  PresentationStyle,
  RoleCard,
  SceneSettings,
  StoryRole,
  Tier,
} from "@convex/shared/contracts";

/**
 * UI-side cast types (PLAN §9.5, Phase 4). These are the shapes the audition
 * components consume; both the fixtures session and the Convex session map
 * their data into them, so components never care where a cast came from.
 */

export type CastRoleStatus = "active" | "offstage" | "retired";

export type CastRole = {
  id: string;
  kind: "ai" | "human";
  card: RoleCard;
  status: CastRoleStatus;
  /** Whole field groups locked from regeneration (`identity`, `voice`, …). */
  draftLocks: string[];
  avatarUrl?: string;
  /** Latest generated sample lines (falls back to card.voice.sampleLines). */
  sampleLines?: string[];
  currentRevisionId?: string;
};

export type CastBeatOrigin =
  | "opening"
  | "turn"
  | "option"
  | "userInsert"
  | "edit"
  | "regenerate";

export type CastBeat = {
  id: string;
  seq: number;
  text: string;
  origin: CastBeatOrigin;
  status: "streaming" | "finished" | "failed" | "aborted";
  speakerRoleId?: string;
  createdAt: number;
};

export type OpeningDraft = {
  text: string;
  speakerRoleId?: string;
  /** Increments on every regenerate so the UI can label rerolls. */
  variant: number;
};

export type CastScene = {
  id: string;
  title: string;
  premise: string;
  status: "draft" | "playing" | "paused" | "archived";
  settings: SceneSettings;
  roles: CastRole[];
  beats: CastBeat[];
  openingDraft?: OpeningDraft;
  updatedAt: number;
};

/** Everything the three doors collect before a cast can be generated. */
export type SceneDraftInput = {
  title: string;
  premise: string;
  genre: string;
  settingEra: string;
  presentationStyle: PresentationStyle;
  playLanguage: string;
  tone: SceneSettings["tone"];
  boundaries: SceneSettings["boundaries"];
  castSize: number;
  youInScene?: { name: string; pronouns?: string };
  /** Template skeleton / director nudge for the casting prompt. */
  vibeSteer?: string;
};

export type RoleCardPatch = {
  identity?: Partial<RoleCard["identity"]>;
  hook?: string;
  psychology?: RoleCard["psychology"];
  voice?: RoleCard["voice"];
  drives?: RoleCard["drives"];
  boundariesLines?: string[];
  relations?: RoleCard["relations"];
  meta?: RoleCard["meta"];
};

export type CastBusy = {
  casting: boolean;
  castRegen: boolean;
  resize: boolean;
  role: string | null;
  field: string | null;
  sample: string | null;
  opening: boolean;
};

export type SampleLinesResult = { lines: string[]; cached: boolean };

export type CastSessionValue = {
  mode: "fixtures" | "live";
  scene: CastScene | null;
  warnings: string[];
  error: string | null;
  busy: CastBusy;
  /** Field groups that changed in the last regeneration, per role id. */
  changedFields: Record<string, string[]>;
  createScene: (input: SceneDraftInput) => Promise<string>;
  updateRole: (roleId: string, patch: RoleCardPatch) => Promise<void>;
  setLocks: (roleId: string, locks: string[]) => Promise<void>;
  regenerateField: (roleId: string, field: string) => Promise<void>;
  regenerateRole: (roleId: string) => Promise<void>;
  regenerateCast: (vibe: string) => Promise<void>;
  addRole: () => Promise<void>;
  duplicateRole: (roleId: string) => Promise<void>;
  setRoleStatus: (roleId: string, status: CastRoleStatus) => Promise<void>;
  reorder: (roleIds: string[]) => Promise<void>;
  setCastSize: (size: number) => Promise<void>;
  requestSampleLines: (roleId: string, force?: boolean) => Promise<SampleLinesResult>;
  draftOpening: () => Promise<void>;
  commitOpening: (input: { text: string }) => Promise<{ sceneId: string; beatId: string }>;
  clearError: () => void;
};

export type { PresentationStyle, RoleCard, SceneSettings, StoryRole, Tier };
