/**
 * Tiny promise wrapper around IndexedDB (no dependencies).
 * Falls back to an in-memory Map when IndexedDB is unavailable
 * (e.g. some private-browsing modes) so the app never hard-crashes.
 */
export type StoreName = "characters" | "personas" | "chats";
export const STORE_NAMES: StoreName[] = ["characters", "personas", "chats"];

const DB_NAME = "nightfall";
const DB_VERSION = 1;

const mem: Record<StoreName, Map<string, unknown>> = {
  characters: new Map(),
  personas: new Map(),
  chats: new Map(),
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") return resolve(null);
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const s of STORE_NAMES) {
            if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function wrap<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  if (!db) return [...mem[store].values()] as T[];
  return wrap(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return mem[store].get(id) as T | undefined;
  return wrap(db.transaction(store).objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  const db = await open();
  if (!db) {
    mem[store].set(value.id, value);
    return;
  }
  await wrap(db.transaction(store, "readwrite").objectStore(store).put(value));
}

export async function del(store: StoreName, id: string): Promise<void> {
  const db = await open();
  if (!db) {
    mem[store].delete(id);
    return;
  }
  await wrap(db.transaction(store, "readwrite").objectStore(store).delete(id));
}
