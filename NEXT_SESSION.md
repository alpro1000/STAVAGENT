# Next Session - Quick Start

**Last Updated:** 2026-02-27
**Current Branch:** `claude/fix-ui-add-features-Wq8dc`
**Last Session:** Position Instance Architecture v1.0 + Portal linking fixes

---

## Quick Start Commands

```bash
cd /home/user/STAVAGENT

# 1. Read system context
cat CLAUDE.md && cat NEXT_SESSION.md

# 2. Check branch and recent commits
git log --oneline -10

# 3. TypeScript check (rozpocet-registry)
cd rozpocet-registry && npx tsc --noEmit --skipLibCheck

# 4. Run tests
cd ../Monolit-Planner/shared && npx vitest run        # 51 tests
```

---

## Сессия 2026-02-27: Резюме

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| docs | Position Instance Architecture v1.0 — двухуровневая модель (Instance + Template) | ✅ |
| portalAutoSync.ts | FIX: auto-sync теперь сохраняет portalProjectId обратно в store | ✅ |
| PortalLinkBadge.tsx | REWRITE v2: project picker вместо ручного ввода UUID | ✅ |
| PortalPage.tsx | FIX: sleeping backend UX + ?project= not found banner | ✅ |
| CorePanel/ParsePreview/PortalPage | FIX: wrong Registry URL (stavagent-backend-ktwx → rozpocet-registry) | ✅ |

---

### Ключевые изменения:

#### 1. Position Instance Architecture (docs/POSITION_INSTANCE_ARCHITECTURE.ts)
```
Двухуровневая модель для исключения "двух правд":

Level 1: PositionInstance — конкретная строка на конкретном листе
  - position_instance_id (UUID) — единственный ID для связи киосков
  - monolith_payload (JSON) — результат расчёта Monolit
  - dov_payload (JSON) — распис ресурсов (labor, machinery, materials, formwork, pump)
  - overrides (JSON) — ручные правки после шаблона
  - template_id + template_confidence (GREEN/AMBER/RED)

Level 2: PositionTemplate — переиспользуемый шаблон
  - catalog_code + unit + normalized_description
  - monolith_template + dov_template (нормализованы на qty=1)
  - scaling_rule: linear | fixed | manual

Включает:
  - MonolithPayload (crew, days, KROS rounding, formwork/rebar subtypes)
  - DOVPayload (labor, machinery, materials, formwork rental, pump rental)
  - API контракты (GET/POST per payload, Templates API, Audit Log)
  - SQL миграции (5 фаз, backward compatible)
  - Compatibility map: existing fields → new fields
```

#### 2. Portal Auto-Link Fix
```
БЫЛО: portalAutoSync.ts sync → получал portal_project_id → НЕ сохранял в store
      → пользователь вручную вводил UUID в текстовое поле
СТАЛО: setAutoLinkCallback → store регистрирует callback
      → после успешного sync → linkToPortal() автоматически
      → проекты линкуются без участия пользователя
```

#### 3. PortalLinkBadge v2 — Project Picker
```
БЫЛО: текстовое поле "Введите UUID" → пользователь мог ввести "d6"
СТАЛО:
  1. "Vytvořit nový" — синк + auto-link одним кликом
  2. Список проектов из Portal API (с names, kiosk counts)
  3. Fallback на ручной ввод только если Portal недоступен
  4. Loading/error/empty states
```

#### 4. Portal Sleeping Backend UX
```
БЫЛО: fetch timeout → projects=[] → "Zatím žádné projekty" + "Vytvořit první"
      → пользователь создавал дубликат, думая что проектов нет
СТАЛО:
  - backendSleeping state → "Backend se probouzí..." + кнопка "Načíst znovu"
  - ?project=d6 not found → жёлтый баннер + "Zkusit znovu" + "Zavřít"
  - "Vytvořit první projekt" только когда backend ответил и проектов реально 0
```

---

### Коммиты сессии:
```
fa0242d DOCS: Position Instance Architecture v1.0 — two-level identity model
e56bb6e FIX: Portal project linking — auto-link, project picker, sleeping backend UX
```

### Изменённые файлы:
```
docs/POSITION_INSTANCE_ARCHITECTURE.ts                       NEW (868 lines)
rozpocet-registry/src/services/portalAutoSync.ts             +setAutoLinkCallback
rozpocet-registry/src/stores/registryStore.ts                +callback registration
rozpocet-registry/src/components/portal/PortalLinkBadge.tsx  rewritten v2
stavagent-portal/frontend/src/pages/PortalPage.tsx           +sleeping/notFound UX
stavagent-portal/frontend/src/components/portal/CorePanel.tsx       URL fix
stavagent-portal/frontend/src/components/portal/ParsePreviewModal.tsx URL fix
```

---

## ⏭️ Следующие задачи (приоритет)

### 🔴 Приоритет 1: Реализация Position Instance API (Phase 1)
```
Файл-спецификация: docs/POSITION_INSTANCE_ARCHITECTURE.ts

Phase 1 — DB migration:
  ALTER TABLE portal_positions ADD COLUMN position_instance_id UUID;
  ALTER TABLE portal_positions ADD COLUMN monolith_payload JSONB;
  ALTER TABLE portal_positions ADD COLUMN dov_payload JSONB;
  ALTER TABLE portal_positions ADD COLUMN template_id UUID;
  ALTER TABLE portal_positions ADD COLUMN template_confidence VARCHAR(10);
  ALTER TABLE portal_positions ADD COLUMN overrides JSONB;

Phase 2 — API endpoints:
  GET  /positions/{instance_id}/monolith
  POST /positions/{instance_id}/monolith
  GET  /positions/{instance_id}/dov
  POST /positions/{instance_id}/dov

Phase 3 — Templates:
  POST /templates (save as template)
  POST /templates/{id}/apply (apply to matches)
```

### 🔴 Приоритет 2: Universal Parser Phase 3 — Send to Kiosk
```
ParsePreviewModal → кнопка "Odeslat do Monolitu" / "Odeslat do Registry"
  → POST /api/monolit-import (Portal backend)
    → POST https://monolit-planner-api.onrender.com/import
```

### 🟠 Приоритет 3: Pump Calculator (TOVModal) — незакрытые задачи
```
[ ] handlePumpRentalChange — обработчик изменений
[ ] pumpCost — отображение в footer breakdown
[ ] auto-save PumpRentalSection — useRef isAutoSaving
```

### 🟡 Приоритет 4: Deep-links между киосками
```
Обновить формат ссылок:
  Старый: ?project=X&part=Y
  Новый:  ?project_id=X&position_instance_id=Y
Обратная совместимость: если только part=Y → resolve через lookup
```

---

## ⏳ AWAITING USER ACTION

### 1. Merge PR
```
Branch: claude/fix-ui-add-features-Wq8dc
Contains: Architecture doc + Portal linking fixes
```

### 2. Переменные окружения (Render)
```env
# concrete-agent (для Perplexity в KB Research):
PERPLEXITY_API_KEY=pplx-...

# concrete-agent (для OpenAI в FormworkAssistant):
OPENAI_API_KEY=sk-...
```

### 3. AI Suggestion Button (Monolit) — ожидает SQL
```bash
# Render Dashboard → monolit-db → Shell:
psql -U monolit_user -d monolit_planner < БЫСТРОЕ_РЕШЕНИЕ.sql
```

---

## 🧪 Статус тестов

| Сервис | Тесты | Статус |
|--------|-------|--------|
| Monolit shared formulas | 51/51 | ✅ Pass |
| rozpocet-registry tsc build | npx tsc --noEmit | ✅ Pass |
| rozpocet-registry vite build | npm run build | ✅ Pass |
| URS Matcher | 159 | ⚠️ Не запускались |

---

**При старте следующей сессии:**
```bash
1. Прочитай CLAUDE.md
2. Прочитай NEXT_SESSION.md (этот файл)
3. Прочитай docs/POSITION_INSTANCE_ARCHITECTURE.ts (архитектура интеграции)
4. git log --oneline -10
5. Спроси: Position Instance API (Phase 1) или Send to Kiosk или Pump TOVModal?
```

*Ready for next session!*
