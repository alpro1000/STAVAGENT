# TASK_Orchestrator_WorkOntology_SO202_Bridge

**Target week:** Late Week 3 / early Week 4 of Cemex CSC 2026 runway (Jun 14 — Jun 21, 2026)
**Estimated effort:** ~38 hours (extraction ~16h + calculator integration for 9 element types ~12h + validation rules ~6h + tests ~4h)
**Dependencies:**
  - TASK_Orchestrator_StageGating_MVP (Week 2) — orchestrator state machine and session model
  - TASK_Orchestrator_WorkOntology_SO250 (early Week 3) — pipeline already calibrated on simple case
**Demo role:** Complex case for Cemex demo video (60 seconds, deep showcase of pipeline scaling to bridge complexity)

---

## Mantra (read this fully before ANY action)

Before writing a single line of code, do all of the following:

1. **Read the SO-202 golden test file** in Project Knowledge (`SO-202_D6_most_golden_test.md` or wherever the exact path is). This file has the entire expected calculator output structure including all 9 element types, all 10 validation rules, and the construction sequence. This task implements the orchestrator side of producing outputs that match this golden test.
2. **Read the SO 202 Technická zpráva PDF** in Project Knowledge (`D010201_01 Technická zpráva.pdf`, 44 stran). This is the primary source document for the orchestrator's extraction.
3. **Read the entire repo structure** to identify where the existing prestressed concrete logic lives in the calculator (if it exists), where the existing piloty logic lives, where pevná skruž technology is represented, and where REBAR_NORMS data is accessed.
4. **Read the SO 250 implementation** from Week 3 to understand the established extraction and calibration pattern. This task extends it to bridge typology, not replaces it.
5. **Read TKP 18** references in the golden test for curing class rules. Internal STAVAGENT documentation should already have these — locate them.
6. **Read ČSN EN 1992 references** for prestressed concrete in the existing knowledge base or norms search index.
7. Only then begin coding.

This task scales the orchestrator from retaining wall to bridge superstructure. Quality and validation rule coverage matter more than speed. The 10 validation rules from the golden test are the hard correctness contract.

---

## Pre-Implementation Interview

Ask the user (via AskUserQuestion) before writing code — wait for all answers:

1. **Is there existing logic for prestressed concrete (dodatečně předpjatá NK) in the calculator?** If yes, where? If no, this task introduces it.
2. **Is there existing logic for piloty Ø900 with overpouring +0.5m in the calculator?** If yes, where? If no, this task introduces it.
3. **How is pevná skruž v 1 taktu represented in the calculator?** As a num_tacts=1 parameter, as a technology enum value, or other?
4. **Where is the REBAR_NORMS matrix accessed?** Direct table lookup, function call, MCP tool?
5. **Is there existing logic for multi-class concrete in a single element?** SO 202 has elements like opěry with different concrete classes for dřík (C30/37 XF4) and základ (C25/30 XF1). Calculator may need composite handling.
6. **How is "construction phase" (Fáze 1-7) versus "construction Etapa" terminology handled in existing code?** SO 202 has 7 etapy výstavby per TZ §7.2.
7. **Is there existing handling for "no working joints" enforcement?** Pevná skruž v 1 taktu means monolitic NK pour with no working joints.
8. **Where do calculator validation rules live currently?** This task adds 10 SO 202 validation rules — needs to know existing convention.
9. **Has the SO 250 implementation already established a convention for cross-document evidence integration?** If yes, follow that. If not, this task may need to formalize it.
10. **What is the existing handling for integrity tests (CHA, PIT) for piloty?** These are real cost items per the TZ — may or may not be in scope of the calculator output structure.

---

## Context

SO 202 D6 Most na sil. I/6 v km 0,900 is a real ŘSD highway bridge project. PDPS documentation is in Project Knowledge as the Technická zpráva PDF (44 pages).

Key parameters from the TZ and the golden test file:

- 2 mosty (LM + PM), separate NK, 117.9 m each, total length 235.8 m
- 6 polí per most: 15 + 5×20 + 15 m spans
- Width per most: 10.85 m (NK 10.25 m vlastní deska), total bridge width 23.4 m
- NK type: dvoutrámová, dodatečně předpjatá
- NK concrete: C35/45 XF2, curing class **4** per TKP 18 §7.8.3
- Reinforcement: B500B (B500A for pile shoes)
- Height above terrain: ~7.8 m

Prestressing (§6.5.2):
- 12 cables per most (6 per trám)
- 13 lan Y1860S7-15.7 per cable, 156 lan total
- Tendon area 150 mm², mass 1.18 kg/m
- One-sided stressing (half from OP1, half from OP7)
- Stressing prerequisite: fcm,cyl ≥ 33 MPa, earliest 7 days after pour
- Anchor stress 1440 MPa
- Anti-corrosion: PL2 — injection in plastic duct

Spodní stavba (§6.4):

- Opěry OP1, OP7: massive RC, parallel wings; dřík C30/37 XF4, základ C25/30 XF1, závěrná zídka C30/37 XF4, křídla C30/37 XF4, podkladní beton C16/20 X0 or C12/15 X0; výztuž B500B
- Pilíře P2-P6 (5 piers per most): 2 sloupy + rozšířená hlavice + společný základ; sloupy C35/45 XF4 (P4 is C35/45 XF2); základy C25/30 XF1 (P3 is C25/30 XF3); podkladní beton C12/15 X0; výztuž B500B

Founding on piloty (§6.3):

- 122 piloty total: 61 LM + 61 PM
- Ø900 mm
- Lengths 7.5-16.0 m varying by support
- Concrete C30/37 XA2 (medium aggressive water, agresivní CO2, sírany, chloridy)
- Reinforcement B500B
- Paženy ocelovými zámkovými pažnicemi (HPV touches ZS)
- Betonáž metodou Contractor (pod vodou, licí roura)
- Overpouring +0.5m above top of podkladní beton
- Geology: Granit R4-R2, pokryvné útvary 4-10m
- HPV 1.0-3.55 m below terrain
- P3 PM and P4 LM krajní: plovoucí piloty (per doIGP recommendation due to anomální geologie)

Integrity tests (§6.3.3):

- CHA (ultrazvuk) on OP1-P6: 1+1, OP7: 2+2 → 16 tests total
- PIT (odrazová) on remaining: 122 - 16 = 106 tests

Římsy (§6.7):

- 4 římsy per pair of mosty: vnější LM, vnitřní LM, vnitřní PM, vnější PM
- Beton C30/37 XF4, curing class **4**
- Vnější width 1.7 m, vnitřní 0.9 m
- Vnější has revizní chodník 0.75 m + svodidlo + zábradlí + stožáry VO
- Vnitřní has zábradelní svodidlo + plotový nástavec 1.6 m

Přechodové desky (§6.6.1):

- 4 desky: OP1 LM/PM, OP7 LM/PM
- Beton C25/30 XF2
- OP1: 4.0 m length × 0.300 m thickness
- OP7: 7.0 m length × 0.350 m thickness
- Podkladní beton C12/15 X0, 100 mm

Třída ošetřování (§7.8.3, TKP 18):

- Prvky spodní stavby: 3
- Nosná konstrukce: **4** ← critical
- Římsy: **4** ← critical

Minimum curing days per třída and surface temperature (TKP 18 table):

- Třída 4, 15-25°C: **9 days minimum**
- Třída 4, 10-15°C: 13 days
- Třída 4, 5-10°C: 18 days
- Třída 4, ≥25°C: 5 days
- All XF3/XF4 elements: minimum 7 days regardless of třída

Etapy výstavby (§7.2):

1. Přeložky IS, odhumusování, vyztužené násypy, konsolidační násyp OP7 (60 dní)
2. Výkop na pilotážní plošiny, pilotové založení
3. Výkop na ZS, začištění hlav pilot, opěry, pilíře, kanalizace
4. Ložiska, částečný zásyp PO, **betonáž NK + předpětí (1 etapa, pevná skruž)**
5. Závěrné zídky, křídla, zásyp PO, přechodové desky
6. Mostní svršek LM, MÚK, svedení dopravy na LM
7. Mostní svršek PM, dokončení MÚK, úpravy pod mostem

This is far more complex than SO 250. Nine element types vs three. Prestressed concrete vs ordinary RC. Curing class 4 critical path. Pevná skruž technology. Multi-class concrete per element. Integrity tests as real cost items.

The goal: orchestrator pipeline runs end-to-end on the SO 202 TZ PDF, produces work ontology items for all 9 element types, calculator runs for each with correct curing class, prestressing schedule, and pevná skruž enforcement, all 10 validation rules from the golden test pass.

---

## Business Logic

### 1. Document ingestion

The orchestrator workflow for SO 202 reads the SO 202 Technická zpráva PDF (44 pages) from Project Knowledge. Visual table extraction is critical here because §6.3 (piloty), §7.8.1 (beton classes per element), §7.8.3 (curing classes), and §11 (validation rules in golden test) are all heavily table-based.

If supplementary documents are available (statický výpočet, výkresy), include them. If only the TZ is available, the pipeline still must produce a valid Stage 1 work list with appropriate confidence levels and HITL flags for any missing geometry.

### 2. Project context extraction

From the TZ, extract:

- Object identification (SO 202, bridge over silnice I/6 km 0,900)
- Two-bridge structure (LM + PM)
- Static system (continuous beam over 6 spans)
- Length, width, height parameters per §2.1
- All concrete classes from §7.8.1 table (full enumeration)
- All exposure classes (X0, XF1, XF2, XF3, XF4, XA2)
- Curing classes per §7.8.3 (třída 3 for spodní stavba, třída 4 for NK and římsy)
- Reinforcement grade(s) (B500B primary, B500A for pile shoes)
- Construction technology: **pevná skruž v 1 etapě** for NK
- Etapy výstavby (Fáze 1-7) per §7.2
- Norms cited (TKP 18, ČSN EN 1992, ČSN EN 206+A1/A2, etc.)
- Special elements: integrity tests (CHA, PIT), anti-corrosion protection PL2 for prestressing ducts

### 3. Work ontology extraction for 9 element types

For each of the 9 element types defined in the golden test §10 Očekávané vstupy kalkulátoru, generate work ontology items.

**Element type 1: Piloty (122 ks)**
- 9 work items by support (OP1, P2, P3, P4, P5, P6, OP7) × (LM, PM), aggregated or split as appropriate
- Per pile: Ø900, length per support, C30/37 XA2, B500B
- Aggregate volume ≈ 908 m³ (122 × 7.44 m³ at average length 11.7m)
- Overpouring loss ≈ 39 m³
- Integrity tests: 16 CHA + 106 PIT as separate cost work items
- Special properties: pažení, licí roura, pod vodou (Contractor metoda)

**Element type 2: Základy opěr (4 ks: OP1 LM/PM, OP7 LM/PM)**
- C25/30 XF1
- Curing class 3 (XF1 → 7 days minimum)
- Dimensions per výkresy (estimate from drawings or HITL if missing)

**Element type 3: Základy pilířů (10 ks: P2-P6 × LM/PM)**
- P2, P4, P5, P6: C25/30 XF1, curing class 3
- P3: C25/30 XF3, curing class 3, ≥7 days
- Aggregate or split per element

**Element type 4: Dříky pilířů (20 sloupů: 5 pilířů × 2 sloupy × LM/PM)**
- P2, P3, P5, P6: C35/45 XF4, curing class 3, ≥7 days
- P4: C35/45 XF2, curing class 3
- Height ~7.8 m → záběry from formwork pressure (DIN 18218): roughly 3 záběry per 2.7m
- Reinforcement index ~150 kg/m³

**Element type 5: Dříky opěr + závěrné zídky + křídla**
- C30/37 XF4, curing class 3, ≥7 days
- Complex geometry: dřík + úložný práh + závěrná zídka + křídla
- Reinforcement index ~120 kg/m³

**Element type 6: Nosná konstrukce — mostovková deska (2 mosty)**
- C35/45 XF2, **curing class 4 (CRITICAL — TKP 18 §7.8.3)**
- Volume per most ≈ 605 m³ (estimated 5 m²/bm × 111.5 m NK length)
- Two trámy per most, výška 1.1 m, šířka 1.6-2.1 m proměnná
- Vnější konzola 2.0 m, vnitřní 1.75 m
- Středová deska 2.3 m, výška 0.25-0.35 m
- Koncové příčníky šířka 1.25 m
- Technology: pevná skruž v 1 taktu (num_tacts = 1)
- Predpětí: 12 kabelů per most, 156 lan total per most
- No working joints allowed (monolitic pour)
- Curing days minimum 9 (curing class 4 at 15°C)
- Prestressing schedule: 7 days strength wait + 2 days stressing + 2 days injection = 11 days minimum after NK pour
- Total NK schedule per most ≈ 80-90 days (concrete + curing + prestress + ancillary)
- 2 mosty sequential ≈ 160-180 days total NK phase

**Element type 7: Římsy (4 ks: vnější+vnitřní × LM/PM)**
- C30/37 XF4, **curing class 4 (CRITICAL)**
- Length 111.5 m per most
- Vnější width 1.7 m, vnitřní 0.9 m
- Reinforcement ~120 kg/m³
- Formwork: římsové bednění T system (NOT stropní systémy)
- Curing days ≥ 9 (curing class 4)

**Element type 8: Přechodové desky (4 ks)**
- OP1: 4.0 m × 0.300 m, C25/30 XF2, curing class 3
- OP7: 7.0 m × 0.350 m, C25/30 XF2, curing class 3
- Podkladní beton C12/15 X0, 100 mm
- Reinforcement ~60 kg/m³

**Element type 9: Podkladní betony**
- C12/15 X0 (most locations) or C16/20 X0 (pilotážní šablona OP1)
- No reinforcement
- Curing class 1 or 2 (per TKP 18, X0 minimum requirements)

### 4. Calculator integration with bridge-specific logic

For each element, calculator must respect bridge-grade rules:

**Prestressed NK:**
- Calculator output must include both:
  - Concrete pour + curing window (curing class 4, ≥9 days at 15°C)
  - Prestressing window (≥7 days strength + 2 days stressing + 2 days injection)
- Schedule must be sequential, not parallel: prestressing cannot start before concrete reaches 33 MPa, which is no sooner than 7 days
- Pevná skruž: num_tacts = 1, no working joints, monolitic pour in one continuous operation

**Piloty:**
- Volume per pile: π × (0.45)² × length
- Overpouring: π × (0.45)² × 0.5 m above podkladní beton (≈0.318 m³ per pile)
- Total overpouring loss for 122 piloty ≈ 39 m³
- Concrete class C30/37 XA2 (aggressive water)
- Reinforcement index ~40 kg/m³ for piloty
- No formwork (pažené but pažení is steel sheet pile, not formwork system)
- Integrity tests are separate cost work items, not pile cost

**Pilíř sloupy with height ~7.8m:**
- Formwork pressure analysis per DIN 18218
- Vertical pour split into záběry: with h=7.8m, typically 3 záběry × 2.7m
- Záběry are not synonymous with working joints — they are pour cycles within one element

**Římsy:**
- Curing class 4 means ≥9 days curing, regardless of exposure class
- Formwork: T-system rim formwork. NOT slab formwork systems. This must be correct in formwork engine output.

### 5. Sequential work list generation per Fáze 1-7

Construction sequence follows TZ §7.2 etapy výstavby. Work items must be ordered and tagged with their Fáze:

- Fáze 1: Přeložky IS, odhumusování, vyztužené násypy, konsolidační násyp OP7 (60 dní waiting time before Fáze 2 — important constraint)
- Fáze 2: Výkop na pilotážní plošiny, pilotové založení
- Fáze 3: Výkop na ZS, začištění hlav pilot, opěry, pilíře, kanalizace
- Fáze 4: Ložiska, částečný zásyp PO, betonáž NK + předpětí (1 etapa, pevná skruž)
- Fáze 5: Závěrné zídky, křídla, zásyp PO, přechodové desky
- Fáze 6: Mostní svršek LM, MÚK, svedení dopravy na LM
- Fáze 7: Mostní svršek PM, dokončení MÚK, úpravy pod mostem

### 6. Stage 1 Definition of Done

Same as SO 250 task. All Pattern 15 DoD checks must pass. Code column empty, Cena column empty. Every item has formula and source. Logical order present.

### 7. Output generation

Same as SO 250: items.json + Stage 1 XLSX export. Format matches HK212 and SO 250 baseline.

### 8. Regression tests

- HK212 still produces baseline output (138 items)
- SO 250 still produces SO 250 baseline (from Week 3 task)
- SO 202 produces output that passes all 10 validation rules from the golden test §11

---

## Domain Rules

The 10 validation rules from the SO-202 golden test §11 are hard correctness contracts. Calculator output must satisfy all:

1. **NK curing ≥ 9 dní** (curing class 4, 15°C surface temperature). NOT 1.5 days, NOT 5 days. The calculator must apply TKP 18 §7.8.3 table correctly for the higher temperature ranges and not return shorter durations.
2. **NK předpětí ≥ 11 dní** (7 days strength + 2 days stressing + 2 days injection). Calculator must produce a schedule with these phases sequential, not overlapping.
3. **Piloty: no formwork card, no formwork system comparison table.** Piloty are formed by ocelové zámkové pažnice (steel sheet piling). Calculator must NOT produce DOKA/PERI formwork comparison for piloty — this is a category error.
4. **Piloty: overpouring +0.5m in volume.** Per pile volume includes 0.5m extra above top of podkladní beton. For 122 piloty this is ≈39 m³ of overpour loss in concrete consumption.
5. **Dříky pilířů: záběry from formwork pressure (DIN 18218).** With height 7.8m, calculator must produce 3 záběry (approximately 2.7m each), not a single pour. Záběry are pour cycles within one element due to formwork pressure limits — not working joints.
6. **Římsy: T-system rim formwork**, NOT slab formwork systems. Calculator formwork recommendation must select T-type rimsa systems (DOKA Top 50 system rímsa, PERI VARIO rímsa, or equivalent). Never STAXO/MULTIPROP/slab tables.
7. **XF4 elements: minimum curing 7 days.** This applies to opěry dříky, závěrné zídky, křídla, pilíře P2/P3/P5/P6 sloupy, římsy. Curing window must be ≥7 days regardless of curing class.
8. **XF3 elements: minimum curing 7 days.** Specifically základ pilíře P3 (C25/30 XF3) — its curing must be ≥7 days even though curing class is 3.
9. **Pevná skruž v 1 taktu → num_tacts = 1 for NK.** Calculator output for NK must explicitly set num_tacts=1. No working joints allowed in NK. Monolitic pour of all 6 polí in one continuous operation per most.
10. **2 mosty: total schedule ≈ 2× schedule 1 mostu (sekvenčně).** The 2 mosty are built sequentially, not in parallel (per TZ §7.2 Etapa 6 and 7). Calculator total project schedule for NK phase must reflect sequential build of LM then PM.

Additional domain rules:

- All TKP 18 §7.8.3 curing minimums must be respected. Especially: XF3 and XF4 minimum 7 days regardless of třída ošetřování.
- ČSN EN 1992 must be cited in audit trails for prestressed concrete decisions.
- ČSN EN 206+A2 must be cited for exposure class semantics.
- Anonymization rules same as SO 250: remove projektant company names. Geographic identifiers (D6, km 0,900) can stay.
- Czech terminology in popis fields (mostovka, opěry, pilíře, dříky, závěrné zídky, římsy, přechodové desky, podkladní beton, dilatační celek, pevná skruž, předpětí, etc.).

---

## Acceptance Criteria

1. Orchestrator workflow runs end-to-end on the SO 202 TZ PDF without errors. State transitions DOCUMENT_ANALYSIS → WORK_ATOMIZATION → (REVIEW or terminal).
2. ProjectContext populated with all 9 element type categories, all concrete classes (full §7.8.1 enumeration), all exposure classes, all curing classes per §7.8.3, all 7 etapy výstavby from §7.2, construction technology (pevná skruž v 1 etapě), all norms cited.
3. Work ontology items generated for all 9 element types. Each type has at least one work item (some types have multiple, e.g., piloty has aggregation by support).
4. Piloty count totals 122 (61 LM + 61 PM) within ±2 (accommodating any per-support drawing discrepancies).
5. Mostovka NK volume calculated per most ≈ 605 m³ within ±5% (estimated from 5 m²/bm × 111.5 m NK length).
6. Prestressing detected: 12 kabelů per most (6 per trám), 156 lan total per most.
7. NK curing window enforced ≥9 days for curing class 4 at 15°C (Validation Rule 1).
8. NK prestress schedule enforced ≥11 days total (7+2+2) sequential (Validation Rule 2).
9. Piloty work items do NOT contain formwork card output or formwork system comparison (Validation Rule 3). Verified by absence of DOKA/PERI references in pile work item audit trails.
10. Piloty volume aggregation includes +0.5m overpouring per pile (Validation Rule 4). Total overpour ≈ 39 m³.
11. Pilíř sloupy with height ~7.8m produce 3 záběry in formwork plan (Validation Rule 5).
12. Římsy formwork recommendation is T-type rim system, not slab systems (Validation Rule 6).
13. XF4 elements (opěry dříky + závěrné zídky + křídla, pilíře P2/3/5/6 sloupy, římsy) have minimum 7-day curing in audit (Validation Rule 7).
14. P3 základ (XF3) has minimum 7-day curing in audit (Validation Rule 8).
15. NK work item explicitly has num_tacts = 1 and no working joints (Validation Rule 9).
16. Total project schedule for NK phase reflects sequential LM-then-PM build, ≈ 2× single most NK duration (Validation Rule 10).
17. Audit trails cite TKP 18 §7.8.3 for curing decisions and ČSN EN 1992 for prestressed concrete decisions.
18. Integrity tests (16 CHA + 106 PIT) are represented as separate work items, not embedded in piloty cost.
19. Fáze 1-7 sequence is correctly applied to all work items. Fáze 1 has 60-day waiting constraint represented.
20. validate_stage1_work_list passes all DoD checks. Code column empty, Cena column empty.
21. items.json output format consistent with SO 250 and HK212 baselines.
22. Stage 1 XLSX export per Pattern 15 §5.3 schema.
23. Regression tests pass: HK212 baseline unchanged, SO 250 baseline unchanged.
24. Anonymization: output does not contain projektant company names. D6 km 0,900 geographic identifier remains.
25. Replay test: same SO 202 inputs + same tool versions produce identical work ontology items.

---

## What Is NOT Included

- Stage 3 catalog binding for SO 202. That is Week 4 (TASK_Orchestrator_KROS_Adapter_Wrap), and SO 202 will be one of its test cases.
- Pricing of any items. Post-Cemex.
- DXF parsing. No DXF available for SO 202 per the user.
- Statický výpočet automated reading (full structural calculation parsing). Reading parameter quotes from §6.5.2 etc. is acceptable. Full structural ingestion is post-Cemex.
- BIM/IFC integration. Post-Cemex.
- Monte Carlo or probabilistic duration. Post-Cemex.
- Crew sizing simulation. Post-Cemex.
- Real-time progress tracking. Post-Cemex.
- Polish on XLSX visual formatting. Functional output is enough.
- Voice or copilot interaction.
- Auto-handling of supplementary documents beyond the TZ. If user provides only the TZ, that is the input. If they provide additional drawings or statický výpočet, treat as evidence augmentation but do not require them.

---

## Naming Determination

All paths, identifiers, type names, function names, module names, and JSON field names mentioned are **descriptive of business intent only**. Determine actual naming from existing repo conventions, especially from the SO 250 implementation completed earlier in Week 3.

If SO 250 introduced a specific items.json shape, SO 202 must use the same shape. If SO 250 introduced specific element_type enum values (foundation_pad, retaining_wall_monolitic, etc.), SO 202 extends the same enum with bridge-specific values (pilota, opera, pilir_sloup, mostovka_predpjata, rimsa, prechodova_deska, podkladni_beton).

The golden test file SO-202_D6_most_golden_test.md uses Czech-named YAML structure for §10 expected calculator inputs. If the actual calculator I/O uses different naming, align this task's outputs to the calculator's actual contract — the golden test is descriptive, the calculator is authoritative.

When in doubt, match the most recently merged calibration test (likely SO 250 from earlier in the week).
