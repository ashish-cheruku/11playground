"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { voiceDesignPreviews, voiceDesignSave, type VoiceDesignPreview } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { Card, Textarea, Input, Button, Label, Spinner, ErrorBox, Slider } from "@/components/ui";
import { Sparkles } from "lucide-react";

const SAMPLE = "She paused at the door, the wind tugging at her cloak. The night was cold, but the silence was colder.";

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export default function VoiceDesignPage() {
  const { apiKey } = useStore();
  const [description, setDescription] = useState(
    "A weathered, gravelly male narrator in his 60s with a slow Southern drawl. Warm but tired."
  );
  const [text, setText] = useState(SAMPLE);
  const [autoText, setAutoText] = useState(false);
  const [loudness, setLoudness] = useState(0.5);
  const [guidance, setGuidance] = useState(5);
  const [seed, setSeed] = useState("");
  const [previews, setPreviews] = useState<VoiceDesignPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setPreviews([]);
    setLoading(true);
    try {
      const res = await voiceDesignPreviews(apiKey, {
        voiceDescription: description,
        text: autoText ? "" : text,
        autoGenerateText: autoText,
        loudness,
        guidanceScale: guidance,
        seed: seed.trim() ? parseInt(seed.trim()) : undefined,
      });
      setPreviews(res.previews);
      for (const p of res.previews) {
        const blob = base64ToBlob(p.audio_base_64, p.media_type || "audio/mpeg");
        await saveHistory({
          id: genId(),
          createdAt: Date.now(),
          kind: "voice-design",
          label: `${description.slice(0, 60)}…`,
          text: res.text,
          audioBlob: blob,
          audioMime: p.media_type,
          meta: { generated_voice_id: p.generated_voice_id, description },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveVoice = async (p: VoiceDesignPreview) => {
    const name = prompt("Name this voice:");
    if (!name) return;
    try {
      await voiceDesignSave(apiKey, name, description, p.generated_voice_id);
      alert(`Saved as "${name}". Reload Dashboard to see it in the voice list.`);
    } catch (e) {
      alert("Failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Voice Design</h1>
        <p className="text-sm text-muted mt-1">
          Generate brand-new voices from a text description. Save the ones you like to your account.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <Label>Voice description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            <p className="text-[11px] text-muted mt-1">
              Be specific: age, gender, accent, mood, vocal qualities. Detailed prompts → consistent results.
            </p>
          </Card>
          <Card>
            <div className="flex items-center justify-between mb-2">
              <Label>Sample text to read</Label>
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" checked={autoText} onChange={(e) => setAutoText(e.target.checked)} />
                Auto-generate
              </label>
            </div>
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} disabled={autoText} />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-3">Previews</h3>
            <ErrorBox msg={error} />
            <div className="mb-3">
              <Button onClick={generate} disabled={loading}>
                {loading ? <Spinner size={14} /> : <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" strokeWidth={1.75} /> Generate Previews</span>}
              </Button>
            </div>
            {previews.length > 0 && (
              <div className="space-y-3">
                {previews.map((p, i) => {
                  const blob = base64ToBlob(p.audio_base_64, p.media_type || "audio/mpeg");
                  const url = URL.createObjectURL(blob);
                  return (
                    <div key={p.generated_voice_id} className="bg-panel2 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">Preview {i + 1}</div>
                        <Button variant="outline" onClick={() => saveVoice(p)} className="text-xs">
                          Save to my voices
                        </Button>
                      </div>
                      <audio src={url} controls className="w-full h-9" />
                      <div className="text-[11px] text-muted font-mono mt-1">{p.generated_voice_id}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Generation Settings</h3>
            <div className="space-y-4">
              <Slider
                label="Loudness"
                value={loudness}
                onChange={setLoudness}
                hint="Volume of the generated voice."
              />
              <Slider
                label="Guidance Scale"
                value={guidance}
                onChange={setGuidance}
                min={1}
                max={20}
                step={0.5}
                format={(v) => v.toFixed(1)}
                hint="How strictly to follow the description. Higher = more literal, less varied."
              />
              <div>
                <Label>Seed (optional)</Label>
                <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. 12345" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
