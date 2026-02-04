# Next Session - Quick Start

**Last Updated:** 2026-02-04
**Current Branch:** `claude/update-main-branch-ZYDrg`
**Last Session:** Portal Fix + Unification Audit

---

## Quick Start Commands

```bash
cd /home/user/STAVAGENT
git status
git log --oneline -10

# Start development
cd stavagent-portal/backend && npm run dev   # Portal API :3001
cd rozpocet-registry && npm run dev          # Registry :5173
cd Monolit-Planner/backend && npm run dev    # Monolit API :3001
cd URS_MATCHER_SERVICE && npm run dev        # URS :3001
```

---

## Сессия 2026-02-04: Резюме

### Что сделано:

| # | Задача | Статус |
|---|--------|--------|
| 1 | **Portal fix:** `safeGetPool()` для SQLite режима | ✅ |
| 2 | **Registry:** Редактируемая цена + авто-пересчёт суммы | ✅ |
| 3 | **Registry:** Секции — скрыта цена/skupina, показана сумма | ✅ |
| 4 | **Registry:** Excel export fixes (collapsible, styling) | ✅ |
| 5 | **Аудит:** Проанализированы все 5 kiosks | ✅ |
| 6 | **Документация:** `docs/UNIFICATION_PLAN.md` создан | ✅ |

### Коммиты (2026-02-04):
```
018535f DOCS: Update NEXT_SESSION.md with Portal fix session info
0e64fad FIX: Portal project creation error when PostgreSQL not available
94518d8 FEAT: Section rows - hide price/skupina, show section totals
1aa4a1f FIX: Hide number input spinner arrows
...и ещё 5 коммитов для price editing
```

### Ключевой фикс Portal:

**Проблема:** Ошибка "PostgreSQL pool not initialized" при создании проекта без DATABASE_URL

**Решение:** Добавлен `safeGetPool()` в `portal-projects.js`:
```javascript
function safeGetPool() {
  if (!USE_POSTGRES) return null;
  try { return getPool(); }
  catch (error) { return null; }
}
```

Теперь API возвращает mock данные с `_warning` полем когда БД недоступна.

---

## ВАЖНО: Активный план унификации

### Документация:
- **`docs/UNIFICATION_PLAN.md`** — Полный план (700 строк)
- **`docs/UNIFIED_DATA_MODEL.ts`** — TypeScript типы
- **`CLAUDE.md`** — Главная документация

### Текущая фаза: Фаза 1 — Базовая связность

**Следующая задача:**
```
1.1 Добавить portalProjectId в rozpocet-registry

Файлы:
- src/types/project.ts         → portalProjectId?: string
- src/stores/registryStore.ts  → linkToPortal(), unlinkFromPortal()
- Новый UI компонент           → отображение связи с Portal
```

---

## Архитектура унификации

```
Portal (Hub) — portalProjectId (UUID)
    │
    ├── Monolit-Planner
    │   └── project_id (строка "SO201") — ⚠️ Нужен portal link
    │
    ├── URS_MATCHER
    │   └── portal_project_id ✅ Уже есть
    │
    ├── rozpocet-registry
    │   └── projectId (UUID) — ❌ НЕТ portal связи
    │
    └── concrete-agent (CORE)
        └── project_id (UUID)
```

### Маппинг полей:

| Unified | Registry | Monolit | URS |
|---------|----------|---------|-----|
| code | kod | otskp_code | urs_code |
| description | popis | item_name | urs_name |
| quantity | mnozstvi | qty | quantity |
| unit | mj | unit | unit |
| unitPrice | cenaJednotkova | unit_cost_native | - |
| totalPrice | cenaCelkem | kros_total_czk | - |
| category | skupina | subtype | - |

---

## Чеклист задач

### Фаза 1: Базовая связность
- [ ] Registry: добавить `portalProjectId`
- [ ] Monolit: API endpoint для Portal link
- [ ] URS: endpoint экспорта в Registry

### Фаза 2: API синхронизации
- [ ] Registry serverless API (`/api/sync/*`)
- [ ] Маппинг функции (`mapToUnified()`)

### Фаза 3: TOV UI
- [ ] `TOVButton` + `TOVModal`
- [ ] Вкладки: Люди | Механизмы | Материалы
- [ ] Store расширение

### Фаза 4: Интеграция калькуляторов
- [ ] Monolit ↔ Registry
- [ ] URS → Registry

---

## Service URLs

| Service | URL |
|---------|-----|
| Portal | https://stav-agent.onrender.com |
| Monolit API | https://monolit-planner-api.onrender.com |
| URS | https://urs-matcher-service.onrender.com |
| CORE | https://concrete-agent.onrender.com |

---

## Key Files

### Portal (stavagent-portal)
```
backend/src/routes/portal-projects.js  ← Исправлен (safeGetPool)
backend/src/routes/kiosk-links.js      ← Связи с kiosks
backend/src/db/schema-postgres.sql     ← Схема БД
```

### Registry (rozpocet-registry)
```
src/types/project.ts                   ← Project interface
src/stores/registryStore.ts            ← Zustand store
src/components/items/ItemsTable.tsx    ← Таблица позиций
```

### Monolit (Monolit-Planner)
```
shared/src/types.ts                    ← Position types
backend/src/routes/monolith-projects.js← API проектов
```

---

**При старте сессии:**
1. Прочитай `CLAUDE.md`
2. Прочитай `docs/UNIFICATION_PLAN.md`
3. Продолжай с Фазы 1.1

*Ready for next session!*
