# Formwork Calculator Integration Plan

## Проблемы:

1. ❌ При нажатии "Kalkulátor Bednění" результат записывается как ОТДЕЛЬНАЯ часть конструкции, а не в ту же часть
2. ❌ Название "Kalkulátor opalubky (Bednění)" - слово "opalubky" русизм
3. ❌ Краткое название из калькулятора переносится БЕЗ префикса "Bednění +"
4. ❌ В Betonování нет созревания бетона
5. ❌ Наем опалубки записывается не туда и не учитывает общие дни

## Решение:

### 1. Интеграция калькулятора опалубки в PartHeader

**Файл:** `Monolit-Planner/frontend/src/components/PartHeader.tsx`

Добавить кнопку "🪵 Kalkulátor Bednění" рядом с OTSKP кодом.

При клике открывать модальное окно `FormworkCalculatorModal.tsx` с параметрами:
- `partName` - текущая часть конструкции
- `onSave` - callback для сохранения результата

### 2. Создать FormworkCalculatorModal.tsx

**Файл:** `Monolit-Planner/frontend/src/components/FormworkCalculatorModal.tsx`

Модальное окно с полями:
- Краткое название (например: "Pilíře 1-5")
- Площадь опалубки (m²)
- Норма монтажа (ч/м²) - default 0.8
- Норма демонтажа (ч/м²) - default 0.4
- Количество комплектов - default 2
- Дни созревания бетона - default 7

Кнопка "Uložit" → вызывает `onSave` с данными:
```typescript
{
  itemName: `Bednění + ${shortName}`, // Префикс!
  area_m2: number,
  assembly_norm: number,
  disassembly_norm: number,
  num_kits: number,
  curing_days: number
}
```

### 3. Обработка результата в PositionsTable

**Файл:** `Monolit-Planner/frontend/src/components/PositionsTable.tsx`

Добавить функцию `handleFormworkCalculatorSave`:

```typescript
const handleFormworkCalculatorSave = async (partName: string, data: FormworkData) => {
  // Создать 3 позиции в ТОЙ ЖЕ части конструкции:
  
  // 1. Монтаж опалубки
  const assemblyPosition = {
    part_name: partName, // ТА ЖЕ ЧАСТЬ!
    item_name: data.itemName, // "Bednění + Pilíře 1-5"
    subtype: 'bednění',
    unit: 'm2',
    qty: data.area_m2,
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: calculateDays(data.area_m2, data.assembly_norm, 4, 10)
  };
  
  // 2. Демонтаж опалубки
  const disassemblyPosition = {
    part_name: partName,
    item_name: `${data.itemName} - Demontáž`,
    subtype: 'bednění',
    unit: 'm2',
    qty: data.area_m2,
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: calculateDays(data.area_m2, data.disassembly_norm, 4, 10)
  };
  
  // 3. Наем опалубки (аренда комплектов)
  // ВАЖНО: Рассчитывается из ОБЩИХ дней всех работ в части
  const totalDays = calculateTotalDaysForPart(partName, data);
  const rentalPosition = {
    part_name: partName,
    item_name: `${data.itemName} - Pronájem`,
    subtype: 'jiné',
    unit: 'den',
    qty: totalDays,
    crew_size: 0, // Нет людей
    wage_czk_ph: data.rental_price_per_day || 500, // Цена аренды за день
    shift_hours: 1,
    days: 1
  };
  
  await positionsAPI.create(selectedBridge, [
    assemblyPosition,
    disassemblyPosition,
    rentalPosition
  ]);
};

function calculateTotalDaysForPart(partName: string, formworkData: FormworkData): number {
  const partPositions = positions.filter(p => p.part_name === partName);
  
  // Суммируем дни:
  // - Армирование (výztuž)
  // - Бетонирование (beton)
  // - Созревание бетона (из formworkData.curing_days)
  // - Монтаж опалубки (из formworkData)
  // - Демонтаж опалубки (из formworkData)
  
  const reinforcementDays = partPositions
    .filter(p => p.subtype === 'výztuž')
    .reduce((sum, p) => sum + (p.days || 0), 0);
    
  const concretingDays = partPositions
    .filter(p => p.subtype === 'beton')
    .reduce((sum, p) => sum + (p.days || 0), 0);
    
  const assemblyDays = calculateDays(
    formworkData.area_m2,
    formworkData.assembly_norm,
    4,
    10
  );
  
  const disassemblyDays = calculateDays(
    formworkData.area_m2,
    formworkData.disassembly_norm,
    4,
    10
  );
  
  return reinforcementDays + concretingDays + formworkData.curing_days + assemblyDays + disassemblyDays;
}
```

### 4. Добавить созревание бетона в Betonování

**Файл:** `Monolit-Planner/shared/src/calculators/concrete.ts`

Добавить параметр `curing_days` в расчет бетонирования:

```typescript
export interface ConcreteCalculatorParams {
  volume_m3: number;
  pump_capacity_m3_h: number;
  crew_size: number;
  shift_hours: number;
  curing_days?: number; // NEW! Default 7
}

export function calculateConcrete(params: ConcreteCalculatorParams): ConcreteCalculatorResult {
  // ... existing code ...
  
  const curingDays = params.curing_days || 7;
  const totalDays = pouringDays + curingDays;
  
  return {
    // ... existing fields ...
    curing_days: curingDays,
    total_days_with_curing: totalDays
  };
}
```

### 5. Исправить название калькулятора

**Файл:** `Monolit-Planner/frontend/src/components/PartHeader.tsx`

Заменить:
```tsx
// ❌ БЫЛО:
<button>Kalkulátor opalubky (Bednění)</button>

// ✅ СТАЛО:
<button>🪵 Kalkulátor Bednění</button>
```

## Итоговый флоу:

1. Пользователь в части конструкции "PILÍŘE" нажимает "🪵 Kalkulátor Bednění"
2. Открывается модальное окно с полями
3. Вводит: "Pilíře 1-5", 80 m², норма 0.8 ч/м², 2 комплекта, 7 дней созревания
4. Нажимает "Uložit"
5. В ТУ ЖЕ часть "PILÍŘE" добавляются 3 позиции:
   - "Bednění + Pilíře 1-5" (монтаж)
   - "Bednění + Pilíře 1-5 - Demontáž" (демонтаж)
   - "Bednění + Pilíře 1-5 - Pronájem" (аренда на ОБЩЕЕ количество дней)

## Файлы для изменения:

1. `Monolit-Planner/frontend/src/components/PartHeader.tsx` - добавить кнопку
2. `Monolit-Planner/frontend/src/components/FormworkCalculatorModal.tsx` - СОЗДАТЬ
3. `Monolit-Planner/frontend/src/components/PositionsTable.tsx` - добавить обработчик
4. `Monolit-Planner/shared/src/calculators/concrete.ts` - добавить curing_days
5. `Monolit-Planner/shared/src/types.ts` - обновить типы

## Приоритет:

1. ✅ Создать FormworkCalculatorModal.tsx
2. ✅ Добавить кнопку в PartHeader
3. ✅ Добавить обработчик в PositionsTable
4. ✅ Исправить название (убрать "opalubky")
5. ✅ Добавить префикс "Bednění +"
6. ✅ Добавить созревание бетона
7. ✅ Рассчитывать наем из общих дней
