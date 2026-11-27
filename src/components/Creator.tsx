"use client";

import { Dices, Loader2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as db from "@/lib/db";
import { CATEGORIES, type Category, type Character } from "@/lib/types";
import { autoAvatar, uid } from "@/lib/util";
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
  const editing = editId ? characters.find((c) => c.id === editId) : undefined;

  useEffect(() => {
    if (editing) {
      setF({
        name: editing.name, tagline: editing.tagline, avatar: editing.avatar, category: editing.category,
        tags: editing.tags.join(", "), personality: editing.personality, scenario: editing.scenario,
        greeting: editing.greeting, exampleDialogue: editing.exampleDialogue,
      });
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
          <Field label="Avatar URL" hint="Paste an image link, or use auto-generate. Falls back to a generated avatar if the image fails to load.">
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

      <div className="mt-6 flex justify-end gap-2">
        <button onClick={() => go("")} className="btn-ghost">Cancel</button>
        <button onClick={save} className="btn-primary">{editing ? "Save changes" : "Create character"}</button>
      </div>
    </div>
  );
}
