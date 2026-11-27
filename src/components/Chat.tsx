"use client";

import {
  Brain, Check, ChevronLeft, ChevronRight, Copy, FastForward, Image as ImageIcon, Loader2, Menu, Pencil,
  Plus, RefreshCw, Send, SlidersHorizontal, Square, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as db from "@/lib/db";
import { MODELS } from "@/lib/models";
import { activeText, buildApiMessages, fillVars } from "@/lib/prompt";
import { streamChat } from "@/lib/stream";
import type { Character, Chat, Message } from "@/lib/types";
import { cssUrl, uid } from "@/lib/util";
import { useApp } from "./AppProvider";
import { ChatDrawer, type DrawerTab } from "./ChatDrawer";
import { RichText } from "./RichText";
import { Avatar } from "./ui";

const STUB: Character = {
  id: "missing", name: "Unknown", tagline: "", avatar: "", category: "Custom", tags: [],
  personality: "A mysterious stranger.", scenario: "", greeting: "", exampleDialogue: "", createdAt: 0, updatedAt: 0,
};

function IconBtn({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white disabled:opacity-30">
      {children}
    </button>
  );
}

export function ChatView({ chatId }: { chatId: string }) {
  const { characters, personas, go, setMenuOpen, notify, newChat } = useApp();
  const [chat, setChat] = useState<Chat | null>(null);
  const [missing, setMissing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [drawer, setDrawer] = useState<DrawerTab | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const chatRef = useRef<Chat | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const character = useMemo(() => characters.find((c) => c.id === chat?.characterId) ?? STUB, [characters, chat?.characterId]);
  const persona = useMemo(() => personas.find((p) => p.id === chat?.personaId) ?? null, [personas, chat?.personaId]);
  const userName = persona?.name || "You";

  useEffect(() => {
    let alive = true;
    db.getChat(chatId).then((c) => {
      if (!alive) return;
      if (c) { chatRef.current = c; setChat(c); } else setMissing(true);
    });
    return () => { alive = false; abortRef.current?.abort(); };
  }, [chatId]);

  /** Apply a change to the chat. `persist=false` is used for per-token streaming updates. */
  const commit = useCallback((fn: (c: Chat) => Chat, persist = true) => {
    const cur = chatRef.current;
    if (!cur) return;
    const next = fn(cur);
    chatRef.current = next;
    setChat(next);
    if (persist) void db.saveChat(next);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chat?.messages, streaming]);

  const setText = (msgId: string, text: string) =>
    commit((c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === msgId ? { ...m, swipes: m.swipes.map((s, i) => (i === m.swipeIndex ? text : s)) } : m)),
    }), false);

  const generate = async (mode: "new" | "swipe" | "continue", targetId?: string) => {
    const cur = chatRef.current;
    if (!cur || streaming) return;

    let history: Message[];
    let msgId: string;
    let prefix = "";

    if (mode === "new") {
      msgId = uid();
      history = cur.messages;
      commit((c) => ({ ...c, messages: [...c.messages, { id: msgId, role: "assistant", swipes: [""], swipeIndex: 0, createdAt: Date.now() }] }), false);
    } else {
      const idx = cur.messages.findIndex((m) => m.id === targetId);
      const target = cur.messages[idx];
      if (!target) return;
      msgId = target.id;
      if (mode === "swipe") {
        history = cur.messages.slice(0, idx);
        commit((c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === msgId ? { ...m, swipes: [...m.swipes, ""], swipeIndex: m.swipes.length } : m)),
        }), false);
      } else {
        history = cur.messages.slice(0, idx + 1);
        prefix = activeText(target);
      }
    }

    const apiMessages = buildApiMessages(cur, character, persona, history, mode === "continue" ? "continue" : "normal");
    const ac = new AbortController();
    abortRef.current = ac;
    setStreaming(true);
    stick.current = true;
    let acc = "";

    try {
      await streamChat({
        messages: apiMessages,
        model: cur.model,
        temperature: cur.params.temperature,
        maxTokens: cur.params.maxTokens,
        signal: ac.signal,
        onDelta: (d) => {
          // When continuing, make sure the join point never glues two sentences together.
          if (!acc && prefix && /[.!?*"\u201D]$/.test(prefix) && /^[^\s]/.test(d)) d = " " + d;
          acc += d;
          setText(msgId, prefix + acc);
        },
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        notify(e instanceof Error ? e.message : "Generation failed", "error");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Roll back empty results (error / immediate stop) so we never keep blank messages.
      if (!acc.trim()) {
        commit((c) => ({
          ...c,
          messages: c.messages.flatMap((m) => {
            if (m.id !== msgId) return [m];
            if (mode === "new") return [];
            if (mode === "swipe") {
              const swipes = m.swipes.slice(0, -1);
              return [{ ...m, swipes, swipeIndex: Math.max(0, swipes.length - 1) }];
            }
            return [m];
          }),
        }));
      } else {
        commit((c) => c);
      }
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !chat) return;
    setInput("");
    stick.current = true;
    commit((c) => ({ ...c, messages: [...c.messages, { id: uid(), role: "user", swipes: [text], swipeIndex: 0, createdAt: Date.now() }] }));
    await generate("new");
  };

  const swipe = (id: string, delta: number) =>
    commit((c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === id ? { ...m, swipeIndex: Math.min(m.swipes.length - 1, Math.max(0, m.swipeIndex + delta)) } : m)),
    }));

  const saveEdit = () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return notify("Message can't be empty. Use delete instead.", "error");
    commit((c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === editing.id ? { ...m, swipes: m.swipes.map((s, i) => (i === m.swipeIndex ? text : s)) } : m)),
    }));
    setEditing(null);
  };

  const copy = (m: Message) => {
    void navigator.clipboard.writeText(fillVars(activeText(m), userName, character.name)).then(() => {
      setCopied(m.id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const startNew = async () => {
    if (streaming) abortRef.current?.abort();
    const c = await newChat(character.id);
    if (c) go(`chat/${c.id}`);
  };

  if (missing) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-zinc-400">This conversation no longer exists.</p>
          <button onClick={() => go("history")} className="btn-primary mt-4">Back to history</button>
        </div>
      </div>
    );
  }
  if (!chat) return <div className="grid h-full place-items-center"><Loader2 className="animate-spin text-violet-400" /></div>;

  const lastId = chat.messages[chat.messages.length - 1]?.id;
  const lastIsUser = chat.messages[chat.messages.length - 1]?.role === "user";
  const bgSrc = character.avatar || "";
  const modelKnown = MODELS.some((m) => m.id === chat.model);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {chat.params.background && bgSrc && (
        <div aria-hidden className="pointer-events-none absolute inset-0 scale-125 bg-cover bg-center opacity-25 blur-3xl" style={{ backgroundImage: cssUrl(bgSrc) }} />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/60 to-bg/90" />

      {/* Header */}
      <header className="relative z-10 border-b border-line bg-bg/70 px-3 py-2.5 backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-2">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-zinc-300 hover:bg-card md:hidden"><Menu size={20} /></button>
          <button onClick={() => go("history")} aria-label="Back to history" className="hidden rounded-lg p-1.5 text-zinc-400 hover:bg-card hover:text-white md:block"><ChevronLeft size={20} /></button>
          <Avatar src={character.avatar} name={character.name} className="h-10 w-10 shrink-0 rounded-full ring-2 ring-violet-500/50" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-white">{character.name}</h1>
            <p className="truncate text-xs text-zinc-500">{streaming ? "typing…" : character.tagline}</p>
          </div>
          <IconBtn label="New chat" onClick={startNew}><Plus size={18} /></IconBtn>
          <IconBtn label="Toggle background" onClick={() => commit((c) => ({ ...c, params: { ...c.params, background: !c.params.background } }))}>
            <ImageIcon size={18} className={chat.params.background ? "text-violet-400" : ""} />
          </IconBtn>
          <IconBtn label="Memory & Lorebook" onClick={() => setDrawer("memory")}><Brain size={18} /></IconBtn>
          <IconBtn label="Chat parameters" onClick={() => setDrawer("params")}><SlidersHorizontal size={18} /></IconBtn>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 pl-0 sm:pl-12">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            Model
            <select
              aria-label="Model"
              className="max-w-[210px] rounded-lg border border-line bg-card px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500"
              value={modelKnown ? chat.model : MODELS[0].id}
              onChange={(e) => commit((c) => ({ ...c, model: e.target.value }))}
            >
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            Chatting as
            <select
              aria-label="Persona"
              className="max-w-[160px] rounded-lg border border-line bg-card px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500"
              value={chat.personaId ?? ""}
              onChange={(e) => commit((c) => ({ ...c, personaId: e.target.value || null }))}
            >
              <option value="">You (no persona)</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
        }}
        className="relative z-10 flex-1 overflow-y-auto px-3 py-5 sm:px-6"
      >
        <div className="mx-auto max-w-3xl space-y-5">
          {chat.messages.map((m) => {
            const isUser = m.role === "user";
            const isLast = m.id === lastId;
            const text = activeText(m);
            const isEditing = editing?.id === m.id;
            const pending = streaming && isLast && !isUser && !text;

            return (
              <div key={m.id} className={`group flex animate-fadein gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
                {!isUser && <Avatar src={character.avatar} name={character.name} className="mt-1 h-9 w-9 shrink-0 rounded-full" />}
                <div className={`min-w-0 max-w-[88%] ${isUser ? "items-end text-right" : ""}`}>
                  <div className={`mb-1 text-xs font-medium ${isUser ? "text-violet-300" : "text-zinc-500"}`}>{isUser ? userName : character.name}</div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-left ${
                      isUser ? "rounded-tr-sm bg-gradient-to-br from-violet-700/80 to-fuchsia-700/60" : "rounded-tl-sm border border-line bg-card/85 backdrop-blur"
                    }`}
                  >
                    {isEditing ? (
                      <div className="w-[min(70vw,640px)] space-y-2">
                        <textarea autoFocus className="input min-h-[120px]" value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditing(null)} className="btn-ghost !px-3 !py-1.5 !text-xs"><X size={13} /> Cancel</button>
                          <button onClick={saveEdit} className="btn-primary !px-3 !py-1.5 !text-xs"><Check size={13} /> Save</button>
                        </div>
                      </div>
                    ) : pending ? (
                      <span className="flex gap-1 py-1" aria-label="Generating">
                        {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-blink rounded-full bg-violet-400" style={{ animationDelay: `${i * 0.2}s` }} />)}
                      </span>
                    ) : (
                      <>
                        <RichText text={fillVars(text, userName, character.name)} />
                        {streaming && isLast && !isUser && <span className="ml-0.5 inline-block h-4 w-1.5 animate-blink bg-violet-400 align-middle" />}
                      </>
                    )}
                  </div>

                  {!isEditing && !(streaming && isLast) && (
                    <div className={`mt-1 flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100 ${isUser ? "justify-end" : ""}`}>
                      {!isUser && m.swipes.length > 1 && (
                        <span className="mr-1 flex items-center text-xs text-zinc-400">
                          <IconBtn label="Previous variation" onClick={() => swipe(m.id, -1)} disabled={m.swipeIndex === 0}><ChevronLeft size={15} /></IconBtn>
                          <span className="tabular-nums">{m.swipeIndex + 1}/{m.swipes.length}</span>
                          <IconBtn label="Next variation" onClick={() => swipe(m.id, 1)} disabled={m.swipeIndex === m.swipes.length - 1}><ChevronRight size={15} /></IconBtn>
                        </span>
                      )}
                      <IconBtn label="Copy" onClick={() => copy(m)}>{copied === m.id ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}</IconBtn>
                      <IconBtn label="Edit" onClick={() => setEditing({ id: m.id, text })}><Pencil size={15} /></IconBtn>
                      {!isUser && isLast && <IconBtn label="Regenerate" onClick={() => generate("swipe", m.id)}><RefreshCw size={15} /></IconBtn>}
                      {!isUser && isLast && <IconBtn label="Continue" onClick={() => generate("continue", m.id)}><FastForward size={15} /></IconBtn>}
                      <IconBtn label="Delete" onClick={() => commit((c) => ({ ...c, messages: c.messages.filter((x) => x.id !== m.id) }))}><Trash2 size={15} /></IconBtn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {lastIsUser && !streaming && (
            <div className="flex justify-center">
              <button onClick={() => generate("new")} className="btn-ghost !text-xs"><RefreshCw size={14} /> Retry response</button>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="relative z-10 border-t border-line bg-bg/80 p-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
            }}
            rows={1}
            placeholder={`Message ${character.name}…  (*action* and "speech")`}
            aria-label="Message"
            className="input max-h-40 min-h-[44px] resize-none !rounded-2xl !py-3"
            style={{ height: "auto", fieldSizing: "content" } as React.CSSProperties}
          />
          {streaming ? (
            <button onClick={() => abortRef.current?.abort()} aria-label="Stop generating" className="btn-danger h-11 w-11 shrink-0 !rounded-full !p-0"><Square size={16} fill="currentColor" /></button>
          ) : (
            <button onClick={() => void send()} disabled={!input.trim()} aria-label="Send" className="btn-primary h-11 w-11 shrink-0 !rounded-full !p-0"><Send size={17} /></button>
          )}
        </div>
      </div>

      {drawer && <ChatDrawer chat={chat} tab={drawer} setTab={setDrawer} update={(fn) => commit(fn)} onClose={() => setDrawer(null)} />}
    </div>
  );
}
