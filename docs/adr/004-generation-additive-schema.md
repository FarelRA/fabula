# Additive schema fields shipped with the generation engine

**Status:** Accepted

## Context

The generation engine needed three small schema additions that
the original schema did not enumerate. All three are additive:

1. `roles.sampleCache`, cache for the audition "sample line" button, keyed by
   a stable hash of the role's card.
2. `promptSnapshots.blocks[].text`, the compiled block text itself..1
   stored only hashes/tokens/chars, but the prompt inspector's promise is
   "show the compiled blocks for any message", which is impossible
   without storing the text.
3. Three new members of the `generationMode` union, `castRegen`,
   `fieldRegen`, `continuity`, because those generations write snapshots and
   usage rows that were forced into a misleading mode ("casting"/"summary")
   without them.

Per.3 rule 6 ("any schema/contract change after G0: ADR +
coordinated bump; never silent").

## Decision

Ship the three additions as documented additive fields/enum members. Same
`generationMode` union is used consistently in `convex/schema.ts`,
`convex/lib/validators.ts` and `convex/shared/contracts.ts`.

## Consequences

- The prompt inspector can render historical prompts verbatim.
- Snapshot/usage rows distinguish cast regen, field regen and continuity
  checks from full casting runs.
- `roles.sampleCache` is bounded (one row per role) and carries a
  `createdAt` for future retention policies.
- The branch-isolation leak law is unaffected: snapshots are provenance
  records, never inputs to compilation.
