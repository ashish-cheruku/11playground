"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getSubscription, listVoices, listModels } from "@/lib/api";
import { Card, Button, Badge, Spinner, ErrorBox } from "@/components/ui";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

export default function Dashboard() {
  const { apiKey, voices, models, subscription, setSubscription, setVoices, setModels, clearApiKey } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const [v, m, s] = await Promise.all([listVoices(apiKey), listModels(apiKey), getSubscription(apiKey)]);
      setVoices(v.voices || []);
      setModels(m || []);
      setSubscription(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subscription === undefined) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usagePct = subscription?.character_limit
    ? Math.round(((subscription.character_count || 0) / subscription.character_limit) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Account status, usage, and quick links.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? <Spinner size={14} /> : "Refresh"}
          </Button>
          <Button variant="ghost" onClick={() => { if (confirm("Clear stored API key?")) clearApiKey(); }}>
            Clear API key
          </Button>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBox msg={error} /></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Tier</div>
          <div className="text-2xl font-semibold">{subscription?.tier || "—"}</div>
          <div className="text-xs text-muted mt-1">{subscription?.status || ""}</div>
        </Card>
        <Card>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Characters Used</div>
          <div className="text-2xl font-semibold">
            {(subscription?.character_count ?? 0).toLocaleString()}
            <span className="text-sm text-muted font-normal">
              {" "}/ {(subscription?.character_limit ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-panel2 rounded h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-accent h-full transition-all"
              style={{ width: `${Math.min(100, usagePct)}%` }}
            />
          </div>
          <div className="text-xs text-muted mt-1">{usagePct}% of monthly quota</div>
        </Card>
        <Card>
          <div className="text-xs text-muted uppercase tracking-wide mb-1">Capabilities</div>
          <div className="space-y-1 mt-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge color={subscription?.can_use_instant_voice_cloning ? "success" : "muted"}>
                {subscription?.can_use_instant_voice_cloning
                  ? <Check className="w-3 h-3 inline" strokeWidth={2.5} />
                  : <Minus className="w-3 h-3 inline" strokeWidth={2} />}
              </Badge>
              <span>Instant Voice Cloning</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge color={subscription?.can_use_professional_voice_cloning ? "success" : "muted"}>
                {subscription?.can_use_professional_voice_cloning
                  ? <Check className="w-3 h-3 inline" strokeWidth={2.5} />
                  : <Minus className="w-3 h-3 inline" strokeWidth={2} />}
              </Badge>
              <span>Professional Voice Cloning</span>
            </div>
            <div className="text-xs text-muted mt-2">
              Voices: {voices.length} · Models: {models.length}
            </div>
          </div>
        </Card>
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Quick Start</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <QuickLink href="/tts" title="Text to Speech" desc="Single-voice narration. All v3 settings, emotion tags, presets." />
        <QuickLink href="/dialogue" title="Text to Dialogue" desc="Multi-speaker scenes. v3-only. The natural turn-taking endpoint." />
        <QuickLink href="/ab-test" title="A/B Compare" desc="Run two configs on the same text. Side-by-side playback." />
        <QuickLink href="/voice-clone" title="Voice Cloning" desc="Upload audio samples to clone an existing voice. Instant Voice Cloning." />
        <QuickLink href="/voice-design" title="Voice Design" desc="Create new voices from a text description. Save winners." />
        <QuickLink href="/voice-changer" title="Voice Changer (S2S)" desc="Re-render audio in a different voice." />
        <QuickLink href="/sound-effects" title="Sound Effects" desc="Generate FX from text prompts." />
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Models Available</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 font-medium">Name</th>
                <th className="text-left py-2 pr-3 font-medium">Model ID</th>
                <th className="text-left py-2 pr-3 font-medium">TTS</th>
                <th className="text-left py-2 pr-3 font-medium">S2S</th>
                <th className="text-left py-2 pr-3 font-medium">Languages</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.model_id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{m.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-muted">{m.model_id}</td>
                  <td className="py-2 pr-3">{m.can_do_text_to_speech
                    ? <Check className="w-4 h-4 text-success" strokeWidth={2} />
                    : <Minus className="w-4 h-4 text-muted" strokeWidth={2} />}</td>
                  <td className="py-2 pr-3">{m.can_do_voice_conversion
                    ? <Check className="w-4 h-4 text-success" strokeWidth={2} />
                    : <Minus className="w-4 h-4 text-muted" strokeWidth={2} />}</td>
                  <td className="py-2 pr-3 text-xs text-muted">{m.languages?.length ?? 0}</td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-muted text-sm">No models loaded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href}>
      <Card className="hover:border-accent transition-colors cursor-pointer h-full">
        <div className="font-semibold text-sm mb-1">{title}</div>
        <div className="text-xs text-muted">{desc}</div>
      </Card>
    </Link>
  );
}
