# TASK — Automated Takeoff: DXF-First + walk_drawings + IFC/BIM roadmap

## Назначение

Ответ на вопрос Alexander: "может ли система проходить по чертежам и описывать
каждый элемент рассуждая, как я вручную? И почему не вытащить из DXF/DWG слоёв —
проектант же чертит элементы? В Spain/China программа находит всё автоматически,
человек не проверяет — наоборот."

Honest разбор + 3 стратегии: DXF-first parser (сейчас), walk_drawings vision
(fallback), IFC/BIM (будущее, к Spain/China уровню).

---

## ЧАСТЬ 0 — Ключевое осознание

**DXF/DWG = структурированные данные, НЕ картинка.** Проектант чертит элементы →
они в слоях/объектах. Мы недооценили это — читали vision (картинки), хотя DXF
даёт детерминизм.

**Правильный порядок (детерминизм first — core принцип STAVAGENT):**
```
1. DXF parse (conf 1.0) — layers/polylines/blocks/dimensions/text
2. Vision (conf 0.85) — fallback где DXF неполный
3. TZ cross-ref — validation
```
Vision НЕ first — DXF first. Vision только где DXF не дал.

---

## ЧАСТЬ A — DXF-First Parser (РЕАЛИЗОВАТЬ СЕЙЧАС)

### Что вытаскивается детерминированно из DXF

| DXF entity | Что даёт | Как |
|---|---|---|
| **Layers (vrstvy)** | классификация элементов | имя слоя "S03a-STENA", "VYZTUZ-B500" → тип |
| **LWPOLYLINE/HATCH** | площади (автоматом) | замкнутый контур → area |
| **INSERT (blocks)** | count повторяющихся (okna/dveře) | подсчёт вхождений блока |
| **DIMENSION** | точные длины | размерные линии |
| **TEXT/MTEXT** | размеры, popisy, čísla místností | парсинг текста |
| **ATTRIB** | свойства (materiál, tloušťka) | атрибуты блоков |

### Pipeline
```
DXF файл (ezdxf библиотека Python)
  ↓ читать modelspace
  ↓ per layer: классифицировать (slovník имён слоёв проектанта)
  ↓ polylines → площади (shapely для контуров)
  ↓ blocks → count (okna/dveře/sloupky)
  ↓ dimensions + text → размеры
  ↓ ATTRIB → materiály/tloušťky
Output: structured elements [{type, area, count, dimensions, layer, _source}]
  ↓ confidence 1.0 (детерминизм) где геометрия чистая
```

### Граница DXF-парсинга (честно)
- ✅ Площади polygonов, count блоков, длины dimensions — детерминизм
- ⚠ Интерпретация слоёв — нужен slovník (что значит "S03a"? проектанты называют
  по-разному) → накапливать mapping, vision fallback где неясно
- ⚠ Скрытая логика (патки = 2 ряда; вынос S01 за стену) — может не быть явно
  в DXF, нужно vision/рассуждение

### Acceptance
- ezdxf parser извлекает layers/polylines/blocks/dimensions из RD Jáchymov DXF
- площади полигонов сверить с ручным обмером Alexander (17.6, 62.5, 44.6)
- где DXF != ручной → flag (slovník слоёв неполный или ручной точнее)
- VÝMĚRY register заполняется ИЗ DXF (conf 1.0) где возможно

---

## ЧАСТЬ B — walk_drawings (Vision fallback, host-delegated P40)

Где DXF неполный/неоднозначный → host vision проходит чертёж рассуждая (как
Alexander вручную).

### MCP tool walk_drawings (host-delegated vision)
```
1. MCP инструктирует host (ChatGPT/Claude/Gemini vision):
   "Пройди КАЖДЫЙ чертёж как rozpočtář. Per element опиши:
    název / rozměry / skladba / jak se počítá. Рассуждай вслух.
    Где неуверен — скажи 'OVĚŘIT', не выдумывай."

2. Host vision проходит + рассуждает (стиль Alexander):
   "Stěna S03a: 14 рядов tvárnic × 250 = 3.5m, ряд с патками = 2 ряда,
    3 стороны трапеции 17.84m..."

3. MCP validates каждое рассуждение:
   - cross-ref TZ (элемент в TZ? размеры match?)
   - cross-ref DXF (если есть — площадь подтверждается?)
   - geometrie детерминированно (площадь = obvod × výška)
   - anti-double-count (венец integrální? P: integrální ≠ položka)
   - confidence: vision+DXF+TZ=0.95, vision+TZ=0.85, vision alone=0.6

4. Где conf <0.85 → OVĚŘIT флаг (как Alexander "не знаю высоту дверей")
```

### Принуждение host (4 механизма P40)
- schema: submit_element требует {type, dimensions, _source, confidence}
- description: "читай чертёж как изображение, рассуждай как rozpočtář"
- validation gate: reject ungrounded (нет _source)
- cross-ref: DXF/TZ детерминированно проверяет vision

---

## ЧАСТЬ C — Почему Spain/China авто (IFC/BIM), и путь туда

### Честная разница — почему у них "программа находит всё, человек не проверяет"

| | 2D DXF/DWG (проекты Alexander) | 3D BIM/IFC (Spain/China авто) |
|---|---|---|
| Что в файле | linие, hatch, text, layers | **объекты со свойствами** |
| Площадь | считается из polylines | **зашита в объекте** |
| Материал | в тексте/слое (парсить) | **атрибут объекта** |
| Класс бетона | в TZ/тексте | **свойство элемента** |
| Автоматизм | высокий + интерпретация слоёв | **полный (объект самоописан)** |

**Ключ:** Spain (FIEBDC-3/BC3) + China работают с BIM/IFC — богатая 3D-модель
где элемент "стена" ЗНАЕТ свой объём/материал/класс. Программа вытаскивает БЕЗ
интерпретации. + нац. каталог зашит (код привязан к типу автоматически) +
стандартизация формата.

**Почему "человек не проверяет":**
1. BIM-модель уже верифицирована проектантом (объекты корректны на входе)
2. Нац. каталог зашит (auto code binding)
3. Стандартный формат (FIEBDC-3)

**Почему у Alexander сложнее (пока):**
- 2D DXF (не BIM) → нужна интерпретация
- ÚRS paywalled → нет auto code binding
- Нет гарантии BIM от проектанта

### Путь к их уровню — IFC/BIM support (roadmap)
```
ЕСЛИ проектант даёт IFC → элементы самоописаны → авто-takeoff (их уровень):
- IfcWall → объём/материал/класс зашиты → položka автоматом
- ifcopenshell (Python) парсит IFC
- Это "программа находит всё" — человек верифицирует модель, не takeoff

НО: требует BIM от проектанта (в ČR не все делают, особенно rekonstrukce).
Для DSP/2D — DXF-first + vision остаётся.
```

---

## ЧАСТЬ D — Honest вывод (3 уровня автоматизации)

```
Уровень 1 — 2D DXF (проекты сейчас):
- DXF parse (площади/count/layers) conf 1.0 + vision fallback + human verify деталей
- Автоматизм 70-80%, человек finiшírует (патки=2 ряда, вынос, "чего не хватает")

Уровень 2 — DXF + накопленный slovník слоёв:
- Mapping имён слоёв проектантов накоплен → меньше интерпретации
- Автоматизм 85%, человек меньше

Уровень 3 — IFC/BIM (Spain/China уровень):
- Объекты самоописаны → авто-takeoff → человек верифицирует модель
- Автоматизм 95%, но требует BIM на входе
```

**Текущая реальность Alexander = Уровень 1→2.** Spain/China = Уровень 3 (BIM).
Путь: DXF-first parser сейчас → накопить slovník → IFC support когда проектанты
дают BIM.

---

## Приоритеты реализации

| # | Что | Priority | Усилие |
|---|---|---|--:|
| 1 | DXF-first parser (ezdxf: layers/polylines/blocks/dims) | P0 | ~40h |
| 2 | Slovník имён слоёв (mapping проектантов) | P1 | ~накопительно |
| 3 | walk_drawings vision fallback (host P40) | P1 | ~25h |
| 4 | IFC/BIM support (ifcopenshell) | P2 | ~60h (когда BIM на входе) |

**Старт P0:** DXF-parser — сверить с ручным обмером RD Jáchymov (17.6/62.5/44.6).
Если DXF даёт те же площади детерминированно → огромный апгрейд (то что делали
vision/ручками → авто из DXF).

---

## Паттерн в library

```
Pattern: DXF-First (структура чертежа перед vision)
Problem: читали чертежи как картинки (vision/pypdf), теряя структуру — DXF/DWG
содержит элементы в слоях/объектах (площади, count, размеры) детерминированно.
Algorithm: для DXF/DWG → СНАЧАЛА parse структуру (layers/polylines→площади/
blocks→count/dimensions). conf 1.0 где геометрия чистая. Vision fallback только
где DXF неоднозначен (интерпретация слоёв, скрытая логика).
Acceptance: площади из DXF сверены с ручным обмером; vision только где DXF не дал.
Anti-pattern: vision-first на DXF (теряет детерминированную структуру).
Origin: RD Jáchymov — читали řezy vision, хотя DXF давал площади/слои детерминированно.
```
(verify против P39 vision-first — это НЕ конфликт: P39 для растровых PDF/сканов,
DXF-First для векторных DXF/DWG. Разные источники. Возможно enrichment P39 или NEW.)

## Naming
По конвенциям репо. ezdxf для DXF, ifcopenshell для IFC. Встроить в pipeline.

## STOP gate
DXF-parser прототип на 1 файле RD Jáchymov → сверить площади с ручным обмером →
показать совпадение/расхождение → решить scope.
