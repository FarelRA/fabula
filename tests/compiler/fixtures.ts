import { DEFAULT_TEMPLATES } from "../../convex/prompts/templates";
import type {
  ContextBeat,
  FactLine,
  ModelRef,
  NoteLine,
  RelationLine,
  RoleCardData,
  ScenePromptData,
  SummaryLine,
  TemplateMap,
} from "../../convex/compiler/types";

export function templateMap(): TemplateMap {
  const map: TemplateMap = {};
  for (const template of DEFAULT_TEMPLATES) {
    map[template.key] = {
      key: template.key,
      version: template.version,
      content: template.content,
    };
  }
  return map;
}

export const scene: ScenePromptData = {
  title: "The Glass Harbor",
  premise: "A debt collector knocks on the wrong door in 1970s Saigon.",
  genre: "noir",
  settingEra: "Saigon, 1975",
  presentationStyle: "chat",
  playLanguage: "en",
  tone: { comedicGrim: -0.4, groundedFantastical: -0.6, romanceRivalry: 0.2 },
  boundaries: { allowed: ["tension", "rain"], blocked: ["graphic violence"] },
  lengthTarget: "medium",
  branchFrequency: "key",
  turnMode: "reactive",
  contextBeatsK: 30,
};

export const role: RoleCardData = {
  id: "role_linh",
  name: "Linh",
  hook: "Collects debts she can never repay herself.",
  ageEra: "Saigon, 1975",
  occupation: "debt collector",
  pronouns: "she/her",
  traits: ["patient", "watchful", "dry"],
  dials: { warmth: 0.4, impulse: 0.3, guile: 0.8, optimism: 0.2 },
  flaws: ["proud", "cannot ask for help"],
  fears: ["being exposed"],
  desires: ["a clean name"],
  secret: "She owes the same syndicate she collects for.",
  register: "low, deliberate",
  rhythm: "short sentences",
  verbosity: "terse",
  verbalTics: ["'Fine.'"],
  sampleLines: ["Fine. We do it your way.", "You don't get to be surprised."],
  doNotSay: ["I love you"],
  narrationStyle: "observational, hands and doors",
  publicGoal: "Collect the ledger before the week ends",
  secretGoal: "Buy her own name back",
  stakes: "Her life, quietly",
  boundariesLines: ["Never hits first"],
  tier: "spotlight",
  modelTier: "spotlight",
};

export const otherRole = { id: "role_duc", name: "Mr. Đức", tier: "supporting" as const };

export const relations: RelationLine[] = [
  {
    name: "Mr. Đức",
    dynamic: "rival",
    tension: 0.7,
    historyNote: "He kept her brother's debt on the books.",
    knowsAbout: "He knows about the ledger in her coat.",
  },
];

export const facts: FactLine[] = [
  { text: "The ledger is real and hidden in her coat.", isPinned: false, subjects: ["role_linh"] },
  { text: "The wrong door belongs to the Widow.", isPinned: true, subjects: [] },
];

export const summaries: SummaryLine[] = [
  { text: "The knock was not answered.", coveredThroughSeq: 2 },
  { text: "Someone inside knows the ledger.", coveredThroughSeq: 5 },
];

export const notes: NoteLine[] = [
  { kind: "steer", text: "make her suspicious of the door" },
  { kind: "constraint", text: "Keep the rain relentless." },
  { kind: "doNot", text: "Do not reveal the Widow yet." },
];

export function beats(count = 8, contextBeatsK = 30): ContextBeat[] {
  return Array.from({ length: count }, (_, index) => {
    const seq = index + 1;
    const speakerLinh = seq % 2 === 1;
    return {
      id: `beat_${seq}`,
      seq,
      speakerRoleId: speakerLinh ? "role_linh" : "role_duc",
      speakerName: speakerLinh ? "Linh" : "Mr. Đức",
      text: `Beat number ${seq} moves through the rain.`,
      isPinned: seq === 2 && contextBeatsK < 5,
    };
  });
}

export const model: ModelRef = {
  provider: "openai",
  modelId: "gpt-4.1",
  ref: "openai/gpt-4.1",
};
