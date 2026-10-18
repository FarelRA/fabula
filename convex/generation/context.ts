import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertSceneAccess, requireScene } from "../lib/authz";
import { projectPath } from "../lib/path";
import { loadTemplateMap } from "../prompts/load";
import type {
  ContextBeat,
  FactLine,
  NoteLine,
  RelationLine,
  RoleCardData,
  ScenePromptData,
  SummaryLine,
  TemplateMap,
} from "../compiler/types";

/**
 * Generation context loader (PLAN §7.1): DB → plain data for the pure
 * compiler. Access checks run here; nested calls from actions inherit the
 * caller's identity.
 */

export type SceneView = {
  id: Id<"scenes">;
  ownerId: Id<"users">;
  title: string;
  premise: string;
  status: "draft" | "playing" | "paused" | "archived";
  activeBranchId?: Id<"branches">;
  activeTipBeatId?: Id<"beats">;
  threadId?: string;
  seqCounter: number;
};

export type SettingsView = {
  genre: string;
  settingEra: string;
  presentationStyle: "chat" | "script" | "novel";
  playLanguage: string;
  tone: { comedicGrim: number; groundedFantastical: number; romanceRivalry: number };
  boundaries: { allowed: string[]; blocked: string[] };
  turnRules: {
    mode: "roundRobin" | "reactive" | "directorLed" | "freeform";
    autoBurst: boolean;
    burstMax: number;
    abortedKeepsPartial: boolean;
  };
  branchFrequency: "always" | "key" | "onDemand";
  optionsDefaultCount: number;
  contextBeatsK: number;
  summaryEveryN: number;
  lengthTarget: "short" | "medium" | "long";
};

export type RoleView = {
  id: Id<"roles">;
  name: string;
  kind: "ai" | "human";
  tier: "spotlight" | "supporting" | "background";
  modelTier: "spotlight" | "standard" | "cheap";
  storyRole: string;
  status: "active" | "offstage" | "retired";
  sortKey: string;
  draftLocks: string[];
  temperature?: number;
  card: RoleCardData;
  /** Full card-shaped plain object (identity incl. avatar fields) for validation/patching. */
  rawCard: Record<string, unknown>;
  relations: Array<{
    toRoleId: Id<"roles">;
    dynamic: string;
    tension: number;
    historyNote: string;
    knowsAbout: string;
  }>;
};

export type TurnContextView = {
  scene: SceneView;
  settings: SettingsView;
  templates: TemplateMap;
  roles: RoleView[];
  chain: ContextBeat[];
  facts: FactLine[];
  summaries: SummaryLine[];
  notes: NoteLine[];
  lastBeat?: ContextBeat;
  tensions: Record<string, number>;
  cooldown: Record<string, number>;
  factSubjectsWindow: string[];
  beatsSinceStateChange: boolean[];
};

function sceneView(scene: Doc<"scenes">): SceneView {
  return {
    id: scene._id,
    ownerId: scene.ownerId,
    title: scene.title,
    premise: scene.premise,
    status: scene.status,
    activeBranchId: scene.activeBranchId,
    activeTipBeatId: scene.activeTipBeatId,
    threadId: scene.threadId,
    seqCounter: scene.seqCounter,
  };
}

function settingsView(settings: Doc<"sceneSettings">): SettingsView {
  return {
    genre: settings.genre,
    settingEra: settings.settingEra,
    presentationStyle: settings.presentationStyle,
    playLanguage: settings.playLanguage,
    tone: settings.tone,
    boundaries: settings.boundaries,
    turnRules: settings.turnRules,
    branchFrequency: settings.branchFrequency,
    optionsDefaultCount: settings.optionsDefaultCount,
    contextBeatsK: settings.contextBeatsK,
    summaryEveryN: settings.summaryEveryN,
    lengthTarget: settings.lengthTarget,
  };
}

export function roleCard(role: Doc<"roles">): RoleCardData {
  return {
    id: role._id,
    name: role.identity.name,
    hook: role.hook,
    ageEra: role.identity.ageEra,
    occupation: role.identity.occupation,
    pronouns: role.identity.pronouns,
    traits: role.psychology.traits,
    dials: role.psychology.dials,
    flaws: role.psychology.flaws,
    fears: role.psychology.fears,
    desires: role.psychology.desires,
    secret: role.psychology.secret,
    register: role.voice.register,
    rhythm: role.voice.rhythm,
    verbosity: role.voice.verbosity,
    verbalTics: role.voice.verbalTics,
    sampleLines: role.voice.sampleLines,
    doNotSay: role.voice.doNotSay,
    narrationStyle: role.voice.narrationStyle,
    publicGoal: role.drives.publicGoal,
    secretGoal: role.drives.secretGoal,
    stakes: role.drives.stakes,
    boundariesLines: role.boundariesLines,
    tier: role.meta.tier,
    modelTier: role.meta.modelTier,
  };
}

function roleView(role: Doc<"roles">): RoleView {
  return {
    id: role._id,
    name: role.identity.name,
    kind: role.kind,
    tier: role.meta.tier,
    modelTier: role.meta.modelTier,
    storyRole: role.meta.storyRole,
    status: role.status,
    sortKey: role.sortKey,
    draftLocks: role.draftLocks,
    temperature: role.meta.temperature,
    card: roleCard(role),
    rawCard: {
      identity: { ...role.identity },
      hook: role.hook,
      psychology: { ...role.psychology },
      voice: { ...role.voice },
      drives: { ...role.drives },
      boundariesLines: [...role.boundariesLines],
      relations: role.relations.map((relation) => ({ ...relation })),
      meta: { ...role.meta },
    },
    relations: role.relations.map((relation) => ({ ...relation })),
  };
}

export function scenePromptData(scene: SceneView, settings: SettingsView): ScenePromptData {
  return {
    title: scene.title,
    premise: scene.premise,
    genre: settings.genre,
    settingEra: settings.settingEra,
    presentationStyle: settings.presentationStyle,
    playLanguage: settings.playLanguage,
    tone: settings.tone,
    boundaries: settings.boundaries,
    lengthTarget: settings.lengthTarget,
    branchFrequency: settings.branchFrequency,
    turnMode: settings.turnRules.mode,
    contextBeatsK: settings.contextBeatsK,
  };
}

export function relationsForRole(view: TurnContextView, role: RoleView): RelationLine[] {
  const nameById = new Map(view.roles.map((entry) => [entry.id as string, entry.name]));
  const activeOthers = new Set(
    view.roles.filter((entry) => entry.status === "active" && entry.id !== role.id).map((entry) => entry.id as string),
  );
  const lines: RelationLine[] = [];
  for (const relation of role.relations) {
    const toId = relation.toRoleId as string;
    if (!activeOthers.has(toId)) continue;
    lines.push({
      name: nameById.get(toId) ?? "Unknown",
      dynamic: relation.dynamic,
      tension: relation.tension,
      historyNote: relation.historyNote,
      knowsAbout: relation.knowsAbout,
    });
  }
  return lines;
}

async function buildContext(
  ctx: QueryCtx,
  scene: Doc<"scenes">,
  tipOverride?: Id<"beats">,
): Promise<TurnContextView> {
  const settingsDoc = await ctx.db
    .query("sceneSettings")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .first();
  if (!settingsDoc) throw new Error("Scene settings missing");
  const settings = settingsView(settingsDoc);

  const rolesRaw = await ctx.db
    .query("roles")
    .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
    .collect();
  const roles = rolesRaw
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(roleView);
  const nameById = new Map(roles.map((role) => [role.id as string, role.name]));

  const templates = loadTemplateMap(await ctx.db.query("promptTemplates").collect());

  const projection = await projectPath(ctx, scene, tipOverride);
  const chain: ContextBeat[] = projection.chain.map((beat) => ({
    id: beat._id as string,
    seq: beat.seq,
    speakerRoleId: beat.speakerRoleId as string | undefined,
    speakerName: beat.speakerRoleId ? nameById.get(beat.speakerRoleId as string) : undefined,
    text: beat.text,
    isPinned: beat.isPinned,
  }));
  const facts: FactLine[] = projection.facts.map((fact) => ({
    text: fact.text,
    isPinned: fact.isPinned,
    subjects: fact.subjects.map((subject) => subject as string),
  }));
  const summaries: SummaryLine[] = projection.summaries
    .map((summary) => ({ text: summary.text, coveredThroughSeq: summary.coveredThroughSeq }))
    .sort((a, b) => a.coveredThroughSeq - b.coveredThroughSeq);

  const noteRows = await ctx.db
    .query("directorNotes")
    .withIndex("by_scene_status", (q) => q.eq("sceneId", scene._id).eq("status", "active"))
    .collect();
  const notes: NoteLine[] = noteRows.map((note) => ({ kind: note.kind, text: note.text }));

  const lastBeat = chain.length > 0 ? chain[chain.length - 1] : undefined;

  const tensions: Record<string, number> = {};
  if (lastBeat?.speakerRoleId) {
    for (const role of roles) {
      if (role.id === lastBeat.speakerRoleId) continue;
      const relation = role.relations.find((entry) => entry.toRoleId === lastBeat.speakerRoleId);
      tensions[role.id as string] = relation ? relation.tension : 0;
    }
  }

  const cooldown: Record<string, number> = {};
  const lastSpokeAt = new Map<string, number>();
  chain.forEach((beat, index) => {
    if (beat.speakerRoleId) lastSpokeAt.set(beat.speakerRoleId, index);
  });
  for (const role of roles) {
    const index = lastSpokeAt.get(role.id as string);
    cooldown[role.id as string] = index === undefined ? chain.length + 1 : chain.length - index;
  }

  const factSubjectsWindow = Array.from(
    new Set(
      projection.facts
        .filter((fact) => fact.nodeId === lastBeat?.id)
        .flatMap((fact) => fact.subjects.map((subject) => subject as string)),
    ),
  );

  const factNodes = new Set(projection.facts.map((fact) => fact.nodeId as string));
  const pickedRows = await ctx.db
    .query("candidates")
    .withIndex("by_scene_status", (q) => q.eq("sceneId", scene._id).eq("status", "picked"))
    .collect();
  const pickedBeats = new Set(
    pickedRows
      .map((candidate) => candidate.pickedBeatId as string | undefined)
      .filter((value): value is string => value !== undefined),
  );
  const beatsSinceStateChange = chain
    .slice(-5)
    .map((beat) => factNodes.has(beat.id) || pickedBeats.has(beat.id));

  return {
    scene: sceneView(scene),
    settings,
    templates,
    roles,
    chain,
    facts,
    summaries,
    notes,
    lastBeat,
    tensions,
    cooldown,
    factSubjectsWindow,
    beatsSinceStateChange,
  };
}

export const loadTurnContext = internalQuery({
  args: { sceneId: v.id("scenes"), trusted: v.optional(v.boolean()) },
  handler: async (ctx, { sceneId, trusted }) => {
    const scene = await requireScene(ctx, sceneId);
    // `trusted` is only for scheduled internal passes (wrap summary) whose
    // caller already passed an access gate before scheduling.
    if (trusted !== true) {
      await assertSceneAccess(ctx, scene, { write: true });
    }
    return await buildContext(ctx, scene);
  },
});

export const loadOptionsContext = internalQuery({
  args: { sceneId: v.id("scenes"), tipBeatId: v.id("beats") },
  handler: async (ctx, { sceneId, tipBeatId }) => {
    const scene = await requireScene(ctx, sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    const tip = await ctx.db.get(tipBeatId);
    if (!tip || tip.sceneId !== sceneId) throw new Error("Tip beat not found in this scene");
    return await buildContext(ctx, scene, tip._id);
  },
});

export const loadRoleContext = internalQuery({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Role not found");
    const scene = await requireScene(ctx, role.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    const settingsDoc = await ctx.db
      .query("sceneSettings")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .first();
    if (!settingsDoc) throw new Error("Scene settings missing");
    const templates = loadTemplateMap(await ctx.db.query("promptTemplates").collect());
    return {
      scene: sceneView(scene),
      settings: settingsView(settingsDoc),
      role: roleView(role),
      templates,
    };
  },
});

/** Resolve a beat + scene for the regeneration action (write access). */
export const loadBeatForRegen = internalQuery({
  args: { beatId: v.id("beats") },
  handler: async (ctx, { beatId }) => {
    const beat = await ctx.db.get(beatId);
    if (!beat) throw new Error("Beat not found");
    const scene = await requireScene(ctx, beat.sceneId);
    await assertSceneAccess(ctx, scene, { write: true });
    return { beat, sceneId: beat.sceneId };
  },
});

export const setSceneThread = internalMutation({
  args: { sceneId: v.id("scenes"), threadId: v.string() },
  handler: async (ctx, { sceneId, threadId }) => {
    await ctx.db.patch(sceneId, { threadId });
  },
});
