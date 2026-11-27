"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as db from "@/lib/db";
import { activeText } from "@/lib/prompt";
import type { Chat } from "@/lib/types";
import { timeAgo } from "@/lib/util";
import { useApp } from "./AppProvider";
import { Avatar, PageHeader } from "./ui";

export function HistoryView() {
  const { characters, go } = useApp();
  const [chats, setChats] = useState<Chat[] | null>(null);

  useEffect(() => {
    db.listChats().then(setChats);
  }, []);

  const remove = async (c: Chat) => {
    if (!confirm("Delete this conversation permanently?")) return;
    await db.deleteChat(c.id);
    setChats((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <PageHeader title="Chat History" subtitle="Pick up where you left off." />
      {chats && chats.length === 0 && (
        <div className="mt-16 text-center text-zinc-500">
          <MessageSquare className="mx-auto mb-3" />
          <p>No conversations yet.</p>
          <button onClick={() => go("")} className="btn-primary mt-4">Discover characters</button>
        </div>
      )}
      <ul className="space-y-2">
        {chats?.map((c) => {
          const char = characters.find((x) => x.id === c.characterId);
          const last = c.messages[c.messages.length - 1];
          return (
            <li key={c.id} className="group flex items-center gap-3 rounded-2xl border border-line bg-card p-3 transition hover:border-violet-500/50">
              <button onClick={() => go(`chat/${c.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar src={char?.avatar} name={char?.name ?? "?"} className="h-12 w-12 shrink-0 rounded-xl" />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-semibold text-white">{char?.name ?? "Deleted character"}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{timeAgo(c.updatedAt)} · {c.messages.length} msgs</span>
                  </div>
                  <p className="truncate text-sm text-zinc-400">{last ? activeText(last).replace(/[*]/g, "") : "Empty chat"}</p>
                </div>
              </button>
              <button onClick={() => remove(c)} aria-label="Delete chat" className="rounded-lg p-2 text-zinc-500 hover:bg-red-950/50 hover:text-red-300">
                <Trash2 size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
