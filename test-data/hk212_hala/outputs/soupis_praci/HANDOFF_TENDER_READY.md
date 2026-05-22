# HK212 Soupis prací — Tender Handoff

**Project:** Hala Hradec Králové [212] — SOLAR DISPOREC s.r.o.
**Branch:** `claude/hk212-soupis-praci-final`
**Generated:** 2026-05-24
**Stupeň PD:** DSP

---

## 1. Tender-ready verdict: 🟡 **YELLOW**

Soupis prací is **structurally complete and bid-stage usable**, but 3 critical ABMV remain unresolved before final tender submission. Recommended workflow:

1. ✅ **Use Excel + JSON as-is** for internal review, vendor RFQs, draft submission.
2. ⚠ **Resolve 3 critical ABMV** before sending final tender to SOLAR DISPOREC (see §6).
3. 🔵 **Cena fill** is a separate workflow (per user directive — not in scope this commit).

**Why YELLOW vs GREEN:** 3 critical ABMV (stroje, beton class, zastavěná plocha) have material cost impact. GREEN requires their resolution. RED would require schema or structural failure — not present here.

---

## 2. Status summary

| Metric | Value |
|---|---:|
| **Total items processed** | **128** |
| Tier 1 (KROS match conf ≥ 0.70) | **79 (61.7 %)** |
| Tier 2 (custom položka) | **49 (38.3 %)** |
| Acceptance §8 ≥ 60 % Tier 1 | ✅ **MET** |
| Excel sheets generated | 13 |
| ABMV total | 22 |
| ABMV unresolved | **12** (3 critical, 7 important, 2 minor) |
| Items.json mutation | ✅ **NONE** (original UNMODIFIED) |
| Prices | ✅ Empty per user directive |

### Per kapitola

| # | Kapitola | Položek | Tier 1 | Tier 2 | Hlavní MJ |
|---|---|---:|---:|---:|---|
| 1 | HSV-1 Zemní práce | 28 | 21 | 7 | m³ |
| 2 | HSV-2 Základy + deska | 18 | 18 | 0 | kg |
| 3 | HSV-3 Ocelová konstrukce | 14 | 6 | 8 | kg |
| 4 | HSV-9 Ostatní stavební | 4 | 0 | 4 | m³ |
| 5 | PSV-71x Izolace | 4 | 4 | 0 | m² |
| 6 | PSV-76x Výplně otvorů | 12 | 11 | 1 | bm |
| 7 | PSV-77x Podlahy | 6 | 6 | 0 | m² |
| 8 | PSV-78x Klempířské | 12 | 6 | 6 | bm |
| 9 | PSV-OPL Kingspan opláštění | 8 | 5 | 3 | m² |
| 10 | VRN | 22 | 2 | 20 | t·km |
| | **CELKEM** | **128** | **79** | **49** | |

### Tier 2 distribution (where KROS doesn't cover)

- **VRN (20 items)** — VRN nemají standardní KROS code (expected, normal)
- **HSV-3 OK (8 items)** — specifické ocelové profily (IPE 400, IPE 450, UPE 160 atd.)
- **HSV-9 (4 items)** — lešení pro Kingspan (produktově specifické)
- **PSV-78x klempíř (6 items)** — Lindab + MEA Mearin produktové specifikace
- **PSV-OPL Kingspan (3 items)** — KS NF + KS FF-ROC + montáž (Kingspan není v KROS, expected)
- **HSV-1 (7 items)** — kácení dřevin + ruční výkopy u sítí + atypický základ (specifické)
- **PSV-76x (1 item)** — vrata 3500×4000 motorická (rozměr nestandardní)

---

## 3. Output files

```
outputs/soupis_praci/
├── preflight_inventory.md             ← Phase A: KROS/example_vv/items inventory
├── kros_match_results.json            ← Phase B: per-item matching
├── kros_match_report.md               ← Phase B: human-readable match report
├── hk212_soupis_praci.json            ← Phase C: enriched final JSON
├── hk212_soupis_praci.xlsx            ← Phase C: 13-sheet Excel
└── HANDOFF_TENDER_READY.md            ← this doc
```

### Excel sheet structure (`hk212_soupis_praci.xlsx`)
1. **Hlavička** — project metadata, geometric + geotechnical params, reference docs
2. **Rekapitulace** — per kapitola summary table
3-12. **Per kapitola detail** — `Poř.|Kód|Popis|MJ|Mnozstvi|J.cena|Celkem|Tier|Conf|Pozn.`
13. **ABMV + Poznámky** — unresolved ABMV (highlighted), resolved ABMV reference, doc list

### Excel highlights
- **Yellow background** = item with conf < 0.70 (KROS match OR items.json)
- **Pink/red background** = item with active `_review_*` flag (e.g. `_review_concrete_class`)
- **Empty J.cena + Celkem columns** = ready for manual price fill

---

## 4. JSON schema (`hk212_soupis_praci.json`)

```jsonc
{
  "_meta": { /* project + counts + ceny_status */ },
  "hlavicka": { /* investor + geometrie + geotechnika + docs */ },
  "items": [
    {
      "id_internal": "HSV-1-001",            // links to items.json source
      "kapitola": "HSV-1",
      "kod_soupis": "131201101",             // KROS code (Tier 1) or HK212-Z-001 (Tier 2)
      "popis": "Hloubení figury pod desku..." ,
      "mj": "m³",
      "mnozstvi": 210.0,
      "j_cena": null,                        // ceny prázdné
      "cena_celkem": null,
      "kros_code": "131201101",
      "kros_match_confidence": 0.85,
      "kros_match_method": "fts_bm25_strong_mj_trida",
      "kros_candidates_top3": [ /* top 3 KROS candidates */ ],
      "tier": 1,
      "_custom_position": false,
      "_reference_kros_code": null,          // (only for Tier 2)
      "_custom_reason": null,                // (only for Tier 2)
      "items_json_confidence": 0.75,
      "review_flags": [],
      "vyjasneni_ref": ["ABMV_22"],
      "audit_trail_ref": "items_hk212_etap1.json :: HSV-1-001",
      "source": "A201_vykopy + A105_zaklady + user zone-by-zone"
    }
  ],
  "abmv_unresolved": [ /* 12 ABMV entries */ ]
}
```

---

## 5. Acceptance criteria (§8) — verified

| Criterion | Target | Actual | Status |
|---|---|---|---|
| Tier 1 KROS match ≥ 60 % | ≥ 60 % | 61.7 % | ✅ MET |
| Tier 2 flagged with nearest KROS ref | ~40 % with ref | 49 items, 47 with ref | ✅ MET |
| Excel renders 13 sheets | 13 (or 12 if PDF dropped) | 13 sheets | ✅ MET |
| 128 items distributed | 128 | 128 | ✅ MET |
| Rekapitulace sums match detail | totals consistent | 79+49=128 ✓ | ✅ MET |
| Confidence highlighting visible | yellow + red | implemented | ✅ MET |
| JSON twin preserves audit_trail | full audit_trail_ref | audit_trail_ref field per item | ✅ MET |
| ABMV unresolved listed | all formats | sheet 13 + JSON + this doc | ✅ MET |
| items.json UNMODIFIED | no mutation | git diff vs prior branch = 0 lines | ✅ MET |
| PDF rekapitulace | dropped (reportlab missing) | flagged in handoff | ⚠ DROPPED |

---

## 6. Top 5 nejistot pro investor SOLAR DISPOREC review

Ranked by impact on tender pricing + technical clarity:

### 6.1 🔴 **ABMV_3 (critical, open)** — Stroje DRIFT_E1 / DEFRAME / FILTRACE specifikace
- **What's missing:** výrobce/typ, hmotnost, požadované kotvy, přívody médií, dodávka investorem ano/ne
- **Impact:** anchorage VV (HSV-2 chemická kotva + lokální výztuž desky PSV-77x-003) +
  EL příkon (~budoucí D.1.4) + VRN (manipulace s stroji)
- **Cost magnitude:** **HIGH** (anchorage + EL + scope ambiguity)
- **Owner:** projektant Volka + investor SOLAR DISPOREC technical lead
- **Workaround current bid:** anchorage included as PSV-77x-003 (30 m² lokální zesílení); EL deferred per ABMV_12

### 6.2 🔴 **ABMV_19 (critical, open)** — Plochy stavby 3-source drift
- **What's conflicting:**
  - TZ A: Sz=540.10 m², podl.=495 m², ob.=3694.62 m³
  - TZ B: Sz=520 m², podl.=507 m², ob.=2833 m³
  - TZ D.1.1: Sz=541 m², podl.=495 m², ob.=3404 m³
  - PBR: Sz=520 m²
  - Step 3 measured: Sz=538.5 m²
  - A105 deska: 531.22 m² (measured)
- **Impact:** VRN poplatky (vyjmutí ze ZPF), obestavěný prostor pro DPZ, deska scope
- **Cost magnitude:** **MEDIUM** (VRN + soft DPZ verifikace)
- **Owner:** projektant Volka pro DPZ vyjasnění
- **Workaround current bid:** items.json uses Step 3 538.5 m² for výkop figura + A105 531.22 m² for deska scope

### 6.3 🟡 **ABMV_5 (important, needs_design_clarification)** — Beton třída desky 2:2 split
- **What's conflicting:**
  - A101 legend + A105 legend = **C30/37-XC2** (2 drawings)
  - TZ ARS D.1.1 + TZ statika D.1.2 = **C25/30 XC4** (2 TZ documents)
- **Impact:** HSV-2-013 deska 106.24 m³ — cena beton C30/37 ≈ +10–15 % vs C25/30
- **Cost magnitude:** **MEDIUM** (~10-15 tis CZK na desku)
- **Owner:** projektant Volka + statika Plachý/Doležal — vyjasnění intent
- **Workaround current bid:** items.json HSV-2-013 retains C25/30 XC4 (statika authority) + `_review_concrete_class` flag visible in Excel

### 6.4 🟡 **ABMV_1 (resolved_with_caveats)** — Topení 21 ks (PBR) vs 40 ks (DXF Stage C)
- **What's conflicting:**
  - PBR p.5: 21× sálavá stropní 1.2 kW + 4× nástěnná 9 kW = **61.2 kW**
  - DXF UT_HALAHK_DPS: 40× FENIX ECOSUN_S+_12 + 4× DALAP E-HP_9kW = **84 kW**
  - 19 ks ghost reading
- **Impact:** EL příkon dimenzování (rozvaděč + přívodní kabel)
- **Cost magnitude:** **MEDIUM** (EL pendingdle D.1.4, mimo HSV scope this commit)
- **Owner:** projektant + EL koordinátor (D.1.4 missing per ABMV_12)
- **Workaround current bid:** No EL items in this soupis (D.1.4 missing, intentional Stage D)

### 6.5 🟡 **ABMV_22 (minor, open)** — A201 BILANCE ZEMINY placeholder unfilled
- **What's missing:** A201 paperspace má label "BILANCE ZEMINY:" ale žádné vyplněné hodnoty
- **Impact:** HSV-1 výkop 210 m³ je user zone-by-zone estimate (± 15 %); odvoz + skládkovné scope
- **Cost magnitude:** **LOW-MEDIUM** (typically 80-150 tis Kč na úseku 25–50 m³ precision)
- **Owner:** projektant — vyplnit bilanci v A201 nebo DXF polygon scan
- **Workaround current bid:** 210 m³ user analysis = bid-stage acceptable; ABMV_22 flags for final precision

### Carry-forward important (less critical, but should resolve):
- **ABMV_6** EW 15 DP1 vs EW 15 DP3 (PBŘ wins) — working_assumption holds
- **ABMV_7** plochy duplicate of ABMV_19
- **ABMV_8** oplocení strojů (BUDE UPŘESNĚNO per A106)
- **ABMV_9** umyvadlo v hale ZTI vnitřní rozsah
- **ABMV_10** stěrka epoxid vs PU (working_assumption holds)
- **ABMV_12** TZB D.1.4 missing (VZT + ZTI + EL koncepčně only)
- **ABMV_20** Lindab svody 3 vs 4 (A101 vs TZ B) — working_assumption 4

---

## 7. Recommended next steps

### Immediate (before tender submission)
1. **Resolve 3 critical ABMV** (3, 19, 5) — block tender submission until clarified
2. **Cena fill workflow** — separate task, investor-side OR projektant-přípravář:
   - Manual fill J.cena column in XLSX per kapitola
   - OR import KROS vintage 2026 prices via separate script
   - OR competitive vendor RFQ on top 10 highest-value items
3. **Vendor RFQ ready** — Kingspan ČR (Hradec Králové závod), Lindab CZ, statika office

### Bid-stage refinements
4. **KROS vintage filter** — currently mix of 2018 + 2026 codes. Re-run Phase B with vintage_year=2026 filter for tender-ready prices.
5. **HSV-3 mass reconciliation** (deferred from prior session) — PROFILY DXF geometry to resolve IPE 160 vaznice +11.4 % mass drift.
6. **Klempíř lemy detail** — PSV-OPL-005 207 bm + PSV-78x atika 95 bm both flagged `_review_qty`. Need klempíř výkaz from projektant.

### Post-tender (after award)
7. **Pilot variant decision** — HSV-2-010..012 flagged `alternative_variant_per_IGP_not_required`. If selected zhotovitel encounters skutečné podmínky, pilota option per A105 note may activate.
8. **Phase 2.1 audit_trail detail** — expand per-item formula traceability (currently audit_trail_ref points to items.json).
9. **Stage E benchmark** — vs example_vv corpus full fuzzy comparison (not in this scope).

### Out-of-scope (for next session, NOT now)
- PDF rekapitulace (reportlab missing in env — separate dep install or skip)
- F-2 ABMV_1 PBR vs DXF energy bilance re-open
- UNIXML KROS export (separate format, future)

---

## 8. Phase summary commits

| Commit | Phase | Scope |
|---|---|---|
| (prior) | F-1..F-5 + IGP + Kingspan + patky | items.json mutations (28→128 items, all ABMV closures from prior sessions) |
| `[Phase A]` | preflight | KROS DB inventory + example_vv survey + items.json census |
| `[Phase B]` | matching | FTS5 KROS lookup, 79/128 Tier 1, MJ equivalence classes |
| `[Phase C]` | outputs | enriched JSON + 13-sheet XLSX |
| `[Phase D]` | handoff | this doc |

---

## 9. Environment notes

| Lib | Status | Impact |
|---|---|---|
| `openpyxl` | ✅ Available | XLSX read/write working |
| `xlrd 2.0.2` | ✅ Available | old .xls reference parsing (not used in final deliverable) |
| `sqlite3` | ✅ stdlib | KROS DB queries |
| `pandas` | ❌ Missing | Worked around with openpyxl + sqlite directly |
| `reportlab` | ❌ Missing | **PDF rekapitulace dropped** from §5 — flagged as P3 follow-up |

---

## 10. Final verdict

🟡 **YELLOW — bid-stage usable, 3 critical ABMV require resolution before formal tender submission.**

Soupis prací is technically complete (128 items, all kapitoly covered, KROS matching at 61.7 % Tier 1 = above acceptance threshold). Custom Tier 2 items have nearest-KROS reference codes for tender reviewer context. ABMV queue is structured for projektant review.

**Greenlight conditions:**
1. ✅ ABMV_3 resolved (stroje specs from investor)
2. ✅ ABMV_19 resolved (zastavěná plocha — projektant DPZ vyjasnění)
3. ✅ ABMV_5 resolved (beton class — projektant + statika decision)
4. ✅ Cena fill workflow completed (separate task)

After 1-4 → submit to SOLAR DISPOREC for tender review.

---

**End of handoff.**
