export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic gradient avatar (SVG data URI) – no network needed. */
export function autoAvatar(name: string, hueOverride?: number): string {
  const h = hash(name || "?");
  const h1 = hueOverride ?? h % 360;
  const h2 = (h1 + 50 + (h % 70)) % 360;
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const cx = 60 + (h % 140);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 80% 45%)"/><stop offset="1" stop-color="hsl(${h2} 85% 25%)"/></linearGradient><radialGradient id="r" cx="${cx / 256}" cy="0.25" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="256" height="256" fill="url(#g)"/><rect width="256" height="256" fill="url(#r)"/><circle cx="${(h >> 3) % 256}" cy="${(h >> 7) % 256}" r="70" fill="#fff" fill-opacity=".06"/><circle cx="${(h >> 5) % 256}" cy="${(h >> 11) % 256}" r="40" fill="#000" fill-opacity=".12"/><text x="128" y="150" text-anchor="middle" font-family="Georgia,serif" font-size="96" font-weight="700" fill="#fff" fill-opacity=".92">${initials.replace(/[<&>]/g, "")}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function cssUrl(src: string): string {
  return `url("${src.replace(/"/g, "%22")}")`;
}

export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export function isVideoUrl(u: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u) || u.startsWith("data:video/");
}

/** Read an image file, downscale (max side px) and re-encode as JPEG data URL. */
export function fileToImageDataUrl(file: File, maxSide = 1024, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

/** Download a remote image and shrink it into a data URL so it survives link expiry. */
export async function urlToDataUrl(src: string, maxSide = 1024): Promise<string> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Image request failed (${res.status})`);
  const blob = await res.blob();
  return fileToImageDataUrl(new File([blob], "img", { type: blob.type || "image/jpeg" }), maxSide);
}
