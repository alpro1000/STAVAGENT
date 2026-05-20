# Phase 6.6 GATE 2 — Master ↔ material pairing stats

_Generated: 2026-05-20T18:57:18+00:00_

_Branch: claude/tz-material-decomposition-lBp5D_

## 1. Pairing totals

- **Master items (unchanged):** 4090
- **Sub-items emitted:** 4956
- Material library entries (GATE 1): 714
  - Used as source: 1038
  - Unmapped taxonomy (`material_kind=None` in library): 329

⚠️ **329 library entries with `material_kind=None`** (taxonomy gaps — verbatim + provenance valid but unclassified). Per user spec these are **accepted as-is** and not blocking pairing. Doporučujeme review pro budoucí rozšíření taxonomy rules.

## 2. Sub-items by source provenance

| Source | Count | % | Confidence |
|---|---:|---:|---:|
| `tz_explicit_with_rate` | 0 | 0.0 | 1.0 |
| `tz_explicit_no_rate` | 664 | 13.4 | 0.5 |
| `tabulka_referenced` | 374 | 7.5 | 0.95 |
| `vykres_annotated` | 0 | 0.0 | 0.85 |
| `generic_no_documentation` | 3918 | 79.1 | 0.3 |

## 3. Pairing cases per master item

| Case | Count |
|---|---:|
| `case_4_generic` | 1398 |
| `case5_master_is_material` | 973 |
| `no_kapitola_rule` | 432 |
| `mixed` | 337 |
| `cases_1_3_library` | 286 |
| `skipped_status` | 223 |
| `no_pairing` | 215 |
| `skipped_mj_incompatible` | 101 |
| `skipped_zero_qty` | 81 |
| `skipped_install_only` | 44 |

## 4. Sub-items by kapitola

| Kapitola | Sub-items |
|---|---:|
| `HSV-963` | 1884 |
| `PSV-784` | 1368 |
| `PSV-771` | 336 |
| `HSV-612` | 312 |
| `PSV-781` | 304 |
| `HSV-611` | 284 |
| `HSV-631` | 214 |
| `PSV-776` | 168 |
| `HSV-713` | 43 |
| `PSV-763` | 34 |
| `HSV-622.1` | 6 |
| `PSV-713` | 3 |

## 5. Aggregate totals — top 25 materials across objekt D

| Materiál | MJ | Σ množství |
|---|---|---:|
| Lepidlo flexibilní C2TE — disperzní | kg | 9,879.98 |
| Cementový potěr | kg | 4,410.16 |
| Výztužná tkanina (perlinka) — omítka | m2 | 4,013.27 |
| Lepidlo (Cemix) tl. 5 mm | kg | 3,383.07 |
| Penetrace univerzální — disperzní | l | 3,275.40 |
| Malba disperzní — 1× vrstva | l | 2,160.11 |
| Tepelná izolace EPS | m2 | 1,892.28 |
| Omítka vápenocementová | m2 | 1,205.11 |
| Obkladový pásek cihelný (Terca) | m2 | 1,085.16 |
| Nášlapná vrstva (vinyl)		07 mm | m2 | 980.04 |
| Manžeta protipožární — prostup | ks | 942.00 |
| Obklad keramický (Schluter) | m2 | 890.84 |
| Cementový potěr | m2 | 814.87 |
| Spárovací hmota — keramika | kg | 754.33 |
| Penetrace tl. 15 mm | l | 729.70 |
| Tmel akrylátový — spárování / dilatace | kg | 720.11 |
| Nášlapná vrstva (dlažba/vinyl)	15/7 mm | m2 | 617.81 |
| Tmel požárně-odolný — utěsnění prostupu | kg | 471.00 |
| Dle použitého sytému (ref. např. Cemix penetrace H) | l | 397.98 |
| Nárožní lišta — omítka | bm | 364.84 |
| SDK deska (Knauf) | m2 | 252.58 |

## 6. Spot-check — 5 masters with full sub-item provenance

### Master `73046604-e4f…` — kapitola `PSV-784`
- **popis:** Penetrace stěn pod malbu vápenná (F19)
- **master qty:** 76.71 m2
- **misto:** {"objekt": "D", "podlazi": "1.PP", "mistnosti": ["S.D.09"]}
- **sub-items (3):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | [odhad] Penetrace univerzální — disperzní | 15.34 | l | ⚠ ODHAD — generic standard | 0.3 |
  | 2 | [odhad] Malba disperzní — 1× vrstva | 11.51 | l | ⚠ ODHAD — generic standard | 0.3 |
  | 3 | [odhad] Tmel akrylátový — spárování / dilatace | 3.83 | kg | ⚠ ODHAD — generic standard | 0.3 |

### Master `31aa7a4d-226…` — kapitola `PSV-771`
- **popis:** Dlažba keramická — kladení (F01)
- **master qty:** 9.965 m2
- **misto:** {"objekt": "D", "podlazi": "1.NP", "mistnosti": ["D.1.S.02"]}
- **sub-items (4):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Nášlapná vrstva (dlažba/vinyl)	15/7 mm | 9.96 | m2 | ⚠ TZ Podlahy (rate odhad) | 0.5 |
  | 2 | Lepidlo (Cemix) tl. 5 mm | 49.83 | kg | 📋 Tabulka 0030 | 0.95 |
  | 3 | Dle použitého sytému (ref. např. Cemix penetrace H) | 1.99 | l | 📋 Tabulka 0030 | 0.95 |
  | 4 | [odhad] Spárovací hmota — keramika | 4.98 | kg | ⚠ ODHAD — generic standard | 0.3 |

### Master `2e9c92df-47c…` — kapitola `PSV-781`
- **popis:** Hydroizolační stěrka 2× pod obklad (F06) (full-height sprcha wall)
- **master qty:** 6.699 m2
- **misto:** {"objekt": "D", "podlazi": "1.NP", "mistnosti": ["D.1.1.03"]}
- **sub-items (4):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Obklad keramický (Schluter) | 6.70 | m2 | ⚠ TZ Obklady vnitřní (rate odhad) | 0.5 |
  | 2 | [odhad] Penetrace univerzální — disperzní | 1.34 | l | ⚠ ODHAD — generic standard | 0.3 |
  | 3 | [odhad] Lepidlo flexibilní C2TE — disperzní | 33.49 | kg | ⚠ ODHAD — generic standard | 0.3 |
  | 4 | [odhad] Spárovací hmota — keramika | 3.35 | kg | ⚠ ODHAD — generic standard | 0.3 |

### Master `d42db1fc-33f…` — kapitola `HSV-622.1`
- **popis:** Cihelné pásky Terca — kladení
- **master qty:** 542.58 m2
- **misto:** {"objekt": "D", "podlazi": "fasáda", "mistnosti": []}
- **sub-items (3):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | Obkladový pásek cihelný (Terca) | 542.58 | m2 | ⚠ TZ Fasádní plášť (rate odhad) | 0.5 |
  | 2 | [odhad] Penetrace univerzální — disperzní | 108.52 | l | ⚠ ODHAD — generic standard | 0.3 |
  | 3 | [odhad] Lepidlo flexibilní C2TE — disperzní | 2,712.90 | kg | ⚠ ODHAD — generic standard | 0.3 |

### Master `5f3d6fb4-7d5…` — kapitola `HSV-963`
- **popis:** Prostup ve stropě — VZT (vzduchotechnika), 1.NP
- **master qty:** 1 ks
- **misto:** {"mistnosti": [], "objekt": "D", "podlazi": "1.NP"}
- **sub-items (2):**

  | # | Popis | Sub qty | MJ | Zdroj | Conf |
  |--:|---|---:|---|---|---:|
  | 1 | [odhad] Tmel požárně-odolný — utěsnění prostupu | 0.50 | kg | ⚠ ODHAD — generic standard | 0.3 |
  | 2 | [odhad] Manžeta protipožární — prostup | 1.00 | ks | ⚠ ODHAD — generic standard | 0.3 |

## 7. Stop conditions check

| Condition | Threshold | Actual | Status |
|---|---|---|---|
| Master count unchanged | = original | 4090 | ✅ |
| Sub-items have paired_with link | 100 % | 100 % | ✅ |
| Cross-objekt scope inherited | 100 % | 100 % | ✅ |
| Generic rates NOT inlined in code | external KB | generic_consumption_rates.json | ✅ |
| Case 4 sub-items use [odhad] prefix | required | 3918 / 3918 | ✅ |

---

**GATE 2 deliverable status:** sub-items paired, per-source stats, spot-check 5 masters, aggregate totals emitted.

**Awaiting user approval before GATE 3 (Excel + audit list).**
