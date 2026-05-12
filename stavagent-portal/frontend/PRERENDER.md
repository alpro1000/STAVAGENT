# Prerender (snapshot-based static-HTML serving)

**Status:** active since landing v3.2 Gate 4 (2026-05-08).
**Runtime architecture rewritten:** 2026-05-12 — Puppeteer moved off Vercel
build runtime onto GitHub Actions (`ubuntu-latest`) because Vercel's build
container is missing `libnss3.so` + friends that any Chromium binary —
bundled `puppeteer` or `@sparticuz/chromium` — dynamically links against.

## What happens, end-to-end

```
  Developer push to main
        │
        ▼
  .github/workflows/prerender.yml
        │
        ├── npm install (workspace root, hoisted deps)
        ├── npm run build  (vite + REAL Puppeteer prerender — libs present)
        ├── cp dist/*.html → public/prerendered/*.html
        └── git commit "[skip prerender]" + git push origin main
                    │
                    ▼
          Vercel deploy triggered by the new commit
                    │
                    ├── npm run build with SKIP_PRERENDER=1
                    │      ├── vite build      → empty SPA shells in dist/
                    │      └── postbuild       → prerender.mjs SKIP branch
                    │                            copies public/prerendered/
                    │                            over dist/* (4 routes)
                    │
                    └── dist/ contains fully-rendered HTML, served as
                       static files (filesystem precedence beats the
                       SPA-fallback rewrite)
```

A `curl https://www.stavagent.cz/` after deploy returns rendered `<h1>` +
`<meta>` content instead of an empty `<div id="root">`. Search engines and
preview-card scrapers (LinkedIn, Facebook, X) see the static content
immediately without running JS.

## Allow-list

Routes that get prerendered are listed in
`scripts/prerender.mjs` → `ROUTES_TO_PRERENDER`. Today:

```js
const ROUTES_TO_PRERENDER = ['/', '/en/', '/team', '/en/team'];
```

Per-Gate additions:

| Gate | Added entry | Output file |
|---|---|---|
| Gate 4 | `'/'` | `dist/index.html` (overwritten) |
| Gate 10 | `'/team'` | `dist/team/index.html` |
| Gate 10 | `'/en/team'` | `dist/en/team/index.html` |
| Gate 11 | `'/en/'` | `dist/en/index.html` |

**Routes that MUST NOT be in this list:**
- `/portal/*` — auth-gated; prerender would either flash unauth content for
  Googlebot or expose page shape to scrapers.
- `/cabinet/*` — same reasoning.
- `/admin/*` — admin-only; never indexed.
- `/dashboard`, `/login`, `/register`, `/verify`, `/forgot-password`,
  `/reset-password` — flow pages that only matter to logged-in flows;
  the prerendered `/` is what Google indexes.

When adding a route to the allow-list, **also extend the smoke-check loop
and copy loop in `.github/workflows/prerender.yml`** (look for the four
file paths that need to grow to five).

## Snapshot storage

The committed snapshots live at:

| Route | Snapshot file (in git) | Served at (after Vercel deploy) |
|---|---|---|
| `/` | `stavagent-portal/frontend/public/prerendered/index.html` | `dist/index.html` |
| `/en/` | `stavagent-portal/frontend/public/prerendered/en/index.html` | `dist/en/index.html` |
| `/team` | `stavagent-portal/frontend/public/prerendered/team/index.html` | `dist/team/index.html` |
| `/en/team` | `stavagent-portal/frontend/public/prerendered/en/team/index.html` | `dist/en/team/index.html` |

Two parties write to this directory:
- **The GitHub Action** on every push to main that touched non-snapshot files.
- **A developer running `npm run build` locally** — useful for verifying a
  change before pushing. Local runs are fine to commit; the Action will
  overwrite them on the next push anyway.

## Why a snapshot, not live prerender on Vercel

Vercel's build container is a minimal Linux image (`amazonlinux:2023`-ish).
It does NOT ship the GUI shared libraries that Chromium dynamically links
against:

- `libnss3.so` — Network Security Services
- `libxss1`, `libasound2`, `libatk-bridge-2.0-0`, `libcups2`,
  `libxcomposite1`, `libxdamage1`, `libxfixes3`, `libxrandr2`, `libgbm1`,
  `libpango-1.0-0`, `libcairo2`

Both variants of Chromium (`puppeteer`'s bundled download AND
`@sparticuz/chromium`) hit the same `libnss3.so: cannot open shared
object file` at launch. `@sparticuz/chromium` ships its own `chromium`
binary that statically links *fonts*, but not the GUI libs.

`ubuntu-latest` (GitHub Actions) ships those libs preinstalled, so
Puppeteer "just works" there. Hence the split: build + prerender on
ubuntu-latest, serve from Vercel.

## Loop prevention

The workflow commits to main. Without precautions, that commit would
re-trigger the workflow, which would re-prerender + commit again, …
Two layers of defense:

1. **`paths-ignore`** on `stavagent-portal/frontend/public/prerendered/**`
   in the workflow's `on.push` block — the bot's commits change only
   that path, so the trigger filters them out before the job ever starts.

2. **`[skip prerender]` tag** in the commit message — the job's `if:`
   condition checks for that substring and refuses to run. Belt-and-
   suspenders in case a human commit accidentally bundles a snapshot
   change with another change (paths-ignore would NOT block that mixed
   commit, since the non-snapshot file is unfiltered).

If you ever need to force-skip the prerender workflow on a normal commit,
append `[skip prerender]` to the commit subject.

## Manually triggering a re-prerender

Two ways:

1. **GitHub UI:** Actions → "Prerender Landing Pages" → "Run workflow"
   (the workflow_dispatch trigger is enabled).
2. **Empty commit:** `git commit --allow-empty -m "trigger prerender"`
   and push to main.

## Skipping prerender (locally)

```bash
SKIP_PRERENDER=1 npm run build
# or
npm run build:no-prerender
```

In SKIP mode, `scripts/prerender.mjs` exits without launching Puppeteer.
If `public/prerendered/` exists in the working tree, it copies that
snapshot over `dist/` (matching Vercel's behavior). If not, dist/ stays
as the empty SPA shell.

## Build-time impact

| Stage | Where | Time |
|---|---|---|
| GH Action: `npm install` (cached) | ubuntu-latest | ~10–20 s |
| GH Action: `vite build` | ubuntu-latest | ~5–10 s |
| GH Action: Puppeteer prerender (4 routes) | ubuntu-latest | ~10–15 s |
| GH Action: commit + push | ubuntu-latest | ~3 s |
| **GH Action total** | | **~30–50 s** |
| Vercel: `vite build` | Vercel | ~30–60 s |
| Vercel: postbuild snapshot copy | Vercel | <1 s |
| **Vercel total** | | **~30–60 s** |

Net SEO latency between developer push and rendered HTML on prod:
~90 seconds (GH Action ≈45 s + Vercel ≈45 s, sequential because Vercel
deploy is triggered by the GH Action's commit).

## Debugging a broken render

1. **GH Action `Build frontend` step red:** check the Puppeteer trace in
   the Actions log. Common causes: a route component crashed at mount
   (look for `[prerender]   page error: ...`), a `networkidle0` timeout
   from an analytics request, an exception in `useHeadMeta`.
2. **GH Action `Smoke-check` step red ("No <h1>"):** the route rendered
   but produced an empty body. Likely the route is `React.lazy`'d and
   the chunk didn't load before `networkidle0` fired — eager-import it
   in `App.tsx`, or extend `POST_RENDER_SETTLE_MS`.
3. **Vercel deploy green but `curl /` returns empty `<div id="root">`:**
   the snapshot copy didn't run, OR `public/prerendered/` is missing from
   the deployed commit. Check `vercel.json` still has the
   `build.env.SKIP_PRERENDER = "1"` block, and that the GH Action has
   actually pushed at least once since the last force-rewrite of main.
4. **Hydration mismatch warnings in browser console after Vercel deploy:**
   client-side React renders different content than what's in the
   prerendered HTML. Common culprits: `Date.now()`, `Math.random()`,
   `localStorage` reads, feature flags. Move those into `useEffect`.
5. **Asset 404 in browser after deploy:** the snapshot HTML references
   asset hashes from an older build that no longer exist in `dist/`.
   This happens if Vercel's bundled-asset hashes drift from the GH Action's
   hashes (different Node minor, different `npm install` resolution).
   Workarounds: pin `node-version` exactly across both runners + commit
   `package-lock.json`. Long-term fix: configure Vite to emit stable
   filenames, or post-process snapshot HTML to rewrite asset URLs to
   match the current build's hashes. Open a ticket if this happens.
6. **Local repro of the deploy flow:**
   ```bash
   cd stavagent-portal/frontend
   # Step 1: simulate GH Action — full build with real Puppeteer
   npm run build
   cp dist/index.html         public/prerendered/index.html
   cp dist/en/index.html      public/prerendered/en/index.html
   cp dist/team/index.html    public/prerendered/team/index.html
   cp dist/en/team/index.html public/prerendered/en/team/index.html
   # Step 2: simulate Vercel — SKIP_PRERENDER copies snapshot
   rm -rf dist
   SKIP_PRERENDER=1 npm run build
   ls -la dist/index.html dist/team/index.html
   grep -c '<h1' dist/index.html dist/team/index.html  # both should be ≥ 1
   ```

## History

| Date | What changed |
|---|---|
| 2026-05-08 (Gate 4) | Initial puppeteer + sirv post-build prerender for `/` |
| 2026-05-09 (Gate 10) | Added `/team` and `/en/team` to allow-list |
| 2026-05-10 (Gate 11) | Added `/en/`; hreflang via `useHeadMeta` hook |
| 2026-05-12 (PR #1126) | Swapped `puppeteer` → `@sparticuz/chromium` + `puppeteer-core` to try to fix Vercel build (didn't work — same libnss3 issue) |
| 2026-05-12 (this rewrite) | Moved prerender to GitHub Action; Vercel uses committed snapshot via SKIP_PRERENDER branch in `scripts/prerender.mjs` |

## Why not Astro / Next.js (still)

Migration scope is too large for the v3.2 → Cemex CSC 28.06 deadline.
The snapshot-based prerender gives 95% of the SEO benefit at <1% of the
migration cost. A proper SSG refactor is parked as a backlog item for
post-Cemex.
