# SO-207 D6 Karlovy Vary — Golden Test v2 (Three-Way Cross-Check)

**Object:** Estakáda na sil. I/6 v km 4.450-4.650, LM 9 polí + PM 10 polí, posuvná skruž
**TZ source:** `inputs/SO-207_D6_estakada_TZ_PDPS.pdf` (VIAPONT, VIII/2025, Ing. M. Jaroš)
**B3 extraction:** `app/knowledge_base/B3_current_prices/extracted_data/26-0XXC_*.json` (TO_BE_MAPPED)
**TKP base:** `STAVAGENT/extracted_data/TKP{NN}_*_extracted.json` (36 kapitol)
**VL4:** `app/knowledge_base/B2_csn_standards/VL_4_2021_Mosty_markdown.md`
**Last re-snapshot:** 2026-04-17 (v4.21.0 terminology + MSS fix pack)

---

## v4.21.0 Re-Snapshot Notes (2026-04-17)

SO-207 is the estakáda with posuvná skruž (MSS) — biggest change of
the three golden tests because the MSS path now fully wires through
orchestrator + UI + cost summary.

**Engine-side changes when `construction_technology='mss'`:**

- Formwork selector short-circuits to `DOKA MSS` (or `VARIOKIT Mobile`
  if `preferred_manufacturer='PERI'`) — `pour_role='mss_integrated'`,
  `mss_reuse_factor=0.35`, `rental_czk_m2_month=0`.
- Per-tact assembly labor (`shapedAssemblyNorm`) = catalog 1.20 h/m²
  × 0.35 = **0.42 h/m²** (before: full mount hours repeated per tact).
  Same factor on disassembly. Schedule days per tact drop accordingly.
- `calculateProps()` is SKIPPED (MSS carries its own stojky). Decision
  log records "Props: skipped — MSS integrated layer".
- `formwork_rental_czk` = **0** on MSS path regardless of catalog
  value (gate applied even against user `rental_czk_override`).
  `props_rental_czk` = 0 for the same reason.
- `formwork_labor_czk` = standard 3-fázový model + `mssCost.mobilization_czk`
  + `mssCost.demobilization_czk` (both from `calculateMSSCost`). The
  mob/demob represent "vlastní síly tesaři" montáž/demontáž of the
  MSS rig — priced as if the user's own crew did the mount (for
  comparison with DOKA/PERI subcontract offers, which typically run
  1.5–2× the self-mount figure).
- `plan.costs.is_mss_path=true`, and three new fields populated:
  `mss_mobilization_czk`, `mss_demobilization_czk`, `mss_rental_czk`.

**UI-side changes:**

- Card 🌉 "Posuvná skruž (MSS) — vše integrováno" replaces the
  generic 📦 Bednění card. Props card is suppressed.
- Cost summary gains three rows in the labor block: "MSS montáž
  (vlastní síly — tesaři)" + "MSS — per-takt úprava (práce)" +
  "MSS demontáž (vlastní síly — tesaři)". Rental block replaces
  "Pronájem bednění" with "Pronájem MSS (stroj)" followed by three
  italic zero rows ("↳ Pronájem bednění / skruže / stojek: 0 Kč
  (součást MSS)") so users see the bundle structure explicitly.

**Expected cost-order-of-magnitude delta** (19 spans × ~36 m × 13.6 m
NK ≈ 9 300 m² NK, SO-207 total):

| Category | Before v4.21 | After v4.21 | Delta |
|----------|--------------|-------------|-------|
| Formwork rental (Dokaflex/Staxo ghost) | ~1–2 M Kč | 0 Kč | −1…2 M Kč (bundled) |
| Props rental (Staxo separate) | ~0.6–1 M Kč | 0 Kč | −0.6…1 M Kč (bundled) |
| Per-takt formwork labor | full-mount × 19 | 0.35 × full × 19 | −65 % |
| MSS mobilization/rental/demob | in `bridge_technology.mss_cost` but invisible in `costs.*` | Surfaced as `mss_*_czk` fields + 3 cost-table rows | neutral (no double-count) |

**Behavioral check:** total plan cost should land close to the MSS
cost model from `calculateMSSCost` (mobilization + rental_total +
demob) plus recurring per-tact work, rebar, concrete. The old
"Dokaflex recommended for estakáda" issue disappears — the selector
returns DOKA MSS immediately and never quotes Dokaflex.

---

## Proč SO-207 = nejsložitější test

```
         SO-202    SO-203    SO-207
───────────────────────────────────
Polí     6+6       5+5       9+10 asymmetric
Max span ~20       24        36.74
Tech     fixed     fixed     MOVING scaffolding
Piloty   Ø900      Ø1200     Ø1200 + Ø900 MIX
Nadaci   deep      deep      DEEP + SHALLOW MIX
TP124    ?         3         4 (DEMZ + welding)
Fáze     ?         6         6 + traffic-on-bridge
PHS      no        no        YES 3.0 m
Konsol.  no        no        YES 60-day OP1
```

**Hypotéza:** pokud kalkulátor prochází SO-207, pak prochází i SO-202 a SO-203 jako podmnožiny.

---

## Section A — Identifikace stavby (TKP01 + TKP02)

```yaml
- id: SO207-A-01
  description: "Stavba SO207, estakáda na I/6"
  tz_fact:
    source: "TZ §1.1, §1.3"
    so_number: "SO207"
    road_category: "S 22.5/80 se SDP š. 3.5 m"
    nazev: "Estakáda na sil. I/6 v km 4.450-4.650"
  b3_check:
    source: "TO_BE_MAPPED/26-0XXC_extracted.json"
    path: "$.identification.so_number"
    expected_match: "SO207"
  tkp_check:
    source: "TKP01_2022_04_extracted.json"
    section: "Všeobecné — identifikační údaje"

- id: SO207-A-02
  description: "Ochranné pásmo 1. stupně přírodních léčivých zdrojů Karlovy Vary"
  tz_fact:
    source: "TZ §5.3, §7.5.1"
    flag: "1_ochranne_pasmo_lecivych_zdroju"
    dotkla_se_hranice: true
  tkp_check:
    source: "TKP01_2022_04_extracted.json"
    section: "Zvláštní požadavky — ochranná pásma zdrojů"
    rule: "Stavba v OP lečivých zdrojů vyžaduje stanovisko Inspekce lázní a zřídel"
  calc_assertion:
    element: "object_attributes"
    expected_regulatory_flag: "inspekce_lazni_a_zridel_required"
    bug_ref_if_missing: "#45 new from SO-207"
```

---

## Section B — Asymetrický most (TKP15 + TKP18 — KLÍČOVÉ pro SO-207)

```yaml
- id: SO207-B-01
  description: "Asymetrické mosty — LM 9 polí vs PM 10 polí"
  tz_fact:
    source: "TZ §1.4, §2.1, §6.1"
    num_bridges: 2
    num_fields_lm: 9
    num_fields_pm: 10
    asymmetry_reason: "Rozdílná délka kvůli posunu mostů a terénu"
    nk_delka_lm_m: 310.17
    nk_delka_pm_m: 342.58
    delka_mostu_lm_m: 335.45
    delka_mostu_pm_m: 350.45
  b3_check:
    source: "TO_BE_MAPPED"
    path: "$.bridges[*].num_fields"
    expected_values: [9, 10]
    expected_length: 2
  tkp_check:
    source: "TKP15_2021_02_extracted.json"
    section: "Mosty a lávky — návrhová pravidla"
    rule: "Každý jízdní směr je samostatná konstrukce — nelze průměrovat"
  calc_assertion:
    element: "bridge_object"
    input: {bridges: [{id: LM, fields: 9}, {id: PM, fields: 10}]}
    expected_schedule: "per_bridge_separately"
    expected_warning: "Asymmetric bridges — LM + PM jako samostatné jednotky"
    bug_ref_if_averaged: "#33 new from SO-207"

- id: SO207-B-02
  description: "Proměnná rozpětí polí v ose mostu"
  tz_fact:
    source: "TZ §2.1"
    rozpeti_lm_v_ose_mostu_m: [27.55, 36.74, 36.68, 36.52, 36.27, 36.06, 35.92, 35.66, 26.57]
    rozpeti_pm_v_ose_mostu_m: [26.28, 35.05, 35.38, 35.69, 35.93, 36.09, 36.38, 36.71, 27.72]
    rozpeti_v_ose_so101a_zjednodusene:
      lm: "27.00 + 7 × 36.00 + 27.00"
      pm: "27.00 + 8 × 36.00 + 27.00"
    inconsistency_flag: "PM má v TZ deklarováno 10 polí ale vypsáno 9 hodnot rozpětí — parser MUSÍ flag-ovat arithmetic mismatch"
    max_span_m: 36.74
    min_span_m: 26.28
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Spojité nosné konstrukce — variabilní rozpětí"
    rule: "Statický výpočet per-pole, konstrukční rozměry nelze průměrovat"
  calc_assertion:
    element: "mostovkova_deska"
    input: {span_array: "per_field"}
    expected_volume_calc: "per_field_sum"
    expected_cycle_time: "per_pole_individually"
    bug_ref_if_single_span: "#35 new from SO-207"

- id: SO207-B-03
  description: "Proměnná šířka NK"
  tz_fact:
    source: "TZ §2.1, §6.1"
    sirka_nk_lm_range_m: [12.24, 14.09]
    sirka_nk_pm_range_m: [12.30, 13.30]
    sirka_sdp_range_m: [0.45, 1.40]  # Zrcadlo se mění
    reason: "Rozhledové poměry + protisměrné oblouky"
    rozsireni_v_konzolach: true
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Proměnné průřezy NK"
    rule: "Variabilní šířka realizována v konzolách, trámy konstantní"
  calc_assertion:
    element: "mostovkova_deska"
    input: {width_range: [12.24, 14.09]}
    expected_volume_calc: "segmentovaný podle šířky"
    bug_ref_if_avg_width: "#34 new from SO-207"

- id: SO207-B-04
  description: "Překlápění příčného sklonu — pole 7"
  tz_fact:
    source: "TZ §6.1, §6.7.12"
    stredni_pole_s_nulovym_sklonem: 7
    preklápění_z: "+6%"
    preklápění_na: "-6%"
    dusledek_pro_odvodnění: "odvodňovače na OBOU stranách v poli 7"
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Odvodnění mostovky při překlápění sklonu"
  calc_assertion:
    element: "odvodneni_mostu"
    input: {transverse_slope_flip_field: 7}
    expected_mo_both_sides_pole_7: true
    expected_proužky_zapuštěné_v_polí: [6, 7]
    bug_ref: "#44 new from SO-207"
```

---

## Section C — Konsolidační násyp OP1 (UNIKÁTNÍ pro SO-207)

```yaml
- id: SO207-C-01
  description: "Konsolidační násyp OP1 — 60 dnů, smax 295 mm"
  tz_fact:
    source: "TZ §6.2, §6.11.1"
    lokace: "OP1"
    duration_budovani_m: 2
    duration_konsolidace_m: 2
    duration_odtezeni_m: 0.3
    smax_mm: 295
    monitoring:
      - "horizontální inklinometrie"
      - "piezometrické měření pórových tlaků"
    material_vymeny: "štěrkovitá zemina / hrubozrnný materiál fr. 0/125 / zlepšení mísením"
    pod_P2_taky: true  # Zlepšení podloží P2 také
  geotech_detail:
    source: "TZ Příloha č. 2 Geotechnický pasport"
    fázovaný_výpočet_sedání:
      - {faze: 0, t_dni: 30, s_mm: 4, popis: "přeložka, výměna podloží"}
      - {faze: 1, t_dni: 120, s_mm: 58, popis: "násyp pravé strany"}
      - {faze: 1_konsol, t_dni: 240, s_mm: 83}
      - {faze: 1_kce_vozovky_PM, t_dni: 270, s_mm: 98}
      - {faze: 2, t_dni: 300, s_mm: 106, popis: "násyp levé strany"}
      - {faze: 2_konsol, t_dni: 360, s_mm: 111}
      - {faze: dokonceni, t_dni: 390, s_mm: 117}
      - {faze: 3_roky_po_stavbe, t_dni: 1485, s_mm: 121}
      - {faze: konec_konsolidace, s_mm: 121}
    delta_s_csn_736244_mm: 10
    csn_limit_mm: 20
    vyhovuje: true
  tkp_check:
    - source: "TKP22_2022_06_extracted.json"
      section: "Geotechnika — konsolidace násypů"
      csn_refs: ["ČSN 73 6244 čl. 7.1.6", "TP76"]
    - source: "TKP03_2008_07_extracted.json"
      section: "Zemní práce — konsolidace"
  calc_assertion:
    element: "object_attributes"
    input: {consolidation_required: true, location: "OP1", smax_mm: 295}
    expected_monitoring_plan_required: true
    expected_piezometry_required: true
    expected_inklinometrie_required: true
    expected_schedule_extension_days: 60
    expected_delta_s_vs_limit: "≤ 20 mm"
    bug_ref_if_not_modeled: "#38 new from SO-207"

- id: SO207-C-02
  description: "Výměna měkkých potočních náplav"
  tz_fact:
    source: "TZ §6.2"
    lokace: "OP1 + P2"
    material_puvodni: "měkké potoční náplavy"
    material_nahradni: "štěrkovitá zemina nebo hrubozrnný fr. 0/125"
    alternativa: "zlepšení mísením"
  tkp_check:
    source: "TKP03_2008_07_extracted.json"
    section: "Zemní práce — výměna podloží"
    csn_ref: "ČSN 73 6133 čl. 6.2.2.3"
```

---

## Section D — Smíšené založení (TKP22 + TKP24 + TKP17 + TKP18)

```yaml
- id: SO207-D-01
  description: "Smíšené typy založení v jednom objektu"
  tz_fact:
    source: "TZ §6.3"
    foundation_types:
      OP1: "hlubinné (piloty Ø1200) + konsolidační násyp"
      P2_P6: "hlubinné (piloty Ø1200)"
      P7_LM: "plošné"
      P7_PM: "hlubinné"
      P8_LM: "plošné"
      P8_PM: "hlubinné (s alternativou plošné)"
      P9_LM: "plošné"
      P9_PM: "plošné"
      P10_PM: "plošné (alt. hlubinné)"
      OP10_LM: "plošné"
      OP11_PM: "hlubinné"
      SDP_opěrná_zeď: "Ø900 × 6 m piloty"
  b3_check:
    source: "TO_BE_MAPPED"
    path: "$.foundations[*].type"
    expected_types_distinct: ["deep_pile", "shallow", "deep_pile_secondary"]
  tkp_check:
    source: "TKP22_2022_06_extracted.json"
    section: "Geotechnika — volba způsobu založení"
    rule: "Mix deep+shallow v jednom objektu povolen — geotech. kategorie 3"
  calc_assertion:
    element: "object_attributes"
    input: {foundation_types_count: 3}
    expected_model: "mixed_foundation_enum"
    expected_cost_per_podpera: "podle typu"
    bug_ref_if_not_mixed: "#36 new from SO-207"

- id: SO207-D-02
  description: "Mix průměrů pilot — Ø1200 hlavní + Ø900 opěrná zeď"
  tz_fact:
    source: "TZ §6.3.2, §6.4.2"
    pile_diameters:
      main_Ø1200:
        material: "C30/37 XA2"
        steel: "B500B"
        locations: "všechny hluboké podpěry"
        productivity_expected: 1.0
      secondary_Ø900:
        material: "C30/37 XA2"
        length_m: 6.0
        location: "opěrná zeď SDP u OP10"
        dilatacni_celek_m: 6
        productivity_expected: 1.5
  tkp_check:
    source: "TKP24_2003_12_extracted.json"
    section: "Piloty různých průměrů — provádění"
  calc_assertion:
    element: "pilota"
    input: {mixed_diameters: [{d: 1200, loc: "main"}, {d: 900, loc: "retaining_wall"}]}
    expected_groups: 2
    expected_productivity_per_group: [1.0, 1.5]
    expected_rebar_per_group: "separate"
    bug_ref_if_single_group: "#37 new from SO-207"

- id: SO207-D-03
  description: "Provaření výztuže pilot — TP124 stupeň 4"
  tz_fact:
    source: "TZ §6.3, §6.10.2"
    provareni_vyztuze: true
    tp124_stupen: 4
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Bludné proudy — 4. stupeň"
    - source: "TKP24_2003_12_extracted.json"
      section: "Piloty — provaření výztuže"
    - source: "TKP19_2015_03_extracted.json"
      section: "PKO výztuže"
  calc_assertion:
    element: "pilota"
    input: {tp124_level: 4}
    expected_rebar_welding: true
    expected_demz: true
    expected_cost_premium_percent: "5-10"
    bug_ref: "#40 new from SO-207"
```

---

## Section E — Posuvná skruž (TKP18 — kriticky důležité!)

```yaml
- id: SO207-E-01
  description: "Technologie výstavby NK — posuvná skruž, více taktů"
  tz_fact:
    source: "TZ §6.5, §7.3.1"
    primary_technology: "posuvná skruž"
    alternative_technology: "pevná skruž"
    taktu_count: "více"
    rezerva_pro_skruz_m: 2.59  # při podjezdné výšce 4.2 m
    kabely_spojkovani_v_pracovni_spare: true
    napinani: "jednostranné z pracovních spar"
    doprava_pod_skruzi: "neuvažuje se"
    pristup_z_boku_LM_stavajici_I6: true
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Technologie NK — posuvné skruže MSS"
    decision_matrix:
      rozpeti_m: [25, 40]
      poli_min: 4
      doporucena_tech: "posuvná skruž"
      alternativa: "pevná skruž (při dostatku prostoru)"
    rule: "Pro rozpětí > 30 m a ≥ 4 poli je posuvná skruž ekonomicky výhodná"
  calc_assertion:
    element: "mostovkova_deska"
    input: {max_span: 36.74, num_fields: 19, alt_tech_allowed: true}
    expected_primary_technology: "moving_scaffolding"
    expected_alternative: "fixed_scaffolding"
    expected_prestress_per_takt: true
    expected_cable_spojkovani: true
    bug_ref: "#39 new from SO-207"

- id: SO207-E-02
  description: "Betonáž NK přes 6. pole PM během výstavby vede doprava"
  tz_fact:
    source: "TZ §7.3.1"
    pole_s_dopravou: "pole 6 PM"
    faze_s_dopravou: "II-IV"
    provizorni_objezd: "nutný pro přesun skruže do pole 4"
    podjezdna_vyska_m: 4.2
    rezerva_pro_skruz_m: 2.59
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Výstavba při zachovaném provozu"
  calc_assertion:
    element: "construction_phases"
    input: {traffic_during_construction: true}
    expected_provizorni_komunikace_so_ref: "SO904"
    expected_phases_complexity_premium: "10x"

- id: SO207-E-03
  description: "NK — předpětí 16 kabelů × 19 lan Y1860S7-15.7"
  tz_fact:
    source: "TZ §6.5.1"
    kabely_total: 16
    lana_per_kabel: 19  # vs SO203 má 15!
    typ_lana: "Y1860S7-15.7"
    spojkovani_v_pracovni_spare: true
    napinani: "jednostranné z pracovních spar"
    pevnost_napinani_min_mpa: 33
    stari_napinani_min_dny: 7
    kotevni_napeti_mpa: 1440
    pko_stupen: "PL2"
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Předpínací výztuž — spojkování"
      rule: "Spojkování v pracovní spáře při vícetaktové betonáži"
    - source: "TKP17_2022_04_extracted.json"
      section: "Beton — pevnost pro napínání"
  calc_assertion:
    element: "mostovkova_deska"
    is_prestressed: true
    input: {cables: 16, strands: 19, spojkovani: true}
    expected_injection_time_days: "per kabel + spojkování premium"
    bug_ref_cable_count_mismatch: "#31 from SO-203"

- id: SO207-E-04
  description: "NK ošetřování — třída 4 při 15°C = 9 dní (NE 5 jak kalkulátor)"
  tz_fact:
    source: "TZ §7.8.3"
    trida_osetrovani: 4
    prvek: "nosná konstrukce C35/45 XF2"
  tkp_check:
    source: "TKP17_2022_04_extracted.json"
    section: "P10 ošetřování — třída 4"
    table:
      t_ge_25: 5
      t_15_25: 9
      t_10_15: 13
      t_5_10: 18
  calc_assertion:
    element: "mostovkova_deska"
    input: {exposure: "XF2", curing_class: 4, temp_C: 15}
    expected_days: 9
    bug_ref: "#1 CRITICAL from SO-202"

- id: SO207-E-05
  description: "Dva pevné body — P5 a P6"
  tz_fact:
    source: "TZ §6.5.2"
    pevne_body_count: 2
    pevne_body_locations: ["P5", "P6"]
    loziska_klad_do_tecny: true
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Návrh pevných bodů u dlouhých mostů"
    rule: "Mosty > 200 m mohou mít více pevných bodů pro omezení deformací"
  calc_assertion:
    element: "bearing_layout"
    input: {nk_length_m: 342.58, fixed_points_count: 2}
    expected_fixed_points: ["P5", "P6"]
    bug_ref_if_single: "#41 new from SO-207"
```

---

## Section F — Složité betonové třídy per-podpěra (TKP17)

```yaml
- id: SO207-F-01
  description: "Různé exposure třídy pro pilíře podle polohy"
  tz_fact:
    source: "TZ §7.8.1"
    zaklady:
      P2_P3_P4: "C30/37 XF3"
      P5_P6_P7_P9: "C30/37 XA2"
      P8_P10P: "C30/37 XF1"
      opery: "C25/30 XF1"
    driky:
      P2_P8_P9_P10P: "C35/45 XF2"
      P3_P4_P5_P6_P7: "C35/45 XF4"
  tkp_check:
    source: "TKP17_2022_04_extracted.json"
    section: "Třídy vlivu prostředí — XF rodina"
    rules:
      XF1: "mírný mráz bez rozmrazovacích solí"
      XF2: "mírný mráz s rozmrazovacími solemi"
      XF3: "silný mráz bez solí"
      XF4: "silný mráz se solemi — piliers u vozovky, postřik"
      XA2: "středně agresivní chemická voda"
  calc_assertion:
    element: "zaklady_piliru"
    input: {per_pier_exposure: true, pier_id: "P4"}
    expected_exposure: "XF3"
  notes:
    - "XF3 pro základy P2-P4: blíže k potoku/vodoteči, stříkání vody"
    - "XA2 pro P5-P7, P9: kontakt s agresivní podzemní vodou"
    - "XF4 pro driky P3-P7: postřik rozmrazovacími solemi ze silnice"
    - "XF2 pro driky P2, P8-P10P: vzdálené od silnice, bez postřiku"

- id: SO207-F-02
  description: "Dobetonávky kapes pro MZ a kotvy předpětí — C30/37 XF4"
  tz_fact:
    source: "TZ §7.8.1"
    dobetonavka_kapes_MZ: "C30/37 XF4"
    dobetonavka_kapes_kotev: "C30/37 XF4"
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Dobetonávky — třída vyšší nebo rovna hlavní konstrukci"
```

---

## Section G — Ochrana před bludnými proudy — stupeň 4 (TP124 + TKP18 + TKP19)

```yaml
- id: SO207-G-01
  description: "TP124 stupeň 4 — plná ochrana"
  tz_fact:
    source: "TZ §6.10.2"
    stupen: 4
    primarni_ochrana: "dle čl. 5.2 TP124"
    sekundarni_ochrana: "ochranné nátěry spodní stavby"
    provareni_vyztuze: true
    vyvody_na_povrch: true
    mereni_elektroizolacni_malty: true
    mereni_elektricky_odpor_MZ: true
    mereni_pred_vystavbou: "ověřující korozní průzkum"
    demz: true
    predani_spravci: true
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Bludné proudy — stupeň 4"
      rules:
        provareni: "povinné + vyvedení na povrch"
        mereni_plastbetonu: "po zatvrdnutí, před zatížením"
        mereni_MZ: "po zabudování"
        demz: "povinné"
    - source: "TKP19_2015_03_extracted.json"
      section: "PKO a bludné proudy — interakce"
  calc_assertion:
    element: "object_attributes"
    input: {object: "SO207"}
    expected_tp124_level: 4
    expected_rebar_welding: true
    expected_demz_required: true
    expected_measurement_stages: ["before", "during", "after"]
    expected_cost_premium_vs_level_3_percent: "5-10"

- id: SO207-G-02
  description: "Ochrana před atmosférickým přepětím — PHS, clona, délka >100 m"
  tz_fact:
    source: "TZ §6.10.3"
    triggers:
      - "PHS na vnější římse PM"
      - "clona proti oslnění na obou vnějších římsách"
      - "délka mostu > 100 m (LM 335, PM 350)"
    jiskriste_pocet: "vzduchová jiskřiště u ložisek"
    uzemnovaci_tyce: "nerez Ø10 mm nad povrch říms"
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Atmosférické přepětí — TP124"
  calc_assertion:
    element: "object_attributes"
    expected_lightning_protection: true
    expected_jiskriste_count: "2+ per podpěra s vnějším ložiskem"
```

---

## Section H — PHS, clona, portál (TKP14 + TKP25A + TKP31)

```yaml
- id: SO207-H-01
  description: "Protihluková stěna (PHS) 3.0 m odrazivá na PM"
  tz_fact:
    source: "TZ §6.7.10"
    so_ref: "SO704"
    vyska_m: 3.0
    typ: "odrazivá"
    lokace: "vnější římsa PM km 4.330-4.670"
    delka_na_mostě_m: 220
    konstrukce:
      profily: "HEA 120"
      rozteč_m: 2.0
      sokl_vyska_m: 0.5
      sokl_material: "hliníkové lamely"
      vyplň_horni: "průhledný tónovaný materiál"
      ochrana_ptactva: "TP 104"
      kotveni: "lepené kotvy"
  tkp_check:
    - source: "TKP14_2021_04_extracted.json"
      section: "Protihlukové stěny — obecné"
    - source: "TKP25A_2018_09_extracted.json"
      section: "PHS — konstrukční detaily"
  calc_assertion:
    element: "protihlukova_stena"
    input: {height_m: 3.0, type: "odrazivá", mounting: "bridge_rimsa"}
    expected_vnejsi_rimsa_sirka_mm: 1900  # rozšířená kvůli PHS
    bug_ref_if_not_first_class: "#42 new from SO-207"

- id: SO207-H-02
  description: "Clona proti oslnění 1.5 m — AOPK ČR požadavek"
  tz_fact:
    source: "TZ §6.7.10"
    vyska_m: 1.5
    lokace_lm: "celá délka"
    lokace_pm: "od km 4.670 do konce (za PHS)"
    duvod: "AOPK ČR — CHKO, snížení negativních vlivů"
  tkp_check:
    source: "TKP14_2021_04_extracted.json"
    section: "Protioslnění — AOPK požadavky"
  calc_assertion:
    element: "clona_osvetleni"
    expected_height_m: 1.5
    expected_AOPK_compliance: true

- id: SO207-H-03
  description: "Portál dopravního značení č. 6 na PM nad P7"
  tz_fact:
    source: "TZ §6.7.5, §6.7.13"
    so_ref: "SO120a.3"
    lokace: "PM nad pilířem P7"
    kotveni: "v rozšířených římsách"
    rimsa_vnitrni_sirka_v_miste_portalu_mm: 1900
    rimsa_vnejsi_sirka_v_miste_portalu_mm: 3000
  tkp_check:
    source: "TKP27_2013_05_extracted.json"
    section: "Svislé dopravní značení — portály"
  calc_assertion:
    element: "rimsa"
    input: {portal_location: "P7_PM", variable_width: true}
    expected_variable_rimsa_widths: true
```

---

## Section I — Vozovka třívrstvá 135 mm (TKP07 + TKP13 + TKP18)

```yaml
- id: SO207-I-01
  description: "Třívrstvá vozovka 135 mm (vs dvouvrstvá 85 mm SO-203)"
  tz_fact:
    source: "TZ §6.7.3"
    tloustka_celkem_mm: 135
    vrstvy:
      - {nazev: "SMA 11 S", tloustka_mm: 40, norma: "ČSN EN 13108-5"}
      - {nazev: "ACL 16 S", tloustka_mm: 55, norma: "ČSN EN 13108-1", role: "ložná"}
      - {nazev: "MA 11 IV", tloustka_mm: 35, norma: "ČSN EN 13108-6", role: "litý asfalt + posyp 4/8"}
      - {nazev: "NAIP + pečetící vrstva", tloustka_mm: 5}
    spojovaci_postriky: "0.35 kg/m² PS-CP ČSN 73 6129 × 2"
    vyztužná_skelná_textílie: "10×10 mm v litém asfaltu (kvůli sklonu 5.1%)"
    tdz: "S/I"
  tkp_check:
    - source: "TKP07_2021_10_extracted.json"
      section: "Hutněné asfaltové vrstvy — TDZ S/I"
      rule: "TDZ S pro dálnice + I. třídy = třívrstvá pro vyšší trvanlivost"
    - source: "TKP13_2008_07_extracted.json"
      section: "Izolace mostovky — NAIP"
    - source: "TKP18_2022_05_extracted.json"
      section: "Mostovky — konstrukce vozovky"
  calc_assertion:
    element: "vozovka"
    input: {object: "SO207", tdz: "S", slope_max_percent: 5.1}
    expected_layers_count: 4  # SMA + ACL + MA + NAIP
    expected_mesh_in_MA: true  # kvůli sklonu
    bug_ref_if_single_schema: "#43 new from SO-207"
```

---

## Section J — Opěrná zeď v SDP (TKP18 + TKP24)

```yaml
- id: SO207-J-01
  description: "Opěrná úhlová zeď mezi opěrami u SDP"
  tz_fact:
    source: "TZ §6.4.2"
    typ: "úhlová zeď"
    zalozeni: "Ø900 × 6 m piloty"
    rozdeleni_celku_m: 6
    smykove_spojeni: "betonový ozub"
    v_kazdem_celku_prostup_drenaz: true
    nivelacni_znacky_ve_2_celcich: true
  tkp_check:
    - source: "TKP24_2003_12_extracted.json"
      section: "Piloty Ø900 — technologie"
    - source: "TKP18_2022_05_extracted.json"
      section: "Opěrné zdi — návrh"
  calc_assertion:
    element: "opěrná_zeď"
    input: {pile_diameter_mm: 900, pile_length_m: 6.0, dilat_celek_m: 6}
    expected_separate_schedule: true
```

---

## Section K — Mostní závěry OP1, OP10/11 (TKP12)

```yaml
- id: SO207-K-01
  description: "Mostní závěry lamelové druh 8 — obě polohy"
  tz_fact:
    source: "TZ §6.5.3"
    op1_lm_pm:
      typ: "povrchový lamelový druh 8"
      dilatace_pos_mm: 87
      dilatace_neg_mm: -139
      total_mm: 226
    op10_op11:
      typ: "povrchový lamelový druh 8"
      dilatace_pos_mm: 100
      dilatace_neg_mm: -155
      total_mm: 255
    prostor_nk_zaverna_zidka_mm: 700  # vs 600 SO-203
    vyska_vozovky_v_miste_MZ_mm: 70
  tkp_check:
    source: "TKP12_2013_05_extracted.json"
    section: "Dilatační závěry — druhy dle dilatace"
    rule: "Dilatace > 200 mm → lamelový druh 8 povinně"
  calc_assertion:
    - element: "mostni_zaver"
      input: {total_dilation_mm: 226}
      expected_type: "povrchovy_lamelovy_druh_8"
    - element: "mostni_zaver"
      input: {total_dilation_mm: 255}
      expected_type: "povrchovy_lamelovy_druh_8"
    - element: "mostni_zaver"
      attribute: "prostor_nk_zaverna_zidka_mm"
      expected_value: 700
      reason: "Větší prostor pro delší dilatace"
```

---

## Section L — Nestandardní prvky SO-207 (rozšířené hlavy pilířů, hydraulické lisy)

```yaml
- id: SO207-L-01
  description: "Rozšíření hlavy pilíře pro hydraulické lisy"
  tz_fact:
    source: "TZ §6.4.3, §6.11.6"
    rozsirene_hlavy_pro_lisy: true
    lokace: "všechny vnitřní sloupové pilíře P2-P10"
    účel: "rektifikace NK"
    polymerbeton_pod_loziskem: true
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Pilíře — detaily pro rektifikaci"
  calc_assertion:
    element: "driky_piliru"
    input: {SO: "SO207"}
    expected_hlava_rozsirena: true
    expected_volume_premium_percent: "5-10"

- id: SO207-L-02
  description: "DIS-SOS chráničky HDPE 2×3 ks"
  tz_fact:
    source: "TZ §6.7.5"
    chranicky_pocet: 6  # 2×3
    typ: "HDPE Ø110/94"
    lokace: "vnitřní římsa LM"
    zatahovaci_kabelove_komory: 3  # á 90 m
    vyvedení_na_koncích: "VL 4 402.11"
    ppk_standard: "PPK-KAB"
  tkp_check:
    - source: "TKP33_2016_11_extracted.json"
      section: "Kabelové trasy — chráničky HDPE"
    - source: "TKP30_2017_04_extracted.json"
      section: "Telematika DIS-SOS"
  vl4_check:
    source: "VL_4_2021_Mosty_markdown.md"
    section: "402.11 Vyvedení kabelových chrániček u opěr"
    section_2: "402.12 Zatahovací kabelové komory"
```

---

## Section M — Geodetická sledování a monitoring (TKP28 + M10 ŘSD + VL4)

```yaml
- id: SO207-M-01
  description: "Monitoring konsolidace OP1 — specifický pro SO-207"
  tz_fact:
    source: "TZ §6.11.1"
    predpokladana_doba_m: 2
    smax_mm: 295
    monitoring_typy:
      - "horizontální inklinometrie"
      - "piezometrické měření pórových tlaků"
    ukonceni_rozhoduje:
      - "firma provádějící měření"
      - "zodpovědný geolog zhotovitele"
      - "objednatel"
      - "zodpovědný projektant"
  tkp_check:
    - source: "TKP22_2022_06_extracted.json"
      section: "Geotechnický monitoring"
    - source: "TKP28_2022_12_extracted.json"
      section: "Zkoušení — monitoring"
  calc_assertion:
    element: "monitoring_plan"
    input: {consolidation: true, location: "OP1"}
    expected_piezometry_count: "per projekt geotech. monitoringu"
    expected_inklinometrie_points: "per projekt"
```

---

## Section N — Plná mapa TKP vs. prvky SO-207

| TKP | Kapitola | Aplikuje se na SO-207 prvek | Refs v TZ | Tier |
|---|---|---|---|---|
| TKP01 | Všeobecné | object_header, vytyčování, materiály, OP lázeňské | 7× | 2 |
| TKP01A | Příloha | mikrosíť (13 bodů) | 1× | 3 |
| TKP02 | Pozemní komunikace | S 22.5/80 | 1× | 3 |
| TKP03 | Zemní práce | výkopy + konsolidační násyp + výměna náplav | 5× | 2 |
| TKP04 | Odvodnění | MO, sběrné, horské vpusti, mostní odvodňovače | 3× | 3 |
| TKP05 | Podkladní vrstvy | ŠDA štěrkopísek | 2× | 3 |
| TKP06 | Nestmelené vrstvy | ŠDB pro přístupovou rampu | 1× | 3 |
| TKP07 | Hutněné asfaltové | SMA + ACL + MA (3vrstvá!) | 4× | 2 |
| TKP08 | CB kryty | — | 0 | 4 |
| TKP09 | Kamenivo | dlažba úpravy | 1× | 3 |
| TKP10 | Ocelové mosty | — | 0 | 4 |
| TKP11 | Dřevěné | — | 0 | 4 |
| **TKP12** | **Dilatační závěry** | **OP1 + OP10/11 lamel. druh 8** | **3×** | **2** |
| TKP13 | Izolace proti vodě | NAIP + ALP | 3× | 2 |
| **TKP14** | **PHS** | **PHS 3 m + clona 1.5 m** | **4×** | **2** |
| TKP15 | Mosty a lávky | přechodové desky, obecné | 5× | 2 |
| TKP16 | Gabiony | — | 0 | 4 |
| **TKP17** | **Beton** | **ALL betonové prvky, třídy, ošetřování** | **18×** | **1** |
| **TKP18** | **Betonové mosty** | **NK, spodní stavba, technologie** | **25×** | **1** |
| **TKP19** | **PKO** | **ložiska, MZ, svodidla, zábradlí, PHS, clona** | **10×** | **1** |
| TKP20 | Žel. svršek | — | 0 | 4 |
| TKP21 | Žel. spodek | — | 0 | 4 |
| **TKP22** | **Geotechnika** | **smíšené základy, konsolidace, seismika, vyvody** | **8×** | **1** |
| TKP23 | Tunely | — | 0 | 4 |
| **TKP24** | **Zvláštní zakládání** | **piloty Ø1200 + Ø900 + provaření** | **5×** | **1** |
| **TKP25A** | **PHS A** | **PHS 3m odrazivá** | **2×** | **2** |
| TKP25B | Svodidla B | H3 svodidla | 3× | 2 |
| TKP26 | Směrové sloupky | — | 0 | 4 |
| TKP27 | Značení | portál dopravní značení č. 6 | 2× | 3 |
| **TKP28** | **Zkoušení** | **Integrita pilot, monitoring konsolidace, geodet** | **5×** | **1** |
| TKP29 | Ozelenění | svahy | 1× | 3 |
| TKP30 | Telematika | DIS-SOS | 2× | 3 |
| **TKP31** | **Mosty — speciální** | **nátěry S2/S4** | **2×** | **2** |
| TKP32 | Lícové zdivo | — | 0 | 4 |
| TKP33 | Kabelové trasy | DIS-SOS chráničky | 2× | 3 |
| **VL4** | **Vzorové listy** | **Detaily — 402.11, 402.12, 509.01, 306.1, 210.01** | **12×+** | **1** |

**Tier summary:**
- **Tier 1 (≥ 5 refs):** TKP17, TKP18, TKP19, TKP22, TKP24, TKP28, VL4 — 7 kapitol
- **Tier 2 (3-4 refs):** TKP01, TKP03, TKP07, TKP12, TKP13, TKP14, TKP15, TKP25A, TKP25B, TKP31 — 10 kapitol
- **Tier 3 (1-2 refs):** TKP01A, TKP02, TKP04, TKP05, TKP06, TKP09, TKP27, TKP29, TKP30, TKP33 — 10 kapitol
- **Tier 4 (N/A):** 9 kapitol

**SO-207 coverage = 27 ze 36 TKP** (vs. ~25 pro SO-203) — nejvyšší pokrytí ze tří objektů.

---

## Section O — SO-207 vs SO-203 differential (co je unikátní)

```yaml
unique_to_SO207_not_in_SO203:
  - consolidation_embankment: {location: "OP1", duration_m: 2, smax_mm: 295}
  - moving_scaffolding: {reason: "max_span 36.74 > 30 m"}
  - mixed_foundation: {deep: [OP1,P2-P6,P7PM,P8PM,OP11PM], shallow: [P7-P10 LM/PM], retaining_piles_Ø900: [SDP]}
  - mixed_pile_diameters: [Ø1200, Ø900]
  - tp124_level: 4  # vs 3 in SO203
  - demz_required: true  # vs false in SO203
  - rebar_welding: true  # vs false in SO203
  - phs: {height_m: 3.0, so_ref: "SO704"}
  - clona_osvetleni: {height_m: 1.5, reason: "AOPK CHKO"}
  - portal_dopravniho_znaceni: {location: "P7_PM", so_ref: "SO120a.3"}
  - meteostanice: {location: "OP1", so_ref: "SO495"}
  - hydraulicke_lisy_hlava_pilire: true
  - multiple_fixed_bearings: ["P5", "P6"]  # vs 1 in SO203
  - transverse_slope_flip: {field: 7, from: "+6%", to: "-6%"}
  - variable_nk_width: {range_m: [12.24, 14.09]}
  - variable_span: {range_m: [26.28, 36.74]}
  - asymmetric_fields: {lm: 9, pm: 10}
  - 3_layer_pavement: {thickness_mm: 135}
  - traffic_during_construction: {phase: "II-IV", pole: "6 PM"}
  - demolice_stavajiciho_mostu: true
  - prelozka_potoka: {so_ref: "SO322"}
  - ochranne_pasmo_zridel: "1_stupen_Karlovy_Vary"
  - pocet_stavebnich_fazi: 6
  - cables_per_kabel_strands: 19  # vs 15 in SO203

critical_parser_challenges_SO207:
  - asymmetric_fields_arithmetic_mismatch: "PM 10 polí deklarováno, 9 hodnot vypsáno — MUST flag"
  - variable_width_per_pole: "Šířka NK per-pole, ne průměr"
  - per_pier_exposure_class: "Pilíře P2-P10 mají různé XF třídy dle polohy"
  - drawing_references: "Piloty počty/délky jsou v 'výkrese č. 08', ne v TZ textu"
  - subdocument_integration: "Hydrotech + Geotech pasport + hlavní TZ musí být propojeny"
```

---

## Section P — Známé bugy (inherited + new)

```yaml
bugs_inherited:
  - "#1 curing class 4"
  - "#2, #3 wizard UX"
  - "#4 MSS floor — pro SO-207 OK (max_span 36.74 > 25), ale edge cases"
  - "#11 XF4 missing in opery"
  - "#12 XF2 missing in driky"
  - "#13 pile rebar default"
  - "#14 curing classes generally"
  - "#26 mix pile lengths — SO-207 má taky (Ø1200 různých délek per výkres)"
  - "#27 tp124_level — pro SO-207 kritické (stupeň 4)"
  - "#28 MZ type selection — SO-207 má 2 lokace druhu 8"
  - "#29 fixed point — SO-207 má DVA pevné body"
  - "#30 geotech category — SO-207 je kategorie 3"
  - "#31 prestress cable count — SO-207 má 19 lan"

bugs_new_from_SO207:
  - {id: "#33", severity: "CRITICAL", summary: "Asymmetric bridges LM 9 vs PM 10 polí musí být modelovány separátně"}
  - {id: "#34", severity: "CRITICAL", summary: "Variable deck width per-pole — volume computation segmented"}
  - {id: "#35", severity: "CRITICAL", summary: "Variable span per-field — calc per pole, ne průměr"}
  - {id: "#36", severity: "HIGH", summary: "Mixed foundation types v jednom SO (deep + shallow)"}
  - {id: "#37", severity: "HIGH", summary: "Mixed pile diameters Ø1200 + Ø900 v jednom SO"}
  - {id: "#38", severity: "HIGH", summary: "Konsolidační násyp není v schedule modelu"}
  - {id: "#39", severity: "HIGH", summary: "Moving scaffolding pravidla — taktů, prestress per takt, spojkování"}
  - {id: "#40", severity: "CRITICAL", summary: "TP124 level 4 — provaření výztuže, DEMZ, monitoring fáze"}
  - {id: "#41", severity: "MEDIUM", summary: "Multiple fixed bearings (P5 + P6)"}
  - {id: "#42", severity: "HIGH", summary: "PHS + clona + portál jako first-class attributes, ovlivňují šířku říms"}
  - {id: "#43", severity: "MEDIUM", summary: "3-vrstvá vozovka 135 mm schema (vs 2-vrstvá 85 mm)"}
  - {id: "#44", severity: "MEDIUM", summary: "Překlápění příčného sklonu v poli 7 — odvodnění oboustranné"}
  - {id: "#45", severity: "MEDIUM", summary: "CHOPAV 1. stupeň — regulatory flag"}
  - {id: "#46", severity: "MEDIUM", summary: "6 fází výstavby s dopravou na mostě — schedule complexity 10×"}
  - {id: "#47", severity: "LOW", summary: "Různé rozměry přechodových desek per-object (5.25 × 300 vs 6.0 × 350)"}
  - {id: "#48", severity: "LOW", summary: "Tektonická porucha v geotech. pasportu — per-location pile design"}
  - {id: "#49", severity: "MEDIUM", summary: "Span count inconsistency — PM 10 polí ale 9 hodnot. Parser MUSÍ flag"}
  - {id: "#55", severity: "HIGH", summary: "Per-pier concrete exposure class (P2-P10 různé XF) — current model has 1 value per element type"}
  - {id: "#56", severity: "MEDIUM", summary: "Variable rimsa width (0.80-3.00 m kvůli portálu) — segmented calc"}
  - {id: "#57", severity: "HIGH", summary: "Hydraulické lisy na hlavách pilířů — rozšířené rozměry"}
  - {id: "#58", severity: "MEDIUM", summary: "Demolice stávajícího mostu + přeložka potoka jako předchůdnické aktivity"}
  - {id: "#59", severity: "LOW", summary: "Meteostanice + teplotní čidla v NK — extra chráničky v římse"}
```

---

## Section Q — Execution & integration

```bash
# Three-way golden check
python tools/golden_runner.py \
  --object SO207 \
  --tz-pdf inputs/SO-207_TZ_PDPS.pdf \
  --b3-extracted app/knowledge_base/B3_current_prices/extracted_data/26-0XXC_extracted.json \
  --tkp-base STAVAGENT/extracted_data/ \
  --vl4 app/knowledge_base/B2_csn_standards/VL_4_2021_Mosty_markdown.md \
  --include-subdocuments \
  --subdocuments inputs/SO-207_Priloha_1_Hydrotech.pdf,inputs/SO-207_Priloha_2_Geotech.pdf \
  --output reports/SO207_golden_report.json

# Expected failure modes:
#   asymmetric_bridge_not_supported    → calculator limits
#   variable_width_not_supported       → calculator limits  
#   moving_scaffolding_not_modeled     → calculator scope gap
#   tp124_level_4_not_first_class      → data model gap
#   consolidation_not_in_schedule      → schedule model gap
#   per_pier_exposure_not_supported    → data model gap
```

---

## Section R — Meta: které testy budou pass / fail

```yaml
expected_status_first_run:
  total_assertions: 47  # counted in this file
  
  expected_pass: ~15
    - TZ extraction basic (so_number, category, dimensions)
    - Concrete grade extraction per element type (high-level)
    - Piloty Ø1200 basic (bez mix detection)
    - Exposure classes per element (high-level)
  
  expected_fail_critical: ~10
    - #1 curing class 4 (always fails)
    - #33 asymmetric bridges
    - #34 variable width
    - #35 variable span
    - #40 tp124 level 4
    - #38 consolidation
    - #39 moving scaffolding
  
  expected_fail_parser: ~8
    - #49 span count inconsistency
    - #50 TKP alias normalization
    - #52 span pattern regex
    - #53 subdocument linking
    - drawing references
  
  expected_manual_review: ~14
    - bridge composites (PHS, clona, portál)
    - per-pier exposure
    - mixed foundation
    - mixed pile diameters
    - variable rimsa width
    - various edge cases
```

**End of SO-207 golden test v2.**
