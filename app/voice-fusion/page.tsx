"use client";

// Voice Fusion — blend two ElevenLabs voices into one. ElevenLabs has no native
// "merge voices" endpoint, so this uses Instant Voice Cloning as the fuser:
// generate speech clips from Voice A and Voice B (split by a blend ratio), then
// create ONE cloned voice from the combined clip set. IVC averages the acoustic
// characteristics of everything it's given, so the result is a genuine blend —
// tilt the slider to weight it toward either parent. The fused voice is a real
// voice in your account (delete button provided); each fuse spends a little TTS
// + one clone.

import { useState } from "react";
import { useStore } from "@/lib/store";
import { listVoices, textToSpeech, voiceCloneAdd, voiceDelete } from "@/lib/api";
import { Card, Textarea, Button, Input, Label, Spinner, ErrorBox, Badge } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { AudioPlayer } from "@/components/AudioPlayer";

// Distinct, phonetically varied lines → richer clone samples than one repeated
// sentence. One line per clip; the blend decides how many clips per parent.
const SAMPLE_LINES = [
  "The quiet harbor held its breath as the last ferry slipped past the breakwater.",
  "She counted the seconds between the lightning and the low roll of thunder.",
  "Numbers, names, and small betrayals — he remembered every single one of them.",
  "Coffee, rain, and the smell of old paper filled the narrow little bookshop.",
  "We were never going to agree, but we kept talking anyway, softly, into the night.",
  "Zip the bag, check the map, and don't look back until we reach the ridge at dawn.",
];
// Same line rendered by A, the fusion, and B — this is the a/b/fusion comparison.
const COMPARE_LINE =
  "Here's how I sound — listen to the warmth, the timbre, and the pace of my delivery.";
// Clean, non-expressive model for clone samples + comparisons.
const MODEL = "eleven_multilingual_v2";

async function ttsFile(apiKey: string, voiceId: string, text: string, name: string): Promise<File> {
  const blob = await textToSpeech(apiKey, { voiceId, text, modelId: MODEL, outputFormat: "mp3_44100_128" });
  return new File([blob], name, { type: "audio/mpeg" });
}

export default function VoiceFusionPage() {
  const { apiKey, voices, setVoices } = useStore();
  const nameOf = (id: string) => voices.find((v) => v.voice_id === id)?.name ?? id.slice(0, 8);

  const [voiceA, setVoiceA] = useState("");
  const [voiceB, setVoiceB] = useState("");
  const [blend, setBlend] = useState(50); // 0 = all B, 100 = all A
  const [nameEdited, setNameEdited] = useState<string | null>(null);
  const [fusing, setFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fused, setFused] = useState<{ id: string; name: string; split: string } | null>(null);
  const [cmp, setCmp] = useState<{ a: Blob; fused: Blob; b: Blob } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [tryText, setTryText] = useState(COMPARE_LINE);
  const [tryAudio, setTryAudio] = useState<Blob | null>(null);
  const [trying, setTrying] = useState(false);

  const TOTAL = 6;
  const countA = Math.min(TOTAL - 1, Math.max(1, Math.round((TOTAL * blend) / 100)));
  const countB = TOTAL - countA;

  const autoName = voiceA && voiceB ? `Fusion: ${nameOf(voiceA)} × ${nameOf(voiceB)}` : "Fused voice";
  const name = nameEdited ?? autoName;

  async function fuse() {
    setError(null);
    setFused(null);
    setCmp(null);
    setTryAudio(null);
    if (!voiceA || !voiceB) return setError("Pick two voices to fuse.");
    if (voiceA === voiceB) return setError("Pick two different voices.");
    setFusing(true);
    try {
      // 1. Sample clips — countA lines by A, the next countB lines by B.
      const filesA = await Promise.all(
        Array.from({ length: countA }, (_, i) => ttsFile(apiKey, voiceA, SAMPLE_LINES[i % SAMPLE_LINES.length], `a${i}.mp3`)),
      );
      const filesB = await Promise.all(
        Array.from({ length: countB }, (_, i) =>
          ttsFile(apiKey, voiceB, SAMPLE_LINES[(countA + i) % SAMPLE_LINES.length], `b${i}.mp3`),
        ),
      );
      // 2. Clone ONE voice from the combined set → the fusion.
      const { voice_id } = await voiceCloneAdd(apiKey, {
        name,
        files: [...filesA, ...filesB],
        description: `Fusion of ${nameOf(voiceA)} + ${nameOf(voiceB)} (${countA}:${countB} clips)`,
        labels: { fused: "true" },
      });
      const split = `${countA}:${countB}`;
      setFused({ id: voice_id, name, split });
      // Refresh the store so the fused voice shows up on every other page.
      try {
        setVoices((await listVoices(apiKey)).voices);
      } catch {}
      // 3. Same line via A, the fusion, and B → the comparison.
      const [a, fusedBlob, b] = await Promise.all([
        textToSpeech(apiKey, { voiceId: voiceA, text: COMPARE_LINE, modelId: MODEL }),
        textToSpeech(apiKey, { voiceId: voice_id, text: COMPARE_LINE, modelId: MODEL }),
        textToSpeech(apiKey, { voiceId: voiceB, text: COMPARE_LINE, modelId: MODEL }),
      ]);
      setCmp({ a, fused: fusedBlob, b });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFusing(false);
    }
  }

  async function tryFused() {
    if (!fused || !tryText.trim()) return;
    setTrying(true);
    setTryAudio(null);
    try {
      setTryAudio(await textToSpeech(apiKey, { voiceId: fused.id, text: tryText, modelId: MODEL }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTrying(false);
    }
  }

  async function removeFused() {
    if (!fused) return;
    setDeleting(true);
    try {
      await voiceDelete(apiKey, fused.id);
      setFused(null);
      setCmp(null);
      setTryAudio(null);
      try {
        setVoices((await listVoices(apiKey)).voices);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Voice Fusion</h1>
        <p className="text-sm text-muted mt-1">
          Blend two ElevenLabs voices into a new one. There's no native "merge" endpoint, so this fuses via Instant
          Voice Cloning: it voices sample clips with each parent (split by the slider), then clones a single voice from
          the combined set. The result is a real voice in your account — a delete button is provided.
        </p>
      </div>

      {/* Parents + blend */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <div>
            <Label>Voice A</Label>
            <VoiceSelector value={voiceA} onChange={setVoiceA} />
          </div>
          <div className="text-center text-2xl font-semibold text-muted pb-2">×</div>
          <div>
            <Label>Voice B</Label>
            <VoiceSelector value={voiceB} onChange={setVoiceB} />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-1">
            <Label className="m-0">Blend</Label>
            <span className="text-xs text-muted tabular-nums">
              {countA} clip{countA > 1 ? "s" : ""} A · {countB} clip{countB > 1 ? "s" : ""} B
            </span>
          </div>
          <input
            type="range"
            min={17}
            max={83}
            step={1}
            value={blend}
            onChange={(e) => setBlend(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>← more {voiceA ? nameOf(voiceA) : "A"}</span>
            <span>even</span>
            <span>more {voiceB ? nameOf(voiceB) : "B"} →</span>
          </div>
        </div>

        <div className="mt-5">
          <Label>Fused voice name</Label>
          <Input value={name} onChange={(e) => setNameEdited(e.target.value)} placeholder="Fusion: A × B" />
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={fuse} disabled={fusing || !voiceA || !voiceB}>
            {fusing ? <Spinner size={14} /> : "⚗️ Fuse voices"}
          </Button>
          <span className="text-xs text-muted">
            Spends ~{TOTAL} short samples + a comparison, and creates 1 voice in your account.
          </span>
        </div>
        <div className="mt-3">
          <ErrorBox msg={error} />
        </div>
      </Card>

      {/* Result */}
      {fused && (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <Badge color="success">Fused</Badge>
              <span className="font-semibold">{fused.name}</span>
              <span className="text-xs text-muted">· {fused.split} clip split · id {fused.id.slice(0, 10)}…</span>
            </div>
            <Button variant="danger" onClick={removeFused} disabled={deleting} className="text-xs">
              {deleting ? <Spinner size={12} /> : "Delete fused voice"}
            </Button>
          </div>

          {cmp && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(
                [
                  ["Voice A", cmp.a, nameOf(voiceA)],
                  ["Fusion", cmp.fused, fused.name],
                  ["Voice B", cmp.b, nameOf(voiceB)],
                ] as const
              ).map(([label, blob, sub], i) => (
                <div key={label} className={`rounded border p-3 ${i === 1 ? "border-accent" : "border-default"}`}>
                  <div className="text-xs font-semibold mb-0.5">{label}</div>
                  <div className="text-[11px] text-muted truncate mb-2" title={sub}>{sub}</div>
                  <AudioPlayer blob={blob} filename={`${label}-${Date.now()}.mp3`} compact />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted mt-3">Same line, three voices — the middle one is the blend.</p>
        </Card>
      )}

      {/* Try the fused voice with your own text */}
      {fused && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">Try the fused voice</h3>
          <Textarea rows={3} value={tryText} onChange={(e) => setTryText(e.target.value)} />
          <div className="mt-3 flex items-center gap-3">
            <Button variant="outline" onClick={tryFused} disabled={trying || !tryText.trim()}>
              {trying ? <Spinner size={14} /> : "▶ Speak"}
            </Button>
          </div>
          <div className="mt-3">
            <AudioPlayer blob={tryAudio} filename={`fusion-${Date.now()}.mp3`} />
          </div>
        </Card>
      )}
    </div>
  );
}
