# Workflow A Specification: Cost Estimate & Documentation Pipeline

## 1. Purpose

Workflow A orchestrates the end-to-end processing of Czech/Slovak construction cost estimates (Rozpočet, Výkaz výmer) together with accompanying project documentation. The workflow ingests user uploads, parses and normalises the data, caches intermediate artefacts, and exposes interactive analysis tools that generate engineering deliverables on demand.

## 2. High-Level Flow

1. **Initialisation & Upload Handling** – accept files, resolve or create the project cache, persist raw artefacts.
2. **Parsing & Normalisation** – extract tabular positions, textual specifications, and drawing notes; harmonise fields and units.
3. **Validation** – enforce schema requirements, deduplicate, and classify positions by section.
4. **Caching** – persist consolidated project state so subsequent requests are incremental.
5. **Interactive Summaries** – produce project or section overviews when prompted by the user.
6. **Analysis Modules** – launch specialised reasoning flows (tech cards, resource schedules, material enrichment).
7. **Reporting** – emit PDF/XLSX/JSON artefacts that encapsulate the requested analysis.
8. **Status & Logging** – maintain operational telemetry and surfaced errors per project.

The workflow runs in a conversational UI: once parsing finishes the user sees actionable buttons (Summary, Tech Card, Resource Sheet, Material Lookup). Each activation reads from the cached project context and writes new results back to the same store.

## 3. Step-by-Step Details

### 3.1 Initialisation (Step 1)

- **Inputs:** uploaded Rozpočet / Výkaz výmer spreadsheets or XML files, PDF drawings, technical specifications.
- **Process:**
  - Compute or retrieve `project_id`.
  - If `/data/projects/{project_id}.json` exists, load cached state and refresh metadata.
  - Otherwise create `raw/{project_id}/`, persist uploads, and seed metadata.
- **Outputs:** in-memory project model with file references and timestamps.

### 3.2 Parsing & Normalisation (Steps 2–3)

- **Parsers:**
  - `excel_parser.py` / `xml_parser.py` extract position lists (`code`, `description`, `unit`, `quantity`, `section`).
  - `pdf_parser.py` captures textual layers from drawings and specifications (no OCR initially).
- **Normalisation:** unify column naming, convert measurement units, clean descriptions, enforce required fields.
- **Validation:** drop commentary rows, remove duplicates, and allocate positions to discipline buckets.
- **Outputs:**
  ```json
  {
    "project_id": "proj_xxxx",
    "positions": [...],
    "drawings_text": [...],
    "technical_specs": [...],
    "validated_positions": [...],
    "diagnostics": {...}
  }
  ```

### 3.3 Caching (Step 4)

Persist the merged structure as `/data/projects/{project_id}.json`. Repeated requests rehydrate this cache so subsequent analyses reuse prior work.

### 3.4 Summaries (Step 5)

Activated via the **📋 Summary** UI button. The AI receives the cached project data and instructions to produce an engineering overview (scope, goals, risk highlights, key quantities). Results are stored with metadata such as summary type (project vs. section) and headline figures.

### 3.5 Analysis Modules (Step 6)

Each module is triggered by a dedicated UI button and follows a deterministic pre/post pipeline around an LLM call.

#### Tech Card Generator (🧱 Pó postup prací)

1. Fetch the selected `position_id` from cache.
2. Infer work type (concrete, masonry, installation, etc.).
3. Load reference norms from `app/knowledge_base/B1`…`B9` as applicable.
4. Optionally enrich context through the Perplexity connector for up-to-date standards or materials.
5. Prompt the LLM as a site engineer to deliver structured outputs (work stages, captures, crews, equipment, resources, risks, timeline).
6. Save the response under `tech_plans[position_id]` in the project cache.

#### Resource Schedule (📦 Vedomost zdrojov)

1. Retrieve the existing tech card for the selected position (generate if missing).
2. Aggregate resource requirements across labour, materials, equipment.
3. Cross-check availability or references inside knowledge base folders and Perplexity results.
4. Emit a tabular dataset suitable for XLSX/PDF export.

#### Material Enrichment (🔍 Materiály)

1. Accept position descriptions or free-form material queries.
2. Use cached documents and Perplexity search snippets to build a knowledge pack.
3. Ask the LLM to return a material card covering analogues, compliance requirements, applications, compatibility notes.

### 3.6 Reporting (Step 7)

Use `report_generator.py` utilities to create user-facing artefacts:

- Project summaries, tech cards, or resource tables in PDF.
- Resource schedules exported to XLSX.
- JSON payloads returned to the web UI / API consumers.

Artefacts live under `/data/outputs/{project_id}/` and are linked in the conversation when ready for download.

### 3.7 Logging & Status (Step 8)

- Persist status fields (`status`, `progress`, `last_action`, timestamps) inside `project.json`.
- Write operational logs to `logs/workflow_a/{project_id}.log` with timestamps and error diagnostics.
- On exceptions, flag `status=failed` and capture `error_message` for surface in the UI.

## 4. Key Modules & Ownership

| Responsibility | Location | Notes |
| --- | --- | --- |
| Project cache lifecycle | `app/services/project_cache.py` | Load/save `project.json`, manage timestamps. |
| Structured document parsing | `app/parsers/excel_parser.py`, `app/parsers/xml_parser.py`, `app/parsers/pdf_parser.py` | Specialised extractors with fallbacks. |
| Data validation | `app/validators/validator.py` | Ensures schema completeness, removes duplicates. |
| AI reasoning | `app/ai/ai_reasoner.py` | Houses tech card and summary prompt logic. |
| Knowledge base | `app/knowledge_base/B1`–`B9` | Reference norms and material catalogues. |
| External enrichment | `app/api/perplexity_connector.py` | Interface to external search for modern norms/materials. |
| Report generation | `app/utils/report_generator.py` | Assemble PDF/XLSX exports. |
| Logging | `app/core/logger.py` | Central logging utility leveraged across services. |

## 5. User Journey Snapshot

1. Upload cost estimate and drawings.
2. System parses uploads, stores cache, and announces readiness.
3. UI displays actionable buttons (Summary, Tech Card, Resources, Materials).
4. User selects a position; system generates the corresponding tech card and resources.
5. Artefacts become available for download, while new insights persist in the project cache for reuse.

## 6. Prompt Preparation Guidance

When preparing prompts for Codex or other LLMs, ensure the request references the structured cache schema above, clarifies the active module, and supplies any required excerpts (e.g., position details, drawing snippets, knowledge base extracts). This keeps token usage efficient while maintaining deterministic pipeline behaviour.
