# Phase 3e Quality Scorecard — osazení + speciální + úklid + VRN + border-zone

**Generated:** Phase 3e step 3 (final)  
**Branch:** `claude/phase-0-5-batch-and-parser`  
**Items:** `items_phase_3e_osazeni_specialni_uklid_vrn.json` (121,129 bytes)  

## Critical findings (PERSISTENT — surface in EVERY scorecard)

### CRITICAL — 0.7 step 4 PROBE 1

**Summary:** starý VV missing ~2000 m² of cement screed: 4 objekty × ~930 m² floor each → komplex screed ≈ 3000 m², VV reports only 1058 m². Confirms customer's complaint that the VV is incomplete.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit

### CRITICAL — 3a — PSV-781 obklady

**Summary:** starý VV reports only 43 m² hydroizolace pod obklad komplex; F06 ground truth across komplex ~283 m² (D-side ≈ 71 m² for koupelny F06). Gap of ~240 m² komplex hydroizolace under F06 obklad. Persistuje až do Phase 5.

**Next action:** catalogue as VYNECHANE_KRITICKE in Phase 5 audit; verify F06 wall area against Tabulka skladeb step (F06 = obklad keramický + skladba pod ním uvedena samostatně)
**Parser D-side estimate:** 325.76 m²

## Items per category (A-G)

| Category | Items |
|---|---:|
| A — osazení oken | 33 |
| B — osazení dveří | 117 |
| C — speciální dveře | 10 |
| D — stavební úklid | 10 |
| E — border-zone | 7 |
| F — Libuše specifika | 14 |
| G — VRN structure | 11 |
| **Total Phase 3e** | **202** |

## Items per kapitola

| Kapitola | Items | MJ totals |
|---|---:|---|
| `HSV-622` | 2 | 150.0 m · 30.0 ks |
| `HSV-642` | 84 | 514.0 ks · 2172.0 m |
| `HSV-643` | 2 | 12.0 ks |
| `HSV-962` | 1 | 30.0 ks |
| `HSV-998` | 2 | 150.0 m · 200.0 ks |
| `PSV-764` | 2 | 93.0 m |
| `PSV-766` | 31 | 1089.2 m |
| `PSV-767` | 40 | 314.0 ks · 1.0 sady · 1.0 kpl |
| `PSV-768` | 11 | 73.0 ks |
| `PSV-771` | 4 | 10.0 m2 · 76.0 m |
| `PSV-784` | 2 | 92.0 m2 · 60.0 m |
| `PSV-952` | 10 | 6672.4 m2 · 16.0 ks · 8.0 m3 · 40.0 h |
| `VRN-010` | 1 | 100.0 m2 |
| `VRN-011` | 1 | 1.0 kpl |
| `VRN-014` | 2 | 4.0 měs · 1.0 kpl |
| `VRN-016` | 2 | 24.0 h |
| `VRN-017` | 3 | 208.0 h |
| `VRN-026` | 1 | 0.5 % |
| `VRN-027` | 1 | 1.5 % |

## Status distribution

| Status | Count |
|---|---:|
| `to_audit` | 184 |
| `to_be_negotiated_with_investor` | 11 |
| `subcontractor_required` | 5 |
| `to_be_clarified_with_collegues` | 2 |

## Category distribution

| Category | Count |
|---|---:|
| `subcontractor_required` | 191 |
| `general_site_overhead` | 11 |

## ⚠️ Border-zone items (to_be_clarified_with_collegues)

**2 items** waiting on user discussion with elektro/VZT/ZTI collegues.

| Kapitola | Popis | MJ × množství |
|---|---|---|
| `HSV-998` | Vyboření drážek pro elektroinstalace v stěnách | 150 m |
| `HSV-962` | Vrtání prostupů pro potrubí ZTI/VZT (cca 30 prostupů) | 30 ks |

## VRN structure overview (CATEGORY G)

**11 VRN items** marked status='to_be_negotiated_with_investor'.

| VRN code | Popis | MJ × množství |
|---|---|---|
| `VRN-010` | Zpevnění příjezdových ploch dočasné (informativní) | 100 m2 |
| `VRN-011` | Zařízení staveniště — REFERENCE na Phase 3d PSV-925 | 1 kpl |
| `VRN-014` | Koordinátor BOZP × 4 měsíce | 4 měs |
| `VRN-014` | BOZP vybavení staveniště (cedule, výstražné pásky, hasicí přístroje) | 1 kpl |
| `VRN-016` | Vytyčení dokončovacích prací (omezené) | 16 h |
| `VRN-016` | Kontrolní geodetická měření při předání | 8 h |
| `VRN-017` | Autorský dozor projektanta × 4 měs | 64 h |
| `VRN-017` | Technický dozor investora × 4 měs | 128 h |
| `VRN-017` | Koordinace s BOZP | 16 h |
| `VRN-026` | Pojištění odpovědnosti zhotovitele (% z ceny) | 0.5 % |
| `VRN-027` | Záruční rezerva na opravy (% z ceny) | 1.5 % |

**Note**: VRN-011 zařízení staveniště je REFERENCE na Phase 3d PSV-925 — not a duplicate. Phase 3d items remain as the source of truth; VRN-011 marker tells the audit/excel that overhead pool is consolidated there.

## Coverage metrics

- Door osazení items per D## type: **117** (covers all 14 D-codes from Phase 1 aggregate)
- Window osazení items per W## type: **25** (covers all 5 W-codes from Phase 1 aggregate)
- Border-zone items: **2** (require user clarification)
- VRN items: **11** (negotiate with investor)

## Cumulative state — items_objekt_D_complete.json

- **Total items: 2277**

| Source | Items |
|---|---:|
| `items_phase_3a_vnitrni.json` | 1425 |
| `items_phase_3b_vnejsi_a_suteren.json` | 104 |
| `items_phase_3c_sdk.json` | 358 |
| `items_phase_3c_truhl_zamec.json` | 76 |
| `items_phase_3c_detaily.json` | 87 |
| `items_phase_3d_leseni_pomocne.json` | 25 |
| `items_phase_3e_osazeni_specialni_uklid_vrn.json` | 202 |
| **Total** | **2277** |

## Acceptance

- Items count ≥ 150: **202** ✅
- All 7 categories present (A-G): **7** ✅
- Border-zone items flagged: **2** ⚠️

### ✅ READY FOR PHASE 5 (audit + diff against starý VV)

## Action items for user before Phase 5

1. **Border-zone clarifications** (2 items): vyjasnit s collegues elektro/VZT/ZTI which side does (a) vyboření drážek, (b) prostupy, (c) lokální oprava povrchů. Update item.status from 'to_be_clarified_with_collegues' to either 'subcontractor_required' or 'remove_out_of_scope'.
2. **VRN negotiation** (11 items): potvrdit s investorem (a) TDI hodiny — typicky platí investor; (b) overlap with Phase 3d PSV-925; (c) % values for pojištění + záruční rezerva.
3. **Vstupní dveře type code** (Phase 3e B): heuristic D11 = entry. Verify against Tabulka dveří popisem a počet vstupních dveří per byt.
4. **Garážová vrata + protipožární vrata count**: 1 garage + 2 fire doors estimate. Verify against TZ + 1.PP DXF layout.

## Phase 5 inputs ready

- `items_objekt_D_complete.json` — **2277 items** with full popis, MJ, množství, místo, skladba_ref, category, status.
- Carry-forward critical findings (PROBE 1 cement screed + PROBE 2 hydroizolace pod obklad) must be CATALOGUED as VYNECHANE_KRITICKE in Phase 5 audit_report.md.
- Border-zone + VRN items will surface in Phase 5 as 'NEEDS_USER_DECISION' rows for the audit report.