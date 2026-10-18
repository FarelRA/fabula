# ADR-005 — Additive play-loop API

**Status:** Accepted (Phase 5)
**Date:** 2026-10-18
**Deciders:** A0 (orchestrator), A1 (domain), A2 (generation), A6 (play UX)

## Context

PLAN §13.4 froze a `thread.listMessages(sceneId, pagination, streamArgs)` query
but left it unimplemented; the play loop also needs read surfaces and a
regeneration operation that the frozen table did not name explicitly:

- a streamed turn beat is created at the first delta but does **not** move the
  active tip until it finishes, so `beats.listPath` cannot show it;
- offered candidates exist scene-wide (tip options + ghosts under old beats);
- the play UI needs public floor state (who is speaking, abort requested);
- “regenerate” must fork (L4) **and** stream a fresh take, not just create an
  empty fork beat.

## Decision

Add the following **additive** surface (no schema changes, no renames):

**Queries**
- `thread.listMessages` — scene-scoped authorization, `listUIMessages` +
  `syncStreams`, returns the UIMessage page plus stream deltas. Beats remain the
  source of truth; this query exists only for in-flight text/resume.
- `beats.listPending` — `streaming`/`failed`, non-artifact children of the active
  tip. Failed children stay visible with a retry affordance and never enter the
  path.
- `candidates.listForScene` — offered candidates with `parentSeq` and
  `parentIsTip`, powering inline options and collapsed ghost paths.
- `generation.runs.active` — public floor state (speaker identity, mode,
  abort-requested).

**Action/mutations**
- `generation.regenerate.beat({beatId, instruction?})` — forks from the target's
  parent with the same active AI role, compiles the current path context (+ an
  optional instruction message), streams into the new beat, writes provenance
  and usage, and logs undo (`restoreActive`). On failure/abort-discard it
  restores the previous active branch/tip.
- Internal helpers: `generation.regenerate.beginFork`, `restorePointers`,
  `generation.runs.fail`, `generation.lifecycle.bindRun`.
- `beats.createRegenerateFork` is extracted from the public
  `beats.regenerateFork` so both paths share law L4.

## Consequences

- The transport query is never rendered twice: finished text comes from beats,
  only the in-flight row uses Agent deltas.
- Regeneration preserves the original branch and restores pointers when the new
  attempt fails, so a failed take cannot become canon.
- E2E-02 (two contexts) and E2E-03 (reload mid-stream) can run against the real
  local backend (ADR-006).
- §13.4 is updated in PLAN.md with these names; existing args/returns are
  unchanged.
