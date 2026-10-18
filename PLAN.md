# Fabula Product Build Plan (complete build: Horizon 1 through the final v2.0)

**Status:** Approved plan of record (pre-implementation)
**Target repo:** `~/projects/apps/fabula/`
**Product:** A realtime roleplay platform where the entire cast is AI and the human is the director. Onboarding → scene creation → cast generation → play → branching → archive/export.
**Scope:** the **entire product through the final, fully-featured release**, not just v1.0. v1.0 is Milestone 1 (Horizon 1, Phases 0 to 8). Horizons 2 to 3 (Phases 9 to 14) complete the app: multiple humans & spectators, secret knowledge, crowd casts, branch compare/merge, voice/TTS radio mode, community gallery & remixing, PWA, localization (§1.3, §12.11 to 12.12). Every Horizon-1 decision is made so Horizons 2 to 3 are **additive, not rewrites** (§5.4 future-proofing audit).
**Deployment:** Docker-first and **fully self-hostable**, the whole stack (self-hosted Convex backend included) runs from a single `docker compose up`; managed Convex Cloud is optional, never required; the only external dependencies are the AI provider APIs the operator configures (§15.4 to 15.7).

> This document is the single source of truth for the build. Every phase, sub-phase, test slate, agent brief, contract, and acceptance criterion lives here. Implementation must not start on a sub-phase until its inputs (frozen contracts) are in place and its tests-first list is written down. Horizon 1 is a complete product experience on its own, never a throwaway MVP, and Horizons 2 to 3 layer on top until §17.2, the final acceptance bar, is reached.

---

## 0. How to use this document

| Reader | Start at |
|---|---|
| Orchestrator agent (A0) | §12 (phases), §13 (agent operating model), §17 (acceptance) |
| Backend agent (A1) | §5 (schema), §6 (laws), §13.4 (API surface) |
| Generation agent (A2) | §7 (prompt architecture), §5, §13.4 |
| Memory/orchestration agent (A3) | §6, §8 (orchestration spec) |
| UI agents (A4, A7) | §9 (UX + wireflows), §13 (ownership matrix, fixtures mode) |
| QA agent (A8) | §11 (testing strategy), §17 (acceptance checklist) |
| Docs agent (A9) | §16 (deliverable docs) |
| Horizon 2 to 3 planning | §1.3 (north star), §5.4 (future-proofing audit), §12.11 to 12.12, §17.2, §19.2 to 19.3 |
| Ops / self-hosting | §15.4 to 15.7 (Docker, compose, runbook, parity law) |

Rules that apply to everyone:

1. **TDD is mandatory.** Each sub-phase lists a *test slate*, write those tests (red), implement (green), refactor. CI blocks merges without them.
2. **Contracts are frozen before parallel work.** §13.3 defines the freeze list. Changing a frozen contract requires an ADR in `docs/adr/` approved by A0.
3. **Ownership is file-scoped.** Only the owning agent edits a path (§13.2). Cross-path needs are raised to A0.
4. **Library rule (hard):** if a maintained library solves it, use it (§3). Deviations require one-sentence justification in the PR.
5. **Terminology is enforced.** UI says *scene, role/character, beat, path options, branch, floor*. The words *thread* and *agent* never appear in user-facing strings (lint test in §11.6).
6. **Horizons share the discipline.** H2/H3 phases (§12.11 to 12.12) repeat the same wave choreography and gates; contracts refreeze at each horizon kickoff.
7. **Self-host parity is a law.** Every feature must work on the self-hosted Docker Compose stack (self-hosted Convex included); the only permitted external dependencies are AI provider APIs (§15.7). CI enforces it.

---

## 1. Product definition & terminology

Fabula is not a chat box. It is a **director's console** for an all-AI cast:

- **Scene**, story container: premise, tone, cast, rules, one branch tree.
- **Role / Character**, an AI participant with a structured role card. ("Agent" in code, "role/character" in UI.)
- **Beat**, one narrative turn (single message or short burst).
- **Path options**, 2 to 4 AI-generated candidate continuations at a decision point. Picking one makes it canon.
- **Branch**, a divergent path. Created by picking alternates, editing, rewriting, or regenerating. Never destructive.
- **Floor**, who is currently generating/speaking.
- **Meta-agents**, non-speaking AI helpers: casting, director, memory. They never speak in-fiction.
- **Thread**, one Convex Agent thread per scene. **Implementation detail; never surfaced in UX.**

Three direction modes at any turn:

1. **Pick a path**, choose one of 2 to 4 AI candidate continuations.
2. **Steer**, out-of-character director note ("make her suspicious", "skip to the duel").
3. **Write in-character**, inject your own line as any participant.

### 1.1 Branch laws (enforced in code, documented in README, tested in CI)

| # | Law | Enforcement point |
|---|---|---|
| L1 | Candidates attach to a parent beat; picking one appends it and makes it canonical. | `candidates.pick` mutation |
| L2 | Picking at the active tip **extends** the current branch. | `applyPick` reducer |
| L3 | Picking a ghost candidate whose parent is *not* the active tip **forks** a new branch from that parent. | `applyPick` reducer |
| L4 | Editing, rewriting, or regenerating any past beat forks a new branch from its parent. The original is always preserved. | `applyEditFork`, `applyRegenerate` reducers |
| L5 | The active path defines memory/context. Switching branches recomputes context. Facts from other branches never leak in. | `projectPath()` + leak tests (§11.4) |
| L6 | Nothing is ever destroyed; everything is reversible. | No destructive mutations; `actions` log with inverse ops; soft states (`offstage`, `muted`, `artifact`) |

### 1.2 Baseline UX loop

Floor resolves → speaker streams into the scene → memory updates in background → at decision points, path options render as **inline cards under the active beat (never a modal)** → director acts (pick / steer / write / regenerate) → repeat.

### 1.3 The North Star, what the final app is (v2.0)

The final Fabula is the complete realization of the director's-console concept, delivered in three additive horizons:

| Horizon | Version | Theme | Phases | Headline features |
|---|---|---|---|---|
| H1 | **v1.0** | The Director's Chair | 0 to 8 | Everything in §10: full play loop, branching, memory, prompt inspector, sharing, archive/export |
| H2 | **v1.5** | The Living Room | 9 to 11 | Multiple humans co-playing the AI cast; spectators; characters with real secrets (private facts, whispers); casts up to 8 with crowd dynamics; compare & merge branches |
| H3 | **v2.0 final** | Voices & Community | 12 to 14 | Per-role voices + radio-mode playback + voice input; published scenes, gallery discovery, remix with attribution, moderation; PWA/offline reading, localization, spend center |

Principles that hold at every horizon:

1. **Additive only**. H2/H3 add tables/fields/surfaces; they never rewrite branch laws, projection, or the prompt compiler (§5.4 proves this line-by-line).
2. **v1.0 stands alone**, a complete, polished product, not an MVP stub.
3. **The final acceptance bar is §17.2**, reached only when the whole app, not just Milestone 1, passes.
4. **Self-hostable by default**, every horizon runs from the Docker Compose stack (self-hosted Convex included); only AI provider APIs are external (§15.7).

---

## 2. Architecture overview

```
┌──────────────────────── Next.js (App Router, TS strict) ────────────────────────┐
│  App shell: 3-pane desktop · 2-pane tablet · single-col mobile + bottom sheets  │
│  Thread (TanStack Virtual) · Cast · Inspector (memory, prompts, map, usage)     │
│  Command palette (cmdk) · Toasts (sonner) · URL state (nuqs) · zustand (UI only)│
│  Data: useQuery / useUIMessages({stream:true}) + syncStreams  ← Convex reactive │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ Convex client (websocket; optimistic; auto-reconnect)
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│                              Convex deployment (only backend)                    │
│  queries & mutations ─ schema/indexes ─ crons ─ scheduler                        │
│  actions: generation/*  ── Vercel AI SDK (streamText | generateObject)           │
│    ├─ Agent component: ONE thread per scene; role prompts compiled per call;     │
│    │  saveStreamDeltas → persisted deltas → survive reloads, all devices         │
│    ├─ ModelGateway (real | fake for tests/E2E; per-role model config)            │
│    ├─ PromptCompiler (pure, deterministic, golden-tested; templates in DB)       │
│    ├─ Memory projector (path-scoped facts + summaries; leak-tested)              │
│    └─ Orchestrator (floor, tiers, burst, director meta-agent, end detection)     │
│  file storage: avatars · usage ledger · promptSnapshots · action log             │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Deployment model (law):** the entire stack. Next.js app, **self-hosted Convex** (with its Postgres metadata store and S3-compatible object storage), dashboard, runs via Docker Compose on one machine or many. Managed Convex Cloud is drop-in optional, never required. The *only* external dependencies are AI provider APIs (LLM/STT/TTS/image) configured with the operator's own keys; because all model calls route through the provider-agnostic gateway, they can be pointed at self-hosted model servers (Ollama/vLLM) where practical. See §15.4 to 15.7.

Key invariants:

- **Beats are the source of truth.** The Agent component thread is the *transport* for streaming/resume, not the domain model. Prompt context is always compiled from `beats` filtered by the active path, never from raw thread history. This is what makes branch isolation provable.
- **All state realtime.** No REST CRUD, no polling, no custom websockets.
- **Every generation stores a prompt snapshot** (§7.5) → prompt inspector + reproducibility.

---

## 3. Stack & library decisions

### 3.1 Core stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript **strict** | SPA-feel shell, RSC where useful, typed end-to-end |
| Backend (only) | Convex, **self-hosted via Docker** or Convex Cloud (interchangeable) | Mandated; realtime subscriptions eliminate websocket layer; self-hosting keeps the whole stack in the operator's infra |
| Packaging & deployment | **Docker + Docker Compose** (multi-stage Next.js build; official `convex-backend` self-host images) | One-command self-host on a Linux VM; same compose topology for dev-parity, staging and self-hosted prod (§15) |
| AI runtime | Vercel AI SDK (`streamText`, `generateObject`) | Provider-agnostic; structured output; per-role models |
| Streaming + resume | `@convex-dev/agent` (threads, `saveStreamDeltas`, `useUIMessages({stream:true})`, `syncStreams`) | Deltas persisted & reactively queried → resume on reload/any device, no flicker |
| Auth | Convex Auth (anonymous → upgrade/claim) | No account wall before first scene; everything stays in Convex; fallback Clerk documented in ADR if anonymous-upgrade proves insufficient |
| Presence | `@convex-dev/presence` | Viewer badges, typing indicators on shared scenes |

### 3.2 Default library set (mandated)

| Concern | Library | Rationale |
|---|---|---|
| UI kit | Tailwind CSS + shadcn/ui (Radix) | Own the markup; accessible primitives for free |
| Icons | lucide-react | Consistent, tree-shakeable |
| Motion | motion (Framer Motion) | Layout/exit animations; `useReducedMotion` built in |
| Virtualized lists | TanStack Virtual | Thread with 1000+ beats at 60fps; dynamic row measurement |
| Markdown | react-markdown + remark-gfm + rehype-sanitize | Beat rendering; sanitize untrusted model text |
| Tree map | @xyflow/react (React Flow) + **@dagrejs/dagre** (added) | Graph view; dagre = maintained layout engine (never hand-roll) |
| Drag & reorder | **@dnd-kit** (added: used for cast reorder = spotlight priority) | Maintained DnD with keyboard support; never hand-roll |
| Command palette | cmdk | Powers ⌘K + mention autocomplete |
| Toasts | sonner | Retry/undo affordances |
| Forms + validation | react-hook-form + zod | Role card editor, scene settings, every AI output schema |
| URL state | nuqs | Wizard step, inspector tab, selected beat, shareable URLs |
| Ephemeral UI state | zustand | Pane layout, composer mode, autoscroll intent (Convex remains source of truth) |
| Dark mode | next-themes | Dark-first, light available |
| Testing | Vitest + Testing Library + Playwright (multi-context) + `convex-test` | §11 |
| Dates | date-fns | Timestamps in inspector/map metadata |

### 3.3 Model configuration (provider-agnostic)

`convex/lib/models.ts` maps **logical tiers → concrete provider/model**, env-overridable:

| Tier | Used by | Class (final pick verified in Phase 0; env-configured) |
|---|---|---|
| `spotlight` | Spotlight roles, options, casting | capable frontier model |
| `standard` | Supporting roles, field regen, sample lines | mid model |
| `cheap` | Director meta, memory agent, summaries, facts | fast/cheap model |

Per-role overrides live on the role card (`modelTier`, optional `temperature`). Pricing table in `convex/lib/pricing.ts` (per-1M-token, env JSON override) powers the usage meter; values are estimates, labeled as such in UI.

**H3 additions (at kickoff):** TTS + STT via provider SDKs behind the same gateway abstraction; playback uses native `HTMLAudioElement` in a small controlled component (no extra library needed, justified); captions reuse the markdown renderer.

---

## 4. Repository & file tree

```
fabula/
├─ PLAN.md                      # this document
├─ README.md                    # §16
├─ Dockerfile                   # Next.js app, multi-stage, standalone output
├─ docker-compose.yml           # self-host stack: app + convex-backend + dashboard
├─ docker-compose.dev.yml       # dev-parity overrides (hot reload, local ports)
├─ docker-compose.tls.yml       # optional Traefik TLS overlay for public deploys
├─ .dockerignore
├─ docker/
│  ├─ .env.example              # compose env (origins, instance secret, postgres, S3, AI keys)
│  ├─ traefik/traefik.yml       # Traefik static config for the TLS overlay
│  └─ README.md                 # self-host runbook (§15.6)
├─ package.json                 # pnpm
├─ next.config.ts               # code-split config (tree map dynamic import)
├─ tsconfig.json                # strict: true, noUncheckedIndexedAccess
├─ tailwind.config.ts  postcss.config.mjs
├─ vitest.config.ts  playwright.config.ts
├─ .env.example
├─ .github/workflows/ci.yml
├─ docs/
│  ├─ prompt-architecture.md    # §7 (kept in sync; PLAN.md is source)
│  ├─ orchestration.md          # §8
│  ├─ branch-and-memory.md      # §6
│  ├─ testing.md                # §11 protocol
│  ├─ acceptance-run.md         # filled in Phase 8
│  └─ adr/NNN-*.md              # contract deviations only
├─ convex/
│  ├─ convex.config.ts          # app.use(agent); app.use(presence)
│  ├─ schema.ts                 # §5
│  ├─ auth.ts  auth.config.ts
│  ├─ shared/
│  │  └─ contracts.ts           # zod: casting, options, summary, facts, director, enums (imported by app too)
│  ├─ lib/
│  │  ├─ path.ts                # ancestors(), projectPath(), revisionAt()
│  │  ├─ tokenBudget.ts         # estimator + compaction policy (§7.6)
│  │  ├─ models.ts  pricing.ts  gateway.ts  fakeGateway.ts
│  │  ├─ invariants.ts          # assertNoCycle, assertSingleActiveRun, ...
│  │  └─ ids.ts  time.ts
│  ├─ prompts/
│  │  ├─ registry.ts            # load/seed versioned templates; hash()
│  │  └─ seed.ts                # v1 template documents (data, not inline strings)
│  ├─ compiler/
│  │  ├─ blocks.ts              # block builders (contract, identity, world, boundaries, memory, relations, directorNotes, mode)
│  │  ├─ compileRolePrompt.ts   # → { system, messages, snapshot }
│  │  ├─ compileOptions.ts  compileSummary.ts  compileFacts.ts
│  │  ├─ compileCasting.ts  compileDirectorMeta.ts
│  │  └─ types.ts
│  ├─ domain/
│  │  ├─ applyPick.ts  applyEditFork.ts  applyRegenerate.ts   # pure branch laws (unit-tested)
│  │  └─ orchestrate.ts         # floor resolution + burst gate (pure core)
│  ├─ scenes.ts  cast.ts  branches.ts  beats.ts  candidates.ts
│  ├─ facts.ts  summaries.ts  directorNotes.ts  actions.ts
│  ├─ shares.ts  exportScene.ts  usage.ts  claim.ts
│  ├─ generation/
│  │  ├─ turn.ts  options.ts  casting.ts  memory.ts  directorMeta.ts
│  │  ├─ openingBeat.ts  sampleLine.ts  avatar.ts  regenerateBeat.ts
│  │  └─ runs.ts                # generationRuns lifecycle, abort, retry/backoff
│  ├─ crons.ts                  # watchdog: stalled runs, usage rollups, retention
│  └─ tests/                    # convex-test specs (see §11.3)
│     ├─ branchLaws.test.ts  projection.test.ts  leak.test.ts
│     ├─ orchestration.test.ts  runs.test.ts  shareAccess.test.ts
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx  providers.tsx  page.tsx            # onboarding / landing
│  │  ├─ new/page.tsx                                   # three doors entry
│  │  ├─ new/quick/page.tsx  new/wizard/page.tsx  new/templates/page.tsx
│  │  ├─ s/[sceneId]/page.tsx                           # play shell
│  │  ├─ s/[sceneId]/archive/page.tsx
│  │  ├─ share/[token]/page.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ ui/*                   # shadcn primitives
│  │  ├─ shell/*                # AppShell, ThreePane, BottomSheet, ReconnectBanner
│  │  ├─ onboarding/*           # ValueScreen, ClaimBanner
│  │  ├─ cast/*                 # AuditionGrid, RoleCard, RoleCardEditor, LockToggle,
│  │  │                         # VibeSteerBar, SampleLineSheet, CastSizeStepper, TierBadge
│  │  ├─ thread/*               # ThreadView, BeatRow, StreamingBeat, BranchGutter, JumpToLatest
│  │  ├─ options/*              # OptionCards, GhostCandidates
│  │  ├─ director/*             # DirectorBar, SteerComposer, FloorIndicator, MentionPopover, QueueMenu
│  │  ├─ inspector/*            # InspectorTabs, MemoryPanel, PromptInspector, UsageMeter, BranchMapView (lazy)
│  │  ├─ scenes/*               # SceneList, SceneCard, ShareDialog, ExportDialog
│  │  └─ cmdk/*                 # CommandMenu, ShortcutsDialog
│  ├─ hooks/                    # useSceneThread, useFloor, useOptimisticPick, useKeymap, useSessionClaim
│  ├─ stores/ui.ts              # zustand
│  ├─ lib/                      # convex client, cn, keymap registry, fixtures/, format
│  └─ styles/
├─ tests/                       # vitest unit + component tests
│  ├─ compiler/*.golden.test.ts  budget.test.ts  path.test.ts
│  ├─ contracts.test.ts  pricing.test.ts  export.test.ts
│  └─ components/*.test.tsx
├─ e2e/
│  ├─ quickstart.spec.ts  multi-device.spec.ts  resume.spec.ts
│  ├─ branch-edit-leak.spec.ts  six-role-tiers.spec.ts  share.spec.ts
│  ├─ failure-isolation.spec.ts  a11y.spec.ts  responsive.spec.ts
└─ scripts/
   ├─ seed-dev.ts  gen-fixtures.ts  check-terminology.ts
```

> **H2/H3 additions** (paths reserved; created at each horizon's kickoff): `convex/{seats,audience,voices,gallery,reports,analytics}.ts`, `convex/generation/audio.ts`, `src/components/{audience,audio}/**`, `src/i18n/**`, `public/manifest*`.

---

## 5. Data model (`convex/schema.ts`)

### 5.1 Schema listing (normative)

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// ---- shared value objects ----
export const storyRole = v.union(
  v.literal("protagonist"), v.literal("antagonist"), v.literal("foil"),
  v.literal("wildcard"), v.literal("support"),
);
export const tier = v.union(v.literal("spotlight"), v.literal("supporting"), v.literal("background"));
export const presentationStyle = v.union(v.literal("chat"), v.literal("script"), v.literal("novel"));
export const generationMode = v.union(
  v.literal("turn"), v.literal("options"), v.literal("summary"), v.literal("facts"),
  v.literal("casting"), v.literal("directorMeta"), v.literal("sampleLine"),
);

export default defineSchema({
  ...authTables,

  // Extends the Convex Auth users table.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    claimedFrom: v.optional(v.id("users")),   // anon → real account claim trail
  }).index("by_anonymous", ["isAnonymous"]),

  scenes: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    status: v.union(v.literal("draft"), v.literal("playing"), v.literal("paused"), v.literal("archived")),
    premise: v.string(),
    activeBranchId: v.optional(v.id("branches")),   // null before opener
    activeTipBeatId: v.optional(v.id("beats")),     // null before opener
    threadId: v.string(),                            // Agent component thread (impl detail)
    seqCounter: v.number(),                          // monotonic scene seq source
    endedAt: v.optional(v.number()),
  }).index("by_owner_updated", ["ownerId"]),

  sceneSettings: defineTable({
    sceneId: v.id("scenes"),
    genre: v.string(),
    settingEra: v.string(),
    presentationStyle,                              // chat | script | novel
    playLanguage: v.string(),                       // BCP-47-ish tag; prompts instruct output language
    tone: v.object({                                // dials in [-1, 1]
      comedicGrim: v.number(), groundedFantastical: v.number(), romanceRivalry: v.number(),
    }),
    boundaries: v.object({ allowed: v.array(v.string()), blocked: v.array(v.string()) }),
    turnRules: v.object({
      mode: v.union(v.literal("roundRobin"), v.literal("reactive"), v.literal("directorLed"), v.literal("freeform")),
      autoBurst: v.boolean(), burstMax: v.number(),
      abortedKeepsPartial: v.boolean(),
    }),
    branchFrequency: v.union(v.literal("always"), v.literal("key"), v.literal("onDemand")),
    optionsDefaultCount: v.number(),                // 2 to 4, default 3
    contextBeatsK: v.number(),                      // default 30 (verbatim window)
    summaryEveryN: v.number(),                      // default 6
    lengthTarget: v.union(v.literal("short"), v.literal("medium"), v.literal("long")),
    budget: v.object({ softUsdCap: v.optional(v.number()) }),
  }).index("by_scene", ["sceneId"]),

  roles: defineTable({
    sceneId: v.id("scenes"),
    kind: v.union(v.literal("ai"), v.literal("human")),   // human = the director playing a role
    userId: v.optional(v.id("users")),                    // set for human roles
    // ---- current role card (denormalized latest for fast reads) ----
    identity: v.object({
      name: v.string(), monogram: v.string(), ageEra: v.string(),
      pronouns: v.string(), occupation: v.string(),
      accentColor: v.string(),                            // token name, not raw hex
      avatarStorageId: v.optional(v.id("_storage")), avatarPrompt: v.optional(v.string()),
    }),
    hook: v.string(),
    psychology: v.object({
      traits: v.array(v.string()),
      dials: v.object({ warmth: v.number(), impulse: v.number(), guile: v.number(), optimism: v.number() }),
      flaws: v.array(v.string()), fears: v.array(v.string()),
      desires: v.array(v.string()), secret: v.string(),
    }),
    voice: v.object({
      register: v.string(), rhythm: v.string(), verbosity: v.string(),
      vocabularyNotes: v.string(), verbalTics: v.array(v.string()),
      sampleLines: v.array(v.string()),                  // cached per revision hash
      doNotSay: v.array(v.string()), narrationStyle: v.string(),
    }),
    drives: v.object({ publicGoal: v.string(), secretGoal: v.string(), stakes: v.string() }),
    boundariesLines: v.array(v.string()),                 // in-fiction lines this role won't cross
    relations: v.array(v.object({
      toRoleId: v.id("roles"),
      dynamic: v.union(v.literal("ally"), v.literal("rival"), v.literal("lover"),
        v.literal("mentor"), v.literal("enemy"), v.literal("family"), v.literal("stranger")),
      tension: v.number(), historyNote: v.string(), knowsAbout: v.string(),
    })),
    meta: v.object({
      storyRole, tier,
      modelTier: v.union(v.literal("spotlight"), v.literal("standard"), v.literal("cheap")),
      temperature: v.optional(v.number()),
    }),
    status: v.union(v.literal("active"), v.literal("offstage"), v.literal("retired")),
    statusChangedAtSeq: v.number(),                        // airtime math; never deleted
    sortKey: v.string(),                                   // reorder = spotlight priority
    draftLocks: v.array(v.string()),                       // field paths locked in the audition UI (pre-play only)
    currentRevisionId: v.optional(v.id("roleRevisions")),  // set once scene is playable
  })
    .index("by_scene_status_sort", ["sceneId", "status", "sortKey"])
    .index("by_scene", ["sceneId"]),

  roleRevisions: defineTable({                             // starts at play time; pre-play edits are drafts
    roleId: v.id("roles"),
    sceneId: v.id("scenes"),
    effectiveFromBeatId: v.optional(v.id("beats")),        // null = from scene start
    effectiveSeq: v.number(),                              // scene seq for cheap revisionAt()
    card: v.any(),                                         // frozen snapshot of the full role card (see note)
    changedFields: v.array(v.string()),
    origin: v.union(v.literal("initial"), v.literal("edit"), v.literal("regen"), v.literal("vibeSteer")),
    createdAt: v.number(),
  })
    .index("by_role_effectiveSeq", ["roleId", "effectiveSeq"])
    .index("by_scene", ["sceneId"]),

  participants: defineTable({                              // presence of a role in the scene (multi-human ready)
    sceneId: v.id("scenes"),
    roleId: v.id("roles"),
    userId: v.optional(v.id("users")),                     // set for human roles; N humans later = N rows
    seat: v.number(),                                      // turn-order seat
    presence: v.union(v.literal("active"), v.literal("offstage")),
    joinedAtSeq: v.number(),
  })
    .index("by_scene_seat", ["sceneId", "seat"])
    .index("by_user", ["userId"]),

  branches: defineTable({
    sceneId: v.id("scenes"),
    label: v.string(),                                     // auto: "Main", "Alternate · beat 12", user renameable
    forkedFromBeatId: v.optional(v.id("beats")),           // parent beat where divergence occurs; null = mainline
    forkedFromBranchId: v.optional(v.id("branches")),
    forkReason: v.optional(v.union(
      v.literal("pick"), v.literal("edit"), v.literal("regenerate"),
      v.literal("rewrite"), v.literal("steerFork"))),
    createdByUserId: v.id("users"),
    colorIndex: v.number(),                                // stable accent for gutter/map
    tipBeatId: v.optional(v.id("beats")),
    createdAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_fork", ["sceneId", "forkedFromBeatId"]),

  beats: defineTable({
    sceneId: v.id("scenes"),
    branchId: v.id("branches"),
    parentBeatId: v.optional(v.id("beats")),               // null = opener/root
    seq: v.number(),                                       // scene-monotonic; stable ordering + gutter mapping
    depth: v.number(),
    speakerRoleId: v.optional(v.id("roles")),              // null = pure narration
    origin: v.union(
      v.literal("opening"), v.literal("turn"), v.literal("option"),
      v.literal("userInsert"), v.literal("edit"), v.literal("regenerate")),
    status: v.union(
      v.literal("streaming"), v.literal("finished"), v.literal("failed"), v.literal("aborted")),
    isArtifact: v.boolean(),                               // aborted/discarded generation: stored, not canon
    text: v.string(),
    streamMessageId: v.optional(v.string()),               // Agent component message id (transport only)
    renderedBlocks: v.optional(v.array(v.object({ kind: v.string(), text: v.string() }))), // optional structured render
    editedFromBeatId: v.optional(v.id("beats")),
    regenerateOfBeatId: v.optional(v.id("beats")),
    promptSnapshotId: v.optional(v.id("promptSnapshots")),
    model: v.optional(v.string()),
    tokensIn: v.optional(v.number()), tokensOut: v.optional(v.number()),
    costEstimateUsd: v.optional(v.number()),
    isPinned: v.boolean(),
    runId: v.optional(v.id("generationRuns")),
    createdAt: v.number(),
  })
    .index("by_scene_seq", ["sceneId", "seq"])
    .index("by_branch_seq", ["branchId", "seq"])
    .index("by_parent", ["parentBeatId"])
    .index("by_run", ["runId"]),

  candidates: defineTable({                                // path options; ghosts persist forever
    sceneId: v.id("scenes"),
    parentBeatId: v.id("beats"),
    branchId: v.id("branches"),                            // context in which the option was offered
    optionIndex: v.number(),
    label: v.string(),                                     // 2 to 4 words
    speakerRoleId: v.optional(v.id("roles")),
    text: v.string(),
    strategy: v.string(),                                  // taxonomy: escalate|de-escalate|reveal|conceal|ally|confront|commit|deflect
    status: v.union(v.literal("offered"), v.literal("picked"), v.literal("dismissed")),
    pickedBeatId: v.optional(v.id("beats")),
    promptSnapshotId: v.optional(v.id("promptSnapshots")),
    createdAt: v.number(),
  })
    .index("by_parent_status", ["parentBeatId", "status"])
    .index("by_scene_status", ["sceneId", "status"]),

  facts: defineTable({                                     // append-only canon ledger
    sceneId: v.id("scenes"),
    nodeId: v.id("beats"),                                 // beat where introduced
    text: v.string(),
    subjects: v.array(v.id("roles")),
    visibility: v.object({
      kind: v.union(v.literal("public"), v.literal("private")),  // v1 ships all-public; schema ready
      roleIds: v.array(v.id("roles")),                            // for private
    }),
    status: v.union(v.literal("active"), v.literal("muted")),
    isPinned: v.boolean(),                                 // user "make canon" → treated as global (§6.3)
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

  directorNotes: defineTable({                             // steering: steer | standing constraint | do-not
    sceneId: v.id("scenes"),
    kind: v.union(v.literal("steer"), v.literal("constraint"), v.literal("doNot")),
    text: v.string(),
    appliesFromSeq: v.number(),
    status: v.union(v.literal("active"), v.literal("resolved"), v.literal("expired")),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_scene_status", ["sceneId", "status"]),

  promptTemplates: defineTable({                           // versioned documents, never inline strings
    key: v.string(),                                       // e.g. "contract.roleplay", "mode.turn", "meta.casting"
    version: v.number(),
    content: v.string(),
    vars: v.array(v.string()),
    isActive: v.boolean(),
    notes: v.string(),
    createdAt: v.number(),
  })
    .index("by_key_version", ["key", "version"])
    .index("by_key_active", ["key", "isActive"]),

  promptSnapshots: defineTable({                           // provenance: "why did it say that"
    sceneId: v.id("scenes"),
    mode: generationMode,
    beatId: v.optional(v.id("beats")),
    candidateId: v.optional(v.id("candidates")),
    roleId: v.optional(v.id("roles")),
    blocks: v.array(v.object({
      key: v.string(),                                     // contract|identity|world|boundaries|memory|relations|director|mode
      templateKey: v.optional(v.string()), templateVersion: v.optional(v.number()),
      hash: v.string(), tokens: v.number(), chars: v.number(),
    })),
    model: v.object({ provider: v.string(), modelId: v.string(), params: v.any() }),
    tokenCounts: v.object({ system: v.number(), context: v.number(), outputReserve: v.number(), total: v.number() }),
    budget: v.object({ contextWindow: v.number(), systemTargetPct: v.number(), overBudgetAction: v.optional(v.string()) }),
    createdAt: v.number(),
  })
    .index("by_beat", ["beatId"])
    .index("by_candidate", ["candidateId"])
    .index("by_scene_createdAt", ["sceneId", "createdAt"]),

  generationRuns: defineTable({                            // lifecycle, locks, retry, abort
    sceneId: v.id("scenes"),
    branchId: v.id("branches"),
    parentBeatId: v.optional(v.id("beats")),
    mode: generationMode,
    roleId: v.optional(v.id("roles")),
    candidateId: v.optional(v.id("candidates")),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("aborted"), v.literal("failed")),
    abortRequested: v.boolean(),
    attempt: v.number(),
    error: v.optional(v.string()),
    startedAt: v.number(), finishedAt: v.optional(v.number()),
  })
    .index("by_scene_status", ["sceneId", "status"])
    .index("by_startedAt", ["startedAt"]),                 // watchdog cron

  actions: defineTable({                                   // undo log; inverse ops for reversibility law
    sceneId: v.id("scenes"),
    seq: v.number(),
    type: v.string(),                                      // "pick" | "editFork" | "regenerate" | "retire" | "muteFact" | ...
    payload: v.any(),
    inverse: v.any(),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
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
    tier: v.string(), provider: v.string(), modelId: v.string(),
    kind: generationMode,
    tokensIn: v.number(), tokensOut: v.number(),
    costEstimateUsd: v.number(),
    createdAt: v.number(),
  }).index("by_scene_createdAt", ["sceneId", "createdAt"]),

  sceneUsage: defineTable({                                // transactional rollup for the meter
    sceneId: v.id("scenes"),
    tokensIn: v.number(), tokensOut: v.number(), costEstimateUsd: v.number(),
    byTier: v.any(),
    updatedAt: v.number(),
  }).index("by_scene", ["sceneId"]),
});
```

**Note on `roleRevisions.card`:** stored as `v.any()` at the table level but written/read exclusively through the zod `RoleCard` type in `convex/shared/contracts.ts`. Convex's validator can't express recursive-but-typed JSON ergonomically without enormous duplication. All reads go through typed helpers; a `contracts.test.ts` guarantees writer/reader agreement. (Justified deviation, logged as ADR-002.)

### 5.2 Index rationale (normative)

| Query need | Index | Why |
|---|---|---|
| Active-path beats, newest first, paginated | `beats.by_branch_seq` + `beats.by_parent` | Path walk via parent chain; branch listing for map |
| Thread render (scene-wide seq, stable order) | `beats.by_scene_seq` | Monotonic seq gives deterministic ordering across branches |
| Ghost options under a beat | `candidates.by_parent_status` | Fetch offered candidates per decision point |
| Path fact projection | `facts.by_scene_node` | Filter by `nodeId ∈ ancestors(tip)` |
| Summary projection | `summaries.by_scene_coveredThroughSeq` | Summary applies iff its end beat is on path |
| Revision at a beat | `roleRevisions.by_role_effectiveSeq` | `revisionAt(role, seq)` = latest revision ≤ seq |
| Run lock / watchdog | `generationRuns.by_scene_status`, `by_startedAt` | Single active run per scene; stall recovery |
| Inspector provenance | `promptSnapshots.by_beat` / `by_candidate` | One snapshot per generation |
| Access checks | `shareLinks.by_token` (unique-ish), `scenes.by_owner_updated` | Share route + dashboard |

**Path traversal:** `ancestors(tipBeatId)` walks `parentBeatId` upward (iterative, depth-bounded by scene length). `projectPath(sceneId, tipBeatId)` = `{ beatIds: Set<seq/ids>, facts, summaries }`. This single module is the *only* place path filtering happens, enabling the leak test (§11.4).

### 5.3 Invariants (asserted in `lib/invariants.ts` and tested)

1. At most one `generationRuns` row with `status=running` per scene.
2. `beats.seq` strictly increases per scene (`seqCounter` bump inside the creating mutation).
3. No cycles in `parentBeatId`; every beat's `parentBeatId` belongs to the same scene.
4. `scenes.activeTipBeatId` and `activeBranchId` are always consistent (tip's branch = active branch).
5. A candidate can be picked at most once; `pickedBeatId` is set exactly when `status=picked`.
6. `roles.currentRevisionId` exists iff the scene has an opener (play started).
7. Branch forks always reference an existing `forkedFromBeatId` in the same scene.

### 5.4 Future-proofing audit. Horizon 2 to 3 needs vs. today's model

Every final-product feature below is either **already supported** by the frozen schema or lands as **purely additive fields/tables** (no rewrites of §6 branch laws, §7 compiler, or §8 orchestration):

| Final-product feature | Supported now | Additively added later | Leak/law impact |
|---|---|---|---|
| Multiple humans (players) | `participants.userId` (N rows), seats, `roles.kind:"human"` | seat invite perms (`player`), human turn-handoff states | Floor resolver already speaker-agnostic; tests extended |
| Spectators | `shareLinks.permission:"viewer"`, presence component | spectator seat rows, reactions (optional) | Server-side filtering already enforced |
| Private facts / whispers | `facts.visibility{kind,roleIds}`; compiler filters per speaker | memory agent emits private facts; beat-level `visibility` | Leak suite extends to humans, same projection module |
| Crowd casts (7 to 8) | tiers incl. `background`; condensed prompt form | rotation policy presets, compaction tuning | No schema change |
| Compare & merge branches | full branch tree + `actions` log; `FABULA_FF_COMPARE` | compare UI; explicit audited `mergeFact` op (pin-like override) | Merge is an explicit override, documented like ADR-001 |
| Voice / TTS / radio mode | role `voice` block; gateway abstraction; file storage | beat fields `audioStatus/audioStorageId/voiceProfileHash`; voice profiles on role meta | Text path never blocked by audio (isolation rule) |
| Voice input (STT) | mutation surface unchanged | client capture → same steer/in-character mutations | None |
| Gallery / publish / remix | scenes/branches/beats are forkable; boundaries fields exist | `publishedScenes`, `reports`, moderation queue; fork-with-attribution | Remix **copies**; facts stay scene-scoped (permanent law §18.1) |
| PWA / offline reading | read-only archive queries | service-worker cache for archived read models | Realtime stays the live path, no offline editing (§18.1) |
| Localization | scene `playLanguage`; keymap registry | next-intl for UI chrome; RTL audit | Prompts already language-scoped |
| Spend center / analytics | `usageEvents` + `sceneUsage` + `actions` | account rollups, alerts, dashboards | None |

---

## 6. Branch laws & memory projection

### 6.1 Branch mutation semantics (pure reducers in `convex/domain/`, used by mutations)

```
applyPick(scene, candidate):
  parent = candidate.parentBeatId
  if parent == scene.activeTipBeatId:
      # L1 + L2, extend active branch (canon append)
      beat = createBeat(branch=scene.activeBranchId, parent=parent, origin="option")
  else:
      # L3, fork from parent
      branch = createBranch(forkedFromBeatId=parent,
                            forkedFromBranchId=candidate.branchId,
                            forkReason="pick")
      beat = createBeat(branch=branch, parent=parent, origin="option")
  candidate.status = "picked"; candidate.pickedBeatId = beat._id
  setActive(scene, branch=beat.branchId, tip=beat._id)
  logAction(inverse = { type: "setActive", branch, tip: parent })

applyEditFork(scene, beat, newText):
  # L4, never touched in place, always forks from the ORIGINAL's parent
  branch = createBranch(forkedFromBeatId=beat.parentBeatId, forkReason="edit")
  newBeat = createBeat(branch, parent=beat.parentBeatId, origin="edit",
                       editedFromBeatId=beat._id, text=newText)
  setActive(scene, branch, tip=newBeat)

applyRegenerate(scene, beat): same shape as applyEditFork, forkReason="regenerate",
                              origin="regenerate", regenerateOfBeatId=beat._id
```

Opening-beat edit/regenerate forks the root exactly the same way (mainline keeps the original opener).

### 6.2 Ghost candidates

Unpicked candidates stay `status=offered` forever ("ghost alternatives"). They render under their parent beat when the parent is on the active path, with a fork warning ("taking this will fork the story from beat N"). Picking a ghost much later executes L3.

### 6.3 Memory projection semantics (documented in README + docs/branch-and-memory.md)

- **Active path** = `ancestors(activeTipBeatId)` realized as a set of beat ids + seqs.
- **Facts** in context: `status=active` AND (`nodeId` on path) AND (visibility public OR caller is subject). Plus **global pins**: facts with `isPinned=true` are treated as scene-global canon regardless of path, this is an *explicit director override*, visually marked in the memory panel, and the leak test excludes only these explicitly-pinned rows (ADR-001). Muted facts never enter prompts.
- **Summaries** in context: summaries whose `coveredThroughBeatId` is on the path, most recent up to memory budget; older ones collapse into the next summary.
- **Switching branches** recomputes projection instantly; UI shows a "context updated" toast; nothing is re-generated retroactively.
- **Private knowledge (schema-ready, v1 public):** private facts compile only into prompts of subject roles; the role's own card `secret`/`secretGoal` is always visible to itself.

### 6.4 Leak test (CI-mandatory, §11.4)

Fixture: scene with branches A and B diverging at beat 3, each containing unique fact tokens (`FACT_A_9C1`, `FACT_B_44E`). For every mode (turn/options/summary/facts/director meta), compile prompts on A and assert: `FACT_B_44E` appears in zero blocks; and vice versa. Also per-role privacy: role X's private facts absent from role Y's compiled prompt. The same spec runs as an E2E on edit-fork (E2E-04).

---

## 7. Prompt architecture (the heart of role quality)

### 7.1 Compiler pipeline

```
compileRolePrompt(scene, roleAtSeq, tipBeatId, mode, runtimeInputs) →
  blocks = [
    contract, identity, world, boundaries, memory, relations, directorNotes, mode
  ] (fixed order)
  context = last K=sceneSettings.contextBeatsK beats on active path, visibility-filtered
  budget = fitToBudget(blocks, context, model, lengthTarget)   # §7.6
  system = render(blocks)
  messages = renderContext(context)
  snapshot = { blocks: hashes+tokens, model, params, tokenCounts, budget }
  return { system, messages, snapshot }
```

Properties: **pure** (no DB writes, no clock, no RNG), deterministic, server-side only, single module, golden-tested per mode. Template text is loaded from `promptTemplates` (versioned documents) and injected, the compiler contains zero prompt prose literals.

### 7.2 Block assembly (fixed order)

| # | Block | Contents | Template key | Compaction priority (lower = shrunk first) |
|---|---|---|---|---|
| 1 | Roleplay contract | Stay in character; never control others' choices/reactions/thoughts; no omniscience; never break character or mention being an AI; respect boundaries; continuity with facts ledger; leave hooks, don't resolve the whole scene in one beat. | `contract.roleplay` | never shrink |
| 2 | Identity & voice | From role card: identity, essence, psychology, voice, drives, boundaries. | `identity` | 5 |
| 3 | World & tone | Premise, genre, era, tone dials (rendered as prose), presentation style. | `world` | 4 |
| 4 | Content boundaries | Scene allowed/blocked + global; hard rules. | `boundaries` | never shrink |
| 5 | Story memory | Rolling summary + relevant facts (path-projected). | `memory` | 3 |
| 6 | Relationships present | Dynamic/tension/knows-about for each *present* participant. | `relations` | 4 |
| 7 | Director notes | Active steers, standing constraints, hard do-not list. | `directorNotes` | never shrink |
| 8 | Mode contract | Mode-specific task + output format (length target, narration vs speech per style). | `mode.turn` / `mode.options` / ... | never shrink |

### 7.3 Output contracts by mode (zod in `convex/shared/contracts.ts`)

**turn**, free text (streamed); formatted per presentation style:

| Style | Format contract | Length (medium default) |
|---|---|---|
| chat | `Name: text`; narration italic on its own lines | 40 to 120 words |
| script | `NAME` / parenthesized stage directions / dialogue lines | 60 to 160 words |
| novel | third-person limited past-tense prose, quoted dialogue, no name prefixes | 120 to 300 words |

No meta commentary. One beat = one character's turn (bursts chain multiple beats).

**options**, `generateObject`:

```ts
const PathOptionsSchema = z.object({
  options: z.array(z.object({
    label: z.string().min(2).max(4),            // words, enforced post-parse
    speakerRoleId: z.string(),
    text: z.string(),
    strategy: z.enum(["escalate","de-escalate","reveal","conceal","ally","confront","commit","deflect"]),
  })).min(2).max(4),
});
```

Default 3 (setting `optionsDefaultCount`). Validated: speakers must be active participants; strategies should span divergent quadrants (escalate/de-escalate, reveal/conceal, ally/confront); **≥1 option must change scene state** (strategy ∈ {escalate, reveal, confront, commit}). Violations → one repair pass; still invalid → deterministic fallback (speaker rotation, temperature-up retry).

**summary**, `{ summary: string, coveredFromSeq, coveredThroughSeq }`; concise, evidence-anchored, no speculation.

**facts**, `{ facts: [{ text, subjects: string[], visibility: "public"|"private", nodeId }] }`; deduped against existing ledger (cheap model dedupe pass + normalized-string fallback).

**casting**, full cast, per §7.4.

**directorMeta**, `{ decisionPoint: boolean, reason: string, responders: string[], pacingNote: string, endingSuggested: boolean }`.

**sampleLine**, 2 to 3 in-voice sample lines (standard tier; cached on the revision).

### 7.4 Casting agent contract

Per role: name, hook, story role, tier, psychology (traits, temperament dials, flaws, fears, desires, secret), voice (register, rhythm, verbosity, vocabulary notes, verbal tics, 2 sample lines, do-not-say list), goals (public + secret), boundaries, relationships to other roles, avatar prompt.

Cast-level constraints (checked **programmatically** after parse, not trusted from the model):

1. Relationship graph is connected (every role reachable via relations).
2. ≥1 alliance edge and ≥1 friction edge (tension ≥ 0.6).
3. Voice distinctness: pairwise sample-line/vocabulary token-overlap below threshold.
4. No two hooks with near-identical phrasing (normalized overlap < threshold).
5. Tier assignment obeys the sizing policy (§4 table): ≤4 → all spotlight; 5 to 6 → max 4 spotlight; 7+ → max 3 spotlight / 2 supporting / rest background.
6. Speakers in the requested cast size; roles include the human player's role if "you-in-scene" chosen (human role generated with the same schema).

Violations trigger up to 2 repair passes (model receives the violation list); residual violations surface as non-blocking warnings on the audition screen.

### 7.5 Meta-agents (never speak in-fiction; own versioned templates)

| Meta-agent | Purpose | Default tier | Template keys | Triggers |
|---|---|---|---|---|
| casting | cast gen, field/role/cast regen, vibe steers | spotlight (regen: standard) | `meta.casting`, `meta.fieldRegen`, `meta.castRegen` | Wizard/quick start, audition actions |
| director | pacing, floor ordering, decision-point detection, stall recovery, end-scene detection | cheap | `meta.director` | After each finished beat; on manual "Offer paths" |
| memory | summaries, fact extraction, continuity warnings | cheap | `mode.summary`, `mode.facts`, `meta.continuity` | Every N beats on active path (default 6) |

### 7.6 Token budget policy

- Target: **system ≤ 25% of usable context**; usable = `contextWindow - outputReserve - protocolOverhead`.
- When over budget, compaction order: **(1)** drop oldest context beats (never below 4), **(2)** compact memory (summaries + top-N facts by subject overlap & recency), **(3)** shrink world/relations/identity descriptions, **(4)** record `overBudgetAction` in the snapshot. **Never** shrink blocks 1, 4, 7, 8 (contract/boundaries/director/mode).
- If still over after (3): fail the generation cleanly (run `failed`, beat not created) and retry once with context halved. Never truncate silently.
- `lib/tokenBudget.ts` exposes `estimateTokens()` (provider tokenizer when available, chars/4 fallback) and `fitToBudget()`. Property test fuzzes block sizes to prove the never-exceed invariant and the never-shrink invariant.

### 7.7 Provenance & the prompt inspector

Every generation writes a `promptSnapshots` row (blocks with hashes + template key/version + tokens, model, params, token counts, budget). The inspector panel shows, for any beat or candidate: block-by-block compiled text, which template version produced it, token counts, and over-budget actions. Editing a template creates a new version; old snapshots remain reproducible.

### 7.8 Template versioning

- Templates are DB documents seeded by `convex/prompts/seed.ts` (idempotent by `key+version`). Active version per key via `by_key_active`.
- Any prose change = new version (never edit in place). Golden snapshots act as a prompt-change review gate: updating them requires a PR note explaining the behavioral change.
- Scene-level pinning (optional, Phase 6+): a scene may pin template versions for reproducibility.

---

## 8. Orchestration spec

### 8.1 Floor resolution (pure core in `convex/domain/orchestrate.ts`)

Priority order:

1. **Forced mention**, user @mention always overrides everything.
2. **Director queue**, a queued speaker pops next.
3. **Turn mode:**
   - `roundRobin`, next active seat after last speaker (seat pointer stored on participant).
   - `reactive` (default), candidate responders = { roles addressed by name/@ in last beat } ∪ { facts' subjects introduced by last beat } ∪ { roles with tension ≥ 0.7 to last speaker }; dedupe; if empty → spotlight roles minus cooldown. Order decided by director meta-agent; **deterministic fallback** if the meta call fails: mention order → tension desc → round-robin.
   - `directorLed`, no auto floor; UI waits for queue/mention/in-character write.
   - `freeform`, no auto floor; director instructs explicitly (composer nudges "type a steer or @mention").
4. Tier behavior: `spotlight` full agent, default frequency; `supporting` appears in candidate set only when addressed/affected or every Nth beat; `background` reacts **only** when addressed or directly affected, and uses the `cheap` model tier with the lightweight prompt form (identity+voice condensed, no psychology section). Enforcement is in the responder filter, tested with the 6-role fixture.

### 8.2 Auto-burst

If `turnRules.autoBurst` and `consecutiveAiBeats < burstMax` and the director meta (or fallback heuristic: no decision point / no user-addressed mention) says continue → immediately resolve the next floor. Otherwise the floor returns to the director. The UI shows a burst counter ("2/3") in the floor indicator; any director action interrupts.

### 8.3 Decision points & options cadence

`branchFrequency` semantics:

| Setting | Options appear |
|---|---|
| `always` | After every finished AI beat (options generated automatically) |
| `key` (default) | Only when director meta-agent flags `decisionPoint=true` (threshold on confidence/reason) |
| `onDemand` | Never automatically; the "Offer paths" button/shortcut generates them at the current tip |

Options generate **in parallel** (default 3, configurable 2 to 4). While generating, inline skeleton cards render; failures drop that option silently if ≥2 succeed, else the whole batch retries once then shows an inline retry.

### 8.4 Director's chair controls, semantics

| Control | Backend | Notes |
|---|---|---|
| Pause/resume | `scenes.status` toggle | Pause = no auto-floor; direct actions still allowed |
| Steal floor | abort current run (keep/discard per setting) | Partial → artifact beat (§8.5) |
| Queue role | `directorQueue` on scene (or run lock payload) | Popped by floor resolver |
| @mention force | same as queue with priority 1 | |
| Retry / regenerate | `applyRegenerate` fork | Original preserved |
| Edit any beat | `applyEditFork` fork | Confirm dialog communicates the fork |
| Undo | `actions.undoLast` → inverse op | Covers pick, edit-fork, regenerate, retire/restore, mute/unmute, pin/unpin |
| Pin beat | `beats.isPinned` | Pinned beats always in verbatim context window; UI badge |
| Pin/mute fact | `facts.isPinned/status` | Pin = global canon override (§6.3) |
| Eject/retire role | `roles.status=offstage/retired` + audit | Never deleted; restore anytime |
| End scene | `scenes.status=archived` + `endedAt` | Freezes tree; archive view |

### 8.5 Abort, failure & artifacts

- Abort (`⌘.` or button) sets `runs.abortRequested`; stream aborts; partial text handling per `abortedKeepsPartial`:
  - **keep** → partial becomes a `finished` beat (canon).
  - **discard** → partial is stored as **artifact beat** (`isArtifact=true`, `status=aborted`) hanging off the same parent, *not* on the active path. Nothing is destroyed; a later "keep this attempt" action canonizes it via the normal pick/fork path.
- Failures: beat is created as `status=streaming` only after the first delta arrives; if the run fails before that, **no beat row exists** (tree never corrupted). If it fails mid-stream, beat → `failed`, UI offers retry (regenerate fork) and "keep partial" (artifact policy).
- Retries: exponential backoff (3 attempts, 0.5s/2s/8s) inside the action; watchdog cron fails stale `running` rows > 3 min and surfaces retry UI.

### 8.6 Stall recovery & end detection

- Stall (3 consecutive canon beats with zero fact delta and no picked options): director meta proposes an escalation steer chip ("raise the stakes") or generates options regardless of cadence setting; UI surfaces it non-modally.
- End detection: `endingSuggested=true` in ≥2 consecutive meta results or explicit resolution cues; UI offers "Wrap scene" (never auto-archives). Wrapping runs a final summary pass.

### 8.7 Concurrency & multi-device

- One active run per scene (enforced by `invariants.assertSingleActiveRun` in `runs.ts`). Picking while a run is active aborts it first (per setting), deterministic, logged.
- All client mutations are optimistic where safe (pick, steer, pin, mute) with server reconciliation via reactive queries. Two contexts see the same state in the same tick (§11.5 E2E-02).
- Share-director links: control actions allowed but serialized by the run lock; presence badges show who is directing. v1 advisory single-writer; conflicts are last-writer-wins on notes, blocked on runs.

---

## 9. UX specification & wireflows

### 9.1 Information architecture (routes)

| Route | Purpose |
|---|---|
| `/` | Value-first onboarding (one screen, concept + CTA). No account wall. |
| `/new` | Three doors: quick start · guided wizard · templates |
| `/new/quick` | One-liner → cast+opener generation → audition-lite → play (≤3 screens total) |
| `/new/wizard` | Stepped wizard (nuqs step state): premise → world & tone → you-in-scene → cast size → generate → audition |
| `/new/templates` | Genre preset gallery (seeds premise + cast skeleton + tone) |
| `/s/[sceneId]` | Play shell (three panes; panels via nuqs: `?inspector=memory|prompts|map|usage&beat=…`) |
| `/s/[sceneId]/archive` | Read-only replay, branch explorer, export |
| `/share/[token]` | Viewer (read-only live) or director (controls) shared view |

### 9.2 Wireflow A, entry & three doors

```
 [ / ] Value screen ──"Start a scene"──▶ [ /new ]
                                         │
        ┌────────────────────────────────┼───────────────────────────────┐
        ▼                                ▼                               ▼
  ┌───────────┐                   ┌─────────────┐                ┌──────────────┐
  │ Quick     │                   │ Guided      │                │ Templates    │
  │ start     │                   │ wizard      │                │ gallery      │
  │ one-line  │                   │ 4 steps     │                │ (noir, court,│
  │ premise   │                   │ + cast size │                │ space crew…) │
  └─────┬─────┘                   └──────┬──────┘                └──────┬───────┘
        │                                │                              │
        └──────────────► generation ◄────┴──────── preseeded ───────────┘
                    (progressive cast reveal)
                             │
                             ▼
                      [ Audition grid ] ──"Start scene"──▶ first beat (opening) ──▶ PLAY
```

### 9.3 Wireflow B, quick start (≤3 screens, E2E-01)

```
 Screen 1: /new/quick
┌─────────────────────────────────────────────────────┐
│ Fabula                          [◐ theme] [→ wizard] │
│                                                      │
│  Give me one line. I'll cast it and start the scene. │
│  ┌────────────────────────────────────────────────┐  │
│  │ A debt collector knocks on the wrong door in   │  │
│  │ 1970s Saigon.                                  │  │
│  └────────────────────────────────────────────────┘  │
│  tone: [comedic ◉────○ grim]  [grounded ◉─○ fantast] │
│  I'll play:  ( ) a role   (◉) director from the wings│
│      [✨ Cast & play →]     [more options ▾]          │
└─────────────────────────────────────────────────────┘
 Screen 2: /new/quick (generation → audition-lite)
┌─────────────────────────────────────────────────────┐
│ ✦ Casting…  [▓▓▓░░░]  premise ✓ · cast ✓ · opener ✓ │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│ │ ▨ avatar   │ │ ▨ avatar   │ │ ▨ avatar   │         │
│ │ Linh       │ │ Mr. Đức    │ │ The Widow  │         │
│ │ protagonist│ │ foil       │ │ wildcard   │         │
│ │ hook…      │ │ hook…      │ │ hook…      │         │
│ │ [✎ edit ▾] │ │ [✎ edit ▾] │ │ [✎ edit ▾] │         │
│ └────────────┘ └────────────┘ └────────────┘         │
│ Opening beat (editable, ▾ regenerate / ✍ write mine) │
│ ────────────────────────────────────────────────     │
│ "The rain hadn't stopped for three days when…"       │
│                        [ Start scene →  (3/3) ]      │
└─────────────────────────────────────────────────────┘
 Screen 3: /s/[id] play shell, opening beat live, floor indicator spinning up.
```

Field-level edits from Screen 2 open the full audition grid (still the same route family; "Start scene" returns to play). Screen counting for E2E-01: navigation events to a rendered thread ≤ 3.

### 9.4 Wireflow C, guided wizard steps (nuqs `?step=`)

```
 1 premise       2 world & tone       3 you-in-scene       4 cast size
┌───────────┐   ┌───────────────┐   ┌────────────────┐   ┌────────────────┐
│ premise   │   │ genre, era,   │   │ (◉) I play a   │   │ 2 [3] 4  5   8 │
│ inputs +  │   │ tone dials,   │   │ role → opens   │   │ 2 to 4 recommend. │
│ "expand   │   │ presentation  │   │ role editor    │   │ ≥5 → explain:  │
│ with AI"  │   │ style, lang,  │   │ ( ) director   │   │ turn mode +    │
│           │   │ boundaries    │   │ from the wings │   │ idle roles     │
└─────┬─────┘   └───────┬───────┘   └───────┬────────┘   └───────┬────────┘
      └───────────────┬─┴───────────────────┴────────────────────┘
                      ▼  [✨ Generate cast] → progress → Audition (§9.5) → Opener → PLAY
```

"You-in-scene" selection: generate the human role with the casting agent, then open the **same role editor** (same component as AI roles, `kind=human`); or choose director-from-the-wings (no in-fiction presence; the composer still allows in-character writes as *any* role).

### 9.5 Wireflow D, the audition (review) screen, the delight surface

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ✦ The Glass Harbor · cast 4        [ Vibe steer: ________________ ✨ Apply ] │
│  "make the whole cast younger"  ·  respects 🔒 · regenerates whole cast      │
├────────────────────┬────────────────────┬────────────────────┬───────────────┤
│ ⭐ Linh            │ Đức                │ The Widow          │ ◎ You (human) │
│ ┌──────┐  [⇄ drag]│ ┌──────┐           │ ┌──────┐           │ ┌──────┐      │
│ │avatar│          │ │avatar│           │ │avatar│           │ │avatar│      │
│ │ ▨→🖼 │ async    │ └──────┘           │ └──────┘           │ └──────┘      │
│ └──────┘          │                    │                    │               │
│ protagonist ⭐     │ foil               │ wildcard           │ protagonist   │
│ hook      [✎][🔒] │ hook      [✎][🔒] │ hook      [✎][🔒] │ hook   [✎]    │
│ traits    [✎][🔒] │ traits    [✎][🔒] │ traits    [✎][🔒] │ …             │
│ voice     [✎][🔒] │ voice     [✎][🔒] │ voice     [✎][🔒] │               │
│ goals     [✎][🔒] │ goals     [✎][🔒] │ goals     [✎][🔒] │               │
│ secret    [✎][🔒] │ secret    [✎][🔒] │ secret    [✎][🔒] │               │
│ relations ▾       │ relations ▾        │ relations ▾        │               │
│ [▶ sample line]   │ [▶ sample line]    │ [▶ sample line]    │               │
│ [↻ role][⧉ dup]   │ [↻ role][⧉ dup]    │ [↻ role][⧉ dup]    │               │
│ [🗑 off-stage]    │ [🗑 off-stage]     │ [🗑 off-stage]     │               │
├────────────────────┴────────────────────┴────────────────────┴───────────────┤
│  Cast size:  ◂ 4 ▸   2 to 4 recommended · 5+ needs strict turn mode (learn more) │
│  [+ blank role]  [⧉ duplicate]  [↻ regenerate cast 🔒 respects locks]        │
│                                          [ Generate opening beat →  ]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

Behavior spec:

| Element | Behavior |
|---|---|
| Inline field edit | Click ✎ → field becomes RHF+zod input; save = pre-play draft update (no revision until play starts) |
| 🔒 lock | Field excluded from `fieldRegen/roleRegen/castRegen` payloads; locks persist in `roles.draftLocks` |
| ↻ field/role/cast | Calls respective casting action with locks + vibe steer; progressive skeletons; other cards stay interactive |
| Vibe steer | Free text → casting instructions; "Apply" regenerates whole cast respecting 🔒; diff badges show changed cards |
| ⧉ duplicate | Copy role as a base (new name suffix), relations cloned without self-reference |
| + blank role | Empty card with defaults; every field editable |
| 🗑 off-stage | Soft state (`status=offstage`); card collapses with "restore" affordance |
| ⇄ drag reorder | @dnd-kit; order = spotlight priority (seat order derives from it) |
| ▶ sample line | `sampleLine` action (standard tier) → bottom sheet (mobile) / popover (desktop); cached per revision hash |
| Avatar | Placeholder = deterministic gradient + monogram, rendered immediately; image gen runs async, crossfades on arrival; **never blocks** |
| Cast size stepper | 1 to 8; hint "2 to 4 recommended"; ≥5 shows inline explanation (turn throughput, idle roles, cost), never a modal |
| Start / generate opener | Generates opening beat (editable / regenerable / "write the opener yourself") → transitions to play |

**Three doors mapping:** Quick start = Screen 1 → Screen 2 (generation + audition-lite). Guided = wizard steps then the same audition. Templates = preseeded then the same audition. All doors converge on **one** audition component.

### 9.6 The play loop (wireflow E, condensed)

```
 Floor resolves ──▶ speaker streams into active beat ──▶ memory updates (background)
        ▲                                                   │
        │                                  decision point?  │
        │                                       ├─ yes → ghost/option cards render INLINE
        │                                       └─ no  → floor indicator shows next
        │                                                   ▼
        └──────────── director acts: pick ▪ steer ▪ write in-character ▪ regenerate
                           (composer with 3 modes; ⌥1-4 picks; ⌘. aborts)
```

- Option cards: inline under the active beat; each shows speaker avatar, 2 to 4-word label, text preview, strategy chip; expanding shows full text. Picked cards become canon beats; unpicked become ghosts (fork warning on later pick).
- Steer composer modes (segmented control): **Steer** (OOC note) · **In-character** (role selector + input) · comment-style quick chips ("faster pace", "raise stakes").
- Floor indicator: avatar + name + "speaking…" / "next" + burst counter + abort/pause/skip.

### 9.7 Responsive layout matrix

| Class | Layout | Panels |
|---|---|---|
| Phone portrait ≤ 480px | Single column thread; options and role cards in **bottom sheets**; thumb-zone action bar; safe-area insets; swipe right on beat → actions | Inspector = full-screen sheet |
| Phone landscape / foldable 481 to 768px | Dense single column, collapsible header | Inspector = side sheet |
| Tablet 769 to 1200px | Two panes: cast \| thread | Inspector slides over |
| Desktop ≥ 1201px | Three panes: scenes/cast · thread (max-width reading column ~72ch) · inspector (branch map, memory, prompts, usage tabs) | All inline |
| Ultrawide 21:9+ | Same three panes; thread column stays max-width, side panes absorb extra width | All inline |

Container queries for role cards and option cards (they appear in grids, sheets, and inspector). Every pane has designed loading/empty/error/offline/reconnecting states (§9.9).

### 9.8 Interaction craft inventory

- Optimistic updates: pick option, edit note, mute/pin fact, reorder roles, all paint immediately, reconcile via subscriptions.
- Skeletons for: cast generation, options, thread load, map load. Streaming caret with reduced-motion fallback (pulse → static).
- Smart autoscroll: stick-to-bottom when user is at bottom; otherwise show "Jump to latest" pill (⌘J).
- Undo toasts after every reversible action (sonner, with ⌘Z binding for last action).
- Reduced motion: all motion components check `useReducedMotion`; streaming caret respects it.
- Keyboard: §Appendix B keymap; visible focus rings everywhere; focus trap in all sheets/dialogs (Radix).

### 9.9 States catalog (each surface designs all five)

| Surface | Loading | Empty | Error | Offline | Reconnecting |
|---|---|---|---|---|---|
| Scene list | skeleton cards | "Create your first scene" (three doors CTA) | retry card | cached list + banner | banner |
| Audition | skeleton cast, per-card progressive | "add blank role" | per-field/card error + retry; cast-level retry banner | disable regen buttons | banner |
| Thread | beat skeletons + streaming | opener prompt | failed-beat inline retry; error boundary per row | banner + disabled composer actions that mutate server state | auto-resume banner; streaming resumes from persisted deltas |
| Options | inline skeletons | "Offer paths" button | inline retry | queued until reconnect | banner |
| Map / inspector | lazy skeleton | "no branches yet" | panel-level boundary | cached | banner |

### 9.10 Horizon 2 to 3 UX additions (planned; detailed in §12.11 to 12.12)

- **Seats strip** (H2): player avatars beside the floor indicator; "Your turn" wait state; pass/hand-off affordances; invite sheet.
- **Spectator shell** (H2): `/share/[token]` becomes a live watch view with presence, reactions off by default, and zero mutate affordances.
- **Privacy affordances** (H2): fact editor visibility toggle; whisper beats render collapsed as "only X can see this".
- **Compare view** (H2): two-column aligned branch reader with divergence markers; graduates `FABULA_FF_COMPARE` to default.
- **Audio rail** (H3): per-beat play buttons, radio-mode transport bar, per-role voice picker on the role card, captions toggle.
- **Gallery** (H3): `/gallery` discovery surface, publish dialog on the scene menu, remix banner with attribution.

---

## 10. Feature checklist. Milestone 1 · v1.0 (Horizon 1) → surfaces & phases

> The checklist for the **final** product (all horizons) is §17.2.

| Feature | Surface | Phase |
|---|---|---|
| Onboarding | `/` value screen, claim banner | 3, 4 |
| Scene setup (fields, you-choice) | `/new/wizard`, settings sheet | 4 |
| Cast wizard (three doors) | `/new*` | 4 |
| Locks, vibe steers, sample lines, async avatars | Audition | 4 |
| Role cards, versioning, tiers, off-stage/retire | Audition + inspector role sheet | 4, 6 |
| Presentation styles (chat/script/novel) | Renderer + compiler | 2, 5 |
| Turn orchestration + @mentions + auto-burst | Floor system | 2, 5 |
| Path options inline + ghosts | Thread | 5 |
| Branch tree map + switching | Inspector tab (lazy) | 6 |
| Branch gutter/minimap | Thread rail | 6 |
| Director's chair controls | DirectorBar + backend | 5 |
| Memory panel (pin/mute, summaries) | Inspector tab | 6 |
| Prompt inspector | Inspector tab | 6 |
| Usage meter | Inspector tab + wizard | 6 |
| Share links (viewer/director) | ShareDialog + `/share/[token]` | 7 |
| Export markdown/JSON | Archive + scene menu | 7 |
| Command palette + shortcuts | cmdk | 3, 5 |
| Realtime multi-device streaming + resume | platform-wide | 2, 5 |
| End detection + archive replay | Archive | 7 |

---

## 11. Testing strategy (TDD protocol)

### 11.1 Pyramid & tooling

| Layer | Tool | Scope |
|---|---|---|
| Pure unit | Vitest | reducers (branch laws), path projection, compiler goldens, budget, contracts/zod, pricing, exporters, keymap registry |
| Backend integration | `convex-test` + fake gateway | mutations/queries/actions, run lifecycle, access control, leaks, orchestration |
| Component | Vitest + Testing Library | audition interactions, option cards, composer modes, memory panel, palette |
| E2E | Playwright (multi-context, fake gateway, deterministic timing) | §11.5 scenarios |
| A11y | axe-core (Playwright) | keyboard walkthroughs, contrast, focus |

**Fake gateway** (`convex/lib/fakeGateway.ts`): deterministic canned streams (configurable token delay), scripted failures (500 / timeout / mid-stream drop), fixture casts. Enabled via env `FABULA_MODEL_FAKE=1`, the E2E suite never calls real models. Real-model smoke tests run nightly behind a flag.

### 11.2 TDD protocol per sub-phase

1. Write the test slate (listed in §12 per sub-phase), all red.
2. Implement minimum to green.
3. Refactor; keep goldens updated only with review note.
4. Coverage floors: ≥85% lines on `convex/compiler`, `convex/domain`, `convex/lib`, `convex/shared` (the correctness core). No global floor.

### 11.3 Backend integration suites (convex-test, mandatory)

- `branchLaws.test.ts`, extend-vs-fork matrix for pick/edit/regenerate incl. root-opener forks; originals preserved; invariants 1 to 7.
- `projection.test.ts`, path projection, summary collapse, private visibility per role, global pins.
- `leak.test.ts`, §6.4, all modes, both directions.
- `orchestration.test.ts`, floor priority, reactives, tiers (background speaks only when mentioned/affected), burst gate, stalls.
- `runs.test.ts`, single run lock, abort keep/discard→artifact, retries/backoff, watchdog.
- `shareAccess.test.ts`, viewer cannot mutate; director can; revocation; expired token.
- `usage.test.ts`, ledger → rollup math, pricing table application.
- `exportScene.test.ts`. JSON lossless for the tree; markdown structure snapshot.

### 11.4 Branch isolation leak test (the crown jewel)

Covered in §6.4. Two execution forms: pure/compiler test and convex-test integration; plus E2E-04. CI fails the build if any unpinned cross-path fact string appears in a compiled prompt. Ambiguity rule: only explicitly pinned global facts may cross paths (ADR-001).

### 11.5 Playwright scenarios (multi-context where noted)

| ID | Scenario | Assertions |
|---|---|---|
| E2E-01 | Quick start ≤3 screens | premise → audition → thread; ≤3 navigations to a rendered opening beat |
| E2E-02 | Two contexts (A/B), same scene | A picks an option → B sees canon beat < 1s without reload; both see ghost list consistent |
| E2E-03 | Reload mid-generation | start turn (fake gateway 50ms/token); reload at 40%; stream resumes; final text has no lost/duplicated tokens; caret state correct |
| E2E-04 | Edit past beat → fork + leak | edit beat 3 → branch created; original intact (map shows both); memory panel shows only active-path facts; switching back restores |
| E2E-05 | Six-role scene, tiers | background role does not speak unprompted; @mention makes it speak; burst respects `burstMax` |
| E2E-06 | Failure isolation | gateway 500 mid-scene → beat `failed`, tree intact, retry forks cleanly; abort → artifact, not canon |
| E2E-07 | Share links | viewer link sees live stream read-only, cannot mutate; director link can pick |
| E2E-08 | Responsive | 320px: bottom-sheet options; 1440px: three panes; keyboard-only walkthrough of pick/steer/mention |
| E2E-09 | Palette & shortcuts | ⌘K opens; ⌥1 to 4 picks; ⌘. aborts; shortcuts dialog lists all |

### 11.6 Terminology lint

`scripts/check-terminology.ts` greps user-facing strings (src/components, src/app, README excerpt) for forbidden UX words `thread`, `agent` (case-insensitive, allowlisted identifiers), fails CI. Keeps the product language honest.

### 11.7 Performance checks

- 60fps scroll trace on a 200-beat virtualized thread (Playwright + CDP trace assertion, generous threshold, regression-detecting).
- Route JS budgets: play route ≤ 250KB gz initial; tree map chunk loaded only on demand (bundle analyzer assertion in CI).
- Streaming: commit batched, no layout thrash; input latency target < 50ms.

---

## 12. Execution plan. Horizon 1 (Phases 0 to 8, v1.0) + Horizons 2 to 3 (§12.11 to 12.12)

Estimates are agent-days (assume one focused agent-day = a solid sub-agent work block). With the wave parallelism in §12.10, wall-clock ≈ 55 to 60% of the sum. Horizons 2 to 3 repeat the same discipline (spike → freeze → build → harden → accept) at their own kickoff.

### Phase 0 Foundation & contracts (Owner: A0 + A8; 4 to 6d)

| Sub | Task | Tests first |
|---|---|---|
| 0.1 | Scaffold: pnpm, Next 15 App Router, TS strict, Tailwind + shadcn init, Convex init (local deployment), vitest/RTL/convex-test/Playwright configs, ESLint/Prettier, CI skeleton | smoke: app renders `/`; `convex-test` harness runs a trivial query; CI green |
| 0.2 | Schema v1 (§5) + zod contracts (`convex/shared/contracts.ts`) + typed helpers | schema compiles; contracts round-trip fixtures; `contracts.test.ts` writer/reader agreement |
| 0.3 | ModelGateway interface + FakeGateway + model registry + pricing | fake streams deterministic chunks; failure modes scriptable; pricing unit tests |
| 0.4 | Prompt template registry + seed v1 templates as documents | seed idempotent by key+version; registry returns active version; hash stability test |
| 0.5 | **Library verification pass**: exact `@convex-dev/agent` API surface (streams/syncStreams/saveStreamDeltas), Convex Auth anonymous→claim, presence component, AI SDK structured-output capability per provider. Pin versions. ADRs for deviations | integration spike test: stream into thread + persist deltas + read via stream query |
| 0.6 | Fixtures generator (`gen-fixtures.ts`) for UI-first development | fixtures parse against contracts; `NEXT_PUBLIC_FIXTURES=1` renders shell with data |
| 0.7 | **Docker & self-host scaffold**: multi-stage Dockerfile (Next standalone), `docker-compose.yml` (app + self-hosted convex-backend + dashboard + postgres + S3-compatible store; healthchecks, volumes, pinned tags), `docker-compose.dev.yml`, compose env example, `scripts/selfhost-smoke.ts` | `docker compose up` on a clean checkout serves the app; backend healthy; smoke script signs in and creates a scene; CI `selfhost` job green |

**Gate G0:** `pnpm check` green (typecheck+lint+unit+convex-test), streaming spike proven, contracts frozen for Wave 1, `docker compose up` smoke green.

### Phase 1 Domain core & branch laws (Owner: A1; 5 to 7d)

| Sub | Task | Tests first |
|---|---|---|
| 1.1 | scenes + sceneSettings CRUD, ownership checks, status machine, seqCounter | CRUD tests; status transitions; ownership matrix |
| 1.2 | roles + revisions: draft (pre-play) vs versioned (post-play, `effectiveFromBeatId/Seq`), tiers, reorder, offstage/restore, draft locks, `revisionAt(role, seq)` | revisionAt matrix; draft-vs-versioned edit semantics; soft states never delete |
| 1.3 | branches + beats + candidates: pure reducers `applyPick/applyEditFork/applyRegenerate` + mutations; active pointers; ghosts; artifacts | branchLaws.test.ts (§11.3) full matrix |
| 1.4 | facts/summaries + `projectPath` + pin/mute + scope semantics | projection.test.ts; leak.test.ts (pure layer) |
| 1.5 | action log + undo inverses for all reversible ops | undo round-trip property tests; every logged type has a tested inverse |
| 1.6 | shareLinks + access checks (viewer/director) | shareAccess.test.ts |
| 1.7 | usage events + rollup (`sceneUsage`) | usage.test.ts |

**Gate G1:** branch laws + leak + access suites green; invariants asserted everywhere.

### Phase 2 Generation engine (Owner: A2 + A3; started Wave 1 for pure compiler; 8 to 10d)

| Sub | Task | Tests first |
|---|---|---|
| 2.1 | Prompt compiler: blocks, modes, snapshots; extract all prose into templates | golden snapshots per mode × presentation style; purity test (same input → byte-identical output) |
| 2.2 | Token budget: estimator + compaction policy | property tests: never exceed usable; never shrink blocks 1/4/7/8; overBudgetAction recorded |
| 2.3 | Turn action: thread wiring, `saveStreamDeltas`, beat lifecycle (streaming→finished), abort, crash recovery | runs.test.ts: streaming persistence with fake gateway; abort keep/discard→artifact; failure → no beat or failed beat |
| 2.4 | Options action: parallel generateObject ×3, validation, repair/fallback, candidate rows | fixture parse tests incl. invalid outputs; strategy divergence enforcement; ≥1 state-changing |
| 2.5 | Casting action: full cast, constraint checks + repair loops, field/role/cast regen w/ locks + vibe steer, human-role generation | constraint checker fixtures (violating casts); lock-respect tests; vibe-steer prompt snapshot test |
| 2.6 | Memory agent: summary every N, fact extraction + dedupe, continuity warnings; scheduled post-beat | summary/facts fixture tests; dedupe; scheduling thresholds; private visibility passthrough |
| 2.7 | Director meta: decision points, responder ordering, pacing, end detection, stall recovery + deterministic fallbacks | orchestration.test.ts incl. 6-role background-only-when-mentioned; fallback paths when meta fails |
| 2.8 | sampleLine + avatar actions (storage, placeholder policy) + opening beat action | sample line cached per revision hash; avatar never blocks (beat exists before image) |
| 2.9 | runs/watchdog/backoff hardening + snapshot writing everywhere | retry/backoff tests; stale-run cron test |

**Gate G2:** all backend suites green with fake gateway; every generation writes a snapshot; budget invariants proven.

### Phase 3 App shell & design system (Owner: A4; 4 to 5d)

| Sub | Task | Tests first |
|---|---|---|
| 3.1 | Theme: dark-first tokens, light mode, role accent palette with contrast pairs; typography scale (reading measure) | contrast token test (AA), theme switch test |
| 3.2 | Responsive shell: three/two/single pane, container queries, bottom sheets, safe-area, focus order + skip links | component tests for pane state; E2E-08 partial (layout) |
| 3.3 | shadcn primitives set + motion presets + reduced-motion variants | RTL: dialog/sheet focus trap; reduced-motion honored |
| 3.4 | States catalog components (§9.9) | snapshot/component tests per state component |
| 3.5 | Command palette + keymap registry + shortcuts dialog | palette filtering, keymap registry collision test |

**Gate G3:** shell navigable 320px→21:9, screenshots archived, keyboard-only pass.

### Phase 4 Cast generation UX (Owner: A5; 7 to 8d; starts Wave 2 against fixtures)

| Sub | Task | Tests first |
|---|---|---|
| 4.1 | `/` onboarding + `/new` three doors + template gallery + wizard steps (nuqs) | wizard step validation tests; template preseed applies tone+cast skeleton |
| 4.2 | Audition grid: cards, inline field edit, locks, per-field/role/cast regen wiring, diff badges | lock-respected payload tests; edit persists; regen keeps locks |
| 4.3 | Vibe steer bar + duplicate/add/off-stage/drag reorder (@dnd-kit, keyboard DnD) | dnd keyboard test; duplicate has no self-relation |
| 4.4 | Sample line sheet/popover + avatar async crossfade | placeholder < 100ms; crossfade on arrival; sample sheet focus trap |
| 4.5 | Cast size stepper + sizing hints + tier policy surfacing | stepper bounds; ≥5 inline explanation; tier defaults per size |
| 4.6 | Opening beat step (edit/regenerate/write-your-own) → play handoff | three opener paths each reach `/s/[id]` with beat |
| 4.7 | Quick-start flow integration | E2E-01 ≤3 screens |

**Gate G4:** E2E-01 green; audition keyboard-complete; generation failures leave the audition usable.

### Phase 5 Play loop (Owner: A6 + A3; 8 to 9d)

| Sub | Task | Tests first |
|---|---|---|
| 5.1 | Thread virtualization + BeatRow renderers (chat/script/novel) + accent borders + pinning | renderer goldens per style; 200-beat scroll perf trace |
| 5.2 | Streaming beat UI: caret, throttled aria-live, resume wiring (`useUIMessages stream:true` + `syncStreams` + beat status reconcile, dedupe by streamMessageId) | streaming→finished commit once; reload resume (E2E-03); no flicker reconciliation test |
| 5.3 | Floor UX: indicator, queue, @mention popover, steal floor, pause/resume, burst counter | mention override E2E path; pause blocks auto-floor |
| 5.4 | Option cards inline + ghosts + later-pick fork warning; "Offer paths" | pick optimistic→canonical; ghost pick forks (L3); cards never modal |
| 5.5 | Steer composer: three modes, chips, active notes, regenerate-from-note | mode switching; note chips create directorNotes; regenerate forks |
| 5.6 | DirectorBar: retry/regenerate/edit-fork(confirm)/undo/end scene | edit-fork confirm copy; undo restores prior active tip |
| 5.7 | Autoscroll + Jump to latest + connection banner | stick-to-bottom logic unit tests; E2E-02 two-context pick sync |

**Gate G5:** E2E-02/03 green; 60fps trace; streaming resume proven with no duplicates.

### Phase 6 Branch & meta surfaces (Owner: A6/A7 + A3; 6 to 8d)

| Sub | Task | Tests first |
|---|---|---|
| 6.1 | Branch gutter/minimap in thread (decision diamonds, active path highlight, click→switch/scroll) | gutter markers map to tree positions; click switches active |
| 6.2 | Tree map (@xyflow/react + dagre, lazy chunk): nodes=beats colored by branch, canon vs alternative edges, metadata side panel (who/how/when) | lazy-load assertion; keyboard navigation through nodes; metadata accuracy |
| 6.3 | Branch switching UX + "context updated" feedback + ghost list per decision point | switch recomputes projection (leak backend reused); toast/indicator |
| 6.4 | Compare two branches side-by-side (flag `FABULA_FF_COMPARE`) | aligned read-only render; no editing affordances |
| 6.5 | Memory panel: facts pin/mute, summaries, warnings, global-pin section visually distinct | pin/mute mutations; global pin cross-path warning copy |
| 6.6 | Prompt inspector: blocks, template versions, hashes, tokens, budget actions | inspector matches snapshot row for any beat/candidate |
| 6.7 | Usage meter: totals + per-tier, budget warnings | aggregation matches ledger; warning threshold |
| 6.8 | E2E-04 leak + fork integrity | as specified |

**Gate G6:** E2E-04 green; map lazy-loaded; inspector works for every generation type.

### Phase 7 Archive & share (Owner: A7; 4 to 5d)

| Sub | Task | Tests first |
|---|---|---|
| 7.1 | End detection surfacing + wrap flow + archive freeze + final summary | wrap offers (never auto); archived scenes immutable via mutations |
| 7.2 | Archive view: read-only replay + branch explorer | replay renders full tree; no mutate affordances |
| 7.3 | Export markdown + JSON (pure serializers) | golden markdown; JSON round-trip includes branches, candidates, facts, snapshots-optional |
| 7.4 | Share links: create/revoke, permissions, `/share/[token]`, presence badges | E2E-07; revoked/expired tokens 404; viewer can't mutate (server-side) |

**Gate G7:** E2E-07 green; exports open cleanly in a fresh browser tab and in `jq`.

### Phase 8 Hardening & acceptance (Owner: A0 + A8 + A9; 5 to 6d)

| Sub | Task | Tests first |
|---|---|---|
| 8.1 | Perf pass: memo boundaries, batching, code-split audit, route JS budgets | perf trace + bundle assertions (§11.7) |
| 8.2 | A11y audit WCAG 2.2 AA: axe E2E, keyboard walkthrough, contrast, aria-live throttling, focus mgmt | E2E-08/09 full; axe zero critical/serious |
| 8.3 | Resilience: error boundaries per surface, offline/reconnect UX, failure-injection sweep | E2E-06 expanded; offline toggle test |
| 8.4 | Cross-browser/device matrix + responsive polish | Playwright projects: chromium desktop, webkit mobile, firefox; 320→2560 widths |
| 8.5 | Docs: README, docs/*, ADR index, terminology lint | docs build/lint; terminology script green |
| 8.6 | Acceptance run: execute §17.1 checklist, capture evidence in `docs/acceptance-run.md` | all green; tag `v1.0.0` |
| 8.7 | **Self-host release drill**: fresh VM → `docker compose up` → full app; image upgrade + rollback drill; Postgres + object-store backup/restore; ops runbook completed | drill script green; §15.6 runbook complete |

**Gate G8 (Horizon 1 final):** §17.1 checklist fully checked with linked evidence + self-host drill green → tag `v1.0.0`. The product-final gate is §17.2 at H3.

### 12.10 Wave timeline (parallel execution)

```
Wave 0: [A0+A8  P0 foundation & contracts] ──────────────────────────► G0
Wave 1: [A1 P1 domain] [A2 2.1 to 2.2 compiler+budget] [A4 P3 shell] [A8 harness] ─► G1
Wave 2: [A1 P1 tail] [A2 2.3 to 2.9 engine] [A3 orchestration core] [A5 P4 cast UX (fixtures)] [A4 polish]
Wave 3: [A3 memory+director integration] [A5 P4 real-backend] [A6 P5 play loop] [A2 hardening] ─► G2, G4
Wave 4: [A6 A7 P6 branches+meta surfaces] [A3 leak/E2E support] [A7 P7 archive/share] ─► G6, G7
Wave 5: [A0+A8 P8 hardening] [A9 docs] [acceptance run] ─► G8 / v1.0.0
```

Dependency DAG (hard edges): G0 → everything; P1.3 → P1.4/1.5; 2.1 → 2.3+; 2.3 → P5.2; P1 → P4 real-backend swap; 2.6/2.7 → P5.3/5.4; P1.3 → P6; P5/P6 → E2E suite completion; all → P8.

### 12.11 Horizon 2, v1.5 "The Living Room" (Phases 9 to 11)

**Phase 9. Multi-human co-play & spectators** (Owner: A10 + A1/A3; 6 to 8d)

| Sub | Task | Tests first |
|---|---|---|
| 9.1 | Seats & invites: N human participants per scene, each bound to a role; new `player` share permission; host = owner; seat CRUD | permission matrix (owner/host/player/director/viewer); seat CRUD; human role uses the same role card editor |
| 9.2 | Human turn handoff: floor resolver lands on human seats like roles; "Your turn" wait state, pass, optional soft timer (off by default) | floor tests with human seats interleaved with AI burst; pass semantics; AI never speaks for a human seat |
| 9.3 | Per-player visibility: each human sees their role's private context; server-side filtering of private beats/facts per viewer | extended leak suite per player & spectator; no private text in payloads for unentitled sessions |
| 9.4 | Spectator mode: viewer links become live spectator seats; presence-rich; promote/demote player↔spectator by host | access matrix; live updates reach spectators; zero mutate affordances |
| 9.5 | Multi-director reconciliation: run-lock holder display, request-floor, soft takeover | two-director concurrency tests; serialized generations; lock state visible |

**Gate H2-9:** E2E-H2-01 covers a scene with 2 humans + 3 AI + 1 spectator; floors alternate correctly; the spectator sees live and cannot mutate; private notes never leak.

**Phase 10. Secret knowledge & crowd casts** (Owner: A1 + A3; 5 to 7d)

| Sub | Task | Tests first |
|---|---|---|
| 10.1 | Private facts end-to-end: memory agent emits `visibility`, fact editor UI, per-scope pin/mute | per-role private isolation across **all** modes (leak-suite extension) |
| 10.2 | Whisper beats: `visibility.roleIds` subsets; collapsed rendering for unentitled viewers; branch-law compatible (visibility ≠ branch) | render/filter tests; ghosts & forks preserve visibility |
| 10.3 | Crowd mode (7 to 8): spotlight-window policy (≤3 spotlight speakers per beat window), mentioned-only interjectors, aggressive compaction preset, cost guardrails | 8-role soak: no single role dominates; background = mentioned-only; budget invariants hold |
| 10.4 | Casting at capacity: constraint checks scaled for 8-role graphs; tier auto-assignment updated | 8-role casting fixtures; all §7.4 constraints hold |

**Gate H2-10:** 8-role crowd soak + secrets-never-leak suite green.

**Phase 11. Deep branching** (Owner: A6 + A7; 4 to 6d)

| Sub | Task | Tests first |
|---|---|---|
| 11.1 | Compare two branches side-by-side (graduate `FABULA_FF_COMPARE`): aligned columns, divergence marker, per-path fact diff | alignment/divergence tests; read-only review |
| 11.2 | Branch rename / annotate / bookmark; branch notes in map; text search across branches | metadata CRUD; map reflects; search |
| 11.3 | Director merge tool: explicitly bring a fact from branch B into branch A's canon (audited, undoable, marked "merged", a documented explicit override like ADR-001) | merge logged + inverse; leak suite updated with merge semantics (ADR-003) |
| 11.4 | Replay scrubber: scrub/step the active path with animated replay | perf on 200-beat scrub; reduced-motion variant |

**Gate H2-11:** compare + merge acceptance; leak suite green under merge semantics.

### 12.12 Horizon 3, v2.0 final "Voices & Community" (Phases 12 to 14)

**Phase 12. Voice & audio** (Owner: A11 + A2; 7 to 9d)

| Sub | Task | Tests first |
|---|---|---|
| 12.1 | Role voice profiles: voice id/style/pace on role meta; provider-agnostic TTS via the gateway; deterministic voice↔role mapping surviving revisions | profile CRUD; deterministic mapping; no voice drift across revisions |
| 12.2 | Beat audio pipeline: async TTS per finished beat → `audioStorageId`; additive beat fields; **audio failure never affects text**; regeneration on voice change is revision-aware; storage retention policy | async pipeline tests; failure isolation; retention cleanup |
| 12.3 | Playback UX: per-beat play; **Radio mode** (continuous scene playback incl. live new beats); per-role speed/pitch; synced captions | radio queue ordering under branching/switching; caption a11y; interruption semantics |
| 12.4 | Voice input (STT) for steers & in-character lines (flag-gated) | mocked STT; permission prompts; same mutation surface |

**Gate H3-12:** E2E-H3-01, radio mode plays a 20-beat scene continuously, voice stable across a branch switch; text path unaffected by audio failures.

**Phase 13. Community & gallery** (Owner: A12 + A1; 6 to 8d)

| Sub | Task | Tests first |
|---|---|---|
| 13.1 | Publish scenes/presets to a public gallery (premise, cast preview, first-beat excerpt); discovery feed by genre/tone | publish/unpublish; moderation flags required before listing |
| 13.2 | Remix/fork with attribution: clones premise+settings+cast skeleton (never play history); attribution chain preserved | fork tests: attribution; **no private data copied**; facts never shared across scenes (§18.1) |
| 13.3 | Public read scenes + SEO: OG cards, indexable read pages | OG metadata; read-only enforcement |
| 13.4 | Moderation: report button, review queue, takedown (removes from gallery, never from the owner's drive) | report flow; takedown scope tests |
| 13.5 | Director analytics (optional): per-scene stats, usage trends | aggregation correctness |

**Gate H3-13:** E2E-H3-02, publish → discover → remix → play; moderation takedown works.

**Phase 14. Platform completion** (Owner: A4 + A12; 5 to 7d)

| Sub | Task | Tests first |
|---|---|---|
| 14.1 | PWA: installable, offline **reading** of archived scenes (read-only cache) | install test; offline archive read; no offline editing (§18.1) |
| 14.2 | Localization: next-intl UI layer (scene play language already per-scene) + RTL audit | i18n routing; persistence; RTL layouts |
| 14.3 | A11y/perf regression sweep across new surfaces (audio rail, gallery, compare, seats) | axe + traces on each new surface |
| 14.4 | Spend center: per-scene & per-account budgets, alerts | aggregation + alert tests |
| 14.5 | Release: v2.0 docs, migration notes, acceptance run record | docs build; §17.2 evidence captured |

**Gate H3-14 (FINAL):** §17.2 fully green → tag `v2.0.0`. The app is complete.

**Horizon discipline:** each horizon repeats the wave choreography of §12.10 (spike → freeze contracts → parallel build → integration → hardening → acceptance). Horizons 2 to 3 kick off with their own mini-Phase-0 spikes listed in §19.2 to 19.3.

---

## 13. Sub-agent operating model

### 13.1 Agent roster

| ID | Agent | Mission |
|---|---|---|
| A0 | **Orchestrator / Architect** | Owns PLAN.md, contracts, ADR approvals, integration order, gates, final acceptance. Breaks ties. |
| A1 | **Backend Domain** | Schema, auth, scenes/cast/branches/beats/candidates/facts/shares/usage/actions; branch laws; invariants. |
| A2 | **Generation Engine** | Prompt compiler, templates, gateway, turn/options/casting/sample/avatar/opening actions, snapshots, budget, runs lifecycle. |
| A3 | **Memory & Orchestration** | Memory agent (summaries/facts/warnings), director meta-agent, floor/tiers/burst, stall/end detection, leak-suite co-ownership. |
| A4 | **Shell & Design System** | Theme, responsive shell, primitives, states catalog, palette + keymap, motion. |
| A5 | **Cast UX** | Onboarding, three doors, wizard, audition grid, locks/vibe/sample/avatars, opening beat, E2E-01. |
| A6 | **Play & Branch UX** | Thread, streaming UI, floor UI, options/ghosts, composer, director bar, gutter, tree map, switching, E2E-02/03/04/05 support. |
| A7 | **Meta Surfaces & Archive** | Memory panel, prompt inspector, usage meter, archive, export, share links/presence, E2E-07. |
| A8 | **QA / Test Infrastructure & Packaging** | Harness (convex-test, fake gateway, fixtures mode), E2E suite, leak enforcement, perf & a11y tooling, failure injection, Docker/self-host scaffolds & release drills. |
| A9 | **Docs & DX** | README, docs/*, env examples, scripts, terminology lint, ADR index, acceptance-run record. |
| A10 | **Multiplayer & Audience** (H2) | Seats, human turn handoff, spectators, per-player visibility, multi-director reconciliation. |
| A11 | **Voice & Audio** (H3) | TTS pipeline, voice profiles, radio mode, captions, STT input. |
| A12 | **Community & Platform** (H3) | Gallery/publish/remix, moderation, analytics, PWA, localization, spend center. |

### 13.2 Ownership matrix (only owner edits; others request via A0)

| Path | Owner |
|---|---|
| `convex/schema.ts`, `convex/lib/{path,invariants,ids,time}.ts`, `convex/domain/*`, `convex/{scenes,cast,branches,beats,candidates,facts,summaries,directorNotes,actions,shares,usage,claim}.ts`, `convex/exportScene.ts` | A1 |
| `convex/{compiler,prompts,generation}/**`, `convex/lib/{models,pricing,gateway,fakeGateway,tokenBudget}.ts`, `convex/shared/contracts.ts` | A2 |
| `convex/lib/orchestrate` core use, `convex/generation/{memory,directorMeta}.ts` | A3 (with A2 on shared files; A2 owns files, A3 owns modules listed) |
| `src/components/{ui,shell,onboarding,cmdk}`, `src/styles/**`, `src/stores/**`, `src/hooks/useKeymap.ts` | A4 |
| `src/app/{new/**}`, `src/components/cast/**`, `src/hooks/{useSessionClaim}.ts` | A5 |
| `src/app/s/[sceneId]/**`, `src/components/{thread,options,director}/**`, `src/hooks/{useSceneThread,useFloor,useOptimisticPick}.ts` | A6 |
| `src/components/{inspector,scenes}/**`, `src/app/share/**`, `src/app/s/[sceneId]/archive/**` | A7 |
| `tests/**`, `e2e/**`, `scripts/{gen-fixtures,check-terminology}.ts`, CI workflow | A8 |
| `Dockerfile`, `docker-compose*.yml`, `docker/**`, `scripts/selfhost-smoke.ts` | A8 |
| `README.md`, `docs/**`, `scripts/seed-dev.ts`, `scripts/check-terminology.ts` (shared w/ A8) | A9 |
| `convex/{seats,audience}.ts`, `src/components/audience/**` (H2; share surface evolves via A7 handoff at H2 kickoff) | A10 |
| `convex/{voices,generation/audio}.ts`, `src/components/audio/**` | A11 |
| `convex/{gallery,reports,analytics}.ts`, `src/i18n/**`, `public/manifest*` | A12 |
| `PLAN.md` | A0 |

### 13.3 Interface freeze checklist (locked at G0)

1. Schema tables/fields/index names per §5.
2. Zod contracts: `RoleCard`, `PathOptions`, `SummaryOut`, `FactsOut`, `DirectorMetaOut`, `CastingOut`, enums (§5.1 unions).
3. Convex API surface (names + args + returns) per §13.4 table.
4. Model registry keys + tier policy.
5. Prompt template keys/versions (v1 set).
6. Keymap action IDs (§Appendix B).
7. Fixtures shape == API return types (A8 generates from contracts).

### 13.4 Initial API surface (frozen at G0; owner in brackets)

**Queries:** `scenes.listMine` [A1] · `scenes.get` + `scenes.getWithSettings` [A1] · `cast.listRoles(sceneId, {includeOffstage})` [A1] · `beats.listPath(sceneId, pagination)` [A1] · `beats.getWithOptions(beatId)` [A1] · `beats.listPending(sceneId)` [A1] (Phase 5, ADR-005) · `candidates.listForBeat(beatId)` [A1] · `candidates.listForScene(sceneId)` [A1] (Phase 5, ADR-005) · `branches.list(sceneId)` + `branches.tree(sceneId)` [A1] · `facts.listForPath(sceneId)` + `facts.listForScene(sceneId)` [A1] (Phase 6, ADR-007) · `summaries.listForPath(sceneId)` [A1] · `warnings.listForScene(sceneId, includeDismissed?)` [A1] (Phase 6, ADR-007) · `directorNotes.listActive(sceneId)` [A1] · `shares.listForScene(sceneId)` + `shares.getByToken(token)` (live shape: pending/options/run/notes) [A1] (Phase 7, ADR-008) · `usage.getSceneUsage(sceneId)` [A1] · `generation.runs.active(sceneId)` [A2] (Phase 5, ADR-005) · `generation.snapshots.getForBeat(beatId)` / `getForCandidate(candidateId)` / `listForScene(sceneId, limit?)` [A2] (Phase 6, ADR-007) · `exportScene.getBundle(sceneId, {includeSnapshots?})` [A1] (Phase 7, ADR-008) · `thread.listMessages(sceneId, pagination, streamArgs, shareToken?)` [A2] (Phase 7, ADR-008) · `presence.heartbeat/list/disconnect` [A7] (Phase 7, ADR-008).

**Mutations:** `scenes.create/update/rename/setStatus(pause·resume)` [A1] · `scenes.endScene(sceneId)` (wrap: freeze + final summary + reversible) [A1] (Phase 7, ADR-008) · `cast.upsertDraftRole/updateDraft/reviseRole(effectiveFrom)/retire/restore/reorder/setTier/setLocks` [A1] · `candidates.pick(shareToken?)/dismiss` [A1] (Phase 7, ADR-008) · `beats.editFork/regenerateFork/pin/keepArtifact` [A1] · `branches.setActive/rename` [A1] · `directorNotes.add/resolve` [A1] · `facts.pin/mute/unmute/addUserFact` [A1] · `warnings.dismiss(warningId)` [A1] (Phase 6, ADR-007) · `actions.undoLast` [A1] · `shares.create/revoke` [A1] · `claim.claimScene` [A1] · `director.queueRole/forceMention/stealFloor` [A3].

All Phase 7 story mutations additionally pass `assertSceneMutable` (archived scenes are story-immutable; share/export/undo stay allowed. ADR-008).

**Actions:** `generation.startTurn/abort/retry` [A2] · `generation.offerOptions` [A2] · `generation.castDraft/regenField/regenRole/regenCast` [A2] · `generation.opening.draft` [A2] (Phase 4 audition preview, ADR-004) · `generation.regenerate.beat` [A2] (Phase 5 streamed fork, ADR-005) · `generation.sampleLine/avatar` [A2] · `generation.openingBeat` [A2] · internal scheduled: `generation.memoryPass` [A3], `generation.directorDecide` [A3] · crons: `crons.watchdog/rollups` [A2].

### 13.5 Handoff protocol (every agent, every task)

Report format (paste into session):

```
TASK: <sub-phase id + title>
STATUS: done | blocked | partial
FILES: <touched paths>
TESTS: <commands run + results>
EVIDENCE: <screenshots/traces/snapshots where relevant>
CONTRACT NOTES: <any frozen-contract friction → ADR request to A0>
NEXT: <suggested next sub-phase>
```

### 13.6 Conflict & integration rules

- Trunk-based; one branch per agent per sub-phase; PRs require: typecheck, lint, unit+convex-test, affected E2E; A8 reviews test quality; A0 merges.
- Feature flags (`FABULA_FF_COMPARE`, `FABULA_FF_PRESENCE`, `NEXT_PUBLIC_FIXTURES`) keep `main` demoable at all times.
- Any schema/contract change after G0: ADR + coordinated bump; never silent.
- UI agents consume only §13.4 names + `convex/shared/contracts.ts`; if a name is missing, request it, never invent a parallel API.

### 13.7 Agent briefing template (copy-paste to spawn a sub-agent)

```
You are agent <ID> (<Name>) on Fabula. Read ~/projects/apps/fabula/PLAN.md
sections: §<list>. Your owned paths: <from §13.2>. Frozen contracts you may
rely on: §13.3 to 13.4. Your assignment: Phase <n>, sub-phases <list>.

Work TDD: write the test slate first (listed in §12 for your sub-phase),
then implement to green, then refactor. Use only the libraries in §3.
Never edit files outside your owned paths; request changes via the
orchestrator. Keep user-facing language per §1 terminology (no "thread",
no "agent" in UI). Update docs you own.

Definition of done: sub-phase tests green + gate criteria in §12 + report
in the §13.5 format. If a frozen contract blocks you, stop and report, do not improvise a workaround.
```

---

## 14. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Agent-component/Auth/Presence API drift from plan assumptions | Rework | Phase 0.5 verification spike + pinned versions + ADR per deviation |
| Streamed-delta vs beat reconciliation flicker/duplicates | Core UX trust | Single status machine, dedupe by `streamMessageId`, E2E-03 asserts token-exact resume |
| Branch memory leaks regress silently | Product law violation | Single projection module; leak suite in CI (unit + integration + E2E-04); code-owner review on `path.ts` |
| Prompt budget overflow with 7-role crowd on long scenes | Broken generations | Budget property tests, compaction policy, context cap, per-scene K tuning, fail-clean retry |
| Casting schema violations (bad graph, similar voices) | Weak casts | Programmatic constraint checks + 2 repair passes + residual warnings surfaced |
| Cost blowups | Budget trust | Cheap meta tier, capped parallel options, per-scene meter + soft cap warnings, nightly real-model smoke off by default |
| Convex action runtime limits on long streams | Failed turns | Delta persistence per chunk, watchdog cron, retry/backoff, artifact policy keeps tree clean |
| Multi-director (share director) conflicts | State confusion | Run lock serializes generations; notes last-writer-wins; presence badges; v1 advisory |
| Options fatigue | Product feel | Default `key` cadence, ghosts collapsed, "Offer paths" always available |
| "Thread"/"Agent" wording leaks into UX | Terminology erosion | `check-terminology.ts` in CI |
| Heavy tree map bloats bundle | Perf | Lazy chunk + bundle-size assertion in CI |
| H2: two humans act simultaneously | Turn confusion | Human turns are floors; composer locks to the active human seat; pass/timeout UX; concurrency tests (P9.2/9.5) |
| H3: TTS cost/latency at scale | UX/cost | Async per-beat, cheap voice tier, cache per (text, voice) hash, retention policy (P12.2) |
| H3: community abuse | Trust/safety | Moderation pipeline **before** listing; boundaries metadata; takedown (P13.4) |
| Self-hosted backend ↔ Convex SDK drift after upgrades | Broken flows | Pin `convex` + backend image tags; `selfhost` CI job on every build; upgrade/rollback drill (P8.7); upgrade notes in `docker/README.md` |

---

## 15. Setup, env, scripts, CI & self-hosting (Docker)

### 15.1 Env vars

`.env.local` (Next), public:

```
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_FIXTURES=0
NEXT_PUBLIC_APP_NAME=Fabula
```

Convex deployment env (`npx convex env set ...`):

```
SITE_URL=http://localhost:3000
JWT_PRIVATE_KEY=  JWKS=                      # Convex Auth
OPENAI_API_KEY=   ANTHROPIC_API_KEY=         # whichever providers chosen
FABULA_MODEL_SPOTLIGHT=provider/model
FABULA_MODEL_STANDARD=provider/model
FABULA_MODEL_CHEAP=provider/model
FABULA_PRICING_JSON=                         # optional override {model: {in, out}}
FABULA_MODEL_FAKE=0                          # 1 = deterministic fake gateway (tests/E2E)
FABULA_E2E_SECRET=                           # dev-only test sign-in guard
FABULA_MAX_TOKENS_DEFAULT=                   # hard ceiling fallback when model unknown
TTS_API_KEY=                                 # Horizon 3 (voice), set at H3 kickoff
```

Docker Compose self-host, `docker/.env` (copy from `docker/.env.example`):

```
CONVEX_CLOUD_ORIGIN=http://localhost:3210    # backend public origin (your domain in prod)
CONVEX_SITE_ORIGIN=http://localhost:3211     # HTTP actions origin
CONVEX_INSTANCE_SECRET=                      # generate once (openssl rand -hex 32); keep stable
POSTGRES_PASSWORD=                           # backend metadata DB
S3_ENDPOINT_URL= S3_ACCESS_KEY= S3_SECRET_KEY= S3_BUCKET=   # MinIO or any S3-compatible store
ALLOWED_ORIGINS=                             # CORS: app origin(s)
ACME_EMAIL= APP_HOST= CONVEX_HOST= CONVEX_SITE_HOST=   # optional TLS overlay (Traefik)
NEXT_PUBLIC_CONVEX_URL=                      # app → backend origin
# AI keys from the Convex env block above are injected into the backend service
```

The exact variable set is pinned to the chosen `convex-backend` self-host release (verified in Phase 0.5/0.7, never assume drift). With self-host, deployment env is applied via the Convex dashboard or `npx convex env set` against `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY`.

### 15.2 Scripts

Scripts invoke binaries directly (package-manager agnostic); the repo standardizes on **Bun** for installs, CI and local runs (see `docs/adr/003-bun-toolchain.md`).

```
pnpm dev              # next dev
pnpm dev:backend      # convex dev --local  (also generates types)
pnpm check            # typecheck + lint + vitest + convex-test
pnpm test:e2e         # playwright (fake gateway + convex local)
pnpm seed             # seed prompt templates + dev fixtures
pnpm fixtures         # regenerate UI fixtures from contracts
pnpm terminology      # forbidden-word lint
pnpm dc:up            # docker compose up -d, full self-host stack
pnpm dc:logs          # follow stack logs
pnpm dc:down          # stop the stack
pnpm selfhost:smoke   # health → sign-in → create scene → one fake turn (any backend URL)
```

### 15.3 CI (GitHub Actions)

1. `verify`: install → typecheck → lint → vitest (+coverage floors) → convex-test → `next build` (bundle assertions).
2. `e2e`: convex local + next dev + Playwright (chromium/webkit/firefox, mobile projects) with fake gateway.
3. `nightly`: real-model smoke (casting + one turn + options) behind env flag; cost-capped.
4. `selfhost`: build images → `docker compose up` → health checks → `selfhost:smoke` + Playwright smoke subset (nightly also runs the upgrade/rollback drill from P8.7).

Every backend used in CI is the open-source Convex backend (`convex dev --local` / compose), there is no managed-only path; self-host parity is exercised on every build.

### 15.4 Local development topologies

| Path | Command | When |
|---|---|---|
| Fast loop | `pnpm dev` + `pnpm dev:backend` (`convex dev --local`, the open-source backend, no Docker) | day-to-day feature work |
| Parity loop | `pnpm dc:up` (`docker-compose.dev.yml`: hot-reload app + pin-matched backend/dashboard/postgres/S3) | before PRs touching infra, auth, storage, streaming |
| Test loop | Playwright with fake gateway against the local backend | CI + E2E |

### 15.5 Self-host production topology (`docker-compose.yml`)

| Service | Image / base | Purpose | Notes |
|---|---|---|---|
| `app` | multi-stage build of this repo (Next standalone) | UI + RSC | `NEXT_PUBLIC_CONVEX_URL` → backend origin |
| `convex-backend` | official `convex-backend` self-host image, **pinned tag** | DB, realtime, functions/actions, scheduler, file storage endpoints | metadata in Postgres, files in S3 |
| `convex-dashboard` | official dashboard image | operator console (env, logs, data, schedules) | expose on admin network/localhost only |
| `postgres` | `postgres:16` (or external managed PG) | backend metadata | named volume + backups |
| `s3` | MinIO (or external S3-compatible) | avatars, audio exports (H3), files | named volume + lifecycle policy |
| `traefik` (optional) | `traefik:v3.x` (pinned) | TLS termination + reverse proxy for single-VM deploys | routes the app, the Convex API and the HTTP actions host; Let's Encrypt via HTTP-01; config in `docker-compose.tls.yml` |

Containers run non-root, with healthchecks, resource limits, and pinned tags (no `latest`). All AI API keys flow only into `convex-backend` env; the app layer holds no provider secrets.

### 15.6 Self-host runbook (shipped as `docker/README.md`, completed in P8.7)

- Prereqs: Linux VM (2 vCPU / 4 GB RAM to start), Docker + Compose plugin, a domain (optional TLS via the Traefik overlay).
- First run: copy `docker/.env.example` → `docker/.env`, set secrets + origins, `pnpm dc:up`, run `pnpm selfhost:smoke`.
- Deploy code: `npx convex deploy` against the self-hosted backend (`CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY`) + pull the new app image.
- Backup: `pg_dump` (metadata) + object-store sync (files); documented restore + rollback (pin back old image tags).
- Ops: healthchecks, log locations, upgrade cadence, TLS renewal, S3 lifecycle for avatars/audio.

### 15.7 Deployment parity law

The open-source Convex backend is the **reference target**: every feature (Agent component threads/streams, Convex Auth, file storage, scheduling, crons) must pass CI against it. Convex Cloud remains supported as a convenience deployment, same code, same schema, but no feature may depend on Cloud-only behavior. Postgres and S3 may be internal (compose) or external managed services. The only hard external dependencies are AI provider APIs, swappable via the model gateway (§3.3).

---

## 16. Deliverable docs

### 16.1 README.md (outline, final content written by A9)

1. What Fabula is (concept, all-AI cast, director's chair) + hero screenshot.
2. Quickstart, local dev first, then `docker compose up` self-host in one command (env vars, seed, run).
3. How streaming & resume work (Agent component threads, `saveStreamDeltas`, `useUIMessages({stream:true})`, reconciliation model).
4. Branch laws (L1, L6 table) + what forking means in the UI.
5. Memory projection (path-scoped facts/summaries, global pins, leak-test guarantee).
6. Prompt blocks (8-block table + budget policy) and prompt inspector.
7. Orchestration modes (floor algorithm, tiers, burst, branch cadence).
8. Architecture diagram + repo map.
9. Testing (how to run, fake gateway, E2E scenarios table).
10. Glossary (UX term ↔ code term, incl. "thread is internal").
11. Roadmap: horizons H1/H2/H3, what v1.0 already ships, what H2/H3 add (§1.3).
12. Self-hosting & operations: compose topology, env reference, upgrades/backups/rollback, TLS (§15.5 to 15.7, `docker/README.md`).

### 16.2 docs/*

`prompt-architecture.md` (§7), `orchestration.md` (§8), `branch-and-memory.md` (§6), `testing.md` (§11), `adr/…`, `acceptance-run.md` (evidence).

---

## 17. Acceptance checklists

### 17.1 Milestone 1 · v1.0 (Horizon 1), evidence links required

| # | Criterion | Verified by |
|---|---|---|
| 1 | Quick start → playable scene in ≤3 screens | E2E-01 |
| 2 | Cast is coherent; every role editable; locks + vibe-steer work | E2E-01 + cast suites + manual review of a generated cast vs §7.4 constraints |
| 3 | Two devices: option picked on one updates the other instantly | E2E-02 (2 contexts) |
| 4 | Reload mid-generation: stream resumes; no lost/duplicated tokens | E2E-03 (token-exact assert) |
| 5 | Edit a past beat: forks new branch; original intact; memory reflects active path only (leak test passes) | E2E-04 + `leak.test.ts` |
| 6 | 6 roles: tiers behave; Background role speaks only when mentioned | E2E-05 + `orchestration.test.ts` |
| 7 | Prompt inspector shows compiled blocks for any message | E2E-04 extension + `promptSnapshots` tests |
| 8 | Generation failure never corrupts the tree | E2E-06 + `runs.test.ts` |
| 9 | 320px → 21:9 correct and beautiful; touch + keyboard | E2E-08 + screenshots archive |
| 10 | WCAG 2.2 AA: keyboard operability, focus mgmt, aria-live, contrast | axe zero critical/serious + E2E-09 |
| 11 | Every surface has loading/empty/error/offline/reconnecting states | states catalog review (§9.9) + component tests |
| 12 | Usage meter matches ledger; soft cap warned | `usage.test.ts` + manual |
| 13 | Share viewer cannot mutate; director can; revoke works | E2E-07 + `shareAccess.test.ts` |
| 14 | Export markdown + JSON open cleanly; JSON is tree-lossless | `exportScene.test.ts` + manual `jq` |
| 15 | No "thread"/"agent" in user-facing UI | `check-terminology.ts` |
| 16 | Budget invariants: prompts never exceed context; contract/mode/director never shrunk | budget property tests + snapshots audit |
| 17 | **Self-host**: fresh VM → `docker compose up` → full app functional; only AI provider keys are external; Convex Cloud optional | self-host drill (P8.7) + `selfhost:smoke` in CI |

### 17.2 Final product · v2.0 (all horizons)

| # | Criterion | Verified by |
|---|---|---|
| F1 | 2 humans + 3 AI + 1 spectator live scene; human floors alternate; AI never speaks for a human; spectator read-only | E2E-H2-01 |
| F2 | Private facts & whisper beats never leak to unentitled roles/humans in any mode | extended leak suite (§6.4) |
| F3 | 8-role crowd scene completes an arc within budget; background roles mentioned-only; no role dominates | crowd soak test |
| F4 | Compare two branches side-by-side; explicit merge is audited, undoable, documented | E2E-H2-02 + ADR-003 |
| F5 | Every role has a stable voice; radio mode plays 20 beats continuously incl. a branch switch | E2E-H3-01 |
| F6 | Publish → gallery discover → remix (attribution, no private copy) → play; moderation takedown works | E2E-H3-02 |
| F7 | PWA installable; archived scenes readable offline; no offline editing | PWA suite |
| F8 | UI localized to ≥2 locales incl. RTL audit; scene play language honored | i18n suite |
| F9 | All new surfaces pass axe AA + perf budgets | audit |
| F10 | Spend center shows accurate per-scene & per-account estimates with alerts | aggregation tests |
| F11 | Self-host & managed parity: the full compose stack runs every horizon's features on a single VM; no managed-service lock-in (AI APIs excepted) | parity CI job + release drills |

---

## 18. Boundaries

### 18.1 Permanent non-goals (every horizon)

- No mandatory managed services or vendor lock-in: the entire product (self-hosted Convex included) runs from the Docker Compose stack; only AI provider APIs may be external, and they are swappable via the gateway.
- No custom websockets, no polling, no REST CRUD layer.
- No offline-first **editing** (realtime + reconnect UX instead; offline reading arrives in H3).
- Meta-agents never speak in-fiction.
- Nothing is ever destroyed, no destructive story mutations, at any horizon.
- No cross-scene fact sharing: remixes **copy**; facts stay scene-scoped forever.
- No hand-rolled virtualization/markdown/dnd/graph-layout/streaming/URL-state/dialog primitives, libraries only (§3).

### 18.2 Deferred beyond v1.0, scheduled, not cut (Horizons 2 to 3)

| Deferred from v1.0 | Lands in |
|---|---|
| Multiple humans (players) & spectators | Phase 9 |
| Private facts, whispers, per-player visibility | Phase 10 |
| 7+ crowd mode | Phase 10 |
| Compare branches + explicit audited merge | Phase 11 |
| TTS/voice, radio mode, STT input | Phase 12 |
| Gallery/publish/remix/moderation | Phase 13 |
| PWA/offline reading, localization, spend center | Phase 14 |

### 18.3 Beyond v2.0 (not committed)

Ideas only, no plan: native mobile apps, marketplace/monetization, third-party role plugins, multi-scene sagas, cross-scene character continuity.

---

## 19. Verification spikes

### 19.1 Horizon 1, resolve before/at G0

1. Exact `@convex-dev/agent` API for: thread creation, streaming with `saveStreamDeltas`, `streamArgs`+`syncStreams` client consumption, abort semantics; pin the version.
2. Convex Auth anonymous sign-in → upgrade/claim flow shape (or ADR to Clerk with anonymous-friendly claim).
3. Presence component compatibility (or flag-gate `FABULA_FF_PRESENCE`).
4. AI SDK structured-output support per chosen provider/model for the casting schema size (fallback: tool-call mode).
5. Image-generation provider for avatars + Convex file storage flow (or ship gradient+monogram only behind env flag).
6. Convex local deployment for CI + Playwright orchestration (`convex dev --local`).
7. Tokenizer availability per provider (fallback chars/4 estimator, document accuracy expectations).
8. Confirm `roleRevisions.card` typed-any decision (ADR-002) or find a validator-friendly encoding.
9. **Self-host parity spike (P0.7):** pin the `convex-backend` self-host release; verify Agent component streams, Convex Auth, file storage, scheduling, and crons behave identically; finalize the compose service matrix + env set + healthchecks.

### 19.2 Horizon 2 spikes (resolve at H2 kickoff)

1. Human turn handoff UX semantics (wait state, pass, optional timers) against the existing floor resolver.
2. Server-side per-viewer payload filtering with Convex subscriptions (row-level filtering shape).
3. Merge-fact override semantics vs the leak law (drafts ADR-003).
4. Crowd compaction preset measurement (8 roles, long scenes) against budget invariants.

### 19.3 Horizon 3 spikes (resolve at H3 kickoff)

1. TTS provider selection, per-character voice catalogs, cost/latency per beat, storage retention policy.
2. Radio-mode transport against streaming (queueing live beats, branch-switch interruption).
3. Gallery moderation model (report → queue → takedown scope) + SEO surface.
4. PWA offline cache strategy limited to archived read models.
5. Localization stack (next-intl) + RTL audit scope.

---

## Appendix A. Genre preset seeds (v1)

| Preset | Premise seed | Cast skeleton (suggested) | Tone defaults |
|---|---|---|---|
| Noir interrogation | A rain-soaked precinct, 1948; a detective has one night to break an alibi | detective (protagonist), suspect (antagonist), corrupt captain (foil), informant (wildcard) | grim, grounded, rivalry |
| Court intrigue | The old king is dying; every smile hides a knife | heir (protagonist), spymaster (antagonist), queen (foil), jester (wildcard) | mid, grounded, rivalry |
| Space crew | A salvage crew wakes something in the hold of an abandoned freighter | captain (protagonist), engineer (support), the passenger (wildcard), ship AI persona (foil) | mid, fantastical, rivalry |
| Campus drama | Scholarship students vs legacy money at an elite conservatory | scholarship violinist (protagonist), legacy rival (antagonist), professor (mentor/foil), roommate (support) | comedic-lean, grounded, romance |
| Cozy tavern | A tavern at the crossroads where every traveler owes someone something | innkeeper (protagonist), bard (support), bounty hunter (foil), mysterious guest (wildcard) | comedic, grounded-fantastical, romance |
| Duel of letters | Two rival columnists in 1920s Paris are secretly each other's confessor | columnist A (protagonist), columnist B (antagonist), editor (foil) | mid, grounded, romance-rivalry |

Each preset seeds: premise, genre/era, tone dials, cast size, role skeletons (names empty, hooks pre-filled), presentation style, and a starter director note.

## Appendix B. Keymap (registry IDs frozen at G0)

| Keys | Action ID | Where |
|---|---|---|
| ⌘K / Ctrl K | `palette.open` | global |
| ⌘J | `thread.jumpToLatest` | play |
| ⌥1 to 4 | `options.pick.1..4` | play (options visible) |
| ⌘⏎ | `composer.send` | composer |
| ⌘⇧O | `options.offer` | play |
| ⌘. | `generation.abort` | while streaming |
| ⌘Z | `action.undoLast` | global (director actions) |
| ⌘B | `inspector.map.open` | play |
| ⌘I | `inspector.toggle` | play |
| ⌘M | `inspector.memory.open` | play |
| Esc | context close / cancel compose | global sheets/dialogs |
| ? | `shortcuts.dialog` | global |

## Appendix C. Model & cost configuration

- Logical tiers (`spotlight`/`standard`/`cheap`) resolve via `FABULA_MODEL_*` env → concrete `provider/model` in `lib/models.ts`; per-role override on the card.
- Attendance rules: options = spotlight (parallel ≤4); casting = spotlight; field/role regen = standard; sample lines = standard; director meta + memory + summaries + facts = cheap; background roles = cheap + condensed prompt.
- Pricing: `lib/pricing.ts` table (USD per 1M in/out) + `FABULA_PRICING_JSON` override; `sceneUsage` rollup drives the meter; UI labels numbers "estimated".
- Budget guard: soft USD cap per scene (setting) → metered warning banner at 80% / 100%; generation never hard-blocked in v1 (user override), decision logged.

## Appendix D. Glossary (UX ↔ code)

| UX word | Code term | Notes |
|---|---|---|
| Role / Character | `roles`, `roleRevisions` | AI → `kind:"ai"`; human-in-scene → `kind:"human"` |
| Beat | `beats` | one narrative turn |
| Path options | `candidates` (`status:"offered"`) | ghosts = offered after a sibling was picked |
| Branch | `branches` | forked from a beat; never destructive |
| Floor | `domain/orchestrate` + `generationRuns` | who generates next |
| Meta-agents | `casting` / `director` / `memory` action modules | never in-fiction |
| Thread | Agent component thread | **internal only, never in UX copy** |
| Artifact | `beats.isArtifact` | aborted/discarded partials; stored, not canon |
| Global pin | `facts.isPinned` | explicit director override of path scoping (§6.3, ADR-001) |
