# КОНТРАКТ — целевая форма ответа `find_urs_code` (блокер T1-adapter ↔ T5)

> **Тип:** контракт-решение (design). НЕ имплементация, прод-код не тронут.
> **Зачем:** T1-adapter и T5 должны строиться против ОДНОЙ формы. Этот док фиксирует форму до кода.
> **Ветка:** `claude/atomizer-localize` · **Дата:** 2026-06-19
> **Заземление:** `app/mcp/tools/urs.py` (текущая форма), `app/mcp/tools/otskp.py` (несущая-эталон), `docs/specs/universal-work-decomposer/design.md` §3/§5.

---

## 0. Решение за 30 секунд

- **T5 (тулза)** отвечает за: carrier-паритет с `find_otskp_code` + честную провенанс-разметку каждого результата (`source`, `catalog`, `catalog_version`, `unit`, **`match_kind`**).
- **T1 (adapter)** отвечает за: вывод **status-enum** (`exact|candidate|group_only|not_verified`) + выбор каталога по режиму закупки.
- **Единственное новое поле, которое реально блокирует T1** = **`match_kind`** (`item|group|raw_context|none`). Без него adapter не отличит `group_only` от `not_verified` детерминированно.
- **Status-enum остаётся в adapter, НЕ в тулзе** → инвариант design.md §5.3 («контракты тулов не менять по сути») сохранён: T5 делает выход тулзы честным и однородным, но НЕ решает binding-семантику.

---

## 1. Натяжение, которое разводим (по коду)

| Источник | Говорит |
|---|---|
| design.md §5.3 | adapter «obaluje `find_urs_code` **bez přepisu**», контракт не менять |
| T5 (INDEX) | дать `find_urs_code` **carrier-shape** + штамп версии |
| Текущий код (`urs.py:73-82`) | `{results:[{code,description,confidence,source}], total_found, query, context}` — нет `status`, нет `catalog_version`, нет `unit` (кроме matcher), `code:"N/A"`+`note` для raw-context |

**Разрешение:** это не конфликт, если разрезать по слоям:
- T5 НЕ добавляет `status` в тулзу (это была бы binding-семантика — она в adapter). T5 добавляет **провенанс** (откуда, какой каталог, какого рода совпадение).
- adapter ЧИТАЕТ провенанс и ВЫВОДИТ `status`. Так design.md §5.1 инвариант («`exact` только для OTSKP DB») держится, и T1 не строит против формы, которую T5 потом переделает.

---

## 2. Целевая форма ответа `find_urs_code` (T5 имплементирует)

**Конверт (паритет с `find_otskp_code` — уже почти совпадает):**
```jsonc
{
  "results": [ <result>, ... ],   // отсортировано по confidence desc
  "total_found": <int>,
  "query": <str>,                 // = description (переименование context-паритет с OTSKP "query")
  "catalog": "urs"                // НОВОЕ: маркер каталога на уровне конверта
}
// ошибка: { "error": <str>, "results": [], "total_found": 0, "catalog": "urs" }
```

**Один `<result>` (поля, NEW = добавить в T5):**
| Поле | Тип | Сейчас | Контракт |
|---|---|---|---|
| `code` | str | ✅ | код или sentinel; НЕ `"N/A"` строкой → см. `match_kind` |
| `description` | str | ✅ | как есть |
| `unit` | str\|null | частично | **всегда** (null если не отдал источник) |
| `unit_price_czk` | float\|null | ❌ | **NEW** — null честно (URS web/matcher часто без цены), не 0 |
| `confidence` | float | ✅ | как есть (0.80–0.85 web, matcher своё) |
| `source` | str | ✅ | `perplexity_urs_search` \| `urs_matcher_service` (провенанс пути) |
| `catalog` | str | ❌ | **NEW** = `"urs"` (паритет с OTSKP-провенансом) |
| `catalog_version` | str\|null | ❌ | **NEW** — реальная версия ЕСЛИ источник отдаёт; иначе **null** (НЕ выдумывать; URS web версию не репортит — честный null) |
| `match_kind` | enum | ❌ | **NEW, КЛЮЧЕВОЕ** — `item` \| `group` \| `raw_context` \| `none` |

> ⚠️ **Связь с Fix 3/T3 (провенанс источника):** OTSKP-сторона штампует `source:"OTSKP 1/2025"` хардкодом — это Fix 3 чинит на реальный `catalog_version`. URS-сторона **не должна повторять ту же ошибку**: `catalog_version` для URS = честный `null`, пока источник не отдаёт версию. Единый принцип: версия — из данных или null, никогда не константа-выдумка.

---

## 3. `match_kind` → status-enum (таблица маппинга adapter, T1)

Это то, ради чего вводится `match_kind`. Adapter (T1) читает `match_kind`+`confidence` и выводит status:

| `match_kind` (от тулзы) | Условие | → `status` (adapter) | Примечание |
|---|---|---|---|
| `item` | конкретный код, conf ≥ floor | **`candidate`** | URS **никогда** не `exact` (design §5.1: exact = только OTSKP DB) |
| `item` | conf < floor | `not_verified` | слабый матч — человек биндит |
| `group` | найдена только skupina/kapitola (prefix) | **`group_only`** | честно «категория, не item» |
| `raw_context` | текущий случай `code:"N/A"`+`note` | **`not_verified`** | сырой контекст, не код |
| `none` | пусто | `not_verified` | нет совпадения |

→ Adapter получает `group_only` vs `not_verified` **детерминированно из `match_kind`**, а не угадывает по строке кода. Это снимает блокер.

---

## 4. Разделение ответственности (чтобы T1 и T5 не наступали друг на друга)

| Слой | Владеет | НЕ трогает |
|---|---|---|
| **T5** `find_urs_code` (тулза) | конверт-паритет, `source`/`catalog`/`catalog_version`/`unit`/`unit_price_czk`/**`match_kind`** | `status` (это adapter), сигнатуру (`description, context` — не менять, MCP compat) |
| **T1** catalog-binding adapter | `status`-enum вывод, выбор каталога по `urs_otskp_routing.yaml`, нормализация в work-атом | внутренности `find_urs_code`, контракт OTSKP |

**MCP-совместимость:** сигнатура `find_urs_code(description, context)` НЕ меняется (design §5.3). Меняется только **форма result-словарей внутри `results[]`** — аддитивно (новые поля), существующие потребители (Portal/URS/Registry/Monolit) не ломаются, если читают по ключам. T5-гейт это проверяет.

---

## 5. Что это даёт T1 прямо сейчас

`_attach_catalog_codes` (`breakdown.py:157`, сейчас ранний `return` для не-OTSKP) в MVP получает ветку:
```
если procurement → ÚRS (по urs_otskp_routing): 
    for atom: res = await find_urs_code(atom.work, context)
              top = res["results"][0] if res["results"] else None
              status = map_status(top.match_kind, top.confidence)   # таблица §3
              atom.code/status/confidence/catalog ← top + status
```
Сигнатуры не тронуты, OTSKP-путь не тронут, status-семантика в adapter. Форма `top` известна заранее (§2) → T1 не переделывает, когда T5 доедет.

---

## 6. Точки ратификации (до кода T1-adapter)

1. **`match_kind` как новое поле тулзы** — ОК? (это единственный реальный must-have от T5 для T1).
2. **`catalog_version` для URS = null честно** (не выдумывать версию web-источника) — ОК?
3. **`status` живёт в adapter, не в тулзе** (design §5.1 инвариант) — подтверждаем?
4. **Floor для URS `candidate`** — переиспользовать OTSKP-floor или отдельный (URS web слабее, 0.80–0.85)? — решить значение.

После «да» по 1–3 (+значение 4) — T1-adapter MVP строится против §2/§3 без риска переделки.

---

## ГЕЙТ. Это контракт, не код. Жду ратификации §6, затем go на T1-adapter MVP.
