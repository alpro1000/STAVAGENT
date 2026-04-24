# Next session — out-of-scope findings

Следующие пункты обнаружены во время аудита Registry flat layout (ветка `claude/audit-registry-flat-layout-cu8oA`, документ `AUDIT_Registry_FlatLayout.md`) и **НЕ входят в scope текущего аудита**. Требуют отдельных тасков с собственными audit / design / implementation циклами.

---

## 1. Document-navigation уровень (Conflicts § 3.4)

Конфликты выше row-level и skupina-level не адресованы Variant B (§ 4.3.10 п. 4).

- **Sheet tabs strip** между skupinами / проектами в `App.tsx:1187-1263` — `whitespace-nowrap` + counter `(N položek)` на каждой вкладке → горизонтальный overflow на mobile 375 px, навигационные кнопки `«« « » »»` занимают место и не показывают активный таб без скролла (§ 3.1 подробно).
- **Floating "корзина"** (BulkActionsBar из live-кейса пользователя — решается частично в PR 4 Rollout, но полная переработка floating geometry остаётся issue).
- **Floating "папка"** (скорее всего `FolderOpen`-trigger для ImportModal или project-level навигация — требует уточнения по скриншотам пользователя).
- **Navigator Stavba_Prodejna** — частный случай sheet tabs.
- **Взаимодействие этих панелей с bulk bar и detail panel на mobile** — z-index collision'ы, одновременное появление на одном экране.

**Почему out-of-scope текущего аудита**: task spec зафиксировал покрытие "skupiny + položky" — row-level и skupina-level. Document-level UX требует отдельного аудита с другим inventory scope (`App.tsx`, `<ProjectHeader>`, `<PortalLinkBadge>`, `<ImportModal>`, Navigator pattern Excel-like vs drawer vs tree).

**Рекомендуемый следующий шаг**: отдельная сессия "audit Registry document navigation" с фокусом на § 1.5 + § 1.6 элементы из текущего Inventory + screenshot walkthrough от пользователя с конкретными проблемными случаями.

---

## 2. Каталожная цена (OTSKP / ÚRS price comparison)

Новая функция, упомянутая в § 5.2.4 Recommendation как пример расширяемости Variant B — архитектура Variant B её поддерживает без структурных изменений, но **сам функционал требует отдельного таска**.

Scope нового таска:

- **Display-cells в row-level**: `cena jedn. katalog` (реф. цена из OTSKP / ÚRS каталога) + возможный `celkem katalog` + `odchylka %` или `odchylka Kč`. Решить — все три или только одна ячейка с комбинированным представлением.
- **Цветовая индикация variance**: паттерн `components/flat/FlatPositionsTable.tsx:489-491` из Part A — `color: 'var(--red-500)'` при `Výpočet > Katalog` (перерасход), `'var(--green-500)'` при ≤. Пороги нужно явно зафиксировать: > 0 % сразу красный или только после 5 % / 10 %?
- **3-уровневый apply**:
  - **Single** — в detail panel (§ 4.3.5) inline-поле "Cena jedn. katalog: 3 150,00 Kč · Odchylka: +2,9 %" + кнопка `[ Použít katalog. cenu → ]`.
  - **Bulk (filtered)** — новая кнопка в BulkActionsBar по шаблону существующего `Tag` → dropdown "Převést na katalogové ceny".
  - **All-document (filtered by category)** — новая кнопка в document-level toolbar "Aplikovat katalog na celý rozpočet" с фильтром по OTSKP / ÚRS и confirm dialog.
- **Edge cases**:
  - Позиция не имеет каталожного соответствия (невалидный / отсутствующий kod) — скрывать cell или показывать "—"?
  - Несколько каталожных цен для одного kod (старая vs новая редакция OTSKP) — какая версия priority?
  - Устаревший / impropoртированный каталог — показывать warning badge.
  - ÚRS vs OTSKP разные базы — указывать каталог в tooltip или рядом с ценой?
- **Preview отчёта** "Применено к N из M позиций" после bulk / all-document action — где отображать (modal / toast / в BulkActionsBar).

**Зависит от**: точности классификатора (п. 3 ниже) — apply-логика требует корректного `detectCatalog()` для filter'а "только OTSKP" / "только ÚRS".

---

## 3. Классификатор точность (false positives + false negatives)

В ходе сессии упомянуто: классификатор `detectCatalog()` в `src/utils/position-linking.ts` иногда:

- активирует интерфейс "Rozpočítat / бетонные работы" на не-бетонных позициях (false positive),
- и наоборот — не активирует на бетонных позициях (false negative).

Scope нового таска:

- Собрать **10–20 реальных примеров** из production Registry, где классификатор ошибся (нужен вход от пользователя — конкретные kod + popis + ожидаемая vs фактическая классификация).
- Определить **паттерн ошибки**: regex-miss, OTSKP keyword-miss, AI fallback ошибся, negative-context (стávajíci, odstranění) не отсёкся.
- Добавить **golden-тесты** на эти 10–20 кейсов в `test-data/` (если уже есть) или создать `test-data/classifier-golden.json`.
- **Fix по обнаруженному паттерну**: расширение regex / keyword-list / negative-context / threshold confidence'ов.

**Блокирующая для**: п. 2 (каталожная цена), п. 4 (фильтр на импорт в Monolit).

---

## 4. Стратегическое решение — множественные калькуляторы (Monolit / Pump / Formwork)

Обсуждалось в сессии: Monolit Planner получает **все** позиции из Registry, не только бетонные (current импорт pipeline). Это создаёт шум в Planner — 80 % позиций несоотносимы с бетонными расчётами.

**Принято решение — Путь 3**: фильтр на импорт "только бетонные позиции" (по результатам классификатора).

Scope нового таска:

- **Фильтр на выгрузке из Registry в Monolit Planner**: в `src/services/monolitExport.ts` (если существует — уточнить путь) или в backend-endpoint, который Monolit дёргает. Фильтр по `detectCatalog() === 'beton'` или аналогичному domain-specific predicate.
- **UI-переключатель**: "Exportovat všechny / jen betonové" — default ON для бетонных.
- **Backward compat**: существующие проекты, уже заимпортированные в Monolit с full-import'ом — мигрировать или оставить, требует решения.
- **Симметричная логика для URS Matcher / Rozpocet / других будущих киосков** — фильтр по category должен быть generic, не hardcode на beton.

**Зависит от**: точности классификатора (п. 3) — фильтр ломается при high false-negative rate (бетонные позиции не попадут в Monolit). Рекомендуется — сначала fix п. 3, потом имплементировать п. 4.

---

## Приоритизация

Если сессии ограничены по времени, рекомендуемый порядок:

1. **П. 3** (классификатор) — блокирующий для двух других.
2. **П. 4** (фильтр импорта в Monolit) — дешёвая победа после п. 3, решает production pain.
3. **П. 2** (каталожная цена) — новая feature, требует product-design обсуждения.
4. **П. 1** (document navigation) — UX improvement, важно, но не блокирует бизнес-логику.

Каждый пункт — отдельная сессия с собственным audit / design / implementation циклом, чтобы не раздувать scope одной ветки.

---

## 5. `text-text-muted` — undefined Tailwind class (~50 uses)

Обнаружено при диагностике cross-browser chevron'а. Класс `text-text-muted` используется в ~50 местах (`App.tsx`, `ItemsTable.tsx`, и другие), но **не определён** — нет ни записи в `tailwind.config.js`, ни hand-written `.text-text-muted` rule в `index.css` / `tokens.css`. Tailwind JIT не генерирует CSS для этого класса; он молчаливо игнорируется во всех браузерах. Color падает на `inherit` от родителя (обычно `.table td { color: var(--flat-text) }` = stone-900, работает), но класс бесполезен.

Scope cleanup-таска:

- **Grep по `text-text-muted`** → полный список 50+ мест.
- **Решение** (один из вариантов):
  - (a) Заменить на работающий эквивалент `text-[var(--text-muted)]` или `text-stone-500` (если введён stone-палитра в Tailwind config). Семантически точнее — использует задуманный "muted" оттенок.
  - (b) Удалить класс полностью, положиться на `color` инheritance от родителя. Быстрее, меньше шума в JSX.
  - (c) Добавить `.text-text-muted { color: var(--text-muted); }` в `@layer utilities`. Делает существующий код работающим без правок JSX.
- **Рекомендация — вариант (c)** если хочется сохранить "muted" оттенок в `Poř.` столбце, или **(a)** если начинаем миграцию на именованные stone-тон'ы. Вариант (b) теряет семантику.

**Не блокирует**: ничего — JSX работает, просто игнорируется класс. Но накапливает tech-debt и путает читающего код (выглядит как именованная Tailwind utility, которой нет).

---

## 6. PR 990 — cross-browser icons — Safari/Firefox validation pending

`fix/registry-icons-cross-browser` (PR #990) применил `w-[Npx] h-[Npx]` пары ко всем 19 lucide иконкам в `ItemsTable.tsx` + `RowActionsCell.tsx`. Root cause зафиксирован: lucide emit'ит SVG width/height как HTML-атрибуты, Safari/Firefox collapse flex-basis до 0 в virtualized row'е.

**Ждёт подтверждения на Vercel preview**:

- Chevron виден в main-row с `subCount > 0` в Safari + Firefox.
- Row ordinal number (`Poř.`) виден рядом с chevron.
- Role indicators (ClipboardList / FileText / CircleHelp) видны в actions-колонке.

**Conditional follow-ups (применить ТОЛЬКО если preview покажет что проблема не решена)**:

- **Step 2 — ordinal number clipping.** Если после фикса chevron'а номер всё ещё не виден — проблема в `Poř.` колонке: `size: 50` + overflow при переполнении контента `<button>` (chevron 11 + gap 2 + "001" ~22 + gap 2 + "+3" ~16 = 53px ≥ 50px). Решение: увеличить `size: 50 → 60` в `ItemsTable.tsx:592`, или перенести counter `+N` в отдельную колонку, или убрать counter на mobile.
- **Step 3 — `↳` character (`U+21B3`).** Если subordinate индикатор не виден — проверить font-fallback; не все sans-serif font'ы содержат глиф U+21B3. Решение: обернуть в `<span style={{ fontFamily: '"Apple Symbols","Segoe UI Symbol","Noto Sans Symbols","Symbola",sans-serif' }}>↳</span>` в `RowActionsCell.tsx:38`.

**Если preview работает — PR мержится, секция удаляется отсюда.**

---

## 7. Branch protection на main — пуши bypass'ятся

Последние 3 commit'а (accent unify, accentDark unify) пушились напрямую в `origin/main` и получали предупреждение от remote:

```
remote: Bypassed rule violations for refs/heads/main:
remote:   - Changes must be made through a pull request.
```

Это означает: правило "require PR" на main существует, но мой access bypass'ит его. Если хочется enforce'ить PR-flow для всех, включая меня — настроить rule в GitHub repo settings: **Settings → Branches → main → Restrict who can bypass required pull requests → снять все галочки**. После этого прямые пуши будут отклоняться; останется только PR → review → merge путь.

**Не cleanup-таск, а process decision**: решить, нужен ли такой enforce или текущий режим (user explicitly authorizes прямой push через чат) удобнее.

---

## 8. PR 2-B — per-group inline toolbars inside virtualized ItemsTable

PR 2 ship в ветке `claude/registry-toolbar-group-Qophc` реализовал **Variant B (single active-skupina toolbar above table)** из трёх рассмотренных в AskUserQuestion. AUDIT §4.3.4 идеально описывает **inline per-group toolbars** ("когда фильтр off — toolbar рендерится над КАЖДОЙ skupinой в скроллируемой таблице"), но это требует:

1. **Принудительная сортировка по `item.skupina`** — пересекается с существующим click-to-sort по колонкам (`ItemsTable.tsx:1056-1072`). Нужно решить: либо skupina-группировка перекрывает сортировку (как в Excel PivotTable), либо toolbars остаются sticky по скроллу + ручная сортировка оставляет visual несоответствие (item выпадает "не из своей секции").
2. **Variable-height virtualizer rows** — `useVirtualizer` сейчас с `estimateSize: () => ROW_HEIGHT` (32 px константа, `ItemsTable.tsx:980`). Для toolbar-рядов нужен `measureElement` + mixed row kinds (item vs toolbar). react-virtual это поддерживает, но требует переписывания `rowVirtualizer.getVirtualItems()` цикла — увеличенная поверхность риска регрессий в существующей таблице.
3. **Синтетические rows в data stream** — нужно выстроить derived list `[{ kind: 'toolbar', skupina, count, total }, { kind: 'item', ... }, …]` вместо плоского `visibleItems`.

**Scope PR 2-B** (когда брать):
- Ввести режим "group by skupina" с toggle в toolbar (по умолчанию off → текущее поведение, on → синтетические toolbar rows). Toggle разблокирует visual хаос при ручной сортировке.
- Переписать `rowVirtualizer` на variable heights + 2 row kinds.
- Скопировать action set из текущего `SkupinaToolbar` в inline вариант (per-row activeSkupina = the header's own skupina).
- Оставить текущий single-toolbar above-table surface как fallback при group-by-off.

**Estimate**: M-L, 2-4 дня. Не блокирует PR 3 (detail panel), PR 4 (extend bulk bar), PR 5 (click-cells) — те работают с текущим плоским рендерингом таблицы.

---

## 9. Floating panel geometry conflicts (Conflicts § 3.4) — Mobile 375 px

PR 2 single-toolbar above-table решает §4.3.4 но не трогает геометрию уже существующих floating overlays, которые на mobile 375 px могут накладываться друг на друга при одновременной активации:

- `<BulkActionsBar>` `fixed bottom-6 left-1/2 z-50` + `<TOVModal>` `fixed inset-0 z-50` + `<ImportModal>` + `AlertModal` + Role dropdown portal (`RowActionsCell.tsx:208-249`) + Attach-to-parent modal (`RowActionsCell.tsx:262-405`).
- z-index collisions когда 2+ overlays открыты одновременно (selection + TOV + import).
- "Корзина" / "папка" навигаторы проекта из live-кейса пользователя (out-of-scope PR 2 — упоминание в task spec).

**Scope**: отдельный UX-таск с скриншотами пользователя, audit z-index стека, возможно переход на bottom-sheet pattern на mobile вместо fixed pills.

**Estimate**: M, 1-2 дня. Не блокирует PR 3-5.

---

## 10. AI Klasifikace + GroupManager — `max-height + overflow-y` внутри панелей

Контекст: в сессии 2026-04-23 пытались убрать двойной scroll через flex-1 chain от `<main>` до scroll container таблицы (commit `3106ab2`). Chain сломался потому что `AIPanel` и `GroupManager` — **expandable** компоненты с натуральной растущей высотой. Когда оба развёрнуты одновременно (AI Mode panel + 47 skupin в GroupManager), их сумма превышает высоту main → `flex-1 min-h-0` на ItemsTable схлопывал карточку в `0 px`. `main: overflow-hidden` не давал доскроллить — таблица исчезала с экрана. Откатили на `6ed4180`, вернулись к двойному scroll (`main: overflow-y-auto` + table internal scroll через `useLayoutEffect` maxHeight).

**Правильное решение — ограничить вертикальный рост самих панелей:**

- `AIPanel` (`src/components/ai/AIPanel.tsx:303`) и `GroupManager` (`src/components/groups/GroupManager.tsx:160`): при `isExpanded=true` содержимое может занимать 400-600 px. Добавить `max-height: min(50vh, 500px); overflow-y: auto` на раскрытое состояние. Обе панели покажут свой scrollbar внутри — не пушат card ниже viewport.
- После этого можно вернуть **flex-1 chain** вариант из `3106ab2`: outer `h-screen flex flex-col` + main `flex-1 min-h-0 overflow-hidden` + sheet-items wrapper `flex-1 min-h-0 flex flex-col gap-4` + ItemsTable wrapper+card+scroll container с `flex-1 min-h-0`. Card больше не схлопнется в 0 — siblings теперь имеют bounded height.
- Удалить useLayoutEffect+ResizeObserver (те ~30 строк JS) — flex распределит пространство сам.

**Scope**: 2 файла (`AIPanel.tsx`, `GroupManager.tsx`) — добавить max-height на expanded panel body. Плюс revert revert commit = restore flex-1 chain. Test: развернуть обе панели, убедиться что таблица видна и единственный scroll внутри таблицы.

**Estimate**: S, 1-2 часа. Не блокирует classifier rewrite. Низкий риск регрессий — только CSS.

---

## 11. Classifier rewrite по спеке `docs/ROW_CLASSIFICATION_SPEC.md` — ✅ RESOLVED (2026-04-23, v4.25.0)

**Shipped:** Rewrite выполнен по спеке `rozpocet-registry/docs/ROW_CLASSIFICATION_ALGORITHM.md` v1.1 (не SPEC.md — спека переписана в ходе pre-implementation interview). Format-gated path (EstiCon/Komplet/RTSROZP) заменён на **universal column auto-detection + optional Typ-column fast-path**. PR #1006 (core module, 6 commits) + PR #1008/#1009 (integration + 87 tests, twin merge auto-dedup). Verified на 3 real fixtures: D6_202 + Kyšice + Veselí — **482 mains + 2097 subs + 70 sections + 0 orphans** across 2649 items. Follow-ups §14-17 ниже.

<details>
<summary>Original scope (pre-rewrite snapshot)</summary>

Формат-aware детерминистический классификатор заменит текущий `classifyRows` (regex + эвристика) в `rowClassificationService.ts`. Full spec в `rozpocet-registry/docs/ROW_CLASSIFICATION_SPEC.md` с cross-link на baseline audit `ROW_CLASSIFICATION_CURRENT.md`.

**Ключевые изменения:**

- **3 формата Excel** вместо template-agnostic pass: **EstiCon** (первая колонка `Typ` = `SD/P/PP/VV/TS/SO`), **Komplet** (`Typ` колонка = `D/K/PP/PSC/VV`), **RTSROZP** / custom (content heuristics как сейчас, но как fallback).
- **Format detection** перед column mapping: сканировать лист на EstiCon header (col 0 enum) или Komplet header row (`PČ + Typ + Kód + Popis + MJ + Množství`). RTSROZP — если ни то ни другое.
- **`parentItemId` всегда заполнен** для subordinate rows. Orphan subordinate (нет main выше в source) downgrade'ится в `unknown` с warning. UI fallback `effectiveParentMap` в `ItemsTable.tsx:252` станет no-op, оставляем как safety net.
- Новое поле `sectionId: string | null` на `ParsedItem` для section-group tracking (миграция persist storage для legacy items).
- Новое поле `originalTyp: string | null` для traceability EstiCon/Komplet.
- Extend `ImportConfig.columns` чтобы читать `Poř. Č.` column (EstiCon col 1, Komplet col 2) в `item.boqLineNumber` напрямую из импорта, а не генерировать счётчиком.

**Stashed preview**: `stash@{0}: classifier-migration WIP — user paused` содержит `classifyMissingRowRoles` store action + effect в ItemsTable.tsx для one-time migration legacy items без `rowRole`. Это **бандейд**, не замена — legacy items получают роли через существующий `classifyRows` без изменения parser/format detection. Решить при rewrite: забрать stash как bandage-before-rewrite или дропнуть.

**Scope**: L, 2-3 дня. Файлы: `rowClassificationService.ts` (rewrite), `excelParser.ts` (format detection + Poř. column read), `types/item.ts` (sectionId + originalTyp fields), `stores/registryStore.ts` (migration для persist), `config/templates.ts` (update column mapping defaults), новые тесты.

**Пререквизиты**: `ROW_CLASSIFICATION_SPEC.md` open questions (§Open questions 1-9) — нужен corpus реальных проблемных Excel'ей от пользователя для golden tests. Без corpus rewrite делается вслепую.

**Блокирующая для**: п. 2 (каталожная цена, зависит от корректного main/subordinate split), п. 4 (фильтр импорта в Monolit — нужна надёжная классификация).

</details>

---

## 12. Read `Poř. Č.` column from source Excel

Сейчас `item.boqLineNumber` генерируется классификатором как sequential counter main rows (1, 2, 3...). В импортируемом Excel (EstiCon col 1, Komplet col 2) уже есть свой `Poř. Č.` — нумерация которая может не совпадать с нашим счётчиком (пропуски, reset по section'ам, etc.). User показал что в UI ожидает видеть **то число что было в оригинальном файле**, не наш счётчик.

**Scope**:
- Добавить `Poř.` в `ImportConfig.columns` (строка column letter).
- Парсер (`excelParser.ts`) читает эту колонку и складывает в `item.por` (новое поле на `ParsedItem`) ИЛИ напрямую в `item.boqLineNumber` если классификатор этот же путь использует.
- Классификатор `classifyRows`: вместо `boqLineNumber = ++boqCounter` на main — `boqLineNumber = item.por ?? ++boqCounter` (fallback на счётчик если исходник не содержит).
- Обновить built-in templates в `config/templates.ts` (урs-standard, otskp, rts) с sensible defaults для Poř. column.

**Estimate**: S, 0.5-1 день. Блокирован п. 11 (format detection) — логично делать вместе.

---

## 13. Sticky header — проверка реальных браузеров

Fix `b5db134` перенёс `position: sticky; top: 0` с `<thead>` на `<th>` (Chrome игнорирует sticky на row-group). Протестировано в build, но живое поведение в разных браузерах не проверялось на этой ветке.

**Scope**: Safari, Firefox, Chrome + mobile 375 px — убедиться что при скролле внутри table scroll container header остаётся видимым. Если в каком-то браузере sticky-th тоже не работает — fallback на `display: block` hack для thead + separate table layout, или `<div>`-based grid вместо `<table>`.

**Estimate**: 30 минут проверки + фикс если нужен.

---

## 14. Persist ColumnMapping per Sheet (P1) — follow-up из review PR #1009

При нажатии «Překlasifikovat» в `ItemsTable` `reclassifySheet()` вызывает
`classifySheet(rows, { templateHint: null, preserveRawCells: false })` —
templateHint теряется, classifier падает на content-heuristic. Sparse
reconstructed rows не содержат header row (parser его выбросил при import),
поэтому detection не находит header-match и качество re-classification хуже
первичного импорта. Edge case specifically for EstiCon — если первый import
шёл по шаблону `esticon` (pre-filled column positions), re-run теряет это
знание.

Fix: сохранять либо полный `ColumnMapping` из первого detectColumns(),
либо `templateHint` string в `Sheet.config` при import; читать обратно в
`reclassifySheet()`. Также пересмотреть: поскольку `_rawCells` уже есть
per-item, может быть проще сохранять `templateHint` + `headerRowCells`
отдельно.

Размер: 0.5-1 день.

---

## 15. CI workflow для rozpocet-registry tests (P2) — ✅ RESOLVED (2026-04-24, PR #1013)

Workflow `.github/workflows/rozpocet-registry-test.yml` (44 строки) замерджен
в main. Триггеры `pull_request` + `push` на `main` с path filter
`rozpocet-registry/**` + сам workflow-файл. Шаги: checkout → Node 20.x + npm
cache → `npm ci` → `npm run test:run` (87 vitest) → `npm run build`
(`tsc -b && vite build`). Fail-on-red на обоих.

Self-test пройден на собственном PR за 42s (run `24848951369`, job
`test (20.x)` success). Caching, path filter и build-step — все корректны.

**Не провалидировано пока (Test Plan остаток)**:

1. Открыть trivial PR, трогающий только `stavagent-portal/` → подтвердить,
   что `Test Rozpočet Registry` workflow НЕ триггерится (path-filter
   exclusion).
2. Второй запуск должен hit'нуть npm cache (быстрее ~30s).

Secrets не требуются (тесты pure unit, без API).

---

## 16. classificationConfidence type cleanup (P3)

Текущий type в `ParsedItem.classificationConfidence`:

```ts
classificationConfidence?: number | 'high' | 'medium' | 'low';
```

Union string|number требует `typeof === 'number'` branch у всех consumers.
Legacy код писал строки ('high'/'medium'/'low'), v1.1 classifier пишет
numeric 0.0-1.0. `unifiedMapper.mapConfidenceToNumber` уже обрабатывает оба
варианта, но если какой-то UI-компонент читает поле и сравнивает со строкой
без проверки типа — silent misbehavior (числа не будут == `'high'`).

Fix:

1. `grep -rn "classificationConfidence" rozpocet-registry/src/` — составить
   список consumers.
2. Убедиться что каждый либо проверяет `typeof`, либо вызывает helper.
3. Опционально: переименовать numeric поле в `classificationScore: number`
   + оставить легаси `classificationConfidence?: 'high'|'medium'|'low'`
   под старым name для обратной совместимости (tech debt, но без риска
   silent bugs).

Размер: 2-3 часа. Не срочно пока нет багов.

---

## 17. Remove legacy classifyRows fallback (P3) — отложено

В `ImportModal.tsx:327, 472` на каждый импорт сначала запускается legacy
`classifyRows(result.items)`, затем v1.1 `classifySheet()` upgrade'ит
поля additive. Legacy остался как safety net на случай alignment edge
cases (v2 не производит matching row для некоторого ParsedItem).

После 2-3 недель production confirm'а что v2 strictly better:

1. Удалить импорт `classifyRows` + вызов на обоих branches.
2. Удалить сам файл `rowClassificationService.ts` (оставить только
   `isMainCodeExported` который нужен `registryStore.ts:21` для других
   целей — или перенести этот хелпер в другой модуль).
3. Проверить что `unmatched` count в mergeV2IntoParsedItems остаётся
   околонулевым на реальных импортах.

Размер: 1 час. Заблокировано временем — 2-3 недели после 2026-04-23.

---

## Приоритизация — обновлённая после сессии 2026-04-23 (post-classifier-merge)

**✅ Closed**: п. 11 (classifier rewrite) — shipped v4.25.0, follow-ups разнесены в §14-17. п. 15 (CI workflow) — shipped 2026-04-24 через PR #1013.

1. **П. 14** (persist ColumnMapping per Sheet) — P1, 0.5-1 день. Устраняет degradation "Překlasifikovat" — currently templateHint теряется.
2. **П. 10** (AI/GroupManager max-height) — 1-2 часа, разблокирует возврат flex-1 chain и устраняет двойной scroll окончательно. Низкий риск.
3. **П. 12** (read Poř. Č. from Excel) — частично решено в v4.25.0 (classifier extracts `por` в ClassifiedRowBase), остаётся проверить что parser пишет в `item.boqLineNumber` из Excel column, а не из счётчика. Быстрая проверка.
4. **П. 6** (PR 990 validation) — проверка cross-browser, независимо от всего.
5. **П. 13** (sticky header cross-browser) — быстрая проверка 30 мин.
6. **П. 4** (фильтр импорта в Monolit) — **разблокирован** после v4.25.0 classifier. Можно делать сразу.
7. **П. 5** (`text-text-muted` cleanup) — tech-debt, не блокирует.
8. **П. 2** (каталожная цена) — **разблокирован** после v4.25.0. Можно делать сразу.
9. **П. 1** (document navigation) — UX improvement.
10. **П. 16** (classificationConfidence type cleanup) — P3, 2-3 часа. Не срочно пока нет багов.
11. **П. 9** (floating panel geometry mobile) — отдельный UX-аудит.
12. **П. 8** (PR 2-B per-group inline toolbars) — возможен после появления use-case.
13. **П. 17** (remove legacy classifyRows fallback) — P3, 1 час. Заблокировано временем — 2-3 недели после 2026-04-23 (т.е. ~2026-05-07).
14. **П. 7** (branch protection) — process decision, не код.
15. **П. 3** — **закрыто**, заменено v4.25.0 classifier + п. 14 persist mapping.

PR 2 Variant B (single active-skupina toolbar above table) + compensation pack (subordinate visual distinction, vertical column dividers, sticky header fix, split Poř. column, hide empty monolit column) отправлен через ветку `claude/registry-toolbar-group-Qophc`. Двойной scroll сознательно принят как меньшее зло до реализации п. 10. PR-2-B / PR 3 (detail panel) / PR 4 (extend BulkActionsBar) / PR 5 (click-cells) остаются в плане `AUDIT_Registry_FlatLayout.md` §5.3.1.

**Stashed на ветке**: `stash@{0}: classifier-migration WIP — user paused` — one-time migration для legacy items без `rowRole`. Ждёт решения при реализации п. 11: забрать как bandage или дропнуть в пользу полного rewrite.
