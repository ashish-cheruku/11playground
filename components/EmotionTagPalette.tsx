"use client";

import { useState } from "react";
import { EMOTION_TAGS, PROSODY_HINTS } from "@/lib/emotionTags";
import { Card, Badge } from "./ui";

const GROUPS = ["Voice", "Emotion", "Character", "Non-verbal", "Pacing"] as const;

export function EmotionTagPalette({ onInsert }: { onInsert: (tag: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left mb-2"
      >
        <h3 className="text-sm font-semibold">v3 Emotion / Direction Tags</h3>
        <span className="text-muted text-xs">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          <p className="text-[11px] text-muted mb-3">
            Click a tag to insert it at the cursor. v3 reads these as voice direction. Tags work best in dialogue
            and high-emotion narration.
          </p>
          <div className="space-y-2">
            {GROUPS.map((group) => (
              <div key={group}>
                <div className="text-[10px] uppercase tracking-wider text-muted mb-1">{group}</div>
                <div className="flex flex-wrap gap-1">
                  {EMOTION_TAGS.filter((t) => t.group === group).map((t) => (
                    <button
                      key={t.tag}
                      title={t.hint}
                      onClick={() => onInsert(t.tag)}
                      className="px-2 py-0.5 text-xs rounded bg-panel2 hover:bg-accent hover:text-white border border-border transition-colors font-mono"
                    >
                      {t.tag}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1 mt-2">Prosody hints</div>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted">
                {PROSODY_HINTS.map((h) => (
                  <span key={h.sym}>
                    <span className="font-mono text-text">{h.sym}</span> — {h.hint}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
