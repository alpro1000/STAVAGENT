# TASK: Říms kalibrace + Scheduler refactor (full-stack)

> **Verze:** v1
> **Datum:** 2026-05-20
> **Priorita:** P0
> **Effort estimate:** ~2-3 dny Claude Code session
> **Affects:** Core Engine API + MCP server + Monolit-Planner UI
> **Reference real case:** SO 206 Most na D6 v km 4,720 SO 101 v MÚK Žalmanov, DOKA nabídka č. 540045359

---

## Мантра

> **Read entire repo first. Determine naming from existing code conventions. Do NOT create parallel structure.**
> **Embed into existing code. Do not invent new file paths, variable names, table names, or class names.**

---

## PRE-IMPLEMENTATION INTERVIEW (mandatory — show findings before any code)

### Phase A — Endpoint discovery

Skenuje celý repo a najde všechny endpointy/funkce volané při výběru element_type=rimsa. Vrátí v markdown reportu:

1. **Core Engine API endpoints** — všechny endpoints v FastAPI service které vrátí data pro říms (schedule, formwork, rebar, curing, pump, advisor, work breakdown, OTSKP)
2. **MCP server tools** — všechny MCP tool funkce které volá calculator workflow
3. **Monolit-Planner UI components** — všechny React komponenty které renderují inputs/outputs pro element=rimsa
4. **Norms / catalog files** — všechny config soubory s normami (formwork productivity, rebar ratios, curing classes, difficulty factors)
5. **Test files** — všechny test files související s calculator (unit + integration + golden)
6. **Golden tests v `test-data/tz/`** — inventář všech existujících golden testů, mapping per element_type, identifikace těch které pokrývají rimsa (SO-202, SO-203, SO-207, SO-250, VP4-FORESTINA)

### Phase A6 — Field visibility audit per element=rimsa (NEW)

**Cíl:** Identifikovat každé pole které se zobrazuje v Monolit-Planner UI pro element=rimsa a klasifikovat zda je RELEVANTNÍ pro tento element.

**Pre-context:** PR #1145 (`docs/audits/calculator_field_audit/2026-05-14_full_ui_walkthrough.md`) už identifikoval generic problémy:
- Orphaned UI fields (`use_retarder`, `concrete_consistency`)
- Duplicate Výška fields (D7 vs E1)
- Smart defaults dead code (helpers.ts not wired)
- Geometry inputs flat (no hierarchy)
- Tabulka porovnání bednění obsahuje stropní systémy pro říms ⚠️

**Co Phase A6 dělá specificky pro rimsa:**

1. Otevřít Monolit-Planner (`kalkulator.stavagent.cz/planner`), vybrat element_type=rimsa
2. Vyfotit screenshot celého formuláře
3. Pro každé viditelné pole klasifikovat:

| Klasifikace | Co znamená | Akce |
|---|---|---|
| ✅ **Relevant** | Pole má smysl pro říms | Zachovat |
| ⚠️ **Hidden but relevant** | Mělo by být viditelné, je skryté za toggle | Odhalit |
| ❌ **Irrelevant** | Pro říms nedává smysl (např. `pile_diameter_mm` pro říms) | Skrýt pro element=rimsa |
| 🔄 **Duplicate** | Stejná hodnota se zadává 2× | Sjednotit |
| 💀 **Dead code** | Pole exists v UI ale není wired do engine | Odstranit nebo wire |

4. Output: tabulka per UI sekce (geometrie / materiály / bednění / výztuž / harmonogram / output) s klasifikací každého pole

5. Zvláštní check: **Tabulka porovnání bednění** musí být filtrovaná podle element=rimsa:
   - SHOW: T-bednění, Římsový vozík T, Římsový vozík TU, Místní traditionální
   - HIDE: Frami Xlife, Framax Xlife, MAXIMO, VARIO GT 24, Dokaflex, SKYDECK, Top 50, Staxo 100 (žádný z těchto není pro říms)

**Acceptance test pro Phase A6:**
- UI pro element=rimsa zobrazuje POUZE relevantní fieldy
- Tabulka porovnání bednění obsahuje POUZE bednění vhodné pro říms
- Žádné `pile_*` fieldy nejsou viditelné
- Žádné `nk_subtype` fieldy nejsou viditelné (to je pro mostovkova_deska)
- Žádné `prestress_*` fieldy nejsou viditelné

### Phase A7 — Knowledge base inventory (NEW)

**Cíl:** Identifikovat každý zdroj znalostí který se aktuálně používá při výpočtu pro element=rimsa a každou hodnotu která je hardcoded místo aby byla v `B*` souborech.

**Reálná runtime cesta** (potvrzeno z STAVAGENT_Chat_Handoff_2026-05-11.md):
```
concrete-agent/packages/core-backend/app/knowledge_base/
```

**Inventory steps:**

1. **Skenuje existující obsah `B*` složek:**
   - List všech `.yaml` v `B4_production_benchmarks/default_ceilings/` — které element_types mají coverage?
   - List všech `.yaml` v `B5_tech_cards/` — formwork systems coverage
   - List všech `.yaml` v `B7_regulations/` — které ČSN/TKP/DIN normy jsou extrahované
   - List všech `.yaml` v `B9_validation/conflicts/` — known conflicts

2. **Per element=rimsa identifikuje gaps:**
   - `B4_production_benchmarks/default_ceilings/rimsa.yaml` — exists nebo missing?
   - `B5_tech_cards/formwork_vendor/doka_2024/T_bedneni.yaml` — exists?
   - `B5_tech_cards/rimsa/extracted.yaml` — exists nebo missing?
   - `B7_regulations/tkp_18_rsd_2024/extracted.yaml` — má říms-relevant data?

3. **Skenuje engine kód pro hardcoded matrices:**
   - Find `REBAR_RATES_MATRIX` declarations v calculator engines
   - Find `CURING_DAYS_TABLE` / `T_WINDOW_HOURS` / `EXPOSURE_MIN_CURING_DAYS`
   - Find hardcoded DOKA/PERI productivity numbers
   - Find hardcoded element defaults (rimsa ratio 130, range 100-160, etc.)
   - Find hardcoded TKP/ČSN/DIN constants in kódu

4. **Output v markdown reportu:**

```markdown
## KB Coverage Report

### Existing files relevant to rimsa
- [ ] B4_production_benchmarks/default_ceilings/operne_zdi.yaml  ← reference pattern
- [x] B4_production_benchmarks/default_ceilings/mostovkova_deska.yaml
- [ ] B4_production_benchmarks/default_ceilings/rimsa.yaml         ← MISSING, create
- [ ] B5_tech_cards/formwork_vendor/doka_2024/T_bedneni.yaml       ← MISSING, create

### Hardcoded matrices found in engine code
- File: <path>:<line> — Constant: REBAR_RATES_MATRIX[rimsa]=130
  - Bug ticket: P1, migrate to B4_production_benchmarks/default_ceilings/rimsa.yaml
- File: <path>:<line> — Constant: CURING_DAYS_TABLE[class=4][temp=15]=9
  - Bug ticket: P1, migrate to B7_regulations/tkp_18_rsd_2024/extracted.yaml
- ... (additional findings)

### Recommendation
Create rimsa.yaml + DOKA T-bednění tech card before refactor.
Add bug tickets for each hardcoded matrix (do NOT migrate in this task — separate effort).
```

**Acceptance test pro Phase A7:**
- KB Coverage Report wykazuje stav VŠECH knowledge sources relevant for rimsa
- `rimsa.yaml` v `B4_production_benchmarks/default_ceilings/` je vytvořen s defaults (rebar ratio 140, range 100-180, max cycle 6m, curing class 4, exposures XF4/XD3, formwork T-bednění recommended)
- DOKA T-bednění tech card vytvořena v `B5_tech_cards/formwork_vendor/doka_2024/T_bedneni.yaml` s productivity (setup 1.0, relocate 0.5, strip 0.4 h/bm)
- Bug tickety vytvořeny v BACKLOG.md pro hardcoded matrices (out-of-scope migration)
- Calculator response obsahuje source attribution pro každou použitou hodnotu

### Phase B — Architecture analysis

Po Phase A identifikuje:

- **Single source of truth?** — Vychází vše z Core Engine API, nebo má MCP duplikovanou logiku? Má UI duplikovanou logiku?
- **DRY violations** — kde se počítají stejné hodnoty (productivity, rebar ratio, schedule) na víc místech?
- **Backward compat risk** — jaké jiné element_types používají sdílený scheduler kód (mostovka, dříky, opěrné zdi)?

### Phase C — User Confirmation

Před jakoukoli implementací: Claude Code zastaví, ukáže report, zeptá se uživatele:

- "Tato struktura souborů vypadá správně?"
- "Mám pokračovat s refactor, nebo nejdřív audit doplnit?"
- "Existují skryté závislosti které mám zohlednit?"

**ŽÁDNÝ kód není napsán před schválením user.**

---

## Context (co teď funguje vs co je broken)

### Co funguje
- Calculator vrátí formwork system + rebar tons + schedule pro říms (nějaké hodnoty)
- OTSKP code matching (find_otskp_code) vrací správné kódy
- MCP tool calculate_concrete_works je dostupný pro Claude
- Monolit-Planner UI renderuje výsledky

### Co je broken (zjištěno proti DOKA nabídce 540045359 + tabulce výztuže SO 206)

1. **Říms zadávaná jako m³ místo bm × průřez** — uživatel musí ručně počítat objem, místo aby zadal délku
2. **Schedule v continuous time** — vrací zlomky dnů (0,7 dne) místo celých směn
3. **Cyklus záběrů sčítaný lineárně** — 6 záběrů × 9 dnů curing = 54 dnů místo realistických 9 dnů (jen poslední záběr)
4. **T-bednění norma jen `setup + strip`** — chybí `relocate` (cyklický posun mezi záběry)
5. **Rebar days ignoruje crew size** — 1,47 t / 8 h = 18 dnů místo reálných 2-3 dnů s crew 3 osob
6. **Auto-výběr "Římsový vozík T"** — ekonomicky špatné pro krátké říms (≤50 bm), tool by měl preferovat stacionární "T-bednění"
7. **Žádná validace max záběr length** — uživatel může zadat 30 m, ale TKP 18 + Metodika MD ČR omezuje na 6 m pro říms s XF4
8. **Geometry awareness** — říms by se měl počítat per kus (2 ks per most), tool účtuje volume jako jednolitý celek
9. **Default rebar ratio 130 kg/m³** — reálná SO 206 nabídka 138 kg/m³, kalibrovat na 140
10. **Žádný explicit input pro shift_length** — hardcoded 8 h, ale stavebnictví běžně 10 h, max 12 h dle Zákoníku práce §83

---

## Business logic to implement

### 1. Discrete shift scheduler (P0 — core refactor)

**Princip:**
- Configurable shift length (uživatel volí: 8 / 10 / 12 h, default 8)
- Validation: shift_length > 12 h → error (Zákoník práce §83)
- Každá fáze (bednění, výztuž, betonáž, odbednění) per záběr = **minimum 1 směna**
- Mezi fázemi vždy nový den (cleanup + příprava nelze srazit do jedné směny)
- Curing běží pasivně (neblokuje další záběr po dosažení 70 % pevnosti)
- Total days = ceiling(working_hours / shift_length), nikdy fractional

**Behavior:**
- Pure work 3 h v 8 h směně → vykazuje **1 směnu**, ne 0,375 dne
- Pure work 9 h → **2 směny** (přesah do druhé směny = nový den)
- Pure work 16 h → **2 směny** (pokud crew může pokračovat)

### 2. Cyclic phase model pro multi-záběr elementy (P0 — core refactor)

**Pro element_types s pracovními záběry** (rimsa, operne_zdi, mostovkova_deska s MSS, izolacni_stena délkou >6 m):

**Workflow per záběr:**
- Den 1: bednění (relocate nebo setup pro 1. záběr)
- Den 2: vázání výztuže
- Den 3: betonáž + počátek curing
- Den 4-5: interim curing wait do 70 % pevnosti (~2 dny @ 15 °C, 3-4 dny @ 5-10 °C)
- Den 6: odbednění + posun bednění na další záběr

**Critical path:**
```
total_days = (num_tacts - 1) × cycle_per_tact_days + last_tact_days + final_curing_tail
  kde
    cycle_per_tact_days = formwork_relocate_shifts 
                       + rebar_shifts 
                       + concrete_shifts 
                       + interim_curing_shifts  (do 70 %)
                       + strip_shifts            (zahrnuto v relocate dalšího záběru)
    last_tact_days = cycle_per_tact_days (bez relocate, místo strip)
    final_curing_tail = curing_class_days @ temperature_band (po betonáži posledního záběru)
```

**Pro single-tact elementy** (zaklady, sloup, sachta jednorázové): zůstává sum_of_phases (current behavior preserved).

### 3. T-bednění formwork productivity (P0 — calibration)

**Current (incorrect):**
```
productivity = {assembly: 1.0 h/bm, strip: 0.43 h/bm}
total_formwork_hours = (assembly + strip) × length_bm × num_tacts
                     # = 1.43 × 35 × 6 = 300 h ← TOO MUCH
```

**Expected (calibrated against DOKA 2024 + methvin.co):**
```
productivity = {
  setup_h_per_bm: 1.0,      # initial assembly, 1× per řims
  relocate_h_per_bm: 0.5,   # cyclic move between záběry, (n-1)×
  strip_h_per_bm: 0.4       # final strip, 1× per řims
}
total_formwork_hours = setup × záběr_length 
                    + relocate × záběr_length × (num_tacts - 1)
                    + strip × záběr_length
                    # = 1.0 × 6 + 0.5 × 6 × 5 + 0.4 × 6 = 23.4 h per řims
```

Apply same pattern for:
- Vozík T (Římsový vozík T): setup 0.8, relocate 0.3, strip 0.4
- T-bednění opěrné zdi: setup 1.2, relocate 0.6, strip 0.5

**Source:** DOKA katalog 2024 + methvin.co labor norms + ČBS TP 02.

### 4. Crew parallelism (P0 — scheduler fix)

**Current (incorrect):**
```
rebar_days = (tonnage × hours_per_ton × difficulty) / shift_length
           # ignores crew_size, treats as 1 worker
```

**Expected:**
```
rebar_days = ceiling(
  (tonnage × hours_per_ton × difficulty) 
  / (shift_length × crew_size_rebar)
)
```

Same fix for formwork_days, concrete_days. Crew sizes configurable (UI + MCP input).

### 5. Říms geometry awareness (P0 — UI + MCP refactor)

**Current input:** uživatel zadá `volume_m3` (musí počítat ručně).

**Expected input:**
```
length_per_rimsa_bm: float      # délka jedné říms [m]
cross_section_width_m: float    # šířka průřezu [m]  (typicky 0.5-1.5)
cross_section_height_m: float   # výška převislé části [m] (typicky 0.4-0.8)
shape_factor: float             # = 1.0 pro rectangle, 0.7-0.85 pro typický trapéz s odlivkou
num_bridges: int                # 1 nebo 2 (LM+PM)
nk_type: enum                   # "spolecna_nk" (1 most = 2 říms) | "separovane_nk" (1 most = 4 říms)
```

**Auto-computed:**
```
num_rimsas = (2 if nk_type == "spolecna_nk" else 4) × num_bridges
volume_per_rimsa_m3 = length × width × height × shape_factor
total_volume_m3 = volume_per_rimsa_m3 × num_rimsas
total_length_bm = length_per_rimsa_bm × num_rimsas
```

**UI display:**
- "Počet říms celkem: 2" / "4"
- "Celkový objem: X m³"
- "Celková délka bednění: Y bm"
- Volitelně: backward compatibility input "Total volume m³" se zachová (tool detekuje který input user použil).

### 6. Záběr length validation (P1)

**Pro element_type=rimsa:**
- `cycle_length_bm > 6.0` → **warning** v output: "Záběr > 6 m pro říms s XF4 expozicí je mimo TKP 18 + Metodika MD ČR pro řízené smršťovací spáry. Doporučená hodnota: 6 m."
- `cycle_length_bm < 3.0` → **warning** "Záběr < 3 m je neekonomický (zbytečně mnoho cyklů)"
- Range OK: 4.0 – 6.0 m

**Pro element_type=operne_zdi:**
- Recommended range: 6.0 – 12.0 m
- > 15 m → warning

**Pro mostovka NK (mostovkova_deska):**
- Recommended range: 15 – 30 m per záběr
- Závisí na construction_technology (fixed_scaffolding / MSS / cantilever)

### 7. Formwork auto-selection refinement (P1)

**Pro element_type=rimsa:**

```
if total_length_bm <= 50:
    auto_select = "T-bednění" (stacionární)
    reason = "Stacionární T-bednění je 3× levnější než vozík pro krátké říms"
elif 50 < total_length_bm <= 150:
    auto_select = "Římsový vozík T" or "T-bednění" (uživatel volí)
    reason = "Hraniční rozmezí — vozík rychlejší, bednění levnější"
else:
    auto_select = "Římsový vozík TU"
    reason = "Pro dlouhé říms je vozík ekonomicky výhodnější"
```

Manual override přes `formwork_system_name` parameter zachován (current behavior).

### 8. Rebar ratio calibration (P2)

**Current:**
```
rimsa: ratio_kg_m3 = 130 (range 100-160)
```

**Expected (calibrated against SO 206 + 4 dalších reálných bridge říms):**
```
rimsa: ratio_kg_m3 = 140 (range 100-180)
```

Source: SO 206 DOKA nabídka 540045359 + tabulka výztuže (138 kg/m³ skutečná), + REBAR_NORMS_COMPREHENSIVE_AUDIT.md.

### 9. Resource caps validation (P1 — NEW)

**Princip:** Calculator nesmí akceptovat nesmyslné zdrojové vstupy. Globální resource caps fungují jako sanity guard.**Caps to validate (warn or error):**

| Resource | Soft warn | Hard error | Důvod |
|---|---|---|---|
| crew_size_formwork | > 8 | > 20 | Bednění crew typ. 4, max 8 paralelně |
| crew_size_rebar | > 6 | > 15 | Vazači typ. 3, max 6 paralelně per úsek |
| crew_size_concrete | > 12 | > 30 | Betonáž crew typ. 5, max 12 (ukládka+vibrace+finiš) |
| num_formwork_sets (rimsa) | > 4 | > 10 | Pro říms max 4 sety bednění reálné |
| num_pumps | > 3 | > 5 | Pro most: typ. 1-2 pumpy, max 3 paralelně |
| shift_length_h | > 10 | > 12 | Zákoník práce §83 |
| working_days_per_week | > 6 | > 7 | §92 nepřetržitý odpočinek v týdnu |
| total_workers_on_site | > 30 (rimsa) | > 100 (most/rimsa) | Site capacity, koordinace |

**Behavior:**
- Soft warn → response obsahuje warning array, výpočet proběhne
- Hard error → return 400 s odůvodněním a referencí na normu

**UI hint:** Pokud uživatel zadá crew_size=50, UI ukáže červený warning "50 vazačů na 1 říms je nereálné. Doporučená hodnota: 3-6. Pokračovat?"

**MCP behavior:** Stejný validation v `calculate_concrete_works`, warnings/errors v response.

**Source:** Empirické limity z N=5 production pilots (Žihle, Libuše, hk212, SO 206, RD Jáchymov).

### 10. Knowledge base integration check (P1 — sanity, NEW)

**Cíl:** Audit zda calculator pro element=rimsa skutečně volá knowledge base layers (L1-L4), nebo zda hardcoduje hodnoty.

**Reálná runtime cesta v repo:**
```
concrete-agent/packages/core-backend/app/knowledge_base/
├── B0_sources/
├── B1_otksp/
├── B2_csn_en_206/
├── B3_current_prices/
├── B4_production_benchmarks/      ← name v reálu (ne "B4_productivity")
│   └── default_ceilings/
│       ├── operne_zdi.yaml         ✓ exists
│       ├── mostovkova_deska.yaml   ✓ exists
│       └── rimsa.yaml              ❓ MUST CREATE
├── B5_tech_cards/
│   ├── ZS_templates/               ← active (Zihle sprint)
│   └── formwork_vendor/            ← MUST CREATE for DOKA T-bednění
├── B6_research_papers/
├── B7_regulations/
├── B8_company_specific/
└── B9_validation/
```

**Known P0 bug per `KNOWLEDGE_PLACEMENT_GUIDE.md` (z STAVAGENT_Chat_Handoff_2026-05-11.md):**

Engine kód obsahuje hardcoded matrices které **by měly být v `B*` souborech**:

| Hardcoded v engine | Měla by být v KB | Pro říms znamená |
|---|---|---|
| `REBAR_RATES_MATRIX` | `B4_production_benchmarks/rebar_rates/methvin_calibrated.yaml` | říms D10/D12 ratio 22 h/t (calibrated) |
| `T_WINDOW_HOURS` | `B5_tech_cards/formwork_vendor/doka_2024/` | T-bednění setup/relocate/strip |
| `CURING_DAYS_TABLE` | `B7_regulations/tkp_18_rsd_2024/extracted.yaml` | TKP18 §7.8.3 class 4 = 9 dnů |
| `EXPOSURE_MIN_CURING_DAYS` | `B7_regulations/csn_en_13670_provadeni/` | XF4 floor 7 dnů |
| DIN 18218 k-factors | `B7_regulations/din_18218_2010_frischbetondruck/` | lateral pressure |
| Element defaults (rimsa) | `B4_production_benchmarks/default_ceilings/rimsa.yaml` | ratio 130→140, range 100-180, cycle max 6m |

**Audit per knowledge layer:**

| Layer | Co kontrolujeme | Expected behavior |
|---|---|---|
| L1 Element YAML | Calculator čte `B5_tech_cards/rimsa/extracted.yaml`? | YES — pre-flight load při výběru element_type=rimsa |
| L2 Norms B7 | TKP18 maturity tables, ČSN EN 13670 strip strengths | YES — lookup z `B7_regulations/`, ne hardcoded v engine |
| L3 Research B6 | fib Bulletin 48 (formwork), Nečas mosty II | Optional — pro AI Advisor hints |
| L4 Productivity B4 | methvin.co rebar rates | YES — calibrated source z `B4_production_benchmarks/` |
| L5 RAG | Semantic search v učebnicích | NOT IN SCOPE (separátní task) |
| L6 Validation B9 | Conflict rules | YES — cross-check warnings |

**Acceptance:**
- Calculator response obsahuje `sources[]` array s referencemi (např. `["TKP 18 §7.8.3", "methvin.co D12 rebar", "DOKA katalog 2024 T-bednění"]`)
- Pokud reference chybí → hardcoded hodnota → bug ticket
- Audit trail per element vidí všechny knowledge sources použité
- **Soubor `B4_production_benchmarks/default_ceilings/rimsa.yaml` musí být vytvořen** s defaults pro říms (ratio, range, cycle limits, exposures, curing class)

**Migration scope (P1, ne P0):**
Tento task **NE** dělá full migraci všech hardcoded matrices do KB. To je separátní big effort. **Tento task:**
- Vytvoří `rimsa.yaml` v `B4_production_benchmarks/default_ceilings/`
- Identifikuje a zaloguje VŠECHNY hardcoded references použité při výpočtu říms
- Zatím READ z hardcoded path zachová, ale PŘIDÁ sekundární lookup ze YAML
- Vytvoří bug tickety pro každou hardcoded reference (Phase A7 output)

**Out of scope (deferred to separate task):**
- Full migration hardcoded matrices → KB YAML files (P1 separátní task)
- L5 RAG layer (pgvector + embeddings + RAG endpoint) → `TASK_Knowledge_L5_RAG_v1.md`
- Učebnice mostů ingestion z GCS bucket → součást L5 RAG task
- Multi-persona AI Advisor (Rozpočtář/Stavbyvedoucí/Projektant) → `TASK_AI_Advisor_Triangulation_v1.md`

---

## Domain rules (sources)

| Pravidlo | Zdroj |
|---|---|
| Záběr říms max 6 m (XF4 expozice) | TKP 18 + Metodika MD ČR pro řízené smršťovací spáry |
| Curing class 4 pro mostní říms a NK | TKP kap. 18 §7.8.3 |
| Curing 9 dnů @ 15 °C pro class 4 | TKP kap. 18 tabulka 7.8.3-1 |
| Min 7 dnů curing pro XF3/XF4 expozici | TKP kap. 18 §7.8.3 (exposure floor) |
| Maximální směna 12 h | Zákoník práce 262/2006 Sb. § 83 |
| Min odpočinek mezi směnami 11 h | Zákoník práce § 90 |
| Přesčas max 8 h/týden nařízený, 416 h/rok celkem | Zákoník práce § 93 |
| T-bednění productivity (setup/relocate/strip) | DOKA katalog 2024 + methvin.co + ČBS TP 02 |
| Boční tlak DIN 18218 pro bednění | DIN 18218 / EN 12812 |
| Lateral pressure formwork limits (Frami 80 kN/m², Framax 100 kN/m², VARIO 150) | DOKA katalog 2024 |
| OTSKP kód 317325 pro říms ŽB C30/37 | OTSKP 1/2025 |
| OTSKP kód 317365 pro výztuž říms B500B | OTSKP 1/2025 |
| Geometrie říms na mostě | <https://cs.wikipedia.org/wiki/Mostn%C3%AD_%C5%99%C3%ADmsa> + VL 4-101.xx |

---

## Frontend changes (Monolit-Planner UI)

Pro element_type=rimsa:

**Input section (nové fields):**
- "Délka 1 říms [m]" (number, default 35)
- "Šířka průřezu [m]" (number, default 0.75)
- "Výška průřezu [m]" (number, default 0.6)
- "Shape factor" (number 0.6-1.0, default 0.85 — pro trapéz s odlivkou)
- "Počet mostů" (number 1 or 2, default 1)
- "Typ NK" (radio: "Společná NK přes celý pruh" / "Separované NK")
- "Záběr length [m]" (number, default 6.0, warning if > 6 or < 3)
- "Délka směny [h]" (dropdown: 8 / 10 / 12, default 8)
- "Crew bednění" (number 2-6, default 4)
- "Crew výztuž" (number 2-6, default 3)
- "Crew betonáž" (number 3-8, default 5)
- "Počet setů bednění" (number 1-4, default 1) — pro paralelní záběry
- Bednění dropdown: T-bednění / Vozík T / Vozík TU (auto-recommend with override)

**Auto-display (computed):**
- "Počet říms: X" (2 nebo 4)
- "Celková délka: Y bm" (length × num_rimsas)
- "Celkový objem: Z m³"
- "Počet záběrů per řims: N" (length / cycle_length)

**Output section (revised):**
- Schedule shown as **discrete shifts** (no fractional days)
- Gantt-style bars per phase per záběr
- Critical path highlighted
- Total cost breakdown: beton + výztuž + bednění pronájem + bednění podíl koupě + práce
- Warning messages prominently displayed (záběr > 6 m, etc.)

---

## MCP consistency (calculate_concrete_works tool)

Add new parameters:
- `length_per_rimsa_bm` (optional, alternative to volume_m3 for rimsa)
- `cross_section_width_m`
- `cross_section_height_m`
- `shape_factor`
- `nk_type` ("spolecna_nk" | "separovane_nk")
- `shift_length_h` (8 | 10 | 12, default 8)
- `crew_size_formwork` (default 4)
- `crew_size_rebar` (default 3)
- `crew_size_concrete` (default 5)
- `num_formwork_sets` (default 1)

**Critical:** MCP server musí volat Core Engine API (single source of truth). NE duplikovat logiku v MCP service. Pokud Core Engine vrátí JSON, MCP jen forward s mírnou re-strukturací response.

**Response additions:**
- `discrete_schedule`: array of shift objects per záběr
- `total_days_calendar`: int (no fractions)
- `total_shifts`: int
- `warnings`: array (validation warnings)
- `cost_breakdown_czk`: dict s detailními položkami

---

## Acceptance criteria

> **Strategie:** Regression test proti **existujícím golden testům** v `test-data/tz/`. NE psát nové golden testy v této session. Po refactoru musí všechny existující golden tests projít, plus mini-test pro SO 206 jako bonus validation.

### 1. Existing golden tests — backward compat (must all pass)

Tyto testy už mají expected values v `test-data/tz/`. Po refactoru musí projít bez modifikace expected values (regression):

| Golden test | Element types | Co testuje pro říms refactor |
|---|---|---|
| `test-data/tz/SO-202_D6_most_golden_test.md` | mostovkova_deska, driky_piliru, rimsa, opery, kridla, zaklady_piliru, pilota | Říms NK (předpjatý most) — XF4 expozice, C30/37, B500B |
| `test-data/tz/SO-203_D6_most_golden_test_v2.md` | most (jednotrámový?) | Říms NK druhý referenční |
| `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` | mostovka MSS, rimsa | Říms na estakádě s MSS technologií |
| `test-data/SO_250/tz/SO-250.md` ⭐ | operne_zdi (zárubní zeď), rimsa | **Hlavní říms test** — 525 bm říms, 42 dilatačních celků, C30/37 XF4+XD3+XC4, pohledové C2d bednění. Spec only (markdown); Vitest fixture wiring deferred to Phase G per Phase A Q1 decision. |
| `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` | operne_zdi | Opěrná zeď + říms (Horažďovice, méně agresivní expozice) |

**SO-250 je primary říms validation:**
- File location: `test-data/SO_250/tz/SO-250.md` (corrected from `test-data/tz/` per Phase A Q1)
- 42 dilatačních celků (40 × 12,5 m + 2 × 7,6 m) = 525 bm celkem
- C30/37 XF4+XD3+XC4
- Pohledové C2d bednění (multivrstvé desky se strukturou dřeva)
- Záběr 12,5 m → **testuje validation warning** (12,5 > 6 m doporučených pro mostní říms s XF4)
- Testuje **cyklus** (42 záběrů → critical path scheduler)
- Testuje **scale** (525 bm vs 70 bm SO 206)
- Vitest fixture (`golden-so250.test.ts`) NOT created in Phase A — wiring is Phase G work

### 2. Critical bug fixes — testovatelné požadavky

**2.1 Discrete shifts (no fractional days)**
- Vstup: jakýkoli element s pure_work < 8 h pro jakoukoli fázi
- Expected: shift count je celé číslo ≥ 1 (no 0.7 dní)
- Test path: regression na SO-202, SO-250, VP4-FORESTINA

**2.2 Crew parallelism**
- Vstup: rebar 1,47 t, crew_size_rebar=3, shift=8h, difficulty=1.4
- Expected: rebar_days ≈ 2 směny (ne 18 dnů)
- Math: 1,47 × 22 × 1,4 / (8 × 3) = 1,9 → ceiling = 2 směny

**2.3 Cyclic schedule (multi-záběr)**
- Vstup: rimsa s num_tacts=6, 1 set bednění, sekvenčně
- Expected: total_days = (5 × cycle) + last_tact + 9_dnů_curing_tail ≈ 35-40 dnů (ne 84 nebo 102 jak teď)
- Test path: SO 206 mini-test (viz bod 4 níže)

**2.4 T-bednění productivity (setup/relocate/strip)**
- Vstup: T-bednění, length=35 bm, num_tacts=6
- Expected formwork hours: 1.0×6 + 0.5×6×5 + 0.4×6 = 23,4 h per řims (ne 1.43 × 35 × 6 = 300 h)

**2.5 Curing accumulation fix**
- Vstup: rimsa, num_tacts=6, curing_class=4, 15°C
- Expected: final_curing_tail = 9 dnů (jen poslední záběr), ne 54 (kumulace)

**2.6 Validation warnings**
- cycle_length_bm=10 pro rimsa → warning v response s referencí TKP 18 + Metodika MD ČR
- shift_length_h=14 → error response (Zákoník práce §83)
- rebar_ratio_kg_m3=250 pro rimsa → warning (mimo range 100-180)

### 3. UI ↔ MCP consistency (single source of truth)

- Stejný input v Monolit-Planner UI a v MCP calculate_concrete_works → **numericky identický výstup**
- Test: paralelně volat UI form-submit a MCP tool se stejnými parametry, porovnat output JSON

### 4. SO 206 bonus mini-test (z DOKA nabídky 540045359)

**Není formal golden test, ale sanity check** že refactor produkuje realistické hodnoty pro nový případ:

- Vstup:
  ```yaml
  element_type: rimsa
  length_per_rimsa_bm: 35.026
  cross_section_width_m: 0.75
  cross_section_height_m: 0.60
  num_bridges: 1
  nk_type: spolecna_nk          # → 2 říms total
  concrete_class: C30/37
  exposure_class: XF4
  rebar_class: B500B
  cycle_length_bm: 6.0
  formwork_system_name: T-bednění
  num_formwork_sets: 1
  shift_length_h: 8
  crew_size_formwork: 4
  crew_size_rebar: 3
  crew_size_concrete: 5
  ```

- Expected output (s tolerancí ±10 %):
  ```yaml
  num_rimsas: 2
  total_volume_m3: ~22.56          # 0.85 shape_factor × 0.75 × 0.6 × 35 × 2
  total_length_bm: 70.05
  rebar_tons: ~3.1                 # 140 kg/m³ × 22.56 / 1000
  formwork_system: T-bednění
  schedule_days: 55-70             # sekvenčně, 1 set, 1 crew, s overlap
  schedule_shifts: 55-70           # discrete shifts only
  warnings: []                     # cycle 6m OK, shift 8h OK
  ```

- Expected costs (s tolerancí ±15 %):
  ```yaml
  beton_otskp_317325: 381 270 Kč   # 22.56 × 16 900,36
  vyztuz_otskp_317365: 129 000 Kč  # 3.1 × 41 635,80
  bednění_T_pronájem: ~92 000 Kč   # 70 bm × 528 Kč/bm/měs × 2.5 měs
  total_cost_range: 850 000 - 950 000 Kč
  ```

Tento mini-test se MŮŽE přidat do `test-data/tz/SO-206_rimsa_minicheck.md` (volitelné, ne mandatory).

### 5. SO-250 záběr validation test

Z SO-250 golden testu:
- Vstup: cycle_length=12,5 m pro element=rimsa
- Expected: response obsahuje warning "Záběr > 6 m pro říms s XF4 expozicí je mimo TKP 18..." ALE výpočet stále proběhne (warning ≠ error)
- Důvod: zárubní zeď SO-250 reálně má 12,5 m záběry navržené projektantem (odlišný kontext než mostní říms)

### 6. OTSKP integration (current behavior preserved)

- `find_otskp_code(query="římsa C30/37")` → vrátí kód 317325, cena 16 900,36 Kč/m³ (žádná regrese)
- `find_otskp_code(query="výztuž říms B500B")` → vrátí kód 317365, cena 41 635,80 Kč/t

### 7. Skip lists from golden tests (must respect)

Golden tests obsahují **expected exceptions** a edge cases. Refactor je nesmí porušit:

- SO-202: prestress vyztuž Y1860S7 — žádná interakce s říms scheduler
- SO-250: 42 dilatační celky, ne 1 — scheduler musí podporovat hodně záběrů (>20)
- VP4-FORESTINA: variable thickness — calculator používá průměr (warning emission)
- SO-207: MSS technology na NK, ale říms zůstává standardní T-bednění

---

## Affected endpoints — discovery output expected

Claude Code v Phase A reportuje (vyplní z reálného repo):

```yaml
core_engine_endpoints:
  - <path1>: <description>
  - <path2>: <description>
  ...

mcp_tools:
  - calculate_concrete_works: signature + return shape
  - classify_construction_element: ...
  - get_construction_advisor: ...
  - create_work_breakdown: ...
  ...

ui_components_monolit_planner:
  - <ComponentName1>: <role>
  - <ComponentName2>: <role>
  ...

norm_config_files:
  - <path>: <covers what>
  ...

test_files:
  - <path>: <coverage>
  ...

shared_logic_assessment:
  - Where is productivity defined? Core / MCP / UI / multiple?
  - Where is rebar ratio defined? Core / MCP / UI / multiple?
  - Where is schedule computed? Core / MCP / UI / multiple?
  - DRY violations found: <list>
```

---

## Out of scope (NOT in this task)

- Refactor pro non-rimsa element_types beyond scheduler core changes (scheduler refactor affects ALL but logic per-element zůstává jak je)
- Pricing UI changes (Lemon Squeezy billing untouched)
- MCP OAuth / authentication
- Cross-user data isolation (P0 task separately)
- Pricing of dilatation seals, anchors, isolation — those stay as separate budget items (out of calculator scope)
- I18n / multilanguage UI
- Geometry calculator module (separate task)
- **Agent composability layer** (atomic_calculate as primitive used by UI + MCP) → `TASK_MCP_Composable_Agent_Layer_v1.md`
- **Sborné position decomposition** for agent workflow → covered by `TASK_MCP_Composable_Agent_Layer_v1.md`

---

## UI vs MCP behavior boundary (clarification)

This task focuses on **single calc primitive** (atomic_calculate) used by both UI and MCP. The differences in UX behavior are explicitly NOT in scope:

| Aspect | This task delivers | Separate task delivers |
|---|---|---|
| Field visibility (UI) | ✅ Phase A6 filter pro element=rimsa | — |
| Resource caps validation | ✅ Section 9 (used by both UI + MCP) | — |
| Knowledge base integration | ✅ Section 10 (KB lookup, ne hardcoded) | — |
| MCP composable tools (calculate_partial, aggregate_partials) | ❌ Not here | `TASK_MCP_Composable_Agent_Layer_v1.md` |
| Sborné position decomposition | ❌ Not here | `TASK_MCP_Composable_Agent_Layer_v1.md` |
| Agent session memory | ❌ Not here | `TASK_MCP_Composable_Agent_Layer_v1.md` |
| Commit routing (Planner vs Registry TOV) | ❌ Not here | `TASK_MCP_Composable_Agent_Layer_v1.md` |

**Rationale:** Říms task delivers a clean atomic primitive. The Composable Agent Layer task uses that primitive to enable agent workflows. Without říms task first, agent layer would inherit broken scheduler.

---

## Naming rule (mandatory)

> Naming and file structure: determine from existing repo conventions.
> Do not create parallel structure. Do not invent new file paths, variable names, table names, or class names.
> Read entire repo first. Show audit findings. Wait for confirmation. THEN write code.

---

## Session execution plan (estimated)

| Day | Phase | Output |
|---|---|---|
| Day 1 AM | **Phase A: Endpoint discovery + Phase B: Architecture analysis** | Markdown report + user confirmation |
| Day 1 AM | **Phase A2: Golden test inventory** — number existujících testů v `test-data/tz/`, mapping per element_type, identify expected values for říms-related tests | Updated audit report |
| Day 1 AM | **Phase A6: Field visibility audit** per element=rimsa (rozšíření PR #1145) | Screenshot + classification report |
| Day 1 AM | **Phase A7: Knowledge base inventory** v `concrete-agent/packages/core-backend/app/knowledge_base/` | KB Coverage Report + bug tickets |
| Day 1 PM | Phase C: Scheduler core refactor (discrete shifts + cyclic phases) | Code + unit tests pass |
| Day 2 AM | Phase D: T-bednění productivity calibration + crew parallelism fix + create `rimsa.yaml` + `T_bedneni.yaml` v KB | Code + tests pass + KB files |
| Day 2 PM | Phase E: UI Monolit-Planner refactor (length-based input for rimsa + field visibility filter + bednění dropdown filter) | UI screenshots + e2e tests |
| Day 3 AM | Phase F: MCP tool parameter additions + Core Engine API alignment | API tests + MCP integration tests |
| Day 3 PM | **Phase G: Regression run proti všem 5 golden testům** v `test-data/tz/` + bonus SO 206 mini-test + docs update | All tests green + PR description |

**Phase G detail:**
1. Run regression suite proti všem golden testům v `test-data/tz/*.md`
2. Pro každý test: actual output vs expected output, diff report
3. If diff > tolerance (typicky ±2 % volumes, ±15 % costs, ±10 % schedule) → fix or update expected values (s odůvodněním)
4. Optional: přidat SO 206 mini-check do `test-data/tz/SO-206_rimsa_minicheck.md`
5. Generate PR description s diff summary

---

## CONTEXT FOR CLAUDE CODE — what to read first (priority order)

Před Phase A skenováním Claude Code MUSÍ přečíst v tomto pořadí:

### Architecture & conventions
1. `concrete-agent/README.md`
2. `concrete-agent/packages/core-backend/app/` — top-level layout
3. `concrete-agent/packages/core-backend/app/parsers/` — existing patterns
4. `concrete-agent/packages/core-backend/app/services/`
5. `concrete-agent/packages/core-backend/app/schemas/`
6. `concrete-agent/packages/core-backend/app/ai/ai_reasoner.py`
7. `concrete-agent/packages/core-backend/app/knowledge_base/B*` — **kritické**
8. `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` — orchestrator
9. `Monolit-Planner/shared/src/calculators/resource-ceiling.ts` — resource validation patterns
10. `Monolit-Planner/shared/src/calculators/` — všech 7 enginů

### Knowledge & policies
11. `KNOWLEDGE_PLACEMENT_GUIDE.md` — kam patří nová knowledge
12. `STAVAGENT_PATTERNS.md` — 8 codified patterns
13. `STAVAGENT_ClaudeCode_Session_Mantra.md` — task writing principles
14. `CALCULATOR_PHILOSOPHY.md` — design principles
15. `calculator_element_logic_v4_FINAL.md` — element logic
16. `calculator_complete_pipeline.md` — pipeline overview + GAP analysis
17. `REBAR_NORMS_COMPREHENSIVE_AUDIT.md` — rebar norms source of truth
18. `SKRUZ_TERMINOLOGIE_KANONICKA.md` — terminology

### Element & formwork
19. `STAVAGENT_Complete_Element_Catalog.md` — 22+ element types
20. `rimsa_element_spec_v2_DOKA_PERI.md` — current rimsa spec
21. `formwork_catalog_PERI_DOKA_2025.md` — formwork catalog
22. `CODEX_TASK_GEOMETRY_CALCULATOR.md` — geometry module

### Golden tests in `test-data/tz/`
23. `test-data/tz/SO-202_D6_most_golden_test.md` — most reference
24. `test-data/tz/SO-203_D6_most_golden_test_v2.md` — most v2
25. `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` — MSS reference
26. `test-data/tz/SO-250_golden_test.md` — **primary rimsa test** ⭐ (525 bm říms, D6 Olšová Vrata-Žalmanov stejná stavba)
27. `test-data/tz/VP4_FORESTINA_operna_zed_golden_test.md` — opěrná zeď

### Existing audits (already in repo)
28. `docs/audits/calculator_field_audit/2026-05-14_full_ui_walkthrough.md` (PR #1145)
29. `docs/audits/calculator_resource_ceiling/2026-05-07_phase0_audit.md` (PR #1110)
30. `docs/audits/smartextractor_so250/2026-05-14_extractor_coverage.md` (PR #1143)
31. `docs/audits/smartextractor_variant_b/FINDINGS_SO_FAR_2026-05-10.md`

### Recent handoffs (for current state)
32. `STAVAGENT_Chat_Handoff_2026-05-11.md` — current branch status, test counts, known bugs
33. `CLAUDE.md` (root) — current sprint state + session setup
34. `next-session.md` (if exists) — last session's handoff

---

## Reference materials in project knowledge

Tyto soubory už existují v project knowledge — Claude Code by je měl číst před začátkem:

- `STAVAGENT_ClaudeCode_Session_Mantra.md` — session principles
- `CALCULATOR_PHILOSOPHY.md` — design principles for calculator
- `calculator_element_logic_v4_FINAL.md` — element logic
- `calculator_complete_pipeline.md` — pipeline overview
- `REBAR_NORMS_COMPREHENSIVE_AUDIT.md` — rebar ratios source of truth
- `SKRUZ_TERMINOLOGIE_KANONICKA.md` — terminology (skruž vs stojky for context)
- `rimsa_element_spec_v1.md` + `rimsa_element_spec_v2_DOKA_PERI.md` — current říms spec
- `formwork_catalog_PERI_DOKA_2025.md` — formwork catalog
- `STAVAGENT_PATTERNS.md` — 7 product patterns from Žihle

---

**Confidence level: 0.9** (high — validated against real DOKA nabídka 540045359 + tabulka výztuže SO 206)

**Author:** STAVAGENT calculator audit, 2026-05-20
