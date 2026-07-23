# Migration plan: TanStack Start → SPA mode

## Goal

Stop rendering routes on the server. Ship a static `index.html` + JS bundle that boots the router in the browser. Keep the small server surface we actually need (the streaming `/api/axel-chat` route and the `createServerFn` handlers used by Axel chat).

This removes the whole class of "missing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` at SSR time", hydration mismatches, and the h3-swallowed 500s the SSR wrapper exists to catch.

## What changes

### 1. Router: disable SSR globally
In `src/router.tsx`, set `defaultSsr: false` on `createRouter(...)`. Every route renders on the client; loaders still run, just in the browser.

### 2. Root route: static shell
`src/routes/__root.tsx` keeps its `head()` (title, meta, JSON-LD, font `<link>` tags) so the shipped `index.html` still has good baseline SEO/OG. No per-route SSR HTML — dynamic `head()` becomes client-only.

### 3. Route files: drop SSR-only workarounds
- Remove the per-route `ssr: false` we added to `_authenticated.tsx` and `login.tsx` (now the global default).
- Loaders that call `requireSupabaseAuth`-protected server functions become safe from any route (no more prerender 401s).
- Keep `_authenticated/route.tsx` as the auth gate.

### 4. Server surface we keep
- `src/routes/api/axel-chat.ts` — streaming AI endpoint, must stay server-side.
- `src/lib/axel.functions.ts` — `createServerFn` handlers (threads/messages). Still callable from the SPA via the generated RPC endpoint.
- `src/routes/sitemap[.]xml.ts` — server route, keep.
- `src/start.ts` middleware (`errorMiddleware`, `attachSupabaseAuth`) — keep for the server functions.

### 5. Build output & hosting
- Configure `@lovable.dev/vite-tanstack-config` for SPA output: prerender only `/` (single `index.html`) and enable SPA fallback so deep links like `/accounts` serve `index.html` and the client router takes over.
- The Cloudflare Worker still runs, but only to serve `/api/*`, `/sitemap.xml`, and the static assets + SPA fallback. No React SSR in the request path.

### 6. Remove SSR error scaffolding that no longer applies
- `src/server.ts` response-normalizer for h3-swallowed React SSR errors → simplified; kept only if the Worker still wraps `/api/*`.
- `src/lib/error-capture.ts` global listeners → keep (cheap, still useful for server-fn errors).
- Route-level `errorComponent` / `notFoundComponent` stay — they run client-side.

### 7. Env vars
Once SSR is off, the client only needs `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` inlined at build time (already handled in `vite.config.ts`). The runtime `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` are only read inside `createServerFn` handlers and the `/api/axel-chat` route — no more SSR module-init crashes when they're absent.

### 8. Verification
- `bun run build` produces `dist/` with `index.html` + hashed assets.
- Playwright against the built output: `/`, `/login`, `/accounts` (redirects to `/login`), `/axel` (post-login) all render with **no** "Missing Supabase env" error and **no** hydration warnings.
- `/api/axel-chat` still streams; thread list still loads via server functions.
- Publish and confirm the same on `axel-command-center.lovable.app`.

## Risk & rollback

- Low risk: the app is already almost entirely client-driven (auth-gated, `_authenticated` subtree runs `ssr: false` today).
- Rollback = revert the router `defaultSsr: false` flip and the vite config SPA setting; everything else is additive/subtractive around that switch.

## Out of scope

- No changes to Supabase schema, RLS, or business logic.
- No UI changes.
- No changes to Axel chat behavior — only how the shell is delivered.
