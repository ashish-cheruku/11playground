"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { textToDialogue } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { Card, Textarea, Button, Label, Select, Input, Spinner, ErrorBox, Badge } from "@/components/ui";
import { ModelSelector } from "@/components/ModelSelector";
import { AudioPlayer } from "@/components/AudioPlayer";
import { VoiceSettingsControls } from "@/components/VoiceSettingsControls";
import type { VoiceSettings, DialogueLine } from "@/lib/types";

// Seed scene — a literary-fiction homecoming exchange between two speakers.
// Tuned for ~35–45s of audio so you can actually evaluate a cloned voice
// across multiple emotional registers (whisper, soft, hesitant, breaking,
// resolute, grateful, warm) without writing your own test material.
//
// Total: 12 lines · ~135 words · alternates speaker A / speaker B so you
// can pair a cloned voice against a stock voice and hear turn-taking.
const DEFAULT_LINES: DialogueLine[] = [
  { voice_id: "", text: "[whispers] You came. I didn't think you would, after everything." },
  { voice_id: "", text: "[softly] Twenty-three years, Eli. I had to see the harbor one more time before they tear it down." },
  { voice_id: "", text: "[hesitantly] He's awake. He's been asking for you. [pauses] Every morning since the diagnosis." },
  { voice_id: "", text: "[breaking] Please don't make me do this alone. I can't be the one who walks in there pretending nothing changed." },
  { voice_id: "", text: "[resolute] You're not alone. I'll be on the porch. Whatever you decide, I'm staying through morning." },
  { voice_id: "", text: "[grateful] Thank you. [pauses] For not letting me run again." },
  { voice_id: "", text: "[warmly] Go on. The light's on. He'll know it's you the moment the stairs creak." },
  { voice_id: "", text: "[shaky] What if he doesn't recognise me? What if I waited too long?" },
  { voice_id: "", text: "[gentle] He kept the photograph, Bryn. The one from the lighthouse. Twenty-three years on his bedside table." },
  { voice_id: "", text: "[crying] God. [pauses] I don't deserve that." },
  { voice_id: "", text: "[firm] That's not yours to decide tonight. Just go inside." },
  { voice_id: "", text: "[whispers] Okay. [pauses] Okay." },
];

export default function DialoguePage() {
  const { apiKey, voices } = useStore();
  const [lines, setLines] = useState<DialogueLine[]>(DEFAULT_LINES);
  const [modelId, setModelId] = useState("eleven_v3");
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [seed, setSeed] = useState("");
  const [settings, setSettings] = useState<VoiceSettings>({
    stability: 0.45,
    similarity_boost: 0.75,
    style: 0.4,
    use_speaker_boost: true,
    speed: 1.0,
  });
  const [audio, setAudio] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Use same voice for all" — when on, every line uses singleVoiceId.
  // The per-line voice dropdowns hide; one dropdown sits at the top instead.
  const [useSameVoice, setUseSameVoice] = useState(false);
  const [singleVoiceId, setSingleVoiceId] = useState("");

  const update = (i: number, patch: Partial<DialogueLine>) => {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };
  const addLine = () => setLines((ls) => [...ls, { voice_id: ls[ls.length - 1]?.voice_id || "", text: "" }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  // Apply the single voice to every line whenever the toggle is on or the
  // chosen voice changes. Going off restores per-line picks (no auto-clear).
  const onToggleSameVoice = (next: boolean) => {
    setUseSameVoice(next);
    if (next && singleVoiceId) {
      setLines((ls) => ls.map((l) => ({ ...l, voice_id: singleVoiceId })));
    }
  };
  const onChangeSingleVoice = (vid: string) => {
    setSingleVoiceId(vid);
    if (useSameVoice) {
      setLines((ls) => ls.map((l) => ({ ...l, voice_id: vid })));
    }
  };

  const generate = async () => {
    setError(null);
    setAudio(null);
    if (lines.some((l) => !l.voice_id || !l.text.trim())) {
      return setError("Every line needs a voice and text");
    }
    setLoading(true);
    try {
      const blob = await textToDialogue(apiKey, {
        inputs: lines,
        modelId: modelId || undefined,
        outputFormat,
        seed: seed.trim() ? parseInt(seed.trim()) : undefined,
        settings,
      });
      setAudio(blob);
      const totalChars = lines.reduce((s, l) => s + l.text.length, 0);
      await saveHistory({
        id: genId(),
        createdAt: Date.now(),
        kind: "dialogue",
        label: `${lines.length} lines · ${lines[0].text.slice(0, 50)}…`,
        modelId,
        settings,
        charCount: totalChars,
        audioBlob: blob,
        audioMime: "audio/mpeg",
        meta: { lines },
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
        <h1 className="text-2xl font-semibold">Text to Dialogue</h1>
        <p className="text-sm text-muted mt-1">
          Multi-speaker scenes with natural turn-taking. v3-only. Use it for dialogue exchanges, not narration paragraphs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {/* Master "use same voice for all lines" toggle.
              When on: a single voice dropdown drives every line's voice_id,
              and per-line voice dropdowns hide so the layout collapses to
              text-only line cards. Useful for testing a single cloned voice
              against a long emotional scene. */}
          <Card>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useSameVoice}
                onChange={(e) => onToggleSameVoice(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              <span className="text-sm font-medium">Use the same voice for every line</span>
              <span className="text-xs text-muted ml-2">— ideal for testing one cloned voice across emotional registers</span>
            </label>
            {useSameVoice && (
              <div className="mt-3">
                <Label>Voice for all lines</Label>
                <Select value={singleVoiceId} onChange={(e) => onChangeSingleVoice(e.target.value)}>
                  <option value="">Select…</option>
                  {voices.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </Card>

          {lines.map((line, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between mb-2">
                <Badge color="accent">Line {i + 1}</Badge>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(i)} className="text-xs text-danger hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <div className={useSameVoice ? "" : "grid grid-cols-1 md:grid-cols-3 gap-3"}>
                {!useSameVoice && (
                  <div>
                    <Label>Voice</Label>
                    <Select value={line.voice_id} onChange={(e) => update(i, { voice_id: e.target.value })}>
                      <option value="">Select…</option>
                      {voices.map((v) => (
                        <option key={v.voice_id} value={v.voice_id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <div className={useSameVoice ? "" : "md:col-span-2"}>
                  <Label>Text</Label>
                  <Textarea rows={2} value={line.text} onChange={(e) => update(i, { text: e.target.value })} />
                </div>
              </div>
            </Card>
          ))}
          <div>
            <Button variant="outline" onClick={addLine}>+ Add line</Button>
          </div>

          <Card>
            <h3 className="text-sm font-semibold mb-3">Output</h3>
            <ErrorBox msg={error} />
            <AudioPlayer blob={audio} filename={`dialogue-${Date.now()}.mp3`} />
            <div className="mt-3">
              <Button onClick={generate} disabled={loading}>
                {loading ? <Spinner size={14} /> : "▶ Generate Dialogue"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Model & Output</h3>
            <div className="space-y-3">
              <ModelSelector value={modelId} onChange={setModelId} filter={(m) => !!m.can_do_text_to_speech} />
              <div>
                <Label>Output Format</Label>
                <Select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                  <option value="mp3_44100_128">MP3 44.1kHz 128kbps</option>
                  <option value="mp3_44100_192">MP3 44.1kHz 192kbps</option>
                  <option value="pcm_44100">PCM 44.1kHz</option>
                </Select>
              </div>
              <div>
                <Label>Seed (optional)</Label>
                <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. 12345" />
              </div>
            </div>
          </Card>
          <VoiceSettingsControls value={settings} onChange={setSettings} />
        </div>
      </div>
    </div>
  );
}
