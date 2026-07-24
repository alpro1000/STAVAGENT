/**
 * §5.2 Level 1 — short frontoffice queries built from intent fields.
 *
 * The live frontoffice answers empty on long verbatim lines (0/47 measured);
 * the short query carries action + object + production-method tokens with
 * their ORIGINAL diacritics (the catalog server owns Czech; folding is our
 * internal convention only).
 */

import { buildFrontofficeQuery } from '../src/services/ursMatcher.js';
import { extractIntent } from '../src/services/intentExtractor.js';

function build(text) {
  return buildFrontofficeQuery(text, extractIntent(text));
}

test('long 174-family line yields a short raw-token query incl. the method', () => {
  const q = build(
    'Zásyp sypaninou z jakékoliv horniny ručně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách'
  );
  expect(q).not.toBeNull();
  const words = q.split(' ');
  expect(words.length).toBeLessThanOrEqual(5);
  expect(q).toContain('Zásyp');          // action, original diacritics
  expect(q).toContain('ručně');          // production-method differentiator
  expect(q.length).toBeLessThan(60);
});

test('the strojně sibling line carries strojně, not ručně', () => {
  const q = build(
    'Zásyp sypaninou z jakékoliv horniny strojně s uložením výkopku ve vrstvách se zhutněním jam, šachet, rýh nebo kolem objektů v těchto vykopávkách'
  );
  expect(q).toContain('strojně');
  expect(q).not.toContain('ručně');
});

test('short lines return null — the legacy full-text call is untouched', () => {
  expect(build('Podkladní beton C25/30')).toBeNull();
  expect(build('174111101')).toBeNull();   // bare code lookup stays exact
});

test('a long line with no extractable intent falls back to null', () => {
  expect(build('Xq wz yy zz aa bb cc dd ee ff gg hh')).toBeNull();
});
