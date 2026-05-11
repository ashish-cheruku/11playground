// Emotion / prosody tags supported by Eleven v3.
// Insert these inline into the text — the model interprets them as voice direction.
export const EMOTION_TAGS: { tag: string; group: string; hint: string }[] = [
  // Voice quality
  { tag: "[whispers]", group: "Voice", hint: "Whispered delivery" },
  { tag: "[shouts]", group: "Voice", hint: "Loud / projected" },
  { tag: "[softly]", group: "Voice", hint: "Quiet, gentle" },
  { tag: "[loudly]", group: "Voice", hint: "Raised volume" },

  // Emotion
  { tag: "[happily]", group: "Emotion", hint: "Cheerful tone" },
  { tag: "[sadly]", group: "Emotion", hint: "Melancholy" },
  { tag: "[angrily]", group: "Emotion", hint: "Anger / hostility" },
  { tag: "[excitedly]", group: "Emotion", hint: "Energetic, enthusiastic" },
  { tag: "[nervously]", group: "Emotion", hint: "Anxious, uncertain" },
  { tag: "[calmly]", group: "Emotion", hint: "Even, controlled" },
  { tag: "[sarcastically]", group: "Emotion", hint: "Sarcasm / irony" },
  { tag: "[seriously]", group: "Emotion", hint: "Grave, weighty" },
  { tag: "[lovingly]", group: "Emotion", hint: "Affectionate" },
  { tag: "[fearfully]", group: "Emotion", hint: "Afraid" },
  { tag: "[surprised]", group: "Emotion", hint: "Astonished" },
  { tag: "[confused]", group: "Emotion", hint: "Uncertain, puzzled" },
  { tag: "[curious]", group: "Emotion", hint: "Inquisitive" },

  // Non-verbal
  { tag: "[laughs]", group: "Non-verbal", hint: "Laughter" },
  { tag: "[chuckles]", group: "Non-verbal", hint: "Soft laugh" },
  { tag: "[sighs]", group: "Non-verbal", hint: "Audible sigh" },
  { tag: "[gasps]", group: "Non-verbal", hint: "Sharp intake" },
  { tag: "[breathes]", group: "Non-verbal", hint: "Audible breath" },
  { tag: "[crying]", group: "Non-verbal", hint: "Tearful" },
  { tag: "[sobs]", group: "Non-verbal", hint: "Heavy crying" },
  { tag: "[groans]", group: "Non-verbal", hint: "Pained / annoyed" },
  { tag: "[snorts]", group: "Non-verbal", hint: "Derisive" },
  { tag: "[coughs]", group: "Non-verbal", hint: "Cough" },
  { tag: "[clears throat]", group: "Non-verbal", hint: "Throat clear" },
  { tag: "[yawns]", group: "Non-verbal", hint: "Yawn" },

  // Pacing
  { tag: "[pauses]", group: "Pacing", hint: "Brief pause" },
  { tag: "[long pause]", group: "Pacing", hint: "Longer pause" },
  { tag: "[slowly]", group: "Pacing", hint: "Slower pace" },
  { tag: "[quickly]", group: "Pacing", hint: "Faster pace" },
  { tag: "[hesitantly]", group: "Pacing", hint: "With hesitation" },
];

export const PROSODY_HINTS = [
  { sym: "...", hint: "Ellipsis = trailing pause" },
  { sym: "—", hint: "Em dash = abrupt pause / interruption" },
  { sym: "CAPS", hint: "Capitals = emphasis" },
  { sym: "*word*", hint: "Asterisks = stress (sometimes)" },
];

// Audiobook-tuned voice setting presets
export const VOICE_PRESETS = [
  {
    name: "Audiobook — Default",
    settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.0 },
    note: "General-purpose narration. Sweet spot for most fiction.",
  },
  {
    name: "Audiobook — High Emotion",
    settings: { stability: 0.30, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true, speed: 1.0 },
    note: "Action, romance, fear. More expressive, occasional drift.",
  },
  {
    name: "Audiobook — Exposition",
    settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true, speed: 1.0 },
    note: "World-building, descriptive passages. Steady, less dramatic.",
  },
  {
    name: "Non-fiction Narration",
    settings: { stability: 0.65, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true, speed: 1.0 },
    note: "Steady, even, journalistic.",
  },
  {
    name: "Conversational",
    settings: { stability: 0.50, similarity_boost: 0.75, style: 0.40, use_speaker_boost: true, speed: 1.0 },
    note: "Dialogue, podcasts, casual.",
  },
  {
    name: "Maximum Expression",
    settings: { stability: 0.20, similarity_boost: 0.75, style: 0.70, use_speaker_boost: true, speed: 1.0 },
    note: "Stage performance — risky drift, big highs and lows.",
  },
];
