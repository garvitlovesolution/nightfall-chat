import { DEFAULT_DIRECTIVE, DEFAULT_MODEL } from "./models";
import type { Settings } from "./types";

const KEY = "nightfall.settings";

export const DEFAULT_SETTINGS: Settings = {
  defaultModel: DEFAULT_MODEL,
  temperature: 0.9,
  maxTokens: 700,
  directive: DEFAULT_DIRECTIVE,
  defaultPersonaId: null,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { apiKey: _legacy, ...rest } = JSON.parse(raw) as Partial<Settings> & { apiKey?: string };
      return { ...DEFAULT_SETTINGS, ...rest };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function storeSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
