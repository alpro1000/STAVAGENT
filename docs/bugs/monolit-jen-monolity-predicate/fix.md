# Fix — THE single predicate `isMonolithGroup`

**PR:** #1523 (2026-07-18)

## Change

- `shared/src/monolith-classifier.ts` — nová exportovaná `isMonolithGroup(rows)`:
  1. explicitní `metadata.is_monolith_override` na kterémkoli řádku rozhoduje,
     **veto-first** (jakékoli `false` → ven; jinak jakékoli `true` → dovnitř);
  2. jinak: skupina je monolit ⇔ má řádek `subtype='beton'`.
  Žádná re-klasifikace `item_name`/`otskp_code` — `classifyMonolithRow` běží
  při importu a přes toggle, nikdy při čtení/exportu.
- Konzumenti (všichni TŘI na stejné funkci):
  - `FlatPositionsTable.elementIsMonolith` → delegát (m³-gate a text-cesta pryč),
  - `FlatKPIPanel` «Prvků» → počet part-skupin splňujících predikát,
  - `backend/src/routes/export.js` `filterMonolithicPositions` → group-by-part
    + predikát; exportováno pro hermetický test.

## Behavioral deltas (vědomé)

- Skupina se subtype='beton' a agregátním textem («kamenivo») se NYNÍ exportuje
  pod filtrem — ruční/importní subtype je pravda (živý bug pin).
- Skupina bez beton-řádku a bez override (samostatná výztuž/jiné, i m³) není
  monolit — dřívější m³-promotion cesta ve front-filtru padá (bez signálu a bez
  ručního označení do filtru nepatří; ✓ toggle ji stále povýší).

## Tests

- shared `monolith-classifier.test.ts` +6 (subtype-truth, veto, promote,
  konflikt override, JSON-string metadata, prázdná skupina) → 1489.
- backend `tests/routes/export-monolith-filter.test.js` +4 (LIVE BUG PIN
  kamenivo-beton kept; promote celého partu; veto + siblings; DB-string
  metadata) → 121.
