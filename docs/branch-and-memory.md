# Branch laws and memory projection

Fabula's story is a tree, not a transcript. This document describes the six
branch laws, how picks/edits/regenerations mutate the tree, and how memory
(facts, summaries, context) is projected along the active path. It mirrors
PLAN §6; every mutation, field and test below is verified against the code.

## 1. The six laws

| # | Law | Enforced by |
|---|---|---|
| L1 | Candidates attach to a parent beat; picking one appends it and makes it canon. | `candidates.pick` (`convex/candidates.ts`) → `createBeatRow` (`convex/beats.ts`) |
| L2 | Picking at the active tip **extends** the current branch. | `planPick` (`convex/domain/branchPlans.ts`) returns `{ kind: "extend" }` when the candidate’s parent is the active tip; the beat is written into the active branch. |
| L3 | Picking a ghost (parent ≠ active tip) **forks** a new branch from that parent. | `planPick` returns `{ kind: "fork" }`; a `branches` row is inserted with `forkedFromBeatId`, `forkedFromBranchId`, `forkReason: "pick"`. |
| L4 | Editing, rewriting or regenerating any past beat forks from its **parent**. The original is always preserved. | `planEditFork` / `planRegenerate`; mutations `beats.editFork` and `beats.regenerateFork` (plus `createRegenerateFork` for streaming regeneration). |
| L5 | The active path defines memory/context; switching recomputes it. Nothing leaks across branches. | `projectPath` (`convex/lib/path.ts`) + the leak suite (`tests/convex/projectionLeak.test.ts`), E2E-04. |
| L6 | Nothing is ever destroyed; everything is reversible. | No destructive mutations; `actions` log with inverse ops (`convex/actions.ts`), soft states (`offstage`, `muted`, `isArtifact`, `archived`). |

`createBeatRow` is the single append primitive: it allocates `seq` from
`scene.seqCounter`, computes `depth` from the parent, inserts the beat, and
moves the branch tip — except for streaming beats, which pass
`setBranchTip: false` and only canonize in `generation.lifecycle.completeRun`.

## 2. Extend vs fork — the pick reducer

```text
planPick({ activeBranchId, activeTipBeatId, candidateParentBeatId,
           candidateBranchId }):
  atTip = activeTipBeatId !== undefined
          && activeTipBeatId === candidateParentBeatId
          && activeBranchId !== undefined
  atTip → extend active branch
  else  → fork from candidateParentBeatId (forkedFromBranchId = candidate.branchId)

candidates.pick:
  create/choose branch → createBeatRow(parent = candidate.parentBeatId,
                                       origin = "option") →
  candidate.status = "picked", candidate.pickedBeatId = beatId →
  scene.activeBranchId / activeTipBeatId = beat/branch →
  logAction(type "candidate.pick", inverse "restoreActive")
```

Branch labels are human-readable (`Alternate · beat N`: the fork point for
picks, the edited/regenerated beat’s seq for forks), `colorIndex` cycles 0–7
for the map, and `forkReason` is one of `pick`, `edit`, `regenerate`.

## 3. Ghost candidates and later-pick forking

Unpicked candidates stay `status: "offered"` forever — the “ghost alternatives”
of PLAN §6.2. Nothing sweeps them; they remain visible history.

- `candidates.listForScene` decorates every offered candidate with
  `parentSeq` and `parentIsTip`.
- The thread renders tip options as actionable cards (“Take this path”) and
  older ones as **ghost cards** under their parent beat, with the count of
  unused paths at that beat (`src/components/options/OptionCards.tsx`).
- Picking a ghost opens a confirm step (`PlayShell` dialog kind `ghostPick`)
  that states the consequence: this forks the story from that beat.
- Confirming executes L3: the original canon continues on its branch and the
  new branch holds the ghost’s continuation.
- E2E-02 asserts both contexts see the same ghost list after one side picks
  (`e2e/play.spec.ts`).

## 4. Edit and regenerate forks

Both reducers have the same constraint-preserving shape: **fork from the
target’s parent, never touch the target**.

- `beats.editFork(beatId, newText)` → new branch (`forkReason: "edit"`), new
  beat with `origin: "edit"` and `editedFromBeatId` pointing at the original.
- `beats.regenerateFork(beatId, text?)` / streaming
  `generation.regenerate.beat` → new branch (`forkReason: "regenerate"`), new
  beat with `origin: "regenerate"` and `regenerateOfBeatId`. The streamed
  version gets the speaker’s voice with the *current path context*; on failure
  or discarded abort the previous pointers are restored
  (`regenerate.restorePointers`), so a failed attempt can never become canon.
- **Root opener:** editing or regenerating the opening beat forks from
  `parentBeatId: undefined` — the mainline keeps the original opener and the
  fork becomes the new root. Covered by
  `tests/convex/playLoop.test.ts` (“regenerating the opening forks the root
  and preserves the original”).
- In every case the original beat and its branch remain in the tree, and the
  UI toast says so (“The original stays on its branch”), with an Undo action.

## 5. Active-path projection

`convex/lib/path.ts` is the single place that computes “the active path”
(L5). Everything that needs path-scoped context goes through it.

```text
activeChain(ctx, scene, tip?)  = buildChain(beats, tip ?? scene.activeTipBeatId)
  buildChain walks parentBeatId links tip → root, reversing to seq order.
  It throws on cycles and on missing beats.

projectPath(ctx, scene, tip?) returns:
  chain      — active-path beats (seq order)
  facts      — active-status facts with (isPinned || nodeId on path)
  summaries  — summaries whose coveredThroughSeq is on the path
```

`pathSets(chain)` yields the `ids` and `seqs` sets used by the two filters.
Consumers: `beats.listPath`, `facts.listForPath`, `summaries.listForPath`,
`shares.getByToken`, `branches.tree` (which also marks `activeBeatIds`), and
every generation context load (`convex/generation/context.ts`).

`revisionAt(ctx, roleId, seq)` resolves the role revision effective at a scene
seq (`roleRevisions` has `by_role_effectiveSeq`), so old prompts can be
reconstructed against the card as it was.

## 6. Facts in context

Facts are an append-only ledger (`convex/facts.ts`), each anchored to the beat
where it was introduced (`nodeId`).

In-context rule (`filterFactsAlongPath`):

```text
fact.status === "active" && (fact.isPinned || pathIds.has(fact.nodeId))
```

- **Global pins** (`isPinned = true`) are explicit scene-global canon
  overrides: a fact pinned on branch A compiles on branch B too. This is the
  one sanctioned cross-path exception (ADR-001); pins are set only by an
  explicit user action, labelled “make canon”, visually distinct in the memory
  panel, and undoable.
- **Muted facts** (`status: "muted"`) never enter prompts, pinned or not.
- The memory panel reads `facts.listForScene`, which deliberately includes
  off-path and muted rows, flagging each with `onPath` and `inContext`
  (`inContext = onPath || isPinned`) so nothing is silently hidden.
- The director can pin/unpin and mute/unmute from the panel; both are
  action-logged with inverse ops.

## 7. Summaries and the collapse rule

- A summary applies iff the beat it ends on is on the active path
  (`filterSummariesAlongPath` uses `coveredThroughSeq`).
- Summaries are produced by the memory agent (`generation.memory.runPass`)
  every `summaryEveryN` beats on the active path (default 6) and once forced
  when a scene is wrapped. `summaries.add` clamps `coveredFromSeq` into the
  summarized window; `coveredThroughBeatId` is the window’s last beat.
- **Collapse rule:** the compiler renders only the **two most recent**
  applicable summaries, oldest first (`renderSummaryText`); older text
  collapses into the newer summary’s coverage. Summaries are never deleted —
  collapsing is a rendering rule, not a mutation.
- On branch switch, the applicable set recomputes instantly because the path
  gate (`coveredThroughSeq ∈ path seqs`) changes.

## 8. Branch switching

`branches.setActive({ sceneId, tipBeatId })`:

- validates the tip belongs to the scene;
- patches `scene.activeBranchId = tip.branchId` and
  `scene.activeTipBeatId = tip._id`;
- nothing else. No regeneration, no retroactive memory edits.

The UI (`PlayShell.switchBranch`) calls it and shows the “Context updated”
toast: *“Memory now follows <branch label>. Nothing was regenerated.”*
`branches.list` exposes each branch with `beatCount` and `isActive`;
`branches.tree` powers the lazy-loaded map. `tests/convex/phase6.test.ts` and
`tests/convex/branchLaws.test.ts` (L5 case) assert the projected fact set
follows the switch.

## 9. The leak test — the crown jewel

`tests/convex/projectionLeak.test.ts` (convex-test, PLAN §6.4 / §11.4):

Fixture shape (`seedTwoBranchScene`): one playable scene → one opener beat
carrying `TOKEN_OPENER` → two candidates at the opener → pick the first
(canon branch A, fact `TOKEN_BRANCH_A …`) → pick the second (ghost → forks
branch B, fact `TOKEN_BRANCH_B …`).

Assertions:

| Case | Expectation |
|---|---|
| Facts on active path | Opener + own-branch fact present; the other branch’s fact absent — in both directions (switch via `branches.setActive`). |
| Pins | After switching away, pinning A’s fact makes it visible on B (`isPinned: true`); unpinning removes it again. |
| Mute | Muting A’s fact removes it from A’s own path too. |
| Summaries | A summary applies only when its `coveredThroughSeq` is on the active path; switching to A shows both opener and A summaries, B shows only the opener summary. |

CI enforcement: `bun run test` runs the whole Vitest suite including this file
(`.github/workflows/ci.yml` job `verify`), so an unpinned cross-path fact
surfacing in a projected context — the input to every compiled prompt — fails
the build. The same suite proves the pinned case positively; compiled-prompt
coverage rides on the projection plus the compiler goldens and E2E-04.

The same behavior is exercised end to end on an **edit-fork** (E2E-04,
`e2e/branch.spec.ts`): after editing the tip, the memory panel shows
`FACT_B_44E` and hides `FACT_A_9C1`, the map shows both branches and the
preserved original, switching back restores A’s context, and the prompt
inspector still resolves the original beat’s turn snapshot (≥6 blocks,
`contract.roleplay v1`).

Compiler-level goldens additionally prove the pinned-extra window behavior:
pinned beats older than `contextBeatsK` are always included
(`tests/compiler/compileRolePrompt.test.ts`).

## 10. Private knowledge — schema readiness

v1 ships **all-public** knowledge, but the schema is ready for H2 secrets:

- `facts.visibility = { kind: "public" | "private", roleIds: Id<"roles">[] }`
  (`convex/schema.ts`). The memory agent stores `roleIds = subjects` for
  private facts (`generation.memory.ts`).
- A role’s own card — including `psychology.secret` and `drives.secretGoal` —
  is always rendered into its own identity block (`identity` template), so a
  role knows its own secret.
- The role-scoped projection (`visibility.roleIds` filtering in
  `projectPath`/`context.ts`) is **not applied yet**: the current
  `filterFactsAlongPath` keeps every active path fact regardless of
  visibility. That is the deliberate v1 stance — H2 (“characters with real
  secrets”) wires the per-subject filter without schema changes.

PLAN §6.3’s “private facts compile only into prompts of subject roles” is
therefore schema-ready but not yet enforced; treat it as the H2 contract.

## 11. Undo — the inverse-op map

Every reversible action logs an inverse (`convex/actions.ts`);
`actions.undoLast` applies the newest unconsumed inverse inside the
transaction.

| Action type | Inverse |
|---|---|
| `candidate.pick` | `restoreActive` (branch/tip + candidate back to `offered`) |
| `beat.editFork`, `beat.regenerateFork` | `restoreActive` |
| `beat.pin` / `beat.unpin` | `patchBeat` |
| `beat.keepArtifact` | `patchBeat` back to artifact/aborted |
| `fact.pin`/`fact.unpin`, `fact.active`/`fact.muted` | `patchFact` |
| role edits, retire/restore, reorder | `patchRole`, `patchRoleOrder` |
| notes, warnings, candidates | `patchNote`, `patchWarning`, `patchCandidate` |
| `scene.end` (wrap) | `patchScene` (+ `clearEndedAt`) |

Coverage: `tests/convex/branchLaws.test.ts` (L1–L5, originals preserved),
`tests/convex/projectionLeak.test.ts` (leak + pins + summaries),
`tests/convex/phase6.test.ts` (tree, inspector, memory flags, branch switch),
`tests/convex/playLoop.test.ts` (regenerate/undo/root forks),
`tests/convex/actionsUndo.test.ts` (undo semantics).

## 12. Field-level quick reference

| Table | Key fields for branching/memory |
|---|---|
| `scenes` | `activeBranchId`, `activeTipBeatId`, `seqCounter`, `endingStreak`, `endedAt`, `status` |
| `branches` | `forkedFromBeatId`, `forkedFromBranchId`, `forkReason` (`pick`/`edit`/`regenerate`), `tipBeatId`, `colorIndex`, `label` |
| `beats` | `branchId`, `parentBeatId`, `seq`, `depth`, `origin`, `status`, `isArtifact`, `isPinned`, `editedFromBeatId`, `regenerateOfBeatId` |
| `candidates` | `parentBeatId`, `branchId`, `optionIndex`, `status` (`offered`/`picked`/`dismissed`), `pickedBeatId` |
| `facts` | `nodeId`, `subjects`, `visibility.kind`/`roleIds`, `status`, `isPinned` |
| `summaries` | `coveredFromSeq`, `coveredThroughBeatId`, `coveredThroughSeq` |
| `actions` | `seq`, `type`, `payload`, `inverse`, `undoneAt` |

Indexes that make this cheap: `beats.by_parent`, `beats.by_scene_seq`,
`branches.by_scene`, `candidates.by_parent_status`,
`candidates.by_scene_status`, `facts.by_scene_status`, `facts.by_scene_node`,
`summaries.by_scene_coveredThroughSeq`, `actions.by_scene_seq`.
