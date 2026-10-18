# Acceptance run — v1.0.0 (Horizon 1)

**Date:** 2026-10-18
**Scope:** PLAN §17.1 checklist (Milestone 1 / Horizon 1), all 17 criteria.
**Environment:** Linux (arm64), Bun 1.4.2, Next.js 15.5.28, TypeScript 6,
open-source Convex backend 1.47 (isolated local deployment), deterministic fake
model (`FABULA_MODEL_FAKE=1`) — no cloud account, no provider calls.

## Gates executed

| Command | Result |
|---|---|
| `bun run check` (tsc + eslint + vitest) | **429 unit/integration tests passed** across 69 files; 0 lint warnings |
| `bun run build` + `bun run check:bundles` | lazy map chunk verified absent from route initial JS; all 8 route JS budgets pass |
| `bun run test:e2e` (fresh build, isolated backend, 4 profiles) | **69 passed / 19 skipped / 0 failed** — chromium-desktop, chromium-mobile (Pixel 7), firefox-desktop, webkit-mobile (iPhone 14) |
| `bun run terminology` | no internal jargon in user-facing strings |
| `bun run selfhost:drill` | executed by the nightly CI `selfhost` job (see §17.1 #17) |

Route budgets (kB gz, measured): `/` 118.3 / 250 · `/new` 107.0 / 250 ·
`/new/quick` 280.1 / 340 · `/new/wizard` 286.8 / 340 · `/new/templates`
190.9 / 250 · `/s/[sceneId]` **160.4 / 250** (PLAN §11.7) ·
`/s/[sceneId]/archive` 114.5 / 250 · `/share/[token]` 114.5 / 250.

Thread performance (200-beat scene, `e2e/perf.spec.ts` attachment):
**6 rows rendered**, 92 rAF frames in 1.5 s → **60.8 fps**.

The 19 skips are by design: the axe sweep runs on the desktop profile only
(12), the perf trace and the responsive-screenshot evidence run on
chromium-desktop (6), and Playwright cannot emulate offline mode on Firefox
(1 — the offline contract runs on Chromium and WebKit).

## §17.1 checklist — evidence

| # | Criterion | Evidence |
|---|---|---|
| 1 | Quick start → playable scene in ≤3 screens | `e2e/quickstart.spec.ts` (all four profiles): premise → audition → rendered opening beat |
| 2 | Cast coherent; every role editable; locks + vibe-steer work | `e2e/quickstart.spec.ts` (audition keyboard flow, sample-line dialog), `tests/cast/*` (constraints, presets, tier policy), `tests/components/audition.test.tsx` (field edit, locks, regen payloads); casting constraint checker suite `tests/domain/castConstraints.test.ts` |
| 3 | Two devices: pick on one updates the other instantly | `e2e/play.spec.ts` E2E-02 (two Playwright contexts, canon beat < 1 s, ghosts consistent) |
| 4 | Reload mid-generation: stream resumes, token-exact | `e2e/play.spec.ts` E2E-03 (`[[fake:delay:180]]`, 20 chunks, reload mid-stream, single finalized row containing every token exactly once) |
| 5 | Edit a past beat forks; original intact; active-path-only memory (leak test) | `e2e/branch.spec.ts` E2E-04 (fork + map + memory switch + "Context updated"), `tests/convex/projectionLeak.test.ts` (all modes, `FACT_A_9C1`/`FACT_B_44E`), `tests/convex/branchLaws.test.ts` |
| 6 | 6 roles: tiers behave; background speaks only when mentioned | `tests/domain/orchestrate.test.ts` (background never enters via tension; responds when addressed; burst cap `shouldAutoBurst`), `tests/cast/tierPolicy.test.ts`, `tests/convex/generationTurn.test.ts`, plus live mention E2E in `e2e/play.spec.ts`. **Deviation:** no dedicated Playwright six-role spec in v1 (tier law is engine-level; documented in `docs/testing.md` §6) |
| 7 | Prompt inspector shows compiled blocks for any message | `e2e/branch.spec.ts` (beat actions → Inspect prompts → turn snapshot with `contract.roleplay v1`, ≥6 blocks), `tests/convex/phase6.test.ts`, snapshot writer tests |
| 8 | Generation failure never corrupts the tree | `e2e/resilience.spec.ts` E2E-06 (fail-before → no beat row; fail-mid → failed attempt preserved, retry forks cleanly), `tests/convex/generationTurn.test.ts`, `tests/convex/playLoop.test.ts`; abort mid-stream keeps the partial as canon (`e2e/keyboard.spec.ts`, 16-chunk stream cut short) |
| 9 | 320px → 21:9 correct; touch + keyboard | `e2e/shell.spec.ts` responsive screenshots (`docs/screenshots/shell-320/768/1280/2560.png`), `docs/screenshots/play-375.png`, every scenario runs on desktop + mobile profiles, full keyboard walkthroughs (E2E-09) |
| 10 | WCAG 2.2 AA: keyboard, focus, aria-live, contrast | `e2e/a11y.spec.ts`: axe-core `wcag2a/aa + wcag21aa + wcag22aa` sweeps on landing (dark + light), doors, quick, wizard, templates, play shell (idle, inspector, palette, shortcuts dialog), archive replay and shared viewer — **zero critical/serious**; reports attached per scan; contrast tokens unit-tested (`tests/theme`); streaming live region throttled (`useThrottledValue` 700 ms); dialog focus-trap tests (`tests/components/dialogFocus.test.tsx`) |
| 11 | Every surface has loading/empty/error/offline/reconnecting states | `src/components/shell/states.tsx` + `tests/components/states.test.tsx`; route error boundaries for root, casting flow, play/archive and share (`tests/components/routeErrors.test.tsx`); offline/reconnect banners in the app shell with mutation locks (`e2e/resilience.spec.ts` offline test) |
| 12 | Usage meter matches ledger; soft cap warned | `tests/convex/sharesClaimUsage.test.ts`, `e2e/branch.spec.ts` (usage meter shows recorded, "estimated" labeling) |
| 13 | Share viewer cannot mutate; director can; revoke works | `e2e/share.spec.ts` E2E-07 (viewer read-only, director pick propagates live, revocation closes), `tests/convex/phase7.test.ts` (token access matrix) |
| 14 | Export markdown + JSON open cleanly; JSON tree-lossless | `e2e/archive.spec.ts` (downloads parsed from real files: JSON `format`/`version`/`exportedAt`/branches/beats + parent links; markdown structure), `tests/export/*` goldens + round-trip |
| 15 | No "thread"/"agent" in user-facing UI | `bun run terminology` green (scans `src/**`); CI runs it in `verify` |
| 16 | Budget invariants: never exceed context; never shrink contract/mode/director | `tests/tokenBudget/*` property tests (never-exceed + never-shrink + `overBudgetAction`), snapshot audit in `tests/convex/*` |
| 17 | Self-host: fresh VM → `docker compose up` → full app; only AI keys external | `scripts/selfhost-drill.ts` (up → health → admin key → functions deploy → seed → smoke → data-volume backup + archive verification → optional upgrade/rollback/restore), nightly CI `selfhost` job executing the drill, runbook `docker/README.md`. **Local drill note:** this workstation's registry access blocks `ghcr.io` (HTTP 403; `docker.io` works), so the compose images could not be pulled here — the drill is exercised by CI runners and can be re-run with `bun run selfhost:drill` on any Docker/Podman host |

## Hardening log (what Phase 8 found and fixed)

- **Live streaming lifecycle (`returnImmediately`).** The agent's
  `saveStreamDeltas: true` consumed the whole model stream before returning,
  so beat rows were created only after generation finished (replay), live text
  used the pre-delta cue row, and aborts could only act at the end. Both stream
  sites now use `{ returnImmediately: true }`, an `AbortController` fed by a
  400 ms `isAborted` watcher stops the provider stream server-side, and the
  reader loop keeps its 5-chunk check. Abort now lands mid-stream and keeps the
  partial (E2E-09 proves an aborted 16-chunk stream canonizes < 16 words).
- **Resume re-arms the floor.** Pausing and resuming with identical tip state
  could skip the burst driver (`lastAutoKey` guard). Pause/archive now disarm
  the key so resuming always re-arms it.
- **Failed-beat retry semantics.** The failed-row Retry button used to start an
  unrelated turn; it now regenerates (L4 fork) the failed attempt, matching
  PLAN §8.5, while the failed row stays preserved off-path.
- **Pick gated by unrelated runs.** A bookkeeping run (options offer, memory
  pass) could swallow ⌥1 picks; only turn-mode runs block picking now.
- **A11y:** palette button accessible name (visible text mismatch), slider
  thumb labels (tone dials), transient-toast handling in the axe sweep, and
  emulated-WebKit key-dispatch retries in keyboard specs.
- **Budgets & bundles:** new `scripts/check-bundle-budgets.ts` asserts gzipped
  first-load JS per route in CI alongside the lazy-map check.
- **Self-host:** one-command release drill + completed runbook + nightly CI
  job (the previous job never deployed functions to the fresh backend).

## Deviations & known gaps (v1.0)

1. **E2E-05 is not a dedicated Playwright spec** — tier/burst laws are covered
   at the engine layer (`tests/domain/orchestrate.test.ts`,
   `tests/cast/tierPolicy.test.ts`) plus a live mention E2E; documented in
   `docs/testing.md`.
2. **Terminology lint scans `src/**` only** — README prose is intentionally
   developer-facing and keeps technical terms; the user-facing guarantee is
   enforced where users see strings.
3. **Perf evidence is an rAF measurement**, not a CDP trace assertion
   (PLAN sketch); thresholds are generous and regression-detecting.
4. **Nightly real-model smoke** behind an env flag (PLAN §11.1) is not wired;
   all CI runs use the deterministic fake model, as planned for v1.
5. `/new/quick` and `/new/wizard` are the heaviest routes (280–287 kB gz,
   budget 340) — casting UI is loaded eagerly within those routes; split
   candidates are noted for H2.

**Result: §17.1 fully satisfied (with the deviations above recorded) → tag
`v1.0.0`.**
