# INVENTORY — RD Jáchymov Fibichova 733

**Datum prvotního auditu:** 2026-05-16
**Datum UNSORTED auditu:** 2026-05-16 (Phase 0b §3.1, branch `claude/rd-jachymov-phase-0b-foundation`)
**Datum re-parse:** 2026-05-16 (Phase 0b §3.2 — `tools/phase0b_validator.py`, 67/69 = 97.1 % verified, 0 drifts, gate OPEN)
**Datum DXF parse:** 2026-05-16 (Phase 0b §3.3 — `tools/phase0b_dxf_extractor.py`, 4/4 DXF parsed OK, vyjasnění #18 partially_resolved)
**Datum Phase 1 HSV gate:** 2026-05-16 (Phase 1 §HSV — `tools/phase1_items_generator.py --group HSV`, 95 položek (74 dum + 21 sklad), 0 sub mapping fail, 0 mnozstvi confidence pod 0.70; vyjasnění #18 fully_resolved via LWPOLYLINE probe)
**Datum Phase 1 PSV gate:** 2026-05-16 (Phase 1 §PSV — 35 položek (33 dum + 2 sklad), 2 needs_mapping flags: okenni_zaluzie_kastlik_purenit + biodeska_konstrukcni)
**Datum Phase 1 TZB+M gate:** 2026-05-16 (Phase 1 §TZB — 22 položek dum, 1 needs_mapping flag: instalater_TUV_akumulacni_zasobnik. Architectural bugfix: `_gate` field oddělený od `kapitola_group`)
**Datum Phase 1 VRN gate:** 2026-05-16 (Phase 1 §VRN — 19 položek (15 dum + 4 sklad), 2 needs_mapping flags: mykolog + azbestovy_specialista. Phase 1 COMPLETE)
**Datum Phase 1 complete:** 2026-05-16 — **171 položek celkem** (144 dum + 27 sklad), všechna 4 STOP gates uzavřena, 5 needs_mapping flags akumulovaných pro batch update.
**Sběr:** Email cesta Volný → Jiří Šmíd → Karel Šmíd → Alexander; OneDrive linky 2× (sklad+parking + dům)
**Status:** **PODKLADY DSP KOMPLETNÍ** pro varianty A/C, **DSP-only limity zachovány** pro variantu B (chybí výpisy oken/dveří, tabulky místností, skladby — typický nedostatek DSP). Phase 0b §3.1 + §3.2 dokončeny.

---

## 1. Co máme (verified)

### 1.1 Společné pro oba objekty

| Soubor | Velikost | Stupeň | Datum | Zpracovatel |
|---|---:|---|---|---|
| `inputs/tz/common/B_Souhrnna_TZ_EAR.pdf` | 585 KB | DSP | 02/2026 | SMASH architekti (M. Smolka) |

Pokrývá: identifikační údaje, urbanismus, výpočet parkovacích stání, požadavky DOSS, odpady, bilance, vodohospodářské řešení, BOZP základní.

### 1.2 Objekt 260219 — Dům (rekonstrukce + nástavba)

| Soubor | Velikost | Stupeň | Datum | Zpracovatel |
|---|---:|---|---|---|
| `inputs/tz/260219_dum/D_1_1_01_TZ_ARS_dum_EAR.pdf` | 465 KB | DSP | 12/2025-01/2026 | SMASH architekti |
| `inputs/tz/260219_dum/D_2_1_TZ_statika_dum_TeAnau.pdf` | 2.1 MB | DSP | 09.02.2026 | TeAnau s.r.o. (Tvardík, Bendík) |
| `inputs/tz/260219_dum/D_3_PBR_dum_TUSPO.pdf` | 1.2 MB | DSP+DPS | 01/2026 | TUSPO (Kirschbaum, Tuček) |

### 1.3 Objekt 260217 — Zahradní sklad, parking, schodiště

| Soubor | Velikost | Stupeň | Datum | Zpracovatel |
|---|---:|---|---|---|
| `inputs/tz/260217_sklad/D_1_1_00_TZ_ARS_sklad_EAR.pdf` | 425 KB | DSP | 12/2025-01/2026 | SMASH architekti |
| `inputs/tz/260217_sklad/D_2_1_TZ_statika_sklad_TeAnau.pdf` | 2.2 MB | DSP | 06.02.2026 | TeAnau s.r.o. |

PBŘ pro sklad/parking SAMOSTATNÉ NENÍ — sklad spadá do volné stavby k bydlení a pravděpodobně bude pokryt obecným PBŘ domu, ale to je třeba ověřit.

---

## 2. Stav po UNSORTED auditu (2026-05-16)

### 2.1 Výkresy a další podklady — DODÁNO

| Typ | Status | Soubory |
|---|---|---|
| **C — Situační výkresy** | ✅ Kompletní | `situace/`: C.01 širší vztahy, C.02 katastrální, C.03.R2 koordinační (3 PDF) |
| **D.1.1 ARS dům — půdorysy** | ✅ Kompletní | `vykresy_pdf/260219_dum/`: 4 podlaží × 3 fáze (stav/bourání/návrh) = 12 PDF + krov návrh + střecha (R2) |
| **D.1.1 ARS dům — řezy** | ✅ Kompletní | Příčný řez A-A (stav/bourání/návrh), Podélný řez B-B (návrh) = 4 PDF |
| **D.1.1 ARS dům — pohledy** | ✅ Kompletní | 6 PDF: 2 stav, 2 bourání, 2 návrh |
| **D.1.1 ARS sklad** | ⚠️ MINIMUM | jen `D.1.1.02.R1 - Půdorys suterénu_skladu` (1 PDF). Bez řezu, bez pohledů sklad — předpokládá se že sklad je čistý technický prostor, statika pokrývá konstrukční detaily |
| **D.1.1 výpisy (okna/dveře/skladby/místnosti)** | ❌ N/A v DSP | typický nedostatek DSP — projektant nepořizoval. Blokuje plnohodnotnou variantu B u PSV/výplní otvorů |
| **D.2.2 statický výpočet** | ✅ Kompletní | dům: `D.2.2 - statický výpočet _ EAR.pdf` (19.8 MB, plné znění s přílohami) |
| **D.2.3 výkresy tvaru** | ✅ Kompletní | dům: 4 PDF (1.PP, 1.NP, 2.NP, 3.NP). Sklad nemá samostatné — pokryto statickou TZ |
| **D.3 — PBŘ** | ✅ Dům kompletní | 1 PDF v `tz/260219_dum/` |
| **DXF / DWG** | ✅ DODÁNO (oba objekty) | 4 DXF: dům DPZ + situace, vjezd DPZ + situace |
| **Dokladová část E** | ✅ Kompletní | `dokladova_cast/`: 10 PDF — JES, MU rozhodnutí + nabytí PM, město Souhlas + Vyjádření, 3× PČR stanoviska (vč. dodatek PD č.1 a koordinační situace), TI DTM mapa, E.01 dodatek PD |
| **A — Průvodní list** | ✅ Kompletní | `tz/common/A - průvodní list _ EAR.pdf` |
| **B — Souhrnná TZ** | ✅ Kompletní | `tz/common/B_Souhrnna_TZ_EAR.pdf` |

### 2.2 Stále chybí (DSP-only limity, nezáleží na auditu)

**Doplňující dokumenty:**

- [ ] IGP (inženýrsko-geologický průzkum) — **NEPROVEDEN**, statika použila archivní vrty
- [ ] Mykologický průzkum dřeva — **bude proveden při bourání** (TZ §3.2.3 dům)
- [ ] Azbestový průzkum — předběžné ohledání negativní, podrobný před bouráním
- [ ] PENB (energetický průkaz) — bude ke kolaudaci, není součástí DSP
- [ ] Statický výpočet v plném znění (RFEM 5.39 model) — text TZ statika obsahuje pouze závěry
- [ ] Polohopisné a výškopisné zaměření pozemku — pro architekta podklad, není přílohou
- [ ] Tabulka místností s plochami — **CHYBÍ** (typický nedostatek DSP, pro Libuše-style pipeline blocker)
- [ ] Výpis prvků (okna/dveře/klempířka/zámeč/truhl.) — **CHYBÍ** pro DSP-only projekt

---

## 3. Implikace pro rozpočet

### 3.1 Agregovaný rozpočet (varianta A — doporučená)
- ✅ Možný kompletně z dostupných TZ.
- Skeleton: 20–30 položek na dům, 10–15 na sklad+parking, plus VRN.
- Výměry odhad/extract z TZ (zastavěná, podlahová, m³ obestavěný).
- Časový odhad: 8–12 h práce rozpočtáře.

### 3.2 Položkový rozpočet (varianta B)
- ⚠️ Lze sestavit, ale s následujícími caveats:
  - Bourací práce — z popisu v TZ + odhad procent jednotlivých materiálových frakcí (TZ B m.10.e dává t-y odpadů)
  - HSV — z geometrie + statických detailů (počty IPE180, ks překladů IPN160, m² ETICS)
  - PSV výplně otvorů — **bez výpisu oken/dveří** položit obecně dle ploch fasád + počtu místností
  - Klempířina, zámečnictví, truhlářské prvky — odhad ks/m podle popisu
  - TZB — agregované sumy (kamna, elektrokotel, krb, multisplit TČ, ELI rozvody, ZTI revize, ŽB rozvody atd.) — bez detailních výkazů
- Časový odhad: 30–40 h.

### 3.3 Hybrid (varianta C)
- HSV položkově do ÚRS kódů, PSV+TZB agregovaně po kapitolách.
- Praktický kompromis.
- Časový odhad: 18–25 h.

---

## 4. Hodnocení úplnosti pro STAVAGENT pipeline

| Komponent pipeline | Status | Poznámka |
|---|---|---|
| TZ ARS | ✅ Kompletní | dům + sklad |
| TZ statika | ✅ Kompletní | dům + sklad |
| TZ B souhrnná | ✅ Kompletní | |
| TZ TZB profese (D.1.4) | ❌ N/A v DSP | projektant nepořizoval |
| PBŘ | ✅ Dům kompletní | sklad samostatné PBŘ — k ověření |
| Půdorysy | ✅ Dům kompletní, sklad jen suterén | 4 podlaží × 3 fáze pro dům; sklad jen jeden výkres |
| Řezy | ✅ Dům kompletní | A-A stav/bourání/návrh + B-B návrh |
| Pohledy | ✅ Dům kompletní | 6 pohledů (stav/bourání/návrh × 2 strany) |
| Situace C | ✅ Kompletní | C.01 / C.02 / C.03.R2 |
| Tabulka místností 0020 | ❌ N/A v DSP | blocker pro Libuše-style Π.0a |
| Tabulka skladeb 0030 | ❌ N/A v DSP | blocker pro Libuše-style Π.0a |
| Tabulky 0041/0042/0080 | ❌ N/A v DSP | blocker pro Libuše-style |
| DXF | ✅ Oba objekty | 4 DXF: dům DPZ+situace, vjezd DPZ+situace |
| Dokladová část E | ✅ Kompletní | 10 PDF v dokladova_cast/ |

**Závěr:** Použít **hk212-style pipeline** (TZ + výkresy → Phase 0b + Phase 1), NE Libuše-style (chybí tabulky).

---

## 5. Phase 0b §3.1 — UNSORTED audit (2026-05-16)

**Vstup:** 65 souborů v `UNSORTED/` (po unzip + GitHub UI upload). **Výstup:** 60 souborů přesunutých do strukturovaných podadresářů + 8 byte-identických duplikátů smazaných + 7 starších revizí do `_superseded/2026-05-16_unsorted_audit/`.

### 5.1 Hard-deleted (byte-identical to canonical or stray)

| Soubor | Důvod |
|---|---|
| `1` (1 B) | Stray placeholder (commit 13d57e1 re-upload artifact) |
| `D.1.1.2.1.04 - Půdorys 1.PP - stav _ EAR (1).pdf` | SHA = no-`(1)` variant |
| `D.2.3.03 - výkres tvaru 2.NP _ EAR (1).pdf` | SHA = no-`(1)` variant |
| `B - Souhrnná technická zpráva _ EAR.pdf` | SHA = canonical `tz/common/B_Souhrnna_TZ_EAR.pdf` |
| `D.1.1.00 - Technická zpráva _ EAR.pdf` | SHA = canonical `tz/260217_sklad/D_1_1_00_TZ_ARS_sklad_EAR.pdf` |
| `D.1.1.01 - Technická zpráva _ EAR.pdf` | SHA = canonical `tz/260219_dum/D_1_1_01_TZ_ARS_dum_EAR.pdf` |
| `D.2.1 - technická zpráva _ EAR.pdf` | SHA = canonical `tz/260217_sklad/D_2_1_TZ_statika_sklad_TeAnau.pdf` (sklad, ne dům!) |
| `D.2.1 - technická zpráva.pdf` | SHA = canonical `tz/260219_dum/D_2_1_TZ_statika_dum_TeAnau.pdf` (dům) |
| `D.3 - PBR_RD_Jachymov_EAR.pdf` | SHA = canonical `tz/260219_dum/D_3_PBR_dum_TUSPO.pdf` |

### 5.2 Moved to `_superseded/2026-05-16_unsorted_audit/`

| Soubor | Důvod (proč starší/jiná verze) |
|---|---|
| `A - Průvodní list _ EAR (1).pdf` | dvojice s `A - průvodní list _ EAR.pdf` v `tz/common/`, sizes 447844 vs 449507 — `(1)` je menší/starší |
| `B - Souhrnná technická zpráva _ EAR (1).pdf` | dvojice s canonical B (598 KB); tento variant je 531 KB — předchozí draft |
| `C.01 - Situace širších vztahů _ EAR.pdf` | dvojice s `C.01 - Situační výkres širších vztahů` v `situace/`; ten má formálnější název + větší velikost |
| `C.02 - Katastrální situační výkres _ EAR (1).pdf` | dvojice s no-`(1)` v `situace/` |
| `C.03 - Koordinační situační výkres _ EAR.pdf` | superseded `C.03.R2` (revize 2) |
| `D.2.2 - statický výpočet.pdf` (4.7 MB) | superseded `D.2.2 ... _ EAR.pdf` (19.8 MB plné znění s přílohami) |
| `D.2.3.01 - výkres tvaru.pdf` (385 KB) | superseded `D.2.3.01 - výkres tvaru 1.PP _ EAR.pdf` (317 KB, stamped) |

### 5.3 Routing summary

- `dokladova_cast/` (nový subdir per ČSN canon Vyhl. 499/2006 Sb. příl. E) — 10 PDF
- `situace/` — 3 PDF
- `tz/common/` — +1 (A průvodní list)
- `vykresy_pdf/260219_dum/` — 31 PDF (10 ARS půdorysy stav/bourání/návrh + 3 řezy + krov + střecha + 6 pohledů + 1 statika výpočet + 4 výkresy tvaru)
- `vykresy_pdf/260217_sklad/` — 1 PDF (suterén skladu)
- `vykresy_dxf/260219_dum/` — 2 DXF
- `vykresy_dxf/260217_sklad/` — 2 DXF
- `_superseded/2026-05-16_unsorted_audit/` — 7 PDF (historie, audit trail)

`UNSORTED/` smazán.

### 5.4 Otevřené otázky → zapsány do `vyjasneni_queue.json` v Phase 0b §3.2 (commit s re-parse)

Viz `vyjasneni_queue.json` items #13–#18 — všechny nové vyjasnění z §3.1 audit + §3.2 re-parse jsou v jedné queue.

## 6. Phase 0b §3.2 — independent TZ re-parse (2026-05-16)

**Tool:** `tools/phase0b_validator.py` (pypdf-based extraction + 69 cross-checks + regex/substring matchers).

**Vstup:** 6 TZ PDF (B common + 3 dum + 2 sklad) — 65 stran celkem, 156 077 znaků extrahovaného textu.

**Výstup:** `outputs/validation_report.json` (67/69 verified = 97.1 %, 0 drifts, 2 missing).

### 6.1 Klíčové nálezy

| Severity | Finding | Akce |
|---|---|---|
| **HIGH** | `D_2_1_TZ_statika_dum_TeAnau.pdf` a `D_2_1_TZ_statika_sklad_TeAnau.pdf` byly v canonical layoutu **PROHOZENÉ** (soubor `_dum_` obsahoval "Zahradní sklad" content, opačně). Příčina: chat session author mis-attribute při uploadu zip souboru. | Fixed inline: SWAP files in commit, SHA-256 verified post-swap. Vyjasnění #16. |
| **MEDIUM** | Sklad geometric dimensions (6,35×3,34 m lichoběžník, parking 7,0 m délka) NEJSOU v TZ tělech — patrně z architektonického výkresu D.1.1.02.R1 nebo z DXF. | Vyjasnění #18: Phase 1 musí extract z DXF (ezdxf wrapper). |
| **LOW** | Sloupky krovu pre-baked 'JKL 100/4', actual TZ 'jakl' (ARS) / 'jeklu 100/4' (statika). Cyklický německý termín místo ČSN EN 10219-2 (RHS/SHS). | Vyjasnění #17: korekce v project_header.json + použít RHS/SHS v Phase 1 položkách. |

### 6.2 Drift threshold check

Per §3.6: pokud silent_drifts > 5 → STOP před Phase 1. Po opravě file-swap je drifts = 0, gate **OPEN**.

### 6.3 New findings z re-parse

- **25 unique ČSN references** napříč 6 TZ (`ČSN 06`, `ČSN 33`, `ČSN 73`, `ČSN EN 1090-1/2`, `ČSN EN 1990`, `ČSN EN 1991-1`, `ČSN EN 1992-1`, `ČSN EN 1993-1`, `ČSN EN 1995-1`, `ČSN EN 1996-1/2`, `ČSN EN 1997-1`, `ČSN EN 1999-1`, `ČSN EN 206`, `ČSN EN 13670`, `ČSN EN 1443`, `ČSN EN 14604`, `ČSN EN 1922-1`, `ČSN EN ISO 5817`, `ČSN EN ISO 12944`, `ČSN 732604`, `ČSN 732810`). Použít pro normy traceability v Phase 1 audit_trail.

## 7. Phase 0b §3.3 — DXF independent parse (2026-05-16)

**Tool:** `tools/phase0b_dxf_extractor.py` (ezdxf 1.4.4 — INSERT block counts, DIMENSION extraction, MTEXT/TEXT per layer, HATCH polygonal areas).

**Vstup:** 4 DXF (sklad DPZ + sklad situace + dum DPZ + dum situace), všechny AutoCAD 2010 (AC1024). Žádný `_blocked_old_format`.

**Výstup:** `outputs/dxf_extract_report.json` (~39 KB).

### 7.1 Per-file přehled

| DXF | Entities | Layers | INSERTs (unique) | DIMENSIONs | HATCHes | Σ HATCH plochy (m² za předpokladu mm units) |
|---|--:|--:|--:|--:|--:|--:|
| sklad_DPZ | 1 029 | 39 | 90 (21) | 65 | 147 | 97,5 |
| sklad_situace | 4 388 | 35 | 345 (23) | 12 | 6 | 0,0 (drobné survey polygony) |
| dum_DPZ | 7 195 | 53 | 535 (59) | 686 | 281 | 936,3 |
| dum_situace | 4 372 | 43 | 336 (25) | 22 | 8 | 0,0 (jen kontury) |

### 7.2 Vyjasnění #18 (sklad geometrie) — partially_resolved

| Cíl | Status | Důkaz |
|---|---|---|
| 6,35 m sklad šířka | ✅ RESOLVED | `6350,06 mm` v sklad_DPZ + `6350,0 mm` v dum_DPZ (DIMENSION objekty, confidence 0,95) |
| 3,34 m sklad hloubka | ✅ RESOLVED | `3340,0 mm` exactly v dum_DPZ (sklad zobrazený adjacentně k objektu domu) |
| 7,0 m parking délka | ✗ NOT FOUND | žádný DIMENSION objekt v 4 DXF v rozmezí ±50 mm; bude třeba derivovat z LWPOLYLINE extents v Phase 1 nebo akceptovat TZ value s conf 0,75 |
| (alt) 3,085 m interior | ✅ corroborating | `3085,0 mm` v sklad_DPZ — odpovídá interior dim = 3340 − 2×127,5 wall thickness |

### 7.3 Top INSERT bloky napříč všemi DXFs (Phase 1 hint)

| Block name | Count | Význam |
|---|--:|---|
| `bod_000` | 461 | Geodetický bod (zaměření) — sklad_situace + dum_situace |
| `PLOT_DREVENY_04` | 133 | Šrafa dřevěné plochy (krov, podlaha terasa) — užitečné pro Phase 1 derivaci m² dřeva |
| `KR` | 111 | Krokve (sklad DPZ + dum DPZ) — počet krokví derivovatelný |
| `řezová značka`, `název`, `investor`, `projektant`, `datum`, `část`, `razítko`, atd. | 32 × ~8 = ~256 | Standard razítka výkresů (vyfiltrovat při Phase 1 INSERT analytice) |
| `severka` | 16 | Standardní orientační značka — vyfiltrovat |

## 8. Phase 1 final — items_rd_jachymov_complete.json totals

**Generator:** `tools/phase1_items_generator.py` (886 LOC + 4 STOP gates: HSV / PSV / TZB / VRN)
**Output:** `outputs/items_rd_jachymov_complete.json` (~171 items, ~4 800 řádků JSON)
**Variant target:** B (max detail položkový), realized 171 items vs cíl 140 — slightly over per user-explicit item-level guidance per gate.

### 8.1 Items by gate

| Gate | Items | Objekt split |
|---|--:|---|
| HSV (HSV-1..HSV-7) | 95 | 74 dum + 21 sklad |
| PSV (PSV-71/76/77/78/95) | 35 | 33 dum + 2 sklad |
| TZB+M (PSV-72/73 + M-21) | 22 | 22 dum + 0 sklad |
| VRN | 19 | 15 dum + 4 sklad |
| **Total** | **171** | **144 dum + 27 sklad** |

### 8.2 Confidence ladder distribution

| Confidence | n items | % |
|---|--:|--:|
| 0.99 (manual judgement) | 5 | 2.9 % |
| 0.95 (DXF DIMENSION/INSERT, regex 1.0 ekvivalent) | 21 | 12.3 % |
| 0.90 (DXF LWPOLYLINE bbox / HATCH) | 5 | 2.9 % |
| 0.85 (regex z TZ) | 36 | 21.1 % |
| 0.80 (empirické Methvin/B4) | 16 | 9.4 % |
| 0.75 (geometry-from-TZ) | 88 | 51.5 % |
| < 0.70 (hard-fail per §3.6) | **0** | **0 %** |

### 8.3 URS lookup status

| Status | n items | Note |
|---|--:|---|
| needs_production_lookup | **171** *(100 %)* | sandbox bez Cloud Run URS_MATCHER + OTSKP DB; všech 171 položek čeká na produkční 2-stage match (catalog + Perplexity rerank) |

### 8.4 Subdodavatel needs_mapping flags (5 — pre batch update)

| Flag | Gate | Item | Důvod |
|---|---|---|---|
| `okenni_zaluzie_kastlik_purenit` | PSV | 9 ks žaluzie kastlík purenit ulice | Hybrid trade (okenář + ETICS + purenit dodávka) |
| `biodeska_konstrukcni` | PSV | 25 m² biodeska 3.NP spací patro | Pseudo-hybrid truhlář + krov_tesarsky_kompletni |
| `instalater_TUV_akumulacni_zasobnik` | TZB | Akumulační zásobník TUV v 1.PP | Specialty subset vytápěč+vodař hybrid pro multivariantní topný systém |
| `mykolog` | VRN | Mykologický průzkum dřeva | Specialty surveyor (autorizovaný mykolog dřeva) |
| `azbestovy_specialista` | VRN | Azbestový průzkum podrobný | Specialty surveyor (autorizovaný technik azbestu + lab. posudek) |

## 9. Corpus patterns — extracted from this pilot

Tento RD Jáchymov pilot přinesl 4 distinct corpus patterns pro budoucí STAVAGENT pipeline:

### 9.1 Pattern 1: UNSORTED audit + SHA-based dedup (Phase 0b §3.1)
**Problem:** Chat session výstupy obsahují UNSORTED/ adresář s míchanými dokumenty, často s duplicity (různé revize, "(1)" copy, _EAR vs no_EAR).
**Solution:** `mkdir -p _superseded/<datum>_unsorted_audit/`, then SHA-256 verification before any hard-delete. Files canonical → vykresy_pdf/dxf/situace/tz/dokladova_cast per type. Older revisions → _superseded/ (audit trail preserved).
**Repository precedent extension:** Žádný předchozí STAVAGENT pilot neměl `inputs/dokladova_cast/` ani `inputs/_superseded/`. Nově zavedeno per Vyhláška 499/2006 Sb. příloha E nomenclature.

### 9.2 Pattern 2: Pre-baked drift detection via independent re-parse (Phase 0b §3.2)
**Problem:** Pre-baked extraction (chat session) může mít systematic error neviditelný bez nezávislé verifikace. Konkrétní instance: dvě statika TZ files byly v canonical layoutu SWAPPED (soubor `_dum_` obsahoval "Zahradní sklad" header per page, opačně).
**Solution:** `tools/phase0b_validator.py` (pypdf-based extraction) + 69 cross-checks. Re-parse confidence ladder per task §5 (regex 1.0 > DXF 0.95 > substring 0.85 > AI 0.70). Re-parse VŽDY vyhrává nad pre-baked (per user policy 2026-05-16).
**Discovery:** Rdt drift (300↔350 mezi dum/sklad) byl smoking gun pro file swap. Post-swap re-parse jumped z 36/69 (52 %) → 67/69 (97.1 %), 3 drifts → 0.

### 9.3 Pattern 3: Multi-modal geometry extraction (Phase 0b §3.3 + Phase 1 PSV)
**Problem:** Stavební rozměry nejsou vždy v TZ tělech — některé existují jen v DXF/výkresech (např. sklad lichoběžník 6,35×3,34 m, parking 7,0 m).
**Solution:** Three extraction layers per ezdxf:
1. **DIMENSION objects** (`.get_measurement()`) → confidence 0.95
2. **LWPOLYLINE bbox extents** → confidence 0.90 (when no direct DIMENSION present)
3. **INSERT block counts** by name → confidence 0.95 (např. okna count = ks z INSERT 'okno 1.NP' / 'okno 2.NP' atd.)
**Live application:** Vyjasnění #18 sklad geometrie fully_resolved via Pattern 3 (6350.06 mm DIMENSION + 3340.0 mm DIMENSION + 7000 mm LWPOLYLINE bbox). DXF INSERT 'okno *' = 16 ks oken (replaces TZ-derived odhad ~10).

### 9.4 Pattern 4: Workflow gate ≠ classification kapitola_group (Phase 1 TZB)
**Problem:** Catalog classification (HSV/PSV/M/VRN per Czech ÚRS 800) NE vždy odpovídá workflow gates user definuje (např. user-spec "TZB+M gate" obsahuje PSV-72/73 + M-21). Naivní `kapitola_group` filter v merge logic vede k duplikacím or accidental deletes.
**Solution:** Parallel `_gate` field on each item, populated via `KAPITOLA_TO_GATE` table mapping kapitola prefix → user-workflow gate. `kapitola_group` stays as classification (HSV/PSV/M/VRN per catalog). Merge filter uses `_gate` exclusively.
**Lesson:** Workflow concerns (review gates, batch commits) and classification concerns (ÚRS hierarchy, catalog) are orthogonal — separate fields, don't conflate.
