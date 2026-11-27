export const CATEGORIES = ["Anime", "Fantasy", "Sci-Fi", "Modern", "Romance", "Villain", "Helper", "Custom"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Character {
  id: string;
  name: string;
  tagline: string;
  avatar: string;
  category: Category;
  tags: string[];
  personality: string;
  scenario: string;
  greeting: string;
  exampleDialogue: string;
  builtin?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Persona {
  id: string;
  name: string;
  appearance: string;
  backstory: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  /** All variations of this message. Users always have exactly one. */
  swipes: string[];
  swipeIndex: number;
  createdAt: number;
}

export interface LoreEntry {
  id: string;
  keywords: string[];
  content: string;
  enabled: boolean;
}

export interface MemoryItem {
  id: string;
  text: string;
  enabled: boolean;
}

export interface ChatParams {
  temperature: number;
  maxTokens: number;
  directive: string;
  background: boolean;
}

export interface Chat {
  id: string;
  characterId: string;
  personaId: string | null;
  model: string;
  title: string;
  messages: Message[];
  memories: MemoryItem[];
  lorebook: LoreEntry[];
  params: ChatParams;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  apiKey: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  directive: string;
  defaultPersonaId: string | null;
}
