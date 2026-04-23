# TASK: Registry Row Classifier Rewrite

## Мантра

> Сначала читаешь ROW_CLASSIFICATION_ALGORITHM.md (будет приложен к таску).
> Потом читаешь существующий classifier код в репо, понимаешь что там сейчас.
> Затем пишешь новую реализацию по спецификации. Тесты обязательны.
> Наклейка на импортер не допускает потери данных — все fields сохраняются.

## PRE-IMPLEMENTATION INTERVIEW

Перед началом задай через AskUserQuestion:

1. Где сейчас живёт классификация — в Registry frontend (TS), в Core Engine backend (Python), или в обоих? Найди по коду конкретные файлы и подтверди.

2. Когда classification происходит — при Excel import (один раз) или per-view (каждый раз когда таблица рендерится)? Это влияет на где fix: один раз при parsing или на runtime каждый раз.

3. Есть ли уже какой-то format detection — например user explicitly выбирает "Komplet" или "EstiCon" при импорте через UI dropdown? Или всё auto-detect? Нужно для понимания UX flow.

## Context

STAVAGENT — SaaS платформа для строительных смет. Registry (rozpocet-registry) импортирует Excel-файлы трёх форматов:

- **EstiCon** (Czech BIM software export) — явная колонка `Typ` с SD/P/PP/VV/TS
- **Komplet** (Export Komplet, OTSKP / ÚRS) — колонка `Typ` с D/K/PP/PSC/VV
- **RTSROZP / custom** — без явной `Typ`, нужны content-based heuristics

Текущий classifier имеет bug: для некоторых subordinate rows устанавливает `rowRole='subordinate'` но оставляет `parentItemId=null`. Это ломает chevron / expand-collapse в UI.

Compensation PR (already merged) добавил proximity fallback в `ItemsTable.tsx:effectiveParentMap` как safety net. Этот fallback вычисляет effective parent по source order если `parentItemId=null`. Работает, но это симптоматическое лечение.

**Proper fix** — переписать classifier так чтобы `parentItemId` **всегда** был правильно установлен при импорте. После этого proximity fallback в ItemsTable станет избыточным (но не harmful — оставляем).

## Business logic — что должно произойти

### 1. Прочитать спецификацию

Спецификация: `ROW_CLASSIFICATION_ALGORITHM.md` (будет приложен).

Содержит:
- Format detection rules (EstiCon / Komplet / RTSROZP)
- Column mapping per format
- Classification rules per format (Typ column → rowRole)
- Parent linking pseudocode
- 10 edge cases с expected behavior
- Normalized Item Model (TypeScript interface)

**Не отклоняйся от спецификации.** Если обнаружишь что-то не покрытое — добавь в next-session.md, не изобретай новую логику.

### 2. Найти и прочитать текущий classifier code

Вероятные места:
- `rozpocet-registry/src/services/rowClassificationService.ts`
- `rozpocet-registry/src/parsers/**` — Excel parsers
- `rozpocet-registry/src/stores/**` — если classification в store
- Core Engine (Python) — если classification на backend

Зафиксируй текущий state в PR description: какие файлы трогаются, какие остаются.

### 3. Реализовать format detection

Function `detectFormat(workbook: Workbook): 'EstiCon' | 'Komplet' | 'RTSROZP'`.

Логика из спецификации. Тест на 3 приложенных файлах должен возвращать:
- `TEST__ROZPOČET__D6_202.xlsx` → 'EstiCon'
- `011-26_I-26_Kyšice.xlsx` → 'Komplet'
- `IO01_ZTV_Veselí.xlsx` → 'Komplet'

Если появится четвёртый формат в будущем — добавляется новая ветка в detection, без breaking changes.

### 4. Реализовать три classifier'а

Per format:
- `classifyEsticon(row)` — direct mapping из колонки Typ
- `classifyKomplet(row)` — direct mapping из колонки Typ
- `classifyRtsrozp(row, columnMapping)` — content-based heuristics

Каждый возвращает `rowRole` для отдельной row. Confidence — `'typ-column'=1.0`, `'content-heuristic'=0.85`.

### 5. Реализовать parent linking

Function `assignParentLinks(items: RawItem[]): ClassifiedItem[]`.

Псевдокод из спецификации. State tracking `currentMainId` и `currentSectionId` при итерации по source order.

Обработать все 10 edge cases из спецификации:
1. Orphan subordinate в начале файла → downgrade to 'unknown' + warning log
2. Section-row reset current_main_id
3. Два main подряд без subordinates — ok
4. Numbered prefix в section popis
5. MJ разный регистр — normalize
6. Množství как строка — try parse
7. #REF! → None
8. Пустые rows — skip
9. Poř. int vs str — normalize
10. Mixed Cenová soustava — сохранить per-item

### 6. Column mapping

Для EstiCon и Komplet — fixed indices по спецификации.

Для RTSROZP — implement header-based detection:
- Найти row содержащий keywords 'Kód', 'Popis', 'MJ', 'Množství', 'Cena'
- Запомнить column indices
- Если не найден header — fallback to content-based detection (OTSKP regex в колонке, max-length column = popis)

### 7. Обновить ClassifiedItem model

Используй TypeScript interface из спецификации:

```typescript
interface ClassifiedItem {
  id: string;
  source_row_index: number;
  source_sheet_name: string;
  source_format: 'EstiCon' | 'Komplet' | 'RTSROZP';
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

Если существующий Item model отличается — **не ломай его**. Добавь новые поля optional через миграцию. `source_format`, `source_row_index`, `originalTyp`, `classificationConfidence`, `classificationSource` — новые, прошлые сохранены.

### 8. Тесты

Обязательные unit tests в `rozpocet-registry/src/services/__tests__/rowClassification.test.ts`:

```typescript
describe('rowClassification', () => {
  describe('format detection', () => {
    test('EstiCon — detects by Typ column A', () => { ... });
    test('Komplet — detects by PČ|Typ|Kód header', () => { ... });
    test('RTSROZP — fallback when no Typ column', () => { ... });
  });

  describe('EstiCon classification', () => {
    test('SD → section', () => { ... });
    test('P → main, parentItemId null', () => { ... });
    test('PP/VV/TS → subordinate, parentItemId = last P', () => { ... });
    test('section resets currentMainId', () => { ... });
  });

  describe('Komplet classification', () => {
    test('D → section', () => { ... });
    test('K → main', () => { ... });
    test('PP/PSC/VV → subordinate with correct parent', () => { ... });
  });

  describe('RTSROZP content heuristics', () => {
    test('short kod (1-2 digits) → section', () => { ... });
    test('kod + mj + mnozstvi → main', () => { ... });
    test('only popis → subordinate', () => { ... });
  });

  describe('edge cases', () => {
    test('orphan subordinate downgrades to unknown', () => { ... });
    test('section-row resets parent chain', () => { ... });
    test('MJ normalization M3 vs m3', () => { ... });
    test('#REF! handled as None', () => { ... });
    test('empty rows skipped', () => { ... });
  });

  describe('integration with real files', () => {
    test('EstiCon D6_202 file produces expected structure', () => {
      // Load TEST__ROZPOČET__D6_202.xlsx
      // Assert: 4 sections, 44 mains, 194 subordinates (44 PP + 107 VV + 43 TS)
      // Assert: every subordinate has parentItemId set
    });

    test('Komplet Kyšice file produces expected structure', () => {
      // Load 011-26_I-26_Kyšice sheet '101 - Oprava vozovky'
      // Assert: all K rows have parentItemId null
      // Assert: all PP/PSC/VV rows have parentItemId = last K
    });
  });
});
```

Fixtures — маленькие reduced Excel examples в `__fixtures__/` folder. Не push реальные клиентские данные.

## Acceptance criteria

1. `detectFormat()` возвращает правильный format на 3 приложенных файлах
2. `classifyEsticon/Komplet/Rtsrozp()` правильно устанавливают rowRole
3. `assignParentLinks()` устанавливает parentItemId для всех subordinates — **zero orphans** после import
4. Все 10 edge cases покрыты unit tests
5. Integration tests на 3 real files проходят
6. `npm run build` clean
7. Proximity fallback в ItemsTable.tsx остаётся нетронутым (safety net)
8. PR description содержит:
   - Ссылки на ROW_CLASSIFICATION_ALGORITHM.md
   - Список файлов изменённых
   - Before/after metrics: сколько orphan subordinates было на test files, сколько после
   - Screenshots (если applicable) Registry UI с правильно работающим chevron на test files
9. Backward compat: существующие импортированные данные (в IndexedDB/Zustand state) продолжают работать, не требуют re-import

## Что НЕ входит в этот таск

- UI changes — только classifier logic
- Format detection UI (dropdown let user override detected format) — отдельный таск
- Custom format support beyond EstiCon/Komplet/RTSROZP — отдельный таск
- AI fallback для unparseable rows — отдельный таск (uses Claude Sonnet для edge cases)
- Migration of existing data в IndexedDB — data остаётся как была, новый алгоритм применяется только к новым import
- Removing proximity fallback в ItemsTable — оставляем как safety net
- Fix PR 3/4/5 (Detail panel, BulkActionsBar, Click-edit) — эти PR запускаются параллельно, зависимости нет

## Процесс

1. git checkout main && git pull (должен содержать compensation PR merged)
2. Создай ветку: `fix/row-classifier-rewrite`
3. Прочитай приложенный `ROW_CLASSIFICATION_ALGORITHM.md` полностью
4. Прочитай существующий classifier code, зафиксируй current behavior
5. Реализуй format detection → 3 classifier → parent linking → tests
6. Коммиты атомарные минимум 5:
   - Add ClassifiedItem interface + type definitions
   - Implement format detection
   - Implement EstiCon classifier
   - Implement Komplet classifier
   - Implement RTSROZP content heuristics
   - Implement assignParentLinks with edge cases
   - Add unit tests for each classifier
   - Add integration tests on real files
7. npm run build clean, all tests pass
8. Push, open PR against main
9. В PR description — all acceptance criteria checklist
10. Request Vercel preview
11. Wait for user review — не merge сам

---

**Naming и структуру файлов определяй по существующим конвенциям.
Главный источник истины — ROW_CLASSIFICATION_ALGORITHM.md.
Не изобретай новую логику — реализуй спецификацию.**
