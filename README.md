# Fabula

Realtime roleplay platform where the **entire cast is AI** and the human is the
director. Create a scene, cast an ensemble of distinct AI roles, and steer the
story three ways: pick one of the AI-generated paths, drop an out-of-character
director note, or write a line yourself. Every choice can branch; nothing is
ever destroyed.

> **Status: Phases 0–7 complete** (foundation, domain core, generation engine,
> app shell & design system, cast generation UX, play loop, branch & meta
> surfaces, archive & share). The full plan — schema, prompt architecture,
> orchestration spec, wireflows, phases, agents and acceptance criteria —
> lives in [PLAN.md](./PLAN.md).

## What works today

- **Archive & share** (Phase 7): end detection surfaces a non-modal “Wrap
  scene?” offer after consecutive resolution signals — never an automatic
  archive. Wrapping freezes the tree, runs a final summary pass and is one
  ⌘Z away from reopening; archived scenes are story-immutable server-side
  while remaining readable, shareable and exportable.
  - **Archive** (`/s/[sceneId]/archive`): read-only replay of every branch
    root→tip, a branch explorer, ghosts preserved as “paths not taken”, the
    frozen facts/summaries/notes ledger, and share/export actions.
  - **Exports**: golden-tested markdown (mainline first, then branch deltas)
    and lossless JSON (ids, branch links, candidates, facts; prompt snapshots
    optional) generated in the browser — JSON opens cleanly in `jq`.
  - **Share links** (`/share/[token]`): viewer links stream the scene live
    read-only; director links can pick path options; both show a “N watching”
    presence badge (`@convex-dev/presence`), and revocation closes the door
    immediately (E2E-07, cross-context with no session).
- **Branch & meta surfaces** (Phase 6): the inspector (Memory · Prompts · Map ·
  Usage) is URL state (`?inspector=…&beat=…`), inline as a third desktop pane
  and a sheet on tablet/mobile.
  - **Branch gutter**: a rail beside the thread with active-path markers,
    decision diamonds, pins/failures, and fork chips at divergence beats —
    click scrolls to a beat; a fork chip switches branches.
  - **Story map** (lazy `@xyflow/react` + dagre chunk, bundle-asserted by
    `bun run check:bundles`): branches colored by the identity palette,
    canon vs alternative edges, who/how/when metadata, a keyboard-navigable
    beat list, and — behind `NEXT_PUBLIC_FABULA_FF_COMPARE=1` — a read-only
    two-branch compare with divergence markers.
  - **Branch switching** recomputes projection only (L5): a “Context updated”
    toast, no regeneration, nothing destroyed.
  - **Memory panel**: facts in context, global pins (visually distinct —
    “crosses branches”), off-path exclusions, muted rows with unmute,
    summaries, and dismissible continuity warnings — all reversible.
  - **Prompt inspector**: rendered block-by-block text for any beat/options
    generation plus recent casting/memory/director-meta snapshots, with
    template key@version, block hashes, token counts and budget actions.
  - **Usage meter**: estimated totals + per-tier breakdown and soft-cap
    warnings at 80% / 100% (generation is never hard-blocked in v1).
- **Play loop** (Phase 5): the `/s/[sceneId]` director console with a
  TanStack-Virtual thread (200-beat evidence: 8 rendered rows, 60.4 fps),
  chat/script/novel renderers with per-role accent borders, pin and
  failed-beat retry rows, smart autoscroll + Jump-to-latest (⌘J), and
  persisted streaming deltas through `useUIMessages(..., {stream:true})` so a
  reload mid-generation resumes without lost or duplicated tokens.
  - Floor indicator with speaker, deterministic next-speaker preview, burst
    counter, pause/resume, abort, and "Offer paths"; @mention forces a speaker,
    queue-next and steal-floor abort-and-handoff are wired.
  - Inline path options under their parent beat, ghost candidates collapsed by
    default with later-pick fork warnings, optimistic picks, Alt/⌥1–4 picking,
    and offer-paths at the tip.
  - Three-mode composer: steer (with quick chips + active note chips),
    in-character writing as any role, and steer-and-regenerate (forks a new
    take). cmdk powers mention autocomplete.
  - Director bar: undo, offer paths, pause/resume, edit-fork with explicit
    branch copy, regenerate (server-streamed fork, pointer restore on failure),
    pin beats, and wrap/end scene. Beat text is the source of truth; transport
    messages are never rendered twice.
  - Live E2E: E2E-01≤3 screens, E2E-02 two-context pick sync, E2E-03
    reload-mid-stream token-exact resume, E2E-04 edit-fork + memory leak +
    branch switch, E2E-07 viewer read-only + director pick + revoke, wrap →
    archive → markdown/JSON export, keyboard picks, mention override, pause
    blocking auto-floor, and the 200-beat perf probe.
- **Cast generation UX** (Phase 4): `/` onboarding, the three doors
  (`/new/quick`, `/new/wizard`, `/new/templates` with six Appendix-A presets),
  the validated four-step wizard (nuqs step state), and one audition surface:
  role cards with the shared RHF+zod editor, whole-field locks, per-field /
  per-role / whole-cast regeneration, vibe steers with diff badges, duplicate /
  add blank / off-stage / restore, @dnd-kit reorder (pointer + keyboard),
  cached sample-line sheet, deterministic gradient+monogram avatars, cast-size
  stepper with the tier policy, and an opening-beat preview (generate / reroll /
  write-your-own) committed atomically at Start. Quick start reaches a rendered
  opening in ≤3 navigations (E2E-01). The same interface runs against **live
  Convex**: anonymous sign-in, scene creation, casting, opening preview and
  commit were smoke-tested against the self-hosted backend with the
  deterministic fake gateway.
- **App shell & design system** (Phase 3): dark-first theme with a WCAG-AA
  tested token system (light mode included; `tests/theme/contrast.test.ts`),
  8-slot identity palette, responsive three/two/single-pane shell with
  bottom/side sheets + safe areas, states catalog
  (loading/empty/error/offline/reconnecting), command palette (⌘K), keymap
  registry + shortcuts dialog (Appendix B, collision-tested), motion presets
  with reduced-motion, skip link + focus-trapped dialogs. Screenshots
  archived in `docs/screenshots/` (320 → 2560).
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
  persisted atomically with their snapshot; the play thread renders them inline
  and keeps unpicked candidates as ghosts.
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

No backend handy? `NEXT_PUBLIC_FIXTURES=1 bun run dev` runs the three doors and
the audition on deterministic local fixtures for UI-first development. E2E does
**not** use fixtures: it boots the open-source Convex backend + fake model.

Run everything:

```bash
bun run check          # typecheck + lint + tests (424 unit/integration tests)
bun run test:e2e       # builds live, boots local Convex + fake model, Playwright
bun run e2e:server     # the backend+app server Playwright starts (manual runs)
bun run build          # production build
bun run check:bundles  # lazy-chunk assertion (run after build; CI does)
bun run seed           # seed prompt templates (needs a running backend)
bun run fixtures       # regenerate UI fixtures
bun run terminology    # guard: no internal jargon in user-facing strings
```

`test:e2e` expects ports 3100 (app) and 3210/3211 (Convex backend) to be free;
it creates an anonymous local deployment in `.env.local` on a clean checkout and
generates auth keys. Set `FABULA_E2E_NO_SERVER=1` to run Playwright against an
already-running e2e server.

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
