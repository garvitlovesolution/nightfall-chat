"use client";

import { Compass, History, KeyRound, PlusCircle, Sparkles, UserRound, X } from "lucide-react";
import type { ReactNode } from "react";
import { useApp } from "./AppProvider";

function Item({ icon, label, active, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active ? "bg-gradient-to-r from-violet-600/30 to-neon-pink/20 text-white ring-1 ring-violet-500/40" : "text-zinc-400 hover:bg-card hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Nav() {
  const { route, go, setModal, setMenuOpen } = useApp();
  return (
    <div className="flex h-full flex-col p-4">
      <button onClick={() => go("")} className="mb-6 flex items-center gap-2 px-2 text-left">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-neon-pink shadow-glow">
          <Sparkles size={18} className="text-white" />
        </span>
        <span className="text-lg font-bold tracking-tight text-white">Nightfall</span>
      </button>
      <nav className="flex flex-col gap-1">
        <Item icon={<Compass size={18} />} label="Discover" active={route.name === "discover"} onClick={() => go("")} />
        <Item icon={<PlusCircle size={18} />} label="Create Character" active={route.name === "create"} onClick={() => go("create")} />
        <Item icon={<UserRound size={18} />} label="My Personas" onClick={() => { setMenuOpen(false); setModal("personas"); }} />
        <Item icon={<History size={18} />} label="Chat History" active={route.name === "history" || route.name === "chat"} onClick={() => go("history")} />
      </nav>
      <div className="mt-auto">
        <Item icon={<KeyRound size={18} />} label="API / Model Settings" onClick={() => { setMenuOpen(false); setModal("settings"); }} />
        <p className="mt-3 px-3 text-[11px] leading-snug text-zinc-600">Local-first: your chats live in this browser.</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { menuOpen, setMenuOpen } = useApp();
  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-line bg-[#0c0c0f] md:block">
        <Nav />
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slidein bg-[#0c0c0f] [animation-direction:normal]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1 text-zinc-400 hover:text-white">
              <X size={18} />
            </button>
            <Nav />
          </aside>
        </div>
      )}
    </>
  );
}
