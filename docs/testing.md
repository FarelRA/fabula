# Testing

How Fabula is verified: the test pyramid, the deterministic fake model, the
convex-test harness, the E2E scenarios and the CI gates. Mirrors;
every script, marker and spec below exists in the repository.

## 1. Pyramid and tooling

| Layer | Tool | Where | Scope |
|---|---|---|---|
| Pure unit | Vitest | `tests/domain`, `tests/compiler`, `tests/path`, `tests/tokenBudget`, `tests/retry`, `tests/contracts`, `tests/pricing`, `tests/export`, `tests/shell`, `tests/branches`, `tests/cast` | Branch-law reducers, path projection, compiler goldens, budget, zod contracts, pricing, exporters, keymap |
| Backend integration | `convex-test` + fake model | `tests/convex/**` | Mutations/queries/actions, run lifecycle, access control, leaks, orchestration, memory, casting, shares, usage |
| Component | Vitest + Testing Library (jsdom) | `tests/components`, `tests/director`, `tests/options`, `tests/inspector`, `tests/thread`, `tests/scenes`, `tests/archive` | Audition, option cards, composer, floor indicator, memory panel, prompt inspector, palette, route error boundaries, virtualization |
| End to end | Playwright (isolated self-hosted backend + fake model) | `e2e/**` | Scenario table below |
| A11y | axe-core (Playwright) + contrast unit test | `e2e/a11y.spec.ts`, `tests/theme/contrast.test.ts` | WCAG 2.2 AA sweeps (zero critical/serious), contrast pairs, keyboard E2E |

Vitest configuration (`vitest.config.ts`): jsdom transforms via oxc; aliases
`@convex → convex`, `@ → src`; includes `tests/**/*.test.ts(x)` and
`convex/tests/**/*.test.ts`; 20 s test/hook timeout; `@convex-dev/agent` and
`convex-test` are inlined (they ship `import.meta.glob`). Backend suites use
`// @vitest-environment edge-runtime`; component suites use
`// @vitest-environment jsdom` plus `installDomShims()`.

## 2. TDD protocol

1. Write the test slate for the change, all red.
2. Implement the minimum to green; keep the fake model doing the talking
   (never a real provider in tests or CI).
3. Refactor. Goldens change only with a review note explaining the behavioral
   change.
4. Coverage floors: **≥85% lines** on `convex/compiler`, `convex/domain`,
   `convex/lib`, `convex/shared`, the correctness core. There is no global
   floor. Note: the floor is a review-gate policy; `vitest.config.ts` does not
   currently fail on a threshold, so keep it honest when touching the core.

Cross-cutting practices used throughout the repo:

- Pure decisions live in modules without a Convex runtime
  (`convex/domain/*`, `convex/lib/path.ts`, `convex/lib/tokenBudget.ts`) so
  laws are unit-testable; mutations own only the DB mechanics.
- Every generation mode has a compile-level test (`tests/compiler/*`) and an
  action-level test (`tests/convex/*Gen.test.ts`).
- E2E asserts invariants (no lost tokens, original preserved, viewer cannot
  mutate), not pixel trivia.

## 3. The deterministic fake model

Two fakes, one switch, `isFakeMode()` (`convex/lib/modelRegistry.ts`) returns
true when `FABULA_MODEL_FAKE=1`, or when `process` is undefined (the test
simulator). The fake is **always on** in tests: `tests/convex/helpers.ts` sets
the env var at module load, and `scripts/e2e-server.ts` provisions it on the
deployment.

| Fake | File | Used by | Behavior |
|---|---|---|---|
| `FakeLanguageModel` | `convex/lib/fakeLanguageModel.ts` | Turn/regenerate streaming through the Agent component | `mockModel` that emits text deltas, honors delay/chunk/failure markers, returns fake usage; default text `"The rain keeps falling on the wrong door."` |
| `FakeGateway` | `convex/lib/fakeGateway.ts` | Structured calls (`gateway.object`) and the opening-draft stream | Matches streams by the `MODE:` marker; synthesizes **valid objects** from the rendered prompt by schema name (`options`, `directorMeta`, `summary`, `facts`, `continuity`, `casting`, `castRegen`, `fieldRegen`, `sampleLine`); default turn chunks `["The ","rain ","keeps ","falling."]` |

Because objects are synthesized from the compiled prompt lines, integration
tests need no scripting at all, the fake reads the role ids, cast size,
requested option count and cadence straight out of the prompt, so prompts and
contracts stay honest. All model output goes through the same zod contracts as
production (`FakeGateway.object` calls `req.schema.parse(raw)`).

### Control markers

Markers are **inert text to the real gateway**. Both fakes scan the full
request text, the system prompt plus message content, so the two stable
places to put them are the **scene premise** (lands in the `world` block) or a
**director note/steer** (lands in the `directorNotes` block). Beat text also
works for turn streams (context messages carry it, as `e2e/archive.spec.ts`
does).

| Marker | Effect |
|---|---|
| `[[fake:fail-before]]` | Stream errors before any delta → **no beat row** is created; run fails. |
| `[[fake:fail-mid:N]]` | Emits N words, then errors → beat is `failed` with the partial text; tip does not move. |
| `[[fake:chunks:w1\|w2\|…]]` | Scripted stream chunks (joined with single spaces), used for token-exact reload tests. |
| `[[fake:delay:MS]]` | Per-chunk delay (`simulateReadableStream`), used to reload mid-stream. |
| `[[fake:no-decision]]` | Director meta `decisionPoint: false` (overrides the cadence-derived default). |
| `[[fake:ending]]` | Director meta `endingSuggested: true` → builds the ending streak. |
| `[[fake:no-facts]]` | Facts synthesis returns `{ facts: [] }`. |
| `[[fake:options-bad]]` | Options synthesis returns one invalid option, exercises the repair pass and deterministic fallback. |

Default directorMeta synthesis: `decisionPoint` follows the cadence (`always`
or `key` → true), `responders` are the first ≤2 parsed role ids, and
`endingSuggested` is false unless the marker is present.

## 4. convex-test harness

`tests/convex/helpers.ts`:

- Test files live **outside `convex/`** so they are never deployed.
  `import.meta.glob("../../convex/**/*.*s")` loads the function modules and the
  keys are normalized to `./scenes.ts`; `_generated` **must** be included or
  convex-test cannot find the modules root.
- `makeT()` wraps `convexTest(schema, modules)` and registers the Convex
  component test doubles (`registerAgent`, `registerPresence`).
- Identity helpers: `makeUser`, `makeAnonymousUser`, `asUser(t, id)` (sets
  `tokenIdentifier: test|id`), access-control suites use real authz paths.
- `seedScene` bootstraps prompt templates like a fresh self-host
  (`api.prompts.seed.seedV1`) and creates a scene with `defaultSettings()`;
  `seedPlayableScene` adds an opening beat. `makeCard(name)` builds a valid
  role card; `tests/factories.ts` and `tests/play/fixtures.ts` cover the UI
  side.
- Suites run under an `edge-runtime` environment directive, no browser, no
  server, sub-second per case.

## 5. Component tests

Patterns (`tests/components/testUtils.tsx`):

- Render the component directly with fixture props, no Convex provider is
  mocked; data flows in as props (`tests/play/fixtures.ts`), and suites that
  navigate stub `next/navigation` (`vi.mock("next/navigation", …)`).
- `installDomShims()` stubs `matchMedia`, `ResizeObserver`, pointer capture
  and `scrollIntoView` for Radix/cmdk; `stubMatchMedia(width)` drives
  responsive branches deterministically.
- Interactions go through `@testing-library/user-event`; assertions use
  `jest-dom`. Examples: audition grid (`tests/components/audition.test.tsx`),
  floor indicator (`tests/director/floor.test.tsx`), option cards incl. ghost
  fork warnings (`tests/options/optionCards.test.tsx`), memory panel pins and
  mute disclosure (`tests/inspector/memoryPanel.test.tsx`), palette
  (`tests/components/palette.test.tsx`), route error boundaries
  (`tests/components/routeErrors.test.tsx`), thread virtualization
  (`tests/thread/threadVirtualization.test.tsx`).

## 6. E2E scenarios

Playwright projects (`playwright.config.ts`): `chromium-desktop` (Desktop
Chrome), `chromium-mobile` (Pixel 7), `firefox-desktop` (Desktop Firefox) and
`webkit-mobile` (iPhone 14). Serial (`fullyParallel: false`), 90 s timeout,
retries 1 on CI, trace `on-first-retry`; Playwright boots `bun run e2e:server`
unless `FABULA_E2E_NO_SERVER=1`. CI installs Chromium, Firefox and WebKit.

| Scenario | Spec | What it asserts |
|---|---|---|
| Quick start | `e2e/quickstart.spec.ts` | Premise to audition to rendered opening beat in **at most 3 navigations**; the audition is keyboard-operable (lock a field, open the sample-line dialog, start the scene); screenshots archived to `docs/screenshots/`. |
| Live sync | `e2e/play.spec.ts` | Two browser contexts on one scene: a pick in A appears as canon in B without reload; unpicked paths become ghosts consistently in both. |
| Reload resume | `e2e/play.spec.ts` | Reload mid-stream (`[[fake:delay:180]]`, 20 chunks): the stream resumes; the finalized beat contains every token exactly once (single beat row). |
| Fork and leak | `e2e/branch.spec.ts` | Edit the tip, which forks from the parent while the original stays intact; the memory panel shows `FACT_B_44E` and hides `FACT_A_9C1`; the map shows both branches; switching back triggers the context-updated toast and restores A; the prompt inspector resolves the turn snapshot (`contract.roleplay v1`, at least 6 blocks); the usage meter shows recorded usage. |
| Tier and burst law | *(lower layers)* | Six-role tier law (a background role speaks only when addressed or affected) and the burst cap: `tests/domain/orchestrate.test.ts`, `tests/cast/tierPolicy.test.ts`, `tests/director/floor.test.tsx`. No dedicated browser spec exists. |
| Failure isolation | `e2e/resilience.spec.ts` plus lower layers | A failure before the first token creates **no beat row** and leaves the path unchanged; the next turn recovers. A mid-stream failure keeps the partial as a failed pending beat (the UI shows the failed attempt with `Partial:`), and retry lands a new canon attempt while the failed one stays preserved off path. Going offline shows the banner and locks story mutations; recovery unlocks without reload. Lower layers: `tests/convex/generationTurn.test.ts` (state machine), `tests/convex/playLoop.test.ts` (pending and failed children). |
| Share links | `e2e/share.spec.ts` | A viewer link streams live read-only (no pick, composer or actions) and the presence badge appears; a director link can pick and the pick lands in the viewer live; revocation closes the viewer while the director link stays valid. |
| Responsive sweep | all specs across all four profiles, plus `e2e/shell.spec.ts` and `e2e/a11y.spec.ts` | Mobile and desktop profiles run every scenario; the shell spec captures 320/768/1280/2560 evidence; keyboard-only walkthroughs (skip link, palette, shortcuts) live in `shell.spec.ts` and `quickstart.spec.ts`; the accessibility sweep covers the landing screen, the three doors, quick start, wizard and templates (dark and light), the play shell (idle, inspector, palette, shortcuts dialog), archive replay and the shared viewer with axe-core WCAG 2.2 AA, failing on any critical or serious finding (desktop profile, reports attached as artifacts). |
| Keyboard walkthrough | `e2e/keyboard.spec.ts`, `e2e/shell.spec.ts` | The first path is taken with the pick shortcut, the pick is undone with the undo shortcut, the inspector opens, the lazy story map opens, jump-to-latest scrolls back, and a mid-stream abort keeps the partial (fewer than all chunks on the path). Inspector and map assertions are desktop-scoped; the shell spec covers the palette and the shortcuts dialog. |
| Performance trace | `e2e/perf.spec.ts` | A 200-beat virtualized thread: rendered rows below 60, animation-frame scroll above 45 fps over 1.5 s, attachment and log for evidence; desktop profile only. See the bundle and performance section below. |

`e2e/helpers.ts` provides `createLiveScene` (quick start through the audition),
`sceneIdFromUrl`, `ownerClient` (anonymous session JWT attached to a
`ConvexHttpClient` against `FABULA_E2E_CONVEX_URL`, default
`http://127.0.0.1:3210`), `pauseAndSettle`, `pathBeats`, `waitForOptions` and
`firstOptionText`.

## 7. Running everything locally

| Command | What it does |
|---|---|
| `bun run test` | Vitest run: unit + component + convex-test (`bun run test:watch` for watch mode). |
| `bun run check` | `tsc --noEmit && eslint . --max-warnings 0 && vitest run`, the pre-PR gate. |
| `bun run build` | Production Next.js build (needed before bundle assertions). |
| `bun run check:bundles` | Lazy-chunk assertion plus route JS gz budgets after a build. |
| `bun run check:dockerctx` | Type-checks the file set the Docker image context contains (`.dockerignore`-filtered). Catches whatever only exists under `tests/`, `e2e/` or `docs/`, which the image build never sees. |
| `bun run terminology` | UX-language guard. |
| `bun run test:e2e` | Builds with `NEXT_PUBLIC_FIXTURES=0` and `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`, then Playwright starts the isolated e2e server. |
| `FABULA_E2E_NO_SERVER=1 bun run test:e2e` | Reuse an already-running e2e server (env var is read by `playwright.config.ts`; `webServer` is disabled). |
| `bun run e2e:server` | Start the backend + app server manually (same script Playwright uses). |
| `bun run seed` | Seed prompt templates against a running backend. |
| `bun run fixtures` | Regenerate the UI fixtures used by `NEXT_PUBLIC_FIXTURES=1 bun run dev`. |

E2E port map: **3100** app (`FABULA_E2E_PORT`/`PORT`), **3210** self-hosted
Convex backend (`/version` health check; `NEXT_PUBLIC_CONVEX_URL`), **3211**
Convex HTTP/site (`NEXT_PUBLIC_CONVEX_SITE_URL`). All three must be free.

## 8. The isolated E2E server (`scripts/e2e-server.ts`)

No cloud account, no managed service, no provider calls. On start it:

1. Ensures `.env.local` names a **local anonymous** Convex deployment
   (`CONVEX_DEPLOYMENT=anonymous:…`, URLs 3210/3211); refuses to run against a
   cloud deployment.
2. Spawns `bunx convex dev` and waits for `http://127.0.0.1:3210/version`.
3. Provisions deployment env: `FABULA_MODEL_FAKE=1`, `SITE_URL`, and Convex
   Auth keys (`JWT_PRIVATE_KEY`, `JWKS`) generated into `.convex/e2e-auth/`
   when missing.
4. Runs `bun run seed` until the function push lands (90 s budget), the fake
   prompt templates are deployment data.
5. Starts Next.js with the e2e `PORT`.

On shutdown it terminates Next and Convex and scopes a `pkill` to this
project’s `convex-local-backend` so parallel checkouts don’t interfere. This is
the same topology used by CI’s `e2e` job.

## 9. Terminology lint (`scripts/check-terminology.ts`)

Scans `src/**.ts(x)` for the forbidden UX words **thread** and **agent**
(case-insensitive, word boundaries) inside string literals, template literals
and JSX text. Comments, imports/module specifiers and
`thread.jumpToLatest` (a frozen keymap identifier) are allowlisted. Any hit
prints the file:line and exits 1. The check is part of CI (`bun run
terminology`), keeping the UI language (“role”, “character”, “scene”) honest.
v1 scans `src/` only; the README excerpt check from.6 is not wired.

## 10. Bundle and performance assertions

- **Lazy map**: after
  `bun run build`, it reads `.next/app-build-manifest.json`, finds the chunk
  containing `data-fabula-map` (the branch map marker) and fails if that chunk
  is in the **initial** chunk list for route `/s/[sceneId]/page`. Run in CI
  right after the build.
- **Thread perf** (`e2e/perf.spec.ts`): seeds 200 beats through the
  authenticated HTTP client, asserts the virtualized thread renders fewer than
  60 `beat-row`s, then measures `requestAnimationFrame` frames while
  programmatically scrolling for 1.5 s, requires > 10 frames and > 45 fps,
  attaches the numbers as test evidence. v1 uses this rAF measurement rather
  than a browser trace assertion; treat it as the regression detector.
- **Route JS budgets** (`scripts/check-bundle-budgets.ts`): gzips each route’s
  initial chunks from `app-build-manifest.json` and fails over budget. Current
  budgets: `/` 250, `/new` 250, `/new/quick` 340, `/new/wizard` 340,
  `/new/templates` 250, `/s/[sceneId]` 250, `/s/[sceneId]/archive` 250,
  `/share/[token]` 250 kB gz. `bun run check:bundles` runs this together with
  the lazy-map assertion; CI runs both after the build.

## 11. CI (`.github/workflows/ci.yml`)

| Job | Steps |
|---|---|
| `verify` | `bun install --frozen-lockfile` → `typecheck` → `lint` → `terminology` → `test` → `check:dockerctx` → `build` (with `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`) → `check:bundles`. |
| `e2e` | install Chromium, Firefox and WebKit → `bun run test:e2e` with `FABULA_E2E_PORT=3100`. |
| `selfhost` (nightly / manual) | Configures `docker/.env` (generated `INSTANCE_SECRET`), logs in to GHCR for the Convex images, then runs the full release drill (`bun run selfhost:drill --backup-dir backups`): compose up → health → functions deploy → seed → smoke → data-volume backup + archive verification; stack logs dumped on failure and the verified backup uploaded as a build artifact. No real-model calls; the nightly real-model smoke behind an environment flag is not wired. |

The branch-isolation leak suite is part of `bun run test`, so a leak fails the
`verify` job. See `docs/branch-and-memory.md` for the leak suite.
