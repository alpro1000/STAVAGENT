# 📊 СТРУКТУРА EXCEL ЭКСПОРТА - ПОЛНАЯ СПЕЦИФИКАЦИЯ

**Версия**: 2.0.0
**Статус**: Phase 4 Complete
**Дата**: 2025-11-21

---

## ОБЗОР

Excel экспорт (XLSX) в Monolit Planner состоит из **2 листов** (реализовано) + **2 листа** (планируется).

### Текущие листы:
1. **KPI** - Ключевые показатели проекта
2. **Detaily** - Детальный список позиций с формулами

### Планируемые листы:
3. **Materiály** - Сводка материалов (TODO)
4. **Plán** - График работ (TODO)

---

## ЛИСТ 1: KPI (Ключевые показатели)

### Структура:

```
┌─────────────────────────────────────────────────────────────┐
│ MONOLIT PLANNER — ZPRÁVA O PROJEKTU                        │
│ Most: SO123 | Datum: 21.11.2025                            │
│                                                              │
│ === PARAMETRY OBJEKTU ===                                   │
│ Délka nosné konstrukce:        45.50          m             │
│ Šířka nosné konstrukce:        12.00          m             │
│ Předpokládaná doba realizace:  52.00          týdnů        │
│                                                              │
│ === KLÍČOVÉ METRIKY PROJEKTU ===                            │
│ Σ Objem betonu:               350.00          m³            │
│ Σ Cena (KROS):          2,450,000.00          CZK           │
│ Jednotková cena:             7,000.00          CZK/m³       │
│                                                              │
│ === REŽIM PRÁCE ===                                         │
│ Režim:       30 dní/měsíc [spojitá stavba]                │
│ Odhadovaná doba: 5.2 měsíců | 26 týdnů                    │
│                                                              │
│ === PRŮMĚRNÉ HODNOTY ===                                    │
│ Průměrná velikost party:       6           osob             │
│ Průměrná hodinová sazba:   350.00          CZK/hod         │
│ Průměrný počet hodin za den: 8             hod             │
└─────────────────────────────────────────────────────────────┘
```

### Источники данных:

| Řádek | Pole | Zdroj | Formát |
|-------|------|-------|--------|
| Délka | span_length_m | header_kpi | 0.00 |
| Šířka | deck_width_m | header_kpi | 0.00 |
| Doba | pd_weeks | header_kpi | 0.00 |
| Σ Objem | sum_concrete_m3 | Σ(concrete_m3) | 0.00 |
| Σ Cena | sum_kros_total_czk | Σ(KROS) | #,##0.00 |
| J. cena | project_unit_cost_czk_per_m3 | Σ(KROS)/Σ(m³) | #,##0.00 |

---

## ЛИСТ 2: DETAILY (Детальные позиции)

### Макет таблицы:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ MONOLIT PLANNER — DETAILNÍ PŘEHLED POZIC                                           │
│ Most: SO123 | Datum: 21.11.2025                                                    │
│                                                                                      │
│ === ZÁKLADY ===  (Merged, gray background)                                        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ A      │ B  │ C      │ D    │ E       │ F      │ G   │ H      │ I       │ J │ K  │ L   │ M      │ N   │
│ Podtyp │ MJ │ Množs. │ Lidi │ Kč/hod  │Hod/den │ Den │Hod clk.│Kč clk. │ $/m³ │ m³ │KROS │KROS cl.│ RFI │
├──────────────────────────────────────────────────────────────────────────────────────┤
│Betonáž │ m³ │ 45.00  │  6   │ 350.00  │  8.00  │ 20  │ 960.0  │336000.0│ 7.5 │42.0│ 600 │25200.0 │     │
│        │    │        │      │         │        │     │=D*F*G  │=E*H    │     │    │     │=L*K    │     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│Výztužení│ kg │ 3.20  │  4   │ 280.00  │  8.00  │ 20  │ 640.0  │179200.0│ 0.5 │1.6 │ 100 │ 160.0  │ ⚠️ RFI│
│        │    │        │      │         │        │     │=D*F*G  │=E*H    │     │    │     │=L*K    │     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│(Zebra striping на четных строках)                                                   │
│                                                                                      │
│ CELKEM  │    │ 0.00   │      │         │        │     │1600.0  │515200.0│     │    │     │25360.0 │     │
│         │    │        │      │         │        │     │=SUM(H) │=SUM(I) │     │    │     │=SUM(M) │     │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Колонки и формулы:

| Кол. | Назв. | Тип | Формула | Примечание |
|------|-------|-----|---------|-----------|
| A | Podtyp | TEXT | - | Вид работы |
| B | MJ | TEXT | - | m³, kg, ks, m² |
| C | Množství | NUMBER (0.00) | - | Количество в единицах |
| D | Lidi | INTEGER (0) | - | Размер команды |
| E | Kč/hod | CURRENCY | - | Часовая ставка |
| F | Hod/den | DECIMAL (0.00) | - | Часы в день |
| G | Den | INTEGER (0) | - | Дни |
| **H** | **Hod celkem** | **DECIMAL** | **=D×F×G** | **Crew × Hours × Days** |
| **I** | **Kč celkem** | **CURRENCY** | **=E×H** | **Wage × Total hours** |
| J | CZK/m³ | CURRENCY | - | Цена за м³ |
| K | m³ | DECIMAL (0.00) | - | **Объем бетона** |
| L | KROS JC | CURRENCY | - | KROS unit price |
| **M** | **KROS clk.** | **CURRENCY** | **=L×K** | **⭐ CRITICAL: KROS price × Volume** |
| N | RFI | TEXT | - | Требует информацию |

### Ключевые формулы:

#### 1. Трудозатраты (Column H - Hod celkem)
```excel
=D{row}*F{row}*G{row}

Пример: =D5*F5*G5
Логика: Размер команды × Часы в день × Дни = Всего часов
Результат: 6 × 8 × 20 = 960 часов
```

#### 2. Стоимость труда (Column I - Kč celkem)
```excel
=E{row}*H{row}

Пример: =E5*H5
Логика: Часовая ставка × Всего часов = Сумма затрат
Результат: 350 × 960 = 336,000 CZK
```

#### 3. KROS ИТОГО (Column M - KROS clk.) ⭐ **САМАЯ ВАЖНАЯ**
```excel
=L{row}*K{row}

Пример: =L5*K5
Логика: KROS unit price (за m³) × Concrete volume (m³) = Total KROS cost
Результат: 600 × 42.0 = 25,200 CZK

❌ НЕПРАВИЛЬНО (было раньше):
   =L{row}*C{row}  ← Умножает цену на количество (неправильная единица!)

✅ ПРАВИЛЬНО (текущая реализация):
   =L{row}*K{row}  ← Умножает цену на объем бетона (правильно!)
```

#### 4. Итоговые суммы (Totals Row)
```excel
После всех групп позиций добавляется строка "CELKEM / TOTAL":

Hod celkem (H): =SUM(H{first}:H{last})
Kč celkem (I):  =SUM(I{first}:I{last})
KROS clk. (M):  =SUM(M{first}:M{last})

Пример для данных в строках 5-15:
- H total: =SUM(H5:H15)  → 1,600 часов
- I total: =SUM(I5:I15)  → 515,200 CZK
- M total: =SUM(M5:M15)  → 25,360 CZK
```

---

## 🎨 Форматирование

### Заголовки таблицы (Header Row)
- **Фон**: Темно-синий (#4472C4)
- **Текст**: Белый, Bold, размер 11
- **Выравнивание**: CENTER, MIDDLE, с переносом (wrapText: true)
- **Границы**: Черные, thin style

### Заголовки групп (Group Headers)
- **Фон**: Светло-серый (#E7E6E6)
- **Текст**: Black, Bold
- **Выравнивание**: LEFT
- **Границы**: Черные, thin
- **Merged cells**: Через все колонки

### Строки данных (Data Rows)
- **Форматы**:
  - Количество: `0.00`
  - Целые числа: `0`
  - Деньги: `#,##0.00`
  - Формулы: Сохраняются с вычисленными результатами
- **Выравнивание**:
  - Текст: LEFT
  - Числа: RIGHT
- **Zebra striping**: Четные строки → фон #F9F9F9
- **Границы**: Черные, thin

### Строки RFI (If has_rfi = true)
- **Фон**: Светло-желтый (#FFF8DC)
- **Текст**: Автоматически видимый контраст
- **Символ**: "⚠️ RFI"
- **Выделение**: Вся строка подсвечена

### Итоговая строка (Totals Row)
- **Фон**: Светло-серый (#E7E6E6)
- **Текст**: Bold, размер 11
- **Выравнивание**: LEFT для текста, RIGHT для чисел
- **Границы**: Черные, thin
- **Позиция**: После всех групп

---

## 📋 Дополнительные возможности

### ✅ Уже реализовано

| Функция | Статус | Файл | Строки |
|---------|--------|------|--------|
| Лист KPI | ✅ | exporter.js | 91-141 |
| Лист Detaily | ✅ | exporter.js | 143-305 |
| Группировка по частям | ✅ | exporter.js | 148-155 |
| Формулы H, I, M | ✅ | exporter.js | 271-289 |
| Totals row с SUM | ✅ | exporter.js | 307-364 |
| Форматирование и цвета | ✅ | exporter.js | 37-79 |
| Freeze Panes | ✅ | exporter.js | 93, 145 |
| Auto-fit columns | ✅ | exporter.js | 367-388 |
| Zebra striping | ✅ | exporter.js | 235-242 |
| RFI highlighting | ✅ | exporter.js | 291-300 |
| CSV export | ✅ | exporter.js | 499-537 |
| Сохранение на диск | ✅ | exporter.js | 396-402 |
| История экспортов | ✅ | exporter.js | 416-445 |

### 🔲 Не реализовано

#### ЛИСТ 3: MATERIÁLY (Сводка материалов) - HIGH PRIORITY
```
┌──────────────────────────────────────────┐
│ Materiál    │ Jednotka │ Celkem          │
├──────────────────────────────────────────┤
│ Cement      │ t        │ 450.00          │
│ Písek       │ t        │ 850.00          │
│ Štěrkopísek │ t        │ 1,200.00        │
│ Ocel (výztužení)│ kg   │ 42,000.00       │
│ Dřevo       │ m³       │ 125.00          │
│ Bednění     │ m²       │ 8,500.00        │
└──────────────────────────────────────────┘
```

**Что нужно разработать**:
- Парсинг материалов из позиций (из описания)
- Расчет количества материала на основе объема бетона
- Группировка по типам материала
- Суммирование по единицам

#### ЛИСТ 4: PLÁN (График работ) - MEDIUM PRIORITY
```
┌─────────────────────────────────┐
│ Část     │ Začátek │ Konec  │ Dní │
├─────────────────────────────────┤
│ ZÁKLADY  │ 1.12    │ 21.12  │ 20  │
│ OPĚRY    │ 22.12   │ 31.01  │ 30  │
│ NOSNÁ KON.│ 1.02   │ 21.03  │ 48  │
│ MOSTOVKA │ 22.03   │ 30.04  │ 39  │
└─────────────────────────────────┘
```

**Что нужно разработать**:
- График по частям на основе дней
- Вычисление дат начала/конца
- Диаграмма Gantt (опционально)

#### ДИАГРАММЫ - LOW PRIORITY
- Chart 1: Pie chart распределения затрат по частям (Column I)
- Chart 2: Bar chart трудозатрат по частям (Column H)
- Chart 3: Stacked bar chart материалов

---

## 🔌 Реализация в коде

### Основной файл: `backend/src/services/exporter.js`

**Функция**: `exportToXLSX(positions, header_kpi, bridge_id, saveToServer)`

**Входные параметры**:
```javascript
{
  positions: [
    {
      part_name: "ZÁKLADY",
      subtype: "Betonáž",
      unit: "m³",
      qty: 45.00,
      crew_size: 6,
      wage_czk_ph: 350.00,
      shift_hours: 8.00,
      days: 20,
      unit_cost_on_m3: 7.50,
      concrete_m3: 42.0,
      kros_unit_czk: 600.00,
      has_rfi: false
    },
    // ... остальные позиции
  ],
  header_kpi: {
    span_length_m: 45.50,
    deck_width_m: 12.00,
    pd_weeks: 52.00,
    sum_concrete_m3: 350.00,
    sum_kros_total_czk: 2450000.00,
    project_unit_cost_czk_per_m3: 7000.00,
    // ... остальные KPI
  },
  bridge_id: "SO123",
  saveToServer: true
}
```

**Выходные параметры**:
```javascript
{
  buffer: ArrayBuffer,  // XLSX файл в памяти
  filename: "monolit_SO123_1637467123000.xlsx",  // Имя файла
  filepath: "/path/to/exports/monolit_SO123_1637467123000.xlsx"  // Путь на диске
}
```

---

## 📝 Примеры использования

### Backend (Express)
```javascript
import { exportToXLSX } from '../services/exporter.js';

// В route handler:
const positions = await db.prepare(
  'SELECT * FROM positions WHERE bridge_id = ?'
).all(bridge_id);

const header_kpi = await db.prepare(
  'SELECT * FROM monolith_projects WHERE project_id = ?'
).get(project_id);

const { buffer, filename, filepath } = await exportToXLSX(
  positions,
  header_kpi,
  bridge_id,
  true  // saveToServer = true
);

// Отправить клиенту
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
res.send(buffer);
```

### Frontend (React)
```typescript
const response = await fetch(`/api/export/${projectId}`, {
  method: 'POST'
});

const buffer = await response.arrayBuffer();
const blob = new Blob([buffer], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});

const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `monolit_${projectId}.xlsx`;
a.click();
```

---

## 🐛 Известные проблемы и исправления

### ⭐ KROS Formula Fix (Commit 7273670)
**Проблема**: KROS formula использовала неправильный столбец
```
❌ БЫЛО:  =L*C  (Цена × Количество)
✅ СТАЛО: =L*K  (Цена × Объем m³)
```

**Влияние**: 2-500× ошибки в расчетах для неконкретных позиций

**Исправление**:
- Добавлен столбец K "Objem m³" (concrete_m3)
- Обновлена формула M: `=L*K`

---

## 🎯 Дальнейшее развитие

### Phase 5 Tasks
- [ ] Добавить ЛИСТ 3: Материалы
- [ ] Добавить ЛИСТ 4: График
- [ ] Добавить диаграммы
- [ ] Экспорт в PDF

### Текущий статус
- **Фаза**: Phase 4 Complete
- **Версия**: 2.0.0
- **Готовность**: Production Ready
- **Производительность**: Экспорт за 0.5-1 секунду

---

**Последнее обновление**: 2025-11-21
**Автор**: Monolit Planner Development Team
