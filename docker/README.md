# Fabula self-host runbook

Everything Fabula needs — the app, the Convex backend, the operator dashboard —
runs from one Docker Compose stack. The only external dependencies are the AI
provider APIs you configure. This document is the operational contract for
Phase 8.7 (PLAN §15.5–15.7); `scripts/selfhost-drill.ts` automates every step
below and is what CI runs nightly.

## Topology

| Service | Image | Purpose |
|---|---|---|
| `backend` | `ghcr.io/get-convex/convex-backend` (pin `CONVEX_IMAGE_TAG`) | database, realtime, functions/actions, scheduler, file storage |
| `dashboard` | `ghcr.io/get-convex/convex-dashboard` | operator console (env, logs, data, schedules) — expose on localhost/admin network only |
| `app` | built from this repo (`Dockerfile`, Next standalone, non-root) | UI + server components |

Data lives in the `convex-data` volume (SQLite + files by default). The
optional Postgres/S3 upgrade path is pure configuration: set `POSTGRES_URL`
and the `S3_*` variables in `docker/.env` and restart — no image change.

## Prereqs

- Linux VM (2 vCPU / 4 GB RAM to start), Docker + Compose plugin (Podman
  works too; the drill auto-detects either engine)
- Optional: a domain + Caddy (`docker/Caddyfile`) for TLS

## First run

```bash
cp docker/.env.example docker/.env     # set INSTANCE_SECRET! (openssl rand -base64 32)
docker compose --env-file docker/.env up -d --build
docker compose exec backend ./generate_admin_key.sh   # admin key for deploys
```

- API `http://127.0.0.1:3210` · HTTP actions `http://127.0.0.1:3211` ·
  dashboard `http://127.0.0.1:6791` · app `http://127.0.0.1:3000`

## Deploy code + seed + smoke

Convex functions live with the code, not the image — deploy them against the
self-hosted backend on every release, then seed templates:

```bash
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
CONVEX_SELF_HOSTED_ADMIN_KEY=<admin key> \
bunx convex dev --once        # or: bunx convex deploy --yes

NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 bun run seed
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 FABULA_APP_URL=http://127.0.0.1:3000 \
  bun run selfhost:smoke
```

### The one-command drill

```bash
bun run selfhost:drill --backup-dir backups
```

Runs: compose up → backend health → admin key → functions deploy → template
seed → smoke → data-volume backup + archive verification. Extra flags:

| Flag | Effect |
|---|---|
| `--skip-up` | stack already running (CI re-runs) |
| `--skip-deploy` | functions unchanged |
| `--backup-dir <dir>` | write + verify a `convex-data-*.tgz` archive |
| `--restore-from <file>` | **destructive**: replace the volume from a backup, restart, smoke |
| `--upgrade-tag <tag>` | rewrite `CONVEX_IMAGE_TAG`, recreate backend/dashboard, health, smoke |
| `--rollback-tag <tag>` | after an upgrade, go back and re-verify |

## Upgrades & rollback

1. Pin an exact `CONVEX_IMAGE_TAG` (e.g. `v1.47.0`) — never float `latest` in
   production.
2. Upgrade: `bun run selfhost:drill --skip-up --upgrade-tag v1.48.0
   --rollback-tag v1.47.0`. This deploys, smokes, then rolls back and smokes
   again, proving both directions.
3. The app image rolls back the same way: deploy the previous build tag (or
   previous `docker compose up -d --build` from the previous git tag).
4. Volumes are never touched by upgrade/rollback.

Keep `convex` (npm package) and `CONVEX_IMAGE_TAG` on compatible versions: the
drill always deploys the repo's functions after an upgrade, and the smoke call
exercises them.

## Backups & restore

### Default (SQLite + files in the `convex-data` volume)

```bash
bun run selfhost:drill --skip-up --skip-deploy --backup-dir backups
# → backups/convex-data-<timestamp>.tgz (+ verified archive listing)
```

Restore (destructive, tested by `--restore-from`):

```bash
bun run selfhost:drill --skip-up --skip-deploy \
  --backup-dir backups --restore-from backups/convex-data-<timestamp>.tgz
```

Manual equivalent: stop `backend`, untar the archive into the volume, start.

### Postgres + S3 upgrade path

When `POSTGRES_URL` / `S3_*` are configured, back up both:

```bash
pg_dump "$POSTGRES_URL" | gzip > backups/postgres-$(date +%F).sql.gz
aws s3 sync s3://$S3_STORAGE_FILES_BUCKET backups/s3-files/   # or mc/restic
```

Restore: `zcat backups/postgres-*.sql.gz | psql "$POSTGRES_URL"` + `s3 sync`
back into the bucket, then restart the backend. Schedule both (cron/systemd
timer) and keep archives off the VM.

## TLS (single-VM deploys)

Point DNS at the VM, edit `docker/Caddyfile` (two subdomains: app + backend
origin), run Caddy alongside the stack, and set the origins in `docker/.env`
to the public URLs (`CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`,
`NEXT_PUBLIC_CONVEX_URL`). Rebuild the app image after changing
`NEXT_PUBLIC_CONVEX_URL` — it is baked at build time.

## Operations

- **Health**: backend `GET /version`; app `GET /`; both services declare
  Docker healthchecks and `restart: unless-stopped`.
- **Logs**: `docker compose --env-file docker/.env logs -f backend app`.
- **Retention**: `DOCUMENT_RETENTION_DELAY` (documents), S3 lifecycle rules
  (files/avatars) — archived scenes are user data; only ephemeral rows expire.
- **AI provider keys** live in the Convex deployment env, never in the app
  image or compose env: dashboard → Settings → Env, or
  `bunx convex env set KEY value` with the self-hosted URL + admin key.
- **Watchdogs**: stalled generation runs are failed by the backend cron; the
  UI offers retry. No operator action required.

## Troubleshooting

| Symptom | Check |
|---|---|
| Backend unhealthy | `docker compose logs backend`; `INSTANCE_SECRET` set? ports free? |
| Dashboard login fails | regenerate the admin key (`generate_admin_key.sh`) |
| App loads but data is empty / query errors | functions not deployed — run the deploy step (drill covers it) |
| App errors about origins | `CONVEX_CLOUD_ORIGIN`/`NEXT_PUBLIC_CONVEX_URL` must match how users reach the stack; rebuild the app image after changes |
| Deploy CLI hangs | confirm `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY`; the drill falls back from `convex dev --once` to `convex deploy --yes` |

## Security notes

- Only the backend container holds provider keys; the app is stateless.
- Expose the dashboard (and ideally the backend) on an admin network or behind
  auth — they are operator surfaces.
- `INSTANCE_SECRET` must be stable across restarts and backed up: losing it
  invalidates issued tokens.

## Parity law

The self-hosted backend is the reference target (PLAN §15.7). CI's nightly
`selfhost` job boots this stack from scratch, runs the drill (including the
backup archive check), and would fail the build on any divergence. Convex
Cloud remains a convenience deployment of the same code and schema.
