# SO-203 D6 Karlovy Vary — Golden Test v2 (Three-Way Cross-Check)

**Object:** Most na sil. I/6 v km 2,450 (přes MK SO106), LM + PM, 5 polí, pevná skruž
**TZ source:** `inputs/SO-203_D6_most_TZ_PDPS.pdf` (VIAPONT, X/2025, Ing. M. Drnec)
**B3 extraction:** `app/knowledge_base/B3_current_prices/extracted_data/26-0XXC_*.json` (TO_BE_MAPPED — určit který ze 5 extracted souborů odpovídá SO-203)
**TKP base:** `STAVAGENT/extracted_data/TKP{NN}_*_extracted.json` (36 kapitol, plný rozsah)
**VL4:** `app/knowledge_base/B2_csn_standards/VL_4_2021_Mosty_markdown.md`
**Audit tool:** `tools/golden_runner.py --object SO203 --mode three-way`
**Last re-snapshot:** 2026-04-17 (v4.21.0 terminology + MSS fix pack)

---

## v4.21.0 Re-Snapshot Notes (2026-04-17)

SO-203 runs on pevná skruž (5 polí × ~24 m max span), so the MSS path
is inactive; the v4.21 changes affect terminology + card split only:

- `plan.formwork.system.name` = `Top 50` (was `Staxo 100` for h ≥ 8 m
  or `Staxo 40` for h < 8 m). `pour_role='falsework'`.
- Per-tact formwork labor (Top 50 Nhod 0.60 × 0.55 difficulty) lower
  than previous Staxo 100 value (0.90). Formwork rental line reads
  "Pronájem skruže (nosníky)" with 380 Kč/m²/měs — same pricing.
- `plan.props.system.name` = `Staxo 40` (stojky) — unchanged. UI shows
  it in its own "🔩 Stojky" card, not conflated with the skruž above.
- Cost summary: four rental rows (skruž / stojky) replace the two
  previous (bednění / podpěry) with identical totals but clearer
  attribution.
- Dokaflex NEVER appears in the candidate pool (applicable_element_types
  allow-list) — resolving the "ai advisor recommends Dokaflex" issue
  flagged in the audit backlog.

No MSS fields populated (`is_mss_path=false`, all `mss_*_czk=0`).

---

## v4.22.0 Re-Snapshot Notes (Gate 2.1 — 2026-04-29)

**Gap #8 (CRITICAL) — terminology correction:**

Per Gate 1 audit Section C.3 Gap #8 + canonical doc §9.1 + DOKA katalog
(„Nosníkové bednění Top 50"), Top 50 + VARIOKIT HD 200 reclassified.
The v4.21.0 section above documented the SELECTOR fix; v4.22.0 corrects
the TERMINOLOGY of that selection per canonical taxonomy. Symmetric to
the SO-202 v4.22.0 Re-Snapshot — both mostovka spec-y use the same
Top 50 + Staxo 100 stack on pevná skruž.

Changes in `formwork-systems.ts`:
- Top 50: `pour_role` `'falsework'` → `'formwork'`; `formwork_subtype`
  `'nosnikove'` added (Vrstva 1 per canonical §9.2 — kontaktní povrch)
- VARIOKIT HD 200: `pour_role` `'falsework'` → `'formwork_beam'`
  (NEW enum value, Vrstva 2 per §9.2 — horizontální nosníky)
- `PourRole` enum expanded with `'formwork_beam'`
- `FormworkSubtype` type alias added:
  `'ramove' | 'nosnikove' | 'stropni' | 'beam'`

Output shape changes for SO-203 mostovka path:
- `plan.formwork.system.name` = `'Top 50'` (unchanged)
- `plan.formwork.system.pour_role` = `'formwork'` (was `'falsework'`)
- `plan.formwork.system.formwork_subtype` = `'nosnikove'` (NEW field)

Out of scope (Phase 2 narrow per Variant B decision):
- Staxo 100 reclassification (`'props'` → `'falsework'` per canonical
  Vrstva 3) — deferred to Phase 3 mostní review or Gate 3
- `plan.falsework.system` field (multi-layer output) — deferred, would
  require `recommendFormwork` return-shape refactor
- UI card title changes — Gate 3 UI scope

Test assertions inverted in lockstep (covered by SO-202 fixture; SO-203
has no automated golden test yet — see migration plan Phase 1
recommendation):
- `formwork-systems.test.ts:23-30` (Top 50 pour_role + subtype)
- `formwork-systems.test.ts:71-82` (VARIOKIT HD pour_role)
- `element-classifier.test.ts:630-647` (mostovka → Top 50 formwork +
  nosnikove)

References:
- Gate 1 audit: `Monolit-Planner/docs/AUDIT_Podpera_Terminologie.md`
  Section C.3 Gap #8
- Migration plan:
  `Monolit-Planner/docs/MIGRATION_PLAN_GATE2_TO_GATE4.md` Phase 2
- Canonical: `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md`
  §9.1, §9.2, §9.3
- Calculator philosophy: `docs/CALCULATOR_PHILOSOPHY.md`
- Phase 2 commits: `6d2784f` (types), `b60d24d` (Top 50),
  `b2fc701` (VARIOKIT HD)

---

## Architektura trojitého golden testu

```
┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  TZ.pdf fakta   │ ↔│  B3 extracted    │ ↔│  TKP/VL4 normy   │
│  (ground truth) │   │  (parser output) │   │  (expected rules)│
└────────┬────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                     │                       │
         └─────────────────────┼───────────────────────┘
                               ▼
                    3 druhy chyb detekovány:
                    • Parser error (TZ ≠ B3)
                    • Calculator error (B3 ≠ TKP)
                    • Norm violation (TZ ≠ TKP)
```

Každý assert block níže má formát:

```yaml
id: SO203-CAT-NN
description: "..."
tz_fact:
  source: "TZ_SO203.pdf §X.Y"
  value: ...
b3_check:
  source: "26-0XXC_extracted.json"
  path: "json.path.expression"
  expected_match: true
tkp_check:
  source: "TKP17_2022_04_extracted.json"  # či jiná
  section: "..."
  expected_value: ...
calc_assertion:
  element: "..."
  input: {...}
  expected_output: ...
  bug_ref_if_mismatch: "#N"
```

---

## Section A — Identifikace stavby (TKP01 + TKP02)

```yaml
- id: SO203-A-01
  description: "Stavba je SO203 mostního objektu na pozemní komunikaci I/6"
  tz_fact:
    source: "TZ §1.1, §1.3"
    so_number: "SO203"
    road_category: "I/6"
    stavba: "D6 Karlovy Vary – Olšová Vrata"
    stupen_dokumentace: "PDPS VD-ZDS"
  b3_check:
    source: "TO_BE_MAPPED/26-0XXC_extracted.json"
    path: "$.identification.so_number"
    expected_match: "SO203"
  tkp_check:
    source: "TKP01_2022_04_extracted.json"
    section: "Všeobecné podmínky — identifikační údaje"
    rule: "Každý objekt musí mít unikátní SO identifikátor + stavbu + stupeň"
  calc_assertion:
    element: "object_header"
    required_fields: [so_number, stavba, stupen_dokumentace, kraj, obec]
    all_present: true

- id: SO203-A-02
  description: "Kategorie převáděné komunikace"
  tz_fact:
    source: "TZ §1.3"
    category: "MS 4d -/19.5/80"
  tkp_check:
    source: "TKP02_2022_04_extracted.json"
    section: "Kategorie pozemních komunikací"
    rule: "MS 4d = místní sběrná 4-pruhová, návrhová rychlost 80 km/h"
```

---

## Section B — Zemní práce (TKP03) a přechodové oblasti (TKP15 + ČSN 73 6244)

```yaml
- id: SO203-B-01
  description: "Výkopy pro pilíře P4, P5 levého mostu — pažení"
  tz_fact:
    source: "TZ §6.2"
    piliere_pazene: [P4_LM, P5_LM, P4_PM]
    pazeni_typ: "štětovnice"
    cerpani_vody: true
  tkp_check:
    source: "TKP03_2008_07_extracted.json"
    section: "Zemní práce — stavební jámy"
    rule: "Hloubka > 1.5 m + hladina PV → pažení povinné + čerpání"
  calc_assertion:
    element: "zaklady_piliru"
    input: {location: "P4_PM", gwt_near_base: true, depth_m: 3}
    expected_needs_pazeni: true
    expected_pumping_cost: true

- id: SO203-B-02
  description: "Přechodová oblast typ B.7 dle ČSN 73 6244"
  tz_fact:
    source: "TZ §6.6.1"
    typ: "obr. B.7 s přechodovou deskou"
    pd_delka_m: 6.0
    pd_tloustka_mm: 350
    pd_beton: "C25/30 XF2"
    podkladni_beton: "C12/15 X0 tl. 100 mm"
    zasyp_ID: 0.85
    rubova_drenaz_dn: 150
    rubova_drenaz_sklon_min_percent: 3
  tkp_check:
    source: "TKP15_2021_02_extracted.json"
    section: "Mosty a lávky — přechodové konstrukce"
    csn_ref: "ČSN 73 6244 čl. 5.1, 5.2, 5.3, 5.6"
  calc_assertion:
    element: "prechodova_deska"
    expected_dimensions: {length_m: 6.0, thickness_mm: 350}
    expected_concrete: "C25/30_XF2"
```

---

## Section C — Založení a piloty (TKP17 + TKP18 + TKP22 + TKP24 + TKP28)

### C.1 Parametry pilot

```yaml
- id: SO203-C-01
  description: "Piloty Ø1200 mm, beton C30/37 XA2, ocel B500B"
  tz_fact:
    source: "TZ §6.3.2"
    diameter_mm: 1200
    concrete: "C30/37"
    exposure: "XA2"
    steel: "B500B"
    total_count: 160
    pile_groups:
      - {locations: "OP1, OP6 LM+PM", length_m: 16.5, count: 48}
      - {locations: "P2, P3, P4_LM, P5_LM LM+PM + P2, P3 PM", length_m: 16.5, count: 84}
      - {locations: "P4_PM, P5_PM", length_m: 10.5, count: 28}
  b3_check:
    source: "TO_BE_MAPPED/26-0XXC_extracted.json"
    path: "$.foundation.piles[*]"
    must_contain_groups: 3
    must_aggregate_total: 160
  tkp_check:
    - source: "TKP17_2022_04_extracted.json"
      section: "Beton pro zvláštní prostředí XA2"
      rule: "XA2 → min. C30/37, min. cement 320 kg/m³, krytí ≥ 50 mm"
    - source: "TKP24_2003_12_extracted.json"
      section: "Piloty vrtané — provádění"
      rule: "Piloty v agresivní vodě XA2 vrtané pod ochrannou výpažnicí"
    - source: "TKP22_2022_06_extracted.json"
      section: "Geotechnika — piloty v podzemní vodě"
      rule: "HPV < 2 m pod terénem → casing povinné"
  calc_assertion:
    element: "pilota"
    input: {diameter_mm: 1200, length_m: 16.5, count: 12, gwt: true}
    expected_casing: true
    expected_rebar_kg_per_m3: 80  # CURRENT DEFAULT 40 — bug #13 from SO-202
    expected_concrete_cover_mm: 60  # XA2 = 50 + tolerance 10

- id: SO203-C-02
  description: "Mix pile lengths v jednom SO — 16.5 m hlavní, 10.5 m pro P4/P5 PM"
  tz_fact:
    source: "TZ §6.3.2 tabulka"
    mixed_lengths_within_so: true
    lengths_m: [16.5, 10.5]
    reason: "P4/P5 PM mají vyšší základovou spáru díky granitům v podloží"
  calc_assertion:
    element: "pilota"
    input: {pile_groups: [{len: 16.5, n: 132}, {len: 10.5, n: 28}]}
    expected_schedule: "per-group, ne průměr"
    expected_volume_m3: 132 * 18.66 + 28 * 11.88  # = 2795.6 m³
    bug_ref_if_calc_averages: "#26 new from SO-203"
```

### C.2 Technologie provádění pilot (TKP24)

```yaml
- id: SO203-C-03
  description: "Sled vrtání pilot, protokol, zkoušky"
  tz_fact:
    source: "TZ §6.3.3"
    norms: ["ČSN EN 1536+A1", "TKP 16 — Piloty a podzemní stěny"]
    note: "TZ odkazuje na TKP 16 (staré označení pro piloty) — v aktuálním systému TKP24"
    casing: "ocelové zámkové pažnice, předstih dle zastižených poměrů"
    cleaning_paty: "šapa"
    vyztuz_ukonceni_ode_dna_mm: 100
    betonaz: "licí roura"
    overpouring_min_m: 0.50
    bourani_hlavy_po_zatvrdnuti: true
    bourani_nad_podkladni_beton_mm: 30
  tkp_check:
    source: "TKP24_2003_12_extracted.json"
    sections_applicable:
      - "Provádění vrtaných pilot"
      - "Betonáž pod hladinou podzemní vody"
      - "Převzetí a zkoušky integrity"
    rules:
      - "Čištění paty šapou povinné"
      - "Overpouring min. 0.5 m nad podkladním betonem"
      - "Protokol o každé pilotě"
    note: "Aktuální TKP24 nahrazuje starší TKP16 citovanou v TZ — parser musí mapovat"
  calc_assertion:
    element: "pilota"
    expected_overpouring_m: 0.5
    expected_productivity_pilot_per_shift_D1200_gwt_cased: 1.0
    expected_heads_per_shift_D1200: 2

- id: SO203-C-04
  description: "Zkoušky integrity pilot — CHA + PIT"
  tz_fact:
    source: "TZ §6.3.3"
    cha_distribution: "2 + 2 (LM+PM) per podpěra × 6 podpěr + 3 u křídel SDP"
    cha_total: 27
    cha_armokos_vybaveni: "4 trubky dle VL4 210.01"
    pit_total_formula: "všechny piloty mínus CHA = 160 − 27 = 133"
  tkp_check:
    source: "TKP28_2022_12_extracted.json"
    section: "Zkoušení — integrita pilot"
    rule: "CHA u min. 2 pilot na každou podpěru + dle rozhodnutí projektanta"
  vl4_check:
    source: "VL_4_2021_Mosty_markdown.md"
    section: "210.01 Vybavení armokoše pro CHA"
    rule: "4 trubky pro ultrazvukové měření v armokoši"
  b3_check:
    source: "TO_BE_MAPPED"
    path: "$.piles.integrity_tests"
    expected_cha_count: 27
    expected_pit_count: 133
  calc_assertion:
    element: "pilota"
    expected_cha_cost_formula: "27 × 40000"  # = 1 080 000 Kč
    expected_pit_cost_formula: "133 × 5000"  # =   665 000 Kč
```

---

## Section D — Spodní stavba (TKP18 + TKP17)

```yaml
- id: SO203-D-01
  description: "Opěry OP1, OP6 — masivní monolitické"
  tz_fact:
    source: "TZ §6.4.1"
    sestavy: ["základ", "dřík s úložným prahem", "závěrná zídka", "zavěšená rovnoběžná křídla"]
    dřík_sklon_prah_percent: 4.0
    rohy_skos_mm: "50/50"
    podkladni_beton: "C12/15 X0 tl. 150 mm"
  concrete_map:
    zaklady_opery: {grade: "C30/37", exposure: "XF1"}
    driky_opery: {grade: "C30/37", exposure: "XF4"}
    zaverna_zidka: {grade: "C30/37", exposure: "XF4"}
    kridla_opery: {grade: "C30/37", exposure: "XF4"}
    podloziskove_bloky_opery: {grade: "C30/37", exposure: "XF4"}
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Betonové mosty — spodní stavba"
      rule: "Opěry u vozovky XF4 (postřik rozmrazovacími solemi)"
    - source: "TKP17_2022_04_extracted.json"
      section: "Třídy vlivu prostředí XF"
      rule: "XF4 vyžaduje C30/37 min., provzdušnění, krytí ≥ 45 mm"
  calc_assertion:
    element: "opery_ulozne_prahy"
    input: {exposure: "XF4", grade: "C30/37"}
    expected_in_exposure_list: true  # BUG #11 — XF4 missing in current code
    expected_min_cover_mm: 45

- id: SO203-D-02
  description: "Pilíře P2-P5 — sloupové, členěné"
  tz_fact:
    source: "TZ §6.4.2"
    type: "2 sloupy na společném základovém pasu"
    zaklad_pasu_beton: "C30/37 XA2"  # POZOR: XA2 pro pilíře, ne XF1 jako opěry!
    drik_sloupu_beton: "C30/37 XF4"
    podloziskove_bloky: "C35/45 XF2"  # vyšší třída než opěry
    zaklad_sklon_od_osy_percent: 5
    podkladni_beton: "C12/15 X0 tl. 150 mm + půdor. přesah 300 mm"
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Pilíře — návrhové třídy"
      rule: "Sloupové pilíře v XA2 prostředí → C30/37 XA2 pro základy"
    - source: "TKP17_2022_04_extracted.json"
      section: "Podložiskové bloky"
      rule: "XF2 typicky C35/45 pro vyšší pevnost pod ložisky"
  calc_assertion:
    element: "zaklady_piliru"
    input: {exposure: "XA2"}
    expected_in_exposure_list: true
    expected_grade_min: "C30/37"

- id: SO203-D-03
  description: "Izolace spodní stavby — ALP+NAIP, ALP+2xALN"
  tz_fact:
    source: "TZ §6.4.3"
    izolace_rubu_opery_nad_drenazi: "ALP+NAIP + drenážní geokompozit"
    izolace_pod_drenazi: "ALP + 2× ALN"
    izolace_horni_povrch_kridel: "ALP+NAIP"
    ochrana_pod_rimsou: "asf. pás s hliníkovou vložkou, přesah 150 mm"
    izolacni_pasy_preklad_na_kridla_m: 1.0
    fabion_rohy: "cementová malta M10 dle ČSN EN 998-2"
    geotextilie_parametry: "dle TP97"
  tkp_check:
    - source: "TKP13_2008_07_extracted.json"
      section: "Izolace proti vodě"
      rule: "ALP+NAIP nad drenáží, ALP+2xALN pod drenáží"
    - source: "TKP31_2006_09_extracted.json"
      section: "Mosty — speciální vybavení, nátěry typ S2/S4"
      rule: "Obruby říms S4, NK S2, rozsah dle VL4 306.1"
  vl4_check:
    source: "VL_4_2021_Mosty_markdown.md"
    section: "306.1 Rozsah ochranných nátěrů"
```

---

## Section E — Nosná konstrukce (TKP18 — hlavní!)

```yaml
- id: SO203-E-01
  description: "NK — spojitý monolitický dvoutrám, 5 polí"
  tz_fact:
    source: "TZ §6.5"
    typ: "spojitý monolitický dodatečně předpjatý dvoutrám"
    poli: 5
    rozpeti_v_ose: [18.00, 24.00, 24.00, 24.00, 18.00]
    max_span_m: 24.00
    min_span_m: 18.00
    nk_delka_m: 109.20
    nk_sirka_lm_m: 13.10
    nk_sirka_pm_m: 12.25
    tram_vyska_m: 1.40
    tram_sirka_m: [1.60, 2.20]  # proměnná
    osova_vzdalenost_tramů_lm_m: 6.50
    osova_vzdalenost_tramů_pm_m: 5.69
    konzoly_delka_lm_m: 2.21
    konzoly_delka_pm_m: [2.15, 2.20]
    konzoly_vyska_m: [0.25, 0.45]  # proměnná
    stredova_deska_vyska_m: [0.30, 0.45]
    koncove_pricniky_sirka_m: 1.25
    beton: "C35/45"
    exposure: "XF2"
    vyztuz: "B500B"
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Betonové mosty — nosné konstrukce předpjaté"
      rule: "Dvoutrám C35/45 XF2 standardní pro rozpětí 18-30 m"
    - source: "TKP15_2021_02_extracted.json"
      section: "Mosty a lávky — obecné požadavky"
  calc_assertion:
    element: "mostovkova_deska"
    subtype: "dvoutram"
    input: {max_span: 24.0, num_fields: 5}
    expected_technology: "fixed_scaffolding"  # TZ §6.11.3, §7.3

- id: SO203-E-02
  description: "Technologie výstavby NK — pevná skruž, 1 takt"
  tz_fact:
    source: "TZ §7.2, §7.3.4, §6.11.3"
    technology: "pevná skruž"
    taktu: 1
    note: "Nosná konstrukce bude betonována v jedné etapě na pevné skruži"
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Technologie výstavby — skruže pevné a posuvné"
    decision_matrix:
      rozpeti_max_m: 24
      poli: 5
      doporucena_tech: "pevná skruž"
      alternativy: ["dílčí pevná skruž"]
      posuvna_skruz: "neefektivní pro max rozpětí ≤ 25 m"
  calc_assertion:
    element: "mostovkova_deska"
    input: {max_span: 24.0, num_fields: 5}
    expected_technology: "fixed_scaffolding"
    expected_moving_scaffolding_possible: false
    bug_ref_if_mss_recommended: "#4 from SO-202"

- id: SO203-E-03
  description: "Podélné předpětí — 16 kabelů × 15 lan"
  tz_fact:
    source: "TZ §6.5.2"
    kabely_total: 16
    kabely_per_tram: 8
    lana_per_kabel: 15
    lano_typ: "Y1860S7-15.7"
    napinani: "oboustranné"
    pevnost_napinani_min_mpa: 33
    stari_napinani_min_dny: 7
    kotevni_napeti_mpa: 1440
    pko_stupen: "PL2"
    norma_pko: "ČSN EN 1992-2 Z2"
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Předpínací výztuž"
      rule: "PL2 = plastový kanálek, standard pro mosty I. třídy"
    - source: "TKP17_2022_04_extracted.json"
      section: "Beton — pevnost pro napínání"
      rule: "fcm,cyl ≥ 33 MPa nebo ≥ 7 dní (cokoliv později)"
  calc_assertion:
    element: "mostovkova_deska"
    is_prestressed: true
    input: {cables: 16, strands: 15, tensioning: "both_sides"}
    expected_prestress_ready_days: 7
    expected_anchor_stress_mpa: 1440

- id: SO203-E-04
  description: "Ošetřování NK — třída 4 (kritické!)"
  tz_fact:
    source: "TZ §7.8.3"
    prvek: "nosná konstrukce"
    trida_osetrovani: 4
    table_min_days:
      t_ge_25: 5
      t_15_25: 9
      t_10_15: 13
      t_5_10: 18
    xf2_povinne_min_dny: "není (ale XF3/XF4 min. 7 dní vždy)"
  tkp_check:
    source: "TKP17_2022_04_extracted.json"
    section: "P10 — ošetřování a ochrana betonu"
    curing_class_4_table:
      t_ge_25_C: 5
      t_15_25_C: 9
      t_10_15_C: 13
      t_5_10_C: 18
    note: "Třída 4 pro nosné konstrukce předpjaté"
  calc_assertion:
    element: "mostovkova_deska"
    input: {exposure: "XF2", curing_class: 4, temp_C: 15}
    expected_days: 9
    current_calc_output: 5  # BUG #1 from SO-202 — class 4 not implemented
    bug_ref: "#1 CRITICAL"
```

---

## Section F — Ložiska a dilatační závěry (TKP12 + TKP22 + TKP18)

```yaml
- id: SO203-F-01
  description: "Kalotová ložiska, pevný bod P4"
  tz_fact:
    source: "TZ §6.5.3"
    typ: "kalotová"
    celkem_ks: 24  # 12 LM + 12 PM
    pevny_bod: "P4"
    zmena_vs_dusp: "posun z P2 na P4"
    rektifikace: true
    vymenitelnost: true
    kotveni: "zdvojená horní i dolní deska"
    polymerbeton_tloustka_mm: 30
    polymerbeton_min_mm: 15
    polymerbeton_odpor_ohm_m: 1e12
    polymerbeton_pevnost_mpa: 50
    izolacni_odpor_kohm_min: 5
    exc_trida: "EXC3"
    csn_ref: ["ČSN EN 1337", "TNI 73 6270"]
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Ložiska — kap. 22 TKP"
    rules:
      - "Kalotová ložiska pro mosty I. tř. — EXC3 povinné"
      - "Polymerbeton pro izolaci proti bludným proudům min. 15 mm"
      - "Izolační odpor ≥ 5 kΩ"
  calc_assertion:
    element: "lozisko"
    input: {type: "kalota", road_class: "I", bridge_type: "vozovky"}
    expected_exc_class: "EXC3"
    expected_count: 24

- id: SO203-F-02
  description: "Mostní závěry — druh 8 dle T86"
  tz_fact:
    source: "TZ §6.5.4"
    op1_typ: "povrchový lamelový druh 8"
    op1_dilatace: {pos_mm: 26, neg_mm: -70, total_mm: 96}
    op6_typ: "jednoduché těsnění spáry druh 8"
    op6_dilatace: {pos_mm: 18, neg_mm: -43, total_mm: 61}
    prostor_nk_zaverna_zidka_mm: 600
    exc_trida: "EXC3"
    elektroizolacni_uprava: true
    csn_refs: ["TKP PK kap. 19A", "ČSN 73 2603"]
  tkp_check:
    - source: "TKP12_2013_05_extracted.json"
      section: "Dilatační závěry — volba typu"
      rule: "Dilatace ≤ 80 mm → jednoduché těsnění; 80-250 mm → lamelový druh 8"
    - source: "TKP19_2015_03_extracted.json"
      section: "PKO závěrů"
      rule: "C4/C5 → IIIA + IIIE pro lamelové závěry"
  calc_assertion:
    - element: "mostni_zaver"
      input: {dilation_total_mm: 96}  # OP1
      expected_type: "povrchovy_lamelovy_druh_8"
    - element: "mostni_zaver"
      input: {dilation_total_mm: 61}  # OP6
      expected_type: "jednoduche_tesneni_druh_8"
    bug_ref_if_not_supported: "#28 from SO-203"
```

---

## Section G — Mostní svršek a vybavení (TKP13 + TKP14 + TKP25B + TKP31)

```yaml
- id: SO203-G-01
  description: "Izolace mostovky — NAIP + pečetící"
  tz_fact:
    source: "TZ §6.7.1"
    izolace_tloustka_mm: 5
    typ: "natavované asfaltové izolační pásy na pečetící vrstvu"
    preklad_na_pd_m: 1.0
    povrch_mostovky_pevnost_odtrh_mpa_min: 1.5
    priprava_povrchu: "brokování"
    ochrana_pod_rimsou: "asf. pás s hliníkovou vložkou"
    ochrana_pod_vozovkou: "litý asfalt MA11 IV tl. 40 mm"
    csn_ref: "ČSN 73 6242"
  tkp_check:
    - source: "TKP13_2008_07_extracted.json"
      section: "Izolace proti vodě — mostovky"
      rule: "NAIP 5 mm + pečetící vrstva = standard pro silnice I. třídy"
    - source: "TKP18_2022_05_extracted.json"
      section: "Mostovky — povrchová úprava"
  calc_assertion:
    element: "izolace_mostovky"
    expected_thickness_mm: 5
    expected_bond_strength_mpa_min: 1.5

- id: SO203-G-02
  description: "Vozovka — dvouvrstvá tl. 85 mm"
  tz_fact:
    source: "TZ §6.7.3"
    tloustka_celkem_mm: 85
    vrstvy:
      - {nazev: "SMA 11S", tloustka_mm: 40, norma: "ČSN EN 13108-5"}
      - {nazev: "MA 11 IV", tloustka_mm: 40, norma: "ČSN EN 13108-6"}
      - {nazev: "PS modifikovaný", mnozstvi_kg_m2: 0.35, norma: "ČSN 73 6129"}
      - {nazev: "NAIP + pečetící vrstva", tloustka_mm: 5}
  tkp_check:
    - source: "TKP07_2021_10_extracted.json"
      section: "Hutněné asfaltové vrstvy"
      rule: "SMA 11S jako obrusná vrstva dle TDZ S"
    - source: "TKP08_2013_05_extracted.json"
      section: "(nepoužito — beton. kryt)"
    note: "Dvouvrstvá konstrukce vozovky — POZOR srovnání se SO-207 (třívrstvá 135 mm)"
  calc_assertion:
    element: "vozovka"
    input: {object: "SO203"}
    expected_thickness_mm: 85
    expected_layers_count: 3  # SMA + MA + NAIP

- id: SO203-G-03
  description: "Římsy — monolitické, vnější 1.70 m + vnitřní"
  tz_fact:
    source: "TZ §6.7.5"
    beton: "C30/37 XF4"
    vyztuz: "B500B"
    vnejsi_rimsa_sirka_m: 1.70
    vnitrni_rimsa_lm_sirka_m: 1.10
    vnitrni_rimsa_pm_sirka_m: 0.80
    revisni_chodnik_sirka_m: 0.75
    obruba_vyska_mm: 150
    obruba_sklon: "5:1"
    smrstovaci_spary_vzdalenost_m: 6
    ochranny_nater_obruby: "typ S4 dle TKP31 tab. 5"
    stredova_rimsa_lm_chranicky: "6 ks HDPE Ø110/94"
    stredova_rimsa_pm_vozovkove_sondy: "kabelová komora 300x300 mm"
  tkp_check:
    - source: "TKP18_2022_05_extracted.json"
      section: "Římsy monolitické — návrh"
    - source: "TKP31_2006_09_extracted.json"
      section: "Tab. 5 Ochranné nátěry"
      rule: "S4 pro obruby říms, S2 pro NK"
    - source: "TKP17_2022_04_extracted.json"
      section: "P10 ošetřování — třída 4 pro římsy"
  vl4_check:
    source: "VL_4_2021_Mosty_markdown.md"
    section: "402.11 Vyvedení kabelových chrániček u opěr"
  calc_assertion:
    element: "rimsa"
    input: {exposure: "XF4", curing_class: 4, temp_C: 15}
    expected_days: 9
    bug_ref_if_5: "#1 from SO-202"

- id: SO203-G-04
  description: "Svodidla ocelová — H3 (W4)"
  tz_fact:
    source: "TZ §6.7.8"
    vnejsi_svodidla: {uroven_zadrzeni: "H3", working_width: "W4"}
    vnitrni_zabradelni_svodidla: {uroven_zadrzeni: "H3", plotovy_nastavec_vyska_m: 1.6}
    elektroizolacni_uprava: true
    kotveni: "chemické / rozpěrné / kotevní přípravek dle TPV"
    max_vrt_rimsy_mm: 170
    max_vrt_stredova_rimsa_lm_mm: 140
    csn_ref: "výkres opakovaných řešení R plán R116"
  tkp_check:
    source: "TKP25B_2024_06_extracted.json"
    section: "Svodidla — úrovně zadržení"
    rule: "H3 (W4) povinné pro D + I. třídy silnic"
    pko_ref: "TKP19B — IIIA + IIIE"
  calc_assertion:
    element: "svodidlo"
    input: {road_class: "I", bridge: true}
    expected_h_level: "H3"
    expected_w_level_min: "W4"

- id: SO203-G-05
  description: "Odvodnění mostu — MO 500x500, DN200 GRP"
  tz_fact:
    source: "TZ §6.7.11"
    mo_rozmer_mm: "500x500"
    mo_vzdalenost_m: 24
    sberny_potrubi_material: "GRP (sklolaminát) DN200"
    odolnost: "CHRL + UV"
    zaveseni_osa: "pod pravou konzolou NK"
    prostup: "v závěrné zídce OP1"
    drenaz_v_uzlabi_rozmer_mm: "150 × 40"
    pricna_zebra_vzdalenost_m: 6
  hydrotech_ref:
    source: "TZ Příloha č. 1 Hydrotechnický výpočet"
    intenzita_deste_pro_rsd: "200 l·s⁻¹·ha⁻¹"  # ne průměr 195
  tkp_check:
    - source: "TKP04_2008_07_extracted.json"
      section: "Odvodnění pozemních komunikací"
    - source: "TKP18_2022_05_extracted.json"
      section: "Mostní odvodňovače"
  calc_assertion:
    element: "odvodneni_mostu"
    input: {rain_intensity_l_s_ha: 200}
    expected_mo_spacing_m: 24
```

---

## Section H — PKO a ochrana před bludnými proudy (TKP19 + TP124)

```yaml
- id: SO203-H-01
  description: "PKO ocelových konstrukcí — atmosféra C4/C5"
  tz_fact:
    source: "TZ §6.10.1"
    atmosfera: "C4 lokálně C5"
    norma: "ČSN EN ISO 9223"
    zivotnost: "velmi vysoká pro ložiska / vysoká pro závěry, svodidla"
    norma_zivotnosti: "ČSN EN ISO 12944-2"
    povlaky:
      loziska: "IA + I speciál"
      mostni_zavery: "IIIA + IIIE + TP86"
      svodidla_sloupky: "IIIA"
      svodidla_svodnice_distancni: "IIIE"
  tkp_check:
    source: "TKP19_2015_03_extracted.json"
    section: "Protikorozní ochrana — tabulka povlaků"
    csn_refs: ["ČSN EN ISO 12944-2", "ČSN EN ISO 9223", "ČSN EN ISO 1461"]
  calc_assertion:
    element: "pko_katalog"
    input: {atmosphere: "C4", lifetime: "very_high", component: "lozisko"}
    expected_coating: "IA + I speciál"

- id: SO203-H-02
  description: "Ochrana proti bludným proudům — TP124 stupeň 3"
  tz_fact:
    source: "TZ §6.10.3"
    stupen: 3
    primarni_ochrana: "dle čl. 5.2 TP124"
    sekundarni_ochrana: "ochranné nátěry spodní stavby"
    konstrukcni_opatreni: "min. krytí dle TKP18 + izolační dilatace svodidel/zábradlí"
    merici_vyvody: false
    provareni_vyztuze: false
    mereni_behem_vystavby: false
    mereni_po_vystavbe: false
    demz: false
    note: "3. stupeň = bez měření, bez provaření, bez DEMZ"
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Ochrana před bludnými proudy — odkaz na TP124"
    rules:
      "3_stupen":
        "provaření": false
        "DEMZ": false
      "4_stupen":
        "provaření": true
        "DEMZ": true
    note: "Rozdíl 3 vs 4 stupeň = VÝZNAMNÝ cost impact (5-10% spodní stavba)"
  calc_assertion:
    element: "object_attributes"
    input: {object: "SO203"}
    expected_tp124_level: 3
    expected_rebar_welding: false
    expected_demz_required: false
    bug_ref_if_not_first_class: "#27 from SO-203"
```

---

## Section I — Geodetická sledování (TKP28 + M10 ŘSD + VL4)

```yaml
- id: SO203-I-01
  description: "Nivelační značky — spodní stavba + římsy"
  tz_fact:
    source: "TZ §6.11"
    znacky_spodni_stavba_ks: 24  # 2×4 opěry + 4×4 pilíře
    znacky_rimsy_ks: 44  # 11 × 4
    vl4_ref: "509.01"
    stredodatna_vyskova_odchylka_mm: 1
  vl4_check:
    source: "VL_4_2021_Mosty_markdown.md"
    section: "509.01 Nivelační značky"
  tkp_check:
    source: "TKP28_2022_12_extracted.json"
    section: "Zkoušení — geodetické sledování"
  calc_assertion:
    element: "geodet_sledovani"
    input: {object: "SO203", num_fields: 5, num_podper: 6}
    expected_znacky_spodni_stavba: 24
    expected_znacky_rimsy: 44

- id: SO203-I-02
  description: "Zatěžovací zkouška — projektant nepožaduje"
  tz_fact:
    source: "TZ §6.12"
    pozadavek: false
    rozhodnutí_investora: true
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Zatěžovací zkoušky — kdy vyžadovat"
    rule: "Pro běžné mosty I. třídy do 120 m není standardně nutná"
```

---

## Section J — Výstavba, mikrosítě, materiály (TKP01A + TKP17)

```yaml
- id: SO203-J-01
  description: "Prováděcí třída"
  tz_fact:
    source: "TZ §7.1"
    trida: 3
    norma: "TKP18"
  tkp_check:
    source: "TKP18_2022_05_extracted.json"
    section: "Prováděcí třídy"
    rule: "Třída 3 pro monolitické předpjaté mosty I. tř."

- id: SO203-J-02
  description: "Mikrosíť — 6 bodů"
  tz_fact:
    source: "TZ §7.6"
    pocet_bodu: 6
    predpis: "PPK-BOD"
  tkp_check:
    source: "TKP01A_2024_06_extracted.json"
    section: "Vytyčovací sítě mostních objektů"

- id: SO203-J-03
  description: "Požadavky na materiály — vhodnost"
  tz_fact:
    source: "TZ §7.7"
    predpisy:
      - "NV č. 215/16 Sb."
      - "NKvPP(EU) č. 568/2014"
      - "NKvPP(EU) č. 574/2014"
      - "NEPaR(EU) č. 1907/2006"
      - "NEPaR(EU) č. 305/2011"
      - "SJ-PK části II/5"
  tkp_check:
    source: "TKP01_2022_04_extracted.json"
    section: "Dokladování vhodnosti materiálů — SJ-PK"

- id: SO203-J-04
  description: "Přesnost vytyčování — mezní odchylky"
  tz_fact:
    source: "TZ §7.9"
    norma: "ČSN 73 0420-1 a -2"
    kategorie_objektu: "C"
    mezni_odchylky_tkp1_priloha_9:
      vrtane_piloty_polohove_d_le_1m: 100  # mm
      vrtane_piloty_polohove_d_1_1_5m: "0.1 × D"
      vrtane_piloty_sklon_svisla: "0.02 m/m"
      spodni_stavba_opery_smer_mm: 20
      spodni_stavba_pilire_smer_mm: 20
      nk_predpjata_smer_mm: 20
      rimsy_smer_mm: 15
  tkp_check:
    source: "TKP01_2022_04_extracted.json"
    section: "Příloha 9 — mezní odchylky"
    csn_refs: ["ČSN 73 0420-1", "ČSN 73 0420-2", "ČSN 73 0212-4"]
```

---

## Section K — Normy a předpisy (CROSS-REFERENCE s TKP Inventář)

```yaml
norms_cited_in_tz:
  - {code: "ČSN EN 1991-2 ed. 2", scope: "Zatížení mostů dopravou", tkp_ref: "TKP18"}
  - {code: "ČSN EN 1992-2 Z2", scope: "Navrhování betonových mostů", tkp_ref: "TKP18"}
  - {code: "ČSN EN 1997-1", scope: "Navrhování geotechnických konstrukcí", tkp_ref: "TKP22"}
  - {code: "ČSN EN 1998-1", scope: "Seismika", tkp_ref: "TKP22"}
  - {code: "ČSN EN 206+A2", scope: "Beton — specifikace", tkp_ref: "TKP17"}
  - {code: "ČSN 42 0139", scope: "Betonářská výztuž B500B", tkp_ref: "TKP17"}
  - {code: "ČSN EN 10080", scope: "Výztužná ocel", tkp_ref: "TKP17"}
  - {code: "ČSN EN 10138", scope: "Předpínací výztuž Y1860S7", tkp_ref: "TKP18"}
  - {code: "ČSN EN 10025", scope: "Ocel S235", tkp_ref: "TKP19"}
  - {code: "ČSN EN 1536+A1", scope: "Vrtané piloty", tkp_ref: "TKP24"}
  - {code: "ČSN EN 13108-5", scope: "SMA 11", tkp_ref: "TKP07"}
  - {code: "ČSN EN 13108-6", scope: "Litý asfalt MA 11", tkp_ref: "TKP07"}
  - {code: "ČSN EN 13163", scope: "Pěnový polystyren EPS", tkp_ref: "TKP22"}
  - {code: "ČSN EN 13164", scope: "Extrudovaný polystyren XPS", tkp_ref: "TKP22"}
  - {code: "ČSN EN 13285", scope: "Štěrkodrť ŠDA", tkp_ref: "TKP05"}
  - {code: "ČSN EN 13670", scope: "Provádění betonových konstrukcí", tkp_ref: "TKP17"}
  - {code: "ČSN EN 13808", scope: "Asfaltové emulze", tkp_ref: "TKP07"}
  - {code: "ČSN 73 0212-4", scope: "Geometrická přesnost - liniové stavby", tkp_ref: "TKP01"}
  - {code: "ČSN 73 0420-1, -2", scope: "Přesnost vytyčování", tkp_ref: "TKP01"}
  - {code: "ČSN 73 2603", scope: "Provádění ocel. konstrukcí EXC3", tkp_ref: "TKP19"}
  - {code: "ČSN 73 6121", scope: "SMA v konstrukci vozovky", tkp_ref: "TKP07"}
  - {code: "ČSN 73 6122", scope: "Litý asfalt ve vozovce", tkp_ref: "TKP07"}
  - {code: "ČSN 73 6129", scope: "Spojovací postřiky", tkp_ref: "TKP07"}
  - {code: "ČSN 73 6133", scope: "Návrh a provádění zemního tělesa", tkp_ref: "TKP03"}
  - {code: "ČSN 73 6201", scope: "Prostorové uspořádání mostů", tkp_ref: "TKP18"}
  - {code: "ČSN 73 6203", scope: "Provedení mostních ložisek EXC3", tkp_ref: "TKP22"}
  - {code: "ČSN 73 6242", scope: "Izolace mostovek", tkp_ref: "TKP13"}
  - {code: "ČSN 73 6244", scope: "Přechody mostů", tkp_ref: "TKP15"}
  - {code: "ČSN 73 6270", scope: "Mostní ložiska — měření", tkp_ref: "TKP22"}
  - {code: "TNI 73 6270", scope: "Ložiska — technické informace", tkp_ref: "TKP22"}
  - {code: "ČSN 03 8372", scope: "Korozní agresivita vůči kovům", tkp_ref: "TKP19"}
  - {code: "ČSN 03 8375", scope: "Chemické působení vody na ocel", tkp_ref: "TKP19"}
  - {code: "TP 86", scope: "Mostní závěry — specifikace", tkp_ref: "TKP12"}
  - {code: "TP 97", scope: "Geotextilie", tkp_ref: "TKP13"}
  - {code: "TP 107", scope: "Intenzita deště", tkp_ref: "TKP04"}
  - {code: "TP 124", scope: "Ochrana proti bludným proudům", tkp_ref: "TKP18+19"}
  - {code: "TP 193", scope: "Svařování betonářské výztuže", tkp_ref: "TKP17"}
  - {code: "TP 231", scope: "Ošetřování betonu", tkp_ref: "TKP17"}
```

**Assertion:** parser musí extrahovat VŠECH 37 citovaných norem/předpisů a zmapovat je na TKP inventář.

---

## Section L — Plná mapa TKP vs. prvky SO-203

| TKP | Kapitola | Aplikuje se na SO-203 prvek | Frequency (occurrences in TZ) |
|---|---|---|---|
| TKP01 | Všeobecné | object_header, vytyčování, materiály | 5× |
| TKP01A | Příloha všeobecných | mikrosíť | 1× |
| TKP02 | Pozemní komunikace | kategorie MS 4d | 1× |
| TKP03 | Zemní práce | výkopy OP, pilíře | 3× |
| TKP04 | Odvodnění | MO, sběrné potrubí, dešťová kanal. | 2× |
| TKP05 | Podkladní vrstvy | ŠDA štěrkopísek v přech. obl. | 2× |
| TKP06 | Nestmelené vrstvy | — | 0 (v SO203 ne) |
| TKP07 | Hutněné asfaltové vrstvy | vozovka SMA + MA | 3× |
| TKP08 | Cementobetonové kryty | — | 0 |
| TKP09 | Kamenivo | kamenná dlažba úpravy pod mostem | 1× |
| TKP10 | Ocelové mosty | — | 0 (SO-203 je beton.) |
| TKP11 | Dřevěné mosty | — | 0 |
| TKP12 | Dilatační závěry | OP1 (lamel), OP6 (jedn. těsnění) | 2× |
| TKP13 | Izolace proti vodě | izolace mostovky, NAIP, ALP | 3× |
| TKP14 | Protihlukové stěny | — | 0 (SO-203 nemá PHS) |
| TKP15 | Mosty a lávky | přechod. desky, obecné | 4× |
| TKP16 | Gabiony / geosynt. | — | 0 |
| **TKP17** | **Beton** | **VŠECHNY betonové prvky** | **15×+** |
| **TKP18** | **Betonové mosty** | **CELÁ NK, spodní stavba** | **20×+** |
| TKP19 | PKO | ložiska, MZ, svodidla, zábradlí | 6× |
| TKP20 | Železniční svršek | — | 0 |
| TKP21 | Železniční spodek | — | 0 |
| TKP22 | Geotechnika | piloty, ložiska, seismika | 5× |
| TKP23 | Tunely | — | 0 |
| **TKP24** | **Zvláštní zakládání** | **Piloty vrtané** | **4×** |
| TKP25A | Protihlukové stěny A | — | 0 |
| TKP25B | Svodidla B | svodidla H3 | 2× |
| TKP26 | Směrové sloupky | — | 0 (v převáděné komunikaci) |
| TKP27 | Značení | dopravní značení | 1× |
| **TKP28** | **Zkoušení** | **Integrita pilot CHA/PIT, geodet** | **3×** |
| TKP29 | Ozelenění | svahy pod mostem | 1× |
| TKP30 | Telematika | SO49x DIS-SOS chráničky | 1× |
| **TKP31** | **Mosty — speciální** | **Ochranné nátěry S2/S4** | **2×** |
| TKP32 | Lícové zdivo | — | 0 |
| TKP33 | Kabelové trasy | DIS-SOS | 1× |
| **VL4** | **Vzorové listy mosty** | **Detaily — 509.01, 306.1, 210.01, 402.11** | **10×+** |

**Tier of importance for SO-203:**

- **Tier 1 (Critical, ≥ 10 refs):** TKP17, TKP18, VL4
- **Tier 2 (Primary, 3-9 refs):** TKP01, TKP19, TKP22, TKP24, TKP12, TKP13, TKP15, TKP28
- **Tier 3 (Secondary, 1-2 refs):** TKP02, TKP03, TKP04, TKP05, TKP07, TKP09, TKP25B, TKP27, TKP29, TKP30, TKP31, TKP33, TKP01A
- **Tier 4 (N/A):** TKP06, TKP08, TKP10, TKP11, TKP14, TKP16, TKP20, TKP21, TKP23, TKP25A, TKP26, TKP32

**Golden test coverage:** all Tier 1-3 must have at least 1 assertion block per object.

---

## Section M — Známé bugy parseru / kalkulátoru (inherited + new)

```yaml
bugs_inherited_from_SO_202:
  - {id: "#1", severity: "CRITICAL", component: "calculator.curing", summary: "Třída ošetřování 4 neimplementována — NK a římsy dostávají 5 dní místo 9"}
  - {id: "#2", severity: "CRITICAL", component: "wizard.step2", summary: "Curing hint ignoruje exposure class"}
  - {id: "#3", severity: "CRITICAL", component: "wizard.steps", summary: "Mostní params pouze v step 5"}
  - {id: "#4", severity: "MEDIUM", component: "bridge_tech.recommendation", summary: "MSS floor 25 m — pro SO-203 (max span 24 m) OK, ale pro SO-207 problém"}
  - {id: "#11", severity: "CRITICAL", component: "exposure_list.opery", summary: "XF4 chybí → falsepositive warning"}
  - {id: "#12", severity: "CRITICAL", component: "exposure_list.driky", summary: "XF2 chybí v driky_piliru"}
  - {id: "#13", severity: "CRITICAL", component: "pilota.rebar_default", summary: "40 kg/m³ — pro Ø1200 bridge pile má být ~80-100"}
  - {id: "#14", severity: "CRITICAL", component: "calculator.curing", summary: "Třídy 2/3/4 obecně neimplementovány"}

bugs_new_from_SO_203:
  - {id: "#26", severity: "HIGH", component: "pilota.mix_lengths", summary: "Mix délek pilot (16.5 m + 10.5 m) v jednom SO — calculator musí schedule per-group, ne průměr"}
  - {id: "#27", severity: "HIGH", component: "object.tp124_level", summary: "tp124_level není first-class atribut — rozdíl 3 vs 4 drastickyovlivňuje cenu"}
  - {id: "#28", severity: "MEDIUM", component: "mostni_zaver.type_selection", summary: "Volba druh 8 lamelový vs jednoduché těsnění dle dilatace není v kalkulátoru"}
  - {id: "#29", severity: "MEDIUM", component: "bearing.fixed_point", summary: "Poloha pevného bodu (P4 pro SO-203) ovlivňuje typy ložisek (pevné vs pohyblivé)"}
  - {id: "#30", severity: "MEDIUM", component: "object.geotech_category", summary: "Geotechnická kategorie neextrahována — ovlivňuje CHA počty"}
  - {id: "#31", severity: "MEDIUM", component: "prestress.cable_size", summary: "Různé počty lan per kabel (15 vs 19) ovlivňuje injektáž"}
  - {id: "#32", severity: "LOW", component: "bridge.different_stavebni_vyska", summary: "LM 1.444 m vs PM 2.041 m — různá tloušťka desky"}

bugs_new_from_SO_203_specific:
  - {id: "#50", severity: "HIGH", component: "parser.tkp_alias", summary: "TZ cituje 'TKP 16' pro piloty — v aktuálním TKP inventáři je to TKP24. Parser musí normalizovat aliasy."}
  - {id: "#51", severity: "MEDIUM", component: "parser.vl4_refs", summary: "Odkazy 509.01, 306.1, 210.01, 402.11 musí být dereferencovány na VL_4_2021_Mosty.md"}
  - {id: "#52", severity: "HIGH", component: "parser.span_pattern", summary: "Regex pro '18.00 + 3 × 24.00 + 18.00' musí expandovat na [18, 24, 24, 24, 18]"}
  - {id: "#53", severity: "MEDIUM", component: "parser.subdocument_link", summary: "Hydrotechnický výpočet (Příloha 1) a geotech. pasport (Příloha 2) jsou sub-dokumenty, které parser musí linkovat"}
  - {id: "#54", severity: "LOW", component: "parser.cha_formula", summary: "CHA počet '2+2 per podpěra × 6 + 3 křídla = 27' — composite formula extraction"}
```

---

## Section N — Execution plan

```bash
# Run three-way golden check
python tools/golden_runner.py \
  --object SO203 \
  --tz-pdf inputs/SO-203_TZ_PDPS.pdf \
  --b3-extracted app/knowledge_base/B3_current_prices/extracted_data/26-0XXC_extracted.json \
  --tkp-base STAVAGENT/extracted_data/ \
  --vl4 app/knowledge_base/B2_csn_standards/VL_4_2021_Mosty_markdown.md \
  --output reports/SO203_golden_report.json

# Expected exit codes:
#   0 = all asserts pass
#   1 = parser errors (TZ ≠ B3)
#   2 = calculator errors (B3 ≠ TKP)
#   3 = norm violations (TZ declares something TKP forbids)
#   4 = missing KB entries (TKP file not found / section not extracted)
```

**End of SO-203 golden test v2.**
