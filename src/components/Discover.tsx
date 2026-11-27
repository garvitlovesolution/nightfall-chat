"use client";

import { ImagePlus, Loader2, MessageCircle, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import * as db from "@/lib/db";
import { CATEGORIES, type Character } from "@/lib/types";
import { uid, urlToDataUrl } from "@/lib/util";
import { useApp } from "./AppProvider";
import { Avatar, Modal, PageHeader } from "./ui";

function Profile({ c, onClose }: { c: Character; onClose: () => void }) {
  const { openCharacter, reload, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const media = c.media ?? [];

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "portrait", character: { name: c.name, tagline: c.tagline, personality: c.personality } }),
      });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || "Image generation failed");
      let src = j.url;
      try { src = await urlToDataUrl(j.url); } catch { /* keep remote URL */ }
      await db.saveCharacter({ ...c, media: [...media, { id: uid(), type: "image", src }] });
      await reload();
      notify("Added to gallery ✨");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Image generation failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const live = view ? media.find((m) => m.id === view) : null;
  return (
    <Modal title={c.name} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-[260px_1fr]">
        <div>
          <Avatar src={c.avatar} name={c.name} className="aspect-[3/4] w-full rounded-2xl border border-line" />
          <button onClick={() => { onClose(); void openCharacter(c.id); }} className="btn-primary mt-3 w-full"><MessageCircle size={16} /> Start chat</button>
        </div>
        <div className="min-w-0 space-y-4">
          <div>
            <span className="rounded-full bg-card2 px-2.5 py-0.5 text-xs text-zinc-300">{c.category}</span>
            <p className="mt-2 text-sm text-zinc-300">{c.tagline}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{c.tags.map((t) => <span key={t} className="rounded-md bg-card2 px-2 py-0.5 text-[11px] text-zinc-400">#{t}</span>)}</div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="label !mb-0">Gallery · {media.length}</h3>
              <button onClick={generate} disabled={busy} className="btn-ghost !px-3 !py-1.5 !text-xs">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Generate AI photo
              </button>
            </div>
            {media.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-zinc-500">No photos or videos yet. Generate one, or add your own via Edit.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {media.map((m) => (
                  <button key={m.id} onClick={() => setView(m.id)} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-card2">
                    {m.type === "video"
                      ? <video src={m.src} muted loop playsInline autoPlay className="h-full w-full object-cover" />
                      : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.src} alt="" className="h-full w-full object-cover transition hover:scale-105" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {live && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4" onClick={() => setView(null)}>
          {live.type === "video"
            ? <video src={live.src} controls autoPlay loop playsInline className="max-h-full max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
            : /* eslint-disable-next-line @next/next/no-img-element */ <img src={live.src} alt="" className="max-h-full max-w-full rounded-xl" />}
        </div>
      )}
    </Modal>
  );
}

function Card({ c, onOpen }: { c: Character; onOpen: () => void }) {
  const { openCharacter, go, reload, notify } = useApp();
  const remove = async () => {
    if (!confirm(`Delete ${c.name}? Existing chats with them will stay in your history.`)) return;
    await db.deleteCharacter(c.id);
    await reload();
    notify(`${c.name} deleted`);
  };
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition hover:-translate-y-0.5 hover:border-violet-500/50 hover:shadow-glow">
      <button onClick={onOpen} aria-label={`View ${c.name}`} className="relative block aspect-[4/3] w-full overflow-hidden text-left">
        <Avatar src={c.avatar} name={c.name} className="h-full w-full transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-medium text-zinc-200 backdrop-blur">{c.category}</span>
        {!!c.media?.length && <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-zinc-200 backdrop-blur">📷 {c.media.length}</span>}
      </button>
      <div className="flex flex-1 flex-col p-4 pt-2">
        <h3 className="truncate text-lg font-semibold text-white">{c.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-zinc-400">{c.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded-md bg-card2 px-2 py-0.5 text-[11px] text-zinc-400">#{t}</span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => openCharacter(c.id)} className="btn-primary flex-1 !py-2">
            <MessageCircle size={16} /> Chat
          </button>
          <button onClick={() => go(`create/${c.id}`)} aria-label={`Edit ${c.name}`} className="btn-ghost !px-3 !py-2">
            <Pencil size={15} />
          </button>
          <button onClick={remove} aria-label={`Delete ${c.name}`} className="btn-ghost !px-3 !py-2 hover:!text-red-300">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Discover() {
  const { characters, go } = useApp();
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const profile = characters.find((c) => c.id === openId) ?? null;

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    characters.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t]) => t);
  }, [characters]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return characters.filter((c) => {
      if (cat !== "All" && c.category !== cat) return false;
      if (tag && !c.tags.includes(tag)) return false;
      if (!needle) return true;
      return [c.name, c.tagline, c.category, ...c.tags].some((s) => s.toLowerCase().includes(needle));
    });
  }, [characters, cat, tag, q]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <PageHeader
        title="Discover"
        subtitle="Pick a character and step into the story."
        right={<button onClick={() => go("create")} className="btn-primary">Create character</button>}
      />

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input className="input !pl-9" placeholder="Search characters, tags, vibes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search characters" />
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`pill shrink-0 ${cat === c ? "pill-active" : ""}`}>{c}</button>
        ))}
      </div>
      {topTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`rounded-md px-2 py-0.5 text-xs transition ${tag === t ? "bg-violet-600 text-white" : "bg-card2 text-zinc-400 hover:text-white"}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="mt-16 text-center text-zinc-500">
          <p>No characters match your filters.</p>
          <button onClick={() => { setCat("All"); setTag(null); setQ(""); }} className="btn-ghost mt-4">Clear filters</button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((c) => <Card key={c.id} c={c} onOpen={() => setOpenId(c.id)} />)}
        </div>
      )}
      {profile && <Profile c={profile} onClose={() => setOpenId(null)} />}
    </div>
  );
}
