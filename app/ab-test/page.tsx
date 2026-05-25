"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { textToSpeech, textToDialogue } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { Card, Textarea, Button, Spinner, ErrorBox, Label, Select, Badge, Input } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { VoiceSettingsControls } from "@/components/VoiceSettingsControls";
import { EmotionTagPalette } from "@/components/EmotionTagPalette";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { VoiceSettings, DialogueLine } from "@/lib/types";

type Mode = "tts" | "dialogue";

interface SideCommon {
  modelId: string;
  settings: VoiceSettings;
  outputFormat: string;
  seed: string;
  audio: Blob | null;
  elapsed: number | null;
  error: string | null;
  loading: boolean;
}

interface TTSSide extends SideCommon {
  voiceId: string;
}

interface DialogueSide extends SideCommon {
  lines: DialogueLine[];
  /** When true, every line uses singleVoiceId and per-line dropdowns hide. */
  useSameVoice: boolean;
  singleVoiceId: string;
}

const initialTTS = (): TTSSide => ({
  voiceId: "",
  modelId: "eleven_v3",
  settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.0 },
  outputFormat: "mp3_44100_128",
  seed: "",
  audio: null,
  elapsed: null,
  error: null,
  loading: false,
});

const initialDialogue = (): DialogueSide => ({
  modelId: "eleven_v3",
  settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.0 },
  outputFormat: "mp3_44100_128",
  seed: "",
  audio: null,
  elapsed: null,
  error: null,
  loading: false,
  lines: [{ voice_id: "", text: "" }],
  useSameVoice: true,
  singleVoiceId: "",
});

const DEFAULT_TEXT =
  "She paused at the door. [whispers] Are you sure about this? [pauses] Once we go in, there's no coming back out the same way.";

const DEFAULT_DIALOGUE_LINES: DialogueLine[] = [
  { voice_id: "", text: "[soft, warm] Welcome back. I wasn't sure you'd come." },
  { voice_id: "", text: "[hesitant] I almost didn't. [pauses] But here I am." },
];

/* ============================================================
 * Pure dialogue-line helpers (module-level so they don't
 * change identity on every render of the page).
 * ============================================================ */
const patchLine = (
  sideLines: DialogueLine[],
  setSideLines: (n: DialogueLine[]) => void,
  i: number,
  patch: Partial<DialogueLine>
) => {
  setSideLines(sideLines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
};
const addLine = (sideLines: DialogueLine[], setSideLines: (n: DialogueLine[]) => void) => {
  const last = sideLines[sideLines.length - 1];
  setSideLines([...sideLines, { voice_id: last?.voice_id || "", text: "" }]);
};
const removeLine = (sideLines: DialogueLine[], setSideLines: (n: DialogueLine[]) => void, i: number) => {
  setSideLines(sideLines.filter((_, idx) => idx !== i));
};

/* ============================================================
 * TTSSideEditor — defined at module level so its identity is
 * stable across page renders (otherwise React unmounts/remounts
 * every keystroke, dropping focus and losing the typed character).
 * ============================================================ */
function TTSSideEditor({
  label,
  cfg,
  set,
  color,
  text,
  onRun,
}: {
  label: "A" | "B";
  cfg: TTSSide;
  set: (c: TTSSide) => void;
  color: "accent" | "warn";
  text: string;
  onRun: (side: "A" | "B", cfg: TTSSide, set: (c: TTSSide) => void, text: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <Badge color={color}>{cfg.modelId || "default model"}</Badge>
      </div>

      <Card>
        <div className="space-y-3">
          <VoiceSelector value={cfg.voiceId} onChange={(v) => set({ ...cfg, voiceId: v })} />
          <ModelSelector
            value={cfg.modelId}
            onChange={(v) => set({ ...cfg, modelId: v })}
            filter={(m) => !!m.can_do_text_to_speech}
          />
          <div>
            <Label>Output Format</Label>
            <Select value={cfg.outputFormat} onChange={(e) => set({ ...cfg, outputFormat: e.target.value })}>
              <option value="mp3_44100_128">MP3 128kbps</option>
              <option value="mp3_44100_192">MP3 192kbps</option>
              <option value="pcm_44100">PCM 44.1kHz</option>
            </Select>
          </div>
          <div>
            <Label>Seed (optional)</Label>
            <Input value={cfg.seed} onChange={(e) => set({ ...cfg, seed: e.target.value })} placeholder="e.g. 12345" />
          </div>
        </div>
      </Card>

      <VoiceSettingsControls value={cfg.settings} onChange={(v) => set({ ...cfg, settings: v })} />

      <Card>
        <h3 className="text-sm font-semibold mb-2">Output</h3>
        {cfg.elapsed !== null && (
          <div className="text-xs text-muted mb-1">Generated in {(cfg.elapsed / 1000).toFixed(1)}s</div>
        )}
        <ErrorBox msg={cfg.error} />
        <AudioPlayer blob={cfg.audio} filename={`ab-tts-${label}-${Date.now()}.mp3`} />
        <div className="mt-3">
          <Button variant="outline" onClick={() => onRun(label, cfg, set, text)} disabled={cfg.loading}>
            {cfg.loading ? <Spinner size={14} /> : `Run ${label} only`}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
 * DialogueSideEditor — also at module level for stable identity.
 * ============================================================ */
function DialogueSideEditor({
  label,
  cfg,
  set,
  color,
  lines,
  setLines,
  onRun,
}: {
  label: "A" | "B";
  cfg: DialogueSide;
  set: (c: DialogueSide) => void;
  color: "accent" | "warn";
  lines: DialogueLine[];
  setLines: (n: DialogueLine[]) => void;
  onRun: (side: "A" | "B", cfg: DialogueSide, set: (c: DialogueSide) => void, lines: DialogueLine[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{label}</h2>
        <Badge color={color}>{cfg.modelId || "default model"}</Badge>
      </div>

      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={cfg.useSameVoice}
                onChange={(e) => {
                  const next = e.target.checked;
                  if (next && cfg.singleVoiceId) {
                    setLines(lines.map((l) => ({ ...l, voice_id: cfg.singleVoiceId })));
                  }
                  set({ ...cfg, useSameVoice: next });
                }}
              />
              Use same voice for every line
            </label>
          </div>
          {cfg.useSameVoice ? (
            <VoiceSelector
              value={cfg.singleVoiceId}
              onChange={(v) => {
                setLines(lines.map((l) => ({ ...l, voice_id: v })));
                set({ ...cfg, singleVoiceId: v });
              }}
            />
          ) : null}
          <ModelSelector
            value={cfg.modelId}
            onChange={(v) => set({ ...cfg, modelId: v })}
            filter={(m) => !!m.can_do_text_to_speech}
          />
          <div>
            <Label>Output Format</Label>
            <Select value={cfg.outputFormat} onChange={(e) => set({ ...cfg, outputFormat: e.target.value })}>
              <option value="mp3_44100_128">MP3 128kbps</option>
              <option value="mp3_44100_192">MP3 192kbps</option>
              <option value="pcm_44100">PCM 44.1kHz</option>
            </Select>
          </div>
          <div>
            <Label>Seed (optional)</Label>
            <Input value={cfg.seed} onChange={(e) => set({ ...cfg, seed: e.target.value })} placeholder="e.g. 12345" />
          </div>
        </div>
      </Card>

      <VoiceSettingsControls value={cfg.settings} onChange={(v) => set({ ...cfg, settings: v })} />

      <Card>
        <h3 className="text-sm font-semibold mb-2">Lines ({lines.length})</h3>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="border border-default rounded p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Line {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeLine(lines, setLines, i)}
                  className="text-xs px-2 py-0.5 rounded border border-default hover:bg-surface-subtle"
                  disabled={lines.length === 1}
                >
                  Remove
                </button>
              </div>
              {!cfg.useSameVoice && (
                <VoiceSelector
                  value={line.voice_id}
                  onChange={(v) => patchLine(lines, setLines, i, { voice_id: v })}
                />
              )}
              <Textarea
                rows={2}
                value={line.text}
                onChange={(e) => patchLine(lines, setLines, i, { text: e.target.value })}
                placeholder="[whispers] What if it doesn't work?"
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="outline" onClick={() => addLine(lines, setLines)}>
            + Add line
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold mb-2">Output</h3>
        {cfg.elapsed !== null && (
          <div className="text-xs text-muted mb-1">Generated in {(cfg.elapsed / 1000).toFixed(1)}s</div>
        )}
        <ErrorBox msg={cfg.error} />
        <AudioPlayer blob={cfg.audio} filename={`ab-dialogue-${label}-${Date.now()}.mp3`} />
        <div className="mt-3">
          <Button variant="outline" onClick={() => onRun(label, cfg, set, lines)} disabled={cfg.loading}>
            {cfg.loading ? <Spinner size={14} /> : `Run ${label} only`}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
 * Main page component.
 * ============================================================ */
export default function ABTestPage() {
  const { apiKey, voices } = useStore();
  const [mode, setMode] = useState<Mode>("tts");

  // ---------------- TTS state ----------------
  const [textA, setTextA] = useState(DEFAULT_TEXT);
  const [textB, setTextB] = useState(DEFAULT_TEXT);
  const [linkedText, setLinkedText] = useState(true);
  const [a, setA] = useState<TTSSide>(initialTTS());
  const [b, setB] = useState<TTSSide>({
    ...initialTTS(),
    settings: { stability: 0.30, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true, speed: 1.0 },
  });

  // ---------------- Dialogue state ----------------
  const [linesA, setLinesA] = useState<DialogueLine[]>([...DEFAULT_DIALOGUE_LINES]);
  const [linesB, setLinesB] = useState<DialogueLine[]>([...DEFAULT_DIALOGUE_LINES]);
  // Default UNLINKED in dialogue mode — the typical use case for dialogue A/B
  // is comparing different line arrangements (e.g. with vs without a trailing
  // " ..." on the last line). Defaulting to linked silently mirrors edits,
  // which the user reasonably called out as defeating the purpose.
  const [linkedLines, setLinkedLines] = useState(false);
  const [dA, setDA] = useState<DialogueSide>(initialDialogue());
  const [dB, setDB] = useState<DialogueSide>(initialDialogue());

  // ---------------- TTS handlers ----------------
  const updateTextA = (next: string) => {
    setTextA(next);
    if (linkedText) setTextB(next);
  };
  const updateTextB = (next: string) => {
    setTextB(next);
    if (linkedText) setTextA(next);
  };
  const toggleLink = () => {
    if (!linkedText) setTextB(textA);
    setLinkedText((v) => !v);
  };

  const runOneTTS = async (
    side: "A" | "B",
    cfg: TTSSide,
    set: (c: TTSSide) => void,
    text: string
  ): Promise<void> => {
    if (!cfg.voiceId) {
      set({ ...cfg, error: "Pick a voice" });
      return;
    }
    set({ ...cfg, loading: true, error: null, audio: null });
    const t0 = Date.now();
    try {
      const blob = await textToSpeech(apiKey, {
        voiceId: cfg.voiceId,
        text,
        modelId: cfg.modelId || undefined,
        voiceSettings: cfg.settings,
        outputFormat: cfg.outputFormat,
        seed: cfg.seed.trim() ? parseInt(cfg.seed.trim()) : undefined,
      });
      const v = voices.find((vv) => vv.voice_id === cfg.voiceId);
      set({ ...cfg, loading: false, audio: blob, elapsed: Date.now() - t0 });
      await saveHistory({
        id: genId(),
        createdAt: Date.now(),
        kind: "tts",
        label: `[A/B ${side}] ${text.slice(0, 60)}`,
        text,
        voiceId: cfg.voiceId,
        voiceName: v?.name,
        modelId: cfg.modelId,
        settings: cfg.settings,
        charCount: text.length,
        audioBlob: blob,
        audioMime: "audio/mpeg",
        meta: { abSide: side, linkedText, mode: "tts" },
      });
    } catch (e) {
      set({ ...cfg, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const runBothTTS = async () => {
    await Promise.all([runOneTTS("A", a, setA, textA), runOneTTS("B", b, setB, textB)]);
  };

  // ---------------- Dialogue handlers ----------------
  const updateLinesA = (next: DialogueLine[]) => {
    setLinesA(next);
    if (linkedLines) setLinesB(next.map((l) => ({ ...l })));
  };
  const updateLinesB = (next: DialogueLine[]) => {
    setLinesB(next);
    if (linkedLines) setLinesA(next.map((l) => ({ ...l })));
  };
  const toggleLinesLink = () => {
    if (!linkedLines) setLinesB(linesA.map((l) => ({ ...l })));
    setLinkedLines((v) => !v);
  };

  const runOneDialogue = async (
    side: "A" | "B",
    cfg: DialogueSide,
    set: (c: DialogueSide) => void,
    lines: DialogueLine[]
  ): Promise<void> => {
    // If "use same voice" is on, override each line's voice_id with singleVoiceId for the call.
    const resolved: DialogueLine[] = cfg.useSameVoice
      ? lines.map((l) => ({ ...l, voice_id: cfg.singleVoiceId }))
      : lines.map((l) => ({ ...l }));
    if (resolved.some((l) => !l.voice_id || !l.text.trim())) {
      set({ ...cfg, error: "Every line needs a voice and text" });
      return;
    }
    set({ ...cfg, loading: true, error: null, audio: null });
    const t0 = Date.now();
    try {
      const blob = await textToDialogue(apiKey, {
        inputs: resolved,
        modelId: cfg.modelId || undefined,
        outputFormat: cfg.outputFormat,
        seed: cfg.seed.trim() ? parseInt(cfg.seed.trim()) : undefined,
        settings: cfg.settings,
      });
      set({ ...cfg, loading: false, audio: blob, elapsed: Date.now() - t0 });
      const totalChars = resolved.reduce((s, l) => s + l.text.length, 0);
      await saveHistory({
        id: genId(),
        createdAt: Date.now(),
        kind: "dialogue",
        label: `[A/B ${side}] ${resolved.length} lines · ${resolved[0].text.slice(0, 50)}`,
        modelId: cfg.modelId,
        settings: cfg.settings,
        charCount: totalChars,
        audioBlob: blob,
        audioMime: "audio/mpeg",
        meta: { abSide: side, linkedLines, mode: "dialogue", lines: resolved },
      });
    } catch (e) {
      set({ ...cfg, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const runBothDialogue = async () => {
    await Promise.all([
      runOneDialogue("A", dA, setDA, linesA),
      runOneDialogue("B", dB, setDB, linesB),
    ]);
  };

  // ---------------- Render ----------------

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">A/B Compare</h1>
        <p className="text-sm text-muted mt-1">
          Two configurations, side-by-side. Compare voice settings on the same input, swap settings to test how the same
          voice handles different text, or compare endpoints (TTS vs Dialogue).
        </p>
      </div>

      {/* Mode tabs */}
      <div className="mb-6">
        <div className="inline-flex rounded border border-default overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("tts")}
            className={`px-4 py-2 text-sm ${mode === "tts" ? "bg-surface-subtle font-semibold" : "hover:bg-surface-subtle"}`}
          >
            Text-to-Speech
          </button>
          <button
            type="button"
            onClick={() => setMode("dialogue")}
            className={`px-4 py-2 text-sm border-l border-default ${mode === "dialogue" ? "bg-surface-subtle font-semibold" : "hover:bg-surface-subtle"}`}
          >
            Text-to-Dialogue
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          {mode === "tts"
            ? "Single-speaker text-to-speech (POST /v1/text-to-speech/{voice_id}). Per-side voice + settings."
            : "Multi-speaker dialogue (POST /v1/text-to-dialogue). Per-side list of {voice, text} lines. Use this to replicate AIStoryForge chunks (it uses text-to-dialogue under the hood)."}
        </p>
      </div>

      {mode === "tts" ? (
        <>
          {/* TTS text inputs */}
          {linkedText ? (
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="m-0">Text (both sides)</Label>
                <button
                  type="button"
                  onClick={toggleLink}
                  className="text-xs px-2 py-1 rounded border border-default hover:bg-surface-subtle"
                  title="Use different text on each side"
                >
                  🔗 Linked — click to unlink
                </button>
              </div>
              <Textarea rows={5} value={textA} onChange={(e) => updateTextA(e.target.value)} />
              <div className="text-xs text-muted mt-1">{textA.length} chars</div>
              <div className="mt-3">
                <EmotionTagPalette onInsert={(tag) => updateTextA(textA + tag)} />
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <Label className="m-0">Text A</Label>
                  <button
                    type="button"
                    onClick={toggleLink}
                    className="text-xs px-2 py-1 rounded border border-default hover:bg-surface-subtle"
                    title="Sync both sides to use the same text"
                  >
                    ⛓️‍💥 Unlinked — click to link
                  </button>
                </div>
                <Textarea rows={5} value={textA} onChange={(e) => updateTextA(e.target.value)} />
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted">{textA.length} chars</div>
                  <button
                    type="button"
                    onClick={() => setTextB(textA)}
                    className="text-xs px-2 py-1 rounded border border-default hover:bg-surface-subtle"
                    title="Copy this text into Text B"
                  >
                    Copy A → B
                  </button>
                </div>
                <div className="mt-3">
                  <EmotionTagPalette onInsert={(tag) => updateTextA(textA + tag)} />
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <Label className="m-0">Text B</Label>
                  <span className="text-xs text-muted">Independent input</span>
                </div>
                <Textarea rows={5} value={textB} onChange={(e) => updateTextB(e.target.value)} />
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted">{textB.length} chars</div>
                  <button
                    type="button"
                    onClick={() => setTextA(textB)}
                    className="text-xs px-2 py-1 rounded border border-default hover:bg-surface-subtle"
                    title="Copy this text into Text A"
                  >
                    Copy B → A
                  </button>
                </div>
                <div className="mt-3">
                  <EmotionTagPalette onInsert={(tag) => updateTextB(textB + tag)} />
                </div>
              </Card>
            </div>
          )}

          <div className="flex gap-2 mb-6 flex-wrap">
            <Button onClick={runBothTTS} disabled={a.loading || b.loading || !a.voiceId || !b.voiceId}>
              {(a.loading || b.loading) ? <Spinner size={14} /> : "▶▶ Run both"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setB({ ...a, audio: null, elapsed: null, error: null })}
              title="Copy Side A's voice + settings into Side B"
            >
              Copy A → B (settings)
            </Button>
            <Button
              variant="outline"
              onClick={() => setA({ ...b, audio: null, elapsed: null, error: null })}
              title="Copy Side B's voice + settings into Side A"
            >
              Copy B → A (settings)
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TTSSideEditor label="A" cfg={a} set={setA} color="accent" text={textA} onRun={runOneTTS} />
            <TTSSideEditor label="B" cfg={b} set={setB} color="warn" text={textB} onRun={runOneTTS} />
          </div>
        </>
      ) : (
        <>
          {/* Dialogue mode top bar */}
          <Card className={`mb-4 ${linkedLines ? "border-2 border-accent" : ""}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-muted">
                {linkedLines ? (
                  <span>
                    <strong>Lines are mirrored across sides.</strong> Editing A also updates B (and vice versa). Use
                    this to compare different settings on the same lines. Click the toggle to make sides independent.
                  </span>
                ) : (
                  <span>
                    <strong>Sides are independent.</strong> Edit A and B separately to compare different line
                    arrangements. Click the toggle to keep them in sync.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={toggleLinesLink}
                className={`text-xs px-3 py-1.5 rounded border ${
                  linkedLines ? "border-accent bg-surface-subtle font-semibold" : "border-default hover:bg-surface-subtle"
                }`}
              >
                {linkedLines ? "🔗 Linked — click to unlink" : "⛓️‍💥 Independent — click to link"}
              </button>
            </div>
          </Card>

          <div className="flex gap-2 mb-6 flex-wrap">
            <Button onClick={runBothDialogue} disabled={dA.loading || dB.loading}>
              {(dA.loading || dB.loading) ? <Spinner size={14} /> : "▶▶ Run both"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDB({ ...dA, audio: null, elapsed: null, error: null });
                setLinesB(linesA.map((l) => ({ ...l })));
              }}
              title="Copy Side A's settings AND lines into Side B"
            >
              Copy A → B (settings + lines)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDA({ ...dB, audio: null, elapsed: null, error: null });
                setLinesA(linesB.map((l) => ({ ...l })));
              }}
              title="Copy Side B's settings AND lines into Side A"
            >
              Copy B → A (settings + lines)
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DialogueSideEditor
              label="A"
              cfg={dA}
              set={setDA}
              color="accent"
              lines={linesA}
              setLines={updateLinesA}
              onRun={runOneDialogue}
            />
            <DialogueSideEditor
              label="B"
              cfg={dB}
              set={setDB}
              color="warn"
              lines={linesB}
              setLines={updateLinesB}
              onRun={runOneDialogue}
            />
          </div>
        </>
      )}
    </div>
  );
}
