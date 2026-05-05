# Phase C — Calculator runner (Most 2062-1 Žihle)

Spustí Monolit-Planner kalkulátor přes všechny elementy z
`../02_design/element_breakdown.yaml` a sestaví agregát:
- per-element JSONs (`outputs/<id>.json`)
- `cost_summary.xlsx` (4 sheets)
- `gantt_chart.svg`

## Setup

```bash
# 1) Lokální deps (exceljs + js-yaml + tsx)
npm install

# 2) Kalkulátor pro 11 elementů → outputs/*.json
npm run calc

# 3) Agregát Excel + Gantt
npm run summary
```

Žádný build `Monolit-Planner/shared/` není potřeba — `tsx` spouští TS přímo
přes `exports['./src/*']` v `Monolit-Planner/shared/package.json`.
(Plné `tsc` build padá na pre-existing typing bugu kolem `zaklady_oper`,
takže používáme tsx bypass.)

## Files

| Soubor | Popis |
|---|---|
| `package.json` | Lokální sandbox deps (exceljs, js-yaml, tsx) |
| `run-calc.ts` | Hlavní runner — volá `planElement()` per element |
| `make-summary.ts` | Agregát: Excel 4 sheets + Gantt SVG |
| `outputs/<id>.json` | Per-element calculator outputs (input + PlannerOutput) |
| `outputs/_all_outputs.json` | Combined: všechny outputs + out_of_calculator items |
| `cost_summary.xlsx` | 4 sheets: per-element / per-SO / total vs budget / harmonogram |
| `gantt_chart.svg` | Vizuální harmonogram s ZD limitem 30 měsíců |

## Excel sheets

1. **`1_Per_element`** — 11 prvků s detail breakdown (bednění práce, nájem, stojky, výztuž, betonáž, materiály)
2. **`2_Per_SO`** — agregát per SO objekt (SO 001, SO 180, SO 201, SO 290, svršek, ZS)
3. **`3_Total_vs_budget`** — porovnání proti 30 mil. Kč ZD §5.5 + 30 měsíců ZD §29.2
4. **`4_Harmonogram`** — fáze + start/délka/end + total project days

## Quirks (calculator workarounds)

Per-element vstup `element_breakdown.yaml` má 3 workarounds, dokumentovaný:

1. **`zaklady_oper` → `zaklady_piliru`**: union type `zaklady_oper` byl přidán
   v Phase 3 Gate 2a, ale 4 lookup tables (pour-decision, props, sequence)
   nedostaly přidanou položku → runtime crash. `zaklady_piliru` je per
   code-comment "paralelní" → safe substitute pro plošný základ.

2. **`cement_type: 'CEM_II'`**: enum hodnoty v `maturity.ts` jsou
   `'CEM_I' | 'CEM_II' | 'CEM_III'`, nikoliv `'CEM_II_AS_32_5'` (běžný
   industry slug).

3. **`season: 'normal'`**: `SeasonMode` enum =
   `'hot' | 'normal' | 'cold'`, nikoliv `'summer'`. Per
   `T_WINDOW_HOURS[season].no_retarder`.

4. **`rebar_mass_kg: 100` for podkladni_beton**: calculator vyžaduje
   rebar_mass > 0 (`rebar.ts:35`). Reálný podkladní beton je nevyztužený.
   Náklad je negligible (~0.5 % celku) — placeholder akceptovatelný.

5. **PlannerInput field name = `rebar_mass_kg`**, NEJDE `reinforcement_total_kg`
   (tá hodnota je v jiném strukturálním kontextu, ne primary input).

## Sanity

11/11 elements OK. Total direct cost ~6.5 mil. Kč (calculator + materiály +
out-of-calculator midpoints), 78.4 % headroom proti budgetu 30 mil. Kč,
schedule 319 dní (~10.6 měsíců) proti limitu 900 dní (30 měsíců).

> ⚠️ **Direct cost ≠ Nabídková cena.** Calculator vrátí labor + rental +
> rebar materials + concrete materials. NEZAHRNUJE: vendor margin (15-30%),
> design fees (DUR+DSP+DPS), risk contingency, insurance, profit. Pro
> realistickou nabídku přičti ~50-100 % na top. Detail v `00_PROJECT_SUMMARY.md`.

## Reproduce

```bash
cd /home/user/STAVAGENT/test-data/most-2062-1-zihle/03_calculation
npm install      # ~15 s, only first time
npm run calc     # ~5-10 s, 11 elements
npm run summary  # <1 s, builds xlsx + svg
```

Both outputs are deterministic given the same `element_breakdown.yaml`.
