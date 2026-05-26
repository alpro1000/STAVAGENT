# HK212 Stage D Audit — applied 2026-05-22T05:20:38.384026+00:00
## Items.json items_hk212_etap1.json
- Initial item count: **141**
- Final item count: **119** (Δ −22)
- New URS status counts: `{'matched_medium': 33, 'needs_review': 82, 'matched_high': 4}`
- New high+medium match rate: **0.3109**

### Dropped items (out-of-scope per Phase 0b §5 + Task §3)

| ID | kapitola | popis |
|---|---|---|
| Rpol-001 | M | Chemická kotva M20 × 200 mm pro anchorage strojů (DRIFT_E1, DEFRAME, filtrační) |
| Rpol-002 | M | Lokální výztuž desky pod stroji — B500B vázaná, dopl. nad rámec KARI |
| Rpol-003 | M | Beton lokálního zesílení podlahy pod stroji C25/30 XC4 |
| Rpol-004 | M | Bezpečnostní oplocení strojů — Troax-type, výška 2.2 m, mřížová síť, panely modulární |
| Rpol-005 | M | Montáž bezp. oplocení + sloupky kotvené do podlahy + branka pro přístup |
| Rpol-006 | M | Bezpečnostní tabulky + značení — výstrahy, zákazy, BOZP piktogramy |
| Rpol-007 | M | El. připojení strojů — kabel CYKY × přívody + průchodky podlahou |
| VZT-001 | VZT | Rekuperační jednotka venkovní 4000 m³/h s deskovým rekuperátorem + el. ohřev + přímý výparník |
| VZT-002 | VZT | Venkovní kondenzační jednotka chlazení 15 kW pro přímý výparník |
| VZT-003 | VZT | Dveřní clona horizontální 4700 m³/h, š. 2 m, s el. ohřevem |
| VZT-004 | VZT | Potrubí SPIRO pozink Ø 315 mm — hlavní rozvod |
| VZT-005 | VZT | Potrubí SPIRO pozink Ø 250 mm — větve |
| VZT-006 | VZT | Potrubí SPIRO pozink Ø 160 mm — koncové úseky + napojení clon |
| VZT-007 | VZT | Tlumiče hluku v potrubí — kruhové, vč. připojovacích manžet |
| VZT-008 | VZT | Tepelná izolace VZT potrubí — kaučuková tl. 13 mm, parotěsná |
| VZT-009 | VZT | Antivibrační pružná uložení rekuperace + manžety na přípojkách |
| VZT-010 | VZT | Automatická regulace VZT s MaR (měření a regulace) — řízení rekuperace + clon |
| VZT-011 | VZT | Dálkové ovládání + napojení na centrální řízení haly |
| VZT-012 | VZT | Závěsy + příchytky potrubí SPIRO — komplet pro celý rozvod |
| VZT-013 | VZT | Spuštění + zaregulování VZT systému + měření hlučnosti a vzduchových výkonů |
| VZT-014 | VZT | Doprava VZT komponentů — paušál pro veškeré jednotky a potrubí |
| VZT-015 | VZT | Revize VZT + protokol o předání + zapojení do BMS |

### HSV-3 _length_source annotation (hybrid ladder)

| ID | _length_source | _length_value_m | _length_confidence | method |
|---|---|---:|---:|---|
| HSV-3-001 | default_estimate | 7.0 | 0.7 | B5 default for 'IPE 400' as sloupy = 7.0 m per piece (ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2 DIMENSION-sp |
| HSV-3-002 | default_estimate | 7.0 | 0.7 | B5 default for 'HEA 200' as sloupy štítové = 7.0 m per piece (ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2 DIME |
| HSV-3-003 | default_estimate | 9.6 | 0.7 | B5 default for 'IPE 450' as příčle = 9.6 m per piece (ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2 DIMENSION-sp |
| HSV-3-004 | default_estimate | 6.0 | 0.7 | B5 default for 'IPE 160' as vaznice = 6.0 m per piece (ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2 DIMENSION-s |
| HSV-3-005 | default_estimate | 6.0 | 0.7 | B5 default for 'UPE 160' as vaznice krajní = 6.0 m per piece (ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2 DIME |
| HSV-3-006 | default_estimate | 4.0 | 0.7 | B5 default for 'L 70/70/6' as ztužidla stěnová = 4.0 m per piece (ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2  |
| HSV-3-007 | default_estimate | 6.0 | 0.7 | B5 default for 'Ø20' as ztužidla střešní = 6.0 m per piece (ladder 3 fallback; ladder 1 PROFILY-geom and ladder 2 DIMENS |
| HSV-3-008 | not_applicable_service | — | — | service item — kg/m³/m²/ks/paušál, no per-piece length concept |
| HSV-3-009 | not_applicable_service | — | — | service item — kg/m³/m²/ks/paušál, no per-piece length concept |
| HSV-3-010 | not_applicable_service | — | — | service item — kg/m³/m²/ks/paušál, no per-piece length concept |
| HSV-3-011 | not_applicable_service | — | — | service item — kg/m³/m²/ks/paušál, no per-piece length concept |
| HSV-3-012 | not_applicable_service | — | — | service item — kg/m³/m²/ks/paušál, no per-piece length concept |
| HSV-3-013 | not_applicable_service | — | — | service item — kg/m³/m²/ks/paušál, no per-piece length concept |
| HSV-3-014 | not_applicable_service | — | — | service item — kg/m³/m²/ks/paušál, no per-piece length concept |

### ABMV queue updates

#### ABMV_1 — Energetická bilance vs. technologie strojů
- Status: **resolved_with_caveats**
- Resolution: Stage C ÚT discovery extracted P_topny_total = 84.0 kW from UT_HALAHK_DPS.dxf zařízení list. Devices: DALAP Dalap_E-HP_9kW × 4 (9.0 kW/unit = 36.0 kW); FENIX (ECOSUN) ECOSUN_S+_12 × 40 (1.2 kW/unit = 48.0 kW); PT Ventilation PT_Vents_UET-15D × 4 (0 kW/unit = 0 kW); LENS LENS_ARENA_60x120_W × 36 (0 kW/unit = 0 kW). Heating bilance covered; cooling + VZT electric load NOT in DXF (VZT D.1.4 still missing per ABMV_12). LED svítidla a VZT rekuperační jednotky listed at 0 kW (reference only — actual EL spotřeba waits on EL D.1.4).
- Source: `outputs/dsp_dxf_ut_integration/ut_zarizeni_list.json`

#### ABMV_12 — TZB profesní PD (D.1.4)
- Status: **working_assumption_partial**
- Resolution: ÚT D.1.4 extracted via Stage C: DALAP Dalap_E-HP_9kW × 4 (9.0 kW/unit = 36.0 kW); FENIX (ECOSUN) ECOSUN_S+_12 × 40 (1.2 kW/unit = 48.0 kW); PT Ventilation PT_Vents_UET-15D × 4 (0 kW/unit = 0 kW); LENS LENS_ARENA_60x120_W × 36 (0 kW/unit = 0 kW), P_topny_total = 84.0 kW. No DPS razítko per Stage A dossier — DXF stupeň = DSP. VZT D.1.4 + ZTI D.1.4 + MAR D.1.4 still missing — assumed concept-level per Phase 0b. VZT/M items dropped from etap-1 scope (Stage D 22-item removal).
- Source: `outputs/dsp_dxf_ut_integration/{ut_razitka,ut_zarizeni_list,energetical_balance_update}.{json,md}`

#### ABMV_15 — Krajní vaznice: C150×19,3 vs UPE160
- Status: **resolved**
- Resolution: Kusovník DXF rozbor (Stage B) confirms UPE 160 as krajní vaznice (NOT C150×19.3 per RE-RUN §9.4 working assumption). Profile_rollup entry: UPE 160 with catalog_hit=True, kg/m=18.8. Item HSV-3-005 mnozstvi=1030.24 kg retained as written.
- Source: `outputs/dsp_dxf_ut_integration/dsp_dxf_kusovnik.json`

#### ABMV_16 — Externí dokument '2966-1 návrh dispozice strojů HK'
- Status: **resolved_external_xref_confirmed**
- Resolution: External document '2966-1 návrh dispozice strojů HK' confirmed as DXF external xref: 3 layers ('212_HK_situace_03_dwg-1', '2966-1_navrh dispozice stroju-HK_02_dwg-1', '2966-1_navrh dispozice stroju-HK_dwg-1') across A106_stroje + A107_stroje_kotvici_body. Reclassified as `external_reference` in ratified layer dictionary (Task 2 Step 1.5). Cross-ref to Stage A razítka odkazů — same document referenced 2× in title block.
- Source: `outputs/dsp_geometry_extraction/{layer_dictionary_ratified,dictionary_decisions}.{json,md}`


### Not closed (NEW DXF/extraction evidence available — deferred)

- **ABMV_2** Šířka sekčních vrat 3000 vs 3500: DXF block name `M_Vrata_výsuvná_sekční - 3000×4000 MM` (4 ks confirmed) supports 3000 mm — deferred formal closure to next Stage iteration.
- **ABMV_14** Lindab svody 3 vs 4: Task 2 extraction shows **3 distinct physical downpipes** (815811, 794159, 815879) per `agenm_targeted_scan.json`; PSV-78x-001 currently states 4 ks. Reconciliation deferred — flagged in ABMV queue but not silently overwritten.
- **ABMV_20** Lindab svody A101 vs A104 elevation: same evidence as ABMV_14.

### HSV-3 mass reconciliation (deferred — sensitive)

Current HSV-3 masses sourced from `statika D.1.2` + Stage 0b assumption `DXF A101 INSERT 'Sloup IPE' × 36`. Kusovník (Stage B DXF rozbor) shows 152 total INSERT instances across 67 profile families; PROFILY layer counts often represent SCHEDULE LEGEND (1× HEA100, 1× HEA120 … 1× HEA340 = catalog reference, NOT real piece counts). Real physical sloupy = 141 INSERTs on `structural_columns` layer (S-COLS), průvlaky = 45. Mass recalibration requires (a) cross-sheet dedup of replicated views and (b) schedule-vs-physical distinction — deferred to dedicated reconciliation task.
