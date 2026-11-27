"use client";

import { Dices, ImagePlus, Loader2, Plus, Trash2, Upload, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as db from "@/lib/db";
import { CATEGORIES, type Category, type Character, type MediaItem } from "@/lib/types";
import { autoAvatar, fileToImageDataUrl, isVideoUrl, uid, urlToDataUrl } from "@/lib/util";
import { useApp } from "./AppProvider";
import { Avatar, Field, PageHeader } from "./ui";

const BLANK = {
  name: "", tagline: "", avatar: "", category: "Custom" as Category, tags: "",
  personality: "", scenario: "", greeting: "", exampleDialogue: "",
};

export function Creator({ editId }: { editId?: string }) {
  const { characters, go, reload, notify } = useApp();
  const [f, setF] = useState(BLANK);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [hue, setHue] = useState<number | undefined>();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [imgBusy, setImgBusy] = useState<"avatar" | "gallery" | null>(null);
  const avatarFile = useRef<HTMLInputElement>(null);
  const galleryFile = useRef<HTMLInputElement>(null);
  const editing = editId ? characters.find((c) => c.id === editId) : undefined;

  useEffect(() => {
    if (editing) {
      setF({
        name: editing.name, tagline: editing.tagline, avatar: editing.avatar, category: editing.category,
        tags: editing.tags.join(", "), personality: editing.personality, scenario: editing.scenario,
        greeting: editing.greeting, exampleDialogue: editing.exampleDialogue,
      });
      setMedia(editing.media ?? []);
    }
  }, [editing]);

  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) => setF((p) => ({ ...p, [k]: v }));

  const enhance = async () => {
    if (!idea.trim() && !f.name.trim()) return notify("Describe your idea in one sentence first.", "error");
    setBusy(true);
    try {
      const res = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim() || `${f.name}: ${f.tagline}`,
          existing: { name: f.name, tagline: f.tagline, personality: f.personality },
        }),
      });
      const j = (await res.json()) as Partial<Character> & { error?: string };
      if (!res.ok) throw new Error(j.error || "Generation failed");
      setF((p) => ({
        ...p,
        name: j.name || p.name,
        tagline: j.tagline || p.tagline,
        category: (CATEGORIES as readonly string[]).includes(j.category ?? "") ? (j.category as Category) : p.category,
        tags: j.tags?.length ? j.tags.join(", ") : p.tags,
        personality: j.personality || p.personality,
        scenario: j.scenario || p.scenario,
        greeting: j.greeting || p.greeting,
        exampleDialogue: j.exampleDialogue || p.exampleDialogue,
        avatar: p.avatar || (j.name ? autoAvatar(j.name) : ""),
      }));
      notify("Character enhanced ✨ Review and tweak anything.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Generation failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const generatePortrait = async (target: "avatar" | "gallery") => {
    if (!f.name.trim()) return notify("Give your character a name first.", "error");
    setImgBusy(target);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: target === "avatar" ? "avatar" : "portrait", character: { name: f.name, tagline: f.tagline, personality: f.personality } }),
      });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || "Image generation failed");
      let src = j.url;
      try { src = await urlToDataUrl(j.url, target === "avatar" ? 512 : 1024); } catch { /* keep remote URL */ }
      if (target === "avatar") set("avatar", src);
      else setMedia((m) => [...m, { id: uid(), type: "image", src }]);
      notify("Image generated ✨");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Image generation failed", "error");
    } finally {
      setImgBusy(null);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    try { set("avatar", await fileToImageDataUrl(file, 512)); } catch (e) { notify(e instanceof Error ? e.message : "Upload failed", "error"); }
  };

  const uploadGallery = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      if (!file.type.startsWith("image/")) {
        notify("Upload images here. For videos, paste a direct .mp4/.webm link below.", "error");
        continue;
      }
      try {
        const src = await fileToImageDataUrl(file);
        setMedia((m) => [...m, { id: uid(), type: "image", src }]);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Upload failed", "error");
      }
    }
    if (galleryFile.current) galleryFile.current.value = "";
  };

  const addMediaUrl = () => {
    const u = mediaUrl.trim();
    if (!/^https?:\/\//i.test(u)) return notify("Paste a full http(s) link to an image or video.", "error");
    setMedia((m) => [...m, { id: uid(), type: isVideoUrl(u) ? "video" : "image", src: u }]);
    setMediaUrl("");
  };

  const save = async () => {
    if (!f.name.trim() || !f.personality.trim() || !f.greeting.trim()) {
      return notify("Name, personality and first message are required.", "error");
    }
    const now = Date.now();
    const char: Character = {
      id: editing?.id ?? uid(),
      name: f.name.trim(),
      tagline: f.tagline.trim(),
      avatar: f.avatar.trim() || autoAvatar(f.name.trim(), hue),
      category: f.category,
      tags: f.tags.split(",").map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean).slice(0, 10),
      personality: f.personality.trim(),
      scenario: f.scenario.trim(),
      greeting: f.greeting.trim(),
      exampleDialogue: f.exampleDialogue.trim(),
      media,
      builtin: editing?.builtin,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.saveCharacter(char);
    await reload();
    notify(editing ? "Character updated" : "Character created 🎉");
    go("");
  };

  const previewSrc = f.avatar.trim() || autoAvatar(f.name || "?", hue);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <PageHeader title={editing ? `Edit ${editing.name}` : "Create Character"} subtitle="Design a personality, a world and a first impression." />

      <section className="mb-6 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-pink-950/20 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <Wand2 size={16} className="text-neon-pink" /> Magic Enhance with AI
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. a grumpy dragon who runs a bakery and secretly writes poetry"
            onKeyDown={(e) => e.key === "Enter" && !busy && enhance()}
          />
          <button onClick={enhance} disabled={busy} className="btn-primary shrink-0">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {busy ? "Conjuring…" : "Enhance"}
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Expands one sentence into a full personality, scenario, greeting and example dialogue.</p>
      </section>

      <div className="grid gap-5 md:grid-cols-[200px_1fr]">
        <div>
          <Avatar src={previewSrc} name={f.name || "?"} className="aspect-square w-full rounded-2xl border border-line" />
          <button
            onClick={() => { const h = Math.floor(Math.random() * 360); setHue(h); set("avatar", autoAvatar(f.name || "?", h)); }}
            className="btn-ghost mt-3 w-full !text-xs"
          >
            <Dices size={14} /> Auto-generate avatar
          </button>
          <button onClick={() => void generatePortrait("avatar")} disabled={!!imgBusy} className="btn-ghost mt-2 w-full !text-xs">
            {imgBusy === "avatar" ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} AI portrait
          </button>
          <button onClick={() => avatarFile.current?.click()} className="btn-ghost mt-2 w-full !text-xs"><Upload size={14} /> Upload photo</button>
          <input ref={avatarFile} type="file" accept="image/*" hidden onChange={(e) => { void uploadAvatar(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={80} /></Field>
            <Field label="Category">
              <select className="input" value={f.category} onChange={(e) => set("category", e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Tagline"><input className="input" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={160} placeholder="A one-line hook shown on the card" /></Field>
          <Field label="Avatar URL" hint="Paste an image or .mp4/.webm video link (videos autoplay muted as an animated avatar), or use the buttons on the left.">
            <input className="input" value={f.avatar.startsWith("data:") ? "" : f.avatar} onChange={(e) => set("avatar", e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Tags" hint="Comma-separated, e.g. tsundere, school, comedy">
            <input className="input" value={f.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <Field label="Personality / System Prompt *" hint="Who they are, how they speak, quirks, motivations. Use {{user}} and {{char}}.">
          <textarea className="input min-h-[160px]" value={f.personality} onChange={(e) => set("personality", e.target.value)} />
        </Field>
        <Field label="Scenario / World Setting"><textarea className="input min-h-[90px]" value={f.scenario} onChange={(e) => set("scenario", e.target.value)} /></Field>
        <Field label="First Message (Greeting) *" hint='Use *asterisks* for actions and "quotes" for speech.'>
          <textarea className="input min-h-[130px]" value={f.greeting} onChange={(e) => set("greeting", e.target.value)} />
        </Field>
        <Field label="Example Dialogue" hint="Format each line as {{user}}: … and {{char}}: …">
          <textarea className="input min-h-[120px] font-mono text-xs" value={f.exampleDialogue} onChange={(e) => set("exampleDialogue", e.target.value)} placeholder={'{{user}}: Hello!\n{{char}}: *waves* "Well, hello there."'} />
        </Field>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-card p-4">
        <h3 className="text-sm font-semibold text-white">Gallery: photos &amp; videos</h3>
        <p className="mt-1 text-xs text-zinc-500">Shown on the character&apos;s profile. Upload photos, generate AI pictures, or paste direct links to images / .mp4 / .webm videos.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {media.map((m) => (
            <div key={m.id} className="group relative aspect-square overflow-hidden rounded-xl bg-card2">
              {m.type === "video" ? <video src={m.src} muted loop playsInline autoPlay className="h-full w-full object-cover" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.src} alt="" className="h-full w-full object-cover" />}
              <button onClick={() => setMedia((x) => x.filter((y) => y.id !== m.id))} aria-label="Remove media" className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100"><Trash2 size={13} /></button>
              {m.type === "video" && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] text-white">VIDEO</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => galleryFile.current?.click()} className="btn-ghost !text-xs"><Upload size={14} /> Upload photos</button>
          <input ref={galleryFile} type="file" accept="image/*" multiple hidden onChange={(e) => void uploadGallery(e.target.files)} />
          <button onClick={() => void generatePortrait("gallery")} disabled={!!imgBusy} className="btn-ghost !text-xs">
            {imgBusy === "gallery" ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} Generate AI picture
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <input className="input" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMediaUrl()} placeholder="https://…/clip.mp4 or image link" />
          <button onClick={addMediaUrl} className="btn-ghost shrink-0 !px-3" aria-label="Add link"><Plus size={16} /></button>
        </div>
      </section>

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={() => go("")} className="btn-ghost">Cancel</button>
        <button onClick={save} className="btn-primary">{editing ? "Save changes" : "Create character"}</button>
      </div>
    </div>
  );
}
