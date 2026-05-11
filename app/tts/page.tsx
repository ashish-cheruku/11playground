"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { textToSpeech } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { Card, Textarea, Button, Label, Select, Spinner, ErrorBox, Input, Badge } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { VoiceSettingsControls } from "@/components/VoiceSettingsControls";
import { EmotionTagPalette } from "@/components/EmotionTagPalette";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { VoiceSettings } from "@/lib/types";

const DEFAULT_TEXT =
  "She paused at the door. [whispers] Are you sure about this? [pauses] Once we go in, there's no coming back out the same way.";

export default function TTSPage() {
  const { apiKey, voices } = useStore();
  const [text, setText] = useState(DEFAULT_TEXT);
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("eleven_v3");
  const [settings, setSettings] = useState<VoiceSettings>({
    stability: 0.45,
    similarity_boost: 0.75,
    style: 0.35,
    use_speaker_boost: true,
    speed: 1.0,
  });
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [seed, setSeed] = useState<string>("");
  const [normalize, setNormalize] = useState<"auto" | "on" | "off">("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (tag: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = text.slice(0, start) + tag + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + tag.length;
    });
  };

  const generate = async () => {
    if (!voiceId) return setError("Pick a voice");
    if (!text.trim()) return setError("Enter text");
    setError(null);
    setAudio(null);
    setLoading(true);
    const t0 = Date.now();
    try {
      const blob = await textToSpeech(apiKey, {
        voiceId,
        text,
        modelId: modelId || undefined,
        voiceSettings: settings,
        outputFormat,
        seed: seed.trim() ? parseInt(seed.trim()) : undefined,
        applyTextNormalization: normalize,
      });
      setAudio(blob);
      setElapsed(Date.now() - t0);
      const v = voices.find((vv) => vv.voice_id === voiceId);
      await saveHistory({
        id: genId(),
        createdAt: Date.now(),
        kind: "tts",
        label: text.slice(0, 80),
        text,
        voiceId,
        voiceName: v?.name,
        modelId,
        settings,
        charCount: text.length,
        audioBlob: blob,
        audioMime: "audio/mpeg",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Text to Speech</h1>
        <p className="text-sm text-muted mt-1">
          Single-voice synthesis. Use v3 for fiction with emotion tags. Output saves to history.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: text + emotion palette */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-2">
              <Label>Text {`(${text.length} chars)`}</Label>
              <div className="flex items-center gap-2">
                <Badge color="muted">~{Math.ceil(text.length / 1000 * 0.18 * 100) / 100} credits</Badge>
              </div>
            </div>
            <Textarea ref={textareaRef} rows={10} value={text} onChange={(e) => setText(e.target.value)} />
          </Card>
          <EmotionTagPalette onInsert={insertTag} />

          <Card>
            <h3 className="text-sm font-semibold mb-3">Output</h3>
            <ErrorBox msg={error} />
            {elapsed !== null && (
              <div className="text-xs text-muted mb-2">Generated in {(elapsed / 1000).toFixed(1)}s</div>
            )}
            <AudioPlayer blob={audio} filename={`tts-${Date.now()}.mp3`} />
            <div className="mt-3">
              <Button onClick={generate} disabled={loading || !voiceId}>
                {loading ? <Spinner size={14} /> : "▶ Generate"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: controls */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Voice & Model</h3>
            <div className="space-y-3">
              <VoiceSelector value={voiceId} onChange={setVoiceId} />
              <ModelSelector value={modelId} onChange={setModelId} filter={(m) => !!m.can_do_text_to_speech} />
            </div>
          </Card>

          <VoiceSettingsControls value={settings} onChange={setSettings} />

          <Card>
            <h3 className="text-sm font-semibold mb-3">Output Settings</h3>
            <div className="space-y-3">
              <div>
                <Label>Output Format</Label>
                <Select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                  <option value="mp3_44100_128">MP3 44.1kHz 128kbps (audiobook default)</option>
                  <option value="mp3_44100_192">MP3 44.1kHz 192kbps</option>
                  <option value="mp3_44100_96">MP3 44.1kHz 96kbps</option>
                  <option value="mp3_44100_64">MP3 44.1kHz 64kbps</option>
                  <option value="pcm_44100">PCM 44.1kHz</option>
                  <option value="pcm_22050">PCM 22.05kHz</option>
                  <option value="pcm_16000">PCM 16kHz</option>
                  <option value="ulaw_8000">μ-law 8kHz</option>
                </Select>
              </div>
              <div>
                <Label>Text Normalization</Label>
                <Select value={normalize} onChange={(e) => setNormalize(e.target.value as "auto" | "on" | "off")}>
                  <option value="auto">Auto</option>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </Select>
              </div>
              <div>
                <Label>Seed (optional)</Label>
                <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. 12345" />
                <p className="text-[11px] text-muted mt-1">Same seed = reproducible output. Useful for chunk re-rolls.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
