"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { getMediaBlob } from "@/lib/db";
import type { Attachment } from "@/lib/types";
import { autoAvatar, isVideoUrl } from "@/lib/util";

export function Avatar({ src, name, className = "" }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const resolved = !src || failed ? autoAvatar(name) : src;
  if (!failed && src && isVideoUrl(src)) {
    return <video src={src} autoPlay loop muted playsInline onError={() => setFailed(true)} className={`object-cover ${className}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={name} onError={() => setFailed(true)} className={`object-cover ${className}`} draggable={false} />;
}

/** Renders a chat attachment (image / video, local or remote). */
export function AttachmentView({ a, className = "" }: { a: Attachment; className?: string }) {
  const [url, setUrl] = useState<string | null>(a.src ?? null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (a.src || !a.mediaId) return;
    let obj: string | null = null;
    let alive = true;
    getMediaBlob(a.mediaId).then((b) => {
      if (!alive) return;
      if (b) { obj = URL.createObjectURL(b); setUrl(obj); } else setBroken(true);
    });
    return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
  }, [a.src, a.mediaId]);

  if (broken) return <div className="rounded-xl border border-line bg-card2 px-3 py-6 text-center text-xs text-zinc-500">Media unavailable</div>;
  if (!url) return <div className={`animate-pulse rounded-xl bg-card2 ${className}`} style={{ minHeight: 120 }} />;
  if (a.type === "video") return <video src={url} controls playsInline preload="metadata" className={`rounded-xl bg-black ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="attachment" onError={() => setBroken(true)} className={`rounded-xl ${className}`} /></a>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full animate-fadein flex-col rounded-t-2xl border border-line bg-card shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-4xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-zinc-400 hover:bg-card2 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="bg-gradient-to-r from-white to-neon-pink bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
