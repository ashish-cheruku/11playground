"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { speechToSpeech } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { Card, Button, Label, Spinner, ErrorBox, Select } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { ModelSelector } from "@/components/ModelSelector";
import { VoiceSettingsControls } from "@/components/VoiceSettingsControls";
import { Repeat } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { VoiceSettings } from "@/lib/types";

export default function VoiceChangerPage() {
  const { apiKey, voices } = useStore();
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("eleven_multilingual_sts_v2");
  const [audio, setAudio] = useState<File | null>(null);
  const [removeNoise, setRemoveNoise] = useState(false);
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [settings, setSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.3,
    use_speaker_boost: true,
  });
  const [output, setOutput] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setOutput(null);
    if (!voiceId) return setError("Pick a target voice");
    if (!audio) return setError("Upload an audio file");
    setLoading(true);
    try {
      const blob = await speechToSpeech(apiKey, {
        voiceId,
        audio,
        modelId,
        voiceSettings: settings,
        outputFormat,
        removeBackgroundNoise: removeNoise,
      });
      setOutput(blob);
      const v = voices.find((vv) => vv.voice_id === voiceId);
      await saveHistory({
        id: genId(),
        createdAt: Date.now(),
        kind: "voice-changer",
        label: `S2S → ${v?.name || "voice"}`,
        voiceId,
        voiceName: v?.name,
        modelId,
        settings,
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Voice Changer (Speech-to-Speech)</h1>
        <p className="text-sm text-muted mt-1">
          Upload audio, re-render in a different voice. Preserves emotion and prosody from the source.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <Label>Source audio</Label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudio(e.target.files?.[0] || null)}
              className="block w-full text-sm text-text file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
            />
            {audio && (
              <div className="text-xs text-muted mt-2">
                {audio.name} · {(audio.size / 1024).toFixed(1)} KB
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-3">Output</h3>
            <ErrorBox msg={error} />
            <AudioPlayer blob={output} filename={`s2s-${Date.now()}.mp3`} />
            <div className="mt-3">
              <Button onClick={generate} disabled={loading}>
                {loading ? <Spinner size={14} /> : <span className="inline-flex items-center gap-1.5"><Repeat className="w-4 h-4" strokeWidth={1.75} /> Convert</span>}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Target Voice & Model</h3>
            <div className="space-y-3">
              <VoiceSelector value={voiceId} onChange={setVoiceId} label="Target voice" />
              <ModelSelector
                value={modelId}
                onChange={setModelId}
                filter={(m) => !!m.can_do_voice_conversion}
                label="S2S Model"
              />
              <div>
                <Label>Output Format</Label>
                <Select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                  <option value="mp3_44100_128">MP3 128kbps</option>
                  <option value="mp3_44100_192">MP3 192kbps</option>
                  <option value="pcm_44100">PCM 44.1kHz</option>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={removeNoise}
                  onChange={(e) => setRemoveNoise(e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span>Remove background noise</span>
              </label>
            </div>
          </Card>
          <VoiceSettingsControls value={settings} onChange={setSettings} showSpeed={false} />
        </div>
      </div>
    </div>
  );
}
