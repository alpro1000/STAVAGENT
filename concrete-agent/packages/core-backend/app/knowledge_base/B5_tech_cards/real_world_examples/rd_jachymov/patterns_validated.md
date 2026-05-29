# RD Jáchymov pilot — universal patterns validation

**Source pilot:** RD Jáchymov Fibichova 733 (DSP rekonstrukce + nadstavba 3.NP + sklad 260217, 2026-05-18 → 2026-05-26)
**Master registry reference:** `docs/STAVAGENT_PATTERNS.md`
**Pilot-local case studies:** `concrete-agent/.../rd_jachymov/patterns/01_*.md` … `09_*.md`
**Sibling validation report:** `concrete-agent/.../zihle_2062_1/patterns_validated.md`
**Compiled:** 2026-05-26 (CEV expansion + pattern library expansion session)

This file mirrors the Žihle convention — it records **which universal patterns** in the master registry were validated (or invented) by this pilot, with cross-links to the pilot-local case studies that ship the concrete artefacts.

---

## Patterns invented by this pilot (new — added to master registry)

20 of the 36 master patterns trace their origin to this pilot's iteration. Pattern numbers in the master registry use the canonical sequence `last_number: 36`, `next_pattern: 37` (header of `docs/STAVAGENT_PATTERNS.md`).

| Master # | Title | Pilot-local cross-ref | Validation evidence |
|---:|---|---|---|
| **17** | Phase 0a Completeness Audit (mandatory pre-extraction gate) | `patterns/08_completeness_audit_mandatory.md` (CRITICAL canonical algorithm) | 156 / 156 DXF layers exhaustively probed via Path C 5-tier sweep after first pass probed only 11 (7 %). 6 silent drifts caught (ETICS 200 → 160 mm, PIR 180 → 160 mm, klempířina 4-way split, obklady per-koupelna výška, per-podlaží světlé výšky, špalety perimeter). |
| **18** | Iterative deepening with human-as-QA-gate | `patterns/09_iterative_layer_probe_user_caught_gaps.md` (ANTI-PATTERN preserved as negative example) | 6 categories of silent drifts caught only via user prompting (file-swap, encoding, S-codes, missed layers, fabricated terms, per-drawing POZN refs). |
| **19** | Diminishing returns gate | (no pilot-local case study — codified in CEV final report) | Audit chain: Audit v2 found 8 → 0 → CEV per-drawing found 3 + 1 → Phase 3.5 verified canonical. Stop signal triggered cleanly. |
| **20** | Audit v2 — 10-section completeness methodology | (no pilot-local case study — codified in `tools/completeness_check_v2.py`) | Audit v1 (4 sections A-D) caught 2 gaps; Audit v2 (10 sections A-J) caught 8 additional gaps. ~80 % of real gaps fell into sections E-J. |
| **21** | Multi-factor catalog candidate selection | (carried forward from HK212 — pilot reinforced) | Note-hint operator signal recognised as 4th factor alongside confidence + unit_match + popis_jaccard. |
| **22** | PDF noise filters mandatory in matrix builders | (codified in `tools/cev_matrices.py` + `tools/cev_matrices_cd.py`) | First Matrix A pass: 22 false-positive critical GAPs from TOC lines + numeric-dump catastrophic backtracking. Final pass with filters: 0 GAPs. |
| **23** | Per-drawing extraction (beyond TZ-only) | (codified in `tools/cev_per_drawing_audit.py` + `tools/cev_dxf_full_text_dump.py` + `tools/cev_full_ocr_pipeline.py`) | Per-drawing audit found POZN.1.02 (komín bourání), POZN.1.03 (opěrné zídky bourání), POZN.2.02 (drenáž za bílou vanou) — 3 GAPs + 1 ENRICHMENT (VRN.001 mykologický + dřevokazný hmyz) missed by TZ-only extraction. |
| **24** | Multi-namespace S-code / F-code handling | (codified in `tools/apply_phase3_5_sklad_skladby.py` + `outputs/sklad_skladby_legenda_canonical.json`) | Sklad has its OWN S01-S05 namespace (different from dům řez A-A S01-S12b legenda). First Phase 3.1 tagged only 38 dům items; Phase 3.5 added 14 sklad items + 9 explicit-null markers using sklad-namespace S-codes. |
| **25** | Web search as catalog verification fallback | (carried forward from HK212 — pilot accepted) | 49 clear URS codes / 130 review needed / 122 manual lookup heuristic established. |
| **26** | Honest fallback hierarchy for missing data | (carried forward from HK212 — pilot codified 8-level table) | 122 items with blank cell + "MANUAL LOOKUP" flag rather than fabricated codes. 9 wrong-leaf items kept 6-digit family + "???" leaf rather than guessing. |
| **27** | External LLM cross-validation as Nth source layer | (codified in conversation log — ChatGPT independent analysis) | ChatGPT confirmed ~80 % of internal findings + flagged 2 real gaps: sklad-specific skladby namespace (Pattern 24 motivator) + cell numbering anomaly. Both verified + addressed. |
| **28** | Schema integrity — globally-unique entity IDs | (caught + fixed in `tools/apply_per_drawing_audit_fixes.py` — VRN.001 collision bug) | `VRN.001` id collides across 9 VRN sub-kapitolas. Patch tool overwrote ZS WC popis instead of Průzkumy popis. Caught + fixed via `(id, kapitola)` compound key. Schema-level refactor queued. |
| **29** | Continuous source provenance per item | (codified in items.json schema — `source`, `mnozstvi_formula`, `mnozstvi_confidence`, `_data_quality`, `_vyjasneni_ref`, `_audit_gap_fixed`) | All 211 items carry full provenance. Matrix C verification: 163 VERIFIED + 48 PARTIAL + 0 NOT_VERIFIABLE. |
| **30** | Czech regex diacritic boundary pitfall | (codified in `tools/quality_audit.py` regex patterns) | Quality pass caught 2 false negatives where regex failed on `č` / `š` boundary in stems (`Hydroizolac\w+` failing on `Hydroizolační`). |
| **31** | Comprehensive Extraction Verification (CEV) before catalog matching | (codified in `tools/cev_layers_extract.py` + `tools/cev_matrices.py` + `tools/cev_matrices_cd.py` + `outputs/cev_final_report.md`) | 5 layers + 4 matrices applied. Path A verdict reached. Caught 3 GAPs + 1 ENRICHMENT after Audit v2 + Quality already passed. |
| **32** | Two-file delivery — audit + production separation | (codified in `outputs/Vykaz_vymer_RD_Jachymov_VSE_VARIANTY_*.xlsx` File A + `outputs/Vykaz_vymer_RD_Jachymov_KROS_format_*.xlsx` File B) | File A (10 sheets: Souhrn + 6 Variants + Var_D/E/F + Cross_verification, audit provenance), File B (KROS production format, code | popis | MJ | qty | price). |
| **33** | Project synthesis before audit decisions | (codified in `outputs/Project_Summary_RD_Jachymov.md` + `outputs/Project_OnePager_RD_Jachymov.md`) | After 4 audit layers caught gaps iteratively, holistic synthesis enabled informed Path C decision (hybrid delivery). |
| **34** | Honest cost transparency to user | (codified in conversation log — bill-clarification exchange) | User saw "$10-15 budget" comment + 1000 CZK GCP bill same day → conflated. Clarification: WebSearch real cost ~ $0.50, GCP bill = STAVAGENT infrastructure unrelated. |
| **35** | Skill-of-the-pilot encoding for next iterations | (THIS FILE is the validation of Pattern 35 itself — meta) | 22 patterns extracted from session, 20 new + 2 enrichments codified into master + this pilot-local validation report + CLAUDE.md mandatory-rule promotion. |
| **36** | File staging convention for processed vs canonical inputs | (codified in `inputs/` tree: `tz/` / `dokladova_cast/` / `vykresy_pdf/` / `situace/` / `_superseded/<date>_<reason>/` / `meta/`) | Multiple TZ revisions handled via `_superseded/2026-05-16_unsorted_audit/` subdir. Canonical inputs stayed clean. |

## Patterns enriched by this pilot (existing master patterns extended)

| Master # | Title | Enrichment from this pilot |
|---:|---|---|
| **12** | Squash Merge Orphans Source Branch Ref | Added branch-lifecycle workflow + repo-settings algorithm. 4× false merge conflicts mid-work documented as recurring-cycle anti-pattern. |
| **15** | Work-First, Catalog-Last — Sequential Výkaz Výměr Generation | Added CEV pre-match consolidation gate. Extended HK212's 3-stage workflow to strict 6-phase sequencing (EXTRACT → CROSS-REFERENCE → CONSOLIDATE → VALIDATE LIST → MATCH CATALOG → PRODUCTION) with explicit STOP gate after Phase 4. Two-file principle (File A audit vs File B production) formalised. |

## Patterns inherited from prior pilots (validated again, no changes)

These master patterns were established by prior pilots (HK212 hala, Žihle 2062-1) and validated again on this pilot without modification:

| Master # | Title | Validation |
|---:|---|---|
| 1 | Per-SO Chunking pro Master Soupis | Applied per-objekt (dum + sklad) for items.json + Excel generation |
| 2 | Audit Trail Mandatory | Every one of 211 items carries `source` + `mnozstvi_formula` + `mnozstvi_confidence` + `_data_quality` |
| 3 | Triangulation Philosophy | DXF dimension × TZ explicit × items.json formula triangulated at Matrix D check |
| 5 | TSKP Hierarchical Structure (0-9) | Item kapitola distribution: HSV-1..7 + PSV-71..78 + PSV-95 + M-21 + VRN — full TSKP family coverage |
| 6 | No Work Duplication Rule | Audit v2 section H (material balance check) + section G (cross-element consistency) validate no double-counting |
| 13 | Synthetic Acceptance Metrics Mask Correctness | Manual sampling QA on URS Tier 1 prevented false-positive ship |
| 14 | Forward-Tracked `_analytical_journey` on Item Mutations | `_audit_v2_fixes_applied_log` + `_per_drawing_audit_fixes_log` + `_phase3_consolidate_log` + `_phase3_5_sklad_skladby_log` records all mutations |

## Pilot-local case studies (separate namespace 01-09)

These are RD Jáchymov-specific case studies — concrete artefacts from this pilot. They are referenced from the universal patterns table above where applicable.

| Case study | Title | Maps to universal pattern |
|---|---|---|
| `patterns/01_file_swap_detection.md` | SHA-verified swap detection via Rdt fingerprint drift | (no direct universal — pilot-unique technique) |
| `patterns/02_tz_validator_iterative_refinement.md` | 4 Czech regex weakness classes | Pattern 30 (Czech regex diacritic pitfall) |
| `patterns/03_multi_view_items_json.md` | Single source N projections (items.json upstream, Excel downstream) | Pattern 32 (Two-file delivery) |
| `patterns/04_workflow_gate_vs_catalog_grouping.md` | `_gate` field parallel to `kapitola_group` | Pattern 5 (TSKP hierarchical structure) |
| `patterns/05_exhaustive_dxf_extraction.md` | 5-tier prioritization | Pattern 17 (Phase 0a) Layer 2 |
| `patterns/06_embedded_table_extraction_dxf_mtext.md` | `^I` literal caret-I tab, NOT ASCII `\t` | Pattern 17 (Phase 0a) Layer 2 |
| `patterns/07_honest_detail_fallback_dsp_scope.md` | DSP-scope honest fallback | Pattern 26 (Honest fallback hierarchy) — DSP-scope variant |
| `patterns/08_completeness_audit_mandatory.md` | Phase 0a algorithm canonical reference | Pattern 17 (Phase 0a Completeness Audit) — CRITICAL |
| `patterns/09_iterative_layer_probe_user_caught_gaps.md` | ANTI-PATTERN preserved as negative example | Pattern 18 (Iterative deepening) — what catches Pattern 17 when not run |

## Cross-references

- Master registry: [`docs/STAVAGENT_PATTERNS.md`](../../../../../../../../docs/STAVAGENT_PATTERNS.md)
- Sibling pilot validation: [`zihle_2062_1/patterns_validated.md`](../zihle_2062_1/patterns_validated.md)
- ZS templates (separate library): [`B5_tech_cards/ZS_templates/PATTERNS.md`](../../ZS_templates/PATTERNS.md)
- Concrete-agent CLAUDE.md pattern section: [`concrete-agent/CLAUDE.md`](../../../../../../../../concrete-agent/CLAUDE.md)

## UWO restructure pass (2026-05-28/29) — Stage 1A/1B

Second contribution wave from the UWO single-source restructure. Honest assessment of 7 pattern candidates → **1 NEW + 2 ENRICHMENTS + 4 ALREADY COVERED** (no library inflation):

| Master # | Title | Type | Origin in this pass |
|---:|---|---|---|
| **38** | Single-source projection discipline | **NEW** | `regenerate_all_views.py` orchestrator rebuilt 7 views from items.json 212→214; post-regen count assertion; `_superseded/` snapshot. Distinct from 16 (catalog-agnostic) + 32 (which views) — codifies the *regeneration/no-hand-edit* operational rule. |
| **25** | Web search as catalog verification fallback | ENRICHMENT | Added source-priority ladder: catalog API/MCP (`find_urs_code`) authoritative > WebSearch snippet > blank. Phase 5B 60 WebSearch queries gave mostly FAMILY_VERIFIED because paywalled catalog leaves aren't in Google snippets. |
| **20** | Audit v2 — 10-section completeness | ENRICHMENT | Added §C implicit-pomocné/VRN sub-class (PM01-PM06: přesun hmot, lešení, hromosvod, slaboproud, okapový chodník, terénní úpravy) — works rarely in TZ but physically required. Stage 1A found all 47 standard anchors COVERED, 6 GAPs all in this class. |

Candidates dismissed as already covered (verified against existing patterns):

| Candidate | Verdict |
|---|---|
| Atomic worklist HK212 028a..f letter-suffix | ALREADY COVERED — Pattern 15 Stage 2 (split into `{parent}a/b`, references `split_hsv1_028.py`) |
| Catalog tools BLOCKED during Stage 1 | ALREADY COVERED — Pattern 15 Rule ("Code+Cena columns left EMPTY in Stage 1", "never run auto-matcher on fresh items") |
| Names FROM catalog Stage 3 | ALREADY COVERED — Pattern 15 Stage 3 + Pattern 16 (names are catalog-local; work ontology is name-agnostic) |
| Don't invent work not in TZ | ALREADY COVERED — Pattern 9 (Re-read TZ Before Generating) + Pattern 26 (honest, no fabrication). Stage 1B-verify (scan TZ before adding PM03/05/06) is this discipline applied. |

Stage 1A/1B artefacts:
- `tools/anchor_checklist_gap_audit.py` + `outputs/anchor_checklist_gap_audit.json` (53 anchors → 48 COVERED + 6 GAP)
- `tools/apply_anchor_gaps.py` (212→214: PM01 přesun hmot + PM02 lešení only)
- `tools/add_anchor_vyjasneni.py` (vyjasnění #22 hromosvod + #23 terénní + #24 slaboproud)
- `tools/regenerate_all_views.py` (single-source orchestrator — Pattern 38 reference impl)

## Compilation note

This file was compiled as part of the pattern-library expansion pass on 2026-05-26 (commit hash to follow), extended 2026-05-28/29 with the UWO restructure wave (Pattern 38 + enrichments to 20/25). It is a snapshot of the pilot's contribution to the master registry. Future RD Jáchymov sessions extending these patterns should append updates here, NOT renumber master entries — see Pattern 35 (Skill-of-the-pilot encoding) for the discipline.
