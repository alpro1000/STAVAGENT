# TASK — Výměry-First + Full Decomposition (универсальный паттерн)

## Назначение

ДВА объединённых правила, универсальных для ЛЮБОГО объекта (most / pozemní / 
hala / opěrná zeď / tunel):

1. **Výměry-First** — обмер ВСЕГО перед списком работ. Сводная таблица всех 
   единиц (помещение / конструктивный элемент) со всеми измерениями. Список 
   работ ВЫВОДИТСЯ из обмеров.
2. **Full Decomposition** — каждая работа = atomic слои + montáž/materiál split 
   с qty ОБОИХ (труд отдельно, материал отдельно).

Применить к RD Jáchymov СЕЙЧАС + закодировать как паттерн для ВСЕХ будущих 
проектов (library) + спроектировать как MCP-этап.

---

## ЧАСТЬ A — Универсальность (любой объект)

Výměry-First работает для всего, меняется только ЧТО измеряем:

| Тип объекта | Единица обмера | Ключевые измерения |
|---|---|---|
| **Pozemní (помещение)** | místnost | plocha podlahy, světlá výška, obvod, plocha stěn (досчёт), skladby |
| **Most** | konstrukční prvek (pilíř/NK/opěra) | objem betonu, plocha bednění, výška, délka, plocha mostovky |
| **Hala** | konstrukce (sloup/stěna/střecha) | plocha, výška, objem, rozpon |
| **Opěrná zeď** | úsek | délka, výška, plocha líce, objem |
| **Tunel** | profil/úsek | délka, plocha ostění, objem výrubu |

Принцип ОДИН: единица обмера → все измерения (из таблиц/výkresů/ТЗ) + досчёт 
производных (plocha stěn, objem) → структурированная сводная → список работ из неё.

---

## ЧАСТЬ B — RD Jáchymov СЕЙЧАС (применить)

### B1 — VÝMĚRY таблица (Výměry-First)

#### Step 1: Собрать ВСЕ измерения (vision P39 для таблиц чертежей)
Из таблиц místností (DXF/výkres), řezů, ТЗ — per помещение (dům) + per prvek 
(sklad):
- plocha podlahy (таблица если есть)
- světlá výška (řez/ТЗ)
- obvod (из rozměrů)
- skladba podlahy (S0X), skladba stěn/stropu (omítka/obklad)
- otvory (okna/dveře z výpisu)

Vision-first (P39): таблицы DXF = читать как изображение.
_source каждого числа (P29): "tabulka místností" / "řez A-A" / "ТЗ §X".

#### Step 2: Досчитать производные (детерминированно)
- plocha stěn = obvod × světlá výška − Σ otvory
- plocha stropu = plocha podlahy (если ровный)
- objem = plocha × výška (для отопления/VZT/vytápění)
Vzorec в колонке. Confidence: измерено=1.0, досчитано=0.95, OVĚŘIT где предположение.

#### Step 3: Структурировать — VÝMĚRY_SOUHRN.xlsx
Один лист, per řádek = помещение/prvek:
```
Jednotka | Podlaží/Objekt | Plocha podlahy | Světlá výška | Obvod | 
Plocha stěn | Plocha stropu | Objem | Skladba podlahy | Skladba stěn/stropu | 
Otvory | Zdroj | Status
```
- Данные есть → заполнено
- Нет → BLANK + "doplnit" (легко дополнить вручную)
- qty неизвестно → null + OVĚŘIT (Pattern 44)

#### Step 4: Связать список работ с VÝMĚRY
Существующие 281 atomic ops → связать qty с výměry где возможно (omítka stěn 
= plocha stěn z tabulky). Где работа берёт qty из výměry → ref в _source.
Рассогласование (как sklad 21.2 vs 17.6) → устранить: одна plocha = один источник.

### B2 — Full Decomposition (montáž/materiál split)

#### Read-only audit: per atomic op (dům + sklad)
- atomic или агрегат? агрегат → flag DECOMP (разложить на слои)
- montáž/materiál split есть? нет → flag SPLIT
- qty montáž И qty materiál указаны? нет → flag QTY

#### Fix (после approve)
Каждая работа → montáž + materiál с qty обоих:
```
Пример dlažba 17.6 m²:
- montáž "kladení dlažby" — 17.6 m² (труд, MJ работы)
- materiál "betonová dlažba 250×250" — 17.6 m² + ztratné ~5% (материал, MJ материала)
```
- qty materiál следует из qty montáž (dlažba m² = dlaždice m²) → деривация OK
- qty materiál требует расчёт которого нет (ztratné %, tonáž oceli) → OVĚŘIT
- агрегат разложить ТОЛЬКО если знаем слои (skladba/ТЗ), иначе vyjasnění

### B3 — Объединить с текущим sklad-аудитом
Sklad: DS2/DS3 geometrie fix (решено) + decomposition audit (agregát→atomic + 
split + qty) + связь с VÝMĚRY (17.6 одна база). Один проход.

---

## ЧАСТЬ C — Паттерны для ВСЕХ будущих проектов (library)

Добавить в docs/STAVAGENT_PATTERNS.md (verify против existing, не дублировать):

### Pattern: Výměry-First (обмер перед списком работ)
```
Problem: qty работ "висят в воздухе" — нет единой базы, рассогласование 
(одна площадь по-разному в разных работах).
Algorithm: ПЕРЕД списком работ → сводная таблица обмеров всех единиц 
(помещение/prvek). Все измерения из таблиц/výkresů/ТЗ + досчёт производных 
(plocha stěn = obvod × výška − otvory). Список работ ВЫВОДИТСЯ из обмеров — 
каждая qty ссылается на výměru, не отдельная оценка.
Universal: любой объект (most/pozemní/hala/zeď), меняется только что измеряем.
Acceptance: VÝMĚRY таблица создана ПЕРЕД work breakdown; каждая qty работы 
трассируется к výměře; нет рассогласования (одна площадь = один источник).
Anti-pattern: список работ с qty без единой таблицы обмеров (sklad 21.2 vs 
17.6 — рассогласование из-за отсутствия базы).
Origin: RD Jáchymov — qty висели, sklad пол 21.2/17.6 рассогласован.
```

### Pattern: Full Decomposition (montáž/materiál split с qty обоих)
```
Problem: работы агрегированы (не разложены на слои) или не разделены 
montáž/materiál → неполный decompose (core принцип STAVAGENT).
Algorithm: каждая работа = (1) atomic слои, (2) montáž op + materiál op 
раздельно с qty ОБОИХ. montáž = трудовая операция (MJ работы), materiál = 
dodávka (MJ материала + ztratné). qty materiál из qty montáž где следует, 
OVĚŘIT где расчёт неизвестен.
Universal: любой объект.
Acceptance: ноль агрегатов где известны слои; montáž+materiál split везде; 
qty обоих заполнены или OVĚŘIT/null.
Anti-pattern: "podlaha 21 m²" одной строкой (агрегат, нет слоёв, нет split).
Origin: RD Jáchymov sklad — работы агрегированы, montáž/materiál не разделены.
```

(Если Výměry-First концептуально близок Pattern 44/geometrie — enrichment, 
не дубль. Honest verdict агента.)

---

## ЧАСТЬ D — MCP этап (будущее)

Výměry-First = недостающий MCP-этап для автономии:
```
MCP flow:
1. host-vision читает таблицы místností/prvků → VÝMĚRY (структурированно)
2. MCP validate (cross-ref ТЗ/řez, досчёт производных детерминированно)
3. MCP выводит work breakdown ИЗ výměr (qty трассируется)
4. Full decomposition: montáž/materiál split автоматом

Tool design (P40 host-delegation):
- tool "submit_vymery" — schema требует jednotka[] + измерения + _source
- description: "читай таблицу místností как изображение, извлеки все rozměry"
- validation gate: reject если qty без _source
- cross-ref: ТЗ/řez подтверждает площади
```
Делает MCP надёжнее — qty из обмеров (детерминированно), не из воздуха.

---

## Acceptance criteria (RD Jáchymov)
1. VÝMĚRY_SOUHRN.xlsx создан — все помещения dům + prvky sklad, измерения + досчёт
2. Рассогласование устранено (sklad 17.6 одна база)
3. Decomposition audit — agregáty разложены, montáž/materiál split + qty обоих
4. 2 паттерна в library (verify не дубль)
5. regenerate включает VÝMĚRY как шаг
6. STOP gate: VÝMĚRY таблица + decomposition план перед fix

## Naming
По конвенциям репо. Не параллельная структура. Встроить в существующее 
(items.json source, regenerate orchestrator, ATOMIC_FLAT deliverable).

## Workflow
Read-only audit (VÝMĚRY + decomposition) → STOP gate → approve → fix → 
regenerate → STOP gate confirm. Snapshot first.
