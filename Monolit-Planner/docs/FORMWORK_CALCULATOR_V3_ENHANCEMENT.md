# Formwork Calculator v3 - Enhancement Plan

## 📋 Цель

Добавить возможность ручного ввода количества людей и часов смены в калькулятор бедения v3, с режимом "Авто расчет" и сохранением результатов на каждой позиции.

---

## 🎯 Требования

### 1. Ручной ввод людей и часов
- Пользователь может вручную указать количество людей (crew_size)
- Пользователь может вручную указать часы смены (shift_hours)
- Эти значения используются для расчёта вместо предустановленных

### 2. Режим "Авто расчет"
- Toggle: "Авто расчет" (ON/OFF)
- **Когда ON:** блокировать ручной ввод, использовать только предустановки из Q4
- **Когда OFF:** разрешить ручной ввод crew_size и shift_hours

### 3. Сохранение результата
- Результат авто расчета сохраняется на каждой позиции в FormworkCalculatorModal
- При повторном открытии калькулятора - показывать сохранённые значения

---

## 🔍 Анализ текущей логики

### Текущая структура Q4

```typescript
const Q4_OPTIONS: { value: Crew; label: string; hint: string }[] = [
  { value: '2_bez_jeravu', label: '2 lidé bez jeřábu', hint: 'Ruční, 8h směna' },
  { value: '3_bez_jeravu', label: '3 lidé bez jeřábu', hint: 'Střední tempo, 8h' },
  { value: '4_bez_jeravu', label: '4 lidé bez jeřábu', hint: 'Standard, 10h směna' },
  { value: '4_s_jeravem',  label: '4 lidé + jeřáb',   hint: '+20 % rychlost, 10h' },
  { value: '6_s_jeravem',  label: '6 lidí + jeřáb',   hint: 'Nejvyšší tempo, 10h' },
];
```

**Маппинг crew → (crew_size, shift_hours, crane):**
```typescript
'2_bez_jeravu' → (2, 8, false)
'3_bez_jeravu' → (3, 8, false)
'4_bez_jeravu' → (4, 10, false)
'4_s_jeravem'  → (4, 10, true)
'6_s_jeravem'  → (6, 10, true)
```

---

## 📊 Проверка логики: Модель графа с ограниченными ресурсами

### Теория: Resource-Constrained Project Scheduling (RCPS)

**Модель:**
- **Узлы (Activities):** Montáž (A), Armování (R), Betonáž (B), Zrání (C), Demontáž (D)
- **Рёбра (Dependencies):** A → R → B → C → D (последовательные зависимости)
- **Ресурсы:** Люди (crew), Часы (shift), Jeřáb (crane), Комплекты бедения (sets)

**Ограничения:**
1. **Precedence constraints:** R не может начаться до завершения A
2. **Resource constraints:** Ограниченное количество людей и комплектов
3. **Time constraints:** Минимальное время зрания (curing_days)

### Текущая реализация в коде

#### 1. Расчёт времени монтажа (Assembly)

```typescript
// FormworkAIModal.tsx → backend /api/formwork-assistant
assembly_days = (set_area_m2 × assembly_norm_h_m2) / (crew_size × shift_hours)
```

**Формула корректна:** ✅
- Площадь × норма = общие человеко-часы
- Делим на (люди × часы/день) = дни

**Пример:**
```
set_area_m2 = 50 m²
assembly_norm_h_m2 = 0.72 h/m² (из системы бедения)
crew_size = 4 человека
shift_hours = 10 часов

assembly_hours = 50 × 0.72 = 36 h
daily_capacity = 4 × 10 = 40 h/день
assembly_days = 36 / 40 = 0.9 дня → округляем до 1 дня ✅
```

#### 2. Расчёт времени демонтажа (Disassembly)

```typescript
disassembly_days = assembly_days × disassembly_ratio
// disassembly_ratio = 0.35 (35% от монтажа)
```

**Формула корректна:** ✅
- Демонтаж обычно быстрее монтажа (меньше точности)
- Коэффициент 0.35 соответствует практике

#### 3. Расчёт времени армирования (Rebar)

```typescript
rebar_hours = rebar_mass_kg × norm_h_per_t / 1000
rebar_days = rebar_hours / (crew_size_rebar × shift_hours)
```

**Формула корректна:** ✅
- Масса × норма (22 h/t) = общие часы
- Делим на (люди × часы) = дни

#### 4. Расчёт цикла (Cycle)

```typescript
cycle_days = assembly_days + rebar_days + concrete_days + curing_days + disassembly_days
```

**Проблема:** ❌ **Не учитывает параллельность!**

**Правильная модель:**
```
Цикл = max(assembly_days, rebar_days) + concrete_days + curing_days + disassembly_days
```

**Почему:**
- Армирование может идти **параллельно** с монтажом (если разные бригады)
- Узкое место (bottleneck) = max(assembly, rebar)

**Текущий код учитывает это:**
```typescript
// В FormworkAIModal.tsx есть bottleneck detection:
bottleneck: string;           // 'assembly' | 'rebar' | 'curing'
bottleneck_days: number;      // max(assembly, rebar, curing)
```

**Вывод:** Логика **частично корректна**, но в cycle_days суммируются все фазы. Нужно использовать bottleneck_days.

#### 5. Расчёт стратегий (Strategies)

```typescript
// Стратегия A: Последовательно (1 комплект)
total_days_A = num_tacts × cycle_days

// Стратегия B: С перекрытием (2 комплекта)
total_days_B = (num_tacts / 2) × cycle_days + overlap_adjustment

// Стратегия C: Параллельно (num_tacts комплектов)
total_days_C = cycle_days
```

**Проблема:** ❌ **Формула для стратегии B неточная!**

**Правильная модель (Resource-Constrained Scheduling):**

```
Стратегия A (1 комплект):
  total_days = num_tacts × cycle_days

Стратегия B (2 комплекта):
  effective_tacts = ceil(num_tacts / 2)
  total_days = effective_tacts × cycle_days
  
  Пример: 6 тактов, 2 комплекта
  - Комплект 1: такт 1, 3, 5 (3 цикла)
  - Комплект 2: такт 2, 4, 6 (3 цикла)
  - Параллельно → total = 3 × cycle_days ✅

Стратегия C (6 комплектов):
  total_days = cycle_days (все такты параллельно)
```

**Текущий код:**
```typescript
// В backend /api/formwork-assistant
strategies = [
  { id: 'A', sets: 1, total_days: num_tacts × cycle_days },
  { id: 'B', sets: 2, total_days: ??? },  // Нужно проверить
  { id: 'C', sets: num_tacts, total_days: cycle_days }
]
```

---

## 🔧 План изменений

### Изменение 1: Добавить ручной ввод в Q4

**Файл:** `FormworkAIModal.tsx`

**Текущий код:**
```typescript
interface Answers {
  crew: Crew;  // '2_bez_jeravu' | '3_bez_jeravu' | ...
}
```

**Новый код:**
```typescript
interface Answers {
  crew: Crew;
  // Новые поля:
  manual_mode: boolean;        // true = ручной ввод, false = предустановки
  manual_crew_size?: number;   // Ручное количество людей
  manual_shift_hours?: number; // Ручные часы смены
  manual_crane?: boolean;      // Ручной выбор jeřáb
}
```

**UI изменения:**
```typescript
<QuestionSection label="Q4 — Pracovní síla (bednění)">
  {/* Toggle: Авто расчет */}
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
    <input 
      type="checkbox" 
      checked={!answers.manual_mode} 
      onChange={e => set('manual_mode', !e.target.checked)}
    />
    <span style={{ fontSize: '12px', fontWeight: 600 }}>
      Авто расчет (предустановки)
    </span>
  </label>

  {/* Если авто расчет - показать радио кнопки */}
  {!answers.manual_mode && (
    <RadioGroup
      options={Q4_OPTIONS.map(o => ({ value: o.value, label: o.label, sublabel: o.hint }))}
      value={answers.crew}
      onChange={v => set('crew', v as Crew)}
    />
  )}

  {/* Если ручной режим - показать инпуты */}
  {answers.manual_mode && (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
      <NumberInput 
        label="Počet lidí" 
        value={answers.manual_crew_size || 4} 
        onChange={v => set('manual_crew_size', v)}
        min={1}
        max={20}
      />
      <NumberInput 
        label="Směna (h)" 
        value={answers.manual_shift_hours || 10} 
        onChange={v => set('manual_shift_hours', v)}
        min={1}
        max={16}
        step={0.5}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
        <input 
          type="checkbox" 
          checked={answers.manual_crane || false}
          onChange={e => set('manual_crane', e.target.checked)}
        />
        Jeřáb
      </label>
    </div>
  )}
</QuestionSection>
```

### Изменение 2: Обновить backend API

**Файл:** `backend/src/routes/formwork-assistant.js` (или аналогичный)

**Текущий запрос:**
```typescript
POST /api/formwork-assistant
{
  crew: '4_bez_jeravu',
  // ...
}
```

**Новый запрос:**
```typescript
POST /api/formwork-assistant
{
  crew: '4_bez_jeravu',
  manual_mode: false,
  manual_crew_size?: 5,
  manual_shift_hours?: 12,
  manual_crane?: true,
  // ...
}
```

**Backend логика:**
```typescript
// Определить crew_size, shift_hours, crane
let crew_size, shift_hours, crane;

if (manual_mode) {
  // Ручной режим
  crew_size = manual_crew_size || 4;
  shift_hours = manual_shift_hours || 10;
  crane = manual_crane || false;
} else {
  // Авто расчет из предустановок
  const crewMap = {
    '2_bez_jeravu': { crew: 2, shift: 8, crane: false },
    '3_bez_jeravu': { crew: 3, shift: 8, crane: false },
    '4_bez_jeravu': { crew: 4, shift: 10, crane: false },
    '4_s_jeravem':  { crew: 4, shift: 10, crane: true },
    '6_s_jeravem':  { crew: 6, shift: 10, crane: true },
  };
  const config = crewMap[crew];
  crew_size = config.crew;
  shift_hours = config.shift;
  crane = config.crane;
}

// Использовать crew_size, shift_hours для расчётов
```

### Изменение 3: Сохранение результата на позиции

**Файл:** `FormworkCalculatorModal.tsx`

**Текущая структура:**
```typescript
interface FormworkCalculatorRow {
  id: string;
  construction_name: string;
  total_area_m2: number;
  set_area_m2: number;
  num_tacts: number;
  num_sets: number;
  assembly_days_per_tact: number;
  disassembly_days_per_tact: number;
  days_per_tact: number;
  formwork_term_days: number;
  // ...
}
```

**Новая структура:**
```typescript
interface FormworkCalculatorRow {
  // ... существующие поля ...
  
  // Новые поля для AI результата:
  ai_calculated?: boolean;           // true = результат из AI
  ai_crew_size?: number;             // Использованные люди
  ai_shift_hours?: number;           // Использованные часы
  ai_crane?: boolean;                // Использован jeřáb
  ai_cycle_days?: number;            // Цикл из AI
  ai_strategies?: Strategy[];        // Стратегии из AI
  ai_rebar_days?: number;            // Дни армирования
  ai_curing_days?: number;           // Дни зрания
  ai_bottleneck?: string;            // Узкое место
}
```

**Логика применения AI результата:**
```typescript
function handleAIApply(rowId: string, aiResult: AssistantResult) {
  setRows(prev => prev.map(r => {
    if (r.id !== rowId) return r;
    
    const det = aiResult.deterministic;
    
    return {
      ...r,
      // Применить основные результаты
      days_per_tact: det.days_per_tact,
      formwork_term_days: det.formwork_term_days,
      
      // Сохранить AI метаданные
      ai_calculated: true,
      ai_crew_size: det.crew_size,
      ai_shift_hours: det.shift_hours,
      ai_crane: det.crane,
      ai_cycle_days: det.cycle_days,
      ai_strategies: det.strategies,
      ai_rebar_days: det.rebar_days,
      ai_curing_days: det.curing_days,
      ai_bottleneck: det.bottleneck,
    };
  }));
}
```

**UI индикатор:**
```typescript
{row.ai_calculated && (
  <span style={{ 
    fontSize: '10px', 
    color: '#16a34a', 
    marginLeft: '6px' 
  }}>
    ✨ AI ({row.ai_crew_size}L × {row.ai_shift_hours}h)
  </span>
)}
```

### Изменение 4: Исправить формулу стратегии B

**Файл:** `backend/src/services/formwork-calculator.js` (или аналогичный)

**Текущий код (предположительно):**
```typescript
const strategy_B_days = (num_tacts / 2) * cycle_days + some_overlap;
```

**Правильный код:**
```typescript
const strategy_B_days = Math.ceil(num_tacts / 2) * cycle_days;
```

**Обоснование:**
- 2 комплекта работают параллельно
- Эффективное количество циклов = ceil(num_tacts / 2)
- Каждый цикл = cycle_days

**Пример:**
```
num_tacts = 6, cycle_days = 11
strategy_B_days = ceil(6/2) × 11 = 3 × 11 = 33 дня ✅
```

---

## 🧪 Тестирование

### Тест 1: Ручной ввод

**Шаги:**
1. Открыть FormworkAIModal
2. Выключить "Авто расчет"
3. Ввести: 5 людей, 12 часов, jeřáб ON
4. Нажать "Vypočítat"

**Ожидаемый результат:**
- Расчёт использует crew_size=5, shift_hours=12, crane=true
- assembly_days = (50 × 0.72) / (5 × 12) = 36 / 60 = 0.6 → 1 день

### Тест 2: Авто расчет

**Шаги:**
1. Включить "Авто расчет"
2. Выбрать "4 lidé + jeřáb"
3. Нажать "Vypočítat"

**Ожидаемый результат:**
- Расчёт использует crew_size=4, shift_hours=10, crane=true
- assembly_days = (50 × 0.72) / (4 × 10) = 36 / 40 = 0.9 → 1 день

### Тест 3: Сохранение результата

**Шаги:**
1. Применить AI результат к строке
2. Закрыть калькулятор
3. Открыть снова

**Ожидаемый результат:**
- Строка показывает ✨ AI (4L × 10h)
- Значения days_per_tact и formwork_term_days сохранены

### Тест 4: Стратегия B

**Входные данные:**
- num_tacts = 6
- cycle_days = 11

**Ожидаемый результат:**
- Стратегия A: 6 × 11 = 66 дней
- Стратегия B: ceil(6/2) × 11 = 33 дня ✅
- Стратегия C: 11 дней

---

## 📊 Проверка модели графа

### Корректность текущей модели

**✅ Правильно:**
1. Расчёт assembly_days через (площадь × норма) / (люди × часы)
2. Расчёт disassembly_days через коэффициент 0.35
3. Расчёт rebar_days через (масса × норма) / (люди × часы)
4. Определение bottleneck = max(assembly, rebar, curing)

**❌ Требует исправления:**
1. **strategy_B_days:** Должен быть ceil(num_tacts / 2) × cycle_days

### ⚠️ ВАЖНО: Два калькулятора в одном!

**Калькулятор бедения считает ДВА разных результата:**

#### 1. Стоимость работ опалубщиков (ЧИСТАЯ)
```typescript
// Только монтаж + демонтаж (БЕЗ армирования)
formwork_labor_days = assembly_days + disassembly_days
formwork_labor_cost = formwork_labor_days × crew_size × hourly_rate
```
**Это идёт в позиции:** "Montáž bednění" + "Demontáž bednění"

#### 2. Срок аренды опалубки (С АРМИРОВАНИЕМ)
```typescript
// Полный цикл с учётом параллельности
const bottleneck_days = Math.max(assembly_days, rebar_days);
const rental_term_days = bottleneck_days + concrete_days + curing_days + disassembly_days;
```
**Это используется для:** 
- Расчёта стоимости аренды опалубки
- Передачи в Registry TOV (модуль материалов)

### Почему max(A, R)?

**Сценарий 1: Разные бригады (параллельная работа)**
```
День 1-2: Опалубщики монтируют (A=2d) | Армировщики вяжут арматуру (R=7d)
День 3-7: Опалубка готова, ждём      | Армировщики продолжают (R=7d)
День 8:   Бетонирование (B=1d)
День 9-15: Зрание (C=7d)
День 16:  Демонтаж (D=1d)

Итого: max(2, 7) + 1 + 7 + 1 = 16 дней ✅
```

**Сценарий 2: Одна бригада (последовательная работа)**
```
День 1-2: Монтаж (A=2d)
День 3-9: Армирование (R=7d)
День 10:  Бетонирование (B=1d)
День 11-17: Зрание (C=7d)
День 18:  Демонтаж (D=1d)

Итого: 2 + 7 + 1 + 7 + 1 = 18 дней
```

**Текущая реализация использует max(A, R)** → предполагает разные бригады (оптимистичный сценарий)

### Рекомендуемая формула цикла

```typescript
// Правильная формула с учётом параллельности
const bottleneck_days = Math.max(assembly_days, rebar_days);
const cycle_days = bottleneck_days + concrete_days + curing_days + disassembly_days;

// Для стоимости работ опалубщиков (БЕЗ армирования)
const formwork_labor_days = assembly_days + disassembly_days;

// Для стоимости аренды (С армированием)
const rental_term_days = cycle_days;
```

### Модель RCPS (Resource-Constrained Project Scheduling)

**Граф зависимостей с учётом RCPSP Unified v2.0:**
```
     ┌─────────┐
     │ Montáž  │ (A) - опалубщики
     │ (A days)│
     └────┬────┘
          │
     ┌────▼────┐
     │Armování │ (R) - армировщики (может идти параллельно с A)
     │ (R days)│     если разные бригады
     └────┬────┘
          │
     ┌────▼────┐
     │Betonáž  │ (B) - 1 день (non-preemptive если нет спар)
     │ (1 day) │
     └────┬────┘
          │
     ┌────▼────┐
     │ Zrání   │ (C) - зависит от температуры, цемента, конструкции
     │ (C days)│     (ČSN EN 13670)
     └────┬────┘
          │
     ┌────▼────┐
     │Demontáž │ (D) - опалубщики
     │ (D days)│
     └─────────┘
```

**Критический путь:**
```
CP = max(A, R) + B + C + D
```

**Два выхода калькулятора:**
```typescript
// 1. Стоимость работ опалубщиков (передаётся в PositionsTable)
formwork_labor_days = A + D  // БЕЗ армирования!
formwork_labor_cost = formwork_labor_days × crew × rate

// 2. Срок аренды опалубки (передаётся в Registry TOV)
rental_term_days = max(A, R) + B + C + D  // С армированием!
rental_cost = rental_term_days × rental_rate_per_day
```

**Связь с RCPSP Unified v2.0:**
- **has_dilatacni_spary = false** → монолитная заливка (non-preemptive)
- **has_dilatacni_spary = true** → секционная заливка (можно прерывать)
- **Калькулятор бедения** работает на уровне **одного такта** (одной секции)
- **Стратегии A/B/C** определяют порядок тактов (sequential / chess / parallel)

---

## 📝 Итоговый чеклист изменений

### Frontend (FormworkAIModal.tsx)
- [ ] Добавить поля в interface Answers: manual_mode, manual_crew_size, manual_shift_hours, manual_crane
- [ ] Добавить UI toggle "Авто расчет"
- [ ] Добавить UI инпуты для ручного ввода (когда manual_mode = true)
- [ ] Обновить handleCalculate() для отправки новых полей

### Frontend (FormworkCalculatorModal.tsx)
- [ ] Добавить поля в interface FormworkCalculatorRow: ai_calculated, ai_crew_size, ai_shift_hours, ai_crane, ai_cycle_days, ai_strategies, ai_rebar_days, ai_curing_days, ai_bottleneck
- [ ] Обновить handleAIApply() для сохранения AI метаданных
- [ ] Добавить UI индикатор ✨ AI (XL × Yh) в таблице

### Backend (/api/formwork-assistant)
- [ ] Добавить обработку manual_mode, manual_crew_size, manual_shift_hours, manual_crane
- [ ] ✅ Проверить формулу cycle_days: должна использовать max(A, R) (скорее всего уже правильно)
- [ ] Исправить формулу strategy_B_days: ceil(num_tacts / 2) × cycle_days
- [ ] Добавить в ответ: crew_size, shift_hours, crane (для сохранения в frontend)
- [ ] Добавить в ответ: formwork_labor_days (A + D) для стоимости работ опалубщиков
- [ ] Добавить в ответ: rental_term_days (max(A,R) + B + C + D) для аренды

### Тестирование
- [ ] Тест 1: Ручной ввод (5L × 12h)
- [ ] Тест 2: Авто расчет (4L × 10h)
- [ ] Тест 3: Сохранение результата
- [ ] Тест 4: Стратегия B (6 тактов → 33 дня)

---

## 🚀 Приоритет реализации

1. **High:** Исправить формулу cycle_days (критическая ошибка)
2. **High:** Исправить формулу strategy_B_days (критическая ошибка)
3. **Medium:** Добавить ручной ввод людей/часов
4. **Medium:** Добавить сохранение AI результата
5. **Low:** UI индикатор ✨ AI

---

**Готово к реализации!** 🎉
