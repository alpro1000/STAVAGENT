# HK212 — Audit Trail Extraction Report (Stage C)

_Ran at: 2026-05-14T06:11:34.088222+00:00_

_Tolerance: ±5 %_

_Source: reused Phase 0b tz_specs/_aggregate.json + dxf_parse/*.json_

_AI calls made: 0 (pure deterministic + existing artefacts)_


## Summary

- Items total: **141** (custom skipped: 7)
- audit_trail blocks added: **134**
- Match within tolerance: **70 / 134 (52.2 %)**
- Match mismatch: 33, no computed: 31

## Confidence buckets

| Tier | Count | Color |
|---|---:|---|
| green (≥ 0.85) | 49 | #C6EFCE |
| yellow (0.60–0.85) | 60 | #FFEB9C |
| red (< 0.60) | 25 | #FFC7CE |

## Extraction method distribution

| Method | Count |
|---|---:|
| qty_formula_parse | 35 |
| placeholder_uncertain | 25 |
| qty_formula_mismatch | 24 |
| placeholder_matches_declared | 21 |
| verbal_only | 15 |
| qty_formula_dxf_verified | 14 |

## Sample green-tier audit trails (top 10 by quantity)

| id | popis | formula | computed | declared | Δ% |
|---|---|---|---:|---:|---:|
| HSV-1-019 | Skládkovné — uložení vytěžené zeminy na  | 350 m³ × 1.8 t/m³ (zhutněná zemina) | 630.0 | 630.0 | 0.0 |
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
| HSV-1-004 | Hloubení atypického základu — varianta j | placeholder 12 m³ (vrt + zaplnění; variantní řešení per A105 | 12.0 | placeholder_uncertain |
| HSV-1-009 | Obetonování stávajícího potrubí splaškov | placeholder ~5 m³ (úsek 5 m × tlouš. 0.3 m × š. 0.8 m + ofse | 5.0 | placeholder_uncertain |
| HSV-1-010 | Obetonování stávajícího potrubí dešťové  | placeholder ~5 m³ (úsek 5 m × 0.3 × 0.8 + ofset) | 5.0 | placeholder_uncertain |
| HSV-1-026 | Nakládání stavební suti na dopravní pros | placeholder 540 m² × 0.25 m × 2 t/m³ × 30% = ~80 t | 80.0 | placeholder_uncertain |
| HSV-2-009 | Výztuž patek a pasů ze svařovaných sítí  | placeholder 600 kg per RE-RUN §3.4 statika dimensioning | 600.0 | placeholder_uncertain |
| HSV-2-012 | VARIANTA — výztuž piloty 8× R25 podélná  | 8 ks × 3.86 kg/m × 8 m + třmínky placeholder | 380.0 | placeholder_uncertain |
| HSV-3-014 | Revize ocelové konstrukce + protokol o p | paušál | 1.0 | placeholder_uncertain |
| HSV-9-002 | Pomocné lešení pro montáž ocelové konstr | placeholder ~200 m³ prostorové lešení pro halu 28×19×6 m | 200.0 | placeholder_uncertain |
| PSV-77x-003 | Lokální zesílení podlahy v anchorage zón | placeholder ~30 m² (3 stroje × ~10 m² každé anchorage zóna) | 30.0 | placeholder_uncertain |
| PSV-78x-012 | Doprava klempířiny + materiálu na stavbu | paušál | 1.0 | placeholder_uncertain |

## Mismatch — computed ≠ declared (top 10 worst Δ%)

| id | popis | formula | computed | declared | Δ% |
|---|---|---|---:|---:|---:|
| HSV-2-015 | Výztuž desky KARI síť Ø8 oka 100×100 mm  | 495 m² × 3.95 kg/m² (KARI Ø8 100×100) | 156420000.0 | 1955.25 | 7999900.0 |
| HSV-3-008 | Styčníkové plechy + spojovací materiál š | ~6% × součet OK 27 985 kg ≈ 1 450 kg | 71806500.0 | 1450.0 | 4952072.4 |
| HSV-1-026 | Nakládání stavební suti na dopravní pros | placeholder 540 m² × 0.25 m × 2 t/m³ × 30% = ~80 t | 648000.0 | 80.0 | 809900.0 |
| HSV-3-003 | Specifikace + dodávka příčlí IPE 450 S23 | 6 rámů × 18.5 m × 77.6 kg/m × 1.1 (náběh) = 9 478  | 40761277.92 | 9474.96 | 430100.0 |
| HSV-9-002 | Pomocné lešení pro montáž ocelové konstr | placeholder ~200 m³ prostorové lešení pro halu 28× | 638400.0 | 200.0 | 319100.0 |
| HSV-3-001 | Specifikace + dodávka sloupy IPE 400 S23 | 36 ks × 4.3 m × 66.3 kg/m = 10 263 kg | 26992321.2 | 10263.24 | 262900.0 |
| VRN-013 | Doprava materiálu na stavbu vodorovně —  | placeholder ~1500 t·km (30 t materiálů × 50 km) | 2250000.0 | 1500.0 | 149900.0 |
| HSV-3-004 | Specifikace + dodávka vaznice IPE 160 S2 | 12 řad × 27.4 m × 15.8 kg/m = 5 195 kg | 5065164.0 | 5195.04 | 97400.0 |
| HSV-3-012 | Antikorozní nátěr 2-vrstvý dle ISO 12944 | celk. povrch profilů ~30 m²/t × 28 t = 850 m² | 714000.0 | 850.0 | 83900.0 |
| HSV-3-002 | Specifikace + dodávka sloupy HEA 200 S23 | 8 ks × 4.3 m × 42.3 kg/m = 1 455 kg | 662079.6 | 1455.12 | 45400.0 |
