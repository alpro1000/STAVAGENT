# Next Session - Quick Start

**Last Updated:** 2026-02-04
**Current Branch:** `claude/update-main-branch-ZYDrg`
**Last Session:** Rozpočet Registry - Price Editing + Kiosk Unification Audit

---

## Quick Start Commands

```bash
# Current working directory
cd /home/user/STAVAGENT

# Check branch and status
git status
git log --oneline -10

# Pull latest changes
git pull origin main

# Start development (rozpocet-registry)
cd rozpocet-registry && npm run dev     # Vite on :5173

# Other services (if needed)
cd URS_MATCHER_SERVICE/backend && npm run dev        # URS Matcher
cd Monolit-Planner/backend && npm run dev            # Monolit backend
cd concrete-agent && npm run dev:backend             # CORE backend
```

---

## ВАЖНО: Активный план унификации

### Документация по плану:
- **`docs/UNIFICATION_PLAN.md`** — Полный план реализации (читать первым!)
- **`docs/UNIFIED_DATA_MODEL.ts`** — TypeScript типы для всех kiosks
- **`CLAUDE.md`** — Главная документация системы

### Текущая фаза: Фаза 1 — Базовая связность

**Следующая задача:**
```
1.1 Добавить portalProjectId в rozpocet-registry

Файлы для изменения:
- src/types/project.ts — добавить поле portalProjectId?: string
- src/stores/registryStore.ts — методы linkToPortal(), unlinkFromPortal()
- UI компонент для отображения связи с Portal
```

---

## Recent Work (2026-02-04)

### Сессия 1: Excel Export Fixes + Import Preview
- Subordinate inheritance
- Collapsible rows в Excel
- Import preview improvements

### Сессия 2: Price Editing + Unification Audit

**Commits:**
```
94518d8 FEAT: Section rows - hide price/skupina, show section totals
1aa4a1f FIX: Hide number input spinner arrows
da252ce FIX: Increase padding for price input to show all decimals
33b6aa7 FIX: Price input shows 2 decimal places + wider columns
16ec745 FEAT: Auto-fit width for price columns based on data
d8a6244 FIX: Price input - local state prevents cursor jump + lighter styling
94a9614 FEAT: Editable unit price with auto-recalculation + thinner scrollbar
```

**Функции добавлены:**
1. Редактируемая цена (cenaJednotkova) с авто-пересчётом cenaCelkem
2. Скрытие spinner-стрелок в number input
3. Авто-ширина столбцов цен по данным
4. Секции: скрыты цена/skupina, показана сумма секции

**Аудит kiosks завершён:**
- Проанализированы все 5 сервисов
- Выявлены несоответствия в именовании
- Создан план унификации

---

## Архитектура унификации (напоминание)

```
Portal (Hub) — portalProjectId (UUID)
    │
    ├── Monolit-Planner
    │   └── project_id / bridge_id (строка "SO201")
    │
    ├── URS_MATCHER
    │   └── jobs.id (UUID) + portal_project_id ✅
    │
    ├── rozpocet-registry
    │   └── projectId (UUID) — НЕТ portal связи ❌
    │
    └── concrete-agent (CORE)
        └── project_id (UUID)
```

### Маппинг полей позиций:

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

## Key Files for Unification

### Registry (rozpocet-registry)
```
src/types/project.ts          — Project interface
src/stores/registryStore.ts   — Zustand store (376 строк)
src/types/item.ts             — ParsedItem interface
```

### Monolit (Monolit-Planner)
```
shared/src/types.ts                          — Position, Bridge interfaces
backend/src/routes/monolith-projects.js      — Project API
backend/src/routes/positions.js              — Positions API
backend/src/db/schema-postgres.sql           — DB schema
```

### URS (URS_MATCHER_SERVICE)
```
backend/src/models/                    — Job, Match models
backend/src/api/routes/jobs.js         — Jobs API
```

### Portal (stavagent-portal)
```
backend/src/routes/kiosk-links.js      — Kiosk linking API
backend/src/routes/portal-projects.js  — Projects API
```

---

## TOV (Ведомость ресурсов) — Будущая фаза

### Структура компонентов (Фаза 3):
```
src/components/tov/
├── TOVButton.tsx           # Кнопка [📊] возле позиции
├── TOVModal.tsx            # Модальное окно с вкладками
├── LaborTab.tsx            # Вкладка: Люди (норм-часы)
├── MachineryTab.tsx        # Вкладка: Механизмы (маш-часы)
├── MaterialsTab.tsx        # Вкладка: Материалы
└── TOVSummary.tsx          # Итоги
```

### Интеграция с калькуляторами:
- Материалы → Monolit-Planner (бетон, арматура)
- Техника → Machinery Calculator (будущее)
- Труд → Labor Calculator (будущее)

---

## Чеклист задач

### Фаза 1: Базовая связность
- [ ] Registry: добавить portalProjectId
- [ ] Monolit: API endpoint для Portal link
- [ ] URS: endpoint экспорта в Registry

### Фаза 2: API синхронизации
- [ ] Registry serverless API
- [ ] Маппинг функции

### Фаза 3: TOV UI
- [ ] TOVButton + TOVModal
- [ ] Вкладки ресурсов
- [ ] Store расширение

### Фаза 4: Интеграция
- [ ] Monolit → Registry
- [ ] Registry → Monolit
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

**При старте сессии:**
1. Прочитай `CLAUDE.md`
2. Прочитай `docs/UNIFICATION_PLAN.md`
3. Продолжай с текущей фазы

---

*Ready for next session!*
