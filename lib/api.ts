// Direct browser → ElevenLabs API client. CORS works because ElevenLabs returns
// permissive CORS headers; the API key sits in localStorage on the user's machine.

import type {
  Voice,
  Model,
  Subscription,
  VoiceSettings,
  DialogueLine,
  PronunciationDictionary,
  DialogueAlignment,
  VoiceSegment,
  DialogueTimestampsResult,
} from "./types";
import { base64ToBlob } from "./alignment";

const BASE = "https://api.elevenlabs.io";

function authHeaders(apiKey: string, json = true): HeadersInit {
  const h: Record<string, string> = { "xi-api-key": apiKey };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail?.message || parsed?.detail || JSON.stringify(parsed);
    } catch {}
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function blobOrThrow(res: Response): Promise<Blob> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail?.message || parsed?.detail || JSON.stringify(parsed);
    } catch {}
    throw new Error(`ElevenLabs ${res.status}: ${detail || res.statusText}`);
  }
  return res.blob();
}

// ---------------- Account ----------------

export async function getSubscription(apiKey: string): Promise<Subscription> {
  const r = await fetch(`${BASE}/v1/user/subscription`, { headers: authHeaders(apiKey, false) });
  return jsonOrThrow<Subscription>(r);
}

export async function getUser(apiKey: string): Promise<{ subscription?: Subscription; xi_api_key?: string; first_name?: string }> {
  const r = await fetch(`${BASE}/v1/user`, { headers: authHeaders(apiKey, false) });
  return jsonOrThrow(r);
}

// ---------------- Models ----------------

export async function listModels(apiKey: string): Promise<Model[]> {
  const r = await fetch(`${BASE}/v1/models`, { headers: authHeaders(apiKey, false) });
  return jsonOrThrow<Model[]>(r);
}

// ---------------- Voices ----------------

export async function listVoices(apiKey: string): Promise<{ voices: Voice[] }> {
  const r = await fetch(`${BASE}/v1/voices`, { headers: authHeaders(apiKey, false) });
  return jsonOrThrow(r);
}

export async function getVoice(apiKey: string, voiceId: string): Promise<Voice> {
  const r = await fetch(`${BASE}/v1/voices/${voiceId}`, { headers: authHeaders(apiKey, false) });
  return jsonOrThrow<Voice>(r);
}

export async function getDefaultVoiceSettings(apiKey: string): Promise<VoiceSettings> {
  const r = await fetch(`${BASE}/v1/voices/settings/default`, { headers: authHeaders(apiKey, false) });
  return jsonOrThrow<VoiceSettings>(r);
}

export async function getVoiceSettings(apiKey: string, voiceId: string): Promise<VoiceSettings> {
  const r = await fetch(`${BASE}/v1/voices/${voiceId}/settings`, { headers: authHeaders(apiKey, false) });
  return jsonOrThrow<VoiceSettings>(r);
}

// ---------------- Text-to-Speech ----------------

export interface TTSOptions {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: string; // e.g. mp3_44100_128
  seed?: number;
  applyTextNormalization?: "auto" | "on" | "off";
  pronunciationDictionaryLocators?: PronunciationDictionary[];
  languageCode?: string;
}

export async function textToSpeech(apiKey: string, opts: TTSOptions): Promise<Blob> {
  const url = new URL(`${BASE}/v1/text-to-speech/${opts.voiceId}`);
  if (opts.outputFormat) url.searchParams.set("output_format", opts.outputFormat);
  const body: Record<string, unknown> = {
    text: opts.text,
    model_id: opts.modelId || "eleven_multilingual_v2",
  };
  if (opts.voiceSettings) body.voice_settings = opts.voiceSettings;
  if (opts.seed !== undefined) body.seed = opts.seed;
  if (opts.applyTextNormalization) body.apply_text_normalization = opts.applyTextNormalization;
  if (opts.pronunciationDictionaryLocators?.length) {
    body.pronunciation_dictionary_locators = opts.pronunciationDictionaryLocators.map(d => ({
      pronunciation_dictionary_id: d.id,
      version_id: d.version_id,
    }));
  }
  if (opts.languageCode) body.language_code = opts.languageCode;
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  return blobOrThrow(r);
}

export async function textToSpeechStream(apiKey: string, opts: TTSOptions): Promise<Blob> {
  const url = new URL(`${BASE}/v1/text-to-speech/${opts.voiceId}/stream`);
  if (opts.outputFormat) url.searchParams.set("output_format", opts.outputFormat);
  const body: Record<string, unknown> = {
    text: opts.text,
    model_id: opts.modelId || "eleven_multilingual_v2",
  };
  if (opts.voiceSettings) body.voice_settings = opts.voiceSettings;
  if (opts.seed !== undefined) body.seed = opts.seed;
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  return blobOrThrow(r);
}

// ---------------- Text-to-Dialogue ----------------

export interface DialogueOptions {
  inputs: DialogueLine[];
  modelId?: string;
  outputFormat?: string;
  applyTextNormalization?: "auto" | "on" | "off";
  seed?: number;
  settings?: VoiceSettings;
}

export async function textToDialogue(apiKey: string, opts: DialogueOptions): Promise<Blob> {
  const url = new URL(`${BASE}/v1/text-to-dialogue`);
  if (opts.outputFormat) url.searchParams.set("output_format", opts.outputFormat);
  const body: Record<string, unknown> = {
    inputs: opts.inputs,
    model_id: opts.modelId || "eleven_v3",
  };
  if (opts.settings) body.settings = opts.settings;
  if (opts.applyTextNormalization) body.apply_text_normalization = opts.applyTextNormalization;
  if (opts.seed !== undefined) body.seed = opts.seed;
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  return blobOrThrow(r);
}

// POST /v1/text-to-dialogue/with-timestamps — same request as textToDialogue but
// returns a JSON envelope { audio_base64, alignment, normalized_alignment,
// voice_segments } instead of raw audio bytes. The audio is decoded to a Blob so
// callers treat it like any other player source.
export async function textToDialogueWithTimestamps(
  apiKey: string,
  opts: DialogueOptions,
): Promise<DialogueTimestampsResult> {
  const url = new URL(`${BASE}/v1/text-to-dialogue/with-timestamps`);
  if (opts.outputFormat) url.searchParams.set("output_format", opts.outputFormat);
  const body: Record<string, unknown> = {
    inputs: opts.inputs,
    model_id: opts.modelId || "eleven_v3",
  };
  if (opts.settings) body.settings = opts.settings;
  if (opts.applyTextNormalization) body.apply_text_normalization = opts.applyTextNormalization;
  if (opts.seed !== undefined) body.seed = opts.seed;
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const data = await jsonOrThrow<{
    audio_base64: string;
    alignment: DialogueAlignment | null;
    normalized_alignment: DialogueAlignment | null;
    voice_segments?: VoiceSegment[];
  }>(r);
  const mime = (opts.outputFormat || "mp3_44100_128").startsWith("pcm") ? "audio/wav" : "audio/mpeg";
  return {
    audioBlob: base64ToBlob(data.audio_base64, mime),
    audioMime: mime,
    alignment: data.alignment ?? null,
    normalizedAlignment: data.normalized_alignment ?? null,
    voiceSegments: data.voice_segments ?? [],
  };
}

// ---------------- Voice Design (text-to-voice) ----------------

export interface VoiceDesignPreviewReq {
  voiceDescription: string;
  text: string;
  autoGenerateText?: boolean;
  loudness?: number;
  guidanceScale?: number;
  seed?: number;
}

export interface VoiceDesignPreview {
  generated_voice_id: string;
  audio_base_64: string;
  media_type: string;
  duration_secs?: number;
}

export async function voiceDesignPreviews(
  apiKey: string,
  req: VoiceDesignPreviewReq
): Promise<{ previews: VoiceDesignPreview[]; text: string }> {
  const r = await fetch(`${BASE}/v1/text-to-voice/create-previews`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      voice_description: req.voiceDescription,
      text: req.text,
      auto_generate_text: req.autoGenerateText ?? false,
      loudness: req.loudness,
      guidance_scale: req.guidanceScale,
      seed: req.seed,
    }),
  });
  return jsonOrThrow(r);
}

export async function voiceDesignSave(
  apiKey: string,
  voiceName: string,
  voiceDescription: string,
  generatedVoiceId: string
): Promise<{ voice_id: string }> {
  const r = await fetch(`${BASE}/v1/text-to-voice/create-voice-from-preview`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      voice_name: voiceName,
      voice_description: voiceDescription,
      generated_voice_id: generatedVoiceId,
    }),
  });
  return jsonOrThrow(r);
}

// ---------------- Speech-to-Speech (Voice Changer) ----------------

export interface S2SOptions {
  voiceId: string;
  audio: Blob;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  outputFormat?: string;
  removeBackgroundNoise?: boolean;
  seed?: number;
}

export async function speechToSpeech(apiKey: string, opts: S2SOptions): Promise<Blob> {
  const url = new URL(`${BASE}/v1/speech-to-speech/${opts.voiceId}`);
  if (opts.outputFormat) url.searchParams.set("output_format", opts.outputFormat);
  const fd = new FormData();
  fd.append("audio", opts.audio);
  fd.append("model_id", opts.modelId || "eleven_english_sts_v2");
  if (opts.voiceSettings) fd.append("voice_settings", JSON.stringify(opts.voiceSettings));
  if (opts.removeBackgroundNoise !== undefined)
    fd.append("remove_background_noise", String(opts.removeBackgroundNoise));
  if (opts.seed !== undefined) fd.append("seed", String(opts.seed));
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  return blobOrThrow(r);
}

// ---------------- Sound Effects ----------------

export interface SoundFxOptions {
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  outputFormat?: string;
}

export async function soundGeneration(apiKey: string, opts: SoundFxOptions): Promise<Blob> {
  const url = new URL(`${BASE}/v1/sound-generation`);
  if (opts.outputFormat) url.searchParams.set("output_format", opts.outputFormat);
  const body: Record<string, unknown> = { text: opts.text };
  if (opts.durationSeconds !== undefined) body.duration_seconds = opts.durationSeconds;
  if (opts.promptInfluence !== undefined) body.prompt_influence = opts.promptInfluence;
  const r = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });
  return blobOrThrow(r);
}

// ---------------- Speech-to-Text ----------------

export interface STTOptions {
  audio: Blob;
  modelId?: string;
  languageCode?: string;
  tagAudioEvents?: boolean;
  numSpeakers?: number;
  diarize?: boolean;
  timestampsGranularity?: "none" | "word" | "character";
}

export async function speechToText(apiKey: string, opts: STTOptions): Promise<unknown> {
  const fd = new FormData();
  fd.append("file", opts.audio);
  fd.append("model_id", opts.modelId || "scribe_v1");
  if (opts.languageCode) fd.append("language_code", opts.languageCode);
  if (opts.tagAudioEvents !== undefined) fd.append("tag_audio_events", String(opts.tagAudioEvents));
  if (opts.numSpeakers !== undefined) fd.append("num_speakers", String(opts.numSpeakers));
  if (opts.diarize !== undefined) fd.append("diarize", String(opts.diarize));
  if (opts.timestampsGranularity) fd.append("timestamps_granularity", opts.timestampsGranularity);
  const r = await fetch(`${BASE}/v1/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  return jsonOrThrow(r);
}

// ---------------- Pronunciation Dictionaries ----------------

export interface DictRule {
  string_to_replace: string;
  type: "alias" | "phoneme";
  alias?: string;
  phoneme?: string;
  alphabet?: "ipa" | "cmu-arpabet";
}

export async function dictAddFromRules(
  apiKey: string,
  name: string,
  rules: DictRule[],
  description?: string
): Promise<{ id: string; version_id: string }> {
  const r = await fetch(`${BASE}/v1/pronunciation-dictionaries/add-from-rules`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ name, rules, description }),
  });
  return jsonOrThrow(r);
}

export async function dictList(apiKey: string): Promise<{ pronunciation_dictionaries: { id: string; name: string; latest_version_id: string }[] }> {
  const r = await fetch(`${BASE}/v1/pronunciation-dictionaries`, {
    headers: authHeaders(apiKey, false),
  });
  return jsonOrThrow(r);
}

export async function dictAddRules(
  apiKey: string,
  dictionaryId: string,
  rules: DictRule[]
): Promise<{ id: string; version_id: string }> {
  const r = await fetch(`${BASE}/v1/pronunciation-dictionaries/${dictionaryId}/add-rules`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ rules }),
  });
  return jsonOrThrow(r);
}

// ---------------- Voice Cloning (Instant) ----------------

export interface VoiceCloneOptions {
  name: string;
  files: File[];
  description?: string;
  labels?: Record<string, string>;
  removeBackgroundNoise?: boolean;
}

export async function voiceCloneAdd(apiKey: string, opts: VoiceCloneOptions): Promise<{ voice_id: string; requires_verification?: boolean }> {
  const fd = new FormData();
  fd.append("name", opts.name);
  for (const f of opts.files) fd.append("files", f);
  if (opts.description) fd.append("description", opts.description);
  if (opts.labels) fd.append("labels", JSON.stringify(opts.labels));
  if (opts.removeBackgroundNoise !== undefined)
    fd.append("remove_background_noise", String(opts.removeBackgroundNoise));
  const r = await fetch(`${BASE}/v1/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  return jsonOrThrow(r);
}

export async function voiceEdit(
  apiKey: string,
  voiceId: string,
  opts: { name?: string; description?: string; labels?: Record<string, string>; files?: File[] }
): Promise<{ status?: string }> {
  const fd = new FormData();
  if (opts.name) fd.append("name", opts.name);
  if (opts.description) fd.append("description", opts.description);
  if (opts.labels) fd.append("labels", JSON.stringify(opts.labels));
  if (opts.files) for (const f of opts.files) fd.append("files", f);
  const r = await fetch(`${BASE}/v1/voices/${voiceId}/edit`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  return jsonOrThrow(r);
}

export async function voiceDelete(apiKey: string, voiceId: string): Promise<{ status?: string }> {
  const r = await fetch(`${BASE}/v1/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": apiKey },
  });
  return jsonOrThrow(r);
}

// ---------------- Audio Isolation ----------------

export async function audioIsolation(apiKey: string, audio: Blob): Promise<Blob> {
  const fd = new FormData();
  fd.append("audio", audio);
  const r = await fetch(`${BASE}/v1/audio-isolation`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  return blobOrThrow(r);
}
