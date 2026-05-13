# Session Handoff — Phase 0b RE-RUN (Independent Cross-Verification)

**Date:** 2026-05-13
**Branch:** `claude/hk212-phase-0b-rerun-clean-verification`
**Status:** Phase 0b RE-RUN complete · **STOP gate triggered** (výkop > 10× drift per §11)
**Predecessor:** Phase 0b on `claude/hk212-phase-0b-phase1-foundation` (2026-05-12)

---

## Executive Summary

Per user request — previous Phase 0b validation contained inaccuracies from chat-session estimates. This run re-verified **everything** against source documents only:

- 7 TZ PDFs (102 pages, dumped per-page to `outputs/tz_pages/`)
- 7 DXF parses (existing structured dumps from Phase 0b, all 7 files re-grep'd)
- 3 situace PDFs (`outputs/situace_pages/`, C1/C2/C3)

**Result: previous Phase 0b had 3 false drifts + 1 fabricated ABMV.** Corrected this run. **Plus 3 new legitimate drifts discovered**.

---

## Corrections to previous Phase 0b

| ID | Previous claim | Actual |
|---|---|---|
| G-01 sklon 5,25° → 5,65° | drift | ❌ **FALSE** — 5,65° on A101 = window-tilt angles (4 instances at window-corner coordinates). Real sklon střechy = **5,25°** (TZ statika D.1.2 p04 + A102 + 7 other unanimous sources). user's hypothesis verified. |
| X-01 2966-1 NOT found | drift | ❌ **FALSE** — reference exists as INSERT block names (not XREF entities, which is why prev. flag-based XREF detection missed them). **10 instances total** across A104 (8) + A106 (1) + A107 (1). |
| ABMV_13 Kingspan IPN/PIR alternativa | open ABMV | ❌ **FABRICATED** — **0 mentions** of PUR/IPN/PIR/polyuretan in ANY of 7 TZ + 3 situace PDFs. Authoritative TZ statika D.1.2 p21: roof = KS FF-ROC (rock wool), walls = KS NF (minerální vata). |
| Výkop calc 349,8 m³ | mostly correct | ✅ **CONFIRMED 341,8 m³** (within rounding noise after re-doing dohloubka math using TZ statika D.1.2 p31 correct heights 1,2 m rámové + 0,8 m štítové). Still 10,7× TZ B claim. |

---

## New legitimate drifts discovered (added to queue)

### ABMV_18 (NEW, important)
**Beton classes — titul-list vs statika**
- `06_zaklady_titul.pdf` p01 (titul-list pro výkres A105 ZÁKLADY):
  - ŽB DESKA = **C16/20-XC0** ❌
  - PILOTA = **C30/37-XC2** ❌
- TZ statika D.1.2 p29 + p32 (authoritative):
  - Deska = **C25/30 XC4**
  - Pilota = **C25/30 XC4** + 8×R25 B500B + třmínky R10 á 200 mm

### ABMV_19 (NEW, critical)
**Plochy stavby — 3 different values**
- Zastavěná plocha: TZ A=540,10 m² / TZ B=520 m² / TZ D.1.1=541 m² / PBŘ=520 m²
- Obestavěný prostor: TZ A=3694,62 m³ / TZ B=2833 m³ / TZ D.1.1=3404 m³

### ABMV_20 (NEW, minor)
**Lindab svody — A101 půdorys missing 1 svod**
- TZ B p14+p23: 4 svody DN100
- A104 pohledy DXF: 4 INSERT (matches)
- A101 půdorys 1NP DXF: **3 INSERT** — 1 svod není v půdorysu zakreslen

---

## §9 user-flagged items — verification table

| User question | Verdict | Top-1 evidence |
|---|---|---|
| §9.1 Zastavěná plocha — 3 hodnoty? | ✅ DRIFT CONFIRMED | TZ A p03 / TZ B p07 / TZ D.1.1 p02 — all cited |
| §9.2 Sklon 5,25° vs 5,65° | ✅ 5,25° AUTHORITATIVE | TZ statika D.1.2 p04 + A102 DXF (the roof plan!) — 5,65° on A101 = okenní úhel |
| §9.3 Beton C25/30 XC4 vs C30/37 XC2 | ✅ C25/30 wins; 06_zaklady_titul outlier | TZ statika D.1.2 p29 (deska) + p32 (pilota) |
| §9.4 Kingspan PUR/IPN/PIR | ✅ **0 hits anywhere** — minerální vata only | TZ statika D.1.2 p20+p21: KS FF-ROC + KS NF |
| §9.5 UPE 160 vs C150×19,3 | ✅ UPE 160 wins 22:2 | TZ + statika + K01 titul (19 explicit labels) vs A104 (2 legacy blocks) |
| §9.6 Vrata 3000 vs 3500 mm | ✅ DRIFT CONFIRMED | TZ D.1.1 p04 "3500 × 4000 mm" vs A101 DXF "3000X4000" |
| §9.7 Lindab svody 3 vs 4 | ✅ TZ + A104 say 4; A101 has 3 | NEW DRIFT — ABMV_20 |
| §9.8 80 kW per stroj | ✅ A106 MTEXT explicit + 2966-1 reference IS FOUND | A106 G-ANNO-TEXT: "PŘÍKON STROJE cca 80 kW" (DEFRAME) + "150 kW" (DRIFT_E1); 2966-1 in 10 INSERT block names |

---

## Final queue state

| Severity | Count |
|---|---:|
| Critical (open) | 6 |
| Important (open) | 6 |
| Minor (open) | 2 |
| Closed (fabricated) | 1 (ABMV_13) |
| **Total** | **20** |

(Previous: 17 → +3 new − 0 deleted; ABMV_13 status changed open → closed_fabricated.)

---

## Files generated (this run)

**Scripts:**
- `scripts/extract_tz_pages.py` — per-page TZ text dumps for citation
- `scripts/build_phase_0b_rerun_reports.py` — comprehensive report builder

**Per-page text dumps:**
- `outputs/tz_pages/*.txt` (102 files) + `_index.json`
- `outputs/situace_pages/*.txt` (3 files) + `_index.json`

**Reports (`outputs/phase_0b_rerun/`):**
- `MASTER_facts_report.md` (48 KB — full consolidated)
- `section_9_user_flagged_verification.md` (10 KB)
- `section_6_externi_site.md` (3,5 KB)
- `section_3_1_facts_project_identification.md`
- `section_3_2_facts_geometry.md`
- `section_3_3_facts_constructions.md`
- `section_3_5_facts_otvory.md`
- `section_3_8_facts_tzb.md`
- `section_3_9_facts_technologie.md`
- `section_3_10_facts_vykopy_calc.md`
- `cross_verification_table.md` (40 items, > target 30)
- `drift_audit_vs_header.md` (KEEP / UPDATE / CLOSE / NEW sections)
- `email_draft_for_projektant.md` (10-item draft, ready to send after review)
- `vyjasneni_queue_updated.json` (20 items, refreshed)

---

## §11 STOP gate analysis

| Gate | Threshold | Actual | Triggered? |
|---|---|---|---|
| 3+ new silent drifts | > 3 | 3 (ABMV_18/19/20) | ⚠️ At threshold |
| 5+ fabricated items in existing queue | > 5 | 1 (ABMV_13) | ✗ No |
| Výkop > 10× drift | > 10 | 10,7× | ✅ **YES** |
| DXF unparseable | any | All 7 OK | ✗ No |
| TZ tokens < 200 | < 200 | 600+ | ✗ No |

**STOP triggered → return control to user before applying changes to `project_header.json` or starting Phase 1.**

---

## Recommendation (next steps)

1. **User reviews:**
   - `MASTER_facts_report.md` (executive summary + all citations)
   - `email_draft_for_projektant.md` (10 vyjasňující dotazy)
   - `drift_audit_vs_header.md` (KEEP / UPDATE / CLOSE table)

2. **After approval** — separate task:
   - Apply approved changes to `inputs/meta/project_header.json` (sloupy 30→36, štítové 10→8, ztužidla 7→8, `06_zaklady_titul` beton classes correction, plochy reconciliation)
   - Optionally rewrite `outputs/abmv_email_queue.json` ← `outputs/phase_0b_rerun/vyjasneni_queue_updated.json`
   - Send email draft to projektant (after pricing/scope review)

3. **Phase 1 generator** — start AFTER:
   - Projektant resolves at least the critical drifts (plochy, beton, vrata, 80 kW)
   - OR working assumptions are explicitly accepted for each unresolved item

---

## Open follow-ups for future verification (not blockers)

- **§3.7 PBŘ** — full requirement matrix (R/EI/EW classes per construction, fire load kg/m²) not extracted yet; PBŘ has 32 pages, would need own sub-pass
- **§3.11 Statika loads** — větrná oblast, sněhová oblast, qk, EXC class — searched but partial; D.1.2 p13–14 needs detailed re-read
- **§3.6 Fasáda klempířské** — only TZ summary captured; per-element specs (parapetní plech, atika, žlaby) need detail pass
- **Cleanup root-level DXF duplicates** — `/home/user/STAVAGENT/*.dxf` (4 files) — still untracked, recommend rm after user OK
- **Phase 1 generator design** — pending user approval of corrected header + closure of critical ABMVs

---

## §13 ADDENDUM — Precedent inventory + pattern + alignment (DONE)

**Date appended:** 2026-05-13
**Trigger:** user uploaded `test-data/hk212_hala/example_vv/` (20 files, ~8.5 MB) — §13.5 STOP cleared.

### Discovery (§13.1)
- 6 hala-typed precedent xlsx (Rožmitál ⭐ primary, Hala JHV, Kralovice, ANTRACIT, Sklad škrobu, Třemošná)
- 6 Forestina (residential/sklad — non-primary)
- 6 PDF výkresů (D.1.1.1..D.1.1.6 — supporting docs)
- 1 XML mirror, 1 dummy file
- Report: `outputs/phase_0b_rerun/example_precedents_inventory.md`

### Pattern analysis (§13.2)
- **Catalog (jádro):** URS 9-mistné kódy (1 kanonický catalog, identický napříč 5/6 precedenty — per user feedback 2026-05-13)
- **Export wrappers:** RTS Rozpočet (Rožmitál `#RTSROZP#`) vs KROS Komplet (4× — `Export Komplet`) — oba interchangeable nad stejným URS catalogem; volba wrapperu je výstupní formátovací rozhodnutí, ne catalog volba. ANTRACIT (custom investor format) = jiný catalog, nepřenosný.
- **Price book overlay:** sloupec "Ceník" (`RTS 24/ II` / `URS 24/I` / `Vlastní`) řeší jen Kč/MJ údaje nad URS kódy.
- **Hierarchy:** Stavba → Objekt (SO) → Rozpočet → Díl → Položka (POL + POP + VV)
- **Granularity per ŽB element:** 4-5 položek (beton + bednění zřízení + bednění odstr + výztuž + přesun hmot)
- **Granularity per ocel:** 2-3 položek (specifikace + montáž + nátěr)
- **Granularity per Kingspan:** 2 položek
- **Subdodavatel split:** column "Dodavatel" = `Vlastní` default, fill at contracting time. 6-8 trades typical pro hala-sized projects
- **VRN:** 8-12 položek (geodet, ZS, doprava, zkoušky, atesty, pojištění)
- **Excel layout:** 25 sloupců (RTS standard, recommended)
- Report: `outputs/phase_0b_rerun/example_pattern_analysis.md` + `.json`

### Apply to hk212 (§13.3)
- **11-SO skeleton:** SO-01 ASŘ + SO-02 Statika + SO-03 ZTI vnitř + SO-04 ZTI venk + SO-05 VZT + SO-06 ÚT + SO-07 EL + SO-08 LPS + SO-09 PBŘ + SO-10 Technologie M + SO-11 VRN
- **Target items:** ~200-310 (matches spec ≥180)
- **Default catalog:** URS 9-mistné kódy. **Default export wrapper:** KROS Komplet (preferred pro veřejné zakázky); RTS Rozpočet interchangeable
- **Custom items:** Rpol* prefix pro technologii strojů (SO-10) + jakékoli mimo URS catalog

### Discrepancy check (§13.4)
- ✅ Granularity matches precedent pro ŽB / ocel / Kingspan / klempířské / vrata / VRN
- ⚠️ SO-10 Technologie strojů — Rožmitál nemá precedent (žádná strojní technologie); použít Rpol* custom položky, KAŽDÁ s `_vyjasneni_ref: ['ABMV_3', 'ABMV_16']`
- ⚠️ HSV-1 výkopy — Rožmitál má jen 17 položek (kombinováno s demolicí); použít FULL precedent breakdown (6-8 položek), KAŽDÁ s `_vyjasneni_ref: ['ABMV_17']`
- ⚠️ Beton desky podlahy — Rožmitál má 1 položku; hk212 vyžaduje 6 položek (lož + beton + 2× bednění + KH síť + vlákna do betonu + povrchová úprava)
- ❌ NEPOUŽÍVAT ANTRACIT custom investor format pro hk212 (jiná filozofie, nepřenese se do zadávacího řízení)
- Report: `outputs/phase_0b_rerun/structure_alignment_check.md`

### Privacy guardrails (§13.6) — aktivně dodrženo
- 0 cen, 0 IČO/DIČ, 0 kontaktů, 0 adres v output reportech
- Investor / projektant class abstraktně (veřejný/soukromý/krajská správa atd.)
- Subdodavatel attribution pouze na chapter-level granularitě

### REVISED Phase 1 start gate
Phase 1 generator nyní MÁ kompletní precedent strukturu. Single remaining blocker pre-Phase-1:
1. **User review + approval** drifts z `drift_audit_vs_header.md` (7 drifts + 7 confirmed precedent recommendations)
2. **Critical ABMV closure** (alespoň #1 80kW DRIFT, #3 stroje, #11 IGP pilota, #13 Kingspan typ, #15 UPE 160 vs C150, #17 výkopy)
3. **Export wrapper volba** (catalog vždy URS): KROS Komplet (default — veřejné zakázky) nebo RTS Rozpočet (interchangeable, 25-sloupcový layout)
4. **Confirm 11-SO struktura** nebo navrhni změny

Po přijetí těchto 4 → Phase 1 spustím separátně.
