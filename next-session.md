# Next session

## Next step
Deploy all services to Cloud Run and run Calculator Suggestions E2E test (upload real TZ PDF → Core extraction → Monolit Planner → verify SuggestionBadge appears for correct SO).

## Context
- New files: `document_chunker.py`, `parsed_document_adapter.py`, `extraction_to_facts_bridge.py` in `concrete-agent/packages/core-backend/app/services/`
- `_PROJECT_FACTS` persisted to `data/projects/{id}.json` key `calculator_facts` (write-through, lazy-load from disk)
- 102 tests pass: `test_chunked_extraction.py` (44) + `test_extraction_to_facts_bridge.py` (18) + `test_calculator_suggestions.py` (40)

## Open questions
- Golden test with real PDF (AC9 from chunked extraction task) — needs a real 10+ page TZ Statika file
- `document_meta` merge in `_merge_chunk_results` uses first-wins strategy — may need highest-confidence merge later

## Do not touch
- `extraction_schemas.py` v2.0 — ChunkInfo, ChunkExtractionResult, FactConflict, DomainImplication models
- `norm_ingestion_pipeline.py` v2.0 — chunked orchestrator (L1→Chunk→per-chunk[L2+L3a]→Merge→L3b)
- `calculator_suggestions.py` — write-through persistence, XF4 warning, eviction guard
- `routes_project_documents.py` — bridge integration in both PDF and Excel paths
- Monolit frontend (PlannerPage.tsx) — SuggestionBadge + DocWarningsBanner already work, do not rewrite
- Monolit backend (planner-advisor.js) — proxy route already works with 15s timeout + graceful degradation
- CLAUDE.md v4.3.0 — just updated, 234 lines
