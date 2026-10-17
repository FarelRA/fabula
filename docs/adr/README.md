# Architecture Decision Records

Numbered notes for decisions that extend or deviate from `PLAN.md`.
Plan §13.3 requires an ADR for frozen-contract changes; toolchain decisions
are recorded here too.

| ADR | Decision | Status |
|---|---|---|
| [001](./001-pinned-facts-global-override.md) | Pinned facts are explicit scene-global canon overrides (the one sanctioned path leak) | Accepted |
| [002](./002-role-card-typed-any.md) | `roleRevisions.card` is stored as `v.any()`, typed through `convex/shared/contracts.ts` | Accepted |
| [003](./003-bun-toolchain.md) | Standardize installs, scripts and CI on Bun; scripts stay package-manager agnostic | Accepted |
| [004](./004-phase2-additive-schema.md) | Additive schema fields from Phase 2 (`roles.sampleCache`, snapshot block text, extra generation modes) | Accepted |
