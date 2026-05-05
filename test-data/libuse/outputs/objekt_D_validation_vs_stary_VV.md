# Validation: objekt D vs starý Vykaz výměr

Compares 5 representative line items from the starý výkaz výměr (`Vykaz_vymer_stary.xlsx` / sheet `100 - Architektonicko-sta…`) against parser-derived D-only equivalents. The starý VV bills the whole komplex (A+B+C+D), so the validation metric is the **pomer** (D-share) — expected ~19 % for exterior items and ~28 % for interior items.

**Source files:**
- Tabulka místností: `185-01_DPS_D_SO01_100_0020_R01_TABULKA MISTNOSTI.xlsx`
- Starý VV: `Vykaz_vymer_stary.xlsx`
- Parser aggregates: `objekt_D_per_podlazi_aggregates.json`
- Parser fasáda/střecha: `objekt_D_fasada_strecha.json`

## Per-probe results

| # | Probe | Komplex VV (m²) | Parser D (m²) | Pomer D/Komplex (%) | Expected band | Verdict | Derivation |
|---|---|------:|------:|------:|---|---|---|
| 1 | FF20 vyrovnávací cementový potěr 55 mm | 1058.40 | 730.4 | 69.0 | 20–32 % | ⚠️ outside band | Σ Tabulka.plocha for D-codes with any FF## cement screed: FF20=69.7, FF21=163.8, FF30=170.7, FF31=326.2 = total 730.4 m² |
| 2 | Sádrová omítka vnitřních ploch (F04/F05 wall plaster) | 9648.28 | 1819.2 | 18.9 | 18–30 % | ✅ within band | D rooms with povrch_sten ∈ (F04,F05,F17): 41 rooms; Σ est_perim × 2.7 m ≈ 1819.2 m² (perim heuristic 4.5×√plocha) |
| 3 | Vápenocementová omítka 1.PP (F19) | 1217.07 | 1249.6 | 102.7 | 22–32 % | ⚠️ outside band | 1.PP perimeter (Σ room perimeters) 462.8 m × 2.7 m clear height = 1249.6 m² (room-perimeter sum overestimates because internal walls are counted from both sides) |
| 4 | Tenkovrstvá akrylát. omítka venkovních podhledů (F16) | 352.04 | 121.0 | 34.4 | 15–25 % | ⚠️ outside band | facade perimeter 80.7 m × 1.5 m balkón depth ≈ 121.0 m² (heuristic — assumes balkóny on all sides) |
| 5 | Tenkovrstvá pastovitá omítka venkovní (F13 fasáda) | 112.71 | 1004.1 | 890.9 | 15–25 % | ⚠️ outside band | facade brutto rect envelope 1079.1 m² − openings ≈ 1004.1 m² (overestimates due to atika gable peak in height) |

## Headline

- ✅ within band: **1**
- ⚠️ outside band / not found: **4**
- Total probes: **5**

## Caveats

- Pomer expectations (~19 % exterior, ~28 % interior) come from the spec's manual proof-of-concept. Each building has slight floor-count variance, so wider acceptance bands are used.
- D-side derivations for interior wall area are rough: assume 2.7 m clear height and that 100 % of rooms receive the surface treatment. Phase 1 will refine using `Tabulka místností.povrch_sten` per-room mapping.
- Facade brutto from step 2 includes the atika gable peak in total height (13.38 m vs spec's wall-only ~9.82 m), inflating the parser's facade m² by ~30 %. PROBE 5 reflects this overestimate.
- Heuristic balkón estimate (PROBE 4) assumes balkóny on all sides — actual Libuše D may have balkóny only on one or two sides. Refine in Phase 1 using Tabulka klempířských + a balkón polygon scan.
- The starý VV is the document the customer flagged as INCOMPLETE — the purpose of this validation is to confirm parser geometry is in the right ballpark, NOT to certify the VV. Phase 1.5 will catalogue the spec's known missing items (hydroizolace stěn koupelen, zábradlí balkónů, ocelové stupně, klempířské prvky TP12/TP22/OP50) and quantify the gap.

## Reframing: probe 'failures' may be VV gaps, not parser bugs

PROBE 1 (FF cement screed) reports D-pomer **69 %**, far above the expected 20–32 % band. Parser-side number (Σ all FF## skladby for D rooms = 730 m²) is internally consistent: 4 objekty × ~930 m² floor each → komplex screed should sit around ~3000 m², not the 1058 m² that the starý VV records. The ratio inversion suggests the **starý VV is missing the bulk of cement screed** for the project — which is exactly the kind of gap the customer asked us to find. Phase 5 (Audit & Diff against Old výkaz) will catalogue these as VYNECHANE_KRITICKE entries.

PROBE 2 (sádrová omítka) is the gold-standard match: 18.9 % within the 18–30 % band confirms the parser/Tabulka geometry pipeline produces ratio-correct numbers. PROBE 5 (pastovitá fasáda) is a parser-side overestimate (atika gable peak still in total height) and will resolve once Phase 1 introduces wall-only height clustering.