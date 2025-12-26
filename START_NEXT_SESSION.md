# 🚀 Шаблон для начала следующей сессии

**Копируй и вставляй это сообщение в начале новой сессии**

---

```
Привет! Продолжаю работу над STAVAGENT.

Контекст:
- Последняя сессия: Time Norms Automation + Portal Services Hub (2025-12-26)
- Ветки:
  - claude/implement-time-norms-automation-qx8Wm (Time Norms)
  - claude/add-portal-services-qx8Wm (Portal + Design System)
- Последние коммиты:
  - a787070 - FEAT: Add Portal Services Hub + Digital Concrete Design System
  - 80e724e - FIX: Add feature flag check to AI suggestion button
  - 9279263 - FEAT: Implement Time Norms Automation with AI-powered days suggestion
- Статус:
  ✅ Time Norms Automation реализована (AI-powered days estimation)
  ✅ Portal Services Hub создан (6 kiosks: 2 active, 4 coming soon)
  ✅ Design System "Digital Concrete" внедрён в Portal
  🟢 Готов к rollout дизайна на другие сервисы

Что сделано в последней сессии:

1. Time Norms Automation (4 часа):
   - Backend: timeNormsService.js (350 строк)
   - API: POST /api/positions/:id/suggest-days
   - Frontend: Sparkles button (✨) + AI tooltip
   - Feature flag: FF_AI_DAYS_SUGGEST = true
   - Тесты: 68/68 passing

2. Portal Services Hub + Design System (3 часа):
   - DESIGN_SYSTEM.md (8 страниц, 332 строки)
   - tokens.css + components.css (BEM naming)
   - ServiceCard.tsx component
   - PortalPage.tsx полностью переписан
   - 6 сервисов: Monolit, URS, Pump, Formwork, Earthwork, Rebar

Приоритет сегодня:
⭐ РЕКОМЕНДУЮ: Применить Design System к Monolit Planner и URS Matcher (3-4 часа)

План:
1. Скопировать design system files в Monolit-Planner - 15min
2. Импортировать CSS в main.tsx - 5min
3. Рефакторить компоненты (Header, Sidebar, PositionRow) - 1.5h
4. Удалить redundant стили из global.css - 30min
5. Повторить для URS Matcher - 1.5h

Детальный план см. в NEXT_SESSION.md → OPTION A
Design System: см. DESIGN_SYSTEM.md

Начинаю...
```

---

## 📚 Полезные файлы

- **NEXT_SESSION.md** - Детальная сводка последней сессии + план следующей (797 строк)
- **DESIGN_SYSTEM.md** - Полная документация Design System (8 страниц, 332 строки)
- **CLAUDE.md** - Полная документация всей системы

---

## 🔗 Быстрые команды

```bash
# Проверить статус
cd /home/user/STAVAGENT
git status
git log --oneline -5

# Посмотреть Design System
cat DESIGN_SYSTEM.md

# Посмотреть детальный план
cat NEXT_SESSION.md | grep -A 30 "OPTION A"

# Скопировать design system в Monolit
mkdir -p Monolit-Planner/frontend/src/styles/design-system
cp stavagent-portal/frontend/src/styles/design-system/*.css \
   Monolit-Planner/frontend/src/styles/design-system/

# Запустить тесты
cd Monolit-Planner/shared && npm test  # 34 formula tests
cd Monolit-Planner/backend && npm run test:unit  # Backend tests
```

---

## 🎯 Альтернативные задачи (если не Design System)

### Вариант B: Time Norms Enhancements (2-3 hours)
- Добавить Historical Learning System (сохранять feedback пользователей)
- Batch Suggestion (AI для всех позиций проекта сразу)
- Confidence Threshold (auto-fill только если confidence > 80%)
- Alternative Estimates (показывать range вместо одного числа)

### Вариант C: Production Deployment (2 hours)
- Обновить CLAUDE.md и README.md
- Проверить environment variables на Render.com
- Создать PRs для обеих веток
- Deploy to staging → testing → production

### Вариант D: xlsx Vulnerability Mitigation (2-3 hours)
- Migrate from `xlsx` to `exceljs` for Excel parsing
- Risk: Medium (Excel parsing is critical)
- Benefit: Устранить 2 high severity vulnerabilities

---

## 📊 Текущее состояние

**Ветки (готовы к PR):**
- `claude/implement-time-norms-automation-qx8Wm`
- `claude/add-portal-services-qx8Wm`

**Файлы созданы:**
- `Monolit-Planner/backend/src/services/timeNormsService.js`
- `DESIGN_SYSTEM.md`
- `stavagent-portal/frontend/src/styles/design-system/tokens.css`
- `stavagent-portal/frontend/src/styles/design-system/components.css`
- `stavagent-portal/frontend/src/components/portal/ServiceCard.tsx`

**Файлы изменены:**
- `Monolit-Planner/backend/src/routes/positions.js` (+35 lines)
- `Monolit-Planner/frontend/src/components/PositionRow.tsx` (+85 lines)
- `stavagent-portal/frontend/src/pages/PortalPage.tsx` (полностью переписан)
- `stavagent-portal/frontend/src/main.tsx` (+3 import lines)

**Зависимости добавлены:**
- `lucide-react` (Monolit-Planner) - для Sparkles icon

**Тесты:**
- ✅ 68/68 passing (Monolit-Planner)
- ✅ 34/34 formula tests passing

---

## 🎨 Design System Quick Reference

**Классы:**
- `.c-btn` / `.c-btn--primary` - Buttons
- `.c-panel` / `.c-panel--inset` - Panels
- `.c-card` - Interactive cards
- `.c-input` - Input fields
- `.c-badge` / `.c-badge--success` - Status badges
- `.c-tabs` / `.c-tab` - Tab navigation
- `.c-grid--2` / `.c-grid--3` - Responsive grids

**Цвета:**
- `--app-bg-concrete: #C9CBCD` - Background
- `--panel-bg-concrete: #CFD1D3` - Panels
- `--brand-orange: #FF9F1C` - Accent (CTA, numbers)
- `--text-primary: #2F3133` - Primary text
- `--text-secondary: #5A5D60` - Secondary text

**Тени:**
- `--elevation-low` / `--elevation-medium` / `--elevation-high` - Выпуклые
- `--depressed-inset` / `--depressed-deep` - Вдавленные

**Эффекты:**
- Buttons: `elevation-low` → hover: `scale(1.02)` → active: `depressed-inset` (вдавливается)
- Cards: `elevation-low` → hover: `elevation-high + translateY(-2px)` (поднимается)
- Inputs: всегда `depressed-inset` (вдавленные)

---

## 🚀 Features Ready for Production

### 1. Time Norms Automation
**Endpoint:** `POST /api/positions/:id/suggest-days`

**Response:**
```json
{
  "success": true,
  "suggested_days": 6,
  "reasoning": "Pro betonování 100 m³ s partou 4 lidí, standardní produktivita 5-8 m³/h...",
  "confidence": 92,
  "data_source": "KROS norma B4.3.1",
  "model_used": "gemini-2.0-flash-exp"
}
```

**UI:** Sparkles button (✨) рядом с полем "days" → tooltip с reasoning + auto-fill

**Feature Flag:** `FF_AI_DAYS_SUGGEST: true` (can be toggled via API)

### 2. Portal Services Hub
**URL:** Portal landing page

**Services:**
- 🪨 Monolit Planner (Active)
- 🔍 URS Matcher (Active)
- ⚙️ Pump Module (Coming Soon)
- 📦 Formwork Calculator (Coming Soon)
- 🚜 Earthwork Planner (Coming Soon)
- 🛠️ Rebar Optimizer (Coming Soon)

**Design:** Digital Concrete (Brutalist Neumorphism) - unified brand identity

---

**Создано:** 2025-12-26
**Для:** Следующей сессии работы над STAVAGENT
**Рекомендация:** Apply Design System to Monolit + URS (3-4 hours)
