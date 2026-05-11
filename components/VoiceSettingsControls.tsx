"use client";

import { Slider, Card } from "./ui";
import { VOICE_PRESETS } from "@/lib/emotionTags";
import type { VoiceSettings } from "@/lib/types";

export function VoiceSettingsControls({
  value,
  onChange,
  showSpeed = true,
}: {
  value: VoiceSettings;
  onChange: (v: VoiceSettings) => void;
  showSpeed?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Voice Settings</h3>
        <select
          className="text-xs bg-panel2 border border-border rounded px-2 py-1"
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            if (!isNaN(idx) && VOICE_PRESETS[idx]) {
              onChange({ ...VOICE_PRESETS[idx].settings });
            }
            e.currentTarget.value = "";
          }}
          defaultValue=""
        >
          <option value="">Apply preset…</option>
          {VOICE_PRESETS.map((p, i) => (
            <option key={p.name} value={i}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-4">
        <Slider
          label="Stability"
          value={value.stability}
          onChange={(v) => onChange({ ...value, stability: v })}
          hint="Lower = more expressive but voice may drift; 0.3–0.5 is fiction's sweet spot."
        />
        <Slider
          label="Similarity Boost"
          value={value.similarity_boost}
          onChange={(v) => onChange({ ...value, similarity_boost: v })}
          hint="How closely to match the original voice. 0.75 default."
        />
        <Slider
          label="Style"
          value={value.style}
          onChange={(v) => onChange({ ...value, style: v })}
          hint="v3 expressiveness. 0.3–0.4 for narration; 0.5+ goes theatrical."
        />
        {showSpeed && (
          <Slider
            label="Speed"
            value={value.speed ?? 1.0}
            onChange={(v) => onChange({ ...value, speed: v })}
            min={0.7}
            max={1.2}
            step={0.05}
            hint="0.7 = slower/clearer, 1.2 = faster. Default 1.0."
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.use_speaker_boost}
            onChange={(e) => onChange({ ...value, use_speaker_boost: e.target.checked })}
            className="w-4 h-4 accent-accent"
          />
          <span>Use speaker boost</span>
          <span className="text-[11px] text-muted ml-auto">Crisper, slight CPU cost</span>
        </label>
      </div>
    </Card>
  );
}
