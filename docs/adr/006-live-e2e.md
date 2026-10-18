# ADR-006 — E2E against the local Convex backend

**Status:** Accepted (Phase 5)
**Date:** 2026-10-18
**Deciders:** A0 (orchestrator), A8 (QA), A9 (docs/DX)

## Context

Phase 4 E2E-01 ran on the deterministic fixtures session. Phase 5’s gate
requires:

- **E2E-02** — two browser contexts observing the same scene and a pick;
- **E2E-03** — reload while a model stream is in flight, then token-exact
  resume.

Fixtures are page-scoped (`sessionStorage`) and simulate generation locally;
they cannot prove cross-context reactivity or durable stream resume. PLAN
§11.1/§15.4 already specify E2E with the fake gateway against a local Convex
backend.

## Decision

`bun run test:e2e` builds the app **live** (`NEXT_PUBLIC_FIXTURES=0`) and
Playwright starts `scripts/e2e-server.ts`, which:

1. creates/uses an anonymous local deployment in `.env.local` (clean CI);
2. starts `convex dev` (open-source backend, no cloud account);
3. provisions `FABULA_MODEL_FAKE=1`, `SITE_URL`, and generated RSA JWT keys for
   Convex Auth;
4. seeds prompt templates once functions are pushed;
5. starts Next.js on port 3100.

`FABULA_E2E_NO_SERVER=1` runs the specs against an already-running e2e server.
Fixtures remain the UI-first development mode and the component-test source of
determinism; they are no longer the E2E substrate.

The mobile Start CTA helper uses `click({ force: true })`: Playwright’s mobile
emulation mis-hit-tests the CTA on very tall audition pages even though the
button is the topmost element at its point (verified with `elementFromPoint`).
This affects only the test driver, not the product.

## Consequences

- E2E exercises real anonymous auth, real Convex reactivity, real Agent stream
  persistence, and real access control.
- CI needs the Convex CLI to boot the local backend; no Convex Cloud token or
  paid service is involved.
- E2E is slower than fixtures but deterministic; the fake model and seeded
  templates keep it fully offline.
- Tests share one local deployment, so Playwright runs with one worker
  (`fullyParallel: false`); scenarios create their own scenes/users.
