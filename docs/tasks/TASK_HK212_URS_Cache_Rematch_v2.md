# TASK: HK212 Phase 1 Etap 1 — Rematch needs_review items proti enriched URS Cache

**Project:** STAVAGENT / HK212 hala
**Branch:** `claude/hk212-urs-cache-rematch`
**Předchozí kroky:** URS cache builder + enricher (Александр lokálně dokončil)
**Cíl:** unblock Phase 2 (Excel/KROS export) — match rate 29.8% → **≥60-70%**
**Effort:** ~3-4h coding session
**Coding:** Python, offline (proti local SQLite), žádný outbound HTTP

---

## §0 KRITICKÁ INFRASTRUCTURE — co je k dispozici

Александр lokálně postavil **enriched URS cache** s DVĚMA datovými vrstvami:

```
data/
  urs_cache.db          ← 139 MB, SQLite + 2 FTS5 tabulky
  urs_cache/
    2026-I.json ... 2021-I.json     ← raw catalog JSON per vintage
    items_flat.json                 ← flat list items
```

### Cache obsah

**Vrstva 1: catalog tree items** (table `items`, FTS5: `urs_fts`)
- 77,551 leaf items přes 11 vintages (2021/I → 2026/I)
- Schema:
  - `urs_code` — ÚRS položkový kód (e.g. "1111111", "61.131.", "421361.")
  - `title` — krátký popis (e.g. "Sanační postřik vnitřních omítaných ploch")
  - `title_normalized` — lowercase + bez diakritiky
  - `catalog_code`, `catalog_name` — e.g. "801-1", "Budovy a haly..."
  - `vintage` — "2026-I", "2025-II", ...
  - `kapitola`, `dil`, `soubor` — hierarchie z tree
  - `path_codes`, `path_titles` — full breadcrumb
  - `node_id` — internal podminky.urs.cz id (FK to texts below)
- FTS5 indexuje: `urs_code, title, title_normalized, path_titles`

**Vrstva 2: full podmínky texts** (table `node_texts`, FTS5: `node_texts_fts`)
- 47,355 HTML article texts přes 11 vintages
- Schema:
  - `vintage`, `node_id` (link to items)
  - `node_code`, `node_title` — denormalized parent node info
  - `catalog_code` — for filtering
  - `text_id`, `text_code` — e.g. "1101.", "3311."
  - `information_label`, `construction_label` — text type ("obsah", "volba", "definice", ...)
  - `content_html` — raw HTML
  - `content_text` — plain text (HTML stripped)
  - `content_normalized` — lowercase + bez diakritiky + collapsed whitespace
  - `breadcrumb_path`
- FTS5 indexuje: `content_text, content_normalized, node_title, node_code, catalog_code, information_label, construction_label`

### Klíčový pattern: dvouvrstvý lookup

```
raw_description "Sanační postřik vnitřních omítaných ploch vápenocementový"
       ↓
Layer 1 (items FTS5): find soubor cen base
       → 801-1 / 61.131. "Sanační postřik vnitřních omítaných ploch"
       ↓
Layer 2 (node_texts FTS5): verify by content match
       → search "vapenocementov*" within content_normalized
       → match found in node 62.325 (Oprava vápenocementové omítky)
       → CONFLICT: chose between 61.131. (new install) vs 62.325 (repair)?
       → answer: from item.path_titles ("Sanační postřik" not "Oprava")
       → final: 61.131. with high confidence
```

### Scraper scripts (NEšahej, ne začleňuj do repa)

- `urs_cache_builder.py` — Александrův tool, mimo repo
- `urs_cache_enrich.py` — Александrův tool, mimo repo

---

## §1 MANTRA

1. **Než začneš ANY kód:** přečti `outputs/phase_1_etap1/items_hk212_etap1.json` strukturu (`view`), prozkoumej `app/services/` konvence STAVAGENT repa (naming, error handling, logging), najdi kde žije existing URS matching logika (možná `URS_MATCHER_SERVICE/backend/` nebo `app/services/urs_matcher.py`). Встройся, ne dupliciruj.

2. **Determinism > AI:** preferred order:
   - **Exact urs_code match** (raw item už má kód) → confidence 1.0
   - **Layer 1 FTS5 (items.urs_fts) na title** → confidence base 0.70-0.85
   - **Layer 2 FTS5 (node_texts.node_texts_fts) na content** → boost confidence pokud confirms Layer 1
   - **Pokud ani jeden hit** → status zůstává `needs_review`, confidence 0.0

3. **NIKDY nepiš real HTTP calls.** Vše offline proti local SQLite.

4. **Pre-implementation interview povinný** (§3).

5. **Naming, file structure, deps — výhradně per existing repo conventions.**

---

## §2 KONTEXT — current state

### File k upravě

- `outputs/phase_1_etap1/items_hk212_etap1.json`
- 141 items total
- **42 matched** (29.8%) — already mají `urs_code` + confidence
- **7 custom** (`Rpol-NNN` ručně created)
- **92 needs_review** — modern URS položky vintage gap

### Per-item shape (typical needs_review)

```json
{
  "id": "hk212-001-...",
  "raw_description": "Výztuž základové desky betonářskou ocelí B500B...",
  "raw_code": null | "1234567",
  "mj": "t",
  "quantity": 12.5,
  "status": "needs_review",
  "urs_code": null,
  "confidence": 0.0,
  "match_source": null,
  ...
}
```

(přesnou strukturu ověř `view` na souboru — neimprovizuj)

---

## §3 PRE-IMPLEMENTATION INTERVIEW

Před první řádkou kódu zeptej Александra:

1. **Output strategy:**
   - In-place update + backup `_pre_rematch.json`?
   - Or separate `items_hk212_etap1_rematched.json`?

2. **Auto-apply confidence threshold:**
   - Conservative ≥0.85 (recommend pro první run)
   - Moderate ≥0.70
   - Aggressive ≥0.55
   - **Pro první run conservative, pak loosen po manual review**

3. **Vintage priority:**
   - Newest wins: 2026-I → 2025-II → 2025-I → ... → 2021-I
   - OR keep whichever first matched (multi-vintage tagging)

4. **Catalog filter from raw_code:**
   - If raw_item.raw_code exists (např. "612310011"), use first 3 digits as catalog hint ("800-6" zone)
   - Restrict FTS5 to that catalog → faster, more precise
   - OR unrestricted across all 77,551 items

5. **Tokenization & query construction:**
   - Auto-add prefix wildcard `*` na last 4+ char tokens (handles czech declensions: "stropů" → "strop*")
   - Strip stopwords: czech-specific ("a", "v", "z", "se", "pro", "do", "na", "ve", "pří")
   - Strip construction noise: "položka", "viz", "dle", "podle"
   - **Sdělíš 5-10 example raw_descriptions** → Claude Code adaptuje tokenization

6. **Two-layer matching strategy:**
   - Layer 1 only (items table): faster, simpler, may miss material variants
   - **Layer 1 + Layer 2 (items + node_texts)**: recommended — Layer 2 confirms/boosts Layer 1 matches
   - Layer 2 only: too imprecise (whole article text)

7. **Confidence calculation formula (suggested baseline):**
   - +0.50 base for any Layer 1 hit
   - +0.20 if top-1 Layer 1 rank gap > 2× to top-2 (clear winner)
   - +0.15 if all query tokens matched in title (no fuzzy degradation)
   - +0.10 if Layer 2 (node_texts) confirms — query terms also found in node's content
   - +0.10 if catalog code matches expected (from raw_code prefix)
   - +0.05 if path_titles contains key category keyword
   - Cap at 0.95 (reserve 1.0 for exact code match)
   - **Александre, je to ok startovní heuristika?** Refine after first run.

8. **MJ validation:**
   - Cache neobsahuje MJ (tree endpoint neposkytuje)
   - Skip MJ check OR derive from raw_item only?

---

## §4 BUSINESS LOGIC

### Workflow

1. **Load HK212 items** from `outputs/phase_1_etap1/items_hk212_etap1.json`
2. **Connect to local URS cache** (`data/urs_cache.db`, read-only mode)
3. **For each `needs_review` item:**

   **Step A: Exact code lookup**
   ```sql
   SELECT * FROM items WHERE urs_code = ? ORDER BY vintage DESC LIMIT 5
   ```
   If 1+ hits → take newest vintage, confidence=1.0, status='matched'.

   **Step B: Layer 1 — title FTS5 search**
   - Normalize raw_description: lowercase, remove diacritics, strip stopwords/noise
   - Tokenize, take top 3-5 most distinctive tokens
   - Auto-add prefix wildcard on tokens ≥4 chars: `vyztuz strop*` instead of `vyztuz strop`
   - ```sql
     SELECT items.urs_code, items.title, items.vintage, items.catalog_code,
            items.path_titles, items.node_id, urs_fts.rank
     FROM urs_fts JOIN items ON items.id = urs_fts.rowid
     WHERE urs_fts MATCH ?
     ORDER BY rank LIMIT 10
     ```
   - Group by `urs_code` (dedupe across vintages, prefer newest)
   - Take top-5 unique candidates

   **Step C: Layer 2 — content FTS5 confirmation (optional boost)**
   - For each top-5 candidate from Step B:
     - Find the candidate's `node_id` (or parent node_id if leaf has none)
     - ```sql
       SELECT COUNT(*), GROUP_CONCAT(text_code) FROM node_texts_fts
       JOIN node_texts ON node_texts.id = node_texts_fts.rowid
       WHERE node_texts.node_id = ? AND node_texts_fts MATCH ?
       ```
     - If query terms appear in content → boost candidate's confidence

   **Step D: Confidence scoring per top-3 candidates** (§3 question 7)

   **Step E: Decision**
   - If top-1 confidence ≥ threshold → auto-apply:
     - Set `urs_code`, `confidence`, `match_source='urs_cache_fts5'`, `match_vintage`, `match_layer=1|2|1+2`
     - Status → `matched`
   - Else:
     - Keep `status='needs_review'`
     - Add `match_candidates` array (top-3 alternatives with scores + reasoning)

4. **Audit trail per item:** log query tokens, top-3 candidates with sub-scores (Layer 1 rank, Layer 2 boost), decision, timestamp

5. **Persist:**
   - Save updated items per §3.1 strategy
   - Generate `rematch_report.md`:
     - Summary: pre vs post counts per status
     - Match rate change
     - Top-10 best matches (highest confidence) — verify quality
     - Top-10 borderline (confidence 0.5-0.85) — needs manual review
     - Histogram of confidence scores
     - Per-catalog match distribution

### Edge cases

- **Empty raw_description:** skip, mark `cannot_match`
- **raw_code present but not in cache:** fallback to FTS5 path
- **Multiple identical title matches across vintages:** prefer newest
- **Special chars** (Czech diacritics, fractions "C30/37", diameters "Ø600", concrete classes): normalize before tokenization; preserve as searchable tokens (`c30 37` from "C30/37", `d600` from "Ø600")
- **Stopwords:** "a, v, z, se, pro, do, na, ve, pří" + "položka, polozka, soupis, vlastní, viz, dle, podle"
- **Numbers without context:** strip pure digits <3 chars; preserve dimensions like "600 mm", "C30"
- **Layer 2 search across vintages:** restrict to same vintage as Layer 1 winner OR allow cross-vintage (recommend same vintage first, cross only if 0 results)

---

## §5 ACCEPTANCE CRITERIA

### Po session

1. Module struktura odpovídá existujícím konvencím v `app/services/`
2. Reads `outputs/phase_1_etap1/items_hk212_etap1.json` + `data/urs_cache.db` correctly
3. Two-layer matching implemented (items + node_texts)
4. Generates:
   - Updated items file (per §3.1)
   - `outputs/phase_1_etap1/rematch_report.md`
   - `outputs/phase_1_etap1/rematch_audit.json` (per-item audit trail)
5. **Match rate improves from 29.8% → ≥60% (target 70%)** measured on Александrově dataset
6. Tests passing offline (no real DB, no network):
   - Unit: tokenization, normalization, czech stopword strip, wildcard auto-add, confidence formula
   - Integration: small fixture DB s ~50 items + 10 node_texts + 15 query cases, expected matches verifiable
7. CLI entry point per repo conventions:
   - Input file path
   - Cache DB path
   - Threshold flag
   - Layer mode flag (layer1 / both)
   - `--dry-run`, `--report`, `--help`
8. Idempotent: re-run on already-matched file is safe

### Po Александrově review

1. Manual spot-check 20 random auto-applied matches → ≥90% správné
2. `rematch_report.md` čitelný, ukazuje what changed
3. Items s confidence 0.5-0.85 jasně flagged pro manual review

---

## §6 STOP GATES

STOP a alert Александrovi pokud:

1. `urs_cache.db` neexistuje, korupný, nebo schema mismatch (missing `node_texts` table → Александr nespustil enricher)
2. Match rate po prvním runu **nezlepšila** se na ≥50% → analyze: bad tokenization? bad threshold? bad cache scope?
3. Auto-apply rate > 80% with aggressive threshold → suspicious overconfidence, manual spot-check first
4. Existing repo má URS matching service který by měl být extended → встройся, ne dupliciruj

---

## §7 OUT-OF-SCOPE

- **MJ extraction & validation** — separate task
- **Detail item fetcher** for full popis with material variants — paid KROS API only, not on podminky.urs.cz
- **Production URS_MATCHER_SERVICE refactor** — separate task
- **Generic project rematch tool** (not HK212-specific) — separate generalization
- **Phase 2 Excel/KROS export** — separate task po this completes
- **Cross-domain validation** (statics, geology) — separate task

---

## §8 NAMING & PR DISCIPLINE

- **Branch:** `claude/hk212-urs-cache-rematch`
- **Commits:** push origin po každém logickém kroku
- **PR:** NE-otevírat (no-PR-unless-asked)
- **File naming:** existing `app/services/` patterns
- **Test fixtures:** small SQLite + JSON v `tests/fixtures/urs_rematch/`

---

## §9 HANDOFF MESSAGE (Claude Code → Александр)

Po session completion:

1. Branch name + commits
2. Run command pattern: `python -m <module> --input outputs/phase_1_etap1/items_hk212_etap1.json --cache data/urs_cache.db`
3. Expected output files
4. **Pre/post match rate** measured on real data
5. Manual review queue stats: kolik items s confidence 0.5-0.85
6. Sample 5 best matches + 5 borderline pro Александrovu verifikaci
7. Next task: Phase 2 Excel/KROS export (separate later)

---

**Naming, file structure, deps — výhradně z existujících konvencí v repu. Встройся.**

**END OF TASK.**
