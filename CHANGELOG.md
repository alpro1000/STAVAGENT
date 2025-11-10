# 📝 Changelog

Все важные изменения в проекте Monolit Planner.

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
