# ROW CLASSIFICATION — target algorithm (specification)

> **Status.** Specification, ready for implementation — 2026-04-22.
>
> **Relationship to other docs.**
> - [`ROW_CLASSIFICATION_CURRENT.md`](./ROW_CLASSIFICATION_CURRENT.md) —
>   baseline audit of how classification works *today* (post-hoc regex
>   walk after the parser has already grouped rows). Describes 11
>   failure modes.
> - **This file** — replacement algorithm. Deterministic, format-aware,
>   reads the source-of-truth `Typ` column for EstiCon and Komplet
>   exports and falls back to content heuristics only for the RTSROZP /
>   custom case.
>
> **Scope.** Specification only. Implementation lives in a follow-up PR
> (tracked by `TASK_ClassifierRewrite.md` — to be added separately).

## Purpose

Этот документ описывает **детерминистический алгоритм** определения `rowRole` (main / subordinate / section / unknown) и установки `parentItemId` при импорте строительных смет в Registry.

Алгоритм заменит текущий classifier который имеет проблему orphan subordinates (строки помечены `rowRole='subordinate'` но `parentItemId=null`). Proximity fallback в ItemsTable.tsx из compensation PR остаётся как safety net.

---

## Обзор форматов

На основе анализа 3 реальных смет идентифицированы **три формата Excel**:

### Format A: EstiCon (Czech, machine-readable)
- Уникальный идентификатор: первая колонка содержит поле `Typ` с явными маркерами
- Примеры: `TEST_ROZPOČET_D6_202.xlsx`
- Характерные признаки: `SD`, `P`, `PP`, `VV`, `TS` в колонке A

### Format B: Export Komplet — OTSKP (ÚRS)
- Уникальный идентификатор: вторая-третья колонка содержит `PČ | Typ | Kód | Popis | MJ | Množství | J.cena | Cena celkem | Cenová soustava`
- Примеры: `011-26_I-26_Kyšice.xlsx`, `IO01_ZTV_Veselí.xlsx`
- Характерные признаки: `D`, `K`, `PP`, `PSC`, `VV` в колонке Typ
- Есть header row с текстом `'PČ'`, `'Typ'`, `'Kód'`, `'Popis'`

### Format C: RTSROZP / custom
- Ни EstiCon header, ни Komplet header
- Требует column-mapping by content (heuristics by header row keywords + fallback by OTSKP code regex in first column with data)

---

## Алгоритм Format Detection

```
detect_format(workbook):
  for each sheet in workbook:
    for row in first 200 rows of sheet:
      if row[col=0] in {'SD', 'P', 'PP', 'VV', 'TS', 'SO', 'SP'} for 3+ rows:
        return 'EstiCon'
      if row contains text 'PČ' AND 'Typ' AND 'Kód' AND 'Popis' AND 'MJ' AND 'Množství':
        return 'Komplet'
  return 'RTSROZP'  # fallback
```

**Важно**: Header row в Komplet обычно на 120-125 строке листа (после Krycí list soupisu prací + Rekapitulace). Data начинается со следующей строки после header.

---

## Column Mapping

### Format A — EstiCon
Колонки фиксированные:

| Index | Name | Type | Example |
|-------|------|------|---------|
| 0 | `Typ` | string | `'SD'`, `'P'`, `'PP'`, `'VV'`, `'TS'` |
| 1 | `Poř. číslo` | int \| None | `1`, `2`, `3` |
| 2 | `Kód položky` | string \| None | `'014101'`, `'0'`, `'1'` |
| 3 | `Varianta` | string \| None | `''`, `'kn'`, `'pvh'` |
| 4 | `Název Položky` | string | `'POPLATKY ZA SKLÁDKU'` |
| 5 | `MJ` | string \| None | `'M3'`, `'KUS'`, `'T'` |
| 6 | `Množství` | float \| None | `1020.341` |
| 7 | `Cena Jednotková` | float | `0` или сумма |
| 8 | `Cena Celkem` | float | `0` или сумма |
| 9 | `Cenová soustava` | string | `'OTSKP 2025'` |

### Format B — Komplet
Колонки по header row (ищи row где `row[2]='PČ'`):

| Index | Name | Type | Example |
|-------|------|------|---------|
| 2 | `PČ` (Pořadové číslo) | int \| None | `1`, `2` |
| 3 | `Typ` | string | `'D'`, `'K'`, `'PP'`, `'PSC'`, `'VV'` |
| 4 | `Kód` | string | `'014101'`, `'121151123'` |
| 5 | `Popis` | string | `'POPLATKY ZA SKLÁDKU'` |
| 6 | `MJ` | string | `'M3'`, `'m2'`, `'m3'` |
| 7 | `Množství` | float | `5621.023` |
| 8 | `J.cena [CZK]` | float | `0` |
| 9 | `Cena celkem [CZK]` | float | `0` |
| 10 | `Cenová soustava` | string | `'OTSKP 2025'`, `'CS ÚRS 2025 02'` |

**Важно**: `MJ` регистр разный — `'M3'` в OTSKP, `'m3'` в ÚRS. Нормализовать к lowercase при сохранении.

### Format C — RTSROZP / custom
Fallback heuristics:
1. Найти row где cells содержат `'Kód'` или `'Kod'` — это header, колонка для `kod`
2. Рядом `'Popis'` / `'Název'` / `'Text položky'` — колонка для `popis`
3. `'MJ'` / `'Jednotka'` / `'m.j.'` — колонка для `mj`
4. `'Množství'` / `'Počet'` — колонка для `mnozstvi`
5. `'Cena'` / `'J.cena'` — цена

Если header не найден — fallback by content:
- Колонка у которой ≥30% ячеек соответствует regex OTSKP (6 цифр) или ÚRS (9 цифр) → это `kod`
- Колонка у которой ≥30% ячеек это float → вероятно `mnozstvi` или `cena`
- Колонка с самыми длинными текстами → `popis`

---

## Row Classification Algorithm

### Format A — EstiCon

Прямое mapping из колонки `Typ`:

```
classify_esticon(row):
  typ = row[0]
  switch typ:
    case 'SO': rowRole = 'section'   # Stavba (top-level)
    case 'O':  rowRole = 'section'   # Objekt
    case 'O1': rowRole = 'section'   # Rozpočet
    case 'SD': rowRole = 'section'   # Skupina dílů (раздел "0 Všeobecné", "1 Zemní práce")
    case 'P':  rowRole = 'main'      # Položka (основная работа)
    case 'PP': rowRole = 'subordinate'  # Popis Podrobný (уточнение)
    case 'VV': rowRole = 'subordinate'  # Výpočet Výměry (формула расчёта)
    case 'TS': rowRole = 'subordinate'  # Text Standardní (стандартный текст ÚRS)
    default:   rowRole = 'unknown'
```

**Parent linking**:
- `SD` - не имеет parent (section — top-level в пределах sheet)
- `P` — не имеет parent (main в пределах своей section)
- `PP`, `VV`, `TS` — parent = последний `P` в source order

### Format B — Komplet

```
classify_komplet(row):
  typ = row[3]  # column 'Typ'
  kod = row[4]
  popis = row[5]
  mj = row[6]
  mnozstvi = row[7]
  
  switch typ:
    case 'D':   rowRole = 'section'   # Díl (раздел "0", "1", "HSV")
    case 'K':   rowRole = 'main'      # Konstrukce (основная работа с кодом)
    case 'PP':  rowRole = 'subordinate'  # Popis Podrobný
    case 'PSC': rowRole = 'subordinate'  # Poznámka k Souboru Cen
    case 'VV':  rowRole = 'subordinate'  # Výpočet Výměry
    default:    rowRole = 'unknown'
```

**Parent linking** — как в EstiCon: subordinates → последний `K` (main) в source order.

### Format C — RTSROZP / custom

Нет явной колонки `Typ`. Используется **content-based heuristics**:

```
classify_rtsrozp(row, mapping):
  kod = row[mapping.kod]
  popis = row[mapping.popis]
  mj = row[mapping.mj]
  mnozstvi = row[mapping.mnozstvi]
  cena = row[mapping.cena]
  
  # Нормализуем: пустая строка == None
  kod_empty = (kod is None) or (str(kod).strip() == '')
  mj_empty = (mj is None) or (str(mj).strip() == '')
  mnozstvi_empty = (mnozstvi is None) or (mnozstvi == 0 and not has_formula)
  popis_empty = (popis is None) or (str(popis).strip() == '')
  
  # Rules in order of precedence
  
  # 1. Section heuristic — короткий kod (1-2 цифры) ИЛИ специальные ключевые слова
  if kod is not None and re.match(r'^[0-9]{1,2}$', str(kod).strip()):
    rowRole = 'section'
    return
  if popis_empty == False and mj_empty and mnozstvi_empty:
    if is_section_keyword(popis):  # "Základy", "Zemní práce", "Svislé konstrukce"...
      rowRole = 'section'
      return
  
  # 2. Main heuristic — есть kod + mj + mnozstvi
  if kod_empty == False and mj_empty == False and mnozstvi_empty == False:
    # Дополнительно валидируем kod format
    if is_valid_otskp_code(kod) or is_valid_urs_code(kod) or is_custom_code(kod):
      rowRole = 'main'
      return
  
  # 3. Subordinate heuristic — всё остальное с popis
  if popis_empty == False:
    rowRole = 'subordinate'
    return
  
  # 4. Empty row
  rowRole = 'unknown'
```

**Parent linking** (proximity-based):
- При итерации items в source order: tracking `currentMainId`
- При встрече `main` → `currentMainId = main.id`
- При встрече `subordinate` → `parentItemId = currentMainId` (если есть)
- При встрече `section` → `currentMainId = null` (новая секция обнуляет контекст)

---

## Валидация кодов

```
is_valid_otskp_code(code):
  # OTSKP: 6 цифр (иногда с варианта-суффиксом — "12373 kn")
  return re.match(r'^[0-9]{5,6}(\.[a-z]+)?$', code.strip())

is_valid_urs_code(code):
  # ÚRS: 9 цифр
  return re.match(r'^[0-9]{9}$', code.strip())

is_custom_code(code):
  # Свободный формат: буквы + цифры, но не section markers
  return re.match(r'^[A-Z0-9]{3,}$', code.strip()) and not re.match(r'^[0-9]{1,2}$', code.strip())
```

---

## Parent Linking — полный псевдокод

```python
def assign_parent_links(items: list[RawItem]) -> list[ClassifiedItem]:
    current_main_id = None
    current_section_id = None
    result = []
    
    for raw in items:
        item = classify(raw)  # returns rowRole
        
        if item.rowRole == 'section':
            current_section_id = item.id
            current_main_id = None  # reset — новая секция
            item.parentItemId = None
            item.sectionId = None  # section-row у себя не имеет section
        
        elif item.rowRole == 'main':
            item.parentItemId = None
            item.sectionId = current_section_id
            current_main_id = item.id
        
        elif item.rowRole == 'subordinate':
            item.parentItemId = current_main_id
            item.sectionId = current_section_id
            # Edge case: subordinate без предшествующего main
            if current_main_id is None:
                log_warning(f"Orphan subordinate at row {raw.source_row_index}")
                item.rowRole = 'unknown'  # downgrade to safe default
        
        else:  # unknown
            item.parentItemId = None
            item.sectionId = current_section_id
        
        result.append(item)
    
    return result
```

---

## Edge Cases

### 1. Orphan subordinate в начале файла
Первая строка — subordinate без main сверху. **Downgrade to `unknown`** и залогировать warning.

### 2. Section-row внутри main+subordinate последовательности
```
main A
  subordinate A1
section X   ← прерывает цепочку
main B
```
Корректно: `current_main_id` reset при встрече section. `subordinate A1` привязан к `A`, не к future `B`.

### 3. Два main подряд без subordinates
Normal. `currentMainId` просто updates, предыдущий main не ломается.

### 4. Numbered prefix в section popis
`"0 - Všeobecné konstrukce a práce"` — это section, но в kod может быть `0` или пустой, а в popis включён сам номер. Признак: `kod` либо 1-2 цифры либо пустой, popis не имеет mj/mnozstvi.

### 5. Pole MJ с разным регистром
`'M3'` (OTSKP) vs `'m3'` (ÚRS). Нормализовать: `str(mj).lower().strip()`.

### 6. Поле Množství как строка (formula cell)
`'1020.341'` vs `1020.341`. Обработать try/except float parse.

### 7. #REF! в ячейках
Excel formula errors — skip, treat as None.

### 8. Пустые row между real items
В Komplet часто встречаются. Skip полностью пустые rows.

### 9. Poř. число как int vs str
`1` vs `'1'` — normalize к int если parsable.

### 10. Cenová soustava разные в одном файле
`'OTSKP 2025'` и `'CS ÚRS 2025 02'` могут быть в одном Komplet файле (гибрид). Сохраняем per-item.

---

## Normalized Item Model (output)

```typescript
interface ClassifiedItem {
  // Identity
  id: string;                      // generated UUID
  source_row_index: number;        // original Excel row number (для debug)
  source_sheet_name: string;
  source_format: 'EstiCon' | 'Komplet' | 'RTSROZP';
  
  // Role
  rowRole: 'section' | 'main' | 'subordinate' | 'unknown';
  parentItemId: string | null;     // → main.id если subordinate
  sectionId: string | null;        // → section.id для группировки
  
  // Core fields
  por: number | null;              // Pořadové číslo (main only)
  kod: string | null;              // OTSKP / ÚRS / custom
  popis: string;                   // always non-empty для non-unknown
  mj: string | null;               // normalized lowercase
  mnozstvi: number | null;
  cenaJednotkova: number | null;
  cenaCelkem: number | null;
  cenovaSoustava: string | null;   // 'OTSKP 2025', 'CS ÚRS 2025 02', etc.
  
  // Original row Typ for traceability (EstiCon / Komplet)
  originalTyp: string | null;      // 'SD', 'P', 'PP', 'VV', 'TS', 'D', 'K', 'PSC'
  
  // Varianta (только EstiCon Format A)
  varianta: string | null;
  
  // Classification metadata
  classificationConfidence: number;  // 1.0 for deterministic (Typ column), 0.85 for regex, 0.7 for AI fallback
  classificationSource: 'typ-column' | 'content-heuristic' | 'ai-fallback';
}
```

---

## Совместимость с текущим кодом Registry

Текущее поле в Registry `rowRole` принимает `'main' | 'subordinate' | 'section' | 'unknown'`. **Не меняем values**, только алгоритм их установки.

Текущее поле `parentItemId` существует, но в некоторых случаях = null для subordinate. После этого fix → всегда заполнено для subordinate.

Proximity fallback в `ItemsTable.tsx:effectiveParentMap` из compensation PR — остаётся как safety net. После правильного classifier он будет работать вхолостую (все subordinates уже имеют parentItemId из import), но не harmful.

---

## Task для Claude Code

Использовать этот документ как спецификацию. Реализация в отдельном PR после merge compensation PR. Файл: `TASK_ClassifierRewrite.md` (ниже отдельно).
