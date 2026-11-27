// Edge-safe helpers: only Web APIs (fetch, Request, Response) – no Node modules.
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// The key lives ONLY on the server. Any client-supplied key header is ignored.
export function resolveKey(_req: Request): string | null {
  return process.env.OPENROUTER_API_KEY || null;
}

export const FREE_DEFAULT = "nvidia/nemotron-3.5-lightning:free";

// Fallback order when a free endpoint is busy (429/5xx). Vision chain is used when images are attached.
const TEXT_CHAIN = [FREE_DEFAULT, "google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free"];
const VISION_CHAIN = ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3.5-super-vl:free"];

export function candidateModels(requested: string, msgs: Msg[], max = 3): string[] {
  const first = pickModel(requested, msgs);
  const chain = hasImages(msgs) ? VISION_CHAIN : TEXT_CHAIN;
  return [first, ...chain.filter((m) => m !== first)].slice(0, max);
}

/** Statuses worth retrying on another model. */
export const RETRY_STATUS = new Set([404, 408, 429, 500, 502, 503, 504]);

/** Only free models are allowed, so no request can ever spend credit. */
export function sanitizeModel(model: unknown): string {
  return typeof model === "string" && /^[\w.\-/]{3,100}:free$/.test(model) ? model : FREE_DEFAULT;
}

export type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type Content = string | Part[];
export interface Msg {
  role: string;
  content: Content;
}

const toParts = (c: Content): Part[] => (typeof c === "string" ? [{ type: "text", text: c }] : c);

export function hasImages(msgs: Msg[]): boolean {
  return msgs.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
}

/** Free models that can read images. Anything else is swapped for Gemma when an image is present. */
export function pickModel(model: string, msgs: Msg[]): string {
  return hasImages(msgs) && !/gemma-4|nemotron-3\.5-super-vl/i.test(model) ? "google/gemma-4-31b-it:free" : model;
}

/** Some free providers (Gemma) reject a system role, so fold it into the first user turn. */
export function adaptMessages(model: string, msgs: Msg[]): Msg[] {
  if (!/gemma/i.test(model)) return msgs;
  const text = (c: Content) => toParts(c).filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("\n");
  const sys = msgs.filter((m) => m.role === "system").map((m) => text(m.content)).join("\n\n");
  const rest = msgs.filter((m) => m.role !== "system");
  if (!sys) return rest;
  // Gemma needs the first turn to be "user", and our chats open with the character's greeting.
  if (rest[0]?.role === "assistant") return [{ role: "user", content: `[Instructions]\n${sys}\n\n[Begin the roleplay]` }, ...rest];
  return [{ role: "user", content: `[Instructions]\n${sys}` }, { role: "assistant", content: "Understood." }, ...rest];
}

export function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

const MAX_IMAGES = 4;
const MAX_IMAGE_CHARS = 2_500_000; // ~1.8MB binary as a base64 data URL

export function cleanMessages(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return null;
  const out: Msg[] = [];
  let images = 0;
  for (const m of raw) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "system" && role !== "user" && role !== "assistant") return null;
    if (typeof content === "string") {
      out.push({ role, content: content.slice(0, 60000) });
    } else if (Array.isArray(content) && role === "user") {
      const parts: Part[] = [];
      for (const p of content) {
        if (p && p.type === "text" && typeof p.text === "string") parts.push({ type: "text", text: p.text.slice(0, 60000) });
        else if (p && p.type === "image_url" && typeof p.image_url?.url === "string") {
          const url: string = p.image_url.url;
          if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(url) || url.length > MAX_IMAGE_CHARS) return null;
          if (++images > MAX_IMAGES) return null;
          parts.push({ type: "image_url", image_url: { url } });
        } else return null;
      }
      if (!parts.length) return null;
      out.push({ role, content: parts });
    } else return null;
  }
  return out;
}

export function upstreamHeaders(req: Request, key: string): HeadersInit {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": req.headers.get("origin") || new URL(req.url).origin,
    "X-Title": "Nightfall Chat",
  };
}

export async function upstreamError(res: Response): Promise<Response> {
  let message = `OpenRouter error (${res.status})`;
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    if (j.error) message = typeof j.error === "string" ? j.error : j.error.message || message;
  } catch {}
  if (res.status === 401) message = "The server's OpenRouter API key was rejected.";
  if (res.status === 402) message = "OpenRouter account has insufficient credits for this model.";
  return json({ error: message }, res.status);
}
