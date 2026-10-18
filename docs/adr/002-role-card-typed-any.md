# Role-card storage: `roleRevisions.card` as `v.any()` typed through contracts

**Status:** Accepted

## Context

`roleRevisions` stores frozen snapshots of the full role card for versioned
revisions. Convex validators must describe shapes structurally, and
expressing the card, including nested objects, optional fields, and
`relations: Array<{ toRoleId: Id<"roles">, ... }>`, a second time inside the
schema would duplicate `convex/lib/validators.ts` and drift from the zod
`RoleCardSchema` over time.

## Decision

- The `card` column is declared `v.any()` at the schema level.
- All writes and reads go through typed helpers; the zod `RoleCardSchema` in
  `convex/shared/contracts.ts` is the single source of truth for the card's
  shape (used by casting outputs, fixtures and the UI).
- `tests/convex/templates.test.ts` and `tests/contracts.test.ts` guard
  writer/reader agreement; revision writes snapshot `cardFromRole()` which is
  the same shape the zod schema describes.

## Consequences

- Losing schema-level validation for one column, gaining one authoritative type
  definition and no duplication drift.
- If Convex adds ergonomic typed JSON validators, revisit and replace `v.any()`
  with the structural validator plus an equality test against the zod shape.
