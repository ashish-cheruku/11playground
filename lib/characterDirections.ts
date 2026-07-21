// Character-performance direction for Eleven v3.
//
// ElevenLabs documents these as "natural-language instructions, not an enum
// parameter" — so these presets are a STARTING POINT, not a closed menu. Any
// bracketed description works, and richer phrasing ("frail elderly man, voice
// wavering") generally reads better than a bare noun ("old man").
//
// Important limitation, straight from the docs: the chosen voice and its
// training samples cap what a tag can do — "don't expect a whispering voice to
// suddenly shout". These directions make voice X *perform as* a character, the
// way an audiobook narrator does. They are not an age or gender transform.

export interface CharacterDirection {
  /** The bracketed tag, prefixed to the line at request time. */
  tag: string;
  /** Short name for the variant row. */
  label: string;
  group: "Age & gender" | "Accent" | "Role & genre" | "Register";
}

export const CHARACTER_DIRECTIONS: CharacterDirection[] = [
  // Age & gender — the "one narrator plays every part" core.
  { tag: "[narrating neutrally]", label: "Narrator", group: "Age & gender" },
  { tag: "[speaking as a young woman, warm and bright]", label: "Young woman", group: "Age & gender" },
  { tag: "[speaking as an older woman, gentle and papery]", label: "Older woman", group: "Age & gender" },
  { tag: "[speaking as a small child, high and piping]", label: "Small child", group: "Age & gender" },
  { tag: "[speaking as a teenage boy, voice cracking]", label: "Teenage boy", group: "Age & gender" },
  { tag: "[speaking as a frail elderly man, voice wavering]", label: "Elderly man", group: "Age & gender" },
  { tag: "[speaking as a gruff middle-aged man]", label: "Gruff man", group: "Age & gender" },

  // Accent — [strong X accent] is a documented fill-in-the-blank form.
  { tag: "[British accent]", label: "British", group: "Accent" },
  { tag: "[strong Southern US accent]", label: "Southern US", group: "Accent" },
  { tag: "[Australian accent]", label: "Australian", group: "Accent" },
  { tag: "[Irish accent]", label: "Irish", group: "Accent" },
  { tag: "[French accent]", label: "French", group: "Accent" },
  { tag: "[Indian accent]", label: "Indian", group: "Accent" },

  // Role & genre — documented archetype/genre-cue examples.
  { tag: "[fantasy narrator]", label: "Fantasy narrator", group: "Role & genre" },
  { tag: "[classic film noir]", label: "Film noir", group: "Role & genre" },
  { tag: "[sci-fi AI voice]", label: "Sci-fi AI", group: "Role & genre" },
  { tag: "[pirate voice]", label: "Pirate", group: "Role & genre" },
  { tag: "[evil scientist voice]", label: "Evil scientist", group: "Role & genre" },
  { tag: "[news anchor, crisp and measured]", label: "News anchor", group: "Role & genre" },

  // Register — delivery shifts that read as a different "character" of speech.
  { tag: "[conspiratorial whisper]", label: "Conspiratorial", group: "Register" },
  { tag: "[weary and resigned]", label: "Weary", group: "Register" },
  { tag: "[breathless and urgent]", label: "Urgent", group: "Register" },
  { tag: "[dry and sardonic]", label: "Sardonic", group: "Register" },
];

export const DIRECTION_GROUPS = ["Age & gender", "Accent", "Role & genre", "Register"] as const;

// v3 exposes stability as three named modes. The API takes a 0–1 float; the
// docs name the modes without publishing a numeric table, so these are the
// logical anchor points and the UI shows the raw value being sent.
export interface StabilityMode {
  key: "creative" | "natural" | "robust";
  label: string;
  value: number;
  note: string;
}

export const STABILITY_MODES: StabilityMode[] = [
  { key: "creative", label: "Creative", value: 0.0, note: "Most expressive, strongest tag adherence — can hallucinate." },
  { key: "natural", label: "Natural", value: 0.5, note: "Balanced; closest to the original voice recording." },
  { key: "robust", label: "Robust", value: 1.0, note: "Most stable, but largely ignores direction tags." },
];

export const stabilityValue = (key: StabilityMode["key"]): number =>
  STABILITY_MODES.find((m) => m.key === key)?.value ?? 0.5;

// The line sent to the API: direction prefixed to the text. Kept as a function
// so the page can show the user exactly what will be sent.
export function composeLine(direction: string, text: string): string {
  const d = direction.trim();
  const t = text.trim();
  if (!d) return t;
  return `${d} ${t}`;
}
