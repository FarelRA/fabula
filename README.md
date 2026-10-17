# Fabula

Realtime roleplay platform where the **entire cast is AI** and the human is the
director. Create a scene, cast an ensemble of distinct AI roles, and steer the
story three ways: pick one of the AI-generated paths, drop an out-of-character
director note, or write a line yourself. Every choice can branch; nothing is
ever destroyed.

> **Status: Phase 0 + Phase 1 complete** (foundation, contracts, domain core).
> The full plan — schema, prompt architecture, orchestration spec, wireflows,
> phases, agents and acceptance criteria — lives in [PLAN.md](./PLAN.md).

## What works today

- **Schema + contracts**: the full v1 data model (scenes, roles + revisions,
  branches, beats, candidates, facts, summaries, director notes, snapshots,
  runs, usage) and zod contracts for every AI output.
- **Branch laws L1–L6** implemented and tested: pick-at-tip extends; ghost
  picks fork; edit/regenerate always fork and preserve the original.
- **Path-scoped memory**: facts and summaries are projected along the active
  path, with the branch-isolation leak suite (unpinned facts never leak; pins
  are explicit user overrides — ADR-001).
- **Undo**: every reversible director action logs an inverse op.
- **Access control**: owner/participant identity checks, revocable viewer
  share links, anonymous → account claiming.
- **Usage ledger** with per-scene rollups and cost estimates.
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
bun run check          # typecheck + lint + tests (68 tests)
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
