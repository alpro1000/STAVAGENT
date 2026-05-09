# Prerender (post-build static-HTML capture)

**Status:** active since landing v3.2 Gate 4 (2026-05-08).
**Owner:** `scripts/prerender.mjs` runs as a `postbuild` lifecycle script.

## What it does

After `vite build` produces `dist/index.html` (a thin SPA shell with an empty
`<div id="root">`), `scripts/prerender.mjs` boots Puppeteer + a tiny
`sirv` static server, navigates to each allow-listed route, captures the
fully-hydrated HTML, and writes it back to disk.

A `curl https://www.stavagent.cz/` after deploy returns rendered `<h1>` +
`<meta>` content instead of an empty `<div id="root">`. Search engines and
preview-card scrapers (LinkedIn, Facebook, X) see the static content
immediately without running JS.

```
        npm run build
            │
            ├── prebuild        — npm run prepare:shared
            ├── build           — tsc && vite build  (writes dist/)
            └── postbuild       — node scripts/prerender.mjs  (rewrites dist/<route>/index.html)
```

## Allow-list

Routes that get prerendered are listed in
`scripts/prerender.mjs` → `ROUTES_TO_PRERENDER`. Today:

```js
const ROUTES_TO_PRERENDER = ['/'];
```

Adding a route:

| Future Gate | Add to ROUTES_TO_PRERENDER |
|---|---|
| Gate 10 (`/team`) | `'/team'` |
| Gate 11 (`/en/`) | `'/en/'` |
| Gate 11 (`/en/team`) | `'/en/team'` |

**Routes that MUST NOT be in this list:**
- `/portal/*` — auth-gated; prerender would either flash unauth content for
  Googlebot or expose page shape to scrapers.
- `/cabinet/*` — same reasoning.
- `/admin/*` — admin-only; never indexed.
- `/dashboard`, `/login`, `/register`, `/verify`, `/forgot-password`,
  `/reset-password` — flow pages that only matter to logged-in flows;
  the prerendered `/` is what Google indexes.

## Output mapping

| Route in allow-list | Output file |
|---|---|
| `/` | `dist/index.html` (overwritten) |
| `/team` | `dist/team/index.html` |
| `/en/` | `dist/en/index.html` |
| `/en/team` | `dist/en/team/index.html` |

Vercel serves these static files directly because static-file precedence
beats the `vercel.json` SPA rewrite (`{"source":"/(.*)","destination":"/index.html"}`).
Routes NOT prerendered fall through the rewrite and serve the prerendered
`/` shell, which then re-routes via React Router after hydration. This
causes a brief landing-flash on auth-gated routes — acceptable trade-off
since they redirect to /login anyway.

## Build-time impact

| Stage | Time on Vercel |
|---|---|
| `vite build` | ~30–60 s |
| `puppeteer` install (first deploy after cache invalidation) | ~2–3 min |
| `puppeteer` install (cached deploys) | ~5 s |
| `prerender.mjs` (1 route) | ~2–4 s |
| **Total fresh build** | ~3–4 min |
| **Total cached build** | ~45 s |

Vercel caches `node_modules/` between deploys when the lockfile (or
`package.json` for projects without lockfile) is unchanged. Adding a
new route to the allow-list does NOT invalidate the cache — only changing
puppeteer's version does.

## Skipping prerender

For fast local builds:

```bash
SKIP_PRERENDER=1 npm run build
# or
npm run build:no-prerender
```

The script honors `SKIP_PRERENDER=1` and exits 0 immediately.

## Debugging a broken render

1. **Build failed at the prerender step:** check the Vercel build log for
   `[prerender] FAILED:` — full Puppeteer stack trace follows.
2. **`networkidle0` timeout:** the route triggers ongoing network requests
   (analytics, websockets, polling). Either fix the source or increase
   `NAVIGATION_TIMEOUT_MS` in `prerender.mjs`.
3. **Empty content captured:** the route is React.lazy'd and the chunk
   didn't load before `networkidle0` fired. Make the route eager-import in
   `App.tsx` or extend `POST_RENDER_SETTLE_MS`.
4. **Hydration mismatch warnings in browser console:** the React component
   renders different content during SSR-style prerender vs. client. Common
   culprits: `Date.now()`, `Math.random()`, `localStorage` reads, feature
   flags. Move those into `useEffect`.
5. **Local repro:**
   ```bash
   cd stavagent-portal/frontend
   npm run build              # full build with prerender
   ls -la dist/index.html     # should be a fully-rendered HTML, not the SPA shell
   grep -c '<h1' dist/index.html  # should be ≥ 1
   ```

## Why a custom script and not vite-plugin-prerender-spa / react-snap

- **Explicit allow-list.** A `const ROUTES_TO_PRERENDER = [...]` array is
  greppable and obvious. Plugin configs often hide this in a deeply nested
  options object.
- **No third-party plugin maintenance risk.** All these tools wrap
  Puppeteer the same way; this is a thin direct wrapper.
- **Easy to extend.** When `/team` and `/en/` land, it's a one-line array
  edit. No plugin upgrade dance.

## Why not Astro / Next.js

Migration scope is too large for the v3.2 timeline. The post-build prerender
gives 95% of the SEO benefit at <1% of the migration cost.
