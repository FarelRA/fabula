# ADR-004 — Opening-beat preview before canon

**Status:** Accepted (Phase 4)
**Date:** 2026-10-18
**Deciders:** A0 (orchestrator), A2 (generation), A5 (cast UX)

## Context

PLAN §9.5/Phase 4.6 requires the opening-beat step to support three paths:
generate, **regenerate**, and write-your-own, all before the director presses
Start. The Phase 2 opening path (`generation.turn.start` with
`opening: true`) streams into a real beat and rejects a second call once the
scene has an active tip. Reusing it for rerolls would leave abandoned opening
beats in the tree (or require deleting them, violating L6), and keeps the scene
in `playing` while the director is still auditioning.

The frozen API surface (§13.4) names an opening-beat action family but has no
preview operation.

## Decision

Add one **additive** action, `generation.opening.draft`:

- runs the same opening-turn prompt as `turn.start` (spotlight speaker, full
  8-block compiler, model tier, budget),
- validates access through `loadTurnContext`,
- writes a `promptSnapshots` row (mode `turn`, `beatId` unset) and records
  estimated usage,
- **writes no beat and no generationRun**, so rerolls are cheap and the tree is
  untouched; the scene stays `draft`.

The audition commits the chosen text atomically with the existing
`beats.appendOpening` mutation, which creates the opening beat, sets the scene
to `playing`, and freezes initial role revisions. The streamed path
(`turn.start` with `opening: true`) remains available for any flow that wants
live opening tokens.

Because the preview is not canon, it is intentionally not represented in the
beats list; provenance still points at the compiled prompt via the snapshot.

## Consequences

- Rerolling the opening never accumulates ghost beats; "nothing is destroyed"
  holds without cleanup mutations.
- The audition can stay on the draft scene until Start; first-play revision
  semantics are unchanged.
- API surface grows by one action. §13.4 is updated in PLAN.md; no existing
  args/returns changed.
- Preview usage is metered (the usage meter stays honest about rerolls).
- Real-model latency is paid per reroll (same as any generation); fixtures are
  instant and deterministic.
