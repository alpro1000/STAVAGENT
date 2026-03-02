# Formwork Calculator v3 - Final Architecture

## 🎯 Концепция: Один калькулятор, три выхода

**Калькулятор считает ПОЛНЫЙ цикл работ:**
- Монтаж опалубки (A)
- Армирование (R)
- Бетонирование (B)
- Созревание бетона (C)
- Демонтаж опалубки (D)

**Но выдаёт данные для ТРЁХ разных позиций сметы:**

### 1️⃣ Работы опалубщиков (чистые)
```
Montáž bednění:   A дней × crew × rate
Demontáž bednění: D дней × crew × rate
```
→ Записывается в смету как отдельная позиция

### 2️⃣ Работы арматурщиков (чистые)
```
Armování: R дней × rebar_crew × rate
```
→ Записывается в смету как отдельная позиция

### 3️⃣ Срок аренды опалубки (общий)
```
Nájem bednění: max(A, R) + B + C + D дней × rental_rate
```
→ Используется для:
- Расчёта стоимости аренды (в смете)
- Передачи в Registry TOV (модуль материалов)
- Контроля общих сроков (укладываемся ли в график инвестора)

---

## 📊 Архитектура данных

### Структура результата калькулятора

```typescript
interface FormworkCalculationResult {
  // ═══ ВХОДНЫЕ ДАННЫЕ ═══
  total_area_m2: number;
  set_area_m2: number;
  num_tacts: number;
  num_sets: number;
  
  // ═══ ПАРАМЕТРЫ РАБОТ ═══
  crew_size: number;              // Опалубщики
  shift_hours: number;
  crane: boolean;
  rebar_crew_size: number;        // Арматурщики (0 = нет армирования)
  
  // ═══ ФАЗЫ РАБОТ (дни) ═══
  assembly_days: number;          // A - монтаж
  rebar_days: number;             // R - армирование
  concrete_days: number;          // B - бетонирование (обычно 1)
  curing_days: number;            // C - созревание
  disassembly_days: number;       // D - демонтаж
  
  // ═══ КРИТИЧЕСКИЙ ПУТЬ ═══
  bottleneck: 'assembly' | 'rebar' | 'curing';
  bottleneck_days: number;        // max(A, R, C)
  cycle_days: number;             // max(A, R) + B + C + D
  
  // ═══ ВЫХОДЫ ДЛЯ СМЕТЫ ═══
  
  // 1. Работы опалубщиков (БЕЗ армирования, БЕЗ созревания)
  formwork_labor: {
    assembly_days: number;        // A
    disassembly_days: number;     // D
    total_days: number;           // A + D
    crew_size: number;
    total_hours: number;          // (A + D) × crew × shift
    cost_czk?: number;            // если есть ставка
  };
  
  // 2. Работы арматурщиков (отдельно)
  rebar_labor: {
    rebar_days: number;           // R
    crew_size: number;
    total_hours: number;          // R × crew × shift
    mass_kg: number;
    mass_t: number;
    norm_h_per_t: number;
    cost_czk?: number;
    spacer_pcs?: number;
    spacer_cost_czk?: number;
  } | null;
  
  // 3. Срок аренды опалубки (С армированием и созреванием)
  rental_term: {
    total_days: number;           // max(A, R) + B + C + D
    breakdown: string;            // "max(2,7) + 1 + 7 + 1 = 16 дней"
    includes_rebar: boolean;
    includes_curing: boolean;
    monthly_rate_per_m2?: number;
    total_cost_czk?: number;
  };
  
  // ═══ СТРАТЕГИИ (для нескольких тактов) ═══
  strategies: {
    id: 'A' | 'B' | 'C';
    label: string;
    sets: number;
    total_days: number;
    rental_cost_czk?: number;
    recommended_for: 'cost' | 'time' | 'balanced';
  }[];
  
  // ═══ ОПТИМИЗАЦИЯ ═══
  crew_optimization?: {
    label: string;
    crew: number;
    shift: number;
    assembly_days: number;
    rebar_days: number;
    cycle_days: number;
    is_current: boolean;
    is_efficient: boolean;
  }[];
  
  // ═══ ПРЕДУПРЕЖДЕНИЯ ═══
  warnings: string[];
  
  // ═══ AI МЕТАДАННЫЕ ═══
  ai_calculated: boolean;
  ai_model_used?: string;
  ai_explanation?: string;
}
```

---

## 🎨 UI/UX: Как показывать результаты

### В FormworkCalculatorModal (таблица)

**Колонки:**
```
| Konstrukce | Celkem | Sada | Taktů | Sad | Montáž | Armování | Demontáž | Zrání | Doba celkem | Systém | Akce |
```

**Новые колонки:**
- **Armování [dny]** - дни армирования (R)
- **Zrání [dny]** - дни созревания (C)
- **Doba celkem [dny]** - общий срок = max(A,R) + B + C + D

**Цветовая кодировка:**
- 🔵 Синие колонки: Montáž, Demontáž (работы опалубщиков)
- 🟡 Жёлтые колонки: Armování (работы арматурщиков)
- 🟢 Зелёные колонки: Zrání, Doba celkem (общий срок)

### При переносе в PositionsTable

**Кнопка "Přenést" создаёт ТРИ типа позиций:**

```typescript
// Вариант 1: Перенести ВСЁ (3 позиции)
[
  {
    work_type: 'Montáž bednění',
    days: formwork_labor.assembly_days,
    crew: formwork_labor.crew_size,
    note: '✨ AI калькулятор'
  },
  {
    work_type: 'Demontáž bednění',
    days: formwork_labor.disassembly_days,
    crew: formwork_labor.crew_size,
    note: '✨ AI калькулятор'
  },
  {
    work_type: 'Armování',
    days: rebar_labor.rebar_days,
    crew: rebar_labor.crew_size,
    note: `✨ AI: ${rebar_labor.mass_t} t, ${rebar_labor.norm_h_per_t} h/t`
  }
]

// Вариант 2: Перенести только опалубку (2 позиции)
// Вариант 3: Перенести только арматуру (1 позиция)
```

**UI для выбора:**
```tsx
<button onClick={() => setShowTransferOptions(!showTransferOptions)}>
  Přenést ▼
</button>

{showTransferOptions && (
  <div className="transfer-options">
    <button onClick={() => transferAll()}>
      ✅ Vše (Montáž + Armování + Demontáž) - 3 řádky
    </button>
    <button onClick={() => transferFormwork()}>
      🔵 Pouze bednění (Montáž + Demontáž) - 2 řádky
    </button>
    <button onClick={() => transferRebar()}>
      🟡 Pouze armování - 1 řádek
    </button>
  </div>
)}
```

---

## 💾 Сохранение полного расчёта

### Новая таблица в БД: `formwork_calculations`

```sql
CREATE TABLE formwork_calculations (
  id UUID PRIMARY KEY,
  bridge_id UUID REFERENCES bridges(id),
  part_name TEXT,
  
  -- Входные данные
  total_area_m2 NUMERIC,
  set_area_m2 NUMERIC,
  num_tacts INTEGER,
  num_sets INTEGER,
  
  -- Параметры
  crew_size INTEGER,
  shift_hours NUMERIC,
  crane BOOLEAN,
  rebar_crew_size INTEGER,
  
  -- Фазы (дни)
  assembly_days NUMERIC,
  rebar_days NUMERIC,
  concrete_days NUMERIC DEFAULT 1,
  curing_days NUMERIC,
  disassembly_days NUMERIC,
  
  -- Критический путь
  bottleneck TEXT,
  cycle_days NUMERIC,
  
  -- Выходы для сметы (JSON)
  formwork_labor JSONB,  -- {assembly_days, disassembly_days, total_days, crew_size, total_hours}
  rebar_labor JSONB,     -- {rebar_days, crew_size, mass_kg, norm_h_per_t, ...}
  rental_term JSONB,     -- {total_days, breakdown, includes_rebar, includes_curing}
  
  -- Стратегии
  strategies JSONB,
  
  -- AI метаданные
  ai_calculated BOOLEAN DEFAULT false,
  ai_model_used TEXT,
  ai_explanation TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API для сохранения/загрузки

```typescript
// Сохранить полный расчёт
POST /api/formwork-calculations
{
  bridge_id: "uuid",
  part_name: "Pilíř P1",
  ...result
}

// Загрузить расчёт для элемента
GET /api/formwork-calculations/:bridge_id/:part_name

// Получить все расчёты для проекта
GET /api/formwork-calculations/:bridge_id
```

---

## 🔄 Интеграция с Registry TOV

### Передача срока аренды

```typescript
// Когда пользователь добавляет материалы в Registry TOV
const rentalTerm = formworkCalculation.rental_term.total_days;

// Передаём в Registry TOV
POST /api/registry-tov/materials
{
  bridge_id: "uuid",
  part_name: "Pilíř P1",
  material_type: "formwork_rental",
  rental_days: rentalTerm,  // max(A,R) + B + C + D
  area_m2: total_area_m2,
  system_name: "Frami Xlife",
  // ... другие параметры
}
```

---

## 📋 План реализации (приоритеты)

### Фаза 1: Расширение данных (HIGH)
- [ ] Добавить колонки в FormworkCalculatorModal: Armování, Zrání, Doba celkem
- [ ] Обновить FormworkCalculatorRow interface
- [ ] Создать таблицу formwork_calculations в БД
- [ ] API для сохранения/загрузки расчётов

### Фаза 2: Ручной ввод людей/часов (HIGH)
- [ ] Добавить manual_mode в FormworkAIModal
- [ ] UI для ручного ввода crew_size, shift_hours, crane
- [ ] Backend обработка manual_mode

### Фаза 3: Три выхода для сметы (MEDIUM)
- [ ] Структура formwork_labor, rebar_labor, rental_term
- [ ] UI "Přenést" с выбором (Vše / Pouze bednění / Pouze armování)
- [ ] Создание 1-3 позиций в PositionsTable

### Фаза 4: Интеграция с Registry TOV (MEDIUM)
- [ ] Передача rental_term.total_days в Registry TOV
- [ ] UI индикатор "Срок аренды из калькулятора"

### Фаза 5: Контроль сроков (LOW)
- [ ] Сравнение с инвесторским графиком
- [ ] Предупреждения "Не укладываемся в срок"
- [ ] Рекомендации по оптимизации

---

## 🧪 Примеры использования

### Пример 1: Pilíř mostu (с армированием)

**Входные данные:**
- Площадь: 50 m²
- Система: Frami Xlife
- Опалубщики: 4 человека × 10h
- Арматурщики: 6 человек × 8h
- Арматура: 160 kg/m³ × 88.2 m³ = 14,112 kg

**Расчёт:**
```
A (Montáž):    2 дня
R (Armování):  7 дней  ← bottleneck!
B (Betonáž):   1 день
C (Zrání):     7 дней
D (Demontáž):  1 день

Цикл: max(2, 7) + 1 + 7 + 1 = 16 дней
```

**Выходы для сметы:**
```
1. Montáž bednění:   2 дня × 4L × 10h = 80 h
2. Demontáž bednění: 1 день × 4L × 10h = 40 h
3. Armování:         7 дней × 6L × 8h = 336 h
4. Nájem bednění:    16 дней × 50 m² × 45 Kč/m²/měsíc = 1,200 Kč
```

### Пример 2: Základy (без армирования)

**Входные данные:**
- Площадь: 30 m²
- Система: Doka Framax
- Опалубщики: 3 человека × 8h
- Арматурщики: 0 (нет армирования)

**Расчёт:**
```
A (Montáž):    3 дня
R (Armování):  0 дней
B (Betonáž):   1 день
C (Zrání):     2 дня
D (Demontáž):  1 день

Цикл: max(3, 0) + 1 + 2 + 1 = 7 дней
```

**Выходы для сметы:**
```
1. Montáž bednění:   3 дня × 3L × 8h = 72 h
2. Demontáž bednění: 1 день × 3L × 8h = 24 h
3. Nájem bednění:    7 дней × 30 m² × 40 Kč/m²/měsíc = 280 Kč
```

---

## ✅ Итоговый чеклист

### Данные
- [ ] Расширить FormworkCalculatorRow: +armování, +zrání, +doba_celkem
- [ ] Создать FormworkCalculationResult interface
- [ ] Создать таблицу formwork_calculations
- [ ] API: POST/GET /api/formwork-calculations

### UI
- [ ] Добавить колонки: Armování, Zrání, Doba celkem
- [ ] Цветовая кодировка колонок (синий/жёлтый/зелёный)
- [ ] Кнопка "Přenést" с выбором (Vše / Bednění / Armování)
- [ ] Индикатор ✨ AI с деталями

### Логика
- [ ] Формула cycle_days = max(A, R) + B + C + D
- [ ] Формула formwork_labor_days = A + D
- [ ] Формула rebar_labor_days = R
- [ ] Три выхода: formwork_labor, rebar_labor, rental_term

### Интеграция
- [ ] Передача rental_term в Registry TOV
- [ ] Сохранение полного расчёта в БД
- [ ] Загрузка расчёта при повторном открытии

---

**Готово к реализации!** 🚀

**Следующий шаг:** Начать с Фазы 1 (расширение данных)
