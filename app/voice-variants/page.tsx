"use client";

// Character Variants — one voice, many characters.
//
// Renders the SAME line with the SAME voice several times, each with a
// different character-direction tag prefixed to the text, so you can audition
// "voice X narrating as a child" against "as an old man" side by side. This is
// the audiobook technique of one narrator playing every part.
//
// Everything goes through text-to-dialogue. That endpoint takes no per-line
// voice settings — only text + voice_id per input, with one top-level
// `settings` — so each variant is its OWN request. That's also what lets each
// variant carry its own stability mode, which the docs call the biggest lever
// on how strongly a direction tag lands.
//
// A shared seed is offered because without it, variants differ by sampling
// randomness as much as by direction; pinning the seed isolates the tag.

import { useState } from "react";
import { useStore } from "@/lib/store";
import { textToDialogue, voiceCloneAdd, listVoices } from "@/lib/api";
import { saveHistory, genId } from "@/lib/history";
import { SAMPLE_LINES } from "@/lib/sampleLines";
import {
  CHARACTER_DIRECTIONS,
  DIRECTION_GROUPS,
  STABILITY_MODES,
  stabilityValue,
  composeLine,
  type StabilityMode,
} from "@/lib/characterDirections";
import { Card, Textarea, Button, Input, Label, Select, Spinner, ErrorBox, Badge } from "@/components/ui";
import { VoiceSelector } from "@/components/VoiceSelector";
import { AudioPlayer } from "@/components/AudioPlayer";

const MODEL = "eleven_v3";
const MAX_VARIANTS = 8;
// Clips rendered per saved voice. Six distinct lines gives IVC enough phonetic
// variety to learn the character, without spending a lot per save.
const CLONE_CLIPS = 6;

const DEFAULT_LINE = "I told you not to come here. Not tonight, not after everything that's happened.";

interface Variant {
  /** Stable id — async writes key off this, never the array index, because
   *  rows can be added or removed while other variants are still rendering. */
  id: string;
  direction: string;
  stability: StabilityMode["key"];
  audio: Blob | null;
  loading: boolean;
  error: string | null;
  elapsed: number | null;
  // --- save-as-voice ---
  /** Save panel open for this row. */
  saveOpen: boolean;
  saveName: string;
  /** Render the clone's source clips at Natural for consistency, or at the
   *  stability this row was auditioned with. */
  saveConsistent: boolean;
  saving: boolean;
  saveError: string | null;
  savedVoiceId: string | null;
}

const newVariant = (direction: string, stability: StabilityMode["key"] = "natural"): Variant => ({
  id: genId(),
  direction,
  stability,
  audio: null,
  loading: false,
  error: null,
  elapsed: null,
  saveOpen: false,
  saveName: "",
  saveConsistent: true,
  saving: false,
  saveError: null,
  savedVoiceId: null,
});

/** Default voice name from a direction tag — the descriptive tail after the
 *  first comma is useful direction but makes a clumsy voice name, so it's cut.
 *  "[speaking as a young woman, warm and bright]" → "Young woman" */
function directionToName(direction: string): string {
  const inner = direction.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) return "Variant";
  if (/^narrat/i.test(inner)) return "Narrator";
  const head = inner.replace(/^speaking\s+as\s+(a|an)\s+/i, "").split(",")[0].trim();
  return head.charAt(0).toUpperCase() + head.slice(1);
}

const INITIAL: Variant[] = [
  newVariant("[narrating neutrally]", "natural"),
  newVariant("[speaking as a young woman, warm and bright]", "creative"),
  newVariant("[speaking as a small child, high and piping]", "creative"),
  newVariant("[speaking as a frail elderly man, voice wavering]", "creative"),
];

export default function VoiceVariantsPage() {
  const { apiKey, voices, setVoices } = useStore();

  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState(DEFAULT_LINE);
  const [outputFormat, setOutputFormat] = useState("mp3_44100_128");
  const [useSeed, setUseSeed] = useState(true);
  const [seed, setSeed] = useState("1234");
  const [variants, setVariants] = useState<Variant[]>(INITIAL);
  const [topError, setTopError] = useState<string | null>(null);

  const voiceName = voices.find((v) => v.voice_id === voiceId)?.name ?? "";
  const anyLoading = variants.some((v) => v.loading);
  const ready = !!voiceId && !!text.trim();

  // All async writes go through this: merge into CURRENT state, matched by id.
  const patch = (id: string, p: Partial<Variant>) =>
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, ...p } : v)));

  const setDirection = (id: string, direction: string) => patch(id, { direction });
  const setStability = (id: string, stability: StabilityMode["key"]) => patch(id, { stability });
  const addVariant = () =>
    setVariants((vs) => (vs.length >= MAX_VARIANTS ? vs : [...vs, newVariant("")]));
  const removeVariant = (id: string) =>
    setVariants((vs) => (vs.length <= 1 ? vs : vs.filter((v) => v.id !== id)));

  async function render(v: Variant) {
    if (!ready) {
      setTopError(!voiceId ? "Pick a voice first." : "Enter a line to render.");
      return;
    }
    setTopError(null);
    patch(v.id, { loading: true, error: null, audio: null, elapsed: null });
    const t0 = Date.now();
    // Snapshot what we send, so a mid-flight edit can't change the request.
    const line = composeLine(v.direction, text);
    const stability = stabilityValue(v.stability);
    try {
      const blob = await textToDialogue(apiKey, {
        inputs: [{ voice_id: voiceId, text: line }],
        modelId: MODEL,
        outputFormat,
        settings: { stability, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
        seed: useSeed && seed.trim() ? parseInt(seed.trim(), 10) : undefined,
      });
      patch(v.id, { loading: false, error: null, audio: blob, elapsed: Date.now() - t0 });
      await saveHistory({
        id: genId(),
        createdAt: Date.now(),
        kind: "dialogue",
        label: `[variant] ${v.direction || "no direction"} · ${text.slice(0, 40)}`,
        text: line,
        voiceId,
        voiceName,
        modelId: MODEL,
        charCount: line.length,
        audioBlob: blob,
        audioMime: "audio/mpeg",
        meta: { variant: true, direction: v.direction, stability: v.stability, stabilityValue: stability },
      });
    } catch (e) {
      patch(v.id, {
        loading: false,
        audio: null,
        elapsed: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Promote a variant into a real, permanent voice.
  //
  // Renders CLONE_CLIPS distinct lines with this row's direction applied, then
  // clones one voice from that set. Because the character is present in every
  // source clip, IVC bakes it into the new voice's NEUTRAL delivery — the saved
  // voice needs no tag afterwards, and works anywhere in the app.
  //
  // Unlike everything else on this page, this DOES create an account-level
  // voice and consume a voice slot.
  async function saveAsVoice(v: Variant) {
    const name = v.saveName.trim();
    if (!name) {
      patch(v.id, { saveError: "Name the voice first." });
      return;
    }
    if (!voiceId || !v.direction.trim()) {
      patch(v.id, { saveError: "Need a voice and a direction tag." });
      return;
    }
    patch(v.id, { saving: true, saveError: null, savedVoiceId: null });
    // Snapshot the request inputs so mid-flight edits can't change them.
    const direction = v.direction;
    const stability = v.saveConsistent ? stabilityValue("natural") : stabilityValue(v.stability);
    try {
      const files = await Promise.all(
        Array.from({ length: CLONE_CLIPS }, async (_, i) => {
          const blob = await textToDialogue(apiKey, {
            inputs: [{ voice_id: voiceId, text: composeLine(direction, SAMPLE_LINES[i % SAMPLE_LINES.length]) }],
            modelId: MODEL,
            outputFormat: "mp3_44100_128",
            settings: { stability, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
          });
          return new File([blob], `clip${i}.mp3`, { type: "audio/mpeg" });
        }),
      );
      const { voice_id } = await voiceCloneAdd(apiKey, {
        name,
        files,
        description: `Character variant of ${voiceName || voiceId}: ${direction}`,
        labels: { variant: "true", source_voice: voiceName || voiceId },
      });
      patch(v.id, { saving: false, savedVoiceId: voice_id, saveOpen: false });
      // Refresh the store so the new voice appears in every selector app-wide.
      try {
        const { voices: fresh } = await listVoices(apiKey);
        setVoices(fresh);
      } catch {
        /* the voice exists regardless; the list just refreshes on next load */
      }
    } catch (e) {
      patch(v.id, { saving: false, saveError: e instanceof Error ? e.message : String(e) });
    }
  }

  const renderAll = async () => {
    if (!ready) {
      setTopError(!voiceId ? "Pick a voice first." : "Enter a line to render.");
      return;
    }
    // Snapshot the list — rows removed mid-run simply stop mattering, because
    // every write is matched by id and a missing id is a no-op.
    await Promise.all(variants.map((v) => render(v)));
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Character Variants</h1>
        <p className="text-sm text-muted mt-1">
          One voice, many characters. The same line is rendered by the same voice several times, each with a different
          character-direction tag — the audiobook technique of a single narrator playing every part. Everything runs
          through text-to-dialogue on {MODEL}.
        </p>
      </div>

      <div className="mb-4 bg-panel2 border border-border rounded-md p-3 text-xs text-muted">
        <strong className="text-text">What this can and can't do.</strong> Direction tags make your chosen voice{" "}
        <em>perform as</em> a character — they are not an age or gender transform. ElevenLabs is explicit that the
        voice and its training samples cap the effect ("don't expect a whispering voice to suddenly shout"), so a deep
        male narrator will read as that narrator doing a child, not as a child. Tags are natural-language instructions,
        not a fixed list, so edit them freely. <strong className="text-text">Robust</strong> stability will visibly
        flatten the effect; <strong className="text-text">Creative</strong> sells it hardest.
        <br />
        <br />
        Auditioning is free of side effects — your source voice is only ever read, never modified. The one exception is{" "}
        <strong className="text-text">Save as voice</strong>, which clones a variant into a new permanent voice in your
        account.
      </div>

      {/* Shared inputs */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VoiceSelector label="Voice (used by every variant)" value={voiceId} onChange={setVoiceId} />
          <div>
            <Label>Output format</Label>
            <Select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
              <option value="mp3_44100_128">mp3_44100_128</option>
              <option value="mp3_44100_192">mp3_44100_192</option>
              <option value="pcm_44100">pcm_44100</option>
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Line (identical across all variants)</Label>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="font-sans" />
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={useSeed}
              onChange={(e) => setUseSeed(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            <span>Pin seed</span>
          </label>
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            disabled={!useSeed}
            placeholder="1234"
            className="w-28"
          />
          <span className="text-[11px] text-muted flex-1 min-w-[16rem]">
            With the seed pinned, every variant samples identically — so differences you hear come from the direction
            tag, not from random variation. Unpin to hear the natural spread instead.
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={renderAll} disabled={anyLoading || !ready}>
            {anyLoading ? <Spinner size={14} /> : `▶ Render all ${variants.length}`}
          </Button>
          <Button variant="outline" onClick={addVariant} disabled={variants.length >= MAX_VARIANTS} className="text-xs">
            + Add variant
          </Button>
          <span className="text-xs text-muted">
            {variants.length}/{MAX_VARIANTS} variants · one request each
          </span>
        </div>
        <div className="mt-3">
          <ErrorBox msg={topError} />
        </div>
      </Card>

      {/* Variant grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {variants.map((v, i) => {
          const mode = STABILITY_MODES.find((m) => m.key === v.stability)!;
          return (
            <Card key={v.id}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge color={v.audio ? "success" : "muted"}>{i + 1}</Badge>
                  <span className="text-sm font-semibold truncate">{v.direction || "No direction"}</span>
                </div>
                <button
                  onClick={() => removeVariant(v.id)}
                  disabled={variants.length <= 1}
                  className="text-xs text-danger hover:underline disabled:opacity-40 disabled:no-underline shrink-0"
                  title={variants.length <= 1 ? "Keep at least one variant" : "Remove variant"}
                >
                  Remove
                </button>
              </div>

              <Label>Direction tag</Label>
              <Input
                value={v.direction}
                onChange={(e) => setDirection(v.id, e.target.value)}
                placeholder="[speaking as a frail elderly man, voice wavering]"
                className="font-mono text-xs"
              />

              <div className="mt-2">
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setDirection(v.id, e.target.value);
                  }}
                  className="text-xs"
                >
                  <option value="">Insert a preset…</option>
                  {DIRECTION_GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {CHARACTER_DIRECTIONS.filter((d) => d.group === g).map((d) => (
                        <option key={d.tag} value={d.tag}>
                          {d.label} — {d.tag}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <Label className="m-0">Stability</Label>
                  <span className="text-[11px] text-muted font-mono">sending {mode.value.toFixed(1)}</span>
                </div>
                <Select value={v.stability} onChange={(e) => setStability(v.id, e.target.value as StabilityMode["key"])}>
                  {STABILITY_MODES.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-muted mt-1">{mode.note}</p>
              </div>

              <details className="mt-3 text-[11px]">
                <summary className="cursor-pointer text-muted hover:text-text">Exact text sent</summary>
                <pre className="mt-1.5 bg-panel2 border border-border rounded p-2 font-mono text-text whitespace-pre-wrap break-words">
                  {composeLine(v.direction, text) || "(nothing yet)"}
                </pre>
              </details>

              <div className="mt-3 flex items-center gap-3">
                <Button variant="outline" onClick={() => render(v)} disabled={v.loading || !ready} className="text-xs">
                  {v.loading ? <Spinner size={12} /> : "▶ Render"}
                </Button>
                {v.elapsed !== null && <span className="text-[11px] text-muted">{(v.elapsed / 1000).toFixed(1)}s</span>}
              </div>

              <div className="mt-2">
                <ErrorBox msg={v.error} />
              </div>
              <div className="mt-2">
                <AudioPlayer blob={v.audio} filename={`variant-${i + 1}-${Date.now()}.mp3`} />
              </div>

              {/* Save as voice — only once you've actually heard this variant. */}
              {v.audio && !v.savedVoiceId && !v.saveOpen && (
                <div className="mt-3 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    className="text-xs"
                    onClick={() =>
                      patch(v.id, {
                        saveOpen: true,
                        saveError: null,
                        saveName: v.saveName || `${voiceName || "Voice"} — ${directionToName(v.direction)}`,
                      })
                    }
                  >
                    ⭑ Save as voice
                  </Button>
                </div>
              )}

              {v.saveOpen && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs font-semibold mb-2">Save as a new voice</div>
                  <Label>Voice name</Label>
                  <Input
                    value={v.saveName}
                    onChange={(e) => patch(v.id, { saveName: e.target.value })}
                    placeholder="Jon — Young woman"
                  />

                  <div className="mt-2 space-y-1">
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="radio"
                        checked={v.saveConsistent}
                        onChange={() => patch(v.id, { saveConsistent: true })}
                        className="mt-0.5 accent-accent"
                      />
                      <span>
                        <strong>Consistent</strong> — render clips at Natural
                        <span className="text-muted"> · less clip-to-clip variance, cleaner clone</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="radio"
                        checked={!v.saveConsistent}
                        onChange={() => patch(v.id, { saveConsistent: false })}
                        className="mt-0.5 accent-accent"
                      />
                      <span>
                        <strong>As auditioned</strong> — render clips at {mode.label}
                        <span className="text-muted"> · matches what you just heard</span>
                      </span>
                    </label>
                  </div>

                  <p className="text-[11px] text-muted mt-2">
                    Renders {CLONE_CLIPS} clips in this character, then clones them into a new voice. This
                    <strong className="text-text"> creates a permanent voice</strong> in your account and uses a voice
                    slot — delete it from the Voice Cloning page. Cloned from generated audio, so expect some drift
                    from the original.
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <Button onClick={() => saveAsVoice(v)} disabled={v.saving} className="text-xs">
                      {v.saving ? <Spinner size={12} /> : `Create voice (${CLONE_CLIPS} clips + 1 clone)`}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => patch(v.id, { saveOpen: false, saveError: null })}
                      disabled={v.saving}
                    >
                      Cancel
                    </Button>
                  </div>
                  <div className="mt-2">
                    <ErrorBox msg={v.saveError} />
                  </div>
                </div>
              )}

              {v.savedVoiceId && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="bg-success/10 border border-success/30 rounded p-2.5">
                    <div className="text-xs font-medium text-success mb-1">Saved as a voice</div>
                    <div className="text-[11px] font-mono truncate" title={v.savedVoiceId}>
                      {v.savedVoiceId}
                    </div>
                    <div className="text-[11px] text-muted mt-1">
                      Now in your voice list — use it anywhere, no direction tag needed.
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
