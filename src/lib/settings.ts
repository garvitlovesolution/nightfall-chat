import { DEFAULT_DIRECTIVE, DEFAULT_MODEL } from "./models";
import type { Settings } from "./types";

const KEY = "nightfall.settings";

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  defaultModel: DEFAULT_MODEL,
  temperature: 0.9,
  maxTokens: 700,
  directive: DEFAULT_DIRECTIVE,
  defaultPersonaId: null,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function storeSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
