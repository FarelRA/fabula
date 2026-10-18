import type {
  RoleCard,
  SceneSettings,
  StoryRole,
} from "@convex/shared/contracts";
import { hashSeed } from "./avatar";
import { mergeRespectingLocks } from "./fields";
import { fixtureId } from "./roles";
import { tierDefaultsForSize, modelTierFor, clampCastSize } from "./tierPolicy";
import type { CastRole, CastScene, SceneDraftInput } from "./types";
import { settingsFromInput } from "./wizard";

/**
 * Deterministic fixtures session (PLAN Phase 0.6 / 4.7 / §13.6).
 *
 * The three doors and the audition are fully usable without a backend:
 * casting, field/cast regeneration, locks, samples and the opening beat are
 * simulated deterministically. E2E-01 runs against this layer. Live mode
 * (Convex) implements the same session interface.
 */

type CatalogEntry = {
  name: string;
  monogram: string;
  pronouns: string;
  occupation: string;
  hook: string;
  storyRole: StoryRole;
  traits: string[];
  flaw: string;
  fear: string;
  desire: string;
  secret: string;
  register: string;
  rhythm: string;
  verbosity: string;
  tic: string;
  publicGoal: string;
  secretGoal: string;
  stakes: string;
  accent: string;
  narrationStyle: string;
};

const CATALOG: readonly CatalogEntry[] = [
  {
    name: "Linh",
    monogram: "L",
    pronouns: "she/her",
    occupation: "debt collector",
    hook: "Collects debts she can never repay herself.",
    storyRole: "protagonist",
    traits: ["precise", "unsentimental", "quietly superstitious"],
    flaw: "believes every ledger can be balanced",
    fear: "being recognized",
    desire: "one clean way out",
    secret: "Her own name is the oldest entry in the book.",
    register: "low and even",
    rhythm: "short sentences, long pauses",
    verbosity: "sparing",
    tic: "taps two fingers on any wooden surface",
    publicGoal: "Collect the debt before dawn.",
    secretGoal: "Find who opened the wrong door and why.",
    stakes: "If the ledger surfaces, her brother takes the fall.",
    accent: "amber",
    narrationStyle: "notices exits before faces",
  },
  {
    name: "Mr. Đức",
    monogram: "Đ",
    pronouns: "he/him",
    occupation: "ledger keeper",
    hook: "Keeps a ledger of everyone else's mistakes.",
    storyRole: "foil",
    traits: ["courteous", "meticulous", "unhurried"],
    flaw: "mistakes control for safety",
    fear: "an entry he cannot correct",
    desire: "to be owed by the right people",
    secret: "He has already forgiven the debt, and cannot say why.",
    register: "formal, old-fashioned",
    rhythm: "complete sentences, polite detours",
    verbosity: "measured",
    tic: "closes the ledger before answering",
    publicGoal: "Keep the night's accounts tidy.",
    secretGoal: "Get the collector to leave without the book.",
    stakes: "The wrong page would ruin three families.",
    accent: "teal",
    narrationStyle: "narrates other people's mistakes, never his own",
  },
  {
    name: "The Widow",
    monogram: "W",
    pronouns: "she/her",
    occupation: "landlady",
    hook: "She knew the man behind the wrong door.",
    storyRole: "wildcard",
    traits: ["amused", "watchful", "allergic to condolences"],
    flaw: "treats grief as a weapon",
    fear: "being pitied",
    desire: "to see the real name spoken aloud",
    secret: "She was the one who changed the address on the envelope.",
    register: "smoky and dry",
    rhythm: "asides inside asides",
    verbosity: "talkative when it costs someone else",
    tic: "lights a cigarette and forgets it",
    publicGoal: "Keep the building's secrets inside the building.",
    secretGoal: "Make the ledger's owner knock on her door.",
    stakes: "The wrong confession brings the police to her tenants.",
    accent: "violet",
    narrationStyle: "finds the joke in every threat",
  },
  {
    name: "Toma",
    monogram: "T",
    pronouns: "he/him",
    occupation: "night taxi driver",
    hook: "Knows every alley and who pays to keep them empty.",
    storyRole: "support",
    traits: ["easygoing", "observant", "incurably early"],
    flaw: "says yes before counting the cost",
    fear: "a passenger who knows his old name",
    desire: "enough to buy the garage",
    secret: "He drove the man behind the wrong door on his last night.",
    register: "warm, clipped city patois",
    rhythm: "starts mid-thought",
    verbosity: "chatty",
    tic: "checks the mirror when lying",
    publicGoal: "Finish the shift with the meter running.",
    secretGoal: "Warn the collector without naming himself.",
    stakes: "One passenger's memory could end his license.",
    accent: "sky",
    narrationStyle: "tells the truth at an angle",
  },
  {
    name: "Sister Bao",
    monogram: "B",
    pronouns: "she/her",
    occupation: "harbor chapel keeper",
    hook: "Runs the chapel where the ledger was last blessed.",
    storyRole: "antagonist",
    traits: ["serene", "absolute", "generous with conditions"],
    flaw: "confuses mercy with ownership",
    fear: "an empty confessional",
    desire: "the debt paid in a currency she chooses",
    secret: "The ledger was her idea, and the interest is her inheritance.",
    register: "gentle, sermon-shaped",
    rhythm: "questions that are not questions",
    verbosity: "expansive",
    tic: "smooths the edge of a page before reading it",
    publicGoal: "Bring the account home to the chapel.",
    secretGoal: "Make the collector confess first.",
    stakes: "The harbor's silence depends on the book staying closed.",
    accent: "rose",
    narrationStyle: "blesses the room before describing the knife",
  },
  {
    name: "Inspector Vũ",
    monogram: "V",
    pronouns: "they/them",
    occupation: "harbor inspector",
    hook: "Has a warrant for the man who never arrived.",
    storyRole: "antagonist",
    traits: ["patient", "literal", "unimpressed by weather"],
    flaw: "believes procedure is a kind of mercy",
    fear: "a case that solves itself",
    desire: "one confession with a signature",
    secret: "They owe a debt to the same ledger, under another name.",
    register: "flat and official",
    rhythm: "lists before conclusions",
    verbosity: "precise",
    tic: "recites dates when nervous",
    publicGoal: "Close the case before the tide turns.",
    secretGoal: "Find the page with their own name on it.",
    stakes: "A wrong arrest closes the harbor for a week.",
    accent: "orange",
    narrationStyle: "reports the weather like evidence",
  },
  {
    name: "Mai",
    monogram: "M",
    pronouns: "she/her",
    occupation: "radio operator",
    hook: "Hears every distress call before the harbor does.",
    storyRole: "support",
    traits: ["restless", "loyal", "bad at secrets"],
    flaw: "answers questions no one asked",
    fear: "silence on the emergency channel",
    desire: "to be the one who gets the message out",
    secret: "She recorded the wrong door's last call and hid the tape.",
    register: "bright, fast, static-edged",
    rhythm: "interrupts herself",
    verbosity: "breathless",
    tic: "turns the dial a quarter-turn after every sentence",
    publicGoal: "Keep the channel open until morning.",
    secretGoal: "Trade the tape for her brother's passage out.",
    stakes: "The tape could clear one name and drown another.",
    accent: "lime",
    narrationStyle: "hears the scene before seeing it",
  },
  {
    name: "Colonel Hạ",
    monogram: "H",
    pronouns: "he/him",
    occupation: "retired fixer",
    hook: "Has outlived every favor he ever called in.",
    storyRole: "support",
    traits: ["courteous", "imposing", "fond of old debts"],
    flaw: "cannot let a favor go unreturned",
    fear: "dying without a clean ledger",
    desire: "to settle one last account honestly",
    secret: "He wrote the address on the envelope, then forgot why.",
    register: "old courtly cadence",
    rhythm: "pauses to let rank do the work",
    verbosity: "storytelling",
    tic: "straightens a cuff before a lie",
    publicGoal: "See the night end without a funeral.",
    secretGoal: "Pass the ledger to someone who will burn it.",
    stakes: "The old guard still listens when he speaks.",
    accent: "indigo",
    narrationStyle: "remembers rooms better than people",
  },
];

const HOOK_VARIANTS = [
  "Was promised the night would end differently.",
  "Has a key that no longer fits the same door.",
  "Is owed a favor that nobody will admit to.",
  "Remembered the address before the name.",
  "Has been waiting for the knock for years.",
  "Knows what the ledger weighs when it is wet.",
];

const OCCUPATION_VARIANTS = [
  "harbor clerk",
  "off-books fixer",
  "insurance investigator",
  "night ferry hand",
  "pawnbroker",
  "radio dispatcher",
];

const SECRET_VARIANTS = [
  "The name in the ledger belongs to someone who is still alive.",
  "They have already burned a page that mattered.",
  "The wrong door was opened on purpose.",
  "They were paid to be somewhere else tonight.",
  "The debt was inherited, not earned.",
];

const GOAL_VARIANTS = [
  "Get the ledger out of the harbor before dawn.",
  "Make someone else say the name first.",
  "Trade the truth for safe passage.",
  "Keep the night's real business off the record.",
  "Settle the account without opening the book.",
];

const LINE_VARIANTS = [
  "The rain is doing the talking tonight. Let it finish.",
  "You can leave the book on the table and the door unlocked behind you.",
  "I knew your name before you knocked. That is the trouble with names.",
  "Everyone in this harbor owes someone. Tonight the someone is early.",
  "Lower your voice. The building has always listened better than the law.",
];

function sampleLinesForEntry(entry: CatalogEntry): string[] {
  const seed = hashSeed(entry.name);
  return [
    LINE_VARIANTS[seed % LINE_VARIANTS.length] ?? LINE_VARIANTS[0]!,
    LINE_VARIANTS[(seed + 2) % LINE_VARIANTS.length] ?? LINE_VARIANTS[1]!,
  ];
}

function makeCard(entry: CatalogEntry): RoleCard {
  const seed = hashSeed(entry.name);
  const role: RoleCard = {
    identity: {
      name: entry.name,
      monogram: entry.monogram,
      ageEra: "late 30s",
      pronouns: entry.pronouns,
      occupation: entry.occupation,
      accentColor: entry.accent,
    },
    hook: entry.hook,
    psychology: {
      traits: entry.traits,
      dials: {
        warmth: 0.35 + (seed % 30) / 100,
        impulse: 0.3 + ((seed >> 2) % 40) / 100,
        guile: 0.4 + ((seed >> 4) % 40) / 100,
        optimism: 0.2 + ((seed >> 6) % 40) / 100,
      },
      flaws: [entry.flaw],
      fears: [entry.fear],
      desires: [entry.desire],
      secret: entry.secret,
    },
    voice: {
      register: entry.register,
      rhythm: entry.rhythm,
      verbosity: entry.verbosity,
      vocabularyNotes: "harbor trade, old debts, weather",
      verbalTics: [entry.tic],
      sampleLines: sampleLinesForEntry(entry),
      doNotSay: ["As an AI", "I cannot feel anything"],
      narrationStyle: entry.narrationStyle,
    },
    drives: {
      publicGoal: entry.publicGoal,
      secretGoal: entry.secretGoal,
      stakes: entry.stakes,
    },
    boundariesLines: ["Won't hurt a child", "Won't break a confidence given in rain"],
    relations: [],
    meta: {
      storyRole: entry.storyRole,
      tier: "spotlight",
      modelTier: modelTierFor("spotlight"),
    },
  };
  return role;
}

export type FixtureCastArgs = {
  premise: string;
  castSize: number;
  youInScene?: { name: string; pronouns?: string };
  vibeSteer?: string;
  variant?: number;
};

export function generateFixtureCast(args: FixtureCastArgs): CastRole[] {
  const count = clampCastSize(args.castSize);
  const seed = hashSeed(`${args.premise}|${args.vibeSteer ?? ""}|${args.variant ?? 0}`);
  const tiers = tierDefaultsForSize(count);
  const roles: CastRole[] = [];

  for (let index = 0; index < count; index += 1) {
    const entry = CATALOG[(seed + index * 3) % CATALOG.length];
    if (!entry) continue;
    const card = makeCard(entry);
    const tier = tiers[index] ?? "background";
    card.meta = { ...card.meta, tier, modelTier: modelTierFor(tier) };
    roles.push({
      id: fixtureId("role", `${seed}:${index}`),
      kind: "ai",
      card,
      status: "active",
      draftLocks: [],
    });
  }

  const dynamics = ["rival", "ally", "family", "mentor"] as const;
  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    const next = roles[(index + 1) % roles.length];
    if (!role || !next || roles.length < 2) continue;
    const dynamic = dynamics[(seed + index) % dynamics.length] ?? "ally";
    role.card.relations = [
      {
        toRoleId: next.id,
        dynamic,
        tension: dynamic === "rival" ? 0.72 : dynamic === "ally" ? 0.3 : 0.5,
        historyNote: `They met over the same unpaid account.`,
        knowsAbout: next.card.hook,
      },
    ];
  }
  // Guarantee the casting contract's alliance + friction edges, even at size 2.
  if (roles.length >= 2) {
    const first = roles[0];
    const second = roles[1];
    if (first?.card.relations[0]) {
      first.card.relations[0] = { ...first.card.relations[0], dynamic: "rival", tension: 0.72 };
    }
    if (second?.card.relations[0]) {
      second.card.relations[0] = { ...second.card.relations[0], dynamic: "ally", tension: 0.3 };
    }
  }

  if (args.youInScene?.name) {
    const entry = CATALOG[(seed + 5) % CATALOG.length];
    if (entry) {
      const card = makeCard(entry);
      card.identity = {
        ...card.identity,
        name: args.youInScene.name,
        pronouns: args.youInScene.pronouns?.trim() || card.identity.pronouns,
        accentColor: "indigo",
      };
      card.meta = {
        ...card.meta,
        storyRole: "protagonist",
        tier: "spotlight",
        modelTier: modelTierFor("spotlight"),
      };
      const human: CastRole = {
        id: fixtureId("role", `${seed}:you`),
        kind: "human",
        card,
        status: "active",
        draftLocks: [],
      };
      const firstAi = roles[0];
      if (firstAi) {
        human.card.relations = [
          {
            toRoleId: firstAi.id,
            dynamic: "ally",
            tension: 0.3,
            historyNote: "They arrived on the same night, from opposite directions.",
            knowsAbout: firstAi.card.hook,
          },
        ];
      }
      roles.push(human);
    }
  }

  return roles;
}

export function buildFixtureScene(
  input: SceneDraftInput,
  sceneId: string,
  variant = 0,
): CastScene {
  return {
    id: sceneId,
    title: input.title,
    premise: input.premise,
    status: "draft",
    settings: settingsFromInput(input),
    roles: generateFixtureCast({ ...input, variant }),
    beats: [],
    updatedAt: hashSeed(sceneId),
  };
}

function excerpt(premise: string): string {
  const trimmed = premise.replace(/\s+/g, " ").trim();
  return trimmed.length > 110 ? `${trimmed.slice(0, 107).trimEnd()}…` : trimmed;
}

export function generateFixtureOpening(
  scene: CastScene,
  variant = 0,
): { text: string; speakerRoleId: string; variant: number } {
  const candidates = scene.roles.filter(
    (role) => role.kind === "ai" && role.status === "active",
  );
  const speaker =
    candidates.find((role) => role.card.meta.tier === "spotlight") ?? candidates[0];
  if (!speaker) throw new Error("Cast a role before generating an opening");

  const seed = hashSeed(`${scene.id}:${variant}`);
  const lines = [
    `The night began the way all bad nights do: ${excerpt(scene.premise)} No one had knocked yet, and everyone was already lying.`,
    `First came the rain; then the name nobody wanted spoken aloud. ${excerpt(
      scene.premise,
    )} The door was the least honest thing in the room.`,
    `There are doors you knock on and doors you fall through. ${excerpt(
      scene.premise,
    )} This was the second kind.`,
    `They said the city forgave everything by morning. ${excerpt(
      scene.premise,
    )} It did not sound like forgiveness.`,
  ];
  const line = lines[seed % lines.length] ?? lines[0]!;
  const spoken =
    LINE_VARIANTS[(seed + 1) % LINE_VARIANTS.length] ?? LINE_VARIANTS[0]!;

  let text: string;
  if (scene.settings.presentationStyle === "script") {
    text = `${speaker.card.identity.name.toLocaleUpperCase()}\n(${line})\n${spoken}`;
  } else if (scene.settings.presentationStyle === "novel") {
    const name = speaker.card.identity.name;
    text = `${line} ${name} said nothing for a moment, then set the ledger on the table. “${spoken}”`;
  } else {
    text = `${speaker.card.identity.name}: ${line} “${spoken}”`;
  }

  return { text, speakerRoleId: speaker.id, variant };
}

export function regenerateFixtureCast(
  scene: CastScene,
  vibe: string,
  variant = 1,
): CastRole[] {
  const activeAi = scene.roles.filter(
    (role) => role.kind === "ai" && role.status === "active",
  );
  const generated = generateFixtureCast({
    premise: scene.premise,
    castSize: activeAi.length,
    vibeSteer: vibe,
    variant,
  });

  let aiIndex = 0;
  return scene.roles.map((role) => {
    if (role.kind !== "ai" || role.status !== "active") return role;
    const next = generated[aiIndex];
    aiIndex += 1;
    if (!next) return role;
    return {
      ...role,
      card: mergeRespectingLocks(role.card, next.card, role.draftLocks),
      sampleLines: undefined,
    };
  });
}

export function regenerateFixtureField(
  role: CastRole,
  field: string,
  salt = 0,
): RoleCard {
  const card = JSON.parse(JSON.stringify(role.card)) as RoleCard;
  const seed = hashSeed(`${JSON.stringify(role.card)}:${field}:${salt}`);
  const pick = <T,>(items: readonly T[], offset = 0): T | undefined =>
    items[(seed + offset) % items.length];

  switch (field) {
    case "identity": {
      card.identity = {
        ...card.identity,
        occupation: pick(OCCUPATION_VARIANTS, 1) ?? card.identity.occupation,
        ageEra: seed % 2 === 0 ? "early 40s" : "late 20s",
      };
      break;
    }
    case "hook":
      card.hook = pick(HOOK_VARIANTS) ?? card.hook;
      break;
    case "psychology": {
      card.psychology = {
        ...card.psychology,
        traits: [...card.psychology.traits].reverse(),
        secret: pick(SECRET_VARIANTS) ?? card.psychology.secret,
      };
      break;
    }
    case "voice": {
      card.voice = {
        ...card.voice,
        register: seed % 2 === 0 ? "dry, close to a whisper" : "warm, carrying",
        rhythm: seed % 3 === 0 ? "starts mid-thought" : "long clauses, gentle landings",
        verbalTics: ["checks the door before answering"],
        sampleLines: [
          card.voice.sampleLines[0] ?? "Say it plainly.",
          pick(LINE_VARIANTS, 2) ?? "The rain knows more than the harbor does.",
        ],
      };
      break;
    }
    case "drives": {
      card.drives = {
        ...card.drives,
        publicGoal: pick(GOAL_VARIANTS) ?? card.drives.publicGoal,
      };
      break;
    }
    case "boundariesLines": {
      const line = pick(["Won't lie to a child", "Won't sell the ledger", "Won't break the code of the harbor"]);
      card.boundariesLines = line && !card.boundariesLines.includes(line)
        ? [...card.boundariesLines, line]
        : card.boundariesLines;
      break;
    }
    case "meta": {
      const order: StoryRole[] = ["protagonist", "antagonist", "foil", "wildcard", "support"];
      const index = order.indexOf(card.meta.storyRole);
      const next = order[(index + 1) % order.length] ?? card.meta.storyRole;
      card.meta = { ...card.meta, storyRole: next };
      break;
    }
    default:
      break;
  }

  return card;
}

export function regenerateFixtureRole(role: CastRole, salt = 0): RoleCard {
  let card = role.card;
  for (const field of ["hook", "psychology", "voice", "drives", "boundariesLines"]) {
    if (role.draftLocks.includes(field)) continue;
    const nextRole: CastRole = { ...role, card };
    const regenerated = regenerateFixtureField(nextRole, field, salt);
    card = regenerated;
  }
  return card;
}

export function fixtureSampleLines(
  role: CastRole,
  force = false,
  salt = 0,
): string[] {
  const base = role.sampleLines ?? role.card.voice.sampleLines;
  if (!force) return base.slice(0, 3);
  const seed = hashSeed(`${JSON.stringify(role.card)}:${salt}`);
  const fresh = LINE_VARIANTS[seed % LINE_VARIANTS.length] ?? LINE_VARIANTS[0]!;
  return [base[0] ?? fresh, fresh].filter(Boolean).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Session storage (fixtures only; live mode uses Convex)
// ---------------------------------------------------------------------------

const SCENE_PREFIX = "fabula:fixtures:scene:";
const LAST_SCENE_KEY = "fabula:fixtures:last-scene";

function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveFixtureScene(scene: CastScene): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(`${SCENE_PREFIX}${scene.id}`, JSON.stringify(scene));
    storage.setItem(LAST_SCENE_KEY, scene.id);
  } catch {
    // Quota/private mode — fixtures still work in memory.
  }
}

export function loadFixtureScene(sceneId: string): CastScene | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${SCENE_PREFIX}${sceneId}`);
    if (!raw) return null;
    return JSON.parse(raw) as CastScene;
  } catch {
    return null;
  }
}

export function lastFixtureSceneId(): string | null {
  return safeStorage()?.getItem(LAST_SCENE_KEY) ?? null;
}

export function defaultBoundaries(): SceneSettings["boundaries"] {
  return { allowed: [], blocked: [] };
}
