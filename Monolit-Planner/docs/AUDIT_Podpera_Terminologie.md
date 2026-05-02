# AUDIT — Kanonická terminologie podpěrné konstrukce (skruž / stojky / podpěrná konstrukce)

**Datum:** 2026-04-29
**Branch:** `claude/add-terminology-docs-av2bX`
**Gate:** 1 (audit, no code changes)
**Authoritative reference:** [`docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA.md`](../../docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA.md) (ČSN EN 12812 + TKP 18 ŘSD + DOKA Sosna 09.01.2026 + PERI VARIOKIT/MULTIPROP)
**Task spec:** `TASK_Podperna_Konstrukce_Kanonicka_Terminologie.md`

---

## 0) Executive summary

**Co je v kódu už kanonické (good news):**
- 5-hodnotové `pour_role` taxonomy je nasazena: `formwork | falsework | props | formwork_props | mss_integrated` (formwork-systems.ts:123–656).
- Staxo 100 (DOKA) + UP Rosett Flex (PERI) jsou klasifikované jako `props`.
- DOKA MSS + VARIOKIT Mobile jsou `mss_integrated` se správným `mss_reuse_factor=0.35`.
- UI v `CalculatorResult.tsx` už **switchuje card title podle `fwSystem.pour_role`** — `'Skruž (nosníky)' 🏗️ / 'Bednění + stojky' 📦 / 'Posuvná skruž (MSS)' 🌉 / 'Bednění' 📦` (L662–673).
- Cost-summary řádky se rebrandují per-pour_role (L1009–1016): `'Skruž (nosníky — práce)'` vs `'Bednění (práce)'` vs `'Bednění + stojky (práce)'`; rental analogicky.
- HelpPanel už cituje `ČSN EN 12812` (L239) + `ČSN 73 6244` (L235).
- `applicable_element_types` allow-list správně **vylučuje mostovku z lehkých systémů** (Dokaflex, MULTIFLEX, SKYDECK, CC-4) — system selector je nikdy auto-recommendovat nebude.

**Co chybí (gaps — předmět Gate 2–4):**

1. **Žádná `klasifikujPodperu(element)` funkce** — kanonický API z doc §5 (`'skruz' | 'stojky' | 'podperne_leseni'`) **neexistuje**. Display je odvozen od *systému* (`fwSystem.pour_role`), ne od *elementu*. To znamená: pokud uživatel manuálně nasadí lehký systém pod most, **nic neselže a žádný warning se neobjeví**.
2. **Žádný kontext-aware override:** Staxo 100 má globálně `pour_role='props'`. Pod mostovkou (jako podpora pod Top 50) by měl být v UI labelován **„skruž (stojky pod skruží)"** dle TKP 18; aktuálně je labelován jen „Stojky 🔩" (CalculatorResult.tsx:808).
3. **Pricing není rozdělen** do 3–4 kanonických řádků (zřízení / pronájem / odstranění / statický návrh). Zatím existuje jen `formwork_labor_czk + formwork_rental_czk + props_labor_czk + props_rental_czk`. **Statický návrh od výrobce neexistuje** jako pricing field. MSS má `mss_mobilization_czk + mss_demobilization_czk`, ale **flowuje do `formwork_labor_czk`** (žádný separátní řádek).
4. **Žádný explicit user-facing výběr `auto / skruž / stojky`** — uživatel volí `preferred_manufacturer` + `formwork_system_id`, ale kategorii podpěry nikoliv.
5. **Žádný warning** pro: (a) lehký systém pod mostem, (b) podpěrná výška >5 m bez systémového návrhu, (c) skruž bez statického návrhu, (d) mix DOKA + PERI v jedné položce. Confirmed agent C: *„No dedicated 'light-system-on-bridge' warning"*.
6. **HelpPanel L239 obsahuje nepřesný překlad:** `"ČSN EN 12812 — falešné bednění a dočasné konstrukce"` — ČSN EN 12812 hovoří o *podpěrných lešeních*, ne „falešné bednění" (to je doslovný překlad anglického „falsework", ale české normy používají termín *podpěrné lešení / podpěrná konstrukce*).
7. **Žádný odkaz** z UI tooltipů na kanonický dokument `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA.md`.
8. **Tooltip s nosností/kategorií u jednotlivých systémů chybí** v UI (data v katalogu jsou, ale neexponují se).
9. **Warnings shape je `string[]`** bez severity field (planner-orchestrator.ts:767). Pro UI red/orange/info gradient v Gate 3 je nutné zavést `warnings_structured` (deferred backlog item P1 z v4.22 už existuje pro tento účel).
10. **⚠️ Top 50 (DOKA) a VARIOKIT HD 200 (PERI) mají v kódu `pour_role: 'falsework'`** (`formwork-systems.ts:178, :511`), což je v rozporu s DOKA katalogem (Top 50 = Nosníkové bednění) a canonical doc §7. Bug je systematický — header doc-comment (`formwork-systems.ts:25`) explicitně dokumentuje tuto klasifikaci jako záměrnou. Detail viz Gap #8 v sekci C. Vyžaduje opravu v Gate 2/3.

**Migrační složitost:** **STŘEDNÍ.** Převážná infrastruktura (`pour_role`, allow-list, MSS path) je hotová. Hlavní práce je: (a) přidat element-driven klasifikaci jako 2. zdroj pravdy, (b) cross-validovat element vs systém + emit warnings, (c) rozdělit rental do 3 řádků + přidat statický návrh, (d) UI explicit kategorie + tooltipy + cleanup HelpPanel.

**Quantitatives:**
- 28 formwork systémů + 7 props systémů
- 22 element types (10 mostních + 12 budovních/speciálních)
- 21 testovacích souborů v `shared/src` (~7 907 LOC); **5 flagged**, ~3 100 LOC dotčených
- 0 standalone golden snapshotů (vše inlined v test souborech)
- Externí konzumenti: 2 export sites (XLSX) + Portal sync + Registry tovPrefill; **MCP nekonzumuje formwork/props**

**Doporučený split (per task answers):**
- **Gate 2a** = mostní 9 typů + props pod mostem
- **Gate 2b** = budovní 12 typů + stojky pod stropem
- **Gate 3** = UI labels + explicit „kategorie podpěry" výběr + warnings + tooltipy
- **Gate 4** = pricing split (3–4 řádky) + statický návrh field + Excel export rozšíření
- **Cleanup task** (post-Gate 4) = `[CLEANUP] Remove deprecated terminology aliases`, deadline **2026-07-29**, blocker pro public MCP launch

---

## A) Inventář — Formwork & props katalog

### A.1) Formwork systémy (28 entries; `formwork-systems.ts:123–656`)

> **Poznámka k sloupci „Kanonická kategorie":** Tento sloupec reflektuje klasifikaci podle canonical dokumentu §7 TL;DR. Většinou se shoduje s code-derived `pour_role`, kromě dvou case-ů označených ⚠️ (viz Gap #8 v sekci C — Top 50 a VARIOKIT HD 200 jsou v kódu mis-classified).

| Systém | Výrobce | pour_role | Kanonická kategorie | Nosnost / pressure | applicable_element_types |
|---|---|---|---|---|---|
| **Top 50** | DOKA | `falsework` ⚠️ | **Bednění (nosníkové) ⚠️** | nosníkové bednění mostovky (NE skruž — je to bednění stěn/svislých konstrukcí, použitelné jako stěnové bednění mostovky pouze ve formě svislé desky) | [mostovkova_deska, rigel] ⚠️ — viz Gap #8 |
| **VARIOKIT HD 200** | PERI | `falsework` ⚠️ | **Nosník (Heavy-Duty Truss Girder) ⚠️** | primárně horizontální nosník nad falsework věží (VARIOKIT VST), ne falsework sám o sobě | [mostovkova_deska, rigel] ⚠️ — pouze ve smyslu „horizontální překlenutí nad falsework", ne sám falsework |
| **Staxo 100** | DOKA | `props` | **Stojky / pod mostem skruž** | 100 kN/noha (1000 kN/věž) | [mostovkova_deska, rigel, stropni_deska, pruvlak, schodiste] |
| **UP Rosett Flex** | PERI | `props` | **Stojky / heavy shoring** | max 25 m výška | [mostovkova_deska, rigel, stropni_deska, pruvlak, schodiste] |
| **Dokaflex** | DOKA | `formwork_props` | **Stojky + bednění** (Dokaflex 20 = budovní strop) | <5.5 m | [stropni_deska, zakladova_deska, zakladovy_pas, pruvlak] |
| **SKYDECK** | PERI | `formwork_props` | **Stojky + bednění** | <6 m | [stropni_deska, zakladova_deska, pruvlak] |
| **MULTIFLEX** | PERI | `formwork_props` | **Stojky + bednění** (GT24 + VT20) | <5 m | [stropni_deska, zakladova_deska, pruvlak] |
| **CC-4** | ULMA | `formwork_props` | **Stojky + bednění** (Al nosníky) | <6 m | [stropni_deska, zakladova_deska] |
| **DOKA MSS** | DOKA | `mss_integrated` | **Posuvná skruž (MSS dolní)** | reuse 0.35 | [mostovkova_deska, rigel] |
| **VARIOKIT Mobile** | PERI | `mss_integrated` | **Posuvná skruž (MSS dolní)** | reuse 0.35 | [mostovkova_deska, rigel] |
| Frami Xlife | DOKA | `formwork` | Bednění (stěnové, 60 kN/m²) | — | wall-default |
| Framax Xlife | DOKA | `formwork` | Bednění (120 kN/m²) | — | wall |
| TRIO | PERI | `formwork` | Bednění (stěny mostů, opěry) | — | wall |
| MAXIMO | PERI | `formwork` | Bednění (stěny budov) | — | wall |
| DOMINO | PERI | `formwork` | Bednění (lehké manuální 24 kg/m²) | — | wall |
| VARIO GT 24 | PERI | `formwork` | Bednění (vysoké stěny / pilíře) | — | wall/column |
| VARIO | PERI | `formwork` | Bednění (custom column pilířů) | — | [sloup, driky_piliru] |
| DUO | PERI | `formwork` | Bednění (lehké univerzální 22 kg/m²) | — | wall |
| QUATTRO | PERI | `formwork` | Bednění (sloupy 20–60 cm) | — | [sloup, driky_piliru] |
| RUNDFLEX | PERI | `formwork` | Bednění (kruhové R≥1 m) | — | [nadrz] |
| SRS | PERI | `formwork` | Bednění (kruhové sloupy Ø 25–70 cm) | — | [sloup] |
| SL-1 Sloupové | DOKA | `formwork` | Bednění (sloupové) | — | [sloup, driky_piliru] |
| MEGALITE | ULMA | `formwork` | Bednění (large-format wall) | — | wall |
| COMAIN | ULMA | `formwork` | Bednění (frameworks foundations/walls) | — | foundation/wall |
| NOEtop | NOE | `formwork` | Bednění (wall, simple locking) | — | wall |
| **Top 50 Cornice** | DOKA | `formwork` | **Římsové bednění T (vozík)** | unit `bm` | [rimsa] |
| CB 240 | PERI | `formwork` | Climbing console (240 kN, jednostranné) | — | climbing |
| Tradiční tesařské | Local | `formwork` | Bednění (univerzální, 0 Kč rental) | — | universal |

### A.2) Props systémy (7 entries; `props-calculator.ts:38–115`)

| Systém | Výrobce | Výška m | Nosnost / Kč/prop/den | Kanonická kategorie |
|---|---|---|---|---|
| Eurex 20 top | DOKA | 1.5–3.5 | 12 Kč/d | **Stojky (nízké budovy)** |
| Eurex 30 top | DOKA | 2.5–5.5 | 18 Kč/d | **Stojky (běžné budovy)** |
| Staxo 40 | DOKA | 4.0–12.0 | 45 Kč/d | **Stojky (s Dokaflex 20 — bytová)** |
| **Staxo 100** | DOKA | 8.0–20.0 | 75 Kč/d | **pod Top 50 = skruž (mostní)** |
| PEP Ergo | PERI | 1.5–3.5 | 11 Kč/d | Stojky (lehké) |
| Multiprop MP 250 | PERI | 1.5–5.0 | 15 Kč/d | Stojky |
| ST 100 | PERI | 4.0–14.0 | 50 Kč/d | **pod VARIOKIT HD = skruž (mostní)** |

### A.3) Klíčová pozorování — gap vs. canonical doc

- **Globální `pour_role` na Staxo 100 = `props`** (správně z hlediska systému), ale z hlediska kontextu (mostovka) by měl být **„skruž (stojky pod skruží)"**. Aktuálně UI label jen „Stojky 🔩" nezachytí TKP 18 kontext.
- **⚠️ Top 50 jako falsework v kódu — NESPRÁVNÉ.** Code říká `falsework`, DOKA katalog („Nosníkové bednění Top 50") a canonical doc §7 říkají **bednění**. Detail v Gap #8 (sekce C.3).
- **MSS positivně mapováno** (`mss_integrated` + reuse 0.35 + applicable [mostovkova_deska, rigel]).
- **Žádný „statický návrh od výrobce"** atribut na žádném systému (canonical §6 + §8 vyžaduje pro skruž / demolici).
- **Žádný `kategorie: 'skruz'|'stojky'|'podperne_leseni'`** na úrovni katalogu — odvozuje se až per-render z `pour_role`.

---

## B) Inventář — Element types & bridge classification

### B.1) 22 kanonických element types (`element-classifier.ts:117–510`)

**Mostní (10) — `BRIDGE_ELEMENT_TYPES`, L783:** `zaklady_piliru`, `driky_piliru`, `rimsa`, `operne_zdi`, `mostovkova_deska` ★, `rigel` ★, `opery_ulozne_prahy`, `kridla_opery`, `mostni_zavirne_zidky`, `prechodova_deska`

**Budovní (9):** `zakladova_deska`, `zakladovy_pas`, `zakladova_patka`, `stropni_deska` ★, `stena`, `sloup`, `pruvlak` ★, `schodiste` ★, `nadrz`

**Speciální (3):** `podzemni_stena`, `pilota` (no formwork, no supports), `podkladni_beton` / `podlozkovy_blok`

★ = `needs_supports=true` (5 typů: mostovkova_deska, rigel, stropni_deska, pruvlak, schodiste — jediné, které triggerují `calculateProps()` v orchestrátoru).

### B.2) BRIDGE_EQUIVALENT remap (`element-classifier.ts:790–798`)

Když `ClassificationContext.is_bridge=true`, klasifikátor remappuje 7 budovních typů na mostní ekvivalenty: `sloup→driky_piliru`, `zakladova_deska→zaklady_piliru`, `zakladovy_pas→zaklady_piliru`, `zakladova_patka→zaklady_piliru`, `stropni_deska→mostovkova_deska`, `pruvlak→rigel`, `stena→operne_zdi`.

### B.3) Klíčová pozorování

- **Žádný explicit `BRIDGE_ELEMENT_ORDER` ani `BUILDING_ELEMENT_ORDER`** konstanta — klasifikace je context-driven přes `is_bridge` flag + `BRIDGE_EQUIVALENT` map.
- **Pile path je separate:** `pilota` má `needs_formwork=false` + `needs_supports=false` + early-branch v `runPilePath()` v orchestrátoru → **out of scope pro skruž/stojky terminology** (zemina = forma).
- **Gate 2a (mostní) skutečný scope:** pouze **mostovkova_deska + rigel** mají `needs_supports=true`. Ostatních 8 mostních typů (opěry, křídla, římsy, závěrné zídky, přechodová deska, opěrné zdi, dříky pilířů, základy pilířů) nepodléhá props/skruž rozhodování — řeší se přes `recommended_formwork` allow-list.
- **Gate 2b (budovní) skutečný scope:** stropni_deska + pruvlak + schodiste mají `needs_supports=true` — to je terén pro „stojky" rozhodování.

---

## C) Inventář — Terminology mismatches v kódu & UI

### C.1) Code-level gaps

1. **Žádný element-driven `klasifikujPodperu()` API.** Canonical doc §5 specifikuje signature vracející `'skruz' | 'stojky' | 'podperne_leseni'` na základě element type + výška + zatížení + kontext. V kódu **neexistuje žádný takový selector** — display je odvozen od *systému* (`fwSystem.pour_role`). Důsledek: pokud uživatel manuálně nasadí lehký systém pod most, kalkulátor nezná „element vs. systém" rozpor. Hledání symbolů `klasifikujPodperu`, `kategorie_podpery`, `support_category` napříč `shared/src/calculators/planner-orchestrator.ts` a `shared/src/classifiers/element-classifier.ts` vrací 0 výsledků.

2. **Žádný `kategorie` field na `FormworkSystemSpec`.** `shared/src/constants-data/formwork-systems.ts:40–110` exponuje `pour_role: 'formwork'|'falsework'|'props'|'formwork_props'|'mss_integrated'` (L89) + `formwork_category: 'wall'|'slab'|'column'|'special'|'universal'|'support_tower'` (L82). Ani jeden není canonical axis `skruz/stojky/podperne_leseni` z doc §5 — taxonomie je překryvná, ne přímá.

### C.2) UI-level gaps

3. **System-driven labelling se rozchází s TKP 18 kontextem.** `frontend/src/components/calculator/CalculatorResult.tsx:802–808` props card je vždy titulkován `"Stojky 🔩"` ze `pour_role='props'`. Když mostovka používá Top 50 (`falsework`) + Staxo 100 (`props`) zespoda, canonical TKP 18 + canonical doc §3 nazývá celou sestavu **„skruž"** — aktuální Staxo card jako „Stojky" mostní kontext nezachytí.

4. **Žádný user-facing výběr kategorie podpěry.** `frontend/src/components/calculator/CalculatorFormFields.tsx:1361` má dropdown `Výrobce bednění` (DOKA/PERI/ULMA/NOE/Místní) a L1377 má select `Systém bednění`. **Nikde není field `auto / skruž / stojky`** — uživatel nemá explicitní override kategorie (per task answer #2 → scope Gate 3).

5. **Žádný tooltip s nosností / kategorií u systémů.** `formwork-systems.ts` má kompletní data (nosnost, `max_assembly_height_m`, `applicable_element_types`). UI je neexponuje — nejblíž je `CalculatorResult.tsx:1207` jediný Row `"Skruž"` s `plan.norms_sources.skruz` (TKP 18 reference string), žádný per-system info popover.

6. **HelpPanel L239 — nepřesný překlad normy.** `frontend/src/components/calculator/HelpPanel.tsx:239`: literál `"ČSN EN 12812 — falešné bednění a dočasné konstrukce"`. Canonical doc §1 + §7: ČSN EN 12812 v české terminologii pokrývá **„podpěrná lešení / podpěrná konstrukce"**. „Falešné bednění" je doslovný překlad anglického *falsework* a v ČSN se nevyskytuje.

7. **Žádný odkaz z UI na canonical doc.** `HelpPanel.tsx:234–239` cituje normy jen jménem, žádný link na `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA.md`. `CalculatorResult.tsx` ani `CalculatorFormFields.tsx` neobsahují žádný tooltip / „info ⓘ" odkaz na kanonický slovník pojmů.

### C.3) Catalog data quality

8. **Gap #8: Systematic misclassification of Top 50 and VARIOKIT HD 200 as `falsework`**

   **File:line:**
   - `formwork-systems.ts:178` — Top 50 has `pour_role: 'falsework'`
   - `formwork-systems.ts:511` — VARIOKIT HD 200 has `pour_role: 'falsework'`
   - `formwork-systems.ts:25` — header doc-comment dokumentuje tuto klasifikaci jako záměrnou: `'falsework' — nosníková skruž (Top 50, VARIOKIT engineering...)`
   - `formwork-systems.ts:170` — Top 50 description repeats wrong term: `"Nosníková skruž Top 50 — mostovky + stropy..."`
   - `formwork-systems.ts:504` — VARIOKIT HD 200 description repeats: `"...PERI ekvivalent nosníkové skruže Top 50"`

   **Verified facts:**
   - DOKA Xpress 2/2020 + asb-portal: Top 50 = „Nosníkové bednění Top 50" (bednění)
   - DOKA categorization: Staxo 100 = falsework, Top 50 = bednění
   - PERI catalog: VARIOKIT HD 200 = Heavy-Duty Truss Girder (nosník), used ABOVE falsework (VST), not as falsework itself
   - Canonical doc §7 TL;DR: „Top 50 je skruž? — NE. Top 50 je nosníkové bednění (stěn)."

   **Impact:** This systematic misclassification causes calculator to select Top 50 as falsework for horizontal load-bearing scenarios (e.g., základy pilířů), which is technically incorrect and was reported by user as a real bug.

   **Recommendation for Gate 2/3 (NOT to be implemented in Gate 1):**
   - Top 50 should have `pour_role: 'formwork'` (with attribute indicating „nosníkové, primárně stěnové")
   - VARIOKIT HD 200 should have `pour_role: 'formwork'` or new enum value for horizontal-truss systems
   - Header doc-comment L25 must be updated
   - Descriptions L170, L504 must be updated to remove „skruž" / „nosníková skruž" wording
   - Existing tests using these systems may need fixture updates

### C.4) Verified consistent — no action needed

- `frontend/src/components/calculator/applyPlanToPositions.ts:298` profession `'Tesař (podpěry)'`, L569 BOM item `'podpěrná konstr.'`, L301 note `'podpěrná konstr. — montáž + demontáž'` — všechny používají kanonickou českou terminologii, žádný gap.
- `CalculatorResult.tsx:662–673` card titles `'Skruž (nosníky)'` / `'Bednění + stojky'` / `'Posuvná skruž (MSS) — vše integrováno'` / `'Bednění'` — kanonický pour_role-driven branching už funguje *jako mechanismus* (data o tom, které systémy spadají do `falsework`, jsou bug — viz Gap #8).
- `CalculatorResult.tsx:1009–1016` cost-row labels `'Skruž (nosníky — práce)'` / `'Pronájem skruže (nosníky)'` — kanonické.
- `HelpPanel.tsx:235` `"ČSN 73 6244 — skruž mostovek, minimální doba ponechání podpěr"` — kanonické.

### C.5) Observation (not gap)

- `planner-orchestrator.ts:1498–1513` interně používá var prefix `skruz*` (`skruzConstructionType`, `skruzMinDays`, `skruzTableLookup`) pro výpočet minimální doby ponechání podpěr (`PROPS_MIN_DAYS` lookup). Codebase intermixuje **„skruz" naming na element-level** s **„props" naming na system-level** pro tentýž koncept. Není gap, ale signál pro Gate 2 — budoucí cleanup by měl zvolit jednu axis konzistentně.

---

## D) Inventář — Pricing structure (current state + gap vs §8)

### D.1) Cost fields na `PlannerOutput.costs` (`planner-orchestrator.ts:382–411`)

- `formwork_labor_czk` — assembly + disassembly labor for formwork (tesaři); **bundled** (3-phase model vrací `initial + middle + final` phase labor jako jeden agregát, bez zřízení/odstranění splitu)
- `formwork_rental_czk` — `rental_czk_m2_month × adjusted_area_m2 × (total_days / 30)` (computed v `formwork.ts:190–220` přes `calculateThreePhaseFormwork`)
- `props_labor_czk` — assembly + disassembly labor for props (0 pokud `needs_supports=false`); **bundled**, ne split
- `props_rental_czk` — `rental_czk_per_prop_day × num_props × rental_days` (computed v `props-calculator.ts:38–115` přes `calculateProps`, `rental_days` z maturity / ČSN EN 13670 hold time, vyvoláno na `planner-orchestrator.ts:~1882–1890`)
- `is_mss_path: boolean` — true když plan používá MSS (form/skruž/stojky integrated)
- `mss_mobilization_czk` — one-off MSS setup labor (tesaři vlastní síly); **flowuje do `formwork_labor_czk`**, ne samostatný row
- `mss_demobilization_czk` — MSS teardown labor; **flowuje do `formwork_labor_czk`**
- `mss_rental_czk` — MSS machine monthly rental × měsíců (separate od labor); odvozeno z `bridge-technology.ts calculateMSSCost.rental_total_czk` přes `planner-orchestrator.ts:~2047`
- *(rebar / pour fields: `rebar_labor_czk`, `pour_labor_czk`, `pour_night_premium_czk`, `total_labor_czk` — mimo scope tohoto auditu)*

### D.2) Excel export current shape (`frontend/src/utils/exportPlanXLSX.ts`)

- L20–21 — payload type referencuje `props_labor_czk` + `props_rental_czk` jako povinná fields (pokud rename → frontend export selže na type-check)
- L273–282 sekce **„Podpěrná konstrukce (stojky / skruž)"**: Row `'Pronájem celkem'` (`plan.props.rental_days` v dnech) + Row `'Pronájem — náklady'` (`plan.props.rental_cost_czk` v Kč)
- L345 row `'Bednění — pronájem'` (`formwork_rental_czk`); L347 row `'Podpěry — pronájem'` (`props_rental_czk`, podmíněně)
- L356 total row `formwork_labor + formwork_rental + props_labor + props_rental`
- L566–600 strategy comparison columns: `'Formwork'`, `'Crew'`, `'Sets'`, `'Days'`, `'Formwork Labor (Kč)'`, `'Rental (Kč)'`, `'Total Labor (Kč)'`
- **Žádný řádek „Zřízení"** ani **„Odstranění"** jako samostatná položka; **žádný řádek „Statický návrh / projekt od výrobce"**

### D.3) CalculatorResult cost summary (`frontend/src/components/calculator/CalculatorResult.tsx:990–1160`)

- L1009–1016 cost-row labels per `pour_role`: `'Skruž (nosníky — práce)'` / `'Bednění + stojky (práce)'` / `'Bednění (práce)'` + analogické rental rows (`'Pronájem skruže (nosníky)'` / `'Pronájem bednění + stojky'` / `'Pronájem bednění'`)
- L1118 subtotal row `'↳ Tesařské práce (skruž + stojky)'` když je formwork i props nenulové
- L1144 italický row `'↳ Pronájem skruže'` (props_rental_czk pod falsework path)
- Všechny tyto labely renderují **z agregátu** `formwork_labor_czk` / `props_labor_czk` — není underlying split na zřízení vs. odstranění

### D.4) Gap vs canonical doc §8

Canonical doc §8 specifikuje, že pronájem skruže / stojek se v rozpočtu **rozděluje do 3 řádků** (Zřízení / Pronájem / Odstranění) **s volitelným 4. řádkem „Statický návrh / projekt od výrobce"** (typicky 15–50 tis. Kč běžná mostovka, 100+ tis. Kč demolice). Current state:

- **Zřízení vs Odstranění:** nejsou separate; **assembly + disassembly labor je sloučeno** v `formwork_labor_czk` (3-phase model) a v `props_labor_czk` (calculateProps vrací jeden agregátní `labor_cost_czk`).
- **Pronájem:** ✓ je separate (`formwork_rental_czk`, `props_rental_czk`, `mss_rental_czk`).
- **Statický návrh od výrobce:** **neexistuje žádný field** na `PlannerOutput.costs` ani v `FormworkSystemSpec`. Canonical doc §6 + §8 vyžaduje pro skruž a demolici samostatnou pricing položku.
- **MSS mobilization/demobilization:** existují jako separate fields, ale **flowují do agregátu `formwork_labor_czk`** — Excel ani cost-summary je nezobrazí jako samostatné řádky.

### D.5) Migrační princip pro Gate 4

Current state má pronájem oddělený, ale labor (zřízení + odstranění) sloučený, a chybí field pro statický návrh od výrobce. Canonical §8 vyžaduje 3 řádky labor/rental + volitelný 4. řádek statický návrh. Gate 4 task navrhne split s **dual-write přes deprecation aliasy do 2026-07-29** — staré agregáty (`formwork_labor_czk`, `props_labor_czk`) zůstanou populované jako součet nových rozdělených fieldů, downstream konzumenti (Portal, Registry, MCP) tak neselžou. Konkrétní field names + Excel sloupce + Portal sync schema = scope Gate 4 task spec, ne tohoto auditu.

---

## E) Inventář — Warnings (canonical-required vs. existing)

### E.1) Canonical-required warnings (z task spec „Warnings" + canonical doc §6)

| # | Warning | Závažnost | Trigger condition | Status v kódu |
|---|---|---|---|---|
| W1 | Stojky pod mostem | **RED** | mostní element + selected system má lehký pour_role (`formwork_props`) nebo prop systém pod limit nosnosti pro skruž | ❌ chybí |
| W2 | Lehký systém při výšce > 5 m | **ORANGE** | `height_m > 5` + selected system mimo {Staxo 100, UP Rosett, MSS, ekvivalent} | ❌ chybí |
| W3 | Skruž bez statického návrhu od výrobce | **INFO** | `pour_role='falsework'` nebo bridge context + missing design reference | ❌ chybí (Gate 4 — pricing field neexistuje) |
| W4 | Mix DOKA + PERI v jedné položce | **YELLOW** | formwork manufacturer ≠ props manufacturer | ❌ chybí |

### E.2) Existing warnings v kódu (`shared/src/calculators/planner-orchestrator.ts`)

`warnings: string[]` flat array — `PlannerOutput` typ deklaruje na L513, function param L618, init L767. Celkem ~21 push/unshift sites. **Žádný z nich neimplementuje W1-W4.** Representative seznam:

- L627 — exposure class neodpovídá element type
- L794 — nízká classification confidence (<60%)
- L826 (`unshift`) — volume-vs-geometry kritický rozpor (top of list)
- L892 — formwork system nenalezen, použit fallback
- L899–902 — lateral pressure exceedance (DIN 18218)
- L934–937 — preferred manufacturer empty pool, fallback
- L958–961 — crane needed (item weight > limit)
- L964–966 — height > 1.2 m → lateral supports IB
- L969–972 — Frami Xlife pressure edge
- L1098–1105 — staged pouring DIN 18218 per-záběr
- L1127 — merged z `pourDecision.warnings`
- L1133–1148 — rimsa-specific (záběr spacing, construction sequence, bridge length missing)
- L1168–1170 — deck thickness sanity (mostovka)
- L1174–1177 — mostovka construction sequence
- L1190–1223 — mostní subtype reminders (předpětí auto, komorový nosník, přechodová deska sequence)

### E.3) Verified consistent — existing warnings v souladu s ČSN / DIN

- L958–961 crane needed → konsistentní s TKP 18 + DOKA katalogem (pro skruže nad N kg vyžaduje jeřáb).
- L964–966 height > 1.2 m → lateral support IB → konsistentní s DIN 18218.
- L1098–1105 staged pouring → konsistentní s DIN 18218 + canonical doc §6 (max-stage formula `sys.pressure / full_pressure × h`, min 1.5 m).
- Tyto warnings nejsou předmětem skruž/stojky terminology tasku, ale nejsou v rozporu s canonical doc — orthogonal coverage.

### E.4) Observation — warnings shape gap (cross-ref Sec 0 #9)

`warnings: string[]` plain array bez `severity` field. UI rendering v `frontend/src/components/calculator/CalculatorResult.tsx:576–579` mapuje na flat `<li>` (`plan.warnings.map((w, i) => <li>{w}</li>)`), nelze stylovat RED/ORANGE/INFO bez severity. Implementace W1-W4 v Gate 3 závisí na zavedení paralelního `warnings_structured` field — viz gap #9 v sekci 0 + deferred backlog item P1 z v4.22 Phase 2.

---

## F) Inventář — Tests

### F.1) Test discovery summary (Monolit-Planner)

- **Framework:** Vitest 4.0.16 (`Monolit-Planner/shared/package.json` → `"vitest": "^4.0.16"`).
- **Test files:** 21 v `shared/src/**/*.test.ts` + 7 v `backend/tests/**/*.test.js`. Žádné frontend testy, žádné `__snapshots__/` ani `__fixtures__/` adresáře.
- **Total `it / test / describe` blocks v shared:** 1075 (`grep -rEc "^\s*(it|test|describe)\(" shared/src --include="*.test.ts"`). CLAUDE.md cituje **921**; rozdíl jsou `describe` wrapper bloky a `test.each` parametrizace.
- **Files dotčené terminologií** (`skruz|stojky|falsework|top 50|variokit|podpera|pour_role|formwork_category`): **5 z 21**:
  - `shared/src/classifiers/element-classifier.test.ts`
  - `shared/src/calculators/lateral-pressure.test.ts`
  - `shared/src/calculators/planner-orchestrator.test.ts`
  - `shared/src/calculators/position-linking.test.ts`
  - `shared/src/constants-data/formwork-systems.test.ts`
- **Files testující `pour_role` klasifikaci přímo:** 3 z 5 výše (`element-classifier`, `planner-orchestrator`, `formwork-systems`).
- **Backend testy** (`backend/tests/`): 0 hits na terminology — Portal sync + DB integration testy nejsou ovlivněny.

### F.2) Affected tests classified (per Variant 3 — per-test rozhodnutí post-Gate-1)

**A) Auto-pass (žádná změna nutná):** **~16 z 21 shared test souborů + všech 7 backend.** Reprezentativní:
- `formulas.test.ts`, `pump-engine.test.ts`, `exposure-combination.test.ts`, `maturity.test.ts`, `rebar-lite.test.ts`, `pert.test.ts`, `bridge-technology.test.ts`, `calendar-engine.test.ts`, `tariff-versioning.test.ts`, `pile-engine.test.ts`, `element-scheduler.test.ts`, `formwork-3phase.test.ts`, `pour-task-engine.test.ts`, `pour-decision.test.ts`, `element-audit.test.ts`, `tz-text-extractor.test.ts` — logic / math / scheduling nezávislé na skruž/stojky terminology.

**B) Fixture update needed (Gate 3 UI label changes):** **0 souborů.** Žádné frontend testy, žádné snapshot testy, žádné UI label assertions v shared testech — UI label změny v `CalculatorResult.tsx` (Gate 3) se neprojeví v existujících test fixtures.

**C) Manual review needed (assertions závislé na klasifikaci nebo cost shape):** **5 souborů:**
- `shared/src/constants-data/formwork-systems.test.ts:23–26` — explicit assert `top50.pour_role === 'falsework'` (popisek: *„Top 50 is classified as falsework (nosníková skruž), not slab formwork"*) → **invert v Gap #8 fix**
- `shared/src/constants-data/formwork-systems.test.ts:66–67` — `variokit.pour_role === 'falsework'` (popisek *„VARIOKIT HD 200 ... (bridge falsework)"*) → **invert v Gap #8 fix**
- `shared/src/classifiers/element-classifier.test.ts:633–642` — 2 testy: *„mostovka with clearance > 4 m returns Top 50 (falsework)"* + *„mostovka with clearance ≥ 8 m STILL returns Top 50"* → **assertions po Gate 2/3 vrátí jiný systém + jiný `pour_role`**
- `shared/src/classifiers/element-classifier.test.ts:672` — popisek *„VARIOKIT HD 200 (PERI bridge falsework) is available for mostovka"* → **invert popisek + asserce**
- `shared/src/calculators/lateral-pressure.test.ts` — sort stability MOCK_SYSTEMS using `formwork_category` (per sub-agent inventory F); pokud Gate 2 přidá `kategorie` axis nebo přejmenuje category, sort order může selhat
- `shared/src/calculators/planner-orchestrator.test.ts` — strategy comparison test L100–136 + cost-split assertions L115–128 (pokud Gate 4 split rozdělí `formwork_labor_czk`/`props_labor_czk` na zřízení+pronájem+odstranění+statický návrh, struktura se rozšíří — současná assertions zůstanou, dual-write je zachytí)

### F.3) Critical observation — Historical root of Gap #8

**Terminology Commit 2 (2026-04-17)** byl koordinovaný fix Bug #5 z SO-202 audit (2026-04-16), realizovaný uživatelem.

**Před fix-em:** `recommendFormwork(mostovkova_deska, h=7.8)` vracel Staxo 100 jako primary `fwSystem`. To byl skutečný bug — Staxo 100 je load-bearing tower (DOKA term, viz canonical doc §9.3), ne formwork. Calculator míchal vrstvy.

**Intent fix-u byl správný:** oddělit formwork pool (Top 50) od props pool (Staxo 100 / Staxo 40) pro mostovkovou desku.

**Side-effect fix-u:** terminologie `'falsework'` přiřazená Top 50 v `pour_role` je v rozporu s:
- DOKA katalogem (Top 50 = „Nosníkové bednění" = formwork, viz canonical doc §9.1)
- Canonical doc §7 TL;DR (*„Top 50 je skruž? — NE. Je to bednění, ne podpora."*)

**Codifying míst:**
- `formwork-systems.test.ts:23–26` a :66–67 — explicit `pour_role` assertions pro Top 50 / VARIOKIT HD 200
- `element-classifier.test.ts:630–642` — komentář *„Terminology Commit 2 (2026-04-17): selector honors pour_role + applicable_element_types allow-list"*
- `formwork-systems.ts:25, 162–178, 170, 496–511, 504` — code + descriptions
- 3 golden specs (`test-data/tz/SO-202_D6_most_golden_test.md`, `SO-203_D6_most_golden_test_v2.md`, `SO-207_D6_estakada_golden_test_v2.md`) v4.21.0 Re-Snapshot sekce

**Implikace pro Gate 2 fix Gap #8:**

Fix musí **zachovat intent** Terminology Commit 2 (oddělení vrstev — Top 50 nahoře pro bednění, Staxo 100 / Staxo 40 dole pro podpěru) a **opravit terminologii**.

Plná 3-vrstvá taxonomie pro mostovku je definována v canonical doc Section 9.2. Konkrétní implementation strategy (jak měnit `pour_role` enum, jak invertovat assertions v testech, jak v4.22.0 Re-Snapshot v golden specs) je **scope Gate 2 task spec**, ne tohoto auditu.

---

## G) Golden tests — inventory

Reference: `docs/CALCULATOR_PHILOSOPHY.md` (acceptance criteria philosophy), `docs/normy/navody/SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md` (3-layer stack pro mostovku).

### G.1) Discovery

**OPRAVA předchozí discovery:** Section G v commit `8d98863` nesprávně tvrdila, že `test-data/` neexistuje. Discovery byla provedena s prefixem `Monolit-Planner/`, ale `test-data/` je v ROOT repu jako sourozenec `Monolit-Planner/`. CLAUDE.md cesta `test-data/tz/SO-202_D6_most_golden_test.md` je správná.

**Skutečná existence golden specs:**

| Soubor | Velikost | Datum | Pokrytí |
|---|---|---|---|
| `test-data/tz/SO-202_D6_most_golden_test.md` | 12 KB | 2026-04-26 | D6 most, ~8 element types |
| `test-data/tz/SO-203_D6_most_golden_test_v2.md` | 39 KB | 2026-04-26 | D6 most, ~12 element types, 3-way TZ↔B3↔TKP |
| `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` | 41 KB | 2026-04-26 | D6 estakáda, ~15 element types, MSS path |

**Format:** Markdown reference docs s explicit golden assertions, **ne** automated test fixtures. Manual verification proti calculator output.

**Žádné:** `*.snap`, `*.golden.*`, `__fixtures__/`, `__snapshots__/` adresáře. Žádný automated golden test framework v Monolit-Planner scope.

**Existuje v jiném scope:** `URS_MATCHER_SERVICE/backend/tests/fixtures` (URS classifier scope, ne calculator scope) + `concrete-agent/packages/core-backend/tests/test_mcp_golden_so202.py` (Python, MCP tool scope).

### G.2) Per-test analysis

**SO-202 — D6 Karlovy Vary, Most na I/6 km 0.900**
- ~8 element types: pilota Ø900, zaklady_piliru, opery_ulozne_prahy, kridla_opery, driky_piliru, mostovkova_deska, prechodova_deska, rimsa
- 24 known bugs registered (P0 / P1 / P2 priorities)
- Section 5 obsahuje explicit golden assertions per prvek (curing days per třída ošetř., lateral pressure, costs)
- **v4.21.0 Re-Snapshot section (L18–30)** explicitně dokumentuje Top 50 jako `pour_role='falsework'` — viz Gap #8 (sekce C.3)

**SO-203 — D6, Most na I/6 km 2.450**
- ~12 element types, three-way cross-check (TZ ↔ B3 ↔ TKP)
- 47+ YAML assertion blocks
- **v4.21.0 Re-Snapshot** stejná Top 50 `'falsework'` classification jako SO-202 (Gap #8)

**SO-207 — D6, Estakáda I/6 km 4.450–4.650**
- ~15 element types, MSS path (posuvná skruž), asymetrický most LM 9 polí + PM 10 polí
- `pour_role='mss_integrated'` je canonical-correct (per Section 9.2 — MSS je samostatná vrstva integrující všechny 3 layers)
- **NENÍ ovlivněn Gap #8** — Top 50 falsework classification se netýká MSS path

**Decision flag per Variant 3 (per-test rozhodnutí post-Gate-1):**

| Soubor | Flag | Důvod |
|---|---|---|
| SO-202 | KEEP_AND_ADD_V2 | v4.21.0 Re-Snapshot section codifies buggy terminology — fix v Gate 2 vyžaduje v4.22.0 Re-Snapshot section dokumentující terminology correction |
| SO-203 | KEEP_AND_ADD_V2 | Stejně jako SO-202 |
| SO-207 | OVERWRITE | MSS path není ovlivněn Gap #8, lze přepsat bez problémů |

### G.3) Reference projects status

SO-202, SO-203, SO-207 **existují** jako Markdown reference dokumenty v `test-data/tz/`, **ne** jako automated tests.

**Format:** TZ source + golden assertion blocks (YAML / Markdown) + bug registry per project.

**Coverage:** 3 mostní projekty (D6 dálnice), všechny předpjaté betonové, varieta technologií (pevná skruž, MSS).

**Reproducibilita:** NEAUTOMATIZOVANÁ — manual verification proti calculator output. **Gap pro Gate 2:** žádný automated framework, který by parsoval tyto MD soubory a verifikoval calculator output proti nim.

**Doporučení (consistent s Calculator Philosophy):**
- V rámci Gate 2.0 zvážit konverzi 3 MD specs na automated Vitest fixtures pro regression coverage Gap #8 fix a budoucích změn
- Acceptance criteria: technologická správnost (správný stack per element type per Section 9.2) + tolerance ±10–15 % pro numerické hodnoty
- Bez exact precision (per philosophy §3 — kalkulátor je orientační odhad pro tendrovou kalkulaci)

### G.4) Coverage matrix

Pokrytí 22 element types golden specs:

| Element type | SO-202 | SO-203 | SO-207 | Coverage |
|---|---|---|---|---|
| pilota | ✅ Ø900 | ✅ Ø1200 | ✅ mix | Plné |
| zaklady_piliru | ✅ §5b | ✅ | ✅ | Plné |
| opery_ulozne_prahy | ✅ §5c | ✅ | ✅ | Plné |
| kridla_opery | ✅ | ✅ | ✅ | Plné |
| driky_piliru | ✅ §5d–e | ✅ | — | Částečné |
| mostovkova_deska | ✅ §5f fixed | ✅ fixed | ✅ MSS | Plné |
| prechodova_deska | ✅ | ✅ | ✅ | Plné |
| rimsa | ✅ | ✅ | ✅ | Plné |
| mostni_zaver | — | ✅ | ✅ | Částečné |
| lozisko | — | ✅ | — | Slabé |
| izolace_mostovky | — | ✅ | — | Slabé |
| vozovka | — | ✅ | ✅ | Částečné |
| svodidlo | — | ✅ | ✅ | Částečné |
| odvodneni | — | ✅ | — | Slabé |
| PHS | — | — | ✅ | Slabé |
| monitoring | — | — | ✅ | Slabé |
| **Pozemní stavby** (zakladova_deska, sloup pozemní, monolitická stěna, schodiště, atd.) | — | — | — | **Žádné** |

**Pozorování:**
- Mostní prvky pokryté 1–3 referenčními projekty (relativně dobré)
- Pozemní prvky bez golden coverage — pro Gate 2b (budovní) nutno spoléhat na manual smoke testing nebo vytvořit nový golden spec (např. VP4 FORESTINA pokud bude dostupný)
- Risk pro Gate 2: prvky bez goldenu (zejména pozemní) budou fix-nuty bez automated verification

<!-- CONTINUED — section H, migration plan to follow -->
