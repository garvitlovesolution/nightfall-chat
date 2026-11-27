import { adaptMessages, cleanMessages, json, num, OPENROUTER_URL, resolveKey, sanitizeModel, upstreamError, upstreamHeaders } from "./openrouter";

const SYSTEM = `You are an expert character designer for an AI roleplay chat platform.
Given a short idea, design a rich, original character. Reply with ONLY one JSON object (no markdown, no commentary) with exactly these keys:
{
 "name": string,
 "tagline": string (max 100 chars, a hook),
 "category": one of "Anime","Fantasy","Sci-Fi","Modern","Romance","Drama","Villain","Helper","Custom",
 "tags": array of 3-6 short lowercase strings,
 "personality": string (150-250 words: personality, speech style, mannerisms, quirks, motivations, secrets. Use {{user}} for the human),
 "scenario": string (2-4 sentences setting the scene),
 "greeting": string (the character's first message, 2-3 short paragraphs; actions/narration in *asterisks*, dialogue in "double quotes"; end with a hook; use {{user}} where relevant),
 "exampleDialogue": string (3 exchanges using lines that start with "{{user}}:" and "{{char}}:")
}
Keep content tasteful and non-explicit.`;

const CATS = ["Anime", "Fantasy", "Sci-Fi", "Modern", "Romance", "Drama", "Villain", "Helper", "Custom"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function handleGenerate(req: Request): Promise<Response> {
  let body: { idea?: unknown; model?: unknown; existing?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const idea = str(body.idea, 2000);
  if (!idea) return json({ error: "Describe your character idea first." }, 400);

  const key = resolveKey(req);
  if (!key) return json({ error: "Server is not configured: OPENROUTER_API_KEY is missing." }, 401);

  const existing = body.existing && typeof body.existing === "object" ? (body.existing as Record<string, unknown>) : {};
  const hint = Object.entries(existing)
    .map(([k, v]) => [k, str(v, 400)] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const messages = cleanMessages([
    { role: "system", content: SYSTEM },
    { role: "user", content: `Character idea: ${idea}${hint ? `\n\nKeep consistent with these existing details:\n${hint}` : ""}` },
  ])!;

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: upstreamHeaders(req, key),
    body: JSON.stringify({
      model: sanitizeModel(undefined),
      messages: adaptMessages(sanitizeModel(undefined), messages),
      temperature: num(0.9, 0, 2, 0.9),
      max_tokens: 2200,
    }),
  });
  if (!upstream.ok) return upstreamError(upstream);

  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = extractJson(data.choices?.[0]?.message?.content ?? "");
  if (!parsed) return json({ error: "The model did not return valid JSON. Try again or switch model." }, 502);

  const cat = str(parsed.category, 20);
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t) => str(t, 24).toLowerCase()).filter(Boolean).slice(0, 8) : [];
  return json({
    name: str(parsed.name, 80),
    tagline: str(parsed.tagline, 160),
    category: CATS.includes(cat) ? cat : "Custom",
    tags,
    personality: str(parsed.personality, 6000),
    scenario: str(parsed.scenario, 3000),
    greeting: str(parsed.greeting, 4000),
    exampleDialogue: str(parsed.exampleDialogue, 4000),
  });
}
