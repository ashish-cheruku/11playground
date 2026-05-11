"use client";

import { useStore } from "@/lib/store";
import { Select, Label } from "./ui";

export function VoiceSelector({
  value,
  onChange,
  label = "Voice",
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const { voices } = useStore();
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select voice…</option>
        {voices.map((v) => (
          <option key={v.voice_id} value={v.voice_id}>
            {v.name} {v.category ? `(${v.category})` : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}
