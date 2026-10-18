#!/usr/bin/env bash
# Type-checks the file set the Docker image build context actually contains.
#
# `.dockerignore` drops tests/, e2e/, docs/ and caches from the image context.
# Anything a production build type-checks against must live in the surviving
# files; a declaration that only exists under tests/ (for example vite/client's
# `*.css` module declaration, previously pulled in through
# `tests/vite-env.d.ts`) breaks the image build while the dev tree stays green.
#
# Mirrors the .dockerignore exclusions, then runs the same typecheck CI runs.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
ctx="$(mktemp -d)"
trap 'rm -rf "$ctx"' EXIT

tar -C "$root" -cf - \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./.convex' \
  --exclude='./.git' \
  --exclude='./.github' \
  --exclude='./coverage' \
  --exclude='./playwright-report' \
  --exclude='./test-results' \
  --exclude='./tsconfig.tsbuildinfo' \
  --exclude='./docker/.env' \
  --exclude='./PLAN.md' \
  --exclude='./docs' \
  --exclude='./tests' \
  --exclude='./e2e' \
  --exclude='*.log' \
  . | tar -C "$ctx" -xf -

ln -s "$root/node_modules" "$ctx/node_modules"
(cd "$ctx" && bunx tsc --noEmit)

echo "docker-context typecheck OK (same file set the image build sees)"
