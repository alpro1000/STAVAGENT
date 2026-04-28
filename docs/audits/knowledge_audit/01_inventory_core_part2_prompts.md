# CORE Inventory — Part 2: `prompts/`

**Scope:** `concrete-agent/packages/core-backend/app/prompts/`
**Source:** Gate 1+2 Explore agent A (CORE)
**File counts:** ~23 prompt files across `claude/`, `gpt4/`, `hybrid/`, `roles/`, `resource_calculation/`, plus root-level `master_framework.txt` and `pdf_extraction_system_prompt_v2_1.py`.

---

## Counts

| Subfolder | Files | Total lines |
|-----------|-------|-------------|
| `roles/` | 7 | ~7,691 |
| `claude/assistant/` | 2 | 573 |
| `claude/parsing/` | 3 | 399 |
| `claude/audit/` | 1 | 214 |
| `claude/analysis/` | 1 | 32 |
| `claude/generation/` | 1 | 123 |
| `gpt4/ocr/` | 1 | 121 |
| `gpt4/vision/` | 1 | 205 |
| `hybrid/` | 2 | 968 |
| `resource_calculation/` | 1 | 294 |
| Root | 2 | varies |

---

## Inventory table

| path (rel to repo root) | size (lines) | content_type | theme | importers (top 3) | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `concrete-agent/.../app/prompts/master_framework.txt` | varies | text | prompts_framework | `services/resource_calculator.py`, `services/orchestrator.py` | 2026-04-19 | yes (`resource_calculation/master_framework.txt` is duplicate) | keep_in_place | Master framework prompt — single canonical copy |
| `prompts/pdf_extraction_system_prompt_v2_1.py` | varies | python | prompts_pdf_extract | `services/extracted_document_adapter.py` | 2026-04-19 | no | keep_in_place | System prompt for PDF extraction (v2.1); Python module for templating |
| `prompts/roles/concrete_specialist.md` | 1288 | markdown | role, concrete_domain | `services/provider_router.py`, `services/multi_role.py` | 2026-04-19 | no | keep_in_place | Concrete/reinforcement expert persona — embeds TKP18 + ČSN EN 206 rules |
| `prompts/roles/document_validator.md` | 1520 | markdown | role, validation | `services/audit_service.py` | 2026-04-19 | no | keep_in_place | Document validator + contradiction detection |
| `prompts/roles/orchestrator.md` | 1479 | markdown | role, orchestration | `services/orchestrator.py` | 2026-04-19 | no | keep_in_place | Master orchestrator persona |
| `prompts/roles/standards_checker.md` | 1339 | markdown | role, standards | `services/audit_service.py` | 2026-04-19 | no | keep_in_place | Norm conformance — embeds decision logic |
| `prompts/roles/structural_engineer.md` | 1143 | markdown | role, structural | `services/audit_service.py` | 2026-04-19 | yes (references `B2_csn_standards/VL_4_2021_Mosty_markdown.md` + `tkp_18.md`) | keep_in_place | Structural feasibility persona — VL 4 bridge rules embedded |
| `prompts/roles/cost_estimator.md` | 676 | markdown | role, costing | `services/audit_service.py` | 2026-04-19 | no | keep_in_place | Cost & schedule feasibility |
| `prompts/roles/standards_researcher.md` | 246 | markdown | role, research | `services/norm_advisor.py` | 2026-04-19 | no | keep_in_place | Perplexity-powered norm research |
| `prompts/claude/assistant/construction_expert.txt` | 193 | text | claude_assistant, expert | `services/construction_assistant.py` | 2026-04-19 | yes (`stav_expert_v2.txt` is newer fork) | refactor_split | v1 construction expert prompt — see merge note below |
| `prompts/claude/assistant/stav_expert_v2.txt` | 380 | text | claude_assistant, expert_v2 | `services/construction_assistant.py` | 2026-04-19 | yes (newer than `construction_expert.txt`) | merge_with | Newer v2 — recommend merge of `construction_expert.txt` + `stav_expert_v2.txt` → `construction_expert_v3.txt` |
| `prompts/claude/parsing/parse_kros_table_xml.txt` | 197 | text | claude_parsing, kros_xml | `services/kros_parser.py` | 2026-04-19 | no | keep_in_place | KROS Table-XML extraction prompt |
| `prompts/claude/parsing/parse_kros_unixml.txt` | 133 | text | claude_parsing, kros_unixml | `services/kros_parser.py` | 2026-04-19 | no | keep_in_place | KROS UNIXML format parsing |
| `prompts/claude/parsing/parse_vykaz_vymer.txt` | 69 | text | claude_parsing, vykaz_vymer | `services/extracted_document_adapter.py` | 2026-04-19 | no | keep_in_place | Výkaz výměr (BOQ) parsing prompt |
| `prompts/claude/audit/audit_position.txt` | 214 | text | claude_audit | none found | 2026-04-19 | partial (superseded by `roles/standards_checker.md`) | mark_legacy | Older audit prompt — no live importer |
| `prompts/claude/analysis/quick_preview.txt` | 32 | text | claude_analysis | none found | 2026-04-19 | no | mark_legacy | Quick-preview prompt — orphan, unused |
| `prompts/claude/generation/generate_from_drawings.txt` | 123 | text | claude_workflow_b | none found (Workflow B status unclear) | 2026-04-19 | no | unclear | Workflow B prompt — agent could not locate active importer; verify if Workflow B is still alive |
| `prompts/gpt4/ocr/scan_construction_drawings.txt` | 121 | text | gpt4_ocr | none found | 2026-04-19 | no | unclear | GPT-4 Vision OCR — agent could not find live integration |
| `prompts/gpt4/vision/analyze_technical_drawings.txt` | 205 | text | gpt4_vision | none found | 2026-04-19 | partial (overlaps `gpt4/ocr/`) | unclear | Alternate vision prompt — possibly duplicate of OCR; integration status unknown |
| `prompts/hybrid/compliance_and_risks.md` | 529 | markdown | hybrid, compliance | `services/orchestrator_hybrid.py` | 2026-04-19 | no | keep_in_place | Compliance & risk prompt across roles |
| `prompts/hybrid/comprehensive_analysis.md` | 439 | markdown | hybrid, analysis | `services/orchestrator_hybrid.py` | 2026-04-19 | no | keep_in_place | Comprehensive project analysis |
| `prompts/resource_calculation/master_framework.txt` | 294 | text | resource_framework | `services/resource_calculator.py` | 2026-04-19 | yes (duplicate of root `master_framework.txt`) | merge_with | Duplicate framework copy — consolidate into single root copy |

---

## Hotspots from this part

1. **Duplicate `master_framework.txt`** — exists at both `prompts/master_framework.txt` and `prompts/resource_calculation/master_framework.txt`. Current importers route to the resource-calculation copy. Resolution: pick one, delete the other.
2. **Dual construction-expert prompts** — `construction_expert.txt` (193 lines) + `stav_expert_v2.txt` (380 lines). Both imported by `services/construction_assistant.py`. Recommend single v3 merge.
3. **Workflow B / OCR / Vision prompts dangling** — 4 prompts with no live importer. Agent flagged `unclear`. Workflow B status needs human confirmation before delete.

---

End of part 2. Continued in `01_inventory_core_part3_engines.md` (services, classifiers, parsers + 8 hardcoded-norm hotspots).
