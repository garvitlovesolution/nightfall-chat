import * as idb from "./idb";
import type { StoreName } from "./idb";
import { cloudPull, cloudPush, cloudRemove, CLOUD_ENABLED } from "./cloud";
import { buildSeedCharacters, SEED_IDS, SEED_VERSION } from "./seed";
import type { Character, Chat, Persona } from "./types";

const SEED_KEY = "nightfall.seeded";

async function ensureSeeded() {
  try {
    if (localStorage.getItem(SEED_KEY) === SEED_VERSION) return;
  } catch {}
  // Retire built-in characters that are no longer part of the catalog.
  for (const old of await idb.getAll<Character>("characters")) {
    if (old.builtin && !SEED_IDS.has(old.id)) await idb.del("characters", old.id);
  }
  for (const c of buildSeedCharacters()) {
    const existing = await idb.get<Character>("characters", c.id);
    // Add new ones; refresh built-ins the user never edited (picks up new art/text).
    if (!existing || (existing.builtin && existing.createdAt === existing.updatedAt)) await idb.put("characters", c);
  }
  try {
    localStorage.setItem(SEED_KEY, SEED_VERSION);
  } catch {}
}

/** Merge docs from D1/KV (if enabled) into IndexedDB; newer updatedAt wins. */
export async function syncFromCloud(): Promise<number> {
  if (!CLOUD_ENABLED) return 0;
  const docs = await cloudPull();
  let changed = 0;
  for (const d of docs) {
    try {
      const incoming = JSON.parse(d.data) as { id: string; updatedAt?: number };
      const local = await idb.get<{ id: string; updatedAt?: number }>(d.store, d.id);
      if (!local || (incoming.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        await idb.put(d.store, incoming);
        changed++;
      }
    } catch {}
  }
  return changed;
}

async function save<T extends { id: string; updatedAt: number }>(store: StoreName, doc: T): Promise<T> {
  const next = { ...doc, updatedAt: Date.now() };
  await idb.put(store, next);
  void cloudPush(store, next);
  return next;
}

async function remove(store: StoreName, id: string) {
  await idb.del(store, id);
  void cloudRemove(store, id);
}

// Characters
export async function listCharacters(): Promise<Character[]> {
  await ensureSeeded();
  const all = await idb.getAll<Character>("characters");
  return all.sort((a, b) => (b.builtin ? 0 : 1) - (a.builtin ? 0 : 1) || b.createdAt - a.createdAt);
}
export const saveCharacter = (c: Character) => save("characters", c);
export const deleteCharacter = (id: string) => remove("characters", id);

// Personas
export async function listPersonas(): Promise<Persona[]> {
  return (await idb.getAll<Persona>("personas")).sort((a, b) => a.createdAt - b.createdAt);
}
export const savePersona = (p: Persona) => save("personas", p);
export const deletePersona = (id: string) => remove("personas", id);

// Chats (memories + lorebook are embedded in the chat document)
export async function listChats(): Promise<Chat[]> {
  return (await idb.getAll<Chat>("chats")).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getChat = (id: string) => idb.get<Chat>("chats", id);
export const saveChat = (c: Chat) => save("chats", c);
export async function deleteChat(id: string) {
  const chat = await idb.get<Chat>("chats", id);
  for (const m of chat?.messages ?? []) for (const a of m.attachments ?? []) if (a.mediaId) await idb.del("media", a.mediaId);
  await remove("chats", id);
}

// Local video blobs (device-only, never synced)
export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  await idb.put("media", { id, blob, type: blob.type, updatedAt: Date.now() });
}
export const deleteMediaBlob = (id: string) => idb.del("media", id);
export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  return (await idb.get<{ id: string; blob: Blob }>("media", id))?.blob;
}

// Backup / restore
export async function exportAll(): Promise<string> {
  const [characters, personas, chats] = await Promise.all([
    idb.getAll<Character>("characters"),
    idb.getAll<Persona>("personas"),
    idb.getAll<Chat>("chats"),
  ]);
  return JSON.stringify({ app: "nightfall", version: 1, exportedAt: Date.now(), characters, personas, chats }, null, 2);
}

export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json) as Partial<Record<"characters" | "personas" | "chats", { id: string; updatedAt: number }[]>>;
  let n = 0;
  for (const store of ["characters", "personas", "chats"] as const) {
    for (const doc of data[store] ?? []) {
      if (doc && typeof doc.id === "string") {
        await idb.put(store, doc);
        void cloudPush(store, doc);
        n++;
      }
    }
  }
  return n;
}
