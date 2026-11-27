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

export interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const CONTEXT_MESSAGES = 40;
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
  for (const m of history.slice(-CONTEXT_MESSAGES)) {
    const text = fillVars(activeText(m), user, char.name).trim();
    if (text) msgs.push({ role: m.role, content: text });
  }
  if (mode === "continue") msgs.push({ role: "user", content: CONTINUE_NOTE });
  return msgs;
}
