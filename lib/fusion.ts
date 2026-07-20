// Voice-fusion math, kept out of the page component so it can be reasoned about
// (and tested) on its own. The only tricky part is turning per-voice weights
// into whole clip counts that sum exactly to a budget, with every voice getting
// at least one clip so no parent is silent in the clone.

export const MIN_VOICES = 2;
export const MAX_VOICES = 6;

// Uploaded-sample mode: weight is a share of the total audio duration handed to
// the clone. 150s sits in the 1–3 min IVC sweet spot; the per-file cap keeps a
// single trimmed mono WAV under the ~10MB upload limit (16-bit @ 44.1kHz mono
// is ~88KB/s, so 110s ≈ 9.7MB worst case).
export const TARGET_TOTAL_S = 150;
export const PER_FILE_CAP_S = 110;

// Clip budget grows gently with voice count: 2→6 (unchanged from the original
// two-voice design), 4→8, 6→12. Capped at 12, which is also how many distinct
// sample lines exist — beyond that, lines would repeat.
export function clipBudget(voiceCount: number): number {
  return Math.min(12, Math.max(6, voiceCount * 2));
}

// Seconds of each uploaded sample to feed the clone: the weighted share of the
// target total, clamped by what the file actually contains and the per-file cap.
// Deliberately does NOT redistribute a short file's shortfall onto the others —
// the caller shows the resulting real ratio instead, so the displayed blend is
// the truth rather than a silently rebalanced one. A NaN duration (metadata the
// browser wouldn't report) falls through to the target; the decode at trim time
// clamps it exactly.
export function allocateSeconds(
  weights: number[],
  durations: number[],
  targetTotal: number = TARGET_TOTAL_S,
): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const fracs = sum > 0 ? weights.map((w) => w / sum) : weights.map(() => 1 / n);
  return fracs.map((f, i) => {
    const target = f * targetTotal;
    const dur = durations[i];
    const available = Number.isFinite(dur) && dur > 0 ? dur : target;
    return Math.max(0, Math.min(target, available, PER_FILE_CAP_S));
  });
}

// Distribute `budget` clips across `weights` proportionally, via largest-
// remainder (Hamilton) apportionment, then enforce a floor of one clip per
// voice by borrowing from whichever voice currently has the most. The result
// always sums to max(budget, weights.length) so each voice keeps ≥1 clip.
export function allocateClips(weights: number[], budget: number): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const total = Math.max(budget, n); // need at least one clip per voice
  const sum = weights.reduce((a, b) => a + b, 0);
  const fracs = sum > 0 ? weights.map((w) => w / sum) : weights.map(() => 1 / n);

  // Proportional apportionment on the full budget.
  const ideal = fracs.map((f) => f * total);
  const counts = ideal.map((x) => Math.floor(x));
  let assigned = counts.reduce((a, b) => a + b, 0);
  const byRemainder = ideal
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r);
  let k = 0;
  while (assigned < total) {
    counts[byRemainder[k % n].i]++;
    assigned++;
    k++;
  }

  // Floor of 1: bump any zero, repay from the current maximum. `total >= n`
  // guarantees the max is always ≥2 when a zero exists, so nothing goes negative.
  for (let i = 0; i < n; i++) {
    if (counts[i] === 0) {
      let maxIdx = 0;
      for (let j = 1; j < n; j++) if (counts[j] > counts[maxIdx]) maxIdx = j;
      counts[maxIdx]--;
      counts[i]++;
    }
  }
  return counts;
}
