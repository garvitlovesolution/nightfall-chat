import { adaptMessages, json, OPENROUTER_URL, resolveKey, sanitizeModel, upstreamHeaders } from "@/lib/server/openrouter";

export const runtime = "edge";

const SIZES = { portrait: [768, 1024], scene: [1024, 768], avatar: [768, 768] } as const;

const SYSTEM = `You write prompts for a text-to-image model. Given a character and (optionally) the latest scene, reply with ONE line: a vivid visual prompt (max 60 words) describing appearance, clothing, setting, lighting, mood and art style (e.g. "anime illustration", "cinematic digital painting").
Rules: tasteful and safe for work, fully clothed, no nudity, no gore, no text or captions. Output only the prompt, nothing else.`;

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export async function POST(req: Request): Promise<Response> {
  let body: { kind?: unknown; character?: { name?: unknown; tagline?: unknown; personality?: unknown }; recent?: unknown; style?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const kind = body.kind === "portrait" || body.kind === "avatar" ? body.kind : "scene";
  const name = clean(body.character?.name, 80);
  if (!name) return json({ error: "Character name is required." }, 400);
  const tagline = clean(body.character?.tagline, 200);
  const personality = clean(body.character?.personality, 700);
  const recent = Array.isArray(body.recent) ? body.recent.slice(-3).map((t) => clean(t, 500)).filter(Boolean) : [];
  const style = clean(body.style, 60) || "digital illustration";

  // 1) Ask a free LLM to write a good visual prompt. If that fails we fall back to the raw character fields.
  let visual = "";
  const key = resolveKey(req);
  if (key) {
    try {
      const model = sanitizeModel(undefined);
      const messages = adaptMessages(model, [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Character: ${name}. ${tagline}\nPersonality/appearance notes: ${personality}\nImage type: ${kind}${kind === "scene" && recent.length ? `\nCurrent scene:\n${recent.join("\n")}` : ""}\nPreferred style: ${style}`,
        },
      ]);
      const r = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: upstreamHeaders(req, key),
        body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 160 }),
      });
      if (r.ok) {
        const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
        visual = clean(j.choices?.[0]?.message?.content, 500).replace(/^["'`]+|["'`]+$/g, "");
      }
    } catch {}
  }
  if (!visual) visual = `${name}, ${tagline}, ${personality.slice(0, 200)}, ${style}`;

  const prompt = `${visual}, ${style}, highly detailed, safe for work, tasteful, fully clothed`;
  const [w, h] = SIZES[kind];
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&safe=true`;
  return json({ url, prompt: visual });
}
