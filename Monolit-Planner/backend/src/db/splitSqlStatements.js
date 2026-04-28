/**
 * SQL statement splitter that respects PostgreSQL dollar-quoted strings.
 *
 * Background: previous implementation used `sql.split(';')` which is
 * naive — semicolons INSIDE a `$$ ... $$` (or tagged `$body$ ... $body$`)
 * block are part of the quoted body, NOT statement terminators. The
 * `DO $$ BEGIN ... ALTER TABLE ...; ... END $$;` migration in
 * schema-postgres.sql contains 2 inner semicolons; naive split chopped
 * the block into fragments, PostgreSQL parser threw "unterminated
 * dollar-quoted string" (code 42601), the migration aborted, ALL
 * subsequent migration statements (110+) silently never ran. Server
 * stayed alive thanks to try/catch in server.js but Cloud SQL ended
 * up in partial-schema state. Diagnosed in production logs of Cloud
 * Run revision stavagent-portal-backend-00255-srx on 2026-04-28.
 *
 * This implementation walks the input character-by-character and
 * tracks open dollar-quote tags. It also skips over PostgreSQL
 * single-line (`-- … EOL`) and multi-line (`/* … *​/`) comments and
 * single-quoted string literals so semicolons embedded in any of
 * those contexts don't trigger a split.
 *
 * What we DO handle:
 *   - Untagged $$ ... $$ blocks
 *   - Tagged $tag$ ... $tag$ blocks (tag = identifier chars)
 *   - Mixed tags in same file (each opens/closes only against its own tag)
 *   - Single-quoted string literals 'with ; semicolons'
 *   - 'Escaped quote like ''this''' inside a string literal (PG style)
 *   - `-- single-line comment` to end of line
 *   - `/* multi-line comment *​/`
 *
 * What we do NOT handle (acceptable trade-offs for migration files):
 *   - Truly nested $tag1$ ... $tag2$ ... $tag2$ ... $tag1$ — the
 *     outer block sees the inner closer and exits early. PostgreSQL
 *     allows this construct but it's vanishingly rare in schema
 *     scripts; if a migration ever uses it, the test suite will catch
 *     the regression once a fixture is added.
 *   - Quoted identifiers `"col;name"` (very unusual)
 *   - Backtick literals (PG doesn't support them anyway)
 *
 * Pure function — no I/O, no module state. Safe to call repeatedly.
 *
 * @param {string} sql Full SQL source (one or more statements).
 * @returns {string[]} Trimmed non-empty statement strings, in source
 *                    order, with dollar-quoted bodies kept intact.
 */
export function splitSqlStatements(sql) {
  if (typeof sql !== 'string' || sql.length === 0) return [];

  const out = [];
  let buf = '';
  // Active context. Only ONE of these is non-null at a time.
  let dollarTag = null;     // e.g. '$$' or '$body$' when inside a dollar-quoted string
  let inLineComment = false; // -- ... \n
  let inBlockComment = false; // /* ... */
  let inString = false;      // single-quoted string

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    // --- 1. End-of-context detection (when something is open) ---

    if (inLineComment) {
      buf += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (ch === '*' && next === '/') { buf += next; i++; inBlockComment = false; }
      continue;
    }
    if (inString) {
      buf += ch;
      if (ch === "'") {
        // PG escape: '' inside string is a literal single quote.
        if (next === "'") { buf += next; i++; }
        else inString = false;
      }
      continue;
    }
    if (dollarTag !== null) {
      // Look for the matching closer at this position.
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
        continue;
      }
      buf += ch;
      continue;
    }

    // --- 2. Outside any context — look for new openers and ; splits ---

    // Line comment: -- ...
    if (ch === '-' && next === '-') {
      buf += ch + next;
      i++;
      inLineComment = true;
      continue;
    }
    // Block comment: /* ... */
    if (ch === '/' && next === '*') {
      buf += ch + next;
      i++;
      inBlockComment = true;
      continue;
    }
    // Single-quoted string: '...'
    if (ch === "'") {
      buf += ch;
      inString = true;
      continue;
    }
    // Dollar-quoted: $$ or $tag$
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (m) {
        dollarTag = m[0]; // includes the $ delimiters, e.g. '$$' or '$body$'
        buf += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }
    // Statement terminator
    if (ch === ';') {
      const trimmed = buf.trim();
      if (trimmed.length > 0) out.push(trimmed);
      buf = '';
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}
