# Phase 0 Audit — Calculator Resource Ceiling

**Branch:** `claude/competitive-audit-stavagent-hfgwP`
**Datum:** 2026-05-07
**Mode:** read-only inventory + gap analysis (no calculator/classifier changes)
**Trigger:** TASK Calculator Resource Ceiling — Element-by-Element Rewrite (§3 PRE-IMPLEMENTATION INTERVIEW dokončený, §4 PHASE 0 AUDIT)
**Output:** tento dokument; ŽÁDNÝ kód, ŽÁDNÉ rozšíření engine, ŽÁDNÉ změny knowledge_base.
**Gate 0 acceptance:** PR pouze s tímto dokumentem.

---

## §0 Decisions z interview (souhrn pro audit)

| Otázka | Odpověď | Důsledek pro audit |
|--------|---------|-------------------|
| Datový model stropu | **Union + relevance flags** | Hledám 1 schema místo 23 schemat; relevance flags musí být per element type |
| Infeasible handling | **Warning + best-effort plán** s ⛔ KRITICKÉ | Engine vrací plán + structured warnings; current `warnings` API extension |
| Granularita | **Per-profession + total** | Strop = celkem + volitelný breakdown {tesaři, železáři, betonáři, vibrátoři, finišéři, řízení} |
| KB lookup | **Single source of truth (B4)** | Hardcoded `REBAR_RATES_MATRIX`, brigáda defaults, productivity rates → audit označí, čištění v Phase 1+ |
| No-ceiling default | **Auto-fill defaults z KB** + banner | UI banner "Použity typické zdroje pro X. Upravit?" — defaults z B4 |
| UI placement | **Extend Expert panel** | `CalculatorFormFields.tsx` Expert section — žádný nový Wizard step, žádná samostatná sekce |

---

## §1 Knowledge_base inventory (B0–B9)

### §1.1 Co tam je dnes

| Kategorie | Aktuální stav | Strojově čitelný? | Co obsahuje pro resource ceiling |
|-----------|---------------|-------------------|----------------------------------|
| `B0_sources/` | ❓ neověřeno (skupina 1 listing nedosáhl) | n/a | Originální PDF zdroje |
| `B1_otkskp_codes/` | dir existuje | unknown | OTSKP catalog (17 904 položek) |
| `B1_rts_codes/` | dir existuje | unknown | RTS catalog |
| `B1_urs_codes/` | dir existuje | unknown | URS catalog (39 000+) |
| `B2_csn_standards/` | dir existuje (audit `2026-05-06_b2_and_docs_bridge_ingest_audit.md` zachytil 7 PDF + 1 DOC k 2026-05-06) | mixed (PDF + 1 DOC nečitelný bez pandoc) | ČSN normy |
| `B3_current_prices/` | dir existuje | unknown | Aktuální tržní ceny |
| `B4_production_benchmarks/` | **✅ rich content** (viz §1.2) | **✅ JSON** | productivity_rates.json, bedneni.json, Berger ceniky 2026 |
| `B5_tech_cards/` | 30+ subdirs, **všechny `source_pointer.md` only** | ❌ pointers, ne extracted YAML | PERI vendor manuals + general (3F TP, monolit_tp01, příručka) |
| `B6_research_papers/` | dir existuje | unknown | Univerzitní skripta, fib bulletiny, ACI |
| `B7_regulations/` | 6 subdirs (viz §1.3) | mixed | ČSN 73 6222, ČSN 73 6244, ČSN EN 206, EN 1992-2, TKP 04, VL 4 mosty |
| `B8_company_specific/` | dir existuje | unknown | Vlastní firemní postupy |
| `B9_Equipment_Specs/` | dir existuje | unknown | Specifikace zařízení |
| `B9_validation/` | 1 subdir `lifecycle_durability` | unknown | Cross-validation rules |

### §1.2 B4_production_benchmarks — co je strojově čitelné

**Soubory v root:**
- `productivity_rates.json` (source: "praktická zkušenost z realizovaných projektů", 2025-01-07, **CZK / 2025**)
- `bedneni.json` (klíče: `_meta`, `systemy`, `faktory_jerab`, `faktory_pocasi`, `faktory_opakovani`, `zrani_betonu`, `slozitost_korekce`, `brigady`, `rychlostni_prehled`, `usage_guidelines`)
- `construction_productivity_norms.json` (norm-based productivity)
- `berger_cenik_mechanizace_pracovnici_2026.json`
- `berger_mala_mechanizace_cenik_2026.json`
- `berger_sazba_mechanizmu_2026.json`
- `berger_tarif_delnici_2026.json`
- `metadata.json` (ale uvnitř `"files": []` — nesynchronizováno s realitou)
- `projects/` (pravděpodobně historical project data)

**productivity_rates.json struktura:**
```
beton/
  bedneni/            ← jednoduche / stredni / slozite / velmi_slozite
                      Per kategorie: rychlost_m2_h_na_cloveka, rychlost_m2_den_brigada, brigada_tesaru
                      Příklady (slozite): "римsы, hlavice sloupů, zakládací části, konzoly"
  armovani/           ← site / pruty / slozita_vyztuž
                      Per kategorie: rychlost_kg_h_na_cloveka, brigada_zelezaru
  betonaz/            ← cerpadlo / jerab_kbelik / michacka
zdivo/                (mimo scope tohoto auditu)
zemni_prace/          (mimo scope)
pomocne_prace/
poznamky/
usage_guidelines/
```

**bedneni.json — `brigady` blok (klíčový pro resource ceiling):**
```json
{
  "mala_bez_jeravu":     { "pocet_osob": 2, "smena_h": 8,  "jerab": false, "crane_factor": 1.0, "pouziti": "malé plochy, opravy" },
  "standard_bez_jeravu": { "pocet_osob": 4, "smena_h": 10, "jerab": false, "crane_factor": 1.0, "pouziti": "standardní stavby, Frami Xlife" },
  "standard_s_jeravem":  { "pocet_osob": 4, "smena_h": 10, "jerab": true,  "crane_factor": 0.8, "pouziti": "Framax, Staxo — standardní" },
  "velka_s_jeravem":     { "pocet_osob": 6, "smena_h": 10, "jerab": true,  "crane_factor": 0.7, "pouziti": "velké mostní projekty, tight schedule" }
}
```

**Důsledek:** B4 obsahuje **realistic brigade defaults** (2 / 4 / 4+jeřáb / 6+jeřáb) ale ne per-element. Per-element normy v `productivity_rates.json` jsou granularitou `jednoduche/stredni/slozite/velmi_slozite` — abstraction-level "typ tesarské práce", ne typ elementu.

### §1.3 B7_regulations — co je relevantní

| Subdir | Obsah | Relevance pro ceiling |
|--------|-------|-----------------------|
| `csn_73_6222_zatizitelnost_mostu/` | Zatižitelnost mostů | nepřímá |
| `csn_73_6244_prechody_mostu/` | Přechody mostů | nepřímá |
| `csn_en_206_pruvodce/` | ČSN EN 206 průvodce | curing, exposure (mimo scope ceiling) |
| `en_1992_2_concrete_bridges/` | EN 1992-2 | bridge design, mimo scope |
| `tkp_04_zemni_prace/` | Zemní práce | mimo scope |
| `vl_4_mosty/` | VL 4 vzorové listy mosty | nepřímá |

**Chybí pro ceiling:** explicitní DIN 18218 výtah, ČSN EN 13670 §7.8.3 výtah pro pour-rate constraints, ČSN EN 12812 výtah (falsework). Tato čísla jsou hardcoded v calculator engines (`lateral-pressure.ts`, `maturity.ts`) — viz §3.

### §1.4 B5_tech_cards — anti-pattern problém

**30+ subdirs, všechny pouze `source_pointer.md`** — žádný element-grouped extracted obsah. Příklady:
- `peri_frami_xlife_panel_formwork/source_pointer.md` (vendor manual pointer)
- `peri_skydeck_slab_formwork/source_pointer.md`
- `peri_variokit_engineering_kit/source_pointer.md`
- `general_3f_tp_tabor_rd/source_pointer.md`
- `walls_monolithic_cz_bba_monolit_tp01/source_pointer.md`
- `general_prirucka_pracovnika_s_betonem/source_pointer.md`

Per `KNOWLEDGE_PLACEMENT_GUIDE.md` §3 by struktura měla být `B5_tech_cards/<element>/<source>/`. Reálná struktura je `B5_tech_cards/<source>/source_pointer.md`. **Element grouping chybí.**

### §1.5 Discrepance v naming

| Zdroj | Říká | Realita | Opatření |
|-------|------|---------|----------|
| `KNOWLEDGE_PLACEMENT_GUIDE.md` §2 | `B4_productivity/` | dir je `B4_production_benchmarks/` | flag, sjednotit nebo opravit guide |
| Task spec §1 | `B4_productivity/` | dir je `B4_production_benchmarks/` | použít skutečný název v Phase 1 lookup |
| `KNOWLEDGE_PLACEMENT_GUIDE.md` §3 | `B5_tech_cards/<element>/<source>/` | reálně `B5_tech_cards/<source>/source_pointer.md` | element grouping je TODO |
| Task spec §11 | `STAVAGENT_Complete_Element_Catalog.md` | reálně `Monolit-Planner/docs/ELEMENT_CATALOG_REFERENCE.md` | jen jiný název, obsah konzistentní |

### §1.6 Co B0–B9 NEMÁ pro resource ceiling

| Chybějící data | Kde by měla být | Důsledek |
|----------------|-----------------|----------|
| **Per-element-type productivity rates** (např. `mostovka: rebar_kg_h_na_cloveka = 30, betonaz_m3_h = 40`) | `B4_production_benchmarks/per_element/<element>.yaml` | Engine musí mapovat element_type → productivity category, nebo zůstat na current `slozite/jednoduche` granularitě |
| **Pour crew composition formulas** (`n_pump × 2 ukladani + ceil(n × 1.5) vibrace + ceil(n × 1.0) finišéři + 3 řízení` per `TASK_MegaPour_CrewLogic_Warnings.md`) | `B4_production_benchmarks/pour_crew_composition.yaml` | Aktuálně hardcoded v `pour-task-engine.ts` `computePourCrewByPumps()` |
| **Per-element resource relevance map** ("pilota nemá soupravy bednění", "rimsa nemá skruž — má římsové konzoly") | `B5_tech_cards/<element>/relevance.yaml` nebo `Monolit-Planner/shared/src/classifiers/element-classifier.ts` jako rozšíření `ElementProfile` | Aktuálně implicitně v `needs_supports/needs_platforms/needs_crane/needs_formwork` boolean flags v `ElementProfile` — ale to jsou potřeby, ne relevance pro user-supplied ceiling |
| **Default ceiling values per element type** ("typická opěrná zeď: 8 lidí, 1 souprava, 1 čerpadlo") | `B4_production_benchmarks/default_ceilings/<element>.yaml` | Neexistuje |
| **Brigade composition per profession** (vibrátoři, finišéři jako separátní brigády vs. součást betonářské brigády) | `B4_production_benchmarks/brigades_by_profession.yaml` | Aktuálně `bedneni.json` má brigády tesarské, `productivity_rates.json` má `brigada_zelezaru`. Chybí betonáři, vibrátoři, finišéři, řízení |

---

## §2 Golden tests inventory

### §2.1 Co existuje v `test-data/`

| Subdir / file | Element types | Status | Resource assertions |
|---------------|---------------|--------|---------------------|
| `test-data/tz/SO-202_D6_most_golden_test.md` | mostovkova_deska (dvoutrámový předpjatý), driky_piliru, opery, piloty | golden test spec — strukturovaný markdown | ❓ neověřeno (file nečten celý) — předpoklad: chybí ceiling assertions |
| `test-data/tz/SO-203_D6_most_golden_test_v2.md` | mostovkova_deska (MEGA pour ~664 m³) | golden test spec | ❓ |
| `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` | mostovkova_deska (MSS plánováno) | golden test spec | ❓ |
| `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` | operne_zdi (pozemní, 156.4m × 1.75m × 0.4m, 94.231 m³) | **structured spec, geometry confirmed** | ❓ — task §5.6 vyžaduje 4 nové scenarios (5p+1s+1p, 12p+2s+1p, INFEASIBLE, default) |
| `test-data/libuse/` | building elements (pozemní, Objekt D bytový soubor) | inputs/ + outputs/ workflow artifacts (extraction, urs_lookup_cache, audit_report, scorecards) | NE — toto je pipeline test, ne calculator golden |
| `test-data/most-2062-1-zihle/` | bridge SO 1 (nosná konstrukce mostu) + SO 2-6 supporting | structured project (00_PROJECT_SUMMARY + 6 phase dirs: extraction/design/calculation/documentation/backlog/inputs + metadata.yaml) | ❓ — D&B sandbox, 154 položek, 10.59M Kč |
| `test-data/most-litovel/` | most | README + inputs + metadata.yaml | ❓ |
| `test-data/*.dwg` + `*.pdf` (root) | Libuše DPS — Objekt A/B/C/D půdorysy, řezy, pohledy | drawings (DWG/PDF) | NE — pre-extraction inputs |
| `test-data/TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md` | Libuše VV | task spec | NE |

### §2.2 Coverage gap per element type

Mapování *element type → existence golden testu* (pro Phase 1+ rollout):

| Element type | Golden test | Coverage |
|--------------|-------------|----------|
| `mostovkova_deska` | SO-202, SO-203, SO-207 | ✅ silná, 3 varianty (pevná skruž, MEGA pour, MSS) |
| `operne_zdi` | VP4 FORESTINA | ✅ 1 case |
| `driky_piliru` | SO-202 (jako component) | ⚠️ částečně |
| `opery_ulozne_prahy` | SO-202 (component) | ⚠️ částečně |
| `pilota` | SO-202 (component) | ⚠️ částečně |
| `zaklady_piliru` | ❓ | možná v SO-202 |
| `zaklady_oper` | ❌ | chybí |
| `rimsa` | ❌ | chybí |
| `rigel` | ❌ | chybí |
| `kridla_opery` | ❌ | chybí |
| `mostni_zavirne_zidky` | ❌ | chybí |
| `prechodova_deska` | ❌ | chybí |
| `podkladni_beton` | ❌ | chybí |
| `podlozkovy_blok` | ❌ | chybí |
| `zakladova_deska` | ❌ (Libuše má drawings, ne golden test spec) | chybí |
| `zakladovy_pas` | ❌ | chybí |
| `zakladova_patka` | ❌ | chybí |
| `stropni_deska` | ❌ (Libuše has artifacts, no calculator golden) | **chybí** |
| `stena` | ❌ | chybí |
| `sloup` | ❌ | chybí |
| `pruvlak` | ❌ | chybí |
| `schodiste` | ❌ | chybí |
| `nadrz` | ❌ | chybí |
| `podzemni_stena` | ❌ | chybí |

**Verdikt:** golden test coverage = **5 / 24 element types** (SO-202 multi + VP4). Pro Phase 2–7 rollout per task §6 (Group A: pozemní vodorovné, Group B: pozemní svislé, …) **chybí golden tests pro celé skupiny**. Task §6 explicitně říká *"pokud pro skupinu chybí golden test, flag jako blocking a požádej uživatele o přidání reálného projektu"*.

### §2.3 Scenario gap v existujících golden testech

VP4 FORESTINA spec (zkontrolováno) má detailní geometry + concrete + rebar + curing assertions, ale **chybí ceiling scenarios** požadované task §5.6:
- ❌ 5 lidí + 1 souprava + 1 čerpadlo → **expected: feasible nebo INFEASIBLE s důvodem**
- ❌ 12 lidí + 2 soupravy + 1 čerpadlo → **expected: feasible plán s využitím v rámci stropu, ne 30 lidí**
- ❌ default ceiling → **expected: auto-fill defaults z KB + banner**

Stejně pro SO-203 chybí:
- ❌ 21 lidí + 2 soupravy + 2 čerpadla → expected: feasible
- ❌ 12 lidí + 1 souprava + 1 čerpadlo → expected: INFEASIBLE s navrženým rozdělením do 2 záběrů s pracovní spárou v ose pole

### §2.4 Format konvencí v golden test souborech

VP4 FORESTINA spec demonstruje **závazný format** (závazné pro Phase 1+ rozšíření):
- Project context + element type + canonical reference link
- Geometry (ASCII art průřezu + dimensions table)
- Material properties (concrete, exposure, rebar)
- Calculation expectations (acceptance ranges ±15%)
- TZ source citations

**Chybí v formatu:** sekce **"Resource ceiling scenarios"** — Phase 1 musí ji přidat jako standardní template, aby Phase 2–7 měly co plnit.

---

## §3 Resource decision sites — kde dnes vznikají rozhodnutí

### §3.1 Mapa rozhodnutí → soubor → linka → bounded?

| Rozhodnutí | Soubor | Linka | User input? | Strop respektován? |
|------------|--------|-------|-------------|-------------------|
| `crew_size` (formwork crew, default 4) | `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` | 571, 770 | ✅ `PlannerInput.crew_size?` | částečně — engine může recommendovat víc, ne respektuje strop |
| `crew_size_rebar` (rebar crew, default 4) | tamtéž | 572, 771 | ✅ `PlannerInput.crew_size_rebar?` | částečně |
| `num_sets` (formwork sets, default 2) | tamtéž | 568, 778 | ✅ `PlannerInput.num_sets?` | částečně — `Math.min(rawSets, num_tacts)` v `element-scheduler.ts:154` |
| `num_formwork_crews` (default 1) | tamtéž | 569, 779 | ✅ `PlannerInput.num_formwork_crews?` | částečně |
| `num_rebar_crews` (default 1) | tamtéž | 570, 780 | ✅ `PlannerInput.num_rebar_crews?` | částečně |
| `formwork_sets_count` | tamtéž | 191, 365, 1641 | ✅ | částečně |
| `pumps_required` (computed) | `Monolit-Planner/shared/src/calculators/pour-decision.ts` | 504, 513, 523, 567 | ❌ **engine-computed** `Math.ceil(V / (q_eff × available_h))` | NE — engine doporučí potřebné, ne respektuje strop |
| `num_pumps_available` (forwarded to pour-task) | `Monolit-Planner/shared/src/calculators/pour-task-engine.ts` | 67 | ✅ `PourTaskInput.num_pumps_available?` | částečně — `pumps_required = Math.max(1, Math.floor(input.num_pumps_available ?? 1))` (linka 185 dříve excerpt) |
| **Pour crew composition** (n_pump × 2 + ceil(n × 1.5) + ceil(n × 1.0) + 3 řízení) | `pour-task-engine.ts` `computePourCrewByPumps()` | uvnitř funkce | ❌ **hardcoded formula** | NE — counts derive from pumps, ne z user-supplied stropu |
| `num_tacts` (computed from has_dilatacni_spary) | `pour-decision.ts` | 410, 464, 564 | ✅ `num_tacts_override?` | částečně |
| `num_sections` | `pour-decision.ts` | 116, 347, 352, 461, 561 | ✅ via dilatation joints input | částečně |
| `target_window_h` | `pour-task-engine.ts` | 57, 81, 224 | ✅ optional input | n/a — používá se k computeu alternative scenario |
| `crane_required` | `element-classifier.ts` `ElementProfile.needs_crane: boolean` | line ~57 | ❌ **engine-derived per element type** | NE — žádný `num_cranes_available` ceiling input nikde |
| **`num_cranes_available`** | **NEEXISTUJE** | n/a | ❌ | NE |
| **`num_vibrators_available`** | **NEEXISTUJE** | n/a | ❌ | NE |
| **`num_finishers_available`** (hladičky) | **NEEXISTUJE** | n/a | ❌ | NE |
| **`mss_set_available`** (boolean) | **NEEXISTUJE** explicitně (má `construction_technology='mss'` mode) | n/a | ❌ | NE — engine zvolí MSS ale nezeptá se zda je k dispozici |
| **`num_carpenters` / `num_rebar_workers` / `num_concreters`** (per-profession breakdown) | **NEEXISTUJE** | n/a | ❌ | NE — všechno přes `crew_size` (single number) |
| **Časový strop investora** (deadline_days, no_weekends, no_holidays) | **NEEXISTUJE** | n/a | ❌ | NE |

### §3.2 Diskrepance v defaults (cross-engine)

| Pole | `planner-orchestrator.ts` default | `pour-task-engine.ts` default | Komentář |
|------|----------------------------------|------------------------------|----------|
| `crew_size` | 4 (line 571) | 6 (line 138, `DEFAULTS.crew_size`) | **dva zdroje truth** — orchestrator forwarduje 4 (forwork) ale pour-task vlastní 6 (concrete crew). Sjednocení v Phase 1. |
| `shift_h` | n/a | 10 (line 139) | OK, jen v pour-task |

### §3.3 Pump count — duplicitní výpočet (zaznamenáno v `TASK_MegaPour_CrewLogic_Warnings.md`)

- `pour-decision.ts:523` computes `pumps_required = Math.ceil(V / (q_eff * available_h))`.
- `pour-task-engine.ts:185` přijímá `num_pumps_available` (forwarded by orchestrator at `planner-orchestrator.ts:1641`).
- **Problém v memory (per CLAUDE.md §"MEGA pour engine fixes (v4.20)" Bug 3):** byl historický rozkol mezi pour-decision (4 čerpadel) a pour-task (1 pump, 20h) — fixován v v4.20 přidáním `num_pumps_available` jako forward kanálu. **Pour-decision is now authoritative.**
- **Pro Phase 1:** strop musí být respektován NA `pour-decision.ts` úrovni — pokud user-supplied ceiling = 1 čerpadlo, ale `Math.ceil(V/(q_eff × available_h))` říká 4, engine musí (a) použít 1 + INFEASIBLE warning *"při 1 čerpadle je pour window 32h, doporučení: rozdělit do záběrů ≤ 16h každý"*, nebo (b) navrhnout split.

### §3.4 Special cases (existing per-element overrides)

- `planner-orchestrator.ts:804` — `if (elementType === 'rimsa' && !input.crew_size)` → forces crew=3 (rimsa specific). Toto je **good pattern** pro per-element customisation; rozšířit v Phase 1.
- `pour-decision.ts` `ELEMENT_DEFAULTS` table — per element `typical_has_spary`, `typical_sub_mode`, `typical_spara_spacing_m`. Toto je strukturně blízko k tomu, co potřebujeme pro per-element relevance flags.

### §3.5 Formwork pre-filter logika (pro reference)

- `lateral-pressure.ts:319` `filterFormworkByPressure()` má **per-záběr staging recovery** — pokud system pressure < required, computuje `effectiveMaxH = sys.pressure / required × pour_height`, accept-uje pokud ≥ 1.5m. **Vzor pro INFEASIBLE recovery v Phase 1:** strop < lower bound → pokus o staging/split, ne pouze hard fail.

---

## §4 Canonical element list — 24 vs 33 discrepance

### §4.1 Implementováno v `ElementProfile` katalogu

24 typů (po Gate 2 přidání `zaklady_oper`):

```
zaklady_piliru, zaklady_oper, driky_piliru, rimsa, operne_zdi,
mostovkova_deska, rigel, opery_ulozne_prahy, kridla_opery,
mostni_zavirne_zidky, prechodova_deska, podkladni_beton,
podlozkovy_blok, zakladova_deska, zakladovy_pas, zakladova_patka,
stropni_deska, stena, sloup, pruvlak, schodiste, nadrz,
podzemni_stena, pilota
```

Plus `other` jako catch-all (= 25 entry v `ELEMENT_CATALOG`).

### §4.2 Documented v `ELEMENT_CATALOG_REFERENCE.md`

**33 typů.** Rozdíl proti implementaci (9 typů documented ALE not in `ElementProfile` catalog):

| # | Typ z reference doc | V katalogu? | Důvod absence (hypothesis) |
|---|---------------------|-------------|---------------------------|
| 4 | **Zakladovy rost** | ❌ | Marked v doc jako "technologicky = zakladovy_pas, ale křížení vyžaduje pozor" — možná intentional alias |
| 13 | **Konzola / balkon** | ❌ | Specializovaná stropní práce — možná pokrývá `stropni_deska` se subtype detekcí |
| 14 | **Venec** | ❌ | Malý prvek (~0.25×0.25m), možná aliased na `pruvlak` |
| 16 | **Prumyslova podlaha** | ❌ | Drátkobeton, hladičky-driven — fundamentálně jiný workflow |
| 18 | **Strikany beton (torkret)** | ❌ | Žádné bednění, žádné vibrace — special technology |
| 31 | **Tunel / osteni** | ❌ | NRTM technologie, ocelová posuvná skruž = bednění+podpera |
| 32 | **Propustek** | ❌ | "Maly most" rámový průřez, 4 fáze betonáže |
| 33 | **Retencni nadrz / vodojem** | ❌ | Possibly aliased na `nadrz` |

**Verdikt:** dokumentace přesahuje implementaci o ~9 typů. Task §6 rozkladá rollout do 6 groups (A–F), ale **canonical list pro Phase 1 je 24 typů z `ElementProfile`**. Doc reference (33 typů) je informativní; rozšíření je out-of-scope tohoto auditu (per task §8 *"Změna canonical seznamu element types — pracujeme s tím co je po Gate 2"*).

### §4.3 ElementProfile interface — co má a co chybí pro ceiling

**Existující resource-relevant pole** (ze 17 fields v `ElementProfile`):
- `recommended_formwork: string[]` — pole systémů
- `difficulty_factor: number` — multiplikátor
- `needs_supports: boolean` — boolean potřeba (skruž / stojky)
- `needs_platforms: boolean` — boolean potřeba (pracovní plošiny)
- `needs_crane: boolean` — **boolean potřeba**, nikoliv "available" — vol. user input
- `needs_formwork?: boolean` — false pro pilota / podkladni_beton
- `rebar_norm_h_per_t: number` — productivity (legacy, supplanted by `REBAR_RATES_MATRIX`)
- `rebar_category: RebarCategory` — pro `getRebarNormForDiameter()` lookup
- `max_pour_rate_m3_h: number` — element-specific pour rate constraint
- `pump_typical: boolean` — boolean

**Co `ElementProfile` NEMÁ** pro ceiling:
- ❌ Per-element resource relevance map (které z 15 ceiling polí jsou relevantní pro tento typ)
- ❌ Default ceiling values (typical 8 lidí, 1 souprava, 1 čerpadlo per element type)
- ❌ Lower bound formula reference (jaký engine určí minimální zdroje per element)
- ❌ Profession breakdown defaults (typický rozdělení 12 lidí na opěrné zdi: 4 tesaři + 6 železáři + 2 betonáři)

### §4.4 SANITY_RANGES coverage

`element-classifier.ts` má `SANITY_RANGES` map (sanity bounds pro user inputs jako volume, height, deck_thickness). Coverage je ≥24 typů per current implementation. **Toto je dobrý vzor pro per-element ceiling defaults** — Phase 1 může přidat parallel `RESOURCE_CEILING_DEFAULTS` map.

---

## §5 Cross-cutting findings

### §5.1 ElementProfile hardcoded normativní hodnoty (porušení `KNOWLEDGE_PLACEMENT_GUIDE` §1)

V `element-classifier.ts` `ELEMENT_CATALOG`:
- `rebar_ratio_kg_m3` per element (např. 120 pro `zaklady_piliru`)
- `rebar_norm_h_per_t` per element (např. 40 pro `zaklady_piliru`)
- `max_pour_rate_m3_h` per element

V `pour-decision.ts`:
- `T_WINDOW_HOURS` table (hot/normal/cold × no_retarder/with_retarder × hours)

V `maturity.ts`:
- `CURING_DAYS_TABLE` (5 temp ranges × 3 concrete groups × 3 curing classes)
- `EXPOSURE_MIN_CURING_DAYS` (XF1 5d, XF3/XF4 7d, …)

V `lateral-pressure.ts`:
- DIN 18218 k-factors (0.85 / 1.00 / 1.50)
- ρ = 2400 kg/m³, g = 9.81

V `element-classifier.ts`:
- `REBAR_RATES_MATRIX` (4 categories × ~10 diameters)

**Per `KNOWLEDGE_PLACEMENT_GUIDE.md` §1: "если в коде калькулятора появляется захардкоженная норма — это bug".** Všechna tato čísla jsou normativní. **Ale pro Phase 1 ceiling rewrite je out-of-scope je všechny přesouvat** — Phase 1 cíl je strop, ne KB-fication celé fyziky. Recommendation block (§6) navrhuje, co přesunout NEJDŘÍV.

### §5.2 Per-CLAUDE.md Gap #8 / Option W principle

CLAUDE.md §"Gate 2 closed (v4.27.0)" zaznamenává Option W = canonical `recommended_formwork[0]` over algorithmic optimization. **Phase 1 ceiling logic musí Option W respektovat** — pokud user strop vylučuje canonical first-choice, engine vrací best feasible (lateral pressure / falsework) místo optimization-driven swap.

### §5.3 Confidence ladder & override

CLAUDE.md "Conventions": confidence ladder je regex 1.0 → OTSKP DB 1.0 → drawing_note 0.90 → Perplexity 0.85 → URS 0.80 → AI 0.70. Higher NIKDY overwriteit lower.

**Pro ceiling:** task spec §5.5 definuje:
- Manual user input = **0.99** confidence (engine NIKDY nepřekročí)
- Default z KB = 0.85
- Auto-derived lower bound z fyziky = 1.00

**Důsledek:** lower bound (1.00) > user manual (0.99), takže pokud user strop < lower bound, lower bound vyhrává a engine vrátí INFEASIBLE warning. Toto je v souladu s confidence ladder (ne porušení).

### §5.4 No project-wide RCPSP this sprint (per master brief)

Task §8 explicitně out-of-scope: project-wide RCPSP přes elementy se sdílenými zdroji. Strop = **per-element this sprint**. Phase 1+ jsou per-element only.

---

## §6 Recommendations — co rozšířit / čistit PŘED start Phase 1

### §6.1 P0 — blokátoři Phase 1

**R1. Shared `ResourceCeiling` schema dokument.** Před Phase 1 mít dokument *(naming určí Phase 1, ne tento audit)* který definuje:
- Union schema (~15 polí: lidé celkem, tesaři, železáři, betonáři, vibrátoři, finišéři, řízení; směny počet/hodin/noční-povolené; soupravy bednění; čerpadla; záložní čerpadla; jeřáby; vibrátory; finishery (hladičky); skruž souprav; MSS k dispozici; deadline_days; no_weekends; no_holidays).
- Per-element relevance flags (boolean map per `StructuralElementType` × každé pole).
- Per-element default values (B4 lookup map).

**R2. B4 default_ceilings YAML.** Přidat `concrete-agent/packages/core-backend/app/knowledge_base/B4_production_benchmarks/default_ceilings/<element>.yaml` per 24 typů. Bez toho **R1 nemá kde brát defaulty**. Initial values lze derivovat z `ELEMENT_CATALOG_REFERENCE.md` (35+ rows technologie + brigady) + `bedneni.json` brigády (2/4/4+jeřáb/6+jeřáb).

**R3. Zachytit duplicitní pump-count logiku.** Per CLAUDE.md memo `TASK_MegaPour_CrewLogic_Warnings.md` byl historický rozkol pour-decision vs pour-task — opraven v v4.20. **Verifikovat ve Phase 0.5** (lehký smoke test, ne kód) že po v4.20 fixu authority je `pour-decision.pumps_required` → forwarded do pour-task. Pokud jde, žádná akce. Pokud ne, fix v Phase 1.

**R4. Sjednotit defaults `crew_size = 4` vs `crew_size = 6`.** `planner-orchestrator.ts:571` má 4, `pour-task-engine.ts:138` má 6. Jeden zdroj truth. Phase 1 fixne při shared model integration.

### §6.2 P1 — silně doporučeno před Phase 1, ne strict blocker

**R5. Golden test format extension.** Update VP4 FORESTINA + SO-202 + SO-203 + SO-207 spec markdown templates: přidat sekci *"Resource ceiling scenarios"* s 3 standardními cases (low/medium/INFEASIBLE) + expected outputs. Toto je content task, ne code; user může doplnit, nebo Phase 1 vygeneruje template.

**R6. Add per-profession brigade defaults to B4.** `productivity_rates.json` má `brigada_tesaru: 4`, `brigada_zelezaru: 3-4`. **Chybí `brigada_betonaru`, `brigada_vibratoru`, `brigada_hladicku`, `brigada_rizeni`** — bez nich engine nemůže rozdělit strop "12 lidí celkem" na profesní složení per element type.

**R7. Doc fix — `B4_productivity` vs `B4_production_benchmarks`.** Update `KNOWLEDGE_PLACEMENT_GUIDE.md` §2 nebo přejmenovat directory. **Doporučení: update guide** (rename directory by zlomil existing imports).

**R8. Resolve `B5_tech_cards` element-grouping anti-pattern.** Realita `B5_tech_cards/<source>/source_pointer.md` ≠ guide-stipulated `B5_tech_cards/<element>/<source>/`. Ne-blocker pro Phase 1, ale **out-of-sync** struktura zhorší KB lookup v Phase 2+ (Group A pozemní vodorovné, …). Doporučuji: (a) přijmout reality + update guide, NEBO (b) reorganize symlinks. **Phase 0.5 decision.**

### §6.3 P2 — nice-to-have, defer post-Phase 1

**R9. Move `REBAR_RATES_MATRIX` from `element-classifier.ts` to B4 YAML.** Per `KNOWLEDGE_PLACEMENT_GUIDE` rule "hardcoded normativní = bug". Teď je matrix v code (1688–1705 v element-classifier.ts). Defer post-Phase 1 — out-of-scope ceiling task.

**R10. Move `T_WINDOW_HOURS`, `CURING_DAYS_TABLE`, `EXPOSURE_MIN_CURING_DAYS` to B7.** Tato čísla pocházejí z TKP18 / ČSN EN 13670 a měly by být v `B7_regulations/` jako extracted YAML. Defer.

**R11. Element catalog gap (24 vs 33).** 9 dokumentovaných typů (zakladovy_rost, konzola, venec, prumyslova_podlaha, strikany_beton, tunel, propustek, retencni_nadrz, …) chybí v `ElementProfile`. Per task §8 explicitně out-of-scope. Zaznamenáno pro budoucí task.

### §6.4 P3 — context-only flags, bez akce v Phase 0

**R12. Calendar-aware scheduling, TZ parser auto-extract, Equipment fleet view** — vše Q3+ 2026 per master brief. Nezasahuje Phase 1 ceiling.

---

## §7 Phase 0 verdict

**Lze Phase 1 startovat?** **ANO**, s následujícími podmínkami:

1. ✅ Knowledge base má **dostatečné** defaults v `B4_production_benchmarks/{productivity_rates,bedneni}.json` pro initial Phase 1 — VP4 FORESTINA reference A může běžet na current B4 dat (operne_zdi, brigady standard 4 osob, faktor jeřáb 0.8, productivity rebar pruty 40 kg/h/osoba).
2. ✅ Existing engines (`pour-decision`, `pour-task-engine`, `planner-orchestrator`, `lateral-pressure`) mají **rozšiřitelné** input typy — přidání `ResourceCeiling` jako nového volitelného PlannerInput pole je low-risk.
3. ✅ ElementProfile má základní per-element distinctions (`needs_supports`/`needs_crane`/`needs_formwork`) které lze rozšířit o per-element relevance map.
4. ⚠️ **R1 + R2 (P0 blockers) musí být součást Phase 1 PR**, nikoli pre-requisite. Phase 1 = (a) shared schema dokument + (b) B4 default_ceilings YAML pro 2 reference elements (operne_zdi + mostovkova_deska) + (c) integrace do orchestrator + (d) golden test scenarios pro VP4 + SO-203.
5. ⚠️ **Golden test gap (5/24)** je strict blocker pro Phase 2–7 (ne Phase 1). Pre-Phase 2 user musí poskytnout reálné projekty pro chybějící skupiny, nebo Phase 2+ flag-and-stop.
6. ⚠️ R7 (doc fix) + R8 (B5 reorganization) jsou Phase 0.5 decisions — drobné scope rozšíření Phase 0 PR, NEBO defer.
7. ❌ R9–R11 (move hardcoded constants do KB) jsou out-of-scope, **NESMÍ** se promíchat do Phase 1 PR per task §8 (surgical changes only).

**Phase 1 minimal viable scope (per task §5):**
- Shared `ResourceCeiling` model (R1) + relevance flags + KB default lookup pro 2 elements.
- B4 default_ceilings YAML pro `operne_zdi` + `mostovkova_deska` (R2 partial, jen 2/24).
- Integration v orchestrator + pour-decision + pour-task-engine.
- 4 nové golden test scenarios (VP4 + SO-203, low/medium/INFEASIBLE/default).
- 1036+ existing tests green.
- 1 PR.

Ostatní 22 elements + 24 default_ceilings YAML files = Phase 2–7 work.

**Open question pro Phase 1 plan:**
- Při INFEASIBLE auto-recovery (split do 2 záběrů s pracovní spárou v ose pole) — tato logic žije v `pour-decision.ts` (`has_dilatacni_spary` → sectional mode) a v `working_joints_allowed` field. **Phase 1 musí explicitně vyřešit:** rozšíříme existing pour-decision flow (`working_joints_allowed = 'unknown'` → emit warning, but allow), nebo vytvoříme nový recovery path? **Recommendation: rozšířit existing.** Decision je Phase 1 design, ne audit.

---

## §8 Sources & traceability

Všechny file paths relativně k root repository. Linka čísla k dnešnímu HEAD `81f56a1` na branche `claude/competitive-audit-stavagent-hfgwP`.

| Téma | Soubor | Linky |
|------|--------|-------|
| KNOWLEDGE_PLACEMENT_GUIDE | `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` | full doc, §1–§3 cited |
| ELEMENT_CATALOG_REFERENCE | `Monolit-Planner/docs/ELEMENT_CATALOG_REFERENCE.md` | rows 1–33 (canonical list of 33 documented types) |
| ElementProfile interface + ELEMENT_CATALOG | `Monolit-Planner/shared/src/classifiers/element-classifier.ts` | 42–110 (interface), 116+ (catalog body), ~24 typů |
| REBAR_RATES_MATRIX (hardcoded) | `Monolit-Planner/shared/src/classifiers/element-classifier.ts` | 1688–1705 |
| RCPSP greedy scheduler | `Monolit-Planner/shared/src/calculators/element-scheduler.ts` | 139–457 |
| Pour decision tree + pumps_required | `Monolit-Planner/shared/src/calculators/pour-decision.ts` | 504–567 (pump count derivation) |
| Pour task engine + crew composition | `Monolit-Planner/shared/src/calculators/pour-task-engine.ts` | 49–67, 138, 185 (DEFAULTS), `computePourCrewByPumps` (in body) |
| Lateral pressure (DIN 18218) + filter | `Monolit-Planner/shared/src/calculators/lateral-pressure.ts` | 155–194 (formula), 263–340 (CSP filter), 256–261 (penalty) |
| Curing (Saul + TKP18) | `Monolit-Planner/shared/src/calculators/maturity.ts` | 89–122 (exposure min), 168–203 (curing days table), 399–408 (maturity index) |
| Orchestrator resource fields | `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` | 144–191 (input fields), 568–571 (DEFAULTS), 770–806 (input read), 1641 (forward num_pumps_available) |
| B4 productivity_rates.json | `concrete-agent/packages/core-backend/app/knowledge_base/B4_production_benchmarks/productivity_rates.json` | full file, beton/{bedneni,armovani,betonaz} |
| B4 bedneni.json — brigády | `concrete-agent/packages/core-backend/app/knowledge_base/B4_production_benchmarks/bedneni.json` | `brigady` key |
| B7 regulations | `concrete-agent/packages/core-backend/app/knowledge_base/B7_regulations/` | 6 subdirs |
| B5 tech_cards (anti-pattern) | `concrete-agent/packages/core-backend/app/knowledge_base/B5_tech_cards/` | 30+ subdirs, all `source_pointer.md` |
| Golden test VP4 | `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` | full file, geometry confirmed |
| Golden test SO-202 | `test-data/tz/SO-202_D6_most_golden_test.md` | full file (not deeply read) |
| Golden test SO-203 | `test-data/tz/SO-203_D6_most_golden_test_v2.md` | full file (not deeply read) |
| Golden test SO-207 | `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` | full file (not deeply read) |
| Žihle bridge project | `test-data/most-2062-1-zihle/` | 00_PROJECT_SUMMARY + 6 phase dirs |
| Litovel bridge project | `test-data/most-litovel/` | README + inputs + metadata.yaml |
| Libuše building project | `test-data/libuse/` | inputs/ + outputs/ workflow artifacts |
| Existing audit convention | `docs/audits/knowledge_audit/` | 25+ files: `00_plan.md`, `01_inventory_*.md`, …, `99_summary.md`, plus dated `2026-05-06_b2_and_docs_bridge_ingest_audit.md` |

---

## §9 Out-of-scope explicitní list

Per task §8 (sprint protection) tento audit **NEZASAHUJE**:
- Project-wide RCPSP across elements (Q4 2026 / Q1 2027)
- Calendar-aware scheduling, public holidays, weather seasons (Q3 2026)
- TZ parser auto-extract resource ceiling z dokumentace (Q3 2026)
- Equipment fleet view across projects (Q1 2027)
- Změna fyziky engines (DIN 18218, Saul, RCPSP — fyzika je správná)
- Změna canonical seznamu element types (zůstaneme na 24 po Gate 2)
- Migrace databází, frameworků, tooling
- Refactor unrelated kódu

A explicitně **VEN** z Phase 0:
- Žádný kód v engine ani UI.
- Žádné změny knowledge_base obsahu (R2 default_ceilings YAML = Phase 1, ne Phase 0).
- Žádný shared `ResourceCeiling` model TS file (= Phase 1).
- Žádné rozšíření `PlannerInput` interface (= Phase 1).

---

## §10 Phase 0 acceptance summary

| Kritérium z task §4.5 | Stav |
|----------------------|------|
| Tabulka `B0–B9 → co tam je → co chybí pro resource ceiling` | ✅ §1.1, §1.6 |
| Tabulka `golden test → element types → existující assertions → chybějící resource assertions` | ✅ §2.1, §2.2, §2.3 |
| Tabulka `element type → kde dnes vzniká crew/sets/pump/crane/shifts → bounded ano/ne` | ✅ §3.1 |
| **Recommendation block** (kde rozšířit knowledge_base, kde čistit duplicitní logiku) | ✅ §6.1–§6.4 + §7 verdict |
| Audit dokument v `docs/audit/` (or per-existing-convention) | ✅ `docs/audits/calculator_resource_ceiling/2026-05-07_phase0_audit.md` (per existing convention `docs/audits/<category>/`) |
| Žádný kód | ✅ |
| 1 PR s pouze audit dokumentem | ⏳ pending commit + push |

---

**Konec Phase 0.** Review checkpoint před Phase 1 startem.
