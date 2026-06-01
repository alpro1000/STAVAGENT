# VÝMĚRY register — RD Jáchymov (dům 260219 + sklad 260217)

> **Výměry-First (Pattern 45):** the measurement base. Every work `mnozstvi` should REFERENCE a row here.
> **Date:** 2026-06-01 · read-only · **Tag:** `measured` (DXF/TZ) · `derived` (formula over measured) · `estimate` (OVĚŘIT) · `blank` (null, no geometry).
> Merges `sklad_audit.md` (sklad rows below) + dům skladby/sokl audits.

---

## 1. VÝMĚRY — DŮM (260219)

| Výměra | Hodnota | Tag | Zdroj | Spotřebuje (work items) |
|---|---|---|---|---|
| obvod domu | 38,7 m | measured | DXF | fasáda, sokl |
| podlaží 1.PP / 1.NP / 2.NP / 3.NP (stav) | 32,4 / 59,5 / 61,0 / 64,9 m² | measured | DXF půdorysy stav | bourání, podlahy |
| podlaží návrh (byt) | 61,4(48,2) / 61,1(49,6) / 64,5(52,8) | measured | DXF půdorysy návrh | nové podlahy, povrchy |
| celková plocha (PBŘ) | 219,3 m² | measured | PBŘ D.3 | — |
| fasáda ETICS (S01/S12a) | 276,7 m² | derived | 38,7 × 0,55 volná × 13,0 v | HSV7.001/002/006 |
| **sokl (S03)** | **23 m² (→ 16 ×řadovka 0,7?)** | **estimate ⚠️** | 38,7 × 0,6 (bez řadovka) | HSV7.007/008/009, HSV6.018 — **vyjasnění #35** |
| strop trámový S07 | 59,5 m² | measured | skladby_per_zone | HSV4.011/4.013/4.014 |
| strop ocelobeton S09 | 104,4 m² | measured | skladby_per_zone | HSV2.010/HSV4.002-006 |
| střecha šikmá S10 | 140,94 m² | measured | skladby_per_zone | HSV5.007-013, HSV5.018 |
| krov krokve | 156 bm | measured | krov výkres | HSV5.001 |
| **strop klemba S08** | **— (null)** | **blank** | legenda only, řez nepretíná | HSV4.018-021 qty=null — **vyjasnění V1** |

## 2. VÝMĚRY — SKLAD (260217)

| Výměra | Hodnota | Tag | Zdroj | Spotřebuje |
|---|---|---|---|---|
| footprint lichoběžník | cca 6,35 × 3,34 m | measured | TZ statika + DXF | hloubení, strop |
| **vnitřní místnost 0.01** | **17,6 m²** | measured | DXF km_tabulka | PSV77.001 dlažba |
| **footprint (obdélník bounding)** | **21,2 m² (= 6,35×3,34)** | derived ⚠️ | rect, NE lichoběžník | HSV1.005/2.005/4.002 — **konflikt s 17,6** |
| schodiště 1.02 | 5,5 m² | measured | DXF | HSV5.001 |
| parking pororošt | 44,6 m² (= 7,0×6,35) | measured | DXF km_tabulka + TZ | HSV4.005 |
| obvod sklad | 19,4 m | derived | 2×(6,35+3,34) | pasy, stěny |
| stěny ztracené bednění | 46,5 m² (19,4 × 2,4 v) | derived | obvod × výška | HSV3.002/3.003 |
| stropnice rozpon | **3,1 m (TZ)** / délka 3,34 | measured | TZ statika | HSV4.001 — **label 3,34 vs 3,1** |
| stání IPE180 | 7,0 m délka × 6,35 | measured | TZ statika | HSV2.002/4.004 |
| **opěrná zeď prefa „lego"** | **výška ~1,6 m PŘEDPOKLAD** | **estimate ⚠️** | TZ neuvádí výšku | HSV3.001 60 ks — **OVĚŘIT** |
| hloubení sklad | H = 1,2 m (svah 1:0,5) | estimate ⚠️ | navážka 4,8 m, prudký svah | HSV1.002 — **vyjasnění #33** |

---

## 3. DECOMPOSITION AUDIT — trasuje qty na výměru?

### ✅ Traces cleanly (qty ← výměra)
S07 59,5 · S09 104,4 · S10 140,94 · fasáda 276,7 · krov 156 bm · parking 44,6 · stěny 46,5 · stropnice profil · podlaží areas · IPE180 921 kg.

### ⚠️ Inconsistent (one element → two výměry)
| # | Element | Konflikt | Fix |
|---|---|---|---|
| **W1** | sklad podlaha | **21,2** (footprint, štěrk/lože/záklop) vs **17,6** (DXF vnitřní, dlažba) | podlahové vrstvy → 17,6; strop/záklop → footprint lichoběžník (ne 21,2 rect) |
| **W2** | dům sokl | **23** (bez řadovka) — vs řadovka 0,7 → ~16 | vyjasnění #35 + řadovka |
| **W3** | sklad footprint | **21,2 obdélník** vs lichoběžník (skutečnost menší) | DXF plocha lichoběžníku |

### 🟡 Estimate without firm geometry (Pattern 44 — verify or null)
| # | Item | Co |
|---|---|---|
| **W4** | HSV3.001 prefa „lego" 60 ks | výška stěny 1,6 m předpoklad → výkres-count nebo OVĚŘIT |
| **W5** | HSV1.002 hloubení H=1,2 m | prudký svah, navážka 4,8 m → vyjasnění #33 |
| **W6** | HSV2.004 „+zídka ~1 m³" / HSV1.001 8 m³ / VRN.002 8 t | ruční odhady |

### blank (correct null — no geometry)
S08 klemba (HSV4.018-021) · vjezd dlažba (HSV5.002) — vyjasnění V1 / Dodatek.

---

## 4. Souhrn k approve (STOP gate — fix on GO)
| Fix | Akce | Deterministický? |
|---|---|---|
| **W1** sklad podlaha 21,2→17,6 (vrstvy) | HSV1.005/2.005 → 17,6 | ✅ ano |
| **DS3** stropnice count 10→11 | HSV4.001 | ✅ ano |
| **W2/W3/W4/W5** | vyjasnění (#35 sokl, #33 hloubka, +#36 lichoběžník plocha + prefa výška) | ❓ DXF/projektant |

Žádné dvojí počítání (jako sokl domu) — jen výměra-mismatche + odhady. Deterministické (W1, DS3) lze opravit hned; geometrie-závislé (lichoběžník, prefa výška) → vyjasnění #36.

---

## 6. SKLAD — measured update z výkresů (2026-06-01, vision P39)

Zdroje: D.1.1.01 (půdorys střechy), D.1.1.02 (půdorys suterénu), D.1.1.03 Řez A-A, D.1.1.04 Řez B-B + legendy.

| Výměra | Hodnota | Tag | Zdroj |
|---|---|---|---|
| Parking stání | **44.60 m²** | measured | legenda místností (NE 44.71 polygon) |
| Sklad room 0.01 | **17.60 m²** | measured | legenda místností |
| Schodiště | **5.50 m²** (9×179.5×250) | measured | legenda + řez |
| Světlá výška skladu | **2.68–2.79 m** | measured | Řez B-B |
| Stěna floor→deck | ~3.23 m | measured | Řez A-A (−3.230 → ±0.000) |
| Opěrná stěna S04 | ~3.0 m (3000) | measured | Řez A-A |
| Stěny pod terénem (S03a+S04) | ~33 m² | derived | řez × obvod, OVĚŘIT |

### Resolved this pass
- **W1** sklad podlaha 21.2 → **17.6** (legenda confirmed) — HSV1.005/2.005 FIXED.
- **DS3** stropnice 10 → **11 ks** (6.35/0.625) — HSV4.001 FIXED.
- **W2** dům sokl 23 → **16** (řadovka 0.7, jedna báze) — HSV7.007/008/009 + HSV6.018 FIXED + vyjasnění #35.
- **NEW** HI/protiradon (HSV3.004) + drenáž nopová folie (HSV3.005) stěn S03a+S04 — gap z výkresu, ~33 m² OVĚŘIT.

### Skladby S01-S05 — všechny mapovány na položky ✓
S01 podlaha (dlažba+drť+pláň), S02 strop (pororošt/IPE180/HI/záklop/KVH 100/160), S03a/b stěny (ztracené bednění 250 + HI/protiradon/drenáž), S04 opěrná stěna (prefa bloky 600 = HSV3.001 + HI/drenáž), S05 schodiště.
