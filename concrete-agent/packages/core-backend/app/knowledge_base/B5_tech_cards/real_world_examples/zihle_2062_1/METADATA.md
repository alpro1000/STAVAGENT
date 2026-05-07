# Žihle 2062-1 — Real-world pilot reference

**KB path:** `B5_tech_cards/real_world_examples/zihle_2062_1/`
**Source artefakty:** `test-data/most-2062-1-zihle/` (full pilot directory)
**Status:** Reference template pre future mostovy projekty.

## Project metadata

| Field | Value |
|---|---|
| Název stavby | Most ev.č. 2062-1 u obce Žihle, přestavba |
| **Project type** | mostovy (silnice III/206 2 mostek přes Mladotický potok) |
| **Project size** | 10 585 736 Kč bez DPH (Session 3) → 12 201 523 Kč (Session 4 retrofit) |
| Project size with DPH 21 % | 14 763 843 Kč (Session 4) |
| **Doba realizace** | 11 měsíců (Phase C scheduler 319 dní + reserve) |
| Délka mostu | 9 m rozpětí, 8.30 m šířka NK |
| Šikmost | 50° |
| Konstrukční systém | Integrální rámový most (per ZD §4.4.l ban na samostatná křídla) |
| Lokace | obec Žihle, okres Plzeň-sever, k.ú. Žihle + Přehořov u Žihle |
| Investor | SÚSPK (Správa a údržba silnic Plzeňského kraje, p.o.) |
| **Tendr forma** | D&B (Design & Build) |
| **Tendr deadline** | 2026-07-02 10:00 (ZD §26.1) |
| ZD limit | 30 000 000 Kč s DPH |
| **vs ZD limit** | **49.2 %** s DPH (Session 4) — margin 15.24 M Kč |

## Master soupis breakdown (per SO objekt)

| SO | Název | Položek | Kč bez DPH | Podíl |
|---|---|---:|---:|---:|
| SO 001 | Demolice + odvozy | 30 | 1 057 831 | 8.7 % |
| SO 180 | Mostní provizorium + objízdná trasa | 26 | 2 047 138 | 16.8 % |
| SO 201 | Most ev.č. 2062-1 (5 částí t0+t1_t2+t3_t4+t5_t6_t7+t8_t9) | 72 | 4 435 958 | 36.4 % |
| SO 290 | Silnice III/206 2 (návaznosti) | 12 | 1 952 470 | 16.0 % |
| SO 801 | Zařízení staveniště (Kfely benchmark) | 25 | 1 204 854 | 9.9 % |
| PRESUN_HMOT | Přesun hmot | 3 | 560 000 | 4.6 % |
| VRN | Vedlejší rozpočtové náklady | 13 | 943 272 | 7.7 % |
| **TOTAL** | | **181** | **12 201 523** | **100 %** |

## ZS+PH+VRN poměr

**22.2 %** z hlavních prací (2 708 126 / 12 201 523).
Within Pattern A "small long-duration mostovy" 22-28 % range (per `../../ZS_templates/PATTERNS.md`).

## Project type classification

| Aspect | Žihle | Pattern match |
|---|---|---|
| Type | mostovy III. třídy | mostovy benchmark = Kfely I/20 |
| Size class | small (< 20 M) | Pattern A: small + long-duration → 22-28 % ZS |
| Location | venkov / obec | Pattern D: grid primary + generator záložní |
| Duration | 11 měs (long for size) | Pattern A: high ZS poměr expected |
| Risk density | mostovy + Mladotický potok | Pattern B: BOZP 80k mostovy benchmark |

**Closest peer benchmark:** Kfely I/20 2022 (`../../ZS_templates/mostovy/Kfely_I_20_2022/`).

## Success status

| Phase | Status | Notes |
|---|---|---|
| Phase A — Extraction | ✅ COMPLETE | 4 YAML files (HPM, ZD, site_conditions, stavajici_most) |
| Phase B — Design | ✅ COMPLETE | varianta_01_integralni_ram + element_breakdown + concrete_classes + formwork_choice + provizorium_specs |
| Phase C — Calculator | ✅ COMPLETE | 11 elementů × 2 položky = 22 calculator-deterministic mnozstvi |
| Phase D — Master soupis | ✅ COMPLETE | 181 položek, 100 % audit-trail coverage, UNIXML 1.2 KROS + XLSX 11-col |
| Phase E — Engineering drawings | ⛔ DROPPED | Per ADR-005 — projektant scope, not STAVAGENT |
| TZ DUR | ✅ COMPLETE | B.1.3 + B.8 sections updated (Session 2) |
| `metadata.yaml` status | ✅ `tender_ready` | Outstanding: Povodí Vltavy souhlas (P0) |

**Overall:** First end-to-end production-shaped pilot. Tender-ready demonstration
without real submission (sandbox project per `not_for_delivery: true`).

## Outstanding flags pre real DUR

1. **P0 — Povodí Vltavy souhlas MISSING** (parcels 1836+385/13 — Mladotický potok).
   Blocks SO 001 T9-09/10 + SO 201 T4-08/T9-18 (cca 173 365 Kč scope). D&B zhotovitel
   získá vodoprávní souhlas před DUR řízením.
2. **P1 — SPÚ vyjádření** (parcel 385/11). Standardní postup po DUR — ne blocker.
3. **P1 — Souhlas obce Žihle bez data** — administrativní fix.
4. **Vendor RFQ before tender** — D6+Kfely unit prices = 2022-2023, vendor RFQ pre real
   2026 prices recommended.

## Cross-references in this KB entry

- `master_soupis_summary.yaml` — consolidated soupis stats + audit trail samples
- `reconciliation_findings.md` — 4 system gaps G1-G4 (calculator improvement backlog)
- `vendor_pricing_snapshot.yaml` — 6 vendor sources (anonymized)
- `patterns_validated.md` — which of 7 STAVAGENT patterns proven by Žihle

## Source-of-truth artefakty (sandbox project)

```
test-data/most-2062-1-zihle/
├── metadata.yaml                            (status: tender_ready)
├── 00_PROJECT_SUMMARY.md
├── 01_extraction/                           (Phase A YAMLs)
├── 02_design/                               (Phase B element_breakdown.yaml etc.)
├── 03_calculation/outputs/                  (Phase C 11 calc-deterministic JSONs)
├── 04_documentation/
│   ├── master_soupis/                       (10 per-SO/per-třída YAML files +
│   │                                          master_soupis.yaml index +
│   │                                          validation_report.md +
│   │                                          soupis_praci_FINAL.{xml,xlsx})
│   ├── kadastr_audit/                       (DXF extracted + parcels + souhlasy)
│   ├── manual_reference_JS/                 (user manual SO_180+201 parsed YAMLs)
│   ├── vendor_pricing/                      (vendor_quotes.yaml — 6 vendorů)
│   ├── reconciliation_report.md
│   ├── výkresy/                             (Phase E SVG + PNG, retained as validation tool)
│   └── TZ_DUR_zihle_2062-1.md
├── backlog/                                 (G1-G4 backlog tickets)
├── build_master_soupis.py                   (aggregator)
└── build_situace_svg.py                     (Phase E validation tool)
```
