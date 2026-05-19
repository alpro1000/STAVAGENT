# Completeness Audit v2 — RD Jáchymov

**Generated:** 2026-05-19
**Items:** 189 | **Rooms:** 25 | **Sections:** A–J (10)

> Tato kontrola dělá strukturovaný sweep po 10 osách. Cíl: poskytnout worksheet kde
> uživatel vidí potenciální mezery. Není garance úplnosti.

## Consolidated gap list (sorted by severity)

**Severity breakdown:** important=7 · medium=1

| ID | Sev | Description | Fix action | Source |
|---|---|---|---|---|
| GAP_002 | 🟧 important | Anchor D06 Demontáž oken + dveří — no items match keywords | Verify in TZ; add item or refine search keywords if false-positive | C.Anchor |
| GAP_003 | 🟧 important | Anchor R08 Energie staveniště — no items match keywords | Verify in TZ; add item or refine search keywords if false-positive | C.Anchor |
| GAP_004 | 🟧 important | Cross-element chain 'okna' — ISSUES: oplechování parapetů items=0 (může být v klempířina a | Reconcile okna counts/quantities across items vs DXF baseline | G.okna |
| GAP_005 | 🟧 important | Cross-element chain 'sanit' — ISSUES: sanit items=15 vs DXF≈21 (Δ 29%) | Reconcile sanit counts/quantities across items vs DXF baseline | G.sanit |
| GAP_006 | 🟧 important | Material balance 'podlahy' — GAP 20% | Reconcile m² totals across items in podlahy | H.podlahy |
| GAP_007 | 🟧 important | Material balance 'steny_vnitrni' — ISSUE — výmalba+obklad 1477 vs omítka 958 (Δ 54%) | Reconcile m² totals across items in steny_vnitrni | H.steny_vnitrni |
| GAP_008 | 🟧 important | TZ deep anchor J12 TZ PBŘ — fire-rated dveře (PSV-76) — TZ mentions but items don't | Add corresponding item OR verify it's collapsed in aggregate | J.J12 |
| GAP_001 | 🟨 medium | TKP 8 (Trubní vedení (kanalizace venkovní, vodovod venkovní)) — žádné položky | Verify TZ for Trubní vedení (kanalizace venkovní, vodovod venkovní) need; if app | A.TKP |

---

## Section E — Per-podlaží matrix (4 × 7)

| Podlaží | podlaha | soklíky | omítka | výmalba | strop | svítidla | topení |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **1.PP** | ✓ | ⚪ | ✓ | ⚠ | ⚪ | ⚠ | ⚪ |
| **1.NP** | ✓ | ⚠ | ✓ | ✓ | ✓ | ⚠ | ⚠ |
| **2.NP** | ✓ | ⚠ | ✓ | ✓ | ✓ | ⚠ | ⚠ |
| **3.NP** | ✓ | ⚠ | ✓ | ✓ | ✓ | ⚠ | ✓ |

---

## Section F — Per-room matrix (25 × 9)

Legend: ✓=hit | flr=covered_at_floor_level | glb=covered_globally | ⚪=N/A | ❌=GAP

| Room | Typ | Podl | pod | sok | om | vým | obkl | dv | okno | strop | top |
|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1.01 vstup a chodba | chodba | 1.NP | flr | glb | flr | flr | ⚪ | flr | ⚪ | flr | ⚪ |
| 1.02 chodba na zahradu | chodba | 1.NP | flr | glb | flr | flr | ⚪ | flr | ⚪ | flr | ⚪ |
| 1.03 komora | komora | 1.NP | ✓ | glb | flr | flr | ⚪ | flr | ⚪ | flr | ⚪ |
| 1.04 WC | wc | 1.NP | ✓ | ✓ | flr | flr | flr | flr | flr | flr | flr |
| 1.05 koupelna | koupelna | 1.NP | flr | glb | flr | flr | ✓ | flr | flr | flr | flr |
| 1.06 obývací místnost + | kuchyne | 1.NP | flr | glb | flr | flr | flr | flr | flr | flr | flr |
| 1.07 pokoj | obytna | 1.NP | flr | glb | flr | flr | ⚪ | flr | flr | flr | flr |
| 1.08 schodiště do sklep | sklep | 1.NP | flr | ⚪ | flr | flr | ⚪ | flr | flr | ⚪ | ⚪ |
| 3.01 schodiště | schodist | 3.NP | ✓ | glb | flr | flr | ⚪ | glb | ⚪ | flr | ⚪ |
| 3.02 chodba | chodba | 3.NP | ✓ | glb | flr | flr | ⚪ | glb | ⚪ | flr | ⚪ |
| 3.03 chodba | chodba | 3.NP | ✓ | glb | flr | flr | ⚪ | glb | ⚪ | flr | ⚪ |
| 3.04 koupelna | koupelna | 3.NP | flr | glb | flr | flr | ✓ | glb | flr | flr | flr |
| 3.05 obývací místnost a | kuchyne | 3.NP | flr | glb | flr | flr | flr | glb | flr | flr | flr |
| 3.06 ložnice | obytna | 3.NP | ✓ | glb | flr | flr | ⚪ | glb | flr | flr | flr |
| 0.01 schodiště | schodist | 1.PP | ✓ | flr | flr | glb | ⚪ | glb | ⚪ | glb | ⚪ |
| 0.02 chodba | chodba | 1.PP | ✓ | flr | flr | glb | ⚪ | glb | ⚪ | glb | ⚪ |
| 0.03 sklep 1 | sklep | 1.PP | ✓ | ⚪ | flr | glb | ⚪ | glb | glb | ⚪ | ⚪ |
| 0.04 sklep 2 | sklep | 1.PP | flr | ⚪ | flr | glb | ⚪ | glb | glb | ⚪ | ⚪ |
| 2.01 schodiště | schodist | 2.NP | ✓ | glb | flr | flr | ⚪ | flr | ⚪ | flr | ⚪ |
| 2.02 chodba | chodba | 2.NP | ✓ | glb | flr | flr | ⚪ | flr | ⚪ | flr | ⚪ |
| 2.03 koupelna | koupelna | 2.NP | flr | glb | flr | flr | ✓ | flr | flr | flr | flr |
| 2.04 chodba | chodba | 2.NP | ✓ | glb | flr | flr | ⚪ | flr | ⚪ | flr | ⚪ |
| 2.05 společný pokoj | obytna | 2.NP | flr | glb | flr | flr | ⚪ | flr | flr | flr | flr |
| 2.06 pokoj | obytna | 2.NP | flr | glb | flr | flr | ⚪ | flr | flr | flr | flr |
| 2.07 pokoj | obytna | 2.NP | flr | glb | flr | flr | ⚪ | flr | flr | flr | flr |

---

## Section G — Cross-element consistency (4 chains)

### G.okna

**Verdict:** ISSUES: oplechování parapetů items=0 (může být v klempířina aggregate)

- `dxf_count` = `16`
- `okna_items_ks_sum` = `0`
- `parapety_items_ks_sum` = `0`
- `parapety_items_bm_sum` = `20.8`
- `parapety_has_any_items` = `True`
- `spalety_bm` = `82.2`
- `spalety_expected_bm` = `80.0`
- `oplech_parapetu_ks` = `0`

### G.dvere

**Verdict:** OK

- `dxf_vnitrni_count` = `15`
- `dxf_vstupni_count` = `2`
- `dxf_total_expected` = `17`
- `dvere_items_ks_sum` = `18`
- `zarubn_items_ks_sum` = `16`
- `kovani_items_ks_sum` = `0`

### G.krokve

**Verdict:** OK

- `dxf_krokve_blocks_count` = `103`
- `krokve_bm_sum` = `156.0`
- `klestiny_bm_sum` = `110.0`
- `pozednice_bm_sum` = `19.4`
- `hea_items_qty_sum` = `1929.0`
- _note: KR INSERT count is gross (incl sloupky + námětky); geometric calc primary per items.json_

### G.sanit

**Verdict:** ISSUES: sanit items=15 vs DXF≈21 (Δ 29%)

- `dxf_sanit_count` = `{'wc': 7, 'umyvadlo': 7, 'vana': 2, 'sprcha': 2, 'drez_kuchyne': 3}`
- `dxf_drez_count` = `0`
- `dxf_total_fixtures` = `21`
- `sanit_items_ks_sum` = `15`
- `baterie_items_ks_sum` = `15`
- `rozvody_voda_bm` = `0`

---

## Section H — Material balance (3 categories)

### H.podlahy

**Verdict:** GAP 20%

- `per_material` = `{'vinyl': 171.5, 'dlazba': 67.109, 'biodeska': 25.0, 'ostatní': 0}`
- `total_m2` = `263.609`
- `tz_baseline_m2` = `219.3`
- `delta_pct` = `20.204742362061086`

### H.fasada_etics

**Verdict:** OK

- `per_kategorie_m2` = `{'priprava': 276.7, 'eps_hlavni': 276.7, 'omitka': 290.2, 'spalety': 0, 'sokl': 13.5, 'profilace': 0}`

### H.steny_vnitrni

**Verdict:** ISSUE — výmalba+obklad 1477 vs omítka 958 (Δ 54%)

- `omitka_m2` = `957.5`
- `vymalba_m2` = `763.0`
- `obklad_m2` = `714.3`
- `vymalba_plus_obklad_m2` = `1477.3`
- `delta_pct` = `54.287206266318535`

---

## Section I — Cost ratio sanity (Methvin estimates)

**Total estimate:** 0 Kč (ballpark)

| Gate | Estimate Kč | % of total | Typical range | Verdict |
|---|--:|--:|---|---|
| HSV | 48,793,794 | 76.7% | 45–55% | OUT OF RANGE (typical 45-55%) |
| PSV | 9,330,707 | 14.7% | 25–35% | OUT OF RANGE (typical 25-35%) |
| TZB | 2,436,000 | 3.8% | 15–20% | OUT OF RANGE (typical 15-20%) |
| VRN | 3,087,000 | 4.9% | 5–10% | OUT OF RANGE (typical 5-10%) |

---

## Section J — TZ deep scan (18 anchors)

| ID | Sev | Description | TZ ks | Items? | Verdict |
|---|---|---|--:|:--:|---|
| J01 | important | TZ statika — IPE profily (počet jednotek) | 1 | ✓ | OK |
| J02 | important | TZ statika — HEA profily | 3 | ✓ | OK |
| J03 | important | TZ statika — IPN profily | 1 | ✓ | OK |
| J04 | important | TZ statika — jekl uzavřený profil | 1 | ✓ | OK |
| J05 | important | TZ B m.10.e — bilance odpadů (kategorie t) | 0 | ⚪ | TZ_silent |
| J06 | important | TZ ARS — komínové těleso (zachované / nové) | 2 | ✓ | OK |
| J07 | important | TZ ARS — vikýře (počet, materiál) | 2 | ✓ | OK |
| J08 | important | TZ ARS — opěrná stěna / bílá vana | 5 | ✓ | OK |
| J09 | important | TZ ARS — anglický dvorek | 2 | ✓ | OK |
| J10 | important | TZ ARS — terasa (materiál) | 2 | ✓ | OK |
| J11 | important | TZ PBŘ — detekce kouře (PSV-95) | 1 | ✓ | OK |
| J12 | important | TZ PBŘ — fire-rated dveře (PSV-76) | 4 | ❌ | GAP — mentioned in TZ but no items match |
| J13 | important | TZ ARS — tepelné čerpadlo (PSV-73) | 3 | ✓ | OK |
| J14 | medium | TZ ARS — elektrokotel / kotel | 2 | ✓ | OK |
| J15 | medium | TZ ARS — krb (PSV-73) | 2 | ✓ | OK |
| J16 | medium | TZ ARS — kamna (PSV-73) | 1 | ✓ | OK |
| J17 | medium | TZ ARS — žaluzie (PSV-76) | 1 | ✓ | OK |
| J18 | informational | TZ ARS — geodet vytýčení | 0 | ⚪ | TZ_silent |

---

## Sections A–D — see also v1 audit (outputs/items_completeness_report.md)

- A. TKP coverage: 9 of 10 families
- B. Subdodavatel: 36 of 36 trades
- C. RD anchors: 64 ok / 2 missing / 1 N/A
- D. TZ verb scan: deprioritized — see v1 (high noise)