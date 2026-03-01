# Next Session - Quick Start

**Last Updated:** 2026-03-01
**Current Branch:** `claude/monolit-position-writeback-LotnK`
**Last Session:** Cross-kiosk project registry (4 features) + production fixes

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

# 4. Run tests (104 total: 55 formulas + 27 scheduler + 22 other)
cd Monolit-Planner/shared && npx vitest run
```

---

## Сессия 2026-03-01: Cross-Kiosk Project Registry + Production Fixes

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| KioskLinksPanel.tsx | Portal frontend — UI for viewing linked kiosks per project | ✅ |
| monolithPolling.ts | Registry auto-polling for Monolit changes (30s/120s) | ✅ |
| MonolitCompareDrawer.tsx | Comparison drawer — Registry vs Monolit side-by-side | ✅ |
| App.tsx + ItemsTable.tsx | Conflict indicators (colored HardHat, pulse, compare button) | ✅ |
| Monolit server.js | CORS fix — allow all *.vercel.app preview domains | ✅ |
| passport_enricher.py | httpx proxy fix — `proxy` (singular) with fallback | ✅ |

### Новые файлы:
```
stavagent-portal/frontend/src/components/portal/KioskLinksPanel.tsx   NEW (186 lines)
rozpocet-registry/src/services/monolithPolling.ts                      NEW (186 lines)
rozpocet-registry/src/components/comparison/MonolitCompareDrawer.tsx    NEW (341 lines)
```

### Изменённые файлы:
```
stavagent-portal/frontend/src/components/portal/CorePanel.tsx          +KioskLinksPanel
rozpocet-registry/src/App.tsx                                          +polling, +compare drawer, +accept price
rozpocet-registry/src/components/items/ItemsTable.tsx                  +conflictMap, severity colors
Monolit-Planner/backend/server.js                                      +Vercel preview CORS
concrete-agent/.../passport_enricher.py                                +httpx proxy compat
```

### Архитектура Auto-Polling + Comparison:
```
Registry App.tsx
  ├── useEffect → startPolling(projectId, portalProjectId, items, onUpdate)
  │     └── monolithPolling.ts
  │           ├── doPoll() every 30s (active tab) / 120s (background)
  │           ├── fetchMonolithData(portalProjectId) → Map<positionInstanceId, MonolithPayload>
  │           └── compute variance: (registryTotal - monolithTotal) / monolithTotal * 100
  │
  ├── conflictMap: Map<itemId, severity>
  │     └── ItemsTable: HardHat icon colored by severity (green/blue/amber/red)
  │
  └── MonolitCompareDrawer
        ├── Grouped by severity: conflict > warning > info > match
        ├── Each row: kod, popis, Registry price (blue) vs Monolit price (amber)
        └── "Přijmout cenu" button → accept Monolit price into Registry
```

### Severity thresholds:
```
|variance| < 5%   → match (green)
|variance| 5-15%  → info (blue)
|variance| 15-30% → warning (amber)
|variance| >= 30% → conflict (red, pulsing)
```

---

## Сессия 2026-02-27 (часть 3): RCPSP Element Scheduler

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| element-scheduler.ts | RCPSP scheduling engine — DAG, Kahn's topo sort, CPM, parallel scheme | ✅ |
| element-scheduler.test.ts | 27 comprehensive tests (edge cases, parametric, real-world) | ✅ |
| formulas.ts | Integration: `calculateElementTotalDays()` → `scheduleElement()` via metadata | ✅ |
| formulas.test.ts | 4 RCPSP integration tests (multi-tact, sequential, savings, fallback) | ✅ |
| ESM fix | `.js` extension for Node.js ESM runtime module resolution | ✅ |
| Refactor v2 | Replaced "textbook recommendations" with real graph algorithms | ✅ |

### Ключевые алгоритмы (element-scheduler.ts):

```
1. GRAPH: ActivityDAG — adjacency list (V, adjFS, adjSS, inFS, inSS, inDegreeFS)
2. TOPO SORT: Kahn's BFS algorithm O(V+E) with cycle detection
3. CPM: Forward pass (ES/EF) + Backward pass (LS/LF) including SS edges
4. RCPSP: Parallel scheduling scheme (NOT serial topo-order!)
   - At each step: scan ALL remaining activities, find ready ones
   - Pick activity with earliest feasible start (resource-aware)
   - Resources: formwork_crew (ASM+STR), rebar_crew (REB)
   - CUR/CON are passive (no crew needed → no resource conflict)
5. CRITICAL PATH: Slack analysis (LS - ES = 0) → bottleneck identification
```

### Критичное исправление — Serial vs Parallel scheme:
```
Serial (broken): Kahn's topo order → T0_ASM, T0_REB, T0_CON, T0_CUR, T0_STR, T1_ASM...
  → FW crew idle during T0 curing! No parallelism!

Parallel (correct): At each step, scan ALL remaining → find ready → pick earliest ES
  → T0_CUR running? Start T1_ASM on set 2! Crew utilized!
```

---

## Сессия 2026-02-27 (часть 2): Stage 1 Implementation

### ✅ Что сделано:

| Компонент | Задача | Статус |
|-----------|--------|--------|
| Portal DB Migration | Phase 8: position_instance_id, monolith_payload, dov_payload, templates, audit_log | ✅ |
| Portal API | Position Instances CRUD API (13 endpoints) | ✅ |
| Portal Integration | import-from-monolit → now saves monolith_payload + position_instance_id | ✅ |
| Portal Integration | import-from-registry → now saves sheet_name, row_index, skupina | ✅ |
| Portal Integration | for-registry → now returns position_instance_id + payloads | ✅ |
| Monolit Export | export-to-registry → builds MonolithPayload per spec | ✅ |
| server.js | Registered /api/positions route | ✅ |

---

### Ключевые изменения:

#### 1. DB Migration (`add-position-instance-architecture.sql`)
```sql
-- Phase 1: Extend portal_positions
ALTER TABLE portal_positions ADD COLUMN position_instance_id UUID DEFAULT gen_random_uuid();
ALTER TABLE portal_positions ADD COLUMN monolith_payload JSONB;
ALTER TABLE portal_positions ADD COLUMN dov_payload JSONB;
ALTER TABLE portal_positions ADD COLUMN overrides JSONB;
ALTER TABLE portal_positions ADD COLUMN template_id UUID;
ALTER TABLE portal_positions ADD COLUMN template_confidence VARCHAR(10);
ALTER TABLE portal_positions ADD COLUMN skupina VARCHAR(50);
ALTER TABLE portal_positions ADD COLUMN row_role VARCHAR(20) DEFAULT 'unknown';
ALTER TABLE portal_positions ADD COLUMN sheet_name VARCHAR(255);
ALTER TABLE portal_positions ADD COLUMN row_index INTEGER;
ALTER TABLE portal_positions ADD COLUMN created_by VARCHAR(100);
ALTER TABLE portal_positions ADD COLUMN updated_by VARCHAR(100);

-- Phase 2: position_templates table (natural key: code + unit + normalized_desc)
-- Phase 3: position_audit_log table (event tracking)
```

#### 2. Position Instances API (`/api/positions/`)
```
GET    /api/positions/project/:projectId           — List all, grouped by object
GET    /api/positions/:instanceId                  — Single instance
POST   /api/positions/project/:projectId/bulk      — Bulk create (Excel import)
PUT    /api/positions/:instanceId                  — Update core fields
DELETE /api/positions/:instanceId                  — Delete

GET    /api/positions/:instanceId/monolith         — Read monolith_payload
POST   /api/positions/:instanceId/monolith         — Write monolith_payload (Monolit)
GET    /api/positions/:instanceId/dov              — Read dov_payload
POST   /api/positions/:instanceId/dov              — Write dov_payload (Registry)

POST   /api/positions/templates                    — Save as template
GET    /api/positions/templates/:projectId         — List templates
POST   /api/positions/templates/:templateId/apply  — Apply with confidence matching
```

#### 3. Monolit Export → MonolithPayload
```
БЫЛО: monolit_metadata (flat fields: project_id, part_name, subtype, days)
СТАЛО: monolith_payload per POSITION_INSTANCE_ARCHITECTURE.ts spec
  — все расчётные поля (crew, wage, shift, days, labor_hours, costs)
  — KROS pricing (unit_cost_on_m3, kros_unit_czk, kros_total_czk)
  — deep-link URL к Monolit frontend
  — source_tag, confidence, calculated_at
```

#### 4. Template System
```
Workflow: Calculate in Monolit → Save as Template → Apply to N matches
- Natural key: catalog_code + unit + normalized_description
- Confidence: GREEN (exact) / AMBER (partial) / RED (code-only)
- Scaling: linear (proportional), fixed (same), manual (user review)
- Audit trail: position_audit_log with event tracking
```

---

### Новые/изменённые файлы (часть 3 — RCPSP):
```
Monolit-Planner/shared/src/calculators/element-scheduler.ts     NEW (~500 lines — RCPSP engine)
Monolit-Planner/shared/src/calculators/element-scheduler.test.ts NEW (27 tests)
Monolit-Planner/shared/src/calculators/index.ts                  +export element-scheduler
Monolit-Planner/shared/src/formulas.ts                           +scheduleElement integration, +safeParseMeta
Monolit-Planner/shared/src/formulas.test.ts                      +4 RCPSP integration tests (total: 55)
```

### Новые/изменённые файлы (часть 2 — Stage 1):
```
stavagent-portal/backend/src/db/migrations/add-position-instance-architecture.sql   NEW (107 lines)
stavagent-portal/backend/src/db/migrations.js                                        +runPhase8Migrations()
stavagent-portal/backend/src/routes/position-instances.js                             NEW (670 lines)
stavagent-portal/backend/src/routes/integration.js                                   updated (monolith_payload, instance_id)
stavagent-portal/backend/server.js                                                   +positionInstancesRoutes
Monolit-Planner/backend/src/routes/export-to-registry.js                             +MonolithPayload builder
```

---

## ⏭️ Следующие задачи (приоритет)

### 🔴 Приоритет 1: Monolit → Position Instance write-back integration
```
Monolit при расчёте позиции должен:
  1. Знать position_instance_id (получать при import/link)
  2. POST /api/positions/:instanceId/monolith при сохранении
  3. Обратная связь: Monolit positions table → position_instance_id column

Файлы:
  - Monolit-Planner/backend/src/routes/positions.js (PUT handler)
  - Monolit-Planner/backend/src/routes/upload.js (import flow)
  - Monolit-Planner/backend/migrations/ (add position_instance_id column)
```

### 🔴 Приоритет 2: Registry → DOV write-back integration
```
Registry TOVModal при сохранении должен:
  1. Знать position_instance_id (получать from Portal при sync)
  2. POST /api/positions/:instanceId/dov при сохранении
  3. Auto-sync при изменении TOV данных

Файлы:
  - rozpocet-registry/src/components/tov/TOVModal.tsx
  - rozpocet-registry/src/services/portalAutoSync.ts
```

### 🟠 Приоритет 3: Deep-links + URL routing
```
Формат: ?project_id=X&position_instance_id=Y
  - Monolit: open specific position in PositionsTable
  - Registry: scroll to specific item in ItemsTable
  - Portal: show position details across all kiosks
```

### 🟡 Приоритет 4: Universal Parser → Bulk Import
```
ParsePreviewModal → "Odeslat do Monolitu" / "Odeslat do Registry"
  → POST /api/positions/project/:projectId/bulk
  → Create PositionInstances from parsed Excel
```

---

## ⏳ AWAITING USER ACTION

### 1. Deploy Portal Backend
```
Portal backend needs redeployment to apply:
  - Phase 8 DB migration (position_instance_id)
  - /api/positions/ endpoints
  - Updated /api/integration/ endpoints
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

## 📊 Stage 1 Progress

```
Спецификация:        100% задокументирована (869 lines)
Stage 1 (7 задач):   ~70% реализовано

  S1-1: DB Migration (portal_positions, templates, audit_log)  ✅
  S1-2: Integration routes + position_instance_id              ✅
  S1-3: CRUD API (13 endpoints)                                ✅
  S1-4: Monolit export → MonolithPayload                       ✅
  S1-5: monolith_payload + dov_payload write-back API          ✅
  S1-6: Unified upload flow (bulk import endpoint)             ✅
  S1-7: Deep links (URL format)                                ⏳ Pending

Stage 2 (9 задач):   0% реализовано
  - Monolit ↔ Portal bidirectional sync
  - Registry ↔ Portal DOV sync
  - Template UI in kiosks
  - Audit log viewer
```

---

## 🧪 Статус тестов

| Сервис | Тесты | Статус |
|--------|-------|--------|
| Monolit shared (formulas + scheduler) | 82/82 (55 + 27) | ✅ Pass |
| rozpocet-registry tsc build | npx tsc --noEmit | ✅ Pass |
| rozpocet-registry vite build | npm run build | ✅ Pass |
| URS Matcher | 159 | ⚠️ Не запускались |

---

**При старте следующей сессии:**
```bash
1. Прочитай CLAUDE.md
2. Прочитай NEXT_SESSION.md (этот файл)
3. Прочитай docs/POSITION_INSTANCE_ARCHITECTURE.ts (архитектура)
4. git log --oneline -10
5. Задачи: Monolit write-back || Registry DOV sync || Deep links
```

*Ready for next session!*
