"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { voiceCloneAdd, voiceDelete, listVoices, textToSpeech } from "@/lib/api";
import { Card, Input, Textarea, Button, Label, Select, Spinner, ErrorBox, Badge, Empty } from "@/components/ui";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AlertTriangle, Check, Mic } from "lucide-react";

type AccentKey =
  | "indian-english"
  | "us-english"
  | "uk-english"
  | "indian-hindi"
  | "indian-telugu"
  | "indian-kannada"
  | "custom";

type Gender = "female" | "male" | "neutral";
type Age = "young" | "adult" | "mature";

interface AccentPreset {
  label: string;
  labels: Record<string, string>;
  description: string;
  testText: string;
}

const ACCENT_PRESETS: Record<AccentKey, AccentPreset> = {
  "indian-english": {
    label: "Indian English",
    labels: { accent: "indian", language: "english", locale: "en-IN" },
    description: "Indian English narrator, neutral Indian accent, warm reading tone suitable for storytelling.",
    testText:
      "She paused at the door, listening to the rain. The monsoon had finally arrived, and the house felt alive with sound.",
  },
  "us-english": {
    label: "US English",
    labels: { accent: "american", language: "english", locale: "en-US" },
    description: "American English narrator, neutral mid-Atlantic accent, warm narration voice.",
    testText:
      "She paused at the door, the wind tugging at her cloak. The night was cold, but the silence was colder.",
  },
  "uk-english": {
    label: "UK English",
    labels: { accent: "british", language: "english", locale: "en-GB" },
    description: "British English narrator, received pronunciation, calm and measured reading voice.",
    testText:
      "She paused at the door, glancing at the rain on the cobblestones. The lamp at the corner flickered once, then went out.",
  },
  "indian-hindi": {
    label: "Indian Hindi",
    labels: { accent: "indian", language: "hindi", locale: "hi-IN" },
    description: "Hindi narrator, neutral north-Indian accent, suitable for storytelling and audiobooks.",
    testText:
      "वह दरवाज़े पर रुकी और बारिश की आवाज़ सुनती रही। शहर की रोशनी पानी पर तैर रही थी, और हवा में मिट्टी की गंध थी।",
  },
  "indian-telugu": {
    label: "Indian Telugu",
    labels: { accent: "indian", language: "telugu", locale: "te-IN" },
    description: "Telugu narrator, neutral Telangana/Andhra accent, ideal for stories and audiobook narration.",
    testText:
      "ఆమె తలుపు దగ్గర ఆగి, వర్షం శబ్దం వింటూ నిలబడింది. ఆకాశం మెల్లగా చీకటిగా మారుతోంది, గాలిలో మట్టి వాసన నిండింది.",
  },
  "indian-kannada": {
    label: "Indian Kannada",
    labels: { accent: "indian", language: "kannada", locale: "kn-IN" },
    description: "Kannada narrator, neutral Karnataka accent, suitable for storytelling and long-form narration.",
    testText:
      "ಅವಳು ಬಾಗಿಲ ಬಳಿ ನಿಂತು ಮಳೆಯ ಶಬ್ದವನ್ನು ಆಲಿಸಿದಳು. ಆಕಾಶ ಮೆಲ್ಲಗೆ ಕತ್ತಲಾಗುತ್ತಿತ್ತು, ಗಾಳಿಯಲ್ಲಿ ಮಣ್ಣಿನ ಪರಿಮಳ.",
  },
  custom: {
    label: "Custom",
    labels: { accent: "neutral" },
    description: "Describe the voice in plain language — accent, age, tone, intended use.",
    testText:
      "She paused at the door, the wind tugging at her cloak. The night was cold, but the silence was colder.",
  },
};

const DEFAULT_ACCENT: AccentKey = "us-english";

export default function VoiceClonePage() {
  const { apiKey, voices, setVoices, subscription } = useStore();
  const [name, setName] = useState("");
  const [accent, setAccent] = useState<AccentKey>(DEFAULT_ACCENT);
  const [gender, setGender] = useState<Gender>("female");
  const [age, setAge] = useState<Age>("adult");
  const [useCase, setUseCase] = useState<string>("narration");
  const [description, setDescription] = useState(ACCENT_PRESETS[DEFAULT_ACCENT].description);
  const [descTouched, setDescTouched] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [removeNoise, setRemoveNoise] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ voice_id: string } | null>(null);

  const [testText, setTestText] = useState(ACCENT_PRESETS[DEFAULT_ACCENT].testText);
  const [testTouched, setTestTouched] = useState(false);
  const [testAudio, setTestAudio] = useState<Blob | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const handleAccentChange = (next: AccentKey) => {
    setAccent(next);
    const preset = ACCENT_PRESETS[next];
    if (!descTouched) setDescription(preset.description);
    if (!testTouched) setTestText(preset.testText);
  };

  const buildLabels = (): Record<string, string> => ({
    ...ACCENT_PRESETS[accent].labels,
    gender,
    age,
    use_case: useCase,
  });

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const estDurationS = Math.round(totalSize / (16000 * 2));

  const cloneVoice = async () => {
    setError(null);
    setSuccess(null);
    if (!name.trim()) return setError("Voice name required");
    if (files.length === 0) return setError("Upload at least one audio sample (1+ minute recommended, ideally 1–3 minutes)");

    const labels = buildLabels();

    setLoading(true);
    try {
      const r = await voiceCloneAdd(apiKey, { name, description, files, labels, removeBackgroundNoise: removeNoise });
      setSuccess({ voice_id: r.voice_id });
      // Refresh voice list so the new voice appears everywhere
      const v = await listVoices(apiKey);
      setVoices(v.voices || []);
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const testClone = async () => {
    if (!success?.voice_id) return;
    setTestLoading(true);
    setTestAudio(null);
    try {
      const blob = await textToSpeech(apiKey, {
        voiceId: success.voice_id,
        text: testText,
        modelId: "eleven_v3",
        voiceSettings: { stability: 0.45, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true, speed: 1.0 },
      });
      setTestAudio(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestLoading(false);
    }
  };

  const cloned = voices.filter((v) => v.category === "cloned" || v.category === "professional");

  const removeVoice = async (voiceId: string, voiceName: string) => {
    if (!confirm(`Delete "${voiceName}"? This cannot be undone.`)) return;
    try {
      await voiceDelete(apiKey, voiceId);
      const v = await listVoices(apiKey);
      setVoices(v.voices || []);
    } catch (e) {
      alert("Failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const canClone = subscription?.can_use_instant_voice_cloning ?? true;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Voice Cloning</h1>
        <p className="text-sm text-muted mt-1">
          Upload audio samples to clone an existing voice (Instant Voice Cloning). For best results, use 1–3 minutes
          of clean speech, single speaker, no background music.
        </p>
      </div>

      {!canClone && (
        <div className="mb-4 bg-warn/10 border border-warn/30 rounded-md p-3 text-sm text-warn flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
          <span>
            Your subscription tier doesn't include Instant Voice Cloning. Cloning calls will fail.
            Upgrade to Starter or higher for IVC.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: clone form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">New Voice</h3>
            <div className="space-y-3">
              <div>
                <Label>Voice name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Narrator" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Accent / Language</Label>
                  <Select value={accent} onChange={(e) => handleAccentChange(e.target.value as AccentKey)}>
                    {(Object.keys(ACCENT_PRESETS) as AccentKey[]).map((k) => (
                      <option key={k} value={k}>
                        {ACCENT_PRESETS[k].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="neutral">Neutral / non-binary</option>
                  </Select>
                </div>
                <div>
                  <Label>Age</Label>
                  <Select value={age} onChange={(e) => setAge(e.target.value as Age)}>
                    <option value="young">Young (18–30)</option>
                    <option value="adult">Adult (30–50)</option>
                    <option value="mature">Mature (50+)</option>
                  </Select>
                </div>
                <div>
                  <Label>Use case</Label>
                  <Select value={useCase} onChange={(e) => setUseCase(e.target.value)}>
                    <option value="narration">Narration</option>
                    <option value="audiobook">Audiobook</option>
                    <option value="conversational">Conversational</option>
                    <option value="characters">Characters / acting</option>
                    <option value="news">News / informative</option>
                    <option value="advertisement">Advertisement</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDescTouched(true);
                  }}
                  className="font-sans"
                  placeholder={ACCENT_PRESETS[accent].description}
                />
                <p className="text-[11px] text-muted mt-1">
                  Auto-fills from the accent preset until you edit it. Edited descriptions stay across accent changes.
                </p>
              </div>

              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted hover:text-text">View computed labels JSON</summary>
                <pre className="mt-2 bg-panel2 border border-border rounded p-2 font-mono text-text overflow-x-auto">
                  {JSON.stringify(buildLabels(), null, 2)}
                </pre>
              </details>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Audio samples *</h3>
              <Badge color={files.length > 0 ? "success" : "muted"}>
                {files.length} file{files.length !== 1 ? "s" : ""}{" "}
                {totalSize > 0 ? `· ${(totalSize / 1024 / 1024).toFixed(1)} MB · ~${estDurationS}s` : ""}
              </Badge>
            </div>
            <input
              type="file"
              accept="audio/*"
              multiple
              onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
              className="block w-full text-sm text-text file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
            />
            <p className="text-[11px] text-muted mt-2">
              Best practice: 1–3 minutes total of clean speech. WAV/MP3/M4A. Single speaker. No music or noise.
              ElevenLabs accepts up to 25 files / ~10MB each.
            </p>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="text-xs bg-panel2 rounded px-2 py-1 flex items-center justify-between">
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted ml-2 shrink-0">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm mt-3">
              <input
                type="checkbox"
                checked={removeNoise}
                onChange={(e) => setRemoveNoise(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <span>Remove background noise (recommended)</span>
            </label>
          </Card>

          <Card>
            <ErrorBox msg={error} />
            {success && (
              <div className="bg-success/10 border border-success/30 rounded p-3 mb-3">
                <div className="font-medium text-success mb-1 flex items-center gap-1.5">
                  <Check className="w-4 h-4" strokeWidth={2} /> Voice cloned
                </div>
                <div className="text-xs font-mono">{success.voice_id}</div>
                <button
                  onClick={() => navigator.clipboard.writeText(success.voice_id)}
                  className="text-xs text-accent hover:underline mt-1"
                >
                  Copy voice_id
                </button>
              </div>
            )}
            <Button onClick={cloneVoice} disabled={loading || !canClone}>
              {loading ? (
                <Spinner size={14} />
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Mic className="w-4 h-4" strokeWidth={1.75} /> Clone Voice
                </span>
              )}
            </Button>
          </Card>

          {success && (
            <Card>
              <h3 className="text-sm font-semibold mb-3">Test the new voice</h3>
              <Label>Sample text</Label>
              <Textarea
                rows={3}
                value={testText}
                onChange={(e) => {
                  setTestText(e.target.value);
                  setTestTouched(true);
                }}
                className="font-sans"
              />
              <div className="mt-3">
                <Button variant="outline" onClick={testClone} disabled={testLoading}>
                  {testLoading ? <Spinner size={14} /> : "▶ Generate test"}
                </Button>
              </div>
              {testAudio && (
                <div className="mt-3">
                  <AudioPlayer blob={testAudio} filename={`clone-test-${Date.now()}.mp3`} />
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right: existing cloned voices */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Your cloned voices</h3>
              <Badge color="muted">{cloned.length}</Badge>
            </div>
            {cloned.length === 0 ? (
              <Empty>None yet.</Empty>
            ) : (
              <div className="space-y-2">
                {cloned.map((v) => (
                  <div key={v.voice_id} className="bg-panel2 rounded p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{v.name}</div>
                        <div className="text-[11px] text-muted font-mono truncate">{v.voice_id}</div>
                        {v.category && (
                          <Badge color={v.category === "professional" ? "accent" : "muted"}>
                            {v.category}
                          </Badge>
                        )}
                      </div>
                      <button
                        onClick={() => removeVoice(v.voice_id, v.name)}
                        className="text-xs text-danger hover:underline shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-2">Tips for clean clones</h3>
            <ul className="text-xs text-muted space-y-1.5">
              <li>• Single speaker only — no other voices</li>
              <li>• 1–3 minutes total. More is rarely better for IVC.</li>
              <li>• Recording-quality audio: no music, no noise, no reverb</li>
              <li>• Match the target use case — narrate samples in narration tone, not phone-call tone</li>
              <li>• Same mic / same room across all samples</li>
              <li>• 16kHz+ sample rate, mono is fine</li>
              <li>
                • <strong>Professional Voice Cloning</strong> (higher quality, longer training) is web-app only —
                cannot be initiated via API.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
