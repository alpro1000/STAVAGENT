// [Stage 1] Scope-Router (upstream). scope text → branch (section_code).
// Keeps the monolit branch from ever touching interiér. Honest-blank on unknown.
//
// Branches:
//   'interier_psv' — handled by this sandbox's template library
//   'monolit'      — existing production branch (OUT OF SANDBOX SCOPE — never applied here)
//   null           — no template for this section → honest-blank (NOT monolit fallback)

const MONOLIT_KEYWORDS = ['beton', 'bednění', 'bedneni', 'výztuž', 'vyztuz', 'monolit', 'základová deska', 'mostovk', 'pilíř', 'opěr'];
const INTERIER_KEYWORDS = [
  'stěn', 'sten', 'štuk', 'stuk', 'perlink', 'nátěr', 'nater', 'malb', 'omítk',
  'koupeln', 'wc', 'obklad', 'dlažb', 'dlazb', 'vana', 'sprch', 'sanuzel',
  'vinyl', 'parket', 'podlah', 'sádrokarton', 'sadrokarton', 'sdk', 'podhled',
  'elektr', 'kotel', 'plynov', 'okn', 'dveř', 'dver', 'schodišt', 'schodist',
  'doprav', 'odvoz', 'suť', 'sut', 'administrativ', 'hodinov', 'demontáž', 'demontaz',
];

function hits(text, keywords) {
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

// Route a single scope section (or arbitrary text) to a branch + confidence.
export function routeScope(text) {
  if (hits(text, MONOLIT_KEYWORDS) && !hits(text, INTERIER_KEYWORDS)) {
    return { branch: 'monolit', confidence: 0.9, matched: 'monolit_keyword' };
  }
  if (hits(text, INTERIER_KEYWORDS)) {
    return { branch: 'interier_psv', confidence: 0.95, matched: 'interier_keyword' };
  }
  // No deterministic branch. Honest-blank — caller MUST NOT fall back to monolit.
  // (LLM fallback would sit here, returning confidence 0.70 WITH a flag — out of sandbox scope.)
  return { branch: null, confidence: 0, matched: null, honest_blank: true };
}

// Route every corpus scope section; the sandbox's sections are interiér by construction,
// but the router proves it would split off monolit/unknown if they appeared.
export function routeSections(corpus) {
  return corpus.scope_sections.map((s) => ({
    id: s.id,
    label: s.label,
    route: routeScope([s.label, ...(s.keywords || [])].join(' ')),
  }));
}
