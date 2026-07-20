"use client";

// Dialogue A/B + Timestamps — run two text-to-dialogue renders on the same (or
// independent) script and compare them. Each side INDEPENDENTLY picks its
// endpoint: "with timestamps" (POST /v1/text-to-dialogue/with-timestamps → audio
// + alignment + voice_segments, unlocking the karaoke transcript / speaker
// timeline / segment timings / metrics / SRT-VTT-JSON-CSV export) or plain
// (POST /v1/text-to-dialogue → audio only). Default: A = with, B = without, so
// out of the box you're comparing the timestamped render against the plain one.

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useStore } from "@/lib/store";
import { textToDialogue, textToDialogueWithTimestamps } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { computeMetrics } from "@/lib/alignment";
import { Card, Textarea, Button, Spinner, ErrorBox, Label, Select, Badge, Input } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { VoiceSettingsControls } from "@/components/VoiceSettingsControls";
import { AudioPlayer } from "@/components/AudioPlayer";
import { DialogueTimestamps } from "@/components/DialogueTimestamps";
import type { VoiceSettings, DialogueLine, DialogueTimestampsResult } from "@/lib/types";

interface Side {
  timestamps: boolean;
  modelId: string;
  settings: VoiceSettings;
  outputFormat: string;
  seed: string;
  useSameVoice: boolean;
  singleVoiceId: string;
  loading: boolean;
  error: string | null;
  elapsed: number | null;
  audio: Blob | null;
  ts: DialogueTimestampsResult | null;
}

const initialSide = (timestamps: boolean): Side => ({
  timestamps,
  modelId: "eleven_v3",
  settings: { stability: 0.45, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 1.0 },
  outputFormat: "mp3_44100_128",
  seed: "",
  useSameVoice: false,
  singleVoiceId: "",
  loading: false,
  error: null,
  elapsed: null,
  audio: null,
  ts: null,
});

const DEFAULT_LINES: DialogueLine[] = [
  { voice_id: "", text: "[whispers] You came. I wasn't sure you would." },
  { voice_id: "", text: "[softly] I almost didn't. But here I am." },
  { voice_id: "", text: "[hesitant] He's been asking for you. Every morning." },
  { voice_id: "", text: "[resolute] Then let's not keep him waiting." },
];

function LinesEditor({
  lines,
  setLines,
  hideVoicePicker,
}: {
  lines: DialogueLine[];
  setLines: (n: DialogueLine[]) => void;
  hideVoicePicker: boolean;
}) {
  const patch = (i: number, p: Partial<DialogueLine>) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  const add = () => setLines([...lines, { voice_id: lines[lines.length - 1]?.voice_id || "", text: "" }]);
  const remove = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="m-0">Lines ({lines.length})</Label>
        <div className="text-xs text-muted">{lines.reduce((s, l) => s + l.text.length, 0)} chars</div>
      </div>
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="border border-default rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Line {i + 1}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={lines.length === 1}
                className="text-xs px-2 py-0.5 rounded border border-default hover:bg-surface-subtle disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            {!hideVoicePicker && <VoiceSelector value={line.voice_id} onChange={(v) => patch(i, { voice_id: v })} />}
            <Textarea rows={2} value={line.text} onChange={(e) => patch(i, { text: e.target.value })} placeholder="[whispers] What if it doesn't work?" />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Button variant="outline" onClick={add}>+ Add line</Button>
      </div>
    </div>
  );
}

function SideConfig({ label, cfg, set, color }: { label: "A" | "B"; cfg: Side; set: (c: Side) => void; color: "accent" | "warn" }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <Badge color={color}>{cfg.modelId || "default"}</Badge>
      </div>

      {/* Per-side endpoint choice — this is the with/without axis. */}
      <Card className={cfg.timestamps ? "border-2 border-accent" : ""}>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" className="h-4 w-4" checked={cfg.timestamps} onChange={(e) => set({ ...cfg, timestamps: e.target.checked })} />
          <span className="text-sm font-semibold">Timestamps</span>
          <Badge color={cfg.timestamps ? "success" : "muted"}>{cfg.timestamps ? "with-timestamps" : "audio only"}</Badge>
        </label>
        <p className="text-xs text-muted mt-1.5">
          {cfg.timestamps
            ? "POST /v1/text-to-dialogue/with-timestamps → karaoke, timeline, segment timings, metrics, export"
            : "POST /v1/text-to-dialogue → plays the audio, nothing else"}
        </p>
      </Card>

      <Card>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={cfg.useSameVoice} onChange={(e) => set({ ...cfg, useSameVoice: e.target.checked })} />
            Use the same voice for every line
          </label>
          {cfg.useSameVoice && <VoiceSelector value={cfg.singleVoiceId} onChange={(v) => set({ ...cfg, singleVoiceId: v })} />}
          <ModelSelector value={cfg.modelId} onChange={(v) => set({ ...cfg, modelId: v })} filter={(m) => !!m.can_do_text_to_speech} />
          <div>
            <Label>Output Format</Label>
            <Select value={cfg.outputFormat} onChange={(e) => set({ ...cfg, outputFormat: e.target.value })}>
              <option value="mp3_44100_128">MP3 128kbps</option>
              <option value="mp3_44100_192">MP3 192kbps</option>
            </Select>
          </div>
          <div>
            <Label>Seed (optional)</Label>
            <Input value={cfg.seed} onChange={(e) => set({ ...cfg, seed: e.target.value })} placeholder="e.g. 12345" />
          </div>
        </div>
      </Card>
      <VoiceSettingsControls value={cfg.settings} onChange={(v) => set({ ...cfg, settings: v })} />
    </div>
  );
}

export default function DialogueABPage() {
  const { apiKey, voices } = useStore();
  const [linesA, setLinesA] = useState<DialogueLine[]>([...DEFAULT_LINES]);
  const [linesB, setLinesB] = useState<DialogueLine[]>([...DEFAULT_LINES]);
  const [linked, setLinked] = useState(true);
  const [a, setA] = useState<Side>(initialSide(true)); // A = with timestamps
  const [b, setB] = useState<Side>(initialSide(false)); // B = without

  const updateLinesA = (n: DialogueLine[]) => {
    setLinesA(n);
    if (linked) setLinesB(n.map((l) => ({ ...l })));
  };
  const updateLinesB = (n: DialogueLine[]) => {
    setLinesB(n);
    if (linked) setLinesA(n.map((l) => ({ ...l })));
  };
  const toggleLink = () => {
    if (!linked) setLinesB(linesA.map((l) => ({ ...l })));
    setLinked((v) => !v);
  };

  // `cfg` is the click-time snapshot and is what the REQUEST is built from — that
  // part is deliberate. State writes, though, must merge into whatever the state
  // is when the response lands (functional updates), or edits the user makes
  // while the request is in flight get reverted by a stale spread.
  const runOne = async (
    side: "A" | "B",
    cfg: Side,
    set: Dispatch<SetStateAction<Side>>,
    lines: DialogueLine[],
  ) => {
    const resolved = cfg.useSameVoice ? lines.map((l) => ({ ...l, voice_id: cfg.singleVoiceId })) : lines.map((l) => ({ ...l }));
    if (resolved.some((l) => !l.voice_id || !l.text.trim())) {
      set((prev) => ({ ...prev, error: "Every line needs a voice and text" }));
      return;
    }
    set((prev) => ({ ...prev, loading: true, error: null, audio: null, ts: null, elapsed: null }));
    const t0 = Date.now();
    try {
      const opts = {
        inputs: resolved,
        modelId: cfg.modelId || undefined,
        outputFormat: cfg.outputFormat,
        seed: cfg.seed.trim() ? parseInt(cfg.seed.trim()) : undefined,
        settings: cfg.settings,
      };
      const chars = resolved.reduce((s, l) => s + l.text.length, 0);
      if (cfg.timestamps) {
        const ts = await textToDialogueWithTimestamps(apiKey, opts);
        // audio/ts are mutually exclusive views of a run — set one, clear the other.
        set((prev) => ({ ...prev, loading: false, error: null, audio: null, ts, elapsed: Date.now() - t0 }));
        await saveHistory({
          id: genId(), createdAt: Date.now(), kind: "dialogue",
          label: `[A/B ${side} ⏱] ${resolved.length} lines · ${resolved[0].text.slice(0, 40)}`,
          modelId: cfg.modelId, settings: cfg.settings, charCount: chars,
          audioBlob: ts.audioBlob, audioMime: ts.audioMime,
          meta: { abSide: side, timestamps: true, lines: resolved, voiceSegments: ts.voiceSegments },
        });
      } else {
        const blob = await textToDialogue(apiKey, opts);
        set((prev) => ({ ...prev, loading: false, error: null, audio: blob, ts: null, elapsed: Date.now() - t0 }));
        await saveHistory({
          id: genId(), createdAt: Date.now(), kind: "dialogue",
          label: `[A/B ${side}] ${resolved.length} lines · ${resolved[0].text.slice(0, 40)}`,
          modelId: cfg.modelId, settings: cfg.settings, charCount: chars,
          audioBlob: blob, audioMime: "audio/mpeg", meta: { abSide: side, timestamps: false, lines: resolved },
        });
      }
    } catch (e) {
      set((prev) => ({
        ...prev,
        loading: false,
        audio: null,
        ts: null,
        elapsed: null,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  };

  const runBoth = async () => {
    await Promise.all([runOne("A", a, setA, linesA), runOne("B", b, setB, linesB)]);
  };

  const nameOf = useMemo(() => {
    const m = new Map(voices.map((v) => [v.voice_id, v.name]));
    return (id: string) => m.get(id) ?? `${id.slice(0, 8)}…`;
  }, [voices]);

  // Only meaningful when BOTH sides produced timestamps (e.g. comparing two
  // configs by their timings). With-vs-without is a visual comparison instead.
  const cmp = useMemo(() => {
    if (!a.ts || !b.ts) return null;
    return {
      A: computeMetrics(a.ts.alignment, a.ts.voiceSegments, nameOf),
      B: computeMetrics(b.ts.alignment, b.ts.voiceSegments, nameOf),
    };
  }, [a.ts, b.ts, nameOf]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Dialogue A/B + Timestamps</h1>
        <p className="text-sm text-muted mt-1">
          Two renders of the same (or independent) script, side by side. Each side picks its own endpoint with the
          <span className="text-accent font-medium"> Timestamps </span>
          switch on its card — <strong>with</strong> (karaoke transcript, speaker timeline, per-segment timings, metrics,
          subtitle export) or <strong>without</strong> (audio only). It starts as <strong>A = with, B = without</strong>,
          so you can compare them directly. Flip both on to A/B two configs by their timings.
        </p>
      </div>

      {/* Lines */}
      {linked ? (
        <Card className="mb-4 border-2 border-accent">
          <div className="flex items-center justify-between mb-3">
            <Label className="m-0">Script (both sides — mirrored)</Label>
            <button type="button" onClick={toggleLink} className="text-xs px-3 py-1.5 rounded border border-accent bg-surface-subtle font-semibold">
              🔗 Linked — click to unlink
            </button>
          </div>
          <LinesEditor lines={linesA} setLines={updateLinesA} hideVoicePicker={a.useSameVoice && b.useSameVoice} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <Label className="m-0">Script A</Label>
              <button type="button" onClick={toggleLink} className="text-xs px-3 py-1.5 rounded border border-default hover:bg-surface-subtle">
                ⛓️‍💥 Independent — click to link
              </button>
            </div>
            <LinesEditor lines={linesA} setLines={updateLinesA} hideVoicePicker={a.useSameVoice} />
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <Label className="m-0">Script B</Label>
              <span className="text-xs text-muted">Independent</span>
            </div>
            <LinesEditor lines={linesB} setLines={updateLinesB} hideVoicePicker={b.useSameVoice} />
          </Card>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <Button onClick={runBoth} disabled={a.loading || b.loading}>
          {a.loading || b.loading ? <Spinner size={14} /> : "▶▶ Run both"}
        </Button>
        <Button variant="outline" onClick={() => setB({ ...a, timestamps: b.timestamps, audio: null, ts: null, elapsed: null, error: null })}>
          Copy A → B (settings)
        </Button>
        <Button variant="outline" onClick={() => setA({ ...b, timestamps: a.timestamps, audio: null, ts: null, elapsed: null, error: null })}>
          Copy B → A (settings)
        </Button>
        <span className="text-xs text-muted ml-1">
          Now: A {a.timestamps ? "with ⏱" : "plain"} · B {b.timestamps ? "with ⏱" : "plain"}
        </span>
      </div>

      {/* Config + output per side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {([["A", a, setA, linesA, "accent"], ["B", b, setB, linesB, "warn"]] as const).map(
          ([label, cfg, set, lines, color]) => (
            <div key={label} className="space-y-3">
              <SideConfig label={label} cfg={cfg} set={set} color={color} />
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">
                    Output {label} <span className="text-muted font-normal">· {cfg.timestamps ? "with timestamps" : "audio only"}</span>
                  </h3>
                  {cfg.elapsed !== null && <span className="text-xs text-muted">{(cfg.elapsed / 1000).toFixed(1)}s</span>}
                </div>
                <ErrorBox msg={cfg.error} />
                <div className="mb-3">
                  <Button variant="outline" onClick={() => runOne(label, cfg, set, lines)} disabled={cfg.loading}>
                    {cfg.loading ? <Spinner size={14} /> : `Run ${label} only`}
                  </Button>
                </div>
                {cfg.ts ? (
                  <DialogueTimestamps result={cfg.ts} voices={voices} label={label} />
                ) : (
                  <AudioPlayer blob={cfg.audio} filename={`dialogue-${label}-${Date.now()}.mp3`} />
                )}
              </Card>
            </div>
          ),
        )}
      </div>

      {/* A/B comparison — both sides with timestamps */}
      {cmp && (
        <Card className="mt-6">
          <h3 className="text-sm font-semibold mb-3">A/B comparison (both sides timestamped)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted text-xs">
                <tr className="text-left">
                  <th className="py-1 pr-4">Metric</th>
                  <th className="py-1 pr-4">A</th>
                  <th className="py-1 pr-4">B</th>
                  <th className="py-1">Δ (B − A)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <CmpRow name="Duration (s)" a={cmp.A.totalDuration} b={cmp.B.totalDuration} d={2} />
                <CmpRow name="Words" a={cmp.A.wordCount} b={cmp.B.wordCount} d={0} />
                <CmpRow name="Words / min" a={cmp.A.wordsPerMin} b={cmp.B.wordsPerMin} d={0} />
                <CmpRow name="Chars / sec" a={cmp.A.charsPerSec} b={cmp.B.charsPerSec} d={1} />
                <CmpRow name="Longest gap (s)" a={cmp.A.longestGap?.duration ?? 0} b={cmp.B.longestGap?.duration ?? 0} d={2} />
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CmpRow({ name, a, b, d }: { name: string; a: number; b: number; d: number }) {
  const delta = b - a;
  return (
    <tr className="border-t border-default">
      <td className="py-1 pr-4">{name}</td>
      <td className="py-1 pr-4">{a.toFixed(d)}</td>
      <td className="py-1 pr-4">{b.toFixed(d)}</td>
      <td className={`py-1 ${delta > 0 ? "text-danger" : delta < 0 ? "text-accent" : "text-muted"}`}>
        {delta > 0 ? "+" : ""}
        {delta.toFixed(d)}
      </td>
    </tr>
  );
}
