import { Fragment } from "react";

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|"[^"\n]*"|“[^”\n]*”)/g;

/** Roleplay formatting: *actions* → muted italics, "dialogue" → highlighted. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-200">
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
          return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
          return <em key={i} className="italic text-zinc-400">{p.slice(1, -1)}</em>;
        if ((p.startsWith('"') && p.endsWith('"') && p.length > 1) || (p.startsWith("“") && p.endsWith("”")))
          return <span key={i} className="font-medium text-pink-200">{p}</span>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </div>
  );
}
