"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { textToSpeech } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { Card, Textarea, Button, Spinner, ErrorBox, Label, Select, Badge, Input } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { VoiceSettingsControls } from "@/components/VoiceSettingsControls";
import { EmotionTagPalette } from "@/components/EmotionTagPalette";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { VoiceSettings } from "@/lib/types";

interface SideConfig {
  voiceId: string;
  modelId: string;
  settings: VoiceSettings;
  outputFormat: string;
  seed: string;
  audio: Blob | null;
  elapsed: number | null;
  error: string | null;
  loading: boolean;
}

const initial = (): SideConfig => ({
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

const DEFAULT_TEXT =
  "She paused at the door. [whispers] Are you sure about this? [pauses] Once we go in, there's no coming back out the same way.";

export default function ABTestPage() {
  const { apiKey, voices } = useStore();
  const [textA, setTextA] = useState(DEFAULT_TEXT);
  const [textB, setTextB] = useState(DEFAULT_TEXT);
  const [linkedText, setLinkedText] = useState(true);
  const [a, setA] = useState<SideConfig>(initial());
  const [b, setB] = useState<SideConfig>({
    ...initial(),
    settings: { stability: 0.30, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true, speed: 1.0 },
  });

  const updateTextA = (next: string) => {
    setTextA(next);
    if (linkedText) setTextB(next);
  };
  const updateTextB = (next: string) => {
    setTextB(next);
    if (linkedText) setTextA(next);
  };
  const toggleLink = () => {
    // When turning link back ON, sync B to match A so they don't silently differ.
    if (!linkedText) setTextB(textA);
    setLinkedText((v) => !v);
  };

  const generateOne = async (
    side: "A" | "B",
    cfg: SideConfig,
    set: (c: SideConfig) => void,
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
        meta: { abSide: side, linkedText },
      });
    } catch (e) {
      set({ ...cfg, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const runBoth = async () => {
    await Promise.all([
      generateOne("A", a, setA, textA),
      generateOne("B", b, setB, textB),
    ]);
  };

  const insertTagA = (tag: string) => updateTextA(textA + tag);
  const insertTagB = (tag: string) => updateTextB(textB + tag);

  const SideEditor = ({
    label,
    cfg,
    set,
    color,
    text,
  }: {
    label: string;
    cfg: SideConfig;
    set: (c: SideConfig) => void;
    color: "accent" | "warn";
    text: string;
  }) => (
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
        <AudioPlayer blob={cfg.audio} filename={`ab-${label}-${Date.now()}.mp3`} />
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={() => generateOne(label as "A" | "B", cfg, set, text)}
            disabled={cfg.loading}
          >
            {cfg.loading ? <Spinner size={14} /> : `Run ${label} only`}
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">A/B Compare</h1>
        <p className="text-sm text-muted mt-1">
          Two configurations, side-by-side. Use linked text to compare voice settings on the same input, or unlink
          to compare how different text variants render under the same (or different) voice settings.
        </p>
      </div>

      {/* Text inputs — either one shared, or two independent */}
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
            <EmotionTagPalette onInsert={insertTagA} />
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
              <EmotionTagPalette onInsert={insertTagA} />
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
              <EmotionTagPalette onInsert={insertTagB} />
            </div>
          </Card>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button onClick={runBoth} disabled={a.loading || b.loading || !a.voiceId || !b.voiceId}>
          {(a.loading || b.loading) ? <Spinner size={14} /> : "▶▶ Run both"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setB({ ...a, audio: null, elapsed: null, error: null });
          }}
          title="Copy Side A's voice + settings into Side B"
        >
          Copy A → B (settings)
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setA({ ...b, audio: null, elapsed: null, error: null });
          }}
          title="Copy Side B's voice + settings into Side A"
        >
          Copy B → A (settings)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SideEditor label="A" cfg={a} set={setA} color="accent" text={textA} />
        <SideEditor label="B" cfg={b} set={setB} color="warn" text={textB} />
      </div>
    </div>
  );
}
