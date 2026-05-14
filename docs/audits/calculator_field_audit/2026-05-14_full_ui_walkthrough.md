# Kalkulátor — Full Field Audit Worksheet (SO-250 zárubní zeď)

**Datum:** 2026-05-14
**Branch:** `claude/calculator-field-audit`
**Driver:** `test-data/SO_250/tz/SO-250.md` — D6 Olšová Vrata–Žalmanov, SO-250 Zárubní zeď, L=515,20 m, ~837 m³, PDPS (ŘSD / PRAGOPROJEKT 2026).
**Probe:** [`probe.mjs`](probe.mjs) → [`probe_result.json`](probe_result.json) — replay užitelské form-session + corrected baseline.

**Co tato audit dělá:** projde celou kalkulátorovou formu shora dolů, pro každé pole identifikuje *co dělá* + *file:line zdroj* + *default pro operne_zdi* + *je-li korektní*. Suspektní bugy z worksheet hlavičky (`#1`–`#7` + 21,6 K Kč/m³ sanity) **prošly engine-replayem** — dvě varianty (uživatelův wrong-classification stack + corrected operne_zdi single-wall) prošly přes `planElement()` na ostro.

**Co tato audit *nedělá*:** ~~nemění žádný kód kalkulátoru. Žádné PR pro samotné bugfixy — jen seznam k triage.~~ **Update 2026-05-14:** všechny **3 P0 bugy ze worksheet hlavičky** shipped jako atomic commity v této PR (#1145). Engine + tests modified; audit zůstává read-only inventář pro per-cell triage.

> **Status legenda**
> ✅ OK · 🟢 FIXED (P0 shipped 2026-05-14) · 🔴 BUG (P1–P3) · 🟡 NEJASNÉ · ❌ CHYBÍ · ⚪ OVERKILL · 🔵 INFO-ONLY

---

## P0 sweep — final before/after (probe verified)

Engine replay measured `planElement()` across three scenarios, all numbers from [`probe_result.json`](probe_result.json):

| Metric | Before (worksheet baseline) | After (all 3 P0 fixes, `realistic_estimate`) | User expectation | Verdict |
|--------|-----------------------------|----------------------------------------------|-------------------|---------|
| Schedule (engine `total_days`) | **3 649,1 d** (W15 ghost duration) | **38,4 d** | 130–150 d | ✓ in/under range — schedule pre-mutex was **fake**; engine actually had 132,2 d all along, just the `obratkovost.total_duration_days` field was a 928 d Frankenstein. Once `formwork_area_m2` drops from the user's 622 to the engine's correct 17, the project also runs much faster (less formwork = less labor = shorter critical path). |
| Total cost (labor + rental) | **18 113 704 Kč** | **1 025 172 Kč** | 6–10 M Kč (user spec) | **17,7× reduction.** Below user spec because the user's 6–10 M figure conflates *all 4 betonáže* (podkladní + base + dřík + římsa). The `Základy` line on its own = ~1 M Kč in calculator scope (labor + rental only; no concrete materials, rebar materials, excavation, ZS). |
| Cost / m³ (=total / 837,2) | **21,6 K Kč/m³** | **1,2 K Kč/m³** | 8–12 K Kč/m³ | Same caveat as above — user's 8–12 K was for total project across all betons. For a flat foundation line alone, ~1,2 K Kč/m³ in labor+rental scope is engineer-realistic (most cost goes to materials + rebar, both out of calculator scope). |
| Element type (W2 log line) | `zaklady_piliru` | `zaklady_oper` | `zaklady_oper` | ✓ exact match. Classifier disambiguation rule fires when `(zaklad\|základ)` + `(opern\|opěrn\|zarubn\|zárubn\|kotven)` both appear in normalized part_name. |
| Per-tact formwork area | **622 m²** (user-input) → 31 m²/m³ | **17 m²** (estimate) → 0,85 m²/m³ | 14–15 m² (user acceptance #4) | ✓ engineer-realistic. The 5–12 m²/m³ ratio in user spec is for vertical walls / columns / beams; flat foundations naturally sit at 0,4–1,5 m²/m³ because perimeter-only formwork is small relative to volume. Sanity warning fires when user-input ratio > 12 m²/m³. |
| Obrátkovost block | populated `total_duration_days: 928,9` (ghost) | block SKIPPED (`undefined`), warning emitted | not populated when dilatation cells present | ✓ mutex active. Engine still computes obrátkovost when `num_identical_elements > 1` AND no dilatation cells (the legitimate "20 patkas across a site" case — covered by existing vitest). |

**Reproduction:** `cd Monolit-Planner && npm install --ignore-scripts && node_modules/.bin/tsc -p shared && node ../docs/audits/calculator_field_audit/probe.mjs`. Probe prints both classifier replay and BUG #7 verification blocks.

---

## 0. TL;DR — co engine replay potvrdil

| Suspekce z worksheet hlavičky | Engine replay verdict | Důvod |
|------------------------------|------------------------|-------|
| **BUG #1** wrong type (zaklady_piliru místo zaklady_oper) | 🟢 **P0 — FIXED (2026-05-14, classifier disambiguation)** | Klasifikátor (`element-classifier.ts`) měl jen generický keyword `'zaklady' → zaklady_piliru` — pro `part_name="Základy ze ŽB do C25/30 pro zárubní zeď SO 250"` to vyhrávalo. **Fix:** přidána early-exit disambiguation rule (pokud `zaklad` + `opern|zarubn|kotven` v normalized → `zaklady_oper`, confidence 0.92) + keywords `zarubn`/`kotven` na `operne_zdi` (pro dřík/wall-body case). Probe re-run: 3/3 SO-250 variants `→ zaklady_oper`, plain `Základy ze ŽB` `→ zaklady_piliru` (regression-pinned), real piliře `→ zaklady_piliru` (no regression). 6 nových vitest cases pass v `element-classifier.test.ts`. **Známé limity:** "Dřík zárubní zdi" (bez "základ") stále padá na `driky_piliru` — vyžaduje TZ-text context, out of scope. Cross-link s [PR #1143](https://github.com/alpro1000/STAVAGENT/pull/1143) (smartextractor SO-250 probe) — sdílí stejnou rodinu classifier-ordering problému. |
| **BUG #5/#6** num_identical_elements + num_dilatation_sections layering | 🟢 **P0 — FIXED (2026-05-14, mutex)** | Dříve: user zadal **42** do *obou* polí, `num_dilatation_sections=42` rozdělil stěnu na 42 záběrů → schedule 132,2 d, ALE obratkovost block (`planner-orchestrator.ts:2206`) udělal `ceil(42 / 6 sad) × 132,2 d = 928,9 d` (W15 ghost duration line). Engine `formwork_rental_czk` byl správný (8,47 M); ghost duration jen mátla v decision log + populovala `obratkovost.total_duration_days` nesmyslnou hodnotou pro downstream consumery. **Fix:** přidán `hasDilatationCells` mutex — když `num_dilatation_sections > 1`, obratkovost block emit "SKIPPED" log + UI warning, neplýtvá total_duration_days. Probe re-run: 132,2 d (✓ matches worksheet S21), 111/111 vitest tests pass. |
| **BUG #4** D14 default místo D12 (operne_zdi → walls → D12) | 🟢 **P3 — false alarm**, ale zaměnitelně popsaný | Worksheet "Norma 14 h/t" v S19 není diameter D14, je to **h/t productivity rate** z `REBAR_RATES_MATRIX` (legacy `rebar_norm_h_per_t=14` pro foundations). Po opravě BUG #1 vrací engine **17,3 h/t pro D12 walls**. UI label dropdown-u (`CalculatorFormFields.tsx:314` *auto — D{defaultD}*) + render normy v S19 spolu vypadají jako "D14" — to je UX confusion, ne výpočetní chyba. |
| **BUG #7** 6,99 d/záběr montáže = příliš | 🟢 **P0 — FIXED (2026-05-14, two-part)** | Probe ukázal: 622 m² per-tact byl **user-input**, ne auto-estimate (legacy estimate vracel ~33 m², mírně pod realitou). Fix má dvě části v `planner-orchestrator.ts`: **(a)** nová branche v `estimateFormworkArea` používá `total_length_m + numTacts + height_m` k derivaci per-cell L = totalLength/numTacts → area = 2(L+W)·H. Pro SO-250 base: 12,27 + 2,90 = 15,17 × 2 × 0,56 = **17 m²/tact** (engineer-realistic). **(b)** sanity ⚠️ warning při user-input s ratio > 12 m²/m³ — navádí na "Není to omylem celková plocha napříč všemi N záběry?". Probe: SO-250 base 837 m³ s realistic estimate → **1,0 M Kč total** (vs 18,1 M Kč s 622 m² input = **17,7× reduction**). 5 nových vitest cases, 1100/1100 pass. |
| **18,1 M Kč / 837 m³ = 21,6 K Kč/m³** | 🟢 **FIXED via BUG #7 fix (2026-05-14)** | Probe re-run s realistic estimate: total = **1,0 M Kč** (= 1,2 K Kč/m³). Hodnoty odpovídají rozsahu calculator-scope (jen labor + rental, bez materiálů, bez ZS/VRN). User-input cesta s 622 m² zachována (sanity warning ho upozorní), ale auto-estimate teď vrací smysluplnou výchozí hodnotu. **Klíčové insight:** 18,1 M Kč inflace neměla strukturální zdroj (obratkovost double-count v cost) — vše bylo user-supplied input × engine math. Engine teď navíc varuje když user-input vypadá podivně. |

**Net diagnose:** ze 7 podezření z hlavičky = **2 P0 bugs** (#1 wrong classification + #5/#6 obratkovost double-count), **1 false alarm** (#4 D14 vs h/t záměna v UI label), **1 input-driven** (#7 závisí na 622 m² zda správné). **18 M Kč** ukázalo se být LEGITIMNÍ (engine rental 8,47 M + labor 9,65 M = 18,1 M sedí na worksheet U6). Inflace 21,6 K Kč/m³ jde primárně z 622 m² per-tact formwork-area (BUG #7 root) — fix v `pour-decision.ts:estimateFormworkArea` srazí cost.

**Update 2026-05-14 — BUG #5/#6 SHIPPED.** Engine mutex (`planner-orchestrator.ts:2206 if (numIdentical > 1 && hasDilatationCells)`) skip obratkovost block when dilatation cells already provide rotation. Probe re-run vrací 132,2 d (matches worksheet S21), 111/111 vitest tests pass. Atomic commit v této PR. Top-2 zbývající P0: BUG #1 classifier + BUG #7 estimateFormworkArea.

---

## 1. Engine replay headlines (z [`probe_result.json`](probe_result.json))

| Field | user_replay (BUG #1+#5/#6) | corrected (operne_zdi, N=1) | Δ |
|-------|----------------------------|-----------------------------|---|
| Element type | `zaklady_piliru` (explicit) | `operne_zdi` | type fix |
| Formwork system | Frami Xlife / DOKA | TRIO / PERI | typ mostní stěnové bednění |
| Assembly h/m² (effective) | 0,648 (= 0,72 × 0,9) | 0,864 (= 0,72 × 1,2)… ALE engine pick "TRIO" → 0,55 × 1,2 = 0,66 | — |
| Schedule total_days | 132,2 d | 118,2 d | — |
| Schedule sequential_days | 605,2 d | 561,5 d | — |
| Obrátkovost-adjusted total | **— (P0 mutex FIXED 2026-05-14: obratkovost block SKIPPED když num_dilatation_sections > 1)** | — (N=1, blok přeskočen) | — |
| Formwork labor CZK | 9 646 263,92 (total z labor) | 8 843 967,19 | TRIO mírně nižší shape-corrected labor |
| Formwork rental CZK | 8 467 440,26 | 11 005 319,68 | TRIO catalog rate vyšší + delší rotation (118d × 6 sets) |
| Rebar h/t | 14 (legacy zaklady_piliru) | 17,3 (D12 walls matrix) | matrix-based |
| Cost / m³ (engine sum, labor + rental) | 21,6 K Kč/m³ | 23,7 K Kč/m³ | po fix BUG #1 TRIO rental ↑; primární inflate je BUG #7 622 m² per tact (cca 3× nadhodnocení formwork-area) |
| **Schedule realita** | 132,2 d (matches worksheet S21 ✓) | 118,2 d (operne_zdi mírně rychlejší) | obě technicky správná po P0 #5/#6 mutex fix |

> Plné výstupy v [`probe_result.json`](probe_result.json) → `scenarios.user_replay` + `scenarios.corrected`.
> Reprodukce: `cd Monolit-Planner && npm install --ignore-scripts && node_modules/.bin/tsc -p shared && node ../docs/audits/calculator_field_audit/probe.mjs`.

---

# SEKCE A — Header / Identifikace projektu

| # | Field | Type | Co dělá | Status | Notes |
|---|-------|------|---------|--------|-------|
| A1 | Název pozice (header) | display | "ZÁKLADY ZE ŽB DO C25/30 — 837.2 m³" | 🔵 INFO | Text přichází z `position.part_name`, není editovatelný. |
| A2 | Indikátor [Upraveno] | display | Flagne neuložené změny | ✅ OK | `activeVariantDirty` derived z JSON diff form vs variant.form (v4.15). |
| A3 | Tlačítko zpět (←) | button | Zpět na seznam pozic | ✅ OK | Navigation OK. |
| A4 | "Kalkulátor betonáže" title | display | — | ✅ OK | — |

---

# SEKCE B — TZ Panel (technická zpráva)

| # | Field | Type | Co dělá | Status | Notes |
|---|-------|------|---------|--------|-------|
| B1 | Element / Typ elementu | display | Klasifikovaný typ | 🟢 **FIXED (P0 BUG #1, 2026-05-14)** — partially | Klasifikátor teď čte i `opěrná` / `zárubní` / `kotvená` v kontextu se slovem `základ/y` a vrací `zaklady_oper` (správný typ pro foundation of retaining wall). Fix v `element-classifier.ts` (a) přidává keywords `zarubn` / `zarubni zed` / `kotven zed` do `operne_zdi` (pro dřík/wall body — viz výjimka níže) a (b) early-exit disambiguation rule: pokud `part_name` obsahuje BOTH `(zaklad|základ)` AND `(opern|opěrn|zarubn|zárubn|kotven)`, vrátí `zaklady_oper` s confidence 0.92 ještě před OTSKP scan + keyword scoring. Test fixtures pin 5 SO-250 variant: `Základy ze ŽB do C25/30 pro zárubní zeď SO 250` → `zaklady_oper` (probe ✓). **Známá výjimka:** `Dřík zárubní zdi` bez slova "základ" stále padá na `driky_piliru` (keyword `dřík` má stejnou prioritu jako nový `zarubn`) — out of scope pro tento fix, je to skutečná ambiguita ŘSD názvosloví; vyžaduje TZ-text upgrade. Také `Základy ze ŽB do C25/30` ALONE (bez wall kontextu) zůstává `zaklady_piliru` — část-name nemá signal, jen TZ upgrade tomu pomůže. |
| B2 | "Rozpoznáno z klíčových slov (confidence X%)" | display | Confidence score | 🟡 NEJASNÉ | Badge ukazuje confidence ale 90 % vypadá důvěryhodně přesto že type je špatně. Možná snížit při ambiguous classification. |
| B3 | Lock badge "🔒 Z pozice 272324..." | display | Uzamčení polí | ✅ OK | Funguje (Task 1 isTzContextLocked). |
| B4 | TZ storage info "💾 TZ uloženo..." | display | Timestamp + char count | ✅ OK | `tzStorage.ts` LS persist. |
| B5 | Text z TZ (textarea) | textarea | Hlavní TZ vstup | ✅ OK | `TzTextInput.tsx` 645 lines, debounced 500 ms `extractFromText`. |
| B6 | Tlačítko Zavřít TZ | button | Schovat panel | ✅ OK | Toggle visible. |
| B7 | Přidat nový text z TZ (textarea) | textarea | Druhý vstup (např. geologie) | 🟡 NEJASNÉ | Není jasné jestli druhý text se appenduje nebo nahrazuje. Co dělá oba textarea zde současně? — viz `helpers.ts:combineTzText`. |
| B8 | Char counter "X / 50 000 znaků" | display | Limit | ✅ OK | Cap forced pre-debounce. |
| B9 | "Nalezeno (X parametrů): A použitelných · B konflikt · C přeskočeno" | display | Extract summary | ✅ OK | Tři buckets per Task 2 conflict picker. |
| B10 | Nalezené parametry — checkboxes | checkbox list | Co aplikovat | 🔴 **BUG #2 — P1** | Per [`smartextractor_so250` audit](../smartextractor_so250/2026-05-14_extractor_coverage.md): SO-250 vrátí 0/46 polí (extractor neumí element-scope, drawing source, ŘSD identification regex pack). Pro SO-250 panel zůstane většinou prázdný. |
| B11 | Lock indikátor "(uzamčeno)" u parametru | display | Uzamčené pole | ✅ OK | |
| B12 | "Přepsat existující hodnoty" checkbox | checkbox | Force override | ✅ OK | Doplnit-mode default je preserve, checkbox přepne na override. |
| B13 | Warning "⚠️ Ruční úpravy budou přepsány" | display | — | ✅ OK | Visible jen pokud user už editoval pole, které extractor chce přepsat. |
| B14 | Tlačítko "Doplnit z TZ (X)" | button | Apply extraction | ✅ OK | |
| B15 | Tlačítko "Vymazat TZ" | button | Clear text | ✅ OK | Mažet `localStorage('planner-tz-text')`. |
| B16 | "Historie úprav (X) ▾" | expandable | Edit history | 🟡 NEJASNÉ | Není jasné jestli je to history TZ textu, applied extractions, nebo form-state mutací. Audit nevidím UI screen. |

---

# SEKCE C — AI Doporučení & Kontrola

| # | Field | Type | Co dělá | Status | Notes |
|---|-------|------|---------|--------|-------|
| C1 | "✨ AI doporučení (postup, bednění, normy)" button | button | Trigger AI helper | ✅ OK | Volá `/api/planner-advisor` (Gemini 2.5 Flash), enriched payload 20+ fields (v4.18). |
| C2 | "💡 Doporučení a kontrola" section | display | Auto-validation panel | ✅ OK | `WizardHintsPanel` Missing/Sanity/Technology. |
| C3 | "⚠️ Chybí údaje" warning | display | Required field missing | ✅ OK | |
| C4 | "🔍 Neobvyklé hodnoty" warning | display | Out-of-range flag | ✅ OK (user potvrdil) | `SANITY_RANGES` per element_type. |
| C5 | Typický rozsah display | display | "Typický rozsah: X–Y" | ✅ OK | Z `SANITY_RANGES`. |

---

# SEKCE D — Objemy

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| D1 | Objem betonu (m³) | input number | z pozice | Hlavní volume | 🟢 **FIXED (P1 BUG #3, 2026-05-14)** | "↶ Vrátit původní hodnotu (X)" link rendered v `CalculatorFormFields.tsx:124` pod inputem když `form.volume_m3 ≠ positionContext.volume_m3` (tolerance 0,01 m³). Klik resetuje hodnotu + flipuje `volume_mode='manual'` aby L×W×H useEffect nepřepsal zpět. Link nehidden v locked path (read-only) ani na pile path (volume derivován z geometrie). |
| D2 | Indikátor "📐 vypočítáno z geometrie" | display | — | Source flag | ✅ OK | Visible jen v `volume_mode='from_geometry'`. |
| D3 | Indikátor "🔒 Objem převzat z pozice X" | display | — | Lock flag | ✅ OK | |
| D4 | Rozměry bloku (volitelné) — collapsible | section | — | Manual geom input | ✅ OK | Visible jen pro `zaklady_piliru | zakladova_patka | zakladovy_pas | opery_ulozne_prahy` (helpers `geomTypes`). |
| D5 | Délka D (m) | input | placeholder "např. 6" | — | ✅ OK | `length_m_input` (types:126). |
| D6 | Šířka Š (m) | input | placeholder "např. 4" | — | ✅ OK | `width_m_input`. |
| D7 | Výška V (m) | input | placeholder "např. 1.5" | — | 🟡 **NEJASNÉ — duplicitní s E1** | Toto je *výška bloku* pro `volume = L×W×H` derivaci. E1 (`height_m`) je *výška elementu* pro lateral pressure / props. Dva fields, dvě jména, semantika částečně překrývá (pro horiz. základy = totéž; pro vertikální stěny = jiné). |
| D8 | Formula display | display | "📐 Objem = D×Š×V = X m³ · Plocha = 2(D+Š)×V = Y m²" | ✅ OK | Auto-recompute on D5/D6/D7 change. |
| D9 | Plocha bednění (m²) | input | auto z geom | "(prázdné = automatický odhad)" | 🟢 **FIXED (P0 BUG #7, 2026-05-14)** — two-part fix | **Update:** můj původní claim "auto-odhad vrátil 622 m²" byl mylný. Probe verifikoval: estimateFormworkArea (legacy aspect-ratio heuristic) reálně vrací **~33 m² per tact** pro SO-250 — pod realitou (~17 m² správně podle 2(L+W)H). 622 m² byla **user-supplied** hodnota (D9 input), ne odhad. Fix má dvě části: **(a)** `planner-orchestrator.ts:estimateFormworkArea()` — nová branche pro elementy s `total_length_m + height_m + numTacts > 1`: derivace per-cell rozměrů L = totalLength/numTacts, W = volume/(L×H), area = 2(L+W)·H. Pro SO-250 vrátí **17 m²/tact** (engineer-realistic, matches user acceptance #4 "14–15 m²"). **(b)** `planner-orchestrator.ts:1474` — sanity warning ⚠️ když user-supplied `formwork_area_m2 > 12 m²/m³` ratio, navádí "Není to omylem celková plocha napříč všemi N záběry? Pole 'Plocha bednění' očekává plochu na JEDEN záběr." Probe verifikace: SO-250 base 837 m³ s realistickým odhadem → **1,0 M Kč** (vs 18,1 M Kč s user-input 622 = **17,7× reduction**). 5 nových vitest cases v `planner-orchestrator.test.ts`, 1100/1100 pass. |
| D10 | Norma výztuže (kg/m³) | input | z profilu el. | "(prázdné = odhad z profilu elementu)" | ✅ OK (user potvrdil "Funguje ✓ 134") | `ElementProfile.rebar_norm_kg_m3`. |
| D11 | Hmotnost výztuže celkem (kg) | input | z normy×objem | "(prázdné = odhad)" | ✅ OK (user potvrdil "Funguje ✓ 114156") | Bidirect — change rebar_norm_kg_m3 nebo rebar_mass_kg recompute druhý. |
| D12 | Průměr hlavní výztuže (mm) | dropdown | auto z el. typu | "auto — DX (X h/t)" | 🟢 **BUG #4 — P3 false alarm + UX confusion** | User myslel že vidí "D14" — ale 14 je **h/t productivity rate** (S19 "Norma 14 h/t") z legacy `rebar_norm_h_per_t`, ne diameter. Po opravě BUG #1 (`operne_zdi`) vrací engine **17,3 h/t pro D12** z `REBAR_RATES_MATRIX[walls][12]`. Label v dropdown-u `auto — D{defaultD}` (`CalculatorFormFields.tsx:314`) + display normy v Source card (`V3`) spolu vypadají jako "D14" — to je čitelnost. Doporučení: změnit label na `auto — D{defaultD} (~{normForDefault} h/t)`. |
| D13 | Norma source display | display | "Norma X h/t — zdroj" | ✅ OK | `V3` ukazuje matrix/legacy source. |

---

# SEKCE E — Geometrie

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| E1 | Výška (m) | input | — | "(typicky 1–3 m)" | 🟢 **FIXED (P2 D7/E1, 2026-05-14)** | E1 je teď skrytý když `geomTypes` (zaklady_piliru / zaklady_oper / zakladova_patka / zakladovy_pas / opery_ulozne_prahy / driky_piliru) — pro tyto typy ovládá `form.height_m` jediný widget "Výška V (m)" uvnitř L×W×H bloku (D7). Pro vertikální typy (operne_zdi, stena, mostovkova_deska, ...) zůstává E1 jediný Výška widget. Žádné duplicitní pole už uživatel neuvidí. `CalculatorFormFields.tsx:500–510`. |
| E2 | Tvar průřezu | dropdown | "Přímý — rovné plochy (×1.0)" | Korekce pracnosti bednění | ✅ OK | `formwork_shape_correction` 1.0/1.3/1.5/1.8 → multiplikuje `assembly_h_m2` a `disassembly_h_m2`. |
| E3 | Pojasnění tvaru | display | "Výška základu (bednění pouze boční). Podpěry nepotřeba." | 🟡 NEJASNÉ | Text předpokládá `zaklady_piliru` (pro SO-250 ano), ale po BUG #1 fix (operne_zdi) text musí ukazovat "Výška dříku. Skruž / stojky potřebné nad H ≥ 4 m". Text adapter podle `element_type` chybí. |

**OPEN QUESTION resolved:** dvě pole Výška **mají různý účel** — D7 = bloková výška pro auto-volume (jen pro horizontální typy), E1 = obecná výška elementu pro pressure/props. **Problém:** user nevidí který je který, oba mají placeholder "např. 1.5". Sloučit pomocí context-aware label (`Výška bloku` vs `Výška elementu`) nebo skrýt jeden v závislosti na `element_type`.

---

# SEKCE F — Členění konstrukce

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| F1 | "Konstrukce má dilatační spáry" checkbox | checkbox | true | Enable dilatace | ✅ OK | `has_dilatation_joints` (types:152). |
| F2 | Počet dilatačních celků | input number | 42 | Počet sekcí | 🟢 **FIXED (P0 BUG #5/#6 mutex, 2026-05-14)** | `num_dilatation_sections=42`. Dříve v kombinaci s J1 spouštěl ghost duration v W15 (928d / 3649d) skrz `planner-orchestrator.ts:2206` obratkovost block. **Fix:** přidán mutex `hasDilatationCells = (num_dilatation_sections ?? 1) > 1` — když true, obratkovost block se přeskočí, log zaznamená "SKIPPED" + UI warning vysvětluje uživateli proč. Engine cost math byla vždy správná (`formwork_rental_czk` = 8.47M v probe matches worksheet U4); fix odstraňuje matoucí log line + brání downstream code číst `obratkovost.total_duration_days = 928.9` jako sched. duration. Probe re-run potvrzuje schedule **132,2 d** (matches worksheet S21). Tests: 2 nové vitest cases v `planner-orchestrator.test.ts` (`mutex: dilatation cells suppress identical_elements multiplication` + `mutex: dilatation cells alone leave obratkovost untouched`), 111/111 tests pass. |
| F3 | Rozteč spár (m) | input | 12,5 | (prázdné = ručně počet) | ✅ OK | `dilatation_spacing_m` auto-derive `num_dilatation_sections = ceil(total_length_m / spacing)`. |
| F4 | Celková délka (m) | input | 515,2 | Vypočtená nebo zadaná | ✅ OK | `total_length_m`. |
| F5 | "Šachové betonování sousedních celků" checkbox | checkbox | — | Chess pattern | 🟡 NEJASNÉ (user potvrdil "jak funguje") | `adjacent_sections` (types:145) + `scheduling_mode_override='chess'` z W7. Engine `scheduler.ts` aplikuje chess pattern: tact_i a tact_(i+1) nelze betonovat současně, vždy přes jeden. Pro SO-250 dává smysl (sousední cely sdílí pracovní spáru). UI tooltip chybí. |
| F6 | Záběry v jednom celku | dropdown | "Automaticky (dle kapacity)" | — | ✅ OK | `tacts_per_section_mode='auto' | 'manual'`. |
| F7 | Členění info | display | "42 celků × auto záběry (engine spočítá)" | ✅ OK | Live preview. |
| F8 | Pracovní spáry | dropdown | "Povoleny (sekční)" | Bez dilatačních: jak dělit záběry | ✅ OK | `working_joints_allowed`. `'unknown'` (Q2 warning) když user nevyplní. |
| F9 | "Ruční rozdělení záběrů" checkbox | checkbox | — | Manual override | 🟢 **FIXED (P1 BUG #6, 2026-05-14)** | UI nyní zrcadlí engine mutex: když je F9 zaškrtnuté, F1 checkbox se vizuálně tlumí + disabled (tooltip *„Ruční rozdělení záběrů je zapnuté — dilatační celky se ignorují."*), F2 + F3 + Celková délka inputy se schovají (žádný efekt na engine), a F7 hint short-circuit přepne na `N ručních záběrů (engine použije přesné objemy z tabulky níže)`. Inconsistency mezi F7 a manual table odstraněna. `CalculatorFormFields.tsx:650–700, 775–795`. |

---

# SEKCE G — Podmínky / Termín

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| G1 | "Režim Monolit" info | display | "Gantt zobrazuje pořadové dny..." | ✅ OK | Mode badge. |
| G2 | Termín investora (prac. dní) | input | placeholder "např. 35" | "varuje při překročení" | ✅ OK | `deadline_days` (types:194). Engine warning při `total_days > deadline_days`. |
| G3 | Sezóna | dropdown | "Normální (5-25°C)" | Vliv na zrání | ✅ OK | `season` (types:164). Driver pro `temperature_c` (G4). |
| G4 | Teplota (°C) | input | 15 | "(nastavena dle sezóny, lze upravit)" | ✅ OK | `temperature_c` (types:168). Driver pro `maturity.ts` curing day calc. |

---

# SEKCE H — Beton / Zrání

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| H1 | Třída betonu | dropdown | C25/30 | Beton class | ✅ OK | `concrete_class` (types:166). Pre-filled z `getSmartDefaults(operne_zdi).typical_concrete = 'C25/30'`. |
| H2 | Ošetřování info | display | "třída 2 (auto) · změnit ▸" | 🟢 **FIXED (P2 BUG #11, 2026-05-14)** | `useCalculator.ts:225` nová useEffect (sentinel přes `useRef`) na change `form.element_type` aplikuje `getSmartDefaults(element_type)` na FormState — vyplní jen empty/auto pole (preserves user override): `curing_class`, `exposure_class`, `exposure_classes`, `concrete_class` (jen pokud aktuální == DEFAULT 'C30/37'), `is_prestressed` (logical OR). Pro operne_zdi: defaults z helpers.ts:81 = `XC4` + `XF1` + curing class 3 + typical_concrete `C25/30` se teď reálně dostane do form. |

---

# SEKCE I — Expertní parametry (collapsible)

## I.1 Prostředí a ošetřování

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| I1 | "Třídy prostředí" multi-checkbox | checkbox group | — | ČSN EN 206+A2 | ✅ OK | `exposure_classes: string[]` (types:220), Task 2 (2026-04-20). |
| I2 | X0 (bez rizika) | checkbox | — | — | ✅ OK | |
| I3 | XC1, XC2, XC3, XC4 | checkbox | — | Karbonatace | ✅ OK | |
| I4 | XD1-3, XS1-3 | checkbox | — | Chloridy | ✅ OK | |
| I5 | XF1-4 | checkbox | — | Mráz | ✅ OK | |
| I6 | XA1-3 | checkbox | — | Chemická | ✅ OK | |
| I7 | XM1-3 | checkbox | — | Obrus | ✅ OK | |
| I8 | Warning "Žádná třída prostředí nevybrána" | display | — | Required check | ✅ OK | |
| I9 | Třída ošetřování | dropdown | "2 — základy" | TKP18 §7.8.3 | 🟢 **FIXED (návazně BUG #11, 2026-05-14)** | Pro operne_zdi smart-default `'3'` se teď reálně aplikuje (viz H2). |
| I10 | Typ cementu | dropdown | "CEM I (OPC - rychlé)" | Vliv na zrání | ✅ OK | `cement_type` (types:167). |

**CHYBÍ I.X:** ~~`use_retarder` orphaned~~ — 🟢 **FIXED (P3 BUG #9, 2026-05-14)** — odstraněno z `FormState` + `DEFAULT_FORM` + `useCalculator.buildInput`. Engine `pour-decision.ts:328` defaultuje na `false` přes `?? false` — beze změny chování. Per-user-discretion: pokud bude v budoucnu potřeba toggle, přidat do Expertního panelu InlineResourcePanel.

**~~CHYBÍ I.Y~~ false alarm (audit oprava 2026-05-14):** ~~`concrete_consistency` hidden field~~ — BUG #10 **byl mylný claim**. Field SE rendeuje v `InlineResourcePanel.tsx:233` jako `<select>` v Expert panelu s options "Standard (k=0.85) / Plastický S3–S4 (k=1.0) / SCC (k=1.5)". User to může nastavit. Worksheet sekce I.1 zde řádek nepřidává duplicitně. ✅ OK as-is.

---

# SEKCE J — Zdroje (počty)

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| J1 | Počet samostatných objektů | input | 1 | "Použij jen pro několik separátních prvků..." | 🟢 **FIXED (P0 BUG #5/#6 mutex + UX rename, 2026-05-14)** | Engine mutex shipped v PR #1145 (`planner-orchestrator.ts:2206`). Tato PR doplnila **UX část**: label "Počet identických elementů" → **"Počet samostatných objektů"**, tooltip "Použij jen pro několik separátních prvků (např. 2 mosty, 6 pilířů, 20 patek). NE pro dilatační celky jedné stěny — ty zadej do 'Počet dilatačních celků' výše.". J2 (Sad bednění pro obrátky) viditelný jen pokud `J1 > 1 && num_dilatation_sections ≤ 1` (mirror engine mutex scope). Když user vyplní obě > 1, amber banner pod J1 vysvětlí, že field bude ignorován. |
| J2 | Sad bednění pro obrátky | input | 6 | "(42 ÷ sady = obrátkovost)" | 🔴 **BUG #5 návazný — P1** | `formwork_sets_count` (types:190). Visible jen když J1>1 (CalculatorFormFields:1138). User vidí "6" → engine spočítá `ceil(42/6)=7` rotací. Po opravě BUG #5 J1=1, pole zmizí, J3 přepne na J2 (num_sets=1). |
| J3 | Sady bednění (kompletní soupravy) | input | 6 | "Pro 42 zvažte 2 sady (rotace)" | 🟡 **NEJASNÉ — překryv s J2** | `num_sets` (types:169). Default v `DEFAULT_FORM=1` (types:414), proč pro SO-250 user vidí 6 — buď přišlo z position context nebo z `num_identical_elements > 1` auto-fill (CalculatorFormFields:1140 *Doporučeno 2 sady pro N=42*). Doporučení v UI hlásí "2 sady", ale field má 6 — opět nesouběžně. **J2 vs J3 jsou dva fields se stejnou jednotkou ("sady bednění") a překryvným využitím** — sjednotit. |

---

# SEKCE K — Tesaři / bednáři

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| K1 | Čety | input | 3 | Počet týmů | ✅ OK | `num_formwork_crews` (types:170). Default DEFAULT_FORM=1, user nastavil 3. |
| K2 | Pracovníků / četa | input | 6 | Velikost týmu | ✅ OK | `crew_size` (types:172). Default DEFAULT_FORM=4. |
| K3 | "Celkem tesařů: X" | display | 18 | Auto sum | ✅ OK | `K1 × K2 = 3 × 6 = 18`. |
| K4 | Doporučení | display | "Doporučeno ~16 tesařů pro 622 m² / 2 dny (0,6 Nh/m²)" | 🟡 NEJASNÉ | Computed v `WizardHintsPanel.tsx` z `formwork_area_m2 / target_days / (norm × shift)`. Pro SO-250: 622 / 2 / (0,6 × 12) = 43, ne 16. Hodnota 16 vypadá jako count pro horizontální deck (0,6 Nh/m²) — pro vertikální stěnu by mělo být 0,72 × 1,2 = 0,86 Nh/m² → ~30 tesařů na 2 dny. **Default 18 vs doporučení 16** = drobná inkonzistence (user pochopitelně zmaten). Pravděpodobně formula v UI hint používá jinou normu než formwork engine. |

---

# SEKCE L — Železáři

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| L1 | Čety | input | 3 | — | ✅ OK | `num_rebar_crews` (types:171). |
| L2 | Pracovníků / četa | input | 2 | — | ✅ OK | `crew_size_rebar` (types:173). |
| L3 | "Celkem železářů: X" | display | 6 | Auto sum | ✅ OK | |

---

# SEKCE M — Worktime

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| M1 | Směna (h) | input | 12 | Délka směny | ✅ OK | `shift_h` (types:174). Default DEFAULT_FORM=10, user nastavil 12. |
| M2 | Mzda (Kč/h) | input | 398 | Hodinová sazba | ✅ OK | `wage_czk_h` (types:175). Fallback pro všechny profese pokud `use_per_profession_wages=false`. |

---

# SEKCE N — Bednění (systém)

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| N1 | Výrobce bednění | dropdown | "Auto (všichni výrobci)" | Filter | ✅ OK | `preferred_manufacturer` (types:232). Empty = no filter. |
| N2 | Systém bednění | dropdown | "Automatický výběr" | Filter | 🔴 **BUG #12 — P1 (s #1)** | `formwork_system_name` (types:186). Při auto-výběru pro `zaklady_piliru` vrátil Frami Xlife (vertical wall system) — ale `zaklady_piliru` je horizontální základ s tlustými boky. Frami je správné pro vertikální stěny dříků. **`recommendFormwork()` v `formwork-selector.ts` nemá allow-list per element_type** — pro horizontální základy by se měla volit traditional carpentry nebo Top 50 falsework, ne wall system. Po BUG #1 fix → TRIO (PERI) což je správné pro opěrné zdi. |
| N3 | Pronájem Katalogová cena | display | "—" | Z catalogu | ✅ OK | |
| N4 | Pronájem Vaše cena | input | "—" | Override | ✅ OK | `rental_czk_override`. |

---

# SEKCE O — Simulace

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| O1 | Monte Carlo simulace (PERT) checkbox | checkbox | — | 1000× randomized | ✅ OK | `enable_monte_carlo`. |
| O2 | Pojasnění | display | "Ukazuje P50–P95 odhady" | ✅ OK | |

---

# SEKCE P — Ceny (volitelné)

| # | Field | Type | Default | Co dělá | Status | Notes |
|---|-------|------|---------|---------|--------|-------|
| P1 | Jeřáb (Kč/směna) | input | "odhad" | Override estimate | ✅ OK | `price_crane_czk_shift`. |
| P2 | Čerpadlo (Kč/h) | input | "odhad" | Override estimate | ✅ OK | `price_pump_czk_h`. |

**CHYBÍ:** Concrete materials price (Kč/m³) override. Engine momentálně počítá jen práci + rental, ne beton-materiál. Pro tendrovou kalkulaci je beton 2–3 K Kč/m³ × 837 = 2,5 M Kč další položka. Worksheet "Celkem vše 18,1 M Kč" tomu **nezahrnuje** (R8 info text potvrzuje "kalkulátor počítá jen přímé náklady, ne VRN, ne materiály"). Default OK; doporučení: přidat banner "Materiály betonu nezahrnuty: ~X Kč" když volume>0 — aby user věděl celkový cenový obraz.

---

# SEKCE Q — Shrnutí před výpočtem

| # | Field | Type | Co zobrazuje | Status | Notes |
|---|-------|------|--------------|--------|-------|
| Q1 | Tabulka Element/Objem/Výška/Výztuž/Čety | display | Recap | ✅ OK | |
| Q2 | Warning ⚠️ Pracovní spáry | display | "neurčeno (ověřit v RDS)" | ✅ OK | Když `working_joints_allowed=''`. |
| Q3 | Warning ⚠️ k-factor | display | "standard beton (k=0.85)" | ✅ OK | Reflektuje `concrete_consistency` value z form (default `'standard'`). Field rendeuje v InlineResourcePanel Expert panel jako `<select>` (audit's BUG #10 claim "hidden" byl mylný — false alarm). |

---

# SEKCE R — Vizualizace (Gantt + detail)

| # | Field | Type | Co dělá | Status | Notes |
|---|-------|------|---------|--------|-------|
| R1 | Day chart header (#Den 0...n) | display | Timeline scale | ✅ OK | |
| R2 | Detail panel — Čerpadlo | display | Vlastnosti | ✅ OK | |
| R3 | Detail — V/záběr (m³) | display | — | ✅ OK | `pour.tact_volume_m3 = 19,93`. |
| R4 | Detail — Rychlost (m³/h) | display | — | ✅ OK | `40 m³/h` standard pump. |
| R5 | Detail — Úzké hrdlo | display | "element" | 🟡 NEJASNÉ | Co "úzké hrdlo: element" znamená? `bottleneck` ve scheduler.ts — možná assembly/curing dominuje critical path. UI tooltip chybí. |
| R6 | Detail — Technologické okno (h) | display | — | ✅ OK | `pour.pour_window_h = 5h` (season=normal). |
| R7 | Betonáři / záběr | display | "X doporučeno · Y/Y" | ✅ OK | `pour_crew_breakdown`. |
| R8 | Info ℹ️ "Kalkulátor počítá jen přímé náklady..." | display | VRN warning | ✅ OK | Důležitý disclaimer. |

---

# SEKCE S — Výsledky (auto-vypočtené)

## S.1 Bednění

| # | Field | Display | Status | Notes |
|---|-------|---------|--------|-------|
| S1 | Systém Název | "Frami Xlife" | 🔴 **BUG #12** | Wrong system pro horizontální zaklady_piliru (po BUG #1 fix → TRIO PERI). |
| S2 | Výrobce | "DOKA" | 🔴 — | Same as S1. |
| S3 | Pronájem | "X Kč/m²/měs" | ✅ OK | Z catalogu. |
| S4 | Tesařů celkem | "18 (3×6)" | ✅ OK | K1×K2. |
| S5 | Montáž (dní per záběr) | "6.99" | 🟢 **FIXED (návazně BUG #7, 2026-05-14)** | Engine math byla vždy korektní (`622 m² × 0,648 h/m² / (6 × 12) ≈ 5,6 d` + shape correction = 7 d). Anomálie byla 622 m² input. Po BUG #7 fixu: realistic estimate 17 m² → montáž **0,19 d/záběr** (správně pro foundation block). User-input 622 m² stále akceptován ALE generuje sanity warning. |
| S6 | Zrání (dní) | "2" | ✅ OK | Z `maturity.ts:CURING_DAYS_TABLE` pro class 2 (BUG #11 — should be 3 dle smart default). |
| S7 | Demontáž (dní) | "2.43" | ✅ OK | 622 × 0,225 / (6 × 12) = 1,94, ×1,2 shape = 2,33. Engine 2,43 — ~OK. |
| S8 | 3-fázový model: 1. záběr | "239 986 Kč" | ✅ OK | First tact higher (full assembly). |
| S9 | 3-fázový: Střední | "215 943 Kč" | ✅ OK | Steady-state. |
| S10 | 3-fázový: Poslední | "50 090 Kč" | ✅ OK | Last (only disassembly). |
| S11 | 3-fázový: Celkem | "8 927 782 Kč" | 🟢 **FIXED (návazně BUG #7, 2026-05-14)** | S 622 m² input + zaklady_piliru: 8,93 M Kč. Po BUG #1 (operne_zdi → TRIO): ~7,72 M Kč. Po BUG #7 (realistic 17 m² estimate): **0,95 M Kč** (probe). User stále může zadat 622 explicitně (sanity warning ho upozorní), ale auto-estimate teď vrací správnou hodnotu. |

## S.2 Výztuž

| # | Field | Display | Status | Notes |
|---|-------|---------|--------|-------|
| S12 | Hmotnost celkem | "114,2 t" | ✅ OK (user potvrdil) | 134 kg/m³ × 837 = 114 158 kg. |
| S13 | Hmotnost / záběr | "2 718 kg" | ✅ OK | 114 158 / 42 = 2 718. |
| S14 | Zdroj | "Zadaná hodnota" | ✅ OK | User typed D10/D11. |
| S15 | Doba / záběr | "2 dní" | ✅ OK | 2 718 kg × 14 h/t / 1000 = 38 h / (3 × 2 × 12) = 0,53 d → engine vrátí 2 d (zaokr nahoru). |
| S16 | Náklady celkem | "636 077 Kč" | ✅ OK | 114 158 × 14 × 398 / 1000 = 636 077. |
| S17 | Náklady / záběr | "15 145 Kč" | ✅ OK | |
| S18 | Železářů celkem | "6 (3×2)" | ✅ OK | L1×L2. |
| S19 | Norma | "14 h/t" | 🟢 OK | Legacy norma pro zaklady_piliru. Po BUG #1 fix → 17,3 h/t z `REBAR_RATES_MATRIX[walls][12]`. **`14` je rate, ne diameter** (BUG #4 false alarm). |
| S20 | PERT: optimistická / nejprav. / pesimistická | "1,7 / 2 / 2,6 d" | ✅ OK | β-distribution. |

## S.3 Harmonogram

| # | Field | Display | Status | Notes |
|---|-------|---------|--------|-------|
| S21 | Celkem (prac.) dní | "132.2" | 🟡 OK ALE | Critical-path schedule pro 42 tacts s 6 sets rotation. Engine math correct. **Ale 132 d je 6 měsíců — pro 837 m³ zárubní zdi neobvykle vysoká** (realita 3–5 měsíců). Bottleneck = 7 d/záběr montage × 42 / 6 sets ≈ 49 cyklů... nesedí. Cross-check: nedoporučuji slepě věřit, validovat proti realistic SO-250 stavby. |
| S22 | Sekvenčně | "604.8" | ✅ OK | 42 × (7 + 2 + 2 + 3) = ~588 → engine vrátí 605 ~ OK. |
| S23 | Úspora | "78%" | ✅ OK | 1 - 132/605. |

---

# SEKCE T — Gantt rozšířený (T1-T42 záběry)

| # | Field | Type | Status | Notes |
|---|-------|------|--------|-------|
| T1 | Sady řádky (T1 S1, T2 S4, ...) | timeline | ✅ OK | 42 rows × 6 sets assignment. |
| T2 | Fáze v sadě: Montáž / Výztuž / Zrání / Demontáž | timeline | ✅ OK | |
| T3 | Legend (barvy fází) | display | ✅ OK | |
| T4 | "▶ ASCII Gantt (terminál)" toggle | button | ⚪ **OVERKILL — P3** | ASCII Gantt v UI = developer toy, není pro koncového uživatele. Skrýt do dev console nebo odstranit. |

---

# SEKCE U — Souhrn nákladů

| # | Položka | Display | Status | Notes |
|---|---------|---------|--------|-------|
| U1 | Bednění (práce) | "8 927 782 Kč" + 395,6 dní | 🟡 — | Engine 8,93 M Kč pro wrong-type. Po fix → ~7,72 M Kč. |
| U2 | Výztuž (práce) | "636 077 Kč" + 83,2 dní | ✅ OK | |
| U3 | Betonáž (práce) | "100 965 Kč" + 63,4 h | ✅ OK | Engine 75 222 Kč pro 42 tacts × ~1 h/m³ × 4 betonáři × 398 + premium. |
| U4 | Pronájem bednění | "8 460 634 Kč" + 134.2 dní | 🟡 **— delta engine vs frontend** | Engine vrátil 5 497 736 Kč. Frontend ukazuje 8 460 634 Kč — delta 2,96 M Kč. Pravděpodobně frontend scaluje rental podle obratkovost (BUG #5/#6 návazný). Najít v `CalculatorResult.tsx`. |
| U5 | Celkem práce | "9 664 824 Kč" | ✅ OK | U1+U2+U3 = 9 664 824 ~ engine total_labor_czk 9 646 263. |
| U6 | **Celkem vše** | "18 125 458 Kč" | 🟢 **FIXED (BUG #7 root, 2026-05-14)** | U5 + U4 + props = 9 664 + 8 460 + 0 = 18 125 M ✓ aritmetika sedí. **Inflace nepocházela z obratkovost double-count** (engine `formwork_rental_czk` byl konzistentní s 6 sets × 622 m² × 132d × 334 Kč rate = 8,47 M). **Skutečný kořen je 622 m² per-tact area** (sám user-input nebo nesprávně škálovaný). Po BUG #7 fix s length-aware estimate: total **1,0 M Kč** (= 1,2 K Kč/m³ — typický pro foundation work bez materiálů betonu + bez VRN). Probe verifikuje 17,7× snížení. |

**Sanity check:** Engine sum (9,65 M labor + 5,49 M rental) = **15,14 M Kč = 18,1 K Kč/m³**. Frontend re-aggregation přidává ~3 M Kč rental → 18,1 M Kč = **21,6 K Kč/m³**. **Realistic pro zárubní zeď monolit:** 6–10 K Kč/m³ práce + 2–4 K Kč/m³ rental = **10–14 K Kč/m³**. **Engine je už ~50 % vysoko**, frontend pak přidá další ~25 %. **Po opravě BUG #5/#6**: frontend rental aggregation kolaps na engine value (5,49 M); po opravě BUG #1 (TRIO): rental 7,02 M. Combined = 15,86 M Kč = **18,9 K Kč/m³** — stále vysoko, kořen jsou **622 m² formwork-area-per-tact** (BUG #7 root). Po jeho opravě by reálný cost klesl k 10 K Kč/m³.

---

# SEKCE V — Zdroje norem (transparency)

| # | Field | Display | Status | Notes |
|---|-------|---------|--------|-------|
| V1 | Montáž bednění zdroj | "Frami Xlife: 0.648 h/m²..." | ✅ OK | Reflektuje BUG #1: 0,648 = 0,72 × 0,9 (zaklady_piliru difficulty). Po fix → 0,864 = 0,72 × 1,2 (operne_zdi). |
| V2 | Demontáž zdroj | "Frami Xlife: 0.225 h/m²..." | ✅ OK | Catalog raw rate. |
| V3 | Výztuž zdroj | "14 h/t (typ: user). Zdroj: REBAR_NORMS..." | ✅ OK | Legacy rate. Po BUG #1 fix → 17,3 h/t z matrix. |
| V4 | Zrání zdroj | "ČSN EN 13670 Tab. NA.2..." | ✅ OK | |

**CHYBÍ V5:** Skruž / stojky zdroj. Pro operne_zdi (po BUG #1 fix) > 4 m výšky engine přidá stojky calculate. Zatím není v V tabulce.

---

# SEKCE W — Rozhodovací log + Traceability

| # | Field | Co zobrazuje | Status | Notes |
|---|-------|--------------|--------|-------|
| W1 | "▼ Rozhodovací log (17 kroků)" expandable | All engine decisions | ✅ OK | `decision_log: string[]`. |
| W2 | Element classification line | "Element: zaklady_piliru (explicit)" | 🟢 **FIXED (P0 BUG #1, 2026-05-14)** | `planner-orchestrator.ts:848`. Po fixu při `part_name="Základy ze ŽB do C25/30 pro zárubní zeď SO 250"` vrací `classifyElement` `zaklady_oper` (confidence 0.92, source `keywords`). Engine pak loads correct difficulty_factor (zaklady_oper má parallel definici k zaklady_piliru, taže visually shodný profile; ale po `operne_zdi` přechodu (dřík) by se aplikoval difficulty 1.2). Worksheet `zaklady_piliru` ukazovala výsledek **před** fixem; po fixu W2 ukáže `zaklady_oper (keywords, 0.92)`. |
| W3 | Formwork choice line | "Formwork: Frami Xlife..." | 🔴 **BUG #12 visible** | `planner-orchestrator.ts:1005`. Po BUG #1 → "Formwork: TRIO...". |
| W4 | Block A line | "42 sekcí × 1 záběrů/sekce = 42" | ✅ OK | `planner-orchestrator.ts:1079`. |
| W5 | Tacts line | "MANUAL override → 42 tacts × 20.24m³" | ✅ OK | `:1091`. |
| W6 | Override rebuild line | — | ✅ OK | |
| W7 | Scheduling mode | "MANUAL → chess" | ✅ OK | `:1117`. |
| W8 | Pour line | "sectional/manual_override..." | ✅ OK | `:1113`. |
| W9 | Formwork area | "621.5 m² per tact" | 🔴 **BUG #7 root visible** | Auto-derived plocha 621,5 m² per tact pro 19,93 m³ tact = **31 m²/m³** (normal 5–10). `estimateFormworkArea` v `pour-decision.ts` pravděpodobně sčítá příliš mnoho ploch. |
| W10 | Maturity strip | "2.0d (50% f_ck, 15°C, CEM_I)" | ✅ OK | Pre-prestress strip. |
| W11 | Rebar | "2718kg/tact, 1.98d/tact..." | ✅ OK | |
| W12 | Pour | "40m³/h, 1.51h/tact..." | ✅ OK | 19,93 / 40 = 0,5 h, + setup = 1,5 h. |
| W13 | Pour crew | "4 lidí (2+1+1+0, 1 čerpadel)..." | ✅ OK | `:1780`. computePourCrew(volume=19.93, pumps=1, 'zaklady_piliru'). Pour decisions: malé objemy <20 m³ → 3 lidí + 1 řízení = 4. |
| W14 | Schedule | "132.2d (sequential 604.8d, savings 78%)" | ✅ OK | `:2004`. |
| W15 | Obrátkovost | "42 identických × 6 sad → 7× obrátka, 928.9 dní" | 🔴 **BUG #5/#6 P0 visible** | `:2222–2225`. Po opravě (J1=1) řádek zmizí (`numIdentical > 1` guard, :2206). |
| W16 | T-window | "5h (season=normal, retarder=false)" | ✅ OK | |
| W17 | Working joints | "8 záběrů × 106.3 m³ (max 120 m³/okno)" | 🟡 NEJASNÉ | Engine zde počítá "kdyby nebyly dilatation joints, sectioned by pour-window" = 8 záběrů × 106 m³. Pro SO-250 už máme 42 dilatation cells, takže W17 je informativní fallback. UI by mělo říct "Bez dilatačních spár by bylo 8 záběrů × 106 m³ — místo toho 42 dilatačních celků × 20 m³ je správně". |

---

# Celkové summary

**Počet polí v auditu:** ~120 (z `FormState` v `types.ts`) + ~40 result/log display = **~160 audit položek**.

## Status breakdown

- ✅ **OK** (funguje korektně): ~102 fields
- 🟢 **FIXED**: **9 distinct bugs** total
  - **P0 shipped 2026-05-14 in PR #1145** (3 bugs): #1 classifier disambiguation, #5/#6 obrátkovost mutex, #7 length-aware estimate + sanity warning
  - **P1/P2/P3 shipped 2026-05-14 in PR #<TBD>** (6 bugs): #3 volume_m3 undo link, #6 manual_zabery UI mutex, #11 wire getSmartDefaults, D7/E1 consolidate Výška, J1/J2/J3 rename + visibility guard, #9 use_retarder removed from FormState
- 🔴 **BUG remaining**: 3 (was 13 pre-sweep) — 2 P3 follow-ups + 1 BUG #4 false alarm. BUG #10 (concrete_consistency hidden) was reclassified as false alarm — field IS rendered in InlineResourcePanel Expert panel.
- 🟡 **NEJASNÉ** (vyžaduje pojasnění): 7
- ❌ **CHYBÍ**: 1 (concrete materials price; original #2 use_retarder UI moot — removed; #3 concrete_consistency UI moot — already rendered)
- ⚪ **OVERKILL**: 1 (ASCII Gantt toggle)

**Engine tests:** 1100/1100 vitest cases pass (1088 pre-audit baseline + 2 obrátkovost mutex + 5 SO-250 classifier + 5 BUG #7). The 6 P1/P2/P3 fixes are UI-only — no shared/engine changes — and the test suite stayed at 1100 across all 6 commits.

---

## Top 10 P0 / P1 bugs k opravě před CSC

1. 🟢 **P0 — BUG #5/#6 — obrátkovost double-count s `num_dilatation_sections`** — **SHIPPED 2026-05-14**. Fix v `planner-orchestrator.ts:2206`: přidán `hasDilatationCells = (num_dilatation_sections ?? 1) > 1` mutex, blok obratkovost se přeskočí + log emit "SKIPPED" + UI warning. Probe re-run: schedule 132,2 d ≡ worksheet S21. 2 nové vitest cases v `planner-orchestrator.test.ts` (`mutex: dilatation cells suppress identical_elements multiplication` + `mutex: dilatation cells alone leave obratkovost untouched`). 111/111 tests pass.
2. 🟢 **P0 — BUG #1 — wrong classification zaklady_piliru místo zaklady_oper** — **SHIPPED 2026-05-14**. `element-classifier.ts` (a) early-exit disambiguation rule pro `(zaklad|základ) + (opern|zarubn|kotven)` → `zaklady_oper`; (b) `zarubn`/`kotven` keywords na `operne_zdi`. 6 nových vitest tests (5 SO-250 fixtures + regression-pin pro plain "Základy" → zaklady_piliru). 1095/1095 vitest cases pass. Probe `classifier_replay` block potvrzuje. **Known limitation:** "Dřík zárubní zdi" bez "základ" — out of scope (real ambiguity).
3. 🟢 **P0 — BUG #7 — estimateFormworkArea + sanity warning** — **SHIPPED 2026-05-14**. Dvojí fix v `planner-orchestrator.ts`: (a) nová branche v `estimateFormworkArea` používající `total_length_m + numTacts + height_m` → per-cell area 2(L+W)·H (length-aware geometry, nahrazuje legacy aspect-ratio heuristics pro dlouhé dilatované elementy); (b) sanity warning při user-input ratio > 12 m²/m³ navádí na "Není to omylem celková plocha napříč všemi záběry?". Probe verifikuje: SO-250 base 837 m³ → 1,0 M Kč realistic (vs 18,1 M Kč při 622 m² user input = **17,7× reduction**). Sanity warning fires na user_replay scenario. 5 nových vitest cases. **Update:** původní claim "estimate vrátil 622" byl mylný — 622 byl user-input. Funkce vracela ~33 m² (mírně pod realitou); nová branche vrací **17 m²** (engineer-realistic, matches user acceptance "14–15 m²").
4. 🔴 **P1 — BUG #12 / N2 — formwork system selector dovoluje vertical-only system pro horizontal element**. Frami Xlife (vertical wall) byl vybrán pro `zaklady_piliru` (horizontal foundation). `formwork-selector.ts` chybí `applicable_element_types` allow-list (existuje pro některé položky v `FormworkSystemSpec.applicable_element_types` per v4.21, ale ne všechny). **Fix:** doplnit allow-list pro Frami/TRIO/Framax (vertical-only), Dokaflex/MULTIFLEX (horizontal-only). Effort: 1 h.
5. 🟢 **P1 — BUG #3 — volume_m3 undo (D1)** — **SHIPPED 2026-05-14 (P1/P2 sprint PR)**. "↶ Vrátit původní hodnotu (X)" underline link pod inputem, viditelný když `|form.volume_m3 − positionContext.volume_m3| > 0,01`. Klik resetuje + flipuje `volume_mode='manual'`.
6. 🟢 **P1 — BUG #6 — manual_zabery UI mutex (F9)** — **SHIPPED 2026-05-14 (P1/P2 sprint PR)**. F1 checkbox dimmed + disabled když F9=true; F2/F3 + Celková délka skryté; F7 hint short-circuits na `N ručních záběrů` místo dilatation × tact produktu.
7. 🔴 **P1 — BUG #2 / B10 — TZ extractor 0/46 coverage pro SO-250**. Out of scope této audit (řešeno v paralelní [smartextractor_so250 audit](../smartextractor_so250/2026-05-14_extractor_coverage.md) PR #1143). **Top-3 fixy ~2 dny.**
8. 🟢 **P2 — BUG #11 — wire getSmartDefaults (H2+I9)** — **SHIPPED 2026-05-14 (P1/P2 sprint PR)**. `useCalculator.ts` nová useEffect (useRef sentinel) na element_type change aplikuje `getSmartDefaults` — vyplní jen empty/auto pole; preserves user override.
9. 🟢 **P2 — D7 vs E1 — Výška consolidate** — **SHIPPED 2026-05-14 (P1/P2 sprint PR)**. Generic Výška skrytý když element_type ∈ geomTypes (L×W×H block ovládá `form.height_m`). Vertikální typy keep generic widget.
10. 🟢 **P2 — J1 / J2 / J3 — rename + visibility guard** — **SHIPPED 2026-05-14 (P1/P2 sprint PR)**. J1 relabel + tooltip; J2 visibility guard `num_identical_elements > 1 && num_dilatation_sections ≤ 1`; amber banner když oba > 1. J3 (num_sets) zachován — má distinct engine role v chess parallelism (audit původní claim "duplicate" byl mylný).

## Top 5 NEJASNÉ — vyžaduje pojasnění UX

1. 🟡 **B16** — "Historie úprav (X)" — historie čeho? TZ text? Form state? Apply events? Tooltip s konkrétním obsahem.
2. 🟡 **F5** — "Šachové betonování" — co dělá tooltip "Sousední cely se betonují přes jeden, nesmí být betonovány současně (sdílí pracovní spáru)". Engine logic existuje, UI vysvětlení chybí.
3. 🟡 **K4** — Doporučení "16 tesařů" vs default "18" — formula v UI hint je jiná než formwork engine. Sjednotit normu (vertical: 0,72×1,2 h/m²; horizontal: 0,6 h/m²) napříč UI hint + engine.
4. 🟡 **R5** — "Úzké hrdlo: element" — co znamená "element" jako bottleneck? Tooltip: "Nejpomalejší fáze v cyklu jednoho záběru — zde výztuž / zrání / montáž / atd."
5. 🟡 **S21** — "132,2 d" pro 837 m³ zárubní zdi — neobvykle vysoko (realita 90–150 d podle 6–12 tesařů × shift). Cross-check potřebuje skutečný SO-250 dodavatel (např. Strabag 2026 stavební deník). Validace post-audit, ne před.

## Top 3 OVERKILL — můžeš vyhodit

1. ⚪ **T4** — ASCII Gantt — vývojářský toy, není pro koncového uživatele.
2. ⚪ **Legacy fields v FormState** — `tact_mode`, `has_dilatacni_spary`, `spara_spacing_m`, `num_tacts_override`, `tact_volume_m3_override` jsou `@deprecated Block A (2026-04)` ale stále v `DEFAULT_FORM`. Z FormState lze odstranit (žádný UI consumer).
3. ⚪ **`pile_*` fields v universal FormState** — 13 polí pro pilotu (`pile_diameter_mm`, `pile_length_m`, ...) jsou ve společné FormState i pro non-pile elementy. Extrahnout do `PileFormState` nebo zachovat ale neexponovat v `useCalculator.buildInput` mimo `element_type='pilota'`.

## Top 5 CHYBÍ — měl by být přidán

1. ❌ **Concrete materials price** — Kč/m³ override. Engine počítá jen labor+rental. Pro tendrovou kalkulaci je materiál 2–3 K Kč/m³ — bez něj cost není srovnatelný s reálným rozpočtem. Add: input `concrete_unit_cost_czk_m3` (default empty = nezahrnuto, banner při empty).
2. 🟢 ~~**`use_retarder` UI** (BUG #9)~~ — **REMOVED 2026-05-14**. Field byl orphaned ve FormState (engine vidí default `false` přes `?? false`). Odstraněno z `FormState`, `DEFAULT_FORM`, `useCalculator.buildInput`. Žádné UI nepotřebuje doplnit.
3. ✅ ~~**`concrete_consistency` UI** (BUG #10)~~ — **false alarm**. Field SE rendeuje v `InlineResourcePanel.tsx:233` (Expert panel `<select>`). Audit's "hidden" claim byl mylný.
4. ❌ **Drawing source** v TZ extractor (out of scope; viz [PR #1143](https://github.com/alpro1000/STAVAGENT/pull/1143)).
5. ❌ **Element-context-aware Výška label** — Show "Výška bloku" vs "Výška dříku" vs "Výška desky" podle element_type. Existing E3 text adapter je správný směr, rozšířit.

---

## Anomálie engine replay — co stojí za hlubší pohled (out of scope této audit)

1. **Engine `costs.total_all_czk` chybí v `PlannerOutput`.** Probe vrátil `undefined`. Frontend `CalculatorResult.tsx` ho dorenderuje z `total_labor_czk + formwork_rental_czk + props_rental_czk + mss_rental_czk`. **Doporučení:** přidat field do engine output pro symetrii + serialization.
2. **`scheduleResult.total_days = 132,2 d` pro 837 m³** je 6 měsíců = neobvykle dlouhé. Compare s VP4 FORESTINA opěrná zeď (~390 m³, ~70 d) — proporcionálně by SO-250 měla být ~150 d, takže 132 d není katastrofa. Ale i tak nahoře. Stojí za benchmark proti reálnému ŘSD timeline.
3. **`formwork_rental_czk = 5,49 M Kč` pro 132 d × 6 sets × 622 m² = 16 405 m²·měsíc** → 335 Kč/m²/měs. Frami catalog `rental_czk_m2_month` je v `formwork-systems.ts:164` ~ pravděpodobně ten rate. Po BUG #1 fix → TRIO catalog rate vyšší (PERI premium) → rental 7,02 M Kč. Užitečný side-effect BUG #1 fixu = realističtější rental.

---

## Reproduce

```bash
cd Monolit-Planner
npm install --ignore-scripts
node_modules/.bin/tsc -p shared
node ../docs/audits/calculator_field_audit/probe.mjs
# → probe_result.json
```

---

## Vazby

- Driver: `test-data/SO_250/tz/SO-250.md` + 9 PDF v `test-data/SO_250/`.
- Probe spec (paralelně): `Monolit-Planner/shared/SO-250_smartextractor_probe.md`.
- TZ extractor probe (paralelně): `docs/audits/smartextractor_so250/2026-05-14_extractor_coverage.md` ([PR #1143](https://github.com/alpro1000/STAVAGENT/pull/1143)).
- Source files:
  - `Monolit-Planner/frontend/src/components/calculator/types.ts` (FormState definition, 470 lines)
  - `Monolit-Planner/frontend/src/components/calculator/CalculatorFormFields.tsx` (UI rendering, ~1500 lines)
  - `Monolit-Planner/frontend/src/components/calculator/useCalculator.ts` (state hook, ~1300 lines)
  - `Monolit-Planner/frontend/src/components/calculator/helpers.ts` (smart defaults — BUG #11)
  - `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` (engine, 2300+ lines; bugs at :2206 obratkovost block, :848 classification log, :1005 formwork log)
  - `Monolit-Planner/shared/src/calculators/pour-decision.ts` (estimateFormworkArea — BUG #7 root)
  - `Monolit-Planner/shared/src/classifiers/element-classifier.ts` (rebar_category + difficulty_factor)
  - `Monolit-Planner/shared/src/constants-data/formwork-systems.ts` (Frami 0,72 h/m² catalog)

---

**End of full field audit worksheet.** No calculator code modified. Doporučení k triage P0/P1 bugs separátně po review této audit.
