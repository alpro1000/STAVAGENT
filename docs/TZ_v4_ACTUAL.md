# ТЕХНИЧЕСКОЕ ЗАДАНИЕ v4.0 (АКТУАЛЬНОЕ)
## STAVAGENT — Multi-Kiosk AI система для строительства

**Репозиторий:** https://github.com/alpro1000/STAVAGENT  
**Версия:** 4.0  
**Дата:** 2026-03-09  
**Статус:** Production (4 микросервиса работают)

---

## 0. РЕАЛЬНАЯ АРХИТЕКТУРА (из кода)

### Микросервисы:

```
STAVAGENT/
├── concrete-agent/              ← CORE (Python FastAPI) - Multi-Role AI
│   ├── packages/core-backend/   ← AI движок
│   └── requirements.txt         ← anthropic, fastapi, pdfplumber
│
├── stavagent-portal/            ← Portal (Node.js) - Диспетчер
│   ├── backend/                 ← Express.js + PostgreSQL
│   └── frontend/                ← React + Vite
│
├── Monolit-Planner/             ← Kiosk 1 (Node.js) - Калькулятор бетона
│   ├── backend/                 ← Express.js
│   ├── frontend/                ← React + Vite
│   └── shared/                  ← Формулы расчета
│
├── rozpocet-registry/           ← Kiosk 2 (React) - Registry TOV
│   └── src/                     ← Frontend only
│
├── rozpocet-registry-backend/   ← Backend для Registry TOV
│   └── src/                     ← Express.js
│
└── URS_MATCHER_SERVICE/         ← Kiosk 3 (Node.js) - URS матчинг
    └── src/                     ← Express.js
```

### Production URLs:

| Сервис | URL | Статус |
|--------|-----|--------|
| Portal Frontend | https://www.stavagent.cz | ✅ |
| Portal Backend | https://stavagent-portal-backend-1086027517695.europe-west3.run.app | ✅ |
| CORE (AI) | https://concrete-agent-1086027517695.europe-west3.run.app | ✅ |
| Monolit Backend | https://monolit-planner-api-1086027517695.europe-west3.run.app | ✅ |
| Monolit Frontend | https://monolit-planner-frontend.vercel.app | ✅ |
| Registry TOV | https://stavagent-backend-ktwx.vercel.app | ✅ |
| URS Matcher | https://urs-matcher-service-1086027517695.europe-west3.run.app | ✅ |

---

## 1. КРИТИЧЕСКИЕ ЗАДАЧИ (из логов 2026-03-09)

### ✅ ИСПРАВЛЕНО СЕГОДНЯ:

1. **SQL ошибка** - `position_instance_id does not exist` → FIXED
2. **Memory overflow** - PDF >20MB → ограничение 50 страниц
3. **Portal send-to-core** - несуществующий `workflowAStart()` → Workflow C API
4. **Multipart parsing** - неправильный boundary → FormData fix

### ❌ ОСТАЛОСЬ ИСПРАВИТЬ:

#### 1.1 База знаний в неправильном месте
```bash
# Проблема: extracted_data/ в корне проекта
# Должно быть: concrete-agent/packages/core-backend/app/knowledge_base/

# Решение:
mv extracted_data/* concrete-agent/packages/core-backend/app/knowledge_base/
rm -rf extracted_data/
```

#### 1.2 MinerU не работает
```python
# concrete-agent/packages/core-backend/app/parsers/smart_parser.py
# Строка 83: "TODO: Add MinerU integration for better PDF parsing"

# Проблема: MinerU установлен но не используется (stub only)
# Решение: Интегрировать MinerU в _parse_document()
```

#### 1.3 Workflow C зависает на больших файлах
```
# Лог: 58-страничный PDF парсится 196 секунд → Memory overflow
# Решение: Streaming парсинг + параллельная обработка страниц
```

#### 1.4 6-ролевой аудит медленный
```python
# concrete-agent/packages/core-backend/app/services/workflow_c.py
# Строка 320: Последовательное выполнение ролей

# Проблема: 6 ролей × 15 сек = 90 секунд
# Решение: Параллельное выполнение + оркестратор
```

---

## 2. ПРИОРИТЕТНЫЕ ЗАДАЧИ (по важности)

### Задача 2.1 — Интегрировать MinerU в PDF парсер

**Файл:** `concrete-agent/packages/core-backend/app/parsers/smart_parser.py`

**Что сделать:**
```python
def parse_pdf(self, file_path: Path, project_id: Optional[str] = None):
    size_mb = file_path.stat().st_size / (1024 * 1024)
    
    if size_mb < SIZE_THRESHOLD_MB:
        # Стандартный парсер
        logger.info("✅ Using standard pdfplumber parser")
        return self.pdf_parser.parse(file_path)
    else:
        # MinerU для больших файлов
        logger.info("✅ Using MinerU parser (large file)")
        return self.mineru_parser.parse(file_path, max_pages=100)
```

**Критерий готовности:**
- PDF 58 страниц парсится < 60 секунд
- Извлекаются таблицы + текст + изображения
- Нет memory overflow

---

### Задача 2.2 — Batch Calculator в Monolit UI

**Файлы созданы сегодня:**
- `Monolit-Planner/shared/src/calculators/batchCalculator.ts` ✅
- `Monolit-Planner/frontend/src/components/BatchCalculatorUI.tsx` ✅

**Что сделать:**
```tsx
// Monolit-Planner/frontend/src/components/MonolithPositionForm.tsx
import { BatchCalculatorUI } from './BatchCalculatorUI';

// Добавить в форму позиции:
{position.element_type === 'foundation' && (
  <BatchCalculatorUI
    initialVolume={position.volume_m3}
    initialLength={position.length_m}
    elementType="foundation"
    onPlanChange={(plan) => {
      updatePosition({ batch_plan: plan });
    }}
  />
)}
```

**Критерий готовности:**
- Ввод: 569 м³ на 10 закладов
- Вывод: Таблица с тактами заливки
- Сохранение в `position.batch_plan`

---

### Задача 2.3 — Параллельное выполнение ролей в Workflow C

**Файл:** `concrete-agent/packages/core-backend/app/services/workflow_c.py`

**Что сделать:**
```python
async def _audit_positions(self, positions, project_name, use_parallel=True):
    if use_parallel:
        # Параллельное выполнение 6 ролей
        tasks = [
            self._execute_role(Role.DOCUMENT_VALIDATOR, positions),
            self._execute_role(Role.STRUCTURAL_ENGINEER, positions),
            self._execute_role(Role.CONCRETE_SPECIALIST, positions),
            self._execute_role(Role.COST_ESTIMATOR, positions),
            self._execute_role(Role.STANDARDS_CHECKER, positions),
            self._execute_role(Role.SAFETY_INSPECTOR, positions),
        ]
        results = await asyncio.gather(*tasks)
        return self._merge_role_results(results)
    else:
        # Последовательное (текущее)
        ...
```

**Критерий готовности:**
- 6 ролей выполняются за 20 секунд (вместо 90)
- Speedup 3-4x
- Результаты корректно мержатся

---

### Задача 2.4 — Переместить базу знаний

**Команды:**
```bash
cd c:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT

# 1. Создать правильную структуру
mkdir -p concrete-agent/packages/core-backend/app/knowledge_base

# 2. Переместить файлы
mv extracted_data/* concrete-agent/packages/core-backend/app/knowledge_base/

# 3. Удалить старую папку
rm -rf extracted_data/

# 4. Обновить пути в коде
# concrete-agent/packages/core-backend/app/services/kb_loader.py
# Изменить BASE_DIR на правильный путь
```

**Критерий готовности:**
- Нет папки `extracted_data/` в корне
- KB загружается из правильного места
- Все тесты проходят

---

## 3. АРХИТЕКТУРНЫЕ РЕШЕНИЯ

### 3.1 Unified Registry (Weeks 1-4 DONE)

**Статус:** ✅ Foundation complete

**Что работает:**
- 8 таблиц в Portal DB
- 11 API endpoints
- File versioning (SHA-256)
- Monolit adapter (backward compatible)
- Registry TOV adapter

**Документация:** `docs/WEEK_4_SUMMARY.md`

---

### 3.2 Cross-Kiosk Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    PORTAL (Диспетчер)                    │
│  - PostgreSQL (portal_projects, portal_positions)       │
│  - Координирует киоски                                  │
└────────────┬────────────────────────────────┬───────────┘
             │                                │
    ┌────────▼────────┐              ┌───────▼────────┐
    │  MONOLIT Kiosk  │              │ REGISTRY Kiosk │
    │  - Расчет бетона│              │ - TOV данные   │
    │  - KROS нормы   │              │ - Аренда       │
    └────────┬────────┘              └───────┬────────┘
             │                                │
             └────────────┬───────────────────┘
                          │
                  ┌───────▼────────┐
                  │   CORE (AI)    │
                  │  - Multi-Role  │
                  │  - Workflow C  │
                  └────────────────┘
```

---

## 4. СТЕК ТЕХНОЛОГИЙ (РЕАЛЬНЫЙ)

```yaml
Backend:
  CORE:     Python 3.12 + FastAPI + Anthropic Claude
  Portal:   Node.js 20 + Express.js + PostgreSQL
  Monolit:  Node.js 20 + Express.js
  Registry: Node.js 20 + Express.js

Frontend:
  Portal:   React 18 + Vite + TypeScript
  Monolit:  React 18 + Vite + TypeScript
  Registry: React 18 + Vite + TypeScript

Database:
  Portal:   PostgreSQL (Render)
  CORE:     PostgreSQL (Render)

Deploy:
  Backend:  Render.com (Free Tier)
  Frontend: Vercel (Free Tier)

AI:
  Primary:  Anthropic Claude (claude-3-5-sonnet)
  Fallback: Google Gemini (gemini-2.5-flash-lite)
```

---

## 5. ПОРЯДОК РАЗРАБОТКИ

| # | Задача | Срок | Файлы |
|---|--------|------|-------|
| 1 | Переместить базу знаний | 1 час | `kb_loader.py` |
| 2 | Интегрировать MinerU | 1 день | `smart_parser.py` |
| 3 | Batch Calculator в UI | 2 часа | `MonolithPositionForm.tsx` |
| 4 | Параллельные роли | 1 день | `workflow_c.py` |
| 5 | Streaming PDF парсинг | 2 дня | `pdf_parser.py` |
| 6 | Оркестратор ролей | 1 день | `orchestrator.py` |

---

## 6. КРИТЕРИИ ПРИЁМКИ

- [ ] База знаний в `concrete-agent/packages/core-backend/app/knowledge_base/`
- [ ] MinerU парсит PDF 58 страниц < 60 сек
- [ ] Batch Calculator показывает такты заливки
- [ ] 6 ролей выполняются параллельно за 20 сек
- [ ] Нет memory overflow на больших PDF
- [ ] Все production URLs работают
- [ ] CI/CD проходит (6 jobs)

---

## 7. ДОКУМЕНТАЦИЯ

| Файл | Описание |
|------|----------|
| `README.md` | Быстрый старт |
| `CLAUDE.md` | Полная документация |
| `SESSION_START.md` | Команды для новой сессии |
| `NEXT_SESSION.md` | Детали последней сессии |
| `docs/BUGFIX_2026_03_09.md` | Сегодняшние исправления |
| `docs/WEEK_4_SUMMARY.md` | Unified Registry Foundation |

---

**Версия:** 4.0  
**Последнее обновление:** 2026-03-09  
**Автор:** Amazon Q + Prokopov Team
