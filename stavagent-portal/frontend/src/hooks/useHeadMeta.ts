/**
 * useHeadMeta — per-page <head> metadata manager.
 *
 * SPA pages mutate global <head> state. To prevent duplicate <link rel="canonical">
 * and overlapping hreflang link tags between client-side route changes, this
 * hook owns canonical + hreflang for the current page exclusively:
 *
 *   - On mount: removes any pre-existing canonical + hreflang link tags, then
 *     inserts the page-specific ones.
 *   - On unmount or arg change: removes the inserted tags so the next page's
 *     hook starts with a clean head.
 *
 * The static index.html shell carries the BASELINE canonical for / (landing),
 * which is what crawlers see before JS hydrates. This hook then replaces that
 * baseline with the page-specific values during render. The postbuild prerender
 * (scripts/prerender.mjs) captures the post-mount state, so each generated
 * dist/<route>/index.html ships with the correct canonical + hreflang set.
 *
 * Usage:
 *   useHeadMeta({
 *     canonical: 'https://www.stavagent.cz/team',
 *     hreflangs: {
 *       cs: 'https://www.stavagent.cz/team',
 *       en: 'https://www.stavagent.cz/en/team',
 *     },
 *   });
 *
 * x-default is automatically synthesized as the cs URL (Czech is the primary
 * locale per Gate 11 spec). Override by passing it explicitly in hreflangs.
 */

import { useEffect } from 'react';

interface UseHeadMetaArgs {
  canonical: string;
  hreflangs: {
    cs: string;
    en: string;
    'x-default'?: string;
  };
}

// Marker so we only touch link tags this hook created, never the user's other
// link tags (favicon, manifest, preload, etc).
const MANAGED_ATTR = 'data-managed-by-usehead';

function removeManagedLinks() {
  const managed = document.head.querySelectorAll(`link[${MANAGED_ATTR}]`);
  managed.forEach((node) => node.remove());
}

function upsertCanonical(href: string) {
  // Replace any existing canonical (including the one baked into index.html)
  // with a managed copy pointing at the current page.
  document.head
    .querySelectorAll('link[rel="canonical"]')
    .forEach((node) => node.remove());
  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', href);
  link.setAttribute(MANAGED_ATTR, '1');
  document.head.appendChild(link);
}

function appendHreflang(lang: string, href: string) {
  const link = document.createElement('link');
  link.setAttribute('rel', 'alternate');
  link.setAttribute('hreflang', lang);
  link.setAttribute('href', href);
  link.setAttribute(MANAGED_ATTR, '1');
  document.head.appendChild(link);
}

export function useHeadMeta({ canonical, hreflangs }: UseHeadMetaArgs) {
  useEffect(() => {
    // Wipe any previously-managed tags from a prior page's hook run. Belt and
    // braces — the unmount cleanup of the previous render should have removed
    // them, but client-side fast-refresh / Strict Mode double-invoke can leave
    // stale managed tags during dev.
    removeManagedLinks();

    upsertCanonical(canonical);

    appendHreflang('cs', hreflangs.cs);
    appendHreflang('en', hreflangs.en);
    appendHreflang('x-default', hreflangs['x-default'] ?? hreflangs.cs);

    return () => {
      removeManagedLinks();
    };
  }, [canonical, hreflangs.cs, hreflangs.en, hreflangs['x-default']]);
}
