# TASK: hk212 URS Cache Rematch v2

**Project:** Hala HK212 (Hradec Králové)
**Branch:** `claude/hk212-phase-1-etap1-hsv-psv-vrn-m-vzt`
**Předpoklad:** `data/urs_cache.db` lokálně exists (77,551 items + 47,355 enriched texts, 11 vintages 2021-I → 2026-I — postaveno přes `scripts/urs_cache/urs_cache_builder.py` + `_enrich.py`).
**Goal:** lift hk212 URS match rate from **29.8 %** (4 high + 38 medium / 141) by re-querying modern URS catalog via dual-layer FTS5.

---

## §1 Inputs / outputs

**Input (read-only):**
- `test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json` — 141 items.
- `data/urs_cache.db` — local SQLite (gitignored, ~140 MB).

**Output (committed):**
- `…/items_hk212_etap1.json` — **updated in place**.
- `…/items_hk212_etap1_pre_rematch.json` — backup, written **once** before first overwrite (idempotent across re-runs).
- `…/rematch_report.md` — exec summary.
- `…/rematch_audit.json` — per-item delta.

---

## §2 Algorithm — dual-layer FTS5

For each of 141 items:
1. **Skip** if `urs_status == 'custom_item'` (7 items, Rpol-NNN, out-of-catalog by design).
2. Normalize source text: prefer `raw_description`, fallback to `popis`. Lowercase + NFKD strip diacritics + collapse whitespace.
3. **Tokenize** — split on whitespace, drop tokens shorter than 3 chars, drop Czech stopwords (see §3).
4. **FTS5 query** — tokens ≥ 4 chars get prefix wildcard `token*`, shorter ones stay verbatim; join with `OR` (FTS5 default is `AND`, too strict for popis variations).
5. **Layer 1** — query `urs_fts` (catalog item titles + breadcrumb path), top 20 by BM25 rank.
6. **Layer 2** — query `node_texts_fts` (long-form Czech HTML articles per category), top 20.
7. **Score normalization** — FTS5 `rank` is negative BM25, lower = better. Map to `1 / (1 + |rank|)` then to `[0, 1]`.
8. **Vintage priority** — newer wins on ties: weight = `1.00` for `2026-I` down to `0.90` for `2021-I` (linear decay 0.01/half-year).
9. **Catalog filter** — if an item carries a numeric `urs_code` already (any vintage), boost candidates whose `catalog_code` shares the leading 3 digits (e.g. `800-*`).
10. **Merge** Layer 1 + Layer 2 candidates by `urs_code`, take `max(layer1, layer2) × vintage_weight`.
11. **Decision** with **conservative threshold 0.85**:
    - `score ≥ 0.85` → `urs_status: matched_high`, `confidence: 0.85`, overwrite `urs_code`, `urs_match_score`.
    - `0.70 ≤ score < 0.85` → `matched_medium`, `confidence: 0.75`, overwrite.
    - `score < 0.70` → **keep current state**; only refresh `urs_alternatives` if new top-5 beats existing.
12. **Always preserve** `raw_description`, `_qty_formula`, `_vyjasneni_ref`, `_data_source`, `_completeness`, `_export_wrapper_hint`, `source`, `subdodavatel_chapter`, `mj`, `mnozstvi`, `SO`, `kapitola`, `id`.

---

## §3 Czech stopwords (built into module)

`a, aby, ale, ani, asi, az, by, byl, byla, byli, bylo, byly, byt, ci, co, dale, do, ho, i, jak, jako, je, jen, jeho, jejich, ji, jiz, jsem, jsi, jsme, jsou, jste, k, ke, ktera, ktere, ktery, kteri, kterou, kdo, kdy, kdyz, ma, mam, mate, me, mezi, mi, mit, mu, my, na, nad, nam, nas, nase, nasi, ne, nebo, neni, nez, no, o, od, on, ona, oni, ono, ony, pak, po, pod, podle, pres, pri, pro, proc, proto, prave, pri, s, se, si, sice, snad, ta, tak, takovy, tato, te, tedy, tem, ten, ti, to, tohle, toho, tom, tomu, ty, u, uz, v, vam, vas, ve, vedle, vsak, vsech, vsechny, vy, z, za, zda, zde, ze`

(deburred — strip diacritics before matching).

Tech tokens kept regardless: `m, mm, cm, m2, m3, kg, t, ks, hod, bm`.

---

## §4 CLI

```bash
python test-data/hk212_hala/scripts/phase_1_etap1/rematch_urs_cache.py
# defaults:
#   --items  test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json
#   --db     data/urs_cache.db
#   --threshold 0.85
#   --output (in-place + auto backup _pre_rematch.json once)
```

Flags:
- `--threshold 0.85` — high tier (≥ 0.70 always considered medium).
- `--dry-run` — print would-be deltas, write nothing.
- `--top-k 20` — candidates per layer (default 20).
- `--vintages 2026-I,2025-II` — restrict to subset (default: all 11).
- `--verbose` — debug log.

---

## §5 Reports

`rematch_report.md` (≤ 200 řád.):
- Overall: before X.X % → after Y.Y %.
- Per-status counts before vs after.
- Top-20 biggest score improvements (item id + old → new code + delta).
- Top-20 still in `needs_review` after rematch.
- Per-kapitola breakdown (HSV-1…M, VRN, VZT).

`rematch_audit.json`:
```json
{
  "ran_at": "<ISO>",
  "threshold": 0.85,
  "total_items": 141,
  "skipped_custom": 7,
  "deltas": [
    {
      "id": "HSV-1-001",
      "old": {"code": "60511064", "score": 0.667, "status": "matched_medium"},
      "new": {"code": "121101101", "score": 0.91,  "status": "matched_high"},
      "source_layer": "layer1+layer2",
      "vintage_picked": "2026-I"
    }
  ]
}
```

---

## §6 Stop gates

- DB missing → exit 2 with hint to run builder.
- 0 items have `raw_description` AND `popis` empty → exit 3 (corrupt input).
- After rematch, total items count differs from input → exit 4 (logic bug).
- `custom_item` count changed → exit 5 (must stay 7).

---

## §7 Acceptance

- Backup created exactly once (idempotent re-runs).
- All 141 items still present, schema-valid.
- `raw_description` field byte-identical post vs pre.
- New match rate ≥ 50 % (target — soft assertion in report).
- Reports written, exit 0.

---

## §8 Out-of-scope

- MJ unit validation (cache lacks `mj` column).
- Pricing / oceněni.
- Excel/KROS export — Phase 2 task.
- AI/LLM rerank — pure FTS5 + heuristic merge.
