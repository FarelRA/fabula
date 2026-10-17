# Fabula

Realtime roleplay platform where the **entire cast is AI** and the human is the
director. Create a scene, cast an ensemble of distinct AI roles, and steer the
story three ways: pick one of the AI-generated paths, drop an out-of-character
director note, or write a line yourself. Every choice can branch; nothing is
ever destroyed.

> **Status: Phases 0–2 complete** (foundation, domain core, generation engine).
> The full plan — schema, prompt architecture, orchestration spec, wireflows,
> phases, agents and acceptance criteria — lives in [PLAN.md](./PLAN.md).

## What works today

- **Generation engine**: pure prompt compiler (fixed 8-block order, golden
  snapshots, byte-deterministic), token-budget policy (system ≤25%, context
  compaction, protected blocks), model tiers + provider-agnostic gateway with
  a **deterministic fake** for tests/CI.
- **Streaming turns** through the Convex Agent component: deltas persisted
  (`saveStreamDeltas`) so streams survive reloads; beat lifecycle
  (streaming → finished/failed/aborted), snapshots + usage on every
  generation, failure isolation (no beat before the first delta; aborted
  partials become artifacts that never move the tip).
- **Path options** with validation → repair pass → deterministic fallback,
  persisted atomically with their snapshot (inline cards render in Phase 5).
- **Casting agent**: full cast with programmatic constraint checks
  (connected graph, alliance + friction, distinct voices/hooks, tier policy),
  up to 2 repair passes, human-role generation, cast/field regen that
  respects locks byte-for-byte.
- **Memory agent**: rolling summaries at the cadence, fact extraction with
  dedupe, continuity warnings — each product snapshotted.
- **Director meta-agent**: decision points, responder ordering, ending
  detection, with deterministic floor fallbacks (pure `domain/orchestrate`).
- **Schema + contracts**: full v1 data model and zod contracts for every AI
  output.
- **Branch laws L1–L6** implemented and tested; **path-scoped memory** with
  the branch-isolation leak suite (pins are explicit overrides — ADR-001).
- **Undo**, identity-guarded access, revocable share links, anonymous →
  account claiming, usage ledger with per-scene rollups.
- **Prompt templates as versioned data** (18 templates, idempotent seeding).
- **Self-host scaffold**: Dockerfile + docker-compose (self-hosted Convex
  backend + dashboard + app), smoke script, CI including a self-host job.

## Quickstart (development)

```bash
bun install
bun run dev:backend   # starts local Convex (codegen) on :3210
bun run dev           # Next.js on :3000
```

Run everything:

```bash
bun run check          # typecheck + lint + tests (141 tests)
bun run seed           # seed prompt templates (needs a running backend)
bun run fixtures       # regenerate UI fixtures
bun run terminology    # guard: no internal jargon in user-facing strings
```

## Self-host (Docker)

```bash
cp docker/.env.example docker/.env   # set INSTANCE_SECRET
docker compose --env-file docker/.env up -d --build
docker compose exec backend ./generate_admin_key.sh
bun run selfhost:smoke               # backend → templates → app
```

The only external dependencies are AI provider APIs. Convex Cloud is optional;
the open-source backend is the reference target (PLAN §15.7). See
[docker/README.md](./docker/README.md) for the runbook.

## Branch laws in one table

| Law | Meaning |
|---|---|
| L1/L2 | Picking an option at the active tip appends it to the current branch |
| L3 | Picking a ghost option from an earlier beat forks a new branch there |
| L4 | Edit/rewrite/regenerate always forks from the parent; the original survives |
| L5 | The active path defines memory; switching branches recomputes context |
| L6 | Nothing is destroyed; every directorial action is undoable |

## Layout

```
convex/           backend: schema, domain laws, functions, prompts, libs (Convex is the only backend)
src/              Next.js app (App Router) — shell lands in Phase 3
tests/            Vitest (pure logic) + convex-test integration suites
scripts/          fixtures, seeding, terminology guard, self-host smoke
docker/, docker-compose*.yml, Dockerfile     self-host stack
docs/adr/         architecture decision records
```

## Docs

- [PLAN.md](./PLAN.md) — the complete product plan (horizons, phases, agents, acceptance).
- [docs/adr/](./docs/adr/) — decision records (pinned-facts override, card typing, Bun toolchain).
- [docker/README.md](./docker/README.md) — self-host runbook.

The README is expanded to the full §16 outline in Phase 8 (streaming/resume
internals, prompt blocks, orchestration, glossary).
