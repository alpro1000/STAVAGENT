# STAVAGENT — Soul (Living Memory)

> **Účel dokumentu:** Continuity memory mezi sessions. Tento soubor je **dopis od minulých sessions budoucím sessions**.
>
> **Read at start of every Claude session.** Online (claude.ai) přes Project Knowledge. Doma (Claude Code) přes Git pull.
>
> **Update na konci každé významné session** — viz `docs/steering/conventions.md` §11.3.
>
> **Verze:** Initialized 19.05.2026

---

## 1. Founder context

**Alexander Prokopov.** Solo founder STAVAGENT.

- **Day job:** přípravář/rozpočtář v Berger Bohemia (Bridge & Railway Division, Plzeň)
- **Evenings/weekends:** STAVAGENT
- **Languages:** Russian (native, communication), Czech (domain expertise, codebase terminology), English (code, technical writing)
- **Personality:** Decisive, action-oriented, override scope reductions, ALL CAPS = frustration signal

---

## 2. Current state snapshot (19.05.2026)

### 2.1 Production

- **v4.24** в продакшне (PR #983 deployed)
- **Gate 1** PR #1058 merged (29.04.2026)
- **Gate 2** PR #1064 merged (15 commits, branch `gate-2-element-classification`). Tests 1002 → 1036. Element types 22 → 23 (zaklady_oper added).
- **MCP v1.0** live с биллингом
- **3,693+** commits, 500+ deployments
- **$5,000** Perplexity credit aktivní

### 2.2 Active critical work

- **P0 BLOCKER před Cemex demo:** Cross-user data isolation. Nový users vidí všechny projekty v Monolit-Planner a Registru. Potential GDPR exposure. Musí se vyřešit před jakýmkoliv public marketing nebo Cemex demo.
- **Cemex CSC 2026 submission deadline:** 28.06.2026 — primary competition target
- **Realistic pitch day target:** Helsinki 16-19.11.2026

### 2.3 Active freelance

- **Libuše objekt D** (VELTON, akce 185-01) — branch `claude/libuse-delivery-continue-GEBr5`, 11 commits ahead. Phase 7a Part 2 + Phase 8 pending. Deadline 11.05 (passed) — uzavřít. Test data: `test-data/libuse/`.
- **hk212_hala** (Hradec Králové, SOLAR DISPOREC) — Phase 1 Etapa 1 complete, 141 items, 29.8% URS match (catalog vintage gap). Phase 2.1 audit trail extraction. Test data: `test-data/hk212_hala/`.
- **Žihle 2062-1** — pilot COMPLETE, 154 položek, 10.59M Kč. Phase E dropped (ADR-005). 7 product patterns documented. Test data: `test-data/most-2062-1-zihle/`.
- **RD Jáchymov dům** — N=5 corpus case COMPLETE (18.05.2026). Hybrid DSP/DPS (DPS-grade DXF в DSP-contracted). 189 items. Test data: `test-data/RD_Jachymov_dum/` (PR #1177 Phase 0b foundation). Path C: 89% → 100% DXF coverage. Dual catalog discovered: URS201801 (39741) + TSKP (11994). Subdod v1.2. **9 corpus patterns** dokumentovány (viz §5.1).
- **SO-250 D6 Žalmanov** — SmartExtractor probe case. Test data: `test-data/SO_250/`.

### 2.4 Knowledge corpus sources (NE freelance, study material pro KB)

- **Litovel bridge** — vlastní diplomová práce, používaná jako study material pro bridge KB build-out v2 (TKP 4 + ČSN 73 6244 + VL 4 + Litovel case study). Test data: `test-data/most-litovel/`. Material se integruje do `app/knowledge_base/B7_regulations/` (TKP, ČSN, VL) a `B6_research_papers/` (case study). NE klient, NE deadline — open-ended KB enrichment.

**Shared assets v `test-data/`:**
- `kros_catalog.db` — KROS catalog SQLite (working copy, parallel to OTSKP DB)
- `STAVAGENT_Drawings_to_VV_Rozpocet_Playbook.md` — dataset-bound playbook (drawings → výkaz výměr → rozpočet)

---

## 3. Key architectural decisions (and why)

### 3.1 Vertex AI primary (ne Bedrock)

**Decision date:** ~03.2026
**Why:**
- EU data residency v `europe-west3`
- Google Cloud for Startups credits applied
- Gemini Flash extremely cheap pro classification volume
- Bedrock = fallback, ne primary

### 3.2 Render NEPOUŽÍVÁ

**Decision date:** ~01.2026
**Why:**
- Migrace na Cloud Run + Vercel completed
- Lepší integrace s GCS, Cloud SQL, Vertex
- Konsistentní stack

### 3.3 Stripe odstraněn

**Decision date:** Gate 2 (28.04.2026)
**Why:**
- Dead code, nikdy commercially activated
- Lemon Squeezy je production billing
- Mít Stripe v repu = confusing pro nového developera

### 3.4 Confidence scoring framework

**Why:**
- OTSKP lookup je deterministic (db.match) → 1.00
- Regex extraction je interpretable → 0.85-0.95
- AI návrh je probabilistic → 0.70
- Human override je intentional → 0.99
- Pravidlo "high doesn't get overwritten by low" — chrání kvalitu dat

### 3.5 Core ↔ Kiosks pattern

**Why:**
- Každý kiosk může být rebuilt nezávisle
- Core API je business logic, kiosky jsou rendering
- DACH/Spain expansion = nový kiosk + nová language layer, NE rewrite Core

### 3.6 Triple access (UI + MCP + API)

**Why это competitive moat:**
- AI agents need engineering ground truth
- Konkurenti (Aitenders, Togal) jsou single-mode (jen UI nebo jen API)
- STAVAGENT je agent-ready by design
- MCP server je live, Lemon Squeezy billing live

### 3.7 Deterministic-first principle

**Why:**
- LLMs halucinate engineering calc
- Regex + lookup tables + formula engines jsou auditovatelné
- AI fallback only kde deterministic je beмocný (free text → categories)
- Aligns s GDPR / EU AI Act (limited risk, transparent)

### 3.8 URS → "Unified Retrieval Service"

**Decision date:** Gate 2
**Why:**
- ÚRS Praha legal exposure
- Backend acronym `URS_MATCHER_SERVICE` is defensible as "Unified Retrieval Service"
- Public UI labels neutralized
- OTSKP (státní, free) is publicly OK

---

## 4. Construction domain insights (accumulated)

### 4.1 "Co je beton — to je harmonogram"

При тендерировании монолитных мостных конструкций výpočet betonu = критическая cesta. Vše ostatní paralelní/následuje. Tento insight definuje **proč** kalkulátor je strategický, ne nice-to-have.

### 4.2 Skruž vs stojky (often confused)

- Bridge element → vždy **skruž** (50-100+ ton, heavy shoring towers)
- Building → **stojky** (<50 kN, light props)
- Height >5m → skruž
- Load >50 kN → skruž

### 4.3 Spáry — dilatační vs pracovní

- **Dilatační** — permanent structural joint
- **Pracovní** — temporary construction joint
- **NEKONFUZIT**

### 4.4 OTSKP routing vs ÚRS

- **Veřejná zakázka (ZZVZ)** → OTSKP primary
- **Privátní (hk212, Libuše)** → ÚRS primary, OTSKP irrelevant
- **D&B (Žihle)** → ÚRS + OTSKP columns

### 4.5 Rebar h/t — opravená matice (v4.24)

| Element | Default | h/t (D12) |
|---|---|---|
| Walls | D12 | 17.3 |
| Slabs | D12 | 16.3 |
| Beams/Cols | D12 | 22.4 |
| Stairs | D12 | 20.4 |
| Stirrups D6-12 | — | 30 |

### 4.6 Pour crew formula v4.24 — co bylo opraveno

- Management (+3 řízení) **REMOVED** — patří do ZS/VRN 3-5% per ČSN 73 0212
- Volume-scaled crew sizing
- Night shift §116 ZP +10%
- MEGA formula: `n_pump×2 + ceil(n×1.5) + ceil(n×1.0)`

---

## 5. Корпусные находки (N=5 corpus patterns)

### 5.1 N=5 RD JÁCHYMOV (18.05.2026)

Hybrid DSP/DPS (DPS-grade DXF v DSP-contracted). 189 items, **9 corpus patterns:**

1. `file_swap` — vendor podstrčil jiný soubor než avizoval
2. `tz_validator_iter` — iterativní validace TZ
3. `multi_view_items` — totéž v různých výkresech
4. `_gate ≠ kapitola` — gates v workflow != kapitoly v TZ
5. `exhaustive_dxf_5tier` — DXF parsing 5-tier strategy
6. `embedded_table_mtext` — `^I` encoding v MTEXT
7. `honest_fallback` — superseded by #8
8. `completeness_audit_mandatory` — Phase 0a v CLAUDE.md
9. `iterative_layer_probe_gaps` — **ANTI-PATTERN** (neopakovat)

Path C: 89% → 100% DXF coverage. Dual catalog discovered: URS201801 (39741) + TSKP (11994). Subdod v1.2.

### 5.2 N=5 corpus aggregate

5 cases:
1. VP4 FORESTINA (operná zeď)
2. SO-202 D6 (most)
3. SO-250 D6 Žalmanov
4. Bytový soubor Libuše
5. SO-220 biokoridor (+ RD Jáchymov hybrid)

Confirms: BOQ structure identical across CZ/DE/AT/ES/FR — only catalog codes + norms + doc formats differ. **4-layer KB viable** (Core universal → Regional CZ/SK/DE.yaml → Empirical → AI fallback).

### 5.3 Libuše cross-objekt detection

Check 'z místnosti č.' a 'do místnosti č.' columns ve všech Tabulkách s multi-objekt scope. Prefix mapping: S.A.\* → A, S.B.\* → B, S.C.\* → C, S.D.\* → D. Regen chain order: phase_7a → phase_6 → phase_8 → phase_0_20.

### 5.4 PROBE findings (Libuše)

- **PROBE 14f** — 8 PSV-768 vrata items deprecated (belong to objekt C, ~130-230k Kč mis-attributed)
- **PROBE 14g** — List 11 regenerated (3,128 → 4,845 rows, 579 → 754 groups)

### 5.5 hk212 critical discovery

**VYJASNĚNÍ #17:** TZ claims 32 m³ výkopů vs DXF-calculated **~341.8 m³** (~130k Kč impact). Cross-document validation rule needed.

---

## 6. Key learnings (process / meta)

### 6.1 Claude Code task writing rule (CRITICAL)

> **Nikdy nespecifikuj jména proměnných, souborů, tříd nebo tabulek.**
>
> Popisuj CO se má stát v termínech business logiky + architektury.
> Claude Code odvodí naming z existujících repo konvencí.

Violation = parallel structure = naming spaghetti. Viz `docs/steering/conventions.md` §9.

### 6.2 Data corpus is the bottleneck, not math

Priority **collect 5-10 real projects** before applying advanced statistical methods:
- Bayesian updating (~50h) — skip until corpus
- Sensitivity analysis PERT (~25h) — skip until corpus
- PySR symbolic regression (~40h) — skip until corpus
- Neural nets, RL, quantum — **not worth it** at current data volume

### 6.3 Branch protection workflow

- Branch protection **stays enabled** на main
- GitHub Action `prerender.yml` blocked by `protect-main` ruleset
- **Correct workflow:**
  1. Lokálně `npm run build`
  2. Zkopírovat 4 HTML soubory z `dist/` do `public/prerendered/`
  3. Include in same PR as source changes

### 6.4 Když Claude Code timeout na large file

Split na sub-tasks <170 řádků nebo by gate (Gate 0 scan-only → Gate 1 format findings). Output findings as plain chat text as fallback.

### 6.5 Scope expansion pattern

Александр consistently overrides scope reduction recommendations. Claude names pattern explicitly each time before complying.

### 6.6a HK212 corpus patterns (consolidated 2026-05-22)

8 cross-cutting patterns destilované z HK212 Stage A→E (12 commits, ~30K LOC):

1. **"Re-read TZ before generating new položky"** — Phase 0b TZ extrakce se často zapomene v pozdějších stagech (Stage D/E item composition). Před JAKOUKOLIV mutací položky (popis, mnozstvi, source) re-check `inputs/dokumentace/TZ_*.pdf` + PBŘ. Symptom: generic placeholders ("~1500 Kč/m²", "TBD") místo TZ-derived specs (tl. 200mm MW, bílá+modrá, EW 15 DP1, EPDM podložka). Cure: TZ re-read jako mandatory step v Stage E checklist. Pattern 8 v `docs/STAVAGENT_PATTERNS.md`.

2. **"DSP-stage detail trap"** — DSP DXF s workshop-level detail (147 OKNO INSERTs, 28 vrata/dveře blocks, 141 structural_columns s serial čísly) ≠ dílenská. DXF razítka říkají DSP. Confidence stays in DSP range (0.85), NE DPS (0.95). HK212 dilenska → dsp_dxf rename housekeeping commit `b23fff07` reflects to.

3. **"Ghost razítko filter rule"** — Razítka kde `date > 2y older than DXF file mtime` AND akce mismatch (např. "DPS výroba" v DSP-stage DXF) = ghost razítka. DXF files jsou reusable templates (block libraries), staré razítka přežijí. Filter rule v Stage A.

4. **"Layer dictionary ratification gate"** — Auto-detect classifier (regex-based 70+ rules) + STOP gate at <50 % coverage. User confirmation BEFORE aggregation pro: ArchiCAD A-/S-/G-/C-* prefixes, Czech ad hoc names (PROFILY, NETISK, OZN-REZU), user_custom_numbered. HK212: 39.6 % → 100 % po 3 iteracích + Step 1.5 A-GENM dossier (Lindab + MEARIN reveal). Reference: `step1c_finalize_dictionary.py` + `dictionary_decisions.md`.

5. **"Annotate-before-mutate"** — Pro ceny (Stage E) + geometrie (Step 3 — area metrics). Add `_*_source` fields first (e.g. `_length_source`, `_geometric_source`, `_price_source: "user_skipped_pricing"`) → user review → potom mutation. Step 3 HK212: `items_hk212_etap1_with_geometry.json` separate file, original NEMODIFIKOVÁN. Cena = NEVER auto-mutate.

6. **"Profession scope-cut hygiene"** — Při dropování položek (Stage D drop 22 items = 15 VZT + 7 Rpol M-kapitola) log to `delta_report` / metadata.dropped_items s reason. Don't leave concept items hanging. Reason musí být citovaný (Phase 0b §5, D.1.4 missing, ABMV_12).

7. **"Long-session context decay"** — Sessions > 30K LOC outputs / > 8 commits → agent forgets Phase 0b data (TZ ARS DPZ details). Mandatory consolidation checkpoint at session end. Trigger: any PR exceeding 20K LOC modifications → run memory consolidation skill before close. HK212 Stage E forced TZ re-read = symptom of decay.

8. **"Block-name as pseudo-schedule"** — DXF block names carry product specs: `OKNO_1k 1000×1000`, `M_Vrata_sekční 3500×4000`, `Lindab Round 150/100 Antique White`, `MEA Mearin Plus3000 NW300`, `IPE450`, `C150×19_3`. Block names = primary source for material specs, NE TEXT/MTEXT entities (architects often skip ATTRIB fill — HK212 ATTRIB harvest = 0). Block-name pseudo-schedule parser zapsán jako separate task (P3 backlog).

### 6.6 Session structure (proven)

1. Drop task .md file into repo
2. Start Claude Code agent session with direct "read and execute" instruction
3. Audit task naming: `TASK_[DOMAIN]_[Scope].md`, nested under `docs/audit/` (now `docs/specs/`)

### 6.7 Decision style

- Quick decisions when options presented as numbered choices
- Sequential PRs preferred over parallel
- Russian primary, Czech terminology throughout codebase
- Voice-to-text artifacts common
- ALL CAPS = emphasis/frustration

---

## 7. External relationships (active)

### 7.1 Cemex CSC 2026

- **Deadline:** 28.06.2026 application
- **Pitch days:** APAC 02.09.2026 (Singapore), Top 30 announce 01.10.2026, Las Vegas 09-11.11, Helsinki 16-19.11
- **Target:** Helsinki (realistic, European pitch day)
- **Partners to watch:** Ferrovial, VINCI Leonard, Hilti (DACH formwork), Trimble (BIM)

### 7.2 Alice Technologies

- **Status:** Outreach к René Morkos drafted, ne sent yet
- **Strategy:** Complementary, ne competitive. STAVAGENT generates engineering inputs, Alice optimizes schedules across them.
- **Outcome regardless:** Strategic partnership v conversation slide v pitch deck

### 7.3 Google for Startups Cloud

- **Status:** Application submitted via postmaster@stavagent.cz (2026-05-13)
- **Waiting:** 3-5 business days response
- **Credits target:** Billing Account `01587B-BEBC6E-418C29`
- **Active constraint during review:** Don't touch production stavagent.cz, don't modify LinkedIn, check postmaster@ daily

### 7.4 VELTON (Libuše freelance)

- Confidentiality strict — VELTON name never mentioned externally
- Libuše geometry used as engine calibration only
- 4,090 items, 13 sheets, akce 185-01

### 7.5 Berger Bohemia (current employer)

- Personal-time disclaimer obligatorní na /team a v LinkedIn About
- Berger not mentioned by name on landing
- If asked: "tool for my own daily problem, personal time, no company resources"

---

## 8. Strategic context (ne lehkomyslně měnit)

### 8.1 International brand

- `stavagent.cz` = Czech/SK wedge brand
- International brand needed for DACH/EU expansion (separate registration)
- Candidates: PourPlan / TaktCast / MonoPlan / TBD
- **Insight:** DIN 18218 already canonical → DACH expansion = catalog + language, NOT engine rewrite

### 8.2 Pitch reframe (W3 deliverable)

**Old pitch:** "AI co-pilot for Czech construction estimators"
**New pitch:** "Engineering calculation layer for construction with triple access (UI / MCP / Agent API). DIN 18218, Saul, RCPSP. Konkurenti dělají document parsing (Aitenders), takeoff (Togal), scheduling optimization (Alice) — žádný nedělá engineering calculations."

### 8.3 EU AI Act compliance

- Risk classification: **Limited risk** (transparency only)
- NOT v Annex III high-risk categories
- STAVAGENT = **deployer of GPAI** (Vertex/Bedrock/Perplexity), NE provider
- TODO до konce května: transparency banner v UI, privacy policy update, AI literacy doc, human-in-the-loop, DPAs

---

## 9. Session log


## 2026-06-04 — Session: SSOT MCP delegate — Phase 2a (calculate) shipped, classify deferred

**Rozhodnuto:**
- **`calculate_concrete_works` (MCP) DELEGUJE na canonical engine** — POST `/api/calculate`
  (Phase 1 thin wrapper nad `planElement`, už v mainu `398b628`). Tool teď mapuje MCP
  argumenty → `PlannerInput`, forwarduje **PlannerOutput verbatim + `source:"monolit_planner_api"`**,
  žádný divergentní Python přepočet. Klíčová oprava SSOT: mostovková deska `rebar_ratio_kg_m3`
  = **150** (ne starých Python `180`).
- **Retired divergentní Python calc** v `calculator.py`: `_lateral_pressure` / `_select_formwork`
  / `_calculate_tacts` / `_estimate_days` / `CURING_DAYS_TABLE` / `EXPOSURE_MIN_CURING` /
  `_try_monolit_api` + ELEMENT_TYPES-fallback. Zůstal jen read-only formwork-override **warning**
  surface (KNOWN_FORMWORK_SYSTEMS — „T-bednění pro základ" hint), mergovaný do engine `warnings[]`.
  `calculate_pump` (TOV) netknutý.
- **Nový seam `app/mcp/tools/monolit_delegate.py`** — jediné místo, kde MCP sahá na engine.
  Vlastní fail-mode kontrakt: 200 → verbatim · 4xx → `engine_invalid_input` (bez retry) ·
  5xx → `engine_error` (1 retry) · timeout/conn → `engine_unavailable` (retry, cold-start budget).
  Nikdy tiché číslo. Monkeypatch-able `_http_post` (per MCP authoring rule — žádný Callable v signature).
- **MCP-only typy** `zdivo_obklad`/`izolacni_stena`/`sachta`/`tunel_rampa` (nejsou v engine
  `StructuralElementType` union) → explicitní `unsupported_element_type` BEZ volání enginu.
  Soft-alias mapa pro `deska→stropni_deska`, `operna_zed→operne_zdi`, `pricinik→rigel`,
  `zaklady→zakladovy_pas`, `jine→other`.
- **Testy:** nový `test_mcp_ssot_delegation.py` (verbatim forward + fail-mode + unsupported,
  16/16); reconciled `test_mcp_compatibility.py` (6 calculator testů) + `test_mcp_golden_so202.py`
  (8 calculate pravidel) + `test_thin_hybrid_recipe.py` na **PlannerOutput shape**. Engine se
  injektuje přes `conftest.py::calculate_replay` — offline replay zachycený z **živého enginu**
  (`replay_calculate.json`, keyed canonical-payload, number-normalized kvůli fastmcp float coercion).
  Jest anchor `engine.parity.test.js` (18/18): endpoint===planElement pro parity-set + rebar-150
  anchor + SO-202 domain (curing≥9, pile≥80, prestress≥11, fixed_scaffolding override). Lokálně
  zelené: ssot_delegation 16 · compat calc/clf/golden/recipe 65 · jest 18.
- **SO-202 golden audit:** 7/9 pravidel přežije delegaci beze změny intentu (engine je splňuje,
  jen v jiných polích). R8 = jediná doménová odchylka: engine auto-doporučuje **MSS** pro 6×20 m
  (≥4 pole), TZ §7.2 chtělo pevnou skruž → golden teď posílá `construction_technology=
  'fixed_scaffolding'` explicitně (engine override ctí). `curing_class` engine nevystavuje →
  assert padl na `formwork.curing_days` (substantivní hodnotu).

**Odmítnuto / odloženo (Phase 2b):**
- **classify-delegace VYŇATA z této fáze** (rozhodnutí Alexandra, var. D). Důvod: W3 SO-250
  klasifikátor má **divergentní type-vocabulary** (`operna_zed` vs engine `operne_zdi`, prostý
  `zaklady`, MCP-only `zdivo_obklad`) + head-noun dizambiguaci (`obklad` ne „do dříku", NK ne
  „trám", dřík stěny ≠ dřík pilíře), kterou canonical engine NEreprodukuje. Sverочná tabulka:
  **7/9 SO-250 goldenů by se rozbilo** (dřík stěny→driky_piliru, obklad→driky_piliru, základ→other).
  `classifier.py` vrácen na W3 origin; `breakdown.py`/`advisor.py` netknuté (zůstávají Python).
- breakdown C1 (množství z `/api/calculate`) + advisor inline-Python retire → Phase 2b
  (závisí na classify-delegaci).

**Otevřené otázky:**
- Phase 2b: buď engine absorbuje W3 normalizaci (head-noun + `operne_zdi`/`zaklady_oper`
  mapping + cladding handling) PŘED tím, než classify deleguje, NEBO hybrid (W3 Python
  pre-layer autoritativní pro svou nomenklaturu + engine pro paritní typy/čísla).

**Co dál:**
- Push Phase 2a na `claude/wonderful-albattani-eO5aY` (čistý commit, bez PR dokud Alexandr neřekne).
- Phase 2b: classify reconciliation (W3 vs engine vocabulary), pak breakdown C1 + advisor.


## 2026-06-03 — Session: Resource Ceiling Phase 2 Group A — recon + dovedení odložené větve do PR #1300

**Rozhodnuto:**
- **#1300 Resource Ceiling Phase 2 Group A smergeováno do main** (squash `8d92c012`). 6 pozemních
  vodorovných typů (`podkladni_beton`, `pruvlak`, `stropni_deska`, `zakladova_deska`,
  `zakladova_patka`, `zakladovy_pas`) dostalo KB-kalibrované defaulty v B4
  `default_ceilings/<el>.yaml` + zrcadlo v `resource-ceiling.ts` (`RESOURCE_CEILING_DEFAULTS`,
  `source: 'kb_default'`). Před tím měl main jen 2 Phase-1 reference elementy (`operne_zdi`,
  `mostovkova_deska`); ostatní padaly na auto-derived dolní mez.
- **Kalibrace proti `computePourCrew()` bucketům + orchestrator DEFAULTS** (num_sets=2, crew_size=4)
  → first-time-user nedostává falešné ⛔ INFEASIBLE z default-vs-default porovnání.
- **Dovedeno cherry-pickem JEDNOHO commitu** `8baaad3d` z odložené větve
  `claude/review-resource-ceiling-pr-3wEjV` na čerstvý `origin/main` (`02deaa84`) →
  nová větev `claude/resource-ceiling-group-a` → PR #1300. **NE rebase** staré větve
  (3949 squash-orphan commitů). Aplikováno bez konfliktu (6 YAML + golden net-new,
  `.ts` diff čistě aditivní +168/−3).
- **Ověřeno** na nové větvi: cherry-pick 0 konfliktů · `tsc` clean · targeted
  `resource-ceiling`+`golden-group-a` 50/50 · **plný shared-suite 1225/1225** (29 souborů,
  žádné regrese). CI flake (Build Frontend `npm ci` ECONNRESET) = transient, pře-kiknuto
  `rerun_failed_jobs`; paralelní run téhož commitu byl zelený. Merge ověřen i přes
  `git` na `origin/main` (ne jen API) — 6 YAML + golden potvrzeny IN-MAIN.

**Odmítnuto:**
- Rebase odložené větve (3949 squash-orphan commitů) — místo toho cherry-pick čisté delty.
- Jakákoli nová fíčra — recon potvrdil, že Group A nebyla mezitím udělána jinou cestou
  (main `RESOURCE_CEILING_DEFAULTS` měl jen 2 Phase-1 záznamy; 6 YAML + golden chyběly).

**Otevřené otázky / dluhy:**
- Resource Ceiling Phase 3-4 (Group B+C+D+E+F, zbývajících 16 typů) stále otevřené per backlog.
- Resource Ceiling UI form (Expert panel) + Foundation C2 auto-recovery split — beze změny.

**Co dál:**
- Zavřen backlog **P0 Resource Ceiling Phase 2 Group A** → odškrtnout v CLAUDE.md TODO.
- DXF-spike stádium 2 (původní zadání této session) zůstává — DXF takeoff je z velké části
  už v main (Pattern 49, viz entry níže); dořešit jen sklad/dům cross-check čísla 17.6/62.5/44.6.

**Pravidlo vyučené (→ CLAUDE.md / Pattern 12):**
- **Odloženou větev verifikovat reconem podle OBSAHU, ne podle grafu commitů** — squash-merge
  orphans (Pattern 12) způsobí, že `git log HEAD..branch` lže (3949 «chybějících» commitů,
  jejichž obsah JE v main pod jinými SHA). Pravá unikátní delta = porovnat soubory
  (existence v `origin/main`, diff `.ts`, test-cherry-pick do worktree). Hotovou práci
  pak dovést **cherry-pickem jednoho commitu na čerstvý main**, ne rebasem celé větve.


## 2026-06-03 — Session: DXF-First automated takeoff (Part A+B) + walk_drawings MCP tool + git hygiene

**Rozhodnuto:**
- **DXF-First takeoff (Pattern 49)** — celá Část A+B z `TASK_Automated_Takeoff_DXF_Vision_BIM.md`
  smergeována do main přes per-PR řetěz:
  - A1 room-label assoc + A2 view separation (#1287): point-in-polygon, 3/3 místnosti
    (0.01 sklad 17.56, 1.01 stání 44.57, 1.02 schodiště 5.5 — všechny ✓)
  - A3 slovník růst na dům DXF (#1288): 28→38 layer + 3→14 block rules, auto-count sanity
    (WC/vana/umyvadlo/sprcha) — zaplnilo gap smety
  - A4 pipeline integrace (#1289): DXF krok v `regenerate_all_views.py`, cross-check vs manual
  - #1 type-aware cross-ref (#1291): MATCH vyžaduje číslo/název linkage → 59→39 pravých shod
  - #2 multi-floor dedup (#1292): 61→39 unique (patro+verze)
- **walk_drawings MCP gate (P40)** — Part B smergeováno (#1290 prototype + #1293 wiring):
  registrovaná tulza `validate_drawing_element` = **Tool 19** (modul `walk_drawings.py`).
  Count **19→20** (18 + extract_tz_fields z #1294 + validate_drawing_element). Synchronizováno
  všech 5 registr-povrchů (server `_REGISTERED` + routes `TOOL_ORDER`/`TOOL_DESCRIPTIONS` +
  auth `TOOL_COSTS=0` + test `EXPECTED_TOOLS`). CI plné green (408 passed, Postgres+Redis, live count=20).
- **Kanonické jméno = `validate_drawing_element`** (modul/flow = `walk_drawings`, NE jméno tulzy);
  kosmeticky vyjasněno v server komentáři / docstring / design-doc / PATTERNS.md / TASK.
- **Git hygiena (#1298)** — output churn (binární xlsx/docx regen) blokoval branch checkout:
  generátory → date-less jména, 34 deliverables + 8 audit/log projekcí gitignored+untracked,
  `applied_at` v finalize → idempotentní (items.json + FROZEN už nečurní). 2. regenerate = 0 churn.
  Snapshot doručeného balíčku v `snapshots/delivered_RD_Jachymov/` (tracked, audit). README date-less.

**Odmítnuto:**
- Install-fail v CI NEBYL PyPI flaka — byl to **lost-in-merge google-auth pin** (#1285 ztratil
  bump, #1295 re-aplikoval `google-auth>=2.47.0` pro aiplatform 1.154.0). Rebase #1293 na main
  to vyřešil deterministicky (clean `pip install --dry-run` resolves).
- Mazání 10 merged-větví z prostředí (push --delete → 403; MCP nemá delete-branch) →
  Alexander smaže přes UI.

**Otevřené otázky / co zbývá v DXF:**
- walk_drawings **end-to-end** (host → submit_element REST → gate) — gate v main + unit-testy,
  ale plný cyklus + host-prompt + e2e test nezadrátováno.
- Slovník růst na nové projekty (Libuše/SO-250) — akumulativně, po cestě.
- multi-floor dedup verze=named/unnamed je heuristika (ne layer-based stav/návrh) — refinement.

**Co dál:**
- **Cemex demo-prep (podání 28.06, ~25 dní od 03.06) = HLAVNÍ priorita** — ODDĚLENOU session.
  Resource Ceiling pro mostovku (326→~40 dní do/po), demo-script (větev `cemex-demo-prep`, bez PR),
  modul CZK/m³ betonu vedle kalkulátoru.
- walk_drawings e2e + slovník růst = po Cemexu / na pozadí.


## 2026-06-02 — Session: extract stage 1 + Vertex SDK freeze + main install-fix

**MERGED do main (tip 25df8d0):**
- #1262 W3b activate object_type (37a23f7e) — `_classify` stub-signature fix + fail-loud breakdown handler.
- #1278 MCP tools `detect_object_type` + `export_soupis`; EXPORTED reachable; dead `read_project_documentation` removed.
- #1280 ADK-spike (izolováno v `spikes/`, venv-only) → ROZHODNUTÍ: stavíme vlastní tenký hybrid, NE ADK. `REPORT.md` = ADR.
- #1281 thin-hybrid recipe orchestrator (#85–#92): `recipe_runner` zaplnil WORK_ATOMIZATION dispatch-stub; nuance decider = Vertex Gemini (v testech stub-injekce); OTel root+child spans; fail-loud vs empty-pass-through split; DB-gated endpoint-test prokázal `asyncio.run` na živém dispatchi (to_thread-worker, žádný running loop → `asyncio.run` bezpečný).
- #1285 freeze `google-cloud-aiplatform==1.154.0` (CVE-2026-2473-safe ≥1.133.0 + obsahuje `vertexai.*` moduly + smoke-ověřeno). **ROZMRAZIT po migraci na google-genai.**
- #1295 fix main install: `google-auth==2.25.2` → `>=2.47.0,<3.0.0` (požadavek aiplatform 1.154.0; při merge #1285 se bump ztratil — main byl install-broken, #1295 opravil).
- #1294 `extract_tz_fields` (#94–#100) — stádium 1 extrakce polí TZ. Registr konzistentní na 19 nástrojích (`TOOL_ORDER`=`_REGISTERED`=`EXPECTED_TOOLS`=19).

**Rozhodnuto (Vertex SDK — z prvopramene, 3 úrovně):**
- vertexai generative SDK deprecated 2025-06-24, removal **2026-06-24** — ale jen z BUDOUCÍCH releasů SDK (dok `genai-vertexai-sdk`: "SDK releases after June 24, 2026 won't include these modules"). Zapinovaný wheel 1.154.0 immutable, moduly uvnitř.
- Modely gemini-2.5-flash/pro/flash-lite retirement **2026-10-16** (dok `model-versions`). `textembedding-gecko@003` — datum nedoloženo, ALE `vertex_embeddings.py` se nikde neimportuje = mrtvý kód, nehraje roli.
- ⇒ Okno Cemex (podání 2026-06-28) **BEZPEČNÉ** na zapinované 1.154.0.

**Odmítnuto:**
- ADK jako orchestrační vrstva (#1280) — vlastní tenký hybrid místo toho.
- Plný 125h DXF/IFC/BIM parser jako závazek — `TASK_Automated_Takeoff_DXF_Vision_BIM.md` je referenční ADR, ne commitment.
- Spěšná migrace vertexai.* před Cemexem — fakty sňaly urgenci.

**Otevřené otázky / dluhy:**
- Migrace `vertexai.*` → `google-genai`: PO Cemexu, reálný deadline ~2026-09-16…10-16. Dotčeno: `gemini_client.py` (GenerativeModel) + dead `vertex_embeddings.py` (TextEmbeddingModel — vypéct nebo migrovat). Smoke Gemini na ŽIVÝCH credech povinný. Pak rozmrazit pin #1285.
- Stádium 2 GUARD: `volume=None` se koalescuje na 0 (čestné pro stádium 1), ale na stádiu 2 objem, který SE MĚL extrahovat ale je None, musí vyplout jako OVĚŘIT, NE tiše 0.
- Opc: #93 provider_router honesty-fix (Bedrock-first pro EXTRACT/CONTRADICTION = mrtvý konfig, tiše jde na Gemini); ELEMENT_TYPES(22)↔WORK_TEMPLATES(9) drift; grounding-gate hardening.
- Backlog-hygiena: 255+ dependabot (1 critical zavřen #1285-freeze); `python-multipart` 0.0.17→0.0.18+ (dosažitelný upload-DoS, high) — po Cemexu.

**Co dál:**
- DXF-spike (= extract stádium 2, výměry z výkresů): jeden soubor RD Jáchymov přes `ezdxf` → plochy/count/layers → porovnat s ručním obměrem 17.6/62.5/44.6 → STOP-gate. NE plný parser. Insight „DXF = struktura ne obrázek, DXF-first před vision" — správný, držet.

**Pravidla vyučená touto session (→ CLAUDE.md):**
1. Injekce závislostí do MCP-nástrojů — JEN přes module-level globals/defaulty, NIKDY `Callable` v public signatuře (FastMCP staví JSON-schema ze signatury → `CallableSchema` crash, kaskádou valí všechny fastmcp-testy).
2. Nový MCP-nástroj → synchronizovat VŠECHNY počítadla naráz: `_REGISTERED_TOOL_NAMES`, `TOOL_ORDER`, `TOOL_DESCRIPTIONS`, `TOOL_COSTS`, manifest, YAML allow-list, A `EXPECTED_TOOLS` v compat-testu (poslední se zapomíná — lokálně bez fastmcp není vidět).
3. Pin knihovny → zkontrolovat její TRANZITIVNÍ požadavky proti ostatním tvrdým pinům (pin aiplatform vynutil bump google-auth). Smoke VŽDY čistým `pip install` bez `--ignore-installed`/obcházení — jinak resolver-konflikty nevidíš (smoke #1285 je skryl, čistý CI-install odkryl).
4. Po KAŽDÉM merge → `git log`/`grep` na origin/main že změna reálně dojela (squash může ztratit commity: #1285 ztratil google-auth-bump → main install-broken). Ověřovat přes worktree z origin/main, ne lokální ref (může být stale).
5. Business/regulatorní data (BIM-zákon, SDK removal, model retirement) — potvrzovat z OFICIÁLNÍHO prvopramene, ne z chatu. Tato session: chyba „rok rezervy" chycena uživatelem → přeověřeno → urgence sňata fakty.

**Stav:** vše smergeno do main (25df8d0), install resolvuje čistě, MCP-registr = 19 nástrojů konzistentně. Pracovní strom čistý. Otevřené PR žádné.


**Rozhodnuto:**
- vymery_souhrn.json kompletně doplněn: 38 jednotek (32 measured, 4 derived, 2 estimate)
  — všechny místnosti 1.PP/1.NP/2.NP/3.NP + dům prvky (fasáda, sokl, střecha) + sklad prvky
- H-BLOK Standard count opraveno 60→18 ks:
  web-ověřeno Herkul H-BLOK Standard líc 1800×600 mm = 1.08 m²/blok; 19.05/1.08=17.6→18 ks
  (layout 4×5=20 ks s řezy — poznámka ve formula); OVĚŘIT definitiv u Herkul zachován
- Regenerace 11 kroků: All OK, docx==queue(31)
- Commit + push: 6b3ec695 on claude/busy-einstein-zMx5F

**Odmítnuto:**
- Tech list přímo z hblok.cz (403 Forbidden); použito cross-ref BB6 1800×600 z web search

**Otevřené otázky:**
- OVĚŘIT H-BLOK definitiv: potvrdit 1800×600mm přímo u Herkul a.s.
- Světlé výšky místností: použity odhady z řezů (OVĚŘIT měřením na stavbě)
- URS matching pro materiál-legs (needs_lookup): part 5b stále čeká

**Co dál:**
- Part 5b URS/KROS catalog matching (189 položky → urs_code_proposed)
- Vyjasnění queue: 31 položek pro Karla Šmída


> Each session adds a section here. Format:
> `## YYYY-MM-DD — Session: {topic}` + Rozhodnuto / Odmítnuto / Otevřené otázky / Co dál

---

### 2026-05-31 — Session: W3b — activate object_type from TZ into work breakdown (classifier #71–#76)

**Topic:** Fresh branch `claude/w3b-activate-object-type` from origin/main (W3 #1261 merged as squash `2fb89ae4`). Completes W3: the classifier accepted an authoritative `object_type` but nobody filled it → production still used the fragile name+code fallback. Recon confirmed `create_work_breakdown` (breakdown.py:157, `_classify(name)`) is the real atomization caller, passing nothing. Red→green TDD.

**Rozhodnuto:**
- **New module `object_type_detector.py`** (pure, no LLM, mirrors W3 normalizer): `detect_object_type(object_name, charakteristika) -> bridge|retaining_wall|building|None`. **Detects ONLY from name + charakteristika sentence, NEVER full text** — SO-250's geology section mentions neighbouring `mostní objekt`/`lávka SO 222`; full-text `most` would falsely flag the wall as bridge (#71 guard test locks this). Wall wins over bridge when explicit wall wording present (adj `zárubní/úhlová/opěrná` + noun `zeď/stěn` co-occur, so a bridge `opěra mostu` isn't caught).
- **Cache key = SO code** (`object_types: {"SO 250":"retaining_wall","SO 202":"bridge"}`) — project is heterogeneous (most + zeď coexist), NOT project-level. Legacy `project_type` (catalog selector, default "most") explicitly NOT used as a type source.
- **Producer/consumer split:** `detect_and_cache_object_type` runs ONCE per object at document-analysis time (idempotent — returns cached without re-detecting, #75), saves via `project_cache.save_field`. `create_work_breakdown` only READS the cache by SO code (`get_cached_object_type`) and threads `object_type` into `_classify(name, object_code, object_type)`. Cache miss → None → W3 fallback (#76, no #63–#70 regression).
- **breakdown.py threading:** added `project_id` + `object_types` params (additive); per-element resolution priority explicit map → cache by SO → None.
- **Tests** `test_mcp_golden_so250b.py` (skip-proof sync `asyncio.run`, like so250): #71 detect + fulltext-noise guard, #72 threaded to each element, #73 bridge generic `Dřík`→`driky_piliru` (the activation payoff), #74 wall→`operna_zed`, #75 detect-once spy + fake cache, #76 undetermined→fallback. **10 passed; 41 total incl. W3 #63–#70 + normalizer regression green.** CI: so250b wired into `test-mcp-compatibility.yml`.

**Odmítnuto:**
- Full-text type detection — the explicit SO-250 false-bridge trap; name+charakteristika only.
- Project-level single type — heterogeneous stavba; keyed by SO code.
- Touching W3 classifier/normalizer (consumer already correct), `provider_router`/`ai_reasoner`, calculator, sister TS classifier.

**Otevřené otázky / risks:**
- The **producer** (calling `detect_and_cache_object_type` at document-analysis time) is provided as a module fn but not yet wired into a live document-analysis entry point — the orchestrator's real WORK_ATOMIZATION loop is still a PR3a stub. W3b ships the mechanism + the breakdown consumer; hooking the producer into the live ingest is a follow-up when that path is built. Until then callers pass `object_types` explicitly (as tests do).
- Sister TS classifier still diverges (W3 carry-forward, unchanged).

**Co dál:**
- Open PR W3b → main (draft → ready after CI green, like W3).
- Wire the producer into the document-analysis entry point once the live atomization loop exists.

---

### 2026-05-31 — Session: W3 element-name normalization layer (SO-250 probe, classifier #63–#70)

**Topic:** Fresh branch `claude/w3-normalize-element-name` from origin/main. Contract `docs/tasks/TASK_W3_NormalizeElementName_SO250.md` (renamed to avoid collision with the existing `TASK_Orchestrator_WorkOntology_SO250.md` #1–#20 extraction task). Red→green TDD on the MCP element classifier.

**Rozhodnuto:**
- **Recon first (no code):** mapped classifier (`app/mcp/tools/classifier.py` — `KEYWORD_RULES` L205+, confidence hard-coded 0.85/0.3, `BRIDGE_MARKERS` SO\d{3} bug), catalog (`ELEMENT_TYPES` 22 types), pre-classify insertion point (`_classify` call), golden harness (`tests/test_mcp_golden_so202.py`, not in any CI workflow), `provider_router.py` (untouched). Reproduced 6 probe findings: 4/6 wrong.
- **Normalization layer** = new pure `normalize_element_name(name, object_code)` (`app/mcp/tools/element_name_normalizer.py`), called inside `_classify` BEFORE the rule loop; rule table unchanged (stays category matcher). 3 signals: canonical head-noun (strips prepositional/participle tails + dims; context-sensitive dřík; základ canonicalized; NK>trám), construction_context (from real vocab, NOT SO-number), status (nový/stávající). No LLM (replay-deterministic).
- **Catalog:** +1 category `zdivo_obklad` (23rd; rebar 0, vertical, no formwork) for lícový obklad z lomového kamene. Q2 decision.
- **Bridge context decoupled from SO-number** (fixes #69) — re-derived from content words (most/NK/pilíř vs zárubní/úhlová zeď), which KEPT the two existing `is_bridge_context is True` tests green (SO-204 "NK deskový", SO-202 "Pilíře").
- **Golden:** new `test_mcp_golden_so250.py` (8 tests #63–#70) mirroring so202; +11 normalizer units. Red verified directly (#63/#65/#66/#68/#69/#70 fail, #64/#67 green guards) → green after impl. CI: wired normalizer + golden so250 + **golden so202** (previously unenforced) into `test-mcp-compatibility.yml`.

**Odmítnuto:**
- Touching `KEYWORD_RULES` regex logic (contract forbids — only normalize before, +1 category).
- Fixing the sister TS classifier (`Monolit-Planner/.../element-classifier.ts`) — same defects, but explicit follow-up to avoid drift risk (task §7).

**Otevřené otázky / risks:**
- Sister TS classifier in the calculator now diverges from the Python MCP one — drift risk until a follow-up ports the normalizer.
- Modifier-stripping is a curated marker set (task examples); broad ŘSD corpus may surface more tail patterns — extend conservatively.

**Co dál:**
- Open PR W3 → main (ready for review). CI must run golden so250 + so202 green (not skip).
- Follow-up: port normalization to the TS sister classifier; extraction-layer criteria #71+ (concrete-class binding, source grounding) on the #1–#20 task.

---

### 2026-05-31 — Session: Implement audit recommendations R1/R2/R3/R6 (R4 held)

**Topic:** Follow-up to the plugins-audit session — enable the БРАТЬ-bucket tooling on `claude/code-plugins-audit-setup-paw6S`. User scope: "R1, R3, R6, and R2 with ruff+black only — no blocking mypy. Hold R4. Each as its own commit, no auto-push hooks, no PR." No product code touched.

**Rozhodnuto:**
- **R1** (already committed `4532e7c`): project `.claude/settings.json` `permissions.deny` read-patterns for the big-data corpus (`test-data/**`, DXF/DWG/DB/MDB, KB JSON/XML, `docs/normy` PDFs, URS CSVs, OTSKP XML).
- **R2** Python lint/format gate → delivered as a **Husky pre-commit gate** (`scripts/python_lint_check.sh`), not a Claude Code PostToolUse hook (user declined the auto-format-on-edit wiring; "no blocking mypy" implied a blocking gate). Checks staged `concrete-agent/**/*.py` with `black --check` + `ruff --select=E9,F63,F7,F82` (real-bug rules only, to avoid blocking on the never-linted core-backend's style nits). No mypy, no auto-formatting. Skips gracefully if tools absent; `--no-verify` bypass documented.
- **R3** cross-user-isolation reviewer **subagent** at `.claude/agents/cross-user-isolation-reviewer.md` (read-only Read/Grep/Glob/Bash, `model: inherit`), grounded in `docs/security/isolation_model.md` — enforces the three `owner_id` invariants + 404-not-403 existence-leak + anonymous-401 checks. Allowlisted `.claude/agents/` in `.gitignore` (mirrors existing `skills/`/`settings.json` exceptions).
- **R6** secret-scan **pre-commit gate** (`scripts/secret_scan_check.sh`), dependency-free (no gitleaks). Scans only added lines; matches private keys, AWS/Google/GitHub/Stripe/Slack tokens, `sk-stavagent-*` product key, and `key="literal"` credentials; ignores placeholders/env-vars; `pragma: allowlist secret` per-line opt-out. Motivated by the once-leaked DB password.
- Each as its own commit (R2 `0d19743`, R3 `44a515f`, R6 `dc94a87`). Both gates wired into `.husky/pre-commit` after the existing shared-formula tests.

**Odmítnuto / honest findings:**
- **R4 held** per user (MCP-compatibility pytest guard — deferred).
- Husky is **not active in this container** (`core.hooksPath` unset, no `.git/hooks/pre-commit`) → gates were validated by running the scripts directly against staged fixtures (black catches unformatted, ruff catches bugs, secret-scan catches AWS/GH/Google keys + hardcoded creds, passes env-vars/placeholders/marker). They activate for developers who run `npm install` (husky prepare) normally.
- R2 PostToolUse auto-format approach was built then removed after the user declined it.

**Otevřené otázky:** R2 `black --check` on a never-blackened codebase will flag any legacy file a dev stages — acceptable boy-scout friction with `--no-verify` escape, but could be softened to warn-only if it proves noisy.

**Co dál:** R4 when user lifts the hold. Optionally add `ruff`/`black` to `core-backend/requirements.txt` (currently commented) so CI/devs install them. Branch pushed, no PR per instruction.

---

### 2026-05-31 — Session: Claude Code plugins audit + setup (code-review installed, automation analysis)

**Topic:** READ-ONLY tooling task on `claude/code-plugins-audit-setup-paw6S`. Install two official plugins (automation analyzer + code-review) and produce a bucketed recommendation report, under Google-for-Startups prod-safety constraints (no auto-push/deploy, no kiosk branches).

**Rozhodnuto:**
- Added official marketplace `anthropics/claude-code` (`claude-code-plugins`); installed **`code-review` v1.0.0** (user scope). Recorded actual composition: 1 slash command spawning haiku-gate → haiku CLAUDE.md-collector → sonnet summary → 4 parallel reviewers (2× sonnet CLAUDE.md + 2× opus bug/security) → per-issue validator subagents → filter.
- Report filed at `docs/audits/claude_code_plugins/2026-05-31_setup_and_recommendations.md` with БРАТЬ/ОТЛОЖИТЬ/НЕ БРАТЬ buckets.
- Big-data context-exclusion **proposed** (R1): read-deny for `test-data/**` (459 MB), DXF/DB/MDB, KB JSON/XML (40 MB), `docs/normy` PDFs (40 MB), URS CSVs. Recommendation only — not applied.
- Top "take now": context read-deny (R1), security/cross-user-isolation reviewer subagent (R3, serves GDPR P0), `/code-review` (R5), Python ruff+black hook (R2, tools commented in requirements, no CI conflict), MCP-compat guard (R4), secret-scan (R6).

**Odmítnuto / honest findings:**
- The task's "automation analyzer" plugin **does not exist** in the official marketplace (all 13 enumerated). User chose: analyze Core manually, no mismatched install.
- `code-review`'s "confidence scoring 0–100" is actually a binary **validation-pass filter**, not a numeric threshold. Command depends on `gh` CLI + `github_inline_comment` MCP — both absent in this remote env (only `mcp__github__*`).
- Code-review **not test-run**: no human PR (all 24 open PRs are Dependabot → command skips automated PRs), gh-CLI gap, and commands load only next-session.

**Otevřené otázky:** none blocking. Whether to actually *enable* R1/R2/R3/R4/R6 is a separate user decision.

**Co dál:** if user approves, implement R1 (project `.claude/settings.json` read-deny) + R2/R4/R6 hooks + R3 isolation-reviewer subagent in a follow-up — none touch product code. Defer R8/R9 (frontend-MCP, auto-deploy) until after Google review.

---

### 2026-05-31 — Session: Orchestrator stage-gating PR3b (durable sessions + real isolation + audit/replay — W2 close)

**Topic:** Fresh branch `claude/orchestrator-stagegating-pr3b` from main (PR3a merged as squash `001f6743`). Closes Week-2 stage-gating: the deferred PR3b scope — real cross-user isolation (P0/GDPR), durable session bridge, append-only audit log, replay. Shipped in 5 incremental commits (pushed as built so nothing is lost).

**Rozhodnuto:**
- **Auth principal (P0, AC18) = Portal JWT (shared `JWT_SECRET`).** concrete-agent had NO JWT; added HS256 validation of the Portal-issued user JWT (claims `userId`/`email`/`role`) → `Principal`. `/orchestrate` owner now comes from `Depends(require_principal)`, NEVER the request body — `SessionAccessError` is a real HTTP 403 boundary, not advisory. `user_id` removed from the request schema. Interview-confirmed with Alexandr.
- **Auto-provision users + projects** (interview decision): concrete-agent's `users`/`projects` are its own DB, so a Portal `userId`/`project_id` may be absent → FK would fail. `ensure_user_provisioned` / `ensure_project_provisioned` idempotently upsert (ON CONFLICT DO NOTHING; sentinel password_hash; `workflow_a` to satisfy the projects CHECK).
- **Durable session bridge = sync SQLAlchemy repository.** PR1's `SessionManager` is sync, the existing repo async (un-wired by design). Rather than rewrite PR1, added `SyncSqlAlchemySessionRepository` (psycopg2, reuses the async repo's pure `_to_model`/`_from_model`) + memoized `make_sync_session_factory`. Endpoint runs the sync orchestrator in `asyncio.to_thread` so blocking DB I/O never blocks the loop. Sessions survive across Cloud Run instances → durable HITL resume (AC11). `purge_expired()` for TTL eviction (bounded store).
- **Append-only audit (AC13) = alembic migration + BEFORE UPDATE/DELETE trigger → RAISE** (not SQL-startup, mirrors PR1; not a GRANT/RLS — trigger is role-independent). `orchestrator_audit_log` captures AC14 fingerprint (tool name/version, inputs/outputs/policy sha256 hashes, core engine version, session/user/project, timestamp) + AC16 transition source. Plain UUID tenant cols (no CASCADE FK) so audit outlives its refs.
- **Replay (AC20):** content hashes computed over canonical JSON with volatile timestamp keys stripped recursively → same inputs + same engine version reproduce the identical audit fingerprint + final state. Test runs a session twice, diffs fingerprints (session_id + `at` excluded).
- **`tools_invoked` → `tools_allowed`:** checkpoint runner records YAML-allowed tools under `tools_allowed` (no tool actually ran) — names must not lie to the audit/replay trail. `tools_invoked` reserved for real dispatch (W4).

**Odmítnuto:**
- Rewriting PR1's `SessionManager` to async — chose the sync-repo bridge (least churn, PR1 untouched).
- MCP Bearer api-key as the principal — session.user_id is a `users` UUID, a different identity space; JWT principal is coherent and matches the FK.
- Enforcing append-only via DB GRANTs/RLS — a trigger holds regardless of connecting role (app credential or compromised credential alike).

**Otevřené otázky / risks:**
- `/orchestrate` requires `JWT_SECRET` set in CORE Cloud Run env (shared with Portal) — must be configured before the UI calls it; endpoint 401s until then.
- Auto-provisioned `users` rows carry a synthetic email + sentinel password_hash — fine for isolation, but these are not full Portal users (no cross-DB sync). Acceptable for orchestrator scope.
- Real per-tool dispatch into the `ToolRunner` seam is still W4 (checkpoint runner is the live default); `tools_invoked` stays empty until then.

**Co dál:**
- Open PR3b → main, ready for review (merge via UI). Verify CI runs the new DB-gated tests green (not skipped) — `STAGEGATING_REQUIRE_ENDPOINT_TESTS=1` makes a missing dep/DB red.
- W3: real work-ontology extraction (SO-250 / SO-202) on top of these rails. W4: KROS adapter + real tool dispatch.

---

### 2026-05-30 — Session: Orchestrator stage-gating PR3a (/orchestrate + HITL + e2e stub + P1 engine memoization)

**Topic:** Branch `claude/orchestrator-stagegating-pr3`. Continuation of the stage-gating MVP (PR1 foundation + PR2 policy gateway already merged on this branch). Split the remaining PR3 into **PR3a** (this session) + **PR3b** (next). PR3a = the thin orchestrator loop, deterministic intent classification, HITL pause/resume, the canonical `/orchestrate` endpoint, an end-to-end stub test, and the P1 engine-memoization perf fix.

**Rozhodnuto:**
- **Thin orchestrator (`app/services/stage_gating/orchestrator.py`):** owns session state; walks a named workflow's `sequence` one state at a time; per state runs a *step* through an injected `ToolRunner` seam, records outputs onto the session, then `SessionManager.advance`s to the next state. Contains NO domain/tool logic (tools never mutate state — orchestrator does). **Atomic steps:** a step either COMPLETES (record + advance) or PAUSES (record nothing, state unchanged) → resume safely re-runs the paused step, no half-applied state, no double-exec. Deterministic by construction (same request + same runner outputs → same state walk + same logs) so PR3b replay will hold.
- **Deterministic intent (`intent_classifier.py`, W3 decision = NO LLM):** resolution order `options.target_output` (explicit, unknown value → raise) → message keyword heuristic (CZ+EN) → default `full_takeoff`. Result validated against loaded `WorkflowConfig` (map↔YAML drift fails loud).
- **HITL:** `StepResult.needs_user_input` + `question` → orchestrator returns `paused_for_input`, persists a `hitl_pause` marker, leaves `workflow_state` on the paused state. Resume = re-invoke `/orchestrate` with `session_id` (+ `user_response`/`confirmation_token`); `user_response` applies only to the FIRST resumed step then is consumed (verified by a two-pause-point test).
- **`/orchestrate` endpoint (`routes_orchestrator.py`, `POST /api/v1/orchestrate`):** single canonical REST surface (UI + MCP). Default `make_checkpoint_tool_runner(config)` records each state as a checkpoint (no fabricated domain outputs) and enforces ONE real gate — COMMIT_PENDING pauses for a `confirmation_token` before crossing into COMMITTED. Client errors mapped: intent→400, not-found→404, wrong-owner→403, terminal→409.
- **P1 perf fix (`mcp/stage_gating_gateway.py`):** replaced per-tool-call `create_async_engine(...)` + `await engine.dispose()` with a module-level `@lru_cache`'d `(engine, factory)` per DSN — was opening/tearing down a fresh pool + asyncpg connection on every gated invocation.
- **SessionManager additions:** two small public, ownership-checked methods (`load`, `persist`) so the orchestrator never touches `_repo` privates; state transitions still go ONLY through `advance`.
- **Tests + CI:** `tests/test_stage_gating_orchestrator.py` (18 tests: 15 pure logic pass locally, 3 endpoint tests skip locally on missing `fastapi`, run in CI). Added the file to `test-mcp-compatibility.yml` (push + PR paths + pytest invocation).

**Odmítnuto:**
- LLM-based intent routing — determinism is a hard requirement for replay (Determinism > AI).
- Wiring real per-tool dispatch into the endpoint this PR — explicitly the "e2e **stub**" scope; checkpoint runner ships instead, with the `ToolRunner` seam as the obvious extension point.
- DB-backed durable orchestrator sessions — PR1's sync `SessionManager` and async `SqlAlchemySessionRepository` are deliberately un-wired (the sync↔async bridge is PR3b). Endpoint uses a **process-local in-memory** repo for PR3a (documented limitation: HITL resume not durable across instances/restarts).

**Otevřené otázky / risks:**
- Endpoint session durability is process-local until the PR3b sync↔async repository bridge lands — multi-instance Cloud Run resume is unreliable meanwhile.
- Audit-hash chaining, append-only audit table (alembic migration + BEFORE UPDATE/DELETE trigger → RAISE), replay verification, cross-user RLS isolation test = all PR3b.

**Co dál:**
- Commit + push PR3a to `claude/orchestrator-stagegating-pr3`.
- PR3b: audit hashes + append-only migration/trigger + replay test + isolation test + real tool dispatch + sync↔async repo bridge for durable sessions.

---

### 2026-05-29 — Session: RD Jáchymov terasa 762 fix + ChatGPT diff + statika cross-check + anti-hallucination patterns

**Topic:** Branch `claude/busy-einstein-zMx5F` (RD Jáchymov pilot, items.json 214 single source). Five units of work shipped + a `main` merge. Drawing-confirmed terasa fix, ChatGPT revize cross-check, full statika D.2 validation, pattern-library codification of the failure that motivated it, and 3 Pattern-38 follow-up fixes. Commits `560bf3a1` → `c49470e8`.

**Rozhodnuto:**
- **Terasa ŘEZ C-C fix (split-by-trade, Option B):** "betonové dlaždice NA terče" was wrong — tiles are the *roznášecí* layer POD terče; terče carry the wooden deck. Wood (762) was never gone — it survived as `PSV76.002 Truhlář` mis-coded `771` + "hliníkový rošt". Fix: `HSV1.005` = 5-op podkladní skladba (fam 636311→564); `PSV76.002` = 2-op dřevěná pochozí vrstva (fam **762**, code blank per Pattern 26, rošt hliníkový→dřevěný); dvorek `HSV1.004` 3→4 ops. No 30 m² double-count (wood only in PSV76.002, terče only in HSV1.005a). items 214 unchanged.
- **ChatGPT revize diff (235 master / 71 CHYBI_OVERIT vs 214):** ~58/71 flags were already covered (risk-annotations on existing items). VALID catches: komín `HSV6.016` 6.0→0.6 m³ (×10 inflation, formula self-documented 0.6); sklad below-grade HI+drenáž (real gap, NOT_IN_TZ → vyjasnění #25); sněhové zábrany #26 + lemování komína #27. All real gaps were NOT_IN_TZ → vyjasnění, not fabricated (Pattern 26). C16/20 "ověřit" resolved by statika (correct).
- **Statika D.2 cross-check:** ALL structural profiles + concrete classes CONFIRMED (zero profile/class errors). Per Pattern 26, kg/ks/bm stay ODHAD (statika §7 — výkaz oceli/dřeva is DPS-level); `statika_validation` note added to 32 structural items. 2 quantity flags noted in-item (sklad IPE180 parking, pozední věnec), unchanged.
- **Anti-hallucination patterns (terasa miss):** 2 NEW (39 Vision-first reading for drawings, 40 Host-delegated vision + MCP validation gate) + 2 enrichments (9 re-read before fact-decision, 29 citation present ≠ VERIFIED). Header `last_number 38→40`, sequence 1..40 validated. P39 promoted to mandatory in `concrete-agent/CLAUDE.md`.
- **3 Pattern-38 fixes:** `generate_otazky_docx.py` was rendering a HARDCODED `OTAZKY[1-20]` and never loaded the queue → docx silently shipped stale set, MISSING #22-27 + INCLUDING resolved 19/20. Made queue-driven (OTAZKY = friendly override), added as 9th orchestrator step + `docx==queue` assertion. Plus docstring count-agnostic + `HSV1.005a` urs ""→null.
- **`main` merge:** PR conflicts resolved — `#1246` was this branch's earlier snapshot; my HEAD verified strict superset → `--ours` on RD/pattern files + regenerate (Pattern 38), main's 3 new task docs kept. Branch now contains all of main.

**Odmítnuto:**
- Putting wood ops into `HSV1.005` (task's literal 7-op) — would double-count 30 m² with PSV76.002. Chose split-by-trade.
- Fabricating sklad HI/drenáž + sněhové zábrany + lemování as položky — NOT_IN_TZ → vyjasnění only (Pattern 26).
- Recomputing steel/timber tonnage from statika — exact výkaz is DPS-level; kept ODHAD + note.

**Otevřené otázky / risks:**
- 2 quantity flags need výkres/RFEM: sklad IPE180 parking (49 lm likely ~20–30% high), pozední věnec (two-level run may underestimate single-ring obvod).
- Stage 3 URS leaf binding still blocked (12/214 verified); `find_urs_code` MCP connected/disconnected intermittently this session — not tested.
- `File B KROS_format` NOT import-ready (codes mostly família/blank) — deliverable to Karel = ATOMIC_WORKLIST + Otazky.docx + File A + Summary, as estimate with disclaimers.

**Co dál:**
- Merge this branch to `main` (this session).
- When `find_urs_code` stable → Stage 3 leaf binding.
- Resolve 24 vyjasnění with Karel/projektant; refine 2 quantity flags from výkres.

**Addendum (same session, post-merge — shipped to `main` via PR #1251, #1256):**
- **`main` merge resolved twice** — parallel snapshots of this branch (#1246, #1248) kept landing on main; HEAD verified strict superset each time → `--ours` on RD/pattern files + regenerate (Pattern 38). PR #1251 merged (merge-commit, Pattern 12).
- **3 Pattern-38 fixes** — discovered `generate_otazky_docx.py` rendered a HARDCODED `OTAZKY[1-20]` and never loaded the queue → docx silently shipped stale set (missing #22-27, including resolved 19/20). Made queue-driven (OTAZKY = friendly override), added as 9th orchestrator step + `docx==queue` fail-fast assertion. Plus count-agnostic docstring + `HSV1.005a` urs ""→null.
- **Situace-measured area correction (PR #1256)** — legend (zpevněné plochy: dlažba [brick-hatch] vs terasa [line-hatch]) overturned the rough ODHAD: **terasa = 9,23 m²** (HSV1.005 podklad + PSV76.002 dřevo, was 30) ≠ **anglický dvorek = 16,54 m²** (HSV1.004, 12,46+4,08, was 30) — two distinct constructions (wood vs dlažba). NEW `HSV1.016` venkovní schody na terénu (13 stupňů 8×175×280 + 5×175×280, TZ §3.2.5, code blank Pattern 26). **items 214 → 215.**
- **soul.md §9 entry** written (this entry). All work on `main`; branch synced.
- **Open:** HSV1.016 assumed betonové schody na terénu — verify vs steel PSV76.001 from výkres (if same stair → drop HSV1.016, fix step count 16→13).

---

**Topic:** Phase C of Rimsa Calibration FullStack v1 (per `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md`, Phase A audit `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`). Single-batch execution G0→G6→G-final on branch `claude/kind-wright-5nBQ2` (piggyback on Týden 3 Knowledge codegen branch — single PR for both bodies of work). All 7 gates shipped atomically; ~470 LOC engine + ~370 LOC tests + ~230 LOC docs. **Tests: 1136 baseline → 1197 (+61 across Týden 3 KB + Phase C cyclic).**

**Rozhodnuto:**
- **G0 preflight:** Branch state verified (claude/kind-wright-5nBQ2, Týden 3 just committed). Baseline CURING_DAYS_TABLE `C30+ × class 4` = `[14, 9, 7, 5, 3]` cold→hot. 2 maturity tests assert old values. Path = YAML edit (NOT maturity.ts direct) thanks to Týden 3 codegen pipeline.
- **G1 calibration:** `kb/tkp18_maturity.yaml` C30+ class 4 row → `[30, 18, 13, 9, 5]` cold→hot (= user spec `[5, 9, 13, 18, 30]` hot→cold reversed to file convention). Position 2 (15-25°C band) = 9d, eliminating rimsa @ 15°C bug. Regenerated TS via `npm run gen:knowledge`. 2 maturity tests updated with Phase C G1 comments.
- **G2 SchedulerMode infrastructure:** `SchedulerMode = 'discrete_cyclic' | 'legacy'` union + `SCHEDULER_MODE_DEFAULTS: Record<StructuralElementType, SchedulerMode>` (rimsa → discrete_cyclic, 22 others → legacy) + `getSchedulerMode(elementType, override?)` helper, all in element-scheduler.ts. Extended PlannerInput with `scheduler_mode?: SchedulerMode` (NO UI exposure per Q2). Follows existing CuringClass/CementType literal-union pattern.
- **G3 scheduleCyclic body:** ~180 LOC new internal function in element-scheduler.ts. Cycle: SET (first only) → REB → POUR → WAIT (intermediates, strip-strength via calculateCuring(strip_strength_pct=70)) → REL (intermediates) → CURE (last, full TKP18 tail) → STR (last). `toShifts(hours, shift_h=8)` exported helper for hour→shift discretization. Dispatch at `scheduleElement()` first line: cyclic mode routes to scheduleCyclic; legacy bytwise unchanged. Crew parallelism: num_rebar_crews ≥ 2 overlaps REB(T_{i+1}) with WAIT(T_i). Graceful n=1 degradation (no special case needed; loop just skips intermediate accounting).
- **G4 orchestrator wire-up:** `getSchedulerMode(elementType, input.scheduler_mode)` + when `fwSystem.unit === 'bm'` (T-bednění) compute `cyclicSetupH = fwSystem.assembly_h_m2 × fwArea` + `cyclicStripH = fwSystem.disassembly_h_m2 × fwArea` → pass to scheduleElement with scheduler_mode + shift_h + setup_h + strip_h. Decision logged for audit trail. Legacy elements ignore the new fields.
- **G5 vitest:** 23 new tests in `scheduler-cyclic.test.ts` covering all 6 spec categories (single-tact, multi-tact, crew parallelism, mode dispatch, strip-strength wait, full cure tail) + toShifts edge cases + output shape parity + critical_path layout + setup_h override.
- **G6 backlog + MCP boundary docs:** `backlog/calc_hardcoded_to_kb.md` tracks 13 hardcoded matrices from Phase A §A.7.4 (5 already done by Týden 3, 8 open); `docs/architecture/mcp_calculator_boundary.md` documents Phase F finding — calculator.py:766-786 silently drops `exposure_class` + `curing_class` on wire to Monolit `/api/calculate` (P2 post-CSC fix).
- **G-final consolidation:** This soul.md entry replaces the standalone G1 entry (chronologically same session, semantically one task). next-session.md handoff updated for Phase D (T-bednění productivity calibration) or Phase E (UI cross-section + length_per_rimsa_bm widget).

**Tests delta per gate:**
| Gate | New tests | Total | Notes |
|---|---|---|---|
| G0 | 0 | 1174 | preflight only |
| G1 | 0 (2 updated) | 1174 | calibration; existing tests modified |
| G2 | 0 | 1174 | type infra only, no caller |
| G3 | 0 | 1174 | cyclic body, no caller |
| G4 | 0 | 1174 | wire-up; element-audit indirectly exercises rimsa cyclic |
| G5 | **+23** | **1197** | dedicated cyclic suite |
| G6 | 0 | 1197 | docs only |

**Rejected during Phase C:**
- G2 orchestrator threading fix — Phase A closing revision (direct read 1535-1576) confirmed threading IS correct; real bug was TS table calibration mismatch (G1).
- Splitting Týden 3 + Phase C into 2 PRs — codegen infra is the enabler of G1 YAML edit; atomic shipping cleaner for review and revert.
- Adding `relocate_h_per_bm` to DOKA Frami YAML — heuristic (0.5 × setup) inside scheduleCyclic adequate for sliding T-bednění; per-system calibration is Phase D scope.
- Cyclic Gantt rendering — orchestrator UI uses tact_details directly; ASCII Gantt deferred.

**Otevřené otázky / risks:**
- **rimsa end-to-end behavior change.** Before Phase C: rimsa scheduled via legacy DAG with class-4 wait_days = 5d (G1 bug). After: scheduled via cyclic with class-4 = 9d. Existing element-audit smoke test passes (output shape preserved), but the **actual day count for rimsa has shifted**. No production rimsa Vitest fixture asserts specific day counts (Phase A §A.2 noted "no SO-250 Vitest fixture"). **Real-world calibration validation pending** — see next-session.md.
- Phase C G1 calibration values (cold side: 30d @ -5°C–5°C for C30+ class 4) are aggressive vs ČSN EN 13670 NA.2 baseline (was 14d). Matches production Python MCP per user spec but lacks independent verification against TKP 18 06/2025 source PDF.
- T-bednění productivity hours pass through `fwSystem.assembly_h_m2` which is documented as "hours per m² OR per bm when unit='bm'". Type-system doesn't enforce; relies on convention. Future: split into `assembly_h_m2?: number` + `assembly_h_bm?: number` fields (low-priority refactor).

**Artefakty této session (Týden 3 + Phase C + PR review fixes, 12 commits on `claude/kind-wright-5nBQ2`):**
- `032c6b7` FEAT(knowledge): codegen pipeline + 5 Top-5 integrations
- `f842ac2` FIX: TKP18 curing class 4 calibration (G1)
- `2b6f18e` FEAT(scheduler): SchedulerMode infrastructure (G2)
- `cd17d96` FEAT(scheduler): cyclic phase model + toShifts (G3)
- `5b4d85a` FEAT(orchestrator): wire cyclic + T-bednění productivity (G4)
- `c9f1460` TEST(scheduler): cyclic regression suite (G5)
- `6456bde` DOCS: backlog + MCP boundary (G6)
- `0a03aed` DOCS: Phase C closing handoff (G-final)
- `c119cd9` FIX(scheduler): split relocate from stripping field (PR review #2)
- `995d271` FIX(scheduler): sequential baseline + remove double-counted relocate (PR review #3)
- `48d8369` FIX(scheduler): explicit rebStart=cursor when overlap + non-first (PR review #1)
- `1979a39` TEST(scheduler): 9 regression locks for PR review fixes

---

### 2026-05-26 — Session: Phase C PR review fixes (Amazon Q logic errors)

**Topic:** Amazon Q automated review on PR #1223 surfaced 3 real logic errors in `scheduleCyclic()`. All 3 confirmed valid, fixed atomically as 3 separate commits + 1 regression test commit. Tests: 1197 → **1206** (+9 review-lock cases).

**Rozhodnuto:**
- **Fix #2 (semantic field):** `TactDetail` gains optional `relocate?: [number, number]`. Intermediate tacts in cyclic mode write `relocate=[relStart, relEnd]` + `stripping=[t, t]` zero-length placeholder. Last tact unchanged (stripping non-zero, relocate undefined). Legacy DAG scheduler never sets `relocate` — backward compat preserved. Stripping stays REQUIRED in interface (consumer breakage avoided).
- **Fix #3 (sequential baseline):** `asmDur = isFirst ? setupShifts : 0` (was: `: relocateShifts`). Root cause was double-counting: each non-first tact had relocate AT START (asmDur) AND AT END (else-branch), giving 2 × relocateShifts per intermediate. Fix means non-first tact's assembly slot is zero-length (form already in place from prev tact's relocate event). Net effect: total_days shrinks by `(n-1) × relocateShifts` for cyclic mode; sequential_days matches manual formula `setup + (n-1)×relocate + n×(rebar+pour) + (n-1)×wait + finalCure + prestress + finalStrip`.
- **Fix #1 (rebar overlap explicit):** `rebStart = (!isFirst && rebarOverlapsWithWait) ? cursor : asmEnd`. After Fix #3, asmEnd === cursor for non-first anyway (functionally equivalent), but explicit conditional documents the parallel-with-WAIT intent + provides robustness against future refactors that might restore asmDur > 0.
- **9 regression tests** in `scheduler-cyclic.test.ts`: 2 for Fix #1 (overlap visible in td.rebar + bounded savings), 4 for Fix #2 (intermediate has relocate + zero-strip / last has strip + no-relocate / relocate at curEnd / n=1 degradation), 3 for Fix #3 (manual formula match / single-crew total==sequential / dual-crew savings_days = (n-1) × min(rebar, wait) exact).

**Odmítnuto:**
- Making `stripping` field optional in TactDetail — would break 4 legacy consumers (PlannerGantt, CalculatorResult CSV, exportPlanXLSX, formulas.ts) that read `td.stripping[0]/[1]` without null checks. Zero-length placeholder is safe (Gantt fillRow handles [t,t] as no-op).
- Keeping asmDur=relocateShifts for non-first + handling double-count elsewhere — root cause is the model itself (form can't be relocated twice per cycle); fixing it at the source is cleaner than band-aid in accumulator.
- Bumping CLAUDE.md version to v4.33.0 — PR #1223 not merged yet; version bumps reserved for post-merge state to avoid drift between CLAUDE.md and main.

**Otevřené otázky:**
- Real-world rimsa validation against DOKA nabídka č. 540045359 — still deferred to Phase D (no Vitest fixture asserts specific day counts; smoke covered via element-audit). After Fix #3, total_days for rimsa shrank further (correct, but more divergent from pre-Phase-C behavior). Real-world calibration matters more than before.
- Whether the "cursor decremented at end of iteration for overlap" + "rebStart=cursor at start of next iteration" pattern is the right abstraction. Works correctly today but reasoning requires tracing across iterations. Alternative: explicit per-iteration rebar/relocate start times computed up-front, no cursor tracking. Refactor candidate if cyclic gets more complex (Phase E?).

**Co dál:**
- PR #1223 awaits re-review (Amazon Q + Alexandra) + CI green
- If review approves: merge. If new findings: another iteration.
- Phase D (T-bednění productivity calibration, golden-rimsa fixture) starts post-merge per `next-session.md`.

---

### 2026-05-26 — Session: Týden 3 Knowledge Integration top-5 (codegen pipeline + 5 integrations)

**Topic:** Build-time TS codegen pipeline activated — `kb/*.yaml` → `Monolit-Planner/shared/src/kb-generated/*.ts` → engines. Top-5 integrations per audit `2026-05-14_inventory_with_gcs.md` shipped: TKP18 maturity tables, Pokorný/Suchánek pour sequences, DOKA Frami katalog (10 systémů), ČSN EN 12812 / DIN 18218 lateral pressure, ÚRS/OTSKP routing per project_type. Codegen tool = plain Node.js (`scripts/gen-knowledge.mjs`, no transpile). CI drift check (`npm run gen:knowledge:check`) wired do `.github/workflows/monolit-planner-ci.yml` jako pre-test step.

**Rozhodnuto:**
- **Scope:** Partial Top-5 only (NE full Variant D migration — to je Týden 4+).
- **Python codegen:** TS-only. Core engine dnes nečte tyto matrices (B2/B3 jsou loaded jen pro LLM context), Python output by byl dead weight.
- **DIN 18218 zdroj:** ČSN EN 12812 + Pokorný/Suchánek + DOKA/PERI brochury jako free fallback. Nákup DIN 18218 (~€100) odložen.
- **PR strategy:** 1 velký PR (codegen infra je shared dependency všech 5 tasks; atomic 5 PRs by způsobil merge konflikty na `kb/` struktuře).
- **Codegen tool stack:** plain Node.js + `js-yaml` (no zod/ajv, manual structural validation). 5 YAMLs = ~30 LOC validator per integration; upgrade na schema lib pokud integration count >10.
- **Namespacing v `kb-generated/index.ts`:** `export * as TKP18_MATURITY from './tkp18-maturity.js'` per module (per-modul `SOURCE_CITATION` symbol collision jinak crashne index re-export).
- **Engine wire-up pattern:** import KB constant + alias to existing local name (`const CURING_DAYS_TABLE = KB_CURING_DAYS_TABLE`). Public API stays identical → 1136 existujících testů zelených bez modifikace.
- **DOKA Frami catalog wiring:** spread `...KB_DOKA_FORMWORK_SYSTEMS` na začátku `FORMWORK_SYSTEMS[]`, PERI/ULMA/NOE/traditional zůstávají inline. 10 DOKA entries (Frami, Framax, Top 50, Dokaflex, SL-1, 3× Římsové, Staxo 100, DOKA MSS) přesunuto verbatim do `kb/doka_frami_catalog.yaml`.
- **Test counts:** baseline byl ve skutečnosti **1136** (NE 1088 jak píše CLAUDE.md, ani 1158 jak píše task brief). Po session: **1174 testů, 27 files** (1136 + 38 new in `kb-generated.test.ts`).

**Odmítnuto:**
- Full `kb/` migration všech 9 B-buckets v jedné session — Týden 4+ work.
- Replace `pour-decision.ts:ELEMENT_DEFAULTS` celý — engine-level Record<StructuralElementType,…> s strict exhaustiveness, refactor je riskantní pro 1088+ existujících testů. Místo toho přidán paralelní `POUR_SEQUENCES` katalog (textbook recommendations), ELEMENT_DEFAULTS zůstává v engine.
- Acquire DIN 18218 standard — ČSN EN 12812 + literatura kryje real CZ use cases.
- Husky pre-commit hook na `gen:knowledge` — script je rychlý ale přidává friction; CI drift check stačí.
- Python codegen — žádný Core consumer dnes neexistuje.

**Otevřené otázky:**
- Pokud Core (Python) začne v budoucnu konzumovat strukturované matrices (např. pro REST endpoint vracející TKP18 limity), schema lift do `kb/_schema/*.json` (language-neutral) + paralelní Python renderer v `gen-knowledge.mjs` (cca 1-2 dni práce).
- `tkp18_maturity.yaml` má `default_curing_class_by_element` jako plain `Record<string, 2|3|4>` — engine ho castuje na `Partial<Record<StructuralElementType, CuringClass>>`. Pokud někdy přibude element_type který je v YAML ale ne v `StructuralElementType` union, cast je sice nepravdivý ale runtime OK. Sledovat při Týden 4 element type rozšířeních.
- Drift check v CI běží ze workspace root (`npm ci || npm install` fallback) — pokud npm ci selže na první-time `package-lock.json` regenerate, install na CI vezme ~30s nav?ic. Akceptováno.

**Co dál:**
- **Vanilla GPT vs STAVAGENT re-test** (per task POST-TASK section): ověřit, že STAVAGENT teď cituje konkrétní TKP18 čísla s `pjpk.rsd.cz` referencí (data je v `SOURCE_CITATION` exportu).
- **Týden 4** — kandidáti pro další codegen integrations: B3 PERI katalog (parallel s DOKA, ~17 systémů), B4 production benchmarks (rebar matrix už máme jako TS, OK), B9 equipment specs (pump/crane catalog).
- **Týden 5** — Geometry Calculator (per task explicit non-goal pro tuto session).
- **Potenciální follow-up:** přidat husky pre-push hook na `npm run gen:knowledge:check` (kompromis mezi pre-commit friction + pure-CI drift discovery delay).

**Artefakty této session:**
- `docs/specs/knowledge-codegen-pipeline/{requirements,design,tasks}.md` (spec triple)
- `docs/architecture/knowledge_codegen_pipeline.md` (1-page reference)
- `scripts/gen-knowledge.mjs` (codegen tool, ~350 LOC)
- `kb/` (5 YAML zdrojů)
- `Monolit-Planner/shared/src/kb-generated/` (6 souborů: 5 generated + index)
- `Monolit-Planner/shared/src/kb-generated/kb-generated.test.ts` (38 testů)
- Updated: `package.json` (gen:knowledge scripts + js-yaml dep), `maturity.ts`, `lateral-pressure.ts`, `formwork-systems.ts`, `monolit-planner-ci.yml`

---

### 2026-05-25 — Session: Pattern 15 + 16 codified — Work-First Catalog-Last + Universal Work Ontology

**Topic:** Architectural patterns codification. Pattern 13 (Synthetic Metrics) + Pattern 14 (Forward-tracked _analytical_journey) były přidány paralelně. Tato session přidává Pattern 15 + 16 jako logické rozšíření — workflow discipline + international expansion strategy.

**Rozhodnuto:**
- **Pattern 15: Work-First, Catalog-Last** — 3-stage workflow (work atomization → decomposition on demand → manual catalog mapping). HK212 sequential_list (138 items, 11 Fází, `build_sequential_list.py` + `split_hsv1_028.py`) je referenční implementace. **Rule: never auto-catalog-match during Stage 1.** Catalog mapping is debugging aid, not authoring tool. Pattern 13 (Synthetic Metrics) failure mode is exactly what this pattern prevents.
- **Pattern 16: Universal Work Ontology** — architectural principle pro international expansion. Construction work = universal across CZ/DE/ES/FR; what differs = local catalog codes + pricing conventions + tender formats. STAVAGENT item generation produces catalog-agnostic items; catalog binding = adapter layer per market (`czech_kros_adapter.py`, `german_bki_adapter.py`, `spanish_fiebdc_adapter.py`, `french_batiprix_adapter.py`). Same items.json → N catalogs → N markets covered. Domain knowledge transfer rule: přípravář workflow learned in HK212 directly applicable to DE/ES/FR after adapter translation.
- **Implementation roadmap (Pattern 16):** ✅ CZ work ontology established (HK212 138 items); ⏳ universal work_ontology JSON schema extraction (separate task); ⏳ formal KROS adapter wrapping Pattern 11; 🔮 BKI/FIEBDC/Batiprix adapters.
- HK212 sequential list workflow (Cesta A) **proven correct** — flat ordered list with NO auto-codes is the only honest output until Stage 3 manual mapping.

**Odmítnuto:**
- Auto-catalog-matchers as authoring tools (Pattern 13 false-positive failure mode established this is wrong)
- Forcing single catalog (KROS) on multi-market roadmap (Pattern 16 explicitly decouples)
- Tight coupling between work generation engine + catalog adapters (architectural decision: separate layers)
- Generating Pattern 15/16 reference implementations now (HK212 build_sequential_list.py already serves this role)

**Otevřené otázky:**
- Universal work_ontology JSON schema canonical form — separate task, extract from items.json schema + flag what's CZ-specific vs universal
- KROS adapter formalization — when to refactor Pattern 11 ad-hoc matching into `czech_kros_adapter.py`
- First non-CZ market choice — DE (BKI biggest commercial) vs ES (FIEBDC simplest format) vs PL (proximity)

**Co dál:**
- Apply Pattern 15 to RD Jáchymov + Žihle in retrospect — verify they followed 3-stage workflow naturally
- Extract universal work_ontology JSON schema as discovery task
- Next pilot project: validate Pattern 15 Stage 1 → Stage 2 → Stage 3 cleanly separable

**Branch:** `claude/patterns-15-16-work-first` (this commit)

---

### 2026-05-24 — Session: HK212 soupis_praci retired → sequential_list (cleanup + retrospective)

**Topic:** Cleanup pass after fresh-eyes review of `hk212_soupis_praci.xlsx` exposed systematic KROS auto-match false positives. `soupis_praci/` removed from main; replaced by `sequential_list/` (shipped via PR #1210) — flat ordered list of 128 items in logical construction sequence with NO codes (manual user-fill workflow).

**Rozhodnuto:**
- **Retire `test-data/hk212_hala/outputs/soupis_praci/`** — 6 files removed from main: `hk212_soupis_praci.xlsx`, `hk212_soupis_praci.json`, `kros_match_report.md`, `kros_match_results.json`, `preflight_inventory.md`, `HANDOFF_TENDER_READY.md`.
- **`sequential_list/` already shipped** via PR #1210 (squash commit `309e2ee0` on main) — single XLSX + CSV + JSON re-ordering all 128 items.json items into 11 construction phases (PŘÍPRAVA → ZEMNÍ → ZÁKLADY → OK → KINGSPAN → KLEMPÍŘ → VÝPLNĚ → IZOLACE → PODLAHA → PŘESUN → KOLAUDACE), 68 sub-step kroky. No codes, no prices, no classification.
- **`items_hk212_etap1.json` is canonical** — 128 items unchanged across both retire + sequential ship.

**Odmítnuto:**
- Patching the broken matcher in-place (root cause is matcher logic, not data — would take weeks of negative-context filter work and Tier-assignment audit; flat-list pivot is days)
- Keeping `soupis_praci/` as historical reference (causes confusion + risk of being shipped to investor by mistake; retrospective lives in soul.md + Pattern 13 instead)
- Re-running matcher with tighter thresholds (61.7 % Tier 1 was already at the target — the bug is that Tier 1 0.85 confidence was assigned to obviously wrong matches, not that confidence was too low)

**Otevřené otázky (root-cause carry-forward):**
- Matcher false-positive pattern: KROS code `763158122` "Podlaha ze sádrokartonových desek" matched stěrka podlahy in PSV-77x at Tier 1 conf 0.85 — keyword-only `podlaha` match without chapter / material / structural context filter.
- 7 cross-domain contamination examples shipped at 0.85: `985121101` tryskání degradovaného betonu (historical reno → new hala), `127401401` hloubení rýh pod vodou pro nábřežní zdi (no water on parcel), `155132111` protierozní geobuňky (roadwork → cladding), `711331383` izolace mostovek (bridge → sokl HI), `342191211` polyester foil opláštění (Kingspan PUR/PIR ≠ folie), `311311971` nadzákladové zdi do ztraceného bednění C 8/10 repeated 4× including 106 m³ that was actually the floor slab.
- Tier-assignment logic apparently does not validate chapter context — a code matched on word `podlaha` lands in any chapter with "podlaha" in its name regardless of code's actual KROS chapter (763 = SDK, ≠ industrial floor 776xxx).

**Co dál:**
- **Pattern 13 added — "Synthetic acceptance metrics mask correctness."** (Pattern 11 + 12 already taken by KROS FTS + squash-merge orphans from prior session — see STAVAGENT_PATTERNS.md.) Hitting "61.7 % Tier 1 above 60 % target" said nothing about whether Tier 1 matches were correct. Domain validation (human spot-check on N representative rows per kapitola, checking chapter + material + structural fit) is required alongside any synthetic threshold gate. Threshold gates without domain check ship false positives at "confident" tier.
- Lesson generalized: any auto-match pipeline (KROS, URS, classifier, …) must have a chapter-context filter in matcher itself (negative-context skip like CORE `_safe_search()` does for stávající/demolice) AND a sampling QA gate on output before "Tier 1" badge is allowed.
- **Workflow pivot:** for HK212 + next pilots until matcher fixed, ship `sequential_list/` (no codes) + leave KROS/URS fill to user. No more `soupis_praci/` outputs from auto-matcher until chapter-context filter lands.
- Future task: backlog item to add negative-context + chapter-bucket filter to KROS matcher (concrete-agent `pricing/otskp_engine.py` + Monolit-Planner classifier), with N-row domain QA gate before Tier 1 confidence allowed.

**Branches / PRs:**
- `claude/hk212-sequential-list` → PR #1210 → main `309e2ee0` (sequential_list ship, auto-merged)
- `claude/hk212-cleanup-soupis-praci` (this cleanup commit — soupis_praci removal + Pattern 13 + this soul.md entry) → PR to follow

**Session retrospective:** `test-data/hk212_hala/outputs/sequential_list/HANDOFF_SEQUENTIAL.md` + `docs/STAVAGENT_PATTERNS.md` §Pattern 13

---

### 2026-05-24 — Session: HK212 IGP integration + Kingspan + patky rework + Soupis prací pipeline

**Topic:** Major HK212 finalization session — IGP delivered (ALTAGEO 526026), TZ statika Kingspan quote integrated, A105 patky geometry rework (correction of F-3 over-fix), soupis prací end-to-end pipeline (preflight → KROS FTS matching → Excel + JSON). Merged via PR #1208 squash.

**Rozhodnuto:**
- **IGP integration**: ABMV_11 + ABMV_17 closed (geotech kategorie 1, Rdt=250 kPa, plošné založení primary). Pilot items HSV-2-010..012 flagged `alternative_variant_per_IGP_not_required` (retained for variant bid). New HSV-1-028 výměna aktivní zóny 269.25 m³. HSV-1-001 figura 222.75 → 323.1 → 210 m³ (3-pass refinement: theoretical → IGP flat → zone-by-zone A201 + A105).
- **Kingspan specs hardened** per statika D.1.2 quote: KS NF 200 mm Hradec Králové (stěnové), KS FF-ROC 200 mm Lipsko (střešní). `_review_thickness` removed (statika explicit). Confidence 0.90 → 0.95.
- **Patky pyramida correction** (F-3 over-fix → A105 reality): rámové 14 (bednění math) → 10 (statika rozteč 6.1 m × 5 rámů + A105 manual count). Dvoustupňová PYRAMIDA (dolní 1.5×1.5×0.6 + horní 1.25×1.25×0.6), NOT prismatic 1.5²×1.2. HSV-2-001 beton: 37.8 → 27.0 → 22.875 m³. Štítové H=1.2m typo resolved (ABMV_21 new + resolved).
- **Deska scope** via A105 měřené 19.04 × 27.90 = 531.22 m² (vs TZ ARS podlahová 495 m²). HSV-2-013: 99.0 → 106.24 m³. KARI ×2 vrstvy: 1955.25 → 2098.3 kg each.
- **ABMV_5 re-opened**: 2:2 split (A101+A105 = C30/37 vs TZ ARS+statika = C25/30). `_review_concrete_class` flag.
- **ABMV_22 new**: A201 BILANCE ZEMINY label present ale unfilled — user zone-by-zone analysis substitutes.
- **Soupis prací pipeline** (4-phase atomic): preflight inventory + KROS FTS5 matching + 13-sheet XLSX + handoff. **61.7 % Tier 1** above 60 % target. Iterations: 44.5 % (strict MJ) → 57 % (MJ-first) → 61.7 % (+ equivalence classes).
- **Verdict 🟡 YELLOW** — bid-stage usable; 3 critical ABMV (3, 19, 5) require resolution před tender submission.

**Odmítnuto:**
- Pilot variant addition to bid (HSV-2-010..012 stay flagged alternative)
- Stage E benchmark vs example_vv corpus this session
- PDF rekapitulace (reportlab missing — deferred P3)
- Cena fill (user directive: separate workflow)
- HSV-3 IPE 160 mass drift +11.4 % bump (flagged only — PROFILY DXF deferred)
- Amazon Q false-positive suggestions (MD5 for non-crypto dedup, missing zero-guard for fixed-128 input, `json.load(open(...))` style — alarmist scanner noise, not real bugs)

**Otevřené otázky:**
- 3 critical ABMV blocking tender: ABMV_3 stroje specs (HIGH cost), ABMV_19 plochy 3-source drift (MEDIUM VRN poplatky), ABMV_5 beton class 2:2 split (MEDIUM ~10-15 tis CZK)
- 12 unresolved ABMV total (3 critical, 7 important, 2 minor)
- HSV-3 PROFILY DXF geometry reconciliation deferred
- Klempíř lemy detail výkaz needed (PSV-OPL-005 + PSV-78x both `_review_qty`)

**Co dál:**
- Send to SOLAR DISPOREC po investor resolution 3 critical ABMV + cena fill
- 2 new patterns ratified: **Pattern 11** (KROS FTS + MJ equivalence), **Pattern 12** (squash merge branch cleanup)

**Branches:**
- `claude/hk212-dilenska-ok-ut-dps-integration` (15 commits IGP + Kingspan + rework + F-1..F-5 fixes) — squash-merged into soupis-praci-final → PR #1208 → main `9493cdd7`. Stale ghost-banner pending manual delete (Pattern 12).
- `claude/hk212-soupis-praci-final` (4 phase commits + merge conflict resolution) — squash-merged PR #1208.

**Session retrospective:** `test-data/hk212_hala/outputs/soupis_praci/HANDOFF_TENDER_READY.md`

---

### 2026-05-23 — Session: HK212 fresh-eyes read-only audit

**Topic:** Read-only audit cross-checking items.json (127 items at time of audit), Step 3 area_aggregates, ABMV queue proti TZ ARS D.1.1 + PBR table 10 II. SPB + STAVAGENT_PATTERNS.md. Single deliverable: `test-data/hk212_hala/outputs/audit_2026_05_23_fresh_eyes.md`.

**Rozhodnuto (5 findings):**
- **F-1 P0** — `area_aggregates.json vrata_sekcni.size_m` stale `[3.0, 4.0]` po ABMV_2 closure → PSV-OPL-001/002 mn 536.4 should be **528.5** m². +9.2 % otvory drift unflagged.
- **F-2 P1** — ABMV_1 closure premature: PBR = 21 ks stropní (61.2 kW); DXF Stage C = 40 ks (84 kW). 19 ks ghost. User instruction: SKIP this session.
- **F-3 P1** — HSV-2-001 patky inconsistency: beton 18.9 m³ implies 7 patek, bednění 100.8 m² implies 14. Fix to 14 (later corrected 2026-05-24 to 10 per A105 manual count + dvoustupňová pyramida geometry).
- **F-4 P1** — ABMV_18 evidence: TZ ARS p3 patky = C16/20 XC0 explicitly; ABMV_18 working_assumption claims statika says C25/30 for patky — unsupported. items.json correct, ABMV closed.
- **F-5 P2** — Pattern 8 numbering duplicate in STAVAGENT_PATTERNS.md. Rename second to Pattern 9 + move před Anti-patterns.

**Odmítnuto:**
- Any mutation of items.json (read-only audit)
- Re-opening ABMV_1 (user directive)

**Otevřené otázky:** Phase 2.1 readiness 🟡 YELLOW pending P0+P1 (~2 h work to GREEN)

**Co dál:** all 5 findings resolved 2026-05-24 except F-2 (deferred per user). F-3 second iteration after A105 evidence delivered correct count.

**Branch:** `claude/hk212-dilenska-ok-ut-dps-integration` (audit commit `2e256524`)

---

### 2026-05-22 — Session: HK212 Stage A→E + Step 3 polygonization (P0 Kingspan resolved)

**Topic:** HK212 hala (Hradec Králové, SOLAR DISPOREC) — full pipeline from DXF discovery housekeeping through Stage E Kingspan P0 blocker resolution. 12 commits on `claude/hk212-dilenska-ok-ut-dps-integration` branch, ~30K LOC modifications across 5 phases. Companion branch `claude/hk212-step3-polygonization-areas` preserved for debug story (3 atomic commits).

**Commits (12):**
- `2a6c9034` Stage A/B/C: B5 steel-profile catalog + UT_HALAHK_DPS DSP discovery
- `b23fff07` dilenska→dsp_dxf housekeeping rename (DSP-grade DXF confirmation)
- `5064753f` Task 2 Step 1: layer dictionary auto-detect (100 % coverage achieved)
- `a74c8ed2` Task 2 Step 1.5: A-GENM dossier (Lindab + MEARIN reveal) + dictionary ratification
- `75221920` Task 2 Step 2: full geometry extraction across 8 DSP DXFs (29 categories)
- `0b22136f` Stage D: 22 items dropped (15 VZT + 7 Rpol) + HSV-3 _length_source + 4 ABMV closures
- `d1bbde80` Step 3: polygonization + 9 area metrics + items.json annotation (separate file)
- `0065cae9` Step 3: handoff doc + acceptance scorecard
- `5bdfa22e` Step 3: slope disambiguation fix (5.25° vs 5.65° gate angle) + kapitola coverage audit (P0 Kingspan blocker found)
- `43f7ba19` Merge step3 → dilenska (no-ff, debug story preserved)
- `2a02bff5` Handoff doc finalized after merge
- `af55d317` **Stage E: P0 Kingspan resolved** — 8 PSV-OPL items (TZ ARS DPZ specs) + ABMV_2 vrata 3500mm + Pattern 8

**Rozhodnuto:**
- DXF stupeň = DSP (NE dílenská) — workshop-level detail v DSP scope. Rename housekeeping done.
- 9 area metrics canonical from Step 3 polygonization: zastavěná 538.5 m², obvod 103.5 m, střecha brutto 556.5 m² / netto 558.8 m², fasáda brutto 623.3 m² / netto 536.4 m², výška 6.02 m, výkop 99.3 m³ (default w/d), podlaha 538.5 m² fallback.
- ABMV_2 vrata: TZ ARS DPZ D.1.1 wins (3500 × 4000 mm) over DXF block name template (3000 mm). Confidence 0.5 → 0.90.
- PSV-OPL kapitola added with 8 items per TZ ARS DPZ concrete specs (NOT generic audit doc placeholders): obvodový Kingspan KS1000 AWP tl. 200mm MW bílá+modrá, střešní MW EW 15 DP1, klempíř lemy, spojovací materiál, doprava, statika. `_price_source: "user_skipped_pricing"` na všech.
- items.json 141 → 119 (Stage D) → 127 (Stage E).
- Pattern 8 zapsán do `docs/STAVAGENT_PATTERNS.md`: "Re-read TZ before generating new položky".

**Odmítnuto:**
- Per-room floor polygonize (deferred — floor LINEs neuzavírají loops, per-room split potřebuje cluster-by-bbox + MTEXT room-label proximity match).
- `dedup_dxf_replicas.py` standalone util — zatím inlined v `step3_polygonization.py:dedup_lines`.
- Block-name pseudo-schedule parser — separate task (P3 backlog).
- Per-record auto-mutation of mnozstvi z geometry metrics. Annotate-before-mutate princip = NEVER auto-mutate. Output je separate `items_*_with_geometry.json` file.

**Otevřené otázky:**
- HSV-1 výkop figura: 222.75 m³ (z RE-RUN §3.10 formula `495 m² × 0.45`) vs Step 3 zastavěná 538.5 m². Buď update HSV-1-001 → 538.5 × 0.45 ≈ 242 m³, NEBO ABMV pro 538 vs 495 reconciliation. Defer to user.
- Roof Kingspan tloušťka: TZ ARS neuvádí explicitně → `_review_thickness: True` na PSV-OPL-003. Ověřit u projektanta / statika D.1.2.
- Klempíř lemy qty: 207 bm = 2× obvod estimate. `_review_qty: True`. Potřebuje klempířský detailní výkaz.
- HSV-3 mass reconciliation: 10263 kg IPE 400 ze statika vs kusovník 2 schedule INSERTs vs structural_columns 141 real cols. Deferred from Stage D.

**Co dál:**
- **Stage E benchmark vs example_vv corpus** — 7 výkazů + 6 PDF výkresů. Recommended option (b) coverage. Now meaningful (P0 resolved).
- **HSV-3 mass reconciliation** — use Step 3 perimeter 103.5 m × foundation cross-section to refine kg/m³.
- Memory consolidation: 8 patterns destilované do soul.md §6.6a (Re-read TZ, DSP detail trap, Ghost razítko, Layer ratification gate, Annotate-before-mutate, Profession scope-cut hygiene, Long-session context decay, Block-name pseudo-schedule).

**Session retrospective:** `docs/sessions/2026-05-22_HK212_StageABCD_Step3.md`

---

### 2026-05-21 — Session: Říms calibration — Phase A discovery audit

**Topic:** Phase A (audit only, no code) of `docs/tasks/TASK_Rimsa_Calibration_FullStack_v1.md`. Covered Phase A.1 (endpoint discovery), A.2 (golden test inventory), A.3 (UI components), A.5 (test inventory), A.6 (field visibility per element=rimsa), A.7 (KB inventory + hardcoded matrices), and B (architecture analysis prep). Spawned 5 parallel `Explore` subagents to keep the breadth manageable. Single deliverable: `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`.

**Rozhodnuto:**
- Říms workflow spans **~35 surfaces across 5 services** (concrete-agent MCP tools + FastAPI, Monolit-Planner backend routes + shared calculators, frontend UI). At least 21 are rimsa-aware, 4 partial, 10 unaware.
- **3 independent sources of truth for rimsa values** — Python MCP `classifier.py` (rebar 130, difficulty 1.4), TS `element-classifier.ts` ELEMENT_CATALOG (rebar 120, difficulty 1.15), B4 YAML stubs (missing). Task target: rebar 140. ⇒ DRY violation table in §B.1 of the audit.
- **Curing-class wiring bug suspected** — `DEFAULT_CURING_CLASS[rimsa]=4` exists in `maturity.ts:611` but is not threaded through `planner-orchestrator.ts:1652`. Net effect: rimsa likely computes ~5 d @ 15 °C instead of TKP18 §7.8.3-required 9 d. Needs 15-min direct repro before Phase C.
- **12 hardcoded matrices** in TS engines that should live in `B*` KB YAML (`EXPOSURE_MIN_CURING_DAYS`, `CURING_DAYS_TABLE`, `DEFAULT_CURING_CLASS`, `T_WINDOW_HOURS`, `ELEMENT_DEFAULTS`, `RECOMMENDED_EXPOSURE`, k-factors, `PILE_PRODUCTIVITY_TABLE`, `ELEMENT_CATALOG`, `REQUIRED_FIELDS`, `SANITY_RANGES`, `FORMWORK_SYSTEMS`). Each = one bug ticket. Per task §10, full migration is out of scope — only `rimsa.yaml` + `T_bedneni.yaml` get created in Phase D.
- **Refactor blast radius mapped.** Per-tact cycling + integer-shift refactor in `element-scheduler.ts` is HIGH-risk for `mostovkova_deska` (MSS coupling), `stena`, `sloup`, `stropni_deska`; MEDIUM for 8 types; LOW for 2; N/A for pilota (early bypass).
- **8 open questions** raised for Alexandra at the bottom of the audit, gating Phase C.

**Odmítnuto:**
- Writing any engine code, creating any YAML, opening any PR. Phase A is explicitly read-only.
- Migrating the 12 hardcoded matrices into KB YAML now (out of scope per task §10).
- Trusting subagent claims about `getSuitableSystemsForElement` line numbers (two subagents reported divergent ranges `1029–1040` vs `1150–1168`); audit notes the divergence and defers cross-check to Phase C.
- Treating `test-data/tz/SO-250_golden_test.md` as present (it's not — actual location is `test-data/SO_250/tz/SO-250.md`, spec-only, not a Vitest fixture). Flagged as Q1.
- Treating SO-206 fixture as expected (no `SO-206_*` file in repo). Flagged as Q2.

**Otevřené otázky:** All 8 listed at the bottom of `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`. Headline:
- Q1: SO-250 path mismatch — relocate or update task?
- Q3: Source-of-truth resolution (Python MCP vs TS catalog vs B4 YAML) for Phase C
- Q4: Curing-class bug — direct repro before Phase C or trust subagent?
- Q5: Scheduler refactor gated behind opt-in flag per element, or one clean refactor?
- Q7: 30-min directed read of `mcp/tools/calculator.py` to settle MCP/Monolit boundary?

**Co dál:**
- Alexandra reviews audit + answers 8 open questions
- Phase C kicks off (scheduler core refactor) per task spec, with answers in hand
- Bug ticket file `backlog/calc_hardcoded_to_kb.md` to be opened by Phase D session, not now

**Files changed:**
- `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md` (new, ~400 lines)
- `docs/soul.md` §9 (this entry)
- `next-session.md` (overwrite with říms Phase A handoff)

**Branch:** `claude/rimsa-calibration-phase-a` (created from `claude/bootstrap-code-skills-ecPCE`)

---

### 2026-05-21 — Session: Bootstrap Claude Code Skills + Discipline Infrastructure

**Topic:** Phase 1 audit + Phase 2 bootstrap of `.claude/skills/` directory per task `docs/tasks/2026-05-20-rimsa-mcp-agent/stavagent-session-discipline-SKILL.md`. Foundation for upcoming říms calibration task (TASK_Rimsa_Calibration_FullStack_v1.md).

**Rozhodnuto:**
- **Skills location:** Project-local `.claude/skills/` (versioned in git, synced into Project Knowledge weekly per skill §7).
- **Root vs docs/:** Keep existing files in `docs/` (no duplication). `docs/STAVAGENT_ClaudeCode_Session_Mantra.md`, `docs/STAVAGENT_PATTERNS.md`, `docs/KNOWLEDGE_PLACEMENT_GUIDE.md` stay canonical at their existing paths. Skills reference these `docs/` paths, not phantom root duplicates.
- **process.md:** Not created. `docs/steering/conventions.md` is canonical for process/workflow content (already covers task structure §9, workflow §11, gates §7, communication §8). Sync list in `stavagent-session-discipline` §7 reflects this.
- **Skill scope:** Two skills bootstrapped — `stavagent-session-discipline` (verbatim from upload, 8 rules) + `stavagent-claude-code-tasks` (codified from `conventions.md` §9-§10). `stavagent-schema-designer` skipped (not in task scope).
- **CLAUDE.md update:** Added single section under Mandatory reading block referencing `.claude/skills/`. No rewrite of existing content.

**Odmítnuto:**
- Creating root-level mantra/patterns/knowledge_placement files. Task spec suggested it but existing canonical paths win — no parallel structures rule.
- Creating new `docs/steering/process.md`. Content already in `conventions.md`.
- Backfilling historical session logs into §9 (start from this entry).
- Migrating `stavagent-schema-designer` from Project Knowledge — out of scope, needs separate session.

**Otevřené otázky:** —

**Co dál:**
- Sync `.claude/skills/` to Project Knowledge on claude.ai (manual, weekly cadence per skill §7).
- Begin říms calibration task with the new skill infrastructure active.
- Optionally migrate `stavagent-schema-designer` in a follow-up session if Alexandra confirms scope.

**Files changed:**
- `.claude/skills/stavagent-session-discipline/SKILL.md` (new, ~210 lines, verbatim from upload with corrected paths to `docs/`)
- `.claude/skills/stavagent-claude-code-tasks/SKILL.md` (new, ~240 lines, codified from conventions.md §9)
- `.claude/skills/README.md` (new, ~85 lines, directory index)
- `CLAUDE.md` (+8 lines, skill reference under Mandatory reading block)
- `docs/soul.md` §9 (this entry)
- `next-session.md` (overwrite — handoff for říms calibration)

**Branch:** `claude/bootstrap-code-skills-ecPCE`

---

### 2026-05-20 — Session: MCP Dynamic Client Registration (RFC 7591) + YAML loader

**Topic:** Two-PR work session closing TASK_DCR_KBYamlLoader.md (DCR endpoint missing + YAML loader skip), three subsequent CI-fix commits triggered by post-merge Amazon Q review, and post-deploy verification (V1-V4). Spanned 9 gates of gate-based implementation plus 1 deploy runbook gate. Ended with post-deploy V1 503 caused by `gcloud --set-env-vars` wiping VPC connector + REDIS_URL on force rebuilds; fixed via explicit `--update-env-vars` re-apply.

**Rozhodnuto:**
- **PR #1189 (DCR)** — branch `claude/mcp-dynamic-client-registration-x7Kb2`, 12 commits, ~5K LOC, 177 tests (3.49s). Architecture per Q1-Q6 interview: separate `mcp_oauth_clients` table (Variant B, not extending `mcp_api_keys`) + `mcp_oauth_codes` extended via migration 010 with NULLABLE `oauth_client_id` column + new `mcp_oauth_tokens` table (sat-{hex48} access + srt-{hex48} refresh, 1h/90d TTLs per OAuth canon). FK target asymmetry intentional: `mcp_oauth_tokens.user_api_key → mcp_api_keys(api_key)` for hot-path no-JOIN bearer lookup; `mcp_oauth_clients.created_by_user_id → mcp_api_keys(id)` for cold-path /token resolution.
- **Token formats** (Q3): `dcr-{hex24}` 96-bit client_id + `dcs-{hex48}` 192-bit client_secret + `sat-{hex48}` access + `srt-{hex48}` refresh — distinct prefixes for middleware dual-prefix routing. SHA-256+salt for client_secret (not bcrypt — 192-bit entropy on secret itself, verified every /token call).
- **Hybrid DCR auth** (Q2 sub-q a): public DCR (no Authorization on /register) → `created_by_user_id=NULL` → client_credentials issues `user_api_key=NULL` token → paid tools return 402 `user_consent_required`. Authenticated DCR (Bearer sk-stavagent-* on /register) → binds, credits attribute. authorization_code flow always full-user-bound via consent form.
- **/authorize inline HTML consent form** (Gate 4.5) — minimal styled page, no JS, no external assets, XSS-escaped via `html.escape()` on every interpolated string. User pastes sk-stavagent-{hex48} api_key → POST → 303 redirect with code bound to (user_api_key, oauth_client_id). MVP shortcut; replace with Portal SSO cookie + auto-consent before Claude Directory submission.
- **Refresh-token rotation** per OAuth 2.0 BCP §4.14: rotate revokes old + mints new with `rotated_from=old.id`. Replay of revoked refresh → WITH RECURSIVE chain revoke of all descendants.
- **Redis-backed rate limit** (Gate 6) — atomic Lua INCR-with-conditional-EXPIRE, 10/IP/h, X-Forwarded-For leftmost IP, `MCP_RATE_LIMIT_WHITELIST` env bypass, fail-closed 503 on Redis outage (NOT in-memory fallback — explicit DoS-gate failure mode rejection). Audit row `status='rate_limited'` written on 429 path.
- **Dual-prefix Bearer routing in middleware** (Gate 5) — `sat-*` → `mcp_oauth_tokens` lookup with revoked + expiry checks; `sk-stavagent-*` → legacy `mcp_api_keys`; anything else → 401. AuthContext attached to `scope["state"]["mcp_auth"]` for downstream tool wrappers. Module extracted to `app/mcp/middleware.py` so tests don't need full FastAPI app graph.
- **CORS tightening on /mcp mount** — explicit `allow_methods=["GET","POST","OPTIONS"]` + `allow_headers=["Authorization","Content-Type","Mcp-Session-Id"]` + `max_age=86400`, NOT wildcard (incompatible with `allow_credentials=True`). Parent app CORS untouched (Portal/Kiosk APIs use wider allow-list).
- **PR #1190 (YAML loader)** — branch `claude/review-kb-yaml-loader-wR7If`, 1 commit, +500 LOC, 18 tests. `_load_yaml()` via `yaml.safe_load` (NEVER `yaml.load` — security). Dispatcher extended with `.yaml/.yml` between `.json` and `.csv`. `_SKIP_FILES = {".gitkeep", ".DS_Store", "Thumbs.db"}` + `_SKIP_SUFFIXES = {".zip", ".tmp", ".bak"}` silent skip with one aggregated `📦 Skipped N archive/temp file(s)` log line per category. `metadata.yaml` symmetric with `metadata.json` (YAML wins conflict with WARNING-level log signal, not INFO).
- **Three post-merge CI fixes** triggered by Amazon Q + manual CI failures:
  - **Gate A — migrations CI glob** (`.github/workflows/test-mcp-compatibility.yml`): replaced hardcoded `psql -f 007.sql; psql -f 008.sql` with `for migration in $(ls migrations/*.sql | sort)` to mirror runtime `startup_migrations.py`. Added Redis 7-alpine service container + REDIS_URL env. Added 5 new DCR test files to pytest run.
  - **Gate B — restored CORS headers on bare OPTIONS** in `app/mcp/middleware.py`: Gate 5 extraction had trimmed `BareOptionsAllowMiddleware` 204 response from 6 headers down to 3, breaking `test_bare_options_includes_credentials_methods_headers_max_age`. Restored full set: ACAO + ACA-Credentials + ACA-Methods + ACA-Headers + Max-Age + Vary.
  - **SQL injection bind refactor** in `mint_token_pair`: `NOW() + INTERVAL '%s seconds'` → `NOW() + (%s * INTERVAL '1 second')`. The single-quoted `%s` in INTERVAL literal is string interpolation (not bind); the `(%s * INTERVAL '1 second')` form routes the integer through proper psycopg2 parameter binding. Practical risk today is zero (call sites are module-level int constants), defensive against future user-input TTL.
- **9-step deploy runbook** at `docs/deployment/dcr_yaml_deploy_runbook.md` (773 lines) — pre-deploy checklist, mandatory merge order (YAML first, DCR second), migration chain verification, env var setup, two-step deploy with traffic flip, 5 startup log signals, 10 curl smoke tests, end-to-end claude.ai manual test, rollback procedure with DDL revert + Redis bucket clear, operational notes with TTL table + monitoring metrics, 6 post-deploy TODOs (CSRF, async last_used_at, Portal SSO, separate auth bucket, token cleanup job, Directory advertise-gating).
- **Post-deploy verification V1-V4** (TASK_PostDeploy_Verify.md). V2 ✅ (isolation leak closed — `Portal JWT required`), V3 ✅ (YAML loaded with valid dict values in B4 + B5 + B6 + B7 per local main checkout). V1 initially ❌ 503 because `gcloud builds submit` reads `cloudbuild-concrete.yaml` which lacks `--vpc-connector` + REDIS_URL → each force rebuild wipes them. Fixed via `gcloud run services update --vpc-connector=stavagent-vpc-connector --vpc-egress=private-ranges-only --update-env-vars=REDIS_URL=redis://10.229.246.227:6379` (revision 00372-bxh). V1 retest ✅ 201 + `dcr-4a3e8e117a5e67164098c830`. V4 ✅ retroactively via production logs at 09:11–09:19: three successful `POST /mcp/ 200` with `Processing request of type CallToolRequest` — real claude.ai-side tool calls already exercised the full chain before V4 was even run.

**Odmítnuto:**
- **Token storage as JWT** (Gate 4 alt T2) — stateless but no revocation list without separate DB; defeats refresh-rotation forensics.
- **Composite Bearer format `sat-...sk-stavagent-...` dot-separated** (Gate 4 alt T3) — hack avoiding new table; less RFC-compliant, harder middleware code.
- **Extending `mcp_api_keys` with nullable DCR-metadata columns** (Q1 Variant A) — concept-mixed (user vs OAuth client are different abstractions); declined for clean separation.
- **Async `update_token_last_used`** for the middleware hot path — psycopg2 is sync, needs asyncio.create_task + bounded thread-pool wrapper; deferred as MVP TODO (Gate 5). Current sync path is ~5-10ms on Cloud SQL primary-key UPDATE, acceptable because dominated by FastMCP tool execution.
- **Login + session-cookie consent UI for /authorize** (Q in Gate 4.5) — inline HTML form is MVP shortcut; proper Portal SSO + auto-consent is post-Directory-submission work.
- **Bcrypt on client_secret** — 192-bit entropy makes slow hashing wasted CPU; SHA-256+128-bit-salt with constant-time compare is the right primitive.
- **Permanent fix for cloudbuild-concrete.yaml** (add `--vpc-connector` + `REDIS_URL` to deploy step) — task §"ЧТО НЕ ВХОДИТ" explicitly excluded touching cloudbuild yaml. Deferred to separate PR. Without it, every force rebuild reintroduces the 503 regression until the manual `gcloud run services update` is re-applied.
- **Refactoring `_print_summary` counter quirk in kb_loader** — cosmetic, per task explicit exclusion.

**Otevřené otázky:**
- **B5 / B6 / B7 entry counts in production startup log are 5–18× lower than local main checkout** (production: B5=3, B6=7, B7=5; local V3: B5=54, B6=30, B7=16). Suggests `.dockerignore` / `.gcloudignore` excludes most KB files from Cloud Build context. B4 matches local count (10 / 2 YAML). Tools user actually exercises (find_otskp_code, calculate_concrete_works) don't need the missing entries, so not a blocker. Track in separate task — diff `.dockerignore` vs KB tree, confirm which nested paths are excluded, decide if they should be shipped.
- Should `cloudbuild-concrete.yaml` get explicit `--vpc-connector` + `REDIS_URL` flags so force rebuilds preserve them? Yes — but separate task; current session's task explicitly excluded cloudbuild changes.
- CSRF token on /authorize POST consent form — api_key acts as combined auth+CSRF today (192-bit secret unguessable by attacker); proper CSRF token + session cookie pair tracked alongside Portal SSO migration.
- Will `MCP_RATE_LIMIT_WHITELIST` env get wiped on next force rebuild same way REDIS_URL was? Currently empty default, so no observable failure mode — but same `--set-env-vars` overwrite mechanism applies. Track separately.

**Co dál:**
- **Permanent fix PR for cloudbuild-concrete.yaml** — add `--vpc-connector=stavagent-vpc-connector`, `--vpc-egress=private-ranges-only`, and `--update-env-vars=REDIS_URL=...` to the deploy step so force rebuilds preserve VPC + Redis automatically. ~10 min work, single yaml edit.
- **Diagnose B5/B6/B7 KB shipping mismatch** — `git ls-files` count vs production startup log count divergence. Likely `.gcloudignore` or `.dockerignore` rule excluding most of the tree.
- **Celery beat job for `mcp_oauth_tokens` cleanup** (runbook §10.5) — rows accumulate forever. Schedule daily 03:00 UTC, delete where `refresh_expires_at < NOW() - 30 days AND revoked_at < NOW() - 30 days`.
- **Portal SSO migration** for /authorize auto-consent (runbook §10.3) — replaces inline HTML form with one-click "Authorize" after Portal cookie established. Unblocks Claude Directory submission alongside CSRF token (§10.1).
- **Separate authenticated-DCR rate-limit bucket** (runbook §10.4) — current per-IP bucket lumps anonymous + authenticated requests from same NAT.
- **Sync this `soul.md` entry to claude.ai Project Knowledge** per workflow item #5 — was not synced this session.

### 2026-05-19 — Session: Landing CTA + CZ/EN terminology + prerender hash drift

**Topic:** Tři navazující landing-page PRs uzavřené v jedné session: #1136 (CTA route fix + manual prerender), #1138/#1183 (CZ/EN terminology audit + prerender hash drift fix). Začalo CTA "Vyzkoušet zdarma" → /register redirectem na /, skončilo production "buttons don't work" emergency po merge — root cause hash drift mezi committed snapshotem a vite-buildem.

**Rozhodnuto:**
- CTA "Vyzkoušet zdarma" routes unauthenticated users na `/login` (ne `/register`). `/register` redirectuje na `/` (separátní bug, P2, workaround logován v `BACKLOG.md` jako `register-route-redirect`). Login page má funkční odkaz "Nemáte účet? Zaregistrujte se" na registrační formulář.
- CZ terminologie cleanup v `LandingPage.tsx` + meta description: `smeta/smety/smetu/smety` → `rozpočet/rozpočtu/Rozpočet/Rozpočty` (Russian/Slovak loan); `bětonpumpa/bětonpumpy` → `čerpadlo betonu/čerpadla betonu`; `kran/kranu` → `jeřáb/jeřábu` (Germanism); `mechanizmy` → `stroje`. Aplikováno taky na strukturované `tov:` karty (unicode-escaped bloky).
- EN landing cleanup (`LandingPageEn.tsx`): odstraněny CZ glossary parentézy `(takty)` + `(betonáž)` v popiscích; module title `Klasifikátor stavebních prací` → `Klasifikátor — construction works classifier`; `Kalkulátor betonáže` → `Kalkulátor — concrete works calculator` (4 výskyty: module title + HowItWorks step 3 + FAQ entry + footer products list); bullety `Detail prvku` / `Plán objektu` → `Single-element detail` / `Whole-object plan`.
- **Prerender hash drift fix v `scripts/prerender.mjs`** — `applySnapshotIfPresent()` přepsáno: před copy snapshot → dist čte fresh `dist/index.html` vyrobený vite, extrahuje `/assets/*.{js,css}` list, a graft-replacuje stale references v snapshot HTML na fresh hashe match-by-name-prefix (`index-OLD.js` → `index-NEW.js`, `chunk-AAA-OLD.js` → `chunk-AAA-NEW.js`). No-op pokud hashe už shodné (happy local case). Verified injekce fake hashů + simulovaný build emituje rewrite log lines.
- Manual prerender regenerace (4 HTML soubory v `public/prerendered/`) zaházena do stejné PR jako source edits — workaround pro `prerender.yml` GitHub Action blokovaný `protect-main` branch protection (user preferuje nechat protection enabled).

**Odmítnuto:**
- Investigation root cause `/register` redirectu na `/` — separátní bug, workaround postačuje. Pravděpodobně auth-guard inverze v `App.tsx`, ale out of scope této session.
- Update `og:description` + `twitter:description` meta tagů ve `index.html` — pořád obsahují "přípraváře monolitů". Copy decision, ne technical, vyžaduje strategický kontext.
- Disable `SKIP_PRERENDER=1` na Vercelu pro forced full Puppeteer prerender — Vercel build container chybí GUI libs (libnss3, libxss1, libasound2) které Chromium dynamicky linkuje.
- Odstranění prerender snapshot systému úplně — ztratil by SEO prerender benefit (Google by viděl prázdný `<div id="root">`).
- Deterministic / stable filename mode v `vite.config.ts` (no content hash) — defeats cache busting.
- Rebuild brigády → čety přejmenování v `LandingPage.tsx:236` ("Brigada: 4 lidé + 2 čerpadla" v structured card) per CLAUDE.md "Čety, ne Brigády" rule — out of session scope.

**Otevřené otázky:**
- Měly by `og:description` + `twitter:description` být aktualizovány aby matchovaly nový "stavby" subtitle? Copy decision pro brand-konzistenci.
- Měl by `kalkulator.stavagent.cz` brand title (a footer list) napříč všemi 3 moduly přejít na `Kalkulátor` bez `betonáže` qualifier? Footer list už používá zjednodušený název post-cleanup, ale konzistence v jiných místech rozdrobená.
- Bude prerender hash drift fix ovlivněn pokud Vercel přidá `<link rel="preload" as="font">` nebo jiné non-asset references v budoucnu? Aktuální regex `\/assets\/([^"'\s>)]+\.(?:js|css))` je narrowly scoped na js/css — bezpečné.
- "Smeta" jako Russian loan acceptable v Czech construction context (běžně se používá)? Některé tooltips/comment by mohli zůstat s "smeta" pokud je to colloquial-OK. Konzervativně jsem nahradil všude.

**Co dál:**
- Sledovat next deploy main na Vercel — pokud hash drift opravdu nastává, build log by měl ukázat `[prerender] index.html: index-X.js → index-Y.js` lines.
- User verification v incognito: 6 kroků (hard refresh → subtitle "stavby" → klik "Vyzkoušet zdarma" → /login → "Zaregistrujte se" link → registrace). Po úspěchu → Google Cloud for Startups re-aplikace.
- Investigovat `/register` redirect root cause a optionally restore goCta na `/register` pro cleaner UX (separátní task).
- Rozhodnout o `Brigada` → `Četa` cleanup v landing structured cards.
- Audit pre-existing meta tagů (og/twitter description, twitter alt) pro coherentní subtitle messaging.

---

### 2026-05-19 — Session: CLAUDE.md SDD integration

**Topic:** Integrate `docs/steering/` + `docs/soul.md` workflow do root `CLAUDE.md` (handoff `docs/handoff/2026-05-19-claude-md-sdd.md`).

**Rozhodnuto:**
- Hlavička: `Version: 4.31.0 → 4.32.0`, `Last Updated: 2026-05-18 → 2026-05-19`.
- Přidána nová sekce `## 🚨 Mandatory reading at session start` mezi `**Repository:**` a `English TL;DR` blok — explicit pořadí 6 souborů (conventions → product → tech → structure → domain → soul) + povinný session-log template.
- Sekce `## 📐 Calculator Philosophy (POVINNÉ ČTENÍ)` — active reference přepnut z `docs/CALCULATOR_PHILOSOPHY.md` na `docs/steering/domain.md §1`. Starý path zůstává pouze v deprecation note s datem.
- Přidána nová sekce `## 📋 Workflow discipline (Spec-Driven Development)` mezi adaptive-thinking poznámku a `Key rules:` blok — hybridní model online/Code, životní cykly feature/bug, mapa "co update v jakém steering souboru", task-writing pravidla.
- Nový changelog entry v4.32.0 vložen na začátek seznamu (před v4.31.0). Všechny v4.24-v4.31 entries zachovány beze změny (Krit. 6 verified).
- 5 commits, jeden Gate = jeden commit, žádný rewrite, vše přes `Edit` str_replace.

**Odmítnuto:**
- Rewrite CLAUDE.md from scratch (per task §7).
- Cleanup historických changelog entries (per task §7).
- Trim CLAUDE.md k 300-line limitu (separátní follow-up taska).
- Update per-service CLAUDE.md souborů (`concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.MD`).

**Otevřené otázky:**
- Žádné — všechny edits byly mechanické per task §3.

**Co dál:**
- Patch `docs/steering/conventions.md` s pravidlem "Před `git mv` vždy zkontroluj SHA-256 zda target neexistuje" (Alexandr explicitně přislíbil v G.1 odpovědi).
- Separátní taska: trim CLAUDE.md na 300 řádků (currently 700+, mimo vlastní limit).
- Per-service CLAUDE.md soubory (concrete-agent, Monolit-Planner) — případně i tam přidat SDD mandatory-reading block, ale separate scope.

---

### 2026-05-19 — Session: Orphaned files & data/ cleanup

**Topic:** Cleanup 13 orphaned souborů v root repa + `data/peri-pdfs/` reorganizace (handoff in-conversation).

**Rozhodnuto:**
- 9 RD Jáchymov PDF + 4 hk212 DXF v root = **byte-identické duplikáty** existujících souborů v `test-data/{project}/inputs/{dokladova_cast,vykresy_dxf}/` (SHA-256 verified). Smazány `git rm` místo `git mv` — task §6.1/§6.2 navrhoval move do nového subfolderu, ale kanonická destinace už existovala (move by vytvořil třetí kopii).
- 3 soubory z `data/peri-pdfs/` přesunuty `git mv` (historie zachována):
  - `formwork_catalog_PERI_DOKA_2025.md` → `docs/reference/formwork_catalog_2025.md` (sjednocení se steering cheat-sheet)
  - `parse_peri_pdfs.py` → `scripts/parse_peri_pdfs.py`
  - `rimsa_element_spec_v2_DOKA_PERI.md` → `docs/specs/element/rimsa-v2-doka-peri.md` (single file, ne split — polished doménová reference, ne implementační spec)
- `data/` složka odstraněna (`rmdir`).
- `docs/steering/structure.md` §5 doplněn o zákaz orphaned root souborů + ad-hoc `data/` (verze bump 1.0 → 1.1).
- Classification report: `docs/handoff/2026-05-19-orphaned-files-classification.md`.

**Odmítnuto:**
- Vytváření `test-data/RD_Jachymov_dum/stavebni_povoleni/` a `test-data/hk212_hala/dxf/` (per task §6.1/§6.2 návrh) — kanonická lokace `inputs/dokladova_cast/` a `inputs/vykresy_dxf/` už existuje.
- Split `rimsa_element_spec_v2_DOKA_PERI.md` do req/design/tasks (per task §6.3.1 fallback — split až při aktivním rozpracování).
- Update stale `data/peri-pdfs/` odkazů v 10 audit/inventory dokumentech (per task §8 out-of-scope — audit docs = snapshot in time).
- Gate 5 (`test-data/_orphaned/`) — žádné neidentifikovatelné soubory.

**Otevřené otázky:**
- Konfirmace deviace `git rm` vs `git mv` pro Gate 2/3 (G.1 z classification reportu).
- Stale markdown references na `data/peri-pdfs/` v audit dokumentech — ponechat snapshot, nebo follow-up `chore/docs-fix-stale-peri-paths`?

**Co dál:**
- TASK: `docs/normy/` → `app/knowledge_base/B7_regulations/` (66 MB doménová data, per docs-audit findings §D.6)
- TASK: `docs/bugs/aplikovat-timeout/` real content fill z Project Knowledge (per task §8 mimo scope)
- TASK: `docs/{architecture,audits,competitive}/` → `docs/reference/` (per docs-audit findings §D.7 migration map)
- TASK: vyřízení 5 open questions z předchozí audit session (docs-audit-findings §F)

---

### 2026-05-19 — Session: Docs structure audit

**Topic:** Inventory aktuální struktury `docs/` proti steering plánu (handoff `docs/docs/handoff/2026-05-19-docs-audit.md`).

**Rozhodnuto:**
- 5 chybějících šablon dovytvořeno: `_TEMPLATE_spec/{design,tasks}.md` (autorské, mirror requirements.md stylu) + `_TEMPLATE_bug/{analyze,fix,verify}.md` (kopie z `bugs/aplikovat-timeout/` které slouží jako kanonická šablona).
- 4 prázdné `1` placeholdery od GitHub web UI smazány (`docs/templates/1`, `docs/templates/_TEMPLATE_bug/1`, `docs/templates/_TEMPLATE_spec/1`, `docs/bugs/aplikovat-timeout/1`).
- Findings report uložen na `docs/handoff/2026-05-19-docs-audit-findings.md` (sekce A–F per task §6).
- Migration map pre-existing folders (architecture/, audits/, competitive/, normy/) navržena, ale **nic se nemigrovalo** — separátní taska.

**Odmítnuto:**
- Migrace `docs/architecture/`, `docs/audits/`, `docs/competitive/`, `docs/normy/` — out of scope (per task §4 a §8). Pouze inventory + doporučení do reportu §D.
- Audit obsahu `docs/bugs/aplikovat-timeout/` souborů (per task §3.6 — řeší samostatná taska).
- Otevírat PR (per task §8 no-PR-unless-asked policy).

**Otevřené otázky:**
- Misnested `docs/docs/handoff/2026-05-19-docs-audit.md` — přesunout do `docs/handoff/`?
- Duplikát `CALCULATOR_PHILOSOPHY.md` (root vs `normy/navody/`) — která je kanonická?
- Branch name mismatch: task říká `chore/docs-structure-audit`, session-level pinuje `claude/docs-audit-2026-05-19-0G3lF` — použit druhý.
- Kdy spustit migraci pre-existing folders (architecture/, audits/, normy/, competitive/) do nové struktury?
- Cleanup deadline 2026-07-29 (Gate 2 leftover) — vztah k novému workflow?

**Co dál:**
- Reakce Alexandra na otevřené otázky F.1–F.5 z findings reportu.
- Samostatná taska `chore/docs-migrate-pre-existing-folders` (per §D.7 mapy).
- Pilot specs (`cross-user-isolation/`, `mcp-policy-engine/`) teď mají kompletní šablony k použití.

---

### 2026-05-19 — Session: SDD workflow setup

**Topic:** Spec-Driven Development + persistent memory workflow для STAVAGENT, with constraint that work is online claude.ai (no terminal access at work, firewall blocks).

**Rozhodnuto:**
- Adopt SDD pattern: `docs/steering/` + `docs/specs/{name}/{req,design,tasks}.md` + `docs/bugs/{id}/{report,analyze,fix,verify}.md`
- Soul.md jako Project Knowledge artifact (ne MCP server) — fungue v claude.ai online
- Hybrid workflow: claude.ai = planning/specs/specs creation, Claude Code (doma) = implementation, Git = bridge
- 4 steering docs: product / tech / structure / domain (+ conventions as 5th)
- Templates pro spec (3 souboru) + bug (4 souboru)
- Audit existujících TASK_*.md → re-classify do `docs/specs/`, `docs/bugs/`, `docs/reference/`, `docs/handoff/`

**Odmítnuto:**
- Local MCP memory servers (mem0, Qdrant, Ollama) — nefungují přes firewall na práci
- Pimzino claude-code-spec-workflow npm package — vyžaduje terminal
- MemCP / claude-memory-mcp — local-only, ne použitelné na práci

**Otevřené otázky:**
- Kdy spustit migraci TASK_*.md → docs/specs/? (návrh: postupně, po PR)
- Soul.md velký vs malý — limit length nebo nech růst? (návrh: split po měsících, archive starší sekce do `docs/handoff/`)
- Cleanup deadline 2026-07-29 (Gate 2 leftover) — jak se to vztahuje k novému workflow?

**Co dál:**
1. User zacommit těchto 4 steering + soul + templates + audit do `docs/` přes GitHub web UI
2. První pilotní spec: `docs/specs/cross-user-isolation/` (P0, před Cemex)
3. Druhý pilotní spec: `docs/specs/mcp-policy-engine/` (Cemex)
4. Až bude pilot fungovat → batch migrace ostatních TASK_*.md

---

### 2026-05-20 — Session: UEP PR4a — MEP D.1.4 matrices + gbXML adapter

**Topic:** UEP PR4a per `docs/tasks/TASK_UEP_PR4.md` §3.1 + §3.2
(Q16 = C hierarchical). Adds detailed coverage matrices for D.1.4
silnoproud / slaboproud / ZTI / VZT / ÚT / plyn / MaR (7 disciplines),
a hierarchical `mep_base` parent shared across all subtypes, the gbXML
extractor (energy / HVAC exchange format), and multi-subtype detection
in `project_type_detector`. Scope-locked to PR4a; PR4b (full IFC diff),
PR4c (UI), PR4d (perf) remain queued.

**Rozhodnuto:**
- **Q16 = C hierarchical** confirmed: each subtype YAML declares
  `extends: mep_base` and inherits all 15 base rows; `load_matrix()`
  resolves the parent transparently, dedupes by category, and
  subtype rows REPLACE base rows on conflict.
- `load_matrices_for_subtypes(["mep_d14_silnoproud", "mep_d14_zti",
  "mep_d14_vzt"])` returns the unioned category list for projects
  bundling multiple D.1.4 disciplines (canonical Czech residential
  D&B pattern).
- `ProjectTypeDetection.mep_subtypes: list[str]` populated whenever
  ANY D.1.4 signal fires — independent of umbrella `top_choice` so a
  residential project with an embedded D.1.4 silnoproud TZ surfaces
  both `top_choice="residential"` AND
  `mep_subtypes=["mep_d14_silnoproud"]`.
- gbXML extractor mirrors LandXML iterparse pattern (≤200 MB memory
  bound per v3 §15.4). Emits `space_inventory` + `surface_inventory`
  + `hvac_zone` + reuses `norm_references` for Construction/Material
  layers — these feed `mep_d14_vzt` / `mep_d14_ut` matrices.
- `_ALLOWED_PROJECT_TYPES` in `routes_uep.py` extended 4 → 12 (the
  path-traversal allow-list from Amazon Q PR #1186 hotfix).

**Odmítnuto:**
- Real gbXML corpus calibration — STOP-condition #2 mentioned the
  option but corpus has none; synthetic Revit-shaped fixture in
  `test_uep_gbxml_extractor.py` is sufficient for PR4a scope (basic
  spaces/surfaces/HVAC zones). Real-export calibration left for PR4b
  when a corpus sample lands.
- Separate top-level `subtype_matrix_dir` config — `load_matrix()`
  resolves `extends:` from the same directory as the subtype YAML
  (or `base_dir=` override for tests). Adding a config key would be
  overengineering for one matrix folder.
- Changing `CoverageRequirement` model shape — hierarchical merge
  happens at YAML-load layer; the runtime model is unchanged, so
  all PR1-3 evaluation paths work without code change.
- IFC diff engine (PR4b), UI viewers (PR4c), perf optimization
  (PR4d), AI narrative (PR5), MCP tool additions for MEP subtypes —
  scope-locked out of PR4a per task split decision in §6.

**Otevřené otázky:**
- Reconciliation rules for MEP subtypes — `/uep/config/reconciliation-rules?project_type=mep_d14_*`
  will 404 until PR4 §3.x adds the rule YAMLs. Not blocking PR4a
  (the config endpoint surfaces 404 cleanly).
- `job_runner.py` currently calls `matrix_path_for(info.project_type)`
  with a single string — when `JobInfo.project_type == "mep_only"`
  the coverage gate cannot yet apply multiple subtype matrices. The
  hook for this is `load_matrices_for_subtypes` but `job_runner`
  isn't yet wired to consume `mep_subtypes` from the detection pass.
  Followup ticket: extend `JobInfo` schema or thread the subtypes
  through `start_job()` body.
- gbXML reference samples — no real Revit / OpenStudio export in
  `test-data/`. PR4b calibration should request a sample upload from
  Alexander before extending the adapter (currently sufficient for
  unit tests + smoke checks; production usage will need calibration
  pass against ≥1 real export).
- D.1.4 reconciliation rules + derivation rules YAMLs (CKZ, drift
  thresholds per discipline) — out of PR4a, queued for PR4b/c.

**Co dál:**
1. Push branch `claude/uep-pr4a-matrices-adapter-1OEjF` + open PR
   with title "feat(uep): PR4a — MEP D.1.4 hierarchical matrices +
   gbXML adapter".
2. Wire `mep_subtypes` from `detect_project_type` into `JobInfo` /
   `start_job()` so `job_runner` can call `load_matrices_for_subtypes`
   when subtypes detected (small follow-up commit on the same PR or
   separate PR4a-jobrunner ticket).
3. PR4b — full IFC diff engine (quantity deltas, material changes,
   severity), per task §3.3 + Q19 = B.
4. PR4b also: collect a real gbXML sample for calibration pass + add
   a discipline-aware filename test fixture (multi-discipline pack
   currently relies on user-friendly naming; production uploads from
   Allplan / Revit often strip the D.1.4.x prefix).
5. Reconciliation + derivation rules YAMLs per MEP subtype (deferred
   from PR4a to PR4b/c).

**Test count delta (PR4a):**
- gbXML extractor: 8 new (`test_uep_gbxml_extractor.py`)
- Hierarchical coverage: 12 new (`test_uep_coverage_hierarchical.py`)
- MEP matrices smoke: 11 new (`test_uep_coverage_matrices_pr4a.py`)
- Multi-subtype detection: 11 new (`test_uep_project_type_detector_multi_subtype.py`)
- **Total: 42 new tests**, 81 tests pass in the relevant UEP module
  set. Zero PR3 regressions.

**Acceptance criteria status (per TASK_UEP_PR4.md §4):**
- AC 1 (7 subtype matrices) ✅
- AC 2 (mep_base shared base) ✅
- AC 3 (≥15 categories per subtype) ✅ (28-32 per subtype after merge)
- AC 4 (multi-subtype aggregation) ✅
- AC 5 (project type detection updated) ✅
- AC 6 (gbXML parses spaces/surfaces/HVAC zones) ✅
- AC 7 (integration with VZT/ÚT matrices) ✅ via shared
  `hvac_zone` + `space_inventory` + `surface_inventory` categories
- AC 26 (MEP matrix tests per subtype) ✅
- AC 27 (gbXML adapter tests) ✅
- AC 8-25, 28-33 (IFC diff full, UI, performance, docs) → PR4b/c/d

---

### 2026-05-20 — Session: UEP PR4b-1 — IFC diff foundation (extractor + engine + REST)

**Topic:** First half of the PR4b split agreed mid-session (Q19 = B,
"deterministic diff complete, AI narrative as PR5"). PR4b-1 ships
the foundation: schemas + Alembic tables + per-entity snapshot
capture in the IFC extractor + basic diff engine (add / remove /
modify by GlobalId + per-IfcType counts) + REST endpoints + 31-test
suite. PR4b-2 (next session) layers quantity deltas, material
composition diff, property set diff, severity classification rules,
and the `uep_get_ifc_diff` MCP tool wrapper on top — all of those
fit inside `IfcDiffReport.report_payload` (open JSONB dict) plus the
flat `severity` column, so the table schema does not change again.

**Rozhodnuto:**
- **PR4b split into PR4b-1 + PR4b-2.** Audit at session start
  surfaced that PR3 had not actually shipped the "basic diff" the
  task §3.3 referenced ("extend basic diff from PR3 with…") — no
  `ifc_diff` module, no `ifc_diff_reports` table, no
  `uep_get_ifc_diff` MCP tool. So PR4b is genuinely "build the diff
  from scratch", not "extend". Split keeps the foundation reviewable
  (~1.4k LOC, 4 commits, no DB session machinery) and pushes the
  advanced layers + MCP tool wrapper into PR4b-2 where they belong.
- **`payload_hash` over canonical-JSON SHA-256** as the "modified"
  detector. Hash covers `{ifc_type, name, object_type, storey,
  quantities, material_layers, property_sets}` — drift in any of
  those flips the bucket. `global_id` + `payload_hash` itself are
  EXCLUDED from the hash (identity is keyed by GlobalId so a GlobalId
  change is an add+remove pair, not "modified"; chicken-and-egg for
  the hash field).
- **`_coerce_number` filters `bool`** before float conversion. `bool`
  is an `int` subclass in Python — without the guard `True` would
  silently become `1.0` in an IfcElementQuantity NetArea dict. Caught
  during the smoke pass; covered by `TestCoercion::test_bool_filtered`.
- **Material layer ORDER matters** — `_compute_payload_hash` includes
  the layers list AS-IS (no sort). Vrstva 1 then 2 is a different
  wall stack than 2 then 1, even with identical thicknesses. Test
  `test_material_layer_order_matters` enforces it.
- **GlobalId change ≠ "modified".** A rebuilt wall with a new GlobalId
  is an add (new gid) + remove (old gid). Treating it as "modified"
  would lose the identity-loss signal. Test
  `test_global_id_change_is_add_plus_remove` enforces it.
- **Cross-project IFC diff explicitly rejected (400).** Versions from
  different projects can't be diffed — diff payload would leak
  schema details about the other project. Enforced in the REST
  endpoint before the engine runs.
- **`_USER_ID_PATTERN` + `_UUID_PATTERN` for path-traversal hardening.**
  Every path parameter (project_id, old/new version_id) is regex-
  validated as UUID 8-4-4-4-12 BEFORE reaching the filesystem
  builder. The diff endpoint additionally re-validates
  `project_dir.name` while scanning so a manually-placed
  `../etc/passwd` dir under `UEP_DATA_DIR/ifc_versions/` cannot
  poison the response.
- **Filesystem storage backend in PR4b-1, SQLAlchemy + asyncpg in
  PR4b-2.** Endpoint contract + auth + path traversal are the review
  surface; storage layer is an implementation detail that swaps
  cleanly behind the Pydantic types. Filesystem rows survive
  container restarts via `UEP_DATA_DIR` mount, so the surface IS
  production-shaped, not a stub.
- **Mount fix shipped opportunistically.** `routes_uep.router` was
  never registered in `app/api/__init__.py` (PR2 + PR3 added the file
  but never wired it in) — entire UEP REST surface was 404 in
  production since merge. Including the router in this PR is
  required for the new IFC endpoints to be reachable; the same line
  ALSO un-buries the PR2 + PR3 endpoints. Side-effect-only fix to a
  pre-existing mount bug; no behaviour change for any other module.

**Odmítnuto:**
- Real IFC corpus calibration — no sample IFC in `test-data/` yet.
  All 31 tests use synthetic snapshot dicts that mirror exactly the
  shape `_emit_entity_snapshots` produces; the diff math is exercised
  independently of vendor IFC variants. Integration test against a
  real Allplan / Revit / ArchiCAD export deferred until a sample
  lands. When it does, vendor-specific drift (e.g. Allplan not
  emitting `IfcRelContainedInSpatialStructure` for IfcSite) will be
  recorded as corpus patterns under
  `app/knowledge_base/B5_tech_cards/real_world_examples/ifc/` —
  mirror of the RD Jáchymov pattern files.
- Severity classification rules — PR4b-1 emits
  `IfcChangeSeverity.UNSCORED` on every report. The 5-tier rule
  table in task §3.3 (cosmetic / minor < 5% / moderate 5-20% /
  major > 20% / scope_change) needs the quantity-delta aggregation
  layer to operate on — that aggregation is the first PR4b-2
  commit, so severity rules naturally follow it.
- AI narrative — locked out of PR4b entirely per Q19 = B. PR5.
- MCP tool `uep_get_ifc_diff` — PR4b-2. The REST endpoint already
  surfaces the same payload, so PR4b-2's wrapper is thin.
- Per-version GET endpoint (full payload incl. `entity_snapshots`) —
  list endpoint serves the lean view (no snapshots, no counts) for
  the UI picker; the full-payload GET pairs better with the MCP
  tool wrapper, so it ships in PR4b-2.
- GIN index on `ifc_versions.entity_snapshots` JSONB — PR4b-2 will
  decide based on the actual severity-rule access patterns. PR4b-1's
  diff engine scans linearly, no JSONB-path queries.
- `IfcEntityChange.change_kind` as Enum (consistency with
  `SourceFormat` / `CoverageStatus` in the same module) — flagged
  during the audit as a minor inconsistency. Deferred to PR4b-2
  alongside the other small enum work (e.g. lifting "added" /
  "removed" / "modified" string literals into `IfcChangeKind`).

**Otevřené otázky:**
- gbXML / IFC real-export samples still missing from the corpus.
  Same blocker as PR4a (gbXML); will be the first task on PR4b-2
  whenever a sample lands.
- `ifc_versions.entity_snapshots` JSONB ceiling — 50k walls × ~200 B
  per snapshot = ~10 MB JSONB, well under Postgres' 1 GiB row
  limit. Confirmed acceptable for realistic models; revisit if a
  pilot crosses 200k IfcRoot instances.
- SQLAlchemy ORM models + asyncpg session pattern not yet present
  in repo (PR4b-1 storage is filesystem). PR4b-2 introduces the
  async session — design choice between `Depends(get_db_session)`
  or a context-manager helper carries forward; both work, lean
  toward `Depends` for FastAPI native injection.
- `streaming_strategy` CHECK in the Alembic migration includes
  `'reject'` even though extractor never persists that value (an
  extraction that resolves to REJECT raises before writing).
  Harmless to allow but imprecise; could tighten in PR4b-2 if it
  comes up in review.

**Co dál:**
1. Push branch + open PR.
2. PR4b-2 — quantity deltas + material composition diff + property
   set diff (all land in `IfcDiffReport.report_payload`) + severity
   classification rules (flip `IfcChangeSeverity` from `UNSCORED`)
   + `uep_get_ifc_diff` MCP tool + per-version GET endpoint
   + SQLAlchemy ORM + asyncpg session swap-in (filesystem →
   Postgres).
3. PR4c — UI viewers (coverage / reconciliation / IFC diff /
   derivation audit) per AC 15-20.
4. PR4d — performance optimization per AC 21-25.

**Test count delta (PR4b-1):**
- `tests/test_uep_ifc_diff.py` — 31 new tests, 5 classes
  (TestPayloadHash, TestCoercion, TestSnapshotSchema,
   TestDiffEngineBasic, TestCategoryCounts, TestGuardRails).
- 31/31 passing in 1.02 s, runs without `ifcopenshell` (synthetic
  dicts mirror the extractor output shape).
- No regression on PR3 / PR4a suites (verified via re-run on the
  branch).

**Acceptance criteria status (per TASK_UEP_PR4.md §4):**
- AC 13 (`ifc_diff_reports` table extended via Alembic) ✅
- AC 8 (per-category counts) ✅ — basic `IfcCategoryCount` per
  IfcType implemented
- AC 9-12, 14 (quantity / material / property / severity, MCP tool)
  → PR4b-2 (foundation ready; layers slot into `report_payload`
  + flat `severity` column without further migration)
- Rest (UI, perf, docs cross-cuts) → PR4c / PR4d

---

## 10. Document metadata

| Field | Value |
|---|---|
| Initialized | 19.05.2026 |
| Version | 1.0 (initial) |
| Maintained by | Alexander Prokopov + Claude sessions |
| Update frequency | After each significant session |
| Read at start of | Every Claude session (online + Claude Code) |
| Storage | Both: `docs/soul.md` in repo + Project Knowledge (synced manually) |

---

**End of soul.md.**
