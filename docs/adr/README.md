# Architecture Decision Records

Numbered notes for decisions that extend or deviate from `PLAN.md`.
Plan §13.3 requires an ADR for frozen-contract changes; toolchain decisions
are recorded here too.

| ADR | Decision | Status |
|---|---|---|
| [001](./001-pinned-facts-global-override.md) | Pinned facts are explicit scene-global canon overrides (the one sanctioned path leak) | Accepted |
| [002](./002-role-card-typed-any.md) | `roleRevisions.card` is stored as `v.any()`, typed through `convex/shared/contracts.ts` | Accepted |
| [003](./003-bun-toolchain.md) | Standardize installs, scripts and CI on Bun; scripts stay package-manager agnostic | Accepted |
| [004](./004-opening-preview.md) | Opening-beat preview drafts live additively on `generation.opening.draft` until the play handoff | Accepted |
| [004](./004-phase2-additive-schema.md) | Additive schema fields from Phase 2 (`roles.sampleCache`, snapshot block text, extra generation modes) | Accepted |
| [005](./005-play-loop-api.md) | Phase 5 play-loop API additions: `beats.listPending`, `candidates.listForScene`, `generation.runs.active`, `generation.regenerate.beat` | Accepted |
| [006](./006-live-e2e.md) | Live E2E runs against an isolated self-hosted local Convex + deterministic fake model | Accepted |
| [007](./007-branch-meta-api.md) | Phase 6 branch & meta surfaces API: facts/warnings queries, `branches.tree`, snapshot inspection, flag-gated compare | Accepted |
| [008](./008-archive-share-presence.md) | Phase 7 archive, share & presence surfaces: wrap, freeze guards, token-scoped reads/picks, exports, presence rooms | Accepted |

Phase 8 (hardening & acceptance) introduced no schema or contract changes —
it strengthened tests, budgets, a11y, resilience and the self-host drill
within the frozen surfaces above.
