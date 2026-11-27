"use client";

import { useEffect, useRef } from "react";
import { useApp } from "./AppProvider";

/** Route `#/c/<characterId>`: always start a brand-new chat, then redirect. */
export function StartChat({ characterId }: { characterId: string }) {
  const { newChat, go } = useApp();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    newChat(characterId).then((chat) => go(chat ? `chat/${chat.id}` : "", true));
  }, [characterId, newChat, go]);
  return null;
}
