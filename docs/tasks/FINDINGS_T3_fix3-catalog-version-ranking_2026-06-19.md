# FINDINGS — T3 RECON (Fix 3): hardcoded `source` + keyword price tie-break

> **Task:** T3 recon for Fix 3. Pin exact code locations of both symptoms, verify the
> tie-break behavior BY CODE, confirm Fix 4 entanglement, produce a fix plan. **Recon only —
> no prod-code changes, no price changes. Stop at gate.**
> **Branch:** `claude/fix3-recon` (from `origin/main` @ `083b6f07`)
> **Demo case:** `find_otskp_code("beton mostních pilířů C30/37")`
> **Date:** 2026-06-19

---

## TL;DR (BY CODE)

| Question | Answer |
|---|---|
| 1. Hardcoded `source "OTSKP 1/2025"` — where? | `app/mcp/tools/otskp.py:191` (exact-code branch) + `app/mcp/tools/otskp.py:237` (keyword/embeddings branch). Static string literal on BOTH. |
| 1b. Does a real `catalog_version` exist in the store? | **YES.** SQLite `otskp` table has a `catalog_version TEXT` column (ingest writes it, `ingest_otskp_catalog.py:144-151`); `otskp_embeddings` has it too (`ingest_otskp_catalog.py:216-222`). Default value = `settings.OTSKP_CATALOG_VERSION = "OTSKP 2026"` (`config.py:139-142`). The readers just never SELECT it. |
| 2. Keyword SQL `ORDER BY cena`? | **YES** — `app/pricing/otskp_engine.py:104`: `"WHERE nazev LIKE ? ORDER BY cena LIMIT ?"`. |
| 2b. Does `deterministic_ranker` break equal-confidence ties by price? | **YES (BY CODE).** `catalog_matching.py:182-185` sort key is `(-_rank_score(c), -score, unit_price_czk asc)`. The 3rd/final key is `unit_price_czk` ascending. At equal `_rank_score` **and** equal `score`, the **cheaper** code sorts first. |
| 3. Is the version stamp detached from data on EVERY path? | **YES.** Exact-code, keyword, AND embeddings all drop the real `catalog_version` and the MCP tool overwrites with the constant. Unhardcoding it will EXPOSE the 2025/2026 split (validates Fix 3 → Fix 4 ordering). |

---

## 1. Symptom 1 — hardcoded `source` (exact file:line + quotes)

### 1.1 Exact-code lookup path — `app/mcp/tools/otskp.py:184-192`
```python
return {
    "results": [{
        "code": item.code,
        "description": item.nazev,
        "unit": item.mj,
        "unit_price_czk": item.cena,
        "confidence": 1.0,
        "source": "OTSKP 1/2025",        # ← line 191: HARDCODED constant
    }],
    ...
}
```
This is the path the STATUS proof hit (`code=334325` → conf 1.0 + that string). The `item`
(an `OTSKPItem`, `otskp_engine.py:36-41`) carries `code/nazev/mj/cena/spec` — **no version field**,
so even if you wanted to stamp the real one here, the reader doesn't load it (see §3.1).

### 1.2 Keyword / embeddings path — `app/mcp/tools/otskp.py:226-243`
```python
return {
    "results": [
        {
            "code": c["code"],
            "description": c["description"],
            ...
            "confidence": c["confidence"],
            "source": "OTSKP 1/2025",     # ← line 237: HARDCODED constant
            "work_type": c["work_type"],
            ...
        }
        for c in ranked
    ],
    ...
}
```
Note the irony: the docstring (`otskp.py:146` — *"the catalog version is stamped in result
provenance"*) and the inline comments (`otskp.py:233-235`) describe an honest provenance, but
the field is a literal. The chain candidate `c` does NOT carry `catalog_version` either (it
flows from `catalog_matching.match_catalog`, which never sets it — see §3.2/§3.3).

### 1.3 Sibling constant (out of Fix-3 scope, note only)
`app/pricing/otskp_engine.py:59` — `PricedPolozka.price_source: str = "OTSKP 1/2025"`. This is the
**pricing-engine** dataclass default, not the MCP `find_otskp_code` response path. Same stale label;
listed so it isn't mistaken for an extra Fix-3 site or accidentally "fixed" into the ranking change.

---

## 2. Symptom 2 — ranking tie-break by price (answered BY CODE: YES)

The "похоже, ломает" from STATUS is now a code-grounded **YES** on two independent layers:

### 2.1 Keyword candidate SQL — `app/pricing/otskp_engine.py:98-107`
```python
def search(self, keyword: str, limit: int = 10) -> List[OTSKPItem]:
    """Fulltext search in names."""
    if not self._conn:
        return []
    rows = self._conn.execute(
        "SELECT code, nazev, mj, cena, spec FROM otskp "
        "WHERE nazev LIKE ? ORDER BY cena LIMIT ?",      # ← line 103-104: ORDER BY cena
        (f"%{keyword.upper()}%", limit)
    ).fetchall()
    return [OTSKPItem(**dict(r)) for r in rows]
```
Recall ordering is **by price ascending**. (The in-memory XML fallback `_InMemoryOTSKP.search`,
`otskp.py:124`, has the SAME price tie-break: `scored.sort(key=lambda x: (-x[0], x[1].get("cena", 0)))`.)
This only orders the *recall* set (later re-ranked), so on its own it is not the decisive bug — but
it bakes a price preference into the candidate stream before ranking and should go.

### 2.2 The decisive tie-break — `deterministic_ranker`, `app/services/catalog_matching.py:176-185`
```python
def _rank_score(c: dict) -> float:
    return c.get("confidence", 0.0) + (FAMILY_RANK_BONUS if c.get("family_match") else 0.0)


def deterministic_ranker(query: str, candidates: list[dict]) -> list[dict]:
    """Default ranker. Stable order: (confidence + family bonus) ↓, score ↓, cheaper first."""
    return sorted(
        candidates,
        key=lambda c: (-_rank_score(c), -c.get("score", 0.0), c.get("unit_price_czk") or 0.0),
    )                                                       # ← line 184: 3rd key = cena ASC
```
**Comparator BY CODE:** sort key is `(-_rank_score, -score, unit_price_czk)`. Element 3 is
`unit_price_czk` **ascending** — the explicit "cheaper first" fallback. So **equal confidence +
equal score → cheaper code wins**. This is a price tie-break by code, confirmed. (Its own docstring,
line 181, says "cheaper first".)

### 2.3 How this produces the observed demo regression
For `334325` (železobeton, 12 935 Kč) vs `334335` (předpjatý, 16 781 Kč) at **equal confidence 0.78**,
two outcomes are possible from the comparator, both code-grounded:
- If `score` (Jaccard `name_score`, `catalog_matching.py:136-141`) **also ties** → key 3 (cena ASC)
  decides → the **cheaper 334325 should win**. STATUS observed the opposite (334335 on top), which
  means the deciding key for that pair is **not** cena but **`score`** (key 2): the query string
  *"beton mostních pilířů C30/37"* shares more tokens with the předpjatý popis, so `-score` ranks
  334335 first. (Per STATUS §3, the top-8 were all embeddings rows, so confidence sits in the AI band
  and `family_match` likely ties — leaving `score` as the live discriminator there.)
- The bug Fix 3 must kill is structural regardless of which key fires in the demo: **price must not
  be a ranking signal at all** (neither as the SQL recall order nor as the ranker's final tie-break).
  The golden below pins the intended outcome so the fix is verifiable independent of the score path.

**Golden (from STATUS):** `C30/37 без předpjatý → 334325 (železobeton) первым`.

---

## 3. Fix 4 entanglement — version stamp detached from data on EVERY path (confirmed)

### 3.1 Exact-code reader drops version — `app/pricing/otskp_engine.py:87-96`
`OTSKPDatabase.get()` runs `"SELECT code, nazev, mj, cena, spec FROM otskp WHERE code=?"` — **no
`catalog_version`** in the SELECT, and `OTSKPItem` (lines 35-41) has no field for it. So the exact-code
branch physically cannot return the row's real version today.

### 3.2 Keyword reader drops version — `app/pricing/otskp_engine.py:98-107`
`search()` SELECT (line 103) is also `code, nazev, mj, cena, spec` — no `catalog_version`.

### 3.3 Embeddings reader drops version — `app/services/catalog_embeddings.py:28-52`
`_SEARCH_SQL` (lines 28-34) selects `code, popis, unit, unit_price_czk, similarity` — **no
`catalog_version`**, although the `otskp_embeddings` table HAS the column (ingest writes it,
`ingest_otskp_catalog.py:217-222`). `build_candidates_from_rows` (lines 43-51) carries no version.

### 3.4 The data DOES carry the real version (so unhardcoding exposes the split)
- SQLite build: `ingest_otskp_catalog.py:144-151` —
  `CREATE TABLE otskp (code TEXT PRIMARY KEY, nazev, mj, cena REAL, spec, catalog_version TEXT)`
  and every `INSERT` stamps `catalog_version` (default `settings.OTSKP_CATALOG_VERSION`).
- Embeddings: `ingest_otskp_catalog.py:216-222` upserts `catalog_version` per row.
- Setting: `config.py:139-142` — `OTSKP_CATALOG_VERSION` default **`"OTSKP 2026"`** (NOT `"1/2025"`).

**Conclusion:** the constant `"OTSKP 1/2025"` is both static AND stale vs the configured `"OTSKP 2026"`.
Reading the real per-row `catalog_version` will surface mixed 2025/2026 in the live output (keyword
store on one rebake, embeddings on another) — i.e. it **exposes Fix 4, not hides it**. The Fix 3 →
Fix 4 ordering in STATUS is validated by code.

---

## 4. FIX PLAN (prose, no code — for a follow-up implementation task)

> Touches **ranking + version stamp ONLY**. **Concrete prices are NOT changed** — `cena` /
> `unit_price_czk` values are read and returned exactly as today; they are only removed as a *sort
> signal* and a *version is read* from the same rows.

### Part A — Unhardcode `source` → stamp the real per-row `catalog_version`
1. **Make the readers carry the column.** Extend the SQLite reads in `OTSKPDatabase.get()` and
   `OTSKPDatabase.search()` to also SELECT `catalog_version`, and add a `catalog_version` field to
   `OTSKPItem` (default empty/None so a legacy DB without the column still loads — guard for the
   column's presence, since an old `otskp.db` predating the ingest rewrite lacks it). For the
   embeddings path, extend `_SEARCH_SQL` to SELECT `catalog_version` and thread it through
   `build_candidates_from_rows` onto the candidate dict.
2. **Thread it through the chain.** `match_catalog` candidate dicts should preserve `catalog_version`
   (passthrough, like `unit_price_czk`); no new gating/confidence logic.
3. **Stamp it at the MCP boundary.** In `app/mcp/tools/otskp.py`, replace the two literal
   `"source": "OTSKP 1/2025"` (lines 191 and 237) with the value read from the row that produced the
   result. Fallback chain when a row lacks the column: row's `catalog_version` → `settings.OTSKP_CATALOG_VERSION`.
   **Never** re-introduce a hardcoded date string.
4. **In-memory XML fallback** (`_InMemoryOTSKP`, `otskp.py:53-126`): it parses `2025_03_otskp.xml`
   and has no version field — give it a single derived `catalog_version` (from the configured setting
   or the filename) so this rarely-used fallback path is also honest, not stamped 1/2025.
5. **MCP-compat:** the response item keys asserted by `tests/test_mcp_compatibility.py:119`
   (`code, description, unit, unit_price_czk, confidence`) are untouched; `source` is NOT asserted, so
   changing its value (or keeping the key name `source` while reading real data) is compat-safe.

### Part B — Remove price as a ranking signal
1. **Keyword recall SQL** (`otskp_engine.py:104`): drop `ORDER BY cena`. Order by something neutral
   to recall (e.g. `LIMIT` without an ordering, or `ORDER BY code` for determinism) — recall just
   needs the top-N candidates; relevance ranking happens downstream in `deterministic_ranker`. Mirror
   the same removal in the in-memory fallback (`otskp.py:124`) so the price tie-break disappears there too.
2. **`deterministic_ranker` tie-break** (`catalog_matching.py:184`): remove `unit_price_czk` as the
   final sort key. Replace the 3rd key with a price-free deterministic tiebreaker (e.g. `code` ascending)
   so equal `(confidence, score)` ties resolve stably WITHOUT preferring the cheaper item. Update the
   docstring (line 181) which currently says "cheaper first". Keep keys 1-2 (`-_rank_score`, `-score`)
   as-is — they are the legitimate relevance signals.
3. **Optional precision boost (only if §B.2 leaves the golden failing):** the demo regression rides on
   `score` (Jaccard token overlap) ranking the předpjatý popis above železobeton for a query that does
   NOT say "předpjatý". The query work-type axis already resolves `predpinaci` vs `beton`
   (`catalog_matching.py:47`), but for a *beton* query both candidates are work-type `beton`. If the
   golden still fails, consider a negative-token / param penalty so a candidate whose popis asserts
   `předpjatý` while the query is plain `beton` ranks below the plain-concrete hit — as a ranking
   penalty on the sort key only, never as a gate, never touching displayed confidence (consistent with
   the existing `FAMILY_RANK_BONUS` pattern). Decide during implementation against the live data.

### Golden / acceptance
- `find_otskp_code("beton mostních pilířů C30/37")` (no "předpjatý") → **`334325` (železobeton) ranks
  above `334335` (předpjatý)**.
- Every result's `source` reflects the row's real `catalog_version` (e.g. `"OTSKP 2026"` after rebake),
  never the literal `"OTSKP 1/2025"`. Mixed 2025/2026 output is EXPECTED here (that is Fix 4's signal).
- `tests/test_mcp_compatibility.py` stays green (response shape unchanged).

---

## 5. Risks

- **Concrete prices (must NOT change):** the plan only (a) reads an extra column and (b) removes price
  from two *sort keys*. `cena` / `unit_price_czk` values returned to callers are byte-identical to
  today. No pricing formula, KROS rounding, or value is touched. **Explicitly out of scope.**
- **MCP compat (`find_otskp_code` response shape):** keys asserted by the compat test are unchanged
  (`source` is not asserted). Keep the key name `source` to avoid any downstream consumer breakage;
  only its *value* becomes data-driven. Re-run `tests/test_mcp_compatibility.py` after the change.
- **Exposing Fix 4 (expected, not a regression):** once `source` is data-driven, the live output will
  show mixed `"OTSKP 2025"`/`"OTSKP 2026"` because keyword-store and embeddings-store were baked from
  different catalog versions (STATUS §3). This is the intended reveal that motivates Fix 4 (rebake
  `otskp.db` → 2026, tie to migration Phase 3). Do NOT paper over it by re-hardcoding.
- **Legacy `otskp.db` without the column:** an old DB file predating the ingest rewrite lacks
  `catalog_version`; Part A.1 must guard the SELECT (column-exists check or try/except) and fall back to
  `settings.OTSKP_CATALOG_VERSION` so the reader doesn't crash on a stale DB.
- **In-memory XML fallback honesty:** if the SQLite DB is absent, the XML fallback path runs; without
  Part A.4 it would silently revert to a single derived/placeholder version — acceptable as long as it
  reads from the setting, not a baked-in date.

---

## Appendix — exact locations (quick index)

| Item | File:line |
|---|---|
| Hardcode `source` (exact-code branch) | `concrete-agent/packages/core-backend/app/mcp/tools/otskp.py:191` |
| Hardcode `source` (keyword/embeddings branch) | `concrete-agent/packages/core-backend/app/mcp/tools/otskp.py:237` |
| Keyword recall SQL `ORDER BY cena` | `concrete-agent/packages/core-backend/app/pricing/otskp_engine.py:104` |
| In-memory fallback price tie-break | `concrete-agent/packages/core-backend/app/mcp/tools/otskp.py:124` |
| Ranker price tie-break (decisive) | `concrete-agent/packages/core-backend/app/services/catalog_matching.py:184` |
| _rank_score (confidence + family bonus) | `concrete-agent/packages/core-backend/app/services/catalog_matching.py:176-177` |
| Exact-code reader (drops version) | `concrete-agent/packages/core-backend/app/pricing/otskp_engine.py:87-96` |
| Keyword reader (drops version) | `concrete-agent/packages/core-backend/app/pricing/otskp_engine.py:98-107` |
| Embeddings reader SQL (drops version) | `concrete-agent/packages/core-backend/app/services/catalog_embeddings.py:28-34` |
| OTSKPItem dataclass (no version field) | `concrete-agent/packages/core-backend/app/pricing/otskp_engine.py:35-41` |
| Ingest builds catalog_version column (SQLite) | `concrete-agent/packages/core-backend/scripts/ingest_otskp_catalog.py:144-151` |
| Ingest stamps catalog_version (embeddings) | `concrete-agent/packages/core-backend/scripts/ingest_otskp_catalog.py:216-222` |
| OTSKP_CATALOG_VERSION setting (default "OTSKP 2026") | `concrete-agent/packages/core-backend/app/core/config.py:139-142` |
| MCP-compat asserted fields (no source) | `concrete-agent/packages/core-backend/tests/test_mcp_compatibility.py:119` |
| Sibling stale label (pricing engine, out of scope) | `concrete-agent/packages/core-backend/app/pricing/otskp_engine.py:59` |
