"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { speechToText } from "@/lib/api";
import { Card, Button, Label, Spinner, ErrorBox, Select, Input } from "@/components/ui";
import { FileText } from "lucide-react";

export default function STTPage() {
  const { apiKey } = useStore();
  const [audio, setAudio] = useState<File | null>(null);
  const [modelId, setModelId] = useState("scribe_v1");
  const [language, setLanguage] = useState("");
  const [diarize, setDiarize] = useState(false);
  const [tagEvents, setTagEvents] = useState(false);
  const [granularity, setGranularity] = useState<"none" | "word" | "character">("none");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcribe = async () => {
    setError(null);
    setResult(null);
    if (!audio) return setError("Upload an audio file");
    setLoading(true);
    try {
      const r = await speechToText(apiKey, {
        audio,
        modelId,
        languageCode: language || undefined,
        diarize,
        tagAudioEvents: tagEvents,
        timestampsGranularity: granularity,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const text = (result as { text?: string } | null)?.text;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Speech to Text</h1>
        <p className="text-sm text-muted mt-1">
          ElevenLabs Scribe transcription. Compare to Whisper for verification quality.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <Label>Audio file</Label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudio(e.target.files?.[0] || null)}
              className="block w-full text-sm text-text file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-accent file:text-white file:cursor-pointer"
            />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-2">Result</h3>
            <ErrorBox msg={error} />
            {text && (
              <div className="mt-2">
                <Label>Transcript</Label>
                <div className="bg-panel2 border border-border rounded p-3 text-sm whitespace-pre-wrap">{text}</div>
              </div>
            )}
            {result !== null && (
              <details className="mt-3">
                <summary className="text-xs text-muted cursor-pointer hover:text-accent">Raw JSON response</summary>
                <pre className="text-[11px] mt-2 p-2 bg-panel2 rounded overflow-auto max-h-96 font-mono">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            )}
            <div className="mt-3">
              <Button onClick={transcribe} disabled={loading}>
                {loading ? <Spinner size={14} /> : <span className="inline-flex items-center gap-1.5"><FileText className="w-4 h-4" strokeWidth={1.75} /> Transcribe</span>}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Settings</h3>
            <div className="space-y-3">
              <div>
                <Label>Model ID</Label>
                <Input value={modelId} onChange={(e) => setModelId(e.target.value)} />
              </div>
              <div>
                <Label>Language code (optional)</Label>
                <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. en, es" />
              </div>
              <div>
                <Label>Timestamps granularity</Label>
                <Select value={granularity} onChange={(e) => setGranularity(e.target.value as "none" | "word" | "character")}>
                  <option value="none">None</option>
                  <option value="word">Word</option>
                  <option value="character">Character</option>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={diarize} onChange={(e) => setDiarize(e.target.checked)} className="w-4 h-4 accent-accent" />
                <span>Diarize speakers</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tagEvents} onChange={(e) => setTagEvents(e.target.checked)} className="w-4 h-4 accent-accent" />
                <span>Tag audio events (laughter, music)</span>
              </label>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
