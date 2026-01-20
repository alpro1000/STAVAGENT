# Migration 005: Bridges → Monolith Projects

## Проблема

Данные хранятся в **старой таблице `bridges`**, но API читает из **новой таблицы `monolith_projects`**.

**Диагностика показала:**
- `monolith_projects`: **0 записей** ❌
- `bridges`: **100 записей** ✅ (включая твой проект "SO 11-20-01")
- `positions`: **3056 записей** ✅

**Результат:** Ошибка 404 при попытке редактировать проекты.

---

## Решение

**Миграция данных** из старой таблицы `bridges` в новую `monolith_projects`.

### Файлы созданы:

1. **SQL миграция:**
   - `backend/migrations/005_migrate_bridges_to_monolith_projects.sql`
   - Копирует все данные: `bridges` → `monolith_projects`

2. **Скрипт запуска:**
   - `backend/scripts/run-migration-005.js`
   - Проверяет состояние БД → Выполняет миграцию → Проверяет результат

---

## Как запустить миграцию

### Вариант 1: Автоматическая миграция (при деплое)

Миграция **автоматически выполнится** при следующем деплое бэкенда.

**Действия:**
1. Подожди **2-3 минуты** (Render деплоит изменения)
2. Открой в браузере: https://monolit-planner-frontend.onrender.com
3. Список проектов должен **появиться** ✅
4. Попробуй редактировать "SO 11-20-01" - должно работать ✅

### Вариант 2: Ручной запуск (если нужно прямо сейчас)

Если у тебя есть доступ к серверу через SSH:

```bash
cd /path/to/Monolit-Planner
node backend/scripts/run-migration-005.js
```

**Вывод покажет:**
```
========================================
Migration 005: Migrate bridges → monolith_projects
========================================

[STEP 1] Checking current database state...
  - bridges table: 100 records
  - monolith_projects table: 0 records
  - positions table: 3056 records

[STEP 2] Loading migration SQL...
  ✓ SQL loaded

[STEP 3] Executing migration...
  ✓ Migration executed successfully

[STEP 4] Verifying migration results...
  - Before: 0 records in monolith_projects
  - After: 100 records in monolith_projects
  - Migrated: 100 records

[STEP 5] Sample migrated projects:
  - SO 11-20-01: "Železnicní most..." (0 m³)
  - SO 12-20-01: "Železnicní most..." (0 m³)
  ...

✅ Migration 005 completed successfully!
```

---

## Что делает миграция

### SQL команда:

```sql
INSERT INTO monolith_projects (
  project_id,
  project_name,
  object_name,
  concrete_m3,
  ...
)
SELECT
  bridge_id as project_id,
  project_name,
  object_name,
  concrete_m3,
  ...
FROM bridges
WHERE bridge_id NOT IN (SELECT project_id FROM monolith_projects)
```

**Перенесёт:**
- ✅ Все 100 проектов из `bridges`
- ✅ Все поля (ID, название, объём бетона, даты создания)
- ✅ Не создаст дубликаты (проверка `WHERE bridge_id NOT IN`)

**Не тронет:**
- ✅ Таблицу `positions` (3056 записей останутся как есть)
- ✅ Старую таблицу `bridges` (останется для бэкапа)

---

## После миграции

### Проверь что всё работает:

1. **Откройте Monolit Planner:**
   - https://monolit-planner-frontend.onrender.com

2. **Список проектов:**
   - Должны появиться все 100 проектов ✅
   - Включая "SO 11-20-01" который ты пытался редактировать

3. **Попробуй редактировать:**
   - Кликни на "SO 11-20-01"
   - Нажми кнопку редактирования ✏️
   - Измени название проекта
   - Сохрани
   - **Должно работать без ошибки 404!** ✅

4. **Проверь F5 refresh:**
   - Нажми F5 (обновить страницу)
   - Проекты должны **остаться** ✅
   - Изменённое название должно **сохраниться** ✅

---

## Почему возникла проблема

### Историческая справка:

**Декабрь 2025 - VARIANT 0 → VARIANT 1 миграция:**
- Раньше: Данные хранились в таблице `bridges`
- Теперь: Данные должны храниться в `monolith_projects`
- **Проблема:** Старые данные остались в `bridges`, новая таблица пустая

**Исправление схемы (2026-01-20):**
- Убрали старые колонки (`stavba`, `parent_project_id`)
- Но забыли мигрировать данные из `bridges` → `monolith_projects`
- API читает из новой таблицы → 404 Not Found

**Сейчас (Migration 005):**
- Переносим все данные в правильную таблицу ✅
- Проекты появятся в интерфейсе ✅
- Редактирование заработает ✅

---

## FAQ

### Q: Что будет со старой таблицей `bridges`?

**A:** Останется без изменений (бэкап). Можно удалить позже, когда убедимся что всё работает.

### Q: Потеряются ли позиции (positions)?

**A:** Нет! Все 3056 позиций привязаны к `bridge_id`, который станет `project_id` в новой таблице.

### Q: Нужно ли заново импортировать Excel?

**A:** Нет! Все данные уже в базе, просто в старой таблице. Миграция перенесёт их.

### Q: Что если миграция выполнится дважды?

**A:** Проверка `WHERE bridge_id NOT IN (...)` предотвратит дубликаты. Безопасно.

---

## Статус миграции

| Этап | Статус |
|------|--------|
| ✅ SQL миграция создана | Готово |
| ✅ Скрипт запуска создан | Готово |
| ⏳ Коммит + Push | В процессе |
| ⏳ Деплой бэкенда (Render) | Ожидание (2-3 мин) |
| ⏳ Автоматический запуск миграции | После деплоя |
| ⏳ Проверка в UI | После миграции |

---

**Commit:** `pending`
**Branch:** `claude/create-onboarding-guide-E4wrx`
**Date:** 2026-01-20

**Важно:** После деплоя проверь логи бэкенда на Render - должна появиться строка:
```
✅ Migration 005 completed successfully!
Migrated: 100 records
```
