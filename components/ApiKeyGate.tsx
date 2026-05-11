"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { getSubscription, listVoices, listModels } from "@/lib/api";
import { Button, Input, Card, Label, ErrorBox, Spinner } from "./ui";

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const { apiKey, setApiKey, setVoices, setModels, setSubscription } = useStore();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Bootstrap shared resources whenever apiKey changes (and is valid).
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    (async () => {
      try {
        const [voicesResp, models, sub] = await Promise.all([
          listVoices(apiKey),
          listModels(apiKey),
          getSubscription(apiKey),
        ]);
        if (cancelled) return;
        setVoices(voicesResp.voices || []);
        setModels(models || []);
        setSubscription(sub);
      } catch (e) {
        if (cancelled) return;
        // Don't clear key on transient errors; surface in dashboard
        console.warn("Bootstrap failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, setVoices, setModels, setSubscription]);

  const onSave = async () => {
    setError(null);
    if (!draft.trim()) {
      setError("Paste your ElevenLabs API key");
      return;
    }
    setLoading(true);
    try {
      // Validate the key by hitting /v1/user/subscription
      await getSubscription(draft.trim());
      setApiKey(draft.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        <Spinner size={20} />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <Card className="w-full max-w-md">
          <div className="mb-4">
            <h1 className="text-lg font-semibold mb-1">Welcome</h1>
            <p className="text-sm text-muted">
              Paste your ElevenLabs API key. It's stored in <span className="font-mono">localStorage</span> on this
              device only — never sent anywhere except api.elevenlabs.io.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk_…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSave();
                }}
              />
            </div>
            <ErrorBox msg={error} />
            <Button onClick={onSave} disabled={loading} className="w-full">
              {loading ? <Spinner size={14} /> : "Continue"}
            </Button>
            <p className="text-[11px] text-muted">
              Find your key at{" "}
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                elevenlabs.io/app/settings/api-keys
              </a>
              . Read-only access still requires a key with the relevant permissions.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
