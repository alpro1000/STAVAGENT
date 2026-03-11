# Multi-Role Performance Optimization Analysis

**Дата:** 2025-12-28
**Проблема:** Sequential Multi-Role вызовы замедляют генерацию Summary
**Статус:** 🔴 Требует оптимизации

---

## 🐌 Текущая проблема

### Sequential Execution (по очереди)

```python
# Phase 2: Document Validator
validation_result = await ai_client.askMultiRole(question1)  # ⏱️ 10-15s

# Phase 3: Structural Engineer
materials_result = await ai_client.askMultiRole(question2)   # ⏱️ 10-15s

# Phase 4: Cost Estimator
cost_result = await ai_client.askMultiRole(question3)        # ⏱️ 10-15s

# Phase 5: Project Manager
timeline_result = await ai_client.askMultiRole(question4)    # ⏱️ 10-15s

# Phase 6: Risks
risks_result = await ai_client.askMultiRole(question5)       # ⏱️ 10-15s

# ⏱️ TOTAL: 50-75 seconds (МЕДЛЕННО!)
```

**Проблема:** Каждый вызов ждет предыдущий → суммарное время = сумма всех вызовов

---

## 📊 Dependency Analysis

### Граф зависимостей

```
Document Validator (DV)
  ↓
  ├─→ Structural Engineer (SE) ─→ Cost Estimator (CE)
  │                              ↓
  │                              Project Manager (PM)
  │                              ↓
  └──────────────────────────→ Risks Analysis (RA)

Sequential:  DV → SE → CE → PM → RA  (5 steps)
Parallel:    DV → [SE, RA] → [CE, PM]  (3 steps)
             ↓
             50-75s → 25-35s  (2-3x faster!)
```

### Независимые запросы (можно параллельно)

| Роль | Зависит от | Можно параллельно с |
|------|-----------|---------------------|
| **Document Validator** | - (первый) | - |
| **Structural Engineer** | DV (project params) | Risks Analysis |
| **Cost Estimator** | SE (materials) | - |
| **Project Manager** | SE (materials) | - |
| **Risks Analysis** | DV (requirements) | Structural Engineer |

---

## ✅ Решение 1: Parallel Execution (Рекомендуется)

### Оптимизированный Pipeline

```python
async def generate_project_summary_optimized(
    project_type: str,
    tz_content: Dict,
    specs: List[Dict],
    drawings: Dict,
    ai_client: MultiRoleClient
) -> ProjectSummary:
    """
    Optimized summary generation with parallel Multi-Role calls
    """

    # ========================================
    # PHASE 1: Document Validator (обязательно первый)
    # ========================================

    validation_result = await ai_client.askMultiRole(
        question=build_validation_question(tz_content, specs, drawings),
        context={"role_preference": "document_validator"}
    )
    # ⏱️ 10-15s

    requirements = extract_json_from_answer(validation_result['answer'])

    # Если completeness < 60%, остановить
    if requirements['completeness_score'] < 60:
        raise InsufficientDocumentationError(...)

    # ========================================
    # PHASE 2: Parallel execution (независимые запросы)
    # ========================================

    # Запускаем 2 роли ПАРАЛЛЕЛЬНО (asyncio.gather)
    materials_result, risks_result = await asyncio.gather(
        # Structural Engineer
        ai_client.askMultiRole(
            question=build_materials_question(requirements, drawings),
            context={"role_preference": "structural_engineer"}
        ),
        # Risks Analysis
        ai_client.askMultiRole(
            question=build_risks_question(requirements, project_type),
            context={"role_preference": "project_manager"}
        )
    )
    # ⏱️ 10-15s (вместо 20-30s!)

    materials = extract_json_from_answer(materials_result['answer'])
    risks = extract_json_from_answer(risks_result['answer'])

    # ========================================
    # PHASE 3: Parallel execution (зависят от materials)
    # ========================================

    # Запускаем 2 роли ПАРАЛЛЕЛЬНО
    cost_result, timeline_result = await asyncio.gather(
        # Cost Estimator
        ai_client.askMultiRole(
            question=build_cost_question(materials, requirements),
            context={"role_preference": "cost_estimator"}
        ),
        # Project Manager (timeline)
        ai_client.askMultiRole(
            question=build_timeline_question(materials, requirements),
            context={"role_preference": "project_manager"}
        )
    )
    # ⏱️ 10-15s (вместо 20-30s!)

    cost_estimate = extract_json_from_answer(cost_result['answer'])
    timeline = extract_json_from_answer(timeline_result['answer'])

    # ========================================
    # PHASE 4: Assemble summary
    # ========================================

    summary = ProjectSummary(...)
    return summary

# ⏱️ TOTAL: 30-45s (вместо 50-75s!)
# 🚀 Ускорение: 1.5-2x
```

### Performance Comparison

| Approach | Phases | Total Time | Speedup |
|----------|--------|-----------|---------|
| **Sequential** | 5 sequential calls | 50-75s | 1x |
| **Parallel (Phase 2+3)** | 3 phases (1 → 2 parallel → 2 parallel) | 30-45s | **1.5-2x** ⚡ |

---

## ✅ Решение 2: Batch Multi-Role API

### Концепция

Вместо 5 отдельных запросов → **1 batch запрос** с несколькими вопросами.

```python
# NEW: Batch Multi-Role API
batch_result = await ai_client.askMultiRoleBatch(
    questions=[
        {
            "id": "validation",
            "role": "document_validator",
            "question": "Validate completeness...",
            "depends_on": []
        },
        {
            "id": "materials",
            "role": "structural_engineer",
            "question": "Calculate materials...",
            "depends_on": ["validation"]  # Wait for validation
        },
        {
            "id": "risks",
            "role": "project_manager",
            "question": "Identify risks...",
            "depends_on": ["validation"]  # Can run parallel with materials
        },
        {
            "id": "cost",
            "role": "cost_estimator",
            "question": "Estimate costs...",
            "depends_on": ["materials"]  # Wait for materials
        },
        {
            "id": "timeline",
            "role": "project_manager",
            "question": "Create timeline...",
            "depends_on": ["materials"]  # Can run parallel with cost
        }
    ]
)

# Backend orchestrates parallel execution based on dependencies
# Returns all results at once

# ⏱️ TOTAL: 30-40s
# 🚀 Ускорение: 1.5-2x
```

### Backend Implementation (concrete-agent)

```python
# concrete-agent/packages/core-backend/app/api/routes_multi_role.py

@router.post("/api/v1/multi-role/batch")
async def multi_role_batch(request: MultiRoleBatchRequest):
    """
    Execute multiple Multi-Role questions in optimal order

    Uses dependency graph to parallelize independent queries
    """

    # Build dependency graph
    graph = DependencyGraph(request.questions)

    # Topological sort to find execution order
    execution_plan = graph.get_execution_plan()
    # Example: [[q1], [q2, q3], [q4, q5]]

    results = {}

    # Execute phases in order, parallelize within phase
    for phase in execution_plan:
        # Run all questions in this phase in parallel
        phase_results = await asyncio.gather(*[
            execute_multi_role_question(q, results)
            for q in phase
        ])

        # Store results for next phase
        for question, result in zip(phase, phase_results):
            results[question.id] = result

    return {
        "results": results,
        "total_time_seconds": calculate_total_time(),
        "phases_executed": len(execution_plan)
    }
```

---

## ✅ Решение 3: Streaming Responses (UX улучшение)

### Концепция

Даже если обработка занимает 30-45s, показывать прогресс в реальном времени:

```
User видит:
┌─────────────────────────────────────┐
│ 📊 Генерация саммари...              │
├─────────────────────────────────────┤
│ ✅ Document Validator    (100%)     │
│ ⏳ Structural Engineer   (60%)      │
│ ⏳ Risks Analysis        (45%)      │
│ ⏸️  Cost Estimator       (0%)       │
│ ⏸️  Project Manager      (0%)       │
├─────────────────────────────────────┤
│ Estimated time: 15 seconds          │
└─────────────────────────────────────┘
```

### Implementation (Server-Sent Events)

```python
# Backend: Streaming endpoint
@router.post("/api/workflow/c/summary/stream")
async def generate_summary_stream(request: Request):
    """
    Generate summary with streaming progress updates
    """

    async def event_stream():
        # Phase 1
        yield f"data: {json.dumps({'phase': 'validation', 'status': 'started'})}\n\n"

        validation_result = await ai_client.askMultiRole(...)

        yield f"data: {json.dumps({'phase': 'validation', 'status': 'completed', 'progress': 20})}\n\n"

        # Phase 2 (parallel)
        yield f"data: {json.dumps({'phase': 'materials', 'status': 'started'})}\n\n"
        yield f"data: {json.dumps({'phase': 'risks', 'status': 'started'})}\n\n"

        materials, risks = await asyncio.gather(...)

        yield f"data: {json.dumps({'phase': 'materials', 'status': 'completed', 'progress': 50})}\n\n"
        yield f"data: {json.dumps({'phase': 'risks', 'status': 'completed', 'progress': 50})}\n\n"

        # ... и т.д.

        # Final result
        yield f"data: {json.dumps({'status': 'completed', 'summary': summary.dict()})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

```javascript
// Frontend: EventSource for streaming
const eventSource = new EventSource('/api/workflow/c/summary/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.status === 'started') {
    updateProgress(data.phase, 'running');
  } else if (data.status === 'completed') {
    updateProgress(data.phase, 'done', data.progress);
  }

  if (data.status === 'completed' && data.summary) {
    displaySummary(data.summary);
    eventSource.close();
  }
};
```

---

## ✅ Решение 4: Caching (долгосрочная оптимизация)

### Кэширование похожих запросов

```python
# Cache key based on project parameters
cache_key = generate_cache_key(
    project_type="bridge",
    span_length=50,
    deck_width=12,
    concrete_volume=1175
)

# Check cache first
cached_result = cache.get(cache_key)
if cached_result and cached_result['confidence'] >= 0.75:
    logger.info(f"Cache hit for {cache_key}")
    return adjust_cached_result(cached_result, current_project)

# Generate new summary
summary = await generate_project_summary(...)

# Cache result for 7 days
cache.set(cache_key, summary, ttl=7*24*3600)
```

### Cache Storage

```sql
CREATE TABLE summary_cache (
  cache_key VARCHAR(255) PRIMARY KEY,
  project_type VARCHAR(50),
  parameters JSONB,  -- span_length, deck_width, etc.
  summary JSONB,
  confidence FLOAT,
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  hit_count INT DEFAULT 0
);

CREATE INDEX idx_summary_cache_type ON summary_cache(project_type);
CREATE INDEX idx_summary_cache_expires ON summary_cache(expires_at);
```

---

## ✅ Решение 5: Simplified Multi-Role для Summary

### Концепция

Использовать **меньше ролей** с **более простыми промптами** для быстрой генерации summary.

### Current (Complex): 5 ролей
```
1. Document Validator (completeness)
2. Structural Engineer (materials)
3. Cost Estimator (cost)
4. Project Manager (timeline)
5. Risks Analysis (risks)

Total: 50-75s
```

### Simplified: 2 роли
```
1. Project Analyzer (all-in-one)
   - Completeness
   - Materials
   - Cost estimate
   - Timeline

2. Risk Assessor
   - Risks
   - Assumptions

Total: 20-30s
🚀 Ускорение: 2-3x
```

### Implementation

```python
# Simplified approach
async def generate_project_summary_fast(
    project_type: str,
    tz_content: Dict,
    specs: List[Dict],
    drawings: Dict
) -> ProjectSummary:
    """
    Fast summary generation with fewer AI calls
    """

    # Single comprehensive prompt
    main_result = await ai_client.askMultiRole(
        question=f"""
        Analyze this {project_type} project and provide comprehensive summary.

        TZ Content: {tz_content}
        Drawings: {drawings['specifications'][:20]}

        Provide JSON with:
        1. Client Requirements (main_goal, parameters, special_requirements)
        2. Materials (concrete: total_m3, breakdown, classes, exposure)
        3. Cost Estimate (total_czk, breakdown by phase, confidence)
        4. Timeline (total_months, milestones with durations)

        Return as structured JSON.
        """,
        context={"enable_kb": True}
    )
    # ⏱️ 15-20s (all-in-one)

    # Risks in parallel (optional)
    risks_result = await ai_client.askMultiRole(
        question=build_risks_question(...),
        context={"role_preference": "project_manager"}
    )
    # ⏱️ 10-15s (parallel with final processing)

    # Assemble summary
    summary = ProjectSummary(...)
    return summary

# ⏱️ TOTAL: 20-30s
# 🚀 Ускорение: 2-3x
```

---

## 📊 Performance Comparison Summary

| Approach | AI Calls | Total Time | Speedup | Complexity |
|----------|----------|-----------|---------|-----------|
| **Sequential (current)** | 5 sequential | 50-75s | 1x | Low |
| **Parallel Phases** | 5 (3 phases) | 30-45s | **1.5-2x** ⚡ | Medium |
| **Batch API** | 1 batch (5 questions) | 30-40s | **1.5-2x** ⚡ | High |
| **Streaming (UX)** | 5 (perceived faster) | 30-45s | **Feels 2x faster** 👁️ | Medium |
| **Simplified (2 roles)** | 2 sequential | 20-30s | **2-3x** ⚡⚡ | Low |
| **Hybrid (Simplified + Parallel)** | 2 parallel | 15-20s | **3-4x** ⚡⚡⚡ | Medium |

---

## 🎯 Рекомендация: Hybrid Approach

### Лучшая комбинация

```python
async def generate_project_summary_hybrid(
    project_type: str,
    tz_content: Dict,
    specs: List[Dict],
    drawings: Dict
) -> ProjectSummary:
    """
    Hybrid approach: Simplified + Parallel + Streaming

    Speedup: 3-4x (50-75s → 15-20s)
    """

    # Start streaming
    yield {"status": "started", "progress": 0}

    # Phase 1: Parallel execution of 2 comprehensive prompts
    yield {"phase": "analysis", "status": "started", "progress": 10}

    main_result, risks_result = await asyncio.gather(
        # Comprehensive project analysis (all-in-one)
        ai_client.askMultiRole(
            question=build_comprehensive_question(...),
            context={"enable_kb": True}
        ),
        # Risks analysis
        ai_client.askMultiRole(
            question=build_risks_question(...),
            context={"role_preference": "project_manager"}
        )
    )
    # ⏱️ 15-20s (parallel)

    yield {"phase": "analysis", "status": "completed", "progress": 80}

    # Phase 2: Assemble summary
    yield {"phase": "assembly", "status": "started", "progress": 80}

    summary = assemble_summary(main_result, risks_result)

    yield {"status": "completed", "progress": 100, "summary": summary}

    return summary

# ⏱️ TOTAL: 15-20s
# 🚀 Ускорение: 3-4x
# 👁️ UX: Streaming progress
```

---

## 🚀 Implementation Timeline

| Phase | Task | Duration |
|-------|------|----------|
| **Phase 1** | Implement parallel execution (asyncio.gather) | 0.5 дня |
| **Phase 2** | Optimize prompts (simplified approach) | 0.5 дня |
| **Phase 3** | Add streaming (Server-Sent Events) | 1 день |
| **Phase 4** | Implement caching layer | 1 день |
| **Phase 5** | Testing + optimization | 0.5 дня |
| **Total** | | **3.5 дня** |

---

## 📝 Next Steps

1. **Immediate (Quick Win):** Implement parallel execution для независимых запросов
   - Файл: `wbs_generator.py`
   - Change: Sequential → `asyncio.gather()`
   - Speedup: 1.5-2x
   - Time: 0.5 дня

2. **Short-term:** Optimize prompts (simplified approach)
   - Reduce from 5 roles to 2 comprehensive prompts
   - Speedup: 2-3x total
   - Time: 0.5 дня

3. **Medium-term:** Add streaming UI
   - Show progress in real-time
   - Better UX даже если время то же
   - Time: 1 день

4. **Long-term:** Caching layer
   - Cache похожих проектов
   - Instant results для repeated patterns
   - Time: 1 день

---

**Автор:** Claude (AI Assistant)
**Дата:** 2025-12-28
**Версия:** 1.0
**Статус:** ✅ Готово к оптимизации
