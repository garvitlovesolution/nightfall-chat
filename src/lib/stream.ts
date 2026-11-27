export interface StreamOptions {
  messages: { role: string; content: unknown }[];
  model: string;
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

/** POST to /api/chat and parse the OpenAI-style SSE stream into text deltas. */
export async function streamChat(opts: StreamOptions): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    signal: opts.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: opts.messages,
      model: opts.model,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }),
  });

  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const handleLine = (line: string): boolean => {
    const l = line.trim();
    if (!l.startsWith("data:")) return false; // comments / keep-alives
    const payload = l.slice(5).trim();
    if (payload === "[DONE]") return true;
    try {
      const json = JSON.parse(payload) as {
        error?: { message?: string } | string;
        choices?: { delta?: { content?: string }; text?: string }[];
      };
      if (json.error) {
        throw new Error(typeof json.error === "string" ? json.error : json.error.message || "Model error");
      }
      const piece = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.text;
      if (piece) opts.onDelta(piece);
    } catch (e) {
      if (e instanceof SyntaxError) return false;
      throw e;
    }
    return false;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (handleLine(line)) return;
    }
  }
  if (buf) handleLine(buf);
}
