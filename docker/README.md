# Fabula self-host runbook

Everything Fabula needs (the app, the Convex backend, the operator dashboard)
runs from one Docker Compose stack. The only external dependencies are the AI
provider APIs you configure. This document is the operational contract for
production self-hosting; `scripts/selfhost-drill.ts` automates every step below
and is what CI runs nightly.

## Topology

| Service | Image | Purpose |
|---|---|---|
| `backend` | `ghcr.io/get-convex/convex-backend` (pin `CONVEX_IMAGE_TAG`) | database, realtime, functions/actions, scheduler, file storage |
| `dashboard` | `ghcr.io/get-convex/convex-dashboard` | operator console for env, logs, data and schedules; keep it on localhost or an admin network |
| `app` | built from this repo (`Dockerfile`, Next standalone, non-root) | UI + server components |

Data lives in the `convex-data` volume (SQLite and local files by default).
The optional Postgres and S3 upgrades are configuration only: set
`POSTGRES_URL` and the `S3_*` variables in `docker/.env` and restart. Every
service binds to `127.0.0.1`; the TLS overlay (see below) is the public entry
point.

## Prereqs

- Linux VM (2 vCPU / 4 GB RAM to start), Docker with the Compose plugin, or
  Podman (the drill auto-detects either engine)
- Optional: a domain plus the TLS overlay for public HTTPS

## First run

```bash
cp docker/.env.example docker/.env     # set INSTANCE_SECRET (openssl rand -base64 32)
docker compose --env-file docker/.env up -d --build
docker compose exec backend ./generate_admin_key.sh   # admin key for deploys
```

- API `http://127.0.0.1:3210` · HTTP actions `http://127.0.0.1:3211` ·
  dashboard `http://127.0.0.1:6791` · app `http://127.0.0.1:3000`

## Deploy code + seed + smoke

Convex functions live with the code, not the image, so deploy them against the
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

Runs compose up, backend health, admin key, functions deploy, template seed,
smoke, and a data-volume backup with archive verification. Extra flags:

| Flag | Effect |
|---|---|
| `--skip-up` | stack already running (CI re-runs) |
| `--skip-deploy` | functions unchanged |
| `--backup-dir <dir>` | write and verify a `convex-data-*.tgz` archive |
| `--restore-from <file>` | destructive: replace the volume from a backup, restart, smoke |
| `--upgrade-tag <tag>` | rewrite `CONVEX_IMAGE_TAG`, recreate backend and dashboard, health, smoke |
| `--rollback-tag <tag>` | after an upgrade, go back and verify again |

## TLS with Traefik

`docker-compose.tls.yml` adds Traefik as the public entry point (ports 80 and
443) and routes three hostnames to the stack: the app, the Convex API, and the
Convex HTTP actions origin. Certificates are issued by Let's Encrypt through
the HTTP-01 challenge and stored in the `traefik-acme` volume.

1. Point DNS at the VM: `APP_HOST`, `CONVEX_HOST`, `CONVEX_SITE_HOST`.
2. Set in `docker/.env`:

```bash
ACME_EMAIL=ops@example.com
APP_HOST=fabula.example.com
CONVEX_HOST=api.fabula.example.com
CONVEX_SITE_HOST=site.fabula.example.com
CONVEX_CLOUD_ORIGIN=https://api.fabula.example.com
CONVEX_SITE_ORIGIN=https://site.fabula.example.com
NEXT_PUBLIC_CONVEX_URL=https://api.fabula.example.com
```

3. Start with the overlay:

```bash
docker compose --env-file docker/.env \
  -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

Rebuild the app image after changing `NEXT_PUBLIC_CONVEX_URL` (it is baked in
at build time). Traefik reads the pinned tag from `TRAEFIK_IMAGE_TAG`
(default `v3.5`).

## Upgrades & rollback

1. Pin an exact `CONVEX_IMAGE_TAG` (for example `v1.47.0`); never float
   `latest` in production.
2. Upgrade and prove both directions with one command:

```bash
bun run selfhost:drill --skip-up --upgrade-tag v1.48.0 --rollback-tag v1.47.0
```

3. The app image rolls back the same way: build and deploy the previous git
   tag, or pin the previous app image.
4. Volumes are never touched by upgrade or rollback.

Keep the `convex` npm package and `CONVEX_IMAGE_TAG` on compatible versions.
The drill always deploys the repo's functions after an upgrade, and the smoke
call exercises them.

## Backups & restore

### Default (SQLite and files in the `convex-data` volume)

```bash
bun run selfhost:drill --skip-up --skip-deploy --backup-dir backups
# writes and verifies backups/convex-data-<timestamp>.tgz
```

Restore (destructive; also exercised by `--restore-from`):

```bash
bun run selfhost:drill --skip-up --skip-deploy \
  --backup-dir backups --restore-from backups/convex-data-<timestamp>.tgz
```

The manual equivalent is: stop `backend`, untar the archive into the volume,
start `backend`.

### Postgres and S3 upgrade path

When `POSTGRES_URL` or the `S3_*` variables are configured, back up both:

```bash
pg_dump "$POSTGRES_URL" | gzip > backups/postgres-$(date +%F).sql.gz
aws s3 sync s3://$S3_STORAGE_FILES_BUCKET backups/s3-files/   # or mc/restic
```

Restore with `zcat backups/postgres-*.sql.gz | psql "$POSTGRES_URL"` plus an
S3 sync back into the bucket, then restart the backend. Schedule both jobs and
keep archives off the VM.

## Operations

- **Health**: backend `GET /version`, app `GET /`; both declare Docker
  healthchecks and `restart: unless-stopped`.
- **Logs**: `docker compose --env-file docker/.env logs -f backend app`.
- **Retention**: `DOCUMENT_RETENTION_DELAY` controls document expiry; S3
  lifecycle rules control files and avatars. Archived scenes are user data, so
  only ephemeral rows expire.
- **AI provider keys** live in the Convex deployment env, never in the app
  image or compose env: dashboard, Settings, Env, or `bunx convex env set KEY
  value` with the self-hosted URL and admin key.
- **Stalled generations** are failed by the backend watchdog and the UI offers
  retry, so no operator action is required.

## Troubleshooting

| Symptom | Check |
|---|---|
| Backend unhealthy | `docker compose logs backend`; is `INSTANCE_SECRET` set, are the ports free? |
| Dashboard login fails | regenerate the admin key with `generate_admin_key.sh` |
| App loads but queries fail | functions not deployed; run the deploy step (the drill covers it) |
| App reports origin errors | `CONVEX_CLOUD_ORIGIN` and `NEXT_PUBLIC_CONVEX_URL` must match how users reach the stack; rebuild the app image after changing them |
| Certificate not issued | DNS for all three hosts must point at the VM before first start; check `docker compose logs traefik` |
| Deploy CLI hangs | confirm `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`; the drill falls back from `convex dev --once` to `convex deploy --yes` |

## Security notes

- Only the backend container holds provider keys; the app is stateless.
- Keep the dashboard, and ideally the backend, on an admin network or behind
  authentication; they are operator surfaces.
- `INSTANCE_SECRET` must be stable across restarts and backed up. Losing it
  invalidates issued tokens.

## Deployment parity

The self-hosted backend is the reference target. CI's nightly `selfhost` job
boots this stack from scratch, runs the drill including the backup archive
verification, and fails the build on any divergence. Convex Cloud remains a
convenience deployment of the same code and schema.
