# Orchestration

Who speaks next, when options appear, how bursts chain, what happens on abort,
failure and wrap. This mirrors PLAN §8; the mechanisms below are the ones
actually wired in the code. Where v1 is narrower than the PLAN, it is called
out explicitly.

Implementation map:

| Concern | Where |
|---|---|
| Floor resolution (pure) | `convex/domain/orchestrate.ts` — `resolveFloor`, `shouldAutoBurst`, `detectStall` |
| Turn action (wiring) | `convex/generation/turn.ts` — `generation.turn.start` |
| Director meta-agent | `convex/generation/directorMeta.ts` — `internal.generation.directorMeta.decide` |
| Options cadence + cards | `convex/generation/options.ts`, `convex/candidates.ts` |
| Client floor driver | `src/components/scene/PlayShell.tsx`, `src/lib/play/helpers.ts`, `src/components/director/FloorIndicator.tsx` |
| Run lifecycle | `convex/generation/runs.ts`, `convex/generation/lifecycle.ts`, `convex/crons.ts` |
| End detection / wrap | `convex/scenes.ts` — `recordEndingSignal`, `endScene` |

## 1. Floor resolution

Priority order (`resolveFloor`):

1. **Forced mention** — an explicit target always wins.
2. **Director queue** — the queued speaker pops next.
3. **Turn mode** — `roundRobin`, `reactive` (default), `directorLed`, `freeform`.
4. **Skip** — when nobody is eligible the action returns `status: "skipped"`
   with a reason and no run starts.

How production wires the priority: `generation.turn.start` accepts an optional
`speakerRoleId`, which covers mentions, queue pops and steal-floor. When a
speaker is provided it is used directly (validated: must be an active AI role,
or the action throws). When it is absent:

- `reactive` → ask the director meta-agent; the first of its `responders` that
  is an active role speaks. If the meta call failed, `resolveFloor` decides.
- other modes → `resolveFloor` decides (`roundRobin` cycles the active seat
  order after the last speaker; `directorLed`/`freeform` return `skip` with
  “awaiting the queue/cue”, which the UI reflects in the floor indicator).
- The pure resolver also models `forcedRoleId` and `queue[]` with tests; the
  client queue lives in `PlayShell` state and pops into `speakerRoleId`.

### Reactive candidates

Candidate responders for the next beat, deduped in this order:

| Source | Rule |
|---|---|
| Addressed | The last beat’s text contains the role’s name (case-insensitive, names ≥3 chars). The last speaker is excluded. |
| Affected | The role appears in `factSubjectsWindow` — subjects of facts anchored to the latest beat (`context.ts`). |
| Tension | Tension toward the last speaker ≥ **0.7** (from the role’s relation `tension`), highest first. |

The first candidate speaks; the full ordered list is returned as `responders`.
**Background-tier law:** background roles enter the candidate set only through
*addressed* or *affected* — never through tension and never the rotation
fallback. This is enforced in `resolveFloor` and tested with the small-cast
fixture in `tests/domain/orchestrate.test.ts`.

**Deterministic fallback** (meta failed, or no candidates): spotlight roles
only, last speaker excluded, sorted by cooldown descending (cooldown = beats
since the role last spoke; never-spoke ranks highest). A background-only cast
therefore skips rather than rotating.

PLAN §8.1 also describes a “mention order → tension desc → round-robin” fallback
and a supporting-tier “every Nth beat” gate. In v1 the fallback is the spotlight
rotation above, and `supporting` roles participate whenever they are
addressed/affected/tensioned — there is no Nth-beat gate.

### Tier behavior

| Tier | Participation | Model |
|---|---|---|
| `spotlight` | Full candidate set, default frequency. | spotlight tier |
| `supporting` | Addressed / affected / tensioned. | standard tier |
| `background` | **Only** when addressed or directly affected. | cheap tier |

Tier → model tier mapping happens at cast time (`src/lib/cast/tierPolicy.ts`,
`modelTierFor`); the compiler does not render a separate condensed prompt for
background roles yet (PLAN §8.1 mentions a lightweight form).

### Director meta-agent

`generation.directorMeta.decide` (internal action, cheap model, `meta.director`
template) receives the last three beats, present roles (`id: Name (tier,
storyRole)`), the tension map, turn mode and branch cadence. It returns
`{ decisionPoint, reason, responders, pacingNote, endingSuggested }`, with
`responders` filtered to active role ids, and writes a prompt snapshot plus a
usage event. It never fails the caller: any error yields `{ meta: null }` and
the deterministic floor takes over.

## 2. Auto-burst

Semantics: after a finished AI beat, immediately resolve the next floor until
`burstMax` consecutive AI beats — but never past a decision point and never
after the director acts.

- Pure gate (`shouldAutoBurst`): `autoBurst && !userDirected && !decisionPoint
  && consecutiveAiBeats < burstMax`. Unit-tested in
  `tests/domain/orchestrate.test.ts`.
- Production driver is client-side (`PlayShell` effect): it only fires when the
  scene is `playing`, no run is active, no tip options are open, no pending
  beat is streaming or failed, `autoBurst` is on, the last beat is `finished`,
  and `trailingAiBeats(beats) < burstMax`. It fires after a 900 ms pause; a
  queued role pops first after 350 ms. Pause and pick/edit/write/steer reset
  or block the chain.
- Counter: `trailingAiBeats()` counts trailing beats with `origin` `turn` or
  `regenerate`; `burstLabel()` renders `n/burstMax` and the floor indicator
  shows “Burst 2/3” (`FloorIndicator.tsx`, clamped `burstMax ≥ 1`).
- Any director action interrupts: picks, in-character writes, steers,
  mentions, aborts, offering paths, pausing.

## 3. Decision points and options cadence

`branchFrequency` (scene settings):

| Setting | Options appear |
|---|---|
| `always` | After every finished AI beat (`generation.options.offer` is invoked by the turn action). |
| `key` (default) | Only when the director meta-agent flags `decisionPoint=true`, **or** the scene is stalled (see §6). |
| `onDemand` | Never automatically; the “Offer paths” button (floor indicator, `Ctrl/⌘+Shift+O`) calls `options.offer` at the current tip. |

Options generate as one structured (`generateObject`) call with the spotlight
model, 2–4 requested (default `optionsDefaultCount`), repair pass and
deterministic fallback as described in `docs/prompt-architecture.md` §3.
Candidates persist with their batch snapshot atomically
(`candidates.createBatchWithSnapshot`). Tip options render inline under the beat
(“Take this path”); when the tip has open options, the auto-burst driver waits —
the director’s move. Unpicked candidates become ghosts under their parent beat
(see `docs/branch-and-memory.md`).

## 4. Director’s chair controls

| Control | Backend | Notes |
|---|---|---|
| Pause / resume | `scenes.setStatus("paused" \| "playing")` | The client auto-floor driver only runs while `playing`; direct actions still apply. UI: “Paused — auto-floor is off · direct actions still apply”. |
| Steal floor | abort + `turn.start(speakerRoleId)` | `PlayShell.mention`: if a run is active it requests abort, then starts with the requested role once idle. |
| Queue role | client-side FIFO in `PlayShell` | Pops into `speakerRoleId` after ~350 ms; shown as “· N queued”. Not persisted server-side in v1. |
| @mention force | same path, priority 1 | Explicit `speakerRoleId` always outranks the resolver. |
| Retry / regenerate | `generation.regenerate.beat` + `beats.regenerateFork` (L4 fork) | Original preserved; failed attempts restore the previous pointers. |
| Edit any beat | `beats.editFork` (L4 fork) | UI: “Save & fork”, toast “Forked from beat N — the original stays on its branch”. |
| Undo | `actions.undoLast` | Applies the newest unconsumed inverse op (pick, fork, regenerate, pin/mute, retire/restore, keep-artifact, wrap). |
| Pin beat | `beats.pin` | Pinned beats always ride in the prompt context (see prompt doc §2). |
| Pin / mute fact | `facts.setPinned` / `facts.setStatus` | Pin = global canon override (ADR-001); mute removes from every prompt. |
| Eject / retire role | role `status` handled in `convex/cast.ts` | Never deleted; restore is undoable. |
| End scene | `scenes.endScene` | Freezes the tree (`archived` + `endedAt`), runs a final forced memory pass, undoable via ⌘Z. |

## 5. Abort, failure and artifacts

The run lifecycle guarantees the tree can never be corrupted
(`convex/generation/lifecycle.ts`):

- **No beat before output** — `beginBeat` runs on the **first stream delta**.
  A failure before any delta leaves **no beat row**; the run is marked failed.
- **Mid-stream failure** — the beat row exists with `status: "failed"`; the tip
  is not moved (`completeRun` only advances pointers when the outcome is
  `done` and the beat’s parent is still the active tip). The thread renders
  failed children from `beats.listPending` as a “failed attempt” row (partial
  text shown, off the active path) whose **Retry** affordance drives a
  regenerate fork of the failed attempt (L4 — the failed row is preserved);
  per-beat regeneration lives in the beat actions menu. E2E-06 covers both
  (`e2e/resilience.spec.ts`).
- **Abort** (`generation.runs.requestAbort`, `⌘.` / button) sets
  `abortRequested`. Two mechanisms act on it: the stream loop checks
  `isAborted` every 5 chunks (fast path), and a 400 ms watcher trips an
  `AbortController` passed to the agent's `streamText` — so the provider
  stream stops **server-side**, not just in the reader. Both paths funnel into
  the same outcome (`aborted`). Partial handling per
  `turnRules.abortedKeepsPartial`:
  - `keep` → the partial becomes a `finished` beat and can canonize (tip moves
    only if its parent is still the tip).
  - `discard` → the partial is stored as an **artifact** (`isArtifact: true`,
    `status: "aborted"`) hanging off the same parent, off the active path.
    `beats.keepArtifact` can later flip it to a normal beat; regardless, the
    normal pick/fork path is what puts anything on the path. Artifact cards are
    not surfaced in the play thread in v1.
- **Regeneration failures** restore the previous active branch/tip
  (`regenerate.restorePointers`), so a failed attempt never becomes canon.
- **Retry/backoff** — `convex/lib/retry.ts` implements exponential backoff
  (3 attempts, 500 ms / 2 s / 8 s, injectable sleep; unit-tested in
  `tests/retry.test.ts`). In the generation actions the practical recovery
  paths are the options repair pass and retrying through the failed-beat
  affordance (fresh attempt) or an L4 regenerate fork; the helper itself is
  used by the e2e server provisioning. PLAN §8.5’s automatic in-action model
  retries are not fully wired in v1.
- **Watchdog** — `convex/crons.ts` runs every **2 minutes** and fails
  `generationRuns` still `running` after **3 minutes**
  (error `"watchdog: stale run"`), which releases the run lock so the floor
  can start again.

## 6. Stall recovery and end detection

- **Stall** (`detectStall`): the three most recent path beats brought **no new
  fact** and **no picked option** → the scene is spinning. In `key` cadence a
  stall overrides the meta decision and options are generated anyway. PLAN’s
  non-modal “raise the stakes” escalation chip is not implemented in v1.
- **End detection**: every meta result feeds
  `scenes.recordEndingSignal({ suggested })` — `endingStreak` increments on
  `endingSuggested=true` (capped at 9) and resets to 0 otherwise. When
  `endingStreak ≥ 2` and not dismissed, the play shell shows the non-modal
  **wrap offer** (`data-testid="wrap-offer"`, “Wrap scene”). Confirming opens
  the “Wrap & archive” dialog → `scenes.endScene`: status `archived`,
  `endedAt`, a reversible action-log entry, and a forced memory pass that
  summarizes any uncovered tail. The scene **never auto-archives**; E2E
  (`e2e/archive.spec.ts`) drives offer → wrap → archive replay → exports.

## 7. Concurrency and multi-device

- **Single active run per scene** — `runs.begin` looks up `running` rows by
  `by_scene_status` and throws `"A generation is already running for this
  scene"` when one exists. `invariants.assertSingleActiveRun` encodes the law.
- **Picking during a run** is safe rather than blocked server-side: a
  late-finishing turn only advances the tip if its parent is still the active
  tip, so a pick can never be clobbered. The keyboard pick path in the play UI
  additionally disables while a run is visible.
- **Multi-device** — every reader subscribes to the same reactive queries, so a
  pick in context A becomes canon in context B without a reload (E2E-02,
  `e2e/play.spec.ts`). All mutations are transactional; there is no per-user
  draft state in the scene.
- **Offline / reconnecting** — `src/hooks/useConnectionState.ts` distinguishes
  `offline` (browser lost the network → mutating affordances lock and a banner
  shows) from `reconnecting` (socket dropped, Convex owns the backoff; queued
  mutations deliver on resume). Recovery re-enables everything without a
  reload (E2E-06, `e2e/resilience.spec.ts`).
- **Share-director scope (v1)** — viewer tokens are read-only by construction
  (mutations never accept them); director tokens may pick
  (`candidates.pick` accepts a `shareToken` and requires `permission:
  "director"`). Directing while a run is active is serialized by the run lock.
  Conflicts are last-writer-wins on notes and blocked on runs — v1 is advisory
  single-writer, with presence badges showing who is in the room.

Coverage: `tests/domain/orchestrate.test.ts` (floor priority, reactives, tier
law, burst gate, stall), `tests/convex/generationTurn.test.ts` (streaming,
failure/abort state machine), `tests/convex/optionsGen.test.ts` (cadence +
repair/fallback), `tests/convex/phase6.test.ts` / `phase7.test.ts` (branch
switching, end detection, share access), `e2e/play.spec.ts` and
`e2e/archive.spec.ts`.
