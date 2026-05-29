# STAVAGENT — MCP Autonomy Roadmap (v2)
### Может ли MCP-сервер сам оценить проект и составить список работ?

**Дата:** 2026-05-29 (v2 — host-delegated vision architecture)
**Контекст:** RD Jáchymov pilot. Terasa 762 miss выявил корневые причины
(vision, source-grounding). Alexander уточнил ключевую архитектуру: **зрение
делегируется хост-чату, не строится в MCP**.

---

## 0. Ключевое архитектурное уточнение (v2)

**v1 ошибка:** "MCP строит свой Gemini Vision pipeline."
**v2 правильно:** Хост-чат (ChatGPT/Claude/Gemini) УЖЕ имеет native vision.
MCP connector встроен в хост. Значит MCP **делегирует** зрение хосту и
**валидирует** результат своим детерминизмом.

```
ХОСТ-ЧАТ (ChatGPT / Claude / Gemini)
  = vision + reasoning (читает чертежи native зрением хоста)
        ↕ MCP connector (tools + schema + validation)
MCP SERVER
  = детерминизм (parse / validate / OTSKP / calculator / anchor / source-grounding)
  + ОРКЕСТРАТОР: заставляет хост делать vision правильно
  + STRICT VALIDATOR: отклоняет ungrounded, cross-ref против TZ
```

Преимущества host-delegation:
- **Дешевле** — vision хоста бесплатно (юзер уже платит за свой чат)
- **Model-agnostic** — работает с любым хостом (GPT-4o / Claude / Gemini)
- **Лучший vision** — тот что у юзера в чате, не отдельный Flash вызов
- **MCP остаётся детерминированным** — его сила, не дублирует зрение

---

## 1. Честный вердикт

**MCP сам справится с системной частью (80%)**: parse → validate → match →
anchor gaps → calculator → export. Это детерминизм + оркестрация хост-vision.

**Остальные 20%** (final leaf binding при paywalled каталоге + resolve противоречий
проекта + scope decisions) = human/Karel. **MCP = co-pilot, не autopilot.**

Vision НЕ блокер autonomy — его делает хост. Блокер = paywalled каталог + scope
решения, которые требуют человека по определению.

---

## 2. Что MCP УЖЕ умеет (детерминизм)

| Способность | Status | Confidence |
|---|---|---|
| Parse rozpočet/soupis (xlsx/pdf razítko) | ✅ production | regex=1.0 |
| OTSKP code match (DB 17904) | ✅ production | DB=1.0 |
| 7-engine calculator (manual params) | ✅ production | deterministic |
| Schema validation (Pydantic) | ✅ production | 1.0 |
| Concrete grade regex, element classification | ✅ production | regex=1.0 |

---

## 3. Как MCP "заставляет" хост делать vision (4 механизма принуждения)

MCP не может буквально force хост. Но жёстко направляет через 4 механизма:

### Механизм 1 — Tool schema требует структуру (forces extraction)
```
Tool: submit_skladba
Required input: layers[] = [{name, thickness, material, source}]
→ Хост НЕ может вызвать с пустыми layers → обязан сначала прочитать чертёж
```

### Механизм 2 — Tool description инструктирует (guides vision)
```
Description: "Сначала прочитай чертёж КАК ИЗОБРАЖЕНИЕ (не текст). Извлеки все
слои skladby сверху вниз: название, толщина, материал. Потом submit с layers."
→ Хост видит инструкцию → использует native vision
```

### Механизм 3 — Validation gate отклоняет ungrounded (forces re-read)
```
MCP validates submit_skladba:
- source отсутствует → REJECT "укажи откуда (напр. ŘEZ C-C)"
- layers неполные/подозрительные → REJECT "перечитай чертёж"
→ Хост вынужден перечитать правильно
```

### Механизм 4 — Cross-ref детерминированная проверка (catches hallucination)
```
MCP парсит TZ текст детерминированно (regex/parse).
Сравнивает с тем что хост извлёк vision из чертежа:
- TZ упоминает "terasa skladba" + хост дал 7 слоёв → MATCH, conf 0.85
- Mismatch (TZ говорит 5 слоёв, хост дал 3) → FLAG для human
→ MCP ловит галлюцинацию хоста через свой детерминизм
```

**Итог:** MCP делает vision хоста НАДЁЖНЕЕ через validation, но не 100%.
Critical skladby с conf <0.85 → flag для human verify.

---

## 4. Пример flow — terasa была бы поймана

```
1. User в ChatGPT (STAVAGENT connector): "оцени RD Jáchymov, составь список работ"
   (загрузил PDF включая ŘEZ C-C)

2. MCP start_evaluation → инструкция хосту:
   "Прочитай все řezy/skladby КАК ИЗОБРАЖЕНИЯ. Per skladba → submit_skladba
   с layers[] + source."

3. ХОСТ (ChatGPT vision) читает ŘEZ C-C → видит terasa 7 слоёв →
   submit_skladba("terasa", [prkna 25 wood, rošt 50 wood, terče 50, dlaždice 50,
   štěrk 100, podsyp 150, geotext], source="ŘEZ C-C")

4. MCP validate:
   - source есть ✓
   - cross-ref TZ: упоминает terasa skladba? → MATCH → conf 0.85
   - 7 layers complete ✓ → ACCEPT

5. MCP детерминированно: decompose → 7 atomic ops, família (762 wood + 564 + 693),
   anchor checklist, source-grounding stamp → list
```

**Дерево (762) было бы поймано** — хост-vision прочитал бы "terasová dřevěná prkna",
MCP validation потребовал source + cross-ref TZ. Ошибка terasa miss не повторилась бы.

---

## 5. Confidence ladder (v2 — с host-delegation)

| Источник | Confidence | Кто решает |
|---|--:|---|
| regex / OTSKP DB | 1.0 | MCP auto |
| host-vision + TZ + DXF match | 0.95 | MCP auto |
| host-vision + TZ cross-ref match | 0.85 | MCP auto |
| anchor checklist gap (rule) | 0.85 | MCP auto-flag |
| host-vision alone (no TZ confirm) | 0.6 | MCP → human verify |
| paywalled code | blank | human/Karel binds |
| no source | UNVERIFIED | human verify |

**Правило:** conf ≥0.85 → MCP auto. <0.85 → flag human. Никогда не fabricate.

---

## 6. 5 механизмов к autonomy (v2 приоритеты)

| # | Механизм | Priority | Усилие | Кто делает vision |
|---|---|---|--:|---|
| 1 | Source-grounding enforcement | P0 | ~20h | — (validation rule) |
| 2 | Honest blank (есть) | P0 | done | — (Pattern 26) |
| 3 | **Host-delegated vision (tool design)** | P1 | **~25h** | ХОСТ (не MCP!) |
| 4 | Anchor checklist KB | P1 | ~40h | — (rule-based) |
| 5 | Periodic re-grounding | P1 | ~25h | — (checkpoint) |

**Изменение vs v1:** Vision pipeline было ~60h (MCP строит Gemini Vision).
Теперь ~25h (MCP design tools для host-delegation). **Дешевле + лучше.**

---

## 7. Честная граница MCP autonomy (v2)

```
MCP МОЖЕТ сам (autopilot, 80%):
✅ Parse → validate → OTSKP/regex match → calculator → export
✅ Оркестрировать host-vision (tool schema + description + validation + cross-ref)
✅ Anchor checklist gap detection (rule-based)
✅ Source-grounding enforcement
✅ Honest blank для paywalled

MCP НЕ может сам (human verify, 20%):
⚠ Critical skladby где host-vision conf <0.85 (TZ не подтверждает)
⚠ Финальный leaf binding когда каталог paywalled
⚠ Resolve противоречий проекта (multisplit vs radiátory)
⚠ Scope decisions (что в TZ vs investor)

ВЫВОД: Vision больше НЕ блокер (делает хост). Блокеры autonomy =
paywalled каталог + scope/conflict решения, которые требуют человека
по определению, не из-за слабости технологии.
```

---

## 8. Прямой ответ Alexander (v2)

> "Справится ли MCP сам составить список работ?"

**Чистый rozpočet/soupis** (структурированный вход): да, уже близко.

**DSP-документация с чертежами** (как RD Jáchymov): **да на ~80%** —
host-vision читает skladby, MCP валидирует + детерминирует. Остаётся human для
critical skladeb (conf <0.85) + leaf binding (paywalled) + scope.

**Vision решён архитектурно** — это работа хоста, MCP оркестрирует.

> "Орк/MCP должен знать как заставить встроенные инструменты чатов работать?"

**Да — через 4 механизма:** tool schema (required structured fields) + tool
description (инструкция читать как изображение) + validation gate (reject
ungrounded) + cross-ref (MCP детерминированно проверяет host-extraction против TZ).

MCP не force буквально, но schema+validation делают так, что хост ВЫНУЖДЕН
сделать vision правильно перед тем как MCP примет данные.

---

## 9. Позиционирование = moat

"AI co-pilot который доводит проект от tender до execution planning. Host-vision
читает чертежи, детерминированный engine валидирует + считает + находит пропуски.
Estimator finiширует critical decisions + leaf binding."

Moat:
- Не autopilot-обещание (vision на чертежах всегда conf <1.0)
- Honest co-pilot который реально экономит 80% времени
- Model-agnostic (любой хост-чат)
- Детерминированный backbone (regex/OTSKP/calculator) = не воспроизводимо конкурентами
  без Czech catalog encoding

---

## 10. Приоритет реализации

**Старт P0:** Source-grounding enforcement (~20h) — каждый item требует _source,
нет → UNVERIFIED. Дёшево, делает галлюцинацию видимой.

**Потом P1:** Host-delegated vision tool design (~25h) — submit_skladba schema +
description + validation + cross-ref TZ. Решает terasa-класс проблем.

**Потом P1:** Anchor checklist KB (~40h) — implicit works auto-detection.
