# HK212 — Audit Trail Extraction Report (Stage C)

_Ran at: 2026-05-14T06:35:18.127569+00:00_

_Tolerance: ±5 %_

_Source: reused Phase 0b tz_specs/_aggregate.json + dxf_parse/*.json_

_AI calls made: 0 (pure deterministic + existing artefacts)_


## Summary

- Items total: **141** (custom skipped: 7)
- audit_trail blocks added: **134**
- Match within tolerance: **102 / 134 (76.1 %)**
- Match mismatch: 2, no computed: 30

## Confidence buckets

| Tier | Count | Color |
|---|---:|---|
| green (≥ 0.85) | 73 | #C6EFCE |
| yellow (0.60–0.85) | 44 | #FFEB9C |
| red (< 0.60) | 17 | #FFC7CE |

## Extraction method distribution

| Method | Count |
|---|---:|
| qty_formula_parse | 47 |
| placeholder_matches_declared | 29 |
| qty_formula_dxf_verified | 26 |
| placeholder_uncertain | 17 |
| verbal_only | 14 |
| qty_formula_mismatch | 1 |

## Sample green-tier audit trails (top 10 by quantity)

| id | popis | formula | computed | declared | Δ% |
|---|---|---|---:|---:|---:|
| HSV-1-016 | Nakládání zeminy hor. tř. 1-4 na dopravn | = celkový objem výkopu 350 m³ (Phase 0b baseline) | 350.0 | 350.0 | 0.0 |
| HSV-1-017 | Vodorovné přemístění zeminy do 5000 m, s | = 350 m³ × 1 (default 5 km deponie) | 350.0 | 350.0 | 0.0 |
| HSV-1-018 | Odvoz výkopu na deponii / skládku — kont | = 350 m³ | 350.0 | 350.0 | 0.0 |
| HSV-1-001 | Hloubení figury pod základovou desku, st | 495 m² × 0.45 m (deska 0.20 + lože 0.25) | 222.75 | 222.75 | 0.0 |
| HSV-1-013 | Štěrkové lože pod základovou deskou, tl. | 495 m² × 0.25 m | 123.75 | 123.75 | 0.0 |
| HSV-1-012 | Pomocné výkopy pro novou areálovou kanal | 82 m gravitační × 0.5 m š × 1.2 m h | 49.2 | 49.2 | 0.0 |
| HSV-1-002 | Hloubení dohloubek pro patky rámové, hor | 14 ks × 1.5 m × 1.5 m × 1.0 m (od úr. figury -0.45 do -1.45/ | 31.5 | 31.5 | 0.0 |
| HSV-1-006 | Ruční výkop v ochranných pásmech stávají | 2 křížení × 5 m délka × 1.5 m š × 2.0 m h | 30.0 | 30.0 | 0.0 |
| HSV-1-005 | Hloubení rýh pro krátké pasy mezi patkam | ~30 bm × 0.4 m × 0.6 m (krátké propojovací pasy) | 7.2 | 7.2 | 0.0 |
| HSV-1-003 | Hloubení dohloubek pro patky štítové, ho | 8 ks × 0.8 × 0.8 × 0.25 m (od figury -0.45 do -0.70) | 1.28 | 1.28 | 0.0 |

## Sample red-tier audit trails (need manual review)

| id | popis | formula | declared | reason |
|---|---|---|---:|---|
| HSV-2-012 | VARIANTA — výztuž piloty 8× R25 podélná  | 8 ks × 3.86 kg/m × 8 m + třmínky placeholder | 380.0 | placeholder_uncertain |
| HSV-3-014 | Revize ocelové konstrukce + protokol o p | paušál | 1.0 | placeholder_uncertain |
| PSV-78x-012 | Doprava klempířiny + materiálu na stavbu | paušál | 1.0 | placeholder_uncertain |
| VRN-005 | Vodovodní přípojka pro stavbu — vytvořen | paušál | 1.0 | placeholder_uncertain |
| VRN-006 | Elektrická přípojka pro stavbu — staveni | paušál | 1.0 | placeholder_uncertain |
| VRN-009 | Plán BOZP + dokumentace bezpečnosti prác | paušál | 1.0 | placeholder_uncertain |
| VRN-010 | Pojištění stavby + odpovědnostní pojistk | paušál | 1.0 | placeholder_uncertain |
| VRN-014 | Geodetické zaměření před zahájením stavb | paušál (Rožmitál URS 00511 R) | 1.0 | placeholder_uncertain |
| VRN-015 | Geodetické zaměření skutečného provedení | paušál | 1.0 | placeholder_uncertain |
| VRN-018 | Předávací protokoly + dokumentace skuteč | paušál | 1.0 | placeholder_uncertain |

## Mismatch — computed ≠ declared (top 10 worst Δ%)

| id | popis | formula | computed | declared | Δ% |
|---|---|---|---:|---:|---:|
| HSV-2-005 | Bednění patek štítových — zřízení | 8 ks × (0.8 × 0.8 × obvod 3.2 m × 2 stupně) — zjed | 32.768 | 20.8 | 57.5 |
| HSV-2-012 | VARIANTA — výztuž piloty 8× R25 podélná  | 8 ks × 3.86 kg/m × 8 m + třmínky placeholder | 247.04 | 380.0 | 35.0 |
