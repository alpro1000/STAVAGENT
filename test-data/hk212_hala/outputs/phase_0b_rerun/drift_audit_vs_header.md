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