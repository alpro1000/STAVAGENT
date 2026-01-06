# NEXT SESSION: Implementation Phase

**Date:** 2026-01-06 (Updated)
**Branch:** `claude/update-session-docs-nKEk1`
**Status:** Portal Fix Complete, Ready for Multi-Role Optimization

---

## ✅ SESSION 2026-01-06: Portal Project Creation Fixed

### Problem
Portal project creation returned error: `"Unexpected token '<', '<!DOCTYPE...' is not valid JSON"`

### Root Cause
1. **Backend not running** - no processes on port 3001
2. **Missing .env file** - `DISABLE_AUTH=true` not configured
3. **Vite proxy failed** - returned HTML (index.html) instead of JSON when backend unavailable

### Solution
1. Created `.env` file with `DISABLE_AUTH=true` for DEV MODE
2. Installed dependencies (`npm install` in backend/, frontend/, shared/)
3. Started backend on port 3001
4. Started frontend on port 5173
5. Verified Vite proxy works correctly

### Files Changed
- `stavagent-portal/backend/.env` - Created (gitignored)
- `stavagent-portal/backend/.env.example` - Added DISABLE_AUTH documentation

### Quick Start (Local Development)
```bash
# 1. Backend
cd stavagent-portal/shared && npm install && npm run build
cd ../backend && npm install
cp .env.example .env  # Edit DISABLE_AUTH=true
npm run dev  # Port 3001

# 2. Frontend (new terminal)
cd stavagent-portal/frontend && npm install
npm run dev  # Port 5173

# 3. Open http://localhost:5173
```

---

## 📋 COMMAND FOR NEXT SESSION

```
Начинаем фазу реализации после завершения анализа.

Приоритет 1 (НАЧАТЬ С ЭТОГО): Multi-Role Performance Optimization
- Цель: Ускорить генерацию Project Summary с 50-75 секунд до 15-20 секунд (3-4x)
- Метод: Параллельное выполнение + упрощение промптов (5 ролей → 2 комплексных)
- Файлы: concrete-agent/packages/core-backend/app/services/multi_role.py
- Время: 3.5 дня
- Детали: См. URS_MATCHER_SERVICE/MULTI_ROLE_OPTIMIZATION.md

Сначала реализуй Multi-Role оптимизацию, потому что:
1. Самый быстрый результат (3.5 дня vs 6-7 дней для Workflow C)
2. Немедленное улучшение производительности для пользователей
3. Подготовит backend для Workflow C и Summary Module
4. Низкий риск - изолированное изменение в одном сервисе

После завершения оптимизации спроси что делать дальше:
- Summary Module (7 дней) - можно сделать независимо
- Workflow C Backend (6-7 дней) - требует интеграции всех парсеров
```

---

## 🎯 Current Context (Session 2025-12-28)

### Completed Analysis (5 documents, 3846 lines)

| Document | Purpose | Commit | Status |
|----------|---------|--------|--------|
| `DOCUMENT_PARSING_ANALYSIS.md` | Gap analysis - current vs expected | `135a03e` | ✅ |
| `PARSERS_INVENTORY.md` | 7 CORE parsers inventory + usage matrix | `94e5f8e` | ✅ |
| `WORKFLOW_C_COMPLETE.md` | Workflow C spec with Project Summary | `3133481` | ✅ |
| `SUMMARY_MODULE_SPEC.md` | Summary module architecture | `f7668ee` | ✅ |
| `MULTI_ROLE_OPTIMIZATION.md` | Performance optimization analysis | `c1fc81b` | ✅ |

**Location:** `URS_MATCHER_SERVICE/` directory

### Ready for Implementation (3 features)

1. **Multi-Role Optimization** - 3.5 days ⭐ START HERE
2. **Summary Module** - 7 days
3. **Workflow C Backend** - 6-7 days

---

## 🚀 PRIORITY 1: Multi-Role Optimization (3.5 days)

### Goal
Reduce Project Summary generation time from 50-75s to 15-20s (3-4x speedup)

### Current Problem
```python
# Sequential execution (SLOW)
validation = await askMultiRole(...)  # 10-15s
materials = await askMultiRole(...)   # 10-15s
cost = await askMultiRole(...)        # 10-15s
timeline = await askMultiRole(...)    # 10-15s
risks = await askMultiRole(...)       # 10-15s
# Total: 50-75s
```
Sheet 1: Souhrn
  - Project name, export date
  - Executive summary (wrapped text)
  - Key findings (bullet list)
  - Recommendations (bullet list)

### Solution: Hybrid Approach
1. **Simplify prompts:** 5 roles → 2 comprehensive queries
2. **Parallel execution:** Run both queries simultaneously with `asyncio.gather()`
3. **Streaming updates:** Show progress to user via Server-Sent Events

### Implementation Plan

#### Day 1: Analysis & Refactoring (8 hours)
**Location:** `concrete-agent/packages/core-backend/`

**Tasks:**
1. Create dependency graph of current Multi-Role queries
2. Identify which queries can run in parallel
3. Design 2 comprehensive prompts to replace 5 separate queries
4. Write tests for new prompts

**Files to modify:**
```
app/services/multi_role.py
app/api/routes_multi_role.py
```

**Code example:**
```python
# New comprehensive prompts

COMPREHENSIVE_ANALYSIS_PROMPT = """
Проанализируй проект {project_type} на основе документов:

1. МАТЕРИАЛЫ И ОБЪЁМЫ:
   - Какие материалы нужны? (бетон, арматура, опалубка)
   - Сколько каждого материала? (в стандартных единицах)
   - Какие классы/марки? (C30/37, B500B, и т.д.)

2. СТОИМОСТЬ:
   - Общая стоимость проекта
   - Разбивка по категориям (материалы, работа, техника)
   - Стоимость за м³ бетона

3. СРОКИ:
   - Общая длительность (месяцы)
   - Основные вехи и фазы
   - Критический путь

Используй базу знаний (KROS, RTS, ČSN нормы).
Отвечай структурированно в JSON формате.
"""

RISKS_ANALYSIS_PROMPT = """
Проанализируй риски и допущения для проекта {project_type}:

1. ТЕХНИЧЕСКИЕ РИСКИ:
   - Сложности конструкции
   - Требования к качеству
   - Критичные параметры

2. ОРГАНИЗАЦИОННЫЕ РИСКИ:
   - Доступность материалов
   - Квалификация персонала
   - Погодные условия

3. ДОПУЩЕНИЯ:
   - Что предполагается о проекте?
   - Какие данные отсутствуют?
   - Рекомендации по уточнению

Отвечай в JSON формате.
"""
```

#### Day 2: Parallel Execution Implementation (8 hours)

**Tasks:**
1. Implement `asyncio.gather()` for parallel queries
2. Add error handling for partial failures
3. Add timeout management per query
4. Write unit tests

**New function:**
```python
async def generate_project_summary_optimized(
    project_type: str,
    tz_content: Dict,
    specs: List[Dict],
    drawings: Dict,
    ai_client: MultiRoleClient
) -> ProjectSummary:
    """
    Optimized summary generation with parallel execution

    Speedup: 3-4x (50-75s → 15-20s)
    """

    # Build context from documents
    context = {
        "project_type": project_type,
        "tz_content": tz_content,
        "specs": specs,
        "drawings": drawings
    }

    # Execute 2 comprehensive queries IN PARALLEL
    try:
        main_result, risks_result = await asyncio.gather(
            ai_client.askMultiRole(
                question=COMPREHENSIVE_ANALYSIS_PROMPT.format(
                    project_type=project_type
                ),
                context={
                    **context,
                    "enable_kb": True,
                    "timeout": 30
                }
            ),
            ai_client.askMultiRole(
                question=RISKS_ANALYSIS_PROMPT.format(
                    project_type=project_type
                ),
                context={
                    **context,
                    "role_preference": "project_manager",
                    "timeout": 30
                }
            )
        )
        # ⏱️ Total time: 15-20s (parallel execution)

    except Exception as e:
        logger.error(f"Multi-Role parallel execution failed: {e}")
        # Fallback to sequential if parallel fails
        main_result = await ai_client.askMultiRole(...)
        risks_result = await ai_client.askMultiRole(...)

    # Assemble summary from results
    summary = assemble_summary(main_result, risks_result)

    return summary


def assemble_summary(main_result: Dict, risks_result: Dict) -> ProjectSummary:
    """Combine results into ProjectSummary object"""
    return ProjectSummary(
        client_requirements=main_result.get("requirements", {}),
        materials=main_result.get("materials", []),
        cost_estimate=main_result.get("cost", {}),
        timeline=main_result.get("timeline", {}),
        risks_assumptions=risks_result.get("risks", [])
    )
```

#### Day 3: Streaming Updates (SSE) (6 hours)

**Tasks:**
1. Implement Server-Sent Events endpoint
2. Add progress tracking for each query
3. Update frontend to show real-time progress
4. Test streaming in browser

**Backend (FastAPI SSE):**
```python
from fastapi.responses import StreamingResponse
import asyncio

@router.post("/api/v1/summaries/generate/stream")
async def generate_summary_stream(request: SummaryRequest):
    """
    Stream progress updates while generating summary
    """
    async def event_generator():
        try:
            # Send progress: Starting
            yield f"data: {json.dumps({'status': 'starting', 'progress': 0})}\n\n"
            await asyncio.sleep(0.1)

            # Send progress: Analyzing
            yield f"data: {json.dumps({'status': 'analyzing', 'progress': 30})}\n\n"

            # Execute parallel queries
            main_result, risks_result = await asyncio.gather(
                ai_client.askMultiRole(...),
                ai_client.askMultiRole(...)
            )

            # Send progress: Assembling
            yield f"data: {json.dumps({'status': 'assembling', 'progress': 80})}\n\n"

            # Assemble summary
            summary = assemble_summary(main_result, risks_result)

            # Send final result
            yield f"data: {json.dumps({'status': 'complete', 'progress': 100, 'summary': summary.dict()})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```
src/components/PositionsTable.tsx
  - Removed overflow:hidden from part panels
  - Added orange styling to "Přidat část konstrukce" button

**Frontend (EventSource):**
```javascript
const eventSource = new EventSource('/api/v1/summaries/generate/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.status === 'starting') {
    updateProgress(0, 'Начинаем анализ...');
  } else if (data.status === 'analyzing') {
    updateProgress(30, 'Анализируем документы...');
  } else if (data.status === 'assembling') {
    updateProgress(80, 'Формируем резюме...');
  } else if (data.status === 'complete') {
    updateProgress(100, 'Готово!');
    displaySummary(data.summary);
    eventSource.close();
  } else if (data.status === 'error') {
    showError(data.message);
    eventSource.close();
  }
};
```

#### Day 3.5: Testing & Documentation (4 hours)

**Tasks:**
1. Write integration tests
2. Benchmark performance (before/after)
3. Update API documentation
4. Create migration guide

**Performance Test:**
```python
import pytest
import time

@pytest.mark.asyncio
async def test_summary_generation_performance():
    """Test that optimized summary generation is 3x faster"""

    # Prepare test data
    project_type = "bridge_overpass"
    tz_content = load_test_tz()
    specs = load_test_specs()
    drawings = load_test_drawings()

    # Measure optimized version
    start = time.time()
    summary = await generate_project_summary_optimized(
        project_type, tz_content, specs, drawings, ai_client
    )
    optimized_duration = time.time() - start

    # Verify performance
    assert optimized_duration < 25, f"Optimized version too slow: {optimized_duration}s"

    # Verify completeness
    assert summary.materials is not None
    assert summary.cost_estimate is not None
    assert summary.timeline is not None
    assert summary.risks_assumptions is not None

    print(f"✅ Optimized generation: {optimized_duration:.1f}s")
```
concrete-agent/packages/core-backend/app/services/document_accumulator.py (+150 lines)
  - ProjectVersion dataclass
  - _versions storage Dict[str, List[ProjectVersion]]
  - _create_version_snapshot() method
  - _compare_summaries() method
  - get_project_versions() method
  - get_version() method
  - compare_versions() method
  - export_to_excel() method
  - export_summary_to_pdf() method

### Files to Create/Modify

**Create:**
```
concrete-agent/packages/core-backend/app/services/summary_generator_optimized.py
concrete-agent/packages/core-backend/tests/test_summary_performance.py
```

**Modify:**
```
concrete-agent/packages/core-backend/app/api/routes_multi_role.py
concrete-agent/packages/core-backend/app/services/multi_role.py
```

### Success Criteria
- ✅ Summary generation time < 25 seconds
- ✅ All tests passing
- ✅ Streaming progress updates working
- ✅ Fallback to sequential execution on error
- ✅ Documentation updated

---

## 📦 PRIORITY 2: Summary Module (7 days)

**Status:** Postponed until Priority 1 complete

**See:** `URS_MATCHER_SERVICE/SUMMARY_MODULE_SPEC.md` for full specification

**Quick summary:**
- Database table `project_summaries`
- API endpoints for generate, get, update, approve, export
- React modal with 5 tabs (Overview, Materials, Cost, Timeline, Risks)
- Export in PDF, Excel, JSON formats

---

## 🔄 PRIORITY 3: Workflow C Backend (6-7 days)

**Status:** Postponed until Priority 1 & 2 complete

**See:** `URS_MATCHER_SERVICE/WORKFLOW_C_COMPLETE.md` for full specification

**Quick summary:**
- Document upload & parsing with all 7 parsers (including MinerU)
- Project essence analysis
- Work Breakdown Structure (WBS) generation
- Integration with URS Matcher for code matching

---

## 📊 Progress Tracking

### Analysis Phase (COMPLETED ✅)
- [x] Document Parsing Analysis (484 lines) - `135a03e`
- [x] Parsers Inventory (838 lines) - `94e5f8e`
- [x] Workflow C Specification (1018 lines) - `3133481`
- [x] Summary Module Architecture (933 lines) - `f7668ee`
- [x] Multi-Role Optimization Analysis (573 lines) - `c1fc81b`

### Implementation Phase (PENDING)
- [ ] Multi-Role Optimization (3.5 days) ⭐ NEXT
- [ ] Summary Module (7 days)
- [ ] Workflow C Backend (6-7 days)

**Total Implementation Time:** ~17 days (2-3 weeks)

---

## 🔧 Environment Setup

**Branch:**
```bash
git checkout claude/update-documentation-logo-fixes-gHv9C
# OR create new feature branch:
git checkout -b claude/implement-multi-role-optimization-<SESSION_ID>
```

**Services to run:**
```bash
# concrete-agent CORE
cd concrete-agent
npm run dev:backend  # Port 8000

# URS Matcher (for testing)
cd URS_MATCHER_SERVICE
npm run dev  # Port 3001
```

**Testing:**
```bash
# Run tests
cd concrete-agent/packages/core-backend
pytest tests/test_summary_performance.py -v

# Benchmark
pytest tests/test_summary_performance.py --benchmark
```

### Manual Deploy Instructions (concrete-agent)

## 📝 Implementation Checklist

### Phase 1: Multi-Role Optimization (Day 1-3.5)
- [ ] Day 1: Analyze dependencies, design 2 comprehensive prompts
- [ ] Day 2: Implement parallel execution with asyncio.gather()
- [ ] Day 3: Add streaming progress updates (SSE)
- [ ] Day 3.5: Write tests, benchmark performance, update docs

### Phase 2: Summary Module (Day 4-10)
- [ ] Create database table `project_summaries`
- [ ] Implement backend API (generate, get, update, approve, export)
- [ ] Build frontend SummaryModal with 5 tabs
- [ ] Implement export service (PDF, Excel, JSON)
- [ ] Add version control
- [ ] Write tests

### Phase 3: Workflow C Backend (Day 11-17)
- [ ] Create `/workflow/c/import` endpoint
- [ ] Implement parser selection logic
- [ ] Integrate MinerU for PDF parsing
- [ ] Create WBS generator
- [ ] Add database tables for WBS
- [ ] Write tests

---

## 🎯 Quick Start Command

```bash
# 1. Checkout branch
git checkout claude/update-documentation-logo-fixes-gHv9C

# 2. Read optimization spec
cat URS_MATCHER_SERVICE/MULTI_ROLE_OPTIMIZATION.md

# 3. Read session summary
cat URS_MATCHER_SERVICE/SESSION_2025-12-28.md

# 4. Start with Day 1 tasks:
#    - Analyze current Multi-Role code
#    - Design 2 comprehensive prompts
#    - Identify parallel execution opportunities

# 5. Files to focus on:
#    - concrete-agent/packages/core-backend/app/services/multi_role.py
#    - concrete-agent/packages/core-backend/app/api/routes_multi_role.py
```

---

## 📊 Session Summary (2025-12-28)

| Task | Time Spent | Status | Files |
|------|------------|--------|-------|
| Document Parsing Analysis | 45 min | ✅ Complete | DOCUMENT_PARSING_ANALYSIS.md |
| Parsers Inventory | 1.5 hours | ✅ Complete | PARSERS_INVENTORY.md |
| Workflow C Specification | 1.5 hours | ✅ Complete | WORKFLOW_C_COMPLETE.md |
| Summary Module Architecture | 1.5 hours | ✅ Complete | SUMMARY_MODULE_SPEC.md |
| Multi-Role Optimization Analysis | 1 hour | ✅ Complete | MULTI_ROLE_OPTIMIZATION.md |
| **TOTAL** | **~6 hours** | **All Complete** | **5 documents, 3846 lines** |

**Commits:**
```
c1fc81b - PERF: Multi-Role optimization analysis - parallel execution strategy
f7668ee - SPEC: Project Summary as Separate Module with Export
3133481 - WORKFLOW C: Complete specification with Project Summary
94e5f8e - INVENTORY: Complete parsers analysis + Workflow C strategy
135a03e - ANALYSIS: Document parsing logic review for URS Matcher
```

---

## 🔍 Key Findings

### 1. Document Parsing Gap
**Problem:** URS Matcher doesn't parse documents or analyze project essence

**Solution:** Workflow C with comprehensive document analysis using all 7 parsers

### 2. Parser Underutilization
**Problem:** MinerU installed but not used, parsers not fully leveraged

**Solution:** Parser selection matrix based on file type, size, content

### 3. Multi-Role Performance Bottleneck
**Problem:** Sequential execution takes 50-75 seconds

**Solution:** Parallel execution + simplified prompts = 15-20 seconds (3-4x speedup)

---

**Ready to start:** Multi-Role Optimization (Priority 1)
**Estimated time:** 3.5 days
**Expected result:** 3-4x speedup (50-75s → 15-20s)

**Branch:** `claude/update-documentation-logo-fixes-gHv9C`
**Last Updated:** 2025-12-28
