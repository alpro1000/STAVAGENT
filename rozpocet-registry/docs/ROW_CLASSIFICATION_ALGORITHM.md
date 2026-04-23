# Registry Row Classification Algorithm

**Version:** 1.1
**Date:** 2026-04-23 (v1.1 — column auto-detection rewrite per user feedback 2026-04-23)
**Status:** Specification — ready for implementation

## Changelog

- **v1.1 (2026-04-23)** — Reframed format detection. V1.0 gated classifier on 3 strict format categories (EstiCon / Komplet / RTSROZP) which forced two column-mapping branches. V1.1 replaces this with **universal column auto-detection** (header-text match + content heuristics) that works for any tabular estimate regardless of producer. Producer signatures (EstiCon, Komplet OTSKP, Komplet ÚRS) are reduced to **hints** for column detection. `Typ` column becomes an **optional fast-path** for classification when present. 5 existing templates in `config/templates.ts` become hints, not gates.
- **v1.0 (2026-04-22)** — Initial spec, 3-format detection.

## Purpose

Детерминистический алгоритм определения `rowRole` (main / subordinate / section / unknown) и `parentItemId` при импорте строительных смет в Registry.

Заменяет текущий classifier с багом orphan subordinates (`rowRole='subordinate'` + `parentItemId=null`). Proximity fallback в ItemsTable.tsx (compensation PR) остаётся safety net.

---

## Архитектура (v1.1)

```
Excel upload
    ↓
[1] Column Auto-Detection  ← CORE (универсально для любого producer)
    - Header text match → columnMapping {kod, popis, mj, mnozstvi, cenaJedn, cenaCelkem, typ?}
    - Content heuristics (fallback если header не найден)
    ↓
[2] Row Classification
    - Fast path: если typ column detected → direct marker→role mapping (EstiCon/Komplet markers)
    - Slow path: content heuristics (kod+mj+mnozstvi → main, etc.)
    ↓
[3] Parent Linking (pass over items in source order)
    - tracking currentMainId + currentSectionId
    - zero orphan subordinates после прохода
    ↓
ClassifiedItem[]
```

**Producer signatures** (EstiCon, Komplet OTSKP, Komplet ÚRS) — не отдельные ветки алгоритма. Они становятся **hints** для column detection: "ожидай Typ в col 0 для EstiCon-like, в col 3 для Komplet-like, варианта в col 3 только в EstiCon". Ошибка определения producer'а не ломает classifier — просто может ухудшить accuracy column detection.

---

## §1. Column Auto-Detection

Для каждого sheet'а алгоритм выдаёт `ColumnMapping`:

```typescript
interface ColumnMapping {
  headerRowIndex: number | null;  // null if header not found
  dataStartRow: number;           // first row of actual data
  kod: number | null;             // column index
  popis: number;                  // required — max-length text column
  mj: number | null;
  mnozstvi: number | null;
  cenaJednotkova: number | null;
  cenaCelkem: number | null;
  typ: number | null;             // fast-path trigger
  por: number | null;             // Poř. číslo (EstiCon)
  cenovaSoustava: number | null;
  varianta: number | null;        // EstiCon-only
  detectionConfidence: number;    // 0.0 — 1.0
  detectionSource: 'header-match' | 'content-heuristic' | 'template-hint';
}
```

### Algorithm

```
detectColumns(sheet, templateHint?):
  # Step 1: Find header row (first 200 rows)
  for rowIdx in range(min(200, sheet.rows)):
    row = sheet[rowIdx]
    header_hits = 0
    candidate = {}
    for colIdx, cell in enumerate(row):
      norm = normalize(cell)  # lowercase + strip + remove accents
      if norm in ['kód', 'kod']:
        candidate['kod'] = colIdx; header_hits += 1
      if norm in ['popis', 'název', 'nazev', 'text položky']:
        candidate['popis'] = colIdx; header_hits += 1
      if norm in ['mj', 'm.j.', 'jednotka']:
        candidate['mj'] = colIdx; header_hits += 1
      if norm in ['množství', 'mnozstvi', 'počet']:
        candidate['mnozstvi'] = colIdx; header_hits += 1
      if 'cena' in norm and 'jedn' in norm:
        candidate['cenaJednotkova'] = colIdx; header_hits += 1
      if norm in ['cena celkem', 'celkem']:
        candidate['cenaCelkem'] = colIdx; header_hits += 1
      if norm == 'typ':
        candidate['typ'] = colIdx
      if norm in ['pč', 'poř.', 'poř. číslo', 'poř.číslo', 'por', 'č']:
        candidate['por'] = colIdx
      if norm in ['cenová soustava', 'cs', 'soustava']:
        candidate['cenovaSoustava'] = colIdx
      if norm in ['varianta', 'var']:
        candidate['varianta'] = colIdx

    if header_hits >= 3:
      candidate['headerRowIndex'] = rowIdx
      candidate['dataStartRow'] = rowIdx + 1
      candidate['detectionConfidence'] = min(1.0, 0.5 + 0.1 * header_hits)
      candidate['detectionSource'] = 'header-match'
      return candidate

  # Step 2: Content heuristics (header not found)
  # - Find column with highest % of cells matching OTSKP/ÚRS regex → kod
  # - Find column with longest avg text (non-numeric) → popis
  # - Find column with mostly short strings like "m3", "kus", "t" → mj
  # - Find column with mostly floats < 100000 → mnozstvi (if no cena context)
  # - Content-heuristic cannot detect `typ` column — no fast path for this sheet
  return contentHeuristicMapping(sheet)
```

### Producer hints (optional layer)

Если `templateHint` передан (user picked "otskp" template in wizard), алгоритм префетчит expected header positions:

| Hint | typ | por | kod | popis | mj | mnozstvi | cena jedn | varianta |
|------|-----|-----|-----|-------|------|----------|-----------|----------|
| EstiCon | col 0 | col 1 | col 2 | col 4 | col 5 | col 6 | col 7 | col 3 |
| Komplet (OTSKP/ÚRS) | col 3 | col 2 | col 4 | col 5 | col 6 | col 7 | col 8 | — |
| urs-standard / otskp / rts | — (no typ) | — | col 0 | col 1 | col 2 | col 3 | col 4 | — |
| flexible / svodny | auto-detect | auto | auto | auto | auto | auto | auto | — |

Template hints **ускоряют** detection (позволяют skip header scan), но **не обязательны**. Auto-detection должен работать без них.

### Learning layer (future)

Per-workbook-signature сохранение corrections — user правит detected mapping, сохраняем как `learned_mappings[workbook_sha1]` в localStorage. На следующий import того же файла mapping loads first. **Не входит в scope этого PR**, но ColumnMapping interface должен быть serializable для future feature.

---

## §2. Typ Column — Fast-Path Classification

Если `mapping.typ !== null`, значит какой-то producer поставил явную колонку `Typ` (EstiCon или Komplet). Используем direct marker→role mapping:

```typescript
const TYP_MAP_ESTICON = {
  'SO': 'section',  // Stavba
  'O':  'section',  // Objekt
  'O1': 'section',  // Rozpočet
  'SD': 'section',  // Skupina dílů
  'P':  'main',
  'PP': 'subordinate',  // Popis Podrobný
  'VV': 'subordinate',  // Výpočet Výměry
  'TS': 'subordinate',  // Text Standardní
};

const TYP_MAP_KOMPLET = {
  'D':   'section',      // Díl
  'K':   'main',         // Konstrukce
  'PP':  'subordinate',  // Popis Podrobný
  'PSC': 'subordinate',  // Poznámka k Souboru Cen
  'VV':  'subordinate',  // Výpočet Výměry
};

// Unified map — union of both, no conflicts (markers don't overlap ambiguously)
const TYP_MAP = { ...TYP_MAP_ESTICON, ...TYP_MAP_KOMPLET };
```

```
classifyWithTypColumn(row, mapping):
  typVal = normalize(row[mapping.typ])  # uppercase + strip
  role = TYP_MAP[typVal]  # undefined if unknown marker
  return {
    rowRole: role || 'unknown',
    classificationConfidence: role ? 1.0 : 0.0,
    classificationSource: 'typ-column',
    originalTyp: typVal,
  }
```

Confidence: 1.0 когда marker распознан, 0.0 когда не распознан (downgrade to unknown).

---

## §3. Content-Heuristic Classification (fallback)

Если `mapping.typ === null`, используем content rules:

```
classifyByContent(row, mapping):
  kod = row[mapping.kod] if mapping.kod else null
  popis = row[mapping.popis] if mapping.popis else ''
  mj = row[mapping.mj] if mapping.mj else null
  mnozstvi = row[mapping.mnozstvi] if mapping.mnozstvi else null

  kodEmpty = isBlank(kod)
  mjEmpty = isBlank(mj)
  mnozstviEmpty = (mnozstvi === null) or (mnozstvi === 0)
  popisEmpty = isBlank(popis)

  # Rule 1: section heuristic
  if !kodEmpty and /^[0-9]{1,2}$/.test(String(kod).trim()):
    return { rowRole: 'section', confidence: 0.9, source: 'content-heuristic' }
  if !popisEmpty and mjEmpty and mnozstviEmpty and isSectionKeyword(popis):
    return { rowRole: 'section', confidence: 0.85, source: 'content-heuristic' }

  # Rule 2: main heuristic
  if !kodEmpty and !mjEmpty and !mnozstviEmpty:
    if isValidOtskpCode(kod) or isValidUrsCode(kod) or isCustomCode(kod):
      return { rowRole: 'main', confidence: 0.9, source: 'content-heuristic' }

  # Rule 3: subordinate
  if !popisEmpty:
    return { rowRole: 'subordinate', confidence: 0.7, source: 'content-heuristic' }

  # Rule 4: empty / garbage
  return { rowRole: 'unknown', confidence: 1.0, source: 'content-heuristic' }
```

### Code validation helpers

```
isValidOtskpCode(code):  /^[0-9]{5,6}(\.[a-z]+)?$/.test(code.trim())
isValidUrsCode(code):    /^[0-9]{9}$/.test(code.trim())
isCustomCode(code):      /^[A-Z0-9]{3,}$/.test(code.trim()) and !/^[0-9]{1,2}$/.test(code.trim())
isSectionKeyword(popis):
  # Hardcoded CZ section vocabulary
  const KEYWORDS = [
    'zemní práce', 'zakládání', 'svislé konstrukce', 'vodorovné konstrukce',
    'úpravy povrchů', 'podlahy', 'komunikace', 'ostatní konstrukce',
    'bourání', 'přesun hmot', 'izolace', 'všeobecné konstrukce',
    'instalace', 'konstrukce tesařské', 'konstrukce zámečnické',
  ]
  normalized = normalize(popis)  # lowercase + strip accents
  return KEYWORDS.some(kw => normalized.startsWith(kw))
```

---

## §4. Parent Linking

Unchanged from v1.0. Full pseudocode in §7 below.

---

## §5. Валидация кодов

Same helpers as §3, also used by column detection (content heuristics).

---

## §6. Edge Cases

Same 10 edge cases as v1.0:

1. Orphan subordinate в начале файла → downgrade to `unknown` + warning
2. Section-row внутри цепочки → reset currentMainId
3. Два main подряд без subordinates — ok
4. Numbered prefix в section popis (`"0 - Všeobecné..."`)
5. MJ разный регистр — normalize `str.lower().strip()`
6. Množství как строка — try/except float parse
7. `#REF!` → None
8. Пустые rows — skip
9. Poř. int vs str — normalize
10. Mixed Cenová soustava — save per-item

Additional edge case for v1.1:

11. **Column detection returns incomplete mapping** (e.g. mnozstvi not found but kod+popis yes). Behavior: classify with what's available, items missing required fields get `rowRole='unknown'` with warning.
12. **Typ column has unknown marker** (e.g. user's custom "PZ" not in TYP_MAP). Behavior: classifyByContent fallback for that row, confidence 0.7.
13. **Multiple sheets in workbook have different column layouts**. Behavior: `detectColumns` runs per-sheet, each sheet has independent mapping.

---

## §7. Parent Linking — Full Pseudocode

Unchanged from v1.0:

```python
def assign_parent_links(items: list[RawItem]) -> list[ClassifiedItem]:
    current_main_id = None
    current_section_id = None
    result = []

    for raw in items:
        item = classify(raw)

        if item.rowRole == 'section':
            current_section_id = item.id
            current_main_id = None
            item.parentItemId = None
            item.sectionId = None

        elif item.rowRole == 'main':
            item.parentItemId = None
            item.sectionId = current_section_id
            current_main_id = item.id

        elif item.rowRole == 'subordinate':
            item.parentItemId = current_main_id
            item.sectionId = current_section_id
            if current_main_id is None:
                log_warning(f"Orphan subordinate at row {raw.source_row_index}")
                item.rowRole = 'unknown'

        else:  # unknown
            item.parentItemId = None
            item.sectionId = current_section_id

        result.append(item)

    return result
```

---

## §8. Normalized Item Model

Same TypeScript interface as v1.0:

```typescript
interface ClassifiedItem {
  id: string;
  source_row_index: number;
  source_sheet_name: string;
  source_format: 'EstiCon' | 'Komplet' | 'RTSROZP' | null;  // v1.1: advisory/informational
  rowRole: 'section' | 'main' | 'subordinate' | 'unknown';
  parentItemId: string | null;
  sectionId: string | null;
  por: number | null;
  kod: string | null;
  popis: string;
  mj: string | null;
  mnozstvi: number | null;
  cenaJednotkova: number | null;
  cenaCelkem: number | null;
  cenovaSoustava: string | null;
  originalTyp: string | null;
  varianta: string | null;
  classificationConfidence: number;
  classificationSource: 'typ-column' | 'content-heuristic' | 'ai-fallback';
}
```

`source_format` теперь nullable — остаётся как informational hint (e.g. "detected Komplet-like layout"), но не ветвит логику.

---

## §9. Совместимость с текущим кодом Registry

- `rowRole` values (`'main' | 'subordinate' | 'section' | 'unknown'`) — **не меняем**, только алгоритм их установки.
- `parentItemId` — после fix всегда заполнено для subordinate (zero orphans on fresh imports).
- Proximity fallback в `ItemsTable.tsx:effectiveParentMap` — остаётся как safety net для **legacy items** в IndexedDB (imported до этого rewrite).
- 5 existing templates в `config/templates.ts` становятся **hints** для column auto-detection, не gates.

---

## §10. Task для Claude Code

Использовать этот документ как спецификацию. Реализация в отдельном PR после merge compensation PR. Файл: `TASK_ClassifierRewrite.md`.
