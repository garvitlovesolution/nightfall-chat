import {
  cleanMessages,
  json,
  num,
  OPENROUTER_URL,
  resolveKey,
  sanitizeModel,
  upstreamError,
  upstreamHeaders,
} from "@/lib/server/openrouter";

export const runtime = "edge";

export async function POST(req: Request): Promise<Response> {
  let body: { messages?: unknown; model?: unknown; temperature?: unknown; max_tokens?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const messages = cleanMessages(body.messages);
  if (!messages) return json({ error: "`messages` must be a non-empty array of {role, content}" }, 400);

  const key = resolveKey(req);
  if (!key) {
    return json({ error: "No OpenRouter API key. Add yours in Settings, or set OPENROUTER_API_KEY on the server." }, 401);
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: upstreamHeaders(req, key),
      signal: req.signal, // aborting in the browser cancels the upstream generation
      body: JSON.stringify({
        model: sanitizeModel(body.model, "mistralai/mistral-nemo"),
        messages,
        temperature: num(body.temperature, 0, 2, 0.9),
        max_tokens: Math.round(num(body.max_tokens, 16, 8192, 700)),
        stream: true,
      }),
    });
  } catch {
    return json({ error: "Could not reach OpenRouter." }, 502);
  }

  if (!upstream.ok || !upstream.body) return upstreamError(upstream);

  // Pipe the upstream SSE stream straight through to the browser.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
