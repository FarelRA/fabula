# ADR-001: Pinned facts are explicit scene-global canon overrides

**Status:** Accepted (Phase 1)

## Context

Law L5 (PLAN §1.1) says the active path defines memory: facts from other
branches must never leak into a compiled prompt. But the director's chair also
needs a "make canon" action: the user can pin a fact, which means "this is
true in this story regardless of the branch I'm on". Those two requirements
collide for facts that live on non-active branches. Silently honoring pins
would make the leak suite unsatisfiable; silently ignoring them would break
the product promise.

## Decision

- `facts.isPinned = true` **is** the sanctioned exception: pinned facts compile
  into prompts on every branch.
- Pins are only ever set by an explicit user action (UI labels it "make canon"),
  are visually distinguished in the memory panel, and are recorded in the
  action log (undoable).
- The branch-isolation leak suite asserts absence of **unpinned** cross-path
  facts. It separately asserts that pinned cross-path facts appear only when
  `isPinned` is true.
- Muted facts (`status: "muted"`) never compile, pinned or not.

## Consequences

- "No leak, ever" is precisely: *no automatic cross-path leakage*. Explicit
  director overrides are part of the product, auditable and reversible.
- The H2 merge tool (Phase 11.3, ADR-003) reuses this exact override semantics
  with a `merged` marker instead of `pinned`.
