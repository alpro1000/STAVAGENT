# 🧩 Component Architecture

Полная документация React компонентов в Monolit Planner.

---

## 📂 Структура компонентов

```
frontend/src/components/
├── Layout Components
│   ├── Header.tsx              # Главный header с навигацией
│   ├── Sidebar.tsx             # Sidebar с иерархией проектов
│   └── App.tsx                 # Root component
│
├── Table Components
│   ├── PositionsTable.tsx      # Главная таблица позиций
│   ├── PositionRow.tsx         # Редактируемая строка таблицы
│   ├── PartHeader.tsx          # Заголовок части конструкции
│   └── KPIPanel.tsx            # Панель KPI метрик
│
├── Modal Components
│   ├── WorkTypeSelector.tsx    # Выбор типа работ (beton, bednění...)
│   ├── NewPartModal.tsx        # Создание новой части с OTSKP
│   ├── CreateBridgeForm.tsx    # Форма создания моста
│   ├── EditBridgeForm.tsx      # Форма редактирования моста
│   ├── HistoryModal.tsx        # История snapshots
│   ├── FormulaDetailsModal.tsx # Детали формул
│   └── ExportHistory.tsx       # История экспортов
│
├── Input Components
│   ├── OtskpAutocomplete.tsx   # Автокомплит OTSKP поиска
│   ├── DaysPerMonthToggle.tsx  # Переключатель 30/22 дней
│   └── SnapshotBadge.tsx       # Индикатор locked snapshot
│
└── Utility Components
    └── ...
```

---

## 🔝 Layout Components

### Header.tsx

**Назначение:** Главный header приложения с навигацией и управлением мостами.

**Функции:**
- Логотип с refresh при клике (window.location.reload())
- Переключатель темы (☀️/🌙)
- Создание нового моста
- Выбор активного моста (dropdown)
- Редактирование моста
- Удаление моста
- Загрузка XLSX файлов
- Экспорт в XLSX/CSV
- Сохранение на сервер
- История экспортов

**Props:**
```typescript
interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}
```

**Tooltips:**
- 🏗️ Logo: "Obnovit aplikaci (F5)"
- ➕ Nový most: "Vytvořit nový most s prázdnými pozicemi"
- ✏️ Upravit most: "Upravit název a metadata mostu"
- 🗑️ Smazat most: "Smazat most (nevratné!)"
- 💾 Nahrát XLSX: "Nahrát Excel soubor s pozicemi mostů"
- 📥 Export XLSX: "Exportovat aktuální pozice do Excel souboru"
- 📥 Export CSV: "Exportovat aktuální pozice do CSV souboru"

**Commit:** `e2dec66` - Logo click refresh

---

### Sidebar.tsx

**Назначение:** Боковая панель с иерархией проектов и мостов.

**Функции:**
- **Иерархия проектов** (📁 Project → 🏗️ Bridge → ID)
- Collapsible folders по `project_name`
- Toggle 30/22 дней в месяц
- Фильтр "Jen problémy" (RFI)
- История snapshots
- Keyboard shortcut: Ctrl+B / Cmd+B

**Структура:**
```
📁 D6 Žalmanov – Knínice (3)
  ▼
  🏗️ SO 201 - Most na D6... (12 prvků)
  🏗️ SO 202 - Most na D6... (8 prvků)
  🏗️ SO 203 - Most na D6... (15 prvků)

📁 Bez projektu (2)
  ▼
  🏗️ SO 100 - Test Bridge (5 prvků)
```

**State:**
```typescript
const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
```

**Группировка:**
```typescript
const bridgesByProject = bridges.reduce((acc, bridge) => {
  const projectName = bridge.project_name || 'Bez projektu';
  if (!acc[projectName]) {
    acc[projectName] = [];
  }
  acc[projectName].push(bridge);
  return acc;
}, {} as Record<string, typeof bridges>);
```

**Commit:** `d60b887` - Project hierarchy

---

## 📊 Table Components

### PositionsTable.tsx

**Назначение:** Главная таблица позиций с группировкой по частям конструкции.

**Ключевые функции:**
- Группировка позиций по `part_name`
- Collapsible parts (expand/collapse)
- **Кнопка "🏗️ Přidat část konstrukce"** - открывает NewPartModal
- **Кнопка "➕ Přidat řádek"** - открывает WorkTypeSelector
- Lock/unlock через Snapshot system

**State:**
```typescript
const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
const [showWorkSelector, setShowWorkSelector] = useState(false);
const [selectedPartForAdd, setSelectedPartForAdd] = useState<string | null>(null);
const [showNewPartModal, setShowNewPartModal] = useState(false);
```

**Типы добавления:**

**Type 1: Создание новой части моста (NewPartModal)**
```typescript
// Создает новую часть с OTSKP кодом
const handleNewPartSelected = async (otskpCode: string, partName: string) => {
  const newPosition: Partial<Position> = {
    id: uuidv4(),
    bridge_id: selectedBridge,
    part_name: partName,
    item_name: partName,
    otskp_code: otskpCode,
    subtype: 'beton', // Первая позиция всегда beton
    unit: 'M3',
    qty: 0,
    // ... defaults
  };
  // Create via API
}
```

**Type 2: Добавление работ к существующей части (WorkTypeSelector)**
```typescript
// Добавляет строку работ выбранного типа
const handleWorkTypeSelected = async (subtype: Subtype, unit: Unit) => {
  const newPosition: Partial<Position> = {
    id: uuidv4(),
    bridge_id: selectedBridge,
    part_name: selectedPartForAdd,
    item_name: 'Nová práce',
    subtype: subtype, // beton, bednění, výztuž, oboustranné (opěry), jiné
    unit: unit,       // M3, m2, t, ks
    qty: 0,
    // ... defaults
  };
  // Create via API
}
```

**Commits:** `2ee3b10`, `d4e7935`

---

### PositionRow.tsx

**Назначение:** Редактируемая строка таблицы с вычислениями.

**Поля:**
- **Editable (orange):** qty, crew_size, wage_czk_ph, shift_hours, days
- **Computed (gray):** labor_hours, cost_czk, concrete_m3
- **Key metric (green):** unit_cost_on_m3 ⭐
- **KROS (green):** kros_unit_czk, kros_total_czk

**Icons по subtype:**
```typescript
const SUBTYPE_ICONS: Record<Subtype, string> = {
  'beton': '🧱',
  'bednění': '🪵',
  'výztuž': '⚙️',
  'oboustranné (opěry)': '📐',
  'podpěrná skruž': '🔩',
  'jiné': '➕'
};
```

**Tooltips на всех полях** с формулами.

---

### PartHeader.tsx

**Назначение:** Заголовок части конструкции с OTSKP поиском.

**Поля:**
- **Název části konstrukce** (item_name)
- **Objem betonu celkem** (betonQuantity)
- **OTSKP kód** с OtskpAutocomplete

**Callbacks:**
```typescript
interface Props {
  itemName?: string;
  betonQuantity: number;
  otskpCode?: string;
  onItemNameUpdate: (itemName: string) => void;
  onBetonQuantityUpdate: (quantity: number) => void;
  onOtskpCodeUpdate: (code: string) => void;
  isLocked: boolean;
}
```

**Auto-fill:** При выборе OTSKP кода автоматически заполняет item_name.

---

### KPIPanel.tsx

**Назначение:** Панель с ключевыми метриками проекта.

**Метрики:**
- Сумма KROS (CZK)
- Объем бетона (m³)
- Единичная цена (CZK/m³)
- Единичная цена (CZK/t)
- Средний размер партии
- Средняя зарплата
- Смена (часов)
- **Длительность (месяцы)**
- **Длительность (недели)**

**Элементы управления:**
- **DaysPerMonthToggle** (30/22 дней)
- **Кнопка "Zafixovat"** (lock/unlock snapshot)

**Стили locked state:**
```css
.btn-lock-kpi.unlocked {
  background: var(--color-warning); /* Orange */
  border-color: var(--color-warning);
}

.btn-lock-kpi.locked {
  background: var(--color-success); /* Green */
  border-color: var(--color-success);
  cursor: default;
  pointer-events: none;
}
```

---

## 🪟 Modal Components

### WorkTypeSelector.tsx ⭐ NEW

**Назначение:** Модальное окно для выбора типа работ при добавлении позиции.

**Типы работ:**
```typescript
const WORK_TYPES: WorkType[] = [
  { value: 'beton', label: 'Betonování', unit: 'M3', icon: '🧱' },
  { value: 'bednění', label: 'Bednění', unit: 'm2', icon: '🪵' },
  { value: 'výztuž', label: 'Výztuž', unit: 't', icon: '⚙️' },
  { value: 'oboustranné (opěry)', label: 'Oboustranné bednění', unit: 'm2', icon: '📐' },
  { value: 'jiné', label: 'Jiné (vlastní práce)', unit: 'ks', icon: '➕' }
];
```

**Interface:**
```typescript
interface WorkType {
  value: Subtype;
  label: string;
  unit: Unit;
  icon: string;
}

interface Props {
  onSelect: (subtype: Subtype, unit: Unit) => void;
  onCancel: () => void;
}
```

**UI:**
- Grid layout (2 columns на desktop, 1 на mobile)
- Карточки с иконками и labels
- Visual feedback при hover
- Pulse animation при selection
- Backdrop blur

**Использование:**
```typescript
{showWorkSelector && selectedPartForAdd && (
  <WorkTypeSelector
    onSelect={handleWorkTypeSelected}
    onCancel={handleWorkTypeCancelled}
  />
)}
```

**Commit:** `2ee3b10`

---

### NewPartModal.tsx ⭐ NEW

**Назначение:** Модальное окно для создания новой части конструкции с OTSKP поиском.

**Шаги:**
1. **Поиск OTSKP кода** (опционально)
   - Autocomplete с 17,904 кодами
   - Поиск по коду или названию
2. **Название части конструкции**
   - Auto-fill из OTSKP или ручной ввод
   - Пример: "ZÁKLADY ZE ŽELEZOBETONU DO C30/37"

**Interface:**
```typescript
interface Props {
  onSelect: (code: string, name: string) => void;
  onCancel: () => void;
}
```

**State:**
```typescript
const [selectedCode, setSelectedCode] = useState('');
const [selectedName, setSelectedName] = useState('');
const [partName, setPartName] = useState('');
```

**Auto-fill логика:**
```typescript
const handleOtskpSelect = (code: string, name: string) => {
  setSelectedCode(code);
  setSelectedName(name);
  setPartName(name); // Auto-fill part name from OTSKP
};
```

**Validation:**
- Кнопка "Vytvořit část" disabled пока `partName.trim()` пустой

**Commit:** `2ee3b10`

---

### CreateBridgeForm.tsx

**Назначение:** Форма создания нового моста.

**Поля:**
- bridge_id (SO201, SO202...)
- object_name (optional)
- project_name (optional)
- span_length_m (optional)
- deck_width_m (optional)
- pd_weeks (optional)

**Tooltips:**
- Submit: "Vytvořit nový most se zadanými parametry"
- Cancel: "Zavřít formulář bez uložení"

**Commit:** `79807a5`

---

### EditBridgeForm.tsx

**Назначение:** Форма редактирования существующего моста.

**Tooltips:**
- Submit: "Uložit změny v názvu a parametrech mostu"
- Cancel: "Zavřít formulář bez uložení změn"

**Commit:** `79807a5`

---

## 🔍 Input Components

### OtskpAutocomplete.tsx

**Назначение:** Autocomplete поиск по OTSKP каталогу (17,904 кодов).

**Функции:**
- Debounced search (300ms)
- Поиск по коду или названию
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Highlighting selected item

**Interface:**
```typescript
interface Props {
  value: string;
  onSelect: (code: string, name: string) => void;
  disabled?: boolean;
}
```

**API:**
```typescript
const response = await otskpAPI.search(searchQuery, 20);
```

**Result display:**
```
┌─────────────────────────────────────┐
│ 121101105  129.00 Kč/M3            │
│ ZÁKLADY ZE ŽELEZOBETONU DO C30/37  │
│ Spec: Betonové konstrukce          │
├─────────────────────────────────────┤
│ 121101106  132.00 Kč/M3            │
│ ŘÍMSY ZE ŽELEZOBETONU DO C30/37    │
└─────────────────────────────────────┘
```

---

### DaysPerMonthToggle.tsx

**Назначение:** Переключатель режима работы (30 или 22 дня в месяц).

**Режимы:**
- **30 дней:** Непрерывная работа (включая выходные)
- **22 дня:** Рабочие дни (без выходных)

**Tooltips:**
- 30 дней: "Režim 30 dní/měsíc (nepřetržitá práce, víkendy)"
- 22 дней: "Režim 22 dní/měsíc (pracovní dny, bez víkendů)"

**State:**
```typescript
const { daysPerMonth, setDaysPerMonth } = useAppContext();
```

**Commit:** `79807a5`

---

### SnapshotBadge.tsx

**Назначение:** Индикатор заблокированного snapshot с кнопкой разблокировки.

**Состояния:**
- **Unlocked:** Редактирование разрешено
- **Locked:** Snapshot заблокирован, показывает:
  - Дату создания snapshot
  - Кнопку "🔓 Odemknout"

**Tooltip:**
- Unlock button: "Odemknout snapshot a povolit úpravy"

---

## 🎨 Стили компонентов

### Новые CSS классы (commit `d60b887`)

**Project Hierarchy:**
```css
.project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-group {
  border-radius: 6px;
  overflow: hidden;
}

.project-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-dark);
  border: 1px solid var(--border-default);
  cursor: pointer;
}

.project-toggle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.project-icon {
  font-size: 1rem; /* 📁 */
}

.project-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 10px;
}

.bridge-list {
  padding-left: 20px; /* Indentation для visual hierarchy */
}
```

**Button Styles:**
```css
.btn-add-part {
  background: var(--accent-primary);
  color: var(--bg-secondary);
  border-color: var(--accent-primary);
}

.btn-add-part:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

## 📦 Type Definitions

### Shared Types (`@monolit/shared`)

```typescript
export type Subtype =
  | 'beton'
  | 'bednění'
  | 'oboustranné (opěry)'
  | 'podpěrná skruž'
  | 'výztuž'
  | 'jiné';

export type Unit = 'M3' | 'm2' | 'kg' | 'ks' | 't' | 'other';

export interface Position {
  id?: string;
  bridge_id: string;
  part_name: string;
  item_name: string;
  otskp_code?: string;
  subtype: Subtype;
  unit: Unit;
  qty: number;
  crew_size: number;
  wage_czk_ph: number;
  shift_hours: number;
  days: number;
  // Computed fields
  labor_hours?: number;
  cost_czk?: number;
  concrete_m3?: number;
  unit_cost_on_m3?: number;
  kros_unit_czk?: number;
  kros_total_czk?: number;
  has_rfi?: boolean;
  rfi_message?: string;
}

export interface Bridge {
  bridge_id: string;
  project_name?: string;
  object_name: string;
  element_count: number;
  concrete_m3: number;
  sum_kros_czk: number;
  span_length_m?: number;
  deck_width_m?: number;
  pd_weeks?: number;
  created_at?: string;
}
```

---

## 🔄 Component Lifecycle

### Типичный flow создания позиции (Type 2):

1. User clicks "➕ Přidat řádek" в PositionsTable
2. `handleAddRow(partName)` вызывается:
   ```typescript
   setSelectedPartForAdd(partName);
   setShowWorkSelector(true);
   ```
3. Показывается WorkTypeSelector modal
4. User выбирает тип работ (например, "bednění")
5. `handleWorkTypeSelected('bednění', 'm2')` вызывается:
   ```typescript
   const newPosition = {
     subtype: 'bednění',
     unit: 'm2',
     qty: 0,
     // ...
   };
   await positionsAPI.create(selectedBridge, [newPosition]);
   ```
6. Backend calculates computed fields
7. State updates via `setPositions(result.positions)`
8. Table re-renders with new row

### Типичный flow создания части (Type 1):

1. User clicks "🏗️ Přidat část konstrukce"
2. `setShowNewPartModal(true)`
3. Показывается NewPartModal
4. User ищет OTSKP код "základ"
5. Выбирает "121101105 - ZÁKLADY ZE ŽELEZOBETONU DO C30/37"
6. Auto-fill `partName` from OTSKP name
7. User clicks "Vytvořit část"
8. `handleNewPartSelected('121101105', 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37')`:
   ```typescript
   const newPosition = {
     part_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37',
     item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37',
     otskp_code: '121101105',
     subtype: 'beton', // First position always beton
     unit: 'M3',
     // ...
   };
   await positionsAPI.create(selectedBridge, [newPosition]);
   ```
9. Backend creates first "beton" position
10. State updates, new part appears in table

---

## 🎯 Best Practices

### 1. Типизация

Всегда используйте типы из `@monolit/shared`:
```typescript
import type { Position, Subtype, Unit } from '@monolit/shared';
```

### 2. State Management

- **Local state:** `useState` для UI состояния (modals, dropdowns)
- **Global state:** `useAppContext` для shared data
- **Server state:** React Query hooks (`usePositions`, `useBridges`)

### 3. Error Handling

```typescript
try {
  const result = await positionsAPI.create(...);
  // Success handling
} catch (error) {
  console.error(`❌ Error:`, error);
  alert(`Chyba: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
}
```

### 4. Tooltips

Всегда добавляйте tooltips на интерактивные элементы:
```typescript
<button
  title="Vytvořit nový most s prázdnými pozicemi"
  onClick={...}
>
  ➕ Nový most
</button>
```

### 5. Inline Styles в модалах

Для изоляции стилей используйте `<style>` внутри компонента:
```typescript
<div className="modal">
  {/* Content */}
  <style>{`
    .modal {
      /* styles */
    }
  `}</style>
</div>
```

---

## 📚 Related Documentation

- [README.md](./README.md) - Основная документация
- [DEPLOY.md](./DEPLOY.md) - Deployment guide
- [shared/src/types.ts](./shared/src/types.ts) - Type definitions
- [shared/src/formulas.ts](./shared/src/formulas.ts) - Calculation formulas

---

**Last Updated:** 2024-01-10
**Version:** 1.0.0
