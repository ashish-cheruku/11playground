// Shared pool of clone-source sentences.
//
// Instant Voice Cloning wants phonetic VARIETY — six readings of one sentence
// give it a narrow slice of a voice's range, while six different sentences
// cover far more of it. Twelve lines is also the maximum clip budget anywhere
// in the app, so no clip set ever has to repeat a line.
//
// Used by Voice Fusion (clips per parent voice) and by Character Variants
// (clips of one voice performing one character, for the save-as-voice clone).
export const SAMPLE_LINES = [
  "The quiet harbor held its breath as the last ferry slipped past the breakwater.",
  "She counted the seconds between the lightning and the low roll of thunder.",
  "Numbers, names, and small betrayals — he remembered every single one of them.",
  "Coffee, rain, and the smell of old paper filled the narrow little bookshop.",
  "We were never going to agree, but we kept talking anyway, softly, into the night.",
  "Zip the bag, check the map, and don't look back until we reach the ridge at dawn.",
  "The old clock in the hallway chimed once, then fell silent for the rest of the evening.",
  "He traced the coastline on the map with one finger, from the cape down to the delta.",
  "A gull wheeled over the pier while the fishermen hauled their nets in the grey light.",
  "Question everything, she wrote, then underlined the word twice and closed the book.",
  "The engine coughed, caught, and settled into a low steady hum against the cold.",
  "Bright, brittle, and beautiful — the frost stitched the whole field white by morning.",
];
