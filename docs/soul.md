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

## 2. Current state snapshot (07.07.2026)

> ⚠️ **Maintenance:** при каждом version bump обнови строку "в продакшне" ниже.
> Детальный live state = root `CLAUDE.md` changelog + §9 Session log этого файла.

### 2.1 Production

- **v4.38** в продакшне (детальный changelog — root `CLAUDE.md`; **1366 shared tests**, 24 element types)
- **Gate 1** PR #1058 merged (29.04.2026)
- **Gate 2** PR #1064 merged (15 commits, branch `gate-2-element-classification`). Tests 1002 → 1036. Element types 22 → 23 (zaklady_oper added).
- **MCP v1.0** live с биллингом
- **3,693+** commits, 500+ deployments
- **$5,000** Perplexity credit aktivní

### 2.2 Active critical work

- **P0 BLOCKER před public/demo: Sprint A (neautentizované routy).** Původní
  cross-user symptom (nový user vidí cizí projekty) je **vyřešen 31.05**
  (§9 entry, `docs/security/isolation_model.md`, isolation e2e + reviewer
  agent). Zbývá JINÁ třída z auditu 2026-07-01: routy úplně bez auth —
  Portal `/api/pump/*` + `/api/parse-preview/import` (owner_id=1) +
  `/api/kb/research`; Monolit `positions.js`/`planner-variants.js`; URS bez
  auth jako třída + anonymní přepínání LLM; Registry `cleanup-empty`
  owner-scope + 2 routy; 5× fail-open vzorů v Portalu. Plán = Sprint A
  v audit-reportu (2026-07-01). Bez toho žádný public marketing/demo.
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

## 2026-07-14 — Session: ADR-009 ACCEPTED — ratifikace tří os + stamps + SO250 reconcile (a)

**Rozhodnuto:** Alexander ratifikoval ADR-009 celý (3 osy · ledger · stamps) → status **Accepted**, všechny stamps provedeny týž den: (1) `TASK_UWO_Bridge_Ontology.md` — `SUPERSEDED_BY` ukazatel OPRAVEN na `universal-work-decomposer` (osa A; původní banner mířil na orchestrator rodinu = osa B = špatně); (2) `_SO202_Bridge` + `_KROS_Adapter_Wrap` — header-linky na kánon `docs/specs/document-to-worklist/SPEC.md` («živá, NE hotová»); (3) `universal-work-decomposer` requirements+design status review → **ACCEPTED (kánon osy A — jen vocabulary+adapters, NE workflow)**; (4) **SO250 reconcile = varianta (a)**: přejmenováno `TASK_Orchestrator_WorkOntology_SO250.md` → `TASK_ElementTyping_HeadNoun_SO250_acceptance.md` (osa C, obsah netknut, header linkuje normalizer v4.34; Stage-1 roli SO-250 nese fixture+SPEC); (5) **oprava jmen fixture od Alexandra**: `test-data/tz/SO-250.md` → `SO-250_golden_test.md` (sousedská `_golden_test` konvence; jméno `SO-250.md` zůstává VOLNÉ pro zdrojový TZ — hlavička fixture ho tak označuje; dva artefakty nesmí sdílet jedno jméno — anti-drift).

**Odmítnuto:** varianta (b) přepisu SO250 na Stage-1 intent (duplikovala by fixture+SPEC); start vocab v1 bez schváleného scope-plánu (Alexander: «вернись ко мне с планом, что именно входит в словарь. Не начинай»).

**GO + realizace (týž den):** Alexander dal GO na vocab v1 se **3 market-proof opravami schématu** (label/keywords = jazykové MAPY s prázdnými de/es sloty, ne `_cs` skaláry · `unit_canonical` SI + lokální render v adapteru · params s národní sémantikou = typované `{market, scheme, value}` — DIN 18300 Bodenklassen zrušeny 2016 → Homogenbereiche, přímý mapping na ČSN 73 6133 neexistuje; invariant-test: přidání německého labelu = vyplnění slotu, NIKDY migrace schématu). **Gate 0 recon** (bottom-up ze 3 reálných zdrojů: WORK_TEMPLATES · HK212 korpus přes Pattern 15/16 — test-data READ-deny ⇒ coverage check = CI-side skript · interiér malba.yaml MVP + sandbox S1–S10; nález: Eurocode-parametry jsou market-neutrální BY EN-unifikace → market-tag jen národním schématům soil/surface/curing/inspection) + **Gate 1 DATA**: `B5_tech_cards/technological_postupy/uwo_vocabulary.yaml` — **47 kódů · 22 domén** (deep 4 / working 15 / declared 3), hermetický invariant-check zelený; `docs/specs/universal-work-decomposer/tasks.md` (Gates 0–5, split §9.1 jako pointer-gate).

**Domain review (Alexander, přípravář-level) → v1.1 + v1.2 + Gate 2 (týž den):** (v1.1) coverage-KONTRAKT: `covered` = větev decomposeru POSTAVENA, ne «kód v YAML» — audit proti breakdown.py: postaveno jen monolit + interier_psv/malba → **13 covered / 41 declared**, HK212-provenance opravena na «registry refs, UNVERIFIED do harness»; pořadí gates otočeno harness-PŘED-retrofit («nekrepíme engine k neověřenému slovníku»); SCAFFOLDING trio ERECTION/RENTAL(m2_day)/DISMANTLING; přesun hmot dvourozměrný → povinný `distance_m`; VRN kódy SMAZÁNY (nákladové články ČSN 73 0212 ≠ práce). (v1.2, 8 oprav z ревью 54 kódů) FALSEWORK m²→**m³** (obestavěný prostor — OTSKP kánon) + FALSEWORK.STRIP; rough-ins kpl→**m** (kpl degeneruje quantity→1, G2 vakuově prochází); **5 děr dokázaných VLASTNÍMI fixturami** (SO-250/202/VP4 slovníkem neprošly!): MEMBRANE.APPLY · DRAINAGE.INSTALL · RAILING.INSTALL (m + mass_kg_per_m; m×kg/m→t deterministicky, t→m = review_flag) · JOINT.DILATATION (42 DC) · SPOIL.REMOVE (výkopek ≠ suť) + BLINDING; **pravidlo 4 do hlavičky** (potvrzeno 3 případy): jedna kanonická jednotka = hlavní fyzikální dimenze, druhá dimenze katalogu = VŽDY povinný param, přepočet = adapter, nikdy druhý unit. **Gate 2 HOTOV**: `services/uwo_vocabulary.py` (honest-empty i na invariant-violace — rozbitý controlled vocab se NIKDY neservíruje) + `tests/test_uwo_vocabulary.py` **39 hermetických zelených** vč. negativních testů validátoru, market-proof testu (de-label = slot fill) a **fixture smoke** (27 prací z goldenů → každá má kód + declared doménu; korpus pokrývá OBA coverage stavy).

**Gate 3 + v1.3 (týž den, GO po tabulce):** Korpus = **244 položek, ne 138** (plný sequential list, ~43 % MEP). Mechanika ratifikovaná: **ručně kurátorovaná verdict-mapa** (`scripts/uwo_hk212_verdicts.yaml`), NIKDY keyword-match (seed nekalibrován, token-overlap = falešné díry i zásahy — `{patek}`); harness (`scripts/uwo_hk212_coverage_harness.py`) validuje jen «kód existuje + doména deklarována», exit≠0 pouze na konzistenci (unmapped/stale/stale-map guard: přidaný kód ⇒ verdikt MUSÍ flipnout). Šestý verdikt **`needs_decomposition`** = consolidated pack → SPEC Stage 2 (první živé potvrzení, že Stage 2 je potřeba reálně: přeložka řadu, přípojka NN). První tabulka: exact 108 / kw 15 / **new 86** / split 2 / not_work 33 — 41 % děr na 209 pracích (MEP-ocas; všechny 4 kvalitativní predikce ревью potvrzeny: nátěry OK, kotvení, klempířina, vrata). **Alexander nad tabulkou rozhodl v1.3:** (1) supply-vs-montáž = **param `scope`** (pravidlo 5 do hlavičky: komerční druhá dimenze pravidla 4; hranice product-install vs process — «kód bez scope» drží JEDEN význam; SUPPLY návrhy pohlceny, scope na 39 kódech); (2) **28 nových kódů** (bez řezu jednohitových — řez podle hitů jednoho korpusu = overfitting) + **domény LANDSCAPING, PAVING**; hydrant zůstává pod PLUMBING (FIRE_PROTECTION až s PBŘS-větví); montáž hromosvodu = díra KORPUSU, ne slovníku (nota); (3) **SCAFFOLDING.SPATIAL trio** m³/m3_day/m³ — prostorové vs fasádní = dvě fyziky (jako skruž ≠ bednění), pojízdné/plošina = param `mobility`; (4) 7 keyword-fixů → všech 15 kw + 86 new flipnuto. **Finál: 85 kódů (13 covered / 72 declared) · 24 domén · tabulka exact 209 / split 2 / not_work 33 = 100 % prací pokryto · harness 0 chyb · 39 hermetických testů zelených.** ⚠️ Ceiling-nota v tasks.md: 85 ≈ strop §5.1 — příští expanze = doménové podseznamy pro LLM (router→doména→5–15 kódů), ne růst plochého seznamu.

**Gate 4 — retrofit (týž den, GO se 3 checkpointy):** (1) **statický mapping** — každý atom `WORK_TEMPLATES` (breakdown.py) i malba.yaml nese inline `vocabulary_code` (STATICKÁ data, deterministické, nikdy LLM-pick; atom bez mappingu = díra slovníku → test padá hlasitě, file proposal); obě emisní místa (monolit + interiér item) pole aditivně forwardují. (2) **coverage-kontrakt = ASSERTION, ne ruční sverka** — `tests/test_uwo_vocabulary_retrofit.py`: `set(emitted) == set(covered)` PŘESNĚ (13 == 13); honesty-pin `FORMWORK.FALSEWORK.STRIP` zůstává declared a neemitován (retrofit ho «nevtáhl»); totalita nad oběma větvemi; živý běh `create_work_breakdown` — každý item nese covered kód. (3) **goldeny byte-stabilní** kromě nového pole (atomizer per-field tuples netknuté, zelené vedle). Lokálně **55 passed** (retrofit 6 + atomizer + vocab 39); mcp-compat přes CI (lokální fastmcp = Debian-PyJWT blocker, dokumentováno); oba nové test-soubory zaregistrovány v `test-mcp-compatibility.yml` (push paths + PR paths + pytest list — jinak by v CI NIKDY neběžely).

**Gate 5 — SPEC §9.1 uzavřen (týž den, GO v sekvenci «po zeleném Gate 4»):** Recon-nález: samotný SPLIT už shipnul dřív (SPEC-varianta «one tool with an explicit mode» — `mode='work_first'` DEFAULT, binding oddělen do `_attach_catalog_codes`, alias `catalog='none'`, response echuje `mode`+`catalog_bound`); chyběl SERVER-side enforcement (YAML komentář to pinoval: «mode enforcement is PR2»). Shipnuto: (1) **`param_constraints` blok v `workflow_definitions.yaml`** (DATA, single source — žádný paralelní manifest): WORK_ATOMIZATION → `create_work_breakdown: mode: [work_first]`; loader STRIKTNĚ validuje (constraint na tool mimo allow-list = chyba loadingu — překlep nesmí tiše vypnout invariant). (2) **`evaluate_tool_policy(tool_args=…)`**: session-gated volání s param mimo povolené hodnoty → STAGE_VIOLATION (409) + audit-record s param/value/allowed; ABSENT param = allowed — korektní jen protože tool-default je `work_first`, pinnutý testem ze SOURCE přes AST (hermetická suita neimportuje breakdown → žádný sqlalchemy řetěz); session-less beze změny (opt-in model). (3) REST wrapper forwarduje `tool_args={"mode","catalog"}` → **invariant §6.4.1 «ve Stage 1 ani jeden kód, ani jedna cena» je vynucen serverem, ne promptem**; orchestrator-recipe volá tool s defaulty (work_first) = konzistentní. (4) **§6.4.3 contract naming**: aditivní pole `coverage` — `covered` na itemech postavených větví (monolit + interiér), `not_covered_branch` na `unresolved`. Testy: +9 `test_stage_gating_policy.py` + 2 retrofit; lokálně **132 passed** přes dotčené suity, goldeny byte-stabilní. **Řetěz stádií 1–4 se poprvé uzavírá: Decompose emituje vocabulary_code, Bind je oddělené stádium za gate a gate je POLICY.**

**Merge + reality-check (týž den):** PR #1509 (celý oblouk: ADR-009 + SPEC de-graveyard + slovník v1.3 + Gates 0–5) smergován merge-commitem `857c523` po 10/10 zelených checích (cestou: union-merge konfliktu s main — paralelní session přidala vlastní testy do téhož CI-workflow + soul §9; Amazon Q «CWE-209» na slovníkovém validátoru VYVRÁCEN v konkrétech, ale reálné zrno — non-dict entry → AttributeError mimo try = porušení honest-empty slibu — opraveno shape-guardem + 2 testy). **První end-to-end běh konvejeru** (SO-250 fixture → Stage-1): 18 položek, všechny s `vocabulary_code`+`coverage=covered`, **0 kódů / 0 cen / `catalog_bound: false`** — invariant §6.4.1 viditelný ve výstupu. Reality-check ale ukázal: **stádium 3 Quantify v běhu nebylo** — výztuž 79.3 t (default 100 kg/m³) vs 95.16 t ve fixtuře (−17 %), bednění podkladního betonu 1004 m² (volume/0.25) vs reálné desítky m² (obvod × tl.) — čísla byla template-odhady tvářící se jako fakta. Backlog: `mcp-transport-stage-gating` (FastMCP dispatch obchází gateway — díra invariantu, ne regrese).

**Rozhodnuto (Alexander nad výstupem): GO na Quantify — «сначала числа честные, потом числа с кодами, потом числа на экране»** (Bind nad křivými čísly = sebejistě-špatná smeta; UI nad nimi = ztráta důvěry přípraváře; šířka F2 by problém multiplikovala). Tři opravy v pořadí, **shipnuto týž den**: (1) **vstup poráží default** — caller-hodnota (rebar_tons/area_m2/height_m/volume_m3) VŽDY vítězí; default jen fallback. (2) **`quantity_status` + `quantity_formula` na KAŽDÉM itemu** (SPEC §6.3/§6.4.2): `from_input` (verbatim ze vstupu; upstream soupis-joiner může povýšit na from_soupis) / `computed` (deterministický vzorec nad vstupy) / `assumed` (typový odhad — MUSÍ křičet) / `NEPOČÍTÁNO(důvod)` (interiér bez výměry — už ne tiché None). Jednotně obě větve (monolit + interiér; `quantity_provenance` zachováno). (3) **blinding-bednění fix**: podkladni_beton = obvod × tloušťka (čtvercový půdorys odhad, tl. z height_m ≤ 0.5 nebo 0.15), ne volume/0.25 — třída chyby «vzorec nezná typ prvku». Testy: nová suita `test_quantify_status.py` (10; registrována ve VŠECH 3 CI-listech) — 100 passed napříč dotčenými suitami, atomizer goldeny byte-stabilní (aditivní pole).

**Otevřené otázky:** lokální fastmcp blocker trvá (mcp-compat přes CI); MCP-transport stage-gating (BACKLOG P1); zbytek Quantify-osy — plnohodnotný `doc_to_quantified_elements` (soupis-join → from_soupis upgrade, geometrické vzorce pro ostatní typy — základ 5286 m² je taky nadhozený odhad, teď aspoň poctivě `assumed`); UWO fronta (F2 port S2–S10, keyword-kalibrace).

**Co dál:** PR pro Quantify-inkrement na pokyn; potom druhé kolo reality-checku (SO-250 s rebar_tons z fixtury → assumed zmizí tam, kde vstup existuje).


## 2026-07-13 — Session: whole-stavba saga DOKONČENA — inkrementy 3+4 (#1506, #1507), 14/14 na reálném souboru, všech 5 PR smergováno

**Rozhodnuto:** Dokončení saga z entry níže (inkrementy 1–2.5 = #1503/#1504/#1505). **Inkrement 3 (#1506) — join semantika na passport-cestě**, čtyři opt-in mechanismy `map_soupis_to_elements` (zapíná JEN assembler; přímí volatelé create_work_breakdown beze změny): (1) `collapse_same_type` — stejný engine-typ z TZ (Opěry+Úložné prahy+Křídla → 3× abutments) dostane soupis-bucket JEDNOU (carrier = první, sourozenci `collapsed_into_sibling`) → abutments 557.851 zpět; uzavírá deferred #5 prahy přes ambiguity-osu. (2) `_PROSTY_BETON_RE` reroute — «BETON PROSTÝ» (461314, 12.733 m³) → podkladni_beton, ne ŽB foundations (doktrína `plain_footings` v passport-mapě). (3) `emit_soupis_only` — soupis-buckety bez TZ-elementu = syntetické elementy (přechodové desky 81.9 + podkladní beton 403.092 m³ — ~20 % betonu objektu se předtím tiše dropovalo). (4) mass-osa nazev-first — VŠECH 7 tunových řádků reálného souboru má prázdný `<popis>`; staré `if not desc: continue` dropovalo 100 % výztuže od P1. Single-position foundations (272325 = 867.136 m³ jedna položka za všechny základy) = datový limit → jeden poctivý klíč, ŽÁDNÝ fabrikovaný split. **Tři review-kola Alexandra na inkrementu 3, všechna vyhraná čísly:** (kolo 1) 45152 «Z KAMENIVA DRCENÉHO» = štěrk — moje emit_soupis_only ho vzalo jako «bonus» (144.69 m³ do blinding; regrese v MÉM vlastním fixu) → material-guard vrstva 1: negative `_NON_CONCRETE_RE` (kamen|sterk|drcen|dlazb|lomov|zemin|asfalt|geotext|izolac) na KAŽDÉM řádku vč. t-osy. (kolo 2b) můj úhyb «positive guard jen na orphan-path» vyvrácen DATY — všech 8 reálných betonových pozic nese beton-signál v `<nazev>`; můj protipříklad byl řádek BEZ catalog_name → vrstva 2: positive `_CONCRETE_SIGNAL_RE` na m³ řádcích S catalog_name (mass/length exempt — B500B je ocelová marka, ne beton-signál), degradace na negative-only bez catalog_name; goldens z blindingu: gabiony 3272A7 («ZDI OPĚR…Z GABIONŮ» 283.47 — obsahuje OPĚR, dřív prošlo jen štěstím) + poplatky 014101 (4639 m³ skládka). (kolo 3) mass-audit — 272365/317365 joinovaly, ale nereportoval jsem je (reporting-chyba, přiznána); 333365 (64 164 kg výztuž opěr) = reálná díra. **Inkrement 4 (#1507) — classifier vocab přes shared DATA:** diagnóza korigovala hypotézu «v4.34 genitive suppression» (stash-test = evidence: suppression nevinná, chyběl genitivní vocab). `element_types.yaml`: mostovkova_deska += «mostni tramov/mostní trámov» (vázáno na «MOSTNÍ TRÁMOVÁ KONSTRUKCE», trám globálně NErozšířen), opery_ulozne_prahy += genitivy «mostních opěr»/«opěr a křídel»; TS artefakt regenerován `gen-knowledge.mjs` (drift-guard green); genitive suppression NEZBOURÁNA. Parity goldeny OBOU runtime zrcadlově (+4 py `test_monolith_classification_mcp_parity` / +4 engine `golden-w3-parity`), OBA směry (reálné «PŘÍČNÍKY MOSTNÍ ZE ŽELEZOBETONU» zůstává pricinik; pozemní «Průvlak trámový» zůstává pruvlak). Deck rebar 468 886 kg = 63 % oceli SO-202 zpět v pasportu. **Finále na reálném 6,6 MB souboru: 14/14 exakt vs manuální etalon** — objemy deck 2697.941 · rims 266.328 · pier_shafts 361.384 · abutments 557.851 · foundations 867.136 · transition 81.9 · blinding 415.825 (Σ 5248.365 m³) + hmoty deck-rebar 468 886 · foundations 129 877 · abutments 64 164 · pier 62 577 · rims 30 074 · transition 12 348 · prestress 82 840 kg. #1505+#1506+#1507 smergovány Alexandrem, fetch-verify na origin/main (5d245f7). Join suite 32 testů; celkem py 103 + engine 193 na dotčených suitách.

**Odmítnuto:** positive guard jen na orphan-path (vyvráceno daty). Fabrikovaný split single-position foundations. Globální rozšíření «trám» (rozbilo by pozemní průvlaky). Demolice genitive suppression z v4.34. `calculate_from_passport` PŘED inkrementem 4 (plán bez 63 % oceli by klamal — držen Alexandrem záměrně).

**Metoda (potvrzena počtvrté):** 4 živé prohony na reálném souboru = 4 třídy багů, které zelené testy propustily (whole-stavba join · stale handle · kamenivo false-positive jako regrese vlastního fixu · mass-osa dropující 100 % výztuže). Živý re-run po každém inkrementu je neoddiskutovatelná část definice hotovo.

**Otevřené otázky:** «ZÁKLADY OPĚR» → zaklady_piliru = pre-existing v4.34 family-preserving flip (stash-test), akceptováno — foundations_abutments fine-grain je jiná osa, samostatný ticket. GCS-URI pro >20 MB soupisy = follow-up. `test-data/SO_11-20-04/` = záměrný NOVÝ projekt Alexandra (N+1), soubory se ještě nahrávají — NEuklízet.

**Co dál:** Cloud Build auto-deploy z main → Alexandrův finální živý prohon: NOVÝ upload (starý ref MUSÍ vrátit typed `soupis_ref_stale`) → 14/14 živě → PRVNÍ `calculate_from_passport` na kompletním pasportu SO-202 → SO_11-20-04 jako N+1 pilot.

## 2026-07-13 — Session: passport-soupis-join whole-stavba bug (živě chycen na prvním E2E, #1503 merged + inkrement 2 + stale-handle)

**Rozhodnuto:** První živý end-to-end běh `build_bridge_passport` (reálný 6,6 MB XC4 soupis Žalmanov, 125 SO / 3372 řádků) chytil ⛔ **money-catastrophe**: passport je PER-SO, ale soupis→element join bral CELOU stavbu a sčítal každý m³ řádek typu přes VŠECHNY objekty. Živě SO-202: deck 8561 vs 2697.941 etalon (×3,2), foundations ×20. **Kořen dokázán proti reálnému XML na TŘECH vrstvách (ne jen join):** (1) `xc4_parser._iter_polozky` házel pryč rodičovský `<objekt><znacka>` (SO); (2) OTSKP normalizer dropoval `object_code` jako neznámý header; (3) join neměl SO-filtr. **Inkrement 1 (SO-filtr, PR #1503 merged, živě potvrzeno na prode):** parser tře­huje `object_code` na každou pozici (nejbližší předek `<objekt>`), normalizer ho pošle verbatim (jako `source_ref`), budget item-contract ho nese, join dostal `so_code` param + filtruje před bucketingem (bezpečná degradace: `so_code=None` nebo soupis bez SO-tagů → no-op, nikdy do falešného NEPOČÍTÁNO), assembler tře­huje `_meta.object.code`. **Živě na prode po #1503: deck 2697.941 ✅, rims 266.328 ✅** — inflace ×3–20 pryč. **Inkrement 2 (nazev, NE code→type mapa):** vyšetření přerámovalo «bug 2 = code-based matching» — Monolit `OTSKP_RULES` matchují JMÉNO (ne číselný kód; pravidlo `/mostní pilíře.*stativ/→driky` už existuje), a reálné OTSKP jméno je v `<nazev>` («MOSTNÍ PILÍŘE A STATIVA…»), zatímco `<popis>`=«vč. nátěru ALP+2x ALN…» je projektová přípiska bez element-podstatného jména; parser preferoval `popis`. Fix = parser expo­nuje `catalog_name`=`<nazev>`, join klasifikuje na `catalog_name or description` (name-based klasifikátor Python i Monolit už souhlasí — ŽÁDNÁ parallel structure). Reálný soubor: **VŠECHNY 4 v etalon** (deck 2697.941, rims 266.328, pier_shafts 361.384, abutments 557.851); 451314 «…pod základy pilířů» už neuvázne v driky.

**Odmítnuto:** bundlovat inkrement 2 do #1503 (Alexander: samostatná hodnota + jiná třída rizika = vlastní gate; jedna větev v letu). Code→type mapa v join (parallel structure s classifierem) NEBO code-signal v sdíleném classifieru (Monolit-paritní riziko) — oba zbytečné, protože `<nazev>` řeší vše přes existující name-based cestu. Flip `DESCRIPTION_TAGS` globálně (opce A) — mění `description` pro Workflow A/audit; zvolena chirurgická opce B (separátní `catalog_name` pole).

**Otevřené otázky / chyba session:** ⚠️ **STALE HANDLE** (chyceno živě při re-runu #1503): handle ukládá `parsed_budget` (výstup parseru), ne surové XML → ref vytvořený PŘED deployem parseru tiše vrací stará čísla 24 h (deck 8561), fresh upload → 2697.941. Reálný operační bag. Inkrement 2.5 (ne blokér, do release): stamp parse-version na handle při save, mismatch při resolve → typed `soupis_ref_stale: re-upload required`. Moje chyba prvního běhu: fixoval jsem nejdřív špatnou parse-path (`_parse_aspe_xc4`) — soubor jde přes `_parse_xc4_price_lists`/ASPE_XC4 a `object_code` dropoval AŽ normalizer; přiznáno, dohledáno empiricky (`parse_xml_tree` OK, `normalize_positions` dropoval).

**Co dál:** inkrement 2.5 stale-handle HOTOV (stejná session, separátní PR): `PARSE_VERSION=3` v budget.py (single source, historie 1=base/2=+object_code/3=+catalog_name) → stamp na handle při save (migrace 015, NULL=pre-versioning=stale) → `resolve()` porovná PO owner-scoped SQL (cross-owner stale = not-found, žádný existence-leak) → `{"stale": True}` BEZ payloadu → tool typed `soupis_ref_stale: re-upload required`. Po deployi živý re-run s NOVÝM uploadem → čekám všechny 4 na prode + stale-error na starém ref.

## 2026-07-13 — Session: soupis upload→handle ingestion pro build_bridge_passport (Variant B, #1502 — NEMERGOVÁNO, merge-gate Alexandra)

**Rozhodnuto:** Reálný soupis (~6,6 MB XML) NEPROJDE base64 přes LLM-mediovaný MCP call (megabajty do model-kontextu) — `soupis_file_base64` byl falešný slib pro reálné soubory (třída DWG-binary). **Variant B (Alexander zvolil jako primární):** caller nahraje soubor JEDNOU (multipart, mimo model-kontext) → server ho parsuje → uloží jen KOMPAKTNÍ parsed výsledek pod owner-scoped 24h handle → `build_bridge_passport` čte přes `soupis_ref`. Megabajty nepřežijí upload temp-file. Nový **owned resource v MCP auth-povrchu** (principal = `mcp_api_keys.id` z ověřeného beareru), takže izolace = primární design-constraint. **Zrcadlí `docs/security/isolation_model.md` do MCP:** owner z ověřeného beareru při WRITE (nikdy z body), owner-scoped SQL read (`WHERE soupis_ref=%s AND owner_id=%s AND expires_at>NOW()`), cross-tenant → not-found (žádný 403-který-potvrzuje, žádný timing-oracle), žádný hardcoded fallback — `/api/positions` anti-pattern naruby. **7 vrstev:** migrace 014 (`mcp_soupis_handles`, owner_id→mcp_api_keys.id ON DELETE CASCADE, parsed_budget JSONB, TTL — klon orchestrator_sessions) · `soupis_handles.py` store · `identity.py` (`current_owner_api_key()` = ContextVar pro REST wrapper + FastMCP `get_http_request()` pro `/mcp` path; túly zůstávají auth-param-free) · `POST /api/v1/mcp/soupis/upload` (auth req→401, 20 MB cap, 30/h per-key rate přes Postgres fixed-window bucket, typed 422 `soupis_parse_failed`) · `build_bridge_passport` +`soupis_ref` (precedence nad base64) · assembler `soupis_provenance` → `quantities.source` cituje soubor+počet (Pattern 2/29) · `maintenance.py` POVINNÝ hodinový Celery sweep + opportunistic purge. **cross-user-isolation-reviewer verdikt: PASS** (žádná cesta nečte/nepřepíše/nepotvrdí cizí ref; oba identity-paths trasovány).

**Odmítnuto:** dedup po haši obsahu (Alexander: nový ref na každou upload, TTL uklidí). Klonovat passport_store/bridge_passport_store (jsou global, bez owner — nesmí se použít pro caller-supplied ref). Rozšiřovat auth-resolution kvůli OAuth (viz níže — vyřešeno routováním přes existující `resolve_bearer_token`, ne novou SQL).

**Opraveno z review (2 non-isolation nálezy, oba hardened do stejného commitu):** (a) MEDIUM availability — 20 MB cap byl AŽ PO `await file.read()` (celé tělo do RAM); teď Content-Length early-reject + bounded `read(max+1)` cap na in-memory raw+base64 i při spoofed/chybějícím Content-Length. (b) LOW completeness — `owner_id_for_api_key` routoval jen bare `sk-*`; user-bound `sat-*` OAuth bearer (Claude.ai konektor) 401 na REST uploadu, ač na `/mcp` resolvuje. Teď přes kanonický dual-prefix `resolve_bearer_token → user_api_key → id`, oba povrchy souhlasí; public-DCR/revoked/expired stále → None (fail-closed, izolace beze změny). Docstring `owner_id_for_api_key` opraven (přeceňoval).

**Otevřené otázky:** ŽIVÁ re-verifikace po deployi (upload → soupis_ref → build_bridge_passport na reálném ~6,6 MB soupisu proti Cloud Run + Postgres). GCS-URI varianta pro >20 MB = follow-up. `_upsert_bucket` okno je sdílené s DCR-register konstantou (`REGISTER_RATE_LIMIT_WINDOW_SECONDS=3600`) — obě míněné jako 1h, namespace klíče různý (`rate:soupis_upload:` vs `rate:dcr_register:`), bez kolize; kdyby se DCR okno změnilo, změní i soupis — cosmetic coupling, ne bug.

**Merge-gate:** Alexandrův (prod-povrch se soubory + auth + nová tabulka = maximální tier). PR #1502 OTEVŘEN, NEMERGOVÁN mnou.

**Co dál:** most «plán z pasportu → pozice + TOV jedním krokem», #5 prahy roll-up (Gate-3), composite-parts pokračování, rate 30-vs-42.5 (čeká domain GO), season-default podzim_jaro.

## 2026-07-13 — Session: half-B live-run na reálném SO-202 → 5 extraction-багů, 4 opraveny (#1499)

**Rozhodnuto:** Alexander pustil `build_bridge_passport` živě na reálném SO-202 TZ (bez soupisu) — invariant DRŽÍ (gaps poctivé, nic nefabrikováno), ale extrakce NEÚPLNÁ: 5 багů, dva ⛔ přímo do money-path. SDD-tiket `docs/bugs/passport-extraction-incomplete/report.md` (cílové tvary z ratifikovaného `example_SO202_zalmanov.json`). **Opraveno #1–#4, každý s content-asserting testem (ne jen struktura — to byla díra, kterou golden propustil):** (1) ⛔ DEDUP — assembler emitoval item per klasifikovaný prvek → 3 textové deck-spany = superstructure_deck ×3 (ztrojený deck v kalkulaci); teď akumulace po passport-klíči s ADITIVNÍM slučováním množství. (2) ⛔ EXPOZICE — `_CONCRETE_RE` bral jen marku (C35/45), zahodil `-XF2+XD1+XC4` (curing/durabilita, XF4 ⇒ min 7 d); nový `_concrete_classes()` bere plný řetězec (tolerantní k mezerám i `+`/`,` separátorům, konzervativní). (3) ⚠️ TAKTY+SKRUŽ Z TEXTU — «na pevné skruži ve třech etapách» → `deck_pour_stages=3` + `falsework_technology=fixed_scaffolding` deterministicky ve stage 1 (CZ číslovky, posuvná→mss před bare skruž, letmá→cantilever); assembler merguje s volitelnou VERIFIED výkres-notou. (4) ⚠️ VÝŠKY Z TEXTU — «Výška mostu nad terénem» 8,10/14,90/9,90 → `geometry.decks[].deck_height_over_terrain_m` = max (14.9, skruž +3,2 M); plausibilita 1–60 m, honest-blank. **#5 prahy** (Úložné prahy/záv.zdi/křídla → dubl abutments) = architektonický (classifier→passport-key roll-up axis, mapa sama říká «NOT here yet») → Gate-3 follow-up, odloženo v tiketu.

**Odmítnuto:** Amazon Q dvě blokující (🛑) находки na #1499 — obě FALSE (`_parse_cz_num` je module-level fn resolvovaná v čase VOLÁNÍ, ne definice — přímý call vrací [8.1,14.9,9.9]; `max()` je gated `if deck_heights:` empty→else). Faktická rebuttal v PR, kód nezměněn.

**Otevřené otázky:** ŽIVÁ re-verifikace #1–#4 na reálném TZ (regex psán proti standardní CZ notaci + verbatim citacím, protože TZ text je read-denied pod `test-data/**` — to je i důvod, proč live-run chytil to, co golden ne). Poučení: golden testoval STRUKTURU (klíče ⊆ example), ne OBSAH → nové testy asertují CO se vytáhlo.

**Chyba session (poctivě):** nepustil jsem geometry-golden lokálně před pushem → 4 pre-existing goldeny (2 geometry needs_verify + 2 SO202 object-code grade-only) spadly na CI; opraveno hned (deck_heights = aditivní opt pole mimo needs_verify; object-code asserty na plnou expozici). Pre-push discipline: příště `pytest tests/test_tz_*` celé.

**Co dál:** fronta — most «plán z pasportu → pozice + TOV jedním krokem», #5 prahy roll-up, composite-parts (#1498 pilíř přistál paralelně na main), rate 30-vs-42.5 (čeká domain GO), season-default podzim_jaro.


## 2026-07-12 — Session: ADR-009 (Proposed, Rev 3) — document→worklist spine, tři osy «WorkOntology», de-graveyard axis-B kánonu

**Rozhodnuto:** Z landscape-auditu «4 nespojené implementace seznamu prací» vznikl meta-**ADR-009** (`docs/architecture/decisions/`, status **Proposed** — čeká ratifikaci Alexandra): (D1) 6-stádiový spine Extract→Structure→Quantify→Decompose→Bind→Plan, každé stádium = Core capability s carrier (data+confidence+provenance), doménové profily (bridge/monolit) = profily stádií 2–3, ne paralelní pipelines; (D2) UWO = sémantická vrstva mezi 4 a 5 — stage 4 emituje `uwo_code` z controlled vocab (~50–100), stage 5 = **deterministický adapter** `uwo_code+params → katalog`, NIKDY fuzzy text→code (příklad `dohloubky patek` ∩ `Bednění základů patek` = {patek} → FORMWORK na EXCAVATION); `not_covered_branch` = štandardní výstup routeru; (D3) **TŘI osy** jménem «WorkOntology»: **A** vocabulary+adapters (Pattern 16) → kánon `universal-work-decomposer` · **B** orchestrator workflow → kánon **`docs/specs/document-to-worklist/SPEC.md`** (importován 2026-07-12 z PK-only TaskSpec; «PDF» byl ve skutečnosti ZIP rastrů+text-layer — proto ho `find`/grep nikdy neviděl) + `_SO202_Bridge` + `_KROS_Adapter_Wrap`, **živá, NE hotová** · **C** element typing (head-noun) → shipped `element_types.yaml`+normalizer, KOMPONENT stádií 2/4; (D4) supersedes-ledger per osa (lék na PK-graveyard); (D5) osa B přejmenována `document-to-worklist` — slovo «WorkOntology» BYLO zdrojem kolize.

**Oprava po Alexandrovi (Rev 1→2):** Rev 1 sloučil tři osy do dvou a orchestrator-rodinu označil «element classification, done» — falsifiable test (grep DoD-strings + čtení SO202/KROS_Adapter celých) potvrdil Alexandrovu korekci: SO202+KROS_Adapter = workflow (osa B), živé; nález navíc — repo-`SO250.md` nese axis-C obsah (#63–70 head-noun) pod axis-B jménem = mis-scoped. **Import-balíček z PK byl sám z poloviny hřbitovní:** SO-250 fixture reálně chyběla (→ `test-data/tz/SO-250.md`), SO-202 kopie z PK byla STARÁ verze bohatšího repo-souboru (28 KB vs 12 KB — NEimportováno), VP4 byte-identická (skip). Pravidlo potvrzeno dvakrát za den: **kritická cesta nesmí vést přes úložiště, které implementující agent nečte; každou PK-citaci ověřit proti repu.**

**Odmítnuto:** ratifikace ledgeru v Rev-1 podobě (pohřbila by živý workflow-kánon a poslala stavět vocab bez acceptance criteria jeho jediného konzumenta → «pátá implementace»); vocab v1 PŘED reconcile SO250 (pořadí: DoD → slovník); `test-data/golden/` jako nový domov fixtur (paralelní struktura — repo-konvence je `test-data/tz/`).

**Otevřené otázky:** ratifikace ADR-009 (3 osy + ledger + stamps); **SO250.md reconcile — jediné otevřené rozhodnutí:** (a) přejmenovat na element-typing acceptance doc (obsah zůstává, osa C), nebo (b) přepsat na Stage-1 worklist intent rodiny; potvrzení pořadí SO250 → vocab v1 → `create_work_breakdown` split (SPEC §9.1 BLOCKING pro Stage-1 invariant «žádný kód, žádná cena» server-side).

**Co dál:** po ratifikaci — stamps (`SUPERSEDED_BY` na `TASK_UWO_Bridge_Ontology` s opravou křivého ukazatele, header-linky na kánon do dvou family-tasků) → SO250 reconcile dle volby → vocab v1 proti SPEC DoD §3.5.


## 2026-07-12 — Session: composite #7 — pilíř jako druhý composite-typ (aditivní, engine netknutý)

**Kontext:** Fronta-poznámka „composite-parts Gate 3+ (přerušeno na design-gate)" byla ZASTARALÁ — celá composite-element-parts (Gates 0–5) je smerged na main (PR #1412 Fáze 1 + PR #1422 Fáze 2, live-tested 2026-07-07). Jediné reálně zbývající = follow-upy z out-of-scope. Alexander vybral **pilíř jako 2. composite-typ**.

**Rozhodnuto (Gate 0 recon → interview → aditivní implementace, engine `planComposite` netknutý):**
- **Šablona pilíře = 2 části: dřík (`driky_piliru`) + hlavice (`rigel`).** Základ (`zaklady_piliru`) = samostatná smětní položka, NE část — symetricky s opěrovou šablonou (interview §0 „základ = samostatná položka"). Podložiskový blok taktéž mimo.
- **Typové podíly = placeholder nesené EXPLICITNÍM `volume_ratio` v šabloně** (dřík 0.75 / hlavice 0.25), NE přes sdílenou `PLACEHOLDER_PART_VOLUME_RATIOS` mapu — protože `driky_piliru` je sdílený s opěrou; explicitní ratio dekopluje obě šablony (budoucí kalibrace jedné nehne druhou). Nové optional pole `PartFormState.volume_ratio` + `buildPartInput` ho forwarduje; `planComposite.ratioFor` ho už preferuje (engine beze změny). Kalibrace VP4/SO-250/Žihle = data-swap follow-up.
- **Výběr šablony „po typu rodiče":** `compositeTemplateFor(element_type)` → `opery_ulozne_prahy`=abutment / `driky_piliru`=pier / else null. `showCompositePanel` + seed-tlačítko + copy panelu se řídí rodičem; copy zneutralizována z „opěra"-specifické na „složený prvek / pilíř" (Σ {noun}, „Rozložte {noun}", apply-note bez deklinace). `applyPlanToPositions` fallback item-name 'Opěra'→'Složený prvek'.
- **Domov šablony = frontend const** (`PIER_PART_TEMPLATE` vedle `ABUTMENT_PART_TEMPLATE` v `compositeParts.ts`) — konzistence se SHIPNUTOU realitou. ⚠️ design.md §5.6/§11 ratifikovaly „single-source v element_rules yaml", ale opěrová šablona shippla jako frontend const → pilíř drží tuto realitu, yaml-single-source = otevřený follow-up pro OBĚ šablony (až přibude 3. konzument, např. MCP composite).

**Odmítnuto:** foundation jako část pilíře (interview: samostatná položka, symetrie s opěrou); ratios přes sdílenou mapu (coupling driky_piliru mezi šablonami); zvláštní „Šablona pilíře" tlačítko VEDLE opěrového bez ohledu na typ (interview: po typu rodiče, míň tlačítek).

**Testy:** shared **1427** (+2: pilíř all-ODHAD explicit-ratio 75/25 + exact-dřík-hlavice-residual — discriminační: kdyby leakla mapa, split by byl ≈31/69) · frontend `compositeParts.test.ts` **+7** (compositeTemplateFor mapa · makePierTemplate · abutment ratio-free parita · buildPartInput ratio-forward/omit) · gate5 9 bez regrese · tsc + vite build čisté. Engine/goldeny byte-identické (composite-planner.ts netknutý).

**Otevřené otázky / fronta:** live-verifikace na kalkulator.stavagent.cz po deployi (šablona pilíře na reálné pozici → dřík+hlavice, ODHAD 75/25, Aplikovat → řádky pod jednou položkou); kalibrace `PIER_PART_TEMPLATE` + `PLACEHOLDER_PART_VOLUME_RATIOS` z reálných dat (data-swap); yaml-single-source obou šablon (až 3. konzument). Zbytek fronty beze změny: most pasport→pozice+TOV, half-B live-verify, monolith #1472, rate 30-vs-42.5 (čeká domain GO).

**Co dál:** commit (design / kód+testy / soul) na `claude/stavagent-session-init-udi5oc`; PR až na pokyn Alexandra.


## 2026-07-11 — Session: xhigh code-review vlastního #1495 → 11 fixů (#1496 merged)

**Rozhodnuto:** Po mergi #1495 spuštěn xhigh self-review (10 finder-úhlů → ~55 kandidátů → dedup → verifikace čtením kódu; verifier-subagenti spadli na Fable-5 limitech, dokončeno ručně na opus-4-8). 15 nálezů, **11 opraveno v #1496** (correctness-first, každý s regresním testem). **Klíčové fixy:** (1) `construction_process` injektován SKRZ `assemble_bridge_passport` (single emit-point) místo post-validate splice → malformed fragment = typed `assembly_invalid`, ne «úspěch» s nevalidním pasportem; gaps se čistí PER-FIELD (falsework-only fragment nechá gap na `deck_pour_stages`). (2) blokující Vertex fallback → `asyncio.to_thread` (jinak murky-TZ zablokuje event loop na Cloud Run). (3) chunked `_LLM` swap přes await → task-local `ContextVar` (async-safe, žádná race; VEŘEJNÁ signatura tulu čistá — parametr-seam rozbil JSON-schema tulu, porušení MCP authoring rule). (4) LLM gate: explicitní `TZ_LLM_FALLBACK=0` vypne i na Cloud Run (kill-switch), gate na `VERTEX_AVAILABLE`, dict-tolerance preferuje `elements` klíč. (5) soupis s 0 items → typed `soupis_parse_failed`. (6) `bridge_passport_store.save()` vrací durability bool → `stored=False` při memory-only fallbacku; deepcopy proti aliasingu. (7) manifest `writes_state=True`+`DRAFT_ONLY`. (8) docs: `tz_filename` = SO-code detection, CLAUDE.md TL;DR 21→22. Testy: +5 golden regresí + nový `test_extract_tz_llm_seam.py` (5); lokálně 126 passed (jen bcrypt-only fail, CI-covered). Amazon Q na #1496: čistý review, «ready for merge».

**Odmítnuto/odloženo (v PR popisu):** store tenant-namespacing — dnes je store WRITE-ONLY (nic nečte podle id, `passport_plan` bere pasport-dict přímo), takže cross-tenant overwrite nemá konzumační cestu; MUSÍ se namespacovat PŘED přidáním read-by-id. `object_type` zamčen na `bridge` (tool se jmenuje build_BRIDGE_passport, non-bridge je mimo scope názvem).

**Otevřené otázky:** živá verifikace half-B po deployi CORE (build_bridge_passport proti reálnému SO-202 TZ PDF + soupisu; LLM fallback firing) + AI-tlačítko na kalkulator.stavagent.cz.

**Co dál:** fronta beze změny — most «plán z pasportu → pozice + TOV jedním krokem» (nový kandidát z Alexandrova dotazu), composite-parts Gate 3+, monolith #1472, rate 30-vs-42.5 (čeká domain GO), season-default podzim_jaro.


## 2026-07-11 — Session: half-B Gates 2–6 KOMPLETNÍ — dokumenty → pasport, MCP `build_bridge_passport` (22 tools)

**Rozhodnuto:** Celá polovina B tz-passport doведена do konce v jedné session (PRs #1490 element-map+budget-fix, #1491 join+AI-button, #1493 assembler+store, #1494 notes-gate, + Gate 5/6 commit). **Gate 2:** element-key mapa = sdílená DATA `element_rules/passport_element_map.yaml` (9 klíčů → engine_type/per_deck/concrete_use) → gen-knowledge.mjs TS artefakt + Python loader (lru_cache, inverse first-declared-wins; W3→passport osa VĚDOMĚ odložena na reálný classifier vocab); budget.py routing FIX (mrtvé importy, `_positions_from_parsed_document` flattener); soupis-join aditivně mass/length (`_PRESTRESS_RE` PŘED `_REBAR_RE`, t→kg, bm jen římsa, ambiguita never-split). **Gate 3:** `bridge_passport_assembler.py` = jediný emit-point (LIVE classifier injektován, model_validate před návratem, honest `_meta.gaps`, unmapped etypes nahlas skipped) + `bridge_passport_store.py` (Cache-Aside, ukládá ORIGINÁLNÍ aliased dict, validace write i read). **Gate 4:** notes-větev `validate_drawing_element` — trio z výkresu čte host-vision, gate re-parsuje verbatim (`_CZ_NUMERALS`, `_FALSEWORK_STEMS` mss-před-pevnou); 0.95 TZ-koroborace / 0.90 nota / 0.0 REJECTED_MISMATCH; jen VERIFIED → ready-to-paste fragment; Amazon Q catch na #1494 REÁLNÝ (partial-claims downgrade) — opraven provided-claims sémantikou (jeho návrh fixu byl ale identický s bugem). **Gate 5:** MCP `build_bridge_passport` (21→22, credits 15, 6 counter-souborů + workflow allow-listy synchronně): stage 1 → volitelný soupis (fail = typed error, nikdy tichý pasport) → assembler → volitelný VERIFIED fragment (smaže svůj gap) → volitelný store; `_LLM` seam napojen na reálný Vertex (`_make_vertex_llm`, gated TZ_LLM_FALLBACK/K_SERVICE, jen materials, conf 0.70; docs-lež opravena). Golden E2E 6 testů (reálný extraktor+classifier+assembler, soupis mock na seamu, structure-grounding vůči `example_SO202_zalmanov.json`, transport-test). **Gate 6:** root CLAUDE.md v4.41.0 (22 tools, mapping row, changelog), requirements.md status, tato entry.

**Odmítnuto:** Amazon Q «critical» findings na #1493 — všechny 3 ověřeny jako FALSE (path traversal nemožný bez separátoru v `_SAFE_ID`; str(None) nedosažitelný s CI-guarded YAML; test path správný) — jedna faktická rebuttal v PR.

**Otevřené otázky:** ŽIVÁ verifikace po deployi CORE (build_bridge_passport proti reálnému SO-202 TZ PDF + soupisu; LLM fallback firing na Cloud Run); per-span heights follow-up; W3→passport osa v mapě.

**Co dál:** fronta beze změny — #7 composite-parts Gate 3+, monolith #1472, rate 30-vs-42.5 (čeká Alexandrovo domain GO), season-default podzim_jaro (hold), live verifikace AI-tlačítka.


## 2026-07-11 — Session: AI-кнопка TZ-парсера kalkulátoru («Я за кнопку ии») + height_m compat bug

**Rozhodnuto:** Extraction ladder pro TZ smart input (Determinism > AI): regex pass beze změny (conf 1.0/0.9); nové tlačítko «✨ Doplnit pomocí AI» → Monolit backend `POST /api/tz-ai-extract` → CORE Vertex (multi-role seam, klíče nikdy ve frontendu) → robust JSON extraction (fence/prose/bare, null = typed error, nikdy fabrikace). **Jeden zdroj «co vytahovat»:** `shared/parsers/tz-ai-extraction.ts` — `buildExtractionManifest(element_type)` derivuje pole z REQUIRED_FIELDS (element-specific labels) + SANITY_RANGES (rozsahy) + `explainIncompatibility` (aplikovatelnost); prompt se staví server-side z TÉHOŽ manifestu; budoucí MCP konzument čte tentýž (ADR-008 nota). **Merge-guard `mergeAiParams`:** AI vyplňuje JEN díry po regexu (nikdy nepřepisuje), citace povinná (bez quote se návrh nezobrazí), sanity-range validace PŘED zobrazením, typová koerce (čárka→tečka, exposure string→UPPER pole, bool), duplicity first-wins, **conf cap 0.70** (lestenka repa). UI: AI párametры tečou existujícím triage/apply (checkbox + human confirm), badge [AI] s citací v tooltipu, honest counts «X návrhů · Y odmítnuto», error state neblokuje deterministickou cestu. `ExtractedParam.source` += 'ai' (aditivní).

**Bonus nález (třetí výskyt třídy passport-height-skruz):** `ELEMENT_TZ_COMPATIBILITY.mostovkova_deska` NEOBSAHOVALA `height_m` — kritické pole (REQUIRED_FIELDS!) z TZ-textu se pro mostovku triažilo «jiný typ» a tiše zahazovalo. Opraveno (+ rigel), klasifikátorová suita bez regrese.

**Testy:** shared **1425** (+10: manifest 3 / prompt 2 / merge-guard 5) · backend **110** (+6 extractJsonArray) · frontend 18 · tsc + vite + shared build čisté.

**Otevřené otázky:** živá verifikace po deployi (tlačítko na kalkulator.stavagent.cz proti prod CORE — force-JSON na Gemini stále není, robust parse to kryje); GitHub konektor odpojen → PR #1491 (Gate 3 part 1 + tato féča) čeká merge po re-auth.

**Co dál:** merge #1491 → half-B Gate 3 part 2 (assembler skeleton + use-keyed stage 1 + store + LLM seam).


## 2026-07-11 — Session: half-B extraction Gate 0 audit (tz-passport) — ingredience existují, emitor je greenfield

**Rozhodnuto:** Alexander vybral half-B jako další prioritu (half-A živě doказан, paspport se dnes staví ručně). Gate 0 read-only audit hotov → `docs/specs/tz-passport-json/halfB-gate0-audit.md`. Klíčové: všechny INGREDIENCE existují (extract_tz_fields stage-1 vč. geometrie; map_soupis_to_elements m³-join; validate_drawing_element P39/40 host-vision gate; recipe_runner._quantify_from_documents assembly seam), ale **emitor `BridgePassport` neexistuje** — jen konzument. 6 gapů: slovníková mapa CZ classifier ↔ EN passport klíče (dnes jen TS ELEMENT_RULES → povýšit na sdílená DATA vzorem element_types.yaml); use-keyed concretes; quantities nad m³ (rebar t / prestress / height / length_bm); **calculable-critical trio bez extrakční cesty** (poznámka «V 3 TAKTECH NA SKRUŽI» = obraz na výkrese → stage 2 jádro); per-deck geometrie + post_tensioning; vlastní store (passport_store je ProjectPassport-locked). Nálezy mimo plán: 🐛 budget.py rozbité parser-routing (parse_komplet/parse_rts_rozpocet + UniversalParser().parse_file NEEXISTUJÍ → komplet/rts-pojmenované soupisy padají; v kritické cestě stage 3); docs-lež v extract_tz_fields («existing Vertex routing» — _LLM je test-only None); dvě QuantityItem třídy.

**Otevřené otázky:** B-INTERVIEW (Q2 kde běží / Q3 LLM-vs-regex upřesnění + vision režim + governance slovníkové mapy) — otázky položeny Alexandrovi v chatu, čeká odpověď. Fronta beze změny + NOVÉ: season-default (engine `podzim_jaro` 21d skruž hold, passport sezónu nenese → možné nadhodnocení hold) — ne-blokér na potom.

**Co dál:** po interview → Gate 1 ADR → gates dle ratifikace.


## 2026-07-11 — Verify: passport bugfix trio ŽIVĚ POTVRZEN na produkci — height-bug byl +51 % aggregate

**Rozhodnuto:** Alexander po deployi prohnal TENTÝŽ reálný passport prod-MCP → všechny tři fixy zelené, tikety CLOSED (verify.md v každém). **(1) height→skruž:** `height_m: 14.9` + ℹ️ nota doletěly; ⛔ warning pryč; props blok POSAZEN — Staxo 100, 576 stojek/takt, 92,2 t, 42 d → `props_rental 1 814 400` + `props_labor 653 357` = **2 467 757 Kč nově ve smetě; aggregate 6 325 799 → 9 531 702 Kč (+3 205 903, +51 %!), dny 252 → 284**. Impact byl PODhodnocen — ne „15–25 % NK", ale TŘETINA smety celého SO; height-bug byl nejdražší nález celé série. **(2) exposure:** celý set `["XF1","XD1","XC4"]` doletěl, engine flaguje XF1+XD1 per-class (⚠️ zůstal = SPRÁVNĚ — čestný TZ-vs-doporučení signál, ne bug). **(3) typed-error:** křivý passport přes konektor → čistý `invalid_passport` + details s `loc`/`msg` (agent ví, CO opravit), žádná opakní transport hláška. **Passport half-A tímto UZAVŘEN:** mapper, Pattern 53, symetrie, honest-ignore, pour-window signál — vše živě ověřeno na SO-202.

**Learning (Pattern-kandidát):** zelené golden testy autora ≠ verify — fixture procházel mapper, ale nikdo neassertoval ŘÁDOVÝ dopad na aggregate číslo. Verify-na-produkci reálným vstupem od uživatele našel za jeden prohon 3 bugy včetně +51% díry. Goldeny po fixu pinují falsework > 0; příště pinovat i řád aggregate.

**Otevřené otázky / fronta (NEZTRATIT):** half-B extraction (tz-passport, interview Q2/Q3 čeká); monolith-classification #1472 (zaparkováno); rate 30 m³/h (engine q_eff/pumpa) vs 42,5 finishing (v4.36, jen Nh-osa) — na 449 m³ mostovce rozhoduje «16h > směna», Alexander: až dojde řada, NE teď; composite-parts Gate 3+ (přerušeno na design-gate); AI-vrstva extrakce TZ (návrh architektury v session logu 11.07 — manifest + ladder + MCP sdílení, čeká na GO + 3 odpovědi).

**Co dál:** dle Alexandrova výběru z fronty.


## 2026-07-11 — Session: passport live-run bugfix trio — height→skruž, exposure_classes, MCP error transport

**Rozhodnuto:** Alexander prohnal reálný passport prod-MCP → 449.66 m³/takt potvrzen, pour-window fyzika křičí správně (16h > okno — signál neztracen), ALE 3 bugy. SDD tikety `docs/bugs/{passport-height-skruz, passport-exposure-single, passport-mcp-error-transport}` (report+analyze+fix), fixy v prioritě peníze→korektnost→DX. **(1) height→skruž (P0, PR #1486):** mapper nečetl `geometry.decks[].deck_height_over_terrain_m` (objekt per KŘÍŽENÍ — road 8.1 / stream 14.9 / field 9.9; decks symetrické) → mostovka bez `height_m` → engine přeskočil skruž+stojky (15–25 % NK) s ⛔. Fix: `height_m = max přes křížení` (nejvyšší pole řídí systém; VĚDOMĚ bez odpočtu stavební výšky NK — pole může měřit k soffitu, chyba na drahou stranu); `qty.height_m` override vyhrává; ℹ️ note; bonus `constant_depth_m → deck_thickness_m`; Pydantic deklaruje obě konzumovaná pole (governance STRICT-on-consumed). **(2) exposure (P1, PR #1486):** mapper posílal jen `exposures[0]` — «XC4+XF4» by ztratil XF4 curing minimum. Fix: předat `exposure_classes` celé (preferované engine API, curing = max, rogue flags per-class) — ŽÁDNÁ výběrová heuristika v mapperu, engine = single source. Golden order-independence «XC4+XF4» → curing ≥ 7 d. **(3) MCP error transport (P2, PR #1487):** typed error na funkci OK, ale konektor viděl «outputSchema defined but no structured output» — reprodukováno in-process: `ve.errors()` nese živé exception objekty v `ctx` → FastMCP serializace structured contentu padá. Fix: `ve.errors(include_url/context/input=False)`; transport-level test přes in-process `fastmcp.Client` (nová třída testu!); registrace ve workflow (3 místa); CLAUDE.md authoring rule «error dicty striktně JSON-serializovatelné + transport test». Bonus ranní: Gate 6 parity test registrován v mcp-compat workflow (chyběl v allow-listu → nikdy neběžel v CI). Testy: shared **1415** (+6 golden) · backend parity 42 · MCP transport 2 + goldeny.

**Odmítnuto:** per-deck výšky (hodnoty jsou per křížení, ne per deck — decks symetrické, `num_bridges` tvar správný); odpočet stavební výšky NK od výšky (nejistá konvence pole, riziko chyby na levnou stranu); výběr exposure průnikem s RECOMMENDED_EXPOSURE (u dříků «XF1+XD1+XC4» by vybral XC4 a PODcenil curing — allow-list není severity); fabrikace XF2/XF4 pro dříky (TZ authority — golden pinuje viditelný ⚠️ XF1 flag, ne přepis); raise ToolError místo typed dictu (mění kontrakt, rozchází se s konvencí ostatních tools).

**Otevřené otázky:** live-verifikace po deployi (verify.md všech tří ticketů): prod MCP bez ⛔ skruž warningu + skruž v aggregate; konektor dostane typed invalid_passport. Rozpor rychlosti betonáže: engine 30 m³/h vs v4.36 finishing-rate 42.5 — samostatně prověřit (ne blokér). Follow-up: per-span výšky → per-tact skruž (engine změna, až bude poptávka).

**Co dál:** PR #1487 → zelené CI → merge. Pak live prohon passportu znovu (Alexander) → verify.md.


## 2026-07-11 — Session: monolith-classification Gates 5–7 — kontrakt výstupu, MCP parita, docs (SPEC KOMPLETNÍ)

**Rozhodnuto:** **Gate 5:** routing v `applyPlanToPositions` extrahován do čistého exportovaného `routeDraftsToBuckets` (testovatelné bez sítě); nový `readFormworkIncluded(metadata)`; při `formwork_included` na hlavní beton pozici se bednění drafty SVINOU do beton pozice s poznámkou «v ceně betonové položky» místo AUTO-VYTVOŘENÍ sourozence — ten by DVOJÍ započítal práci už zaplacenou v jednotkové ceně OTSKP betonu; explicitní bednění řádek (URL id / linked) vždy vyhrává nad flagem; `rebar_included` vědomě NEsvinuje (true je default i při samostatné výztuži — svinutí by bylo špatně pro běžný OTSKP layout); dny se nedvojí (projekce emituje beton před bedněním → dominantní trio main-bucketu je betonářovo, `addDraftToBucket` nikdy nepřepisuje; doba prvku = kritická cesta v `metadata.schedule_info`). Composite-cesta vědomě nedotčena (jiná sémantika — explicitní per-part rozklad). +9 frontend vitest (`applyPlanToPositions.gate5.test.ts`: collapse ano/ne/explicit-wins/výztuž-nikdy + non-doubling + správná pozice). **Gate 6:** nový `concrete-agent/.../tests/test_monolith_classification_mcp_parity.py` (konvence golden-so250: sync + asyncio.run, bez fastmcp) — goldeny pilíř/římsa unchanged (spec se concrete-agentu nedotkl, jiná osa) + **PINNED GAP**: W3 nemá monolith/prefab osu («PATKY Z DÍLCŮ C25/30» tam dnes = beton-typ `zaklady*`); test pinuje dnešek, aby aditivní přidání osy bylo vědomé. Lokálně 21 pytest (golden 17 + parity 4); plná mcp-compat suite poběží v CI (soubor triggeruje workflow). **Gate 7:** `domain.md §4.5` — kanonický signální žebříček (tabulka 8 pater) + 4 katalogová rozvržení + párování/flagy/svinutí + MCP-gap pointer; root CLAUDE.md v4.40.0 changelog + počty (shared 1409 · backend Jest 104 · frontend 18); tasks.md všech 8 gates ✅. Testy celé sady: shared 1409 · backend 104 · frontend 18 · pytest 21 · tsc + vite build zelené.

**Odmítnuto:** Svinovat i na `rebar_included` (sémantika flagu to nedovoluje); collapse v composite-cestě (explicitní rozklad má opačný účel); instalace celého concrete-agent requirements kvůli lokální mcp-compat (classifier importovatelný přímo — golden-so250 disciplína).

**Otevřené otázky:** Live-verifikace po deployi (spec §5): SO-202 import → «Jen monolity» + skupiny; «PATKY Z DÍLCŮ» NE-monolit; Aplikovat na OTSKP-layout pozici → bednění «v ceně», žádný nový řádek. Budoucí: aditivní prefab-osa v MCP classify; badge-UI pro name_overlap návrhy; Excel-cesta persist flagů do metadata (dnes je zapisuje jen Registry-cesta — Excel je má in-memory na parser objektech).

**Co dál:** PR Gates 5–7 → zelené CI (vč. mcp-compat) → merge. SPEC monolith-classification tím KOMPLETNÍ.


## 2026-07-11 — Session: monolith-classification Gate 4 — obě cesty importu na sdílené vrstvě, 3 kopie determineSubtype smazány

**Rozhodnuto:** Všechny tři divergentní `determineSubtype` kopie (concreteExtractor unit-first→beton · import-from-registry text-first→jiné · coreAPI unit-substring→beton) nahrazeny TENKÝMI delegáty nad `classifyMonolithRow` (concreteExtractor/coreAPI: exportovaný 3-arg delegát s volitelným kódem; import-from-registry: inline volání, lokální fn smazána). concreteExtractor ztratil i separátní isMonolithicElement re-gate (žebříček řeší kamenivo-m³ přímo). **Registry-import konečně nese metadata**: `POSITION_INSERT_COLUMNS` +'metadata' (16→17, param-cap math 17×500=8500 OK), builder pushuje `pos.metadata||null` → override + linked_positions na této cestě poprvé MOHOU existovat. **Grouping na Registry-cestě**: po sestavení pozic per-sheet běží `groupMonolithRows`; AUTO (code_prefix) děti přebírají parent.part_name (flat tabulka je konečně seskupí do jednoho prvku), SUGGESTED (name_overlap) zůstávají vlastní řádek; parent dostává `metadata.linked_positions` ve STEJNÉM tvaru jako Excel-cesta (+aditivní `pairing` a `formwork_phase`) + formwork_included/rebar_included. `row_role==='section'` řádky ze struktury Registry se přeskakují explicitně. Shared `normalizeUnit` navíc strippuje vnitřní mezery ('m 3' z divokých XLSX). **Parity test** (Krit. 4): nový `backend/tests/services/subtype-parity.test.js` — BEZ mocku shared (pointa = parita proti REÁLNÉMU klasifikátoru), 11 fixtur žebříčku (marka · včetně-bednění · prefab-veto · kamenivo · §451x · asfalt · výztuž-nad-markou · bednění zřízení/odstranění · weak m³ · dilatace) + zero-signal řádek, na kterém se staré kopie rozcházely. Mocky '@stavagent/monolit-shared' ve 2 route-testech rozšířeny (classifyMonolithRow+groupMonolithRows). Backend deps nainstalovány lokálně (node 22, better-sqlite3 v9 OK) → **backend Jest 104** (bylo 92, +12) · **shared 1409 vitest** · tsc oba balíky zelené.

**Odmítnuto:** Adoptovat parent.part_name i pro name_overlap děti (návrh nesmí tiše slučovat — interview odpověď 3; badge-UI = budoucí práce, zatím jen metadata); konzumovat `skupina` z Portalu (klasifikaci nic nepřidává, jen by šuměla).

**Otevřené otázky:** Gate 5 (kontrakt výstup kalkulátoru → pozice: formwork_included ⇒ svinout bednění, dny = kritická cesta) · Gate 6 (MCP parita + full pass) · Gate 7 (docs). Live-verifikace Registry-importu po deployi (skutečný projekt → skupiny + metadata).

**Co dál:** PR Gate 4 → zelené CI → merge. Gate 5 na pokyn.


## 2026-07-11 — Session: monolith-classification Gate 3 — sdílená skupinová vrstva (4 katalogová rozvržení)

**Rozhodnuto:** Nový sdílený modul `shared/src/monolith-grouping.ts` — `groupMonolithRows(rows)` povyšuje párování z Excel-only `findPairedRows` do shared vrstvy (Gate 4 přepojí volající). Řádky → `{groups: [{parent, classification, children[], formwork_included, rebar_included}], ungrouped[]}`. Párování per interview odpověď 3: **`code_prefix`** (4-znaková shoda kódu) = AUTO; **`name_overlap`** (≥2 významná slova ≥5 znaků rodiče v textu dítěte, best-count vítězí, remíza = pořadí dokumentu) = NÁVRH (badge + odpojitelné); nepárovatelné dítě se NIKDY nepřilepí násilím → `ungrouped`. Bednění děti nesou `formwork_phase: montáž|demontáž` (ÚRS zřízení/odstranění pár = JEDNA sub-role, dvě fáze — ADR-007 §3; demontáž detekce `odbedn|demontaz|odstran`). Flagy `formwork_included`/`rebar_included` zachovávají tvar z findPairedRows (bedn-zmínka na beton řádku; `nezahrnuje×vyztuz` → false). **Klasifikátor dostal inclusion-guard** (chycen PŘED kódem při návrhu testů): OTSKP beton řádky doslova nesou «VČETNĚ BEDNĚNÍ» — sub-work text krok by rodiče unesl do bednění; nový `INCLUSION_MENTION_RE` (vcetne/vc./zahrnuje/s/se + až 2 slova + noun, VČETNĚ spojkového výčtu «bednění a výztuže» — první verze regexu výčet nepokryla, all-in-one golden ji chytil) se stripuje před sub-work testem; grouping čte flagy z plného textu. Exporty `normalizeCzechText`/`cleanOtskpCode` (jedna normalizace, ne kopie per modul). Golden testy per rozvržení: OTSKP (kód-prefix auto + formwork_included) · ÚRS (3 děti, fáze montáž/demontáž) · all-in-one (bez dětí, flagy, nezahrnuje-výztuž flip) · all-separate bez kódů (name_overlap návrhy) + disambiguace (dítě si vybere SPRÁVNÉHO rodiče dle prefixu) + failure-módy (orphan/kamenivo/prefab ungrouped, 1 slovo nestačí). **+14 testů → 1409 shared** + tsc + build zelené.

**Odmítnuto:** Odvozovat `layout`-label per skupina (all-in-one vs „zatím nezadané sub-práce" nerozlišitelné — nepředstírat); bundling z OTSKP katalogové konvence (kód→formwork_included bez textu) = KB znalost, případný follow-up, Gate 3 zůstává čistě textový.

**Otevřené otázky:** Gate 4 — obě cesty importu konzumují klasifikátor+grouping, smazat 3 kopie determineSubtype, parita test; Registry-import INSERT dostat metadata sloupec.

**Co dál:** PR Gate 3 → zelené CI → merge. Pak Gate 4 na pokyn.


## 2026-07-11 — Session: monolith-classification Gate 0-2 — audit, ADR-007, sjednocený klasifikátor (foundation)

**Rozhodnuto:** Alexander schválil všech 5 doporučení interview → Gate 0 (audit 4 paralelními průzkumníky, nálezy v `design.md §2.2`: prefab-filtr mimo primární grade-cestu; 3 divergentní `determineSubtype` s protichůdnými defaulty; Registry-import INSERT bez `metadata`; Portal `row_role`/`skupina` ignorovány; párování jen v Excelu; MCP bez prefab-osy + mrtvý `reject_materials`) → Gate 1 (**ADR-007**: žebříček override → sub-work text → prefab-veto NAD markou → aggregate → marka ~0.95 → kód ~0.9 (+§451x prostý-beton výjimka ~0.75) → m³+keyword ~0.6 → fallback 0.3; bednění = JEDNA sub-role dvě fáze; párování auto-na-prefix / návrh-na-název; import celotabulkový; domov = rozšířit `monolith-classifier.ts`; číslo 007 — README rezervuje 001-004+006 pro pattern-ADRs) → **Gate 2 hotov**: `classifyMonolithRow()` v `shared/src/monolith-classifier.ts` vrací `{is_monolith, is_prefab, sub_role, confidence, decided_by, signals}`; `isMonolithicElement()` = zpětně kompatibilní wrapper; nové sdílené konstanty `CONCRETE_GRADE_RE` (C xx/yy + LC + UHPC C110-170) a `PREFAB_RE` (`prefa|\bdil\w{0,3}\b` — vědomě NEmatchuje `dilatacni`!); sub-work text (výztuž/bednění) poráží marku (výztuž-řádek cituje marku rodiče); kód když přítomen ROZHODUJE (6xxxx/9xxxx nikdy nepropadne do fallbacku — vlastní regrese chycena před testy); `MonolithCandidate.unit` aditivní (tie-break only). +19 testů (marka/LC/spaced · prefab-veto-nad-markou «PATKY Z DÍLCŮ C25/30» · dilatace-guard · sub-work-nad-markou · §451x výjimka + kamenivo + asfalt-guard · weak m³+keyword + m³-sám-fallback · override absolutní obě strany · unit-tie-break · wrapper-parita) → **1395 shared testů** + tsc + shared build zelené; 15 původních testů beze změny.

**Odmítnuto:** Naivní port prefab-substringu 'díl' po normalizaci (matchoval by 'dilatační' — v mostních BOQ všude); non-mono-kód + beton-keyword deferovat obecně (asfaltový beton by prošel — výjimka jen §45x); dvě sub-role pro montáž/demontáž bednění.

**Otevřené otázky:** Gate 3 (sdílená skupinová vrstva, 4 katalogová rozvržení) → Gate 4 (obě cesty importu konzumují, smazat 3 kopie, parita test) → Gate 5-7. Backend Jest lokálně nešel (chybí node_modules) — ověří CI.

**Co dál:** PR Gate 2 → zelené CI → merge. Pak Gate 3.


## 2026-07-10 — Session: cleanup po #1476 — content-fingerprint dedupe backendSync push + monotónní hodiny guardů

**Rozhodnuto:** Dva vědomě odložené nálezy z review #1476 dotaženy. **(1) backendSync push dedupe:** App.tsx effect (`[projects, selectedProjectId]`) spouští `pushProjectToBackend` na KAŽDOU identity-změnu `projects` — včetně server-originated (merge monolith-payloadu po «Aplikovat», přepnutí projektu), a `suppressAutoSync` React-effect gate-ovat NEMŮŽE (běží až po zavření synchronního okna). Fix na správné výšce = content-based dedupe přímo ve funnelu pushů: `projectPushFingerprint(project)` serializuje PŘESNĚ to, co push posílá (header + per-item projekce vč. `serializeClassification` blobu) → identický obsah se skipne PŘED login/availability probe (nula sítě, nula UPSERTů na db-f1-micro); otisk se zapisuje JEN při plném úspěchu (fail/partial vždy retryuje); `deleteProject`/`deleteAll` otisky čistí; `loadFromBackend` otisk SEEDUJE z hydratovaného obsahu → startovní echo-push vlastních dat backendu se přeskočí (lokální rozdíl otisk změní a pushne). Badge: skip v 'pending' stavu vrací na 'idle' (pokud nic jiného nečeká). **(2) Monotónní hodiny:** guard-y v `portalMonolithFetch` přešly z `Date.now()` (nástěnný čas — skok ZPĚT dělá záporné delty: cache «věčně fresh» do doby, než čas znovu doleze ke značce, dead-mark se natahuje o skew) na `performance.now()` (monotónní). Testy TTL přepsány z fake-timers na explicitní `performance.now` spy. Testy: +5 fingerprint kontrakt (`backendSync.fingerprint.test.ts`: echo-skip / content-change push / fail-neregistruje / delete-čistí / classification-mění-otisk) → **Registry 271 vitest** + tsc + vite build zelené.

**Odmítnuto:** Gate-ovat effect přes flag (React effect běží mimo sync-okno — mechanicky nemožné); marker «last change was server-originated» (křehké při React batchingu — user-edit + merge v jednom renderu se slijí).

**Otevřené otázky:** GitHub MCP odpojen uprostřed session (vyžaduje re-auth konektoru) — PR pro tento commit vytvořen až po obnovení připojení.

**Co dál:** PR → zelené CI → merge. Pak passport MCP typed-error gap; monolith-classification interview.


## 2026-07-10 — Session: review #1475 (10 úhlů + sweep) → guard-vrstva přepsána do fetch-seamu + Phase-11 typová migrace

**Rozhodnuto:** xhigh multi-agent review #1475 (10 finderů + gap-sweep, ~39 kandidátů → 15 nálezů) ukázal, že guard-design z #1475 (cooldown 15 s + force + permanentní dead-Set per-caller) má 4 reálné díry: dead-mark bez recovery (owner-scoped 404 z cizího účtu zabil živý link do reloadu, autoLink čistil jen při ZMĚNĚ id, backendSync stavěl portalLink mimo linkToPortal), force obcházel okno na VĚTŠINOVÉ cestě (položky bez payloadu = fetch na každý klik; bez instance-id = provably useless), PŘEpočet do 15 s servíroval starý prefill (částečný návrat symptomu #1473), a failed fetch razítkoval okno (cold-start blackout). Poller byl navíc druhý, nesouhlasící registr mrtvých linků (App.tsx restart pollingu na každou změnu projects — samotný merge spouštěl okamžitý neguardovaný refetch). **Fix = přepis JEDNOHO malého modulu:** guardy přestěhovány do `portalMonolithFetch.ts` — jediný seam pro OBA konzumenty (store + poller): in-flight dedupe (souběžné volání sdílí request) · fresh-TTL **3 s jen po úspěchu** (zabíjí double-fetch po merge-restartu polleru; krátké schválně — recalc→reopen smyčka je delší, čerstvost po «Aplikovat» zachována) · dead-link **TTL 5 min** místo permanent (wrong-account 404 se zotaví, smazaný projekt stojí 1 request/5 min) · `clearMonolithFetchState` volá linkToPortal I backendSync-hydratace. Store/ItemsTable se ZJEDNODUŠILY zpět (force i tři module-guardy smazány); `withSuppressedAutoSync` helper (save-restore invariant nefalšovatelný, 2 call-sites). **Portal:** Phase-11 safety-migrace dostala kořenový fix 42P08 třídy — podmíněné DO-bloky `ALTER COLUMN position_instance_id/template_id TYPE UUID USING NULLIF(...)::uuid` (skip když už uuid = žádný rewrite při každém bootu; garbage řádek = fail→log, query-level tvar zůstává backstop). Audit zápisy sjednoceny do non-fatal `writeAuditLog(client, event, actor, {...})` helperu (SELECT-tvar s JOINem i VALUES-tvar) — a **template_saved/template_applied/bulk_import audit INSERTy přesunuty ZA COMMIT** (seděly v transakci bez try/catch = stejná třída, co 2× shodila kiosk-writes). Mělčí drobnosti: `pool.connect()` do try (pool-starvation → visící request bez odpovědi na Express 4), 500-těla už neforwardují surový PG `detail` (jen SQLSTATE code; detail zůstává v server-logu). Test `auditLogInsert` přepsán robustně (alias-agnostic, quote-agnostic BEGIN, «poslední tx-verb před audit-callem ≠ BEGIN», všech 5 eventů přes helper). **Vše ověřeno ŽIVĚ na efemérním Postgres 16:** TEXT→UUID konverze s daty (empty string→NULL), idempotentní re-run (skip), garbage-fail (sloupec zůstal TEXT + backstop-tvar funguje), oba helper-tvary na driftu i po migraci. Testy: Portal 46 node · Registry **266 vitest** (fetch-seam suite 13: dead-TTL/expiry/clear, fresh-TTL/expiry, in-flight dedupe, failure-nestampuje) + tsc + vite build.

**Odmítnuto:** permanentní dead-mark (no-recovery pro wrong-account 404); force-flag API (UI-znalost v fetch-policy, obcházel guard na majoritní cestě); cooldown 15 s per-caller (stale recalc-prefill); přepis velkých modulů (store/routes) — přepsán jen ~90-řádkový fetch-service, ostatní se zjednodušilo.

**Otevřené otázky:** Nálezy vědomě NEřešené: backendSync-push effect v App.tsx negatuje suppressAutoSync (React effect běží po sync-okně — potřebuje jiný mechanismus, informationless UPSERT zůstává, debounce 2 s to tlumí); ztráta pasivní instance-mapping self-heal smyčky (read-only sese) — kryto dead-TTL recovery; Date.now() backward-clock edge. Po deployi live ověřit: banner po «Aplikovat» (i rychlý recalc < 15 s od otevření), žádný 42P08/`dov_written` fail v logu, audit řádky `template_saved`/`bulk_import` se zapisují, Phase-11 log hlásí konverzi sloupců.

**Co dál:** Passport MCP typed-error gap; monolith-classification PRE-IMPLEMENTATION INTERVIEW (5 otázek) před Gate 2.


## 2026-07-10 — Session: adversariální review #1473 → 5 nálezů opraveno (DOV 42P08 rollback + merge-push + guardy)

**Rozhodnuto:** xhigh code-review právě smergnutého #1473 (multi-agent finder flotila padla na session-limitu → review proveden inline, stejné úhly). 9 nálezů, Alexander schválil fix 1–5: **(1) KRITICKÉ — DOV write-back měl TENTÝŽ dual-context `$1` 42P08** jako monolith, ale o handler níž a UVNITŘ `BEGIN/COMMIT` bez try/catch → na produ (drift audit-sloupce) se **celý `dov_payload` zápis ROLLBACKoval a Registry→Portal TOV zápis se ztrácel s 500**. Fix = zrcadlo monolith paternu: transakce pryč (single atomic UPDATE), audit non-fatal po zápisu, `pp.position_instance_id` místo druhého `$1`. Ověřeno ŽIVĚ na efemérním Postgres 16 (drift TEXT/UUID): starý dotaz → 42P08, nový vkládá, payload přežije pád auditu. Test `auditLogInsert.test.js` zobecněn na VŠECHNY SELECT-style audit INSERTy (regex bounded per-template-literal — lazy `[\s\S]*?` přeskakoval přes VALUES insert) + strukturální assert „DOV bez transakce, audit v try". **(2)** merge-setState v `fetchAndMergeMonolithData` obalen `suppressAutoSync` (server-originated data netlačí plný import-from-registry push zpět — zrcadlí setInstanceMappingCallback). **(3)** guard mrtvých linků (`portalMissing` → Set, TOV-open přestane mlátit 404) + 15s recency window s **`force` bypass když item nemá payload** (právě-Aplikovat případ NESMÍ čekat cooldown — jinak by se banner-bug částečně vrátil pro rychlé uživatele); linkToPortal guardy čistí. **(4)** diagnostika + success-log čtou POST-fetch stav (freshProject), ne pre-fetch snapshot. **(5)** `.catch(() => {})` → warn s message (broken merge ≠ „žádné payloady"). Portal 25 node testů + Registry 258 vitest + tsc + vite build zelené. Nálezy 6–9 (reuse walker/test-factory dup, deps-array konzistence, updated/anyChanged redundance) vědomě NEopraveny — kosmetika.

**Odmítnuto:** Čistý 15s cooldown bez force-bypass (regrese pro rychlé Aplikovat→TOV); ponechání DOV auditu v transakci s try/catch (25P02 — aborted txn stejně zabije COMMIT).

**Otevřené otázky:** Živě po deployi: DOV write-back z Registry projde (žádný 42P08/rollback v logu `dov_written`).

**Co dál:** Nálezy 6–9 jako kosmetický follow-up jen pokud se do těch míst poleze; passport MCP typed-error gap; monolith-classification interview.


## 2026-07-10 — Session: TOV write-back dokončen — audit-log 42P08 (Portal) + Registry banner se nikdy nerefreshoval (#1473)

**Rozhodnuto:** Dva zbývající bugy z Claude-Chrome verifikace PO #1471 (hlavní zápis už 200, ale). **(1) Portal audit-log 42P08:** audit `INSERT … SELECT … WHERE` bindoval `$1` (position_instance_id) ve DVOU typových kontextech naráz — SELECT-list (→ `position_audit_log.position_instance_id`) I WHERE (→ `portal_positions.position_instance_id`). Na produ ty sloupce driftly na různé typy (audit tabulka předchází UUID-standardizaci; `CREATE TABLE IF NOT EXISTS` legacy sloupec nemigroval) → Postgres deduce `$1` jako uuid I text → `inconsistent types deduced for parameter $1 / uuid versus text` na KAŽDÉM zápisu. try/catch to dělal non-fatal (payload přežil), ale audit řádky se nikdy nezapsaly + spam v logu. Fix: audit sloupec brát z JOINnutého řádku (`pp.position_instance_id`), takže `$1` je právě v JEDNOM kontextu (WHERE); hodnota se assignment-castuje na cokoliv audit sloupec reálně je. **Reprodukováno + ověřeno ŽIVĚ** proti efemérnímu Postgresu 16 (drift scénář: audit col TEXT, portal_positions UUID) přes `PREPARE` bez type-listu — staré SQL hází 42P08, nové vkládá při driftu I bez driftu. **(2) Registry «Předvyplnit TOV» banner:** `fetchAndMergeMonolithData` běžel JEN na project-select / Portal-link — obojí PŘED «Aplikovat» → čerstvý payload se nikdy nemergnul do `item.monolith_payload`, `hasExtendedCosts()` zůstal false. Fix: merge se re-runuje při OTEVŘENÍ TOV modalu + modal se renderuje z ŽIVÉ položky (lookup podle id z `items` prop), takže merge dopadne do už otevřeného okna bez re-clicku. Merge vytažen do čisté exportované `mergeMonolithPayloadsIntoProjects` — ref-preserving + key-order-insensitive (`stableStringify`) jako sourozenec `applyInstanceMappingsToProjects`, takže opakované otevření nechurnuje refy řádků (scroll/memoizace). +stale-link diagnostika: `fetched>0` ale `matched===0` loguje oba id-sety (rozliší «merge neběžel» od «běžel, 0 matchů»). Testy: Portal +3 (`auditLogInsert` — dual-context regression guard) → 20 node-testů zelené; Registry +8 (`mergeMonolithPayloadsIntoProjects` kontrakt) → **258 vitest + tsc + vite build zelené**.

**Odmítnuto:** Cast `$1::uuid` na obou místech (křehké — pokud sloupec drift na jiný typ než uuid, rozbije se); místo toho eliminovat dvojí užití parametru úplně. Naivní `JSON.stringify` compare v merge (false-positive churn při přeházených klíčích — přesně to, před čím varují testy sourozence z PR #1019); použit `stableStringify`.

**Otevřené otázky:** Živě po deployi: (a) Aplikovat → Registry TOV banner naskočí; pokud NE, nová diagnostika řekne, zda je to stale-link (→ PortalAutoSync re-link) nebo write-fail. (b) audit řádky `monolith_written` se reálně zapisují (žádný 42P08 v logu).

**Co dál:** Passport MCP typed-error transport gap (nabídnuto, nezačato). monolith-classification spec čeká na PRE-IMPLEMENTATION INTERVIEW (5 otázek, Gate 0) než začne Gate 2.


## 2026-07-10 — Session: TOV write-back byl 100% rozbitý #1466 — DVA skryté SQL bugy, poprvé ověřeno proti ŽIVÉMU Postgresu

**Rozhodnuto:** Alexander přes Claude-Chrome vytáhl Cloud Run logy → root: `POST /:instanceId/monolith` vracelo **500 na KAŽDÉ pozici** s `42P08: could not determine data type of parameter $1` → `[WriteBack] Batch complete: 0 ok, 15 failed` → prázdný TOV. **Regrese z #1466** (merge-guard `monolithPayloadMergeSql`). Spuštěn EFEMÉRNÍ Postgres (`initdb`+`pg_ctl` jako user `postgres`, `/tmp/pgtest`) a SQL reálně vykonáno přes `PREPARE` bez type-listu (= přesně inference-cesta node-postgres). Odhaleny DVA bugy, oba #1466 nikdy nezachytil (testoval jen strukturu stringu, ne exekuci): **(1) 42P08** — první větev `WHEN $1 IS NULL` používala parametr BEZ castu; když je to jediné necastované užití, Postgres neurčí typ → celý UPDATE 500. Fix: `WHEN ($1)::jsonb IS NULL` (každý výskyt parametru nese `::jsonb`). **(2) NULL-poison guardu** — `richPayloadSql` pro TENKÝ payload vrací **NULL, ne false** (`jsonb_typeof(x->'costs')='object'` je NULL když klíč chybí; `NULL OR false` = NULL). Guard `existing_rich AND NOT incoming_rich` = `true AND NOT NULL` = NULL → CASE bere jako nematchnuto → ELSE → **rich payload se PŘESTO downgradoval na tenký**. Tzn. i bez 42P08 by #1466 nikdy nefungoval pro svůj účel (JS `isRichMonolithPayload` vrací korektní false, SQL NULL — parity-gap, který string-testy nezachytí). Fix: `COALESCE((...), false)` kolem celého predikátu. **Živě ověřeno** na Postgresu: staré SQL → 42P08 (reprodukováno); nové SQL → PREPARE OK + rich zůstane rich (costs+resources i tov_entries.labor varianta), thin→rich upgraduje, empty se zapíše. +2 hermetic testy (42P08-guard «žádný bare parametr bez ::jsonb» + COALESCE-false guard), 2 opraveny. **17 monolithPayloadMerge + 18 splitSql node-testů zelené.**

**Odmítnuto:** Vrátit `= $1` (prostý přepis) — vrátí původní #1466 clobber. Testovat jen strukturu SQL stringu (přesně to selhalo v #1466 — od teď merge-SQL VŽDY spustit proti reálnému Postgresu).

**Otevřené otázky:** Živě na 272324 po deployi Portal-backend: Aplikovat → `[WriteBack] Batch complete: N ok, 0 failed` → Registry TOV banner naskočí + prefill. Projekt ŽST Turnov měl navíc visící portalLink (`proj_fd52aa37…`) — po #1468/#1469 se má samo-vyléčit; verify.

**Co dál:** PR (critical hotfix) + merge po zeleném. Pak analýza/plán klasifikace monolitů až Alexander dá go.


## 2026-07-10 — Session: kalkulátor «Načíst z Rozpočtu» — monolit = jen vypočitatelný beton + add-work gate

**Rozhodnuto:** Alexandrův živý feedback k importu z Registry do kalkulátoru (FlatPositionsTable). Dva bugy opraveny (frontend-only): **(1) zelená ✓ bez «Vypočítat»** — Registry import láduje každou smeta-řádku jako VLASTNÍ element-group (1 řádek), takže samostatná «VÝZTUŽ MOSTNÍ … 10505» (t, kód 389365) dostala od `isMonolithicElement` monolit=true POUZE podle OTSKP prefixu 3xx, ale nemá beton-řádek → betonPos undefined → tlačítko «Vypočítat» (gated `isMonolith && betonPos`) se nezobrazí = matoucí zelená fajfka bez akce. Fix: `elementIsMonolith` (frontend wrapper, řídí filtr «Jen monolity» + toggle ikonu + Vypočítat gate) nyní vyžaduje VYPOČITATELNOST — auto-monolit jen když group má beton-řádek NEBO reprezentativní řádek v m³ (promotable). Lone výztuž(t)/bednění(m²)/jiné → default NEMONOLIT (červený ✗, vypadne z «Jen monolity»); ruční override stále absolutní. `ElementBlock` lokální `isMonolith` sjednocen na `elementIsMonolith(element)` (dřív počítal inline z repPos → rozcházel se s filtrem). **(2) add-work v ne-monolitu nabízel betonářské práce** — `AddWorkModal` STANDARD_WORKS (bednění/výztuž/zrání/podpěrná/předpětí) patří k beton-kalkulátoru (auto-gen přes «Aplikovat»); nová prop `allowConcreteWorks` (default true) → ne-monolit group nabídne jen «Vlastní práce» (subtype jiné) + vysvětlující řádek. Tím se «Jen monolity» filtr sám zpřesnil (ukazuje jen reálné betonové elementy) = částečná odpověď na «Registry parser dumpuje celou tabulku». Frontend tsc + vite build + 1376 shared testů zelené.

**Odmítnuto:** Měnit sdílený `isMonolithicElement` (position-level, používá i backend export + parser) — computability je element-level pojem, patří do frontend wrapperu. Filtrovat Registry import na betonové práce jako XLSX parser (rozpor s #1454 rozhodnutím: whole-table import + ruční toggle pro budoucí ne-betonové kalkulátory).

**Otevřené otázky:** Sémantika «monolit = vypočitatelný beton (beton-řádek NEBO m³)» = mé čtení Alexandrova záměru; snadno upravitelné, pokud chce jinou hranici. Backend export `?only_monoliths` (position-level shared classifier) NEdostal computability refinement — možný follow-up pro konzistenci s displejem. Divergence dvou parserů (XLSX vs Registry) je větší architektonická položka, netknuta.

**Co dál:** PR, merge po zeleném (standing pace), restart větve. Live-verify: VÝZTUŽ řádek → červený ✗ (ne zelená bez Vypočítat); add-work v ne-monolitu → jen Vlastní práce.


## 2026-07-10 — Session: fantomové projekty «Auto-created» + resurrection — příčinová oprava celého clusteru (deep-debug «proč to nejdřív fungovalo»)

**Rozhodnuto:** Alexandrova otázka «proč to nejdřív fungovalo a pak se to rozbilo» zodpovězena rekonstrukcí taimline z git/soul.md: bridge Kalkulátor→TOV byl 09.07 ráno ŽIVĚ funkční (#1450 fix `position_audit_log.actor`); rozbil ho následný re-import velkého projektu (test #1463) tím, že aktivoval 4 LATENTNÍ chyby sync-vrstvy, které se navzájem krmily: **(1) adopce sirotka** — `rozpocet-registry-backend/server.js` POST sheets auto-vytvářel placeholder projekt doslova pojmenovaný `'Auto-created'`, když sheet dorazil pro neexistující projekt (= race: delete uprostřed multi-sheet pushe; auto-create pochází z isolation-hardeningu b0c9235 08.07, který opravil owner ale adopci ponechal); **(2) resurrection** — Portal `integration.js` import-from-registry dělal slepý `INSERT…ON CONFLICT DO UPDATE` s klientem poslaným `portal_project_id` → smazaný Portal projekt se každým auto-syncem VZKŘÍSIL (proto «Failed to delete» dojmy + fantomy se vracely); týž UPSERT byl i cross-tenant rename díra (bez owner guardu); **(3) věčný mrtvý link** — `portalAutoSync.debouncedSyncToPortal` volal `onAutoLink` jen při `!project.portalLink`, takže visící link (`proj_84bf8d89` → 404) se NIKDY nepřepojil, MonolithFetch polloval 404 a každý sync плодил další osiřelý Portal projekt; **(4) backoff-stall** — 409 `sync_in_progress` (souběh ručního pushe z PortalLinkBadge s debounce-syncem; Portal advisory lock správně serializuje) armoval 5-min backoff → legitimní re-sync, který by link uzdravil, stál. FIX v jednom PR: (a) server.js sheets POST → **404 místo auto-create** (identická odpověď pro absent/foreign = žádný existence leak); (b) integration.js → `portal_project_id` je jen HINT, validace owner-scoped SELECT, stale/foreign → mint nový projekt, kiosk_links lookup s JOIN+owner filtrem, plain INSERT/owner-scoped UPDATE místo UPSERTu; (c) portalAutoSync → 0-items projekty se AUTO-syncem přeskakují (fantom «Auto-created» (1 sheet, 0 items) už nemintí prázdné Portal projekty; ruční push zůstal), 409 sync_in_progress = benigní skip BEZ backoffu, relink podmínka `portalId !== portalLink?.portalProjectId` (self-heal visících linků — Portal mintne nový, store si ho uloží); (d) backendSync beforeunload keepalive respektuje tombstone (flush hlavičky smazaného projektu ho přes UPSERT resuscitoval). +7 hermetic testů `portalAutoSync.phantoms.test.ts` (409 benign vs jiný 409, 0-items skip, relink/same/fresh). **246 registry vitest + tsc + vite build + 33 Portal node-testů zelené.** Cross-user-isolation-reviewer agent spuštěn na diff (owned tables touched). Předchozí session (týž den): #1466 rich→thin merge guard + #1467 idempotent delete + stop dead-link polling — symptomatická vrstva téhož clusteru.

**Odmítnuto:** Skrývat existující «Auto-created» fantomy při loadFromBackend (uživatel je po #1467 smaže sám a s opraveným zdrojem se nevrátí). Auto-mazání fantomů na backendu (destruktivní bez souhlasu). In-flight guard přesun do syncProjectToPortal (ruční push by dostal matoucí null; Portal lock + benign 409 řeší totéž bez UX regrese).

**Otevřené otázky:** Živá verifikace po deployi (Cloud Run registry-backend+Portal, Vercel Registry): (1) smazat fantomy «Auto-created» v Portálu i Registru — zůstanou smazané; (2) reálný projekt s visícím linkem se po prvním auto-syncu sám přelinkuje na nový Portal projekt (console `Re-linked project …`); (3) po re-linku znovu Aplikovat v kalkulátoru → TOV banner (payloady žily ve starém smazaném projektu). MCP-OAuth BUG #3 (`connection already closed` v `app/mcp/auth.py::_execute`) stále otevřen.

**Co dál:** PR po isolation-ревью, merge po zeleném CI (standing pace), restart větve. Pak live-verify checklist výše s Alexandrem.


## 2026-07-09 — Session: TOV write-back regression FIX — thin export nesmí přebít bohatý Aplikovat payload

**Rozhodnuto:** OPEN BUG #1 z handoffu `2026-07-09_tov-writeback-regression.md` vyřešen. Symptom (položka 272324 ZÁKLADY): zelená přilba (monolith-link), ale prázdné TOV okno + žádný banner «Předvyplnit TOV», ačkoli uživatel spustil «Vypočítat plán» + «Aplikovat». **Root cause potvrzen recon-em napříč 3 službami:** Portal `portal_positions.monolith_payload` (JSONB) mají DVA zapisovatele — (1) **bohatý** = Monolit «Aplikovat» → `portalWriteBack.js buildMonolithPayload` (costs+resources+tov_entries) → Portal `POST /:instanceId/monolith` (`SET monolith_payload = $1`); (2) **tenký** = bulk «Exportovat do Registru» → `export-to-registry.js:153` (jen ploché crew_size/days/cost) → Portal `POST /api/integration/import-from-monolit` (`monolith_payload = COALESCE($11, monolith_payload)`). `COALESCE` hlídá jen NULL, ne tenkou non-null hodnotu → re-export **přepsal** bohatý payload tenkým → Registry `hasExtendedCosts()` (`tovPrefill.ts:21`) = false → banner zmizel. **Fix (Portal-side guard, «nikdy nedegradovat rich→thin», atomicky):** nový `stavagent-portal/backend/src/db/monolithPayloadMerge.js` — `isRichMonolithPayload()` (čistý JS kontrakt, zrcadlí Registry `hasExtendedCosts`: (costs∧resources) ∨ neprázdné `tov_entries.labor`) + `monolithPayloadMergeSql(placeholder)` generuje `CASE`, který ponechá uložený payload když je bohatý a příchozí tenký; jinak zapíše příchozí. `jsonb_array_length` je za `jsonb_typeof='array'` guardem (nikdy nespadne na non-array). Zapojeno do OBOU zapisovačů (`integration.js:199` + `position-instances.js:1098`). `hasExtendedCosts` NEoslabeno — opraven zápis, ne gate. **`template_apply` UPDATE (`position-instances.js:663`) ponechán** = jiná záměrná feature, mimo scope. 15 hermetic testů (`monolithPayloadMerge.test.js`, `node --test`): kontrakt rich/thin/null + struktura CASE (regres-guard proti návratu k COALESCE) + array-safety. Portal backend suite bez nové regrese (4 pre-existing faily = chybějící `xlsx` dep v env, potvrzeno stash-testem).

**Odmítnuto:** Oslabit `hasExtendedCosts` aby přijal tenký payload (ukázal by prázdný banner). Guardovat `template_apply` (explicitní přepis šablonou = záměr uživatele, guard by ho tiše ignoroval). Read-modify-write merge v JS (race — zvolen atomický SQL CASE).

**Otevřené otázky:** Živé ověření na 272324 (Aplikovat → banner → pre-fill Lidé/Mechanizmy/Materiály) až po deployi Portal-backendu — hermetic test + JS-kontrakt logiku zamykají, DB-exekuci SQL ne (žádný live PG v env). BUG #2 (phantom «Auto-created» + 409 sync race) a BUG #3 (MCP-OAuth `connection already closed`) z handoffu netknuty.

**Co dál:** PR (Alexander mergne), restart větve z origin/main. Následně live-verify + případně BUG #2/#3.


## 2026-07-09 — Session: Registry-import 504/statement-timeout = Cloud SQL connection starvation (INFRA) + TOV rounding + import diagnostics

**Rozhodnuto:** Alexander: import z Registry do Monolitu padá (504 / 404), Monolit log `Database initialization failed: connection timeout` (rev 00409). **Root cause = connection starvation na sdíleném Cloud SQL `stavagent-db`.** Instance je **`db-f1-micro` (0.6 GB RAM, shared-core)** → Cloud SQL cappuje `max_connections=25`. Ale pooly: **Monolit `max=20` + Portal `max=10` + Registry ~10 + CORE** ≫ 25, a Cloud Run to ještě násobí autoscale instancemi. Jeden hladový service sežral sloty → další (tady cold-start Monolitu) dostal `connectionTimeoutMillis 10s` → DB-init fail → sypaly se 500/504 na import-from-registry → dov/monolith writeback; 404 na Monolit-importu byl JEN downstream (jeho fetch k Portal `for-registry` má 5s timeout, pod přetíženou DB se nevešel). **Fixy:** (1) **kód** #1458 — Monolit + Portal pool `max` → env `PG_POOL_MAX` default **8** (bylo 20/10) + clamp `[1,100]` (Amazon Q review); (2) **infra (Alexander, zdarma)** — `gcloud sql instances patch stavagent-db --database-flags max_connections=50` (aplikováno «done. Updated»; **NE 100** — na 0.6 GB RAM OOM risk). Durable (platí peníze, ~+$20/měs, jen pod zátěží / pgvector v CORE) = upgrade na `db-g1-small` (1.7 GB). Diagnostika importu #1456: Monolit 404 teď v alertu jmenuje který zdroj (Portal/Registry) je prázdný + `detail`/`hint`. TOV: #1457 — všechny peníze v TOV modálu 2 des. místa (bylo 3, `toLocaleString('cs-CZ')` default = 3 digits + `minimumFractionDigits:2` bez max = taky 3).

**GCP účet — POVINNÝ KONTEXT (migrace 2026-07-08):** Billing-admin Google Cloud přemigrován z osobního `alpro1000@gmail.com` na doménový **`info@stavagent.cz`** (požadavek Google for Startups). `info@stavagent.cz` = **Owner projektu** `project-947a512a-481d-49b5-81c` + Billing Account Admin. `alpro1000@gmail.com` odebrán z Billing Admin, ale ZŮSTÁVÁ Owner projektu (IAM) + **Organization Administrator** na org-node. **Pravidla:** (a) běžná práce (Cloud SQL `stavagent-db`, Cloud Run) pod `info@stavagent.cz`; (b) vzácné org-level operace zůstávají za `alpro1000@gmail.com` (Org Admin visí na něm); (c) **NIKDY** destruktivně nesahat na billing (no Close/Disable/Unlink) a **neodebírat gmail z IAM projektu**. Lokální `gcloud` měl aktivní starou gmail učtu s rozbitým cache (`alprolooo@gmail.com` — překlep) → `404 Account not found` / `401 CREDENTIALS_MISSING` na read-back (patch-write ale prošel přes ADC). Fix CLI: `gcloud auth login info@stavagent.cz` + `gcloud auth application-default login`.

**Odmítnuto:** `max_connections=100` na f1-micro (OOM na 0.6 GB). Blind-fix «pomalého SQL» dokud trace/logy nepotvrdily příčinu — a potvrdily connection starvation, ne pomalý dotaz (indexy na `registry_item_id` existují, `SET LOCAL statement_timeout=20s` + advisory-lock už jsou po výpadku 08.07).

**Otevřené otázky:** Po instance-restartu (max_connections=50) + deployi #1458 (PG_POOL_MAX=8) ověřit, že import/504 zmizely. Pokud VELKÉ projekty (145+ položek) stále 504 → to už je délka **per-item** sync loopu (145× SAVEPOINT+UPDATE/INSERT v jedné transakci, drží spojení) → follow-up = **bulk-INSERT** (unnest/multi-row) místo per-item, zkrátí drženi spojení × řády. Separátní: 401 na `create-from-kiosk` (klient hází bez tokenu) + 403 na Monolit `GET /api/positions` (scope).

**Co dál:** TOV okno B–F (design hlavička/pole, dirty-flag, tichý save-indikátor, beton v «Doprava betonu» dublet + explicitní vypínače pumpa/jeřáb/doprava, ergonomie) čeká na Alexandrův go + odpověď na E. Bulk-sync jako fallback pokud f1-micro+50 nestačí.


## 2026-07-09 — Session: Registry-import review — monolith klasifikace + rate-propagace (2 PR)

**Rozhodnuto:** Alexandrův živý feedback k «Načíst z Rozpočtu» (Monolit Planner) rozdělen na 2 PR (jeho volba: nejdřív bugy, pak funkce). **PR #1453 (2 bugy):** (B1) «X» = NEMONOLIT teď skrývá «Vypočítat» — tlačítko bylo gated jen na `betonPos`, ignorovalo `isMonolith`; teď `{isMonolith && betonPos}`, takže po označení NEMONOLIT nejde otevřít kalkulátor. (B2) horní VÝCHOZÍ SAZBA (418) reálně dorazí do výpočtu — model **projektová sazba = zdroj, ruční přepíše** (Alexandrovo rozhodnutí). Tři obrivy zavřené: import (`import-from-registry.js`) čte `project_config.defaults.DEFAULT_WAGE_CZK_PH/DEFAULT_SHIFT_HOURS` místo zašitých 398/10; `handleCalculate` posílá `wage_czk_ph`+`shift_hours` pozice do URL kalkulátoru; `useCalculator` je parsuje do `positionContext` a sidí form `wage_czk_h`/`shift_h` (dřív vždy DEFAULT_FORM 398). FlatProjectSettings už propagoval top-změnu na ne-přepsané pozice — importované na projektovém defaultu teď sedí a aktualizují se. **PR #1454 (funkce):** rozvázání šapky od `subtype='beton'`. Root: OTSKP kód + KATALOG cena + monolith-toggle se braly z beton-řádku; ne-monolit import (`subtype='jiné'`, bez beton-řádku) neměl ani kód, ani cenu, ani přepínač → nešel ani prohlédnout, ani povýšit. Nové helpery `elementRepPos`/`elementIsMonolith` (reprezentativní pozice = beton-řádek nebo hlavní řádek). (F2) kód+KATALOG pro VŠECHNY skupiny (budoucnost: víc kalkulátorů pro ne-betonové práce). (F3) obousměrný přepínač na všech skupinách — povýšit chybně určený monolit / sundat false-positive; povýšení m³-řádku flipne jeho `subtype`→'beton' → aktivuje pipeline (Vypočítat, concrete_m3). «Jen monolity» filtr teď přes `elementIsMonolith` (respektuje override). Textový badge «MONOLIT/NE-MONOLIT» nahrazen **tichou stavovou ikonou** (zelená fajfka / červený křížek, klik → auto) — Alexandrovo rozhodnutí: sundaná pozice může být později počítána jiným kalkulátorem, text zbytečný.

**Odmítnuto:** Řešit vše jedním velkým PR (Alexander chtěl bugy zvlášť, rychlý výsledek). Ukazovat «NE-MONOLIT» text (zvoleno tiché). Tvrdý přepis všech pozic při změně sazby (zvoleno «projekt=zdroj, ruční přepíše»).

**Otevřené otázky:** Recon Explore-agentem potvrdil: klasifikace monolita žije JEN v `subtype` (žádný `is_monolith` sloupec) — PR #1454 to obchází přes reprezentativní pozici, ne přes nový sloupec (menší diff, žádná migrace). Živé ověření po deploy (Vercel frontend + Cloud Run backend): (a) krestík skryje Vypočítat; (b) 418 dorazí do kalkulátoru; (c) kód+KATALOG u ne-monolitů; (d) obousměrný přepínač; (e) žádný NE-MONOLIT text.

**Co dál:** Až Alexander přidá další kalkulátory (ne-betonové práce), reprezentativní-pozice infra už kód+cenu ukazuje. Případný follow-up: po «demote» promotnutého m³-řádku zůstane `subtype='beton'` (override řídí zobrazení, neškodí) — kdyby vadilo, flipnout zpět na 'jiné' při reset-to-auto.


## 2026-07-09 — Session: Kalkulátor→TOV bridge VYŘEŠENO živě (root cause = `position_audit_log.actor` chybí na produ)

**Rozhodnuto:** Most Kalkulátor→TOV je ŽIVĚ funkční — banner «Předvyplnit TOV» naskočí, pre-fill vyplní (Betonář 4×8h → 32.0 Nh × 398 = 15 920 Kč, mechanizace 1 440, Celkem TOV 17 360 Kč / 403.72 Kč/m³), Registry log `Updated 145 instance mappings, 34 with Monolit data` + `Fetched 34 monolith payloads`. **Root cause NEBYL Registry-refresh gap** (kandidát a z minulé session), ale **schema-drift na Portal produ**: tabulka `position_audit_log` je starší než sloupec `actor` — obě `CREATE TABLE IF NOT EXISTS` (schema-postgres.sql + add-position-instance-architecture.sql) jsou no-op na existující tabulce a NEpřidají sloupec, a `runPhase11SafetyMigrations` (mechanismus opravy driftu) pro tuto tabulku neměl JEDINÝ řádek. Handler `POST /:instanceId/monolith` psal payload + audit-log v JEDNÉ transakci → audit INSERT padl (`column "actor" of relation "position_audit_log" does not exist`) → **celá transakce rollback vč. payloadu** → Portal 500 → `writeBackBatch` hlásil `0 ok, 34 failed`. Diagnostiku (#1449, merged) i příčinu našel Cloud Run log Portal-backendu (přesný text `error: column "actor" ... does not exist`, stejný ve všech záznamech). **Fix #1450 (merged, 2 soubory Portal):** (1) `migrations.js runPhase11SafetyMigrations` — idempotentní `ALTER TABLE position_audit_log ADD COLUMN IF NOT EXISTS` pro všechny sloupce audit-INSERTu (event/actor/project_id/position_instance_id/template_id/details/created_at), nullable → prod se sejde při příštím boot Portalu; (2) `position-instances.js` — audit-INSERT NON-FATAL (vlastní try/catch, MIMO transakci) aby sekundární selhání auditu nikdy nerollbacklo primární zápis payloadu + 500 teď loguje/vrací Postgres `error.code`/`error.detail`.

**Odmítnuto:** Slepá oprava Registry-refresh gapu (minulá session ji měla jako nejpravděpodobnějšího kandidáta) — diagnostika #1449 ukázala, že write-back VŮBEC nedojde (Portal 500), takže Registry nemá co číst; refresh gap byl falešná stopa. Princip «nech logy pojmenovat nohu, než opravíš» se vyplatil.

**Otevřené otázky:** `[PortalAutoSync] Sync timeout — Portal may be sleeping` + `Synced 0 items` v Registry logu = benigní (jiná větev Registry→Portal push-sync, cold-start + známý log-kvirk «na re-syncu jsou všechny items updates → 0 new»), NE TOV most. Zvážit Portal min-instances=1 pokud cold-start bude štvát (Alexanderovo rozhodnutí).

**Co dál:** Most hotový. Případný follow-up: Registry-fronta by mohla refreshovat `monolith_payload` i po výpočtu/na otevření TOV modalu (dnes jen na select projektu) — ale živě to funguje i bez toho (poller + re-fetch stačí), takže nízká priorita.


## 2026-07-09 — Session: Kalkulátor→TOV bridge live-debug + write-back diagnostika (#1445 nefunguje živě)

**Rozhodnuto:** Alexander hlásí «nefunguje nic» — TOV pre-fill banner (Registry) se po Aplikovat neobjeví, ani po F5, ani na NOVÉM projektu založeném správnou cestou (Registry → sync Portal → «Načíst z Rozpočtu»). Plná trasa kódu ověřena end-to-end a je KOREKTNÍ: Monolit Aplikovat PUT `metadata.tov_entries` → PUT handler persistuje metadata (whitelist) + `writeBackBatch` → `buildMonolithPayload` přikládá `tov_entries` → POST Portal `/api/positions/:id/monolith` → `UPDATE portal_positions SET monolith_payload WHERE position_instance_id` → Registry `for-registry` čte tutéž tabulku → `hasExtendedCosts(item.monolith_payload)` → banner (`TOVModal.tsx:289`). Žádný bug v kódu. Vyloučeno: `SERVICE_API_KEY` (Alexander ověřil — obě Cloud Run služby stejný secret). Nalezené kandidáty (živé/infra, ne kód): (a) **Registry-fronta refresh dyra** — `item.monolith_payload` se plní JEN přes `fetchAndMergeMonolithData` na select/link projektu (`registryStore.ts:283/307`), NE po výpočtu ani na otevření TOV; 30s poller plní jen comparison-panel; (b) **starý projekt = `position_instance_id` NULL** (Migration 009 přidala sloupec bez backfillu → write-back `linked.length===0` mlčky přeskočí); (c) Registry browser log ukázal `[PortalAutoSync] Sync timeout — Portal may be sleeping` → Portal Cloud Run cold-start může write-back utnout; (d) možný nedeploy Registry-fronty (#1445 banner kód). **Shipnuto: diagnostika write-backu** (`portalWriteBack.js`) — `linked.length===0` teď loguje WARN («projekt není propojen»), Portal 401/403/404 reject teď WARN s konkrétní hint (401=SERVICE_API_KEY, 404=instance-id není v portal_positions → relink) místo tichého debug. Cíl: další Aplikovat v Cloud Run logu Monolit-backendu SÁM pojmenuje příčinu. Test 4/4 (portalWriteBack.payload).

**Odmítnuto:** «Slepě» opravit refresh-dyru nebo relink dřív, než logy řeknou, KTERÁ noha se láme (write-back nedojde vs. dojde ale Registry nepřečte) — jinak se spálí deploy cyklus na špatný fix.

**Otevřené otázky:** Čeká na Cloud Run log Monolit-backendu (filtr `WriteBack`) po Aplikovat: `Batch complete: N ok` = Portal přijal → bug je Registry-refresh/deploy; `0 ok, N failed` + status = Portal odmítl; ticho = `position_instance_id` NULL. Registry Vercel deploy #1445 (po 2026-07-08?) neověřen.

**Co dál:** Podle logu opravit reálnou příčinu (nejpravděpodobněji Registry-fronta refresh gap: přidat `fetchAndMergeMonolithData` / merge na otevření TOV modalu + do 30s polleru, aby banner naskočil bez re-selectu projektu).


## 2026-07-09 — Session: UWO F3 — sjednocení catalog-binding status-enumu (BACKLOG tz-to-worklist krok 2, část)

**Rozhodnuto:** Po uzavření Gate 2 pokračováno na BACKLOG `tz-to-worklist` krok 2 (UWO F2/F3). Recon (3 paralelní Explore agenti) potvrdil: F0/F1 hotové (branch registry v `breakdown.py`, scope-router), UWO branch YAMLy = **Mechanismus B** (runtime-load `_load_interier_psv_templates` glob, NE codegen/drift-guard — na rozdíl od `kb/` + gen-knowledge). Port-source = `sandbox/uwo-interier-mezonet/src/templates.mjs` (S1–S10, jen S1 malba portnuto). **Odpracováno F3 (status-enum) jako první uzavřený inkrement:** nový `CodeStatus(str,Enum)` v `app/models/item_schemas.py` — single source (design §2.2/§5.1). Divergentní literály sjednoceny: adapter měl `candidate|group_only|not_verified`, breakdown OTSKP path `bound|no_match` pro TÉŽ operace + PSV `not_calculated`. Kanonická čtveřice `exact|candidate|group_only|not_verified` + reálné extra stavy `bundled` (katalog-design rule, conf 1.0) a `not_calculated` (work-first frozen, Pattern 15). `bound`→`candidate` (OTSKP fulltext top nad floor = kandidát, adapter to tak už dělal), `no_match`→`not_verified`. `catalog_binding_adapter.py` + `breakdown.py` teď čerpají z enumu. INVARIANT zachován: `exact` jen deterministický OTSKP DB hit, URS nikdy `exact`. Testy: +6 `test_code_status_enum.py` (enum + map_status validita + never-exact + call-site guard proti návratu `bound`/`no_match` + PSV not_calculated); 2 řádky `test_stage_gating_policy.py` (`bound`→`candidate`) opraveny na sjednocený slovník. **102 pass** napříč code_status_enum + uwo_atomizer + stage_gating + catalog_matching + mcp_compatibility.

**Odmítnuto:** Sloučení `position_enricher.py` `match: exact|partial|none` do CodeStatus v tomto inkrementu — je to JINÁ osa (kvalita shody, ne binding-status; design §0.3), force-merge dvou konceptů = špatný tah. Zůstává jako follow-up F3. Enum-anchor bez collapsingu synonym (jen katalogizovat `bound` i `candidate`) — to není „dokončit", to je cataloguing divergence.

**Otevřené otázky:** F2 (branch content) = velký zbytek: portovat templates.mjs S2–S10 + RD Jáchymov izolace/zemní do KB YAMLů; nové `qty_source` hodnoty vyžadují rozšíření `_decompose_interier_psv` (dnes jen `section_m2`/`fixed_1`); nová větev (izolace/zemni) potřebuje loader + router-vocab. `position_enricher` match-axis convergence.

**Co dál:** F2 template porting (další inkrement/y). Živě deploynout F3 (CORE) — čistě interní změna enumu, žádný MCP counter-file dotčen (CodeStatus není nový tool).


## 2026-07-09 — Session: tz-passport Gate 2 — planPassport napojen (MCP tool + backend route) + soupis 500 fix

**Rozhodnuto:** Zavřen Gate 2 z BACKLOG `tz-to-worklist` krok 1 — hotový `planPassport()` (half A, PR #1426, jen shared) je teď konzumovatelný přes tři povrchy: (1) **Monolit backend route** `POST /api/calculate-from-passport` v `engine.js` — tenký SSOT wrapper nad `planPassport(passport)`, žádná logika navíc, vrací `{mapping, project}` verbatim (parita s přímým voláním, +4 Jest → engine.test.js 18→22). (2) **MCP tool `calculate_from_passport`** (`app/mcp/tools/passport_plan.py`) — validuje passport proti single-source schématu `BridgePassport`, pak **deleguje** přes `monolit_delegate.delegate_calculate_from_passport` na kanonický engine (NIKDY divergentní Python výpočet; selhání = typovaná chyba, ne fabrikované číslo); forwarduje ORIGINÁLNÍ dict (ne re-dump modelu — zachová aliasy `_meta`/`class`/`use`, které TS mapper čte). Všech **6 counter-souborů** synchronně: `_REGISTERED_TOOL_NAMES` + `mcp.tool()` (server.py) · `TOOL_ORDER`+`TOOL_DESCRIPTIONS`+REST wrapper `POST /tools/calculate-from-passport` (routes.py) · `TOOL_COSTS=10` (auth.py) · `ToolManifest credits=10` (tool_manifest.py) · WORK_ATOMIZATION stage (workflow_definitions.yaml) · `EXPECTED_TOOLS` (test_mcp_compatibility.py). MCP tools **20→21**. (3) **UI-import povrch = oprava, ne shape-hack:** SoupisTab renderuje *parsovaný BOQ* (`ParseResult`), NE plán z planPassport (jiný tvar) — správný výklad «SoupisTab se rozsvítí» je, že `/passport/generate` už `soupis_praci` VRACÍ pro XLSX, ale `routes_passport.py:213` dělal `response.model_dump()` v python-módu → `passport.generated_at` (datetime) → `JSONResponse` `json.dumps` CRASH 500 **přesně na XLSX/soupis cestě** (proto SoupisTab pro tabulky nikdy nesvítil). Fix = `model_dump(mode='json')`. Reprodukováno + pinnuto testem. **Vedlejší úklid:** smazán orphan `URS_MATCHER_SERVICE/frontend/components/ContextEditor.html` (0 referencí). DocumentUpload upstream OVĚŘEN živý: `/api/jobs/document-upload` + `document-extract` existují (jobs.js), mounted s opt-in auth (`requireApiKeyIfEnabled`) — handoffův `/api/core/parse/document` byl jiný povrch (Portal SoupisTab), ne URS okno; nic mrtvého. Adversariální verifikace: workflow 5 skeptiků (counter-files / SSOT-purity / datetime-blast-radius / test-coverage / spec-completeness).

**Odmítnuto:** Cpát planPassport výstup do SoupisTab (shape-mismatch — plán ≠ parsovaný soupis; vlastní viewer plánu = budoucí práce). Volat planPassport uvnitř `/passport/generate` (produkuje jiné schéma `ProjectPassport`, ne `tz-bridge-passport`, které planPassport čte — potřebovalo by half-B extrakci). Re-dump validovaného modelu (ztráta aliasů). Smazání `frontend/components/DocumentUpload.html` (stale duplikát, ale mimo scope).

**Otevřené otázky:** Vlastní viewer PLÁNU (aggregate Nh/dny/náklad z planPassport) zatím není — dnes je plán jen agent/MCP-facing (SoupisTab renderuje parsovaný BOQ, ne plán). SoupisTab XLSX (datetime fix) čeká na UI-ověření v Portálu.

**LIVE OVĚŘENO (2026-07-09, po deployi):** PR **#1447 merged do main** (merge-commit `f9b2b0e`, CI zelený — jediný „failure" byl cancelled no-op „CI Summary" agregátor na push-eventu, infra raner, ne kód; pull_request-eventy MCP Compat + Monolit CI + Test Coverage všechny success). CORE nasazen → **21 MCP nástrojů**, `calculate_from_passport` živý. **Živý E2E vůči Cloud Run**: SO-202 Žalmanov passport → **9 prvků, 0 uncalculated, `source: monolit_planner_api`** (potvrzeno delegování na kanonický engine, ne divergentní Python). Agregát: 2 832,09 m³ · 14 740,4 Nh · 251,9 dní · 6 325 799 Kč. Per-deck split (÷2), TZ-marky nad soupis-pásmy (deck C35/45 ne «DO C40/50»; piliry C35/45 ne C40/50), 3 takty z výkresu ctěny, `warnings: []` (OTSKP-pásma = informativní nota, ne konflikt, Pattern 53). Gate 2 UZAVŘEN + live-verified.

**Co dál:** BACKLOG `tz-to-worklist` krok 2 = UWO F2/F3 (portovat work-templates z pilotních skriptů RD Jáchymov + HK212 do KB branch YAMLů). Testy zelené: CORE 93 pass (MCP compat + endpoints + stage-gating credits sync + schema + 6 nových passport) · Monolit backend engine 24 + parita 18 · shared bridge-passport golden 10.


## 2026-07-08 — Session: worklist-audit + session close (10 PR dne)

**Rozhodnuto:** Závěrečný audit «seznam prací»: v repu ČTYŘI nespojené implementace místo jedné magistrály — (a) Portal Analýza dokumentace: SoupisTab (viewer) HOTOVÝ, renderuje `soupis_praci` z `/passport/generate`, ale CORE ho nevrací (planPassport mapper nepřipojen = Gate 2; pokrytí profesí 10–14 %); (b) URS okna: `DocumentUpload.html` mounted → `/api/core/parse/document` + `match-batch` (upstream po Sprint A pravděpodobně mrtvý — ověřit live), `ContextEditor.html` = SIROTA (žádný loader) → kandidát na smazání dle working-only policy; (c) URS `/api/v1/work-packages` co-occurrence engine (VZ data) — bezhlavý, žádné UI ho nevolá → surovina pro UWO F2/F3 šablony, NE samostatný produkt; (d) MCP `create_work_breakdown` bez UI. Verdikt = potvrzení BACKLOG pořadí: **Gate 2 první** (SoupisTab už umí zobrazit výsledek → nejlevnější viditelný «seznam prací»). Dnes celkem **10 PR merged** (#1436–#1445): dedup projektů, cross-device originál + hotfix, Načíst z Rozpočtu JWT, unlock+odkazy, kombinovaný export, outage-guard (P1 pool starvation CLOSED), cookie-login Kalkulátoru, Poptávka cen §19, Kalkulátor↔TOV bridge.

**Co dál:** viz `docs/handoff/2026-07-08_worklist-gate2-next-session.md` — Gate 2 zadání.



## 2026-07-08 — Session: Kalkulátor ↔ TOV bridge — obousměrný tok přes write-back (šestý ship dne)

**Rozhodnuto:** Alexandrův hlavní workflow-request: výpočet z Kalkulátoru betonáže má přistát v TOV správné pozice správného projektu v Registry (Lidé + pronájem bednění; mechanizmy/materiály ručně, pumpa/jeřáb/doprava se počítají VESTAVĚNÝMI kalkulátory TOV) — a zpět deep-linkem. Recon ukázal, že ~70 % potrubí existovalo a bylo přerušeno v JEDNOM místě: `buildMonolithPayload` (write-back Monolit→Portal na PUT pozic) posílal jen basic summary — `hasExtendedCosts()` v Registry TOV modalu byl věčně false, prefill-banner nikdy nesvítil, a jediná cesta dat byla «→ Registry» řádkový export (Alexandrova stížnost «podřízené pozice místo TOV»). Fix (schéma potvrzena Alexandrem: **automatický přenos při Aplikovat + ruční aplikace banner-tlačítkem**): (1) Monolit `buildMonolithPayload` parsuje `positions.metadata` (Aplikovat tam už zapisoval `tov_entries` + costs/resources/formwork_info!) a přikládá je do payloadu, `calculated_at` z výpočtu; corrupt JSON → basic payload, nikdy throw. (2) Registry `MonolithPayload.tov_entries` typ + `prefillTOVFromMonolit` preferuje PŘESNÉ řádky z Aplikovat (vč. Ošetřovatel/Specialista předpětí; normHours=kanon, hours=normHours/count, totalCost verbatim presence×rate) s fallbackem na legacy costs/resources rekonstrukci; rental-materiály z tov_entries → Materials když chybí formwork_info (linked bednění pozice ho nemají — nese ho jen main). (3) TOVModal druhý banner «Aktualizovat z Kalkulátoru» (modrý, timestamp výpočtu) když TOV už není prázdný — `mergeCalcRefresh` nahradí JEN kalkulátorové řádky (`linkedCalcId`/prefill-id marker), ruční labor + machinery + materials nedotčené (Alexandrova volba). Zpětný směr už existoval (deep-link «Otevřít v Kalkulátoru» s project+part+instance_id) — po fixu funguje celý kruh. Testy: +4 Jest (metadata forwarding string/object/absent/corrupt) → **82 Monolit backend**, +7 vitest (verbatim professions, rental fallback, legacy fallback, merge zachovává manual) → **232 registry**, build clean.

**Odmítnuto:** Nová tlačítka v Kalkulátoru (Aplikovat stačí — write-back je automatický) a tichý zápis do TOV (vždy banner + klik). Změna «→ Registry» řádkového exportu (jiný scénář, zůstává). Mechanizmy/materiály z kalkulátoru (nepočítá je — jen vibrátor-seed + beton-objem jako dřív).

**Otevřené otázky:** Sibling pozice NOVĚ vytvořené Aplikovat (bez position_instance_id) do Registry TOV nedotečou — jejich data žijí v Monolitu; propojí se až při dalším «Načíst z Rozpočtu»/linkingu. LIVE ověření celého kruhu po deployi (Monolit backend Cloud Build + Registry Vercel).

**Co dál:** LIVE: Turnov základy → Kalkulátor (Upřesnit) → Aplikovat → Registry TOV pozice 272324 → oranžový banner Předvyplnit → Lidé rozložené + pronájem bednění; přidat ručně jeřábníka → přepočítat v Kalkulátoru → modrý banner Aktualizovat → jeřábník zůstal.



## 2026-07-08 — Session: Poptávka cen — bulk-select + project-scoped skupiny + file naming (§19 CLOSED)

**Rozhodnuto:** Alexandrův UX-request na Poptávka cen (= next-session §19 živý bug + feature): (1) **skupiny podle projektu** — filtr srovnával `item.source.projectId`, který na importovaných/obnovených projektech drejfuje od skutečného id → skupiny mizely nebo prosakovaly mezi projekty; teď membership z reálného `projects`-stromu + prune neviditelných aktivních skupin (useEffect na availableGroups); (2) **«Vybrat vše / Zrušit vše»** pro Projekty i Skupiny (`BulkSelectButtons`, CheckSquare/Square 13px + w/h classes, disabled states dle §19 AC); (3) **jméno exportu podle výběru** — `buildPoptavkaFileName`: 1 skupina → `Poptavka_PILOTY_2026-07-08.xlsx`; N skupin → první VYBRANÁ (click order) + `_a_dalsi_N-1`; 0 skupin → jméno projektu (1 vybraný) / `vse`; diakritika NFD-stripped. Schéma multi-jména vybral Alexander interaktivně (AskUserQuestion: «První + počítadlo», preview varianty A-D). `PriceRequestExportOptions.fileName` override (legacy searchQuery-name zůstává fallback). +5 vitest → **225 registry testů**, build clean.

**Odmítnuto:** Výčet до 3 jmen (+N) a projekt+počet — Alexander zvolil první+počítadlo. Multi-projektový výběr NEzakázán (užitečný okrajově), jen skupiny jsou nyní vždy jednoznačně z vybraných projektů.

**Co dál:** LIVE: vybrat projekt → jen jeho skupiny; Vybrat vše → poptávka; export pojmenován dle skupiny.



## 2026-07-08 — Session: Portal outage guard — pool starvation z registry syncu (P1 root cause CLOSED)

**Rozhodnuto:** Alexandrova diagnóza z Cloud Logging potvrdila hypotézu A: `[LOGIN ERROR] timeout exceeded when trying to connect` — Portal pool (max 10) vyhladověl, `stavagent-db` má **max_connections=25** (1 vCPU/628 MB, «Underprovisioned» health issue), graf Total connections narážel na limit v čase výpadku; `import-from-registry` opakovaně padal a držel spojení. Trojitý fix jedním PR: (1) **Portal** — transakce import-from-registry dostala `SET LOCAL statement_timeout=20s / lock_timeout=5s / idle_in_transaction_session_timeout=30s` + `pg_try_advisory_xact_lock(hashtext(registry_project_id))` fail-fast 409 `sync_in_progress` (dva prohlížeče tlačící TÝŽ projekt se už nefrontují na row-locích); (2) **Registry** — portalAutoSync per-project **failure backoff 5 min** (retry storm na ležící Portál byl spolutvůrce výpadku; success backoff maže); (3) **Monolit modal UX** — anonymous case («Nejste přihlášeni — otevřete Kalkulátor z Portálu, token platí 24 h») místo matoucího «Žádné projekty» (Alexandrův druhý repro «import stále nefunguje» = protuхлý/chybějící auth_token po výpadku Portálu, ne bug #1439). Testy: +4 registry vitest (backoff arm/clear/per-project) → 220; Portal backend 62/62; Monolit frontend tsc+build clean. Tímto uzavřen P1 «Cross-kiosk sync Phase 3 — Portal 500 root cause» (byl to connection starvation, ne DB constraint).

**Odmítnuto:** Automatická změna Cloud SQL tieru (Alexandrova akce v konzoli — doporučeno zvětšit instanci NEBO alespoň db flag max_connections; 25 je strukturálně těsných pro 4 backendy × pool 10). Vypnutí auto-syncu (backoff řeší bouři, sync zůstává).

**Co dál:** Alexander: zvážit upgrade `stavagent-db` (health issue «Underprovisioned»). DOPLNĚNO týž den: Alexandrův repro «stále Nejste přihlášeni» přes dlaždice vitríny — dlaždice (na rozdíl od «Otevřít» u projektu) NEPŘEDÁVAJÍ `?auth_token=`. Fix: Monolit frontend čte JWT s fallbackem na cross-subdomain cookie `stavagent_jwt` (stejný mechanismus jako Registry portalAuth) — centrální `getAuthToken()` v `services/api.ts` (localStorage z URL-handoffu má přednost), axios interceptor + `authHeader()` + FlatHeader gating; logout maže i sdílenou cookie (jinak by fallback uživatele hned zase přihlásil). Přihlášení v Portálu теперь stačí pro JAKÝKOLIV vstup do Kalkulátoru (dlaždice, přímá URL, záložka).



## 2026-07-08 — Session: Registry original-file tools — odemknout listy + odkazy v rekapitulaci (čtvrtý ship dne)

**Rozhodnuto:** Alexandrův request (tendrové soupisy chodí se zamčenými listy — GPT mu je odemykal ručně; + chtěl klikací rekapitulaci): nová služba `rozpocet-registry/src/services/excel/originalFileTools.ts` — dvě on-demand transformace ORIGINÁLU na ZIP/XML úrovni (JSZip + regex, stejný přístup jako patchExporter, netknuté části zůstávají byte-identical): (1) **unlockWorkbook** — sejme `<sheetProtection>/<workbookProtection>/<fileSharing>/<protectedRanges>` ze všech listů (zámek je plain OOXML metadata s hashem, ne šifrování — data/vzorce/styly nedotčeny); (2) **addRecapHyperlinks** — kódy objektů ve sloupci A prvního listu (Rekapitulace) → interní `<hyperlinks location=…>` na list, jehož název končí kódem (exact-trimmed match má přednost), idempotentní replace bloku, OOXML element-order (za mergeCells), + best-effort styling (klon xf prvního odkazovaného cell s novým modrým podtrženým fontem — try/catch, selhání stylingu nikdy neztratí funkční odkazy). Parsování workbook.xml+rels+sharedStrings vlastní (namespace-tolerant regexy, prefixless i `x:`). UI: Export menu sekce 4 — «Původní — odemknout listy» + «Původní — odemknout + odkazy» (gated na hasOriginalFile → díky cross-device featuре funguje z libovolného prohlížeče). Zdroj = `getOriginalFile` (IndexedDB → backend fallback). +7 vitest (unlock all/no-op, links match+order, idempotence, styling, match-priority) → **216 registry testů**, tsc+build clean. Algoritmus zrcadlí GPT-ověřený postup na Alexandrově reálném Turnov souboru (69 listů / 68 odkazů).

**Odmítnuto:** openpyxl/exceljs re-write souboru (ničí formát — celý smysl je zachovat originál). Automatické odemykání při každém «Vrátit do původního» (uživatel může chtít zámky zachovat — proto zvláštní tlačítka «po zapytu»).

**Otevřené otázky:** Portal 500 na `import-from-registry` při auto-syncu (Alexandrův console log) — známý P1 (DB constraint unknown); čeká na `[PortalAutoSync] Sync failed — …` řádek s parsovaným error body.

**Co dál:** LIVE: Export → «Původní — odemknout + odkazy» na Turnovu → listy editovatelné, rekapitulace klikací. DOPLNĚNO týž den (Alexandrův follow-up): kombinovaný export «Vrátit do původního (vše)» — `exportToOriginalFileWithSkupiny(project, {unlock, recapLinks})` aplikuje obě transformace na už sestavený zip s cenami+skupinami (unlock PŘED odkazy), suffix `_skupiny_odemceno_odkazy.xlsx`.


## 2026-07-08 — Session: Monolit «Načíst z Rozpočtu» prázdný — Sprint A JWT forwarding (třetí fix dne)

**Rozhodnuto:** Alexandrův repro (kalkulator.stavagent.cz → «Načíst z Rozpočtu» → «Žádné projekty v Registry»): stejná třída jako PR #1434 — Sprint A zavřel Portal `list-registry-projects` (requireAuth + owner-scope) i registry-backend `/api/registry/projects` (JWT-owner), ale Monolit-backend proxy (`routes/import-from-registry.js`) volal oba upstreamy ANONYMNĚ → 401 → prázdný merge. Fix: `forwardedAuthHeaders(req)` přeposílá caller's Bearer na všech 7 upstream fetch-sites (GET listing 2× + POST import: Portal for-registry + Registry project/sheets/items fallback); anonymní POST teď fail-fast 401 «Přihlaste se v Portálu» místo zavádějícího 404 «no sheets». +4 Jest (supertest harness, mock fetch: Bearer na obou upstreamech, anonymous empty bez upstream callů, POST 401, POST forwarding) → **78 backend Jest**. Vedle toho hotfix #1438: original-file PUT 500 — `INSERT…SELECT` bez explicitních castů (`inconsistent types deduced for parameter $1`; Postgres v SELECT-listu neodvozuje typy z target kolon) → `::varchar/::integer/::bytea`, **reprodukováno + verifikováno na lokálním Postgres 16 + node-pg s produkční schema.sql** (round-trip byte-identical, foreign-owner 0 rows, UPSERT replace OK).

**Odmítnuto:** Service-key mezi Monolitem a Portal/Registry (uživatelský JWT je správný nosič identity — owner-scope musí zůstat per-user).

**Co dál:** LIVE po deployi Monolit-backendu: modal ukáže projekty + import Turnova projde. Sledovat další mrtvé anonymní server-to-server volání po Sprint A (grep `fetch(` bez auth headers napříč kiosky — kandidát na mini-audit).


## 2026-07-08 — Session: Registry original-file cross-device («Vrátit do původního» z jiného prohlížeče)

**Rozhodnuto:** Alexandrův nález — export «Vrátit do původního» (bit-identický zápis cen/skupin do importovaného .xlsx) fungoval jen v prohlížeči, kde proběhl import (originál žil pouze v IndexedDB `rozpocet-registry-files`). Řešení = **serverová kopie per-user v registry-backendu**: nová tabulka `registry_files` (BYTEA, PK = project_id, FK ON DELETE CASCADE na registry_projects, ownership odvozen z parent řádku) + 3 routy `PUT/GET/GET-meta /api/registry/projects/:id/original-file` (requireAuth + owner-scoped `callerOwnsProject`, route-scoped `express.raw` 30 MB, filename v URL-encoded query paramu, CORS `exposedHeaders: X-File-Name`). Frontend `originalFileStore` = dvouvrstvý cache: IndexedDB → lazy download z backendu (+ zpětné cache), upload fire-and-forget při importu (cap 25 MB), **self-healing** `ensureOriginalFileBackup` při výběru projektu (doplní backup souborů importovaných PŘED featurou — Alexandrův Turnov se srovná sám z prohlížeče 1). `canExportToOriginal` = lehký probe (lokál ‖ meta), žádný download kvůli badge. GCS zavržen (nová infra kvůli 1–10 MB souborům), rekonstrukce z dat nemožná (ztrácí formát = smysl funkce). +9 vitest → 209 registry testů, tsc+build clean, `node --check` server.js.

**Odmítnuto:** DELETE routa pro soubor (CASCADE při smazání projektu stačí; lokální delete zůstal lokální). Base64/JSON transport (33 % inflace + global 10mb json limit).

**Isolation review (agent, PASS):** diff bez cross-tenant nálezů; oba LOW hardening pointy zapracovány (owner-predikát složen DO samotných statementů — PUT atomický INSERT…SELECT WHERE EXISTS, download/meta owner-JOIN, žádné check-then-act okno). Bonus: opraven **pre-existující CRITICAL** mimo diff — `POST /api/registry/projects` `ON CONFLICT DO UPDATE` neměl owner-guard → cizí project_id šlo přejmenovat + přečíst `RETURNING *`; teď `WHERE registry_projects.owner_id = EXCLUDED.owner_id` + 409 při cizím id. Zbylý LOW (backend test harness) → next-session §20.6.

**Otevřené otázky:** Soubory > 25 MB zůstávají local-only (warn v konzoli). `loadFromBackend` nerekonstruuje per-sheet `config.columns` (§20.4 next-session) — na patch-export by nemělo mít vliv (patchExporter čte originál), ale hlídat.

**Co dál:** LIVE po deployi: import v prohlížeči A → otevřít v prohlížeči B → «Vrátit do původního» musí být aktivní a vrátit bit-identický soubor. Pro Turnov: otevřít projekt v prohlížeči 1 (self-healing upload), pak export v prohlížeči 2.


## 2026-07-08 — Session: Registry duplicate-project fix (Portal-open × BackendSync race)

**Rozhodnuto:** Alexandrův live repro (XLS_ZM01_ŽST_Turnov, 68 listů) diagnostikován a opraven jedním FIX commitem na fronту Registry — Portal «Otevřít» tvořil při KAŽDÉM otevření nový zploštělý duplikát projektu. 3 nezávislé defekty: (a) **dedupe proti stale closure** — `loadFromPortal` porovnával s render-time `projects`, které je při mountu VŽDY prázdné (IndexedDB rehydratace je async) → dedupe z v4.26 byl fakticky mrtvý kód; teď čeká na persist-hydrataci + startup backend-merge (module-level deferred `backendSyncReady`) a čte FRESH state; primární klíč dedupu = dosud IGNOROVANÝ URL param `?project_id=` (Portal posílá původní registry id z kiosk_links); nový pure helper `services/portalImportDedupe.ts`. (b) **addProject neidempotentní** — apendoval kopie se STEJNÝM id; teď existující id → select, ne append. (c) **pushProjectToBackend nepřežil jeden timeout** — 68 listů = ~137 sekvenčních requestů, jeden 30s abort zabil celý cyklus → trvalá parciální kopie v Postgres (28/68 listů, Alexandrova «dobrá» kopie je NEÚPLNÁ!); teď per-sheet retry (1×, 2s), pokračování po chybě, честný «Uloženo částečně: X/Y listů» badge, startup catch-up push i pro projekty s MÉNĚ listy/položkami na backendu (samo-doléčení parciálních kopií), per-project debounce timery (sdílený timer zahazoval pushe ostatních projektů), busy push se re-armuje místo tichého dropu. Bonus: fallback reimport mapuje `row_role → rowRole`. Testy +13 → **213 registry vitest** green, tsc+build clean, Chromium smoke: seeded IndexedDB + `?project_id=` → «no re-import», bez deadlocku.

**Odmítnuto:** Zápis `row_role` na straně Portalu (import-from-registry UPSERT) — Portal echo stejně nenese parentItemId/popisDetail, dedupe dělá reimport nedosažitelným; samostatný ticket kdyby bylo třeba. Oprava deep-link stale closure šla mimochodem (getState()), širší refactor App effectů ne.

**Otevřené otázky:** Duplikáty už vzniklé v Portal DB («E_Soupis__skupiny MOSTY» ×3) a v registry-backendu — ruční úklid Alexandrem po deployi. Parciální backend kopie (28/68) se doléčí až otevřením v prohlížeči, kde žije plná IndexedDB kopie.

**Co dál:** Deploy Registry frontendu (Vercel) → LIVE ověření: otevřít projekt z Portalu 2×, ověřit 1 projekt bez duplikátu + hierarchie zachována; pak úklid duplikátů. Follow-ups v `rozpocet-registry/next-session.md` §20.


## 2026-07-08 — Session: Sprint A ship + deploy + service-audit sweep (7 PR merged live)

**Rozhodnuto:** Dlouhá relace navazující na Sprint A — vše shipnuto do main + deployed + auditní úklid služby na Alexandrův pokyn («убрать что не работает, вывести одну рабочую версию по всем темам»).

**Merged (7 PR, všechny merge-commit, worktree-verified off origin/main):**
- **#1428** Sprint A security A1–A6 + isolation-review fixy (`b579f63`).
- **#1430 + #1431** Klasifikátor POST-proxy oprava — Vercel edge middleware padal `MIDDLEWARE_INVOCATION_FAILED` na KAŽDÉM POST přes `klasifikator.stavagent.cz` (včetně public matching). Root cause diagnostikován z Vercel runtime logs (ne duplex, ale forwardování connection-specific headers + streamovaný body): buffer body přes `arrayBuffer()` + strip host/content-length/connection/transfer-encoding + 10 MB cap + OPTIONS/TRACE bez těla. Live ověřeno: POST → 401 gate (bylo 500), logy čisté.
- **#1432** working-only showcase (Blok A+B+C-lite): Portal vitrína = jen funkční moduly (Kalkulačka čerpadel `coming_soon`→AKTIVNÍ — byla za flagem ŽIVÁ stránka 929 ř. + `/api/pump`; Analýza výkresů `coming_soon`→BETA — postavená DrawingAnalysis modalka byla nedostupná bo `ServiceCard` vrací na `isDisabled` PŘED onClick; 6 dlaždic pryč, 3 čisté placeholdery smazány úplně). Klasifikátor UI strip: model-selector (~200 ř., po Sprint A vždy 401) + orphan Context Editor + mrtvá pole Množství/MJ (matching je čistě textový, UI default `m3` vs backend `ks`) pryč. ÚRS honest labeling: nový `is_web_suggestion` flag bakcend→UI→MCP (perplexity/brave = návrh, ne katalog-fakt); UI jantarový badge «ÚRS (web)» + «Návrh — ověřte v ÚRS». +oprava order-dependent flake vzEnrichment (guard work_packages ALTER když tabulka neexistuje — repro na čisté DB).
- **#1433** registry-sync JWT oprava — na dotaz «браузер или БД?» odhalen HALF-dead hybrid: registry-backend vyžaduje Bearer na všech `/api/registry` od isolation hotfixu (2026-05-19), ale `registryAPI.ts` ho NIKDY neposílal (`USER_ID = 1` legacy) → `/health` public → availability OK → každé reálné volání 401 → catch → ~7 týdnů projekty žily JEN v IndexedDB, cross-device + browser-wipe recovery tiše rozbité. Fix: `portalAuthHeader()` v JEDINÉM sdíleném fetch wrapperu; honest status «Jen lokálně» když nepřihlášen; keepalive flush nese Bearer; +3 wiring testy.
- **#1434** Portal-FE PositionsPanel — stejná třída: `/api/positions/.../linked` bez Bearer → 401 po Sprint A; +authHeader().

**Blok D (catalog search) — audit verdikt:** OTSKP MCP engine zdravý (52 hermetických testů), prod pgvector recall ŽIVĚ OVĚŘEN (MCP `find_otskp_code` → retrieve_summary embeddings:18, provenance retrieve=embeddings, OTSKP 2026 — opasení «INERT v produ» sneseno). CHYBÍ accuracy benchmark (77 Žihle queries, cíl 80% top-1 — nikdy neměřeno). ÚRS = všude web-search bez licenc. katalogu (RD Jáchymov draft ~50% FP) → od teď `is_web_suggestion`.

**Deploy prereqs SPLNĚNY Alexandrem (Cloud Run, ověřeno):** SERVICE_API_KEY (Portal `00368` + Monolit `00399`), URS_ADMIN_API_KEY (`00360`), REGISTRY_CLEANUP_SECRET (`00313`), JWT_SECRET secret-mounted na Monolit (chyběl úplně — ověřoval tokeny proti public dev-fallbacku!). Smoke: Portal `/api/pump/suppliers` → 401 ✓; klasifikator POST → 401 gate ✓.

**Odmítnuto:** implementace Bloku C (tz→multi-trade worklist) v této relaci — jen plán do BACKLOG (`tz-to-worklist`): 4 kroky (passport Gate 2 → UWO F2/F3 → +14 element types → drawing takeoff). Honest baseline: kód pokrývá ~10–14% BOQ (beton+malba), piloty 154/189 pol. byly MANUÁLNÍ session-práce.

**Otevřené otázky:** další frontendy mohou 401-ovat na fail-closed routách jak na ně uživatel narazí (oprava per-file triviální = authHeader); ÚRS licenc. katalog = strategické rozhodnutí (koupit vs navždy web-suggestion); accuracy benchmark OTSKP nepostaven.

**Co dál:** viz handoff `docs/handoff/2026-07-08_service-audit-next-session.md`. Testy napříč: Registry 187/187, URS 240/240, Portal 62/62, Monolit 74/74, MCP goldens green, tsc+build clean všude.

## 2026-07-07 (6) — Session: Sprint A (SECURITY) implementován celý — A1–A6

**Rozhodnuto:** Celý Sprint A z handoffu `2026-07-07_next-session-sprint-a.md` implementován na větvi `claude/session-closed-sprint-a-handoff-p8y9ek` (6 commitů per oblast + testy). (A1) Portal `/api/pump` + `/api/parse-preview` + `/api/kb/research` za requireAuth; `/import` owner_id z JWT (ne literál 1); PoradnaWidget + pump `created_by` fix. (A5, ratifikováno fail-CLOSED) nový `config/secrets.js` — JWT_SECRET + SERVICE_API_KEY povinné při startu v produkci (fail-fast, Cloud Run drží starou revizi); requireServiceKey bez klíče → 503 (bylo allow-all); mounty `/api/integration`+`/api/positions` → requireAuthOrServiceKey (browser calleri fungovali JEN díky fail-open — objeveno při implementaci); portalWriteBack posílá X-Service-Key; canAfford fail-closed; kreditovaný POST bez přihlášení → 401. (A2) Monolit ownership: `bridgeOwnership.js` owner-chain (monolith_projects.portal_user_id → bridges.owner_id), positions+planner-variants: owned+cizí → 403, legacy NULL-owner kiosk-open, POST kontroluje RESOLVED bridge po Phase-11 dedup + štancuje owner při auto-create (anonym 401), suggest-days anonym 401; Monolit auth.js JWT_SECRET fail-fast; frontend authHeader() do raw fetchů applyPlanToPositions. (A3) URS: POST settings/model(+reset) za fail-closed X-API-Key (`URS_ADMIN_API_KEY`); jobs/batch/pipeline opt-in gate `URS_REQUIRE_API_KEY` (default off — veřejný frontend žije). (A4) Registry cleanup-empty: secret z env + owner-scoped SELECT/DELETE (mazal prázdné projekty VŠECH); +requireAuth na formwork-rental + excel-with-pump. (A6) 2 .env odtrackovány. Isolation-reviewer našel 2 blocking nálezy → opraveny v téže větvi: CRITICAL position-instances.js (0 owner-predikátů, 13 rout → assertProjectAccess/assertInstanceAccess, JWT scoped přes owner_id join s 404, service-key bypass pro portalWriteBack) + HIGH pump calculations read (created_by OR owner-join). Testy po fixech: Portal 62/62, Monolit 74/74 (+dedup-intruder), URS 240/240, tsc clean obě fronty.
**Odmítnuto:** tvrdý API-key gate na URS jobs/batch/pipeline (rozbil by veřejný klasifikator — čeká na Alexandrovo rozhodnutí API-key vs Portal-JWT); hluboký owner-scoping position-instances.js SQL (~15 rout, vlastní PR — viz handoff).
**Otevřené otázky:** DEPLOY PREREQ — SERVICE_API_KEY (Portal+Monolit), URS_ADMIN_API_KEY, REGISTRY_CLEANUP_SECRET nastavit v Cloud Run PŘED deployem (fail-fast je záměr); URS auth model; position-instances owner-scoping follow-up.
**Co dál:** merge (vlastní PR, nemíchat s feature prací); po deployi negativní smoke live; pak P2 tz-passport B-interview + gate 2.

## 2026-07-07 (5) — Session CLOSE: handoff pro příští relaci (Sprint A připraven file:line)

**Rozhodnuto:** Relace uzavřena. Vše z dneška v main (PR #1423 + #1426, tip daba05f). Handoff snapshot `docs/handoff/2026-07-07_next-session-sprint-a.md` — kompletní zadání příští relace: **Priorita 1 = Sprint A (security)** s file:line mapou (A1 Portal pump/parse-preview/kb-research, A2 Monolit positions/planner-variants ownership, A3 URS settings/model, A4 Registry cleanup-empty owner-scope + 2 routy, A5 fail-open Portal, A6 hygiena .env + Secret Manager TODO) — všechny STILL OPEN k 2026-07-07 (ověřeno agentem). Priorita 2 = tz-passport B-interview + gate 2 consumer wiring. Priorita 3 = warnings 5-7, Resource Ceiling per-profession, URS PG, api-access.
**Otevřené otázky:** Sprint A start (Alexander DAL pokyn — začít příští relací); URS auth API-key vs Portal-JWT; fail-open→closed rozhodnutí (SERVICE_API_KEY/JWT_SECRET povinné při startu).
**Co dál:** příští relace = Sprint A per handoff; každá owned-table změna → cross-user-isolation-reviewer PŘED pushem; vlastní PR.

## 2026-07-07 (4) — Session: live-test composite panelu — 2 UI fixy (typy + normy)

**Rozhodnuto:** (1) `ELEMENT_TYPES` v `types.ts` neměl `kridla_opery` ani `zaklady_oper` (22 z 24) — composite šablona opěry pak u «Křídla» ZOBRAZOVALA «Základová deska» (React select bez matching option ukazuje první položku; engine přitom počítal správný typ). Oba typy doplněny — poprvé vybratelné i v hlavním dropdownu. (2) «Výrobní normy (methvin.co)» panel liл surový JSON — v4.18 quick-fix jen nahradil [object Object] za JSON.stringify. Nový humanized renderer: mapa-objektů (`systemy`) → řádek per systém, skaláry «k: v · …», stringy zkráceny na 140 znaků.
**Otevřené otázky:** AI advisor mechanismus vysvětlen Alexandrovi v chatu (multi-role concrete_specialist + kb/research + norms/work-type — 3 nezávislé zdroje v jedné odpovědi).
**Co dál:** merge větve.

## 2026-07-07 (3) — Session: tz-passport-json interview RATIFIED + polovina A gate 1

**Rozhodnuto:** Interview (Alexander): (1) Pydantic v Core = schema SSOT + example jako CI-golden; (2+3) kde běží extrakce a LLM/regex split → DEFERRED do B-interview; (4) konflikty TZ↔soupis: OBĚ hodnoty viditelné, TZ = default výpočtu, OTSKP «DO Cxx/yy» pásmo ≠ konflikt marky (Pattern 53 → informativní); (5) passport per-SO, stavba = kolekce. +AC: honest-ignore nekonzumovaných polí (graceful degrade vůči seam/#7), backward-compat, chybějící množství → NEPOČÍTÁNO (v4.38 UncalculatedError). SHIPPED gate 1: `app/models/bridge_passport.py` (Pydantic, strict na čtených polích + extra=allow) + `tests/test_bridge_passport_schema.py` (5 testů, wired do MCP workflow incl. example path-trigger); example rozšířen o `quantities` (soupis join s provenancí per položka); mapper `Monolit-Planner/shared/src/parsers/bridge-passport.ts` — `mapPassportToPlannerInputs` (9 prvků, plné třídy «C30/37-XF4+XD3+XC4» → class+primární expozice, deck: takty z výkresu → num_tacts_override+tz_facts, per-deck split ÷2) + `planPassport` (→ planProject). 10 golden testů: deck 3 takty × 449,66 m³ BEZ tz-flagu, band-note ne-konflikt, genuine-konflikt warning s TZ defaultem, NEPOČÍTÁNO bez quantities, honest-ignore. Shared 1366→**1376**, Python battery 101→106, tsc+vite clean.
**Odmítnuto:** MCP tool `calculate_from_passport` v tomto gate (counter-soubory = vlastní PR — gate 2 ticket v BACKLOG).
**Otevřené otázky:** B-interview (otázky 2+3); gate 2 consumer wiring; jiný default pro konflikt (Alexander nabídl přehodnotit — zatím TZ).
**Co dál:** gate 2 wiring na povel; B-interview.

## 2026-07-07 (2) — Session: MCP E2E test SO 202 Žalmanov + 5 fixů + tz-passport spec seed

**Rozhodnuto:** (1) Živý E2E přes MCP na reálném mostě (výkres 202/17 Tvar NK vision + soupis EstiCon 99 položek): klasifikace 8/9 správně, spodní stavba OK (pilíře 3 záběry DIN 18218, opěry TRIO bez stagingu), NK bez TZ → 12 taktů dle okna; s tz_pour_stages=3 → validační flag s citací výkresu (v4.37 works E2E); v4.38 fixy potvrzené v prodě (podkladni rebar=0, warnings_structured). Nh celkem 32 701 (5 248 m³, 6,23 Nh/m³; NK 7,99 Nh/m³ — kontaktní plocha skruže ODHAD). (2) 5 nálezů opraveno TENTÝŽ den: MCP +`rebar_mass_kg`+`prestress_strand_mass_kg`+`num_tacts_override`; W3 podkladni_beton (yaml w3_name+w3_family + ELEMENT_TYPES rebar 0 + kb-artifact regen); římsa bm→per-tact area (replay fixture 13 re-captured lokálním enginem); bridge-technology feasibility guard (Žalmanov: span 44,5>40 už NEdoporučuje infeasible MSS — pevná skruž s vysvětlením). Tickets v BACKLOG.md `mcp-e2e-zalmanov-findings`. (3) Alexandrův ručně sestavený bridge-passport JSON přijat jako kanonický příklad → `docs/specs/tz-passport-json/` (example + requirements DRAFT s EARS kritérii; přidáno `_meta` provenance + `deck_pour_stages: 3` se zdrojem). 
**Odmítnuto:** implementace extrakčního pipeline bez interview (governance schématu, kde běží, LLM/regex split, konflikt-UI — 5 otázek v requirements.md).
**Otevřené otázky:** interview tz-passport-json; live re-verifikace 5 fixů po deployi; Pattern 53 konflikty v passportu (pier/deck C35/45 vs soupis DO-band C40/50) — jak zobrazit.
**Co dál:** merge této větve; interview k tz-passport; potom polovina A (mapper passport→PlannerInput[], testovatelná proti example+E2E goldenům).

## 2026-07-07 — Session: audit-verify + Sprint B/C/D execution (Sprint A odloženo na founder's go)

**Rozhodnuto:** (1) Composite #7 Fáze 2 merged do main (PR #1422, merge-commit `a114180`, worktree-verified). (2) Audit 2026-07-01 re-verifikován 4 paralelními read-only agenty proti aktuálnímu main — verdikt: Sprint A nezačat (jen Registry `cleanup-empty` +requireAuth), mrtvý kód nesmazán, docs-truth ~30 %; 2 korekce auditu: `kiosk-links.js` je ŽIVÝ (KioskLinksPanel v CorePanel), Registry double-scroll UŽ opraven v kódu. (3) Fantomní P0 v BACKLOG.md uzavřen (symptom fixed 31.05; neautentizované routy = jiná třída = Sprint A). (4) Sprint B: soft-degradation TŘÍDA vyřešena (`UncalculatedError` NEPOČÍTÁNO + rebar=0 honest zero + selektor allow-list) — founder's direct order supersedoval Step-3-interview gate z TODO; CORE pasporty na disk (`passport_store.py`); URS SQLite→PG = vlastní BACKLOG ticket (infra). (5) Sprint C: warnings_structured Phase 2 (severity + palette + AC3 gate «Pokračovat přesto»), Resource Ceiling UI (stropy firmy + violations karta), Portal `/register` + `?redirect=` (invite flow). (6) Sprint D: dead-code sweep importer-verified (CORE monolit_adapter 613 L «PRODUCTION LIVE» byl fake + 4 moduly + strays; Monolit legacy UI strom + clutter; URS catalog-import route; AWS-éra Registry-backend), docs-truth (version triangle v4.38/1366, handoff single-point = docs/handoff/ + root pointer, CALCULATOR_PHILOSOPHY repointy, Monolit+concrete-agent CLAUDE.md pravda).
**Odmítnuto:** api-access page (blokováno Lemon Squeezy manual TODOs — nešít stránku na nezapojený billing); slepý URS PG rewrite (18 souborů + provisioning mimo repo); mazání `api/sync.ts` (Vercel-convention — nejdřív Vercel logs) a `classifyRows` (živý import path).
**Otevřené otázky:** Sprint A start — čeká na explicitní pokyn Alexandra («а последним когда я скажу»); LIVE-DoD composite #7 na kalkulator.stavagent.cz po deployi.
**Co dál:** Sprint A (auth sweep dle audit-reportu §6.1-3) na povel; zbytky lístků: warnings Phase 2 items 5-7 (MSS-9/MSS-10/golden runner), Resource Ceiling per-profession forma, URS PG ticket, api-access po LS konfiguraci. Testy: shared 1294→**1366**, backend Jest 62, URS 232/232, CORE pytest store+delegation green.

## 2026-06-26 — Session: Fáze 5 #7 — composite-element-parts Fáze 2 Gate 5 (kalkulátor → vkládání částí + odchod berliček)

**Topic:** Dokončení Fáze 2 na FE-větvi `claude/composite-element-parts-fe-1dea1` (Gate 4 už hotový: `5ecd168`/`19ebeed`/`2c224a5`). Gate 5 = kalkulátor počítá opěru po částech (in-process `planComposite`) a vkládá je pod rodiče jako řádky tagované `metadata.structural_part`; odpojený příznak křídla pryč. Spec `docs/specs/composite-element-parts/{requirements,design,tasks §1.6}` + handoff `docs/handoff/2026-06-26_composite-gate5-next-session.md`.

**Interview (před kódem, 2 rozhodnutí):**
- **Váha formuláře části → (a) KOMPAKTNÍ** — část = typ + (objem NEBO L×W×H) + voliteln. override bednění; zbytek z `getSmartDefaults` + zděděné firemní/prostředí nastavení rodiče. Sedí na ±10–15 % filozofii + Karpathy (NE N× plný formulář).
- **Rozsah „tří mechanismů množnosti" → (a) SCOPED** — `num_identical_elements`/`num_dilatation_sections`/`manual_zabery` mají legitimní ne-composite užití (5 stejných pilířů, dilatace→šachové plánování, nerovnoměrné záběry) → ZACHOVÁNY. Composite seznam částí = nový způsob složení opěry. Smazán JEN `include_kridla`/`kridla_height_m` (display-only, do `buildInput` nešel). Recon-nález: WizardHints zápis `num_tacts_override` (CalculatorSidebar.tsx:926–940) byl UŽ dříve opraven na sections/tacts model; `num_tacts_override`/`tact_volume_m3_override` jsou engine-vstupy plněné z `manual_zabery` (drženo) → žádná další berlička k odstranění.

**Rozhodnuto / hotovo:**
- **In-process datová cesta** (NE HTTP): `compositeResult` memo v `useCalculator` volá shared `planComposite({parent, parts})` synchronně, zrcadlí `planElement` větev. Frontend composite-režim gate-nut samotnou existencí seznamu `parts` (AC 3.11).
- **Nové soubory:** `compositeParts.ts` (`makePart`/`makeAbutmentTemplate` 4-part šablona opěry dřík+práh+zídka+křídla = klíče `PLACEHOLDER_PART_VOLUME_RATIOS`; `buildPartInput` dědí rodičovské firemní/prostředí pole, strip-uje geometrii/bridge/množnost, řeší objem explicit > geometrie > vynechán→ODHAD); `CompositePartsPanel.tsx` (kompaktní editor řádků + per-část výsledky m³/ODHAD-badge/taktů/dní/Kč + Σ + uzavření na 100 % + „Aplikovat části do pozice").
- **`applyCompositeToPositions`** (`applyPlanToPositions.ts`): per-část work-řádky (beton/bednění/výztuž/zrání/…) pod TÝMŽ `part_name` (opěra = 1 smětní položka), tagované `metadata.structural_part = part.label` → Gate-4 `groupByStructuralPart` renderuje sub-úroveň. **První část REUSE rodičovský beton-řádek** (retag+re-qty na objem části), ostatní = nové siblingy → rodič = čistý kontejner, Σ beton = total → **bez dvojího započtení** (design §5.5). NEpoužívá `findLinkedPositions` (slučovalo by bednění všech částí do jednoho řádku). Pronájem bednění per-část jen když je známá plocha (geometrie/override); ODHAD části bez plochy nenese pronájem (honest, ne tiché 0). Forwarduje `portal_project_id`/`registry_project_id` jako single-element cesta (isolation parita).
- **Odchod berliček:** `include_kridla`/`kridla_height_m` smazány z `FormState`+`DEFAULT_FORM`, auto-set (useCalculator), `kridlaFormwork` memo, render (CalculatorResult), checkbox (CalculatorSidebar), prop (PlannerPage). Křídla = nyní řádek části „Křídla".
- **Testy:** +2 shared (`composite-planner.test.ts`: 4-part opěra šablona all-ODHAD → každá část vlastní plán/systém/takty + Σ==total; smíšený exact dřík + zbytek ODHAD). **1351 shared zelených** (1349→1351), `tsc` shared+frontend čistý, `vite build` čistý.

**Odmítnuto / NEtknuto (SCOPE GUARD):**
- `price_crane_czk_shift`/`price_pump_czk_h` — samostatný ticket (TOV-rozpad), root CLAUDE.md P1. Nedotčeno.
- Nosná cenová pole (3 režimy, Monolit CLAUDE.md §0) — nedotčeno.
- Tři mechanismy množnosti — ZACHOVÁNY (scoped rozhodnutí).

**Otevřené otázky / Co dál:**
- **Merge-gate = Alexander** (Fáze 2 = jeden PR Gate 4+Gate 5, merge-commit ne squash — Pattern 12).
- **ŽIVÁ kontrola na kalkulator.stavagent.cz po deploy** (DoD): šablona opěry → 4 části → ODHAD badge → Aplikovat → sub-úroveň v tabulce pozic; rodič bez dvojího započtení.
- Follow-up (mimo #7): pilíř jako 2. composite-typ; kalibrace `PLACEHOLDER_PART_VOLUME_RATIOS` z VP4/SO-250/Žihle; pronájem bednění per-část pro ODHAD části; auto-extrakce složení z výkresů.


## 2026-06-26 — Session: Fáze 5 #7 — composite-element-parts Phase 1 (opěra z částí: shared + backend/MCP za flagem)

**Topic:** Složený prvek (opěra = dřík + úložný práh + závěrná zídka + křídla = jedna smětní položka, ale výpočet po částech, každá svým bedněním/takty/betonem). SDD: recon → ratifikace gate-by-gate (AskUserQuestion) → implementace → user merge-gate. Spec `docs/specs/composite-element-parts/` + recon `docs/audits/calculator_field_map/2026-06-23_composite-parts-recon.md`.

**Rozhodnuto (merged na main, PR #1412, merge-commit `e6761d1`):**
- **Gate 0/1** — varianta „b": rodič = **čistý kontejner** (práce na listech, BEZ KPI-surgery → double-count vyloučen konstrukcí, flat-sum sčítá listy); parts single-source = `element_rules` yaml; volume-podíly odloženy (placeholder). Formální ADR ne — `design.md §5.5` = design-of-record (nosné rozhodnutí zapsáno s obhajobou).
- **Gate 2** — `composite-planner.ts` `planComposite(parent + parts[])` (ČISTĚ ADITIVNÍ): přesné části kept; odhad-části dělí zbytek po placeholder-podílech (ODHAD `volume_source`), poslední pohltí reziduum → **Σ == total přesně** (AC 3.7); 0 částí → honest „nedetailizováno" (nikdy nevymýšlí části). `planElement`/`planProject`/`PlannerInput` netknuté → **1344 vitest** (1337 byte-identical, goldeny BEZ re-snapshot; +7 composite).
- **Gate 3a** — backend `/api/calculate` přijme `parts[]` za flagem `ENABLE_COMPOSITE_PARTS` (OFF default) → `planComposite`; flag OFF / no parts = byte-identical single-element. **18/18 jest**.
- **Gate 3b** — MCP `calculate_concrete_works` forwarduje `parts[]` VERBATIM do payloadu (forward-only, MCP nedekomponuje). Opc. param → tool-count beze změny (compat **29/29** v CI); nový golden `test_composite_parts_forward.py` přidán do allow-listu (push+PR+run). 2/2 hermetic lokálně.
- CI #1412 **11/11 zelené** (incl. plný MCP-compat 29/29). Flag OFF → **prod beze změny**, dokud frontend (Fáze 2) neflipne — žádný tichý polo-stav.

**Odmítnuto:**
- Amazon Q bot „🛑 Logic Error" na `composite-planner.ts:177` (exact>total → estimate „silently" 0) — **chybný/false-positive**: warning fires (`překračuje`) + `volume_closed=false` (golden „exact parts exceed total"), a navržená editace `remainder>=0?remainder:0` = no-op vůči `Math.max(remainder,0)`. Reply na PR, kód netknut. (2. chybný Amazon Q po #1409 17904.)

**Otevřené otázky / placeholder:**
- `PLACEHOLDER_PART_VOLUME_RATIOS` NEkalibrované — data-swap follow-up (VP4/SO-250/Žihle); do té doby ODHAD-split hrubý.
- Live MCP „flag ON" prohlídka potřebuje preview/local Monolit backend s flagem (prod flag OFF; `/api/calculate` = Monolit Cloud Run `monolit-planner-api-…`, NE concrete-agent; MCP `MONOLIT_API_URL` overridable).

**Co dál:** **Fáze 2 (frontend) — Gate 4 HOTOVO** na FE-větvi `claude/composite-element-parts-fe-1dea1` (shared `groupByStructuralPart` `5ecd168` + UI `PositionsTable` part-sub-level `19ebeed` + `design.md §5.6` metadata-encoding `2c224a5`; **1349 shared testů ✓**, `vite build ✓`; **prod INERTNÍ** — `metadata.structural_part` zatím nikdo nepíše → vše renderuje flat = dnešek). **Gate 5 (nezačato, pokračuje na TÉŽE větvi — Fáze 2 = jeden PR, NEzakládat novou):** kalkulátor composite-vstup (**ruční seznam částí**, rec. (a)) → engine `parts[]` (za flagem `ENABLE_COMPOSITE_PARTS`) → `applyPlanToPositions` píše `metadata.structural_part` → odchod `include_kridla` + tří mechanismů množnosti. **Handoff:** `docs/handoff/2026-06-26_composite-gate5-next-session.md`. Follow-up: pilíř 2. composite-typ; kalibrace podílů; auto-extrakce.

## 2026-06-22 — Session: MCP task-queue T1–T5 + #1b + T4 Fix-4 diagnostics (Google-call prep ride-along)

**Topic:** Disciplinovaná fronta MCP/Core úkolů (recon → gate → user-ratify → implement → independent venv test → review → merge). Příprava na call s Google inženýrem (Vertex AI → google-genai migrace) sloučena do `docs/handoff/GOOGLE_CALL_2026-06-19_FULL.md`. Merge-gate tiery zavedeny: features = user gate; triviální/docs = Claude self-merge ride-along.

**Rozhodnuto (merged na main):**
- **#1b** (`#1407`) — `breakdown.py` ctí explicitní `element_type` z volajícího (`confidence 0.99`, `classification_source="explicit_input"`) místo re-klasifikace. Live-ověřeno přes prod MCP `create_work_breakdown` (explicit `operna_zed` ctěn). +3 #1b goldeny v `test_uwo_atomizer_t1.py`.
- **T1** (`#1406`/seam) — UWO seam: nové `scope_router.py` + `catalog_binding_adapter.py` (`_FLOORED_SOURCES={"urs_matcher_service"}`, `URS_CANDIDATE_FLOOR=0.80`, `map_status(match_kind, confidence, source)`). Monolit = jedna větev; honest-blank.
- **T2** (`#1406`) — chunked TZ → quantified elements přes existující join (`chunked_tz_extraction.py` + `document_chunker._value_safe_overlap`). Odblokovává T7.
- **T5** (`#1408`) — `find_urs_code` carrier-shape parity s `find_otskp_code` (`retrieve_summary` v success i error envelope). Per-result kontrakt T1 (`catalog`/`catalog_version` honest-null/`match_kind`) zachován. 2 hermetické testy.
- **T4** (`#1409`) — Fix-4 živá diagnostika (Cloud SQL): **pgvector 0.8.1** (≥0.7 → halfvec(3072) ready pro T6, bez `ALTER EXTENSION`); `otskp_embeddings` = **17 940 řádků, všechny `catalog_version='OTSKP 2026'`** (žádný intra-store split); keyword-store **17 904/2025**; **delta 36 → rozštěp je MEZI sklady**. Rozhodnuto: rebake `otskp.db` → 2026/17940 složit do T6 Fáze 3; canon-number sync 17904→17940 (tech.md/product.md/domain.md/CLAUDE.md) až PO rebaku.
- **CI-discipline** — 4 nové goldeny (`test_uwo_atomizer_t1`, `test_chunked_tz_extraction`, `test_otskp_ranking_golden`, `test_urs_carrier_t5`) přidány do EXPLICITNÍHO allow-listu v `.github/workflows/test-mcp-compatibility.yml` (workflow nespouští celou suite — jen jmenovaný seznam; CI instaluje plný `requirements.txt` → importy se resolvnou).
- **Rule 605 catch** — `find_urs_code` docstring counter omylem změněn 17 904 → 17 940 (zkopírováno od sousedního OTSKP čísla). User chytil. Revert (`db28de93`) zůstal trčet na `find-urs-carrier-t5` větvi a nedostal se na main po merge #1408 → **#1409** opravil main zpět na **17 904** (správná aktuální URS-matcher seed hodnota).

**Odmítnuto:**
- Amazon Q bot na #1409 žádal revert 17 904 → 17 940. **Zamítnuto jako chybné** — bot zaměnil URS-matcher seed (17 904, co matcher používá DNES) s OTSKP-canon-sync (17 940 až po rebaku). 17 904 je správná současná hodnota. User merge #1409 potvrdil.
- `--ignore-installed` / bypass při smoke testu závislostí — vždy clean `pip install -r requirements.txt` v čerstvém venv.

**Otevřené otázky:**
- **T6** (vector migrace 3072/halfvec) potřebuje embedding-vidlice ADR + odpovědi Google Q2/Q5 z callu; skládá Fix-4 keyword-store rebake do Fáze 3; canon-number sync 17904→17940 až po rebaku.
- Deck na `/en/pitch` tahá React z unpkg CDN za běhu (ne 100% standalone).

**Co dál (fronta, nezačato):** T6 (vector migr.) · T7 (kiosk cleanup — odblokováno T2) · T9 (URS Perplexity větev) · V1 (šev) · V2 (Pattern 27). Parking: deck Monte-Carlo „live today" claim na `/en/pitch` (přesnost vůči Cemexu), DWG binárka (ODA/libredwg v prod image), „Gate C ingest" recon. **Start příští session:** viz `docs/handoff/2026-06-22_next-session.md`.

## 2026-06-22 — Session: EN language switch + public /en/pitch page (Cemex outreach)

**Rozhodnuto:**
- Sdílená komponenta `components/LanguageSwitch.tsx` (orámovaný, labelled "English"/"Čeština" + Globe; plain `<a>` → shareable, refresh-safe, žádné browser-storage) nahradila tichý textový odkaz v nav CZ (`LandingPage`) i EN (`LandingPageEn`). `TeamPage` už byl compliant (ghostBtn + label), neměněn.
- Public nav dostal presentational responsive pravidlo (`design-system/components.css` `.pub-nav*`): pod 768 px se skryjí section-anchor odkazy a zbytek se zalomí místo ořezu → switch dostupný na mobilu. CZ obsah/sekce/copy beze změny (AC#5).
- Nová EN-only stránka **`/en/pitch`** (`PitchPageEn`, eager route): self-contained HTML deck v `<iframe>`, Download-PDF, Request-a-pilot (mailto `info@stavagent.cz`), 3 captioned screenshoty (self-hide přes `onError`), kontakt. Hero copy verbatim z obálky deku. EN home má CTA „View the pitch“. Cesta `/en/pitch` (univerzální) zvolena místo `/en/cemex`.
- Assety v `public/assets/pitch/`: `deck.html` (988 KB, embed as-is), `deck.pdf` (6.5 MB), `screenshot-1..3.png` (kalkulátor / MCP prompt / deterministická dekompozice).
- Prerender: `/en/pitch` přidán do `prerender.mjs` (`ROUTES_TO_PRERENDER` + `snapshotFiles`) i `.github/workflows/prerender.yml` (smoke + copy). Snapshoty `/`, `/en/`, `/en/pitch` přegenerovány lokálně reálným Puppeteerem a commitnuty (CI action nemůže pushnout do chráněného main). `tsc && vite build` čistý (exit 0).

**Odmítnuto:** `/en/cemex` jako primární cesta · hamburger mobilní menu (stačí responsive skrytí) · restyling deku (embed as-is) · psaní marketingových claimů (copy jen z dodaného deku, captiony faktické).

**Otevřené otázky:** deck tahá React z unpkg CDN za běhu (není 100% standalone — funguje v prohlížeči s internetem) — chce founder verzi bez externí závislosti? · screenshot-1 lze zaměnit za SO-202 whole-object plán.

**Co dál:** founder zreviduje větev `claude/dreamy-ramanujan-ssIIr` a smerguje (PR zatím nevytvořen, dle zadání). Po deployi ověřit `/en/pitch` na produkci (deck iframe, Download-PDF, mailto, switch na mobilu).

## 2026-06-21 — Session: [K] Phase-5 kalkulačka (close-out → konsolidace)

**Topic:** [K] kalkulačka session uzavřena a sloučena do jednoho kánonu (STAVAGENT_CANON_Phase5.md). Session stála on-hold, nedispatchovala nic z menu; zafixovala Fix-3 spec, pořadí [K]-fronty a Cemex-lifted přeřazení.

**Rozhodnuto:**
- Fix 3 patří do [C] (Core/retrieval), ne [K] — správně nepřevzato. Banked spec konverguje s code-verified reconem session C: (A) stamp reálné catalog_version místo hardcode "OTSKP 1/2025"; (B) keyword-kandidáti dle relevance/score, ne ceny; golden C30/37 bez "předpjatý" → ŽB 334325 nad 334335. BUGS#6 (prefab 33311 vs monolit 333326) — neřešit zvlášť, ověřit až po Fix 3.
- Cemex sňat jako blocker → pořadí čistě value + deps + risk, bez demo-řezu. TODO#7 na plnou hodnotu; mostovka-gaty (#8/#5/redesign) value-itemy dle váhy; post-Cemex (Fix 4 / Phase 3 / genai-3072-halfvec) schedulable ale ne urgentní.
- Migrace = vlastní vyhrazený cyklus (vlastní rekalibrace prahů pod 3072), Fix 4 jedním re-embed s ní; pin `google-cloud-aiplatform==1.154.0` drží prod.
- `create_work_breakdown`: #1b serializován PŘED atomizer-общестрой prací, neparalelit.
- Ride-along (stale TODO#6 + zápis Fix-3-do-PLANu) → do větve dalšího [K]-itemu, NE samostatnou docs-PR.

**Odmítnuto:**
- Převzít Fix 3 (špatná session — Core doména).
- Scope-expansion pod svobodou času; rvát do migrace явочным порядком.
- Samostatná docs-PR pro ride-along.

**Otevřené otázky:** (přeneseno do kánonu)
- Pořadí Q3↔Q2 — zda zvednout #1b nad T2 (oboje v `create_work_breakdown`).

**Co dál:**
1. Nahrazeno `STAVAGENT_CANON_Phase5.md` (§3 [K]-fronta). Session uzavřena.
2. Práce pokračuje v session C dle kánonu, jedna větev v letu.

## 2026-06-21 — Session: Analýza zvec/Lift + KB-RAG + seam-interview (close-out)

**Topic:** Analytická session uzavřena a sloučena do kánonu. Eval vektorových/extrakčních nástrojů (zvec, Lift), architektura KB-RAG grounded-decision-layer, seam-interview (TZ pour-stages → dělení taktů). Žádný kód, žádná větev — výstup je analýza + spec.

**Rozhodnuto:**
- **Seam spec** (Q11, doporučeno, ratifikovat při dosažení): TZ = podlaha, fyzika dělí dál (engine NIKDY < TZ, flag jen když nucen překročit); ruční > TZ > auto (confidence 0.99 > dokumentace > default); univerzální bez regresí, reálný cíl mostovka NK; auto-apply + viditelný badge "Záběry z TZ: N etap (§…)" + editovatelné. **Řešení díry Q1↔Q2:** ruční prorazí podlahu TZ (ruční vyhrává), ale ruční-pod-TZ → viditelný warning "odchylka od PD (TZ: N etap)".
- **zvec** (Alibaba embedded hybrid VDB) = kandidát-generátor pod deterministickým re-rankem pro OTSKP matching — revisit post-Phase-5, jen pokud rozhodnuté cesty nedotahují.
- **Lift** (Datalab schema-constrained, 9B/GPU) = pouze eval-on-Czech-golden, fallback pro těžké skeny.
- **KB-RAG**: Class-1 numeric = codegen vs Class-2 prose = RAG; pilot na učebnici B6; AŽ PO embedding-vidlici ADR.
- **Embedding-vidlice = ADR (rozhodnutí, ne build), PŘEDCHÁZÍ jakémukoli embedding-buildu:** sjednotit OTSKP-migraci (gemini-embedding-001 / 3072 / halfvec / pgvector ≥0.7) a KB-RAG (BGE-m3) — jeden stack na oba, nebo explicitně dva.

**Odmítnuto:**
- "Jeden model na oba" jako předpoklad bez ADR (nemožné, pokud se stacky liší).
- Stavět KB-RAG nebo migraci před ADR.
- Seam Option 2 (TZ strict — dokumentace přepisuje fyziku) a Option 3 (status quo, TZ jen flag).

**Otevřené otázky:** (přeneseno do kánonu)
- Seam Option 1 ×4 — ratifikovat při Q11.
- Embedding-vidlice ADR — nerozhodnuto, blokuje Tier-2 embedding práce.

**Co dál:**
1. Nahrazeno `STAVAGENT_CANON_Phase5.md` (seam §4, analýza §7). Session uzavřena.
2. Itemy naplánovány jako Tier 2 (§7) / Q11; ADR první.

## 2026-06-21 — Session: Capability / positioning audit (close-out)

**Topic:** Audit tvrzení na landing/deck/README proti realitě. Dvě chybná určení DWG, opravená živou prod-probe. Nic neodesláno do marketingu, žádná PR.

**Rozhodnuto:**
- DWG = wired-but-non-functional na prod. Adapter kód existuje (`app/services/uep/`), ale `uep_get_dwg_conversion_status → any_available:false` (žádný ODA / dwg2dxf binár v nasazeném image) → každý `.dwg` → `DWG_CONVERSION_FAILED`. "PDF, DWG" na landing = dnes nepravdivé funkční tvrzení (deployment důvod, ne chybějící parser). Nativní DXF funguje (bez bináře) — drženo zvlášť.
- MCP tools = 20 registered (`server.py` `_REGISTERED_TOOL_NAMES`); klasifikace **15 work / 5 introspection**. Marketing-headline = 15 work (nebo "20 total incl. 5 ops" s rozpadem); NIKDY holé "20". README stale "9" → fix. compat-test "11" = subset, glnout později.
- Element types 24 = source-verified (`pour-decision.ts`). **Test count = 1249 LIVE-VERIFIED (vitest, 1249 passed / 30 files, 0 fail)** — publikovatelné (ne "audit figure").
- Lekce: registrace v dispatch table ≠ funkční na prod — probe the runtime.
- Findings zachyceny v audit-docs na `claude/capability-audit-c4p7t` (d5e5821 / 679ca4f / 8297d9c). Nic do marketingu, žádná PR.

**Odmítnuto:**
- 1. určení "STUB" (kód existuje); 2. určení "LIVE/best-effort" (binár chybí na prod). Obě staženy (dvoukrokový CORRECTION banner v dokumentu).
- Editace landing/deck/README; otevření PR; stamping audit-čísel na důvěru.

**Otevřené otázky:** (parked)
- DWG: (a) nainstalovat ODA/libredwg do prod image (Dockerfile, PR3 §3.1) → ponechat "PDF, DWG"; nebo (b) odstranit "DWG" než binár přijde.
- (resolved) tool count = 15 work / 5 introspection; test count = 1249 LIVE-VERIFIED.

**Co dál:**
1. Substance → kánon (positioning slot). Větev `claude/capability-audit-c4p7t` zůstává jako plný audit-záznam (nemergováno). Session uzavřena.

## 2026-06-21 — Session: Fix 3 — catalog_version + price-free ranking (Core/retrieval) — MERGED (PR #1404), live-ověřeno

**Topic:** Fix 3 (Core/retrieval) — odstranění hardcoded catalog version + cenového tie-breaku v OTSKP rankingu. Recon → ratifikovaný kontrakt → implementace → **MERGED (PR #1404)**, live-ověřeno na prod-probe.

**Rozhodnuto:**
- **A — version stamp:** hardcode `"OTSKP 1/2025"` (otskp.py:191/:237) → reálná per-row `catalog_version` ze store (SELECT protažen do `OTSKPItem` + embeddings; fallback `settings.OTSKP_CATALOG_VERSION`; PRAGMA-guard pro legacy DB bez sloupce). In-memory XML fallback odvozuje verzi z configu — žádná nová date-konstanta (WP2).
- **B — price-free ranking:** keyword SQL `ORDER BY cena` → `ORDER BY code`; `deterministic_ranker` final tie-break `unit_price_czk` → `code` asc; sort-only `PRESTRESS_RANK_PENALTY` (0.15, fíruje jen když dotaz NEžádá předpětí a kandidát ho tvrdí — nikdy gate, netýká se zobrazené confidence). WP1: ceny BYTE-identické, odebrány jen ze sortu; `source` klíč zachován → MCP compat zelená.
- **Watch-1 (cena neprořezává pool):** ověřeno živě — retrieve dropuje work_type:51 / param:7, **cenou 0**.

**Odmítnuto:**
- Sahat na betonové ceny (jen sort signal).
- Přejmenovat `source` klíč (MCP kontrakt).
- Řešit BUGS#6 (prefab vs monolit) v tomto PR — až po Fix 3.

**Otevřené otázky:**
- **Fix 4** je teď obnažený (živý výstup ukazuje reálný 2025/2026 split) — počet řádků keyword vs embeddings store vyžaduje DB-přístup (egress zavřený).

**Co dál:**
1. Live-verified na prod: `OTSKP 2026` na všech výsledcích; golden 334325 (ŽB poz.29) nad 334335 (předpjatý poz.~90); 420324 exact-lookup conf 1.0; Watch-1 zavřen. Q1 reálně uzavřen (merge opravil, ne jen "CI zelená").
2. Fix 4 (rebake otskp → 2026) svázat s migrací Phase 3.

## 2026-06-19 — Session: Fáze 5 #6 — odhad plochy bednění (contact_area) z geometrie, factor 1.0 — MERGED (PR #1399), live-ověřeno (Test 1)

**Spec (audit + advisor-review):** labor-projekce (norma skruž+bednění 3.1 Nh/m² KONTAKTNÍ + doporučení čety tesařů §4-B) klíčuje na `contact_area_m2`, který byl POUZE passthrough `formwork_contact_area_m2`. Na živém kalkulátoru pole pro contact-area NENÍ → norma + doporučení NIKDY nefíruly (jen v goldenech, co ji podávaly ručně, např. SO-202 1527,6). #6 = když není zadána, odvodit z engine plochy `formwork_area_m2` (dvoustranný box `2(L+Š)·výška`, už se derivuje) pro **prismatic + system-formwork** prvky; non-prismatic (mostovka/římsa/schodiště/nádrž/other) + no-formwork (pažnice/podzemní stěna/podkladní beton) zůstávají **honest-blank** (undefined).

**Kalibrace 1.0 (DATA, ne teorie — advisor gate #2):** audit navrhoval one-sided factor 0.5; data ho ODMÍTLA. VP4 FORESTINA opěrná zeď: dokumentováno 547,4 m² (dřík oba líce 2·1,45·156,4=453,6 + patka hrany 93,8) vs box 2(L+W)·H=548,6 → **dvoustranná**. SO-250 = úhlová zárubní ŽB zeď (cantilever) → dvoustranná. Žihle element_breakdown «33,2 = 2×(8,30×2,0) oba líce». Demo-zdi se bední OBA líce → **factor 1.0, žádná mapa sidedness**. Jednostranné (gravitační u skály / tížná) = vzácné, NE v demo-rodinách → chytá se viditelným ODHAD-warningem + ručním zadáním, nikdy se nehádá.

**Implementace (PR #1399, merge `05dce4c`, CI 16/16):** `planner-orchestrator.ts` — `contact_area_source: 'user'|'odhad'` na formwork-výstupu; odvození `contact_area_m2 = fwAreaTotal` když chybí + prismatic + system-formwork (pilota nedosáhne — pile-path early-return; podzemni_stena vyloučena); ℹ️ warning pojmenovává dvoustranný předpoklad (advisor #4). `labor-projection.ts` BEZE ZMĚNY (čte `contact_area_m2`). **Pronájem netknut → stejná plocha pro pronájem i labor → žádný rozpor (advisor #2 vyřešen tím, že factor=1.0).** Žádná circular-import / paralelní struktura.

**Ověřeno (hermetic):** tsc shared clean; frontend aditivně clean (jen pre-existing baseUrl deprecation). **1337 shared testů** (1335→1337, gateb null-test split). Goldeny before→after: `labor-projection.gateb` null-test byl operne_zdi (prismatic)→null; #6 odvodí ODHAD→crew≠null → přepsán na ODHAD-cestu + 'user'-cestu + non-prismatic (deck) honest-blank-null. Nedotčeno (ověřeno): SO-202 (podává contact), PDPS canon-fallback (mostovka=non-prismatic, už honest-blank), project-planner (relativní asserce — obě strany se posunou spolu).

**✅ ŽIVĚ OVĚŘENO (Test 1):** deploy auto-prošel na merge #1399 (kalkulátor-kiosk tahá shared TS na BUILD; Vercel main auto-deploy, žádný deploy-gate → #1399 live na prod kalkulator). Live-check Test 1 (Opěrné zdi 10×0,4×2,0) PROŠEL: ODHAD-warning se zobrazil, contact-area 41,6 m² = `2·(10+0,4)·2,0` = dvoustranný box → **factor 1.0 potvrzen na prod**, klasifikace 100 %. Široký efekt (canon→norma + ODHAD-warning na KAŽDÉM prismatic prvku) je tím u živých uživatelů.

**Odmítnuto:** one-sided factor 0.5 (data vyvrátila); mapa `FORMWORK_SIDEDNESS` (žádná jednostranná rodina v provozu — spekulativní; až vznikne reálná → do `ELEMENT_CATALOG` vedle `recommended_formwork`, NE do element-geometry); UI-badge + MCP-proброс `contact_area_source` TEĎ (warning už viditelný, pole aditivní pod CI; MCP jen pokud demo-cesta pole reálně čte přes MCP — jinak make-work); SDD tři-dok (audit + advisor-odpovědi = spека).

**Co dál:** deploy + live-check #6 ✅ HOTOVO (Test 1) → **#6 plně uzavřen**. Odblokován **Fix 3** (samostatná session) — jedna větev v letu, #6-followup se nezakládá jen kvůli zaměstnání (= druhá větev / make-work).

## 2026-06-18 — Session: OTSKP work-row binding fix — single-source match_catalog + bundling-policy + tagger fixes + floor (SO-206)

**Spec (interview, Full Approach B):** `create_work_breakdown(mode=work_with_catalog)` bindovalo GARBAGE kódy (SO-206 opěry/křídla/základy → zpomalovací prahy, ošetřování trávníků, nádrže, DEMONTÁŽE) přes naivní `otskp_catalog.search(work_description, limit=1)` — slash-label query + 2. matchovací cesta paralelní k `match_catalog`. Fix = oba root-causy: (1) single-source přes `match_catalog`/`find_otskp_code`; (2) čistá kanonická query (work-verb + element-noun, NE slash-label); honest None kde linie není. Doménová vidlice (Alexander, přípravář): OTSKP **vší­vá** bednění+odbednění+ošetřování do beton-položky → deterministic None s důvodem „zahrnuto v betonu dle OTSKP" (RULE conf 1.0, NE floor-„nenalezeno"); jen výztuž samostatně (333365). Catalog-aware policy (ÚRS/RTS = vše zvlášť), NE globální hardcode. Floor kalibrován na datech.

**Audit (před kódem, 50 SO-206 stringů):** Hijack přežil ne kvůli `match_catalog` (dvouosá UWO gate UŽ existuje), ale kvůli TAGGERŮM: (a) genitiv „mostních opěr" → query-family `jine` (v4.34 genitive-suppression) → family-osa MRTVÁ (gate `query_ef==jine` → vždy projde); (b) `DEMONTÁŽE BETONOVÝCH ZÁKLADŮ` → work_type `beton` (substring „beton", `demontáž` chyběl v demolice-rule) → demolice přebila reálný základ-beton; (c) `PŘECHOD DESKY MOSTNÍCH OPĚR` → family `jine` → leak. Skruž skrytá pod `bedneni`.

**Implementace:**
- `catalog_matching.py` WORK_TYPE_RULES: + `osetrovani` (před `beton`), + `demontáž|demontov` → `demolice`, skruž oddělena z `bedneni` do vlastního `skruz` (NK falsework ≠ vší­vané bednění).
- `breakdown.py` `_attach_catalog_codes` přepsán async: single-source přes `find_otskp_code`→`match_catalog` (NE naivní `.search`); `CATALOG_BUNDLING={otskp:{bedneni,osetrovani}}` → bundled work-type = deterministic None+reason; `_canonical_query` = work-verb + element-noun v gramatickém pádu dle work-type (beton→nominativ „mostní opěry"/„základy" = match katalogové nominativní tituly + oživí family-gate; výztuž→genitiv „mostních opěr"/„základů" = match „VÝZTUŽ <gen>"); opěry+křídla = JEDEN košík (`333xx MOSTNÍ OPĚRY A KŘÍDLA`) → stejná query; `OTSKP_CODE_BINDING_FLOOR=0.60` (kalibrováno SO 206 n=1, revize při růstu korpusu).

**Ověřeno (SO-206, 50 řádků):** 30 bundled (bednění/odbednění/ošetřování → None „zahrnuto v betonu") + 20 bound, 0 junk. Bound: opěry/křídla beton→`33311 MOSTNÍ OPĚRY A KŘÍDLA`@0.74–0.82, výztuž→`333365 VÝZTUŽ MOSTNÍCH OPĚR A KŘÍDEL`@0.79; základy beton→`27232 ZÁKLADY ZE ŽELEZOBETONU`@0.63, výztuž→`272364 VÝZTUŽ ZÁKLADŮ`@0.74. Floor gap 0.57│0.63 → 0.60 nerubí žádný správný bind. Testy: `test_catalog_matching` (+3 work-type cases) + `test_stage_gating_policy` (FakeCat floor-robust + nový `test_breakdown_otskp_bundles_formwork_and_curing`) + SO-250 goldeny + `create_work_breakdown` MCP-kontrakt (Tool-7 + AC19) → 63 passed. fastmcp/fastapi není lokálně (debian PyJWT konflikt) → plný MCP-compat v CI; změna aditivní (signatura beze změny, jen +pole `code_status`/`code_note`/`code_confidence`/`code_query`, `work_first` netknutý).

**Odmítnuto:** Globální `bednění→None` hardcode (rozbil by ÚRS + skruž NK) → catalog-aware policy + `skruz` vlastní work-type. Kandidátský family-tagger fix pro přechod-desku (nominativní query + opěry=křídla košík to vyřešily bez sáhnutí do globálního `_classify` = bez W3/golden rizika). Floor-blank slabého základy-výztuž řádku (272364 reálně existuje → byl by skrytý retrieval-miss pod falešným honest-None) → vyřešeno noun-tuningem (genitiv).

**Co dál:** ŽIVÝ check po deploy. Subtype refinement: beton bind padá na `33311 Z DÍLCŮ` (prefabrikát) místo `333313 ZE ŽELEZOBETONU` (monolit) — správná RODINA, špatná varianta (query neříká cast-in-place); follow-up = doplnit nature do beton-query. Single-source `_OTSKP_QUERY_NOUN` → migrovat na `otskp_query_noun_{nom,gen}` pole v `element_types.yaml`. Floor revize při růstu korpusu (n>1).

## 2026-06-17 — Session: BUGS#5(3) — wall klasifikátor single-source (W3↔YAML) + gabion reject

**Spec (interview, postupně):** Fix = **strukturální single-source** (ne minimální keyword-záplata) — W3 klasifikátor čte SDÍLENÝ `element_types.yaml` a matchuje STEJNÝM algoritmem jako TS engine → paritet Python↔TS by construction. Doménová vidlice (Alexander): `opěrná/zárubní/tížná zeď` = monolitický ŽB → `operne_zdi`; `gabionová zeď` = drátokoš, NENÍ beton → **explicit reject** (ne `jine`); gabion v `operne_zdi` = jistý chybný beton-výpočet, horší než `jine`. Výstupní label = **w3_name alias** (ne engine-jména) → MCP-kontrakt stabilní (calculator.py map/allowed-lists, goldeny).

**Audit (před kódem):** Bug byl **W3-only** — `zárubní zeď`→`jine@0.3`, protože W3 `classifier.py` měl HARDCODED `KEYWORD_RULES` (regex) bez `zárub`, zatímco sdílený YAML `operne_zdi.include` `zarubn` UŽ měl (TS to četl, W3 ne = dvojí zdroj = přesně ten drift). `gabionová zeď`→`operna_zed@0.9` na OBOU runtimech + v YAML = živý false-positive beton. `tížn` chyběl v `operne_zdi.include` (jen context-vocab) → TS↔W3 paritní mezera. TS rejecty jdou přes early-exit/head-noun (reject-rodiny SKIPnuté z keyword-loopu, line 695), NE přes skóre.

**Implementace:**
- **YAML doktrína (jediný zdroj):** `operne_zdi.include` − `gabion`/`gabionov`, + `tizn`/`tížn`/`tizna zed` (`zarubn` zůstává); `gabion`/`dratokos` do `reject_materials` mirroru.
- **W3 `classifier.py` přepsán:** hardcoded regex `KEYWORD_RULES` (first-match) → čte YAML + skóruje algoritmem enginu (`matchCount*10 + priority + bridge_boost`, signal-ladder 0.9/≤0.7+candidates, exclude honoring, bridge_remap, w3_name alias). Normalizer (head-noun ALGORITMUS) zůstává kód (TASK_2b). `gabion` = **early-exit** (jako TS shotcrete) → `is_concrete_element=False` + `reject_reason=gabion_non_concrete` (bezpečné i v kompozitu „gabionová opěrná zeď").
- **TS `element-classifier.ts`:** přidán `gabion` reject early-exit (zrcadlo W3); regen kb (`gen:knowledge`) → `operne_zdi` bez gabion, s tížn; drift-guard čistý. `gabion` = early-exit reason na obou (jako shotcrete) — ŽÁDNÝ `gabionova_zed` type_core/keyword (čistá ontologie); jen W3-local `ELEMENT_TYPES['gabionova_zed']` pro reject-profil.

**Konvergenční vedlejší efekt (přiznáno, NUTNÁ pozornost Alexandra při review):** skórer dá `základy` → `zaklady_piliru` (prio 10 > zakladovy_pas 9); normalizer kanonizuje VŠE `základ*` → „základy" → tedy generické základy → `zaklady_piliru` (rebar-hint 100) místo W3-coarse `zaklady` (80). Family-preserving (foundation), hint-level (kalkulátor přepočítává rebar z vlastní matice), **paritet s enginem** (TS čte týž YAML → stejný pick), předdokumentováno jako `zaklady→zaklady_piliru`. 3 goldeny (#66/#69/#69b) přepsány na `zaklady_piliru` (jádro #69 = `is_bridge_context=False` zachováno). NENÍ to wall-bug — vedlejší efekt konvergence; foundation-keyword retuning by sáhl do enginu + plné TS revalidace = samostatná osa, NEbundlováno.

**Ověřeno:** W3 goldeny 17/17 (12 upravených + 5 nových: zárubní→operna_zed, tížn→operna_zed, gabion→reject, masonry→reject, opěrná stable). MCP-compat 4/4 classify asserce ověřeny přímo (fastmcp není lokálně → plný compat v CI; změna aditivní = optional pole). TS shared 1335/1335 (+4 nové) + W3-parity green + shared tsc 0. Regen `gen:knowledge:check` čistý.

**Živá změna (VIDITELNÁ) — keyword-confidence 0.85 → 0.90:** přepsaný W3 přestal hardkódovat plochých `confidence: 0.85` pro KAŽDÝ keyword-zásah (starý `classifier.py:291`) a čte signal-ladder enginu, kde ČISTÝ keyword-zásah = **0.9** (`element-classifier.ts:980` `min(0.9, 0.6+score·0.04)`; ≤0.7 jen na genuine same-score tie). 0.85 byl **W3-only drift** = LLM/Perplexity tier (engine doku: 0.9 keyword > 0.85 Perplexity > 0.70 AI), NE deterministický keyword tier → engine vždy dával 0.9, jen W3 zaostával. Dopad: konzumenti `classify_construction_element.confidence` (recipe passthrough) + exportovaný sloupec **Důvěra** (`soupis_exporter.py:193`) ukážou pro keyword-řádky **90 % místo 85 %**. CI: golden `test_calc_provenance_passthrough.py::test_export_visible_columns_filled_and_source_preserved` pinoval starý 0.85 → aktualizován na 0.90 (`d5d8bf9`); counterfactual worktree-proof = ZELENÝ na čistém main (`52734b4`), ČERVENÝ na `40208ba` ⇒ způsobeno touto změnou, NE preexistující regrese; `test_mcp_golden_so250` 17/17 potvrzuje 0.9 jako systémovou pravdu.

**Odmítnuto:** Drift-guarded dual (2 kopie + storož = pořád duplikace, kterou gejt ruší). Plná engine-jména delegace (mění výstupní slovník + 4 konzumenty = scope bez výhody → samostatný gejt = soul §9 end-state). Scoring reject-rodin na W3 (TS je SKIPuje → early-exit je paritní + bezpečnější). Normalizer context-vocab single-source (`_WALL_CONTENT` vs `wall_vocab` — nezpůsobil bug → samostatná osa).

**Co dál:** ŽIVÝ check po deploy (zárubní/gabion na MCP `classify_construction_element` + kalkulátoru). Foundation `zaklady→zaklady_piliru` — Alexander rozhodne: OK (pier-foundation hint), nebo zúžit `zaklady_piliru.include` (vyřadit bare `zaklady`) = samostatný foundation gejt. Normalizer vocab single-source (follow-up). MCP classify-delegation (engine-jména) = budoucí gejt. Větev `claude/beautiful-ramanujan-g0guev` (reset na squash-merged main po Gate C #1388), force-with-lease push, BUGS#5(3) = nový PR.

## 2026-06-16 — Session: Fáze 5 §4 parity — Gate A + Gate B (advisor = zrcadlo Core) — MERGED

**Cíl §4:** jedno číslo — jeden zdroj; advisory nepočítá své mimo engine. Gaty PO JEDNOM, vlastní větev, STOP do merge (merge = Alexander).

**Gate A — Betonáři: karta čte engine (PR #1384, merge `4d3ce41`).** Karta «Betonáři / záběr» přepočítávala osádku inline `max(3, ceil(tactVol/20))` místo enginu. Reálně se rozcházely — karta ukazovala ŠPATNĚ: operne_zdi 120 m³ a mostovka 664 m³ (1 čerpadlo) → engine **5** (2 ukládka + 2 vibrace + 1 finiš), inline **6**; stena 15 m³ (<20) → 3 v obou. Fix: nový helper `pourCrewRecommended(plan)` = `plan.resources.pour_crew_breakdown.total` (front-capacity z `computePourCrew`, řízení 0 → ZS/VRN); karta čte, inline pryč. BEZ engine-změny (pole už bylo v resources). Hermetic «karta = engine» (3 testy, real planElement). **Živá změna po deploy: karta ukáže 5 místo 6.**

**Gate B — Tesaři: doporučení z enginu, ze stejné normy (PR #1385, merge `1647295`).** Doporučení tesařů bylo frontové pravidlo `0.6 Nh/m² × formwork_area` — vymyšlený duplikát nad reálnou normou enginu. Interview (Alexander): (1) přenést do enginu jako u výztuž; (2) brát REÁLNOU normu enginu, ne 0.6; (3) zobrazit «doporučeno vs zadáno» jako výztuž. Recon: engine UŽ počítá Nh opalubky z `skruz_bedneni_nh_per_m2_kontakt × contact_area` v `buildLaborProjection` (labor-projection.ts:285). Fix: `buildLaborProjection` vrací `formwork_recommended_crew` z TÉHOŽ `totalFwNh` přes rebar-pattern `max(2, min(8, ceil(Nh/(5×shift×K_UTIL))))` — **jedna norma → hodiny I osádka**. Bednění-karta ukazuje amber «Doporučeno N tesařů» (když ≠ crew_size_formwork), jako výztuž; frontové 0.6 odstraněno. Hermetic test (single-Nh + honest-blank).
**KLÍČOVÉ zjištění (premisa upřesněna):** `contact_area_m2` je VOLITELNÝ vstup (`formwork_contact_area_m2`), NIKDY se neodvozuje. Doporučení (a reálná-norma Nh) fíruje JEN když je contact_area zadána; jinak engine počítá hodiny opalubky z rozvrhu (crew×shift×dny, crew-závislé) → `formwork_recommended_crew = null` (**honest-blank, žádné vymyšlené 0.6**). Premisa «engine už počítá Nh» platí jen s contact_area. Rozšíření pokrytí (default `contact_area ← formwork_area`) by posunulo labor-basis mnoha prvků → SAMOSTATNÉ rozhodnutí, NEbundlováno.

**Gate C — caталог opalubky: RUNTIME = NE (rozhodnuto Variant 1, ZAtím NEzačato).** Ingest-skript čte baket `gs://stavagent-cenik-norms/` → generuje katalog-data V REPU → commit; advisor/engine NIKDY nečtou baket v rantajmu; goldeny hermetic; dif cen 2024→2025 se reviduje. Start AŽ po merge Gate B (teď splněno) — plná postavení u Alexandra; audit-before-code, STOP před merge.

**Ověřeno (A+B):** shared 63/63 (goldeny KV/Žalmanov + SO-202/203 + labor-projection + one-element parita); frontend 9/9 (NumInput + pourcrew DOM testy); tsc 0.
**Otevřené hvosty:** ŽIVÝ check kalkulator.stavagent.cz (height živě, betonáři 5 ne 6); resolve 2 Q-bot tredů na #1372 (false positives — rozebráno, nemergovat); backlog: Vercel path-filter na `Monolit-Planner/**` (CI hygiena). Odloženo (vlastní interview): multiplicity-redesign (dvojúrovňový model), katalog typů (Základ/Dřík opěry), Step 4 TZ persistence, Step 5 studio, wizardHint3 one-liner.


## 2026-06-16 — Session: Fáze 5 #1 — NumInput live commit (height stale bug) — MERGED (PR #1372)

**Větev:** `claude/numinput-live-commit-height-stale` → **smergováno do main** (PR #1372, merge-commit `88d7e8a`).

**Phase A (kořen):** `NumInput` (sdílený číselný komponent) commitoval do rodiče JEN na blur — bufroval lokální `draft` a zapisoval `form.*` pouze v `handleBlur`. Dokud bylo pole ve fokusu, na obrazovce nové číslo, ale `form.height_m` drželo předchozí hodnotu → volume-derive, preview-formule i boční tlak četly STAROU výšku až do blur. Reprodukuje «pole 3,0, formule 5×0,75×1,75=6,56». **Samoléčí se na blur** → živý uživatel měl finální výsledek správný; «všechna čísla špatně» z agent-reportu = artefakt psaní bez blur. NE type-change-specific; PR3 nesouvisí.

**Phase B (fix, Option A — Alexander):** `NumInput` teď commituje **živě na onChange** (parsované číslo do rodiče po každém znaku) → volume/preview/boční tlak se aktualizují při psaní. Clamp min/max + empty→fallback přesunuty na **blur** (partial input se nebije mid-type). Lokální `draft` zůstává pro zobrazený text (stabilní kurzor). Prázdný/nevalidní mezistav nepíše smetí (`type=number` posílá `''` pro nevalidní znaky → guard). Decimal-comma normalizace ponechána (inertní pro type=number, browser čárku blokuje sám).

**První frontend test-runner:** vitest + jsdom + @testing-library/react (`vite.config.ts` test blok + `src/test/setup.ts` + `npm test`). `ui.numinput.test.tsx` — 6 DOM commit-timing testů. jest-dom matchers záměrně neimportovány (clash s touto verzí vitest; testy plain matchery).

**Ověřeno:** 6/6 frontend testů; frontend tsc 0; shared goldeny (KV/Žalmanov validation-rules, SO-202/203) + one-element parita 37/37.

**PENDING (po deploy):** ŽIVÁ kontrola na kalkulator.stavagent.cz — psát V u 3 prvků po sobě → objem každého se mění při psaní a je správný bez odchodu z pole. Manuální (AI nemá browser na deployed SPA).
**Zjištění k §4-parity frontě (audit, samostatná fronta — NEopravováno):** karta Betonáři recountuje `max(3, ceil(V/20))` inline místo engine `pour_crew_breakdown`; tesař-doporučení je frontend `0.6 Nh/m²` (výztuž je engine `recommended_crew`); katalog bednění je hardcoded TS (2024 DOKA/PERI), GCS bucket `gs://stavagent-cenik-norms/` se na této cestě NEČTE.


## 2026-06-15 — Session: Fáze 5 Step 3 PR1+PR2 (legacy/dead-field cleanup) — MERGED (PR #1363), čeká live-check

**Větev:** `claude/phase5-steps1-2-handoff-p0og0u` → **smergováno do main jako jeden celek (PR #1363, merge-commit)** po uzavření gate (grep-proof + CI green). Step 1 #1353 + Step 2 #1357 už v main.

**Pre-implementation interview (Step 3):** (1) **Hybrid** — truly-dead smazat fyzicky (grep-důkaz), half-wired redirect čtenáře/zapisovatele na live path PAK smazat; (2) degradace (soft-degradation class) → **samostatný Step 3.5**, ne teď; (3) **po jednom poli / malé skupině na PR** (review po PR, merge jako celek).
**Granice čištění (upřesnil Alexander):** ne grep-«dosáhne motoru», ale «část systému 3 cenových režimů NEBO náhodný přišelec». `price_crane`/`price_pump` = přišelci (náklad patří do TOV); nosná cenová pole NEsahat.

**PR1 — čistý dead-code:** smazány `price_crane_czk_shift` + `price_pump_czk_h` (přišelci, sbírány v sidebaru, nikdy v buildInput/advisoru) + `tact_volume_m3_override` (orphan FormState pole, 0 čtenářů/zapisovatelů; stejnojmenné `input.tact_volume_m3_override` z manual_zabery netknuto).

**PR2 — orphan + entangled redirect + bugfix:**
- smazán orphan `CalculatorWizard.tsx` (692 ř., 0 importérů — mrtvý paralelní wizard s vlastním tact_mode tab UI);
- **advisor redirect na live dilataci**: `has_dilatacni_spary`/`spara_spacing_m` v payloadu teď z `has_dilatation_joints`/`dilatation_spacing_m` (backend klíče nezměněny → advisor-prompt/suggestFormwork/num_sets reasonují nad AKTUÁLNÍ daty, ne stale);
- **FIX silent tact-loss**: WizardHints `onApplyRecommendedSystem` psal mrtvý `num_tacts_override` (buildInput ignoroval → ztráta) → teď mapuje doporučené N = TOTAL záběry na live model přes shared helper `tactsPerSectionForRecommendedTotal(N, sections)` = `tacts_per_section = ceil(N/sections)` (sekce>1) / `N` (1 sekce);
- smazána FormState pole `tact_mode`/`has_dilatacni_spary`/`spara_spacing_m`/`num_tacts_override` + typ `TactMode` (0 code-refs, tsc-ověřeno); shared `PlannerInput.*` stejnojmenná pole (z manual_zabery) netknuta;
- nový shared helper `calculators/tact-mapping.ts` + 5 testů (N invariant). shared **1322**, frontend tsc clean, CI green všechny kódové commity.

**Přeřazeno (NEsmazáno — recon premisa «5 truly-dead» chybná pro 3/5; KEEP):** `rebar_norm_kg_m3` (živý dual-input → odvozuje `rebar_mass_kg`), `include_kridla`/`kridla_height_m` (renderují `kridlaFormwork` kartu). Nejsou přišelci.

**§0 cen:** předchozí flag «Monolit-Planner/CLAUDE.md §0 neexistuje» **VYŘEŠEN** — §0 doplněn na main (entry níže), v merge sloučeno.

**STATUS:** **MERGED (PR #1363) jako jeden celek.** **PR2 NENÍ done**, dokud neproběhne **live-check na kalkulator.stavagent.cz** (po Cloud Build/Vercel deploy): advisor reaguje na živou dilataci (ne stale); «apply recommended system» aplikuje takty jednou (žádný dvojí počet); sekce=3 → advisor doporučuje jako součet vs reálně aplikováno (overshoot do N = OK, jen poznamenat). **Live-check je manuální (interaktivní SPA) — dělá Alexander** (AI nemá browser na deployed app). PENDING stejného zaběhu: #1351 tz_facts flag ve Varování + Step 2 geometrie.
**Dál:** **PR3** = low-risk cleanup (2 duplicitní smart-defaults efekty `useCalculator.ts:244-264` + `:712-738`; fyzický dedup duplicitních length-polí) — **samostatná větev, na review** → **multiplicity-redesign NE pod freeze, po 06-21, vlastní interview** → **Step 3.5** degradation. **Freeze** (Cemex demo 06-28) otevírá **06-21**.

**Multiplicity-redesign — vstup ZAFIXOVÁN (Alexander 2026-06-15):** model je **DVOJÚROVŇOVÝ**, ne plochý list. `pozice (1 řádek smety, 1 souhrn) └ list elementů (typ+počet+geometrie→objem) └ záběry/takty elementu (max = bottleneck)`. Smeta vidí JEN souhrn pozice; rozpad žije uvnitř. Fronta: 1 pozice + **vrátit ruční výběr podtypu** (jak bývalo) + vnitřní «rozpad na elementy», do tabulky jde součet. MCP/agent: počítá element po elementu a sčítá (plná detailizace v MCP path; smeta per-element řádky nedrží). Klíč: UI dnes míchá DVĚ osy do bratrských kontrolů — (1) které elementy tvoří pozici, (2) jak se element lije po záběrech — proto `num_identical_elements` ⊥ `num_dilatation_sections` ⊥ `manual_zabery` nesedí (plochý zápis dvojúrovňové reality). Fundament: Step-1 project-carrier (list elementů v engine) obsluhuje OBA surface → redizajn = hlavně re-exprese na frontě + obnova ručního podtypu, ne nový engine. **PIN do interview:** dohledat KONKRÉTNÍ removed/refactored kontrol «ruční výběr podtypu jak bývalo» (přesná obnova, ne rekonstrukce naslepo).


## 2026-06-15 — Session (krátká): zachycení cenové architektury (3 režimy) před Step 3

Alexander z paměti rekonstruoval **architekturu cen kalkulátoru = TŘI režimy**, kterou
recon-mapa NEVIDĚLA (záměr žije v polích UI, ne explicitně v kódu). Bez zápisu by Step 3
mohl smazat cenové pole jako „mrtvý kód".

**Tři režimy (slot „default + override + vypínač", NE prázdný slot):**
1. sazby/mzdy předvyplněné (min. 100) + override → rychlá kalkulace s penězi;
2. vlastní sazby → přesný výpočet pro firmu;
3. zaškrtávátko „bez cen" → jen normohodiny + dny pronájmu (normogram zdrojů), peníze
   se nepočítají. **MCP výstup = režim 3.** Firma s libovolnými sazbami obsloužena.

**Důsledek pro Step 3 (legacy cleanup):** hranice čistky NENÍ „dojde do enginu/grep",
ALE „součást systému tří režimů cen NEBO náhodný přišelec". NOSNÁ pole (sekce Ceny,
cenová pole bednění, sazby/mzdy) = NEsahat. `price_crane_czk_shift`/`price_pump_czk_h`
= přišelci (Alexander: patří do TOV-rozpadu) → smazat z kalkulátoru + založit do TOV.
Zapsáno: `Monolit-Planner/CLAUDE.md §0` + handoff `docs/handoff/2026-06-14_phase5-step3-next-session.md`.

**Pauza:** Step 1+2 v main (zelené). Step 3 (PR2 half-wired tact + mazání z boevého
výpočtu = NEJrizikovější) čeká na novou session s čerstvou hlavou. Freeze 21., runway
týden. Live check #1351 + Step 2 na webu = PENDING po deploy.


## 2026-06-14 — Session (pokračování): Fáze 5 Step 1 + Step 2 (calculator one-element → projekt)

**Smergováno do main (Alexander):**
- **#1353 Step 1 — planProject() project-wrapper** (interview: Path A / nezávisle+suma /
  nový vstup, planElement netknut). Projekt = list elementů, prožene každý NEZMĚNĚNÝM
  planElement, agreguje objem/Nh/peníze/rozvrh (sekvenční suma, null=NEPOČÍTÁNO),
  honest-blank (padlý element → elements_uncalculated, parciální suma). Paritní test
  planProject([x]) ≡ planElement(x).
- **#1357 Step 2 — geometrie↔takty, shared geom rule** (interview: rozšířit na všechny
  prizmatické / honest-blank non-prismatic / geom v shared / additive). Nový
  `element-geometry.ts` (estimateElementVolume L·W·H + 2(L+W)·H; honest-blank pro
  deck/pile/cornice/stairs/tank/other). `planElement.deriveGeometryInput()` additive:
  derive objem/plochu + unifikace length→total_length_m, **NO-OP při zadaném objemu**
  (`if(hasVolume) return input;`) → paritu i goldeny nehýbe. PlannerInput.length_m/width_m.
  MCP length_m passthrough (§4 parity). Frontend: shared fn jako jediný zdroj, blok D×Š×V
  rozšířen ~7→všechny prizmatické + viditelný honest-blank. 1317 shared tests; goldeny
  KV+Žalmanov+normy drží; parita drží; MCP compat 29/29.

**Ověřeno na dotaz Alexandra:** mostovku Step 2 NEdělí na 6 taktů — je non-prismatic +
vždy má objem z VV → deriveGeometryInput je no-op; num_tacts logika netknuta (KV golden
1 takt, Žalmanov 3 takty drží). Amazon Q bot review (#1357) = HALUCINACE: tvrdil inverted
`validationResult.success` (0 výskytů) + `eval()` v calculator.py (0 výskytů) — navržená
oprava by soubor ROZBILA, NEaplikovat.

**Backlog konsolidace (zadáno Alexandrem):** tři nálezy sloučeny do JEDNÉ třídy v
CLAUDE.md — **engine soft-degradation na neúplném/nulovém povinném vstupu**: (a)
podkladni_beton rebar=0 throw, (b) mostovka bez height → MULTIFLEX místo Top 50, (c)
non-prismatic volume=0 crash po honest-blank warningu. Doménově porušení honest-blank na
úrovni výpočtu → chybí povinný vstup ⇒ prvek NEPOČÍTÁNO + přeskočit v agregaci
(planProject už umí), ne spadnout. Léčit jako třídu. Rozhodnutí Step 3 vs samostatný
Step 3.5 padne na interview Step 3 — NEopravovat předtím.

**Fáze 5 maršrut:** Step 1 ✅ · Step 2 ✅ · **Step 3 = legacy/dead-field cleanup
(NEJrizikovější — mazání polí z boevého výpočtu + rozhodnutí o léčbě degradace) — NOVÁ
SESSION, ne ocas maratonu** · Step 4 TZ persistence v project.json · Step 5 studio.

**Otevřené hvosty (živé, po deploy):** LIVE check #1351 (tz_facts flag ve Varování) +
Step 2 (geometrie→objem/takty) na kalkulator.stavagent.cz — PENDING, netvrdit hotové.

Handoff pro Step 3: `docs/handoff/2026-06-14_phase5-step3-next-session.md`.



## 2026-06-13 — Session: Živá napojení Part B/C + Faze 5 Step 1 (project-wrapper)

**Smergováno do main (4 PR):**
- **#1351 tz_facts wiring** — provod extraktoru do validation rule. Frontend
  `buildInput` staví `tz_facts.construction` z `tzText` (auto), předvyplní
  radio Technologie jen když prázdné (tz_facts oddělený kanál, nepřepisuje
  vstup → flag fíruje). MCP `calculate_concrete_works` + 4 optional params
  (tz_technology/tz_pour_stages/tz_quote/tz_anchor) → tz_facts. MCP compat
  28/28. **Part B/C tím přestala být test-only — flag dojde do živé Varování
  card i do Claude.ai/ChatGPT.** ⚠️ LIVE check na kalkulator.stavagent.cz po
  deploy = PENDING (netvrdit hotové, dokud neproběhne na webu).
- **#1352 recon-mapa polí** (docs-only) — rentgen kalkulátoru před Fází 5.
  `docs/audits/calculator_field_map/2026-06-13_recon.md`. ROOT po kódu:
  `planElement(input: PlannerInput)` = jeden element/volání; v PlannerInput
  není pole elementů → agregace projektu strukturálně nemožná. + geometrie
  ↔takty rozpojené (~7/23 typů má geom), 3 nekompatibilní mechanismy
  množnosti, legacy tact-pole polu-zapojená, mrtvá pole (price_*, kridla).
- **#1353 Faze 5 Step 1 — planProject() project-wrapper** (interview:
  Path A / nezávisle+suma / nový vstup, planElement netknut). Nový
  `shared/.../project-planner.ts`: `planProject(elements[])` prožene každý
  element NEZMĚNĚNÝM `planElement`, agreguje objem/Nh (canon
  buildLaborProjection)/peníze/rozvrh (sekvenční SUMA, null=NEPOČÍTÁNO),
  honest-blank (padlý element izolován + počítán jako Nevypočtených N,
  parciální suma). Paritní test: planProject([x]).elements[0].plan ≡
  planElement(x). 1309 shared tests; goldens drží. Engine core byte-identical.

**Faze 5 maršrut (5 kroků, každý PR + STOP gate, merge = Alexander):**
Step 1 ✅ smergován. Step 2 = geometrie↔takty na úrovni elementu (interview
příště: rozšířit geom pokrytí z ~7/23 nebo honest-blank na zbytku). Step 3
legacy cleanup, Step 4 TZ persistence v project.json, Step 5 studio.

**Otevřené hvosty:** LIVE check #1351 (po deploy); MULTIFLEX bez height +
podkladni_beton rebar=0 throw (backlog, Step 3 je podebere); Patterns 51-55
(samostatný batch, mimo Fázi 5).



## 2026-06-13 — Session: tz_facts napojení (živá fíčura Part B/C, úzký PR)

**Scope (potvrzeno Alexandrem):** úzký provod tz_facts — extraktor (hotový)
→ tz_facts → planElement + MCP forward. JEN provod, ŽÁDNÉ jiné pole formuláře,
ŽÁDNÁ agregace, ŽÁDNÉ nové pole. Recon-mapa polí = SAMOSTATNÉ další zadání.

**Interview (3 otázky):** (1) tz_facts AUTO z textu TZ (bez kliků); (2) radio
Technologie předvyplnit JEN když prázdné, tz_facts h
hold ODDĚLENĚ jako zdroj
srovnání (přepis radia = vstup vždy ≡ TZ → flag nikdy nefíruje, proto oddělený
kanál); (3) MCP forward v tomto PR.

**Hotovo:**
- Frontend `useCalculator.buildInput`: z `tzText` zavolá
  `extractConstructionTechnology`, postaví `input.tz_facts.construction`
  (technology + pour_stages_count + quote + anchor), VŽDY předá do enginu.
  NEpřepisuje `form.construction_technology` (vstupní strana). + effect:
  předvyplní radio Technologie z TZ JEN když prázdné (ruční volbu netrhá →
  vědomá odchylka stále fíruje flag).
- MCP `calculate_concrete_works` + `_build_planner_payload`: nové optional
  params `tz_technology` / `tz_pour_stages` / `tz_quote` / `tz_anchor` →
  `payload.tz_facts.construction`. Flag teď funguje i pro Claude.ai/ChatGPT.
- MCP compat test: vstup mss + 12 taktů vs TZ pevná skruž / 3 etapy → flag
  (oba fasety), plán dál vzniká (ne gate). Replay fixture +1 → MCP compat
  **28/28**. Frontend tsc + vite build clean; shared beze změny (1304).

**Důsledek:** validation rule + Žalmanov flag teď DOJDOU do živé Varování
card (frontend) i do MCP — fíčura Part B/C je v produkci AKTIVNÍ (dříve
test-only). Live ověření na kalkulator.stavagent.cz po deploy zůstává
PENDING (backlog) — netvrdím hotové, dokud neproběhne na webu.

**Mimo scope (potvrzeno):** recon-mapa polí kalkulátoru (agregace elementů,
vazba geometrie ↔ takty) = další samostatné zadání.



## 2026-06-13 — Session: Part C (finál Fáze 1) — regex-extrakce technologie + Žalmanov golden (STOP gate)

**Interview (před kódem, zodpovězeno Alexandrem):** Q1 zdroj-autorita = jako
KV (soupis XC4 DI-009 = množství ÷2/most, TZ = technologie/materiál/geometrie,
výkresy = rozměry); Q2 num_tacts pro 3 nestejné etapy 32/44.5/32 — stávající
`tact_volumes[3]` STAČÍ (per-záběr v4.0), engine se netrhá, dokumentován
známý dluh scheduleru (max(tact_volumes) bottleneck); Q3 multi-bridge =
pravidlo etalonu §5i (golden modeluje 1 podobjekt, num_bridges nezadáno,
VV÷2), engine se nemění.

**Hotovo (deliverable A — code, testováno):** `extractConstructionTechnology()`
v `tz-text-extractor.ts` — regex čte `construction_technology`
(pevná skruž/MSS/letmá) + `pour_stages_count` z prózy TZ; sentence-level
count guard + dopravní past („Most bude budován po etapách… dopravy" = NE
takty) ošetřena dvojitě (doprava-guard + chybějící count token u „po etapách").
Cílové fráze z obou digestů: Žalmanov §4.1.6 „ve třech etapách"→3, KV §7.2
„v jednom taktu"→1, §6.11.3 „v jedné etapě"→1. `extractFromText` surfacuje
oba jako ExtractedParams. +9 hermetic testů → **1303 shared tests** (1294→1303),
tsc clean.

**Hotovo (source-of-truth):** soupis DI-009 je úsekový (SO 101…491, ne
per-SO!) — SO-202 vyčleněn přes pod-strom `<stavDil ~SO 202~N>`. Authoritative
VV (oba mosty, ÷2/most): NK trámová předpjatá C40/50 **2697.941 m³ →
1348.97/most** (potvrzuje odhad 1349 dočasné fixtury ✓); plošné založení
ŽB C30/37 867.1 m³ (NE piloty — rozdíl od KV ✓); opěry+křídla 557.9; pilíře
C40/50 361.4; římsy 266.3; přechodové desky 81.9; výztuž per položka. Golden
MD draft `test-data/tz/SO-202_D6_OV_Z_Zalmanov_golden_test.md` (inputy s plným
provenance, výstupy enginu PENDING).

**End-to-end smoke (NEfixováno):** NK 3 takty [397.85, 553.26, 397.85],
num_tacts=3, technologie=TZ → validation rule bez flagu (čisto). FINDING:
bez height_m selektor vrací MULTIFLEX místo falsework Top 50 (engine/selektor,
mimo scope — zaznamenáno).

**STOP gate (čeká na Alexandra, NEmergováno):** NK subtype (dvoutrám/vícetrám),
potvrzení tact_volumes 32/44.5/32 proti výkresu, NK exposure, dohledání lan
Y1860, height_m NK. Po odpovědích → snímek VŠECH pozic + fix assertions +
náhrada dočasné Žalmanov fixtury. Self-merge calc/golden zakázán.

**Dodatek (2026-06-13, oprava záměny mostů + dořešení vstupů Žalmanov):**
Alexander upozornil, že dřívější příčný řez (trám 2400 / š. 13650, „osou
uložení") = **Žalmanov [výkres 202_17]**, kdežto řez trám 1100 / š. 10250
(stěny KARLOVY VARY/PRAHA, „dvoutrámová … z dodatečně předpjatého betonu")
= **KV**. KV-golden trám-výšku neobsahoval → dopsán provenance (trám 1100,
koncový příčník 950, š. 10.25 `[výkres KV příčný řez NK]`), assertions
nezměněny. Žalmanov vstupy dořešeny Z JEHO dokumentů (NEdědit z KV):
✅ subtype dvoutrám, trám 2400 nad podporou, š. 13.65 `[výkres 202_17]`;
✅ NK exposure **C35/45-XF2** (XF2+XD1+XC4) `[TZ §2]` — moje dřívější C40/50
byl VV kód-pásmo „DO C40/50" (**Pattern 53** trap), reálná marka C35/45;
✅ předpínací lana **41.42 t/most** `[VV 422373: 82.84 ÷2]` (nalezeno ve VV).
Σ tact_volumes 1348.96 ≈ VV÷2 ✓; Pattern 52 sanity L/48.8 v koridoru ✓.
**Otevřené (zdroj nečitelný textem, NEhádám):** profil výšky trámu
(konstant/náběh → tact_volumes) + height_m nad terénem (→ výběr skruže).
**2 enginové findings do backlogu:** mostovka bez height → MULTIFLEX místo
Top 50; `podkladni_beton` rebar=0 → throw. Golden MD draft přepsán
(provenance na každém vstupu). Stále NEmergováno, fixtura nenahrazena.

**Dodatek 2 (2026-06-13, výkresy od Alexandra → Part C UZAVŘEN):** Alexander
poslal výkresy NK (202_17 TvarNK, 202_18 Předpětí + KV D-01-02-01_18/19/20).
Čteny VIZUÁLNĚ (Pattern 39). Oba PENDING vyřešeny Z VÝKRESŮ:
✅ trám **konstantní 2400** (202_17: nad pilířem 2400 = v poli 2400) → vol ∝ délka;
✅ height_m **10.6 m** (202_04: pilíř VPRAVO 10600; terén/dno ~664, soffit ~677
→ ~13 m nad dnem) → engine vrací Top 50 falsework ✓.
**KRITICKÁ korekce:** výkres 202_18 SCHÉMA PŘEDPĚTÍ ukazuje **takty betonáže
43.25/44.25/23.0 m** (spáry ZA pilíři), což NEROVNÁ se rozpětím polí 32/44.5/32
z task spec! tact_volumes přepočteny ∝ délka taktu × konstantní 2400 →
**[527.99, 540.20, 280.78]**, Σ = 1348.97 = VV÷2 ✓. Výkres 202_18 navíc
POTVRZUJE lana (1 most 41.42 t / 2 mosty 82.84) + NK beton 35/45-XF2 (materiály).
Snímek VŠECH pozic živým enginem zafixován (NK Top 50/curing 9/186 d; spodní
stavba Frami/TRIO/VARIO; flag NONE — vstup ≡ TZ). **Dočasná Žalmanov fixtura
NAHRAZENA plným goldenem** v validation-rules.test.ts (3 etapy → clean;
deviation 1 takt → flag; Σ tact_volumes kontrola). 1304 shared tests. KV golden
trám 1100 dopsán jako provenance [výkres KV]. PR vytvořen — **merge = Alexander**.
Findings (MULTIFLEX, podkladni rebar=0) v backlogu. **Part C hotov = Fáze 1 finál.**

**Dodatek 3 (2026-06-13, lekce + honest frontend/MCP status):**
- **Pattern 39 lekce pro budoucí goldeny:** zdroj «schéma předpětí 202_18»
  (TAKT 43.25/44.25/23.0, spáry ZA pilíři v zóně malých momentů) se ukázal
  SILNĚJŠÍ než text zadání («32+44.5+32» = rozpětí, ne takty). Vizuální
  čtení výkresu chytlo tichou chybu distribuce, kterou by text neodhalil.
  Alexander potvrdil. Trojitá shoda exposure/lana (TZ §2 + VV + 202_18) +
  uzavření obou PENDING ZDROJEM, ne analogií. **Regola: u golden taktů/objemů
  výkres (schéma předpětí / podélný řez) > text zadání > analogie sesterského
  mostu.**
- **HONEST status validation rule (Part B/C) v produkci:** ověřeno grepem —
  `tz_facts` NENÍ napojen ve frontendu (`frontend/src` 0 výskytů) ANI
  forwardován v MCP (`calculator.py` 0 výskytů). Frontend má pole
  `construction_technology` (radio), ale NESTAVÍ `tz_facts` z extraktoru a
  neposílá ho do `planElement`. Důsledek: validation rule + Žalmanov flag
  jsou pokryty VÝHRADNĚ hermetic shared testy; v živém frontendu/MCP rule
  MLČÍ (po dizajnu «no docs → silent»), tj. fíčura zatím v produkci NEAKTIVNÍ
  dokud se `tz_facts` nenapojí. NEoznačeno jako hotové. Part C deliverable A
  (regex extraktor) běží, ale jeho výstup (construction_technology +
  pour_stages_count) zatím nikdo nemapuje do `tz_facts`.
- **#1348 advisor/MCP polish:** žádná živá kontrola na kalkulator.stavagent.cz
  po deploy — jen Jest 60 + MCP compat 27. Zůstává otevřený P0.


## 2026-06-12 — Session: Part B — validation rule «vstup kalkulátoru vs technologie z TZ»

**Rozhodnuto (interview Alexander před kódem):**
- Q1 (nosič TZ-faktu): kanonické pole technologie v extraction NEEXISTUJE
  (ověřeno: TS tz-text-extractor ani W3 extract_tz_fields technologii
  neextrahují) → varianta «bez extraktoru»: additive `PlannerInput.tz_facts`
  (typ `TzFacts` — technology / pour_stages_count / quote / anchor);
  regex-extrakce technologie = Part C. Extraction kontrakt NEZMĚNĚN.
- Q2 (povrch): flag = ⚠️ řádek do existujícího `plan.warnings[]` (renderuje
  stávající banner bez frontend práce) + strukturní sibling
  `plan.validation_flags?: ValidationFlag[]` zrcadlící pattern
  `resource_violations`. Frontend render = Fáze 4, NE scope.
- Q3 (registr): minimální seznam, ne framework —
  `shared/src/calculators/validation-rules.ts`: `ValidationFlag` {rule_id,
  severity warning|hint, message (1 řádek CZ s emoji prefixem), tz_value,
  tz_quote, tz_anchor, input_value} + `ValidationRule` {rule_id, run(ctx)}
  + `VALIDATION_RULES` list + `runValidationRules(ctx)`. Batch Patterns
  51–55 po Part C jen pushne do seznamu.
- Pravidlo `tz_construction_consistency` (generic, ne jen mosty): dva
  fasety — technology mismatch + pour-stage-count mismatch (proti
  engine-resolved `pour_decision.num_tacts`). Rozpor = VIDITELNÝ FLAG,
  nikdy gate — doménová opora přímo v Žalmanov TZ §4.1.6: «Postup výstavby
  může budoucí zhotovitel upravit dle svých možností a potřeb»; flag
  jednou větou proговаривает důsledky (přepočet statiky stadií, u
  předpjatých spojky kabelů, nový TePř). Shoda = ticho; neznámá
  dokumentace = ticho (no guess). Wired v OBOU assembly paths
  (main §8c + pile mirror).
- **TZ facts digesty (addendum Alexandra):** verbatim formulace technologie
  s kotvami (sekce + strana) extrahovány z obou TZ PDF a uloženy vedle PDF
  jako vždy-čitelné md: `test-data/SO_202_D6_KV_OV/D-01-02-01_01_tz_facts.md`
  (KV: §6.11.3 str. 32 «v jedné etapě na pevné skruži»; §7.2 str. 34
  «betonáž NK na pevné skruži v jednom taktu») +
  `test-data/SO_202_D6_OV_Z/202_01_TechnickaZprava_tz_facts.md` (Žalmanov:
  §4.1.6 str. 11 «na pevné skruži ve třech etapách», směr O1→O4; §5.1
  str. 15). Zdroj citací pro fixtury Part B + cílové fráze pro regex Part C.
- Testy (hermetic, bez AI/network): 12 nových v `validation-rules.test.ts`
  — unit registr (ticho bez faktů / bez fasetů / engine-auto vstup; mismatch
  taktů s quote+anchor+oběma hodnotami; mismatch technologie; čistá shoda)
  + KV engine-integrated (1 takt → čisto; 6 taktů → flag §7.2 v obou
  površích, plán dál vzniká = flag není gate) + Žalmanov DOČASNÁ fixtura
  (1 takt → flag §4.1.6; 3 etapy → čisto; Part C nahradí plným goldenem)
  + negativ (bez tz_facts → pravidlo mlčí). **1294 shared tests** (1282
  + 12), tsc shared + frontend clean.

**Odmítnuto:**
- Rozšíření tz-text-extractoru o regex technologie v Part B — fixtury
  kryjí verified facts, extraktor patří Part C.
- Blokace/gate při rozporu — proti doméně (zhotovitel smí stavět jinak).
- Framework pro pravidla — seznam + jeden interface stačí.

**Otevřené otázky:**
- STOP gate Part B: schválení → PR. Merge = pouze Alexander.

**Co dál:** po approve PR Part B → Part C (plný Žalmanov golden, regex
extrakce technologie, náhrada dočasné fixtury).

**Dodatek (stejný den, po merge PR #1347 — service polish round):**
- **MCP `calculate_concrete_works` — 3 tiše ztracená pole opravena:** `width_m`,
  `formwork_length_bm`, `cycle_length_bm` byly v signatuře + docstringu, ale
  `_build_planner_payload` je zahazoval (regrese SSOT delegace #1304 vs
  pre-SSOT lokální engine). Překlad na kanonická pole: width→`nk_width_m`
  (mostovka) / `formwork_area_m2` odhad (V/tl. horizontal, V/š×2 vertical,
  vzorec identický s pre-SSOT); length_bm→`formwork_area_m2` (bm systémy
  konzumují area input jako množství v jednotce systému);
  length+cycle→`num_tacts_override` (římsa, ceil(L/cyklus)). Replay fixture
  přegenerována lokálním `planElement` (týž SSOT kód); římsa 156 bm / 26 →
  6 záběrů asserted. MCP compat suite 25→27 testů, 27/27 green.
- **AI advisor — hlavní seam bug:** frontend posílá obohacená pole UVNITŘ
  `calculator_context`, backend je destrukturoval z TOP-LEVEL body → sekce
  MOSTNÍ NK / PŘEDPĚTÍ / JIŽ SPOČÍTÁNO ENGINE nikdy nefiraly z reálného
  frontendu. Fix: merge `{...calculator_context, ...req.body}` (top-level
  vyhrává; staří volači beze změny). Advisor = zrcadlo orchestratoru:
  computed_results rozšířeny (pour_mode, pour_hours_per_tact,
  pumps_required, formwork system, top-6 warnings vč. validation flags),
  prompt builder je vypisuje + nové pravidlo «nastav recommended_tacts a
  pour_mode na STEJNÉ hodnoty»; frontend contradiction guard přepíše AI
  takty na engine hodnotu + viditelná poznámka (nikdy tichý override).
  Robustnější JSON extrakce (přímý parse → outermost-brace slice);
  fallback render už nemrzačí čárky v prozě. Backend Jest 58→60.
- Security review diffu: 0 nálezů (oba top kandidáty — body merge a LLM
  JSON parse — trasovány end-to-end, žádný nový sink).



## 2026-06-12 — Session: SO-202 KV kalibrace — potvrzené normy jako data (pokračování)

**Rozhodnuto:**
- Čtyři potvrzené normy z interview aplikovány jako **DATA se zdrojem**
  `[normy potvrzené Alexander, 2026-06]` v novém modulu
  `Monolit-Planner/shared/src/calculators/labor-norms.ts` (per konvence
  tasku — ne konstanty ve formulích): armování **18 Nh/t** · předpětí
  **35 Nh/t lan Y1860** · skruž+bednění **3.1 Nh/m² KONTAKTNÍ plochy** ·
  betonáž **crew-model** (KOREKCE dle světových referencí, provenance
  [Caltrans Deck Constr. Manual Table 1.1; method statement 40–45 m³/h
  finishing-governed; potvrzeno Alexander]: JEDEN finiš-front, 2 čerpadla
  ho krmí a NEnásobí četу; 12 os. on site = Caltrans T1.1 11 + 1 záloha,
  strojníci čerpadel externí; tempo 40–45 m³/h finishing-governed →
  16.3 h střed; rotace > 12 h druhou směnou 12 os., headcount konstantní
  → Nh se nedubluje).
- Projekce (`buildLaborProjection`) konzumuje normy s **canon-fallbackem**,
  když báze chybí; nový field `LaborOperationProjection.norm_source` nese
  provenance per operace. Betonáž crew-model gated na engine
  `pumps_required ≥ 2` (mega-pour), žádný nový threshold.
- Dva additive vstupy protaženy enginem (POUZE echo, harmonogram nedotčen):
  `formwork_contact_area_m2` (SO-202: 1 527.6 [CN SAFE 26-027C]) +
  `prestress_strand_mass_kg` (19 210 [VV 422373 ÷ 2]).
- §5f-Nh přesnímkováno z živého enginu: armování 1 872.0 · předpětí 672.4 ·
  betonáž 156.6 (0.23 Nh/m³ ✓ koridor 0.2–0.3) · skruž+bednění 4 735.5
  (≈ 4 736 ✓) · ošetřování 36.0 → **CELKEM 7 472.5 Nh / 9 340.6 h /
  10.78 Nh/m³** (koridor 8–12 ✓, očekávání ~10.8 trefeno). Fáze-check:
  betonáž-fáze 1.6 d × 10 h = 16 h ≈ modelová zálivka 16.3 h — drží.
  **Harmonogram nehnut: 77.5 d / curing 9 / prestress 13** (hermetic
  assertion plan-s-normami ≡ plan-bez-norem).
- Testy: +11 (hermetic per norma vč. fallbacků + schedule-invariant +
  Caltrans-breakdown integrity, golden koridor §5f-Nh, legacy pilota canon)
  → **1282 shared tests**, tsc shared + frontend clean.

**Odmítnuto:**
- Normy jako konstanty přímo ve formulích projekce — proti konvenci tasku;
  data module s provenance per záznam.
- Betonáž crew-model univerzálně (i 1-pump malé prvky) — 24 os. na patku je
  nesmysl; gate = engine pumps_required ≥ pump_lines.
- První interpretace «12/linku × 2 čerpadla = 24 os., tandem 30–40 m³/h»
  — superseded světovými referencemi (Caltrans T1.1 + method statement):
  čerpadla krmí JEDEN finiš-front a četу nenásobí; armádu kreslit nelze,
  lidé jsou omezený zdroj. Betonáž byla nadhodnocena 2.4× (380.4 → 156.6).

**Otevřené otázky:**
- STOP gate B: schválení snapshotu → PR. (PR se nevytváří před approve.)

**Co dál:** po approve PR; pak Part B/C golden recalibration dle plánu.

## 2026-06-11 — Session: SO-202 KV kalibrace — ošetřování betonu = max(span, curing_days)

**Rozhodnuto:**
- STOP gate A nález z PR #1336 (§5f-Nh ⚠️) VYŘEŠEN rozhodnutím Alexandra:
  `labor-projection.ts` počítá dny ošetřování jako **max(span fáze zrání ze
  scheduleru, curing_days)** — scheduler-fáze zrání v tact_details má pro
  PDPS 1 takt komprimovaný span 1.5 d, zatímco `curing_days` = 9 (třída 4
  @15 °C); ošetřovatel je na stavbě po celou dobu zrání. SO-202 KV: 1.5 d /
  6 Nh → **9 d / 36 Nh**; CELKEM §5f-Nh 3 576.6 → **3 606.6 Nh** (4 508.3 h
  přítomnost, 5.20 Nh/m³). U multi-takt elementů kalendářní span legitimně
  přesahuje curing_days — max() jej zachovává.
- Golden MD §5f-Nh tabulka aktualizována na engine-snapshot (verified live
  run), ⚠️ poznámka nahrazena ✅ resolved záznamem.
- Testy: golden assertion v `golden-so202.test.ts` §5f-Nh (9 d → 36 Nh +
  regression guard ≥36) + hermetic test v `labor-projection.test.ts`
  (days ≥ curing_days, kánon formule). **1271 shared tests** (1269 + 2),
  tsc clean.
- Větev vedena od čerstvého main (#1336 verifikováno na main přes diff —
  byte-identické, vč. STOP-gate commitů; Pattern 12 check OK). Stará větev
  `claude/bold-hawking-v2e7b4` (orphan #1332) ne-force-pushnuta — merge main.

**Odmítnuto:**
- Báze dnů «vždy přesně curing_days» (ignorovat span) — u multi-takt
  elementů by zahodila překrývající se kalendářní periodu > curing_days.
- Oprava v `aggregateScheduleDays` (formulas.ts) — agg.zrani je korektní
  calendar-span pro Gantt/Aplikovat; podhodnocení je specifikum projekce
  ošetřovatele, fix patří do labor-projection (per §5f-Nh kandidát).

**Otevřené otázky:**
- Vnitřní dluh scheduleru (komprimovaný zrání-span 1.5 d v tact_details,
  příbuzný 220.5/307.8 + wait⊂zrání overlap) — samostatný task, nezměněno.

- Kodifikační batch (docs-only, samostatný PR): **Patterns 51–57** zapsány
  do `docs/STAVAGENT_PATTERNS.md` + po řádku do CLAUDE.md backlogu.
  Implementace 51–55 ODLOŽENA na jeden „physics validation rules" batch
  PO Part C (na Part B post-extraction cross-check infra — společný seam);
  56 při Fáze 3 crew/cost recon; 57 = průběžná provenance disciplína.
  Zapsat pattern ≠ implementovat pravidlo — kodifikace hned dokud je
  čerstvá, kód až na svou vrstvu konvejeru.

**Co dál:** Part B/C golden recalibration dle plánu (Žalmanov multi-takt
etalon → odstranění §5f-SYN syntetiky); po Part C physics-rules batch
(Patterns 51–55).

## 2026-06-11 — Session: Classifier Kiosk Full Fix — Phase 1b (embeddings infra + OTSKP 2026 ingestion)

**Rozhodnuto / shipped (branch `claude/upbeat-dirac-krnyqi`, code-only — ops na deploy):**
- **Embedding model revize:** gecko@003 **RETIRED 2025-05-24** + repo má jen vertexai
  (removed 2026-06-24, migrace na google-genai) → interim **text-multilingual-embedding-002
  @768** (native, drop-in na current vertexai API, no new dep), gemini-embedding-001@768 =
  post-migrace upgrade (stejný dim → žádné re-dimenzování pgvector). `EMBEDDING_MODEL/
  EMBEDDING_DIM/OTSKP_CATALOG_VERSION/CATALOG_GCS_BUCKET` v config.py.
- `vertex_embeddings.py` přepsán (sync, ADC, task_type, output_dimensionality, import-safe).
- Alembic `2026_06_11_otskp_embeddings_pgvector` (head=orch_sg_pr3b_audit): `CREATE EXTENSION
  vector` + `otskp_embeddings(... embedding vector(EMBEDDING_DIM))` HNSW cosine.
- `app/services/catalog_embeddings.py`: pgvector provider (degrade-to-keyword on error) +
  `register_embeddings_provider()` → wire do `catalog_matching._EMBEDDINGS_PROVIDER`.
- `scripts/ingest_otskp_catalog.py`: GCS SFDI XML → otskp.db (+ `--index` pgvector). XML
  necommitovat (žije v GCS). Pure `parse_otskp_xml` testovaný.
- `tests/test_catalog_embeddings.py` (8 hermetic). **Celkem 27 hermetic green** (1a+1b).
- otskp.py docstring: "17,904" + "(1.0 for database match)" → honest, version-stamped.

**Data Store otázka (catalogs/ exclusion) — ANSWER:** norms bucket `stavagent-cenik-norms`
je whole-bucket console-sync, žádný prefix-filter → `catalogs/` by znečistil RAG korpus.
**Doporučení (v config): separátní bucket `gs://stavagent-catalogs`.** Fallback: gcsSource
restrict na `B[3567]/` (console-only, fragile).

**Odmítnuto / deferred:** live GCS upload + indexing (deploy) · learned-mappings Core table +
human-confirm-0.99 (acceptance #11, Phase 3 s kiosk-migrací) · local ÚRS-2018 fallback
0.60–0.65 + "ověřit proti aktuálnímu katalogu" UI flag (acceptance #12, Phase 3) · Phase 2
docstring example-code fix.

**Co dál:** CI potvrdit (MCP compat — lokálně chybí fastmcp — + goldeny SO250/SO202). STOP
před merge (Alexander). Runbook: recon doc §8.4.


## 2026-06-11 — Session: Classifier Kiosk Full Fix — Phase 1a (deterministic chain + honest confidence)

**Rozhodnuto / shipped (branch `claude/upbeat-dirac-krnyqi`):**
- Nový `concrete-agent/.../app/services/catalog_matching.py` — Work-First chain:
  work-type axis (`classify_work_type`) + element-family axis (reuse `_classify`) →
  **UWO gate** (`passes_uwo_gate`) → **param prefilter** (concrete_class) → **honest
  confidence** (keyword ≤0.9, embeddings 0.70–0.80, NIKDY 1.0 zde) → **pluggable
  ranking seam** (`rank` + audit `input/output_codes`, replayable, deterministic
  default) → carrier (candidates+confidence+provenance). Embeddings retrieve seam
  `_EMBEDDINGS_PROVIDER` (module-global, monkeypatchovatelný — ne function param,
  FastMCP CallableSchema pravidlo).
- `find_otskp_code` fulltext větev přepojena přes chain; **hardcoded 1.0 na DB-hit
  pryč**; exact code lookup zůstává 1.0 (verified DB row). Contract `results`/
  `total_found`/fields zachován (compat-safe; compat test neasserovala 1.0).
- `tests/test_catalog_matching.py` — **19 hermetic testů green** (AC 1,2,3,4,6,7 +
  e2e přes find_otskp_code s fake katalogem). Fix: `predpinaci` pravidlo PŘED
  `vyztuz` (předpínací výztuž = jiný OTSKP basket než B500).

**Před-kód korekce (user):** gecko@003 **RETIRED 2025-05-24** → gemini-embedding-001
@768 / pgvector cosine / `EMBEDDING_DIM` const (migrace AŽ po verifikaci modelu).
Learned-mappings → Core, human-confirm 0.99 only (no AI auto-learn, acceptance #11).
Local ÚRS ~39K → Core fallback nebo web-only do auditu (acceptance #12).

**Odmítnuto / deferred:** Phase 1b (vertex_embeddings rewrite + pgvector Alembic
migrace 768-dim + index 17 904 OTSKP + provider wire do seamu + learned-mappings
table) = další commit na téže větvi. MCP compat suite lokálně neběží (chybí
`fastmcp` — Debian PyJWT blokuje install) → potvrdit na CI.

**Co dál:** Phase 1b infra za seamem → full pytest + verbatim CI log na HEAD fáze →
STOP před merge. Phase 2: fix docstring example `113472111` (malformed 9-digit).


## 2026-06-11 — Session: Classifier Kiosk Full Fix — Phase 0 recon (READ-ONLY)

**Rozhodnuto (§2 pre-impl interview):**
- Merge timing: **každou fázi po готовности CI** (ne post-Cemex hold), ale honor
  freeze window — fáze musí landnout před ~21.06 nebo staging-only poté.
- Vector index: **pgvector v Cloud SQL** (concrete-agent DB), reuse nepoužitý
  `app/integrations/vertex_embeddings.py` (gecko@003, 768-dim).
- Kiosk matching engine: **migrovat teď na Core/MCP** (Phase 3 dělá kiosk skutečně
  tenkým — nahradí lokální matching stack voláními Core).
- Dead subsystémy: **nechat subsystem 3** (už je Core-proxy = seam pro migraci),
  **odstranit jen subsystem 4** (role-debate / 6-rolový orchestrator + conflictResolver).

**Zjištěno (recon, 3 paralelní Explore agenti):**
- §1.2 потврзено přesně: `find_otskp_code` (`app/mcp/tools/otskp.py`) = plochý substring
  search + `confidence=1.0` hardcoded na každý DB-hit (l.186/~210); žádný UWO gate;
  žádný param prefilter. `create_work_breakdown` už defaultuje `work_first` (Pattern 15).
- NOVÉ: kiosk URS_MATCHER NENÍ tenký UI — má vlastní plný matching stack (lokální
  SQLite ~39K ÚRS, 4-fázový LLM batch pipeline, otskpCatalogService, perplexityClient,
  learned-mappings KB) + plný 6-rolový orchestrator (NE 3 role z tasku). Subsystem 3
  už proxy do Core (`documentExtractionService.js`). DebugCollector v tomto kiosku
  NEEXISTUJE → je to nová věc pro Phase 3.
- Vertex: `vertex_embeddings.py` existuje ale je nepoužitý scaffolding. Žádný pgvector
  dnes (PG15 + Alembic + Czech FTS). ⚠️ `textembedding-gecko@003` je legacy model —
  ověřit lifecycle před Phase 1.

**Odmítnuto / out of scope:** reranker model (P6, jen seam) · Vertex RAG · DACH
adaptéry · calculator element-classifier (net-touch) · cross-user isolation (P0 jinde)
· pricing/TOV/AI-quantities.

**Otevřené otázky:** UI placement «разбивка» (samostatná záložka kiosku vs Registry/
Portal) — neforcováno v interview, vyřešit v Phase 3 design proposalu. Ověřit validní
náhradu schema-example kódu `113472111` (Phase 2). Ověřit gecko@003 lifecycle.

**Co dál:** STOP gate. Čeká na go-ahead (Alexander) pro Phase 1 (Core: UWO gate +
pgvector embeddings retrieve + param prefilter + pluggable ranking seam + honest
confidence). Report: `docs/audits/classifier_kiosk_fullfix/2026-06-11_phase0_recon.md`.


## 2026-06-11 — Session: GCP cost-аудит + пачка А (триггеры/Cloud Build) + пачка Б №3 (Redis retirement) — EXECUTED

**Rozhodnuto:**
- **Cost-аудит** (`docs/audits/cost_audit/2026-06-10_gcp_cost_audit.md`, PR #1331):
  6.3k Kč/мес разложено до причин; адресуемо ~4.2k. H1 ✅ (Redis
  `stavagent-mcp-rate-limit` BASIC 1GB = только DCR-limiter; VPC-коннектор
  e2-micro min=2 — только ради Redis), H2 ✅ (E2_HIGHCPU_8 вне free tier +
  live-триггеры без includedFiles: ~2 400 билдов/мес, ~80 % платные
  guard-cancel'ы), H3 ✅ concrete min=1/6Gi (MinerU чист). Цель ~1.5–2.2k.
- **Пачка А исполнена:** триггеры пересозданы с includedFiles (docs-пуш = 0
  билдов; runbook #1332 + hotfixes #1335/#1338/#1339), все 6 cloudbuild-yaml
  на default-пул (#1333, 2 500 free мин/мес). **Три инцидента за день, все
  пойманы гейтами, ни один не повторился** — verified can/cannot-таблица в
  `triggers_reimport_runbook.md`: `location` режется на import; update-через-
  import мёртв; `beta export` = describe-мусор; legacy-SA создаётся, но убивает
  каждый билд; без SA — INVALID_ARGUMENT на create (grandfather у старых);
  канон = delete → import репо-yaml с user-managed **compute-SA**.
- **Пачка Б №3 исполнена до конца (шаги 1–5):** DCR rate-limiter Redis → Postgres
  atomic UPSERT (миграция 013, PR #1337; fail-closed сохранён, rollback-гигиена
  shared-коннекта, 21+4 goldens verbatim в CI: 487 passed); monolit-кэш →
  in-memory fallback. Smoke #1 и #2 зелёные (DCR-проба `400×10 → 429` на проде
  ДО и ПОСЛЕ снятия env; боевые тулзы через claude.ai-коннектор; логи чистые).
  Шаг 3: ревизия 00405-ls8 без REDIS_URL/коннектора; шаг 5: **Memorystore
  `stavagent-mcp-rate-limit` + `stavagent-vpc-connector` СНЕСЕНЫ** →
  **−1 349 Kč/мес**, класс багов «деплой снёс REDIS_URL» закрыт навсегда.
  Гигиена: `_REDIS_URL`/`_VPC_CONNECTOR`-блоки выпилены из cloudbuild-concrete
  (этим же PR).

**Odmítnuto:**
- Upstash как замена Memorystore — новый вендор в auth-пути против ethos.
- Перебор update-пути import'а после двух INVALID_ARGUMENT — переключились на
  проверенный CREATE-путь вместо третьего эксперимента.
- Ужимать 6Gi/убирать keep-alive — не cost-драйверы (аудит §6).

**Otevřené otázky:**
- 🔐 **Ротация пароля `stavagent_portal`** — засветился в чат-логе сессии
  11.06 (`gcloud sql users set-password` + 4 DSN-секрета + редеплой потребителей).
- Пачка Б №4: concrete `min-instances` 1→0 (~1.0–1.3k Kč/мес) — **отложено
  решением Александра 11.06 («оставим пока как есть»)**; если вернёмся —
  gated-задача с замером cold-start.
- Биллинг-верификация через ~3 суток: строки Memorystore/Compute Engine → 0,
  Cloud Build ↓; SKU-разрез (аудит §7 п.6) — опционально.
- Мёртвый Redis-код (`app/core/redis_client.py`, `session.py`, Celery-таски) —
  hygiene-задача без приоритета; runbook §6 NB: redis-deps в requirements.txt
  пока остаются (импорты живы в неиспользуемых модулях).

**Co dál:** мониторинг первого триггерного concrete-билда после этого PR
(WARN-строк больше нет по построению) → №4 по go → биллинг-чек.
## 2026-06-11 — Session: Golden recalibration SO-202 KV — Part A (PDPS 1 takt + provenance)

**Rozhodnuto:**
- Golden §5f SO-202 KV překalibrován na PDPS: TZ §7.2 «betonáž NK na pevné skruži
  v jednom taktu» / §6.11.3 «v jedné etapě». Vstup: 693.35 m³ (VV 422336: 1 386.700
  oba mosty ÷ 2), C35/45 XF2 třída 4, dvoutram, 12 kabelů one_sided,
  `working_joints_allowed: 'no'` (legitimní 1-takt páka kontraktu),
  `rebar_mass_kg: 104000` (VV 422365 ÷ 2 — VV vyhrává nad engine heuristikou
  100 kg/m³ pro předpjatou NK). Dřívější 605 m³ = odhad, superseded.
- Engine snapshot (kandidátní goldens, fixace po STOP gate A): num_tacts=1,
  4+1 čerpadel (MEGA zálivka ≥500 NEBLOKUJE — warnings + resource-ceiling ⛔),
  curing 21 d (≥9 floor tř. 4), prestress 25 d (wait 21 + 2 + 2), skruž 46 d,
  total 89.5 prac. d/most, Top 50 + Staxo 40.
- Interview: starý 6-takt case = SYNTETIKA («NOT PDPS») do merge Žalmanov goldenu
  (Part C); pak smazat. Permissions: test-data deny zúžen per-extension
  (md/txt čitelné, PDF/XML/XLSX/JSON/images dál zavřené). Part A z čerstvého main
  PO merge seam-fix #1334.
- Provenance konvence v golden MD: každé číslo `[TZ §X]` / `[VV pos. N]` / `[odhad]`
  (retrospektivně: §5a–5e objemy elementů označeny [odhad]).
- Relabel (hodnoty NEZMĚNĚNY — synthetic probes, ne PDPS-pravda): engine.parity
  (SSOT kotvy pro Python replay fixtures — změna hodnot = re-capture
  concrete-agent fixtures), engine.test, planner-advisor, capture_ssot_fixtures,
  labor-projection.test (multi-takt tvar záměrný — overlapy/zrání overlay
  vyžadují >1 takt). MCP docstring calculator.py opraven: 605→693.35 + «1 tact
  per span»→«jeden takt celé NK» (text-only, bez MCP compat dopadu).
  TASK_Orchestrator_WorkOntology_SO202 čísla 605→693.35.
- Engine nesoulad ZAZNAMENÁN, neřešen (exclusion): multi-bridge větev orchestrátoru
  (`num_bridges:2`) dělí volume_m3 jako součet obou mostů, MCP docstring tvrdí
  per-bridge vstup. Golden proto modeluje 1 most bez num_bridges.

**Odmítnuto:** změna kontraktu kalkulátoru; re-capture Python fixtures (probe
hodnoty stačí relabelovat); oprava volume-geometry warning heuristiky (očekávaný
output, dvoutram eq-thickness — warning je v goldenů zachycen).

**Otevřené otázky:** task uvádí «6 polí 15+5×20+15» — aritmeticky 7 hodnot/130 m;
repo-doložené je 15+4×20+15 = 110 m ≈ NK 111.5 (použito). Confirm na STOP gate A.

**STOP gate A rozhodnutí (Alexander, 2026-06-11) — aplikováno v témže PR (#1336):**
- Rozpětí potvrzeno 15+4×20+15 (výkres 18 Tvar NK; TZ §2.1 «5×20» = překlep,
  správně §6.5.1) — v goldenů zaznamenán vnitřní rozpor TZ.
- «21 d pryč»: sezónní skruž floor ČSN 73 6244 se na PŘEDPJATOU mostovku
  neaplikuje (gate odskružení = po napnutí, TZ §6.5.2; tržně CN SAFE 8 d).
  Engine změna (orchestrator): `skruzSeasonalFloorApplies` guard + props
  hold = curing + prestress pro předpjatou NK. Snapshot v2: curing 9 d,
  prestress 13 d (wait 9+2+2), skruž post-pour 22 d, total 89.5 → 77.5 d.
  Residuál (zaznamenán): wait⊂zrání sekvenčně (22 d vs PDPS-min ~11 / CN 8) —
  scheduler debt, samostatně.
- Nh-snímek (vlastní výkon, kánon ×0.8): celkem 3 576.6 Nh / 5.16 Nh/m³
  (armování 892.8 / předpětí 520 / betonáž 51.2 / skruž+bednění 2 106.6 /
  ošetřování 6 ⚠️). Nález: scheduler curing-fáze span 1.5 d vs curing_days 9
  → ošetřování podhodnoceno; kandidát fix v labor-projection
  (days=max(span,curing_days)) — čeká rozhodnutí, neměněno mlčky.
- CN SAFE 26-027C (19.02.2026) ověřeno z PDF, zapsáno jako srovnávací
  fixtura §5h: Meccano 1 527.6 m²/most (rozvinutá 13.7 m ≠ plocha NK
  1 209.775 [TZ §2.1]), POLY 5 838.3 m³/most, harmonogram 114/97 d
  (+10 rozebrání predmontáže), rekapitulace 15 608 460 Kč. Model = VŽDY
  vlastní výkon; CN = externí cena pro srovnání, ne vstup enginu.
- Semantika 2 mostů (PRINCIP, implementace Part C): SO202 = objekt, LM/PM =
  podobjekty s plnou sadou elementů; VV ÷ 2; sekvenční harmonogram se
  sdílenou sadou skruže — uzavírá num_bridges recon-nesoulad.

**Co dál:** merge PR #1336 → Part B (TZ-consistency validation rule)
→ Part C (Žalmanov golden, docs v test-data/SO_202_D6_OV_Z/).

## 2026-06-10 — Session: Monolit seam-fix — единый источник сводки (čel-časy, harmonogram, KPI)

**Rozhodnuto:**
- Recon (tentýž den, STOP gate) potvrdil: kalkulátor (`CalculatorResult`) a sводná Monolit
  (`FlatKPIPanel`/`FlatGantt`/`ElementBlock`/exporter) počítaly čas a člověkohodiny NEZÁVISLE
  (326.7 d vs 622.8 d vs ~357 d; 7 862 / 14 092 / 14 952 h na SO-202 mostovce 605 m³).
- Seam-fix (branch `claude/bold-hawking-v2e7b4`): nový shared modul
  `shared/src/calculators/labor-projection.ts` — JEDINÝ zdroj: `buildScheduleProjection(plan)`
  (total + reálné fáze s překryvy, tvar `schedule_info.phases` který mrtvá větev FlatGantt/exporter
  už očekávala) + `buildLaborProjection(plan)` (kanonické normohodiny ×0.8 per operace, včetně
  viditelné podstroky **ošetřování betonu** 1 os.×5 h/den; přítomnost = ÷0.8). `K_UTIL=0.8` canon.
- Domain decisions (Alexander, fixní): normohodina = lidé×směna×0.8×dny (kánon, normy+termíny);
  přítomnost = ÷0.8; **peníze VŽDY z přítomnosti** (směna 10 h placená celá); zrání = kalendářní
  span/overlay, nikdy sekvenční sčítanec; KPI «Čas» = total enginu, bez harmonogramu →
  `NEPOČÍTÁNO`; peněžní vzorec (KROS÷burn) NIKDY jako druhý "čas" — přesunut do **«Krytí mezd»**
  (budget-months ÷ plan-months, semafor ≥1 zelená / <1 červená, oba vstupy v tooltip).
- Writers: Aplikovat zapisuje plnou projekci (`useCalculator` → `buildScheduleProjection`;
  `buildWorkDrafts` čte `buildLaborProjection` — TOV `normHours`=kánon, `hours`=přítomnost,
  `totalCost`=přítomnost×sazba; `buildPileWorkDrafts` sloučen do projection-driven builderu).
- Readers: FlatGantt fáze z projekce + roll-up = Σ element totals (zrání overlay
  `--zrani` třída); FlatKPIPanel «Čas» z `schedule_total_days` (+ `Nevypočtených` badge,
  mixed projekt = částečná suma — interview answer), «Krytí mezd» v Náklady kartě;
  `calculateHeaderKPI` + `summarizeScheduleProjections` v shared/formulas; Celk.hod buňka
  zobrazuje kánon z TOV; exporter.js «Doba realizace (harmonogram)» + «Krytí mezd» řádek
  (interview: exporter v scope).
- AC na SO-202: všechny tři view = **326.7 d** (bylo 622.8/357); jedno kanonické číslo
  **14 681.6 Nh** / 18 352 h přítomnost (tři čísla zanikla); hermetic suite
  `labor-projection.test.ts` 13 testů. **1262 shared** (1249+13) + 58 backend Jest + tsc + vite OK.

**Odmítnuto:**
- Přenos `planElement` do Core (samostatný budoucí krok). Oprava interního dluhu 220.5 vs 307.8 d
  (Souhrn «Dní» nyní zobrazuje projection-days; engine sub-results nezměněny). Změna KROS/cen.

**Otevřené otázky:**
- Starý nerouted `KPIPanel.tsx`/`MainApp` stále ukazuje peněžní `estimated_months` jako čas —
  mimo routing, mimo scope. `costs.total_labor_czk` zahrnuje props_labor a UI «Celkem práce»
  přičítá propsLabor znovu (pre-existing, recon poznámka) — samostatný cleanup.

**Co dál:** STOP gate — merge dělá Alexander po review PR.

## 2026-06-10 — Session: Live-seal blockers (#1327) + ŽIVÁ PEČEŤ front-half PASSED

**ŽIVÁ PEČEŤ — PASSED.** Po merge #1327 + deploy Alexander zopakoval runbook
(`docs/specs/doc_to_quantified_elements/e2e_runbook.md`): **1 passed, 19.32 s**,
proti deployed stacku (Cloud Run + Cloud SQL + Portal JWT + živý Monolit),
reálný **SO-202 XML soupis** (`E_Soupis praci_XC4_DI-009.xml`) + TZ text,
**BEZ caller-supplied `elements`**. P3-residual UZAVŘEN — front-half
(dokumenty → join → quantified elements[] → kalkulace → deliverable) je
zapečetěn end-to-end živě. Plán design → P1 #1321 → P2 #1322 → P3 #1323 →
Gap A #1324 → blockers #1327 → pečeť: KOMPLET.

**MERGED do main (#1327, 409d8f1c) — tři prod-defekty z PRVNÍ živé pečeti (+ čtvrtý latentní z reconu):**
- **Part A (б-zero):** provisioning psaný pro PŘEDPOKLÁDANÉ vlastní UUID schéma users/projects
  500koval proti reálné Portal-tabulce (id INTEGER, bez status) — `UndefinedColumn` →
  `DatatypeMismatch`. Recon: provisioned řádky NIKDO nečte (existovaly jen kvůli FK
  `orchestrator_sessions`), a orchestrátorové tabulky žádná migrace nevytvářela (jen CI fixture
  přes create_all — 4. vrstva: `UndefinedTable` by byla další). Fix: migrace
  `012_orchestrator_tables.sql` (sessions + audit + append-only trigger, **plain indexed UUID
  user_id/project_id, ŽÁDNÉ FK** — konvence audit-tabulky); FK v ORM modelu odstraněny;
  `ensure_user/project_provisioned` SMAZÁNY — **orchestrátor nikdy nezapisuje do Portal-owned
  tabulek**. Izolace beze změny (app-level principal-vs-session compare).
- **Part B:** deploy-config nese `JWT_SECRET=JWT_SECRET:latest` (byl manual-only, každý deploy
  ho smetl → „JWT auth is not configured") + substituce `_REDIS_URL`/`_VPC_CONNECTOR`
  (hodnoty plní Alexander v triggeru; empty-safe omission přes bash-step — žádný tichý
  ''-overwrite). Ruční restore-ritual mrtvý.
- **Part C:** `_CRITICAL_SCHEMA` rozšířeno o obě orchestrátorové tabulky — drift schématu =
  `SchemaDriftError` na startu (Cloud Run drží předchozí revizi), ne 500 na živém requestu.
- **Goldens** (`test_live_seal_portal_schema.py`, DB-gated, scratch schema): fixture replikuje
  POZOROVANÝ prod-tvar (integer-id users BEZ status) — negativně ověřeno, že reprodukuje oba
  prod-errory doslova. JWT submit+resume projde s **0 zápisy do users**; audit + append-only
  trigger fungují; drift-check projde na 012 a hlasitě padá s názvem sloupce po jeho dropnutí.
  Lokálně ověřeno proti reálnému PG16 (3/3 goldens + 8/8 pr3b endpoint testů); CI na finálním
  HEAD `8662188f`: 483 passed.

**Vestigiální ALTER (zaznamenat, nezapomenout):** `users.status` v prod DB `stavagent_portal` —
ruční `ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`
provedený 2026-06-10 během debuggingu první pečeti. Po б-zero ho orchestrátor **NEPOUŽÍVÁ**
(žádné zápisy do Portal users) — sloupec je vestigiální a neškodný; tabulku vlastní Portal,
případné odstranění je rozhodnutí Portal-strany, ne concrete-agenta.

**Rozhodnuto:**
- **б-zero** (interview): žádná principal-tabulka, žádné FK na Portal users/projects, provisioning
  odstraněn — nic výsledek provisioning nečte, FK na integer-id Portal users není ani vyjádřitelný.
- Deploy-env: JWT hned (secret-ref existuje), REDIS/VPC přes trigger-substituce (hodnoty nejsou v repu).
- Drift-chování: fail-fast reuse existujícího mechanismu (SchemaDriftError → rollback revize).

**Odmítnuto:** (а) adaptace provisioning na Portal-schéma (zápisy do ŽIVÉ Portal users tabulky na
každý JWT request + UUID→integer mapping); (б-table) vlastní principal-tabulka (nikdo by ji nečetl).

**Co dál:** Gap B — šum element-listu v `extract_tz_fields` (6 čistých bullets + ~31 prose-fragmentů
na reálné TZ; geometry-path je čistá, nesahat). Pečeť prošla i s šumem (čisté bullets dostaly objemy),
ale kvalita quantification se Gap B výrazně zvedne. Samostatná gated-úloha.

## 2026-06-09 — Session: doc→quantified-elements front-half (P1+P2+P3 shipped) + scoped validation + Gap A

**Rozhodnuto:**
- Front-half "documents → quantified elements[]" zaveden po fázích (design-first → gated PRs):
  **P1 #1321** pure soupis→element join (`soupis_quantity_join.py`) + TS-mirrored volume-geometry
  cross-check (`volume_geometry.py`, pin B — parity-guard parsuje `element-classifier.ts`).
  **P2 #1322** wiring do `DOCUMENT_ANALYSIS` (`recipe_runner._document_analysis_step` volá
  `extract_tz_fields` + `parse_construction_budget` → join → cache `elements[]` +
  `quantification_summary`; `_atomize_step` fallback na `options['elements']`); divergence jede do
  deliverable jako **ingest** warning (`origin:"ingest:soupis_vs_geometry"`, NE v `calc_warnings`).
  **P3 #1323** env-gated live e2e (`test_p3_live_e2e_orchestrate.py`, skip-by-default, NENÍ CI gate)
  + runbook `docs/specs/doc_to_quantified_elements/e2e_runbook.md`.
- **Scoped validace na reálném SO-202** (real parsers + P1 join, bez serveru) odhalila 2 upstream díry,
  které offline goldeny (čisté fixtury) maskovaly. Join sám robustní (honest-blank, no fabrication,
  čisté bullety dostaly reálné objemy Opěry→949.6 / Římsy→632.2).
- **Gap A FIX (PR #1324, MERGED):** `parse_construction_budget` mis-routoval **XML soupis** do xlsx/zip-readeru
  → `BadZipFile` → tichá 0. Fix: deterministický `_detect_file_kind` (content-sniff `PK`/`<?xml` +
  extension fallback) **uvnitř tulu** → XML dispatch do existujícího `KROSParser` → normalizace přes
  **sdílený `_normalize_items`** (žádný fork). **Honest-error** na neznámém formátu (ne tichá 0).
  Golden na **reálném SO-202 XML** (corpus-gated): tul vrací 3373 pozic / 1217 m³; join na čistých
  bulletech → reálné objemy. xlsx path beze změny; KROSParser nezměněn. CI na finálním HEAD `7a3bbdcc`: 480 passed / 3 skipped, 6/6 Gap-A testů PASSED (oba corpus-gated na reálném XML).

**Odmítnuto:**
- Dumpnout divergenci do `calc_warnings` (maskovalo by se jako calc — proto sibling `quantification_warnings`).
- Měnit KROSParser / P1 join / xlsx-path (fungují); psát nový parsing (jen dispatch + reuse).

**Otevřené otázky / residual:**
- **Live e2e NIKDY neproběhl** proti živému stacku (Postgres+Monolit+JWT) — runbook napsán, neexekuován;
  pečeť u Alexandra. Spuštěn dnes proti reálnému SO-202 by **selhal** kvůli Gap A/B.
- **Gap B (TZ element-list noise):** `extract_tz_fields` vrací na reálném TZ 37 "elementů" (6 reálných
  bulletů + 31 prózních fragmentů) → garbage match + ambiguity. **Další task, ne teď.** Geometrie čistá.

**Co dál:**
- Gap A merged → deployed live-invokace aktualizována na reálný XML soupis (env-var `STAGEGATING_E2E_SOUPIS_XLSX` přijímá XML path — jméno historické); pečeť dělá Alexander proti deployed stacku. Gap B (TZ element-list noise) — po pečeti.
- Deferred (design §7): non-beton field mapping, non-monolit width, CATALOG_BINDING/PRICING, in-flow reconciler.

## 2026-06-08 — Session: Calc-output + confidence passthrough to deliverable (gated, additive, PR #1319)

**Rozhodnuto:**
- Navazuje na pipeline-state recon (`docs/audits/pipeline_state_recon/2026-06-08…`),
  který našel šev: recipe spustí kalkulátor, ale jeho `PlannerOutput` **zahodí**
  (drží jen pár jmen klíčů) a na témže švu **dropne classification confidence**.
  Hirurgická gated-taska, **additive**, kalkulátor (SSOT delegace do Monolitu)
  **netknut**. Pre-implementation interview (AskUserQuestion) PŘED kódem — 5 bodů
  odsouhlaseno + 3 doplňky uživatele (Q1/Q3/Q4) zapracovány.
- **Work-item kontrakt (1× v `breakdown.py`):** stamp `classification_confidence`
  + `classification_source` tam, kde klasifikace řídí item; **rezervované sloty**
  `otskp_code`/`unit_price_czk`/`total_price_czk` = None (CATALOG_BINDING/PRICING
  naplní stejné klíče později); `calc`=None + `calc_status="not_calculated"` +
  `calc_warnings=[]` jako **explicitní honest-blank** (Q3 — stav, ne chybějící pole).
- **recipe_runner `_atomize_step`:** kurátorovaný **calc subset** (resource
  quantities + schedule metrics `total_days`/`num_tacts`/`resources`) + warnings se
  přenese na work-items počítaného prvku (deck); plný provenance-tagged
  `PlannerOutput` → `calc_metadata` v step metadatech (`_source` = `calculator:<el>
  ← monolit_planner_api`, Q1/AC3 replay-grounded); engine error → honest-blank
  (žádná vymyšlená čísla). Přenesené číslo nese `_source` (AC3) jako prácová provenance.
- **export.py:** plní **existující viditelné** sloupce KROS soupisu `Důvěra` ←
  classification confidence (reálný skalár) + `Zdroj` ← calc-status-aware label;
  honest-blank řádek dostává explicitní **`NEPOČÍTÁNO`** marker (Q4 — vizuálně
  odlišný, soupis nevypadá kompletní tam, kde se nepočítalo). Bohatší calc čísla +
  agregované warnings → metadata odpovědi (`calc_summary`/`calc_warnings`), NE do
  KROS sloupců. `_source` work→template + source_map + grounding-gate beze změny.
- **Golden (hermetic, offline):** `test_calc_provenance_passthrough.py` mockuje
  Monolit odpověď na delegačním švu (`monolit_delegate._http_post` → `fake_post`,
  sentinel `total_days=1234`; neznámá cesta → `raise AssertionError`, tj. živá
  služba by FAILnula, neskipla) — 8 testů. Wired do `test-mcp-compatibility.yml`.
- **CI důkaz na finálním HEAD `ac01cdd2`** (MCP-Compatibility job 80175537633,
  success): všech 8 passthrough goldenů **PASSED** (ne skip), registrace tulů
  **nepoškozena** (`test_mcp_server_imports` + `test_all_tools_registered` +
  `test_no_unexpected_tools` PASSED; zero-registration-diff vůči main), 2 flipnuté
  policy-testy PASSED (+ zpevněn vacuous-pass). Souhrn `455 passed, 2 skipped`.
- **Merged jako PR #1319 (squash → `a7df366f`)** — Pattern 12 orphan (obsah na main,
  větvové commity orphaned). HEAD před mergem srovnán na CI-verified `ac01cdd2`
  (drop docs-only §9 commitu z větve, ať se nemerguje neověřený HEAD; soul.md je
  mimo CI-trigger-paths → §9 jde post-merge separátně, jako celou sezónu).

**Odmítnuto:**
- Změna kalkulátoru / jeho kontraktu / Monolit delegace (jen se přestal zahazovat výstup).
- Front-půlka (dokumenty → elements) — příští taska. CATALOG_BINDING/PRICING zůstávají
  no-op (jen rezervované sloty). Reconciler v potoku. Celý `PlannerOutput` na řádek
  (kurátorovaný subset + plný v metadatech). Single composite confidence (separátní pole).

**Otevřené otázky / Residual:**
- Kalkulátor v recipe běží zatím **jen pro deck** (mostovkova_deska) — ostatní prvky
  honest-blank. Rozšíření na víc prvků = navazující taska.
- `Zdroj` label volí classification_source; doménově možná chtít čistší cz štítek
  (kalkulátor/StavAgent) — drobnost, neřešeno.

**Co dál:**
- Front-half (extract → quantified elements feed) + propagace calc na víc prvků +
  případně CATALOG_BINDING wiring. (Konverguje s UWO Catalog-Last status-enumem.)


## 2026-06-08 — Session: UWO sandbox — Work-First na interiér/PSV ( remont mezonetu), runnable offline fixture
**Rozhodnuto:** Groundwork + golden fixture pro UWO (navazuje na design spec). Samostatný zero-dep offline sandbox `sandbox/uwo-interier-mezonet/` (běží `node --test`, žádná síť/DB/AI). **Interview (4 odpovědi):** runnable harnes · šablony uvnitř testdata-projektu · baseline ±10–15 % · reálný ÚRS proba 1×. Reálný kejs: rekonstrukce mezonetu (3D půdorysy M&M + scope majitele + `Cenova_nabidka_rekonstrukce_1.xlsx` mistra, 1 127 350 Kč). 4-fázový pipeline (scope-router → Work-First decomposer → Catalog-Last adapter se status-enumem `exact|candidate|group_only|not_verified` → orientační cost). 10 sekcí → 33 work-atomů; koupelna = balík 7 atomů (nikdy 1 kód). **Jednorázový reálný proba** živého STAVAGENT MCP `find_urs_code` (privátní→ÚRS) zmražen v `data/catalog-findings.json`. Headline: UWO grand **1 435 990 Kč orientačně, +27,4 % vs mistr** — odhalené mezery: malba (stěny+podhledy), hydroizolace, montáž ZP, samonivelační stěrka, **celá výměna kotle**, ochrana schodiště, odvoz suti, administrativa, hodinové. 9/9 acceptance testů green.
**Odmítnuto:** monolitní atomy na interiéru (router guard) · falešný „kód nalezen" (adapter vrací honest status) · catalog-first. Hypotéza „111 vs 784 family-mismatch" se NEpotvrdila (matcher vrátil správné 783); místo toho zmraženy REÁLNÉ false-plausible kódy (kotel „Podmínky použití", štuk „sloupů", perlinka „Příplatek") → sanity-flagy.
**Otevřené otázky:** migrace sandbox šablon → production KB `technological_postupy/` (samostatná úloha); ÚRS find_urs nevrací jednotkové ceny (licencováno) → cost vrstva běží na master/rule-of-thumb sazbách; DPH 12 % flag (neověřeno).
**Deliverable (HK212 styl):** korpus-projekt `test-data/rekonstrukce_mezonet_2026/` — atomizovaný seznam prací jako Excel `outputs/Vykaz_vymer_Mezonet_ATOMIC_WORKLIST.xlsx` (5 listů: Souhrn / Atomic_worklist / Decomposition_Map / GAPS_vs_mistr / Sanity_flagy), generovaný `tools/atomic_worklist_excel.py` z `outputs/atomic_decomposition_map.json` (= projekce sandbox pipeline přes `export-atomic-map.mjs`). HK212 sloupce (Poř./Kapitola/Atomic operace/MJ/Množství/Vzorec/URS kód kandidát/Status 4-tier/náklad/parent). xlsx gitignored (build artifact, vzor RD_Jachymov); zdroj JSON + generátor tracked. 33 ops, 7 dekompozic, 13 gaps, 6 sanity, 0 fabrikovaných kódů, 100 % traceability.
**Co dál:** Production dekompozice ani catalog-search NEZMĚNĚNY (AC10). Gate 3 / SO202 Ingest netknuto. Žádný PR (no-PR-unless-asked). Implementace production UWO větve = po schválení design spec.

## 2026-06-08 — Session: Universal Work Decomposer (UWO) — recon + design (DESIGN-FIRST, žádný kód)
**Rozhodnuto:** Design-first task (Pattern 16 UWO). Výstup = `docs/specs/universal-work-decomposer/{requirements,design}.md`, status `review`. **Žádný kód**, žádná změna monolitu, SO202 Ingest netknutá. **Phase A recon** (4 read-only agenti): monolitní dekompozer `breakdown.py` už nese Pattern 15 kontrakt (`MODE_WORK_FIRST` vs `_WITH_CATALOG`), work-atomy = hardcoded `WORK_TEMPLATES` klíč=element_type, jen monolit; klasifikátor = čistý 24-typ structural-concrete typer, reject jen materiálový, **bez scope-routeru**; `find_otskp`/`find_urs` confidence bez status-enumu; **procurement routing UŽ existuje jako DATA** v `kb/urs_otskp_routing.yaml` (`getCatalogPriority`, privatni/verejna/design_build) ale nepřipojeno; KB `B5_tech_cards/technological_postupy/` má stub `zemni_prace_bourani/` = dům pro ne-betonné šablony. **Phase B interview (4 odpovědi):** interiér/PSV první větev · samostatný scope-router upstream · samostatný catalog-binding adapter · provenance-enum na atomu. **Phase C design:** 3-vrstvý pipeline (Scope-Router → Branch-Decomposer registr větví, monolit=1 větev → Catalog-Binding adapter se status-enumem `exact|candidate|group_only|not_verified`). Větev interiér/PSV rozpracována (renovace koupelny → balík atomů). Fázovaný plán F0–F4+; F3 poputně uzavírá zlepšení ÚRS-hledání (status-enum).
**Odmítnuto:** catalog-first · LLM jako univerzální dekompozer (jen 0.70 fallback s flagem) · rozšíření klasifikátoru o scope (zvolen orthogonální router) · fork slovníků (reuse `element_types.yaml` + `urs_otskp_routing.yaml` + `WORK_TEMPLATES`).
**Otevřené otázky:** keying ne-betonných šablon (navrženo `technological_postupy/<section>/` + `dictionaries.<section>`, k potvrzení); zda `interier_psv` slovník přes `gen-knowledge.mjs` nebo Python-only; jak `procurement_mode` vstupuje do volání.
**Co dál:** **🛑 STOP — design na review.** Implementace (F0–F4) = samostatné úkoly po schválení. Žádný PR (no-PR-unless-asked).

## 2026-06-08 — Session: SO202 Ingest Fix — Gate 1+2+3 (XC4 routing + TZ object-code + NK geometry z prózy)

**Rozhodnuto:**
- Tři sekvenční gaty navazující na recon (2026-06-05 níže), každý **gated/STOP** před mergem,
  **minimální chirurgické additive** změny, **deterministicky** (bez sítě/DB/AI). Každý gate
  spárován s golden testem: hermetic synthetic + **corpus-gated** reálný SO202 — oba běží v CI
  (ne skip), s doloženým verbatim CI-logem že corpus testy PASSED na finálním HEAD. Branch per
  gate (PR1/PR2/PR3), squash-merge.
- **Gate 1 — XC4 routing** (PR #1311, squash `450158d`): AspeEsticon-XC4 soupis
  (`E_Soupis praci_XC4_DI-009.xml`, 3373 `<polozka>`) byl `KROSParser`em poslán do
  OTSKP-XC4 ceníkové větve → **0 položek**. Rozlišovač dává AspeEsticon (`<objekty>` +
  `<zdroj>AspeEsticon`, lowercase `<polozka>`) vlastní identitu a routuje na dedikovaný
  `xc4_parser` (**0 → 3373**). Soubor s `<objekty>` I `<CenoveSoustavy>` → soupis (priorita).
  Reálný ceník (`<Polozka>` capital) beze změny (stále OTSKP-XC4); `_has_xc4_prices` nemá jiné
  konzumenty.
- **Gate 2 — TZ object-code** (PR #1314, squash `70afd18`): `extract_tz_fields` vracel cizí
  `SO 101` (křížená dálnice, ref. v geologii + vnořeno v názvu) a prázdné name/charakteristika
  → `detect_object_type` nepotvrdil most. Fix **reusuje deterministickou SO-logiku klasifikátoru**
  (`extract_so_code(filename)` → `extract_section_ids(text)`), ne paralelní extraktor;
  name/charakteristika přes celodokumentový scan explicitního labelu (colon-optional „Název
  objektu", skip TOC dotted-leader řádků), trailing cizí `SO 101` z názvu odříznut. Oba vstupní
  cesty (s/bez filename) → SO 202; poison-guard SO 250 zárubní zeď NEní most. (Amazon Q: 2×
  `next()` bez defaultu v testech opraveno; produkční kód grepnut — čistý.)
- **Gate 3 — NK geometry z prózy** (PR #1316, squash `69bfc4d`): po Gate 2 byla geometrie NK
  0 % strukturovaná. Additive vrstva `_extract_geometry` v `extract_tz_fields` (segmenter +
  MCP signatura NEtknuté): `num_spans` + uspořádaný `span_lengths_m` (+`spans_consistent`,
  total), `nk_height_m`, `nk_width_m`, `cross_section_type`, `structural_system
  {continuity,casting,prestress}`, per-field `_source` grounding, `needs_verify[]`. Česká
  desetinná čárka, skloňování/předložky (root-regex), číslovky slovy („o **třech** polích").
  **Existing-bridge poison** (TZ popisuje novou NK i bouraný prefab „Petra"): hodnota
  klasifikována podle **nearest-preceding-marker** (popis, pod nímž stojí), ne symetrickým
  oknem → bere nové `32,0+44,5+32,0`/`2,40`/`13,65`/dvoutrám místo starých `26,30+…`/`1,15`/
  `12,64`. Honest-blank ladder (regex 1.0 / inferred count 0.7+flag / absent → None+`needs_verify`).
- **Single-source (zámek):** `cross_section_type` čerpá z živého kalkulátorového `nk_subtype`
  slovníku (`_NK_SUBTYPE_TO_ENGINE` klíče = input vocab) přes drift-guard test
  `test_cross_section_values_are_in_live_calculator_vocab` (emitted ⊆ vocab; engine-internal
  `dvoutram` se NEemituje, jen input form `dvoutramovy`). Žádný fork slovníku.
- **CI důkaz na finálním HEAD `21a1585`** (MCP-Compatibility job 80160139957, success): všech
  14 geometry testů + drift-guard + 2 corpus-gated **PASSED** (ne skip/error); `447 passed,
  2 skipped` (2 skipy = nesouvisející DB-session testy). Po squashi ověřeno na `origin/main`
  (`_extract_geometry` @463, call-site @629, test file, workflow trigger wired) — squash nic
  nezahodil.

**Odmítnuto:**
- Síťový/MCP cross-check, OCR/vize výkresů, golden mimo SO202 korpus.
- Paralelní SO-extraktor v Gate 2 (reuse klasifikátoru místo toho).
- Symetrické negative-context okno v Gate 3 (křehké na kompaktní próze → nearest-preceding-marker).
- Fork `nk_subtype` slovníku (drift-guard místo toho).
- Předpětí/výstavbové fáze v geometrii (must-have only; odloženo).

**Otevřené otázky / Residual (tracking, non-blocker):**
- **nearest-preceding-marker** provalidován na SO202 + 5 hermetic fixtures — **přeověřit na
  širším korpusu reálných mostních TZ** (jiné formulace „nová/stávající" markeru) později.
- Geometrie zatím jen z prózy TZ; výkresy/DXF (přesné kóty, příčný řez) out of scope těchto gatů.

**Co dál:**
- SO202 ingest blokery #1 (XC4) + #2 (object_code) z reconu uzavřeny; geometry pole TZ
  z reconu „Otevřené otázky" vyřešeno. Korpus `test-data/SO_202_D6_OV_Z/` ponechán jako
  corpus-gated baseline.
- Squash-merge orphans (Pattern 12): obsah Gate 1/2/3 na main, větvové commity orphaned;
  recon větev (`d771a3f`) byla taková orphan (obsah na main přes #1310) — designated branch
  `claude/funny-wright-JGSlV` resetnut na post-merge main pro tento §9 zápis.

## 2026-06-06 — Session: Knowledge-architecture audit + governance remediation (Phase 0/1/2)
**Rozhodnuto:** Audit governance/rules/memory vrstvy (odlišná osa od domain-KB `knowledge_audit/`). Report → `docs/audits/knowledge_architecture/2026-06-06_*.md`. Remediation v phasích: **P0** C1 (steering layout přepsán na skutečný monorepo — `structure.md` v2.0 + `tech.md`), C6 (Monolit dvojí CLAUDE → jeden canonical `CLAUDE.md`, stale Render verze do archivu), C5 (settings.json — rozlišeny user-global vs repo permissions). **P1** C2/C3/C4 (DB jména, MCP URL, AI-tier/kredity), C9 (soul §2 v4.24→v4.34), C10 (husky 34→61 testů), C7/C8 (concrete-agent patterns 40→49 + date), D1 (CALCULATOR_PHILOSOPHY ×3 → 1 canon domain.md §1 + stuby). **P2** archiv 14 dead SESSION_/WEEK_ logů, nový `docs/steering/context-index.md` (3-tier mapa), per-service CLAUDE stuby (portal/URS/registry/registry-backend/mineru).
**Nálezy:** Domain-KB osa zdravá (kb/ codegen + drift-guard). Governance osa měla 11 rozporů (2 HIGH) — kořen: **chybí drift-check governance↔realita** (na rozdíl od `gen:knowledge:check`).
**Odmítnuto:** Těžký context-router (anti-bloat). Merge stale Render obsahu do canonical (archivován místo toho).
**Otevřené otázky:** effort "high vs max" (sjednoceno na high-default); fyzický přesun `docs/normy/`→KB B7 (gated, neřešeno).
**Co dál:** **Phase 3 (po Cemex):** drift-guard governance↔realita + trigger update steering/soul §2 + rozhodnutí o SessionStart hooku. Formula testy 61/61 green. Žádný PR (no-PR-unless-asked).

## 2026-06-05 — Session: SO202 corpus — Core Engine recon (RECON ONLY)

**Rozhodnuto:**
- Recon-only task — **žádný produkční fix, žádné golden testy.** Výstup:
  `docs/audits/so202_corpus_recon/2026-06-05_recon.md` + reprodukovatelné skripty
  v `_recon_scripts/` (`run_recon.py`, `cross_check.py`, + JSON). Korpus
  `test-data/SO_202_D6_OV_Z/` (32 souborů: 30 PDF + AspeEsticon-XC4 soupis + marker).
- Interview (uživatel): engine vrstva = **lokální parsery z repa** (ne živé MCP);
  ground-truth = **deterministicky + označit mezeru** (bez OCR/vize na 28 výkresů).
- Spuštěny REÁLNÉ Core Engine funkce: `document_classifier.classify_document_enhanced`,
  `format_detector.detect_format`, `analyze_construction_document` (regex),
  `extract_tz_fields`, `detect_object_type`, `PDFParser`, `KROSParser`, `xc4_parser`.

**Nálezy (top, deskriptivní — pro navazující golden/fix task):**
- 🔴 `KROSParser` vytáhne z AspeEsticon-XC4 soupisu (root `<XC4>`, **3373 `<polozka>`**)
  **0 položek** — `_has_xc4_prices` natvrdo nastaví `OTSKP_XC4` a předběhne `ASPE_XC4`
  větev; dedikovaný `xc4_parser` (umí 3373/3373) je nedosažitelný. `SourceFormat` enum
  AspeEsticon vůbec nezná. → celý soupis SO 202 se v produkční cestě ztratí.
- 🟠 `extract_tz_fields` na TZ i statice: špatný `object_code=SO 101` (≠ 202, chytá
  referencovaný silniční SO), prázdné name/charakteristika → `detect_object_type=None`,
  31/37 narativních false-positive „elementů". ALE 6 odrážkových prvků zváže třídu
  správně (NK→C35/45).
- 🟠 Klasifikátor: **23/28 výkresů mislabeled** (mostly `RO` @0.43) — sparse text razítka
  + RO keyword bleed; bridge názvy (Tvar*/Vyztuz*/VPR/MZ…) minou VY filename pattern.
  Pattern 39 (vision-first) empiricky potvrzen.
- 🟡 Geometrie/technologie NK (3 pole, 32+44,5+32, v2,40, š13,65, dvoutrám, 22-lan,
  PL2, 3 etapy skruže) je **100 % v textu TZ, ale 0 % strukturovaně zachycena** —
  `analyze` regex dá jen materiály + plochý nepojmenovaný seznam kót; `extract_tz_fields`
  jen `{element, concrete_class, volume_m3=None}`.
- ⚠️ Soupis třída = katalogová mez **„DO C40/50"** u NK/dříků pilířů vs skutečná TZ
  **C35/45**; objemy 6 betonových prvků **Δ 0,00 %** vs golden (přes `xc4` direct parse).

**Odmítnuto:**
- Živé MCP cross-check, OCR/vize výkresů, jakákoliv oprava parserů, jakýkoliv golden test
  — vše out of scope (golden testy gated na revizi tohoto reconu).

**Otevřené otázky:**
- Pořadí fixů před golden testy: #1 (KROS XC4 routing) + #2 (extract_tz_fields object_code)
  jsou pravděpodobně prerekvizity smysluplných soupis/TZ goldenů.
- Geometry pole TZ — implementovat (Stage 2 / DXF / vision), nebo zafixovat „pominuto"
  jako baseline golden?

**Co dál:**
- Revize reconu uživatelem → teprve pak navazující golden-test/fix task (gated).
- Korpus `test-data/SO_202_D6_OV_Z/` ponechán jako referenční baseline.
- Env pozn.: recon container potřeboval `pip install pdfplumber pydantic openpyxl lxml
  sqlalchemy` + `--force-reinstall --no-deps cffi` (rozbitá systémová cryptography rust
  binding blokovala pdfminer/pdfplumber import).


## 2026-06-05 — Session: TASK_2b — Engine learns W3 element typing (Gates 0–5)

**Rozhodnuto:**
- Element-classification rule-**DATA** extracted to a single source of truth:
  `concrete-agent/.../app/classifiers/element_rules/element_types.yaml` (ships in the
  concrete-agent Docker image so the W3 Python classifier reads it natively). The TS
  engine imports a committed generated artifact
  `Monolit-Planner/shared/src/kb-generated/element-classification-rules.ts`. Reused the
  EXISTING general generator `scripts/gen-knowledge.mjs` (one INTEGRATION entry +
  `yamlAbs` override), NOT a parallel one. CI-blocking drift guard (`gen:knowledge:check`)
  extended to the concrete-agent `element_rules/**` path.
- Head-noun **ALGORITHM** ported into the engine as a pure pre-layer
  (`element-name-normalizer.ts`), mirroring the W3 Python `element_name_normalizer.py`:
  NK-beats-trám, context-`dřík` (bridge=pier / else wall), `základ` canonicalization,
  obklad→reject, dřík/opěra genitive suppression. **Selective** port — W3's unconditional
  `pilíř→pier` deliberately NOT ported (engine stays finer: building pilíř→sloup).
- `ClassificationContext` gains optional `construction_context` (bridge|retaining_wall|
  building), authoritative over `is_bridge` (back-compat additive).
- Explicit **reject** (`is_concrete_element=false` + `reject_reason`) for stone masonry
  cladding + special materials; `planElement` is the single authoritative site — zeroes
  rebar + all costs, warns "NEJSOU směrodatné".
- **Signal ladder**: OTSKP code = 1.0 (pinned); keyword ≤ 0.9 (conscious tier above
  fuzzy/AI, below code); genuine same-specificity tie → ≤0.7 + `candidates[]`. Specificity
  guard: a more-specific keyword win is not "ambiguous".
- **dřík/opěra bug fixed once on BOTH runtimes** via the genitive-`opěr` qualifier (same
  logic as the `základ`-guard); `telo oper` removed from the pier keyword list. Confident
  abutment (0.9, no near-tie).
- Parity asserted at **family level** (directed engine-fine → W3-coarse roll-up via
  `w3_family`); fine grain guarded by the engine suite, not W3.
- Engine 1249/1249 shared green; W3 19/19 SO-250 Python goldens green (CI MCP-Compatibility
  #336 = first real pytest run of the fix); all 4 CI workflows green on `d3eb623`.

**Odmítnuto:**
- Parallel scoped generator (existing general one extended instead).
- Porting W3's `pilíř→pier` rule (would make the engine less precise).
- Name-based context derivation in 2b (only explicit signals).
- Flagging "opěrná stěna" as ambiguous (specificity win, not a tie).

**Otevřené otázky / Deferred (decomposition phase or follow-up):**
- **MCP classify-delegation** — the MCP/Python side delegating typing to the engine
  (mirrors Phase-2a calc convergence). Only after parity proven. The W3↔engine family
  roll-up map is transitory until then.
- **UI-display reject** — a dedicated pre-compute reject badge in the calculator
  (frontend reads `is_concrete_element`). Today a reject shows as "Jiné" (not a confident
  wrong type) + the post-compute `plan.warnings` surfaces it; richer display deferred.
- **Rich reject handling** — simple-volume for prostý/podkladní beton + full structural
  zeroing of formwork/schedule for rejects (only rebar+costs zeroed now).
- **3-way `construction_context`** — retaining_wall vs building is currently inert (both
  non-bridge → wall) and test-only; thread object_type from the backend parser when a rule
  needs the distinction.
- **sk/de dictionaries** — structure is in place (`dictionaries.<lang>`), only `cs` filled.

**Convergence note — W3 Python goldens that FLIP at MCP-delegation:**
When the MCP/Python side delegates typing to the engine (engine becomes canon), the
following SO-250 goldens flip their LITERAL assertion because the engine vocabulary
differs from W3's — but the **parity FAMILY is preserved in every case** (audited:
ZERO family-level divergence, so delegation is family-safe). Delegation must either
map engine→W3 vocab via `type_core[t].w3_name` / `w3_family`, OR update these literals:
- `operna_zed` → engine `operne_zdi` (wall): `test_mcp_golden_so250.py` #63 (L56);
  `test_mcp_golden_so250b.py` #74 (L154), #76 (L202).
- `zaklady` → engine `zaklady_piliru` (foundation; granularity): `so250.py` #66 (L100),
  #69 (L146), #69b (L157).
- `zdivo_obklad` → engine reject (`element_type='other'` + `is_concrete_element=false`,
  reject family): `so250.py` #65 (L85).
NB: NO golden asserts a W3-specific BUG (e.g. a wrong type the engine corrects across
families) — the audit found none; every W3 golden is family-consistent with the engine.

**Co dál:** Gate 5 closeout (this entry). Next: MCP classify-delegation recon, or the
PositionDecomposition / sub-elements UI phase.


## 2026-06-04 — Session: SSOT MCP delegate Phase 2a + Docker deploy hotfix — SHIPPED, prod live

**Smergeováno do main:**
- **Phase 2a — `calculate_concrete_works` (MCP) DELEGUJE na canonical engine** (POST
  `/api/calculate` → `planElement`). Forwarduje **PlannerOutput verbatim + `source:"monolit_planner_api"`**,
  žádný divergentní Python přepočet. SSOT fix: mostovková deska `rebar_ratio_kg_m3` = **150**
  (ne starých Python `180`). Squash **582d5ae** (PR #1304) — obsahuje i retry-fix **f045b29**.
- **Retired divergentní Python calc** v `calculator.py`: `_lateral_pressure` / `_select_formwork`
  / `_calculate_tacts` / `_estimate_days` / `CURING_DAYS_TABLE` / `EXPOSURE_MIN_CURING` /
  `_try_monolit_api` + ELEMENT_TYPES-fallback. Zůstal jen read-only formwork-override warning.
  `calculate_pump` netknutý.
- **Seam `app/mcp/tools/monolit_delegate.py`** — jediné místo, kde MCP sahá na engine. Fail-mode:
  200→verbatim · 4xx→`engine_invalid_input` (bez retry) · 5xx→`engine_error` (retry) ·
  timeout/conn→`engine_unavailable` (retry). **NEZÁVISLÉ retry-budgety** per typ + hard ceiling
  `_MAX_TOTAL_ATTEMPTS` (Amazon-Q nález f045b29: sdílený čítač kradl 5xx-retry). Nikdy tiché číslo.
- **MCP-only typy** `zdivo_obklad`/`izolacni_stena`/`sachta`/`tunel_rampa` → `unsupported_element_type`
  BEZ volání enginu. Soft-alias `deska→stropni_deska`, `operna_zed→operne_zdi`, `pricinik→rigel`,
  `zaklady→zakladovy_pas`, `jine→other`.
- **Testy:** `test_mcp_ssot_delegation.py` (verbatim + fail-mode + unsupported + retry-budget);
  reconciled compat (6 calc) + golden-SO202 (8) + recipe na PlannerOutput shape přes
  `conftest.calculate_replay` (offline replay z živého enginu). Jest `engine.parity.test.js` (18/18):
  endpoint===planElement + rebar-150 + SO-202 domain. MCP-Compatibility CI zelená.
- **Docker deploy hotfix — PR #1305, squash `f03cbfc`.** Diagnostikován **měsíční zásek deploye
  concrete-agent**: `python:3.11-slim` (plovoucí tag) uvezl base na Debian **trixie**, a
  `libredwg-tools` (přidaný v PR3) NENÍ v Debian stable `main` (ani bookworm, ani trixie) → každý
  Cloud Build padal na `apt-get install` (exit 100) → Cloud Run držel starou pre-PR3 revizi. Fix:
  pin **`python:3.11-slim-bookworm`** + `libredwg-tools` na **best-effort** (`|| echo WARNING`,
  `&& rm` cleanup garantovaný, `apt-get update` zůstává must-succeed). 1 soubor, bez app-změn.
  Amazon-Q návrh (přesun `rm` přes `;`) **odmítnut** — maskoval by selhání `apt-get update` →
  silent-green; rebuttal + resolved na PR.
- **Prod concrete-agent: `/mcp/health` tools 11 → 20**, delegující MCP **živý**. (Delegovaný cíl —
  Monolit `/api/calculate` — živý od PR #1303.)

**Hranice (NEDOTČENO):** `classifier.py` / `breakdown.py` / `advisor.py` zůstaly W3 — žádný diff.
`classifier.py` na mainu má pořád `rebar_kg_m3: 180` (W3 ELEMENT_TYPES intaktní).

**Odmítnuto (var. D — classify NEdelegován):** W3 SO-250 klasifikátor je **korektnější než engine** —
vlastní type-vocabulary (`operna_zed` vs engine `operne_zdi`, prostý `zaklady`, MCP-only
`zdivo_obklad`) + head-noun dizambiguace, kterou engine NEreprodukuje (sverочná tabulka: **7/9
SO-250 goldenů by se rozbilo** — dřík stěny→driky_piliru, obklad→driky_piliru, základ→other).
Delegace classify odložena do 2b.

**Otevřené hvosty (→ samostatné session, NEztratit):**
- **[2b] Engine se učí od W3** (task согласован, Фаза 0 recon): rule-driven klasifikátor, KB-YAML
  s lang-dimenzí, head-noun jako algoritmus, golden-cyklus, + fix `dřík opěry` (teď oba paths →
  `driky_piliru`, má být `opery_ulozne_prahy`). Až PO tom classify deleguje.
- **breakdown C1** (množství z `/api/calculate`) + **advisor inline-retire** — až po classify-konsolidaci.
- **mineru `Dockerfile`** na plovoucím `python:3.11-slim` (záměrně trixie — `libglib2.0-0t64`) →
  zapinovat na **`python:3.11-slim-trixie`** (NE bookworm — rozbilo by t64). Determinismus.
- **Guard-kroky deploye** (`cloudbuild-*.yaml`) dělají `exit 1` na skip → falešné `FAILURE` v Cloud
  Build History. Přepsat na úspěšný skip. Kosmetika — **až po Cemex**.
- **Smoke-галочка:** calculate v prodе → `rebar 150` + `source:"monolit_planner_api"`. Po konstrukci
  už tak je; vizuálně potvrdit s API-klíčem.

**Stav deploye f03cbfc:** merge #1305 (mění `concrete-agent/**`) **auto-spustil** `concrete-agent-deploy`
na main. Build-status z песочnice nečitelný (bez gcloud/sítě) → **čeká na potvrzení** přes
`gcloud builds list` (SHORT_SHA `f03cbfc` → SUCCESS). Silná evidence SUCCESS: identický Dockerfile už
zelený na PR #1305 (`2c2eb5b`) + prod=tools:20.


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
- Update per-service CLAUDE.md souborů (`concrete-agent/CLAUDE.md`, `Monolit-Planner/CLAUDE.md`).

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

## 2026-07-09 — Session: TOV окно (B–F) + import/502 firefight + confirmed write-back regression

**Rozhodnuto (merged):** #1461 TOV окно B–F (editable-field styling, unsaved-changes prompt, visible saved, «Doprava betonu» без бетона + чекбокс, «Odebrat» у pump/crane/delivery) · #1462 import читает колонку «Skupina» (round-trip групп) · #1463 Monolit import больших проектов (timeout 45s + chunked bulk-INSERT `buildPositionInsertChunks`) · #1464 CORE per-call timeout на Vertex Gemini (`VERTEX_CALL_TIMEOUT_S`=90s) — лечит passport/generate 502 (Vertex завис ~598s на 429-шторме). Инфра: Cloud SQL max_connections 25→50, оба backend `PG_POOL_MAX=8`, gcloud → info@stavagent.cz.

**Otevřené (KRITICKÉ, potvrzeno uživatelem):** TOV write-back regression — item 272324 имеет monolith-link (зелёная каска, `crew_size=4` = import default), но `hasExtendedCosts(payload)` false (нет `costs/resources/tov_entries`) → нет баннера «Předvyplnit TOV», хотя Aplikovat запускался. Гипотеза: тонкий write (`export-to-registry.js:153`, без costs/resources/tov_entries) перезаписал богатый Aplikovat-payload (`applyPlanToPositions.ts:504-509`) в Portal. **Полный разбор + точные next-steps:** [`docs/handoff/2026-07-09_tov-writeback-regression.md`](handoff/2026-07-09_tov-writeback-regression.md).

**Další otevřené:** phantom «Auto-created» + гонка синка 409 (`portalAutoSync.ts`) · MCP-OAuth `connection already closed` (`app/mcp/auth.py::_execute` rollback на закрытом соединении) · otskp/R-code 404 noise (безвредно).

**Co dál:** новая сессия с ветки `claude/passport-mcp-worklist-bla05q` (restart from origin/main) → взять handoff §2, проверить Portal merge-vs-overwrite семантику monolith_payload, выровнять два write-пути, проверить на 272324.

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
