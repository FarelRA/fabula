import type { Doc, Id } from "@convex/_generated/dataModel";
import type { RoleCard, SceneSettings } from "@convex/shared/contracts";
import type { CastBeat, CastRole, CastScene } from "./types";

/** Convex document → cast UI types (shared by the live session and scene page). */

export function roleCardFromDoc(doc: {
  identity: {
    name: string;
    monogram: string;
    ageEra: string;
    pronouns: string;
    occupation: string;
    accentColor: string;
  };
  hook: string;
  psychology: RoleCard["psychology"];
  voice: RoleCard["voice"];
  drives: RoleCard["drives"];
  boundariesLines: string[];
  relations: Array<RoleCard["relations"][number] & { toRoleId: Id<"roles"> }>;
  meta: RoleCard["meta"];
}): RoleCard {
  return {
    identity: {
      name: doc.identity.name,
      monogram: doc.identity.monogram,
      ageEra: doc.identity.ageEra,
      pronouns: doc.identity.pronouns,
      occupation: doc.identity.occupation,
      accentColor: doc.identity.accentColor,
    },
    hook: doc.hook,
    psychology: doc.psychology,
    voice: doc.voice,
    drives: doc.drives,
    boundariesLines: doc.boundariesLines,
    relations: doc.relations.map((relation) => ({
      toRoleId: relation.toRoleId,
      dynamic: relation.dynamic,
      tension: relation.tension,
      historyNote: relation.historyNote,
      knowsAbout: relation.knowsAbout,
    })),
    meta: doc.meta,
  };
}

export function castRoleFromDoc(
  doc: Doc<"roles">,
  sampleLines?: string[],
): CastRole {
  return {
    id: doc._id,
    kind: doc.kind,
    card: roleCardFromDoc(doc),
    status: doc.status,
    draftLocks: doc.draftLocks,
    sampleLines: sampleLines ?? doc.voice.sampleLines,
    currentRevisionId: doc.currentRevisionId,
  };
}

export function castBeatFromDoc(doc: Doc<"beats">): CastBeat {
  return {
    id: doc._id,
    seq: doc.seq,
    text: doc.text,
    origin: doc.origin,
    status: doc.status,
    speakerRoleId: doc.speakerRoleId,
    createdAt: doc.createdAt,
  };
}

export function castSceneFromLive(args: {
  scene: Doc<"scenes">;
  settings: Doc<"sceneSettings">;
  roles: Doc<"roles">[];
  beats: Doc<"beats">[];
  sampleOverrides?: Record<string, string[]>;
  openingDraft?: CastScene["openingDraft"];
}): CastScene {
  return {
    id: args.scene._id,
    title: args.scene.title,
    premise: args.scene.premise,
    status: args.scene.status,
    settings: args.settings as unknown as SceneSettings,
    roles: args.roles.map((doc) =>
      castRoleFromDoc(doc, args.sampleOverrides?.[doc._id]),
    ),
    beats: args.beats.map(castBeatFromDoc),
    openingDraft: args.openingDraft,
    updatedAt: args.scene.seqCounter,
  };
}
