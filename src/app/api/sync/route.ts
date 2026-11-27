import { getRequestContext } from "@cloudflare/next-on-pages";
import { json } from "@/lib/server/openrouter";

export const runtime = "edge";

// Minimal structural types so we don't need @cloudflare/workers-types.
interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
interface D1 {
  prepare(q: string): D1Stmt;
}
interface KV {
  get(k: string): Promise<string | null>;
  put(k: string, v: string): Promise<void>;
  delete(k: string): Promise<void>;
  list(o: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}
interface Bindings {
  DB?: D1;
  KV?: KV;
}

const STORES = new Set(["characters", "personas", "chats"]);
const MAX_DOC = 1_500_000;

function bindings(): Bindings {
  try {
    return getRequestContext().env as unknown as Bindings;
  } catch {
    return {};
  }
}

function owner(req: Request): string | null {
  const k = req.headers.get("x-sync-key") ?? "";
  return /^[A-Za-z0-9_-]{24,128}$/.test(k) ? k : null;
}

const noStorage = () =>
  json({ error: "No D1 (binding `DB`) or KV (binding `KV`) is configured. See README → Optional cloud sync." }, 501);

export async function GET(req: Request) {
  const o = owner(req);
  if (!o) return json({ error: "Missing or invalid x-sync-key" }, 401);
  const { DB, KV } = bindings();

  if (DB) {
    const r = await DB.prepare("SELECT store, id, data, updated_at AS updatedAt FROM docs WHERE owner = ?").bind(o).all();
    return json({ docs: r.results });
  }
  if (KV) {
    const docs: unknown[] = [];
    let cursor: string | undefined;
    do {
      const page = await KV.list({ prefix: `${o}:`, cursor });
      for (const k of page.keys) {
        const raw = await KV.get(k.name);
        if (raw) docs.push(JSON.parse(raw));
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return json({ docs });
  }
  return noStorage();
}

export async function PUT(req: Request) {
  const o = owner(req);
  if (!o) return json({ error: "Missing or invalid x-sync-key" }, 401);
  const { DB, KV } = bindings();

  const b = (await req.json().catch(() => null)) as { store?: string; id?: string; updatedAt?: number; data?: string } | null;
  if (!b || !b.store || !STORES.has(b.store) || typeof b.id !== "string" || typeof b.data !== "string" || b.data.length > MAX_DOC) {
    return json({ error: "Invalid payload" }, 400);
  }
  const updatedAt = typeof b.updatedAt === "number" ? b.updatedAt : Date.now();

  if (DB) {
    await DB.prepare(
      "INSERT INTO docs (owner, store, id, data, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(owner, store, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    )
      .bind(o, b.store, b.id, b.data, updatedAt)
      .run();
    return json({ ok: true });
  }
  if (KV) {
    await KV.put(`${o}:${b.store}:${b.id}`, JSON.stringify({ store: b.store, id: b.id, data: b.data, updatedAt }));
    return json({ ok: true });
  }
  return noStorage();
}

export async function DELETE(req: Request) {
  const o = owner(req);
  if (!o) return json({ error: "Missing or invalid x-sync-key" }, 401);
  const { DB, KV } = bindings();
  const url = new URL(req.url);
  const store = url.searchParams.get("store") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!STORES.has(store) || !id) return json({ error: "Invalid params" }, 400);

  if (DB) {
    await DB.prepare("DELETE FROM docs WHERE owner = ? AND store = ? AND id = ?").bind(o, store, id).run();
    return json({ ok: true });
  }
  if (KV) {
    await KV.delete(`${o}:${store}:${id}`);
    return json({ ok: true });
  }
  return noStorage();
}
