"use client";

import { useEffect, useState } from "react";
import { listHistory, deleteHistory, clearHistory } from "@/lib/history";
import type { HistoryEntry } from "@/lib/types";
import { Card, Button, Empty, Badge, Input, Select } from "@/components/ui";
import { AudioPlayer } from "@/components/AudioPlayer";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("");

  const load = () => listHistory(500).then(setItems);
  useEffect(() => {
    load();
  }, []);

  const filtered = items.filter((e) => {
    if (kind && e.kind !== kind) return false;
    if (q && !`${e.label} ${e.text || ""} ${e.voiceName || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="text-sm text-muted mt-1">
            Every generation in this browser. Audio blobs stored in IndexedDB.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            if (confirm("Delete all history?")) {
              await clearHistory();
              load();
            }
          }}
        >
          Clear all
        </Button>
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All kinds</option>
            <option value="tts">TTS</option>
            <option value="dialogue">Dialogue</option>
            <option value="voice-design">Voice Design</option>
            <option value="voice-changer">Voice Changer</option>
            <option value="sound-effect">Sound Effects</option>
          </Select>
          <div className="text-right text-sm text-muted self-center">{filtered.length} items</div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty>No history yet. Generate something on a feature page.</Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge color="accent">{e.kind}</Badge>
                  {e.voiceName && <Badge color="muted">{e.voiceName}</Badge>}
                  {e.modelId && <Badge color="muted">{e.modelId}</Badge>}
                  {e.charCount != null && <Badge color="muted">{e.charCount} chars</Badge>}
                  <span className="text-xs text-muted">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <button
                  onClick={async () => {
                    await deleteHistory(e.id);
                    load();
                  }}
                  className="text-xs text-danger hover:underline"
                >
                  Delete
                </button>
              </div>
              <div className="text-sm mb-2 whitespace-pre-wrap break-words">{e.text || e.label}</div>
              {e.settings && (
                <div className="text-[11px] text-muted font-mono mb-2">
                  stability {e.settings.stability} · sim {e.settings.similarity_boost} · style {e.settings.style}
                  {e.settings.speed != null ? ` · speed ${e.settings.speed}` : ""}
                  {e.settings.use_speaker_boost ? " · boost" : ""}
                </div>
              )}
              {e.audioBlob && (
                <AudioPlayer blob={e.audioBlob} filename={`${e.kind}-${e.id}.mp3`} compact />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
