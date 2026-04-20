# NEXT SESSION — после 2026-03-29 (Session 9)

## Как начать следующий сеанс

```
Продолжи работу над STAVAGENT. Прочитай CLAUDE.md и NEXT_SESSION.md.
Ветка: claude/registration-landing-updates-ClXq0
Продолжай план P3-P7 из этого файла.
```

---

## Что сделано в сессии 9 (2026-03-29) — 8 коммитов

### Коммит 1: Cleanup — удалено 54 устаревших .md файлов (-13,045 LOC)
- Root .md: 68 → 10 файлов
- Обновлены NEXT_SESSION.md и BACKLOG.md

### Коммит 2: NKB Audit System (+1,546 LOC)
- `audit_schemas.py` — DocStatus, DocType, FoundDocument, GapEntry, SourceSummary, AuditResult
- `norm_source_catalog.py` — 15 источников (SŽ, PJPK, MMR, ČAS, ÚNMZ, ČKAIT, etc.)
- `norm_audit_service.py` — httpx+BS4 scrapers + Perplexity для сложных сайтов + gap analysis
- `routes_norm_audit.py` — 5 endpoints: start, status, result, sources, download-missing
- `005_norm_audit_tables.sql` — nkb_audit_runs, nkb_found_documents, zdroje[] на nkb_norms

### Коммит 3: Admin NKB access (+135 LOC)
- AdminDashboard.tsx — новый таб "Normy (NKB)" с карточками-ссылками
- NKBAdminPage.tsx — поддержка ?tab=xxx query param, улучшенный audit UI с download секцией

### Коммит 4: Unified Item Layer (+1,802 LOC, 23/23 тестов)
- `item_schemas.py` — ProjectItem с 4 namespace блоками (estimate, monolit, classification, core)
- `code_detector.py` — 5-step pipeline: OTSKP DB(1.0) → regex(0.95) → prefix(0.90) → hint(0.85) → fallback
- `item_store.py` — 3 операции: bulk_import (atomic, idempotent, versioned), read_items (6 filters), update_block (namespace-isolated)
- `routes_items.py` — POST /import, GET /{project}, PATCH /{id}/{namespace}, GET /versions, POST /detect-codes
- `006_project_items.sql` — project_items + item_versions tables

### Коммит 5: Monolit Planner Refactor (+119 LOC)
- PlannerPage.tsx — useSearchParams для position context, "Aplikovat do pozice" кнопка
- PartHeader.tsx — "Kalkulátor bednění" → "Rассчитать" (оранжевая, #FF9F1C)
- PositionsTable.tsx — навигация на /planner?bridge_id=X&part_name=Y вместо FormworkCalculatorModal

### Коммит 6: Position Grouper (+422 LOC, 15/15 тестов)
- `position_grouper.py` — детерминированная группировка бетон+арматура+опалубка
- Regex detection: concrete class (C30/37), inclusion markers (vč. výztuže/bednění)
- Scan window: 3-5 позиций после бетона для поиска арматуры (t/kg) и опалубки (m²)
- CoreMetadata расширена: group_role, group_leader_id, group_members, armatura_included, opalubka_included
- Wired into bulk_import → group_positions() вызывается автоматически

### Коммит 7: Grouped Items API (+56 LOC)
- GET /api/v1/items/{project_id}/grouped — карточки конструкций для Monolit
- Каждая карточка: beton (leader) + armatura[] + opalubka[] + is_complete flag

### Итого сессия 9:
- **+6,000 LOC** новых, **-13,045 LOC** удалённых
- **38 unit tests** (23 items + 15 grouper), все PASS
- **15 normативных источников** в NKB audit catalog
- **5 новых API endpoints** (items) + **5 endpoints** (NKB audit)

---

## План на следующую сессию — P3-P7

### P3: TOV предзаполнение из калькулятора (СЛЕДУЮЩИЙ)
**Что:** Когда Planner results записаны через "Aplikovat do pozice", TOV автоматически получает секции "Работы" и "Аренда опалубки" с суммами из калькулятора.
**Файлы:** rozpocet-registry/src/components/tov/TOVModal.tsx, dovWriteBack.ts
**Зависит от:** PlannerOutput.costs + PlannerOutput.resources → monolit_data block

### P4: Общий Гантт проекта
**Что:** Вкладка "Гантт проекта" в Monolit — диаграмма всех позиций с данными из калькулятора. Ось — дни, типовой порядок для мостов/зданий, drag-and-drop перестановка.
**Файлы:** Monolit-Planner/frontend/src/components/ProjectGantt.tsx (новый)
**Зависит от:** GET /api/v1/items/{project}/grouped + monolit_data с schedule

### P5: Мини-калькуляторы (бетононасос, кран, доставка)
**Что:** Три мини-калькулятора в TOV: бетононасос (PumpRentalSection уже есть — рефактор), кран (новый), доставка бетона (новый). Справочник поставщиков (pump_knowledge.json, formwork_knowledge.json уже есть).
**Файлы:** rozpocet-registry/src/components/tov/ — новые секции

### P6: Публичный калькулятор в Portal
**Что:** /portal/calculator — публичная страница (без auth) с полным Planner. Гантт с датами, "Скачать результат", баннер регистрации. Без "Aplikovat do pozice".
**Файлы:** stavagent-portal/frontend/src/pages/CalculatorPage.tsx (новый)

### P7: Сценарий Б (генерация из ТЗ/чертежей)
**Что:** Загрузка PDF/DWG → анализ ТЗ (состав конструкций) → снятие объёмов с чертежей → генерация výkaz výměr. Объёмы ТОЛЬКО из текущего проекта.
**Файлы:** concrete-agent — новые services для ТЗ и чертежей

---

## Архитектура (текущее состояние после сессии 9)

```
Portal (Hub) ──→ Core Engine (Items API + NKB + Passport)
    │
    ├──→ Registry (Excel import → Core items → classification → TOV → export)
    │       └── TOV: Работы, Аренда, Бетон, Механизмы, Материалы
    │
    ├──→ Monolit (Карточки конструкций → Калькулятор → "Aplikovat" → Core)
    │       └── Planner: 7-engine pipeline → PlannerOutput → monolit_data block
    │
    └──→ URS Matcher (code matching pipeline)

Core Engine (Python FastAPI):
  /api/v1/items/import          — bulk import with dedup + grouping
  /api/v1/items/{project}       — read with 6 filters
  /api/v1/items/{id}/{ns}       — namespace block update
  /api/v1/items/{project}/grouped — construction cards
  /api/v1/nkb/audit/*           — normative source audit
```

### Ключевые модели данных

**ProjectItem** (4 namespace блока):
- `estimate` — сметные данные из Excel (Registry owns)
- `monolit` — данные калькулятора (Monolit owns)
- `classification` — группа работ, OTSKP/ÚRS/RTS (shared)
- `core` — метаданные, версия, группировка (read-only)

**Position Grouping** (CoreMetadata):
- `group_role` — "beton" | "armatura" | "opalubka" | null
- `group_leader_id` — item_id родительской бетонной позиции
- `group_members` — список item_id связанных позиций
- `armatura_included` / `opalubka_included` — "vč." маркеры

---

## ⏳ Ожидает действий пользователя

| Задача | Статус |
|--------|--------|
| Merge PR ветки claude/registration-landing-updates-ClXq0 → main | Блокирует deploy |
| Stripe ключи → Secret Manager | Блокирует платежи |
| MASTER_ENCRYPTION_KEY → Secret Manager | Для Service Connections |
| AWS Bedrock RPM increase | ThrottlingException |
