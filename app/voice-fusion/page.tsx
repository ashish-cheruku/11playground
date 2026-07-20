"use client";

// Voice Fusion — blend two or more ElevenLabs voices into one. ElevenLabs has no
// native "merge voices" endpoint, so this uses Instant Voice Cloning as the
// fuser: generate speech clips from each parent voice (how many per voice is set
// by its weight), then create ONE cloned voice from the combined clip set. IVC
// averages the acoustic characteristics of everything it's given, so the result
// is a genuine blend — weight the sliders to tilt it toward any parent. The
// fused voice is a real voice in your account (delete button provided); each
// fuse spends a little dialogue generation + one clone.

import { useState } from "react";
import { useStore } from "@/lib/store";
import { listVoices, textToDialogue, voiceCloneAdd, voiceDelete } from "@/lib/api";
import { allocateClips, clipBudget, MIN_VOICES, MAX_VOICES } from "@/lib/fusion";
import { Card, Textarea, Button, Input, Label, Spinner, ErrorBox, Badge } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { AudioPlayer } from "@/components/AudioPlayer";

// Distinct, phonetically varied lines → richer clone samples than one repeated
// sentence. One line per clip; the blend decides how many clips per parent.
// Twelve lines = the max clip budget, so clips stay distinct even at full count.
const SAMPLE_LINES = [
  "The quiet harbor held its breath as the last ferry slipped past the breakwater.",
  "She counted the seconds between the lightning and the low roll of thunder.",
  "Numbers, names, and small betrayals — he remembered every single one of them.",
  "Coffee, rain, and the smell of old paper filled the narrow little bookshop.",
  "We were never going to agree, but we kept talking anyway, softly, into the night.",
  "Zip the bag, check the map, and don't look back until we reach the ridge at dawn.",
  "The old clock in the hallway chimed once, then fell silent for the rest of the evening.",
  "He traced the coastline on the map with one finger, from the cape down to the delta.",
  "A gull wheeled over the pier while the fishermen hauled their nets in the grey light.",
  "Question everything, she wrote, then underlined the word twice and closed the book.",
  "The engine coughed, caught, and settled into a low steady hum against the cold.",
  "Bright, brittle, and beautiful — the frost stitched the whole field white by morning.",
];
// Same line rendered by the fusion and each parent — the comparison row.
const COMPARE_LINE =
  "Here's how I sound — listen to the warmth, the timbre, and the pace of my delivery.";
const MODEL = "eleven_v3";

// Every generation here goes through text-to-dialogue. It takes an array of
// speakers, so a single-element array renders one voice alone — that keeps the
// clone samples one-voice-per-file (IVC needs that) and the comparison players
// separate. Sample lines stay free of audio tags: v3 is expressive by default,
// and tagged delivery would be baked into the clone.
function speak(apiKey: string, voiceId: string, text: string, outputFormat?: string): Promise<Blob> {
  return textToDialogue(apiKey, {
    inputs: [{ voice_id: voiceId, text }],
    modelId: MODEL,
    outputFormat,
  });
}

async function sampleFile(apiKey: string, voiceId: string, text: string, name: string): Promise<File> {
  const blob = await speak(apiKey, voiceId, text, "mp3_44100_128");
  return new File([blob], name, { type: "audio/mpeg" });
}

type Parent = { voiceId: string; weight: number };

export default function VoiceFusionPage() {
  const { apiKey, voices, setVoices } = useStore();
  const nameOf = (id: string) => voices.find((v) => v.voice_id === id)?.name ?? id.slice(0, 8);

  const [parents, setParents] = useState<Parent[]>([
    { voiceId: "", weight: 50 },
    { voiceId: "", weight: 50 },
  ]);
  const [nameEdited, setNameEdited] = useState<string | null>(null);
  const [fusing, setFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fused, setFused] = useState<{ id: string; name: string; split: string } | null>(null);
  const [cmp, setCmp] = useState<{ fused: Blob; parents: { voiceId: string; blob: Blob }[] } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [tryText, setTryText] = useState(COMPARE_LINE);
  const [tryAudio, setTryAudio] = useState<Blob | null>(null);
  const [trying, setTrying] = useState(false);

  // Clip preview reflects only the rows that actually have a voice picked, so the
  // per-row counts match what a fuse would really spend (empty rows spend nothing).
  const chosen = parents.filter((p) => p.voiceId);
  const previewClips = chosen.length >= MIN_VOICES ? allocateClips(chosen.map((p) => p.weight), clipBudget(chosen.length)) : [];
  const clipForRow = (i: number): number | null => {
    if (!parents[i].voiceId || !previewClips.length) return null;
    const pos = parents.slice(0, i + 1).filter((p) => p.voiceId).length - 1;
    return previewClips[pos];
  };
  const totalClips = previewClips.reduce((a, b) => a + b, 0);

  const autoName =
    chosen.length >= MIN_VOICES ? `Fusion: ${chosen.map((p) => nameOf(p.voiceId)).join(" × ")}` : "Fused voice";
  const name = nameEdited ?? autoName;

  const setParent = (i: number, patch: Partial<Parent>) =>
    setParents((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addParent = () => setParents((ps) => (ps.length >= MAX_VOICES ? ps : [...ps, { voiceId: "", weight: 50 }]));
  const removeParent = (i: number) =>
    setParents((ps) => (ps.length <= MIN_VOICES ? ps : ps.filter((_, j) => j !== i)));

  async function fuse() {
    setError(null);
    setFused(null);
    setCmp(null);
    setTryAudio(null);
    const picked = parents.filter((p) => p.voiceId);
    if (picked.length < MIN_VOICES) return setError(`Pick at least ${MIN_VOICES} voices to fuse.`);
    const ids = picked.map((p) => p.voiceId);
    if (new Set(ids).size !== ids.length) return setError("Each voice must be different.");
    setFusing(true);
    try {
      // 1. Clip counts per chosen voice, then sample lines walked in order so
      //    every clip gets a distinct line (wrapping only past the pool size).
      const counts = allocateClips(picked.map((p) => p.weight), clipBudget(picked.length));
      let lineIdx = 0;
      const files: File[] = [];
      for (let vi = 0; vi < picked.length; vi++) {
        const clips = await Promise.all(
          Array.from({ length: counts[vi] }, (_, k) =>
            sampleFile(apiKey, picked[vi].voiceId, SAMPLE_LINES[(lineIdx + k) % SAMPLE_LINES.length], `v${vi}_${k}.mp3`),
          ),
        );
        lineIdx += counts[vi];
        files.push(...clips);
      }
      // 2. Clone ONE voice from the combined set → the fusion.
      const split = counts.join(":");
      const { voice_id } = await voiceCloneAdd(apiKey, {
        name,
        files,
        description: `Fusion of ${picked.map((p) => nameOf(p.voiceId)).join(" + ")} (${split} clips)`,
        labels: { fused: "true" },
      });
      setFused({ id: voice_id, name, split });
      // Refresh the store so the fused voice shows up on every other page.
      try {
        setVoices((await listVoices(apiKey)).voices);
      } catch {}
      // 3. Same line via the fusion and every parent → the comparison.
      const [fusedBlob, parentBlobs] = await Promise.all([
        speak(apiKey, voice_id, COMPARE_LINE),
        Promise.all(
          picked.map(async (p) => ({ voiceId: p.voiceId, blob: await speak(apiKey, p.voiceId, COMPARE_LINE) })),
        ),
      ]);
      setCmp({ fused: fusedBlob, parents: parentBlobs });
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
      setTryAudio(await speak(apiKey, fused.id, tryText));
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
          Blend two or more ElevenLabs voices into a new one. There's no native "merge" endpoint, so this fuses via
          Instant Voice Cloning: it voices sample clips with each parent (how many per voice is set by its weight), then
          clones a single voice from the combined set. The result is a real voice in your account — a delete button is
          provided.
        </p>
      </div>

      {/* Parents + weights */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="m-0">Voices to fuse</Label>
          <span className="text-xs text-muted tabular-nums">
            {chosen.length}/{MAX_VOICES} voices · {totalClips || "—"} clips
          </span>
        </div>

        <div className="space-y-3">
          {parents.map((p, i) => {
            const clips = clipForRow(i);
            return (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_auto] gap-3 items-end">
                <VoiceSelector label={`Voice ${i + 1}`} value={p.voiceId} onChange={(id) => setParent(i, { voiceId: id })} />
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="m-0">Weight</Label>
                    <span className="text-xs text-muted tabular-nums">
                      {p.weight}%{clips != null ? ` · ${clips} clip${clips > 1 ? "s" : ""}` : ""}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={p.weight}
                    onChange={(e) => setParent(i, { weight: Number(e.target.value) })}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
                <Button
                  variant="ghost"
                  onClick={() => removeParent(i)}
                  disabled={parents.length <= MIN_VOICES}
                  className="text-xs h-9"
                  title={parents.length <= MIN_VOICES ? `At least ${MIN_VOICES} voices` : "Remove voice"}
                >
                  ✕
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <Button variant="outline" onClick={addParent} disabled={parents.length >= MAX_VOICES} className="text-xs">
            + Add voice
          </Button>
        </div>

        <div className="mt-5">
          <Label>Fused voice name</Label>
          <Input value={name} onChange={(e) => setNameEdited(e.target.value)} placeholder="Fusion: A × B" />
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={fuse} disabled={fusing || chosen.length < MIN_VOICES}>
            {fusing ? <Spinner size={14} /> : "⚗️ Fuse voices"}
          </Button>
          <span className="text-xs text-muted">
            Spends ~{totalClips || clipBudget(MIN_VOICES)} short samples + a comparison, and creates 1 voice in your account.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded border border-accent p-3">
                <div className="text-xs font-semibold mb-0.5">Fusion</div>
                <div className="text-[11px] text-muted truncate mb-2" title={fused.name}>{fused.name}</div>
                <AudioPlayer blob={cmp.fused} filename={`fusion-${Date.now()}.mp3`} compact />
              </div>
              {cmp.parents.map((par, i) => (
                <div key={par.voiceId} className="rounded border border-default p-3">
                  <div className="text-xs font-semibold mb-0.5">Voice {i + 1}</div>
                  <div className="text-[11px] text-muted truncate mb-2" title={nameOf(par.voiceId)}>{nameOf(par.voiceId)}</div>
                  <AudioPlayer blob={par.blob} filename={`parent-${i + 1}-${Date.now()}.mp3`} compact />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted mt-3">Same line, every voice — the highlighted one is the blend.</p>
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
