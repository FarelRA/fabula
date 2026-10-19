import { assertPromptMessages, DEFAULT_CONTEXT_WINDOW, type GenerationRequest, type ModelGateway, type ObjectRequest } from "./gateway";
import { FAKE_ENDING, FAKE_NO_DECISION, FAKE_NO_FACTS, FAKE_OPTIONS_BAD } from "./fakeMarkers";

/**
 * FakeGateway, deterministic, scripted model responses for unit tests, CI
 * and E2E. Streams are matched by the "MODE: <name>" marker;
 * structured objects are matched by `schemaName`. By default the gateway
 * SYNTHESIZES valid objects (derived from the compiler's rendered prompt
 * lines) so integration tests need no scripting at all. Explicit scripts and
 * control markers override the synthesized defaults.
 */

export type FakeScript = {
  streamChunks?: Record<string, string[]>;
  objects?: Record<string, unknown>;
  contextWindow?: number;
  synthesize?: boolean;
};

export const DEFAULT_FAKE_SCRIPT: FakeScript = {
  streamChunks: {
    turn: ["The ", "rain ", "keeps ", "falling."],
  },
  objects: {},
  synthesize: true,
};

export function modeMarker(req: GenerationRequest): string {
  const match = /MODE:\s*([A-Za-z][A-Za-z-]*)/.exec(req.system);
  const marker = match?.[1];
  return marker ? marker.toLowerCase() : "turn";
}

// ---------------------------------------------------------------------------
// Synthesizers, derive valid outputs from what the compiler rendered.
// ---------------------------------------------------------------------------

/** Compiler renders present roles as "id: Name (tier, storyRole)" lines. */
function parseRoleIds(system: string): string[] {
  const ids: string[] = [];
  for (const rawLine of system.split("\n")) {
    const match = /^([A-Za-z0-9_]+): .+\(/.exec(rawLine.trim());
    if (match?.[1]) ids.push(match[1]);
  }
  return ids;
}

const OPTION_LABELS = ["Push inside", "Wait outside", "Offer the ledger", "Call the bluff"];
const OPTION_TEXTS = [
  "She pushes the door and steps out of the rain.",
  "She waits under the awning, watching the window.",
  "She lays the ledger open on the table between them.",
  "She calls the bluff and says the name out loud.",
];
const OPTION_STRATEGIES = ["escalate", "deflect", "reveal", "confront"];

function synthesizeOptions(system: string): unknown {
  const idList = /must be one of:\s*([^\n]+)/.exec(system)?.[1];
  const ids = idList
    ? idList
        .split(",")
        .map((entry) => entry.trim().replace(/[.;:]+$/, ""))
        .filter((entry) => entry.length > 0)
    : [];
  const requested = Number(/propose (\d+) candidate/.exec(system)?.[1] ?? 3);
  const count = Math.min(4, Math.max(2, requested));

  if (system.includes(FAKE_OPTIONS_BAD)) {
    // Deliberately invalid: one option only (exercises caller repair paths).
    return {
      options: [
        {
          label: "Only one",
          speakerRoleId: ids[0] ?? "missing",
          text: "Invalid on purpose.",
          strategy: "escalate",
        },
      ],
    };
  }

  return {
    options: Array.from({ length: count }, (_, index) => ({
      label: OPTION_LABELS[index % OPTION_LABELS.length] ?? `Option ${index + 1}`,
      speakerRoleId: ids.length > 0 ? ids[index % ids.length] : "missing",
      text: OPTION_TEXTS[index % OPTION_TEXTS.length] ?? `Option ${index + 1}.`,
      strategy: OPTION_STRATEGIES[index % OPTION_STRATEGIES.length] ?? "escalate",
    })),
  };
}

function synthesizeDirectorMeta(system: string): unknown {
  const ids = parseRoleIds(system);
  const cadenceAlways = /Branch cadence:\s*always/.test(system);
  const cadenceKey = /Branch cadence:\s*key/.test(system);
  const decisionPoint = system.includes(FAKE_NO_DECISION)
    ? false
    : cadenceAlways || cadenceKey;
  return {
    decisionPoint,
    reason: "The standoff is tightening.",
    responders: ids.slice(0, Math.min(2, ids.length)),
    pacingNote: "Slow the rhythm; cut on the door.",
    endingSuggested: system.includes(FAKE_ENDING),
  };
}

function synthesizeSummary(system: string): unknown {
  const coveredFromSeq = Number(/covering seq (\d+)/.exec(system)?.[1] ?? 1);
  const coveredThroughSeq = Number(/through (\d+)/.exec(system)?.[1] ?? coveredFromSeq);
  return {
    summary: "The knock happened; the door stayed closed; someone inside knows the ledger.",
    coveredFromSeq,
    coveredThroughSeq: Math.max(coveredFromSeq, coveredThroughSeq),
  };
}

function synthesizeFacts(system: string): unknown {
  if (system.includes(FAKE_NO_FACTS)) return { facts: [] };
  const beats: Array<{ id: string; seq: number }> = [];
  const re = /beat ([A-Za-z0-9_]+) \(seq (\d+)\)/g;
  let match: RegExpExecArray | null = re.exec(system);
  while (match !== null) {
    if (match[1] && match[2]) beats.push({ id: match[1], seq: Number(match[2]) });
    match = re.exec(system);
  }
  return {
    facts: beats.slice(-2).map((beat, index) => ({
      text: `Fake fact ${index + 1}: the ledger changed hands.`,
      subjects: [],
      visibility: "public",
      nodeId: beat.id,
    })),
  };
}

const CAST_NAMES = ["Aster", "Bramble", "Cinder", "Dune", "Ember", "Fable", "Gale", "Hearth"];
const CAST_COLORS = ["amber", "teal", "violet", "rose", "lime", "sky", "orange", "slate"];
const CAST_OCCUPATIONS = [
  "dockworker", "bookkeeper", "widow", "smuggler", "clerk", "singer", "courier", "diver",
];
const HOOK_DETAILS = [
  "a driftwood map", "a brass key", "a pressed flower", "a debt ledger",
  "a cracked compass", "an unsigned letter", "a train ticket", "a piece of sea glass",
];

function synthesizeRoleList(system: string): unknown {
  const requested = Number(/Cast size:\s*(\d+)/.exec(system)?.[1] ?? 3);
  const count = Math.min(8, Math.max(1, requested));
  const roles = Array.from({ length: count }, (_, index) => {
    const name = CAST_NAMES[index] ?? `Role ${index + 1}`;
    const tier = count <= 4 ? "spotlight" : index < 4 ? "spotlight" : index < 6 ? "supporting" : "background";
    return {
      identity: {
        name,
        monogram: name.slice(0, 1),
        ageEra: "the present",
        pronouns: "they/them",
        occupation: CAST_OCCUPATIONS[index % CAST_OCCUPATIONS.length] ?? "wanderer",
        accentColor: CAST_COLORS[index % CAST_COLORS.length] ?? "amber",
      },
      hook: `Carries ${HOOK_DETAILS[index % HOOK_DETAILS.length]} and never says why.`,
      psychology: {
        traits: [`trait-${index}`, "watchful"],
        dials: { warmth: 0.4, impulse: 0.3, guile: 0.6, optimism: 0.5 },
        flaws: [`flaw-${index}`],
        fears: [`fear-${index}`],
        desires: ["quiet"],
        secret: `Secret number ${index + 1} stays in the family.`,
      },
      voice: {
        register: `register ${index}`,
        rhythm: `rhythm ${index}`,
        verbosity: "terse",
        vocabularyNotes: "",
        verbalTics: [],
        sampleLines: [`I am ${name} and I worry.`, `Ask ${name} again in the morning.`],
        doNotSay: [],
        narrationStyle: "observational",
      },
      drives: {
        publicGoal: "Finish the job",
        secretGoal: "Get out with a clean name",
        stakes: "Everything, quietly",
      },
      boundariesLines: [],
      relations: (() => {
        if (index >= count - 1) return [];
        const target = CAST_NAMES[index + 1] ?? `Role ${index + 2}`;
        const base = {
          toRoleId: target,
          historyNote: `history ${index}`,
          knowsAbout: `knows ${index}`,
        };
        const entries = [
          {
            ...base,
            dynamic: index === 0 ? "ally" : index === 1 ? "rival" : "stranger",
            tension: index === 1 ? 0.8 : 0.2,
          },
        ];
        if (count === 2 && index === 0) {
          // Two-role casts must carry BOTH an alliance and friction.
          entries.push({ ...base, dynamic: "rival", tension: 0.8 });
        }
        return entries;
      })(),
      meta: {
        storyRole: index === 0 ? "protagonist" : index === 1 ? "foil" : "support",
        tier,
        modelTier: tier === "spotlight" ? "spotlight" : tier === "supporting" ? "standard" : "cheap",
      },
    };
  });
  return { roles };
}

function synthesizeCasting(system: string): unknown {
  const premise = /Scene:\s*([^\n·]+)/.exec(system)?.[1]?.trim();
  const list = synthesizeRoleList(system) as { roles: unknown[] };
  return { premise: premise && premise.length > 0 ? premise : "A fake premise.", roles: list.roles };
}

function synthesizeFieldRegen(system: string): unknown {
  const fieldsLine = /regenerate only these role-card fields:\s*([^\n]+)/i.exec(system)?.[1];
  const fields = (fieldsLine ?? "hook")
    .split(",")
    .map((field) => field.trim().replace(/[.;:]+$/, ""))
    .filter(Boolean);
  const patch: Record<string, unknown> = {};
  for (const field of fields) {
    patch[field] = field === "hook" ? "A regenerated hook with teeth." : `Regenerated ${field}.`;
  }
  return { fields: patch };
}

// ---------------------------------------------------------------------------

export class FakeGateway implements ModelGateway {
  private readonly script: FakeScript;

  constructor(script: FakeScript = {}) {
    this.script = { ...DEFAULT_FAKE_SCRIPT, ...script };
  }

  async *stream(req: GenerationRequest): AsyncIterable<string> {
    assertPromptMessages(req.messages);
    const key = modeMarker(req);
    const chunks = this.script.streamChunks?.[key];
    if (!chunks) {
      throw new Error(`FakeGateway: no stream script for mode "${key}"`);
    }
    for (const chunk of chunks) {
      await Promise.resolve();
      yield chunk;
    }
  }

  async object<T>(req: ObjectRequest<T>): Promise<T> {
    assertPromptMessages(req.messages);
    const scripted = this.script.objects?.[req.schemaName];
    const combinedSource = [req.system, ...req.messages.map((message) => message.content)].join(
      "\n",
    );
    const raw =
      scripted !== undefined
        ? scripted
        : this.script.synthesize === false
          ? undefined
          : this.synthesize(req.schemaName, combinedSource);
    if (raw === undefined) {
      throw new Error(`FakeGateway: no object script for "${req.schemaName}"`);
    }
    return req.schema.parse(raw);
  }

  contextWindow(): number {
    return this.script.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  }

  private synthesize(schemaName: string, system: string): unknown {
    switch (schemaName) {
      case "options":
        return synthesizeOptions(system);
      case "directorMeta":
        return synthesizeDirectorMeta(system);
      case "summary":
        return synthesizeSummary(system);
      case "facts":
        return synthesizeFacts(system);
      case "continuity":
        return { warnings: [] };
      case "casting":
        return synthesizeCasting(system);
      case "castRegen":
        return synthesizeRoleList(system);
      case "fieldRegen":
        return synthesizeFieldRegen(system);
      case "sampleLine":
        return { lines: ["Sample line one.", "Sample line two."] };
      default:
        return undefined;
    }
  }
}
