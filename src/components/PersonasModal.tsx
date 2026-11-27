"use client";

import { Check, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as db from "@/lib/db";
import type { Persona } from "@/lib/types";
import { uid } from "@/lib/util";
import { useApp } from "./AppProvider";
import { Field, Modal } from "./ui";

export function PersonasModal({ onClose }: { onClose: () => void }) {
  const { personas, reload, settings, updateSettings, notify } = useApp();
  const [selId, setSelId] = useState<string | null>(personas[0]?.id ?? null);
  const [draft, setDraft] = useState<Persona | null>(personas[0] ?? null);

  useEffect(() => {
    setDraft(personas.find((p) => p.id === selId) ?? null);
  }, [selId, personas]);

  const create = async () => {
    const now = Date.now();
    const p = await db.savePersona({ id: uid(), name: "New Persona", appearance: "", backstory: "", createdAt: now, updatedAt: now });
    await reload();
    setSelId(p.id);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return notify("Persona needs a name.", "error");
    await db.savePersona({ ...draft, name: draft.name.trim() });
    await reload();
    notify("Persona saved");
  };

  const remove = async () => {
    if (!draft || !confirm(`Delete persona "${draft.name}"?`)) return;
    await db.deletePersona(draft.id);
    if (settings.defaultPersonaId === draft.id) updateSettings({ defaultPersonaId: null });
    await reload();
    setSelId(null);
  };

  return (
    <Modal title="My Personas" onClose={onClose} wide>
      <p className="mb-4 text-sm text-zinc-400">Personas describe <em>you</em> in the story. Pick one per conversation from the chat header.</p>
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div className="space-y-1.5">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelId(p.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                selId === p.id ? "border-violet-500 bg-violet-600/15 text-white" : "border-line bg-card2 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              <span className="truncate">{p.name}</span>
              {settings.defaultPersonaId === p.id && <Star size={14} className="shrink-0 fill-yellow-400 text-yellow-400" />}
            </button>
          ))}
          <button onClick={create} className="btn-ghost w-full !text-xs"><Plus size={14} /> New persona</button>
        </div>

        {draft ? (
          <div className="space-y-4">
            <Field label="Name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} /></Field>
            <Field label="Appearance"><textarea className="input min-h-[80px]" value={draft.appearance} onChange={(e) => setDraft({ ...draft, appearance: e.target.value })} placeholder="Tall, silver hair, a scar over the left eyebrow…" /></Field>
            <Field label="Backstory"><textarea className="input min-h-[110px]" value={draft.backstory} onChange={(e) => setDraft({ ...draft, backstory: e.target.value })} placeholder="A former courier who…" /></Field>
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={remove} className="btn-danger"><Trash2 size={15} /> Delete</button>
                <button
                  onClick={() => updateSettings({ defaultPersonaId: settings.defaultPersonaId === draft.id ? null : draft.id })}
                  className="btn-ghost"
                >
                  <Star size={15} /> {settings.defaultPersonaId === draft.id ? "Default for new chats" : "Set as default"}
                </button>
              </div>
              <button onClick={save} className="btn-primary"><Check size={15} /> Save</button>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-line p-10 text-sm text-zinc-500">Create a persona to get started.</div>
        )}
      </div>
    </Modal>
  );
}
