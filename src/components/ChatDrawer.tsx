"use client";

import { BookOpen, Brain, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DEFAULT_DIRECTIVE } from "@/lib/models";
import { triggeredLore } from "@/lib/prompt";
import type { Chat, LoreEntry } from "@/lib/types";
import { uid } from "@/lib/util";

export type DrawerTab = "memory" | "lore" | "params";

function KeywordInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <input
      className="input"
      value={text}
      placeholder="keywords, comma, separated"
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(",").map((k) => k.trim()).filter(Boolean));
      }}
    />
  );
}

export function ChatDrawer({
  chat,
  tab,
  setTab,
  update,
  onClose,
}: {
  chat: Chat;
  tab: DrawerTab;
  setTab: (t: DrawerTab) => void;
  update: (fn: (c: Chat) => Chat) => void;
  onClose: () => void;
}) {
  const [newMemory, setNewMemory] = useState("");
  const active = new Set(triggeredLore(chat).map((e) => e.id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const addMemory = () => {
    const text = newMemory.trim();
    if (!text) return;
    update((c) => ({ ...c, memories: [...c.memories, { id: uid(), text, enabled: true }] }));
    setNewMemory("");
  };

  const patchLore = (id: string, patch: Partial<LoreEntry>) =>
    update((c) => ({ ...c, lorebook: c.lorebook.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { id: "memory", label: "Memory", icon: <Brain size={15} /> },
    { id: "lore", label: "Lorebook", icon: <BookOpen size={15} /> },
    { id: "params", label: "Parameters", icon: <SlidersHorizontal size={15} /> },
  ];

  return (
    <div className="fixed inset-0 z-40" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <aside
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slidein flex-col border-l border-line bg-[#0f0f12] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${tab === t.id ? "bg-violet-600/25 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} aria-label="Close drawer" className="rounded-lg p-1 text-zinc-400 hover:bg-card hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {tab === "memory" && (
            <>
              <p className="text-xs text-zinc-400">Pinned facts are injected into every reply, so the character never forgets them.</p>
              <div className="flex gap-2">
                <input className="input" value={newMemory} onChange={(e) => setNewMemory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMemory()} placeholder='e.g. {{user}} is allergic to cats' />
                <button onClick={addMemory} className="btn-primary !px-3" aria-label="Add memory"><Plus size={16} /></button>
              </div>
              {chat.memories.length === 0 && <p className="py-6 text-center text-sm text-zinc-600">No pinned memories yet.</p>}
              {chat.memories.map((m) => (
                <div key={m.id} className="flex items-start gap-2 rounded-xl border border-line bg-card p-3">
                  <input type="checkbox" checked={m.enabled} aria-label="Enabled" className="mt-1 accent-violet-500"
                    onChange={(e) => update((c) => ({ ...c, memories: c.memories.map((x) => (x.id === m.id ? { ...x, enabled: e.target.checked } : x)) }))} />
                  <textarea
                    className="min-h-[40px] flex-1 resize-y bg-transparent text-sm text-zinc-200 outline-none"
                    value={m.text}
                    onChange={(e) => update((c) => ({ ...c, memories: c.memories.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)) }))}
                  />
                  <button aria-label="Delete memory" onClick={() => update((c) => ({ ...c, memories: c.memories.filter((x) => x.id !== m.id) }))} className="text-zinc-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              ))}
            </>
          )}

          {tab === "lore" && (
            <>
              <p className="text-xs text-zinc-400">World info is injected only when one of its keywords appears in the last 6 messages.</p>
              <button
                onClick={() => update((c) => ({ ...c, lorebook: [...c.lorebook, { id: uid(), keywords: [], content: "", enabled: true }] }))}
                className="btn-ghost w-full"
              >
                <Plus size={15} /> Add entry
              </button>
              {chat.lorebook.length === 0 && <p className="py-6 text-center text-sm text-zinc-600">No lorebook entries yet.</p>}
              {chat.lorebook.map((e) => (
                <div key={e.id} className={`space-y-2 rounded-xl border bg-card p-3 ${active.has(e.id) ? "border-violet-500/70 shadow-glow" : "border-line"}`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                      <input type="checkbox" checked={e.enabled} onChange={(ev) => patchLore(e.id, { enabled: ev.target.checked })} className="accent-violet-500" /> Enabled
                      {active.has(e.id) && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">ACTIVE NOW</span>}
                    </label>
                    <button aria-label="Delete entry" onClick={() => update((c) => ({ ...c, lorebook: c.lorebook.filter((x) => x.id !== e.id) }))} className="text-zinc-500 hover:text-red-400"><Trash2 size={15} /></button>
                  </div>
                  <KeywordInput value={e.keywords} onChange={(k) => patchLore(e.id, { keywords: k })} />
                  <textarea className="input min-h-[80px]" placeholder="What the character should know when these words come up…" value={e.content} onChange={(ev) => patchLore(e.id, { content: ev.target.value })} />
                </div>
              ))}
            </>
          )}

          {tab === "params" && (
            <>
              <div>
                <label className="label">Temperature — {chat.params.temperature.toFixed(2)}</label>
                <input type="range" min={0} max={2} step={0.05} value={chat.params.temperature} className="w-full accent-violet-500"
                  onChange={(e) => update((c) => ({ ...c, params: { ...c.params, temperature: +e.target.value } }))} />
                <div className="flex justify-between text-[11px] text-zinc-500"><span>Focused</span><span>Creative</span></div>
              </div>
              <div>
                <label className="label">Max tokens — {chat.params.maxTokens}</label>
                <input type="range" min={64} max={4096} step={32} value={chat.params.maxTokens} className="w-full accent-violet-500"
                  onChange={(e) => update((c) => ({ ...c, params: { ...c.params, maxTokens: +e.target.value } }))} />
                <div className="flex justify-between text-[11px] text-zinc-500"><span>Short replies</span><span>Long replies</span></div>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-line bg-card p-3 text-sm">
                Blurred avatar background
                <input type="checkbox" checked={chat.params.background} className="h-4 w-4 accent-violet-500"
                  onChange={(e) => update((c) => ({ ...c, params: { ...c.params, background: e.target.checked } }))} />
              </label>
              <div>
                <label className="label">Roleplay directive (system)</label>
                <textarea className="input min-h-[220px] text-xs" value={chat.params.directive}
                  onChange={(e) => update((c) => ({ ...c, params: { ...c.params, directive: e.target.value } }))} />
                <button onClick={() => update((c) => ({ ...c, params: { ...c.params, directive: DEFAULT_DIRECTIVE } }))} className="mt-1 text-xs text-violet-400 hover:underline">Reset to default</button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
