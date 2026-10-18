"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { changedFieldMap } from "./diff";
import {
  applyRolePatch,
} from "./fields";
import {
  buildFixtureScene,
  fixtureSampleLines,
  generateFixtureOpening,
  loadFixtureScene,
  regenerateFixtureCast,
  regenerateFixtureField,
  regenerateFixtureRole,
  saveFixtureScene,
} from "./fixtures";
import { blankRole, duplicateRole as cloneRole } from "./roles";
import { CastSessionContext } from "./sessionContext";
import { clampCastSize, modelTierFor, tierDefaultsForSize } from "./tierPolicy";
import type {
  CastBusy,
  CastRole,
  CastRoleStatus,
  CastScene,
  CastSessionValue,
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type FixturesProviderProps = {
  children: ReactNode;
  initialScene?: CastScene;
  initialSceneId?: string;
};

/**
 * Fixtures session: same interface as the live Convex session, fully
 * deterministic and local. Cast generation is simulated; edits, locks,
 * samples, reorders and the opening draft persist in sessionStorage so the
 * handoff to `/s/[sceneId]` works. The quick-start end-to-end spec runs against this layer.
 */
export function FixturesCastSession({
  children,
  initialScene,
  initialSceneId,
}: FixturesProviderProps) {
  const [scene, setScene] = useState<CastScene | null>(() => {
    if (initialScene) return initialScene;
    if (initialSceneId) return loadFixtureScene(initialSceneId);
    return null;
  });
  const [busy, setBusy] = useState<CastBusy>(EMPTY_BUSY);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [changedFields, setChangedFields] = useState<Record<string, string[]>>({});
  const saltRef = useRef(0);
  const sceneCounter = useRef(0);

  useEffect(() => {
    if (scene) saveFixtureScene(scene);
  }, [scene]);

  const withError = useCallback(async (run: () => Promise<void> | void) => {
    try {
      setError(null);
      await run();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  const patchScene = useCallback((updater: (current: CastScene) => CastScene) => {
    setScene((current) => (current ? updater(current) : current));
  }, []);

  const replaceRole = useCallback(
    (roleId: string, updater: (role: CastRole) => CastRole) => {
      patchScene((current) => ({
        ...current,
        roles: current.roles.map((role) => (role.id === roleId ? updater(role) : role)),
        updatedAt: current.updatedAt + 1,
      }));
    },
    [patchScene],
  );

  const createScene = useCallback(async (input: SceneDraftInput): Promise<string> => {
    setBusy({ ...EMPTY_BUSY, casting: true });
    setError(null);
    setChangedFields({});
    try {
      sceneCounter.current += 1;
      const sceneId = `fixture_scene_${Date.now().toString(36)}_${sceneCounter.current}`;
      const built = buildFixtureScene(input, sceneId);
      const opening = generateFixtureOpening(built, 0);
      setScene({ ...built, openingDraft: opening });
      setWarnings([]);
      return sceneId;
    } catch (caught) {
      setError(messageOf(caught));
      throw caught;
    } finally {
      setBusy(EMPTY_BUSY);
    }
  }, []);

  const updateRole = useCallback(
    async (roleId: string, patch: RoleCardPatch) => {
      await withError(() => {
        replaceRole(roleId, (role) => ({
          ...role,
          card: applyRolePatch(role.card, patch),
        }));
        setChangedFields((current) => {
          const next = { ...current };
          delete next[roleId];
          return next;
        });
      });
    },
    [replaceRole, withError],
  );

  const setLocks = useCallback(
    async (roleId: string, locks: string[]) => {
      await withError(() => {
        replaceRole(roleId, (role) => ({ ...role, draftLocks: locks }));
      });
    },
    [replaceRole, withError],
  );

  const regenerateField = useCallback(
    async (roleId: string, field: string) => {
      const role = scene?.roles.find((candidate) => candidate.id === roleId);
      if (!role || role.draftLocks.includes(field)) return;
      setBusy((current) => ({ ...current, field: `${roleId}:${field}` }));
      await withError(() => {
        saltRef.current += 1;
        const card = regenerateFixtureField(role, field, saltRef.current);
        replaceRole(roleId, (current) => ({ ...current, card }));
        setChangedFields((current) => ({
          ...current,
          [roleId]: [...new Set([...(current[roleId] ?? []), field])],
        }));
      });
      setBusy((current) => ({ ...current, field: null }));
    },
    [replaceRole, scene?.roles, withError],
  );

  const regenerateRole = useCallback(
    async (roleId: string) => {
      const role = scene?.roles.find((candidate) => candidate.id === roleId);
      if (!role) return;
      setBusy((current) => ({ ...current, role: roleId }));
      await withError(() => {
        saltRef.current += 1;
        const card = regenerateFixtureRole(role, saltRef.current);
        replaceRole(roleId, (current) => ({ ...current, card }));
        setChangedFields((current) => ({
          ...current,
          [roleId]: ["hook", "psychology", "voice", "drives", "boundariesLines"].filter(
            (field) => !role.draftLocks.includes(field),
          ),
        }));
      });
      setBusy((current) => ({ ...current, role: null }));
    },
    [replaceRole, scene?.roles, withError],
  );

  const regenerateCast = useCallback(
    async (vibe: string) => {
      if (!scene) return;
      setBusy((current) => ({ ...current, castRegen: true }));
      await withError(() => {
        saltRef.current += 1;
        const before = scene.roles;
        const roles = regenerateFixtureCast(scene, vibe, saltRef.current);
        patchScene((current) => ({ ...current, roles, updatedAt: current.updatedAt + 1 }));
        setChangedFields(changedFieldMap(before, roles));
        setWarnings(vibe.trim() ? [`Stayed true to: “${vibe.trim()}”`] : []);
      });
      setBusy((current) => ({ ...current, castRegen: false }));
    },
    [patchScene, scene, withError],
  );

  const addRole = useCallback(async () => {
    await withError(() => {
      patchScene((current) => ({
        ...current,
        roles: [...current.roles, blankRole(`role_blank_${current.roles.length}_${Date.now().toString(36)}`, current.roles.length)],
        updatedAt: current.updatedAt + 1,
      }));
    });
  }, [patchScene, withError]);

  const duplicateRole = useCallback(
    async (roleId: string) => {
      await withError(() => {
        patchScene((current) => {
          const role = current.roles.find((candidate) => candidate.id === roleId);
          if (!role) return current;
          const copy = cloneRole(
            role,
            `role_copy_${roleId}_${Date.now().toString(36)}`,
          );
          return { ...current, roles: [...current.roles, copy] };
        });
      });
    },
    [patchScene, withError],
  );

  const setRoleStatus = useCallback(
    async (roleId: string, status: CastRoleStatus) => {
      await withError(() => {
        replaceRole(roleId, (role) => ({ ...role, status }));
      });
    },
    [replaceRole, withError],
  );

  const reorder = useCallback(
    async (roleIds: string[]) => {
      await withError(() => {
        patchScene((current) => {
          const byId = new Map(current.roles.map((role) => [role.id, role]));
          const ordered = roleIds
            .map((id) => byId.get(id))
            .filter((role): role is CastRole => role !== undefined);
          const missing = current.roles.filter((role) => !roleIds.includes(role.id));
          return { ...current, roles: [...ordered, ...missing] };
        });
      });
    },
    [patchScene, withError],
  );

  const setCastSize = useCallback(
    async (size: number) => {
      setBusy((current) => ({ ...current, resize: true }));
      await withError(() => {
        patchScene((current) => {
          const target = clampCastSize(size);
          const roles = [...current.roles];
          const activeAi = roles.filter(
            (role) => role.kind === "ai" && role.status === "active",
          );
          if (target < activeAi.length) {
            for (const role of activeAi.slice(target)) {
              const index = roles.findIndex((candidate) => candidate.id === role.id);
              const found = roles[index];
              if (found) roles[index] = { ...found, status: "offstage" };
            }
          } else if (target > activeAi.length) {
            let need = target - activeAi.length;
            const restore = roles.filter(
              (role) => role.kind === "ai" && role.status === "offstage",
            );
            for (const role of restore) {
              if (need <= 0) break;
              const index = roles.findIndex((candidate) => candidate.id === role.id);
              const found = roles[index];
              if (found) roles[index] = { ...found, status: "active" };
              need -= 1;
            }
            while (need > 0) {
              roles.push(
                blankRole(
                  `role_size_${roles.length}_${Date.now().toString(36)}`,
                  roles.length,
                ),
              );
              need -= 1;
            }
          }

          const nextActive = roles.filter(
            (role) => role.kind === "ai" && role.status === "active",
          );
          const tiers = tierDefaultsForSize(nextActive.length);
          const tierById = new Map(
            nextActive.map((role, index) => [role.id, tiers[index] ?? "background"]),
          );
          const tiered = roles.map((role) => {
            const tier = tierById.get(role.id);
            if (!tier) return role;
            return {
              ...role,
              card: {
                ...role.card,
                meta: { ...role.card.meta, tier, modelTier: modelTierFor(tier) },
              },
            };
          });
          return { ...current, roles: tiered, updatedAt: current.updatedAt + 1 };
        });
      });
      setBusy((current) => ({ ...current, resize: false }));
    },
    [patchScene, withError],
  );

  const requestSampleLines = useCallback(
    async (roleId: string, force = false): Promise<SampleLinesResult> => {
      const role = scene?.roles.find((candidate) => candidate.id === roleId);
      if (!role) throw new Error("Role not found");
      setBusy((current) => ({ ...current, sample: roleId }));
      try {
        saltRef.current += 1;
        const lines = fixtureSampleLines(role, force, saltRef.current);
        if (force) {
          replaceRole(roleId, (current) => ({
            ...current,
            sampleLines: lines,
            card: {
              ...current.card,
              voice: { ...current.card.voice, sampleLines: lines },
            },
          }));
        }
        return { lines, cached: !force };
      } finally {
        setBusy((current) => ({ ...current, sample: null }));
      }
    },
    [replaceRole, scene?.roles],
  );

  const draftOpening = useCallback(async () => {
    if (!scene) return;
    setBusy((current) => ({ ...current, opening: true }));
    await withError(() => {
      const variant = (scene.openingDraft?.variant ?? -1) + 1;
      const opening = generateFixtureOpening(scene, variant);
      patchScene((current) => ({ ...current, openingDraft: opening }));
    });
    setBusy((current) => ({ ...current, opening: false }));
  }, [patchScene, scene, withError]);

  const commitOpening = useCallback(
    async (input: { text: string }) => {
      if (!scene) throw new Error("No scene to start");
      const text = input.text.trim();
      if (!text) throw new Error("Write an opening line before starting");
      const speaker =
        scene.openingDraft?.speakerRoleId ??
        scene.roles.find((role) => role.kind === "ai" && role.status === "active")?.id;
      const beatId = `fixture_beat_${scene.id}_${scene.beats.length + 1}`;
      const beat = {
        id: beatId,
        seq: scene.beats.length + 1,
        text,
        origin: "opening" as const,
        status: "finished" as const,
        speakerRoleId: speaker,
        createdAt: Date.now(),
      };
      patchScene((current) => ({
        ...current,
        status: "playing" as const,
        beats: [...current.beats, beat],
        openingDraft: undefined,
        updatedAt: current.updatedAt + 1,
      }));
      return { sceneId: scene.id, beatId };
    },
    [patchScene, scene],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<CastSessionValue>(
    () => ({
      mode: "fixtures",
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
