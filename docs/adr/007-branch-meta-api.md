# ADR-007 — Branch & meta surfaces API

**Status:** Accepted (Phase 6)
**Date:** 2026-10-18
**Deciders:** A0 (orchestrator), A1 (domain), A2 (generation), A6/A7 (branch & meta UX)

## Context

Phase 6 adds the story map, branch switching, the memory panel, the prompt
inspector and the usage meter. PLAN §13.4 already names `branches.tree` and
`promptSnapshots.getForBeat/getForCandidate`, but the surfaces need a few
additive reads the frozen table did not spell out:

- the map wants one lazy payload with branches **and** every beat/candidate;
- the prompt inspector must reach snapshots for casting/memory/director-meta
  generations, which carry no beat or candidate id;
- option batches link their snapshot through `candidates.promptSnapshotId`,
  not `promptSnapshots.candidateId`;
- `facts.listForPath` deliberately excludes muted facts and marks nothing,
  so the memory panel could neither unmute nor distinguish off-path rows;
- continuity warnings were write-only (no list/dismiss).

## Decision

Additive, no schema change:

**Queries**
- `branches.tree(sceneId)` — branches + all beats (text preview truncated to
  220 chars) + candidates + `activeBeatIds`; one lazy payload for the map.
- `generation.snapshots.getForBeat(beatId)` / `getForCandidate(candidateId)` —
  full snapshots including rendered block text; `getForCandidate` follows
  `candidates.promptSnapshotId` first, with the `by_candidate` index as a
  forward-compatible fallback.
- `generation.snapshots.listForScene(sceneId, limit?)` — recent snapshots
  (turn/options/casting/memory/directorMeta/sampleLine) so the inspector works
  for every generation type even without a selected beat.
- `facts.listForScene(sceneId)` — every fact (active + muted) with `onPath`
  and `inContext` flags (`inContext = onPath || isPinned`, the ADR-001 global
  pin override).
- `warnings.listForScene(sceneId, includeDismissed?)` — new `convex/warnings.ts`
  module.

**Mutations**
- `warnings.dismiss(warningId)` — reversible; a new `patchWarning` inverse kind
  keeps it inside the L6 action log.

**Flags & build assertions**
- `NEXT_PUBLIC_FABULA_FF_COMPARE=1` gates the read-only compare view (the
  client-visible form of PLAN's `FABULA_FF_COMPARE`; graduates in H2 Phase 11).
- `scripts/check-bundle-lazy.ts` (`bun run check:bundles`) locates the chunk
  containing the `data-fabula-map` marker and asserts it is absent from the
  play route's initial chunk list — the map's lazy-load assertion from §11.7 /
  Gate G6.

## Consequences

- No schema change; `branches.setActive` remains pure navigation (no action
  log entry — undo intentionally covers content actions, not navigation).
- Snapshots already store rendered block text (schema comment, Phase 2), so
  the inspector shows exactly what was compiled after templates or role
  revisions change; no recompilation is needed.
- Muted facts become visible and reversible from the memory panel.
- The map's `@xyflow/react` + `@dagrejs/dagre` code stays out of the initial
  play route bundle; the play route remains ~163 kB first load.
