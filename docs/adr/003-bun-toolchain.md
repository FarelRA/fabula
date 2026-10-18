# Bun as the standard toolchain (scripts stay package-manager agnostic)

**Status:** Accepted

## Context

The original stack decision selected pnpm. The implementation environment provides a Bun-based
toolchain (node/npm/pnpm are Bun shims), and the ecosystem state at
implementation time is:

- **Vitest 5 runs cleanly under Bun** (verified with a spike before scaffolding).
- **Convex CLI + local backend + codegen work under Bun** (`convex dev --once`
  configured a local deployment and generated `_generated/`).
- **typescript-eslint does not yet support TypeScript 7** (the registry's
  latest `typescript`): it hard-errors. Installing `typescript@^6` resolves it.
- **ESLint 10 + eslint-config-next 16** break the FlatCompat path
  (`JSON.stringify cannot serialize cyclic structures`); ESLint 9 +
  eslint-config-next 15 (the Next 15 pairing) work.

## Decision

- Standardize installs, scripts and CI on **Bun**: `bun.lock` is committed,
  CI uses `oven-sh/setup-bun`.
- `package.json` scripts invoke **binaries directly** (`next`, `vitest`,
  `tsc`, `eslint`, `tsx`, …), so any package manager (`pnpm install && pnpm
  run check`) works on machines that have pnpm; only the lockfile/CI differ.
- Pin `typescript@^6` until typescript-eslint supports TS 7, and
  `eslint@^9` + `eslint-config-next@^15` to match Next 15.
- Docker uses `oven/bun` for build stages and `node:22-alpine` for the
  standalone runtime.

## Consequences

- Zero divergence between local, CI and Docker builds in this environment.
- A future migration to TS 7 / ESLint 10 requires only devDependency bumps
  once the lint stack catches up.

## Update. App shell work

Three more Bun-ecosystem pins surfaced while building the app shell:

- **jsdom pinned to `^26`**: jsdom ≥ 27's generated-IDL brand checks fail
  under Bun, even a bare `new JSDOM()` throws
  `'addEventListener' called on an object that is not a valid instance of
  EventTarget`. jsdom 26 passes; revisit when upstream or Bun fixes it.
- **Vitest JSX via `oxc`**: Next's tsconfig uses `jsx: "preserve"`, and
  Vite 8 resolves `oxc` (which vitest pre-seeds), so `esbuild.jsx` options are
  ignored. `vitest.config.ts` sets
  `oxc: { jsx: { runtime: "automatic", importSource: "react" } }`.
- **Playwright E2E port 3100**: the dev sandbox reserves :3000 for an
  infrastructure service (Basic-auth Express), so the E2E webServer honors
  `FABULA_E2E_PORT` with default 3100; CI uses the same default.
- **Keymap robustness**: symbol chords (e.g. `?`) match even when the event
  reports `shiftKey=false` (Playwright, some IMEs), for symbol keys the
  character itself encodes shift; letters/digits still require exact shift.
