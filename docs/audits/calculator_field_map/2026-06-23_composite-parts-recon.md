# Composite-element-parts — Phase A (Gate 0) recon

> **Datum:** 2026-06-23 · **Typ:** read-only audit (`file:line`), nula kódu.
> **Spec:** `docs/specs/composite-element-parts/` · **Báze:** `2026-06-13_recon.md` (re-ověřeno po Šazích 1–3).
> **Účel:** zodpovědět 3 open questions Gate 0 fakty před ratifikací. **STOP gate — kód až po ratifikaci.**

---

## Q1 — Rollup tabulky pozic + dvojí započtení (KLÍČOVÉ)

- KPI projektu se počítá **ploše nad seznamem pozic (řádků)**: `calculateHeaderKPI(positions, …)` (`shared/src/formulas.ts:300`) → uvnitř `summarizeScheduleProjections(positions)` (`:263`, voláno `:347`).
- `summarizeScheduleProjections` (`formulas.ts:263–293`): Σ `schedule_total_days` přes pozice s projekcí; `calculated>0 ? round : null` (honest `NEPOČÍTÁNO`, ne 0); `schedule_elements_uncalculated` = počet nevypočtených.
- **Beton (objem):** Σ jen přes řádky `subtype==='beton'` (Monolit `CLAUDE.md` formule §5 — bednění/výztuž nesou TÝŽ `concrete_m3`, proto se objem sčítá jen z beton-řádku). **Peníze** (`kros_total_czk`): Σ přes VŠECHNY řádky. **Dny:** Σ přes projekce.
- `planProject` (`shared/src/calculators/project-planner.ts:91`) zrcadlí flat-rollup: `schedule_total_days` = **sekvenční SUM** per-element (`:70–74`, `:135`), `elements_uncalculated` honest (`:138`); doc `:13–17`: **NO cross-element overlap**, `/api/calculate` byte-identical, `planProject([x]).elements[0].plan ≡ planElement(x)`.
- **Žádná hierarchie rodič/dítě v Monolit pozicích dnes** — jen ploché `part_name` (prvek) → `subtype` (druh práce). (Parent-child `rowRole`/`parentItemId` má **registry**, NE Monolit.)

**Odpověď na dvojí započtení:** flat-sum sčítá **listy (řádky)**. Když opěra = **čistý rodič-kontejner bez vlastních work-řádků** a práce žije na **listech (částech)**:
- beton: Σ part-beton-řádků = celkový objem opěry; peníze/dny: Σ part-řádků = celek; rodič přispívá 0.
- **⇒ rollup úroveň „část" UNESE BEZ zásahu do KPI-panelu**, pokud work-řádky jsou na listech, ne na rodiči.
- Dnešní jedno-opěra = jeden `part_name` s work-řádky → při composite se work-řádky **přesunou na části**; opěra-rodič ztratí vlastní beton-řádek ⇒ **žádné 2×**.

**Zbylá práce (UI, NE KPI-formule):** tabulka dnes seskupuje po `part_name`; „část" = **nová střední úroveň** mezi `part_name` (opěra) a `subtype` (práce) → grouping v tabulce (Gate 4).

---

## Q5 — Single-source sady částí (composite template)

- Ontologie typů prvků = single-source `concrete-agent/…/element_rules/element_types.yaml` → generovaný `Monolit-Planner/shared/src/kb-generated/element-classification-rules.ts` (`gen-knowledge.mjs`, drift-guard). `type_core` už grupuje `family: abutment` (`opery_ulozne_prahy`, `kridla_opery`) a `pier` (`driky_piliru`).
- **ALE composite template (jaké části má opěra) tam DNES NENÍ** — jen plochý `typ→family`.
- **⇒ sada částí = nový aditivní data-blok ve stejném yaml single-source** (generovaný toutéž pipeline, drift-guarded). **Žádná parallel structure.**

---

## MCP delegate (re-confirm)

- `concrete-agent/…/mcp/tools/calculator.py:5`: „canonical TypeScript engine (planElement) over HTTP — POST /api/calculate"; `_build_planner_payload` (`:176`); POST na /api/calculate (`:620`); `source="monolit_planner_api"` (`:615/661`).
- **⇒ MCP počítá přes TUTÉŽ cestu jako frontend**; složené části forwardované přes `/api/calculate` = parita zdarma. ✓

---

## Stav berliček (re-confirm)

- `planProject` na main; `planElement` / `/api/calculate` netknuté (parita) — `project-planner.ts:16–17`.
- `include_kridla` / `kridla_height_m` **odpojené** (display-only): auto-set `useCalculator.ts:176/201`, memo `:268–274`, render `CalculatorResult.tsx:753`; do `buildInput` **nejdou**.
- Tři mechanismy množnosti (`num_identical_elements` ⊥ `num_dilatation_sections` ⊥ `manual_zabery`) — dle `2026-06-13_recon.md §2c` stále platí.

---

## Závěr Gate 0

| Q | Stav | Závěr |
|---|---|---|
| Q1 rollup / dvojí započtení | **vyřešeno reconem** | Unese **bez KPI-surgery**; klíč = rodič-kontejner, práce na listech; double-count vyřešen konstrukcí. „Část" = nová grouping úroveň v tabulce (Gate 4). |
| Q5 single-source částí | **vyřešeno reconem** | Existující `element_rules` yaml + gen pipeline; aditivní blok, žádná parallel structure. |
| Q3 typové podíly | **čeká na Alexandra** | Data later (placeholder neblokuje Gate 2–5). |

**STOP** — ratifikace Alexandrem → Gate 1 (ADR). Kód se nezačíná.
