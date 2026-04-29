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
- Top 50 (DOKA) + VARIOKIT HD 200 (PERI) jsou klasifikované jako `falsework` (skruž / nosníková konstrukce).
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

| Systém | Výrobce | pour_role | Kanonická kategorie | Nosnost / pressure | applicable_element_types |
|---|---|---|---|---|---|
| **Top 50** | DOKA | `falsework` | **Skruž (nosníky H20/GT24)** | nosníkové bednění mostovky | [mostovkova_deska, rigel] |
| **VARIOKIT HD 200** | PERI | `falsework` | **Skruž (PERI ekvivalent Top 50)** | bridge engineering kit | [mostovkova_deska, rigel] |
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
- **Top 50 jako falsework je correct** (DOKA katalog: „nosníkové bednění" = canonical „skruž" v mostním rozpočtu).
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

### C.3) Verified consistent — no action needed

- `frontend/src/components/calculator/applyPlanToPositions.ts:298` profession `'Tesař (podpěry)'`, L569 BOM item `'podpěrná konstr.'`, L301 note `'podpěrná konstr. — montáž + demontáž'` — všechny používají kanonickou českou terminologii, žádný gap.
- `CalculatorResult.tsx:662–673` card titles `'Skruž (nosníky)'` / `'Bednění + stojky'` / `'Posuvná skruž (MSS) — vše integrováno'` / `'Bednění'` — kanonický pour_role-driven branching už funguje.
- `CalculatorResult.tsx:1009–1016` cost-row labels `'Skruž (nosníky — práce)'` / `'Pronájem skruže (nosníky)'` — kanonické.
- `HelpPanel.tsx:235` `"ČSN 73 6244 — skruž mostovek, minimální doba ponechání podpěr"` — kanonické.

### C.4) Observation (not gap)

- `planner-orchestrator.ts:1498–1513` interně používá var prefix `skruz*` (`skruzConstructionType`, `skruzMinDays`, `skruzTableLookup`) pro výpočet minimální doby ponechání podpěr (`PROPS_MIN_DAYS` lookup). Codebase intermixuje **„skruz" naming na element-level** s **„props" naming na system-level** pro tentýž koncept. Není gap, ale signál pro Gate 2 — budoucí cleanup by měl zvolit jednu axis konzistentně.

<!-- CONTINUED — sections D, E, F, G, H, migration plan to follow -->
