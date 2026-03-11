# 📝 Changelog

Все важные изменения в проекте Monolit Planner.

---

## [2.0.1] - 2025-12-23 - Critical Bug Fixes ✅

### 🔴 Critical Fixes

- **e87ad10**: 🚨 CRITICAL FIX: Import + bridge switch issue - positions now load correctly
  - **Problem**: After importing Excel with multiple bridges, switching between bridges showed no positions
  - **Root Cause 1**: `monolith_projects` table missing `project_name` and `status` columns on INSERT
  - **Root Cause 2**: React Query not refetching positions on bridge change (`refetchOnMount: false`)
  - **Root Cause 3**: Stale data from previous bridge displayed when switching
  - **Backend Fix** (`upload.js:255-273`):
    - Added `project_name` and `status='active'` to INSERT query
    - Ensures sidebar filtering works correctly (filters by `status='active'`)
  - **Frontend Fix** (`usePositions.ts`):
    - Added `useEffect` to clear positions on bridge change
    - Changed `refetchOnMount: false` → `true`
    - Reduced `staleTime` from 10min to 5min
  - **Impact**: Bridge switching now loads positions correctly

### 🔧 Bug Fixes

- **c99ac46**: ♻️ FEAT: Remove template auto-loading on manual project/bridge creation
  - **Problem**: Manual project creation loaded 42 template positions (35 unique) that users had to delete
  - **Solution**: Templates now ONLY used during Excel import (parser-driven)
  - **User Experience**: Manual creation now creates empty project
  - **Code Reduction**: -180 lines across `monolith-projects.js` and `bridges.js`
  - **Files Changed**:
    - `backend/src/routes/monolith-projects.js`: -130 lines
    - `backend/src/routes/bridges.js`: -50 lines

- **be1ebdd**: 🔧 FIX: Excel export - show custom name for 'jiné' instead of generic label
  - **Problem**: Export showed generic "jiné" label instead of user's custom work name
  - **Fix**: `exporter.js:316` now uses `pos.item_name || 'jiné'` for subtype='jiné'
  - **Impact**: Custom work names properly displayed in Excel exports

- **ca7c9cb**: ⚡ FIX: Speed (MJ/h) now editable with live recalculation
  - **Problem**: Speed calculated from stale `position.labor_hours` instead of current edited values
  - **Fix** (`PositionRow.tsx:234-247`):
    - Speed now calculates from CURRENT values: `qty / (crew_size × shift_hours × days)`
    - Bidirectional recalculation:
      - Edit speed → days recalculate
      - Edit days → speed recalculates
    - Min days = 0.5 (half-day minimum)
  - **Impact**: Speed column updates instantly when editing crew/hours/days

### 📊 Changes Summary

| File | Change | Lines | Status |
|------|--------|-------|--------|
| `upload.js` | Add project_name & status to INSERT | +2 | ✅ |
| `usePositions.ts` | Clear positions on bridge change | +5 | ✅ |
| `usePositions.ts` | refetchOnMount: true, staleTime: 5min | +2 | ✅ |
| `PositionRow.tsx` | Live speed recalculation | +15 | ✅ |
| `exporter.js` | Custom name for 'jiné' export | +1 | ✅ |
| `monolith-projects.js` | Remove template auto-loading | -130 | ✅ |
| `bridges.js` | Remove template auto-loading | -50 | ✅ |

### 📦 Commits

- `e87ad10` - 🚨 FIX: Import + bridge switch issue - positions now load correctly
- `ca7c9cb` - ⚡ FIX: Speed (MJ/h) now editable with live recalculation
- `be1ebdd` - 🔧 FIX: Excel export - show custom name for 'jiné' instead of generic label
- `c99ac46` - ♻️ FEAT: Remove template auto-loading on manual project/bridge creation

### 📚 Documentation

- Updated `/CLAUDE.md` to v1.0.8
- Updated `/NEXT_SESSION.md` with session summary

---

## [2.0.0] - 2025-11-20 - Phase 4 Complete ✅

### ✨ Major Features
- **User Management System**: Email verification, dashboard, admin panel, audit logging
- **Document Upload & Analysis**: Excel import, async analysis, work list generation
- **Professional Excel Export**: Dynamic formulas, formatting, multi-format support
- **Performance Optimization**: 10-20x faster operations, critical hang fixes

### 🔴 Critical Fixes
- **fe4be6a**: 📝 Documentation: Hang analysis and quick reference guide
- **2fd7199**: ⚡ CRITICAL FIX: Resolve project creation and file upload hangs
  - Frontend: Added 60-second timeout to axios instance
  - Backend: Batch insert positions in transaction (5-30s → 0.5-1s)
  - Backend: Batch insert parts with parameterized query (5-10s → 0.1s)
  - Impact: 10-20x performance improvement

### 🔧 Bug Fixes
- **7273670**: 🚨 CRITICAL FIX: Correct KROS formula in Excel export
  - Fixed: KROS formula was using qty instead of concrete_m3
  - Impact: 2-500× calculation errors for non-beton positions
  - Solution: Added "Objem m³" column, updated formula to L*K

- **7d44887**: 🔧 Render deployment configuration fixes
  - Fixed: Missing VITE_API_URL in frontend
  - Fixed: Wrong directory paths in backend
  - Fixed: Overly permissive CORS
  - Impact: Frontend-backend communication now works on Render

- **300f3d2**: ♻️ Excel export with formulas and professional formatting
  - Replaced static values with Excel formulas
  - Added professional formatting (zebra striping, freeze panes, auto-fit)
  - Added totals row with SUM formulas

### 📚 Documentation
- Updated claude.md with Phase 4 completion and hang analysis
- Updated README.md with v2.0.0 features
- Updated ROADMAP.md with Phase completion status
- Created HANG_ANALYSIS.md with performance audit
- Created HANG_POINTS_QUICK_REFERENCE.md

### 📊 Phase Completion
- Phase 1: ✅ Email Verification
- Phase 2: ✅ User Dashboard & Password Reset
- Phase 3: ✅ Admin Panel & Audit Logging
- Phase 4: ✅ Document Upload, Analysis, Excel Export
- Phase 5: 🔲 Ready to Start (Concrete-Agent Advanced Integration)

### 🚀 Performance Impact
| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| File Upload (100+ positions) | 30-60s | 3-5s | **10-20x** |
| Project Creation | 10-15s | 1-2s | **8-10x** |
| API Request Timeout | Infinite | 60s | ✅ Safe |

---

## [1.2.1] - 2025-11-11 (Legacy)

### 🐛 Исправлено

#### Upload Spinner CSS Animation
- **Problem**: Спиннер во время загрузки файла не крутился
- **Cause**: CSS @keyframes имел только состояние `to`, но не `from`
- **Fix**:
  - Добавлены явные keyframes: `from { transform: rotate(0deg); }`
  - Улучшен визуальный стиль через `border-right-color` градиент
  - Добавлена синхронизация состояния через `setIsUploading(true/false)`
- **File**: `frontend/src/components/Header.tsx:312-333`
- **Commit**: `7b5f438`

#### UTF-8 Diacritics in XLSX Parser
- **Problem**: Чешские диакритики (ě, č, ř, ů, š, ž) повреждались при парсинге
  - Example: "HNĚVKOV" → "HNÄ\x9AVKOV"
- **Cause**: XLSX библиотека не обрабатывала UTF-8 явно
- **Fix**:
  - Добавлены явные опции кодировки в `XLSX.readFile()`
  - Реализован цикл перекодирования для всех строк
  - Добавлено извлечение метаданных из заголовков (Stavba, Objekt, Soupis)
  - Генерирует описательные имена объектов: "SO 201 - MOST PŘES BIOKORIDOR V KM 1,480"
- **File**: `backend/src/services/parser.js:12-60`
- **Commit**: `7b5f438`

#### Part Name Synchronization with Item Name
- **Problem**: Название в сером заголовке не обновлялось при изменении item_name
  - Показывало новое имя на 1 секунду, потом возвращалось старое
  - Позиции непредсказуемо прыгали
- **Root Causes**:
  1. Серый заголовок показывал только `part_name` вместо полного `item_name`
  2. Нет логики автоматической синхронизации `part_name` ↔ `item_name`
  3. PUT endpoint возвращал позиции без ORDER BY, вызывая переупорядочение
- **Fixes**:
  1. **Frontend** (PositionsTable.tsx:379):
     - Серый заголовок теперь показывает `partPositions[0]?.item_name` с fallback на `partName`
  2. **Backend Smart Sync** (positions.js:19-283):
     - Добавлена константа `TEMPLATE_POSITIONS` со всеми валидными маппингами
     - Создана функция `findPartNameForItemName()`:
       1. Ищет в шаблоне (точное совпадение)
       2. Если найдено - использует `part_name` из шаблона
       3. Если нет - извлекает из `item_name` через `extractPartName()`
     - Добавлена автоматическая синхронизация в PUT маршруте
     - Добавлен `ORDER BY part_name, subtype` в PUT ответ (line 322)
  3. **Text Utils** (text.js:45-90):
     - Создана функция `extractPartName()` для извлечения короткого названия
     - Примеры: "ZÁKLADY ZE ŽELEZOBETONU DO C30/37" → "ZÁKLADY"
- **Files**:
  - `frontend/src/components/PositionsTable.tsx:379`
  - `backend/src/routes/positions.js:19-57, 276-283, 322`
  - `backend/src/utils/text.js:45-90`
- **Commits**: `7b5f438`, `c7ed406`, `4f0661a`, `cd9a621`

#### usePositions Hook Refactoring
- **Problem**: Undefined `bridgeId` в PUT запросах, race conditions при обновлении
- **Cause**: Hook не валидировал `bridgeId` перед отправкой API запроса
- **Fix**:
  - Полная переработка `frontend/src/hooks/usePositions.ts`
  - Явная валидация `bridgeId` в начале hook (line 18-20)
  - Валидация в `queryFn` перед fetch (line 25-28)
  - Валидация в `updateMutation.mutationFn` перед API вызовом (line 53-57)
  - Добавлено подробное логирование всех операций
  - Одинаковая обработка ошибок для всех mutations
- **File**: `frontend/src/hooks/usePositions.ts` (полная переработка)
- **Commit**: `4fd30d8`

### 📊 Changes Summary
| Component | Changes | Status |
|-----------|---------|--------|
| Header.tsx | CSS анимация | ✅ |
| parser.js | UTF-8 encoding | ✅ |
| PositionsTable.tsx | Display item_name | ✅ |
| positions.js (backend) | Smart sync logic | ✅ |
| usePositions.ts | Complete rewrite | ✅ |
| text.js | Extract function | ✅ |

### 🧪 Testing
- ✅ Спиннер анимируется при загрузке
- ✅ Диакритика сохраняется при парсинге
- ✅ Серый заголовок показывает полное имя
- ✅ Изменения part_name сохраняются
- ✅ Позиции остаются в правильном порядке
- ✅ bridgeId правильно передается в PUT

---

## [1.2.0] - 2025-11-11

### ✨ Добавлено

#### OTSKP Search Improvements - Accent-Insensitive Search
- **New Utility**: `backend/src/utils/text.js` with normalization functions
  - `normalizeForSearch()` - removes diacritics using Unicode NFD
  - `normalizeCode()` - strips non-alphanumeric from codes
- **New Database Field**: `search_name` in `otskp_codes` table
  - Pre-computed normalized names for fast search
  - Automatic migration for 17,904 existing codes
  - New index: `idx_otskp_search_name`
- **Enhanced Search Logic**:
  - Multiple WHERE clauses for flexible matching
  - 4-level relevance ranking in ORDER BY
  - Code search with/without spaces support
- **Search Capabilities**:
  - "zaklady" → finds "ZÁKLADY" (diacritic-insensitive)
  - "27 211" → finds "27211" (code formatting flexible)
  - All variants properly ranked by relevance

#### Automatic OTSKP Code Lookup for Estimates
- **New Function**: `findOtskpCodeByName()` in `upload.js`
- **Three-Level Fallback**:
  1. Extract code from Excel if present
  2. Auto-search catalog by work name if not found
  3. NULL if not found anywhere
- **Type-Specific Filtering**:
  - 'beton' → searches БЕТОН/BETONOVÁNÍ items
  - 'bednění' → searches BEDNAŘENÍ items
  - 'výztuž' → searches VÝZTUŽ/OCEL items
- **Auto-Fill Templates**: Even default templates get codes found automatically
- **Detailed Logging**: All matches logged with source and confidence

#### Prefabricated Elements Filter
- **Exclude Items**: prefa, prefabricated, dilce, díl, hotov, prefab
- **Purpose**: Remove non-monolithic prefab elements from parsing
- **Status**: Logged as skipped for debugging
- **File**: `backend/src/routes/upload.js:142-153`

#### Tablet Responsive Design
- **Breakpoint**: 769px - 1024px (iPad landscape, Android tablets)
- **Sidebar**: 250px width (visible on tablet, not collapsed)
- **Buttons**: min-height 40px, font-size 13px (touch-friendly)
- **KPI Grid**: 3 columns (vs 4 on desktop, 2 on mobile)
- **Input Fields**: min-height 40px, font-size 16px (prevents iOS zoom)
- **Dropdowns**: 44px min-height (Apple HIG compliance)
- **Tables**: font-size 13px with optimized padding
- **Modals**: max-width 85vw
- **Toggle Buttons**: 44px min-width, 40px min-height
- **File**: `frontend/src/styles/components.css:2122-2285` (164 lines)

#### OTSKP Import Endpoint Diagnostics
- **Logging**: `__dirname` and `process.cwd()` on import start
- **Path Checking**: Detailed list of all checked paths with status
- **Error Response**: Includes tried paths, cwd, dirname, helpful message
- **Multiple Fallbacks**: Handles dev, production, and Render paths

### 🐛 Исправлено

#### OTSKP Search Case-Sensitivity (P1)
- **Symptom**: "základy" (lowercase) → 0 results, "ZÁKLADY" (uppercase) → 71 results
- **Root Cause**: SQLite LIKE case-sensitive for UTF-8 diacritics
- **Fix**: Added `UPPER()` to both sides of LIKE clause in search SQL
- **File**: `backend/src/routes/otskp.js:101-102`

#### Route Ordering Issue (P1)
- **Symptom**: GET /api/otskp/count returned 404 or wrong result
- **Root Cause**: `/count` route caught by catch-all `/:code` pattern
- **Fix**: Reordered routes - specific before catch-all
- **Order**: /search → /count → /stats/summary → /:code → /import
- **File**: `backend/src/routes/otskp.js`

#### Authorization Security Issue (P1)
- **Symptom**: Fallback to hardcoded 'default-token-change-this'
- **Risk**: Attacker could bypass auth with known default
- **Fix**: Fail-closed - require OTSKP_IMPORT_TOKEN env var
- **Return**: 401 if env var not set, before checking request token
- **File**: `backend/src/routes/otskp.js:220-224`

#### OTSKP Codes Missing on Production
- **Symptom**: Render production had 0 codes, local dev had 17,904
- **Root Cause**: Import script never run on production server
- **Fix**: Created POST /api/otskp/import endpoint with auth
- **Trigger**: User must call endpoint with correct token
- **File**: `backend/src/routes/otskp.js:217-333`

### 📦 Commits

- `9dddd8c` Merge remote-tracking branch 'origin/codex/fix-search-functionality-in-codebase'
- `8c5adaf` Improve OTSKP search normalization (Codex)
- `0461254` 🔍 Add automatic OTSKP code lookup for concrete work items
- `288daa1` 🏗️ Add filter to exclude prefabricated elements (prefa dilce)
- `f2bb3ce` 🔍 Add comprehensive OTSKP import diagnostics
- `af5750a` 🔒 Fix critical OTSKP API issues - route ordering and authorization
- `5b46f77` 📱 Add comprehensive tablet responsive design

---

## [1.1.0] - 2024-01-10

### ✨ Добавлено

#### Work Type Selector (Type 2 - Добавление работ)
- **WorkTypeSelector.tsx** - Модальное окно выбора типа работ
- 5 типов работ: beton (M3), bednění (m2), výztuž (t), oboustranné (opěry) (m2), jiné (ks)
- Visual grid layout с иконками и units
- Интеграция в PositionsTable через кнопку "➕ Přidat řádek"
- Auto-select правильного unit для каждого типа работ

#### OTSKP Search для новых частей (Type 1 - Добавление элементов моста)
- **NewPartModal.tsx** - Модальное окно создания части с OTSKP поиском
- Кнопка "🏗️ Přidat část konstrukce" в PositionsTable
- Autocomplete поиск по 17,904 OTSKP кодам
- Auto-fill названия части из OTSKP каталога
- Создание первой позиции (beton) для новой части

#### Project Hierarchy в Sidebar
- Группировка мостов по `project_name`
- Collapsible folders с иконками (📁 Project → 🏗️ Bridge)
- Показ количества мостов в каждом проекте
- "Bez projektu" группа для мостов без project_name
- Все проекты expanded по умолчанию
- Visual indentation для bridge list (padding-left: 20px)

#### Tooltips для всех кнопок
- **Header.tsx:** ➕ Nový most, 💾 Nahrát XLSX, 📥 Export XLSX/CSV
- **DaysPerMonthToggle.tsx:** 30 dní (nepřetržitá práce), 22 dní (pracovní dny)
- **CreateBridgeForm.tsx:** Submit/Cancel buttons
- **EditBridgeForm.tsx:** Submit/Cancel buttons
- Все остальные кнопки уже имели tooltips

#### Logo Click Refresh
- Клик по логотипу (🏗️ Monolit Planner) → refresh страницы
- Visual cursor pointer on hover
- Tooltip: "Obnovit aplikaci (F5)"
- Функция: `window.location.reload()`

### 🐛 Исправлено

#### TypeScript Build Errors
- Fixed type mismatch в WorkTypeSelector и PositionsTable
- Изменено 'oboustranné' → 'oboustranné (opěry)' (correct Subtype)
- Добавлены imports: `Subtype`, `Unit` из `@monolit/shared`
- Правильная типизация function parameters и work type array

#### Infinite Spinner Bug (P1)
- Root cause: `useBridges.ts` вызывал `setBridges()` на каждом render
- Fix: Wrapped в `useEffect` с `[query.data, setBridges]` dependencies
- Предотвращает render loop при закрытии EditBridgeForm modal

#### 'jiné' Subtype Bug
- User correction: 'jiné' это VALID subtype и должен позволять полную кастомизацию
- Reverted от 'beton' обратно к 'jiné' как default для custom work
- Changed unit от 'M3' → 'ks', qty от 1 → 0
- Добавлен TODO для work selection dialog (теперь реализован)

### 🎨 Стили

#### Project Hierarchy CSS
```css
.project-list          /* Container для project groups */
.project-group         /* Individual project с header + bridges */
.project-header        /* Clickable header (toggle, icon, name, count) */
.project-toggle        /* ▶/▼ треугольник */
.project-icon          /* 📁 иконка */
.project-name          /* Название проекта */
.project-count         /* Количество мостов */
.bridge-list           /* Indented (padding-left: 20px) */
```

#### Button Styles
```css
.btn-add-part          /* Кнопка добавления части */
.btn-add-part:hover    /* Hover с transform и shadow */
```

### 📦 Commits

- `2ee3b10` - ✨ Add work type selector + OTSKP search for new parts
- `79807a5` - 📝 Add tooltips to all buttons
- `e2dec66` - ✨ Add logo click to refresh application
- `d60b887` - ✨ Add project hierarchy to sidebar
- `d4e7935` - 🐛 Fix infinite spinner + Revert 'jiné' to valid option

### 📚 Документация

- **README.md** - Обновлен раздел "Key Features" с новыми функциями
- **COMPONENTS.md** - Новый файл с детальной документацией всех компонентов
- **CHANGELOG.md** - Этот файл

### 🔧 Технические изменения

**Новые компоненты:**
```
frontend/src/components/
├── WorkTypeSelector.tsx    # Modal для выбора типа работ
└── NewPartModal.tsx        # Modal для создания части с OTSKP
```

**Обновленные компоненты:**
```
frontend/src/components/
├── PositionsTable.tsx      # Интеграция обоих modals
├── Sidebar.tsx             # Project hierarchy
├── Header.tsx              # Logo click refresh
├── DaysPerMonthToggle.tsx  # Tooltips
├── CreateBridgeForm.tsx    # Tooltips
└── EditBridgeForm.tsx      # Tooltips
```

**Обновленные стили:**
```
frontend/src/styles/
└── components.css          # Project hierarchy + button styles
```

### 🎯 Breaking Changes

Нет breaking changes.

### ⚠️ Deprecations

Нет deprecations.

### 🔒 Security

Нет security изменений.

---

## [1.0.0] - 2024-01-09

### ✨ Initial Release

- Full-stack monorepo architecture
- SQLite database with migrations
- Excel XLSX import/export
- OTSKP catalog integration (17,904 codes)
- Position calculations (CZK/m³ metric)
- KROS rounding
- Duration estimation (months/weeks)
- Snapshot system (lock/unlock)
- RFI warnings
- Dark/Light theme toggle
- Responsive design

---

## Формат версионирования

Проект использует [Semantic Versioning](https://semver.org/):
- **MAJOR** version для несовместимых API изменений
- **MINOR** version для новых функций с обратной совместимостью
- **PATCH** version для bug fixes

## Типы изменений

- ✨ **Добавлено** - новые функции
- 🔄 **Изменено** - изменения в существующей функциональности
- 🗑️ **Удалено** - удаленные функции
- 🐛 **Исправлено** - исправления багов
- 🔒 **Безопасность** - security fixes
- 📚 **Документация** - изменения в документации
- 🎨 **Стили** - изменения UI/CSS
- ⚡ **Производительность** - performance improvements
- 🧪 **Тестирование** - добавление тестов

---

**Maintained by:** alpro1000
**Repository:** https://github.com/alpro1000/Monolit-Planner
