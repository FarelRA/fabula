# ADR-003: Bun as the standard toolchain (scripts stay PM-agnostic)

**Status:** Accepted (Phase 0)

## Context

PLAN.md §3 selected pnpm. The implementation environment provides a Bun-based
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
  once the lint stack catches up (tracked in PLAN §19.1 style spikes).
