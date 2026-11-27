// Edge-safe helpers: only Web APIs (fetch, Request, Response) – no Node modules.
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function resolveKey(req: Request): string | null {
  const user = req.headers.get("x-openrouter-key")?.trim();
  return user || process.env.OPENROUTER_API_KEY || null;
}

export function sanitizeModel(model: unknown, fallback: string): string {
  return typeof model === "string" && /^[\w.\-:/]{3,100}$/.test(model) ? model : fallback;
}

export function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

export function cleanMessages(raw: unknown): { role: string; content: string }[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) return null;
  const out: { role: string; content: string }[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "system" && role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    out.push({ role, content: content.slice(0, 60000) });
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
  if (res.status === 401) message = "OpenRouter rejected the API key. Check it in Settings.";
  if (res.status === 402) message = "OpenRouter account has insufficient credits for this model.";
  return json({ error: message }, res.status);
}
