import type {
  PresentationStyle,
  StoryRole,
  ToneDials,
} from "@convex/shared/contracts";

/**
 * Genre preset seeds (PLAN Appendix A, Phase 4.1). A preset seeds premise,
 * world, tone, cast size, presentation style and a cast skeleton. The
 * skeleton is passed to the casting prompt as a steer; it is not persisted as
 * roles until the casting agent returns (fixtures use it directly).
 */

export type PresetSkeletonRole = {
  storyRole: StoryRole;
  hook: string;
};

export type GenrePreset = {
  id: string;
  name: string;
  premise: string;
  genre: string;
  settingEra: string;
  presentationStyle: PresentationStyle;
  castSize: number;
  tone: ToneDials;
  skeleton: PresetSkeletonRole[];
  starterNote: string;
};

export const GENRE_PRESETS: readonly GenrePreset[] = [
  {
    id: "noir",
    name: "Noir interrogation",
    premise:
      "A rain-soaked precinct, 1948. A detective has one night to break an alibi before the city buries the case.",
    genre: "noir",
    settingEra: "1948, a rain-soaked city precinct",
    presentationStyle: "novel",
    castSize: 4,
    tone: { comedicGrim: 0.6, groundedFantastical: -0.6, romanceRivalry: -0.4 },
    skeleton: [
      { storyRole: "protagonist", hook: "Works the case with a notebook full of other people's sins." },
      { storyRole: "antagonist", hook: "The alibi is perfect because someone was paid to live it." },
      { storyRole: "foil", hook: "A captain who protects the precinct before the truth." },
      { storyRole: "wildcard", hook: "An informant who sells the same secret twice." },
    ],
    starterNote: "Keep the pressure on the alibi; let the rain do half the talking.",
  },
  {
    id: "court",
    name: "Court intrigue",
    premise:
      "The old king is dying; every smile at court hides a knife, and the succession will be decided before dawn.",
    genre: "political fantasy",
    settingEra: "a Renaissance court, one long winter night",
    presentationStyle: "novel",
    castSize: 4,
    tone: { comedicGrim: 0, groundedFantastical: -0.6, romanceRivalry: -0.4 },
    skeleton: [
      { storyRole: "protagonist", hook: "The heir who was never meant to rule." },
      { storyRole: "antagonist", hook: "The spymaster who knows what the crown did to its first queen." },
      { storyRole: "foil", hook: "The queen who would rather burn the palace than lose her son." },
      { storyRole: "wildcard", hook: "The jester people keep forgetting is listening." },
    ],
    starterNote: "Every favor has a price; make the price visible.",
  },
  {
    id: "space",
    name: "Space crew",
    premise:
      "A salvage crew wakes something in the hold of an abandoned freighter, and the ship no longer answers to its own name.",
    genre: "science fiction",
    settingEra: "the edge of charted space, far future",
    presentationStyle: "chat",
    castSize: 4,
    tone: { comedicGrim: 0, groundedFantastical: 0.6, romanceRivalry: -0.4 },
    skeleton: [
      { storyRole: "protagonist", hook: "The captain who signed the salvage contract without reading the manifest." },
      { storyRole: "support", hook: "The engineer who trusts machines more than the crew." },
      { storyRole: "wildcard", hook: "A passenger no one remembers boarding." },
      { storyRole: "foil", hook: "The ship's voice, and it has started lying." },
    ],
    starterNote: "Let the ship be the room everyone is trapped in.",
  },
  {
    id: "campus",
    name: "Campus drama",
    premise:
      "Scholarship students against legacy money at an elite conservatory, the week before the winter showcase.",
    genre: "contemporary drama",
    settingEra: "present day, an elite conservatory",
    presentationStyle: "chat",
    castSize: 4,
    tone: { comedicGrim: 0.3, groundedFantastical: -0.6, romanceRivalry: 0.6 },
    skeleton: [
      { storyRole: "protagonist", hook: "A scholarship violinist with one cracked string and one shot." },
      { storyRole: "antagonist", hook: "The legacy rival who has never been told no." },
      { storyRole: "foil", hook: "A professor who mistakes cruelty for rigor." },
      { storyRole: "support", hook: "The roommate who hears everything through the practice-room wall." },
    ],
    starterNote: "Keep the room small; let status do the shouting.",
  },
  {
    id: "tavern",
    name: "Cozy tavern",
    premise:
      "A tavern at the crossroads where every traveler owes someone something, and tonight two debts have arrived at the same table.",
    genre: "cozy fantasy",
    settingEra: "a crossroads tavern, late autumn",
    presentationStyle: "script",
    castSize: 4,
    tone: { comedicGrim: 0.6, groundedFantastical: 0.2, romanceRivalry: 0.6 },
    skeleton: [
      { storyRole: "protagonist", hook: "The innkeeper keeping the peace and a ledger of favors." },
      { storyRole: "support", hook: "A bard who has been paid to forget a song." },
      { storyRole: "foil", hook: "A bounty hunter drinking with the wrong hand on the wrong table." },
      { storyRole: "wildcard", hook: "A guest who insists they have never been here before." },
    ],
    starterNote: "Warmth first; let the threat arrive by degrees.",
  },
  {
    id: "letters",
    name: "Duel of letters",
    premise:
      "Two rival newspaper columnists in 1920s Paris are secretly each other's anonymous confessor, and both have just been assigned the same scandal.",
    genre: "period romance",
    settingEra: "1920s Paris, a newspaper office after midnight",
    presentationStyle: "novel",
    castSize: 3,
    tone: { comedicGrim: 0, groundedFantastical: -0.6, romanceRivalry: 0.6 },
    skeleton: [
      { storyRole: "protagonist", hook: "The columnist whose sharpest sentences are written to be misunderstood." },
      { storyRole: "antagonist", hook: "The rival who keeps every letter but has burned every name." },
      { storyRole: "foil", hook: "An editor who knows both signatures and says nothing." },
    ],
    starterNote: "Longing in the subtext; never let them say the true thing plainly.",
  },
] as const;

export function presetById(id: string | null | undefined): GenrePreset | undefined {
  if (!id) return undefined;
  return GENRE_PRESETS.find((preset) => preset.id === id);
}

export function skeletonVibe(preset: GenrePreset): string {
  return `Follow this cast skeleton: ${preset.skeleton
    .map((role) => `${role.storyRole} — ${role.hook}`)
    .join("; ")}.`;
}

const TONE_LABELS = [
  { key: "comedicGrim", low: "Comedic", high: "Grim" },
  { key: "groundedFantastical", low: "Grounded", high: "Fantastical" },
  { key: "romanceRivalry", low: "Rivalry", high: "Romance" },
] as const;

export function toneSummary(tone: ToneDials): string {
  return TONE_LABELS.map((dial) => {
    const value = tone[dial.key];
    return value <= -0.2 ? dial.low : value >= 0.2 ? dial.high : "Balanced";
  }).join(" · ");
}
