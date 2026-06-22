# FINDINGS — T2 RECON: Chunk-extract → Kalkulátor

> **Type:** recon + failure diagnosis + transfer plan. **NOT implementation.** Gate reached, no prod code touched.
> **Branch:** `claude/chunk-extract-recon`
> **Date:** 2026-06-19 (recon run 2026-06-21)
> **Task:** `docs/tasks/TASK_chunk-extract-to-kalkulator_2026-06-19.md`
> **Status context:** `docs/handoff/STAVAGENT_STATUS_HANDOFF_2026-06-19.md` §11 (Analýza dokumentace), §6, §5 (шов).

---

## 0. TL;DR (the load-bearing conclusions)

1. **The chunk logic lives in two coupled Python modules in concrete-agent**, not in the kiosk:
   `app/services/document_chunker.py` (splitter) + `app/services/norm_ingestion_pipeline.py`
   (the per-chunk → merge → conflict → implications orchestrator). The kiosk frontend
   (`DocumentAnalysisPage.tsx`) is a thin uploader; it carries **no** chunk logic.

2. **"Failed on chunks" is MULTI-CAUSAL, not one bug.** Reading the code, the chunked pipeline
   does not crash — it **silently loses structure**. Three concrete, code-visible failure modes
   compound (§2). The single most important one for SmartInput V1: **the merge step flattens
   per-chunk facts into global de-duplicated lists, so facts that belong to the SAME structural
   element but were extracted from DIFFERENT chunks are never reassembled into one element** — the
   pipeline produces a bag of materials/dimensions, never a `list of structural elements`.

3. **There is already a LANDED, deterministic successor** that does exactly "document → quantified
   `elements[]`" and was explicitly designed to avoid the chunk failure: the
   `doc_to_quantified_elements` spec (P1/P2/P3 all merged — `docs/specs/doc_to_quantified_elements/design.md`).
   This changes the transfer recommendation: **do NOT port the chunk merge as-is; port/route through
   the element-assembly seam that already exists.** (§5)

4. **The Kalkulátor input seam is precise and small:** `useCalculator.ts:40–93` (`positionContext`)
   reads element fields **from URL query params** (`part_name`, `volume_m3`, `concrete_class`,
   `bedneni_m2`, `vyzuz_qty`, exposure, OTSKP code…). That is the exact place extracted elements
   feed in. No document parsing exists on the Kalkulátor side — input is one element at a time.

---

## 1. Recon Q1 — WHERE the chunk / document-analysis logic lives

### 1.1 Backend (concrete-agent) — the reusable core

| File | Role |
|---|---|
| `concrete-agent/packages/core-backend/app/services/document_chunker.py` | **The chunker.** `chunk_pdf_text(full_text, total_pages, doc_type)` → `List[(ChunkInfo, chunk_text)]`. Section-based (Czech TZ headings `4.1`, ALL-CAPS), page-group fallback, one-page-per-chunk for drawings, ≤5 pages → single chunk. Overlap = last 500 chars prepended. `_MAX_CHUNK_CHARS=25000`. |
| `concrete-agent/packages/core-backend/app/services/norm_ingestion_pipeline.py` | **The chunked orchestrator** — this is the heart. `NormIngestionPipeline.ingest()` runs L1 (pdfplumber/MinerU) → `chunk_pdf_text` → per-chunk [L2 regex + L3a Gemini] → `_merge_chunk_results` → `_detect_conflicts` → `_derive_domain_implications` → L3b Perplexity → `compile_rules`. Contains all merge/dedup/conflict/page-offset logic. |
| `concrete-agent/packages/core-backend/app/models/extraction_schemas.py` | Schemas: `ChunkInfo`, `ExtractedValue` (value+confidence+source+page+`chunk_id`), `ChunkExtractionResult`, `ExtractionResult` (flat lists: `materials`, `dimensions`, `norm_references`…), `FactConflict`, `DomainImplication`. |
| `concrete-agent/packages/core-backend/app/services/parsed_document_adapter.py` | `parsed_document_to_facts(ParsedDocument)` — Excel/XML path: each díl/chapter = a "chunk", positions → `ExtractedValue` facts (same flat shape). |
| `concrete-agent/packages/core-backend/app/services/extraction_to_facts_bridge.py` | `extraction_result_to_facts(ExtractionResult)` — converts the flat `ExtractionResult` into the calculator-suggestion fact-dict (groups by SO via regex on context/chunk title). **This is the closest existing "→ calculator" bridge.** |
| `concrete-agent/packages/core-backend/app/services/scenario_b_generator.py` | **Separate** TZ→elements LLM path: `_extract_elements` (Gemini, `EXTRACT_ELEMENTS_PROMPT`) → `elements[]` with `objem_m3`/`plocha_m2` → `_generate_positions`. **Not chunked** — single `text[:30000]` truncation. Closest existing "document → list of structural elements" shape, but LLM-first and truncating. |
| `concrete-agent/packages/core-backend/app/services/document_processor.py` | `DocumentProcessor.process()` — the **passport** path. L1 → regex (`CzechConstructionExtractor`) → `section_extraction_engine` (map-reduce) → L3 enrich. **Does NOT chunk** for AI; pdfplumber caps at 70 pages (`:472`), enrichment truncates. |

### 1.2 Wiring — which endpoint uses which path (the kiosk does NOT use the chunked pipeline)

- **Kiosk "Analýza dokumentace" → `POST /api/core/passport/generate`** → `routes_passport.py:46 generate_passport` → `DocumentProcessor.process()` (the **single-blob, truncating** path). Confirmed in `DocumentAnalysisPage.tsx:388`.
- **Chunked `NormIngestionPipeline.ingest()` is wired in two OTHER places only:**
  - `routes_nkb.py:233` (NKB norm ingestion)
  - `routes_project_documents.py:981` (`/api/v1/project/{id}/add-document`, fire-and-forget from the kiosk's *save* flow — `DocumentAnalysisPage.tsx:781 sendToCoreAddDocument`).

> **Provenance caveat:** the handoff says the kiosk "падал на чанках" (failed on chunks). By code, the kiosk's **primary** path (`passport/generate`) is the non-chunked `DocumentProcessor`; the **chunked** pipeline runs in the add-document/NKB side-channel. So "the kiosk failed on chunks" most plausibly refers to the chunked pipeline behind add-document/NKB (and the doc-direction in general), not the passport render. Both share the same upstream weakness (large-TZ handling), diagnosed below.

### 1.3 Frontend (stavagent-portal) — kiosk-bound, stays behind

`stavagent-portal/frontend/src/pages/DocumentAnalysisPage.tsx` (2210 lines) + `src/components/portal/DocumentAnalysis/*` (PassportTab, SoupisTab, AuditTab, SummaryTab, ComplianceTab, CrossValidationPanel, EngineExtractionsPanel). Pure upload/results UI. **No reusable extraction logic — all of it is display.**

---

## 2. Recon Q2 — WHY it failed on chunks (BY CODE; multi-causal)

The pipeline **does not throw** on the happy path. The "failure" is **structural information loss**.
Three independent, code-grounded mechanisms; they compound. Each given a confidence weight.

### Failure mode A — *element identity is destroyed at merge* (PRIMARY; the SmartInput lesson)

`_merge_chunk_results` (`norm_ingestion_pipeline.py:464`) concatenates every chunk's facts into
**global flat lists** and de-duplicates by bare value string:

```python
# norm_ingestion_pipeline.py:526
def _deduplicate_facts(facts: List[ExtractedValue]) -> List[ExtractedValue]:
    best: Dict[str, ExtractedValue] = {}
    for f in facts:
        key = str(f.value).strip().lower()        # ← key is the VALUE alone
        if key not in best or f.confidence > best[key].confidence:
            best[key] = f
    return list(best.values())
```

Consequences, all visible in code:

1. **No element grouping exists.** Output `ExtractionResult` has `materials[]`, `dimensions[]`,
   `norm_references[]` — a **bag of facts**, never `elements[]`. `extraction_schemas.py:100-138` has
   no element/structure container. "C35/45" from the deck chunk and "605 m³" from another chunk are
   never tied to the same element. The thing the calculator needs (`{element_type, volume_m3,
   concrete_class}` per element) **cannot be reconstructed** from this output.
2. **De-dup by value collapses repeated-but-distinct facts.** Two different opěry both "C30/37" → one
   survives. Two `15.0 m³` volumes for different elements → one survives. The `chunk_id` tag is set
   (`:487`) but de-dup ignores it — locality is thrown away exactly when needed to keep elements apart.
3. **"Conflict" detection is a weak proxy** (`_detect_conflicts:536`): only flags concrete grades
   differing *within one chunk_id*, treats exposure as additive. Cross-chunk, multi-element
   disagreements are not modelled — silently merged.

→ **SmartInput lesson:** carry an **element key** through the merge (group facts by element, not
de-dup by value), or document→elements is lost no matter how good per-chunk extraction is.

### Failure mode B — *kiosk's own primary path truncates large TZ* (the "big TZ" symptom)

Kiosk calls `passport/generate` → `DocumentProcessor`, **not chunked** for AI and **truncates**:
`document_processor.py:472` pdfplumber caps at `min(total_pages, 70)`; enrichment context truncated
(`passport_enricher.py:471`; comment `document_processor.py:1462`: *"AI output truncated at 8-16K
tokens → loses data from large TZ"*); sibling LLM extractor `scenario_b_generator.py:188` hard-cuts
`text[:30000]`. On a large multi-SO TZ the passport path loses the tail outright — a distinct "fails
on big docs" symptom even though no chunking is on that path.

### Failure mode C — *chunking heuristics misfire → wrong/garbage boundaries*

- `extract_text_from_pdf` (`norm_ingestion_pipeline.py:58`) reads only `pdf.pages[:50]` — pages 51+ never chunked.
- Page split depends on literal `--- PAGE BREAK ---` or `\n{4,}` (`document_chunker.py:96-104`); MinerU/recovery output without it collapses the doc to one "page", defeating page-group chunking.
- Section detection (`_SECTION_HEADING_RE:27`) needs ≥3 heading matches; otherwise falls back to fixed page groups, and the blind 500-char overlap (`_OVERLAP_CHARS`) can split a fact (`C30/` | `37`) across a boundary so neither chunk's regex matches.
- Per-chunk Gemini (`:749`) has **no cross-chunk state**; `merged.ai_summary = " | ".join(summaries)` (`:519`) just concatenates prose. A fact spanning a boundary is seen by neither call in full.

### Verdict on Q2 (honest, non-forced)

- **A — structural root cause** for "document → list of structural elements": the pipeline
  architecturally cannot emit elements. **High confidence** (from `_merge_chunk_results` +
  `_deduplicate_facts` + element-less schema).
- **B** explains the user-visible "big document breaks" on the kiosk's real primary path
  (truncation). **High confidence** (truncation sites).
- **C** explains thin/garbled results on awkward PDFs. **Medium-high confidence** (splitter heuristics).

They explain **different** observed failures (not the same symptom). Carry-forward for SmartInput is A
(+ avoid B's truncation by actually chunking, + harden C's boundaries).

---

## 3. Recon Q3 — reusable core vs kiosk-bound

### Reusable (front-half of the «шов»: document → element inputs)

- **Chunker** `document_chunker.py` — `chunk_pdf_text` + `detect_text_layer_quality`, generic/portable (after C hardening). Pure text-in / chunks-out.
- **L1 text cascade** — `document_processor.py::_extract_pdf_text` (pdfplumber → recovery → MinerU), the most complete extractor.
- **Per-chunk regex** `RegexNormExtractor` / `CzechConstructionExtractor` — deterministic, confidence=1.0.
- **Element shape that already exists** — `extract_tz_fields.py` emits the canonical `elements[]` (`{name, object_code, concrete_class, volume_m3=None, span_m, num_spans, is_prestressed, _source}`) the Kalkulátor/orchestrator consumes (§4 + `doc_to_quantified_elements/design.md §3`).
- **The deterministic join** `app/services/stage_gating/soupis_quantity_join.py` + `volume_geometry.py` (`map_soupis_to_elements`) — already groups facts **into elements** with provenance/honest-blank/divergence. **Correct replacement for failure-mode-A's flat merge.**

### Kiosk-bound — stays behind (do NOT carry)

- All of `DocumentAnalysisPage.tsx` + `components/portal/DocumentAnalysis/*` (pure display UI).
- The passport-render orientation (`DocumentProcessor` passport assembly, `PassportGenerationResponse`, passport tabs) — a *document-summary* product, not an element-input product; carries failure-mode B's truncation.
- `_merge_chunk_results` / `_deduplicate_facts` / `compile_rules` / NKB-rule compilation — serve the norm KB, embody failure-mode A. **Leave them on the NKB path; do not reuse as the calculator feed.**

---

## 4. Recon Q4 — Kalkulátor input integration point (exact seam)

**File:** `Monolit-Planner/frontend/src/components/calculator/useCalculator.ts`

- **`positionContext` — lines 40–93** is the single seam. Reads element input **from URL search params**:
  - `part_name` (`:46`) → auto-classified to `element_type` via `classifyElement(part_name, {is_bridge})` (`:168`)
  - `volume_m3` (`:79`), `concrete_class` (`:80`, also regex-extracted from `part_name` `:49`), `exposure_class` (`:53/:81`), `bedneni_m2` (`:84`) → `formwork_area_m2`, `vyzuz_qty` (`:86`) → `rebar_mass_kg`, `otskp_code` (`:91`), sibling TOV position IDs.
- **`initialForm` — lines 130–217** maps that context onto `FormState` (calculator's manual-entry shape; `components/calculator/types.ts`).
- **Lock semantics:** `position_id` present (`isTzContextLocked`, `:102`) → `element_type` + `volume_m3` authoritative/locked (`LOCKED_FIELDS`, `:121`).

**Implication:** the Kalkulátor accepts **one element at a time, via URL params**, from another kiosk
(Monolit position, Registry, Portal). It has **no document intake**. Feeding extracted elements in =
producing, per element, the same fields the parent kiosks already pass — i.e. the **`extract_tz_fields`
`elements[]` rows already match this seam field-for-field**. Integration = a list of element rows each
launchable into the calculator, not a new parser inside the calculator.

---

## 5. Transfer plan (saves the logic, does NOT resurrect the kiosk)

### Guiding finding

"document → quantified `elements[]`" **already landed** as `doc_to_quantified_elements` (P1 #1321 join,
P2 #1322 DOCUMENT_ANALYSIS wiring, P3 env-gated e2e — `design.md §12`). Deterministic,
provenance-tracked, honest-blank, **built to avoid failure-mode A** (groups soupis lines into elements
by `element_type`, never a flat value-deduped bag). So the transfer is mostly **routing + chunk
hardening**, not porting the broken merge.

### What to PORT / REUSE

1. **Chunker** (`document_chunker.py`) — keep, but **harden boundaries**: remove `pages[:50]` cap, stop depending on a literal `--- PAGE BREAK ---` marker (derive page boundaries from the L1 extractor), make overlap token/sentence-aware so it never splits a fact (`C30/` | `37`). (= failure-mode C.)
2. **L1 cascade** (`DocumentProcessor::_extract_pdf_text`) as the single text source for long docs (pdfplumber → recovery → MinerU); chunk onto full text instead of the pipeline's truncating inline extractor (= kills failure-mode B).
3. **Per-chunk regex** (`CzechConstructionExtractor`/`RegexNormExtractor`) — deterministic fact layer.
4. **Element assembly = the EXISTING join**, not `_merge_chunk_results`. Route chunked facts through `extract_tz_fields` → `map_soupis_to_elements` (`stage_gating/soupis_quantity_join.py`) so output is `elements[]` keyed by `element_type` with provenance + honest-blank.

### How it feeds the calculator

- **Output contract:** list of element rows = `{part_name/element_type, volume_m3, concrete_class, exposure_class, bedneni_m2?, vyzuz_qty?, otskp_code?, _source/confidence}` — the `extract_tz_fields` `elements[]` shape, which **already matches** `useCalculator.positionContext` field-for-field (§4).
- **Feed mechanism:** present elements as a pick-list (one row per element); launching a row opens the Kalkulátor with those fields as URL params (existing `positionContext` path) — no calculator-internal parser, no coupling of the calculator to extraction code. Honest-blank volumes arrive empty (calculator already treats `volume_m3<=0` as "not computed").

### What NOT to carry

- ❌ Kiosk UI (`DocumentAnalysisPage.tsx` + `DocumentAnalysis/*`).
- ❌ `_merge_chunk_results` / `_deduplicate_facts` as the calculator feed (failure-mode A). Leave on NKB.
- ❌ Passport-render path / truncation sites (failure-mode B).
- ❌ Any revival of the kiosk route in the Portal dashboard (out of scope per task + handoff §11).

---

## 6. Risks

1. **Re-introducing failure-mode A** — if the port reuses the flat `materials[]`/`dimensions[]` merge as calculator input instead of element-keyed assembly, the "no elements, deduped bag" bug ships into SmartInput. **Mitigation:** route through `map_soupis_to_elements`; assert output is `elements[]` with per-element provenance.
2. **Duplicating an already-landed capability** — `doc_to_quantified_elements` already does document→`elements[]`. **Mitigation:** treat this task as "feed the existing element-assembly with chunked full-text for long docs," not "rebuild extraction."
3. **Coupling the working calculator to deprecated code** — Kalkulátor is AKTIVNÍ, must stay decoupled. **Mitigation:** keep the seam at URL params (`positionContext`); extractor produces element rows out-of-band, calculator never imports extraction code.
4. **Chunk-boundary regressions on real TZ** (failure-mode C) if chunker ported unhardened (50-page cap, marker dependence, fact-splitting overlap). **Mitigation:** the three C fixes in §5 before reuse; test on a real multi-SO TZ (SO-202 fixtures under `test-data/`).
5. **Truncation silently returning** (failure-mode B) if the port keeps `text[:30000]` / `pages[:50]`. **Mitigation:** chunk full text via the L1 cascade; add an explicit "N pages / M chars processed of total" honest-coverage marker (mirrors Phase 0a completeness discipline).

---

## 7. Done-criteria check

- ✅ Concrete file paths named (chunker, orchestrator, schemas, adapters, kiosk UI, calculator seam).
- ✅ Chunk failure mode explained **by code** (`_deduplicate_facts` value-key, element-less `ExtractionResult` schema, truncation/`pages[:50]` sites, marker-dependent splitter) — flagged **multi-causal** with per-hypothesis confidence, not forced to one guess.
- ✅ Kalkulátor integration point identified exactly (`useCalculator.ts:40–93 positionContext`, URL params).
- ✅ Plan **saves the logic** (chunker + L1 + regex + existing element-assembly join), **does not resurrect the kiosk** (UI + merge + passport path left behind; calculator stays decoupled).
- ✅ No prod code changed. Stop at gate.

### Carry-forward to SmartInput V1 backlog (per task out-of-scope note)

The §2-A lesson (group facts by an element key through the merge; a flat value-deduped fact bag never
reassembles into `elements[]`) + §2-B/C (chunk the full text, don't truncate; harden boundaries) are
the input findings for the SmartInput PDF pipeline backlog item (root CLAUDE.md §"P2: SmartInput PDF
pipeline" / handoff §5 шов point 1).
