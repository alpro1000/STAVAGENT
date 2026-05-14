# Kalkulátor STAVAGENT — Kompletní pipeline + gap analysis

**Datum:** 2026-05-14
**Účel:** end-to-end vizе jak má kalkulátor fungovat + porovnání s reálným stavem + roadmap pro CSC (28.06.2026)
**Status:** strategický referenční dokument

---

# ČÁST 0 — TL;DR

**Existují 2 pipeline:**
- **A (Generativní):** TZ + výkresy → AI generuje soupis prací → resource calc
- **B (Resource calc):** Hotový soupis (XC4/Excel) → calc resources + harmonogram

**9 vrstev architektury:**
1. Input — 2. Extraction — 3. Classification — 4. Geometry — 5. Knowledge — 6. Engine — 7. AI Advisor — 8. Output — 9. Persistence

**Aktuální stav (po PR #1145 merge):**
- ✅ Funguje: 5 z 9 vrstev (60-80% pokrytí)
- ⚠️ Částečně: 2 vrstvy
- ❌ Chybí: 2 vrstvy (Geometry layer, AI Advisor layer)

**4 hlavní gaps pro CSC:**
1. Geometry Calculator nikdy nezadeployen (jen spec z 24.03.2026)
2. Knowledge integration — 50% v GCS bez čtenáře
3. Pipeline A (generativní) neexistuje
4. Multi-persona AI advisor nenavržen

**Čas do CSC:** 7 týdnů. **Realistický scope:** Pipeline B mature + Pipeline A demo prototype.

---

# ČÁST 1 — IDEAL: jak má kalkulátor fungovat

## 1.1 Dva pipeline — proč existují oba

### Pipeline A: Generativní (TZ + výkresy → soupis)

**Use case:** D&B tendry (Žihle), early-phase projekty, "klient přinesl TZ bez VV"

```
┌─────────────────────────────────────────────────────────────────┐
│ USER INPUT                                                       │
│ • TZ (PDF, text)                                                 │
│ • Výkresy (PDF, images)                                          │
│ • Geologické zprávy                                              │
│ • Statické výpočty                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ EXTRACTION LAYER                                                 │
│ • SmartExtractor (tz-text-extractor.ts) — text → params         │
│ • Vision (Vertex/Gemini) — drawings → dims                       │
│ • Cross-reconciliation TZ ↔ drawings (conflict resolution)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ AI SOUPIS GENERATOR (multi-persona)                              │
│ • Persona "rozpočtář" → OTSKP/URS codes, kompletnost dle ZZVZ   │
│ • Persona "stavbyvedoucí" → pomocné práce, sequence              │
│ • Persona "projektant" → TZ requirements, normy                  │
│ • Inputs: katalogy (OTSKP 17904, ÚRS 12K) + historical patterns  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ GENERATED SOUPIS PROPOSAL                                        │
│ 24 OTSKP položky pro SO 250 (vč. metadata: confidence, source)   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                  Pipeline B (resource calc) ──┐
                                                │
                                                ▼
                                     Final soupis + harmonogram
```

### Pipeline B: Resource calc (soupis → resources)

**Use case:** Veřejné zakázky (ŘSD, ŘVC), tender response, "máme VV z tendru"

```
┌─────────────────────────────────────────────────────────────────┐
│ USER INPUT                                                       │
│ • XC4 / Excel soupis (z tendru)                                  │
│ • Doplňky: TZ, výkresy, geologie (kontextové, ne required)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ VV PARSER                                                        │
│ • XC4 XML parser (ASPE Esticon)                                  │
│ • Excel parser (KROS, RTS variants)                              │
│ • Extract: položka_id, OTSKP_kod, název, množství, MJ, varianta  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLASSIFICATION LAYER                                             │
│ • OTSKP code → element_type lookup                              │
│ • Context disambiguation (e.g. zárubní vs piliř)                │
│ • Catalog routing per project_type:                              │
│   - veřejná → OTSKP primary                                      │
│   - privátní → URS primary                                       │
│   - D&B → oba                                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ GEOMETRY CALCULATOR (per pozice nebo per SO)                     │
│ • Parent type (most/zeď/pilíř/halа)                              │
│ • Sub-elements (základ/dřík/římsa/...)                           │
│ • Shapes (box/wall/octagon/circle/...) + dims                    │
│ • V, F, h per sub-element                                        │
│ • Knowledge lookup: TKP18, ČSN, učebnice mostů                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ ENGINE LAYER (planner-orchestrator.ts)                           │
│ • Resources: crew, equipment, hours/manday                       │
│ • Schedule: záběry, sequence, dilatace, technologické pauzy      │
│ • Bednění: system selection (PERI/DOKA), area, productivity      │
│ • Výztuž: rate kg/m³, profil, schedule per element               │
│ • Cost: labor + rental + materials + VRN                         │
│ • Sanity checks + warnings                                       │
│ • Monte Carlo simulation (PERT optimistic/most/pessimistic)      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT LAYER                                                     │
│ • Per element: V, F, h, durations, costs                         │
│ • Aggregated: total cost, schedule, gantt                        │
│ • Audit trail: formula + inputs + steps + confidence             │
│ • Doporučení (recommendations)                                   │
│ • Warnings (P0/P1/P2)                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ PERSISTENCE LAYER (project.json)                                 │
│ • Save state                                                     │
│ • Versioning                                                     │
│ • Compare diff between versions                                  │
│ • Export: XC4, Excel, PDF (krycí list, soupis, gantt)            │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 Devět vrstev architektury — detail

### Vrstva 1: Input

**Co přijímá:**
- TZ (PDF, text, OCR'd image)
- Výkresy (PDF page, image, BIM model future)
- Geologické zprávy
- Statické výpočty
- Hotový soupis (XC4 / Excel)
- Project context (project_id, account_id, ŘSD/private)
- User parameters (sezóna, termín, ceny override)

**Validace:** file type, size, language detection (CZ/SK/DE).

### Vrstva 2: Extraction

**Komponenty:**
- `tz-text-extractor.ts` (604 LOC, regex + keyword + heuristic)
- `vv-parser` (XC4 XML, Excel formats)
- `vision-extractor` (future — Vertex/Gemini Vision pro výkresy)

**Output:** `ExtractedParam[]` se schema `{value, source, confidence, alternatives, raw_match}`

**Source enum:** `'regex' | 'keyword' | 'heuristic' | 'smeta_line' | 'drawing' (future)`

**Conflict reconciliation:** drawing wins default přes TZ.

### Vrstva 3: Classification

**Co dělá:**
- OTSKP code → element_type mapping (z otskp.db, 17904 entries)
- TZ context → element_type detection (keyword scoring)
- Catalog routing per project_type (veřejná=OTSKP, privát=URS, D&B=oba)
- Disambiguation rules pro ambiguous cases (zárubní vs pilíř, římsa vs operne_zdi)

**Output:** `{element_type, confidence, source, alternatives, catalog_routing}`

**Element types:** 23 (per STAVAGENT_Complete_Element_Catalog)

### Vrstva 4: Geometry

**Co dělá:**
- Parent type selection (most/zeď/pilíř/halа/propustek)
- Sub-element decomposition (per parent type)
- Shape selection (7 forms: box/wall/truncated_pyramid/octagon_prism/circle_prism/triangular_wall/trapezoidal_wall)
- Dimension input (with knowledge lookup pro typical ranges)
- Formula application: V, F, h
- Multi-count multiplication (count × volume_single)
- Formwork-set calculation (H > 5.4m → ceil(H/5.4) sad)
- Knowledge integration: lookup TKP18 tolerance, ČSN normy

**Output:** `GeometryResult{sub_elements[], total_volume, total_formwork_area, warnings[]}`

### Vrstva 5: Knowledge integration

**Sources (5-layer KB):**

| Vrstva | Co tam je | Aktuální stav |
|--------|-----------|---------------|
| **L1 Core universal** | ČSN EN 1992, ČSN EN 13670 | ✓ Hardcoded v engine |
| **L2 Composition rules** | Pour sequence per element, dilatace | ✓ Hardcoded v engine |
| **L3 Regional** | CZ.yaml, SK.yaml, DE.yaml defaults | ✓ Per-region |
| **L4 Empirical** | Historical projects patterns | ❌ Žádná data (potřeba 5-10 projektů) |
| **L5 AI fallback** | Vertex/Bedrock/Perplexity RAG nad učebnicí | ⚠️ Konfigurováno není integrováno |

**Co se má integrovat (top-5 pro CSC):**

| Dokument | Kde leží | Use case |
|----------|----------|----------|
| TKP18 maturity tables | GCS bucket | Engine maturity calc upgrade |
| Učebnice mostů (pour sequences) | GCS bucket | Element-specific decisions |
| DOKA Frami parameters | catalog file | Formwork productivity refinement |
| DIN 18218 lateral pressure | GCS bucket | Pour rate optimization |
| ÚRS 201801 + OTSKP 2026.02 | DB files | Soupis generator (Pipeline A) |

### Vrstva 6: Engine (core calculation)

**Komponenty (per memory v4.24):**
- `planner-orchestrator.ts` — main entry
- `pour-decision.ts` — pour sequence, pump selection, MEGA pour logic
- `formwork-selector.ts` — system selection (25+ PERI/DOKA systems)
- `rebar-engine.ts` — výztuž rates per element type
- `maturity-calculator.ts` — zrání betonu per ČSN EN 13670
- `cost-aggregator.ts` — labor + rental + materials + VRN
- `gantt-builder.ts` — schedule visualization

**Výpočty:**
- Resources (crew composition, equipment count)
- Schedule (záběry, dilatace, technologické pauzy, zimní okno)
- Cost (3-phase: 1. záběr, střední, poslední — for rotation savings)
- Sanity checks (warnings P0/P1/P2)
- Monte Carlo PERT (optimistic / most likely / pessimistic)

### Vrstva 7: AI Advisor (multi-persona triangulation)

**3 personas:**

| Persona | Co vidí | Co přidává |
|---------|---------|-----------|
| **Rozpočtář** | OTSKP codes, množství, ceny | Krycí list, VRN, ZS, kompletnost dle ZZVZ |
| **Stavbyvedoucí** | Pour sequence, harmonogram | Pomocné práce, doprava, mezisklad, lešení, šablony |
| **Projektant** | TZ requirements, normy | Doplňky: izolace, dilatace, kotvy, ošetření |

**Triangulace:** každá persona vrátí návrh, merger sloučí (s priority pravidly).

**Aktuální stav:** **nenavržen.** Pouze single-shot AI prompts existují.

### Vrstva 8: Output

**Co se vrací:**
- Per element: V, F, h, durations, costs, audit_trail
- Aggregated: total_cost, total_schedule, full_gantt
- Soupis (pokud Pipeline A): generated položky s OTSKP/URS codes
- Warnings: P0/P1/P2 with recovery suggestions
- Doporučení: optimalizace, alternativy
- Export: PDF, XLSX, XC4, JSON

**Audit trail (povinný per Žihle pravidlo):**
```json
{
  "value": 132.2,
  "unit": "days",
  "formula": "max(sequence_a, sequence_b) where sequence_a = ...",
  "inputs": {...},
  "steps": [...],
  "confidence": 0.95,
  "sources": ["TKP18 §7.8.3", "Frami Xlife catalog", "ČSN EN 13670 Tab. NA.2"]
}
```

### Vrstva 9: Persistence

**Co se ukládá:**
- `project.json` (centrum znalostí, per memory)
- Versioning (history of edits)
- Diff between versions
- User decisions (override defaults, conflict resolutions)

**Export formats:**
- XC4 (zpět do ASPE Esticon)
- Excel (KROS/RTS compatible)
- PDF (krycí list, soupis, gantt, audit trail)
- JSON (API)

---

# ČÁST 2 — REAL: co máme dnes

## 2.1 Status per vrstva

| Vrstva | Komponent | Status | Coverage | Pozn. |
|--------|-----------|--------|----------|-------|
| **1. Input** | File upload UI | ✅ | 80% | Excel/PDF/text. Chybí: BIM, multi-file upload |
| **2. Extraction** | `tz-text-extractor.ts` | ⚠️ | **0%** na ŘSD TZ | PR #1143 specifikuje 3 fixes |
| **2. Extraction** | XC4 parser | ✅ | 100% | Funguje (testovali na SO-250) |
| **2. Extraction** | Excel parser | ⚠️ | 85% | KROS OK, RTS edge cases |
| **2. Extraction** | Vision | ❌ | 0% | Spec exists, never built |
| **3. Classification** | OTSKP code lookup | ✅ | 100% | otskp.db 17904 entries |
| **3. Classification** | TZ context classifier | ⚠️ | 70% | Po PR #1145: SO-250 keywords fixed; standalone phrases ještě failující |
| **3. Classification** | Catalog routing | ⚠️ | 60% | OTSKP routing OK, URS limited (sandbox blocked) |
| **4. Geometry** | Geometry Calculator UI | ❌ | **0%** | Spec z 24.03.2026, **NEVER DEPLOYED** |
| **4. Geometry** | Geometry backend service | ❌ | 0% | Spec exists, never built |
| **4. Geometry** | Flat UI inputs (D/Š/V) | ⚠️ | 50% | Funguje ale per-pozice silo (nyní) |
| **5. Knowledge** | L1-L3 hardcoded | ✅ | 80% | ČSN/TKP18/regional defaults |
| **5. Knowledge** | L4 empirical | ❌ | 0% | Žádná data (potřeba 5-10 projektů) |
| **5. Knowledge** | L5 AI RAG | ❌ | 0% | GCS bucket existuje, calc nečte |
| **6. Engine** | `planner-orchestrator.ts` | ✅ | 90% | Po PR #1145 fixed 3 P0 |
| **6. Engine** | `pour-decision.ts` | ✅ | 85% | Po PR #1145 length-aware estimate |
| **6. Engine** | `formwork-selector.ts` | ✅ | 90% | 25+ PERI/DOKA systems |
| **6. Engine** | `rebar-engine.ts` | ⚠️ | 75% | Defaults někdy off (per SO-250 test: 70 vs 80 kg/m³) |
| **6. Engine** | `maturity-calculator.ts` | ✅ | 95% | Funguje per ČSN EN 13670 |
| **6. Engine** | `gantt-builder.ts` | ✅ | 80% | Funguje, P1 polish needed |
| **7. AI Advisor** | Single-shot AI prompts | ⚠️ | 30% | "AI doporučení" button existuje, není multi-persona |
| **7. AI Advisor** | Multi-persona triangulation | ❌ | 0% | Nenavržen |
| **8. Output** | Per-element results | ✅ | 90% | Funguje |
| **8. Output** | Audit trail | ⚠️ | 60% | Decision log existuje, není structured |
| **8. Output** | Soupis export (Pipeline A) | ❌ | 0% | Pipeline A neexistuje |
| **8. Output** | XLSX/PDF export | ⚠️ | 50% | Excel works, PDF limited |
| **9. Persistence** | `project.json` | ✅ | 90% | Funguje |
| **9. Persistence** | Versioning + diff | ⚠️ | 40% | Save works, diff weak |

**Celkový status:**
- ✅ Funguje (90%+): **9 komponent**
- ⚠️ Částečně (40-85%): **11 komponent**
- ❌ Nehotovo (0-30%): **8 komponent**

## 2.2 Co reálně funguje pro SO-250 (po PR #1145)

**Pipeline B path (resource calc):**
1. ✅ User uploads XC4 → parser extracts 24 položky
2. ✅ Per pozice: OTSKP code → classification (after PR #1145 zaklady_oper correct)
3. ⚠️ Manual geometry input (D/Š/V flat, no hierarchy) — UX broken
4. ⚠️ Knowledge lookups: hardcoded L1-L3, no L5 RAG
5. ✅ Engine: planner-orchestrator runs (132d / 1M Kč realistic)
6. ⚠️ AI Advisor: single-shot, no triangulation
7. ✅ Output: results displayed, audit trail in decision log
8. ✅ Persistence: project.json saved

**Workflow per pozice (broken pattern):**
```
Open POZICE 7 → manual entry → calc → close
Open POZICE 8 → manual entry → calc → close
...
[6× open/close pro 1 SO]
```

**Co user musí dělat ručně (mělo by být auto):**
- Volat 4 sub-elementy zvlášť (podkladní + základ + dřík + římsa)
- Re-zadávat společné dims pro každou pozici
- Reconciliation TZ ↔ výkres (manual lookup)
- Element type ověření (po classifier auto-suggest)
- Plocha bednění výpočet (pokud chce override)

---

# ČÁST 3 — GAP ANALYSIS

## 3.1 Severity matrix

| Gap | Severity | CSC impact | Effort to close |
|-----|----------|------------|-----------------|
| Geometry Calculator not deployed | 🔴 P0 | High (UX wow) | 4-6 dní (existing spec) |
| Knowledge L5 RAG disconnected | 🟡 P1 | High (differentiator) | 3-5 dní |
| SmartExtractor 0% na ŘSD TZ | 🟡 P1 | Medium (Pipeline A enabler) | 2.5 dní (PR #1143 fixes) |
| Pipeline A (soupis generator) | 🟡 P1 | High (CSC wow) | 5-7 dní |
| Multi-persona AI Advisor | 🟡 P2 | Medium (story) | 3-4 dní |
| Knowledge L4 empirical | 🟢 P3 | Low (needs data) | DEFER (need 5-10 projects) |
| Vision MCP (drawings) | 🟢 P3 | Low (CSC nice-to-have) | DEFER 7+ dní |
| Versioning + diff | 🟢 P3 | Low (production polish) | DEFER 2 dní |
| BIM input | 🟢 P3 | Low (future) | DEFER 14+ dní |

## 3.2 Co je broken (po PR #1145)

**Calculator (Pipeline B):**
- ⚠️ Per-pozice silo workflow (6× open/close) — UX broken
- ⚠️ Geometry inputs flat (no hierarchy) — confusing
- ⚠️ Duplicate "Výška" fields (D7 vs E1) — confusing
- ⚠️ Manual override no undo — frustrating
- ⚠️ Smart defaults dead code (helpers.ts not wired) — silent
- ⚠️ Orphaned UI fields (use_retarder, concrete_consistency)

**Extractor:**
- ⚠️ 0% coverage na ŘSD TZ (PR #1143 spec'd but not applied)
- ⚠️ Silent mis-attribution (0.85 m → wrong field)
- ⚠️ No drawing source enum

**Knowledge:**
- ⚠️ Učebnice mostů v GCS bez čtenáře
- ⚠️ TKP18 maturity tables → hardcoded, not lookup
- ⚠️ DOKA/PERI catalogs partial integration

## 3.3 Co chybí úplně

**Pipeline A:**
- AI Soupis Generator (s OTSKP/URS routing)
- Multi-persona prompt engineering
- Soupis proposal review UI

**Geometry Calculator:**
- Parent → sub-element → shape hierarchy
- 7-shape formula engine (frontend + backend)
- "Načíst z TZ" button (SmartExtractor integration)
- Result box (all sub-elements aggregated)

**AI Advisor:**
- Triangulation 3 personas
- Source citation per recommendation
- Confidence ladder applied

**Output:**
- PDF report (krycí list dle ZZVZ)
- XC4 export (zpět do ASPE Esticon)
- Multi-language (CZ/EN/DE pro CSC)

---

# ČÁST 4 — CSC roadmap (7 týdnů do 28.06.2026)

## Týden 1 (15-21.05) — Calculator stabilizace ✓ AKTUÁLNÍ

- ✅ PR #1145 merged (3 P0 fixes)
- 🔧 Smoke test production po merge
- 🔧 POZICE 8-16 element test na fixed calculator
- 🔧 Geometry Calculator status check (B option)

## Týden 2 (22-28.05) — Knowledge inventory + Geometry deploy

- 📋 Knowledge integration audit (A option, 1 den)
- 🚀 Geometry Calculator deployment:
  - Backend: `geometry_calculator.py` service + routes
  - Frontend: `GeometryModal.jsx` + sub-components
  - Wire button "📐 Geometrie" v PositionTable
  - Add wall catalog extension (operne_zdi / zarubni_zed)
  - Acceptance: SO-250 base entered via Geometry → 837 m³ output
- 🔧 PR #1143 extractor fixes apply (3 fixes from #1143 spec)

## Týden 3 (29.05-04.06) — Top-5 knowledge integration

- TKP18 maturity tables → engine lookup
- Učebnice mostů pour sequences → pour-decision input
- DOKA Frami refined parameters
- DIN 18218 lateral pressure tables
- ÚRS+OTSKP catalog routing per project_type

**Output:** AI doporučení citující reálné dokumenty místo hardcoded values.

## Týden 4 (05-11.06) — Pipeline A demo build

- AI Soupis Generator service
- Multi-persona prompt (3 personas triangulation)
- Soupis proposal review UI
- End-to-end: SO-250 TZ → generated 15-20 položky → reálná coverage 60-70%

**Output:** demo "Vidíte — AI navrhl, my zkontrolovali."

## Týden 5 (12-18.06) — End-to-end testing

- SO-250 full pipeline (TZ → soupis → resources)
- Žihle full pipeline retest
- Libuše full pipeline retest
- Bug bash
- 3-persona AI advisor verification

## Týden 6 (19-25.06) — Pitch deck + demo video

- Slide deck EN (10-15 slides):
  - Problem (CZ rozpočtář pain)
  - Solution (2 pipelines)
  - Differentiator (knowledge-cited AI)
  - Demo screenshots
  - Traction (Žihle/Libuše/SO-250)
  - Ask (CEMEX partnership + Helsinki Pitch Day)
- 60s demo video
- Custom GPT v store
- MCP Claude Directory submission

## Týden 7 (26-28.06) — Submission

- Buffer pro fixes
- CEMEX CSC 2026 submission (deadline 28.06.2026)

## Co NETOLERUJEME pro CSC (defer post-CSC)

- ❌ Full RAG infrastructure (Option B knowledge — too much)
- ❌ VZ Scraper revival (paid license needed)
- ❌ Multi-element classifier per-document
- ❌ Vision MCP / formula parser (deferred from Variant B v2)
- ❌ BIM input
- ❌ L4 empirical layer (needs 5-10 projects)

---

# ČÁST 5 — Critical path checklist pro CSC

## Minimum viable demo (must-have)

- [ ] PR #1145 merged → production calculator green
- [ ] PR #1143 extractor 3 fixes applied
- [ ] Geometry Calculator deployed + wired to UI
- [ ] Top-5 knowledge sources connected to calc
- [ ] SmartExtractor coverage ≥ 70% na ŘSD TZ (after fixes)
- [ ] Pipeline B end-to-end na SO-250 (24 položky → resources + harmonogram)
- [ ] AI Advisor s alespoň "rozpočtář" persona functional
- [ ] PDF export krycí list dle ZZVZ
- [ ] Multi-language EN strings v demo UI

## Wow differentiator (should-have)

- [ ] Pipeline A demo: SO-250 TZ → AI soupis proposal
- [ ] 3-persona AI Advisor (rozpočtář + stavbyvedoucí + projektant)
- [ ] Knowledge citation per recommendation
- [ ] Sanity warning education ("Není to omylem celková plocha?")
- [ ] Comparison view: AI-generated vs reálný XC4 soupis

## Nice-to-have (if time)

- [ ] Vision Vertex pro výkresy
- [ ] Multi-SO project view (D6 = SO-201 + SO-250 + SO-202 dohromady)
- [ ] Crew capacity planning across SOs

---

# ČÁST 6 — Risk assessment

## High risk

**1. Geometry Calculator deploy nezvládneme za týden 2**
- Spec z 24.03 je 4-6 dní effort
- Existing JSX file: nutno zkontrolovat zda kompiluje s aktuálním React/Tailwind verzi
- Backend integration: resource_calculator.py accept geometry_data parameter
- Mitigation: Týden 2 = strict deadline. Pokud blok → CSC scope cut na Pipeline B only.

**2. PR #1143 extractor fixes nezvládnou pokrýt všechny TZ types**
- 0% baseline → 70% target = velký skok
- ŘSD TZ má specifickou strukturu, jiné projekty jinou
- Mitigation: target = 70% NA ŘSD typu, ne universal. Demo používá SO-250 (ŘSD).

## Medium risk

**3. Pipeline A AI generator nebude reliable**
- Multi-persona triangulation je nový workflow
- AI může halucinovat OTSKP codes
- Mitigation: position generator jako "návrh" ne "final". User vždy schvaluje. Pro CSC stačí demo coverage 60-70%.

**4. Knowledge L5 RAG má latence > acceptable**
- Vertex AI Vector Search může mít 2-3s latence per query
- Calculator UI očekává < 500ms response
- Mitigation: pre-compute critical lookups (TKP18 tables) jako static JSON. AI RAG jen pro complex queries (učebnice mostů).

## Low risk

**5. CSC committee má jiné priority než my expect**
- Naše differentiator (knowledge-cited AI) může být překryt jinými critères
- Mitigation: read CSC 2026 criteria, align messaging.

---

# ČÁST 7 — Acceptance criteria pro každou fázi

## Fáze 1: Calculator stabilization (Týden 1) — AKTUÁLNÍ

- [x] 3 P0 bugs fixed (#5/#6, #1, #7)
- [x] 1100/1100 tests pass
- [x] PR #1145 ready for review
- [ ] PR #1145 merged to main
- [ ] Production smoke test OK
- [ ] Element-by-element test POZICE 8-16 documented

## Fáze 2: Geometry + Knowledge audit (Týden 2)

- [ ] Geometry Calculator: SO-250 input via hierarchy → 4 sub-elementy correct
- [ ] Geometry: H > 5.4m warning shown
- [ ] Geometry: počet kusů multiplies correctly
- [ ] Knowledge audit doc committed v `docs/audits/`
- [ ] Top-5 integrations identified s effort estimates

## Fáze 3: Knowledge integration (Týden 3)

- [ ] TKP18 maturity tables → engine reads from JSON not hardcoded
- [ ] Učebnice mostů pour sequences → pour-decision reference
- [ ] DOKA Frami parameters refined
- [ ] AI doporučení cites source (e.g. "Per TKP18 §7.8.3")
- [ ] OTSKP+URS routing per project_type works

## Fáze 4: Pipeline A demo (Týden 4)

- [ ] Multi-persona AI prompt schema designed
- [ ] AI Soupis Generator service runs
- [ ] SO-250 TZ → AI generates 15-20 položky
- [ ] Coverage vs reálný XC4 soupis ≥ 60%
- [ ] Audit trail per generated položka

## Fáze 5: E2E testing (Týden 5)

- [ ] SO-250 full pipeline runs without manual intervention
- [ ] Žihle full pipeline retest passes
- [ ] Libuše full pipeline retest passes
- [ ] All P0 bugs fixed
- [ ] Bug count ≤ 5 P1

## Fáze 6: Pitch (Týden 6)

- [ ] Pitch deck EN approved
- [ ] 60s demo video recorded
- [ ] Custom GPT submitted
- [ ] MCP Claude Directory entry submitted

## Fáze 7: Submission (Týden 7)

- [ ] CSC 2026 form completed
- [ ] All artifacts uploaded
- [ ] Submission confirmed

---

# Appendix A — Reference dokumenty

- **Master brief:** `STAVAGENT_Master_Brief.md`
- **Element catalog:** `STAVAGENT_Complete_Element_Catalog.md`
- **Calculator philosophy:** `CALCULATOR_PHILOSOPHY.md`
- **Geometry Calculator spec:** `CODEX_TASK_GEOMETRY_CALCULATOR.md` (24.03.2026)
- **Geometry Calculator JSX:** `GeometryCalculator.jsx` (24.03.2026)
- **REBAR norms audit:** `REBAR_NORMS_COMPREHENSIVE_AUDIT.md`
- **Formwork catalog:** `formwork_catalog_PERI_DOKA_2025.md`
- **SmartExtractor findings:** `FINDINGS_SmartExtractor_2026-05-10.md`
- **SO-250 golden test:** `test-data/SO_250/tz/SO-250.md`
- **SO-250 element test log:** `SO250_element_test_log.md`
- **Calculator field audit:** `docs/audits/calculator_field_audit/2026-05-14_full_ui_walkthrough.md` (PR #1145)
- **SmartExtractor probe:** `docs/audits/smartextractor_so250/2026-05-14_extractor_coverage.md` (PR #1143)

---

**End of complete pipeline + gap analysis document.**

**Suggested commit path:** `docs/architecture/2026-05-14_CALCULATOR_COMPLETE_PIPELINE.md`
