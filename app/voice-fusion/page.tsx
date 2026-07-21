"use client";

// Voice Fusion — blend two or more voices into one. ElevenLabs has no native
// "merge voices" endpoint, so this uses Instant Voice Cloning as the fuser:
// gather audio from each parent source, then create ONE cloned voice from the
// combined set. IVC averages the acoustic characteristics of everything it's
// given, so the result is a genuine blend — weight the sliders to tilt it
// toward any parent. Two modes supply the audio:
//
//   Library voices — generate sample clips with each parent voice; weight sets
//                    how many clips each contributes.
//   Audio samples  — upload recordings; weight sets how many leading seconds of
//                    each are used, trimmed in the browser before upload.
//
// The fused voice is a real voice in your account (delete button provided).

import { useState } from "react";
import { useStore } from "@/lib/store";
import { listVoices, textToDialogue, voiceCloneAdd, voiceDelete } from "@/lib/api";
import { allocateClips, allocateSeconds, clipBudget, MIN_VOICES, MAX_VOICES, TARGET_TOTAL_S } from "@/lib/fusion";
import { readDuration, trimToMonoWav } from "@/lib/audio";
import { SAMPLE_LINES } from "@/lib/sampleLines";
import { Card, Textarea, Button, Input, Label, Spinner, ErrorBox, Badge } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { AudioPlayer } from "@/components/AudioPlayer";

// Same line rendered by the fusion and (in library mode) each parent.
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

const secs = (s: number) => `${Math.round(s)}s`;
const baseName = (n: string) => n.replace(/\.[^.]+$/, "");

type Mode = "voices" | "samples";
type Parent = { voiceId: string; weight: number };
type Sample = { file: File | null; weight: number; duration: number };

export default function VoiceFusionPage() {
  const { apiKey, voices, setVoices } = useStore();
  const nameOf = (id: string) => voices.find((v) => v.voice_id === id)?.name ?? id.slice(0, 8);

  const [mode, setMode] = useState<Mode>("voices");
  const [parents, setParents] = useState<Parent[]>([
    { voiceId: "", weight: 50 },
    { voiceId: "", weight: 50 },
  ]);
  const [samples, setSamples] = useState<Sample[]>([
    { file: null, weight: 50, duration: NaN },
    { file: null, weight: 50, duration: NaN },
  ]);
  const [removeNoise, setRemoveNoise] = useState(true);
  const [nameEdited, setNameEdited] = useState<string | null>(null);
  const [fusing, setFusing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fused, setFused] = useState<{ id: string; name: string; split: string } | null>(null);
  const [cmp, setCmp] = useState<{ fused: Blob; parents: { label: string; blob: Blob }[]; parentsAreSamples: boolean } | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const [tryText, setTryText] = useState(COMPARE_LINE);
  const [tryAudio, setTryAudio] = useState<Blob | null>(null);
  const [trying, setTrying] = useState(false);

  // Previews reflect only rows that are actually filled in, so the per-row
  // numbers match what a fuse would really spend (empty rows spend nothing).
  const chosen = parents.filter((p) => p.voiceId);
  const previewClips =
    chosen.length >= MIN_VOICES ? allocateClips(chosen.map((p) => p.weight), clipBudget(chosen.length)) : [];
  const totalClips = previewClips.reduce((a, b) => a + b, 0);

  const chosenSamples = samples.filter((s) => s.file);
  const previewSecs =
    chosenSamples.length >= MIN_VOICES
      ? allocateSeconds(chosenSamples.map((s) => s.weight), chosenSamples.map((s) => s.duration))
      : [];
  const totalSecs = previewSecs.reduce((a, b) => a + b, 0);

  // Position of row `i` among the filled rows, or -1 — lets a row read its own
  // entry out of the filled-only allocation arrays above.
  const filledPos = (list: { filled: boolean }[], i: number) =>
    list[i].filled ? list.slice(0, i + 1).filter((x) => x.filled).length - 1 : -1;
  const clipForRow = (i: number) => {
    const pos = filledPos(parents.map((p) => ({ filled: !!p.voiceId })), i);
    return pos >= 0 && previewClips.length ? previewClips[pos] : null;
  };
  const secsForRow = (i: number) => {
    const pos = filledPos(samples.map((s) => ({ filled: !!s.file })), i);
    return pos >= 0 && previewSecs.length ? previewSecs[pos] : null;
  };

  const autoName =
    mode === "voices"
      ? chosen.length >= MIN_VOICES
        ? `Fusion: ${chosen.map((p) => nameOf(p.voiceId)).join(" × ")}`
        : "Fused voice"
      : chosenSamples.length >= MIN_VOICES
        ? `Fusion: ${chosenSamples.map((s) => baseName(s.file!.name)).join(" × ")}`
        : "Fused voice";
  const name = nameEdited ?? autoName;

  const setParent = (i: number, patch: Partial<Parent>) =>
    setParents((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addParent = () => setParents((ps) => (ps.length >= MAX_VOICES ? ps : [...ps, { voiceId: "", weight: 50 }]));
  const removeParent = (i: number) =>
    setParents((ps) => (ps.length <= MIN_VOICES ? ps : ps.filter((_, j) => j !== i)));

  const setSample = (i: number, patch: Partial<Sample>) =>
    setSamples((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addSample = () =>
    setSamples((ss) => (ss.length >= MAX_VOICES ? ss : [...ss, { file: null, weight: 50, duration: NaN }]));
  const removeSample = (i: number) =>
    setSamples((ss) => (ss.length <= MIN_VOICES ? ss : ss.filter((_, j) => j !== i)));

  // Duration is read asynchronously; the identity check guards against a stale
  // result landing after the user has already swapped the file out again.
  const pickFile = async (i: number, file: File | null) => {
    setSample(i, { file, duration: NaN });
    if (!file) return;
    try {
      const d = await readDuration(file);
      setSamples((ss) => ss.map((s, j) => (j === i && s.file === file ? { ...s, duration: d } : s)));
    } catch {
      /* unknown duration — the trim-time decode still clamps exactly */
    }
  };

  const canFuse = mode === "voices" ? chosen.length >= MIN_VOICES : chosenSamples.length >= MIN_VOICES;

  async function fuse() {
    setError(null);
    setFused(null);
    setCmp(null);
    setTryAudio(null);
    setFusing(true);
    try {
      let files: File[];
      let split: string;
      let description: string;
      let parentCards: { label: string; blob: Blob }[];

      if (mode === "voices") {
        const picked = parents.filter((p) => p.voiceId);
        if (picked.length < MIN_VOICES) throw new Error(`Pick at least ${MIN_VOICES} voices to fuse.`);
        const ids = picked.map((p) => p.voiceId);
        if (new Set(ids).size !== ids.length) throw new Error("Each voice must be different.");

        // Clip counts per voice, then sample lines walked in order so every clip
        // gets a distinct line (wrapping only past the pool size).
        const counts = allocateClips(picked.map((p) => p.weight), clipBudget(picked.length));
        let lineIdx = 0;
        files = [];
        for (let vi = 0; vi < picked.length; vi++) {
          const clips = await Promise.all(
            Array.from({ length: counts[vi] }, (_, k) =>
              sampleFile(apiKey, picked[vi].voiceId, SAMPLE_LINES[(lineIdx + k) % SAMPLE_LINES.length], `v${vi}_${k}.mp3`),
            ),
          );
          lineIdx += counts[vi];
          files.push(...clips);
        }
        split = counts.join(":");
        description = `Fusion of ${picked.map((p) => nameOf(p.voiceId)).join(" + ")} (${split} clips)`;
        parentCards = []; // rendered below, after the clone exists
      } else {
        const picked = samples.filter((s) => s.file);
        if (picked.length < MIN_VOICES) throw new Error(`Upload at least ${MIN_VOICES} audio samples to fuse.`);

        // Weight → seconds, then trim each upload in the browser.
        const targets = allocateSeconds(picked.map((s) => s.weight), picked.map((s) => s.duration));
        const trimmed = await Promise.all(picked.map((s, i) => trimToMonoWav(s.file!, targets[i])));
        files = trimmed.map((t) => t.file);
        split = trimmed.map((t) => secs(t.usedSeconds)).join(" : ");
        description = `Fusion of ${picked.map((s) => baseName(s.file!.name)).join(" + ")} (${split})`;
        // Parents can't speak the compare line — there's no voice to render
        // from — so each card plays back its own trimmed sample instead.
        parentCards = trimmed.map((t, i) => ({ label: baseName(picked[i].file!.name), blob: t.file }));
      }

      const { voice_id } = await voiceCloneAdd(apiKey, {
        name,
        files,
        description,
        labels: { fused: "true" },
        ...(mode === "samples" ? { removeBackgroundNoise: removeNoise } : {}),
      });
      setFused({ id: voice_id, name, split });
      // Refresh the store so the fused voice shows up on every other page.
      try {
        setVoices((await listVoices(apiKey)).voices);
      } catch {}

      const fusedBlob = await speak(apiKey, voice_id, COMPARE_LINE);
      if (mode === "voices") {
        const picked = parents.filter((p) => p.voiceId);
        parentCards = await Promise.all(
          picked.map(async (p) => ({ label: nameOf(p.voiceId), blob: await speak(apiKey, p.voiceId, COMPARE_LINE) })),
        );
      }
      setCmp({ fused: fusedBlob, parents: parentCards, parentsAreSamples: mode === "samples" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFusing(false);
    }
  }

  async function tryFused() {
    if (!fused || !tryText.trim()) return;
    setTrying(true);
    setError(null);
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
    setError(null);
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
          Blend two or more voices into a new one. There's no native "merge" endpoint, so this fuses via Instant Voice
          Cloning — gather audio from each parent, then clone a single voice from the combined set. Fuse voices from
          your library, or upload your own recordings. The result is a real voice in your account.
        </p>
      </div>

      {/* Mode */}
      <div className="flex gap-2 mb-4">
        <Button variant={mode === "voices" ? "primary" : "ghost"} onClick={() => setMode("voices")} className="text-xs">
          Library voices
        </Button>
        <Button variant={mode === "samples" ? "primary" : "ghost"} onClick={() => setMode("samples")} className="text-xs">
          Audio samples
        </Button>
      </div>

      {/* Sources + weights */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="m-0">{mode === "voices" ? "Voices to fuse" : "Samples to fuse"}</Label>
          <span className="text-xs text-muted tabular-nums">
            {mode === "voices"
              ? `${chosen.length}/${MAX_VOICES} voices · ${totalClips || "—"} clips`
              : `${chosenSamples.length}/${MAX_VOICES} samples · ${totalSecs ? secs(totalSecs) : "—"} audio`}
          </span>
        </div>

        {mode === "voices" ? (
          <div className="space-y-3">
            {parents.map((p, i) => {
              const clips = clipForRow(i);
              return (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_auto] gap-3 items-end">
                  <VoiceSelector
                    label={`Voice ${i + 1}`}
                    value={p.voiceId}
                    onChange={(id) => setParent(i, { voiceId: id })}
                  />
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
        ) : (
          <div className="space-y-3">
            {samples.map((s, i) => {
              const used = secsForRow(i);
              const short = used != null && Number.isFinite(s.duration) && used >= s.duration - 0.05;
              return (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_auto] gap-3 items-end">
                  <div className="min-w-0">
                    <Label>Sample {i + 1}</Label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => pickFile(i, e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-text file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
                    />
                    {s.file && (
                      <div className="text-[11px] text-muted truncate mt-1" title={s.file.name}>
                        {s.file.name} · {Number.isFinite(s.duration) ? secs(s.duration) : "duration unknown"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="m-0">Weight</Label>
                      <span className="text-xs text-muted tabular-nums">
                        {s.weight}%
                        {used != null ? ` · ${secs(used)} used${short ? " (whole file)" : ""}` : ""}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={s.weight}
                      onChange={(e) => setSample(i, { weight: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => removeSample(i)}
                    disabled={samples.length <= MIN_VOICES}
                    className="text-xs h-9"
                    title={samples.length <= MIN_VOICES ? `At least ${MIN_VOICES} samples` : "Remove sample"}
                  >
                    ✕
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={mode === "voices" ? addParent : addSample}
            disabled={(mode === "voices" ? parents.length : samples.length) >= MAX_VOICES}
            className="text-xs"
          >
            {mode === "voices" ? "+ Add voice" : "+ Add sample"}
          </Button>
          {mode === "samples" && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={removeNoise}
                onChange={(e) => setRemoveNoise(e.target.checked)}
                className="w-4 h-4 accent-accent"
              />
              <span>Remove background noise (recommended)</span>
            </label>
          )}
        </div>

        {mode === "samples" && (
          <p className="text-[11px] text-muted mt-2">
            Weight sets how many leading seconds of each recording are used, targeting ~{TARGET_TOTAL_S}s total. Files
            are trimmed and downmixed to mono in your browser before upload. A file shorter than its share contributes
            everything it has — the readout shows what was actually used. Single speaker per file, no music.
          </p>
        )}

        <div className="mt-5">
          <Label>Fused voice name</Label>
          <Input value={name} onChange={(e) => setNameEdited(e.target.value)} placeholder="Fusion: A × B" />
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={fuse} disabled={fusing || !canFuse}>
            {fusing ? <Spinner size={14} /> : "⚗️ Fuse voices"}
          </Button>
          <span className="text-xs text-muted">
            {mode === "voices"
              ? `Spends ~${totalClips || clipBudget(MIN_VOICES)} short samples + a comparison, and creates 1 voice in your account.`
              : "Spends a comparison render, and creates 1 voice in your account. Your uploads aren't charged."}
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
              <span className="text-xs text-muted">· {fused.split} · id {fused.id.slice(0, 10)}…</span>
            </div>
            <Button variant="danger" onClick={removeFused} disabled={deleting} className="text-xs">
              {deleting ? <Spinner size={12} /> : "Delete fused voice"}
            </Button>
          </div>

          {cmp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded border border-accent p-3">
                <div className="text-xs font-semibold mb-0.5">Fusion</div>
                <div className="text-[11px] text-muted truncate mb-2" title={fused.name}>
                  {fused.name}
                </div>
                <AudioPlayer blob={cmp.fused} filename={`fusion-${Date.now()}.mp3`} compact />
              </div>
              {cmp.parents.map((par, i) => (
                <div key={i} className="rounded border border-default p-3">
                  <div className="text-xs font-semibold mb-0.5">
                    {cmp.parentsAreSamples ? `Sample ${i + 1}` : `Voice ${i + 1}`}
                  </div>
                  <div className="text-[11px] text-muted truncate mb-2" title={par.label}>
                    {par.label}
                  </div>
                  <AudioPlayer blob={par.blob} filename={`parent-${i + 1}-${Date.now()}.${cmp.parentsAreSamples ? "wav" : "mp3"}`} compact />
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted mt-3">
            {cmp?.parentsAreSamples
              ? "The highlighted player is the blend speaking the sample line; the others are your source recordings as trimmed."
              : "Same line, every voice — the highlighted one is the blend."}
          </p>
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
