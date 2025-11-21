# 🏗️ ШАГ ЗА ШАГОМ: КАК СТРОИТСЯ EXCEL ФАЙЛ

**Версия**: 2.0.0
**Файл**: `backend/src/services/exporter.js`
**Функция**: `exportToXLSX()`

---

## 📍 ОБЩИЙ ПРОЦЕСС

```
1. Получить входные данные (positions + header_kpi)
2. Создать новый Workbook
3. ЛИСТ 1: Создать KPI Sheet
4. ЛИСТ 2: Создать Detaily Sheet
5. Сгруппировать позиции по частям
6. Добавить каждую позицию с формулами
7. Добавить итоговую строку с SUM формулами
8. Сгенерировать XLSX buffer
9. (Опционально) Сохранить на диск
10. Вернуть buffer + filename
```

---

## 🔍 ДЕТАЛЬНЫЙ РАЗБОР КАЖДОГО ШАГА

### ШАГ 1-2: Инициализация (Строки 85-89)

```javascript
export async function exportToXLSX(positions, header_kpi, bridge_id, saveToServer = false) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Monolit Planner';
    workbook.created = new Date();
```

**Что происходит**:
- Создается новый пустой Excel workbook
- Устанавливаются метаданные (автор, дата)
- Готово для добавления листов

---

### ШАГ 3: ЛИСТ 1 - KPI Sheet (Строки 91-141)

#### 3a. Создать лист (Строка 92)
```javascript
const kpiSheet = workbook.addWorksheet('KPI', {
  views: [{ state: 'frozen', ySplit: 2 }]  // Заморозить первые 2 строки
});
```

#### 3b. Подготовить данные KPI (Строки 96-118)
```javascript
const kpiData = [
  ['MONOLIT PLANNER — ZPRÁVA O PROJEKTU'],     // Строка 1: Название
  [`Most: ${bridge_id} | Datum: ...`],         // Строка 2: Bridge ID + дата
  [],                                           // Строка 3: Пустая
  ['=== PARAMETRY OBJEKTU ==='],                // Строка 4: Заголовок группы
  ['Délka nosné konstrukce:', formatNumber(header_kpi.span_length_m), 'm'],
  // ... остальные параметры
];
```

**Данные структурированы как массив массивов**:
```
[
  ['Column A', 'Column B', 'Column C'],
  ['Value 1',  'Value 2',  'Value 3'],
  // ...
]
```

#### 3c. Добавить строки на лист (Строки 121-136)
```javascript
kpiData.forEach((row, rowIndex) => {
  const excelRow = kpiSheet.addRow(row);

  // Стилизировать заголовки
  if (rowIndex === 0 || rowIndex === 1) {
    excelRow.font = { bold: true, size: 14 };
  }

  // Добавить границы
  excelRow.eachCell((cell) => {
    if (cell.value) {
      applyBorders(cell);
    }
  });
});
```

**Процесс**:
1. Для каждой строки в `kpiData`:
   - Добавить строку на лист
   - Применить стили (bold, size)
   - Применить границы
2. Все 17 строк KPI добавлены на лист

#### 3d. Установить ширину колонок (Строки 138-141)
```javascript
kpiSheet.getColumn(1).width = 40;
kpiSheet.getColumn(2).width = 25;
kpiSheet.getColumn(3).width = 15;
```

**Результат**: Лист KPI готов! ✅

---

### ШАГ 4: ЛИСТ 2 - Detaily Sheet (Строки 143-305)

#### 4a. Создать лист (Строка 144)
```javascript
const detailSheet = workbook.addWorksheet('Detaily', {
  views: [{ state: 'frozen', ySplit: 1 }]  // Заморозить заголовок
});
```

#### 4b. Подготовить заголовки колонок (Строки 157-172)
```javascript
const positionHeaders = [
  'Podtyp',         // A: Вид работы
  'MJ',             // B: Единица измерения
  'Množství',       // C: Количество
  'Lidi',           // D: Размер команды
  'Kč/hod',         // E: Часовая ставка
  'Hod/den',        // F: Часы в день
  'Den',            // G: Дни
  'Hod celkem',     // H: Всего часов (FORMULA)
  'Kč celkem',      // I: Сумма затрат (FORMULA)
  'Kč/m³',          // J: Цена за м³
  'Objem m³',       // K: Объем бетона
  'KROS JC',        // L: KROS unit price
  'KROS celkem',    // M: KROS итого (FORMULA)
  'RFI'             // N: Требует информацию
];
```

#### 4c. Добавить заголовки листа (Строки 174-182)
```javascript
// Строка 1: Название
const titleRow = detailSheet.addRow(['MONOLIT PLANNER — DETAILNÍ PŘEHLED POZIC']);
titleRow.font = { bold: true, size: 14 };

// Строка 2: Bridge + дата
const subtitleRow = detailSheet.addRow([`Most: ${bridge_id} | Datum: ...`]);
subtitleRow.font = { bold: true, size: 12 };

// Строка 3: Пустая
detailSheet.addRow([]);
```

#### 4d. ГЛАВНЫЙ ПРОЦЕСС: Группировка позиций (Строки 148-155)
```javascript
const groupedPositions = {};
positions.forEach(pos => {
  if (!groupedPositions[pos.part_name]) {
    groupedPositions[pos.part_name] = [];
  }
  groupedPositions[pos.part_name].push(pos);
});

// Результат:
// {
//   'ZÁKLADY': [pos1, pos2, pos3],
//   'OPĚRY': [pos4, pos5],
//   'SLOUPY': [pos6],
//   ...
// }
```

#### 4e. ДЛЯ КАЖДОЙ ЧАСТИ: Добавить группу (Строки 190-305)
```javascript
Object.entries(groupedPositions).forEach(([partName, partPositions]) => {
  // 1. Добавить заголовок части
  const partHeaderRow = detailSheet.addRow([`=== ${partName} ===`]);
  applyGroupHeaderStyle(partHeaderRow.getCell(1));
  detailSheet.mergeCells(partHeaderRow.number, 1, partHeaderRow.number, 14);

  // 2. Добавить заголовки колонок
  const headerRow = detailSheet.addRow(positionHeaders);
  headerRow.eachCell((cell) => applyHeaderStyle(cell));

  // 3. ДЛЯ КАЖДОЙ ПОЗИЦИИ В ЧАСТИ: Добавить данные + формулы
  partPositions.forEach((pos, posIndex) => {
    // ... (см. ШАГ 4f)
  });

  // 4. Добавить пустую строку между группами
  detailSheet.addRow([]);
});
```

#### 4f. ДЛЯ КАЖДОЙ ПОЗИЦИИ: Добавить строку с формулами (Строки 202-300)

```javascript
partPositions.forEach((pos, posIndex) => {
  const rowNumber = detailSheet.lastRow.number + 1;

  // Шаг 1: Подготовить данные
  const rowData = [
    pos.subtype,              // A: Вид работы
    pos.unit,                 // B: Единица
    pos.qty,                  // C: Количество
    pos.crew_size,            // D: Люди
    pos.wage_czk_ph,          // E: Цена/час
    pos.shift_hours,          // F: Часы/день
    pos.days,                 // G: Дни
    null,                     // H: Будет формула
    null,                     // I: Будет формула
    pos.unit_cost_on_m3,      // J: Цена/м³
    pos.concrete_m3,          // K: Объем m³
    pos.kros_unit_czk,        // L: KROS unit
    null,                     // M: Будет формула
    pos.has_rfi ? '⚠️ RFI' : ''  // N: RFI
  ];

  // Шаг 2: Добавить строку на лист
  const dataRow = detailSheet.addRow(rowData);

  // Шаг 3: Применить форматирование
  dataRow.eachCell((cell, colNumber) => {
    applyBorders(cell);

    // Zebra striping
    if (rowCounter % 2 === 0) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
    }

    // Форматирование чисел
    if (colNumber === 3) {  // Количество
      cell.numFmt = '0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (colNumber === 5 || colNumber === 10 || colNumber === 12) {  // Деньги
      cell.numFmt = '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
    // ... остальное форматирование
  });

  // Шаг 4: Добавить ФОРМУЛЫ для вычисляемых колонок

  // H: Трудозатраты = D * F * G
  dataRow.getCell(8).value = {
    formula: `D${rowNumber}*F${rowNumber}*G${rowNumber}`,
    result: pos.crew_size * pos.shift_hours * pos.days
  };

  // I: Стоимость труда = E * H
  dataRow.getCell(9).value = {
    formula: `E${rowNumber}*H${rowNumber}`,
    result: pos.wage_czk_ph * (pos.crew_size * pos.shift_hours * pos.days)
  };

  // M: KROS ИТОГО = L * K ⭐ КРИТИЧЕСКАЯ!
  dataRow.getCell(13).value = {
    formula: `L${rowNumber}*K${rowNumber}`,
    result: pos.kros_unit_czk * pos.concrete_m3
  };

  // Шаг 5: Выделить RFI строки
  if (pos.has_rfi) {
    dataRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } };
    });
  }
});
```

**Что происходит в этом шаге**:
1. Для каждой позиции создается строка
2. Заполняются данные из базы (A-G, J-L)
3. **Добавляются 3 ФОРМУЛЫ**:
   - H = D × F × G (трудозатраты)
   - I = E × H (стоимость труда)
   - M = L × K (KROS итого) ⭐ **САМАЯ ВАЖНАЯ**
4. Применяется форматирование (цвета, выравнивание, форматы чисел)
5. RFI строки выделяются желтым

#### 4g. Добавить ИТОГОВУЮ СТРОКУ (Строки 307-364)

```javascript
if (firstDataRow !== null && lastDataRow !== null) {
  // Шаг 1: Добавить пустую строку
  detailSheet.addRow([]);

  // Шаг 2: Создать итоговую строку
  const totalsRow = detailSheet.addRow([
    'CELKEM / TOTAL',  // A: Заголовок
    '',                // B
    null,              // C
    '',                // D
    '',                // E
    '',                // F
    '',                // G
    null,              // H: Будет SUM формула
    null,              // I: Будет SUM формула
    '',                // J
    '',                // K
    '',                // L
    null,              // M: Будет SUM формула
    ''                 // N
  ]);

  // Шаг 3: Применить стиль итоговой строки
  totalsRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
    applyBorders(cell);
  });

  // Шаг 4: Добавить SUM ФОРМУЛЫ
  const totalRowNumber = totalsRow.number;

  // H: Сумма всех трудозатрат
  totalsRow.getCell(8).value = {
    formula: `SUM(H${firstDataRow}:H${lastDataRow})`
  };

  // I: Сумма всех затрат
  totalsRow.getCell(9).value = {
    formula: `SUM(I${firstDataRow}:I${lastDataRow})`
  };

  // M: Сумма всех KROS итого
  totalsRow.getCell(13).value = {
    formula: `SUM(M${firstDataRow}:M${lastDataRow})`
  };
}
```

**Результат**:
```
CELKEM / TOTAL  │    │ 0.00  │      │         │        │      │=SUM(H...) │=SUM(I...) │      │    │    │=SUM(M...) │
                │    │       │      │         │        │      │ 1,600.00  │ 515,200.00│      │    │    │ 25,360.00 │
```

#### 4h. Auto-fit колонок (Строки 367-388)
```javascript
detailSheet.columns.forEach((column, index) => {
  let maxLength = (positionHeaders[index]?.length || 10) + 2;

  column.eachCell({ includeEmpty: false }, (cell) => {
    let cellLength = 0;
    const value = cell.value;

    if (value === null || value === undefined) {
      cellLength = 0;
    } else if (typeof value === 'object' && value.formula) {
      // Для формул, использовать длину заголовка
      cellLength = (positionHeaders[index]?.length || 10);
    } else {
      cellLength = String(value).length;
    }

    maxLength = Math.max(maxLength, cellLength);
  });

  column.width = Math.min(maxLength + 2, 50);  // Max 50
});
```

**Результат**: Все колонки автоматически подогнаны к содержимому ✅

---

### ШАГ 5: Генерирование XLSX (Строки 390-391)

```javascript
const buffer = await workbook.xlsx.writeBuffer();
```

**Что происходит**:
- ExcelJS сериализует весь workbook в бинарный формат (XLSX)
- Возвращается ArrayBuffer, готовый для отправки клиенту

---

### ШАГ 6: Сохранение на диск (Строки 396-402)

```javascript
let filename = null;
let filepath = null;
if (saveToServer) {
  const timestamp = Date.now();
  filename = `monolit_${bridge_id}_${timestamp}.xlsx`;
  filepath = path.join(EXPORTS_DIR, filename);
  await fs.promises.writeFile(filepath, buffer);
  logger.info(`XLSX export saved to disk: ${filepath}`);
}
```

**Результат**: Файл сохранен на диск для истории экспортов

---

### ШАГ 7: Возврат результата (Строки 404-406)

```javascript
logger.info(`XLSX export generated for ${bridge_id}: ${positions.length} positions`);

return { buffer, filename, filepath };
```

**Возвращает**:
```javascript
{
  buffer: ArrayBuffer,           // Сам XLSX файл
  filename: "monolit_SO123_1637467123000.xlsx",  // Имя для скачивания
  filepath: "/path/to/exports/monolit_SO123_..." // Путь на диске
}
```

---

## 🔍 ВИЗУАЛЬНЫЙ ПРОЦЕСС

```
НАЧАЛО
  │
  ├─── Workbook.create()
  │      └─── Готов для добавления листов
  │
  ├─── ЛИСТ 1: KPI
  │      ├─── Заголовок + дата (строки 1-2)
  │      ├─── Параметры объекта (строки 4-7)
  │      ├─── Ключевые метрики (строки 8-11)
  │      ├─── Режим работы (строки 12-14)
  │      └─── Средние значения (строки 15-17)
  │
  ├─── ЛИСТ 2: DETAILY
  │      ├─── Заголовок + дата (строки 1-2)
  │      │
  │      ├─── ДЛЯ КАЖДОЙ ЧАСТИ (ОСНОВНОЙ ЦИКЛ):
  │      │      ├─── Заголовок части (=== ZÁKLADY ===)
  │      │      ├─── Заголовки колонок (Podtyp, MJ, Množství, ...)
  │      │      │
  │      │      └─── ДЛЯ КАЖДОЙ ПОЗИЦИИ В ЧАСТИ:
  │      │             ├─── Данные (A-G, J-L)
  │      │             ├─── ФОРМУЛА H: =D*F*G
  │      │             ├─── ФОРМУЛА I: =E*H
  │      │             ├─── ФОРМУЛА M: =L*K ⭐
  │      │             ├─── Форматирование (цвета, выравнивание)
  │      │             └─── RFI выделение (если needed)
  │      │      │
  │      │      └─── Пустая строка между частями
  │      │
  │      ├─── ИТОГОВАЯ СТРОКА:
  │      │      ├─── "CELKEM / TOTAL"
  │      │      ├─── ФОРМУЛА H: =SUM(H..:H..)
  │      │      ├─── ФОРМУЛА I: =SUM(I..:I..)
  │      │      └─── ФОРМУЛА M: =SUM(M..:M..)
  │      │
  │      └─── Auto-fit всех колонок
  │
  ├─── writeBuffer() → XLSX в памяти
  │
  ├─── (Если saveToServer) → Сохранить на диск
  │
  └─── return { buffer, filename, filepath }
       │
       ├─── Buffer → Отправить клиенту
       ├─── Filename → Использовать для скачивания
       └─── Filepath → Сохранить в истории
```

---

## 📊 ПРИМЕР ИТОГОВОГО РЕЗУЛЬТАТА

### До добавления позиций:
```
rowCounter = 0
firstDataRow = null
lastDataRow = null
```

### После добавления 15 позиций в ZÁKLADY + 8 позиций в OPĚRY:
```
rowCounter = 23
firstDataRow = 5 (первая позиция)
lastDataRow = 27 (последняя позиция в OPĚRY)

ИТОГОВАЯ СТРОКА (строка 30):
H30: =SUM(H5:H27)  → 2,345.50 часов
I30: =SUM(I5:I27)  → 987,654.00 CZK
M30: =SUM(M5:M27)  → 2,456,789.00 CZK
```

---

## ⚡ ПРОИЗВОДИТЕЛЬНОСТЬ

| Операция | Время | Примечание |
|----------|-------|-----------|
| Создание workbook | < 10ms | |
| Добавление 100 позиций | 100-200ms | Зависит от стилей |
| Добавление формул | 10-20ms | ExcelJS кеширует |
| writeBuffer() | 50-100ms | Сериализация в XLSX |
| Сохранение на диск | 20-50ms | I/O операция |
| **ВСЕГО** | **200-500ms** | ✅ Быстро! |

---

## 🐛 Возможные ошибки и их исправления

### Ошибка 1: "Cannot read property 'length' of undefined"
**Причина**: `positions` или `groupedPositions` undefined
**Исправление**:
```javascript
if (!Array.isArray(positions) || positions.length === 0) {
  throw new Error('No positions to export');
}
```

### Ошибка 2: Формулы не вычисляются
**Причина**: Забыли добавить свойство `result`
**Исправление**:
```javascript
dataRow.getCell(8).value = {
  formula: `D${rowNumber}*F${rowNumber}*G${rowNumber}`,
  result: pos.crew_size * pos.shift_hours * pos.days  // ← IMPORTANT!
};
```

### Ошибка 3: KROS формула дает неправильный результат
**Причина**: Используется столбец C вместо K
**Исправление** (уже сделано):
```javascript
// ❌ БЫЛО:
dataRow.getCell(13).value = { formula: `L${rowNumber}*C${rowNumber}` };

// ✅ СТАЛО:
dataRow.getCell(13).value = { formula: `L${rowNumber}*K${rowNumber}` };
```

---

## 📚 Справочные материалы

- **ExcelJS Docs**: https://github.com/exceljs/exceljs
- **Number Formats**: https://www.excel-easy.com/examples/format-cells.html
- **Cell Reference Format**: `A1:B10` = диапазон от A1 до B10

---

**Дата обновления**: 2025-11-21
**Версия**: 2.0.0
