# Next Session TODO

**Updated:** 2026-03-21
**From Session:** 15 (LandingPage fix + Pump Calculator + Element Planner + Portal UI)
**Branch to merge:** `claude/read-markdown-files-aZoFV` (19 коммитов, tests ✅)

---

## Чеклист для начала работы

1. [ ] Merge ветку `claude/read-markdown-files-aZoFV` в main (или создать PR)
2. [ ] Проверить Vercel deploy после merge (LandingPage TS fix)
3. [ ] Прочитать CLAUDE.md + BACKLOG.md для полного контекста
4. [ ] Выбрать задачу из списка ниже

---

## Задачи (приоритизированные)

### 🔴 Sprint 2: Service Connections (блокировано MASTER_ENCRYPTION_KEY)

**Файлы для создания/изменения:**
```
stavagent-portal/backend/src/services/encryptionService.js   ← NEW
stavagent-portal/backend/src/routes/connections.js            ← NEW
stavagent-portal/backend/src/middleware/rateLimiter.js         ← ADD connectionTestLimiter
stavagent-portal/frontend/src/pages/ConnectionsPage.tsx       ← NEW
stavagent-portal/frontend/src/components/connections/          ← NEW dir
```

**8 API endpoints:**
```
GET/POST/PUT/DELETE  /api/connections
POST                 /api/connections/:id/test
GET                  /api/connections/model-config
GET/PATCH            /api/connections/kiosk-toggles
```

### 🟠 Universal Parser Phase 2 (не блокировано)

**Файлы:**
```
stavagent-portal/frontend/src/pages/ParsePreviewPage.tsx      ← NEW
stavagent-portal/frontend/src/components/parse/               ← NEW dir
Monolit-Planner/frontend/src/components/LoadFromPortal.tsx    ← NEW
rozpocet-registry/src/components/LoadFromPortal.tsx           ← NEW
```

**Endpoints уже готовы (Phase 1):**
- `GET /api/portal-projects/:id/parsed-data`
- `GET /api/portal-projects/:id/summary`
- `GET /api/portal-projects/:id/for-kiosk/:type`

### 🟡 Pump Calculator TOVModal

**Файлы:**
```
rozpocet-registry/src/components/TOVModal.tsx   ← ADD handlePumpRentalChange
rozpocet-registry/src/components/TOVModal.tsx   ← ADD pumpCost to footer
```

### 🟢 Технический долг

- [ ] Node.js 18 → 20/22 (все сервисы)
- [ ] npm audit fix (4 уязвимости)
- [ ] React Error Boundaries
- [ ] Document Accumulator → persistent storage
- [ ] Vitest migration (Monolit Jest → Vitest)

---

## Полезные ссылки

| Ресурс | Путь |
|--------|------|
| Главный CLAUDE.md | `/CLAUDE.md` |
| Backlog | `/BACKLOG.md` |
| API контракты | `/docs/STAVAGENT_CONTRACT.md` |
| Sprint план | `/PLAN_CABINETS_ROLES_BILLING.md` |
| Position архитектура | `/docs/POSITION_INSTANCE_ARCHITECTURE.ts` |
| Monolit CLAUDE.md | `/Monolit-Planner/CLAUDE.MD` |
| CORE CLAUDE.md | `/concrete-agent/CLAUDE.md` |
