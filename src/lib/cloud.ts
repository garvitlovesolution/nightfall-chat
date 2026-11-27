/**
 * Optional Cloudflare D1 / KV sync adapter (client side).
 * Disabled unless NEXT_PUBLIC_STORAGE_MODE=cloud. IndexedDB stays the source of
 * truth for reads; writes are mirrored to /api/sync and pulled on startup.
 */
import type { StoreName } from "./idb";
import { uid } from "./util";

export const CLOUD_ENABLED = process.env.NEXT_PUBLIC_STORAGE_MODE === "cloud";
const KEY = "nightfall.syncKey";

export function getSyncKey(): string {
  try {
    let k = localStorage.getItem(KEY);
    if (!k) {
      k = (uid() + uid()).replace(/-/g, "");
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return "";
  }
}

export function setSyncKey(k: string) {
  try {
    localStorage.setItem(KEY, k.trim());
  } catch {}
}

function headers(): HeadersInit {
  return { "Content-Type": "application/json", "x-sync-key": getSyncKey() };
}

export async function cloudPush(store: StoreName, doc: { id: string; updatedAt?: number }): Promise<void> {
  if (!CLOUD_ENABLED) return;
  try {
    await fetch("/api/sync", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ store, id: doc.id, updatedAt: doc.updatedAt ?? Date.now(), data: JSON.stringify(doc) }),
    });
  } catch {}
}

export async function cloudRemove(store: StoreName, id: string): Promise<void> {
  if (!CLOUD_ENABLED) return;
  try {
    await fetch(`/api/sync?store=${store}&id=${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
  } catch {}
}

export interface CloudDoc {
  store: StoreName;
  id: string;
  updatedAt: number;
  data: string;
}

export async function cloudPull(): Promise<CloudDoc[]> {
  if (!CLOUD_ENABLED) return [];
  try {
    const res = await fetch("/api/sync", { headers: headers() });
    if (!res.ok) return [];
    const json = (await res.json()) as { docs?: CloudDoc[] };
    return json.docs ?? [];
  } catch {
    return [];
  }
}
