"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, Input, Badge, Button, Empty } from "@/components/ui";

export default function VoicesPage() {
  const { voices } = useStore();
  const [q, setQ] = useState("");
  const filtered = voices.filter(
    (v) =>
      v.name.toLowerCase().includes(q.toLowerCase()) ||
      (v.category || "").toLowerCase().includes(q.toLowerCase()) ||
      Object.values(v.labels || {}).join(" ").toLowerCase().includes(q.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, typeof voices>>((acc, v) => {
    const k = v.category || "uncategorized";
    (acc[k] ||= []).push(v);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Voice Library</h1>
        <p className="text-sm text-muted mt-1">
          {voices.length} voices on this account. Click ▶ to preview.
        </p>
      </div>

      <Card className="mb-4">
        <Input
          placeholder="Search by name, category, label…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Card>

      {Object.keys(grouped).length === 0 ? (
        <Empty>No voices match.</Empty>
      ) : (
        Object.entries(grouped).map(([cat, vs]) => (
          <div key={cat} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{cat}</h2>
              <Badge color="muted">{vs.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vs.map((v) => (
                <Card key={v.voice_id}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-sm">{v.name}</div>
                      <div className="text-[11px] text-muted font-mono">{v.voice_id.slice(0, 14)}…</div>
                    </div>
                    {v.preview_url && (
                      <Button
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          const audio = new Audio(v.preview_url);
                          audio.play();
                        }}
                      >
                        ▶
                      </Button>
                    )}
                  </div>
                  {v.labels && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {Object.entries(v.labels).map(([k, val]) => (
                        <Badge key={k} color="muted">
                          {k}: {val}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {v.description && <p className="text-xs text-muted line-clamp-3">{v.description}</p>}
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                    <button
                      onClick={() => navigator.clipboard.writeText(v.voice_id)}
                      className="text-xs text-accent hover:underline"
                    >
                      Copy voice_id
                    </button>
                    {v.fine_tuning?.is_allowed_to_fine_tune && <Badge color="success">Fine-tune</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
