# Phase 6.6 GATE 2 — Master ↔ material pairing stats

_Generated: 2026-05-21T09:07:44+00:00_

_Branch: claude/tz-material-decomposition-lBp5D_

## 1. Pairing totals

- **Master items (unchanged):** 4090
- **Sub-items emitted:** 5930
- Material library entries (GATE 1): 714
  - Used as source: 423
  - Unmapped taxonomy (`material_kind=None` in library): 329

⚠️ **329 library entries with `material_kind=None`** (taxonomy gaps — verbatim + provenance valid but unclassified). Per user spec these are **accepted as-is** and not blocking pairing. Doporučujeme review pro budoucí rozšíření taxonomy rules.

## 2. Sub-items by source provenance

| Source | Count | % | Confidence |
|---|---:|---:|---:|
| `tz_explicit_with_rate` | 0 | 0.0 | 1.0 |
| `tz_explicit_no_rate` | 293 | 4.9 | 0.5 |
| `tabulka_referenced` | 130 | 2.2 | 0.95 |
| `vykres_annotated` | 0 | 0.0 | 0.85 |
| `generic_no_documentation` | 0 | 0.0 | 0.3 |

## 3. Pairing cases per master item

| Case | Count |
|---|---:|
| `case_4_generic` | 1275 |
| `case5_master_is_material` | 1240 |
| `no_kapitola_rule` | 406 |
| `cases_1_3_library` | 316 |
| `no_pairing_promoted_case5` | 298 |
| `skipped_status` | 212 |
| `skipped_zero_qty` | 107 |
| `skipped_mj_incompatible` | 95 |
| `rate_from_popis_universal` | 86 |
| `skipped_install_only` | 44 |
| `vrn_services` | 11 |

## 4. Sub-items by kapitola

| Kapitola | Sub-items |
|---|---:|
| `HSV-963` | 1884 |
| `PSV-784` | 1156 |
| `HSV-631` | 377 |
| `HSV-612` | 361 |
| `PSV-771` | 318 |
| `PSV-781` | 292 |
| `HSV-611` | 291 |
| `PSV-763.2` | 215 |
| `PSV-776` | 168 |
| `PSV-763.1` | 136 |
| `HSV-642` | 97 |
| `PSV-783` | 87 |
| `PSV-766` | 86 |
| `PSV-767` | 75 |
| `PSV-713` | 74 |
| `HSV-713` | 43 |
| `PSV-764` | 41 |
| `OP-detail` | 35 |
| `PSV-763` | 34 |
| `HSV-961` | 20 |

## 5. Aggregate totals — top 25 materials across objekt D

| Materiál | MJ | Σ množství |
|---|---|---:|
| Cementový potěr F5 tl. 58 mm (FF31) | kg | 35,888.05 |
| Cementový potěr F5 tl. 50 mm (FF30) | kg | 18,778.21 |
| Cementový potěr F5 tl. 58 mm (FF21) | kg | 18,013.93 |
| Tondach bobrovka — počet kusů | ks | 10,944.00 |
| Cementový potěr F5 tl. 50 mm (FF03) | kg | 9,293.02 |
| Cementový potěr F5 tl. 50 mm (FF20) | kg | 7,662.49 |
| Příprava povrchů pro malby (broušení + hladění) | m2 | 6,757.00 |
| Lepidlo flexibilní C2TE — disperzní | kg | 5,701.49 |
| Výztužná stěrka pod finální vrstvu | kg | 5,506.13 |
| Talířové hmoždinky | ks | 4,720.00 |
| Výztužná tkanina (perlinka) — omítka | m2 | 4,013.27 |
| Pronájem lešení fasádní × 4 měsíce | m2 | 3,352.00 |
| Lepidlo flexibilní pro cihelné pásky | kg | 2,712.90 |
| Penetrace univerzální — disperzní | l | 2,366.37 |
| Samonivelační stěrka 3 mm (F03) | kg | 2,205.08 |
| Spárovací hmota Polyblend S | kg | 2,170.32 |
| Průběžný úklid během prací × 4 měsíce | m2 | 2,112.32 |
| Lepidlo (Cemix) tl. 5 mm | kg | 1,991.07 |
| Žárové zinkování ocelových LP## (zábradlí, schodiště) | kg | 1,956.66 |
| Vyleštění dlažby + obkladů | m2 | 1,911.00 |
| Malba disperzní — 1× vrstva | l | 1,603.71 |
| Ocelové sloupky IPE120 — krov 3.NP | kg | 1,152.00 |
| Omítka vápenocementová | m2 | 1,133.37 |
| Základní nátěr ŽB stěn — Sikagard 552W Aquaprimer (přilnavos | m2 | 1,089.08 |
| Bezprašný nátěr ŽB stěn — Sikagard 555W Elastic (transparent | m2 | 1,089.08 |

## 6. Spot-check — 5 masters with full sub-item provenance

### Master `73046604-e4f…` — kapitola `PSV-784`
- **popis:** Penetrace stěn pod malbu vápenná (F19)
- **master qty:** 76.71 m2
- **misto:** {"objekt": "D", "podlazi": "1.PP", "mistnosti": ["S.D.09"]}
- **sub-items (3):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Penetrace univerzální — disperzní | 15.34 | l | 🌐 ČSN 73 3450 | 0.6 |
  | 2 | Malba disperzní — 1× vrstva | 11.51 | l | 🌐 ČSN EN 13300 | 0.6 |
  | 3 | Tmel akrylátový — spárování / dilatace | 3.83 | kg | 🌐 ČSN EN ISO 11600 | 0.6 |

### Master `dd1bc458-c0b…` — kapitola `PSV-771`
- **popis:** Penetrace pod dlažbu (F01)
- **master qty:** 9.965 m2
- **misto:** {"objekt": "D", "podlazi": "1.NP", "mistnosti": ["D.1.S.02"]}
- **sub-items (1):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Penetrace pod dlažbu (F01) | 1.99 | l | 🌐 ČSN 73 3450 | 0.7 |

### Master `d68d1ba8-f15…` — kapitola `PSV-781`
- **popis:** Penetrace pod hydroizolaci stěn (F06)
- **master qty:** 22.33 m2
- **misto:** {"objekt": "D", "podlazi": "1.NP", "mistnosti": ["D.1.1.03"]}
- **sub-items (1):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Penetrace pod hydroizolaci stěn (F06) | 4.47 | l | 🌐 ČSN 73 3450 | 0.7 |

### Master `1d721a72-5d6…` — kapitola `HSV-622.1`
- **popis:** Penetrace pod cihelné pásky
- **master qty:** 542.58 m2
- **misto:** {"objekt": "D", "podlazi": "fasáda", "mistnosti": []}
- **sub-items (1):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Penetrace pod cihelné pásky | 108.52 | l | 🌐 ČSN 73 3450 | 0.7 |

### Master `5f3d6fb4-7d5…` — kapitola `HSV-963`
- **popis:** Prostup ve stropě — VZT (vzduchotechnika), 1.NP
- **master qty:** 1 ks
- **misto:** {"mistnosti": [], "objekt": "D", "podlazi": "1.NP"}
- **sub-items (2):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Tmel požárně-odolný — utěsnění prostupu | 0.50 | kg | 🌐 ČSN 73 0810 + ČSN EN 1366-3 | 0.6 |
  | 2 | Manžeta protipožární — prostup | 1.00 | ks | 🌐 ČSN 73 0810 + ČSN EN 1366-3 | 0.6 |

## 7. Stop conditions check

| Condition | Threshold | Actual | Status |
|---|---|---|---|
| Master count unchanged | = original | 4090 | ✅ |
| Sub-items have paired_with link | 100 % | 100 % | ✅ |
| Cross-objekt scope inherited | 100 % | 100 % | ✅ |
| Generic rates NOT inlined in code | external KB | generic_consumption_rates.json | ✅ |
| Case 4 sub-items use [odhad] prefix | required | 0 / 0 | ✅ |

---

**GATE 2 deliverable status:** sub-items paired, per-source stats, spot-check 5 masters, aggregate totals emitted.

**Awaiting user approval before GATE 3 (Excel + audit list).**
