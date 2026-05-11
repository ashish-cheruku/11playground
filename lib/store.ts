"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Voice, Model, Subscription, Preset } from "./types";

interface PlaygroundState {
  apiKey: string;
  setApiKey: (k: string) => void;
  clearApiKey: () => void;

  voices: Voice[];
  setVoices: (v: Voice[]) => void;

  models: Model[];
  setModels: (m: Model[]) => void;

  subscription?: Subscription;
  setSubscription: (s?: Subscription) => void;

  presets: Preset[];
  addPreset: (p: Preset) => void;
  removePreset: (id: string) => void;
}

export const useStore = create<PlaygroundState>()(
  persist(
    (set) => ({
      apiKey: "",
      setApiKey: (k) => set({ apiKey: k }),
      clearApiKey: () => set({ apiKey: "" }),

      voices: [],
      setVoices: (v) => set({ voices: v }),

      models: [],
      setModels: (m) => set({ models: m }),

      subscription: undefined,
      setSubscription: (s) => set({ subscription: s }),

      presets: [],
      addPreset: (p) => set((s) => ({ presets: [p, ...s.presets] })),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    {
      name: "elevenlabs-playground",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ apiKey: s.apiKey, presets: s.presets }),
    }
  )
);
