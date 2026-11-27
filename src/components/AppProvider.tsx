"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as db from "@/lib/db";
import { DEFAULT_SETTINGS, loadSettings, storeSettings } from "@/lib/settings";
import type { Character, Chat, Persona, Settings } from "@/lib/types";
import { clamp, uid } from "@/lib/util";

export type Route =
  | { name: "discover" }
  | { name: "create"; id?: string }
  | { name: "history" }
  | { name: "chat"; id: string }
  | { name: "start"; id: string };

function parseHash(): Route {
  const h = (typeof location !== "undefined" ? location.hash : "").replace(/^#\/?/, "");
  const [a, b] = h.split("/");
  if (a === "create") return { name: "create", id: b || undefined };
  if (a === "history") return { name: "history" };
  if (a === "chat" && b) return { name: "chat", id: b };
  if (a === "c" && b) return { name: "start", id: b };
  return { name: "discover" };
}

type Modal = null | "personas" | "settings";
interface Toast {
  id: number;
  msg: string;
  kind: "info" | "error";
}

interface Ctx {
  ready: boolean;
  route: Route;
  go: (path: string, replace?: boolean) => void;
  characters: Character[];
  personas: Persona[];
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  reload: () => Promise<void>;
  modal: Modal;
  setModal: (m: Modal) => void;
  menuOpen: boolean;
  setMenuOpen: (b: boolean) => void;
  openCharacter: (id: string) => Promise<void>;
  newChat: (characterId: string) => Promise<Chat | null>;
  notify: (msg: string, kind?: "info" | "error") => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>({ name: "discover" });
  const [characters, setCharacters] = useState<Character[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const reload = useCallback(async () => {
    const [c, p] = await Promise.all([db.listCharacters(), db.listPersonas()]);
    setCharacters(c);
    setPersonas(p);
  }, []);

  useEffect(() => {
    setSettings(loadSettings());
    setRoute(parseHash());
    const onHash = () => {
      setRoute(parseHash());
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", onHash);
    (async () => {
      await reload();
      setReady(true);
      // Optional D1/KV pull (no-op unless NEXT_PUBLIC_STORAGE_MODE=cloud)
      if ((await db.syncFromCloud()) > 0) await reload();
    })();
    return () => window.removeEventListener("hashchange", onHash);
  }, [reload]);

  const go = useCallback((path: string, replace = false) => {
    const target = `#/${path.replace(/^#?\/?/, "")}`;
    if (replace) history.replaceState(null, "", target);
    else location.hash = target;
    setRoute(parseHash());
    setMenuOpen(false);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      storeSettings(next);
      return next;
    });
  }, []);

  const notify = useCallback((msg: string, kind: "info" | "error" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 2800);
  }, []);

  const newChat = useCallback(
    async (characterId: string): Promise<Chat | null> => {
      const char = characters.find((c) => c.id === characterId);
      if (!char) return null;
      const now = Date.now();
      const chat: Chat = {
        id: uid(),
        characterId,
        personaId: settings.defaultPersonaId && personas.some((p) => p.id === settings.defaultPersonaId) ? settings.defaultPersonaId : null,
        model: settings.defaultModel,
        title: `Chat with ${char.name}`,
        messages: char.greeting.trim()
          ? [{ id: uid(), role: "assistant", swipes: [char.greeting], swipeIndex: 0, createdAt: now }]
          : [],
        memories: [],
        lorebook: [],
        params: {
          temperature: clamp(settings.temperature, 0, 2),
          maxTokens: settings.maxTokens,
          directive: settings.directive,
          background: true,
        },
        createdAt: now,
        updatedAt: now,
      };
      return db.saveChat(chat);
    },
    [characters, personas, settings],
  );

  const openCharacter = useCallback(
    async (id: string) => {
      const existing = (await db.listChats()).find((c) => c.characterId === id);
      const chat = existing ?? (await newChat(id));
      if (chat) go(`chat/${chat.id}`);
    },
    [go, newChat],
  );

  const value = useMemo<Ctx>(
    () => ({
      ready, route, go, characters, personas, settings, updateSettings, reload,
      modal, setModal, menuOpen, setMenuOpen, openCharacter, newChat, notify,
    }),
    [ready, route, go, characters, personas, settings, updateSettings, reload, modal, menuOpen, openCharacter, newChat, notify],
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm animate-fadein rounded-xl border px-4 py-3 text-sm shadow-lg ${
              t.kind === "error" ? "border-red-900 bg-red-950/90 text-red-200" : "border-line bg-card text-zinc-100"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </AppCtx.Provider>
  );
}
