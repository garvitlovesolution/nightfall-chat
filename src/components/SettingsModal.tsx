"use client";

import { Copy, Download, Eye, EyeOff, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { CLOUD_ENABLED, getSyncKey, setSyncKey } from "@/lib/cloud";
import * as db from "@/lib/db";
import { DEFAULT_DIRECTIVE, MODELS } from "@/lib/models";
import { useApp } from "./AppProvider";
import { Field, Modal } from "./ui";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, reload, notify } = useApp();
  const [show, setShow] = useState(false);
  const [syncKey, setKey] = useState(CLOUD_ENABLED ? getSyncKey() : "");
  const fileRef = useRef<HTMLInputElement>(null);
  const preset = MODELS.some((m) => m.id === settings.defaultModel);

  const exportData = async () => {
    const blob = new Blob([await db.exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nightfall-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const n = await db.importAll(await file.text());
      await reload();
      notify(`Imported ${n} items`);
    } catch {
      notify("That file is not a valid Nightfall backup.", "error");
    }
  };

  return (
    <Modal title="API / Model Settings" onClose={onClose}>
      <div className="space-y-5">
        <Field label="OpenRouter API key" hint="Stored only in this browser and sent per-request to your Edge function. Leave empty to use the server's OPENROUTER_API_KEY.">
          <div className="flex gap-2">
            <input
              className="input"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-v1-…"
              value={settings.apiKey}
              onChange={(e) => updateSettings({ apiKey: e.target.value.trim() })}
            />
            <button onClick={() => setShow(!show)} className="btn-ghost !px-3" aria-label="Toggle key visibility">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </Field>

        <Field label="Default model for new chats">
          <select className="input" value={preset ? settings.defaultModel : "__custom"} onChange={(e) => e.target.value !== "__custom" && updateSettings({ defaultModel: e.target.value })}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
            <option value="__custom">Custom model id…</option>
          </select>
          {!preset && <input className="input mt-2" value={settings.defaultModel} onChange={(e) => updateSettings({ defaultModel: e.target.value.trim() })} placeholder="vendor/model-name" />}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`Temperature: ${settings.temperature.toFixed(2)}`}>
            <input type="range" min={0} max={2} step={0.05} value={settings.temperature} onChange={(e) => updateSettings({ temperature: +e.target.value })} className="w-full accent-violet-500" />
          </Field>
          <Field label="Max tokens">
            <input type="number" className="input" min={64} max={4096} step={50} value={settings.maxTokens} onChange={(e) => updateSettings({ maxTokens: Math.min(4096, Math.max(16, +e.target.value || 700)) })} />
          </Field>
        </div>

        <Field label="Default roleplay directive" hint="Applies to new chats. Each chat can override it in its Parameters drawer.">
          <textarea className="input min-h-[140px] text-xs" value={settings.directive} onChange={(e) => updateSettings({ directive: e.target.value })} />
          <button onClick={() => updateSettings({ directive: DEFAULT_DIRECTIVE })} className="mt-1 text-xs text-violet-400 hover:underline">Reset to default</button>
        </Field>

        <div className="rounded-xl border border-line bg-card2 p-4">
          <h3 className="text-sm font-semibold text-white">Your data</h3>
          <p className="mt-1 text-xs text-zinc-400">Chats, characters and personas are stored locally in IndexedDB. Back them up any time.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={exportData} className="btn-ghost"><Download size={15} /> Export</button>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost"><Upload size={15} /> Import</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = ""; }} />
          </div>
        </div>

        {CLOUD_ENABLED && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4">
            <h3 className="text-sm font-semibold text-white">Cloud sync (D1 / KV)</h3>
            <p className="mt-1 text-xs text-zinc-400">Paste this key on another device to load the same library. Treat it like a password.</p>
            <div className="mt-2 flex gap-2">
              <input className="input font-mono text-xs" value={syncKey} onChange={(e) => setKey(e.target.value)} onBlur={() => { if (/^[A-Za-z0-9_-]{24,128}$/.test(syncKey)) { setSyncKey(syncKey); notify("Sync key saved. Reload to pull data."); } }} />
              <button className="btn-ghost !px-3" aria-label="Copy sync key" onClick={() => navigator.clipboard.writeText(syncKey).then(() => notify("Copied"))}><Copy size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
