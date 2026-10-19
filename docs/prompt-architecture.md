# Prompt architecture

How Fabula turns scene state into role prompts: the compiler pipeline, the eight
prompt blocks, output contracts per mode, the token budget, provenance, and
template versioning. This mirrors; every path and API below is verified
against the implementation. Where the code is narrower than the design, the
difference is called out.

## 1. Pipeline

```
convex/generation/context.ts        DB → plain data (access checks run here)
  loadTurnContext / loadOptionsContext / loadRoleContext / loadBeatForRegen
  ├─ projectPath        (convex/lib/path.ts)      active-path beats, facts, summaries
  ├─ loadTemplateMap    (convex/prompts/load.ts)  active promptTemplates rows
  └─ notes, tensions, cooldown, factSubjectsWindow, beatsSinceStateChange
        │
        ▼
convex/compiler/compileRolePrompt.ts          ← pure: no DB writes, no clock, no RNG
  block drafts 1 to 8        (convex/compiler/blocks.ts)
  context window: last K = sceneSettings.contextBeatsK beats on the active path
  pinned beats older than the window → a separate “Pinned canon” user message
  fitToBudget             (convex/lib/tokenBudget.ts)
        │
        ▼
{ system, messages, snapshot }
  ├─ generation.turn.start / generation.regenerate.beat
  │     → Agent component streamText(..., { saveStreamDeltas: { returnImmediately: true } })
  │       + AbortController wired to runs.abortRequested (server-side aborts)
  ├─ generation.options.offer → gateway.object(PathOptionsSchema)
  ├─ generation.directorMeta.decide / generation.memory.runPass
  ├─ generation.casting.* / generation.sampleLine.generate / generation.opening.draft
  └─ snapshot → promptSnapshots (convex/generation/snapshots.ts, lifecycle.ts,
                                 candidates.createBatchWithSnapshot)
```

Compiler properties, all enforced by tests (`tests/compiler/compileRolePrompt.test.ts`):

| Property | Meaning |
|---|---|
| Pure | No DB access, no clock, no RNG. Callers load data; the compiler is a function. |
| Deterministic | Identical inputs produce byte-identical `system` and `messages`. |
| Fixed order | Blocks always render contract → identity → world → boundaries → memory → relations → directorNotes → mode. |
| Prose-free | Template text comes from `promptTemplates`; the compiler contains zero prompt prose literals. |

## 2. Block assembly (fixed order)

Block keys are stable anchors: budget compaction, snapshots, the inspector and
the golden tests all address blocks by `key`.

| # | Block key | Template key | Contents | Compaction priority (lower shrinks first) |
|---|---|---|---|---|
| 1 | `contract` | `contract.roleplay` | Stay in character; never control others; no omniscience; never mention being an AI; respect boundaries; canon facts are authoritative; leave hooks. | never shrink |
| 2 | `identity` | `identity` | Role card: hook, identity, temperament dials, flaws/fears/desires, secret, goals, boundaries, voice, sample lines. | 5 |
| 3 | `world` | `world` | Premise, genre, era, presentation style, play language, tone dials. | 4 |
| 4 | `boundaries` | `boundaries` | Scene allowed/blocked themes; hard rules. | never shrink |
| 5 | `memory` | `memory` | Rolling summary text + path-projected canon facts (pinned facts marked). | 3 |
| 6 | `relations` | `relations` | For each relation of an *active* other role: dynamic, tension, history, knows-about. | 4 |
| 7 | `directorNotes` | `directorNotes` | Active steers, standing constraints, hard do-not list (from `directorNotes` rows with `status: "active"`). | never shrink |
| 8 | `mode` | `mode.turn` / `mode.options` / `mode.sampleLine` | Mode task + output format, length target, narration rule, responder constraints. | never shrink |

Rendering helpers live in `convex/compiler/blocks.ts`: `renderBeatLine`
(`"Name: text"`, `"Narration: …"` when speakerless), `renderFactLines`
(appends `(pinned)`), `renderSummaryText` (keeps the **last two** summaries in
`coveredThroughSeq` order, older ones collapse into the next summary),
`renderRelationLines`, `renderNotes`, `styleFormatFor`, `lengthWordsFor`,
`worldVars`, `identityVars`.

### Context window and message roles

- The window is the last `contextBeatsK` beats of the active path, sorted by
  `seq`; the shared dev/test settings default is 30 (`SceneSettingsSchema`
  allows 4 to 80).
- Pinned beats older than the window are **always** included, prepended as one
  user message titled `Pinned canon (always in context):`.
- Beats spoken by the compiled role render as `assistant` messages; every other
  beat renders as `user`. That keeps multi-turn continuity natural for the
  model without inventing a fake transcript format.

## 3. Output contracts by mode

All structured outputs parse against zod schemas in `convex/shared/contracts.ts`
before anything is persisted. The gateway rewrites each schema for strict
structured outputs (every object lists all of its keys as required, optional
keys become nullable) and turns those nulls back into absence before zod
validation; free-form records fall back to non-strict JSON
(`convex/lib/strictJsonSchema.ts`). Prompts compiled without beat context
(opening draft, sample lines) carry a short instruction message through
`ensurePromptMessages`, and the gateways refuse empty message lists, so a
missing cue fails in tests instead of streaming nothing from a real provider.
`PathOption.label` is refined post-parse to 2 to 4 words; `Summary` must
satisfy `coveredFromSeq ≤ coveredThroughSeq`.

| Mode | Entry point | Contract | Transport | Model tier |
|---|---|---|---|---|
| `turn` | `generation.turn.start`, `generation.regenerate.beat`, `generation.opening.draft` | Free text, formatted per presentation style | `Agent` component `streamText` with `saveStreamDeltas` (opening draft: `gateway.stream`) | speaker `modelTier` |
| `options` | `generation.options.offer` | `PathOptionsSchema` (2 to 4 options; strategy enum; state-changing strategy required) | `gateway.object` | spotlight |
| `summary` | `generation.memory.runPass` | `SummarySchema` `{ summary, coveredFromSeq, coveredThroughSeq }` | `gateway.object` | cheap |
| `facts` | `generation.memory.runPass` | `FactsSchema` `{ facts: [{ text, subjects, visibility, nodeId }] }` | `gateway.object` | cheap |
| `casting` | `generation.casting.castDraft` | `CastingSchema` (premise + 1 to 8 role cards) | `gateway.object` | spotlight |
| `castRegen` | `generation.casting.castRegen` | `RoleListSchema` | `gateway.object` | spotlight |
| `fieldRegen` | `generation.casting.fieldRegen` | `FieldRegenSchema` (patch object; applier validates per field) | `gateway.object` | standard |
| `directorMeta` | `generation.directorMeta.decide` | `DirectorMetaSchema` `{ decisionPoint, reason, responders, pacingNote, endingSuggested }` | `gateway.object` | cheap |
| `sampleLine` | `generation.sampleLine.generate` | `SampleLinesSchema` (2 to 3 lines) | `gateway.object` | standard |
| `continuity` | `generation.memory.runPass` | `ContinuitySchema` (≤ a few warnings, severity low/medium/high) | `gateway.object` | cheap |

### Turn formatting

`styleFormatFor(presentationStyle)` and `lengthWordsFor(lengthTarget, style)`
produce the mode contract:

| Style | Format contract | medium length (words) |
|---|---|---|
| `chat` | `` `Name: text` `` lines; short narration in italics on its own line | 110 |
| `script` | `NAME` line, dialogue beneath, stage directions in parentheses | 150 |
| `novel` | third-person limited past-tense prose, quoted dialogue, no name prefixes | 260 |

Word targets per length: short 60/90/160, medium 110/150/260, long 180/240/400
(chat/script/novel). `outputReserveFor(lengthTarget)` reserves 400/800/1600
output tokens (short/medium/long) and doubles as `maxOutputTokens`.

### Validation, repair and deterministic fallback

- **options**, after parse, `optionProblems()` checks: every `speakerRoleId`
  is an active role; ≥2 distinct strategies; ≥1 state-changing strategy
  (`escalate | reveal | confront | commit`, `STATE_CHANGING_STRATEGIES`).
  A repair pass re-asks the model, after a parse/transport failure, or with
  the problem list. If the result is still invalid, `fallbackOptions()` emits a
  deterministic batch (rotating speakers, labels “Force the moment / Hold the
  line / Change the subject”, strategies escalate/deflect/commit) and
  `offer` returns `fallback: true` plus warnings. Note: options are generated
  by a single structured call, not as independent parallel requests
 .
- **casting**, zod first, then the programmatic cast checker
  (`convex/domain/castConstraints.ts`), then up to two repair passes; residual
  violations are returned as non-blocking warnings the audition surfaces.
- **facts**, deduped against the existing ledger with
  `isDuplicateFact()` (normalized-string fallback, `convex/domain/factDedupe.ts`);
  `subjects` are filtered to real scene roles; `nodeId` is clamped to the
  summarized window; private facts store `visibility.roleIds = subjects`.
- **summary**, `coveredFromSeq` is clamped into the summarized window;
  `coveredThroughBeatId` is the window’s last beat, so a summary only applies
  when that beat is on the active path.
- **fieldRegen**, locked fields never reach the model; the applier validates
  each returned field individually and drops invalid patches with a warning.
- **directorMeta**, never fails the caller: on any error it returns
  `{ meta: null }` and the turn action falls back to deterministic floor
  resolution (see `docs/orchestration.md`).
- **memory pass**, each of the three products (summary, facts, continuity) is
  individually non-fatal; a failure leaves the beat stream intact.

## 4. Casting constraint checks

`checkCast()` in `convex/domain/castConstraints.ts` runs *after* the model
output parses. Violations carry stable codes:

| Code | Check |
|---|---|
| `disconnected-graph` | Every role is reachable through the relationship graph. |
| `no-alliance` | ≥1 alliance edge (`ally`, `lover`, `mentor`, `family`). |
| `no-friction` | ≥1 friction edge (`rival`, `enemy`) or tension ≥ 0.6. |
| `similar-hooks` | Pairwise hook token overlap (Jaccard) < 0.7. |
| `similar-voices` | Pairwise sample-line overlap < 0.8 and not identical register+rhythm. |
| `duplicate-names`, `self-relation`, `unknown-relation` | Structural sanity. |
| `tier-policy` | `tierPolicy(size)`: ≤4 → all spotlight allowed; 5 to 6 → max 4 spotlight; 7+ → max 3 spotlight + 2 supporting. |

The request-side human role note, cast sizing and vibe steers are inputs to
`compileCastingPrompt`; cast-level checks are never trusted to the model.

## 5. Token budget policy (`convex/lib/tokenBudget.ts`)

- `estimateTokens()` = `ceil(chars / 4)`, the documented fallback until a
  provider tokenizer lands.
- `computeUsable(contextWindow, outputReserve, protocolOverhead = 512)` =
  `contextWindow - outputReserve - 512`.
- `systemTokenBudget(usable)` = 25% of usable (`SYSTEM_TARGET_PCT = 0.25`).
- `fitToBudget()` enforces two constraints at once: system ≤ target *and*
  system + context + outputReserve ≤ usable.

Compaction order when over budget:

1. Drop the **oldest context beats** (never below `minContextBeats`; the
   compiler passes `min(4, window.length)`).
2. Shrink compactable blocks in this exact order: **memory → world →
   relations → identity**. Each shrinks by halving, never below
   `MIN_BLOCK_CHARS = 200`, and keeps an ellipsis marker.
3. Protected blocks (`contract`, `boundaries`, `directorNotes`, `mode`) are
   **never** shrunk. If the prompt is still over budget after step 2, the fit
   result sets `overBudget: true`, nothing is silently truncated.

`overBudgetAction` recorded in snapshots:

- full role prompt: `"compacted (context dropped / blocks shrunk)"` when the
  fit was over budget at any point;
- meta/single-block prompts (`finalizeSingleBlock`): `"single-block over budget"`
  when system or total exceed the usable window on the first pass.

Deferred vs.6: the “fail cleanly and retry once with context halved”
behavior is not wired in v1; the flag persists instead so the inspector and
usage views can show it.

## 6. Provenance, `promptSnapshots`

Every generation persists a snapshot row. Fields (see `convex/schema.ts` and
`convex/generation/snapshots.ts`):

| Field | Meaning |
|---|---|
| `sceneId`, `mode` | Which scene, which generation mode. |
| `beatId` / `roleId` / `candidateId` | The beat, role or candidate the snapshot belongs to (options batches link every candidate to one snapshot). |
| `blocks[]` | Per block: `key`, `templateKey`, `templateVersion`, rendered `text`, `hash` (FNV-1a via `stableHash`), `tokens`, `chars`. |
| `model` | `{ provider, modelId, params }`, params include temperature when the role pins one. |
| `tokenCounts` | `{ system, context, outputReserve, total }`. |
| `budget` | `{ contextWindow, systemTargetPct, overBudgetAction? }`. |
| `createdAt` | Write time. |

Write paths: `generation.lifecycle.completeRun` (turn/regenerate),
`candidates.createBatchWithSnapshot` (options at inserts snapshot + candidates
atomically), `generation.snapshots.write` (director meta, memory products,
casting, sample line), `generation.opening.draft` (audition preview, no beat).

The prompt inspector (`convex/generation/snapshots.ts` queries
`getForBeat` / `getForCandidate` / `listForScene`, rendered by
`src/components/inspector/PromptInspector.tsx`) shows block-by-block rendered
text, the template key + version per block, token counts and over-budget
actions. Because snapshot blocks store text at write time, old snapshots stay
readable after templates change. The fork-and-leak browser scenario asserts this end to end
(`e2e/branch.spec.ts` expects ≥6 prompt blocks and the literal
`contract.roleplay v1`).

## 7. Template versioning

- Prose lives in `convex/prompts/templates.ts` (18 `DEFAULT_TEMPLATES` seeds)
  and is inserted by the idempotent `api.prompts.seed.seedV1` mutation
  (`convex/prompts/seed.ts`), keyed by `(key, version)`.
- `activeTemplateMap()` (`convex/prompts/registry.ts`) picks the active row per
  key, else the highest version; `loadTemplateMap()` converts rows into the
  compiler’s `TemplateMap`.
- `renderTemplate()` substitutes `{{var}}` placeholders; an unknown variable
  stays visible as `{{var}}` rather than rendering empty. Seeded templates
  declare their `vars`; the seed also derives them with `templateVars()` when
  omitted.
- Rule: **any prose change ships as a new version**, never an
  in-place edit. The seed has one release-window exception: before the first
  public release, `seedV1` converges v1 content in place so early builds stay
  fixable. After release, bump `version`.
- `meta.roleRegen` is seeded but not wired to an action in v1 (whole-role
  regeneration currently goes through `castRegen` / `fieldRegen`).

### Goldens as the review gate

`tests/compiler/compileRolePrompt.test.ts` snapshots the full compiled output
for turn (chat/script/novel), options and sampleLine; `tests/compiler/meta.test.ts`
covers summary/facts/continuity/casting/castRegen/fieldRegen/directorMeta
prompts. Additional invariants tested there:

- byte-identical output for identical inputs (purity);
- fixed block order;
- contract/boundaries/directorNotes/mode never shrink under budget pressure;
- pinned beats older than the window are always present;
- own lines become assistant messages, others user messages.

```bash
bun run test tests/compiler          # run the prompt goldens
bun x vitest run tests/compiler -u   # update snapshots, requires a PR note
                                     # explaining the behavioral change
```

Update goldens only when the prompt change is intentional; the snapshot diff is
the review artifact.

## 8. Running the compiler tests locally

```bash
bun run test                 # whole Vitest suite (unit + component + convex-test)
bun run test tests/tokenBudget.test.ts tests/compiler
bun run terminology          # UX language guard (not prompt prose)
```

Compiler tests need no backend: fixtures in `tests/compiler/fixtures.ts` build
the template map from `DEFAULT_TEMPLATES` directly. Integration tests that
generate through the actions bootstrap templates with
`api.prompts.seed.seedV1` (see `tests/convex/helpers.ts`). A real deployment
seeds with `bun run seed` (`scripts/seed-dev.ts`).

See `docs/orchestration.md` for how the director meta-agent consumes these
prompts, and `docs/branch-and-memory.md` for the path projection feeding the
memory block.
