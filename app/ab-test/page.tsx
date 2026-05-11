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

export default function ABTestPage() {
  const { apiKey, voices } = useStore();
  const [text, setText] = useState(
    "She paused at the door. [whispers] Are you sure about this? [pauses] Once we go in, there's no coming back out the same way."
  );
  const [a, setA] = useState<SideConfig>(initial());
  const [b, setB] = useState<SideConfig>({
    ...initial(),
    settings: { stability: 0.30, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true, speed: 1.0 },
  });

  const generateOne = async (
    side: "A" | "B",
    cfg: SideConfig,
    set: (c: SideConfig) => void
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
        meta: { abSide: side },
      });
    } catch (e) {
      set({ ...cfg, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const runBoth = async () => {
    await Promise.all([generateOne("A", a, setA), generateOne("B", b, setB)]);
  };

  const insertTag = (tag: string) => setText((t) => t + tag);

  const SideEditor = ({
    label,
    cfg,
    set,
    color,
  }: {
    label: string;
    cfg: SideConfig;
    set: (c: SideConfig) => void;
    color: "accent" | "warn";
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
          <Button variant="outline" onClick={() => generateOne(label as "A" | "B", cfg, set)} disabled={cfg.loading}>
            {cfg.loading ? <Spinner size={14} /> : `Run ${label} only`}
          </Button>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">A/B Compare</h1>
        <p className="text-sm text-muted mt-1">
          Same text, two configurations, side-by-side. The fastest way to find the right voice settings for your
          content.
        </p>
      </div>

      <Card className="mb-4">
        <Label>Text (used by both A and B)</Label>
        <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="text-xs text-muted mt-1">{text.length} chars</div>
      </Card>

      <div className="mb-4">
        <EmotionTagPalette onInsert={insertTag} />
      </div>

      <div className="flex gap-2 mb-6">
        <Button onClick={runBoth} disabled={a.loading || b.loading || !a.voiceId || !b.voiceId}>
          {(a.loading || b.loading) ? <Spinner size={14} /> : "▶▶ Run both"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setB({ ...a, audio: null, elapsed: null, error: null });
          }}
        >
          Copy A → B
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SideEditor label="A" cfg={a} set={setA} color="accent" />
        <SideEditor label="B" cfg={b} set={setB} color="warn" />
      </div>
    </div>
  );
}
