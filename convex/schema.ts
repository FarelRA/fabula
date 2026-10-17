import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// Shared value objects (PLAN.md §5.1 — normative)
// ---------------------------------------------------------------------------

const storyRole = v.union(
  v.literal("protagonist"),
  v.literal("antagonist"),
  v.literal("foil"),
  v.literal("wildcard"),
  v.literal("support"),
);

const tier = v.union(v.literal("spotlight"), v.literal("supporting"), v.literal("background"));

const presentationStyle = v.union(v.literal("chat"), v.literal("script"), v.literal("novel"));

const generationMode = v.union(
  v.literal("turn"),
  v.literal("options"),
  v.literal("summary"),
  v.literal("facts"),
  v.literal("casting"),
  v.literal("directorMeta"),
  v.literal("sampleLine"),
);

const toneDials = v.object({
  comedicGrim: v.number(),
  groundedFantastical: v.number(),
  romanceRivalry: v.number(),
});

const boundaries = v.object({
  allowed: v.array(v.string()),
  blocked: v.array(v.string()),
});

export default defineSchema({
  ...authTables,

  // Extends the Convex Auth users table.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    claimedFrom: v.optional(v.id("users")), // anon → real account claim trail
  }).index("by_anonymous", ["isAnonymous"]),

  scenes: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    status: v.union(v.literal("draft"), v.literal("playing"), v.literal("paused"), v.literal("archived")),
    premise: v.string(),
    activeBranchId: v.optional(v.id("branches")), // null before opener
    activeTipBeatId: v.optional(v.id("beats")), // null before opener
    threadId: v.optional(v.string()), // Agent component thread (implementation detail)
    seqCounter: v.number(), // monotonic scene-wide seq source
    endedAt: v.optional(v.number()),
  }).index("by_owner_updated", ["ownerId"]),

  sceneSettings: defineTable({
    sceneId: v.id("scenes"),
    genre: v.string(),
    settingEra: v.string(),
    presentationStyle,
    playLanguage: v.string(), // prompts instruct output language
    tone: toneDials, // dials in [-1, 1]
    boundaries,
    turnRules: v.object({
      mode: v.union(
        v.literal("roundRobin"),
        v.literal("reactive"),
        v.literal("directorLed"),
        v.literal("freeform"),
      ),
      autoBurst: v.boolean(),
      burstMax: v.number(),
      abortedKeepsPartial: v.boolean(),
    }),
    branchFrequency: v.union(v.literal("always"), v.literal("key"), v.literal("onDemand")),
    optionsDefaultCount: v.number(), // 2–4, default 3
    contextBeatsK: v.number(), // default 30 (verbatim window)
    summaryEveryN: v.number(), // default 6
    lengthTarget: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    budget: v.object({ softUsdCap: v.optional(v.number()) }),
  }).index("by_scene", ["sceneId"]),

  roles: defineTable({
    sceneId: v.id("scenes"),
    kind: v.union(v.literal("ai"), v.literal("human")), // human = the director playing a role
    userId: v.optional(v.id("users")), // set for human roles
    // ---- current role card (denormalized latest for fast reads) ----
    identity: v.object({
      name: v.string(),
      monogram: v.string(),
      ageEra: v.string(),
      pronouns: v.string(),
      occupation: v.string(),
      accentColor: v.string(), // token name, not raw hex
      avatarStorageId: v.optional(v.id("_storage")),
      avatarPrompt: v.optional(v.string()),
    }),
    hook: v.string(),
    psychology: v.object({
      traits: v.array(v.string()),
      dials: v.object({
        warmth: v.number(),
        impulse: v.number(),
        guile: v.number(),
        optimism: v.number(),
      }),
      flaws: v.array(v.string()),
      fears: v.array(v.string()),
      desires: v.array(v.string()),
      secret: v.string(),
    }),
    voice: v.object({
      register: v.string(),
      rhythm: v.string(),
      verbosity: v.string(),
      vocabularyNotes: v.string(),
      verbalTics: v.array(v.string()),
      sampleLines: v.array(v.string()),
      doNotSay: v.array(v.string()),
      narrationStyle: v.string(),
    }),
    drives: v.object({
      publicGoal: v.string(),
      secretGoal: v.string(),
      stakes: v.string(),
    }),
    boundariesLines: v.array(v.string()), // in-fiction lines this role won't cross
    relations: v.array(
      v.object({
        toRoleId: v.id("roles"),
        dynamic: v.union(
          v.literal("ally"),
          v.literal("rival"),
          v.literal("lover"),
          v.literal("mentor"),
          v.literal("enemy"),
          v.literal("family"),
          v.literal("stranger"),
        ),
        tension: v.number(),
        historyNote: v.string(),
        knowsAbout: v.string(),
      }),
    ),
    meta: v.object({
      storyRole,
      tier,
      modelTier: v.union(v.literal("spotlight"), v.literal("standard"), v.literal("cheap")),
      temperature: v.optional(v.number()),
    }),
    status: v.union(v.literal("active"), v.literal("offstage"), v.literal("retired")),
    statusChangedAtSeq: v.number(), // airtime math; never deleted
    sortKey: v.string(), // reorder = spotlight priority
    draftLocks: v.array(v.string()), // field paths locked in the audition UI (pre-play only)
    currentRevisionId: v.optional(v.id("roleRevisions")), // set once scene is playable
  })
    .index("by_scene_status_sort", ["sceneId", "status", "sortKey"])
    .index("by_scene", ["sceneId"]),

  roleRevisions: defineTable({
    // starts at play time; pre-play edits are drafts
    roleId: v.id("roles"),
    sceneId: v.id("scenes"),
    effectiveFromBeatId: v.optional(v.id("beats")), // null = from scene start
    effectiveSeq: v.number(), // scene seq for cheap revisionAt()
    card: v.any(), // frozen snapshot of the full role card (ADR-002: typed via contracts.ts)
    changedFields: v.array(v.string()),
    origin: v.union(
      v.literal("initial"),
      v.literal("edit"),
      v.literal("regen"),
      v.literal("vibeSteer"),
    ),
    createdAt: v.number(),
  })
    .index("by_role_effectiveSeq", ["roleId", "effectiveSeq"])
    .index("by_scene", ["sceneId"]),

  participants: defineTable({
    // presence of a role in the scene (multi-human ready)
    sceneId: v.id("scenes"),
    roleId: v.id("roles"),
    userId: v.optional(v.id("users")), // N humans later = N rows
    seat: v.number(), // turn-order seat
    presence: v.union(v.literal("active"), v.literal("offstage")),
    joinedAtSeq: v.number(),
  })
    .index("by_scene_seat", ["sceneId", "seat"])
    .index("by_user", ["userId"]),

  branches: defineTable({
    sceneId: v.id("scenes"),
    label: v.string(), // auto: "Main", "Alternate · beat 12", user renameable
    forkedFromBeatId: v.optional(v.id("beats")), // null = mainline
    forkedFromBranchId: v.optional(v.id("branches")),
    forkReason: v.optional(
      v.union(
        v.literal("pick"),
        v.literal("edit"),
        v.literal("regenerate"),
        v.literal("rewrite"),
        v.literal("steerFork"),
      ),
    ),
    createdByUserId: v.id("users"),
    colorIndex: v.number(), // stable accent for gutter/map
    tipBeatId: v.optional(v.id("beats")),
    createdAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_fork", ["sceneId", "forkedFromBeatId"]),

  beats: defineTable({
    sceneId: v.id("scenes"),
    branchId: v.id("branches"),
    parentBeatId: v.optional(v.id("beats")), // null = opener/root
    seq: v.number(), // scene-monotonic; stable ordering + gutter mapping
    depth: v.number(),
    speakerRoleId: v.optional(v.id("roles")), // null = pure narration
    origin: v.union(
      v.literal("opening"),
      v.literal("turn"),
      v.literal("option"),
      v.literal("userInsert"),
      v.literal("edit"),
      v.literal("regenerate"),
    ),
    status: v.union(
      v.literal("streaming"),
      v.literal("finished"),
      v.literal("failed"),
      v.literal("aborted"),
    ),
    isArtifact: v.boolean(), // aborted/discarded generation: stored, not canon
    text: v.string(),
    streamMessageId: v.optional(v.string()), // Agent component message id (transport only)
    renderedBlocks: v.optional(v.array(v.object({ kind: v.string(), text: v.string() }))),
    editedFromBeatId: v.optional(v.id("beats")),
    regenerateOfBeatId: v.optional(v.id("beats")),
    promptSnapshotId: v.optional(v.id("promptSnapshots")),
    model: v.optional(v.string()),
    tokensIn: v.optional(v.number()),
    tokensOut: v.optional(v.number()),
    costEstimateUsd: v.optional(v.number()),
    isPinned: v.boolean(),
    runId: v.optional(v.id("generationRuns")),
    createdAt: v.number(),
  })
    .index("by_scene_seq", ["sceneId", "seq"])
    .index("by_branch_seq", ["branchId", "seq"])
    .index("by_parent", ["parentBeatId"])
    .index("by_run", ["runId"]),

  candidates: defineTable({
    // path options; ghosts persist forever
    sceneId: v.id("scenes"),
    parentBeatId: v.id("beats"),
    branchId: v.id("branches"), // context in which the option was offered
    optionIndex: v.number(),
    label: v.string(), // 2–4 words
    speakerRoleId: v.optional(v.id("roles")),
    text: v.string(),
    strategy: v.string(), // escalate|de-escalate|reveal|conceal|ally|confront|commit|deflect
    status: v.union(v.literal("offered"), v.literal("picked"), v.literal("dismissed")),
    pickedBeatId: v.optional(v.id("beats")),
    promptSnapshotId: v.optional(v.id("promptSnapshots")),
    createdAt: v.number(),
  })
    .index("by_parent_status", ["parentBeatId", "status"])
    .index("by_scene_status", ["sceneId", "status"]),

  facts: defineTable({
    // append-only canon ledger
    sceneId: v.id("scenes"),
    nodeId: v.id("beats"), // beat where introduced
    text: v.string(),
    subjects: v.array(v.id("roles")),
    visibility: v.object({
      kind: v.union(v.literal("public"), v.literal("private")), // v1 ships all-public; schema ready
      roleIds: v.array(v.id("roles")), // for private
    }),
    status: v.union(v.literal("active"), v.literal("muted")),
    isPinned: v.boolean(), // user "make canon" → treated as global (PLAN §6.3)
    source: v.union(v.literal("memory"), v.literal("user")),
    createdAt: v.number(),
  })
    .index("by_scene_status", ["sceneId", "status"])
    .index("by_scene_node", ["sceneId", "nodeId"]),

  summaries: defineTable({
    sceneId: v.id("scenes"),
    coveredFromSeq: v.number(),
    coveredThroughBeatId: v.id("beats"),
    coveredThroughSeq: v.number(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_scene_coveredThroughSeq", ["sceneId", "coveredThroughSeq"]),

  continuityWarnings: defineTable({
    sceneId: v.id("scenes"),
    beatId: v.id("beats"),
    text: v.string(),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(v.literal("open"), v.literal("dismissed")),
    createdAt: v.number(),
  }).index("by_scene_status", ["sceneId", "status"]),

  directorNotes: defineTable({
    // steering: steer | standing constraint | do-not
    sceneId: v.id("scenes"),
    kind: v.union(v.literal("steer"), v.literal("constraint"), v.literal("doNot")),
    text: v.string(),
    appliesFromSeq: v.number(),
    status: v.union(v.literal("active"), v.literal("resolved"), v.literal("expired")),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_scene_status", ["sceneId", "status"]),

  promptTemplates: defineTable({
    // versioned documents — never inline strings
    key: v.string(), // e.g. "contract.roleplay", "mode.turn", "meta.casting"
    version: v.number(),
    content: v.string(),
    vars: v.array(v.string()),
    isActive: v.boolean(),
    notes: v.string(),
    createdAt: v.number(),
  })
    .index("by_key_version", ["key", "version"])
    .index("by_key_active", ["key", "isActive"]),

  promptSnapshots: defineTable({
    // provenance: "why did it say that"
    sceneId: v.id("scenes"),
    mode: generationMode,
    beatId: v.optional(v.id("beats")),
    candidateId: v.optional(v.id("candidates")),
    roleId: v.optional(v.id("roles")),
    blocks: v.array(
      v.object({
        key: v.string(), // contract|identity|world|boundaries|memory|relations|director|mode
        templateKey: v.optional(v.string()),
        templateVersion: v.optional(v.number()),
        hash: v.string(),
        tokens: v.number(),
        chars: v.number(),
      }),
    ),
    model: v.object({ provider: v.string(), modelId: v.string(), params: v.any() }),
    tokenCounts: v.object({
      system: v.number(),
      context: v.number(),
      outputReserve: v.number(),
      total: v.number(),
    }),
    budget: v.object({
      contextWindow: v.number(),
      systemTargetPct: v.number(),
      overBudgetAction: v.optional(v.string()),
    }),
    createdAt: v.number(),
  })
    .index("by_beat", ["beatId"])
    .index("by_candidate", ["candidateId"])
    .index("by_scene_createdAt", ["sceneId", "createdAt"]),

  generationRuns: defineTable({
    // lifecycle, locks, retry, abort
    sceneId: v.id("scenes"),
    branchId: v.id("branches"),
    parentBeatId: v.optional(v.id("beats")),
    mode: generationMode,
    roleId: v.optional(v.id("roles")),
    candidateId: v.optional(v.id("candidates")),
    status: v.union(
      v.literal("running"),
      v.literal("done"),
      v.literal("aborted"),
      v.literal("failed"),
    ),
    abortRequested: v.boolean(),
    attempt: v.number(),
    error: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  })
    .index("by_scene_status", ["sceneId", "status"])
    .index("by_startedAt", ["startedAt"]), // watchdog cron

  actions: defineTable({
    // undo log; inverse ops for the reversibility law (L6)
    sceneId: v.id("scenes"),
    seq: v.number(),
    type: v.string(), // "pick" | "editFork" | "regenerate" | "retire" | "muteFact" | ...
    payload: v.any(),
    inverse: v.any(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    undoneAt: v.optional(v.number()),
  }).index("by_scene_seq", ["sceneId", "seq"]),

  shareLinks: defineTable({
    sceneId: v.id("scenes"),
    token: v.string(),
    permission: v.union(v.literal("viewer"), v.literal("director")),
    createdByUserId: v.id("users"),
    revokedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_scene", ["sceneId"]),

  usageEvents: defineTable({
    sceneId: v.id("scenes"),
    userId: v.optional(v.id("users")),
    tier: v.string(),
    provider: v.string(),
    modelId: v.string(),
    kind: generationMode,
    tokensIn: v.number(),
    tokensOut: v.number(),
    costEstimateUsd: v.number(),
    createdAt: v.number(),
  }).index("by_scene_createdAt", ["sceneId", "createdAt"]),

  sceneUsage: defineTable({
    // transactional rollup for the meter
    sceneId: v.id("scenes"),
    tokensIn: v.number(),
    tokensOut: v.number(),
    costEstimateUsd: v.number(),
    byTier: v.any(),
    updatedAt: v.number(),
  }).index("by_scene", ["sceneId"]),
});
