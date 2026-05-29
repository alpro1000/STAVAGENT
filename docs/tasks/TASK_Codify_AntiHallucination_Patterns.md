# TASK — Codify anti-hallucination patterns (terasa 762 failure)

## Контекст

Агент пропустил terasa 7-layer skladbu, хотя чертёж ŘEZ C-C был дан ранее.
Claude рекомендовал discard 762 wood по памяти, не перепроверив чертёж.
Результат: terasa = 4 ops с неверным "636311 na terče" вместо 7 ops с деревом
(terče несут ДЕРЕВО prkna+rošt, бетонные dlaždice = roznášecí слой ПОД terče).

Две корневые причины:
1. Чертёж читался как ТЕКСТ (pypdf), не как ИЗОБРАЖЕНИЕ (vision) → графическая
   таблица состава потерялась.
2. Решение о факте (discard 762) принято по ПАМЯТИ, без re-verify source.

## Задача

Закодировать anti-hallucination паттерны в library. Verify против existing
(не дублировать, не раздувать).

## Discovery

Найди docs/STAVAGENT_PATTERNS.md (last_number 38). Прочитай relevant existing:
- Pattern 9 (Re-read TZ Before Generating)
- Pattern 26 (honest, no fabrication)
- Pattern 31 (CEV)
- Pattern 38 (single source)
- любые vision/drawing/source patterns

## Кандидаты (verify каждый честно)

### 1. Source-grounding mandatory
Каждый work item / код / qty ОБЯЗАН иметь _source с конкретной ссылкой на
документ ("ŘEZ C-C terasa skladba", "TZ §4.2", "DXF layer X").
Нет ссылки на документ → item = UNVERIFIED (не VERIFIED).
Превращает галлюцинацию в видимый флаг.
→ likely ENRICHMENT Pattern 26, или NEW (это про provenance enforcement)

### 2. Vision-first for drawings
Skladby / řezy / составы материалов / detaily → ВСЕГДА читать чертёж как
ИЗОБРАЖЕНИЕ (Gemini Vision / Claude vision), text-extract (pypdf) только fallback.
pypdf теряет графические таблицы составов в технических чертежах.
→ likely NEW (это про tool-selection discipline)

### 3. Periodic re-grounding (cross-check checkpoint)
Каждые N items / каждую skladbu / каждые несколько шагов: re-read source
document (vision для чертежей) и сверить. НЕ доверять памяти или предыдущему шагу.
→ likely NEW (это про process checkpoint)

### 4. No memory-based decisions on facts
Claude/agent НЕ принимает решения о фактах (коды, составы, qty, discard) по
ПАМЯТИ. Перед любым изменением факта → re-verify source document.
Reconciliation failure (discard 762) = именно этот anti-pattern.
→ likely ENRICHMENT Pattern 9 (re-read before deciding)

### 5. Host-delegated vision + MCP validation gate
MCP/orchestrator НЕ дублирует возможности хост-чата (vision/search). Хост-чат
(ChatGPT/Claude/Gemini) имеет native vision. MCP ДЕЛЕГИРУЕТ зрение хосту и
ВАЛИДИРУЕТ результат своим детерминизмом.
Принуждение хоста через 4 механизма:
1. Tool schema требует structured fields (layers[] + source) → forces extraction
2. Tool description инструктирует "читай чертёж как изображение" → guides vision
3. Validation gate отклоняет ungrounded (нет source) → forces re-read
4. Cross-ref: MCP парсит TZ детерминированно, сравнивает с host-vision → catches hallucination
MCP не force буквально, но schema+validation делают что хост ВЫНУЖДЕН
сделать vision правильно перед тем как MCP примет данные.
→ likely NEW (про MCP↔host architecture, не покрыто existing)
Origin: "RD Jáchymov — vision = host job не MCP job, MCP оркестрирует+валидирует"

## Honest assessment

Per candidate: NEW / ENRICHMENT #N / ALREADY COVERED #N.
Вероятно: 2-3 NEW (vision-first, periodic re-grounding, host-delegated vision) +
2 enrichments (9, 26). НЕ выдумывать номера для покрытого. НЕ раздувать.

## Apply per library rules

- NEW → add к docs/STAVAGENT_PATTERNS.md (template Problem/Algorithm/Acceptance/
  Anti-pattern/Origin), bump last_number, update rd_jachymov/patterns_validated.md
- ENRICHMENT → subsection "enrichment 2026-05-29 (terasa miss)" в existing pattern
- COVERED → note, не добавлять

Origin для всех: "RD Jáchymov terasa 762 miss — drawing read as text not vision,
memory-based discard during reconciliation, no source-grounding"

## CLAUDE.md
Vision-first + source-grounding — если NEW и blocking-уровня → добавить в mandatory
list. Periodic re-grounding → операционная дисциплина (changelog note).

## STOP gate
- Per candidate verdict (NEW/ENRICHMENT/COVERED)
- Что добавлено (new patterns + enrichments)
- last_number updated
- Sequence validated (no gaps/dups)
- Commit

Začni discovery + verify candidates против existing.
