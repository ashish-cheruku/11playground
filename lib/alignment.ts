// Pure helpers for the Text-to-Dialogue-with-timestamps response: decode the
// base64 audio, derive words / per-line segments / metrics from the character
// alignment + voice_segments, and export subtitles (SRT / VTT) + CSV.
//
// All functions are pure (no React, no DOM beyond atob) so they can be unit
// tested against a fixture response.

import type { DialogueAlignment, VoiceSegment } from "./types";

// ---- audio ----

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ---- words ----

export interface WordTiming {
  text: string;
  start: number;
  end: number;
  charStart: number; // inclusive index into alignment.characters
  charEnd: number; // exclusive
  lineIndex: number; // which voice_segment (dialogue_input_index) this word falls in, -1 if none
}

/**
 * Group the character-level alignment into whitespace-delimited words, each
 * carrying the start time of its first character and the end time of its last.
 * `segments` (optional) tags each word with the dialogue line it belongs to.
 */
export function alignmentToWords(
  a: DialogueAlignment | null,
  segments: VoiceSegment[] = [],
  stripTags = false,
): WordTiming[] {
  if (!a || !a.characters?.length) return [];
  const chars = a.characters;
  const st = a.character_start_times_seconds;
  const en = a.character_end_times_seconds;
  const lineOf = (charIdx: number): number => {
    for (const s of segments) {
      if (charIdx >= s.character_start_index && charIdx < s.character_end_index) {
        return s.dialogue_input_index;
      }
    }
    return -1;
  };

  const words: WordTiming[] = [];
  let cur = "";
  let startIdx = -1;
  const flush = (endIdx: number) => {
    if (cur.length > 0 && startIdx >= 0) {
      words.push({
        text: cur,
        start: st[startIdx] ?? 0,
        end: en[endIdx] ?? st[startIdx] ?? 0,
        charStart: startIdx,
        charEnd: endIdx + 1,
        lineIndex: lineOf(startIdx),
      });
    }
    cur = "";
    startIdx = -1;
  };
  let insideTag = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] ?? "";
    // Audio/emotion tags like [whispers] are v3 delivery instructions, not
    // spoken words, but ElevenLabs returns them in the alignment. Skip the whole
    // [...] span so the karaoke transcript reads as clean speech.
    if (stripTags) {
      if (ch === "[") {
        flush(i - 1);
        insideTag = true;
        continue;
      }
      if (insideTag) {
        if (ch === "]") insideTag = false;
        continue;
      }
    }
    if (/\s/.test(ch)) {
      flush(i - 1);
    } else {
      if (startIdx < 0) startIdx = i;
      cur += ch;
    }
  }
  flush(chars.length - 1);
  return words;
}

// ---- per-line segments ----

export interface LineTiming {
  index: number; // dialogue_input_index
  voiceId: string;
  voiceName: string;
  text: string;
  start: number;
  end: number;
  duration: number;
}

/** Remove [audio tags] from a string, collapsing the leftover whitespace. */
export function stripAudioTags(text: string): string {
  return text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

export function segmentsToLines(
  segments: VoiceSegment[],
  a: DialogueAlignment | null,
  voiceName: (id: string) => string,
  stripTags = false,
): LineTiming[] {
  return segments
    .map((s) => {
      const raw = a ? a.characters.slice(s.character_start_index, s.character_end_index).join("") : "";
      return {
        index: s.dialogue_input_index,
        voiceId: s.voice_id,
        voiceName: voiceName(s.voice_id),
        text: stripTags ? stripAudioTags(raw) : raw.trim(),
        start: s.start_time_seconds,
        end: s.end_time_seconds,
        duration: Math.max(0, s.end_time_seconds - s.start_time_seconds),
      };
    })
    .sort((x, y) => x.start - y.start);
}

// ---- metrics ----

export interface SpeakerStat {
  voiceId: string;
  name: string;
  talkTime: number;
  pct: number;
  segments: number;
}
export interface Gap {
  start: number;
  end: number;
  duration: number;
}
export interface DialogueMetrics {
  totalDuration: number;
  charCount: number;
  wordCount: number;
  charsPerSec: number;
  wordsPerSec: number;
  wordsPerMin: number;
  speakers: SpeakerStat[];
  gaps: Gap[];
  longestGap: Gap | null;
}

export function computeMetrics(
  a: DialogueAlignment | null,
  segments: VoiceSegment[],
  voiceName: (id: string) => string,
): DialogueMetrics {
  const totalDuration =
    a && a.character_end_times_seconds.length
      ? Math.max(...a.character_end_times_seconds)
      : segments.length
        ? Math.max(...segments.map((s) => s.end_time_seconds))
        : 0;
  const charCount = a ? a.characters.filter((c) => !/\s/.test(c)).length : 0;
  const wordCount = alignmentToWords(a).length;
  const charsPerSec = totalDuration > 0 ? charCount / totalDuration : 0;
  const wordsPerSec = totalDuration > 0 ? wordCount / totalDuration : 0;

  const map = new Map<string, SpeakerStat>();
  for (const s of segments) {
    const dur = Math.max(0, s.end_time_seconds - s.start_time_seconds);
    const cur =
      map.get(s.voice_id) ??
      { voiceId: s.voice_id, name: voiceName(s.voice_id), talkTime: 0, pct: 0, segments: 0 };
    cur.talkTime += dur;
    cur.segments += 1;
    map.set(s.voice_id, cur);
  }
  const speakers = [...map.values()];
  const talkSum = speakers.reduce((x, s) => x + s.talkTime, 0) || 1;
  for (const s of speakers) s.pct = (s.talkTime / talkSum) * 100;

  const sorted = [...segments].sort((x, y) => x.start_time_seconds - y.start_time_seconds);
  const gaps: Gap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i].start_time_seconds - sorted[i - 1].end_time_seconds;
    if (g > 0.005) {
      gaps.push({ start: sorted[i - 1].end_time_seconds, end: sorted[i].start_time_seconds, duration: g });
    }
  }
  const longestGap = gaps.length ? gaps.reduce((x, y) => (y.duration > x.duration ? y : x)) : null;

  return {
    totalDuration,
    charCount,
    wordCount,
    charsPerSec,
    wordsPerSec,
    wordsPerMin: wordsPerSec * 60,
    speakers,
    gaps,
    longestGap,
  };
}

// ---- active-index lookup (for the karaoke highlight) ----

/** Index of the character active at time `t` (start ≤ t < end), or -1. */
export function activeCharIndex(a: DialogueAlignment | null, t: number): number {
  if (!a) return -1;
  const st = a.character_start_times_seconds;
  const en = a.character_end_times_seconds;
  // Binary search for the rightmost start ≤ t, then confirm against its end.
  let lo = 0;
  let hi = st.length - 1;
  let cand = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (st[mid] <= t) {
      cand = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (cand < 0) return -1;
  return t < (en[cand] ?? Number.POSITIVE_INFINITY) ? cand : -1;
}

/** Index of the word active at time `t`, or -1. */
export function activeWordIndex(words: WordTiming[], t: number): number {
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].start && t < words[i].end) return i;
  }
  return -1;
}

// ---- exports (subtitles / csv) ----

export interface Cue {
  start: number;
  end: number;
  text: string;
}

export function linesToCues(lines: LineTiming[]): Cue[] {
  return lines.map((l) => ({ start: l.start, end: l.end, text: `${l.voiceName}: ${l.text}` }));
}

export function wordsToCues(words: WordTiming[]): Cue[] {
  return words.map((w) => ({ start: w.start, end: w.end, text: w.text }));
}

function pad(n: number, w = 2): string {
  return String(Math.floor(n)).padStart(w, "0");
}
function stamp(t: number, sep: "," | "."): string {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(ms % 1000, 3)}`;
}

export function toSRT(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.text}\n`)
    .join("\n");
}

export function toVTT(cues: Cue[]): string {
  return (
    "WEBVTT\n\n" +
    cues.map((c) => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.text}`).join("\n\n") +
    "\n"
  );
}

export function linesToCSV(lines: LineTiming[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = "line,speaker,voice_id,start_s,end_s,duration_s,text";
  const rows = lines.map((l) =>
    [l.index + 1, esc(l.voiceName), l.voiceId, l.start.toFixed(3), l.end.toFixed(3), l.duration.toFixed(3), esc(l.text)].join(","),
  );
  return [head, ...rows].join("\n");
}

/** Trigger a client-side file download of `text`. */
export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Stable-ish color for a voice id (for the timeline + speaker chips). */
const PALETTE = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#3b82f6", "#f43f5e", "#a855f7"];
export function colorForVoice(voiceId: string, order: string[]): string {
  const idx = order.indexOf(voiceId);
  return PALETTE[(idx < 0 ? order.length : idx) % PALETTE.length];
}

export function fmtTime(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
