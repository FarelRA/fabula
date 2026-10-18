import { chainForDocs } from "@/lib/branches/chain";
import type {
  ExportBeatRow,
  ExportBranchRow,
  ExportBundle,
  ExportCandidateRow,
  ExportRoleRow,
} from "./types";

/**
 * Markdown export (PLAN §12 Phase 7.3): a deterministic, human-readable
 * screenplay-ish document. Mainline first; alternate branches print only the
 * beats they add after their divergence point; ghosts, facts (with global
 * pins and mutes), summaries and director notes follow. Pure: no clock, no
 * randomness — golden-testable.
 */
export function serializeSceneToMarkdown(bundle: ExportBundle): string {
  const lines: string[] = [];
  const { scene, settings, roles } = bundle;
  const roleNames = new Map(roles.map((role) => [role._id, role.identity.name]));

  lines.push(`# ${scene.title}`, "");
  lines.push(`> ${scene.premise}`, "");

  const meta: string[] = [`**Status:** ${scene.status}`];
  if (scene.endedAt !== undefined) {
    meta.push(`**Ended:** ${formatDay(scene.endedAt)}`);
  }
  if (settings) {
    meta.push(`**Genre:** ${settings.genre} · ${settings.settingEra}`);
    meta.push(
      `**Style:** ${settings.presentationStyle} · **Language:** ${settings.playLanguage}${
        settings.lengthTarget ? ` · **Length:** ${settings.lengthTarget}` : ""
      }`,
    );
  }
  lines.push(`- ${meta.join("\n- ")}`, "");

  lines.push("## Cast", "");
  if (roles.length === 0) {
    lines.push("_(no cast)_", "");
  } else {
    for (const role of roles) {
      lines.push(formatRoleHeading(role));
      if (role.hook) lines.push(`- hook: ${role.hook}`);
      lines.push("");
    }
  }

  const offeredByParent = new Map<string, ExportCandidateRow[]>();
  for (const candidate of bundle.candidates) {
    if (candidate.status !== "offered") continue;
    const list = offeredByParent.get(candidate.parentBeatId) ?? [];
    list.push(candidate);
    offeredByParent.set(candidate.parentBeatId, list);
  }

  const branches = branchOrder(bundle.branches);
  for (const [index, branch] of branches.entries()) {
    lines.push(`## ${branch.label}`, "");
    const chain = chainForDocs(branch.tipBeatId, bundle.beats);
    const printed =
      branch.forkedFromBeatId && index > 0
        ? afterFork(chain, branch.forkedFromBeatId)
        : chain;
    if (printed.length === 0) {
      lines.push("_(no beats on this branch)_", "");
    }
    for (const beat of printed) {
      lines.push(
        `### Beat ${beat.seq} · ${beat.origin} · ${speakerName(beat, roleNames)}`,
      );
      lines.push(beat.text, "");
      if (beat.isPinned) lines.push("_Pinned._", "");
      const ghosts = offeredByParent.get(beat._id);
      if (ghosts && ghosts.length > 0) {
        lines.push("**Paths not taken:**");
        for (const ghost of ghosts) {
          lines.push(
            `- **${ghost.label}** (${ghost.strategy}): ${ghost.text}`,
          );
        }
        lines.push("");
      }
    }
  }

  lines.push("## Facts", "");
  if (bundle.facts.length === 0) {
    lines.push("_(no facts recorded)_", "");
  } else {
    for (const fact of bundle.facts) {
      const tags: string[] = [];
      if (fact.isPinned) tags.push("**[global]**");
      if (fact.status === "muted") tags.push("*(muted)*");
      lines.push(`- ${tags.length > 0 ? `${tags.join(" ")} ` : ""}${fact.text}`);
    }
    lines.push("");
  }

  lines.push("## Summaries", "");
  if (bundle.summaries.length === 0) {
    lines.push("_(no summaries)_", "");
  } else {
    for (const summary of bundle.summaries) {
      lines.push(
        `- **Beats ${summary.coveredFromSeq}–${summary.coveredThroughSeq}:** ${summary.text}`,
      );
    }
    lines.push("");
  }

  if (bundle.notes.length > 0) {
    lines.push("## Director notes", "");
    for (const note of bundle.notes) {
      lines.push(
        `- *(${note.kind}, from beat ${note.appliesFromSeq}${
          note.status !== "active" ? `, ${note.status}` : ""
        })* ${note.text}`,
      );
    }
    lines.push("");
  }

  if (bundle.warnings.length > 0) {
    lines.push("## Continuity notes", "");
    for (const warning of bundle.warnings) {
      lines.push(
        `- **${warning.severity}**${warning.status !== "open" ? ` (${warning.status})` : ""}: ${warning.text}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function branchOrder(branches: ExportBranchRow[]): ExportBranchRow[] {
  return [...branches].sort((a, b) => {
    const mainA = a.forkedFromBeatId ? 1 : 0;
    const mainB = b.forkedFromBeatId ? 1 : 0;
    return mainA - mainB || a.createdAt - b.createdAt;
  });
}

function afterFork(
  chain: ExportBeatRow[],
  forkedFromBeatId: string,
): ExportBeatRow[] {
  const index = chain.findIndex((beat) => beat._id === forkedFromBeatId);
  if (index < 0) return chain;
  return chain.slice(index + 1);
}

function speakerName(
  beat: ExportBeatRow,
  roleNames: ReadonlyMap<string, string>,
): string {
  if (!beat.speakerRoleId) return "Narration";
  return roleNames.get(beat.speakerRoleId) ?? "Role";
}

function formatRoleHeading(role: ExportRoleRow): string {
  const tier = role.meta?.tier ? ` · ${role.meta.tier}` : "";
  const storyRole = role.meta?.storyRole ? ` · ${role.meta.storyRole}` : "";
  const human = role.kind === "human" ? " · you" : "";
  const status = role.status !== "active" ? ` · ${role.status}` : "";
  return `### ${role.identity.name}${storyRole}${tier}${human}${status}`;
}

function formatDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
