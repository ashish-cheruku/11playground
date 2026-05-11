# ElevenLabs Playground

Standalone Next.js research tool for exercising **every** ElevenLabs API feature — text-to-speech, text-to-dialogue, voice design, voice changer (S2S), sound effects, speech-to-text, and pronunciation dictionaries — with **A/B comparison** and **full history**.

Built for: testing the API with only an API key (no ElevenLabs account login required).

## Features

| Page | What it does |
|---|---|
| **Dashboard** | Subscription tier, character usage, capability flags, model catalog |
| **Text to Speech** | Full v3 settings, emotion tag palette, output format, seed, normalization |
| **Text to Dialogue** | Multi-speaker scenes with per-line voice + text |
| **A/B Compare** | Same text, two configs, side-by-side playback (the killer feature) |
| **Voice Library** | Browse and preview every voice on the account |
| **Voice Design** | Generate new voices from text descriptions, save winners |
| **Voice Changer (S2S)** | Re-render audio in a different voice |
| **Sound Effects** | Generate FX from prompts |
| **Speech to Text** | Scribe transcription with diarization, timestamps |
| **Pronunciation Dict** | Create + manage IPA / alias dictionaries |
| **History** | Every generation persisted to IndexedDB with audio blobs |

## Setup

```bash
cd elevenlabs-playground
npm install
npm run dev
```

Open <http://localhost:3000>. Paste your ElevenLabs API key on the welcome screen — it's stored in `localStorage` on your machine and sent only to `api.elevenlabs.io`.

## How to use it for audiobook research

1. **Dashboard** — confirm tier, concurrent limit, character cap.
2. **Voice Library** — find candidate voices.
3. **A/B Compare** — load the *same* text, set Voice A = "Audiobook — Default" preset, Voice B = "Audiobook — High Emotion" preset, run both, listen back-to-back.
4. **TTS page** — drill into the winner with the emotion tag palette.
5. **Pronunciation Dict** — define character/place names so they read consistently.
6. **History** — save your favorites, settings preserved.

## Voice setting presets (built in)

| Preset | stability | sim_boost | style | use case |
|---|---|---|---|---|
| Audiobook — Default | 0.45 | 0.75 | 0.35 | Fiction sweet spot |
| Audiobook — High Emotion | 0.30 | 0.75 | 0.55 | Action / romance / fear |
| Audiobook — Exposition | 0.55 | 0.75 | 0.25 | World-building / steady |
| Non-fiction Narration | 0.65 | 0.75 | 0.15 | Even, journalistic |
| Conversational | 0.50 | 0.75 | 0.40 | Dialogue / podcasts |
| Maximum Expression | 0.20 | 0.75 | 0.70 | Stage / dramatic readings |

## Notes

- **No backend.** The browser calls ElevenLabs directly. CORS is supported by the API.
- **API key never leaves your machine.** Only sent in `xi-api-key` header to `api.elevenlabs.io`.
- **History uses IndexedDB.** Audio blobs are persisted; clearing browser data wipes them.
- **No ElevenLabs account login required.** The key alone is sufficient for every endpoint.

## Tech

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (persisted to localStorage)
- IndexedDB via `idb`

## Project layout

```
app/
  layout.tsx              # ApiKeyGate wrapper
  page.tsx                # Dashboard
  tts/                    # Text-to-Speech
  dialogue/               # Text-to-Dialogue
  ab-test/                # A/B Compare
  voices/                 # Voice library browser
  voice-design/           # Text-to-Voice
  voice-changer/          # Speech-to-Speech
  sound-effects/          # Sound generation
  stt/                    # Speech-to-Text
  pronunciation/          # Pronunciation dictionaries
  history/                # IndexedDB browser
components/
  Sidebar, ApiKeyGate, AudioPlayer, VoiceSelector, ModelSelector,
  VoiceSettingsControls, EmotionTagPalette, ui (Button/Card/etc)
lib/
  api.ts                  # Direct browser → ElevenLabs client
  store.ts                # Zustand (apiKey, voices, models, presets)
  history.ts              # IndexedDB
  types.ts
  emotionTags.ts          # v3 emotion tag list + voice presets
```

## License

Internal research tool. Not for redistribution.
