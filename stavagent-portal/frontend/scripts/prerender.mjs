#!/usr/bin/env node
/**
 * Post-build prerender for StavAgent Portal landing.
 *
 * Wakes Puppeteer + a tiny sirv static server after `vite build`, navigates
 * to each allow-listed route, captures the fully-hydrated HTML, and writes
 * it back to `dist/<route>/index.html`. Vercel then serves the static
 * file for that route directly (static-file precedence beats the SPA
 * rewrite in vercel.json), so a `curl /` returns rendered <h1> + meta
 * instead of an empty <div id="root">.
 *
 * Why a custom script and not vite-plugin-prerender-spa or react-snap:
 *   1. Explicit allow-list — auth-gated routes (/portal/*, /cabinet/*,
 *      /admin/*) MUST NOT be prerendered. A custom array makes the
 *      surface obvious and grep-friendly.
 *   2. No third-party plugin to maintain — same Puppeteer underneath
 *      either way; this is just a thin wrapper.
 *   3. Easy to extend: when /team and /en/* land in Gates 10/11, add
 *      one or two strings to ROUTES_TO_PRERENDER below.
 *
 * Skip the prerender step (e.g. for fast local builds):
 *   SKIP_PRERENDER=1 npm run build
 */

// puppeteer + sirv are intentionally loaded via dynamic import inside main()
// so that `SKIP_PRERENDER=1 node scripts/prerender.mjs` works even when those
// packages aren't installed (e.g. fast dev sandboxes that skip devDeps).
// ES module static imports are hoisted and evaluated before any code in the
// module body, so a top-level `import puppeteer from 'puppeteer'` would
// crash with ERR_MODULE_NOT_FOUND before the SKIP_PRERENDER check could run.
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Config ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '../dist');

/**
 * EXPLICIT ALLOW-LIST. Each string is a route path Puppeteer will visit.
 * The captured HTML lands at `dist/<route>/index.html`. The leading slash
 * is required; the root '/' writes back to `dist/index.html`.
 *
 * Auth-gated routes (/portal/*, /cabinet/*, /admin/*, /dashboard, etc.)
 * MUST NOT be in this list — they would either flash unauthenticated
 * content for crawlers or leak page-shape information. Public auth
 * pages (/login, /register, /verify, /forgot-password, /reset-password)
 * are also kept out of this list because they only matter to logged-in
 * flows; the prerendered '/' is what Google indexes.
 *
 * When /team ships in Gate 10, add '/team'.
 * When /en/ ships in Gate 11, add '/en/' (and update for /en/team etc).
 */
const ROUTES_TO_PRERENDER = ['/'];

const NAVIGATION_TIMEOUT_MS = 30_000;
const POST_RENDER_SETTLE_MS = 200; // small buffer for final synchronous renders

// ─── Skip switch ───────────────────────────────────────────────────────────

if (process.env.SKIP_PRERENDER === '1') {
  console.log('[prerender] Skipped (SKIP_PRERENDER=1).');
  process.exit(0);
}

// ─── Static server ─────────────────────────────────────────────────────────

async function startStaticServer(sirvFactory) {
  // single:false so unmapped paths 404 honestly — we deliberately want
  // puppeteer to notice if it asked for a route that doesn't exist in
  // the build (ROUTES_TO_PRERENDER must match real Vite-served paths).
  const handler = sirvFactory(DIST_DIR, { single: false, dev: false });
  const server = createServer(handler);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

// ─── Render one route ──────────────────────────────────────────────────────

async function renderRoute(browser, baseUrl, route) {
  const fullUrl = baseUrl + route;
  console.log(`[prerender] Rendering ${route} (${fullUrl})...`);

  const page = await browser.newPage();
  // Don't ship console noise from the app to the build log.
  page.on('pageerror', (err) =>
    console.warn(`[prerender]   page error: ${err.message}`),
  );

  await page.goto(fullUrl, {
    waitUntil: 'networkidle0',
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  // Tiny settle for any synchronous post-mount work.
  await new Promise((r) => setTimeout(r, POST_RENDER_SETTLE_MS));

  const html = await page.content();
  await page.close();

  // Decide the output path. '/' overwrites dist/index.html; '/team'
  // writes dist/team/index.html; '/en/' writes dist/en/index.html.
  const cleanRoute = route.replace(/^\/|\/$/g, '');
  const outDir = cleanRoute === '' ? DIST_DIR : join(DIST_DIR, cleanRoute);
  const outFile = join(outDir, 'index.html');

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, html);

  console.log(
    `[prerender]   wrote ${outFile.replace(DIST_DIR, 'dist')} ` +
      `(${html.length.toLocaleString('en-US')} bytes)`,
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('[prerender] Starting...');
  const t0 = Date.now();

  // Dynamic import — see top-of-file note about SKIP_PRERENDER ordering.
  const { default: puppeteer } = await import('puppeteer');
  const { default: sirv } = await import('sirv');

  const { server, baseUrl } = await startStaticServer(sirv);
  console.log(`[prerender] Static server listening on ${baseUrl}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    // --no-sandbox required because Vercel build containers run as root.
    // --disable-setuid-sandbox is the matching pair for some Linux distros.
    // --disable-dev-shm-usage avoids /dev/shm exhaustion on small CI workers.
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    for (const route of ROUTES_TO_PRERENDER) {
      await renderRoute(browser, baseUrl, route);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[prerender] Done in ${elapsed}s.`);
}

main().catch((err) => {
  console.error('[prerender] FAILED:', err);
  process.exit(1);
});
