/**
 * Hermetic tests for the ÚRS frontoffice catalog client.
 *
 * Fixtures are the REAL response bodies captured from the live frontoffice API
 * (GET /v1/search?...&query=711113127 and GET /v1/autocomplete?query=711113127).
 * `fetch` is injected via opts.fetchImpl — no network, no DB.
 */
import { searchCatalog, autocomplete } from '../src/services/frontofficeClient.js';

// Verbatim /v1/search body for query "711113127" (3 items: 1 REFERENTIAL + 2 COMMERCIAL).
const SEARCH_BODY = {
  simpleSearch: null,
  advancedSearch: {
    categories: [],
    texts: [],
    items: [
      {
        code: '711113127',
        measureUnit: 'm2',
        description:
          'Izolace proti vlhkosti na svislé ploše za studena těsnicí stěrkou jednosložkovou na bázi cementu',
        fullDescription:
          'Izolace proti zemní vlhkosti natěradly a tmely za studena na ploše svislé S těsnicí stěrkou jednosložkovu na bázi cementu',
        catalogId: 'buc2NFowlXrNSD9nrz5y',
        categoryId: 'I3mUIHy6iW6HteuOqTcY',
        categoryMarvinId: '4674',
        referenceCode: '711113127',
        type: 'REFERENTIAL',
      },
      {
        code: '711113127.SKA',
        measureUnit: 'm2',
        description: 'Izolace ... SCHÖNOX 1K DS PREMIUM',
        catalogId: 'buc2NFowlXrNSD9nrz5y',
        categoryId: 'I3mUIHy6iW6HteuOqTcY',
        categoryMarvinId: '4674',
        referenceCode: '711113127',
        type: 'COMMERCIAL',
      },
      {
        code: '711113127.SMB',
        measureUnit: 'm2',
        description: 'Izolace ... SCHOMBURG AQUAFIN-1K',
        catalogId: 'buc2NFowlXrNSD9nrz5y',
        categoryId: 'I3mUIHy6iW6HteuOqTcY',
        categoryMarvinId: '4674',
        referenceCode: '711113127',
        type: 'COMMERCIAL',
      },
    ],
    metadata: { totalTexts: 0, totalCategories: 0, totalItems: 3 },
  },
};

const AUTOCOMPLETE_BODY = { suggestions: ['711113127'] };

/** Build an injectable fetch that returns a fixed JSON body. */
function fetchReturning(body, { ok = true, status = 200 } = {}) {
  return async (_url, _opts) => ({ ok, status, json: async () => body });
}

/** An injectable fetch that records the URL it was called with. */
function fetchSpy(body) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => body };
  };
  return { impl, calls };
}

describe('searchCatalog', () => {
  test('exact code query → REFERENTIAL first at confidence 1.0, real catalog (not web)', async () => {
    const out = await searchCatalog('711113127', { fetchImpl: fetchReturning(SEARCH_BODY) });
    expect(out).toHaveLength(3);
    const top = out[0];
    expect(top.urs_code).toBe('711113127');
    expect(top.item_type).toBe('REFERENTIAL');
    expect(top.unit).toBe('m2');
    expect(top.confidence).toBe(1.0);
    expect(top.match_kind).toBe('exact_code');
    expect(top.source).toBe('urs_frontoffice');
    expect(top.is_web_suggestion).toBe(false);
    expect(top.full_description).toMatch(/zemní vlhkosti/);
  });

  test('REFERENTIAL is ranked before COMMERCIAL variants; variants score one tier down', async () => {
    const out = await searchCatalog('711113127', { fetchImpl: fetchReturning(SEARCH_BODY) });
    expect(out.map((r) => r.item_type)).toEqual(['REFERENTIAL', 'COMMERCIAL', 'COMMERCIAL']);
    // .SKA / .SMB share referenceCode 711113127 but are not the queried code themselves.
    expect(out[1].urs_code).toBe('711113127.SKA');
    expect(out[1].confidence).toBe(0.9);
    expect(out[1].match_kind).toBe('code_variant');
    expect(out[2].urs_code).toBe('711113127.SMB');
  });

  test('text query (not a code) → real catalog item, high-but-below the auto-learn gate', async () => {
    const out = await searchCatalog('Izolace proti vlhkosti svislá', {
      fetchImpl: fetchReturning(SEARCH_BODY),
    });
    expect(out[0].confidence).toBe(0.8); // REFERENTIAL text hit
    expect(out[0].confidence).toBeLessThan(0.85); // never auto-learned on fuzzy text
    expect(out[0].match_kind).toBe('catalog_text');
  });

  test('sends versionId + query + paging to /v1/search', async () => {
    const spy = fetchSpy(SEARCH_BODY);
    await searchCatalog('beton C25/30', { fetchImpl: spy.impl });
    expect(spy.calls).toHaveLength(1);
    const url = spy.calls[0];
    expect(url).toContain('/v1/search?');
    expect(url).toContain('versionId=');
    expect(url).toContain('query=beton+C25%2F30');
    expect(url).toContain('itemsPage=1');
  });

  test('degrades to [] on non-2xx, network error, and empty items', async () => {
    expect(await searchCatalog('x', { fetchImpl: fetchReturning({}, { ok: false, status: 503 }) })).toEqual([]);
    const throwing = async () => {
      throw new Error('ECONNRESET');
    };
    expect(await searchCatalog('x', { fetchImpl: throwing })).toEqual([]);
    expect(
      await searchCatalog('x', { fetchImpl: fetchReturning({ advancedSearch: { items: [] } }) })
    ).toEqual([]);
  });

  test('empty / invalid query → [] without a request', async () => {
    const spy = fetchSpy(SEARCH_BODY);
    expect(await searchCatalog('   ', { fetchImpl: spy.impl })).toEqual([]);
    expect(await searchCatalog(null, { fetchImpl: spy.impl })).toEqual([]);
    expect(spy.calls).toHaveLength(0);
  });
});

describe('autocomplete', () => {
  test('returns the suggestions array', async () => {
    const out = await autocomplete('711113127', { fetchImpl: fetchReturning(AUTOCOMPLETE_BODY) });
    expect(out).toEqual(['711113127']);
  });

  test('degrades to [] on failure', async () => {
    const throwing = async () => {
      throw new Error('timeout');
    };
    expect(await autocomplete('x', { fetchImpl: throwing })).toEqual([]);
  });
});
