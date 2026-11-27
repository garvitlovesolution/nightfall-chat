export const CATEGORIES = ["Anime", "Fantasy", "Sci-Fi", "Modern", "Romance", "Drama", "Villain", "Helper", "Custom"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface MediaItem {
  id: string;
  type: "image" | "video";
  /** http(s) URL or data: URL */
  src: string;
}

/** Attached to a chat message. Local video files live in IndexedDB ("media" store) and are referenced by mediaId. */
export interface Attachment {
  id: string;
  type: "image" | "video";
  src?: string;
  mediaId?: string;
  generated?: boolean;
}

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
  media?: MediaItem[];
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
  attachments?: Attachment[];
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
  /** Story style preset id (see STORY_STYLES). */
  style?: string;
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
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  directive: string;
  defaultPersonaId: string | null;
}
