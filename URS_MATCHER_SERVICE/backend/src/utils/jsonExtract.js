/**
 * Robust JSON extraction from LLM / Perplexity responses (audit M7).
 *
 * The old pattern `text.match(/\{[\s\S]*\}/)` grabs from the FIRST '{' to the LAST
 * '}' in the whole string. As soon as the model wraps the JSON in prose, adds
 * citations like [1], or emits more than one brace group, that greedy span is not
 * valid JSON and JSON.parse throws → the caller silently returns [] / null. This is
 * a prime "worked at first, then stopped" cause: it breaks the moment the model's
 * output format drifts.
 *
 * extractJson() scans for every balanced {...} / [...] span (respecting string
 * literals + escapes), parses each, and returns the LONGEST parseable one — i.e.
 * the outermost real payload, not a trailing "[1]" citation or a nested fragment.
 */

/**
 * @param {string} text - raw model output (may contain prose / ```json fences)
 * @returns {any|null} parsed JSON value, or null if none found/parseable
 */
export function extractJson(text) {
  if (!text || typeof text !== 'string') return null;

  // Prefer a fenced ```json ... ``` block if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fenced ? fenced[1] : text;

  let best = null;
  let bestLen = 0;

  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    let i = 0;
    while (i < src.length) {
      const start = src.indexOf(open, i);
      if (start === -1) break;
      const span = balancedSpan(src, start, open, close);
      if (span && span.length > bestLen) {
        try {
          const parsed = JSON.parse(span);
          best = parsed;
          bestLen = span.length;
        } catch {
          /* balanced but not valid JSON — ignore */
        }
      }
      i = start + 1;
    }
  }
  return best;
}

/**
 * Return the substring from `start` (an opener) to its matching balanced closer,
 * respecting string literals and escapes; or null if never balanced.
 */
function balancedSpan(src, start, open, close) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < src.length; j++) {
    const ch = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  return null;
}
