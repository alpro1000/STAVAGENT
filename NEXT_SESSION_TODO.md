# Next Session TODO

**Created:** 2026-03-21
**Branch:** `claude/check-vertex-ai-prod-kb07G` (10 commits, ready for PR/merge)
**From Session:** Element Planner expansion + R0 cleanup + Design consolidation

---

## Как начать следующий сеанс

```
Продолжи работу над STAVAGENT. Прочитай CLAUDE.md, BACKLOG.md и NEXT_SESSION_TODO.md.
Ветка текущей работы: claude/check-vertex-ai-prod-kb07G (10 коммитов).
[описание задачи]
```

Или конкретно:
```
Продолжи работу над STAVAGENT. Создай документацию для Element Planner —
встроенный help panel с описанием методологии, инструкцией для пользователей,
объяснением что такое RCPSP граф и Monte Carlo.
Ветка: claude/check-vertex-ai-prod-kb07G
```

---

## 🔴 Незавершённые задачи из текущей сессии

### 1. Element Planner — Встроенная документация / Help Panel

**Приоритет:** ВЫСОКИЙ (запрос пользователя)
**Статус:** Исследовано, не реализовано (контекст закончился)
**Файлы:** Новый компонент `PlannerGuide.tsx` + интеграция в `PlannerPage.tsx`

**Что нужно сделать:**
- Создать компонент документации (модальное окно или боковая панель)
- Разместить кнопку "?" или "Помощь" в header рядом с badge v1.0
- Содержание документации:
  1. **Цель модуля** — оценка продолжительности и технологического процесса монолитных бетонных работ (НЕ точный расчёт стоимости опалубки)
  2. **Методология** — 7 движков: классификация → решение о заливке → опалубка → арматура → заливка → планировщик (RCPSP) → Monte Carlo
  3. **RCPSP граф** — что это (DAG с ограниченными ресурсами), почему используется (реалистичное расписание с учётом бригад и комплектов опалубки)
  4. **Monte Carlo (PERT)** — зачем (оценка рисков), как работает (10000 итераций, треугольное распределение), что показывают P50/P80/P90
  5. **Что вводить** — описание каждого поля, что делать если не знаешь площадь опалубки (оставить пустым = автооценка)
  6. **Что показывает "Экономия времени"** — разница между последовательным и оптимизированным графиком при использовании нескольких комплектов опалубки
  7. **20 типов элементов** — таблица с описаниями, параметрами, особенностями
  8. **Системы опалубки** — какие есть, как выбираются автоматически
  9. **Непрерывная заливка** — когда и почему (мостовые деки, элементы без спар), что с бригадой и сменой
  10. **Экспорт** — что содержит Excel (4 листа), CSV, копирование Gantt

**Контекст для реализации:**
- `shared/src/calculators/planner-orchestrator.ts` — PlannerInput/PlannerOutput интерфейсы
- `shared/src/calculators/element-scheduler.ts` — RCPSP алгоритм (DAG, приоритетный список)
- `shared/src/calculators/pert.ts` — Monte Carlo (треугольное распределение, 10000 итераций)
- `shared/src/classifiers/element-classifier.ts` — ELEMENT_CATALOG (20 типов)
- `frontend/src/pages/PlannerPage.tsx` — все поля формы и результаты
- `frontend/src/styles/r0.css` — CSS-переменные дизайн-системы

---

### 2. Merge / PR текущей ветки

**Ветка:** `claude/check-vertex-ai-prod-kb07G`
**Коммиты:** 10 (от FIX: cross-service audit до STYLE: consolidate design tokens)
**Тесты:** 336/336 pass

Решить: merge в main или продолжить в этой ветке.

---

## 🟡 Из бэклога (не начато)

### 3. Sprint 2 — Service Connections CRUD
- Зависит от: MASTER_ENCRYPTION_KEY в Secret Manager
- 8 API endpoints + frontend UI
- См. BACKLOG.md пункт "Sprint 2"

### 4. Document Accumulator → Cloud SQL
- concrete-agent: in-memory storage → persistent
- См. BACKLOG.md пункт 15

### 5. Portal DISABLE_AUTH
- `VITE_DISABLE_AUTH=true` — нужен нормальный JWT frontend
- Низкий приоритет пока в dev

---

## 📝 Резюме сессии 2026-03-21

### Что было сделано (10 коммитов):

| # | Коммит | Описание |
|---|--------|----------|
| 1 | `8e7c6e2` | FIX: cross-service audit — CORS, Portal URLs, Cloud SQL |
| 2 | `99fff93` | FIX: element-scheduler chess mode bugs |
| 3 | `0ab45cd` | FIX: AI advisor JSON → human-readable format |
| 4 | `b521441` | FEAT: 20 element types, dynamic concrete_days, skruž |
| 5 | `799f2ca` | FEAT: visual Gantt chart + Excel export |
| 6 | `e8db984` | STYLE: package-lock.json (xlsx dependency) |
| 7 | `b907ed6` | REFACTOR: remove unused R0 module |
| 8 | `55e3087` | STYLE: consolidate design tokens, 0 hardcoded hex |

### Ключевые изменения по файлам:

**shared/ (расчётное ядро):**
- `pour-decision.ts` — StructuralElementType расширен с 9 до 20, ELEMENT_DEFAULTS для 11 новых типов
- `element-classifier.ts` — ELEMENT_CATALOG +11 записей, keyword rules для CZ/RU/EN
- `planner-orchestrator.ts` — dynamic concrete_days, continuous pour logic, generalized skruž, overtime 25%
- `maturity.ts` — новые ConstructionType (stropni_deska, pruvlak, schodiste), PROPS_MIN_DAYS
- `element-scheduler.ts` — fix tact_details.set в chess mode, fs_lags для cure_between_neighbors
- Тесты обновлены: 336 pass

**frontend/:**
- `PlannerPage.tsx` — JSON display fix, dropdown с optgroup, все hex→CSS variables
- `PlannerGantt.tsx` — НОВЫЙ: визуальный Gantt с цветными барами по фазам
- `exportPlanXLSX.ts` — НОВЫЙ: 4-листовая XLSX книга (SheetJS)
- `r0.css` — очищен с 838 до 190 строк, 25+ CSS-переменных
- `App.tsx` — удалён маршрут /r0 и импорт R0App
- `components/r0/` — УДАЛЁН (5 файлов, 1052 строки)

**backend/:**
- `planner-advisor.js` — AI prompt с детерминированными правилами, suggestFormwork для новых типов
