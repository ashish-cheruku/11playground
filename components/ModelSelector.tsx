"use client";

import { useStore } from "@/lib/store";
import { Select, Label } from "./ui";

export function ModelSelector({
  value,
  onChange,
  filter,
  label = "Model",
}: {
  value: string;
  onChange: (id: string) => void;
  filter?: (m: { can_do_text_to_speech?: boolean; can_do_voice_conversion?: boolean }) => boolean;
  label?: string;
}) {
  const { models } = useStore();
  const filtered = filter ? models.filter(filter) : models;
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Default</option>
        {filtered.map((m) => (
          <option key={m.model_id} value={m.model_id}>
            {m.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
