"use client";

// The full "with-timestamps" view for one dialogue generation: a playback-synced
// karaoke transcript, a per-speaker timeline, a segment table (click to seek),
// timing metrics, and JSON / SRT / VTT / CSV export. Everything structural is
// derived from the RAW alignment + voice_segments (whose character indices line
// up with the raw output); the normalized alignment is offered as an extra panel.

import { useMemo, useRef, useState } from "react";
import type { DialogueTimestampsResult, Voice } from "@/lib/types";
import {
  alignmentToWords,
  activeWordIndex,
  colorForVoice,
  computeMetrics,
  downloadText,
  fmtTime,
  linesToCSV,
  linesToCues,
  segmentsToLines,
  toSRT,
  toVTT,
  wordsToCues,
} from "@/lib/alignment";
import { SyncedAudioPlayer, type SyncedPlayerHandle } from "./SyncedAudioPlayer";
import { Button, Card } from "./ui";

export function DialogueTimestamps({
  result,
  voices,
  label = "A",
}: {
  result: DialogueTimestampsResult;
  voices: Voice[];
  label?: string;
}) {
  const [t, setT] = useState(0);
  const [showNormalized, setShowNormalized] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const playerRef = useRef<SyncedPlayerHandle>(null);
  const seek = (to: number) => playerRef.current?.seek(to);

  const voiceName = useMemo(() => {
    const byId = new Map(voices.map((v) => [v.voice_id, v.name]));
    return (id: string) => byId.get(id) ?? `${id.slice(0, 8)}…`;
  }, [voices]);

  const align = result.alignment ?? result.normalizedAlignment;
  const order = useMemo(
    () => [...new Set(result.voiceSegments.map((s) => s.voice_id))],
    [result.voiceSegments],
  );
  const lines = useMemo(
    () => segmentsToLines(result.voiceSegments, align, voiceName, !showTags),
    [result.voiceSegments, align, voiceName, showTags],
  );
  const words = useMemo(
    () => alignmentToWords(align, result.voiceSegments, !showTags),
    [align, result.voiceSegments, showTags],
  );
  const metrics = useMemo(
    () => computeMetrics(align, result.voiceSegments, voiceName),
    [align, result.voiceSegments, voiceName],
  );
  const activeWord = activeWordIndex(words, t);
  const total = metrics.totalDuration || 0.001;

  const wordsByLine = useMemo(
    () => lines.map((l) => ({ line: l, ws: words.filter((w) => w.lineIndex === l.index) })),
    [lines, words],
  );

  const normWords = useMemo(
    () => (result.normalizedAlignment ? alignmentToWords(result.normalizedAlignment, [], !showTags) : []),
    [result.normalizedAlignment, showTags],
  );
  const activeNormWord = activeWordIndex(normWords, t);

  const dl = (ext: string, text: string, mime: string) =>
    downloadText(`dialogue-${label}-${Date.now()}.${ext}`, text, mime);
  const jsonPayload = JSON.stringify(
    {
      alignment: result.alignment,
      normalized_alignment: result.normalizedAlignment,
      voice_segments: result.voiceSegments,
    },
    null,
    2,
  );

  return (
    <div className="space-y-3">
      <SyncedAudioPlayer
        ref={playerRef}
        blob={result.audioBlob}
        filename={`dialogue-${label}-${Date.now()}.mp3`}
        onTime={setT}
      />

      {/* Metrics strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Metric label="Duration" value={fmtTime(metrics.totalDuration)} />
        <Metric label="Words" value={String(metrics.wordCount)} />
        <Metric label="WPM" value={metrics.wordsPerMin.toFixed(0)} />
        <Metric label="Chars" value={String(metrics.charCount)} />
        <Metric label="Speakers" value={String(metrics.speakers.length)} />
        <Metric label="Longest gap" value={metrics.longestGap ? `${metrics.longestGap.duration.toFixed(2)}s` : "—"} />
      </div>

      {/* Speaker timeline */}
      <Card>
        <div className="text-xs font-semibold mb-2">Speaker timeline · click to seek</div>
        <div className="relative h-8 rounded overflow-hidden border border-default bg-surface-subtle">
          {lines.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => seek(l.start)}
              title={`${l.voiceName} · ${l.start.toFixed(2)}–${l.end.toFixed(2)}s`}
              className="absolute top-0 h-full opacity-80 hover:opacity-100"
              style={{
                left: `${(l.start / total) * 100}%`,
                width: `${Math.max(0.4, (l.duration / total) * 100)}%`,
                backgroundColor: colorForVoice(l.voiceId, order),
              }}
            />
          ))}
          <div
            className="absolute top-0 h-full w-0.5 bg-black/70 dark:bg-white/80 pointer-events-none"
            style={{ left: `${Math.min(100, (t / total) * 100)}%` }}
          />
        </div>
        {/* Legend + talk-time */}
        <div className="mt-3 space-y-1.5">
          {metrics.speakers.map((s) => (
            <div key={s.voiceId} className="flex items-center gap-2 text-xs">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: colorForVoice(s.voiceId, order) }} />
              <span className="w-28 truncate" title={s.name}>{s.name}</span>
              <div className="flex-1 h-2 rounded bg-surface-subtle overflow-hidden">
                <div className="h-full" style={{ width: `${s.pct}%`, backgroundColor: colorForVoice(s.voiceId, order) }} />
              </div>
              <span className="text-muted tabular-nums w-24 text-right">
                {s.talkTime.toFixed(1)}s · {s.pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Karaoke transcript */}
      <Card>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="text-xs font-semibold">Transcript · highlights with playback · click a word to seek</div>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none shrink-0">
            <input type="checkbox" checked={showTags} onChange={(e) => setShowTags(e.target.checked)} />
            Show audio tags
          </label>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {wordsByLine.map(({ line, ws }, li) => (
            <div key={li} className="flex gap-2">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded self-start shrink-0 text-white"
                style={{ backgroundColor: colorForVoice(line.voiceId, order) }}
              >
                {line.voiceName}
              </span>
              <p className="text-sm leading-relaxed flex-1">
                {ws.map((w, wi) => {
                  const globalIdx = words.indexOf(w);
                  const active = globalIdx === activeWord;
                  return (
                    <button
                      key={wi}
                      type="button"
                      onClick={() => seek(w.start)}
                      className={`rounded px-0.5 transition-colors ${
                        active ? "bg-accent text-white" : "hover:bg-surface-subtle"
                      }`}
                    >
                      {w.text}
                    </button>
                  );
                })}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Segment table */}
      <Card>
        <div className="text-xs font-semibold mb-2">Segments</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted">
              <tr className="text-left">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Speaker</th>
                <th className="py-1 pr-2 tabular-nums">Start</th>
                <th className="py-1 pr-2 tabular-nums">End</th>
                <th className="py-1 pr-2 tabular-nums">Dur</th>
                <th className="py-1">Text</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr
                  key={i}
                  onClick={() => seek(l.start)}
                  className={`cursor-pointer border-t border-default hover:bg-surface-subtle ${
                    t >= l.start && t < l.end ? "bg-surface-subtle" : ""
                  }`}
                >
                  <td className="py-1 pr-2">{l.index + 1}</td>
                  <td className="py-1 pr-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colorForVoice(l.voiceId, order) }} />
                      {l.voiceName}
                    </span>
                  </td>
                  <td className="py-1 pr-2 tabular-nums">{l.start.toFixed(2)}</td>
                  <td className="py-1 pr-2 tabular-nums">{l.end.toFixed(2)}</td>
                  <td className="py-1 pr-2 tabular-nums">{l.duration.toFixed(2)}</td>
                  <td className="py-1 max-w-[16rem] truncate" title={l.text}>{l.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Exports */}
      <Card>
        <div className="text-xs font-semibold mb-2">Export</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="text-xs" onClick={() => dl("json", jsonPayload, "application/json")}>
            JSON
          </Button>
          <Button variant="outline" className="text-xs" onClick={() => dl("srt", toSRT(linesToCues(lines)), "text/plain")}>
            SRT (lines)
          </Button>
          <Button variant="outline" className="text-xs" onClick={() => dl("vtt", toVTT(linesToCues(lines)), "text/vtt")}>
            VTT (lines)
          </Button>
          <Button variant="outline" className="text-xs" onClick={() => dl("words.srt", toSRT(wordsToCues(words)), "text/plain")}>
            SRT (words)
          </Button>
          <Button variant="outline" className="text-xs" onClick={() => dl("csv", linesToCSV(lines), "text/csv")}>
            CSV
          </Button>
        </div>
      </Card>

      {/* Normalized alignment (optional detail) */}
      {result.normalizedAlignment && (
        <Card>
          <button
            type="button"
            onClick={() => setShowNormalized((v) => !v)}
            className="text-xs font-semibold flex items-center gap-1"
          >
            <span>{showNormalized ? "▾" : "▸"}</span> Normalized alignment ({normWords.length} words)
          </button>
          {showNormalized && (
            <p className="text-sm leading-relaxed mt-2 max-h-40 overflow-y-auto">
              {normWords.map((w, wi) => (
                <button
                  key={wi}
                  type="button"
                  onClick={() => seek(w.start)}
                  className={`rounded px-0.5 ${wi === activeNormWord ? "bg-accent text-white" : "hover:bg-surface-subtle"}`}
                >
                  {w.text}
                </button>
              ))}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-default bg-surface-subtle px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
