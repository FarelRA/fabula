# Archive, share and presence surfaces

**Status:** Accepted
**Date:** 2026-10-18
**Deciders:** orchestrator, domain, generation, meta surfaces & archive

## Context

This decision ships wrap and archive, markdown/JSON export, and share links
with presence badges. The API table already names `shares.*`, `scenes.*` and
`exportScene.getBundle`, but the surfaces needed decisions the frozen table did
not spell out:

- end detection (`endingSuggested`) was produced by the director meta-agent
  and then dropped, nothing counted consecutive suggestions or surfaced a
  wrap offer;
- `scenes.setStatus` archived a scene with no final summary pass, no audit
  entry and no reversibility path;
- nothing enforced "archived scenes are immutable" server-side;
- share links were read-only bundles only: no live stream, no director pick,
  no presence;
- exports had no query, no serializers and no delivery path;
- Convex client hooks must never run during a server render, but the new
  routes (`/s/[sceneId]/archive`, `/share/[token]`) were rendered eagerly.

## Decision

Additive, no breaking changes:

**End detection & wrap**
- `scenes.endingStreak?: number` (additive field): consecutive director-meta
  `endingSuggested=true` results; any `false` resets it to 0. The play shell
  offers a non-modal "Wrap scene?" chip at streak ≥ 2, the scene never
  auto-archives.
- `scenes.endScene({sceneId})`: freezes the tree (`status:"archived"` +
  `endedAt`), logs a reversible `patchScene` inverse (with an explicit
  `clearEndedAt` flag, the action log cannot carry `undefined`), and
  schedules the final summary pass (`internal.generation.memory.runPass`
  `{force: true}`) for any beats beyond the last summary. Idempotent.
- `assertSceneMutable(scene)` guards every story mutation (candidates, beats,
  branches, facts, warnings, notes, cast, scene settings/title, generation
  actions). Scene-level operations, share create/revoke, export, the undo
  log, stay allowed; `⌘Z` on the wrap is the reopen path, so
  `scenes.setStatus` cannot leave the archived state directly.

**Share surface**
- `shares.getByToken` grows additively: `pending`, `options` (with
  `parentSeq`/`parentIsTip`), `run`, `notes`, the exact shape the play shell
  consumes, so both surfaces map through `buildPlayScene`.
- `thread.listMessages` accepts an optional `shareToken` (viewer-level) and
  validates the link against the scene; `candidates.pick` accepts an optional
  `shareToken` that must be a director link. Unknown, revoked and expired
  tokens fail closed.
- `@convex-dev/presence` joins the component list. Rooms are share tokens,
  validated at heartbeat time; `presence.list` takes the component's opaque
  `roomToken` (not the share link), and `disconnect` stays unauthenticated
  because it arrives via `sendBeacon` on unload. The share header renders a
  "N watching" badge; anonymous viewers get a stable per-tab display name.

**Archive & export**
- `exportScene.getBundle({sceneId, includeSnapshots?})`: one lossless bundle
  (scene, settings, cast, branches, every beat, candidates with statuses,
  facts both states, summaries, warnings, notes, optionally prompt snapshots).
  Owner-only via `assertSceneAccess`.
- Pure serializers in `src/lib/export/`: markdown (golden-locked, mainline
  first then branch deltas, ghosts under their parent) and JSON
  (`exportedAt` injected at serialization time so the query stays reactive).
  Downloads are browser blobs, no server storage, no REST layer.
- `/s/[sceneId]/archive` and `/share/[token]` render client-only through
  `next/dynamic` (`ssr: false`), the same boundary the play shell uses.

**Shared-director scope (v1)**
- Director links can pick offered path options and nothing else: no steering,
  queueing, pause, abort or edits. A later release evolves seats, presence and
  multi-director reconciliation on this foundation.

## Consequences

- The wrap is audited, summary-complete and reversible; the archive is
  story-immutable but fully readable, exportable and shareable.
- The share browser scenario proves viewer read-only, director pick, live propagation and
  revocation across independent browser contexts with no session.
- The leak law is untouched: token scoping is an access layer over the same
  path projection.
- Presence is flag-free but isolated in `convex/presence.ts` +
  `src/components/share/SharePresence.tsx`, so a future identity-room mode
  swaps the room id without touching the share surface.
