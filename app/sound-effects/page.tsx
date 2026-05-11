"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { soundGeneration } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { Card, Textarea, Button, Spinner, ErrorBox, Slider, Label, Select } from "@/components/ui";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Volume2 } from "lucide-react";

const SAMPLES = [
  "A heavy wooden door slowly creaking open in an empty stone hallway",
  "Distant thunder rolling over a quiet forest at night, light rain on leaves",
  "Sword being drawn from a leather sheath, then a single metallic ring",
  "Crowd cheering inside a stadium, then fading into wind",
  "Crackling campfire with occasional pops, owl hooting in the distance",
];

export default function SoundEffectsPage() {
  const { apiKey } = useStore();
  const [text, setText] = useState(SAMPLES[0]);
  const [duration, setDuration] = useState<number>(0); // 0 = auto
  const [influence, setInfluence] = useState(0.3);
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setAudio(null);
    setLoading(true);
    try {
      const blob = await soundGeneration(apiKey, {
        text,
        durationSeconds: duration > 0 ? duration : undefined,
        promptInfluence: influence,
        outputFormat,
      });
      setAudio(blob);
      await saveHistory({
        id: genId(),
        createdAt: Date.now(),
        kind: "sound-effect",
        label: text.slice(0, 80),
        text,
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Sound Effects</h1>
        <p className="text-sm text-muted mt-1">Generate FX from a text prompt. Up to 22 seconds per generation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <Label>Prompt</Label>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex flex-wrap gap-1 mt-2">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setText(s)}
                  className="text-[11px] bg-panel2 hover:bg-accent hover:text-white border border-border rounded px-2 py-0.5"
                >
                  {s.slice(0, 40)}…
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-2">Output</h3>
            <ErrorBox msg={error} />
            <AudioPlayer blob={audio} filename={`fx-${Date.now()}.mp3`} />
            <div className="mt-3">
              <Button onClick={generate} disabled={loading}>
                {loading ? <Spinner size={14} /> : <span className="inline-flex items-center gap-1.5"><Volume2 className="w-4 h-4" strokeWidth={1.75} /> Generate FX</span>}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Settings</h3>
            <div className="space-y-4">
              <Slider
                label="Duration (seconds, 0 = auto)"
                value={duration}
                onChange={setDuration}
                min={0}
                max={22}
                step={0.5}
                format={(v) => (v === 0 ? "auto" : `${v.toFixed(1)}s`)}
              />
              <Slider
                label="Prompt Influence"
                value={influence}
                onChange={setInfluence}
                hint="Higher = more literal interpretation, less creative."
              />
              <div>
                <Label>Output Format</Label>
                <Select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                  <option value="mp3_44100_128">MP3 128kbps</option>
                  <option value="mp3_44100_192">MP3 192kbps</option>
                  <option value="pcm_44100">PCM 44.1kHz</option>
                </Select>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
