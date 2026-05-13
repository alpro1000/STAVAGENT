# Session Handoff — Phase 0b (Independent Validation)

**Date:** 2026-05-12
**Branch:** `claude/hk212-phase-0b-phase1-foundation`
**Status:** Phase 0b complete · **STOP gate triggered** (7 drifts > 5 threshold per spec §3.6)

---

## Co bylo uděláno

1. **`dxf_hala_parser.py`** — nový isolated modul v `concrete-agent/packages/core-backend/app/services/`. Per Q1 podmínky: minimální schema (block_counts, block_instances, dimensions, text_entries, hatch_per_layer, closed_polylines, xrefs), no shared base class, ezdxf-direct. ~200 řádků.
2. **`extract_dxf.py`** — driver, parse 7 DXF → `outputs/dxf_parse/*.json`. Souhrn: 784 INSERT instances, 390 DIMENSIONs, 545 TEXT/MTEXT, 343 HATCH napříč 7 výkresy.
3. **`extract_tz.py`** — PyMuPDF + regex (24 patterns: concrete/exposure/steel/fire/CSN/kW/m³h/dim/IPE/HEA/UPE/L-angle/KARI/amperage/CYKY/DN/...). Pdfplumber nedostupný (cryptography backend broken). 7 PDF + agregát → `outputs/tz_specs/*.json`. 600+ tokens napříč 102 stran.
4. **`validate_phase_0b.py`** — cross-check 15 claims z `project_header.json` proti DXF+TZ evidenci + nezávislý výkop calc pro VYJASNĚNÍ #17.
5. **`outputs/validation_report.{json,md}`** — strukturovaný + lidsky čitelný reportu.
6. **`outputs/abmv_email_queue.json`** — UPDATED in-place: přidán `ABMV_17` (critical, earth works 32 → 349.8 m³, faktor 10.9×).

## Výsledky validace

| Status | Count |
|---|---:|
| ✅ Confirmed | 7 |
| ⚠️ Drift | 7 |
| ⏳ Partial | 1 |
| ❓ Missing evidence | 0 |
| **Celkem** | 15 |

### Drifts (vyžadují akci před Phase 1)

| ID | Field | Pre-baked | Observed | Action |
|---|---|---|---|---|
| K-01 | sloupy_ramove.pocet_dxf | 30 | **36** | Update header k 36, dotaz na projektanta jestli sloupy vícestupňové nebo dvojité u rámových rohů |
| K-02 | sloupy_stitove.pocet_dxf | 10 | **8** | Update header k 8 |
| K-03 | stresne_ztuzidla.pocet_dxf | 7 | **8** | Update header k 8 |
| K-04 | vaznice_krajni | C150×19,3 (A104) | TZ má 19× UPE 160 | **Flip working_assumption #15**: UPE 160 wins (TZ + statika přebíjejí jednorázový A104 popisek) |
| G-01 | strech_sklon_deg | 5.25 | **5.65** | Update header (DXF MTEXT shows 5.65° ×4 instances) |
| E-01 | elektro p_vyp_kw | 60.5 | TZ list bez 80 kW | **Potvrzuje ABMV #1** — 80 kW DRIFT/DEFRAME stroje **nejsou** v TZ uvedeny, P_inst v TZ je 83 kW (pre-baked OK), drift je v "80 kW per stroj" claim |
| X-01 | externi_dokument 2966-1 source_A104 | A104 XREF | 0 XREFs nikde, 0 zmínky '2966'/'stroj' v A104 MTEXT | Reference pravděpodobně ztracena při DWG→DXF konverzi nebo byla v jiném artefaktu. Manual check A104 PDF doporučen |

### Confirmed (✅)

- O-01 Vrata sekční: 4 ✓
- O-02 Vnější dveře 2-křídlé: 2 ✓
- O-03 Okna: max V-tag = 21 (matches pre-baked, 35 INSERT instances = různé fasádní strany)
- G-02 Podlahová plocha 495 m² ✓ (A101 MTEXT)
- B-01 Beton desky C25/30 + XC4 ✓ (TZ tokens)
- B-02 Beton patek C16/20 + XC0 ✓ (TZ tokens)
- Z-01 Atypický základ pilota Ø800/L=8m + IGP dependency ✓ (A105 MTEXT explicit)

### VYJASNĚNÍ #17 — Earth works (NEW)

**Nezávislý výpočet: 349.8 m³** vs TZ B m.10.g claim **32 m³** = **10.9× drift**.

Breakdown:
- Figura pod deskou: **250.4 m³** (zastavěná 556 m² × 0.45 m hloubka)
- Dohloubky patek rámových: **31.5 m³** (14 × 1.5×1.5×1.0 m)
- Dohloubky patek štítových: **1.6 m³** (10 × 0.8×0.8×0.25 m)
- Pasy mezi patkami: 7.2 m³
- Ruční výkopy u sítí DN300: 30.0 m³
- Safety margin svahy 1:1 (10%): 29.1 m³

Varianta: pilota Ø800/L=8 m vrt = 4.02 m³ (závisí na IGP, ABMV #11).

## Open items / cleanup

1. **Root-level DXF duplicates** — `/home/user/STAVAGENT/*.dxf` (4 souborů × 4–25 MB) jsou untracked duplikáty originálů v `test-data/hk212_hala/inputs/vykresy_dxf/`. Q4 multi-select nevybral cleanup option → ponechány v pracovním stromě, mimo git. Doporučení: rm na konci.
2. **TZ konverze quirk** — Czech diacritics (`ě`, `ů`, `ť`) jsou v MTEXT entities rozděleny na samostatné objekty (např. `'Sklad fotovoltaických panel' + 'ů'`). Regex search funguje (stem matching), ale full-string search by selhal. Důležité pro Phase 1.
3. **Pdfplumber chybí** — system cryptography binding broken, venv install fails na cffi/pyo3. Použit PyMuPDF místo. Pro budoucí TZB drawings extrahování (D.1.4) může být potřeba bytestream-only PDF parser nebo poppler pdftotext.
4. **Multi-role AI / endpoint** — outbound HTTP blocked, sandbox neumožňuje Vertex AI / Bedrock / Gemini. Per Q2 — local URS_201801.csv (39 742 řádků) + local OTSKP XML (17 904 kódů) jako jediné catalog source pro Phase 1. AI semantic interpretation = `needs_review` flag.

## Recommendation per spec §3.6 + §10

**STOP před Phase 1 generator** — 7 drifts > 5 threshold. Před Phase 1 spuštěním:

1. **Schválit aktualizace `project_header.json`:**
   - sloupy_ramove.pocet_dxf: 30 → **36**
   - sloupy_stitove.pocet_dxf: 10 → **8**
   - stresne_ztuzidla.pocet_dxf: 7 → **8**
   - vaznice_krajni: working_assumption → **UPE 160** (S235), C150×19,3 vyloučit
   - strech_sklon_deg: 5.25 → **5.65**
   - heights / scope_estimate — ostatní hodnoty se nemění

2. **Manual review** A104 PDF na výskyt "2966-1" reference (možná v razítku nebo legendě, nezachyceno v DXF text layer).

3. **Optional**: Odeslat update VYJASNĚNÍ e-mailu s ABMV #17 (earth works × 10) — projektant pravděpodobně přepočítá HSV-1 bilanci nebo vysvětlí svůj odhad 32 m³ (asi jen ruční výkopy bez desky).

4. Po schválení → Phase 1 Generator může startovat se zaktualizovaným headerem.

## Next session — Phase 1 plan

- Per kapitola item generation: HSV-1 / HSV-2 / HSV-3 / HSV-9 / PSV-71x / PSV-76x / PSV-77x / PSV-78x / TZB (ZTI+VZT+UT+EL+LPS) / M-konstrukce / VRN
- Target: ≥180 položek
- URS lookup: local URS_201801.csv (39742 codes) + OTSKP XML (17904 codes) — TF-IDF / keyword overlap matching. Items bez match: `urs_status='no_match'` + top-3 alternatives
- Output `items.json` schema: **hybrid** (libuse base + hala extension fields), per Q3
- Every HSV-1 item: `_vyjasneni_ref: ["ABMV_17"]`
- Variant items (pilota Ø800/L=8m): `_status_flag: 'variant_pending_IGP'` + `_vyjasneni_ref: ['ABMV_11']`
- Stroje anchorage items: `_status_flag: 'pending_specifikace_stroju'` + `_vyjasneni_ref: ['ABMV_3', 'ABMV_16']`

## Soubory změněné v tomto commit

```
NEW   concrete-agent/packages/core-backend/app/services/dxf_hala_parser.py
NEW   test-data/hk212_hala/scripts/extract_dxf.py
NEW   test-data/hk212_hala/scripts/extract_tz.py
NEW   test-data/hk212_hala/scripts/validate_phase_0b.py
NEW   test-data/hk212_hala/outputs/dxf_parse/A101_pudorys_1np.json
NEW   test-data/hk212_hala/outputs/dxf_parse/A102_pudorys_strechy.json
NEW   test-data/hk212_hala/outputs/dxf_parse/A104_pohledy.json
NEW   test-data/hk212_hala/outputs/dxf_parse/A105_zaklady.json
NEW   test-data/hk212_hala/outputs/dxf_parse/A106_stroje.json
NEW   test-data/hk212_hala/outputs/dxf_parse/A107_stroje_kotvici_body.json
NEW   test-data/hk212_hala/outputs/dxf_parse/A201_vykopy.json
NEW   test-data/hk212_hala/outputs/tz_specs/01_ars_pruvodni_A.json
NEW   test-data/hk212_hala/outputs/tz_specs/02_ars_souhrnna_B.json
NEW   test-data/hk212_hala/outputs/tz_specs/03_ars_d11_TZ.json
NEW   test-data/hk212_hala/outputs/tz_specs/04_statika_d12_TZ_uplna.json
NEW   test-data/hk212_hala/outputs/tz_specs/05_konstrukce_titul.json
NEW   test-data/hk212_hala/outputs/tz_specs/06_zaklady_titul.json
NEW   test-data/hk212_hala/outputs/tz_specs/07_pbr_kpl.json
NEW   test-data/hk212_hala/outputs/tz_specs/_aggregate.json
NEW   test-data/hk212_hala/outputs/validation_report.json
NEW   test-data/hk212_hala/outputs/validation_report.md
NEW   test-data/hk212_hala/handoff/session_handoff_2026-05-12_phase_0b.md
MOD   test-data/hk212_hala/outputs/abmv_email_queue.json  (added ABMV_17)
```
