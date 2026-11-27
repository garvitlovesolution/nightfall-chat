# Nightfall — AI Character Chat & Roleplay

A Crushon-style character chat app: discover characters, build your own, and roleplay with
real-time streaming replies. **Local-first** (IndexedDB) so it works the moment it's deployed,
with an optional Cloudflare D1/KV sync adapter. Built for **Cloudflare Pages** via
`@cloudflare/next-on-pages`.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Lucide · OpenRouter (SSE streaming)

## Deploy in 3 steps

**1. Push to GitHub**
```bash
git init && git add -A && git commit -m "Nightfall"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git && git push -u origin main
```

**2. Create the Pages project** — Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* →
*Connect to Git* → pick the repo, then set:

| Setting | Value |
|---|---|
| Framework preset | `None` |
| Build command | `npx @cloudflare/next-on-pages` |
| Build output directory | `.vercel/output/static` |
| Environment variable | `NODE_VERSION` = `20` |

**3. Add your key & compatibility flag** — Pages project → *Settings*:
- *Variables and Secrets* → add secret `OPENROUTER_API_KEY` (optional: users can paste their own key in the app's Settings).
- *Runtime* → *Compatibility flags* → add `nodejs_compat` (Production **and** Preview). `wrangler.toml` already declares it, but the dashboard value is what next-on-pages checks on some setups.

Then *Save and Deploy*. Done. No database needed.

## Local development
```bash
npm install
cp .env.example .dev.vars        # or .env.local, add OPENROUTER_API_KEY
npm run dev                      # http://localhost:3000
npm run preview                  # build with next-on-pages and run in the real Workers runtime (workerd)
```

## Features
- **Discover** – 8 hand-written characters, category pills, search, tag filters.
- **Creator Studio** – all character fields, auto-avatar generator, and **Magic Enhance** (`/api/generate-character`, alias `/api/enhance`) which expands one sentence into a full character.
- **Chat engine** – streaming SSE, `*actions*` styled as muted italics and `"dialogue"` highlighted, regenerate with swipeable variations (`‹ 1/3 ›`), continue, edit, delete, copy, stop-generation.
- **Personas** – multiple personas, set a default, switch per conversation.
- **Memory Bank + Lorebook** – slide-over drawer. Memories are always injected; lore entries inject only when a keyword appears in the last 6 messages (and show an *ACTIVE NOW* badge).
- **Parameters** – temperature, max tokens, editable roleplay directive, blurred avatar background toggle.
- **Models** – switcher in the chat header (Mistral Nemo, MythoMax 13B, Hermes 3 70B, Gemini 2.0 Flash, or any OpenRouter id via "Custom…").
- **Backup** – export/import everything as JSON from Settings.

## Architecture
```
src/app/api/chat              Edge – streams OpenRouter SSE straight through to the browser
src/app/api/generate-character  Edge – non-streaming JSON character generation (/api/enhance is an alias)
src/app/api/sync              Edge – optional D1 / KV adapter
src/lib/idb.ts                Dependency-free IndexedDB wrapper (in-memory fallback if unavailable)
src/lib/db.ts                 CRUD for characters / personas / chats (+ seeding, backup)
src/lib/prompt.ts             System-prompt builder, lorebook trigger logic
```
All API routes use `export const runtime = 'edge'` and only Web APIs (`fetch`, `Request`, `Response`, streams) — no `fs`, `path` or Node `crypto`.

The OpenRouter key is read only from the server secret `OPENROUTER_API_KEY`; client-supplied keys are ignored.

## Optional cloud sync (D1 or KV)
Off by default. To enable cross-device sync:
```bash
npx wrangler d1 create nightfall                       # copy the database_id
npx wrangler d1 execute nightfall --remote --file=./schema.sql
```
Then in the Pages project: *Settings → Bindings → D1 database* → variable name **`DB`**
(or *KV namespace* → variable name **`KV`**), and set the environment variable
`NEXT_PUBLIC_STORAGE_MODE=cloud` (it's build-time, so redeploy).
Each browser gets a random sync key (Settings → Cloud sync); paste it on another device to share the library.
The key is the only credential, so treat it like a password.

## Notes
- `@cloudflare/next-on-pages` supports Next.js up to **15.5.2**, so that version is pinned. npm flags it with a security advisory
  (CVE-2025-66478, which affects React Server Components server-side handling). This app has no Server Actions
  and renders a single client page, but if you need a patched Next.js, migrate to the OpenNext adapter (`@opennextjs/cloudflare`);
  the code is already edge-clean, so only the build config changes.
- `.npmrc` sets `legacy-peer-deps=true` to resolve a wrangler / workers-types peer conflict.
- Browser-local data is cleared if the user wipes site data — use Export or cloud sync for safety.
