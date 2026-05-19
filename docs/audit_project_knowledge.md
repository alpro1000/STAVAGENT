# Audit Project Knowledge — STAVAGENT

> Дата: 19.05.2026
> Цель: классифицировать все существующие документы в Project Knowledge по 4 категориям SDD:
> **Steering** (постоянный контекст проекта) — **Spec** (требования к фиче) — **Bug** (баг-реестр) — **Other** (handoff, reference, archive)
>
> После этой классификации существующие документы либо переносятся в нужную папку `docs/`, либо удаляются из Project Knowledge как устаревшие.

---

## 1. Принцип классификации

| Категория | Что туда идёт | Куда переносить в репо |
|---|---|---|
| **Steering** | Постоянный контекст: архитектура, доменные правила, философия, конвенции, стек | `docs/steering/*.md` |
| **Spec** | Требования к конкретной фиче с EARS criteria + design + tasks | `docs/specs/{feature_name}/` |
| **Bug** | Конкретный баг: report → analyze → fix → verify | `docs/bugs/{bug_id}/` |
| **Reference** | Каталоги, примеры, golden tests, нормативные шаблоны | `docs/reference/` |
| **Handoff** | Снимки состояния сессии для следующей | `docs/handoff/` |
| **Archive** | Завершено и нерелевантно | удалить из Project Knowledge |

---

## 2. Существующие meta-документы — куда

| Файл | Категория | Назначение |
|---|---|---|
| `STAVAGENT_Master_Brief.md` | **Steering → product.md** | Источник для разделов "что строим", позиционирование, CSC strategy |
| `STAVAGENT_Project_Knowledge_Snapshot.md` | **Steering (multi)** | Главный источник для tech.md + structure.md + domain.md |
| `STAVAGENT_Architecture_Notes.md` | **Steering → structure.md** | Архитектурные решения |
| `STAVAGENT_Agent_First_Architecture_Vision.md` | **Steering → tech.md** | Vision для tech.md секции AI/MCP |
| `STAVAGENT_ClaudeCode_Session_Mantra.md` | **Steering → conventions.md** | Правила работы с Claude Code (отдельный steering файл) |
| `KNOWLEDGE_PLACEMENT_GUIDE.md` | **Steering → domain.md** | B0-B9 структура, нормативный layer |
| `CALCULATOR_PHILOSOPHY.md` | **Steering → domain.md** | Философия точности ±10-15% |
| `STAVAGENT_Chat_Handoff_2026-05-11.md` | **Handoff** | `docs/handoff/2026-05-11.md` |
| `STAVAGENT_Project_Knowledge_Snapshot.md` секция 11 ("Conventions") | **Steering → conventions.md** | Naming rules, communication style |

---

## 3. TASK_*.md файлы — классификация

### 3.1 Сразу в bugs (имеют признак "fix/critical/bugs")

| Файл | Bug ID | Где разместить |
|---|---|---|
| `TASK_Calculator_FinalFixes_Session_20260414.md` | calc-finals-20260414 | `docs/bugs/calc-finals-20260414/` |
| `TASK_Critical_Aplikovat_Timeout_ProjectID.md` | aplikovat-timeout | `docs/bugs/aplikovat-timeout/` |
| `TASK_Fix_Rimsa_Element.md` | rimsa-element | `docs/bugs/rimsa-element/` |
| `TASK_Calculator_BridgeBugs_PodpernaKonstrukce.md` | bridge-podperna | `docs/bugs/bridge-podperna/` |
| `TASK_Calculator_MostovkaCriticalBugs.md` | mostovka-critical | `docs/bugs/mostovka-critical/` |
| `TASK_LinkedPositions_DeleteRow_GanttColors.md` | linked-positions-ux | `docs/bugs/linked-positions-ux/` |
| `TASK_Calculator_BugfixAndSmartHints.md` | calc-bugfix-hints | `docs/bugs/calc-bugfix-hints/` |
| `TASK_Calculator_UX_Fixes_AIAudit.md` | calc-ux-aiaudit | `docs/bugs/calc-ux-aiaudit/` |

**Для каждого:** перепаковать содержимое в 4 файла (`report.md`, `analyze.md`, `fix.md`, `verify.md`). Если в TASK уже есть analyze/fix — переразложить.

### 3.2 Сразу в specs (полноценные фичи)

| Файл | Spec name | Где разместить |
|---|---|---|
| `TASK_Security_AccountIsolation_PortalNav.md` | cross-user-isolation | `docs/specs/cross-user-isolation/` ⚠️ **P0 ПЕРЕД CEMEX** |
| `TASK_MCP_Server_AllModules.md` | mcp-server-completion | `docs/specs/mcp-server-completion/` |
| `TASK_MCP_Security.md` | mcp-policy-engine | `docs/specs/mcp-policy-engine/` ⚠️ **CEMEX 28.06** |
| `TASK_MCP_Deploy_Auth_Billing_Listings.md` | mcp-deploy-auth | `docs/specs/mcp-deploy-auth/` |
| `TASK_ChunkedExtractionAgent.md` | chunked-extraction | `docs/specs/chunked-extraction/` |
| `TASK_DocumentToCalculatorBridge.md` | document-bridge | `docs/specs/document-bridge/` |
| `TASK_SmartExtractor_VariantB_FormulaGeometry_Vision.md` | smartextractor-variant-b | `docs/specs/smartextractor-variant-b/` |
| `TASK_DocumentExtraction_Universal_Pipeline_v3.md` | universal-doc-pipeline-v3 | `docs/specs/universal-doc-pipeline-v3/` |
| `TASK_TZ_to_Soupis_Pipeline_v3.md` | tz-to-soupis | `docs/specs/tz-to-soupis/` |
| `TASK_VZ_Scraper_WorkPackages_v3.md` | vz-scraper | `docs/specs/vz-scraper/` |
| `TASK_Classifier_BridgeContext_FullMapping.md` | classifier-bridge | `docs/specs/classifier-bridge/` |
| `TASK_NKB_AUDIT.md` | nkb-audit | `docs/specs/nkb-audit/` |
| `TASK_DeepSeek_ShadowMode_Comparison.md` | deepseek-shadow | `docs/specs/deepseek-shadow/` |
| `TASK_DeepSeek_Fallback_Gemini.md` | deepseek-fallback | `docs/specs/deepseek-fallback/` |
| `TASK_UWO_Bridge_Ontology.md` | uwo-bridge-ontology | `docs/specs/uwo-bridge-ontology/` |
| `TASK_Phase4_DocumentExtract.md` | phase4-document-extract | `docs/specs/phase4-document-extract/` |
| `TASK_Phase5_WorkDecomposition_Catalog.md` | phase5-work-decomposition | `docs/specs/phase5-work-decomposition/` |
| `TASK_Phase1_KnowledgeInventory.md` | phase1-knowledge-inventory | `docs/specs/phase1-knowledge-inventory/` |
| `TASK_ProjectSync_PortalRegistryPlanner.md` | project-sync | `docs/specs/project-sync/` |
| `TASK_TZ_Registry_FlatTable_XC4.md` | tz-registry-flat | `docs/specs/tz-registry-flat/` |

**Для каждого:** перепаковать в 3 файла (`requirements.md`, `design.md`, `tasks.md`). Большинство TASK уже содержат "Acceptance criteria" — переделать в EARS-формат.

### 3.3 Calculator-related specs (выделить отдельную группу)

Группа `docs/specs/calculator/*/` — у тебя их много, лучше сделать sub-domain:

| Файл | Spec name |
|---|---|
| `TASK_Calculator_DualMode_UX.md` | calculator/dual-mode-ux |
| `TASK_Calculator_AutoCalc_Variants_Aplikovat.md` | calculator/autocalc-variants |
| `TASK_Calculator_4Improvements_RealCase.md` | calculator/4-improvements |
| `TASK_Calculator_Wizard_StepByStep.md` | calculator/wizard-stepwise |
| `TASK_Calculator_SparyAndCost_AllBlocks.md` | calculator/spary-cost |
| `TASK_Calculator_Pilota_SpecialFlow.md` | calculator/pilota-flow |
| `TASK_Calculator_ExposureAndRebarDefaults.md` | calculator/exposure-rebar |
| `TASK_Calculator_UISimplification_StrategicSplit.md` | calculator/ui-split |
| `TASK_01_Calculator_TZContext_LockFromParent.md` | calculator/tz-context-lock |

### 3.4 Element-specific specs (`element/` sub-domain)

| Файл | Spec name |
|---|---|
| `rimsa_element_spec_v1.md` | element/rimsa-v1 (archived, see v2) |
| `rimsa_element_spec_v2_DOKA_PERI.md` | element/rimsa-v2-doka-peri |
| `TASK_Mostovka_Prestress_Subtypes_Formwork.md` | element/mostovka-prestress |
| `TASK_Mostovka_Complete_NKTypes_Prestress.md` | element/mostovka-nktypes |
| `TASK_Mostovka_BridgeTechnology_MSS.md` | element/mostovka-mss |
| `TASK_Mostovka_FullAudit_LiveTest.md` | element/mostovka-fullaudit |
| `TASK_Podperna_Konstrukce_Kanonicka_Terminologie.md` | element/podperna-canonical |
| `STAVAGENT_Complete_Element_Catalog.md` | **Reference** → `docs/reference/element_catalog.md` |
| `formwork_catalog_PERI_DOKA_2025.md` | **Reference** → `docs/reference/formwork_catalog_2025.md` |
| `SKRUZ_TERMINOLOGIE_KANONICKA.md` | **Reference** → `docs/reference/skruz_terminology.md` |
| `SKRUZ_TERMINOLOGIE_KANONICKA_Section9.md` | **Reference** → склеить с предыдущим |

### 3.5 Project-specific specs (под конкретные TZ)

| Файл | Spec/Reference | Куда |
|---|---|---|
| `TASK_HK212_*` (5 файлов) | Specs | `docs/specs/hk212/{phase0b,phase1-etap1,urs-kiosk,urs-scraper,phase2-1}/` |
| `TASK_RD_Jachymov_Phase0b_for_ClaudeCode.md` | Spec | `docs/specs/rd-jachymov-phase0b/` |
| `TASK_Zihle_PhaseD_SoupisAndTZ.md` | Spec | `docs/specs/zihle-phased/` |
| `TASK_Zihle_XLSX_Hygiene_Kfely_Recalibration.md` | Spec | `docs/specs/zihle-xlsx-hygiene/` |

### 3.6 Golden tests — Reference

| Файл | Куда |
|---|---|
| `SO-202_D6_most_golden_test.md` | `docs/reference/golden_tests/so202_d6.md` |
| `SO-250_golden_test.md` | `docs/reference/golden_tests/so250.md` |
| `VP4_FORESTINA_operna_zed_golden_test.md` | `docs/reference/golden_tests/vp4_forestina.md` |
| `SO-250_smartextractor_probe.md` | `docs/reference/golden_tests/so250_probe.md` |
| `SO-250_calculator_test_log.md` | `docs/reference/golden_tests/so250_log.md` |
| `SO250_briefing_calculator_test.md` | `docs/reference/golden_tests/so250_briefing.md` |

### 3.7 Architecture docs (Reference, не Steering)

| Файл | Куда |
|---|---|
| `document-bridge-architecture.md` | `docs/reference/architecture/document_bridge.md` |
| `document-bridge-architecture.json` | `docs/reference/architecture/document_bridge.json` |
| `document-bridge-review-response.md` | `docs/reference/architecture/document_bridge_review.md` |
| `object-types-taxonomy.md` | `docs/reference/architecture/object_types_taxonomy.md` |
| `calculator_element_logic_v4_FINAL.md` | `docs/reference/architecture/calculator_v4_logic.md` |
| `calculator_complete_pipeline.md` | `docs/reference/architecture/calculator_pipeline.md` |
| `STAVAGENT_Pipeline_Service_Spec_v1.md` | `docs/reference/architecture/pipeline_service_v1.md` |
| `TZ_Rozpocet_Registry.md` | `docs/reference/architecture/tz_rozpocet_registry.md` |

### 3.8 Findings / Audits (Reference)

| Файл | Куда |
|---|---|
| `FINDINGS_SmartExtractor_2026-05-10.md` | `docs/reference/findings/smartextractor_20260510.md` |
| `TASK_AIBlock_Audit_TextSmartInput.md` | `docs/reference/audits/aiblock_textsmartinput.md` |
| `TASK_FullUI_Audit_AllCommits.md` | `docs/reference/audits/fullui_allcommits.md` |
| `TASK_Alice_Competitive_Audit.md` | `docs/reference/audits/alice_competitive.md` |
| `TASK_Registry_Inventory_Audit.md` | `docs/reference/audits/registry_inventory.md` |
| `REBAR_NORMS_COMPREHENSIVE_AUDIT.md` | `docs/reference/audits/rebar_norms.md` |

### 3.9 Marketing / Strategy

| Файл | Куда |
|---|---|
| `STAVAGENT_Landing_Page_Schema_v2.md` | `docs/reference/marketing/landing_schema.md` |
| `STAVAGENT_Video_Presentation_Guide.md` | `docs/reference/marketing/video_guide.md` |
| `STAVAGENT_Competitive_Landscape_Cemex_CSC.md` | `docs/reference/marketing/cemex_csc.md` |

### 3.10 Skills / Playbooks (Steering или Reference)

| Файл | Куда |
|---|---|
| `SKILL_stavagent_dxf_exhaustive.md` | `docs/reference/playbooks/dxf_exhaustive.md` |
| `STAVAGENT_Drawings_to_VV_Rozpocet_Playbook.md` | `docs/reference/playbooks/drawings_to_vv.md` |

### 3.11 Codex specifications (отдельный sub-domain)

| Файл | Куда |
|---|---|
| `CODEX_TASK_GEOMETRY_CALCULATOR.md` | `docs/specs/geometry-calculator/` (req+design+tasks split) |
| `GeometryCalculator.jsx` | `docs/specs/geometry-calculator/reference_prototype.jsx` |

### 3.12 Briefings / Prompts (Handoff)

| Файл | Куда |
|---|---|
| `BRIEFING_NextChat_ElementTechSheets.md` | `docs/handoff/element_techsheets_brief.md` |
| `PROMPT_NextChat_02042026.md` | `docs/handoff/20260402.md` |
| `TASK_MonolitPlanner_PartA_Rewrite.md` | `docs/handoff/monolit_partA_rewrite.md` |

### 3.13 Code artifacts (НЕ markdown — рассмотреть отдельно)

| Файл | Что с этим делать |
|---|---|
| `stavagent_skills_and_project_guide.py` | Это код, не док. Должен быть в репо, не в docs/. Скорее всего уже есть. |
| `norm_ingestion_pipeline.py` | То же — это код. |
| `normative_knowledge_base.py` | То же — код. |
| `add_document_endpoint.py` | То же — код. |
| `rematch_kros_catalog_v2_1.py` | То же — код. |
| `diagnose_hk212.py` | Скрипт диагностики, в `scripts/` репо. |
| `kros_extractor_v8_3.py` | Код. |
| `setup_hk212_hala.sh` | Скрипт, в `scripts/` репо. |
| `CLAUDE_md_phase0b_section.md` | Фрагмент CLAUDE.md — слить в основной CLAUDE.md |

**Эти Python-файлы в Project Knowledge — устаревшая практика. Они должны быть в коде репо, не в knowledge.** Удалить из Project Knowledge.

### 3.14 Document blueprints (Steering)

| Файл | Куда |
|---|---|
| `STAVAGENT_ClaudeCode_Task_UnifiedItemLayer.docx` | конвертировать в MD → `docs/specs/unified-item-layer/` |
| `STAVAGENT_Task_UnifiedItemLayer_v2_OTSKP_URS_RTS.docx` | то же, v2 |
| `TASK_TZ_to_Soupis_Pipeline.md` (старая) | archive — заменена v3 |
| `SPEC_Registry_RibbonRefactor.md` | `docs/specs/registry-ribbon-refactor/` |
| `TASK_Aplikovat_TOV_LinkByCode.md` | `docs/specs/aplikovat-tov-link/` |
| `TASK_Terminology_MSS_Combined.md` | `docs/specs/terminology-mss-combined/` |

### 3.15 TZ PDFs (Reference data, не doc)

| Файл | Куда |
|---|---|
| `250_*.pdf` (9 файлов SO-250 Žalmanov) | Это исходные данные. Должны быть в GCS bucket, не в репо. **Удалить из Project Knowledge, оставить только pointer в `docs/reference/golden_tests/so250_data_pointer.md`** |

### 3.16 Прочее

| Файл | Куда |
|---|---|
| `TASK_Phase_6_5_Spalety_PerRoom_Fix.md` | `docs/bugs/libuse-spalety-perroom/` |
| `TASK_MCP_PricingSync_FastMCPMount.md` | `docs/specs/mcp-pricing-sync/` |
| `TASK_MCP_SchemaEnrichment_GoldenValidation.md` | `docs/specs/mcp-schema-enrichment/` |
| `TASK_MegaPour_CrewLogic_Warnings.md` | `docs/specs/megapour-crew-logic/` |
| `TASK_ClaudeCode_EffortSettings.md` | `docs/reference/playbooks/claude_code_settings.md` |
| `TASK_SmartInput_DocumentBridge.md` | `docs/specs/smartinput-document-bridge/` |

---

## 4. Сводка

| Категория | Кол-во файлов |
|---|---|
| Steering (4 канонических) | 4 (создаются заново из существующих meta) |
| Specs | ~50+ (после перепаковки из TASK_*) |
| Bugs | ~10 |
| Reference | ~30+ |
| Handoff | ~5 |
| Archive (удалить) | ~15 (TZ PDFs, .py-файлы, дубликаты) |

---

## 5. Порядок миграции (что делать сначала)

### Этап 1 — фундамент (на этой неделе)

1. **Создать `docs/steering/{product,tech,structure,domain}.md`** — уже сгенерированы в этом запросе
2. **Создать `docs/soul.md`** — уже сгенерирован
3. **Создать `docs/templates/`** — уже сгенерированы

### Этап 2 — критичные specs (W2)

4. Перепаковать `TASK_Security_AccountIsolation_PortalNav.md` → `docs/specs/cross-user-isolation/` (P0 перед Cemex)
5. Перепаковать `TASK_MCP_Security.md` → `docs/specs/mcp-policy-engine/` (Cemex 28.06)
6. Перепаковать `TASK_MCP_Server_AllModules.md` → `docs/specs/mcp-server-completion/`

### Этап 3 — остальные (W3-W4)

7. Bugs батчем — перенос с разбиением на 4-х файловую структуру
8. Specs батчем — перенос с EARS-форматом acceptance
9. Reference дамп — просто перенос без переделки

### Этап 4 — чистка Project Knowledge

10. Удалить из Project Knowledge всё что мигрировано
11. Оставить в Project Knowledge только:
    - `docs/steering/` (для быстрого доступа claude.ai)
    - `docs/soul.md` (living memory)
    - Активные specs в работе (1-2 штуки)

---

## 6. Что НЕ переносится

- TZ PDFs (исходные данные, в GCS)
- `.py` файлы (исходный код, в репо)
- Дубликаты (rimsa_v1 после v2, TZ_to_Soupis старая после v3)

---

**End of audit.**
