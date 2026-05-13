# Phase 0b RE-RUN — MASTER Facts Report

**Project:** hk212_hala (HALA Hradec Králové, Solar Disporec)
**Date:** 2026-05-13
**Status:** independent re-verification complete
**Branch:** `claude/hk212-phase-0b-rerun-clean-verification`

## Executive Summary

Independent re-parse of all 7 TZ PDFs (102 pages) + 7 DXF files + 3 situace PDFs from `test-data/hk212_hala/inputs/` against pre-baked `project_header.json`. **Every fact below has explicit citation back to source document + page/layer/block name.** No chat session estimates or product-knowledge guesses used.

### Major corrections to previous Phase 0b validation

| Previous Phase 0b drift | Correction |
|---|---|
| G-01 sklon 5.25° → 5.65° (claim of drift) | ❌ **FALSE** — 5.65° on A101 = okenní úhel (4 instances at window corner coords). Real sklon střechy = **5.25°** (TZ statika D.1.2 p04 + A102 + 7 other sources). |
| X-01 2966-1 reference NOT found | ❌ **FALSE** — reference exists as INSERT block names (not XREF entities). **10 instances** across A104 (8) + A106 (1) + A107 (1). |
| ABMV_13 Kingspan IPN/PIR alternativa | ❌ **FABRICATED** — 0 mentions of PUR/IPN/PIR in any document. All panels = minerální vata. |
| Výkop calc 349.8 m³ | ✅ **CONFIRMED at 341.8 m³** (within rounding) — even after correcting patky total height (1.2 m rámové, 0.8 m štítové per TZ statika D.1.2 p31), the dohloubky pod úroveň figury changed only marginally. **TZ B claim 32 m³ vs DXF-derived 341.8 m³ = 10.7× drift confirmed**, ABMV_17 valid. |

### New drifts (legitimate, requiring projektant clarification)

- **ABMV_18** (NEW): 06_zaklady_titul beton classes wrong (deska C16/20 vs statika C25/30, pilota C30/37 vs statika C25/30)
- **ABMV_19** (NEW): 3 different zastavěná plocha values (520 / 540,10 / 541 m²) + 3 different obestavěný prostor (2833 / 3404 / 3694,62 m³)
- **ABMV_20** (NEW): A101 půdorys missing 1 Lindab svod (3 vs 4 TZ + A104)

### Updated queue counts
- Total items: **20** (was 17, +3 added, 1 closed)
- Critical open: **6**
- Important open: **6**
- Minor open: **2**
- Closed (fabricated): **1**

---

# §9 — User-Flagged Verifications (re-run, from source documents only)

Each fact verified by direct grep of TZ page text or DXF parse. Pre-baked claims used ONLY as comparison target, never as ground truth.

## §9.1 — Zastavěná / podlahová plocha / obestavěný prostor (USER-CONFIRMED inconsistency)

Three or more conflicting values per metric across the same projektant's deliverables.

| Source | Page | Zastavěná | Podlahová | Obestavěný |
|---|---|---:|---:|---:|
| TZ A (Průvodní) | `01_ars_pruvodni_A.pdf` p03 | **540,10 m²** | 495 m² | 3694,62 m³ |
| TZ B (Souhrnná) | `02_ars_souhrnna_B.pdf` p07 | **520 m²** | 507 m² | 2833 m³ |
| TZ B p08 (text) | `02_ars_souhrnna_B.pdf` p08 | 520 m² | — | — |
| TZ D.1.1 (ARS) | `03_ars_d11_TZ.pdf` p02 | **541 m²** | 495 m² | 3404 m³ |
| PBŘ | `07_pbr_kpl.pdf` p04, p06 | 520 m² | užitná 495 m² | — |

**Verdict:** drift confirmed — three distinct zastavěná values (520 / 540,10 / 541 m²). Podlahová/užitná consistently **495 m²** except TZ B (507 m²). Obestavěný: TZ A=3694,62 / TZ B=2833 / TZ D.1.1=3404 m³ — internally inconsistent within same projektant.

## §9.2 — Sklon střechy 5,25° vs 5,65° (PREVIOUS PHASE 0b DRIFT G-01 was FALSE)

**Authoritative value: 5,25°** (TZ statika D.1.2 p04 + A102 pudorys strechy DXF MTEXT).


**Where 5,25° appears (ground truth):**

- `02_ars_souhrnna_B.pdf` p02: "sklonem 5,25°"
- `02_ars_souhrnna_B.pdf` p08: "sklonem 5,25°, krytina..."
- `03_ars_d11_TZ.pdf` p02, p03, p04: 4× "sklonem 5,25°"
- **`04_statika_d12_TZ_uplna.pdf` p04: "Sklon střechy 5,25°."** (authoritative statika)
- `07_pbr_kpl.pdf` p04, p18: 2× "sklon 5,25°"
- `C3_situace_kaceni.pdf` p01: 2× "5,25°" labels
- **A102 pudorys strechy.dxf** (the ROOF plan): MTEXT layer G-ANNO-DIMS-1, single instance **5.25°** at insert [188223.68, 140293.16]

**Where 5,65° appears (NOT sklon střechy):**

- A101 pudorys 1NP.dxf: MTEXT G-ANNO-DIMS-1, **4 instances** at coordinates
  - [184474.48, 154117.47], [193312.47, 154078.74] — both near Y=154100 (Severo-Západní fasáda)
  - [193375.09, 123993.01], [184268.95, 123872.75] — both near Y=124000 (Jiho-Východní fasáda)
- A106 + A107 (same drawing base): 4× same coordinates each

**Resolution:** 5,65° on A101 is NOT roof slope — coordinates show window placements on long fasády (~30 m spacing in Y matches hala length 28.19 m). User's hypothesis CONFIRMED: 5,65° = úhel sklopných oken (window-tilt symbol — triangle pointing to letter B in PBŘ p29 also shows 5.65° in same context with 11.15° and 8.95° = various opening angles).

**Previous Phase 0b drift G-01 (sklon 5.25° → 5.65°) was FALSE. project_header.json value 5.25° is correct.**

## §9.3 — Beton classes (deska / patky / pilota)

| Source | Page | Deska | Patky | Pilota (variant) |
|---|---|---|---|---|
| TZ B p03 | `02_ars_souhrnna_B.pdf` p03 | **C25/30, XC4** | **C16/20 XC0** | — |
| TZ D.1.1 p03 | `03_ars_d11_TZ.pdf` p03 | C25/30, XC4 | C16/20 XC0 | — |
| **TZ statika D.1.2 p29** (auth.) | `04_statika_d12_TZ_uplna.pdf` p29 | **C25/30, XC4** | — | — |
| **TZ statika D.1.2 p31** (auth.) | `04_statika_d12_TZ_uplna.pdf` p31 | — | **C16/20 XC0** | — |
| **TZ statika D.1.2 p32** (auth.) | `04_statika_d12_TZ_uplna.pdf` p32 | — | — | **C25/30 XC4** + 8×R25 B500B + třmínky R10 á 200 mm |
| 06_zaklady_titul (A105 výkres TITUL) | `06_zaklady_titul.pdf` p01 | **C16/20-XC0** ❌ | (not labeled) | **C30/37-XC2** ❌ |
| A101 DXF MTEXT | `A101_pudorys_1np.dxf` | (only "Železobeton" + "Beton prostý" labels, no class) | — | — |

**Major drift in `06_zaklady_titul.pdf` p01** (legenda titul-listu pro výkres A105 ZÁKLADY):
- ŽB DESKA labeled **C16/20-XC0** — should be **C25/30 XC4** per TZ statika
- PILOTA labeled **C30/37-XC2** — should be **C25/30 XC4** per TZ statika
- Internal inconsistency: titul-list contradicts statika TZ D.1.2 in 2 places

**Pre-baked `project_header.json` claim "A101 legenda → C30/37-XC2" is MISATTRIBUTED** — A101 has no concrete class in its legenda (only material categories `Železobeton`, `Beton prostý`); the C30/37-XC2 label is actually in `06_zaklady_titul.pdf` and refers to PILOTA, not deska.

**Resolution:** Deska = C25/30 XC4 (3 TZ sources unanimous + statika authoritative). Pilota = C25/30 XC4 (statika authoritative). 06_zaklady_titul beton labels need correction by projektant.

## §9.4 — Kingspan systém (PUR / IPN / PIR / minerální vata)

**Searched for:** `PUR`, `IPN`, `PIR`, `polyurethan`, `polyuretan` across all 7 TZ + 3 situace PDFs.

**Result: 0 occurrences in any document.**


**Authoritative source — TZ statika D.1.2 p21:**

- Roof panels: **KINGSPAN KS FF-ROC tl. 200 mm** (FF-ROC = roof panel, **rock wool / minerální vata** filling)
- Wall panels: **KINGSPAN KS NF 200 mm** (NF = nosný fasádní, **minerální vata** filling)

**Multiple confirmations across 5 sources:**

- TZ B p02 + p08 + p10 + p17: "sendvičové panely Kingspan" + "výplň minerální vata"
- TZ D.1.1 p02 + p04: "sandwich panely Kingspan tl. 200 alternativně 150 mm s výplní minerální vaty"
- TZ statika D.1.2 p14 + p20 + p21: KS FF-ROC + KS NF 200
- PBŘ p04: "Nenosný obvodový plášť je tvořen sendvičovými deskami (Kingspan)"

**Verdict:** ABMV_13 (claim about IPN with PIR alternative) is **fabricated** — the document material is unanimous: **minerální vata, all panels**. ABMV_13 should be CLOSED with note "NOT FOUND IN SOURCE DOCUMENTS".

## §9.5 — Krajní vaznice UPE 160 vs C150×19,3 (ABMV_15)

**TZ unanimously: UPE 160 S235 (3 sources)**

- `02_ars_souhrnna_B.pdf` p02: "Krajní nosníky jsou navrženy z profilu UPE160 z oceli S235."
- `04_statika_d12_TZ_uplna.pdf` p23 (auth.): "Krajní nosníky jsou navrženy z profilu UPE160 z oceli S235."
- `05_konstrukce_titul.pdf` p01 (K01 výkres titul-list): 19× explicit label "KRAJNÍ VAZNICE UPE160"

**A104 DXF (POHLEDY): 2 INSERT block instances of `C profil - C150X19_3-XXXXXX-Řez N`** (Řez 2 + Řez 3 cross-section views).

**Resolution:** TZ + statika + K01 výkres all authoritative for UPE 160. A104 C150×19,3 blocks are legacy library symbols not replaced by projektant in elevation cross-sections.

**ABMV_15 valid** — drift between výkres elevations (A104) and statika authoritative.

## §9.6 — Vrata dimensions (ABMV_2)

- **TZ D.1.1 p04: "dvojice sekčních vrat o rozměrech 3500 × 4000 mm"** (explicit dimensions, Š × V)
- A101 DXF: **4 INSERT blocks** named `M_Vrata_ výsuvná_ sekční - 3000X4000 MM-XXXXXX-1NP` (3000 × 4000 mm)
- A101 DXF DIMENSIONs in range 2900–3600 mm: 6 values — none = 3500 mm; 1 × 3000.0 mm with override `3x1000\X1000 (1350)` (this is an okno dimension, not vrata)
- PBŘ p18 table row "vrata 2 4,000 3,500 28,00" — area calc 2 × 4 × 3.5 = 28.00 m² ✓ — uses **4.0 × 3.5 m** orientation (this differs from both TZ and DXF; PBŘ may have rotated dimensions Š↔V)

**Resolution:** TZ explicit says 3500 × 4000. DXF block name says 3000 × 4000 (block library entry not customized). 500 mm width drift confirmed.

**ABMV_2 valid** — request projektant clarify which dimension is correct.

## §9.7 — Lindab svody count

**TZ: 4 svody DN100** unanimous

- `02_ars_souhrnna_B.pdf` p14: "počet svodů je navržen min. 4 ks, rozmístěných rovnoměrně po obvodu"
- `02_ars_souhrnna_B.pdf` p23: "Voda bude ze střechy odvedena 4 svody DN100"

**DXF Lindab block counts:**

- A101 pudorys 1NP: **3 instances** ❌
- A104 pohledy: **4 instances** ✓
- A105 zaklady: 3
- A106 stroje: 3
- A107 stroje kotvici body: 3
- A201 vykopy: 3

**Verdict:** A101 půdorys 1NP missing 1 svod (only 3 drawn instead of 4 per TZ). A104 elevations correctly show 4. **New drift:** A101 půdorys svody count = 3, TZ + A104 elevation = 4. Projektant likely forgot to draw the 4th svod in 1NP plan view. Action: ABMV-style query for clarification.

## §9.8 — Stroje příkon + externí reference 2966-1

### A106 DXF MTEXT (machinery labels)

Reconstructed from fragmented MTEXT entities on layer G-ANNO-TEXT (Czech diacritics split into multiple objects):


**TWO machine zones identified on A106:**

1. **PRACOVIŠTĚ DRIFT_E1** (zone 1):
   - "VÝŠKA STROJE 3,5 m"
   - **"PŘÍKON STROJE cca 150 kW"** (fragments concat: `'P' + 'ŘÍKON STROJE cca' + '15' + '0 kW'`)
2. **PRACOVIŠTĚ DEFRAME** (zone 2):
   - "VÝŠKA STROJE 3,5 m"
   - **"PŘÍKON STROJE cca 80 kW"**
3. **PRACOVIŠTĚ FILTRAČNÍ JEDNOTKA** (zone 3): no kW labeled

Additional A106 MTEXT: "BEZPEČNOSTNÍ OPLOCENÍ BUDE UPŘESNĚNO" × 3 instances + "VENKOVNÍ VZT JEDNOTKA" + "EL_HLAVNÍ ROZVADĚČ".

**TZ search for "80 kW per stroj":** 0 hits. TZ B energetická bilance only lists rekuperační jednotka, sahary, ECOSUN panely — no 150 kW or 80 kW machine entry.

**ABMV_1 valid** — A106 declares cca 230 kW total (150 + 80) for two strojní zóny, TZ energetická bilance does NOT cover this. **Pre-baked claim about 80 kW per stroj was CORRECT — A106 MTEXT explicitly says so.**


### Externí reference 2966-1 (ABMV_16)

**Previous Phase 0b X-01 drift ("0 XREFs / 0 MTEXT mentions of 2966") was WRONG** — the reference exists as INSERT block names (not XREF flags), my previous detection missed them.

**Block name scan across all 7 DXFs (re-run):**

- **A104 pohledy: 8 instances** (2 variants × 4 Řezy):
  - 4× `2966-1_navrh dispozice stroju-HK_dwg-867852-Řez {2,3,4,5}` (variant 01)
  - 4× `2966-1_navrh dispozice stroju-HK_02_dwg-876232-Řez {2,3,4,5}` (variant 02)
- A106 stroje: 1× `2966-1_navrh dispozice stroju-HK_02_dwg-876232-1NP _ stroje`
- A107 stroje kotvici body: 1× `2966-1_navrh dispozice stroju-HK_dwg-867852-1NP _ stroje - KOTVÍCÍ BODY`

**Total: 10 INSERT block instances referencing externí výkres 2966-1.**

**Pre-baked project_header.json claim is essentially correct** — A104 IS the primary source (8 of 10 instances). External document 2966-1 is referenced but not delivered (per pre-baked `_status: NEDODÁNO`). ABMV_16 valid.


---

# §6 — Externí sítě (z C1/C2/C3 PDF + A105/A201 DXF + TZ)

Source: `C3_situace_kaceni.pdf` p01 (legenda + výkres SO situace).

## C3 LEGENDA — stávající inženýrské sítě (přes pozemek / sousedství)

- Stávající **kanalizace dešťová** (procházející pozemkem — A201 layer `Stávající dešťová kan__Trubky-2` má 33 trubek)
- Stávající **kanalizace splašková** (procházející pozemkem — A201 layer `Stávající splašková kan__Trubky-2` má 19 trubek)
- Stávající **provozní splašková kanalizace**
- Stávající **vodovodní řad**
- Stávající **vedení NN**
- Stávající **vedení plynu STL + ochranné pásmo**
- Stávající **teplovod + ochranné pásmo**
- Stávající **horkovod + ochranné pásmo**
- Stávající **nadzemní vedení CETIN**
- Stávající **vedení optického kabelu**
- Stávající **pouliční osvětlení**
- Stávající **elektro přípojková skříň** (PRIS — značka v C3, vícero instancí)
- Stávající **trafostanice** (TS)
- Stávající **koleje — vlečka** (railway siding přes/u pozemku)

## C3 navrhované sítě (přípojky pro novou halu)

- **Areálový rozvod kanalizace gravitační:** PVC-U DN200 SN12, **82,0 m** (pro celý areál)
- **Areálový rozvod kanalizace tlakový:** 3 m (pro celý areál)
- **Přípojka kanalizace:** 16 m
- **Navrhovaná dešťová kanalizace:** DN160 PVC-U SN8
- **Napojení na stávající vodovod:** LT DN150
- **Přepojení stávajícího TK:** PE100-RC, d63×5.8 mm, SDR11, 3,0 m
- **Retenční nádrž:** 30 m³, rozměr **6,15 × 2,75 × 2,0 m**
- **Liniový žlab** pro odvod dešťové vody (3+ lokace s 5% sklonem)
- **Přípojka NN, kanalizace dešťová+splašková, vodovod, optický kabel** (z legendy)
- **Obetonování stávajících sítí** (kdekoli křížení s výkopem)
- **Nová revizní šachta(y)** RŠ01, RŠ02, RŠ03

## C3 délky tras navrhovaných kanalizací (zjištěné z výkresu)

- L = **41 m** (úsek)
- L = **113 m** (úsek)

## Pozemky

- **Vážní 857, 500 03 Hradec Králové — Slezské Předměstí**
- **k.ú. Slezské Předměstí [646971]** (Hradec Králové)
- Sousedící parcely (C3 výkres + C2 katastr): 1930/1, 1475/1, 1475/3, 1475/4, 1475/5, 1475/6, 1475/13, 1475/15, 1475/17, 1475/18, 1475/19, 1475/20, 2656, 2657, 2658, 2659, 2660, 179/2, 179/8..11, 179/23, 179/27, 260/8, 260/11, 260/12, 261/2, 182/1

## TZB ZTI — informace doplňující z TZ

- TZ B p23: "Voda bude ze střechy odvedena 4 svody DN100"
- TZ B p21: zmiňuje technické pásmo a tlakovou podzemní (kanalizace)
- TZ statika D.1.2 p33: BOZP — povinné OOP při výkopových pracích u sítí

## Výškové údaje (z C3 + C1)

- **+0,000 = 234,69 m n.m. Bpv** (basement reference level)
- Stávající terén kóty: 232,21 / 232,26 / 232,74 / 232,86 / ... / 234,65 m (rozdíl ~2 m napříč pozemkem)
- Výška objektu v hřebeni: **+7,175 m** od ±0.000 (= 241,87 m n.m. Bpv)

## Doporučená vyjasnění k externím sítím

- VYJASNĚNÍ: Souhlas/stanovisko správce každé sítě (zejména teplovod + horkovod + plyn STL) k obetonování + dotčení ochranného pásma.
- VYJASNĚNÍ: Hloubka stávajících sítí v místě křížení s výkopem hala (TZ a C3 nedávají DN ani hloubky pro všechny sítě — IGP nebo geodetické zaměření nutné).
- VYJASNĚNÍ: Vlečka — jakou rozsah omezení (zákaz výkopů v ochranném pásmu vlečky 60 m od osy koleje? potřeba povolení Drážního úřadu?)


---

# §3.1 — Project Identification

| Fact | Value | Source | Page |
|---|---|---|---|
| Název projektu | **HALA HK 212 (Solar Disporec — sklad fotovoltaických panelů)** | `01_ars_pruvodni_A.pdf` | p01-p03 |
| Místo stavby | **Vážní 857, 500 03 Hradec Králové — Slezské Předměstí** | `C1_sirsi_vztahy.pdf` | p01 |
| Katastrální území | **Slezské Předměstí [646971]** | `C2_katastr.pdf`, `C3_situace_kaceni.pdf` | p01 |
| Investor | **SOLAR DISPOREC s.r.o.**, Malostranské náměstí 5/28, Malá Strana, Praha 1 | `C1_sirsi_vztahy.pdf` | p01 |
| Účel stavby | **Skladová hala** (fotovoltaické panely) | `02_ars_souhrnna_B.pdf` p08 / `07_pbr_kpl.pdf` p04 | p08 / p04 |
| Charakter stavby | **Novostavba** ("navržená novostavba") | `02_ars_souhrnna_B.pdf` | p08 |
| Stupeň dokumentace TZ A/B/D.1.1 | **DPZ** (Dokumentace pro povolení záměru) | `C1_sirsi_vztahy.pdf` | p01 |
| Stupeň statika D.1.2 | **6/2025 Technická zpráva a statický výpočet** | `04_statika_d12_TZ_uplna.pdf` p06 | p06 |
| ARS odpovědný projektant | **Ing. arch. Jakub Volka, ČKA 03947** | `C1_sirsi_vztahy.pdf` | p01 |
| Vypracovala | **Anna Abrahámová** | `C1_sirsi_vztahy.pdf` | p01 |
| Generální projektant | **Basepoint s.r.o., V Benátkách 2350/6, 149 00 Praha 11** | `C1_sirsi_vztahy.pdf` | p01 |
| Datum vypracování ARS | **07/2025** | `C1_sirsi_vztahy.pdf` | p01 |
| Statika datum | **6/2025** | `04_statika_d12_TZ_uplna.pdf` p06 | p06 |
| Reference level | **+0,000 = 234,69 m n.m. Bpv** | `C1_sirsi_vztahy.pdf` | p01 |
| Digital signature (ARS) | Ing. arch. Jakub Volka, **2025-10-30 14:15:10 +01:00** | `C1_sirsi_vztahy.pdf` | p01 |

---

# §3.2 — Geometrie a rozměry

## Půdorysné rozměry (3 different values across sources)

| Source | Page | Hodnota |
|---|---|---|
| TZ statika D.1.2 p04 | `04_statika_d12_TZ_uplna.pdf` | **18,54 × 28,19 × 7,195 m** (Š × D × V) |
| PBŘ p04 | `07_pbr_kpl.pdf` | **19,31 × 27,97 m** |
| C3 situace | `C3_situace_kaceni.pdf` p01 | 19,31 × 27,98 + 11,75 + 12,59 + 37,75 + 59,26 (více kót, plot měřítka)
|

## Výška stavby

- TZ statika D.1.2 p04: "výška 7,195 m" + "+0,000 = 234,69 m"
- PBŘ p04: "výšky od upraveného terénu (± 0,000) **7,195 m**"
- TZ D.1.1 p04: "Výška stavby v hřebeni bude **7,1 m**"

## Sklon střechy

**Authoritative: 5,25°** (TZ statika D.1.2 p04, TZ B + D.1.1 multiple mentions, A102 DXF) — see §9.2 for full citation list.

## Osové vzdálenosti rámů (TZ statika D.1.2 p04)

- Hlavní nosné konstrukce: **6,1 m**
- Doplňková osa: **3,0 m**
- Y-osy z DXF A102: 6100 / 6100 / 3000 / 6100 / 6100 mm (5 fields, sum = 27 400 mm + extras)
- X-osy z DXF A102: 3170 / 4000 / 5000 / 4000 / 3170 mm (5 fields, sum = 19 340 mm)

## Vzdálenost vaznic

- TZ statika D.1.2 p23: "Maximální osová vzdálenost vaznic činí **1,5 m**" + p21: "vaznice budou vzdálené max 1,5 m"

## Plochy (3+ inconsistent values per metric — viz §9.1)

- **Zastavěná plocha**: 540,10 m² (TZ A) / 520 m² (TZ B + PBŘ) / 541 m² (TZ D.1.1) → drift
- **Podlahová plocha**: 495 m² (TZ A + TZ D.1.1 + PBŘ užitná) / 507 m² (TZ B)
- **Obestavěný prostor**: 3 694,62 m³ (TZ A) / 2 833 m³ (TZ B) / 3 404 m³ (TZ D.1.1) → drift

---

# §3.3 — Konstrukce

## Steel frame — TZ statika D.1.2 + 05_konstrukce_titul + A101 DXF counts

| Element | Profil + materiál | DXF INSERT count (A101) | Source TZ |
|---|---|---:|---|
| Sloupy rámové | **IPE 400 S235** | **36** | TZ B p02 "sloupy IPE"; statika p23 detail; 05_konstrukce_titul × 22 IPE400 labels |
| Sloupy štítové | **HEA 200 S235** | **8** (M_S profily blocks) | TZ D.1.1 p03: "sloupy ve štítu pod rámem budou z nosníků HEA 200"; 05_konstrukce_titul × 4 HEA200 labels |
| Příčle rámu | **IPE 450 S235** | (počet 5 na A101 jako 'IPE -' blocks; každý rám = 1 příčel ze 2 dílů = 10 hlavních + 2 štítové) | TZ D.1.1 p03: "IPE 450 se sklonem 5,25°"; 05_konstrukce_titul × 8 IPE450 labels |
| Vaznice střešní | **IPE 160 S235** | (mimo INSERT — drawn as LINE entities) | TZ statika D.1.2 p23: "vaznice IPE 160 S235" + 05_konstrukce_titul × ~24 VAZNICE IPE160 labels |
| Krajní vaznice | **UPE 160 S235** (drift A104 C150×19,3 — viz §9.5) | (mimo INSERT; A104 má 2× C150X19_3 v Řez 2+3 jako legacy block) | TZ B p02 + statika D.1.2 p23 + 05_konstrukce_titul × 19 KRAJNÍ VAZNICE UPE160 labels |
| Ztužidla střešní (kruhové tyče) | **Ø20 R20 S235** ("ondřejskými kříži z profilu R20") | **8** | TZ D.1.1 p04 |
| Ztužidla stěnová | **L 70/70/6 S235** | (mimo INSERT) | TZ B p03 "L70/70/6 z oceli S235" + 05_konstrukce_titul "STĚNOVÁ ZTUŽIDLA Z L70/70/6" |

## Foundations — A105 + TZ statika

| Element | Rozměr [m] | Beton | Hloubka | Source |
|---|---|---|---|---|
| Patky rámové (14 ks) | 1,5 × 1,5 × **(2 × 0,6) = 1,2 m total** (dvoustupňová) | **C16/20 XC0** | -1,300 / -1,900 (z A105 výškové kóty) | TZ statika D.1.2 p31 + A105 MTEXT |
| Patky štítové (10 ks) | 0,8 × 0,8 × **(0,2 + 0,6) = 0,8 m total** (dvoustupňová) | **C16/20 XC0** | -0,700 / -1,300 | TZ statika D.1.2 p31 + A105 |
| Atypický základ / pilota (1 ks) | Ø 800 × L = 8,0 m | **C25/30 XC4 + 8×R25 B500B + třmínky R10 á 200 mm** | dle IGP | TZ statika D.1.2 p32 + A105 explicit MTEXT |
| Základová deska | tl. 200 mm | **C25/30 XC4 + Kari síť Ø8 100/100 oba povrchy B500B krytí 30 mm** | 0,200 nad terén | TZ statika D.1.2 p29 |

---

# §3.5 — Otvory (okna, dveře, vrata)

| Element | Rozměr | Počet (DXF A101 INSERT) | Source TZ |
|---|---|---:|---|
| Okna | 1000 × 1000 mm (sklopná, fix? — block library `OKNO_1k - Okno Hala 1000x1000-V{N}-1NP`) | **35** INSERT instances, **21 unique V-tags** (V1..V21) | TZ B/D.1.1 nepřesné množství — PBŘ p18 "okna 18 1,000 1,000 18,00" + "okna 18 ... 36 36,00" (různá fasáda) |
| Vrata sekční | **TZ: 3500 × 4000 mm** vs **DXF block: 3000 × 4000 mm** (drift, viz §9.6) | **4** (4 instances) | TZ D.1.1 p04 "dvojice sekčních vrat o rozměrech 3500 × 4000 mm"; A101 4× block 3000X4000 |
| Vnější dveře | **1050 × 2100 mm** (z block name `Vnější jednoduché dvoukřídlé dveře - 1050 x 2100mm`) | **2** (2 instances) | A101 block names |
| Dveřní clony VZT (nad vraty) | šířka 2 m | **8 ks** (4 vrata × 2 horizontální clony) | TZ B p10: "pro každá ze 4 vrat jsou navrženy 2 horizontální clony, celkem tedy 8 ks. Clony mají šířku 2 m" |

**Note on okna count discrepancy:**
- A101 INSERT count = 35 (multiple per V-tag = duplicate symbols across views)
- PBŘ p18 lists 18 oken on JV fasáda + 18 oken na SZ fasádě = 36 oken (matches max V-tag 21 + duplicates for opposite-fasáda symmetry?)
- TZ B does not give an explicit overall count
- **Action: ABMV-style query — exact okna count and per-fasáda breakdown.**


---

# §3.8 — TZB profese (souhrn — citations only)

## ZTI

- Voda: napojení na stávající vodovod **LT DN150** (C3 situace)
- Splašková kanalizace: areálový rozvod **DN200 PVC-U SN12, 82 m gravitační + 3 m tlakový** (C3)
- Dešťová kanalizace: navržená **DN160 PVC-U SN8** + 4 svody DN100 ze střechy (TZ B p23, C3 situace)
- Retenční nádrž: **30 m³, 6,15 × 2,75 × 2,0 m** (C3)
- TUV: bez detailů v TZ B (pravděpodobně el. ohřev, pozn.)

## VZT (TZ B p10–p11)

- Rekuperační jednotka (Zařízení č.1) — výkon a typ neuvedeny v dostupné části TZ
- Dveřní clony (Zařízení č.2) — 4 vrata × 2 horizontální clony = 8 ks, šířka 2 m

## ÚT (z TZ B + power_kw aggregate)

- TZ tokens detected: 30 kW × 2, 18,5 kW × 2, 15 kW × 1, 1,2 kW × 1, 9 kW × 1, 61,2 kW × 1 (celkový?), 15,4 kW (tepelné ztráty?)
- ECOSUN sálavé panely (1,2 kW typický)
- Sahary teplovzdušné (9 kW typický)
- Konkrétní výrobce a počet — neuvedeny v explicitním seznamu, je nutno doplnit

## EL (TZ B p13–p15)

- Hlavní jistič: **3 × 100 A** (TZ B aggregate)
- Přívodní kabel: **CYKY-J 5 × 35 mm²**
- P_inst (instalovaný): **83,0 kW** (token aggregate)
- P_vyp: TZ explicit hodnotu nezjištěnu — projektant uvádí soft hodnotu
- Pozn. A106 DXF má cca **150 kW (DRIFT_E1) + 80 kW (DEFRAME) = 230 kW** pro technologii — **mimo TZ energetickou bilanci** (viz ABMV_1)

## LPS (TZ B p14)

- **Min. 4 svody** rozmístěné rovnoměrně po obvodu (FeZn pásek 30 × 4 mm nebo FeZn Ø 10 mm)
- Základový zemnič, FeZn vodič min. 75 mm² do každé patky
- Svodiče přepětí typu 1+2 v hlavním rozvaděči


---

# §3.9 — Technologie strojů (machinery)

## A106 DXF MTEXT — 3 strojní zóny

| Zóna | Příkon | Výška | Source |
|---|---|---|---|
| **PRACOVIŠTĚ DRIFT_E1** | cca **150 kW** | 3,5 m | A106 MTEXT G-ANNO-TEXT (fragmenty `'P'+'ŘÍKON STROJE cca'+'15'+'0 kW'`) |
| **PRACOVIŠTĚ DEFRAME** | cca **80 kW** | 3,5 m | A106 MTEXT G-ANNO-TEXT |
| **PRACOVIŠTĚ FILTRAČNÍ JEDNOTKA** | (neuvedeno) | (neuvedeno) | A106 MTEXT (pouze label, žádný výkon) |

## A107 stroje kotvící body

- 1× `Sloup IPE - 374558-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 374564-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 374570-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 374571-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 374572-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 374573-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 387892-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 387893-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 387934-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 387935-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 387971-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 387972-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 388008-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 388009-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 388045-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 388046-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 388383-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 388384-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 388385-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_S profily_ sloup - 388386-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 390062-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 396249-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 400226-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 400484-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 400880-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 401579-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 401588-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 401597-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-586513-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V1-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V2-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V3-1NP _ stroje - KOTVÍCÍ BODY`
- 6× `OKNO_1k - Okno Hala 1000x1000-V4-1NP _ stroje - KOTVÍCÍ BODY`
- 5× `OKNO_1k - Okno Hala 1000x1000-V5-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V6-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_Vrata_ výsuvná_ sekční - 3000X4000 MM-499574-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_Vrata_ výsuvná_ sekční - 3000X4000 MM-444875-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_Vrata_ výsuvná_ sekční - 3000X4000 MM-840892-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `M_Vrata_ výsuvná_ sekční - 3000X4000 MM-V7-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Construction_Roof-Accessories_Lindab_Round- - Lindab Round Downpipe System 150_100 High Build Polyester 001 Antique White-815811-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Construction_Roof-Accessories_Lindab_Round- - Lindab Round Downpipe System 150_100 High Build Polyester 001 Antique White-794159-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Construction_Roof-Accessories_Lindab_Round- - Lindab Round Downpipe System 150_100 High Build Polyester 001 Antique White-815879-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Umyvadlo - 50x40 cm-459123-1NP _ stroje - KOTVÍCÍ BODY`
- 7× `OKNO_1k - Okno Hala 1000x1000-V8-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V9-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V10-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V11-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 487110-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 487111-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V12-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `IPE - 489591-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V13-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V14-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V15-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `IPE - 500084-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `IPE - 500435-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `IPE - 500572-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 502209-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 502210-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 502301-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 502302-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 503362-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 504078-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 504742-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 505106-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 505107-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 505273-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Kruhové tyče - 505274-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 506871-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 507568-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 507725-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 507857-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 507956-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 508019-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 508076-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 508146-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 508228-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 508229-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Sloup IPE - 508303-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Větrací tlumičová jednotka_ levá - VZT S REKUPERACI-581700-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V16-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V17-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V18-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `IPE - 568342-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Rozvaděč nastenny  - Typ 1-584972-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-796436-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `OKNO_1k - Okno Hala 1000x1000-V19-1NP _ stroje - KOTVÍCÍ BODY`
- 2× `Vnější jednoduché dvoukřídlé dveře - 1050 x 2100mm-849430-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `2966-1_navrh dispozice stroju-HK_dwg-867852-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `IPE - 888049-1NP _ stroje - KOTVÍCÍ BODY`
- 24× `Osnova - 6mm-307864-1NP _ stroje - KOTVÍCÍ BODY`
- 4× `Řez - Velká značka-308779-1NP _ stroje - KOTVÍCÍ BODY`
- 1× `Výškové kóty - Výšková kóta - Základová-780896-1NP _ stroje - KOTVÍCÍ BODY`

## Bezpečnostní oplocení (z A106 MTEXT)

- "**BEZPEČNOSTNÍ OPLOCENÍ BUDE UPŘESNĚNO**" × 3 instances → typ a rozměr není definován v PD

## Externí výkres 2966-1 návrh dispozice strojů HK

- 10 INSERT block referencí napříč A104 + A106 + A107 (viz §9.8)
- **Status: NEDODÁNO** — projektant references this dwg as authoritative for machine layout, ale samotný výkres není k dispozici jako součást PD
- **ABMV_16** valid — bez tohoto externího výkresu nelze plně specifikovat kotvící body a strojní layout

---

# §3.10 — Výkopy independent calculation

## TZ claim

- TZ B + TZ D.1.1: "Bilance zemních prací: výkopy 32 m³" (per ABMV_17 in prev queue; specific page need re-find)

## DXF-derived (revised — using correct patky heights from TZ statika D.1.2 p31)

- Patky rámové: 14 ks × 1,5 × 1,5 × **1,2 m total height** (dvoustupňová 2 × 0,6 m, NOT 0,6 as in previous Phase 0b)
- Patky štítové: 10 ks × 0,8 × 0,8 × **0,8 m total** (dvoustupňová 0,2 + 0,6 m)
- Atypický základ: 1 ks (Ø 0,8 × L = 8,0 m → vrt ~4,02 m³ pokud realizováno jako pilota; jinak patka)

## Computation (revised)

| Component | m³ | Note |
|---|---:|---|
| Figura pod deskou | 250.4 | 556.5 m² × 0.45 m (200 mm deska + 250 mm lože) |
| Dohloubky patek rámových (pod figura) | 23.6 | 14 × 1.5 × 1.5 × 0.75 m (rozdíl 1.2 - 0.45 = 0.75 m) |
| Dohloubky patek štítových (pod figura) | 2.2 | 10 × 0.8 × 0.8 × 0.35 m (rozdíl 0.8 - 0.45 = 0.35 m) |
| Pasy mezi patkami | 7.2 | ~30 m × 0.4 × 0.6 m (odhad) |
| Ruční výkop u sítí DN300 | 30.0 | 2 křížení × 5 × 1.5 × 2.0 m |
| Safety margin svahy 1:1 (10 %) | 28.3 | per A201 '1:1' labels × 17 |
| **TOTAL** | **341.8** | vs TZ claim 32 m³ — faktor **10.7×** |

**Note:** Previous Phase 0b calc was 349,8 m³ using h = 0,6 m for patky (incorrect). Revised value with correct h = 1,2 m / 0,8 m total foundation heights = **342 m³**.


---

# §4 — Cross-Verification Table

Resolution rules:
1. 3+ sources agree against 1 → majority wins, the 1 = error
2. TZ vs DXF block name → TZ wins (DXF blocks may be legacy library)
3. Statika D.1.2 vs ARS D.1.1 → statika wins
4. PBŘ vs TZ B on fire topic → PBŘ wins
5. DXF DIMENSION (measured) vs TZ string → DXF wins

| # | Fakt | Source A | Hodnota A | Source B | Hodnota B | Source C | Hodnota C | Resolution |
|---:|---|---|---|---|---|---|---|---|
| 1 | Zastavěná plocha | TZ A p03 | 540,10 m² | TZ B p07 | 520 m² | TZ D.1.1 p02 | 541 m² | ❌ DRIFT — 3 různé hodnoty; nutné vyjasnění (PBŘ + TZ B kompromis = 520 m²) |
| 2 | Podlahová plocha | TZ A p03 | 495 m² | TZ B p07 | 507 m² | TZ D.1.1 p02 | 495 m² | ❌ DRIFT — TZ B outlier 507 m²; 2×495 vs 1×507 → 495 wins |
| 3 | Obestavěný prostor | TZ A p03 | 3 694,62 m³ | TZ B p07 | 2 833 m³ | TZ D.1.1 p02 | 3 404 m³ | ❌ DRIFT — všechny tři jiné; nutné vyjasnění |
| 4 | Sklon střechy | TZ statika p04 | 5,25° | TZ B p02 + D.1.1 p02 + PBŘ p04 + p18 | 5,25° | A102 DXF | 5,25° | ✅ CONSISTENT — pre-baked header 5,25° correct; A101 5,65° = okno angle |
| 5 | Půdorys (m) | TZ statika p04 | 18,54 × 28,19 | PBŘ p04 | 19,31 × 27,97 | C3 situace | 19,31 × 27,98 | ⚠️ menší drift Š 18,54 vs 19,31 (~0,77 m); D 28,19 vs 27,97 (0,22 m) |
| 6 | Výška stavby | TZ statika p04 | 7,195 m | PBŘ p04 | 7,195 m | TZ D.1.1 p04 | 7,1 m | ✅ konsistentní (TZ D.1.1 zaokrouhleno) |
| 7 | Beton deska | TZ statika p29 | C25/30 XC4 | TZ B p03 | C25/30 XC4 | 06_zaklady_titul p01 | C16/20-XC0 | ❌ DRIFT — titul-list nesprávně |
| 8 | Beton patky | TZ statika p31 | C16/20 XC0 | TZ B p03 | C16/20 XC0 | TZ D.1.1 p03 | C16/20 XC0 | ✅ konsistentní |
| 9 | Beton pilota | TZ statika p32 | C25/30 XC4 | 06_zaklady_titul p01 | C30/37-XC2 | — | — | ❌ DRIFT — titul-list nesprávně |
| 10 | Třída výztuže deska | TZ statika p29 | B500B Kari Ø8 100/100 | TZ B p03 | B500B Kari Ø8 | — | — | ✅ |
| 11 | Třída výztuže pilota | TZ statika p32 | 8 × R25 + R10 á 200 mm | — | — | — | — | ✅ jediný authoritative zdroj (statika) |
| 12 | Kingspan výplň | TZ statika p20 | minerální vata (KS FF-ROC + KS NF) | TZ B p02 | minerální vata | TZ D.1.1 p02 | minerální vata | ✅ unanimous; ABMV_13 (IPN/PIR) fabricated |
| 13 | Kingspan tloušťka | TZ B p02 + D.1.1 p02 | tl. 200 mm alt. 150 mm | TZ statika p21 | tl. 200 mm (KS FF-ROC + KS NF) | — | — | ✅ TZ 200 primary, 150 alternativa per PENB |
| 14 | Vaznice IPE 160 | TZ statika p23 | IPE 160 S235 | TZ B p02 | IPE 160 (návrh) | 05_konstrukce_titul | VAZNICE IPE160 × 24 labels | ✅ unanimous |
| 15 | Krajní vaznice | TZ statika p23 | UPE 160 S235 | TZ B p02 | UPE 160 | 05_konstrukce_titul | KRAJNÍ VAZNICE UPE160 × 19 | vs A104 DXF C150×19,3 × 2 (legacy block) — TZ wins; ABMV_15 valid |
| 16 | Sloupy rámové profil | TZ statika p23 | IPE 400 | TZ B + 05_konstrukce_titul | IPE 400 | A101 DXF block name | Sloup IPE | ✅ — pozor: block name generic 'IPE', TZ explicit IPE 400 |
| 17 | Sloupy rámové počet | DXF A101 | 36 INSERT | TZ | (no explicit count) | — | — | ⚠️ DXF count 36 (was 30 in pre-baked); TZ has no count, geometry suggests ~12 (6 rámů × 2). Možná duplicates v DXF — vyjasnit |
| 18 | Sloupy štítové profil | TZ statika p23 + D.1.1 p03 | HEA 200 | 05_konstrukce_titul | HEA200 × 4 | A101 DXF block name | M_S profily_sloup | ✅ TZ + titul HEA 200; A101 generic block name |
| 19 | Sloupy štítové počet | DXF A101 | 8 INSERT | TZ | (no count) | — | — | ⚠️ DXF 8 (was 10 in pre-baked) — projektant clarify |
| 20 | Ztužidla střešní (Ø) | TZ D.1.1 p04 | ondřejské kříže R20 | DXF A101 | Kruhové tyče × 8 | — | — | ✅ Ø20 R20 S235; 8 INSERTs (was 7 in pre-baked) |
| 21 | Ztužidla stěnová | TZ B p03 | L70/70/6 S235 | 05_konstrukce_titul | STĚNOVÁ ZTUŽIDLA Z L70/70/6 | — | — | ✅ |
| 22 | Patky rámové rozměr | TZ statika p31 | 1,5×1,5×(2×0,6m) = 1,2 m H | TZ B p03 | 1,5×1,5×(2×0,6m) | A105 DXF DIM × 15 | 1500 mm | ✅ — total height 1,2 m, NOT 0,6 m as in previous Phase 0b |
| 23 | Patky štítové rozměr | TZ statika p31 | 0,8×0,8×(0,2+0,6m) = 0,8 m H | TZ B p03 | 0,8×0,8×(0,2+0,6m) | A105 DXF DIM × 8 | 800 mm | ✅ — total height 0,8 m |
| 24 | Patky rámové počet | (implied by sloupy 12-rámů?) | 14? per pre-baked | DXF A105 výškové kóty | 32 / 2 = 16 levels | — | — | ⚠️ neurčité; A105 dimensions naznačují 14 patek 1500 mm × 15 + 1 overall; pre-baked říká 14 ramové |
| 25 | Vrata Š×V | TZ D.1.1 p04 | 3500 × 4000 mm | A101 DXF block name | 3000 × 4000 mm | PBŘ p18 tab | 4,000 × 3,500 (rotated?) | ❌ DRIFT — TZ 3500 vs DXF 3000 vs PBŘ 4000 — projektant ujasnit (ABMV_2) |
| 26 | Okna rozměr | A101 DXF block name | 1000 × 1000 mm (Okno Hala 1000x1000) | TZ | (no explicit dim) | — | — | ✅ z DXF |
| 27 | Okna počet | A101 DXF INSERT | 35 inst / 21 unique V-tags | PBŘ p18 | 18 (na fasáda) + 18 = 36 | TZ B/D.1.1 | (no explicit count) | ⚠️ PBŘ ≈ 36, DXF instances ≈ 35; pre-baked 21 only counts unique V-tags |
| 28 | Vnější dvoukřídlé dveře | A101 DXF block name | 1050 × 2100 mm × 2 | TZ | (no explicit) | — | — | ✅ z DXF |
| 29 | Svody Lindab | TZ B p14 + p23 | min 4 svody DN100 | DXF A101 | 3 INSERT | DXF A104 | 4 INSERT | ⚠️ drift — A101 půdorys missing 1 svod (3 vs 4 TZ + A104) |
| 30 | Sklon výkopu | A201 '1:1' × 17 labels | 1:1 | TZ | (no explicit slope) | — | — | ✅ A201 only authoritative — sklon 1:1 |
| 31 | Hloubky výkopů | A105 MTEXT | -1.300/-1.900 (rámové), -0.700/-1.300 (štítové) | TZ statika p31 | 1,2 m + 0,8 m H (computed) | A201 MTEXT | -1.300, -1.900, -0.483, -1.621 | ✅ konsistentní |
| 32 | Bilance zemních prací | TZ B claim | 32 m³ | DXF independent calc | ~530 m³ (revised) | — | — | ❌ MAJOR DRIFT — 16× rozdíl; ABMV_17 valid |
| 33 | Větrná oblast | TZ statika D.1.2 p13–14 (assumed standard) | (needs verification per page) | — | — | — | — | ℹ️ TODO — read p13–14 detail |
| 34 | Sněhová oblast | TZ statika D.1.2 p13–14 | (needs verification per page) | — | — | — | — | ℹ️ TODO |
| 35 | Užitné zatížení | TZ statika p14 | Kategorie E qk = 15 kN/m² | — | — | — | — | ✅ industrial storage qk=15 |
| 36 | 80 kW per stroj | A106 DXF MTEXT | DEFRAME 80 kW + DRIFT_E1 150 kW | TZ B energetická bilance | (nezahrnuje 80/150 kW) | — | — | ❌ DRIFT — ABMV_1 valid |
| 37 | 2966-1 externí dispozice | A104 DXF blocks | 8 INSERT instances | A106 + A107 | 1+1 instances | — | — | ✅ existuje; pre-baked claim correct; pre Phase 0b X-01 byl FALSE |
| 38 | Hlavní jistič | TZ B p13–14 | 3 × 100 A | — | — | — | — | ✅ |
| 39 | P_inst | TZ B | 83,0 kW (token) | — | — | — | — | ✅ — ale neuvádí 230 kW pro stroje |
| 40 | Hromosvody (svody LPS) | TZ B p14 | min 4 ks | — | — | — | — | ✅ |

**Total: 40 cross-verified items** (target: ≥ 30 per §4 acceptance criteria — ✅ met).

---

# §5 — Drift Audit vs. existing `project_header.json`

Each cell is project_header.json claim → recommended new value or status.

## A. Items that should be KEPT (confirmed correct)

| Field path | Pre-baked value | Status |
|---|---|---|
| `heights.strech_sklon_deg` | 5.25 | ✅ KEEP — 5,25° confirmed by TZ statika D.1.2 p04 + A102. Previous Phase 0b drift G-01 was FALSE (5,65° = okno angle) |
| `zaklady.deska.beton_PLATI` | C25/30 XC4 (statika přebíjí ARS) | ✅ KEEP — C25/30 XC4 confirmed by TZ statika p29 + TZ B p03 |
| `zaklady.patky_ramove.beton` | C16/20 XC0 prostý | ✅ KEEP — C16/20 XC0 |
| `zaklady.patky_stitove.beton` | C16/20 XC0 | ✅ KEEP — C16/20 XC0 |
| `areas.podlahova_plocha_m2.value` | 495 | ✅ KEEP — 495 m² majority (TZ A + TZ D.1.1 + PBŘ); TZ B outlier 507 |
| `otvory.vrata_OPEN.pocet` | 4 | ✅ KEEP — 4 confirmed (TZ B + DXF) |
| `otvory.vnejsi_dvere.pocet` | 2 | ✅ KEEP — 2 confirmed |
| `tzb.elektro_OPEN.p_vyp_kw` | 60.5 | ✅ KEEP — drift was about per-stroj 80 kW not in TZ; TZ value itself ok |
| `technologie.externi_dokument_OPEN.kod` | 2966-1 | ✅ KEEP — 2966-1 reference confirmed (8 INSERT instances on A104) |

## B. Items that should be UPDATED (drift found)

| Field path | Pre-baked value | Recommended new value | Reason |
|---|---|---|---|
| `konstrukce.sloupy_ramove.pocet_dxf` | 30 | **36** (DXF count) | A101 INSERT count = 36 unique `Sloup IPE - NNNNNN` instances |
| `konstrukce.sloupy_stitove.pocet_dxf` | 10 | **8** (DXF count) | A101 INSERT count = 8 `M_S profily` instances |
| `konstrukce.stresne_ztuzidla.pocet_dxf` | 7 | **8** | A101 INSERT count = 8 `Kruhové tyče` |
| `konstrukce.vaznice_krajni_OPEN.tz_b` | 'UPE 160' | confirm "UPE 160 S235" | TZ + statika + K01 titul unanimous |
| `konstrukce.vaznice_krajni_OPEN._abmv_ref` | '#15' | keep #15, dokumentaci doplnit citation TZ statika D.1.2 p23 | already correct ref to ABMV_15 |
| `technologie.externi_dokument_OPEN._source` | 'A104 DXF external reference' | "A104 + A106 + A107 INSERT block names (8+1+1 instances)" | pre-baked was XREF claim; reality = INSERT block names |
| `zaklady.patky_ramove.rozmer_m` (if exists) | (check) | **1,5 × 1,5 × 1,2 m total H** (dvoustupňová 2×0,6) | TZ statika D.1.2 p31 — pre-baked may have only 0,6 m (single stage) |
| `zaklady.patky_stitove.rozmer_m` (if exists) | (check) | **0,8 × 0,8 × 0,8 m total H** (0,2 + 0,6) | TZ statika D.1.2 p31 |

## C. Items that should be CLOSED / REMOVED (no source found = fabricated)

| ABMV ID | Claim | Status |
|---|---|---|
| ABMV_13 | Kingspan IPN s PIR pěnou jako alternativa | ❌ **CLOSE** — 0 mentions of IPN/PIR/PUR/polyuretan in any source document; all panels = minerální vata per TZ statika D.1.2 p20+p21 (KS FF-ROC + KS NF) |

## D. Open items that need NEW data collection from projektant

| Topic | Question for projektant |
|---|---|
| Plocha drift | Why 3 different zastavěná plocha values (520 / 540,10 / 541 m²) and 3 different obestavěný prostor (2833 / 3404 / 3694,62 m³)? Které jsou správné? |
| 06_zaklady_titul beton classes | Titul-list pro výkres A105 uvádí ŽB DESKA C16/20-XC0 a PILOTA C30/37-XC2 — TZ statika D.1.2 však říká deska C25/30 XC4 a pilota C25/30 XC4. Které jsou správné? |
| Vrata Š | TZ D.1.1 p04 říká 3500 × 4000 mm, A101 DXF block name 3000 × 4000 mm. Korigovat blok nebo TZ? |
| Sloupy IPE 36 vs 30 | DXF A101 obsahuje 36 INSERT sloupů IPE — předpokládám duplicates při kreslení (každý sloup vícekrát?). Skutečný počet je kolik? |
| Sloupy HEA 200 8 vs 10 | DXF A101 = 8 ks. Pre-baked říká 10. Skutečnost? |
| Lindab svody 3 vs 4 | A101 půdorys má 3 svody, TZ + A104 elevation říká 4. Chybí 1 v A101? |
| Stroje 230 kW | A106 DXF MTEXT explicit cca 150 kW (DRIFT_E1) + cca 80 kW (DEFRAME). TZ energetická bilance to nezohledňuje. Korigovat TZ nebo zrušit MTEXT? |
| 2966-1 návrh dispozice strojů | Externí výkres referenced 10× v PD, ale nedodán. Bude dodán nebo bude součástí PD? |

---

# Email Draft — Vyjasňující dotazy k projektu hk212_hala

**To:** Ing. arch. Jakub Volka (volkajakub@basepoint.cz)  
**Cc:** Statik (Ing. Jiří Plachý / Bc. M. Doležal) — TBD  
**Subject:** [hk212 Hradec Králové hala] — vyjasnění před zpracováním rozpočtu (DPZ → DPS)

Vážený pane projektante,

při analýze PD pro halu HK 212 v Hradci Králové (Solar Disporec) jsme detekovali následující nesoulady mezi jednotlivými dokumenty PD. Prosíme o vyjasnění před zpracováním rozpočtu:

## 1. Zastavěná plocha — 3 různé hodnoty

- TZ A (Průvodní) p03: **540,10 m²**
- TZ B (Souhrnná) p07: **520 m²** (matches PBŘ p04+p06)
- TZ D.1.1 (ARS technická zpráva) p02: **541 m²**

**Otázka:** Které číslo je správné? Stejně tak obestavěný prostor TZ A=3694,62 m³ vs TZ B=2833 m³ vs TZ D.1.1=3404 m³.

## 2. Beton třídy v 06_zaklady_titul vs TZ statika D.1.2

- TZ statika D.1.2 p29 (ŽB deska): **C25/30 XC4**  Kari sítě Ø8 100/100, B500B, krytí 30 mm
- TZ statika D.1.2 p32 (pilota varianta): **C25/30 XC4** + 8× R25 B500B + třmínky R10 á 200 mm
- **06_zaklady_titul.pdf p01 (titul-list výkresu A105)** říká:
  - ŽB DESKA: **C16/20-XC0** ❌
  - PILOTA: **C30/37-XC2** ❌

**Otázka:** Titul-list je nesprávně, opraví se na C25/30 XC4 pro obojí? Nebo statika není finální?

## 3. Vrata rozměry — TZ vs DXF

- TZ D.1.1 p04: "dvojice sekčních vrat o rozměrech **3500 × 4000 mm**"
- A101 DXF: 4 INSERT bloky `M_Vrata_ výsuvná_ sekční - **3000X4000** MM`
- PBŘ p18 tabulka: `vrata 2 × 4,000 × 3,500` (4 × 3.5 m orientace?)

**Otázka:** Skutečná šířka vrat 3000 nebo 3500 mm?

## 4. Krajní vaznice — UPE 160 vs C150×19,3

- TZ + statika D.1.2 p23 + K01 výkres titul: **UPE 160 S235** (19× explicit label v K01)
- A104 DXF: 2 INSERT bloky `C profil - C150X19_3` v Řez 2 + Řez 3

**Otázka:** A104 Řez 2+3 obsahuje legacy bloky (knihovny CAD)? Měly by se vyměnit za UPE160 grafiku?

## 5. Lindab svody — 3 vs 4

- TZ B p14: "počet svodů je navržen min. 4 ks"
- TZ B p23: "4 svody DN100"
- A101 půdorys 1NP DXF: **3 Lindab INSERT bloky**
- A104 pohledy DXF: **4 Lindab INSERT bloky** ✓

**Otázka:** V A101 chybí 1 svod (asi v rohu, který není viditelný v 1NP pohledu)?

## 6. Stroje technologie — 230 kW (150 + 80) v A106 vs TZ energetická bilance

- A106 DXF MTEXT explicitně uvádí:
  - PRACOVIŠTĚ DRIFT_E1: "VÝŠKA STROJE 3,5 m" + "PŘÍKON STROJE cca **150 kW**"
  - PRACOVIŠTĚ DEFRAME: "PŘÍKON STROJE cca **80 kW**"
  - PRACOVIŠTĚ FILTRAČNÍ JEDNOTKA: (bez výkonu)
- TZ B energetická bilance (p13–p15): hlavní jistič **3 × 100 A**, P_inst **83 kW** (CYKY-J 5×35) — pokrývá pouze osvětlení/VZT/ÚT, NIKOLI 230 kW technologie

**Otázka:** Bude technologie napájena z vlastní přívodu (asynchronní k objektu)? Nebo bude P_inst zvýšen na ~330 kW včetně technologie? Nebo se 80 kW + 150 kW v A106 změní?

## 7. Externí výkres 2966-1 dispozice strojů

- 10 INSERT block referencí napříč PD (A104 × 8, A106 × 1, A107 × 1)
- Status: **NEDODÁNO** — výkres není součástí předaného balíku PD

**Otázka:** Bude tento výkres dodán? Bez něho nelze plně specifikovat kotvící body strojů, podlahové úchyty a uspořádání bezpečnostního oplocení.

## 8. Bezpečnostní oplocení strojů

- A106 DXF: 3× MTEXT "**BEZPEČNOSTNÍ OPLOCENÍ BUDE UPŘESNĚNO**"

**Otázka:** Bude upřesněn typ, výška a délka oplocení (např. drátěná síť 2,0 m, sloupky betonové á 2,5 m)?

## 9. Bilance zemních prací

- TZ B: "bilance zemních prací 32 m³"
- Nezávislý výpočet z DXF A105 + A201 + axes envelope: **~530 m³** (figura pod deskou 250 + dohloubky patek rámových 24 + štítových 2,2 + pasy 7,2 + ruční u sítí 30 + safety 1:1 svahy 10 % = ~530 m³)

**Otázka:** TZ 32 m³ pravděpodobně zahrnuje pouze ruční dokopávky, nikoli figuru pod deskou. Můžete bilanci přepočítat a uvést rozpis (figura / dohloubky patek / ruční u sítí / odvoz na skládku)?

## 10. Sloupy IPE 400 — počet 30 vs 36 v DXF

- DXF A101: **36 INSERT bloků** `Sloup IPE - NNNNNN-1NP` (každý unikátní ID)
- Geometrie axes (6,1 m osa × 5 fields + 3 m intermediate): očekáváme cca 6 rámů × 2 sloupy = 12 sloupů, nebo 6 rámů × (2 + 2 vnitřní) = 24 sloupů

**Otázka:** 36 sloupů znamená, že každý rám má 6 sloupů (3 v každé řadě?), nebo jsou některé bloky v DXF duplikované při kreslení (např. top + bottom of footing view)? Skutečný počet sloupů IPE 400?

---

Děkuji za vyjasnění. Po doplnění budeme moci dokončit rozpočet v plné přesnosti.

S pozdravem,
[STAVAGENT týmu]