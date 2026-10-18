"use client";

import { useAction, useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionArgs } from "convex/server";
import type { RoleCard, Tier } from "@convex/shared/contracts";
import { changedFieldMap } from "./diff";
import { castSceneFromLive, roleCardFromDoc } from "./liveMapping";
import { CastSessionContext } from "./sessionContext";
import { blankRoleCard } from "./roles";
import { clampCastSize, tierDefaultsForSize } from "./tierPolicy";
import { settingsFromInput } from "./wizard";
import type {
  CastBusy,
  CastRoleStatus,
  CastScene,
  CastSessionValue,
  OpeningDraft,
  RoleCardPatch,
  SampleLinesResult,
  SceneDraftInput,
} from "./types";

const EMPTY_BUSY: CastBusy = {
  casting: false,
  castRegen: false,
  resize: false,
  role: null,
  field: null,
  sample: null,
  opening: false,
};

const ALL_ROLE_FIELDS = [
  "identity",
  "hook",
  "psychology",
  "voice",
  "drives",
  "boundariesLines",
  "meta",
];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthError(error: unknown): boolean {
  return /auth|unauthenticated|not signed in/i.test(messageOf(error));
}

type DraftRoleCard = FunctionArgs<typeof api.cast.upsertDraftRole>["card"];

// RoleCard's `toRoleId` is a string in the frozen zod contract; Convex ids are
// brands. The editor only ever writes ids that came from the scene.
function asDraftCard(card: RoleCard): DraftRoleCard {
  return card as unknown as DraftRoleCard;
}

/**
 * Live session: the same interface as fixtures, backed by Convex (PLAN
 * §13.4). Cast generation runs through the Phase 2 actions; drafts/edits use
 * the Phase 1 mutations; the opening is previewed via
 * `generation.opening.draft` and committed with `beats.appendOpening`.
 *
 * Anonymous sign-in happens on the first mutating action — no account wall.
 */
export function LiveCastSession({
  children,
  initialSceneId,
}: {
  children: ReactNode;
  initialSceneId?: string;
}) {
  const convex = useConvex();
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [sceneId, setSceneId] = useState<string | null>(initialSceneId ?? null);
  const [busy, setBusy] = useState<CastBusy>(EMPTY_BUSY);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [changedFields, setChangedFields] = useState<Record<string, string[]>>({});
  const [openingDraft, setOpeningDraft] = useState<OpeningDraft | null>(null);
  const [sampleOverrides, setSampleOverrides] = useState<Record<string, string[]>>({});

  const sceneData = useQuery(
    api.scenes.get,
    sceneId ? { sceneId: sceneId as Id<"scenes"> } : "skip",
  );
  const roleDocs = useQuery(
    api.cast.listRoles,
    sceneId
      ? { sceneId: sceneId as Id<"scenes">, includeInactive: true }
      : "skip",
  );
  const path = useQuery(
    api.beats.listPath,
    sceneId ? { sceneId: sceneId as Id<"scenes"> } : "skip",
  );

  const createSceneMutation = useMutation(api.scenes.create);
  const updateDraft = useMutation(api.cast.updateDraft);
  const reviseRole = useMutation(api.cast.reviseRole);
  const setLocksMutation = useMutation(api.cast.setLocks);
  const setStatusMutation = useMutation(api.cast.setStatus);
  const setTierMutation = useMutation(api.cast.setTier);
  const reorderMutation = useMutation(api.cast.reorder);
  const upsertDraftRole = useMutation(api.cast.upsertDraftRole);
  const appendOpening = useMutation(api.beats.appendOpening);

  const castDraft = useAction(api.generation.casting.castDraft);
  const castRegen = useAction(api.generation.casting.castRegen);
  const fieldRegen = useAction(api.generation.casting.fieldRegen);
  const sampleLineAction = useAction(api.generation.sampleLine.generate);
  const openingDraftAction = useAction(api.generation.opening.draft);

  const scene = useMemo<CastScene | null>(() => {
    if (!sceneData?.scene || !sceneData.settings) return null;
    return castSceneFromLive({
      scene: sceneData.scene,
      settings: sceneData.settings,
      roles: roleDocs ?? [],
      beats: path?.beats ?? [],
      sampleOverrides,
      openingDraft: openingDraft ?? undefined,
    });
  }, [sceneData, roleDocs, path, sampleOverrides, openingDraft]);

  const withError = useCallback(async (run: () => Promise<void> | void) => {
    try {
      setError(null);
      await run();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  const requireSceneId = useCallback((): Id<"scenes"> => {
    if (!sceneId) throw new Error("Create a scene first");
    return sceneId as Id<"scenes">;
  }, [sceneId]);

  const createScene = useCallback(
    async (input: SceneDraftInput): Promise<string> => {
      setBusy({ ...EMPTY_BUSY, casting: true });
      setError(null);
      setChangedFields({});
      try {
        if (!isAuthenticated) {
          await signIn("anonymous");
          await sleep(300);
        }

        let created: Awaited<ReturnType<typeof createSceneMutation>> | null = null;
        let attempts = 0;
        while (!created) {
          try {
            created = await createSceneMutation({
              title: input.title,
              premise: input.premise,
              settings: settingsFromInput(input),
            });
          } catch (caught) {
            attempts += 1;
            if (attempts >= 3 || !isAuthError(caught)) throw caught;
            await sleep(400);
          }
        }

        const args: {
          sceneId: Id<"scenes">;
          castSize: number;
          vibeSteer?: string;
          youInScene?: { name: string; pronouns?: string };
        } = { sceneId: created.sceneId, castSize: input.castSize };
        if (input.vibeSteer) args.vibeSteer = input.vibeSteer;
        if (input.youInScene) {
          args.youInScene = {
            name: input.youInScene.name,
            ...(input.youInScene.pronouns
              ? { pronouns: input.youInScene.pronouns }
              : {}),
          };
        }
        const castResult = await castDraft(args);
        setWarnings(castResult.warnings);
        setSceneId(created.sceneId);

        const draft = await openingDraftAction({ sceneId: created.sceneId });
        setOpeningDraft({
          text: draft.text,
          speakerRoleId: draft.speakerRoleId,
          variant: 0,
        });
        return created.sceneId;
      } catch (caught) {
        setError(messageOf(caught));
        throw caught;
      } finally {
        setBusy(EMPTY_BUSY);
      }
    },
    [castDraft, createSceneMutation, isAuthenticated, openingDraftAction, signIn],
  );

  const updateRole = useCallback(
    async (roleId: string, patch: RoleCardPatch) => {
      await withError(async () => {
        const tip = sceneData?.scene.activeTipBeatId;
        if (tip) {
          await reviseRole({
            roleId: roleId as Id<"roles">,
            effectiveFromBeatId: tip,
            patch: patch as Parameters<typeof reviseRole>[0]["patch"],
            origin: "edit",
          });
        } else {
          await updateDraft({
            roleId: roleId as Id<"roles">,
            patch: patch as Parameters<typeof updateDraft>[0]["patch"],
          });
        }
        setChangedFields((current) => {
          const next = { ...current };
          delete next[roleId];
          return next;
        });
      });
    },
    [reviseRole, sceneData?.scene.activeTipBeatId, updateDraft, withError],
  );

  const setLocks = useCallback(
    async (roleId: string, locks: string[]) => {
      await withError(async () => {
        await setLocksMutation({ roleId: roleId as Id<"roles">, locks });
      });
    },
    [setLocksMutation, withError],
  );

  const regenerateField = useCallback(
    async (roleId: string, field: string) => {
      setBusy((current) => ({ ...current, field: `${roleId}:${field}` }));
      await withError(async () => {
        const result = await fieldRegen({ roleId: roleId as Id<"roles">, fields: [field] });
        setWarnings(result.warnings);
        if (result.applied.length > 0) {
          setChangedFields((current) => ({
            ...current,
            [roleId]: [...new Set([...(current[roleId] ?? []), field])],
          }));
        }
      });
      setBusy((current) => ({ ...current, field: null }));
    },
    [fieldRegen, withError],
  );

  const regenerateRole = useCallback(
    async (roleId: string) => {
      setBusy((current) => ({ ...current, role: roleId }));
      await withError(async () => {
        const result = await fieldRegen({
          roleId: roleId as Id<"roles">,
          fields: ALL_ROLE_FIELDS,
        });
        setWarnings(result.warnings);
        setChangedFields((current) => ({
          ...current,
          [roleId]: result.applied,
        }));
      });
      setBusy((current) => ({ ...current, role: null }));
    },
    [fieldRegen, withError],
  );

  const regenerateCast = useCallback(
    async (vibe: string) => {
      setBusy((current) => ({ ...current, castRegen: true }));
      await withError(async () => {
        const before = (roleDocs ?? []).map((doc) => ({
          id: doc._id,
          card: roleCardFromDoc(doc),
        }));
        const result = await castRegen({
          sceneId: requireSceneId(),
          ...(vibe.trim() ? { vibeSteer: vibe.trim() } : {}),
        });
        const after = await convex.query(api.cast.listRoles, {
          sceneId: requireSceneId(),
          includeInactive: true,
        });
        setChangedFields(
          changedFieldMap(
            before,
            after.map((doc) => ({ id: doc._id, card: roleCardFromDoc(doc) })),
          ),
        );
        setWarnings(result.warnings);
      });
      setBusy((current) => ({ ...current, castRegen: false }));
    },
    [castRegen, convex, requireSceneId, roleDocs, withError],
  );

  const addRole = useCallback(async () => {
    await withError(async () => {
      const card = blankRoleCard((roleDocs ?? []).length);
      await upsertDraftRole({
        sceneId: requireSceneId(),
        kind: "ai",
        card: asDraftCard(card),
      });
    });
  }, [requireSceneId, roleDocs, upsertDraftRole, withError]);

  const duplicateRole = useCallback(
    async (roleId: string) => {
      await withError(async () => {
        const source = (roleDocs ?? []).find((doc) => doc._id === roleId);
        if (!source) throw new Error("Role not found");
        const card = roleCardFromDoc(source);
        card.identity = { ...card.identity, name: `${card.identity.name} (copy)` };
        card.relations = card.relations.filter(
          (relation) => relation.toRoleId !== source._id,
        );
        await upsertDraftRole({
          sceneId: requireSceneId(),
          kind: source.kind,
          card: asDraftCard(card),
          ...(source.userId ? { userId: source.userId } : {}),
        });
      });
    },
    [requireSceneId, roleDocs, upsertDraftRole, withError],
  );

  const setRoleStatus = useCallback(
    async (roleId: string, status: CastRoleStatus) => {
      await withError(async () => {
        await setStatusMutation({ roleId: roleId as Id<"roles">, status });
      });
    },
    [setStatusMutation, withError],
  );

  const reorder = useCallback(
    async (roleIds: string[]) => {
      await withError(async () => {
        await reorderMutation({
          sceneId: requireSceneId(),
          roleIds: roleIds as Id<"roles">[],
        });
      });
    },
    [reorderMutation, requireSceneId, withError],
  );

  const setCastSize = useCallback(
    async (size: number) => {
      setBusy((current) => ({ ...current, resize: true }));
      await withError(async () => {
        const target = clampCastSize(size);
        const docs = [...(roleDocs ?? [])].sort((a, b) =>
          a.sortKey.localeCompare(b.sortKey),
        );
        const activeAi = docs.filter(
          (doc) => doc.kind === "ai" && doc.status === "active",
        );
        const inactiveAi = docs.filter(
          (doc) => doc.kind === "ai" && doc.status !== "active",
        );

        if (target < activeAi.length) {
          for (const doc of activeAi.slice(target)) {
            await setStatusMutation({ roleId: doc._id, status: "offstage" });
          }
        } else if (target > activeAi.length) {
          let need = target - activeAi.length;
          for (const doc of inactiveAi) {
            if (need <= 0) break;
            await setStatusMutation({ roleId: doc._id, status: "active" });
            need -= 1;
          }
          while (need > 0) {
            await upsertDraftRole({
              sceneId: requireSceneId(),
              kind: "ai",
              card: asDraftCard(blankRoleCard(docs.length + need)),
            });
            need -= 1;
          }
        }

        const nextActive = [
          ...activeAi.slice(0, Math.min(target, activeAi.length)),
          ...inactiveAi.slice(0, Math.max(0, target - activeAi.length)),
        ].slice(0, target);
        const tiers = tierDefaultsForSize(target);
        for (let index = 0; index < nextActive.length; index += 1) {
          const doc = nextActive[index];
          const tier = (tiers[index] ?? "background") as Tier;
          if (doc && doc.meta.tier !== tier) {
            await setTierMutation({ roleId: doc._id, tier });
          }
        }
      });
      setBusy((current) => ({ ...current, resize: false }));
    },
    [
      requireSceneId,
      roleDocs,
      setStatusMutation,
      setTierMutation,
      upsertDraftRole,
      withError,
    ],
  );

  const requestSampleLines = useCallback(
    async (roleId: string, force = false): Promise<SampleLinesResult> => {
      setBusy((current) => ({ ...current, sample: roleId }));
      try {
        const result = await sampleLineAction({
          roleId: roleId as Id<"roles">,
          ...(force ? { force: true } : {}),
        });
        setSampleOverrides((current) => ({ ...current, [roleId]: result.lines }));
        return result;
      } finally {
        setBusy((current) => ({ ...current, sample: null }));
      }
    },
    [sampleLineAction],
  );

  const draftOpening = useCallback(async () => {
    setBusy((current) => ({ ...current, opening: true }));
    await withError(async () => {
      const draft = await openingDraftAction({ sceneId: requireSceneId() });
      setOpeningDraft((current) => ({
        text: draft.text,
        speakerRoleId: draft.speakerRoleId,
        variant: (current?.variant ?? -1) + 1,
      }));
    });
    setBusy((current) => ({ ...current, opening: false }));
  }, [openingDraftAction, requireSceneId, withError]);

  const commitOpening = useCallback(
    async (input: { text: string }) => {
      const text = input.text.trim();
      if (!text) throw new Error("Write an opening line before starting");
      if ((path?.beats.length ?? 0) > 0) {
        throw new Error("This scene already has an opening beat");
      }
      const scene = requireSceneId();
      const speaker = openingDraft?.speakerRoleId as Id<"roles"> | undefined;
      const result = await appendOpening({
        sceneId: scene,
        text,
        ...(speaker ? { speakerRoleId: speaker } : {}),
      });
      return { sceneId: scene, beatId: result.beatId };
    },
    [appendOpening, openingDraft?.speakerRoleId, path?.beats.length, requireSceneId],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<CastSessionValue>(
    () => ({
      mode: "live",
      scene,
      warnings,
      error,
      busy,
      changedFields,
      createScene,
      updateRole,
      setLocks,
      regenerateField,
      regenerateRole,
      regenerateCast,
      addRole,
      duplicateRole,
      setRoleStatus,
      reorder,
      setCastSize,
      requestSampleLines,
      draftOpening,
      commitOpening,
      clearError,
    }),
    [
      scene,
      warnings,
      error,
      busy,
      changedFields,
      createScene,
      updateRole,
      setLocks,
      regenerateField,
      regenerateRole,
      regenerateCast,
      addRole,
      duplicateRole,
      setRoleStatus,
      reorder,
      setCastSize,
      requestSampleLines,
      draftOpening,
      commitOpening,
      clearError,
    ],
  );

  return (
    <CastSessionContext.Provider value={value}>{children}</CastSessionContext.Provider>
  );
}
