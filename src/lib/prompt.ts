import { STORY_STYLES } from "./models";
import type { Character, Chat, LoreEntry, Message, Persona } from "./types";

export function activeText(m: Message): string {
  return m.swipes[m.swipeIndex] ?? "";
}

export function fillVars(text: string, user: string, char: string): string {
  return text.replace(/\{\{\s*user\s*\}\}/gi, user).replace(/\{\{\s*char\s*\}\}/gi, char);
}

/** Lorebook entries whose keywords appear in the last `depth` messages. */
export function triggeredLore(chat: Chat, depth = 6): LoreEntry[] {
  const recent = chat.messages
    .slice(-depth)
    .map(activeText)
    .join("\n")
    .toLowerCase();
  return chat.lorebook.filter(
    (e) => e.enabled && e.content.trim() && e.keywords.some((k) => k.trim() && recent.includes(k.trim().toLowerCase())),
  );
}

export function buildSystemPrompt(chat: Chat, char: Character, persona: Persona | null): string {
  const user = persona?.name || "You";
  const f = (s: string) => fillVars(s, user, char.name);
  const parts: string[] = [];

  parts.push(f(chat.params.directive.trim()));
  const style = STORY_STYLES.find((s) => s.id === chat.params.style);
  if (style?.text) parts.push(f(style.text));
  parts.push(`# Character: ${char.name}\n${char.tagline ? f(char.tagline) + "\n" : ""}${f(char.personality)}`);
  if (char.scenario.trim()) parts.push(`# Scenario\n${f(char.scenario)}`);

  if (persona) {
    const bits = [`Name: ${persona.name}`];
    if (persona.appearance.trim()) bits.push(`Appearance: ${persona.appearance.trim()}`);
    if (persona.backstory.trim()) bits.push(`Backstory: ${persona.backstory.trim()}`);
    parts.push(`# The user is roleplaying as\n${bits.join("\n")}`);
  }

  const memories = chat.memories.filter((m) => m.enabled && m.text.trim());
  if (memories.length) parts.push(`# Memory bank (established facts, always remember)\n${memories.map((m) => `- ${f(m.text.trim())}`).join("\n")}`);

  const lore = triggeredLore(chat);
  if (lore.length) parts.push(`# World info (relevant right now)\n${lore.map((e) => `- ${f(e.content.trim())}`).join("\n")}`);

  if (char.exampleDialogue.trim()) parts.push(`# Example dialogue (style reference only, do not repeat)\n${f(char.exampleDialogue)}`);

  return parts.join("\n\n");
}

export type ApiPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string | ApiPart[];
}

const CONTEXT_MESSAGES = 40;
const MAX_IMAGES_SENT = 3; // most recent images only, to keep requests small
export const CONTINUE_NOTE =
  "[Continue your previous reply seamlessly from exactly where it stopped. Do not repeat earlier text and do not add a preamble.]";

export function buildApiMessages(
  chat: Chat,
  char: Character,
  persona: Persona | null,
  history: Message[],
  mode: "normal" | "continue" = "normal",
): ApiMessage[] {
  const user = persona?.name || "You";
  const msgs: ApiMessage[] = [{ role: "system", content: buildSystemPrompt({ ...chat, messages: history }, char, persona) }];
  let imageBudget = MAX_IMAGES_SENT;
  const built: ApiMessage[] = [];

  // Walk newest -> oldest so the most recent images win the budget.
  for (const m of history.slice(-CONTEXT_MESSAGES).reverse()) {
    let text = fillVars(activeText(m), user, char.name).trim();
    const atts = m.attachments ?? [];
    const images: string[] = [];
    if (m.role === "user") {
      for (const a of atts) {
        if (a.type === "image" && a.src?.startsWith("data:image/") && imageBudget > 0) {
          images.push(a.src);
          imageBudget--;
        }
      }
    }
    const notes: string[] = [];
    const videos = atts.filter((a) => a.type === "video").length;
    const unseenImages = atts.filter((a) => a.type === "image").length - images.length;
    if (videos) notes.push(m.role === "user" ? `[${user} shared ${videos} video(s)]` : `[${char.name} sent a video]`);
    if (unseenImages > 0) notes.push(m.role === "user" ? `[${user} shared a picture]` : `[${char.name} sent a picture]`);
    if (notes.length) text = [text, ...notes].filter(Boolean).join(" ");

    if (images.length) {
      built.push({ role: "user", content: [{ type: "text", text: text || "(photo)" }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url } }))] });
    } else if (text) {
      built.push({ role: m.role, content: text });
    }
  }
  msgs.push(...built.reverse());
  if (mode === "continue") msgs.push({ role: "user", content: CONTINUE_NOTE });
  return msgs;
}
