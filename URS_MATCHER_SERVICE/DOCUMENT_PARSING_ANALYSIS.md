# URS Matcher - Document Parsing Logic Analysis

**Дата:** 2025-12-28
**Статус:** 🔴 **КРИТИЧЕСКАЯ ПРОБЛЕМА** - Workflow не соответствует ожиданиям

---

## 🎯 Ожидания vs Реальность

### ❌ Текущий Workflow URS Matcher (Реальность)

```
1. Upload Excel (BOQ)
   ↓
2. Parse Excel → Extract rows
   ↓
3. Match каждую строку с URS кодом
   ↓
4. Return results
```

**Проблемы:**
- ❌ НЕТ парсинга PDF/DOCX/TZ документов
- ❌ НЕТ анализа сути проекта
- ❌ НЕТ создания списка работ из требований
- ❌ НЕТ интеграции с парсерами CORE для понимания документации

---

### ✅ Ожидаемый Workflow (Требование пользователя)

```
1. Upload документы (PDF/DOCX/DWG + TZ + спецификации)
   ↓
2. 🧠 ПАРСЕРЫ ИЗ ЯДРА (concrete-agent CORE) анализируют суть:
   - SmartParser → извлекает текст, структуру
   - GPT-4 Vision → анализирует чертежи
   - Multi-Role AI → понимает требования, типы работ
   ↓
3. 📋 СОЗДАНИЕ СПИСКА РАБОТ (Work Breakdown Structure):
   - Понять тип проекта (мост/здание/тоннель)
   - Наметить вехи (фундамент → стены → перекрытия → кровля)
   - Создать подробный список работ
   ↓
4. 🔍 ПОИСК URS КОДОВ:
   - Для каждой работы из списка найти соответствующий URS код
   - Gemini + Local DB + Perplexity (fast pipeline)
   - Multi-Role AI validation (advanced pipeline)
   ↓
5. Return structured results with work list + URS codes
```

---

## 🔍 Анализ Текущей Архитектуры

### 1. URS_MATCHER_SERVICE

**Endpoint:** `POST /api/jobs/document-upload`

**Что делает:**
```javascript
1. Upload файлов (PDF/DOCX/DWG/JPG)
2. Validate file content (validateFileContent)
3. Check document completeness (validateDocumentCompleteness)
4. Return completeness score
```

**Что НЕ делает:**
- ❌ НЕ парсит содержимое документов
- ❌ НЕ извлекает список работ
- ❌ НЕ вызывает concrete-agent парсеры

**Файл:** `backend/src/api/routes/jobs.js:1533-1682`

---

### 2. concrete-agent CORE (Ядро)

**Endpoint:** `POST /api/upload`

**Workflow A - Что делает:**
```python
1. Upload vykaz_vymer (BOQ Excel) + vykresy (DWG/PDF)
2. SmartParser → parse BOQ → extract positions
3. DrawingSpecsParser → parse drawings → extract specs
4. PositionEnricher → enrich positions from drawings
5. Validation → SpecificationsValidator
6. Audit → AuditClassifier (GREEN/AMBER/RED)
7. Return audited positions
```

**Файл:** `concrete-agent/packages/core-backend/app/services/workflow_a.py:66-215`

**Что НЕ делает:**
- ❌ НЕ анализирует ТЗ (техническое задание) для создания Work List
- ❌ НЕ парсит DOCX/PDF документацию (только BOQ в Excel)
- ❌ НЕ создает пошаговый список работ из требований

---

### 3. Интеграция URS Matcher ↔ concrete-agent

**Файл:** `backend/src/services/multiRoleClient.js`

**Что делает:**
```javascript
- askMultiRole(question) → вызов /api/v1/multi-role/ask
- validateBoqBlock(boqBlock) → валидация блока BOQ
- verifyUrsCode(workDescription, ursCode) → проверка URS кода
- resolveUrsConflict(workDescription, ursCandidates) → выбор лучшего кода
```

**Что НЕ делает:**
- ❌ НЕТ функции для парсинга документов
- ❌ НЕТ функции для создания Work List из TZ
- ❌ НЕТ integration с Workflow A upload endpoint

---

## 🚨 Критические Недостатки

### Проблема 1: Нет парсинга документации

**Текущая ситуация:**
- URS Matcher принимает PDF/DOCX файлы
- НО только валидирует их наличие
- НЕ парсит содержимое

**Последствия:**
- Нельзя загрузить ТЗ (техническое задание) и получить список работ
- Нельзя автоматически создать BOQ из документации проекта

---

### Проблема 2: Нет интеграции с парсерами CORE

**Текущая ситуация:**
- concrete-agent имеет SmartParser для Excel/PDF
- concrete-agent имеет DrawingSpecsParser для чертежей
- URS Matcher НЕ использует эти парсеры

**Последствия:**
- Дублирование кода (нужно создать парсеры в URS Matcher)
- Нет единого подхода к парсингу в системе STAVAGENT

---

### Проблема 3: Нет создания Work List

**Текущая ситуация:**
- URS Matcher ожидает готовый список работ (Excel BOQ)
- Нет функции для создания списка работ из ТЗ/спецификаций

**Последствия:**
- Пользователь должен вручную создавать Excel BOQ
- Нельзя автоматизировать процесс "Документация → Work List → URS codes"

---

## ✅ Предлагаемое Решение

### Вариант 1: Новый Workflow C (Рекомендуется)

**Создать Workflow C в concrete-agent CORE:**

```python
# concrete-agent/packages/core-backend/app/api/routes_workflow_c.py

@router.post("/api/workflow/c/import")
async def workflow_c_import(
    technical_zadanie: UploadFile,      # ТЗ (PDF/DOCX)
    specifications: List[UploadFile],    # Спецификации
    drawings: List[UploadFile],          # Чертежи
    project_type: str                    # "bridge" | "building" | "tunnel"
):
    """
    Workflow C: Document Analysis → Work List Generation

    1. Parse TZ using SmartParser + OCR
    2. Extract project requirements (type, scope, materials)
    3. Analyze drawings with GPT-4 Vision
    4. Generate Work Breakdown Structure using Multi-Role AI:
       - Document Validator → validate completeness
       - Project Manager → create WBS
       - Structural Engineer → define structural work
       - Concrete Specialist → define concrete work
       - Cost Estimator → estimate quantities
    5. Return structured work list with:
       - Work phases (milestones)
       - Detailed work items
       - Quantities (if available)
       - Units (m3, m2, kg, etc.)
    """

    # Step 1: Parse TZ
    tz_content = await SmartParser.parse_document(technical_zadanie)

    # Step 2: Extract project info
    project_info = extract_project_info(tz_content, project_type)

    # Step 3: Analyze drawings
    drawing_specs = await DrawingSpecsParser.parse_all(drawings)

    # Step 4: Generate WBS using Multi-Role AI
    wbs = await generate_work_breakdown_structure(
        project_info=project_info,
        tz_content=tz_content,
        drawing_specs=drawing_specs,
        project_type=project_type
    )

    # Step 5: Return work list
    return {
        "project_id": project_id,
        "project_type": project_type,
        "work_list": wbs.items,         # List of work items
        "milestones": wbs.milestones,   # Project phases
        "estimated_duration": wbs.duration_days,
        "next_step": "Match with URS codes using /api/urs-matcher/match-work-list"
    }
```

---

### Вариант 2: Расширение Workflow A

**Добавить в Workflow A support для TZ:**

```python
# Modify existing /api/upload endpoint

@router.post("/api/upload")
async def upload_project(
    ...
    # NEW: Technical zadanie
    technical_zadanie: UploadFile = File(
        None,
        description="Technical zadanie (TZ) - project requirements"
    ),

    # NEW: WBS generation mode
    generate_wbs: bool = Form(
        default=False,
        description="Generate Work Breakdown Structure from TZ"
    )
):
    """
    Enhanced Workflow A with WBS generation
    """

    if generate_wbs and technical_zadanie:
        # Parse TZ
        tz_content = await SmartParser.parse_document(technical_zadanie)

        # Generate WBS
        wbs = await generate_wbs_from_tz(tz_content, project_type)

        # Convert WBS to positions
        positions = convert_wbs_to_positions(wbs)
    else:
        # Original logic: parse vykaz_vymer
        positions = await parse_vykaz_vymer(vykaz_vymer)

    # Continue with existing workflow (enrichment, validation, audit)
    ...
```

---

### Вариант 3: URS Matcher standalone парсинг (НЕ рекомендуется)

**Создать парсеры в URS Matcher:**

❌ **Проблемы:**
- Дублирование кода (парсеры уже есть в CORE)
- Нарушение архитектуры STAVAGENT (CORE = единый парсер для всех kiosks)
- Сложность поддержки (2 набора парсеров)

---

## 🎯 Рекомендуемый Plan

### Phase 1: Workflow C - Document Analysis (2-3 дня)

**Задачи:**

1. **Создать Workflow C endpoint в concrete-agent**
   - File: `concrete-agent/packages/core-backend/app/api/routes_workflow_c.py`
   - Endpoint: `POST /api/workflow/c/import`
   - Accepts: TZ (PDF/DOCX), specifications, drawings

2. **Реализовать WBS Generator**
   - File: `concrete-agent/packages/core-backend/app/services/wbs_generator.py`
   - Functions:
     - `parse_technical_zadanie(tz_file)` → extract requirements
     - `generate_work_breakdown_structure(project_info)` → create WBS using Multi-Role AI
     - `convert_wbs_to_positions(wbs)` → convert to BOQ format

3. **Multi-Role AI для WBS**
   - Use Project Manager role to create milestones
   - Use Structural Engineer to define structural work
   - Use Concrete Specialist to define concrete work
   - Use Cost Estimator to estimate quantities

---

### Phase 2: URS Matcher Integration (1-2 дня)

**Задачи:**

1. **Создать новый endpoint в URS Matcher**
   - File: `backend/src/api/routes/jobs.js`
   - Endpoint: `POST /api/jobs/match-work-list`
   - Accepts: work_list (from Workflow C)
   - Returns: URS codes for each work item

2. **Интеграция с Workflow C**
   - File: `backend/src/services/coreClient.js` (NEW)
   - Function: `uploadToWorkflowC(files, project_type)` → call CORE Workflow C
   - Function: `getWorkList(project_id)` → retrieve WBS from CORE

3. **UI для Workflow C**
   - File: `frontend/public/index.html`
   - Add new section: "Upload TZ + Документы → Создать список работ"
   - Show work list before matching
   - Allow user to edit/approve work list

---

### Phase 3: Testing + Documentation (1 день)

**Задачи:**

1. **Test Cases:**
   - Upload TZ for bridge project → verify WBS
   - Upload TZ for building project → verify WBS
   - Match WBS with URS codes → verify results

2. **Documentation:**
   - Update `CLAUDE.md` with Workflow C architecture
   - Create `WORKFLOW_C_GUIDE.md` for users
   - Update API documentation

---

## 📊 Сравнение Вариантов

| Аспект | Workflow C (Новый) | Расширение Workflow A | URS Matcher standalone |
|--------|-------------------|----------------------|----------------------|
| **Архитектура** | ✅ Чистая, отдельный workflow | ⚠️ Усложняет Workflow A | ❌ Дублирование кода |
| **Поддержка** | ✅ Легко поддерживать | ⚠️ Смешанная логика | ❌ Сложно синхронизировать |
| **Переиспользование** | ✅ Другие kiosks могут использовать | ✅ Да | ❌ Только URS Matcher |
| **Время разработки** | ⚠️ 3-4 дня | ✅ 2-3 дня | ❌ 4-5 дней |
| **Качество WBS** | ✅ Специализированный | ✅ Хорошее | ⚠️ Ниже (нет CORE AI) |
| **Интеграция с CORE** | ✅ Нативная | ✅ Нативная | ❌ Через API calls |

**Рекомендация:** ✅ **Workflow C** (лучший баланс качества и архитектуры)

---

## 🔧 Технические Детали

### Work Breakdown Structure (WBS) Format

```json
{
  "project_id": "proj_abc123",
  "project_type": "bridge",
  "project_name": "Most přes řeku Vltava",
  "milestones": [
    {
      "id": "M1",
      "name": "Přípravné práce",
      "phase": "preparation",
      "duration_days": 14
    },
    {
      "id": "M2",
      "name": "Založení a pilíře",
      "phase": "foundation",
      "duration_days": 60
    },
    {
      "id": "M3",
      "name": "Mostovka",
      "phase": "superstructure",
      "duration_days": 90
    }
  ],
  "work_items": [
    {
      "id": "W1.1",
      "milestone_id": "M1",
      "description": "Vytyčení stavby",
      "quantity": 1,
      "unit": "ks",
      "category": "surveying",
      "estimated_cost_czk": 25000
    },
    {
      "id": "W2.1",
      "milestone_id": "M2",
      "description": "Vrtané piloty Ø 1200mm, C30/37, délka 15m",
      "quantity": 450,
      "unit": "m",
      "category": "foundation",
      "material_specs": {
        "concrete_class": "C30/37",
        "diameter_mm": 1200,
        "length_m": 15
      },
      "estimated_cost_czk": 4500000
    },
    {
      "id": "W2.2",
      "milestone_id": "M2",
      "description": "Železobeton pilířů C35/45, XC4/XF1",
      "quantity": 125,
      "unit": "m3",
      "category": "concrete_structure",
      "material_specs": {
        "concrete_class": "C35/45",
        "exposure_classes": ["XC4", "XF1"]
      },
      "estimated_cost_czk": 1250000
    }
  ],
  "total_estimated_cost_czk": 45000000,
  "total_duration_days": 180,
  "confidence": 0.85,
  "generated_by": "Multi-Role AI (Project Manager + Structural Engineer)",
  "created_at": "2025-12-28T10:30:00Z"
}
```

---

## 🚀 Next Steps

### Немедленные действия:

1. **Обсудить с пользователем:**
   - Подтвердить ожидаемый workflow
   - Выбрать вариант реализации (рекомендуется Workflow C)
   - Уточнить приоритет (срочность реализации)

2. **Создать TODO list:**
   - Детализировать tasks для Phase 1, 2, 3
   - Оценить время разработки
   - Определить тестовые данные (примеры ТЗ)

3. **Начать разработку:**
   - Создать ветку `feature/workflow-c-wbs-generation`
   - Начать с Workflow C endpoint
   - Реализовать WBS Generator

---

## 📚 References

**Существующие файлы для изучения:**

1. **SmartParser:** `concrete-agent/packages/core-backend/app/services/smartparser.py`
   - Парсинг Excel, PDF, XML
   - OCR для сканированных документов

2. **DrawingSpecsParser:** `concrete-agent/packages/core-backend/app/services/drawing_specs_parser.py`
   - Парсинг чертежей DWG/PDF
   - GPT-4 Vision integration

3. **Multi-Role API:** `concrete-agent/packages/core-backend/app/api/routes_multi_role.py`
   - 6 specialist roles
   - Conflict resolution

4. **Workflow A:** `concrete-agent/packages/core-backend/app/services/workflow_a.py`
   - Reference architecture для Workflow C

---

**Автор:** Claude (AI Assistant)
**Дата создания:** 2025-12-28
**Версия:** 1.0
**Статус:** 🔴 Требует решения пользователя
