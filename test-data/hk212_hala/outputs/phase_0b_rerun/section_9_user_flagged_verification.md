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
