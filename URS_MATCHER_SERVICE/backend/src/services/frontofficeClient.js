/**
 * ÚRS Frontoffice catalog client.
 *
 * podminky.urs.cz is a SPA — a plain HTML fetch of an /item/... URL returns the
 * empty JS shell, and a `site:podminky.urs.cz` web search (Perplexity/Brave) can't
 * index its dynamic content, so both returned EMPTY_RESULT. The SPA actually reads
 * the catalog from a public JSON backend on a sibling Cloud Run service:
 *
 *   GET {BASE}/v1/search?versionId=<V>&query=<Q>&textsPage=1&categoriesPage=1&itemsPage=1&limit=<N>
 *   GET {BASE}/v1/autocomplete?query=<Q>
 *
 * These are "capability URLs": no cookie, no Authorization — access is scoped purely
 * by the `versionId` (a catalog-release id) passed as a query param. That means a
 * server-side client can read the real catalog directly and deterministically
 * (confidence 1.0 on an exact code), instead of guessing via the web.
 *
 * Response shape (from a live /v1/search on code 711113127):
 *   { "advancedSearch": { "items": [
 *       { "code":"711113127", "measureUnit":"m2",
 *         "description":"Izolace proti vlhkosti ...",
 *         "fullDescription":"Izolace proti zemní vlhkosti ...",
 *         "referenceCode":"711113127", "type":"REFERENTIAL",
 *         "catalogId":"...", "categoryId":"..." }, ... ],
 *       "metadata": { "totalItems": 3 } } }
 *   type: "REFERENTIAL" = base ÚRS code, "COMMERCIAL" = vendor variant (…​.SKA / .SMB).
 */

import { logger } from '../utils/logger.js';

const FRONTOFFICE_BASE =
  process.env.URS_FRONTOFFICE_URL || 'https://frontoffice-vqysm7dnza-ez.a.run.app';

// The catalog-release version id, scoped as a query param (not a session token).
// Overridable without a redeploy — when ÚRS publishes a new CS ÚRS release the id
// changes and this must track it (same worked-then-stops class as URS_BASE_URL in
// catalog.js). Auto-resolving it from GET /v1/version/metadata/<human-version> is a
// documented follow-up. Current live release: CS ÚRS 2026/II.
const VERSION_ID = process.env.URS_FRONTOFFICE_VERSION_ID || 'dsdCAHQZh6lFvriEi3aB';
const CATALOG_VERSION = process.env.URS_CATALOG_VERSION || 'CS_URS_2026_02';

const REQUEST_TIMEOUT_MS = 12000;

const BASE_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  // The API's CORS allow-list is podminky.urs.cz; a browser needs these, and a
  // server-to-server call sends them so any soft Origin/Referer gate is satisfied.
  Origin: 'https://podminky.urs.cz',
  Referer: 'https://podminky.urs.cz/',
  'Accept-Language': 'cs',
  'User-Agent': 'StavAgent/1.0 (construction cost estimator)',
};

/**
 * GET a frontoffice URL and parse JSON. Never throws — returns null on any failure
 * (network, timeout, non-2xx, bad JSON) so the caller degrades to other retrievers.
 * @param {string} url
 * @param {typeof fetch} [fetchImpl] injectable for tests
 * @returns {Promise<any|null>}
 */
async function getJson(url, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: BASE_HEADERS, signal: controller.signal });
    if (!res.ok) {
      logger.warn(`[Frontoffice] ${res.status} for ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    logger.warn(`[Frontoffice] request failed for ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Case/space-insensitive equality for catalog codes. */
function codeEquals(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
}

/**
 * Normalize one raw frontoffice item to the candidate shape used across the matcher.
 * @param {object} item raw item from advancedSearch.items[]
 * @param {string} query original query (to detect an exact-code hit)
 */
function normalizeItem(item, query) {
  const code = item.code || item.referenceCode || null;
  const refCode = item.referenceCode || code;
  const isReferential = item.type === 'REFERENTIAL';
  // Exact = the item's OWN code equals the query. A COMMERCIAL variant shares the
  // base referenceCode but is not itself the queried code, so it ranks one tier down.
  const isExactCode = codeEquals(code, query);
  const isVariantOfQuery = !isExactCode && codeEquals(refCode, query);

  // Real catalog hits, never web guesses. Exact code = authoritative (1.0); a
  // text-search hit is a real catalog item but relevance is the engine's ranking, so
  // keep it high-but-below the 0.85 auto-learn gate (only exact codes get cached).
  let confidence;
  let matchKind;
  if (isExactCode) {
    confidence = 1.0;
    matchKind = 'exact_code';
  } else if (isVariantOfQuery) {
    confidence = 0.9;
    matchKind = 'code_variant';
  } else {
    confidence = isReferential ? 0.8 : 0.75;
    matchKind = 'catalog_text';
  }

  return {
    urs_code: code,
    urs_name: item.description || null,
    description: item.description || null,
    full_description: item.fullDescription || null,
    unit: item.measureUnit || null,
    reference_code: refCode,
    item_type: item.type || null,
    confidence,
    source: 'urs_frontoffice',
    catalog: 'urs',
    catalog_version: CATALOG_VERSION,
    match_kind: matchKind,
    is_web_suggestion: false,
  };
}

/**
 * Search the ÚRS catalog directly via the frontoffice backend.
 * @param {string} query code or Czech work description
 * @param {{limit?: number, fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<Array>} normalized candidates (REFERENTIAL first, then COMMERCIAL),
 *   empty array on any failure.
 */
export async function searchCatalog(query, opts = {}) {
  const { limit = 20, fetchImpl } = opts;
  if (!query || typeof query !== 'string' || !query.trim()) return [];

  const params = new URLSearchParams({
    versionId: VERSION_ID,
    query: query.trim(),
    textsPage: '1',
    categoriesPage: '1',
    itemsPage: '1',
    limit: String(limit),
  });
  const url = `${FRONTOFFICE_BASE}/v1/search?${params.toString()}`;

  const json = await getJson(url, fetchImpl);
  const items = json?.advancedSearch?.items || json?.simpleSearch?.items || [];
  if (!Array.isArray(items) || items.length === 0) return [];

  const normalized = items
    .filter((it) => it && (it.code || it.referenceCode))
    .map((it) => normalizeItem(it, query));

  // REFERENTIAL (base ÚRS code) before COMMERCIAL (vendor variant), each already
  // ordered by the catalog's own relevance ranking.
  return normalized.sort((a, b) => {
    const ar = a.item_type === 'REFERENTIAL' ? 0 : 1;
    const br = b.item_type === 'REFERENTIAL' ? 0 : 1;
    if (ar !== br) return ar - br;
    return b.confidence - a.confidence;
  });
}

/**
 * Autocomplete suggestions for a code/text prefix.
 * @param {string} query
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<string[]>}
 */
export async function autocomplete(query, opts = {}) {
  const { fetchImpl } = opts;
  if (!query || typeof query !== 'string' || !query.trim()) return [];
  const url = `${FRONTOFFICE_BASE}/v1/autocomplete?query=${encodeURIComponent(query.trim())}`;
  const json = await getJson(url, fetchImpl);
  const suggestions = json?.suggestions;
  return Array.isArray(suggestions) ? suggestions.filter((s) => typeof s === 'string') : [];
}

export const __config = { FRONTOFFICE_BASE, VERSION_ID, CATALOG_VERSION };
