"use client";

import { Menu, Sparkles } from "lucide-react";
import { AppProvider, useApp } from "./AppProvider";
import { ChatView } from "./Chat";
import { Creator } from "./Creator";
import { Discover } from "./Discover";
import { HistoryView } from "./History";
import { PersonasModal } from "./PersonasModal";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";
import { StartChat } from "./StartChat";

function Screen() {
  const { ready, route, modal, setModal, setMenuOpen } = useApp();

  const inChat = route.name === "chat";
  let view = null;
  if (!ready) {
    view = (
      <div className="grid h-full place-items-center">
        <Sparkles className="animate-pulse text-violet-400" />
      </div>
    );
  } else if (route.name === "chat") view = <ChatView key={route.id} chatId={route.id} />;
  else if (route.name === "start") view = <StartChat characterId={route.id} />;
  else if (route.name === "create") view = <Creator key={route.id ?? "new"} editId={route.id} />;
  else if (route.name === "history") view = <HistoryView />;
  else view = <Discover />;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {!inChat && (
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-zinc-300 hover:bg-card">
              <Menu size={20} />
            </button>
            <span className="font-bold text-white">Nightfall</span>
          </div>
        )}
        <div className={`min-h-0 flex-1 ${inChat ? "" : "overflow-y-auto"}`}>{view}</div>
      </main>
      {modal === "personas" && <PersonasModal onClose={() => setModal(null)} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal(null)} />}
    </div>
  );
}

export function AppShell() {
  return (
    <AppProvider>
      <Screen />
    </AppProvider>
  );
}
