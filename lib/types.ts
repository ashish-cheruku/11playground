export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
  samples?: unknown[];
  fine_tuning?: { is_allowed_to_fine_tune?: boolean };
  high_quality_base_model_ids?: string[];
}

export interface Model {
  model_id: string;
  name: string;
  can_be_finetuned?: boolean;
  can_do_text_to_speech?: boolean;
  can_do_voice_conversion?: boolean;
  serves_pro_voices?: boolean;
  token_cost_factor?: number;
  description?: string;
  requires_alpha_access?: boolean;
  max_characters_request_free_user?: number;
  max_characters_request_subscribed_user?: number;
  languages?: { language_id: string; name: string }[];
}

export interface Subscription {
  tier?: string;
  character_count?: number;
  character_limit?: number;
  can_extend_character_limit?: boolean;
  allowed_to_extend_character_limit?: boolean;
  next_character_count_reset_unix?: number;
  voice_limit?: number;
  professional_voice_limit?: number;
  can_use_instant_voice_cloning?: boolean;
  can_use_professional_voice_cloning?: boolean;
  status?: string;
  currency?: string;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed?: number;
}

export interface DialogueLine {
  text: string;
  voice_id: string;
}

export interface PronunciationDictionary {
  id: string;
  version_id?: string;
  name?: string;
  description?: string;
}

export interface HistoryEntry {
  id: string;
  createdAt: number;
  kind: "tts" | "dialogue" | "stt" | "voice-design" | "voice-changer" | "sound-effect";
  label: string;
  text?: string;
  voiceId?: string;
  voiceName?: string;
  modelId?: string;
  settings?: VoiceSettings;
  charCount?: number;
  audioBlob?: Blob;
  audioMime?: string;
  meta?: Record<string, unknown>;
}

export interface Preset {
  id: string;
  name: string;
  modelId: string;
  voiceId?: string;
  settings: VoiceSettings;
  createdAt: number;
}
