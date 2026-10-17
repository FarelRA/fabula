# Fabula self-host runbook

Completing this document is part of Phase 8.7 (PLAN §15.6). It covers: first
run, code deploys, upgrades/rollback, backups, TLS, and troubleshooting.

## Prereqs

- Linux VM (2 vCPU / 4 GB RAM to start), Docker + Compose plugin
- Optional: a domain + Caddy (`docker/Caddyfile`) for TLS

## First run

```bash
cp docker/.env.example docker/.env            # set INSTANCE_SECRET! (openssl rand -base64 32)
docker compose --env-file docker/.env up -d --build
docker compose exec backend ./generate_admin_key.sh
```

- API: http://127.0.0.1:3210 · HTTP actions: http://127.0.0.1:3211 · dashboard: http://127.0.0.1:6791

## Deploy code against the self-hosted backend

```bash
CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 \
CONVEX_SELF_HOSTED_ADMIN_KEY=<admin key> \
bunx convex dev --once        # or `convex deploy` where applicable
```

## Seed + smoke

```bash
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 bun run seed
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210 FABULA_APP_URL=http://127.0.0.1:3000 bun run selfhost:smoke
```

## Upgrades / rollback

1. Pin `CONVEX_IMAGE_TAG` to a validated release in `docker/.env`.
2. Upgrade: bump the tag → `docker compose --env-file docker/.env up -d` → run the smoke.
3. Rollback: restore the previous tag → `up -d` again. Volumes are untouched.

## Backups (default SQLite + local files)

```bash
docker run --rm -v fabula_convex-data:/data -v "$PWD/backups":/backup alpine \
  tar czf /backup/convex-data-$(date +%F).tgz -C /data .
```

Restore: stop the stack, restore the tarball into the volume, start the stack,
run the smoke. With the Postgres/S3 upgrade path: `pg_dump` + bucket sync.

## Troubleshooting

- Backend not healthy: `docker compose logs backend` (check INSTANCE_SECRET and ports).
- Dashboard login: regenerate the admin key (`generate_admin_key.sh`).
- This section is expanded with runbook drills in Phase 8.7.
