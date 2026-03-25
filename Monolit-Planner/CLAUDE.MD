# 🏗️ CLAUDE.MD — AI Context Document

**ВАЖНО: Этот файл — источник истины для AI-ассистента. Всегда обращайся к нему перед выполнением задач!**

---

## 📌 О ПРОЕКТЕ

**Название:** Monolit Planner
**Цель:** Веб-приложение для расчёта и планирования бетонных конструкций (мосты, здания, гаражи, туннели) в Чехии

**Заказчик:** Строительная компания (Чехия)
**Ключевое требование:** Привести ВСЕ затраты к единой метрике **CZK/м³ бетона** (даже если исходная ЕИ — м², кг, ks)

**🚀 СТРАТЕГИЧЕСКИЙ ПЛАН РАЗВИТИЯ:** См. [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)
- Интеграция парсеров из concrete-agent
- Расширение на универсальные объекты (не только мосты)
- Автоматическое формирование таблиц из смет
- Дополнительные модули B0-B8 (Pump, Formwork, RFQ, etc.)

---

## 📁 СТРУКТУРА ПРОЕКТА

```
monolit-planner/
├── backend/                          ← Node.js + Express + SQLite
│   ├── src/
│   │   ├── db/
│   │   │   └── init.js              ← Database initialization
│   │   ├── routes/
│   │   │   ├── positions.js         ← GET/POST/PUT positions (FIXED v4.3.3!)
│   │   │   ├── bridges.js
│   │   │   ├── snapshots.js
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── calculator.js        ← Core calculation logic
│   │   │   ├── parser.js            ← XLSX parsing
│   │   │   └── exporter.js
│   │   ├── utils/
│   │   │   └── logger.js
│   │   └── app.js
│   ├── package.json
│   └── .nvmrc                        ← Node.js 18.20.4
│
├── frontend/                         ← React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── PartHeader.tsx        ← 🪨 Beton input (with logging)
│   │   │   ├── PositionsTable.tsx    ← 📊 Table sync logic
│   │   │   ├── PositionRow.tsx       ← 🔒 Locked beton row + min=0
│   │   │   ├── KPIPanel.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── usePositions.ts       ← 🔄 Mutation with logging
│   │   │   ├── useBridges.ts
│   │   │   └── ...
│   │   ├── context/
│   │   │   └── AppContext.tsx
│   │   ├── services/
│   │   │   └── api.ts                ← Axios wrapper
│   │   ├── styles/
│   │   │   └── global.css
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── shared/                           ← Shared types & formulas
│   ├── src/
│   │   ├── types.ts                  ← Position, HeaderKPI interfaces
│   │   ├── formulas.ts               ← calculatePositionFields(), calculateKPI()
│   │   └── constants.ts
│   └── package.json
│
├── render.yaml                       ← Legacy deployment config (не используется)
├── CLAUDE.MD                         ← 📄 AI Context Document (this file)
├── DEVELOPMENT_PLAN.md               ← 🚀 Strategic Development Plan (NEW!)
├── claude.md                         ← Session logs
├── README.md
└── .gitignore
```

---

## 🎯 ГЛАВНАЯ ИДЕЯ

### Проблема
В текущих сметах мосты имеют разные единицы измерения:
- Бетон → м³
- Опалубка → м²
- Арматура → кг
- Прочие работы → ks, t, м...

**Невозможно сравнить** стоимость разных типов работ!

### Решение
✅ **Универсальная метрика: `unit_cost_on_m3` (CZK/м³ бетона)**

Все затраты конвертируются в стоимость на 1 м³ бетона элемента:
- Бетон (43.8 м³) → 729 CZK/м³
- Опалубка (63.6 м²) → 1079 CZK/м³ (стоимость опалубки, разнесённая на объём бетона)
- Арматура (2100 кг) → 456 CZK/м³ (стоимость арматуры, разнесённая на объём бетона)

**Итого:** Можно честно сравнивать разные типы работ!

---

## 📐 КРИТИЧЕСКИЕ ФОРМУЛЫ

### 1. Определение объёма бетона элемента

```javascript
FOR subtype = "beton":
  concrete_m3 = qty  // qty уже в м³

FOR other subtypes (bednění, výztuž, jiné):
  concrete_m3 = qty_beton_of_same_part
  // Берём объём бетона из строки subtype="beton" той же part_name

  ⚠️ ЕСЛИ НЕ НАЙДЕНО → RFI + возможность ручного ввода
```

### 2. ⭐ ГЛАВНАЯ ФОРМУЛА: Приведение к м³

```javascript
unit_cost_on_m3 = cost_czk / concrete_m3

// Это ключевая метрика!
// Она показывает, сколько стоит данная работа в пересчёте на 1 м³ бетона элемента
```

### 3. KROS-округление (вверх, шагом 50 CZK)

```javascript
kros_unit_czk = Math.ceil(unit_cost_on_m3 / 50) * 50

// Примеры:
// 729.45 → 750
// 1079.12 → 1100
// 800.00 → 800
```

### 4. ⭐ НОВОЕ: Расчёт длительности

```javascript
// Взвешенные средние (по объёму бетона):
avg_crew_size = Σ(crew_size × concrete_m3) / Σ(concrete_m3)
avg_wage_czk_ph = Σ(wage_czk_ph × concrete_m3) / Σ(concrete_m3)
avg_shift_hours = Σ(shift_hours × concrete_m3) / Σ(concrete_m3)

// Месяцы:
estimated_months = sum_kros_total_czk /
                   (avg_crew_size × avg_wage_czk_ph × avg_shift_hours × days_per_month)

// Недели:
estimated_weeks = estimated_months × days_per_month / 7

// days_per_month = 30 (непрерывная работа) или 22 (рабочие дни)
```

### 5. Проектные KPI

```javascript
sum_concrete_m3 = Σ(concrete_m3 для subtype="beton")
sum_kros_total_czk = Σ(kros_total_czk для всех позиций)

project_unit_cost_czk_per_m3 = sum_kros_total_czk / sum_concrete_m3
project_unit_cost_czk_per_t = project_unit_cost_czk_per_m3 / 2.4  // ρ=2.4 t/m³
```

---

## 🗂️ СТРУКТУРА ДАННЫХ

### Position (Позиция)

```typescript
{
  // Входные данные (ОРАНЖЕВЫЕ поля — редактируемые):
  bridge_id: string          // SO201, SO202...
  part_name: string          // ZÁKLADY, ŘÍMSY, OPĚRY...
  item_name: string          // Название элемента (v4.3: заполняется из PartHeader)
  subtype: Subtype          // beton | bednění | výztuž | ...
  unit: string              // M3, m2, kg, ks...
  qty: number               // ⭐ v4.3: Количество (ТОЛЬКО для beton редактируется в PartHeader, для остальных — из других источников)
  qty_m3_helper?: number    // Справочно (для анализа скорости)

  crew_size: number         // Людей в бригаде (default: 4)
  wage_czk_ph: number       // CZK/час (default: 398)
  shift_hours: number       // Часов/день (default: 10)
  days: number              // Дней выполнения (default: 0)

  // Расчётные поля (СЕРЫЕ — readonly):
  labor_hours: number       // = crew_size × shift_hours × days
  cost_czk: number          // = labor_hours × wage_czk_ph
  unit_cost_native: number  // = cost_czk / qty (справочно)

  concrete_m3: number       // ⚠️ КЛЮЧЕВОЕ: объём бетона элемента
  unit_cost_on_m3: number   // ⭐ ГЛАВНАЯ МЕТРИКА: CZK/м³ бетона

  // KROS (ЗЕЛЁНЫЕ ячейки):
  kros_unit_czk: number     // Округлённая единичная цена
  kros_total_czk: number    // Полная стоимость

  // RFI:
  has_rfi?: boolean
  rfi_message?: string
}
```

### HeaderKPI (Шапка)

```typescript
{
  // Входные (ручной ввод):
  span_length_m?: number
  deck_width_m?: number
  pd_weeks?: number
  days_per_month_mode: 30 | 22  // Переключатель!

  // Расчётные суммы:
  sum_concrete_m3: number
  sum_kros_total_czk: number

  // Единичные цены:
  project_unit_cost_czk_per_m3: number
  project_unit_cost_czk_per_t: number

  // ⭐ Длительность:
  estimated_months: number
  estimated_weeks: number

  // Взвешенные средние:
  avg_crew_size: number
  avg_wage_czk_ph: number
  avg_shift_hours: number
  days_per_month: number

  // Константы:
  rho_t_per_m3: number  // = 2.4
}
```

---

## 🔄 ПОТОК ДАННЫХ БЕТОНА (v4.3.2 - Правильная архитектура)

### Архитектура (v4.3.2 - FINAL CORRECT DESIGN)

**ПРАВИЛЬНЫЙ ПОТОК (v4.3.2):**
```
PartHeader (рядом с названием):
  - Название "Název části": "ZÁKLADY ZE ŽELEZOBETONU..." 📝
  - Objem betonu: [INPUT 255] m³ ← 🟠 ГЛАВНОЕ ПОЛЕ! EDITABLE!
         ↓ автоматически синхронизируется ↓
Таблица позиций РАЗВЕРНУТА:
         ↓
Строка 'beton' (представляет работу по БЕТОНИРОВАНИЮ):
  - Podtyp: "beton" (тип работы - бетонирование)
  - MJ: M3
  - Množství: 255 (из PartHeader) ← синхронизировано!
  - LIDI: 4 (люди на работе)
  - KČ/HOD: 398 (зарплата в час)
  - HOD/DEN: 10 (часов в день)
  - DEN: ? (дни вычисляются!)
         ↓
Формула вычисляет:
  concrete_m3 = position.qty = 255  ← Основание расчетов!
         ↓
Остальные строки (bednění=опалубка, výztuž=арматура):
  - concrete_m3 = findConcreteVolumeForPart() = 255
  - Используют ТОЖЕ объем бетона!
         ↓
✅ Все расчёты: unit_cost_on_m3 = cost_czk / 255!
```

### Компоненты и функции (v4.3.2 FINAL)

#### PartHeader.tsx (НАЗВАНИЕ + ОБЪЕМ БЕТОНА)
```typescript
// ПРАВИЛЬНО: два input поля
interface Props {
  itemName?: string;
  betonQuantity: number;  // ← Объем бетона!
  onItemNameUpdate: (itemName: string) => void;
  onBetonQuantityUpdate: (quantity: number) => void;  // ← Синхро!
  isLocked: boolean;
}

export default function PartHeader({
  itemName,
  betonQuantity,
  onItemNameUpdate,
  onBetonQuantityUpdate,
  isLocked
}: Props) {
  return (
    <div className="part-header-container">
      {/* Input 1: Название */}
      <input
        type="text"
        value={itemName}
        onBlur={handleNameBlur}
        disabled={isLocked}
        placeholder="ZÁKLADY ZE ŽELEZOBETONU DO C30/37"
      />

      {/* Input 2: Объем бетона - ГЛАВНОЕ ПОЛЕ! */}
      <div className="concrete-params">
        <label>Objem betonu celkem:</label>
        <input
          type="number"
          className="concrete-input"  // 🟠 Оранжевое!
          value={editedBeton}
          onChange={handleBetonChange}
          onBlur={handleBetonBlur}  // ← Отправляет обновление!
          disabled={isLocked}
          step="0.01"
          min="0"
          placeholder="255"
        />
        <span>m³</span>
      </div>
    </div>
  );
}
```

#### PositionRow.tsx (BETON - EDITABLE!)
```typescript
// ПРАВИЛЬНО: beton НЕ заблокирован, редактируется свободно
<td className="cell-input">
  <input
    type="number"
    step="0.01"
    className="input-cell"  // 🟠 Оранжевый input!
    value={getValue('qty')}
    onChange={(e) => handleFieldChange('qty', parseFloat(e.target.value) || 0)}
    onBlur={handleBlur}
    disabled={isLocked}  // ← ТОЛЬКО если snapshot locked!
    title={
      position.subtype === 'beton'
        ? 'Objem betonu v m³ (синхронизовано с PartHeader выше)'
        : 'Množství v měrných jednotkách'
    }
  />
</td>
```

#### PositionsTable.tsx (СИНХРОНИЗАЦИЯ)
```typescript
// ПРАВИЛЬНО: handleBetonQuantityUpdate() синхронизирует PartHeader → Table
const handleBetonQuantityUpdate = (partName: string, newQuantity: number) => {
  // Находим beton position в части
  const betonPosition = positions.find(
    p => p.part_name === partName && p.subtype === 'beton'
  );

  // Обновляем его qty
  updatePositions([{
    ...betonPosition,
    qty: newQuantity  // ← Это значение используется везде!
  }]);
};

// PartHeader передает:
<PartHeader
  betonQuantity={betonQty}  // ← читает текущее значение
  onBetonQuantityUpdate={(qty) => handleBetonQuantityUpdate(partName, qty)}  // ← отправляет
  ...
/>
```

### Как работает ДВУСТОРОННЯЯ синхронизация

**Сценарий 1: Пользователь меняет в PartHeader**
```
PartHeader [255] → onBetonQuantityUpdate() → PositionsTable
  ↓
updatePositions({beton, qty: 255}) → backend
  ↓
React Query обновляет positions
  ↓
PartHeader перерисовывается: betonQuantity = 255 ✓
Table строка beton перерисовывается: qty = 255 ✓
```

**Сценарий 2: Пользователь меняет в таблице (beton row)**
```
PositionRow [255] → handleFieldChange() → updatePositions()
  ↓
backend обновляет
  ↓
React Query обновляет positions
  ↓
PartHeader перерисовывается: betonQuantity = 255 (вычисляется!) ✓
```

**Ключевой момент:** betonQuantity в PartHeader вычисляется КАЖДЫЙ РАЗ:
```typescript
betonQuantity={partPositions
  .filter(p => p.subtype === 'beton')
  .reduce((sum, p) => sum + (p.qty || 0), 0)}
```

Это значит изменение в ЛЮБОМ месте будет видно везде! ✅

### Примеры использования (v4.3.1)

#### Сценарий 1: Пользователь вводит объём бетона
```
1. Открывает часть конструкции: "ZÁKLADY"
2. Видит PartHeader с полем "Název části: [ZÁKLADY ZE ŽELEZOBETONU...]"
3. Раскрывает таблицу позиций (click на стрелку ▼)
4. Находит строку с "beton" (первая строка)
5. В колонке "Množství" видит оранжевый INPUT
6. ✍️ Вводит: 43.8 (м³)
7. Нажимает Tab или кликает вне поля (onBlur)
8. handleBlur() → updatePositions([{id: ..., qty: 43.8}]) → backend
9. Backend пересчитывает:
   - concrete_m3 = 43.8 (для beton position)
   - unit_cost_on_m3 = cost_czk / 43.8 ✓ (для всех subtypes части)
10. React Query инвалидирует кэш
11. Таблица ре-рендерится:
    - Строка 'beton': qty = 43.8 (оранжевый, редактируемый) ✍️
    - Строка 'bednění': concrete_m3 = 43.8 (вычислено автоматически!)
    - Строка 'výztuž': concrete_m3 = 43.8 (вычислено автоматически!)
    - KPI: sum_concrete_m3 = 43.8 обновляется
    - Все Kč/m³ пересчитаны! ✅
```

#### Сценарий 2: Excel импорт (готово!)
```
Excel содержит: "ČÁST KONSTRUKCE" | "SUBTYPE" | "QTY" | "MJ"
Пример:          "ZÁKLADY"        | "beton"   | 43.8  | m3
           ↓
Parser читает и создаёт positions
           ↓
Frontend отображает таблицу
           ↓
Пользователь видит готовые данные
Если нужно изменить: кликает на оранжевый input в beton строке
           ↓
Всё остальное вычисляется автоматически! ✅
```

### CSS стили (v4.3)

```css
/* Редактируемое поле бетона в PartHeader */
.concrete-input {
  background: var(--input-bg);      /* 🟠 #FFA726 оранжевый */
  border: 2px solid #FF9800;        /* Оранжевый бордер */
  padding: 6px 8px;
  width: 100px;                     /* Компактный размер */
  text-align: right;                /* Выравнивание чисел */
  font-family: monospace;           /* Моно-шрифт для чисел */
}

/* Read-only поле в таблице для beton */
.input-cell.readonly-style input {
  background: var(--bg-tertiary);   /* 🔒 #E8E8E8 серый */
  border-color: var(--border-light);
  color: var(--text-secondary);
  cursor: not-allowed;              /* Запретный курсор */
}
```

---

## 🎨 ДИЗАЙН (ВАЖНО!)

### Цветовая схема

```css
/* Бетонная основа */
--light-concrete: #F5F5F5    /* Фон страницы */
--medium-concrete: #E8E8E8   /* Карточки, секции */
--divider-border: #D0D0D0    /* Линии */

/* Акценты */
--primary-action: #1E5A96    /* Синий (кнопки, заголовки) */
--secondary: #F39C12          /* Оранжевый (предупреждения) */
--success: #27AE60            /* Зелёный (KROS) */
--error: #E74C3C              /* Красный (RFI) */

/* ⭐ INPUT CELLS — АПЕЛЬСИНОВЫЕ! */
--input-bg: #FFA726           /* Фон редактируемых полей */
--input-border: #FF9800       /* Бордер */
--input-focus: #FF7043        /* Фокус (2px ring) */

/* Таблица */
--computed-cells: #F0F0F0     /* Серые readonly */
--kros-success-bg: #F0FFF4    /* Зелёный фон KROS */
--rfi-warning: #FEE8E8        /* Красный фон RFI */
```

### Правила UI

1. **Все input-поля (редактируемые):**
   - Фон `#FFA726` (апельсиновый)
   - Бордер `#FF9800`
   - При фокусе: ring `#FF7043` (2px)

2. **Readonly поля (расчётные):**
   - Фон `#F0F0F0` (светло-серый)
   - Шрифт bold, tabular-nums
   - Курсор: default

3. **KROS-ячейки:**
   - Фон `#F0FFF4` (светло-зелёный)
   - Текст `#27AE60` (зелёный)
   - Font-weight: 600

4. **RFI-строки:**
   - Фон всей строки: `#FEE8E8`
   - Badge: красный с белым текстом

---

## 🏛️ АРХИТЕКТУРА

### Монорепозиторий

```
monolit-planner/
├── backend/          ← Node.js + Express + SQLite
├── frontend/         ← React + TypeScript + Vite
├── shared/           ← Общие типы и формулы
├── render.yaml       ← Legacy конфиг (не используется)
├── DEPLOY.md         ← Инструкции
├── CLAUDE.MD         ← ⭐ ЭТОТ ФАЙЛ (для AI)
└── README.md         ← Пользовательская документация
```

### Backend Stack

- **Node.js 18+** + Express.js
- **SQLite** (better-sqlite3) — встроенная БД
- **XLSX** (xlsx) — парсинг Excel
- **Multer** — загрузка файлов
- **API:** REST (JSON)

**Важные сервисы:**
- `calculator.js` — использует формулы из shared
- `parser.js` — парсит XLSX, определяет bridge_id
- `exporter.js` — генерирует XLSX/CSV для KROS4

### Frontend Stack

- **React 18** + TypeScript 5
- **Vite 5** — сборщик
- **TanStack React Query** — кэширование API
- **Axios** — HTTP-клиент
- **Context API** — глобальное состояние

**Компоненты:**
- `Header` — выбор моста, импорт, экспорт, переключатель дней
- `Sidebar` — список мостов, фильтры
- `KPIPanel` — метрики (месяцы, недели, CZK/м³...)
- `PositionsTable` — таблица с группировкой по part_name
- `PositionRow` — редактируемая строка (апельсиновые inputs!)

### Shared Package

**Цель:** Одна версия формул для фронта и бэка

```typescript
// types.ts — все интерфейсы
// formulas.ts — все расчёты (calculatePositionFields, calculateHeaderKPI...)
// constants.ts — дефолты, цвета, feature flags
```

---

## 🔄 WORKFLOW ПОЛЬЗОВАТЕЛЯ

1. **Открыть приложение** → показывается пустое состояние
2. **Нажать "Upload XLSX"** → выбрать файл с мостами
3. **Backend парсит XLSX:**
   - Определяет bridge_id (из колонки "Poř. číslo" или аналога)
   - Предлагает мэппинг колонок
   - Применяет мэппинг → нормализованные позиции
4. **Выбрать мост** из списка в Sidebar
5. **Backend рассчитывает всё:**
   - Определяет concrete_m3 для каждой позиции
   - Вычисляет unit_cost_on_m3 (⭐ главная метрика)
   - Округляет KROS
   - Вычисляет месяцы/недели
6. **Frontend отображает:**
   - KPI-панель с метриками
   - Таблицу позиций (группировка по part_name)
   - Апельсиновые input-ячейки
   - Серые readonly-ячейки
7. **Пользователь редактирует** (qty, crew_size, days...) → автосохранение
8. **Переключает режим дней** (30 ↔ 22) → пересчёт месяцев/недель
9. **Экспорт XLSX/CSV** → готово для KROS4

---

## ⚠️ КРИТИЧЕСКИЕ ПРАВИЛА

### 1. Zero Regression
- **НЕ переименовывать** исходные колонки XLSX
- Только **мэппинг через UI**

### 2. RFI-система (Request For Information)
- Подсвечивает пропущенные данные
- **НЕ блокирует** расчёты (расчёты выполняются с 0 или null)
- Пользователь может вручную ввести недостающие значения

**Примеры RFI:**
- ❌ "Не найдена строка beton для части 'ŘÍMSY'"
- ⚠️ "Пусто: den (koef 1). Расчёт выполнен (cost_czk=0)"
- ℹ️ "Не распознан Poř. číslo — подтвердите мэппинг"

### 3. Формулы прозрачны
- Каждое расчётное поле → tooltip с формулой
- Пример: при наведении на `kros_unit_czk` показывается:
  ```
  = ceil(unit_cost_on_m3 / 50) × 50
  = ceil(729.45 / 50) × 50
  = ceil(14.589) × 50
  = 15 × 50
  = 750 CZK
  ```

### 4. Переключатель дней/месяца
- **30 дней/месяц** — непрерывная стройка (7 дней в неделю)
- **22 дня/месяц** — рабочие дни (5 дней в неделю + праздники)
- Сохраняется в `project_config.days_per_month_mode`
- При переключении → пересчёт месяцев/недель для всех мостов

---

## DEPLOYMENT (Google Cloud Run)

### Production URLs:
- **Frontend:** https://monolit-planner-frontend.vercel.app (Vercel)
- **Backend:** https://monolit-planner-api-3uxelthc4q-ey.a.run.app (Cloud Run, europe-west3)
- **Database:** Cloud SQL PostgreSQL 15 (instance: `stavagent-db`, db: `monolit_planner`)

### CI/CD: Cloud Build

Push to `main` → Cloud Build trigger → Docker build → Cloud Run deploy

```bash
# Manual deploy
gcloud builds submit --config=cloudbuild-monolit.yaml --region=europe-west3

# Check status
gcloud run services describe monolit-planner-api --region europe-west3
```

**Trigger config:** `triggers/monolit.yaml` (watches `Monolit-Planner/**`)

### Environment Variables (Cloud Run + Secret Manager)

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=<from Secret Manager: MONOLIT_DATABASE_URL>
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app
VITE_API_URL=https://monolit-planner-api-3uxelthc4q-ey.a.run.app
```

### Legacy: render.yaml

`render.yaml` в корне Monolit-Planner — **устаревший файл** (Render больше не используется).
Production deploy через Cloud Build (`cloudbuild-monolit.yaml`).

### Автоматическая сборка shared пакета

**ensure-shared-build.js** (в backend/scripts и frontend/scripts):

Автоматически:
- Проверяет наличие TypeScript в shared/
- Устанавливает зависимости, если нужно
- Собирает shared пакет, если dist/ отсутствует
- Пропускает сборку, если dist/ уже существует

---

## 📝 FEATURE FLAGS

Все в `shared/src/constants.ts`:

```typescript
FEATURE_FLAGS = {
  FF_AI_DAYS_SUGGEST: false,    // AI-подсказки для дней
  FF_PUMP_MODULE: false,         // Модуль бетононасоса
  FF_ADVANCED_METRICS: false,    // Анализ скорости
  FF_DARK_MODE: false,           // Тёмная тема
  FF_SPEED_ANALYSIS: false       // Скорость м²/день
}
```

**Как включить:**
```http
POST /api/config
{
  "feature_flags": {
    "FF_DARK_MODE": true
  }
}
```

---

## 🎯 ROADMAP (Будущее)

- [ ] AI-подсказки для дней (ML-модель)
- [ ] Калькулятор бетононасоса
- [ ] Анализ скорости (м²/день по элементам)
- [ ] Multilang (EN, DE)
- [ ] PDF-отчёты
- [ ] Интеграция с бухгалтерией
- [ ] Мобильное приложение (React Native)

---

## 📌 ИНСТРУКЦИИ ДЛЯ AI

### Когда начинаешь работу:

1. **ВСЕГДА читай CLAUDE.MD** перед выполнением задач
2. Проверь актуальность формул в `shared/src/formulas.ts`
3. Убедись, что дизайн соответствует цветовой палитре

### При добавлении функций:

1. **Обнови CLAUDE.MD** с новой функциональностью
2. Добавь формулы в раздел "КРИТИЧЕСКИЕ ФОРМУЛЫ"
3. Обнови ROADMAP
4. Добавь feature flag, если нужно

### При изменении формул:

1. **⚠️ КРИТИЧНО:** Обнови `shared/src/formulas.ts`
2. Обнови `backend/src/services/calculator.js` (использует shared)
3. Обнови CLAUDE.MD с новой формулой
4. Добавь комментарии в код с примерами

### При изменении дизайна:

1. Обнови `frontend/src/styles/global.css`
2. Проверь соответствие цветам в CLAUDE.MD
3. Обнови CSS-переменные, если нужно

### При добавлении API endpoints:

1. Добавь в `backend/src/routes/`
2. Обнови документацию в README.md
3. Добавь в API-клиент `frontend/src/services/api.ts`
4. Обнови типы в `shared/src/types.ts`, если нужно

---

## 🔍 DEBUGGING CHECKLIST

### Если расчёты неверные:

1. Проверь `concrete_m3` — правильно ли определён?
2. Проверь `unit_cost_on_m3` — используется ли concrete_m3 правильного элемента?
3. Проверь KROS-округление — `Math.ceil`, не `Math.round`!
4. Проверь weighted averages — взвешены ли по concrete_m3?

### Если UI не обновляется:

1. Проверь React Query cache
2. Проверь Context API — обновляется ли состояние?
3. Проверь `usePositions` hook — вызывается ли invalidation?

### Если импорт XLSX не работает:

1. Проверь парсер — находит ли bridge_id?
2. Проверь мэппинг — правильные ли колонки?
3. Проверь нормализацию — все ли поля заполнены?

---

## 📊 SUCCESS CRITERIA

Проект готов, когда:

- ✅ Все подтипы приведены к CZK/м³ бетона
- ✅ KROS-округление работает (вверх, шаг 50)
- ✅ Месяцы и недели рассчитываются корректно
- ✅ Переключатель 30/22 дня работает
- ✅ Апельсиновые input-поля визуально отличимы
- ✅ RFI-система подсвечивает пропуски (но не блокирует)
- ✅ Экспорт XLSX/CSV готов к KROS4
- ✅ Деплой на Cloud Run через Cloud Build работает
- ✅ Frontend и Backend работают раздельно

---

## 🛠️ УСТАНОВКА И НАСТРОЙКА

### Требования системы

- **Node.js**: 18.20.4 (зафиксировано в `.nvmrc`)
  - ⚠️ **КРИТИЧНО**: better-sqlite3 требует именно Node 18.x
  - ❌ Node.js 25.x НЕ РАБОТАЕТ (ошибки компиляции C++)
  - Установка: `nvm install 18.20.4 && nvm use 18.20.4`

- **npm**: версия 9+
- **Git**: для клонирования и работы с репозиторием

### Локальная установка

#### 1. Клонирование репозитория
```bash
git clone https://github.com/alpro1000/Monolit-Planner.git
cd Monolit-Planner
```

#### 2. Установка зависимостей shared пакета
```bash
cd shared
npm install
npm run build
cd ..
```

#### 3. Установка backend
```bash
cd backend
npm install
```

**Environment переменные (backend/.env):**
```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=*
DATABASE_URL=./data/monolit.db
```

#### 4. Установка frontend
```bash
cd frontend
npm install
```

**Environment переменные (frontend/.env.local):**
```env
VITE_API_URL=http://localhost:3001
```

#### 5. Запуск в режиме разработки

**Backend:**
```bash
cd backend
npm run dev
# Или для production: npm start
```

**Frontend (в новом терминале):**
```bash
cd frontend
npm run dev
# Откроется на http://localhost:5173
```

**Обе команды одновременно (корневой каталог):**
```bash
# Требует установленного concurrently (опционально)
npm install -g concurrently
concurrently "cd backend && npm run dev" "cd frontend && npm run dev"
```

### Структура базы данных

База данных инициализируется автоматически при первом запуске backend:
```bash
cd backend
npm run dev
# Создаёт ./data/monolit.db с таблицами:
# - bridges
# - positions
# - snapshots
# - project_config
# - rfi_messages
```

### Сборка для production

```bash
# Shared пакет
cd shared && npm run build && cd ..

# Frontend
cd frontend && npm run build
# Результат: frontend/dist/

# Backend
cd backend && npm start
# Запускает express сервер на порту 3001
```

### Развёртывание (Google Cloud Run)

Используется **Cloud Build** (`cloudbuild-monolit.yaml`):

1. Push код на GitHub (branch `main`)
2. Cloud Build trigger автоматически запускает сборку
3. Docker image → Artifact Registry → Cloud Run deploy

URLs:
- Backend: `https://monolit-planner-api-1086027517695.europe-west3.run.app`
- Frontend: `https://monolit-planner-frontend.vercel.app`
- Trigger: `gcloud builds triggers import --source=triggers/monolit.yaml --region=europe-west3`

---


## 📚 SESSION HISTORY

Detailed session notes (v4.3.3 through v4.13.0+) have been archived:

→ **[docs/SESSIONS_ARCHIVE.md](./docs/SESSIONS_ARCHIVE.md)** (2000+ lines)

Contains:
- Bug fix logs and solutions
- Version-by-version changes (v4.3.3 → v4.13.0)
- PostgreSQL migration notes
- Table alignment fixes
- Excel parser improvements
- Production deployment fixes
- Session 22.03.2026: Portal Auth + SaaS Admin + Element Planner UX + Mobile (16 commits)

---

## 🔧 СЕССИЯ 22.03.2026 (2) — PERI Formwork Integration + Security Fix

**Branch:** `claude/auth-saas-planner-features-jIqEd`
**Коммиты:** 4

### Что сделано

#### 1. PERI pricing из оффера DO-25-0056409 (`1d54378`)
- Создан `B3_current_prices/formwork_systems_peri.json` — 17 вариантов (DOMINO 8, TRIO 4, VARIO 5)
- Средневзвешенные цены: DOMINO 658, TRIO 736, VARIO 807 CZK/m²/мес
- Обновлён `B4_production_benchmarks/bedneni.json` — нормы монтажа/демонтажа
- Обновлён `formwork-systems.ts` — цены TRIO 480→736, DOMINO 420→658, новый VARIO 807

#### 2. 8 новых систем PERI + PDF парсер (`c6f5de2`)
- Добавлены: DUO, QUATTRO, MULTIFLEX, RUNDFLEX, SRS, VARIOKIT, CB 240
- Каталог: 16→25 систем (DOKA, PERI, ULMA, NOE, Místní)
- `element-classifier.ts` — обновлены рекомендации для всех типов элементов
- Создан `data/peri-pdfs/parse_peri_pdfs.py` — скрипт извлечения данных из PDF проспектов PERI

#### 3. Коррекция SRS + верифицированные спеки + security fix (`633c495`)
- SRS: исправлен с "šplhací" на "kruhové sloupové bednění" (Ø 25-70cm)
- Добавлены верифицированные технические характеристики (kg/m², kN/m²) ко всем системам PERI
- QUATTRO высоты → [2.50, 2.75, 3.50, 4.50]
- RUNDFLEX высоты → [0.60, 1.20, 1.80, 2.40, 3.00, 3.60]
- **Security fix (CWE-208):** `serviceAuth.js` — заменён кастомный `timingSafeEqual` на `crypto.timingSafeEqual`

#### 4. Service Auth + CLAUDE.MD refactor (`6105240`)
- `serviceAuth.js` — middleware для аутентификации kiosk↔portal (X-Service-Key)
- `rateLimiter.js` — обновлён, health checks исключены
- `CLAUDE.MD` — рефакторинг 2900→935 строк, сессии вынесены в `docs/SESSIONS_ARCHIVE.md`
- Merge conflict с main — решён

### Тесты
- **336/336 pass** (shared tests)

---

## 🔧 СЕССИЯ 25.03.2026 — Resource Optimization + Mobile Fix + Cross-service cleanup

**Branch:** `claude/document-session-fixes-Yq83C`
**Коммиты:** 5

### Что сделано

#### 1. 8 cross-service cleanups (`d8e07bf`)
- Убран `onrender.com` из CORS regex (concrete-agent/main.py)
- Обновлены fallback модели: gemini-1.5-* → gemini-2.5-flash/pro (passport_enricher, gemini_client)
- Исправлено: gpt-5-mini → gpt-4o-mini (URS llmConfig.js + .env.example, 9 мест)
- Удалены Render-комментарии из portal .env.example
- Централизованы хардкод-URL в rozpocet-registry → `src/utils/config.ts` (7 файлов)
- `resolveOrgId()` вынесен из connections.js в shared middleware orgRole.js
- CLAUDE.md обновлён: registry = "browser + Vercel serverless backend", 11 групп

#### 2. Planner: Resource Optimization engine — always-on (`f263984`, `2edb8c9`)
- Новый опциональный вход `deadline_days` (дедлайн инвестора, пrac. дни)
- **Grid search после каждого расчёта:** перебор комбинаций (до 4 бригад, 6 сад)
- Фильтрация: только варианты быстрее текущего, сортировка по стоимости
- Вывод: `cheapest_faster`, `fastest`, `best_for_deadline` (если дедлайн задан)
- UI: карточка "Optimalizace zdrojů" с таблицей вариантов + summary line
- При превышении дедлайна: красный баннер + рекомендация "Pro splnění termínu"
- Если нельзя ускорить: "aktuální nastavení je optimální"
- XLSX экспорт обновлён
- Типы: `DeadlineCheckResult`, `DeadlineOptimizationVariant`
- **Файлы:** `planner-orchestrator.ts`, `PlannerPage.tsx`, `exportPlanXLSX.ts`

#### 3. Build fix: exportPlanXLSX type error (`8ab5e01`)
- Локальный интерфейс `PlannerOutput` в `exportPlanXLSX.ts` не импортирует из shared
- Добавлен `deadline_check` с полными типами

#### 4. Mobile scroll fix (`07e3827`)
- **Причина:** каскад `height: 100vh; overflow: hidden` на трёх уровнях (#root, .main-layout, planner containers)
- **Исправление:**
  - `#root`: `height: 100vh` → `min-height: 100vh`, убран `overflow: hidden`
  - `.main-layout`: `overflow: hidden` только на desktop (≥769px media query)
  - `.r0-planner-sidebar/.r0-planner-main`: `overflow-y: visible` на мобильном
- Результат: sidebar и results прокручиваются на мобильном, desktop layout не затронут
- **Файлы:** `global.css`, `components.css`, `r0.css`

### Тесты
- **336/336 pass** (shared tests)

### Задание на следующую сессию
1. **PDF парсинг:** скачать PDF из GCS `stavagent-cenik-norms` → `data/peri-pdfs/`, запустить `parse_peri_pdfs.py`
2. **Обогащение данных:** дополнить `formwork-systems.ts` данными из PDF (вес панелей, давление бетона, точные размеры)
3. **Мердж PR** в main (конфликт решён, security fix применён)
4. **Sprint 2:** Service Connections API endpoints + frontend UI + MASTER_ENCRYPTION_KEY
5. **Position write-back:** синхронизация Monolit+Registry→Portal
