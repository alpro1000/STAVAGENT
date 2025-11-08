# 🏗️ CLAUDE.MD — AI Context Document

**ВАЖНО: Этот файл — источник истины для AI-ассистента. Всегда обращайся к нему перед выполнением задач!**

---

## 📌 О ПРОЕКТЕ

**Название:** Monolit Planner
**Цель:** Веб-приложение для расчёта и планирования бетонных конструкций мостов в Чехии

**Заказчик:** Строительная компания (Чехия)
**Ключевое требование:** Привести ВСЕ затраты к единой метрике **CZK/м³ бетона** (даже если исходная ЕИ — м², кг, ks)

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

## 🔄 ПОТОК ДАННЫХ БЕТОНА (v4.3 - Centralize Concrete Volume)

### Архитектура (БЫЛО vs СТАЛО)

**БЫЛО (v4.2 и раньше):**
```
Пользователь вводит в таблице:
  - Строка 'beton', колонка "MNOŽSTVÍ" = qty = 43.8
         ↓
PartHeader вычисляет (readonly):
  - Сумма всех beton qty = "Množství betonu celkem: 43.8"
         ↓
Другие строки (bednění, výztuž):
  - concrete_m3 = findConcreteVolumeForPart() = 43.8

ПРОБЛЕМЫ: Путаница где вводить, два места для информации о бетоне
```

**СТАЛО (v4.3):**
```
PartHeader (единственная точка ввода):
  - Редактируемое поле: "Množství betonu celkem: [INPUT 43.8]" 🟠
         ↓
handleBetonQuantityUpdate() → updatePositions()
         ↓
Строка 'beton' в таблице:
  - qty = 43.8 (READONLY, серое, синхронизированное) 🔒
         ↓
Остальные строки (bednění, výztuž):
  - concrete_m3 = 43.8 (автоматически из beton)
         ↓
Все расчёты используют одно значение!
```

### Компоненты и функции (v4.3)

#### PartHeader.tsx
```typescript
// НОВОЕ: два колбэка вместо одного
interface Props {
  betonQuantity: number;
  onItemNameUpdate: (itemName: string) => void;        // ← NEW
  onBetonQuantityUpdate: (quantity: number) => void;   // ← NEW
}

// Пользователь редактирует поле
<input
  type="number"
  className="concrete-input"  // 🟠 Оранжевое, редактируемое
  value={editedBeton}
  onBlur={handleBetonBlur}    // Отправляет обновление
/>
```

#### PositionsTable.tsx
```typescript
// НОВОЕ: синхронизация бетона
handleBetonQuantityUpdate = (partName: string, newQuantity: number) => {
  // 1. Находим все строки этой части с subtype='beton'
  const betonPositions = positions.filter(
    p => p.part_name === partName && p.subtype === 'beton'
  );

  // 2. Обновляем их qty на новое значение
  const updates = betonPositions.map(pos => ({
    ...pos,
    qty: newQuantity  // ← Единственное место, где меняется qty!
  }));

  // 3. Отправляем на backend через React Query
  updatePositions(updates);
};
```

#### PositionRow.tsx
```typescript
// НОВОЕ: read-only для beton
<input
  type="number"
  disabled={isLocked || position.subtype === 'beton'}  // ← Блокировано!
  className="readonly-style"                             // 🔒 Серое
  title="Objem betonu - upravte v záhlaví výše"        // Подсказка
/>
```

### Примеры использования

#### Сценарий 1: Пользователь вводит объём бетона
```
1. Открывает часть конструкции: "ZÁKLADY"
2. Видит PartHeader с полем "Množství betonu celkem: [0.00]"
3. Вводит: 43.8
4. Нажимает Tab или кликает вне поля (onBlur)
5. handleBetonBlur() → onBetonQuantityUpdate(43.8) → handleBetonQuantityUpdate()
6. updatePositions([{id: ..., qty: 43.8}]) → backend
7. Backend пересчитывает: concrete_m3 = 43.8, unit_cost_on_m3 = ... (для всей части)
8. React Query инвалидирует кэш
9. usePositions() перезагружает данные
10. Таблица ре-рендерится:
    - Строка 'beton': qty = 43.8 (серый, readonly)
    - Строка 'bednění': concrete_m3 = 43.8 (вычислено)
    - KPI: sum_concrete_m3 обновляется
```

#### Сценарий 2: Excel импорт (будущее)
```
Excel содержит: "ČÁST KONSTRUKCE" + "OBJEM BETONU"
           ↓
Parser читает и создаёт positions
           ↓
PartHeader загружается с бетоном из Excel
           ↓
Всё остальное синхронизируется автоматически!
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
├── render.yaml       ← Конфиг деплоя
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

## 🚀 DEPLOYMENT (Render)

### Использовать Blueprint! (render.yaml)

**НЕ создавай вручную "New Web Service"!**

### Правильный процесс:

1. **Push код на GitHub** ✅ (уже сделано)

2. **В Render Dashboard:**
   - Нажать **"New" → "Blueprint"**
   - Выбрать репозиторий `alpro1000/Monolit-Planner`
   - Render автоматически найдёт `render.yaml`
   - Нажать **"Create New Resources"**

3. **Render создаст 2 сервиса:**
   - `monolit-planner-api` (backend)
   - `monolit-planner-frontend` (frontend)

4. **После успешного деплоя backend:**
   - Backend получит URL типа: `https://monolit-planner-api.onrender.com`
   - ⚠️ **ВАЖНО**: Нужно вручную настроить frontend!

5. **Настройка frontend (ОБЯЗАТЕЛЬНО!):**
   - Открой Render Dashboard → `monolit-planner-frontend` → Environment
   - Добавь переменную `VITE_API_URL` = `https://monolit-planner-api.onrender.com`
   - Нажми **"Save Changes"** → frontend пересобрётся автоматически

6. **(Опционально) Ограничить CORS:**
   - После деплоя frontend получит URL типа: `https://monolit-planner-frontend.onrender.com`
   - Открой backend Environment
   - Измени `CORS_ORIGIN` с `*` на URL frontend'а для безопасности

7. **URLs:**
   - Frontend: `https://monolit-planner-frontend.onrender.com`
   - Backend: `https://monolit-planner-api.onrender.com`

### ⚠️ НЕ делай:
- ❌ New Web Service вручную (сложно настроить связи)
- ❌ Редактировать build commands вручную (всё в render.yaml)

### ✅ Делай:
- ✅ Используй Blueprint (render.yaml)
- ✅ Auto-deploy: push в main → автодеплой

### 📝 Правильный синтаксис render.yaml:

**Backend (Web Service):**
```yaml
- type: web
  name: monolit-planner-api
  env: node
  plan: free
  buildCommand: ...
  startCommand: ...
```

**Frontend (Static Site):**
```yaml
- type: web              # ⚠️ НЕ "static"!
  name: monolit-planner-frontend
  env: static            # Это указывает на static site
  buildCommand: ...
  staticPublishPath: frontend/dist
```

⚠️ **ВАЖНО:**
- Render Blueprint НЕ поддерживает `type: static`
- Используй `type: web` + `env: static` для static sites
- НЕ добавляй `region` — не поддерживается free tier
- **Node.js версия ОБЯЗАТЕЛЬНА**: better-sqlite3 требует Node 18.x
  - ✅ Добавлен .nvmrc → 18.20.4
  - ✅ Добавлен NODE_VERSION в render.yaml
  - ❌ Node 25.x НЕ РАБОТАЕТ (ошибки компиляции C++)

### 🔍 Почему CORS_ORIGIN="*" и VITE_API_URL=sync:false - НЕ костыли?

**Проблема fromService (circular dependency):**

При первом деплое через Blueprint с fromService возникает deadlock:
```yaml
# ❌ НЕПРАВИЛЬНО - создаёт deadlock:
backend:
  envVars:
    - key: CORS_ORIGIN
      fromService:
        name: frontend  # Backend ждёт URL frontend

frontend:
  envVars:
    - key: VITE_API_URL
      fromService:
        name: backend   # Frontend ждёт URL backend
```

**Результат:** Backend ждёт frontend → Frontend ждёт backend → **Бесконечный цикл!**

**✅ ПРАВИЛЬНОЕ решение:**

1. **CORS_ORIGIN = "\*"**:
   - Стандартная практика для development
   - Позволяет запросы от любого origin при первом деплое
   - После деплоя frontend можно ограничить на конкретный домен
   - В production: установи `CORS_ORIGIN=https://monolit-planner-frontend.onrender.com`

2. **VITE_API_URL = sync:false**:
   - Говорит Render НЕ ждать значение от другого сервиса
   - Устанавливается вручную в Dashboard после деплоя backend
   - Стандартный паттерн для статических сайтов с отдельным API

**Альтернативы и почему они хуже:**

- ❌ **Использовать один сервис**: теряем масштабируемость и разделение ответственности
- ❌ **Reverse proxy на frontend**: усложняет архитектуру, нужен nginx/express
- ❌ **Относительные URL (/api)**: не работает для статических сайтов на отдельных доменах

**Итог:** Это НЕ костыли, а правильная архитектура для микросервисов!

### 🤖 Автоматическая сборка shared пакета

**ensure-shared-build.js** (в backend/scripts и frontend/scripts):

Автоматически:
- Проверяет наличие TypeScript в shared/
- Устанавливает зависимости, если нужно
- Собирает shared пакет, если dist/ отсутствует
- Пропускает сборку, если dist/ уже существует

**Преимущества:**
- Не нужно явно собирать shared в render.yaml buildCommand
- prestart/prebuild хуки делают всё автоматически
- Ускоряет локальную разработку (только первая сборка)

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
- ✅ Деплой на Render через Blueprint работает
- ✅ Frontend и Backend работают раздельно

---

## 🔐 ВЕРСИОНИРОВАНИЕ

**Текущая версия:** v4.3 (2025-11-08)

**История изменений:**

- **v4.3** (2025-11-08) - Centralize Concrete Volume Input:
  - 🎯 **Single point of entry for concrete volume**: moved from table (beton row) to PartHeader
  - ✨ **PartHeader now has editable concrete volume field** "Množství betonu celkem:"
  - 🔄 **Synchronization logic**: updatePositions() syncs PartHeader value to beton row qty
  - 🔒 **Beton row qty is read-only in table**: shows as gray/disabled field
  - 📝 **Helpful tooltip for users**: "Editujte v záhlaví výše" (Edit in header above)
  - 🎨 **New CSS styles**: `.readonly-style` for disabled inputs, `.concrete-input` for PartHeader
  - ✅ **Architecture ready for Excel import**: one concrete field = one Excel column = auto-sync
  - 📊 **Data flow simplified**: PartHeader (input) → Table (readonly) → Calculations
  - **Files changed**: PartHeader.tsx, PositionsTable.tsx, PositionRow.tsx, components.css

- **v4.2.1** (2025-11-08) - Fix Critical Hangs on Bridge Creation:
  - 🐛 **Fixed infinite refetch loop in useBridges hook**: setState removed from queryFn
  - 🐛 **Fixed race condition in usePositions hook**: setState moved outside queryFn
  - ✅ **Fixed colSpan mismatch**: dynamic colSpan based on isLocked state (16 or 17)
  - ✅ **Improved template position insertion**: transaction wrapper + unique ID generation
  - ✅ **Better error handling in bridge creation**: try-catch in handleCreateSuccess
  - **Root cause**: setState inside React Query queryFn with refetchOnMount creates update loop
  - **Solution**: setState AFTER query completes, not inside queryFn
  - **Impact**: Bridge creation no longer hangs, positions load immediately

- **v4.2** (2025-11-08) - Hierarchical Table Structure:
  - 🏗️ **Fixed critical "Název položky" duplication** in table headers
  - ✨ **Created PartHeader component**: item name displayed once per construction part
  - 🗑️ **Removed "Název položky" column** from main table (17 → 16 columns)
  - 📊 **Clean hierarchical structure**: Header → Concrete Params → Table (subtypes)
  - 🎯 **Improved UX**: cleaner, less cluttered table layout
  - ✅ **Fully documented** with visual diagrams in CLAUDE.MD

- **v4.1** (2025-11-07) - KPI Optimization & Template Update:
  - 🎨 **Optimized KPI Panel layout** (4 columns × 2 rows instead of dynamic grid)
  - 🗑️ **Removed Kč/t (ρ=2.4) metric** as per detailed audit requirements
  - 📏 **Reduced KPI card sizes**: padding 12px → 8px 10px, fonts: label 11px → 10px, value 18px → 16px
  - 🔢 **Fixed z-index hierarchy**: KPI panel (z-index: 100), table headers (z-index: 90, top: 140px)
  - ✨ **Updated bridge templates**: from 15 → 24 positions (11 construction parts from detailed spec)
  - 🏗️ **New templates**: ŘÍMSY (B37), PŘECHODOVÉ DESKY, MOSTNÍ NOSNÉ KONSTRUKCE, SCHODIŠŤ, PODKLADNÍ VRSTVY, PATKY
  - 📋 **KPI Layout**: Row 1 (Celková cena, Kč/m³, Měsíce, Týdny), Row 2 (Averages: lidi, Kč/hod, hod/den, Režim práce)
  - 🎯 **Fixed sticky behavior**: KPI stays on top, table headers scroll under KPI

- **v4.0** (2025-11-07) - Comprehensive UI/UX Audit Implementation:
  - ✅ **Czech translation complete**: CreateBridgeForm translated from Russian to Czech
  - 🎨 **True concrete colors**: #F5F5F5 (primary bg), #E8E8E8 (cards/modals), #D0D0D0 (borders)
  - 📝 **Added "Název položky" column**: first editable column with min-width: 250px, orange background
  - ✨ **Pre-filled template positions**: 15 positions with ZÁKLADY, ŘÍMSY, MOSTNÍ OPĚRY, PILÍŘE, KŘÍDLA, MOSTOVKA, VÝZTUŽ
  - 📌 **Sticky header**: table and KPI card always visible while scrolling
  - 🟠 **Orange inputs (#FFA726)** for all editable fields maintained
  - 🌀 **Concrete gradient**: linear-gradient(170deg, #F5F5F5 80%, #E8E8E8 100%)
  - 🔒 **Database migration**: added item_name column to positions table
  - 📊 **Table always visible**: removed "Žádné pozice" blocking state from previous sessions

- **1.0.5** (2025-11-07):
  - ✨ Добавлены ensure-shared-build.js скрипты (решение от Codex)
  - ✅ Автоматическая сборка shared пакета через prestart/prebuild хуки
  - ✅ Упрощены buildCommand в render.yaml (npm install → автоматика)
  - ✅ Автоопределение: собирает только если dist/ отсутствует
  - ⚠️ ВАЖНО: CORS_ORIGIN="*" и VITE_API_URL=sync:false - НЕ костыли!
  - 📝 Это правильное решение для избежания fromService deadlock при первом деплое

- **1.0.4** (2025-11-07):
  - 🔧 Исправлена циклическая зависимость в render.yaml
  - ✅ Убрана fromService зависимость между backend ↔ frontend
  - ✅ CORS_ORIGIN временно = "*" (после деплоя можно ограничить)
  - ✅ VITE_API_URL = sync:false (устанавливается вручную после деплоя backend)
  - ✅ Исправлена последовательность buildCommand: shared build ПЕРВЫМ
  - ⚠️ КРИТИЧНО: fromService создаёт deadlock при первом деплое!
  - 📝 После деплоя: установить VITE_API_URL в Render dashboard вручную

- **1.0.3** (2025-11-07):
  - 🔧 Исправлена ESM конфигурация shared пакета
  - ✅ Добавлено "type": "module" в shared/package.json
  - ✅ TypeScript компиляция: CommonJS → ES2020
  - ✅ Добавлены .js расширения в импорты (требование ESM)
  - ✅ Исправлены TypeScript ошибки во frontend (unused imports, type assertions)
  - ⚠️ ВАЖНО: shared пакет ДОЛЖЕН собираться перед backend/frontend

- **1.0.2** (2025-11-07):
  - 🔧 Исправлена версия Node.js для better-sqlite3
  - ✅ Добавлен .nvmrc → Node.js 18.20.4 (зафиксировано)
  - ✅ Обновлен engines в backend/package.json → Node 18.x only
  - ✅ Добавлен NODE_VERSION=18.20.4 в render.yaml
  - ⚠️ КРИТИЧНО: better-sqlite3 НЕ работает на Node.js 25.x!

- **1.0.1** (2025-11-07):
  - 🔧 Исправлен render.yaml для Blueprint deployment
  - ✅ Frontend: используется `type: web` с `env: static` (правильный синтаксис)
  - ✅ Удалён параметр 'region' (не поддерживается free tier)
  - ⚠️ ВАЖНО: Render Blueprint требует `type: web` + `env: static`, НЕ `type: static`!

- **1.0.0** (2025-11-07):
  - ✅ Полная реализация core-функциональности
  - ✅ Универсальная метрика CZK/м³
  - ✅ KROS-округление
  - ✅ Расчёт месяцев/недель ⭐ NEW
  - ✅ Переключатель 30/22 дня ⭐ NEW
  - ✅ Апельсиновые input-поля
  - ✅ Деплой на Render
  - ✅ CLAUDE.MD создан

---

## 📞 КОНТАКТЫ

- **Repository:** https://github.com/alpro1000/Monolit-Planner
- **Issues:** https://github.com/alpro1000/Monolit-Planner/issues
- **Branch:** `claude/monolit-planner-core-011CUtRicaEySo6zsaBmswVi`

---

**🏗️ Made for bridge builders in Czech Republic**

**⚡ ВАЖНО: При любых изменениях проекта — ОБНОВЛЯЙ ЭТОТ ФАЙЛ!**
