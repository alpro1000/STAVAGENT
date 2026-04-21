# AUDIT — Registry Flat Layout

**Scope:** Registr Rozpočtů (`rozpocet-registry/`) — таблица skupin и položek.
**Reference target:** Monolit Planner Part A (`Monolit-Planner/frontend/src/components/flat/FlatPositionsTable.tsx` + `styles/flat-design.css`).
**Priority:** Mobile-first (iPhone screen), desktop inherits.
**Date:** 2026-04-21
**Author:** Claude Code (audit only, no implementation).

---

## 1. Inventory

### 1.1 Domain levels

Registry oперирует тремя уровнями иерархии (per `CLAUDE.md` → Domain rules):

| Level | Current representation | Primary file |
|-------|------------------------|--------------|
| **Rozpočet-document** (Komplet / RTSROZP / Excel) | Project header + sheet-tabs strip rendered by `App.tsx` above the table; one document = one project, one sheet = one list inside the project | `rozpocet-registry/src/App.tsx:1187-1263` (sheet tabs), `App.tsx:1270-1298` (project header) |
| **Skupina** (e.g. `SO 202202`) | Два представления: (a) row-level section marker — `ParsedItem.rowRole === 'section'`; (b) string value of `ParsedItem.skupina` per ordinary item, filtered / managed through `GroupManager.tsx` and the Skupina column autocomplete | `rozpocet-registry/src/components/items/ItemsTable.tsx:714-892` (column + filter), `src/components/groups/GroupManager.tsx` (CRUD), `src/types/item.ts` (type) |
| **Položka** (OTSKP 6-digit / ÚRS 9-digit line) | Row with `rowRole === 'main'`, plus optional children `rowRole === 'subordinate'` and catch-all `rowRole === 'unknown'` | `rozpocet-registry/src/components/items/ItemsTable.tsx` (rendering), `RowActionsCell.tsx` (per-row actions), `SkupinaAutocomplete.tsx` (skupina input), `BulkActionsBar.tsx` (multi-select actions) |

`ParsedItem.rowRole` values and render-time treatment live in `ItemsTable.tsx` and are referenced via `row.original.rowRole === 'section' | 'main' | 'subordinate' | 'unknown'`. The classification itself (OTSKP catalog vs. ÚRS catalog) is computed deterministically by `detectCatalog()` in `src/utils/position-linking.ts` — а не действие пользователя. Бейдж `(13 položek)` в sheet-tabs (`App.tsx:1238`) и `(N položek)` в BulkActionsBar (`src/hooks/useUndoableActions.ts:122-174`) — информационный, не интерактивный.

### 1.2 Row-level inventory — Položka (rowRole: `main` | `subordinate` | `unknown`)

Каждая строка — `<tr>` с `display: flex` поверх 12 ячеек, определённых в `ItemsTable.tsx:432-895` (columns array). Legend: **A** = always visible, **H** = hover only, **S** = selected only, **E** = only when parent is expanded, **C** = conditional on item state.

| # | Column id / визуальный элемент | State | Действие при клике | Файл : строка |
|---|---|---|---|---|
| 1 | `select` — `<input type="checkbox">` 12×12 | A | Toggle row selection (feeds `selectedIds` → `BulkActionsBar`) | `ItemsTable.tsx:435-455` |
| 2 | `actions` — `<MoveUp>` 11px | A | Inline reorder: `moveItemUp(projectId, sheetId, item.id)` | `RowActionsCell.tsx:164-170` |
| 3 | `actions` — `<MoveDown>` 11px | A | Inline reorder: `moveItemDown(...)` | `RowActionsCell.tsx:171-177` |
| 4 | `actions` — role trigger (icon = `ROLE_ICONS[currentRole]`: `ClipboardList`/`↳`/`FileText`/`CircleHelp` 12px) | A | Open portal-rendered dropdown → `updateItemRoleUndoable(item.id, newRole)` | `RowActionsCell.tsx:180-205` + portal at `:208-249` |
| 5 | `actions` — `<Link2>` 12px (blue) | C (only when `currentRole === 'subordinate'`) | Open centered resizable modal (default 550×500, min 400×300, max 900×800) to pick parent; `updateItemParent(...)` | `RowActionsCell.tsx:252-405` |
| 6 | `tov` — `<TOVButton>` (`BarChart3` 16px) | C (hidden for `section` / `subordinate`); hasData → orange-tinted bg | Open `<TOVModal>` (`rozpis zdrojů` breakdown); writes via `setItemTOV(itemId, data)` | `ItemsTable.tsx:473-493` + `components/tov/TOVButton.tsx` + `components/tov/TOVModal.tsx` |
| 7 | `monolit` — `<HardHat>` 14px | C (only when `item.monolith_payload` present AND not `section`); color = severity from `conflictMap` (match/info/warning/conflict); pulses when conflict | Open `mp.monolit_url` (+`position_instance_id`) in new tab | `ItemsTable.tsx:497-552` |
| 8 | `boqLineNumber` "Poř." — `<ChevronDown>` / `<ChevronRight>` 12px toggle + line number + `+N` children badge | C: toggle only when `rowRole === 'main'` AND `subordinateCounts.get(item.id) > 0`; `↳` marker for subordinate; plain muted number otherwise | Toggle `expandedMainIds` set → shows/hides subordinate rows | `ItemsTable.tsx:555-597` + `toggleExpanded` at `:201-211` |
| 9 | `kod` — mono text | A | Sort column only (no click action on cell) | `ItemsTable.tsx:600-611` |
| 10 | `popis` — horizontally-scrollable text (`cell-scrollable` class) | A | Sort column only | `ItemsTable.tsx:614-625` + `ItemsTable.css:7-31` |
| 11 | `mj` — read-only | A | Sort column only | `ItemsTable.tsx:628-637` |
| 12 | `mnozstvi` — read-only, tabular-nums | A | Sort column only | `ItemsTable.tsx:640-655` |
| 13 | `cenaJednotkova` — `<EditablePriceCell>` (number input, 2-decimal, local-state) | C (hidden when `rowRole === 'section'`) | `onBlur` / `Enter` → `updateItemPrice(projectId, sheetId, item.id, newPrice)` | `ItemsTable.tsx:30-76` + `:658-679` |
| 14 | `cenaCelkem` — read-only formatted CZK | A; для `rowRole === 'section'` показывает `sectionTotals.get(item.id)` bold orange | Sort column only | `ItemsTable.tsx:682-712` + `sectionTotals` at `:225-240` |
| 15 | `skupina` → `<SkupinaAutocomplete>` input | C (hidden when `rowRole === 'section'`) | Select or create skupina → `setItemSkupinaUndoable` + `recordSkupinaMemory(item.kod, value)` + optional POST to `/api/ai-agent` when `shouldLearn === true` | `ItemsTable.tsx:820-863` + `components/items/SkupinaAutocomplete.tsx` |
| 16 | `skupina` → `<Sparkles>` 16px (orange) | C (only when `currentSkupina && item.kod`) | `applyToSimilar(item)` — автоприсвоение skupiny подобным позициям (similarity ≥40%) во всех листах проекта, via `autoAssignSimilarItems()` | `ItemsTable.tsx:865-874` + `:301-358` |
| 17 | `skupina` → `<Globe>` 16px (blue) | C (only when `currentSkupina && item.kod`) | `applyToAllSheets(item)` — применить skupinu на ВСЕ листы (все проекты) с тем же `kod`, via `setItemSkupinaGlobalUndoable` | `ItemsTable.tsx:875-883` + `:361-383` |

Subordinate rows render the same cells but with `className="opacity-70"` (`ItemsTable.tsx:1062`). Rows fully opt out of selection UI — but the checkbox, move-arrows и role-dropdown всё равно рисуются.

### 1.3 Row-level inventory — Skupina section row (rowRole: `section`)

Использует ту же `<tr>` схему, но ячейки 13/15/16/17 и колонка 7 (`monolit`) возвращают `null`. Ячейка 14 (`cenaCelkem`) переключается в режим "section total" — bold orange, значение из `sectionTotals`.

| # | Ячейка | State in section row | Примечание |
|---|---|---|---|
| 1 | `select` checkbox | A | Visible but functionally useless для раздела (bulk operations работают над `main`/`subordinate` skupina setter, не удалят сам раздел) |
| 2-3 | `MoveUp` / `MoveDown` | A | Reorder раздела применим — двигает секцию в общем списке |
| 4 | role trigger | A | Role picker показывает `FileText` (ROLE_ICONS.section); клик меняет роль обратно в `main` |
| 5 | `Link2` | hidden | Role ≠ 'subordinate' |
| 6 | `TOVButton` | hidden | `ItemsTable.tsx:480-482` explicit null |
| 7 | `HardHat` | hidden | `ItemsTable.tsx:503` explicit null |
| 8 | Poř. | A | Plain muted number, no expand (section не имеет `subordinateCounts` > 0) |
| 9-12 | kod/popis/mj/mnozstvi | A | Обычно пустые для section — отображают `null`/пустую строку |
| 13 | Cena jedn. | hidden | `ItemsTable.tsx:664-666` |
| 14 | Cena celkem | A (modified) | Σ цен всех `main` внутри секции, класс `text-accent-primary` bold | `ItemsTable.tsx:687-696` |
| 15 | SkupinaAutocomplete | hidden | `ItemsTable.tsx:815-817` |
| 16-17 | Sparkles / Globe | hidden | Зависят от skupina-cell, которая null |

Фактически из 17 row-level элементов для секции остаются активными только 7 (checkbox, moveUp/Down, role trigger, Poř., Popis, Cena celkem) — остальные 10 либо пустые, либо скрытые. Визуально это читается как "строка с дырами", а не как заголовок группы.

### 1.4 Skupina as column value — управление (вне строки таблицы)

Управление skupinami живёт параллельно в трёх местах:

| UI | Файл : строка | Назначение |
|----|---------------|------------|
| Column header "Skupina" + `<Filter>` иконка | `ItemsTable.tsx:714-810` | Excel-style filter dropdown — checkbox list skupin с счётчиками, "Zobrazit vše", "pouze" per group; `filterGroups` state |
| Column header sort/filter dropdown | `ItemsTable.tsx:740-807` | Portal-like pop-over (не portal — inline absolute), `onClick stopPropagation`, closes on outside click |
| `<GroupManager>` (collapsible card above table) | `src/components/groups/GroupManager.tsx` (325 lines) | CRUD over skupiny: add / rename / delete / duplicate check; resizable panel (min 480px, max 80vw); persists width в `localStorage('registry-group-manager-width')` |
| `<SkupinaAutocomplete>` inline в row | `src/components/items/SkupinaAutocomplete.tsx` (286 lines) | Autocomplete input: выбор existing или создание new skupina; memory hint из `getMemorySkupiny(item.kod)` |

### 1.5 Rozpočet-document level — header + sheet navigator

Между глобальным tool-strip и таблицей:

| UI | Файл : строка | Назначение |
|----|---------------|------------|
| Project title `<h2>` + `<PortalLinkBadge>` + "Upravit mapování" (`<RotateCcw>`) + list name + oddíl | `App.tsx:1270-1298` | Контекст выбранного rozpočet-документа |
| Sheet tabs strip: `«« « [tabs] » »»` + каждая вкладка `Stavba_...  (N položek)` | `App.tsx:1187-1263` | Excel-style sheet navigator; orange active tab; горизонтальный overflow-x-auto с 4 navigation buttons |
| Filter checkbox "Zobrazit pouze pracovní položky" + counter badge | `App.tsx:1312-1334` | Фильтр подавляет description-only rows через `getFilteredItems()` |
| `<AIPanel>` | `src/components/ai/AIPanel.tsx` | AI-классификация skupin (bulk operations) |
| `<GroupManager>` | `src/components/groups/GroupManager.tsx` | (См. 1.4) |

### 1.6 Floating / overlay UI (в scope только для отметки конфликтов)

Согласно task spec раздел "Что НЕ входит" запрещает работу над floating panels кроме упоминания конфликтов. Список для полноты inventory:

| Component | Файл : строка | Позиционирование | Триггер |
|-----------|---------------|------------------|---------|
| `<BulkActionsBar>` (Eraser / Trash2 / Tag / X + counter) | `src/components/items/BulkActionsBar.tsx` | `fixed bottom-6 left-1/2 -translate-x-1/2 z-50` | `selectedIds.size > 0` |
| ItemsTable header row: Undo / Redo / "X/MAX" + selected count | `ItemsTable.tsx:966-1001` | Static `border-b` inside the table card | Always when table rendered |
| Role dropdown (portal) | `RowActionsCell.tsx:208-249` | `createPortal(..., document.body)` + `position: fixed` + auto-flip | Role-trigger click |
| Attach-to-parent modal (portal) | `RowActionsCell.tsx:262-405` | Centered `fixed`, resizable | Link2 click (subordinate only) |
| Column filter dropdown (Skupina) | `ItemsTable.tsx:740-807` | `absolute right-0 top-full` with manual box-shadow | Filter-icon click in column header |
| `<TOVModal>` | `src/components/tov/TOVModal.tsx:196` | `fixed inset-0 z-50` centered | TOV button click |
| `<ImportModal>` / `<PriceRequestPanel>` / `<MonolitCompareDrawer>` / `<AlertModal>` | various | `fixed` full-screen overlay | Various |

### 1.7 Что каждый row-level элемент делает при клике — сводка

Обобщённо из таблиц 1.2 и 1.3:

- **Навигация (открывает другую страницу / таб):** HardHat (`monolit_url` в новой вкладке).
- **Модалка:** TOVButton (TOVModal), Link2 (parent-picker modal), role trigger (portal dropdown), Filter trigger (column dropdown).
- **Inline-действие (мутация store без UI поверх):** checkbox, MoveUp, MoveDown, Sparkles, Globe, EditablePriceCell commit, SkupinaAutocomplete onChange.
- **Toggle:** ChevronDown/Right на "Poř." (expand/collapse subordinates).
- **Индикатор (не интерактивный):** `(N položek)`, `+N`-бейдж subordinate count, severity-colored HardHat tooltip, `section total` в Cena celkem, Poř. plain number, `↳` marker для subordinate.

---

## 2. Reference — Monolit Planner Part A

Визуальные токены, снятые **напрямую из кода** Planner Part A — без интерпретации. Все file-пути относительно `Monolit-Planner/frontend/src/`. Токены снабжены конкретными file:line ссылками, чтобы при реализации можно было цитировать источник.

### 2.1 Типографика

| Слой | Значение | Источник |
|------|----------|----------|
| Шрифтовые семейства (импорт Bunny Fonts) | `DM Sans` weights 400/500/600 + `JetBrains Mono` weights 400/500 | `styles/flat-design.css:12` |
| `--flat-font` (body) | `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | `styles/flat-design.css:60` |
| `--flat-font-mono` (numeric) | `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` | `styles/flat-design.css:61` |
| App body | `font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased` | `styles/flat-design.css:74-81` (`.flat-app`) |
| **Sticky table header** (`.flat-table th`) | `font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--flat-text-label)` | `styles/flat-design.css:442-446` |
| **Data cell** (`.flat-table td`) | `font-size: 13px` (family inherits `--flat-font`) | `styles/flat-design.css:467` |
| **Layer-2 element column header** (`.flat-el-colheader th`) | `font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--flat-text-secondary)` | `styles/flat-design.css:631-635` |
| **Layer-1 INFO name** (`.flat-el-info__name`) | `font-weight: 600; font-size: 13px` | `styles/flat-design.css:525-526` |
| **Layer-1 metric label** (`.flat-el-info__metric-label`) | `font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; color: var(--stone-500); line-height: 1` | `styles/flat-design.css:553-558` |
| **Layer-1 metric value** (`.flat-el-info__metric-value`) | `font-size: 13px; line-height: 1.2` | `styles/flat-design.css:619-620` |
| Work row cells (`.flat-work-row td`) | `font-size: 13px` | `styles/flat-design.css:649` |
| **Numeric mono helper** (`.flat-mono`) | `font-family: var(--flat-font-mono); font-size: 12px; font-variant-numeric: tabular-nums` | `styles/flat-design.css:894-896` |
| **Editable numeric cell** display (`.flat-ecell`) | `font-family: var(--flat-font-mono); font-size: 12px; text-align: right` | `styles/flat-design.css:1012-1014` |
| Editable numeric cell input (`.flat-ecell-input`) | mono, `font-size: 12px; text-align: right` | `styles/flat-design.css:1055-1058` |
| **Subtype badge** (`.flat-badge`) | `font-size: 11px; font-weight: 500; white-space: nowrap` | `styles/flat-design.css:825-828` |
| Button base (`.flat-btn`) | `font-size: 13px; font-weight: 500; font-family: var(--flat-font); white-space: nowrap` | `styles/flat-design.css:376-385` |
| Small button variant (`.flat-btn--sm`) | `font-size: 12px` | `styles/flat-design.css:404-407` |
| Toolbar label (`.flat-filter-check`) | `font-size: 13px; color: var(--flat-text-label)` | `styles/flat-design.css:995-997` |
| KPI hero number (`.kpi-card__hero`) | `font-size: 20px; font-weight: 600; font-family: var(--flat-font-mono); font-variant-numeric: tabular-nums; line-height: 1.2` | `styles/flat-design.css:940-942` |
| KPI card head (`.kpi-card__head`) | `font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--stone-500)` | `styles/flat-design.css:928-930` |
| KPI row label / value (`.kpi-row__label` / `.kpi-row__value`) | label `font-size: 11px; font-weight: 500; color: var(--stone-500)`; value `font-size: 13px; font-weight: 600; mono; tabular-nums` | `styles/flat-design.css:953-961` |
| OTSKP inline input (`.flat-otskp-input`) | `font-family: var(--flat-font-mono); font-size: 11px` | `styles/flat-design.css:568-569` |

**Наблюдения для переноса в Registry:**

- Две шрифтовые гарнитуры, без fallback-шума: DM Sans для всего текстового, JetBrains Mono только для чисел/кодов с `tabular-nums`. Registry уже импортирует Inter + JetBrains Mono (`rozpocet-registry/src/styles/tokens.css:17` — `--font-body: 'Inter'`), поэтому "тот же визуальный язык" не значит обязательную миграцию на DM Sans — достаточно перенести **паттерн** (sans-serif для текста, mono только для чисел + 6/9/11/13-шаговая шкала).
- Только четыре размера шрифта используются в потоке таблицы: **9 / 11 / 12 / 13 px**. 9 px — только label в INFO метрике. 11 px — заголовки колонок + badge. 12 px — mono-числа. 13 px — читаемый data-text. Нет 14/15/16/17 размеров в табличной части.
- Uppercase + wide letter-spacing (0.04–0.05 em) применяется **только** к column headers и metric labels — это визуальный сигнал "метаданные, не данные". Registry сейчас использует нормальный регистр во всех заголовках (`rozpocet-registry/src/index.css:112` — `.table th font-size: 13px; font-weight: 600`) без uppercase.
- Цифры везде через `font-variant-numeric: tabular-nums` (см. `styles/flat-design.css:896`). Registry этот трюк уже применяет в отдельных ячейках (`rozpocet-registry/src/components/items/ItemsTable.tsx:587, 646, 691, 700` — `tabular-nums`), но не глобально через class helper.
- Весов три: 400 (body), 500 (labels/buttons), 600 (emphasis/headers). 700 не используется.

### 2.2 Spacing и размеры

| Слой | Значение | Источник |
|------|----------|----------|
| **Row height data** (`--flat-row-h`) | `32px` | `styles/flat-design.css:64` |
| **Row height header** (`--flat-header-h`) | `36px` | `styles/flat-design.css:65` |
| Sidebar width (`--flat-sidebar-w`) | `280px` | `styles/flat-design.css:66` |
| Sticky header cells (`.flat-table th`) | `height: 36px; padding: 0 8px` | `styles/flat-design.css:440-441` |
| Data cells (`.flat-table td`) | `height: 32px; padding: 0 8px; vertical-align: middle` | `styles/flat-design.css:465-472` |
| **Layer-1 INFO row** (`.flat-el-info td`) | `padding: 0 !important; height: auto !important` (весь padding делегирован inner) | `styles/flat-design.css:495-498` |
| Layer-1 INFO inner (`.flat-el-info__inner`) | `display: flex; gap: 10px; padding: 8px 10px; min-height: 40px; flex-wrap: nowrap` | `styles/flat-design.css:500-507` |
| Layer-1 separator bar (`.flat-el-info__sep`) | `width: 1px; height: 24px; background: var(--flat-border)` | `styles/flat-design.css:537-540` |
| **Layer-2 column header** (`.flat-el-colheader th`) | `height: 28px; padding: 0 8px` | `styles/flat-design.css:629-630` |
| **Layer-3 work row** (`.flat-work-row td`) | `height: var(--flat-row-h); padding: 0 8px`; `td:first-child { padding-left: 16px }` | `styles/flat-design.css:646-659` |
| **Layer-4 "Přidat práci" row** (`.flat-el-add td`) | `padding: 4px 16px !important; height: auto !important; border-bottom: 2px solid var(--stone-200)` | `styles/flat-design.css:670-674` |
| Subordinate indent (`.flat-row--sub td:first-child`) | `padding-left: 28px` (отступ на +12px от обычного first-child 16px) | `styles/flat-design.css:809-811` |
| Badge (`.flat-badge`) | `padding: 2px 8px; border-radius: 4px` | `styles/flat-design.css:824-827` |
| **Icon-only button** (`.sb__icon-btn`) | `width: 26px; height: 26px; border: none; background: none; border-radius: 4px; padding: 0`; доступен только через псевдо-вариант `--accent` / `--danger` на hover | `styles/flat-design.css:226-233` |
| Button base (`.flat-btn`) | `padding: 6px 14px; border-radius: 6px; border: 1px solid var(--flat-border); gap: 6px` | `styles/flat-design.css:371-385` |
| Small button (`.flat-btn--sm`) | `padding: 4px 10px` | `styles/flat-design.css:404-407` |
| Editable cell display (`.flat-ecell`) | `padding: 2px 4px; border-radius: 3px; border: 1px solid transparent; min-height: 20px` | `styles/flat-design.css:1016-1021` |
| Editable cell input (`.flat-ecell-input`) | `height: 24px; padding: 0 4px; border-radius: 3px; border: 1px solid var(--orange-500)` | `styles/flat-design.css:1049-1061` |
| OTSKP inline input (`.flat-otskp-input`) | `height: 22px; padding: 0 4px; border-radius: 3px; border: 1px solid var(--flat-border); box-sizing: border-box` | `styles/flat-design.css:563-574` |
| Toolbar (`.flat-toolbar`) | `gap: 8px; padding: 8px 0; flex-wrap: wrap` | `styles/flat-design.css:979-984` |
| KPI strip (`.kpi-strip`) | `gap: 10px; padding: 8px 0; margin-bottom: 6px; flex-wrap: wrap` | `styles/flat-design.css:903-907` |
| KPI card (`.kpi-card`) | `flex: 1; min-width: 200px; border-left-width: 4px; overflow: visible` (last fix для срезанного "Kč/m³") | `styles/flat-design.css:911-915` |
| Table wrapper (`.flat-table-wrap`) | `overflow-x: auto; border: 1px solid var(--flat-border); border-radius: 8px; background: var(--flat-surface)` | `styles/flat-design.css:422-427` |
| Sticky first column | `position: sticky; left: 0; z-index: 2` (td) / `z-index: 4` (th) | `styles/flat-design.css:1492-1503` |
| Mobile breakpoint **640 px** — hide helper (`.flat-col--hide-mobile`) | `display: none` | `styles/flat-design.css:1467-1469` |
| Mobile touch targets (`@media max-width: 640px`) | `.flat-btn { min-height: 36px; padding: 8px 12px }` · `.flat-el-info__inner { min-height: 44px; flex-wrap: wrap }` · `.flat-ecell { min-height: 32px; line-height: 32px }` · `.sb__obj { min-height: 44px }` · `.sb__stavba { min-height: 40px }` | `styles/flat-design.css:1471-1476` |
| Mobile sidebar breakpoint | Sidebar becomes `position: fixed` drawer + backdrop at ≤ 900 px; backdrop hidden ≥ 901 px | `styles/flat-design.css:1437-1464` |

**Наблюдения:**

- Четырёхслойная вертикальная шкала высот: **28 → 32 → 36 → 40 px**. 28 px — "вспомогательный" (Layer-2 column header, inline OTSKP). 32 px — стандартная data row. 36 px — sticky header + mobile button minimum. 40 px — element INFO row (min-height; на мобильном растёт до 44 px).
- Горизонтальный padding ячейки таблицы — **8 px**, у first-child — **16 px**. В Registry сейчас применяется `padding: var(--space-md)` = **16 px** на все `<td>` (`rozpocet-registry/src/index.css:120`), вдвое больше; это один из главных вкладчиков в "длинную" строку.
- Icon-only кнопка 26×26 px (`.sb__icon-btn`) — единственный поддерживаемый паттерн для инлайн-действий в Planner Part A (используется, например, как delete-element trigger в INFO-row: `components/flat/FlatPositionsTable.tsx:584-594`). При ≤ 640 px она НЕ увеличивается — вместо этого Planner полагается на `.flat-el-info__inner { min-height: 44px; flex-wrap: wrap }` и на выкидывание 8 столбцов из work-row через `.flat-col--hide-mobile`. Другими словами, "44px iOS-target" достигается ростом контейнера, не иконки.
- `.flat-ecell` живёт как текст (`min-height: 20px`, border: 1px transparent). Превращается в `<input height=24px border=orange>` только по клику — никакой отдельной "edit" иконки.
- Нет `box-shadow` на рядах, только на обёртке таблицы косвенно через `border: 1px + border-radius: 8px`. Dropdowns вне таблицы дают тень `0 8px 24px rgba(0,0,0,0.12)` (`.flat-otskp-dropdown`, `styles/flat-design.css:596-597`). Сравнение с Registry: там на `.card` висит `--shadow-panel` из 4-слойной неоморф-тени (`rozpocet-registry/src/styles/tokens.css:74-77`) — главный визуальный маркер "не-плоского" стиля.

---

### 2.3 Цветовая палитра

Раздельная таблица по ролям. Все значения — дословно из кода (hex или CSS custom property), не перефразированы.

#### 2.3.1 Базовая палитра (из которой всё остальное выводится)

| Токен | Значение | Источник |
|-------|----------|----------|
| `--stone-50` | `#FAFAF9` | `styles/flat-design.css:19` |
| `--stone-100` | `#F5F5F4` | `styles/flat-design.css:20` |
| `--stone-200` | `#E7E5E4` | `styles/flat-design.css:21` |
| `--stone-300` | `#D6D3D1` | `styles/flat-design.css:22` |
| `--stone-400` | `#A8A29E` | `styles/flat-design.css:23` |
| `--stone-500` | `#78716C` | `styles/flat-design.css:24` |
| `--stone-600` | `#57534E` | `styles/flat-design.css:25` |
| `--stone-700` | `#44403C` | `styles/flat-design.css:26` |
| `--stone-800` | `#292524` | `styles/flat-design.css:27` |
| `--stone-900` | `#1C1917` | `styles/flat-design.css:28` |
| `--orange-500` | `#F97316` | `styles/flat-design.css:31` |
| `--orange-100` | `#FFF7ED` | `styles/flat-design.css:32` |
| `--orange-200` | `#FFEDD5` | `styles/flat-design.css:33` |
| `--orange-600` | `#EA580C` | `styles/flat-design.css:34` |
| `--green-500` | `#22C55E` | `styles/flat-design.css:37` |
| `--green-100` | `#F0FDF4` | `styles/flat-design.css:38` |
| `--red-500` | `#EF4444` | `styles/flat-design.css:39` |
| `--red-100` | `#FEF2F2` | `styles/flat-design.css:40` |
| `--blue-50` | `#EFF6FF` | `styles/flat-design.css:41` |
| `--blue-100` | `#DBEAFE` | `styles/flat-design.css:42` |
| `--blue-500` | `#3B82F6` | `styles/flat-design.css:43` |
| `--yellow-500` | `#EAB308` | `styles/flat-design.css:44` |
| `--yellow-100` | `#FEF9C3` | `styles/flat-design.css:45` |

#### 2.3.2 Семантические alias'ы (как ими пользуются компоненты)

| Alias | Значение | Источник |
|-------|----------|----------|
| `--flat-bg` | `var(--stone-50)` — фон `.flat-app` shell | `styles/flat-design.css:48` |
| `--flat-surface` | `#FFFFFF` — фон data-row и add-row | `styles/flat-design.css:49` |
| `--flat-header-bg` | `var(--stone-100)` — фон sticky table header | `styles/flat-design.css:50` |
| `--flat-border` | `var(--stone-200)` — все межстрочные и обрамляющие границы | `styles/flat-design.css:51` |
| `--flat-text` | `var(--stone-900)` — основной текст | `styles/flat-design.css:52` |
| `--flat-text-secondary` | `var(--stone-400)` — вторичный / muted | `styles/flat-design.css:53` |
| `--flat-text-label` | `var(--stone-600)` — подпись (column header) | `styles/flat-design.css:54` |
| `--flat-accent` | `var(--orange-500)` — единственный акцент | `styles/flat-design.css:55` |
| `--flat-hover` | `#F5F3F0` — подсветка строки при hover (не stone-100, а чуть теплее) | `styles/flat-design.css:56` |
| `--flat-selected` | `#EDEBE8` — подсветка выбранной строки | `styles/flat-design.css:57` |

#### 2.3.3 Фон строк в табличной части (потоке данных)

| Строка | Значение фона | Источник |
|--------|---------------|----------|
| **Layer 1 — INFO row** (`.flat-el-info`) | `var(--stone-100)` (`#F5F5F4`) с `!important` | `styles/flat-design.css:490-492` |
| **Layer 2 — column header** (`.flat-el-colheader`) | `var(--stone-50)` (`#FAFAF9`) с `!important` | `styles/flat-design.css:624-626` |
| **Layer 3 — work row** (`.flat-work-row`) | `var(--flat-surface)` (`#FFFFFF`) | `styles/flat-design.css:642-644` |
| **Layer 4 — "Přidat práci"** (`.flat-el-add`) | `var(--flat-surface)` (`#FFFFFF`) | `styles/flat-design.css:666-668` |
| Work row hover (`.flat-work-row:hover`) | `var(--flat-hover)` (`#F5F3F0`) | `styles/flat-design.css:661-663` |
| Generic row hover (`.flat-table tr.flat-row:hover`) | `var(--flat-hover)` | `styles/flat-design.css:476-478` |
| Generic row selected (`.flat-table tr.flat-row--selected`) | `var(--flat-selected)` (`#EDEBE8`) | `styles/flat-design.css:481-483` |
| **RFI warning row** (`.flat-row--rfi`) | `var(--orange-100)` (`#FFF7ED`) с `!important` + левая граница 3 px `var(--orange-500)` | `styles/flat-design.css:813-816` |
| Sticky first column (для горизонтального скролла) | `background: inherit` — наследует цвет слоя, в котором строка живёт (и `--flat-header-bg` у th) | `styles/flat-design.css:1492-1503` |

**Alternating rows (zebra):** в Planner Part A **нет**. Поиск `nth-child(even)` / `nth-child(odd)` / `--data-surface-alt` по `components/flat/` и `styles/flat-design.css` — результат пустой. Различение строк делается через **уровни вложенности** (INFO/colheader/work/add — четыре разных фона) и hover-состояние, а не через alternating stripes. (Для сравнения: в Registry `rozpocet-registry/src/index.css:135-137` висит `.table tbody tr:nth-child(even) { background: var(--data-surface-alt) }` — alternating включён.)

#### 2.3.4 Границы

Planner использует границы экономно: снизу между строками и по периметру обёртки, больше почти нигде.

| Где | Значение | Источник |
|-----|----------|----------|
| Обёртка таблицы (`.flat-table-wrap`) | `border: 1px solid var(--flat-border)` + `border-radius: 8px` | `styles/flat-design.css:422-427` |
| Header cell bottom (`.flat-table th`) | `border-bottom: 1px solid var(--flat-border)` | `styles/flat-design.css:448` |
| Data cell bottom (`.flat-table td`) | `border-bottom: 1px solid var(--flat-border)` | `styles/flat-design.css:468` |
| INFO row bottom (`.flat-el-info td`) | `border-bottom: 1px solid var(--stone-300)` — темнее обычного разделителя | `styles/flat-design.css:495-498` |
| Layer-2 column header bottom (`.flat-el-colheader th`) | `border-bottom: 1px solid var(--flat-border)` | `styles/flat-design.css:636` |
| Work row bottom (`.flat-work-row td`) | `border-bottom: 1px solid var(--flat-border)` | `styles/flat-design.css:650` |
| **Завершитель элемента** (`.flat-el-add td`) | `border-bottom: 2px solid var(--stone-200)` — толще, визуально закрывает блок | `styles/flat-design.css:673` |
| RFI строка (`.flat-row--rfi`) | `border-left: 3px solid var(--orange-500)` | `styles/flat-design.css:814` |
| Info-row separator между метриками (`.flat-el-info__sep`) | `1 px × 24 px`, цвет `var(--flat-border)` | `styles/flat-design.css:537-540` |
| Badge (`.flat-badge`) | **без** border; только `background` + `color` | `styles/flat-design.css:821-829` |
| Editable cell display (`.flat-ecell`) | `border: 1px solid transparent` (невидимо, но резервирует место под edit-state) | `styles/flat-design.css:1018` |
| Editable cell edit-mode (`.flat-ecell-input`) | `border: 1px solid var(--orange-500)` + `box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15)` на focus | `styles/flat-design.css:1052, 1063-1066` |

Толщины используемые: **1 px** (99% случаев), **2 px** (завершитель элемента), **3 px** (RFI left-bar). Нет 4+ px рамок и нет двойных (`double`) рамок.

#### 2.3.5 Акцентные цвета

Один основной акцент — **orange-500**. Danger — **red-500** (опасные действия + ошибка валидации). Success — **green-500** (статусные индикаторы в ячейке, не фон). Warning как таковой не используется как фон: в желтом (`--yellow-*`) нет ни одного применения в таблице — переменные определены, но вызовов нет (grep `yellow-500|yellow-100` по `components/flat/` и `styles/flat-design.css` даёт только определения).

| Роль | Значение | Использование в коде |
|------|----------|----------------------|
| **Primary action fill** | `var(--flat-accent)` = `var(--orange-500)` (`#F97316`) | `.flat-btn--primary { background/border }` `styles/flat-design.css:393-397` |
| Primary action hover | `var(--orange-600)` (`#EA580C`) | `.flat-btn--primary:hover` `styles/flat-design.css:399-402` |
| Primary focus halo (input) | `box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15)` | `.flat-ecell-input:focus` `styles/flat-design.css:1063-1066` |
| Primary inline indicator (filter-check) | `accent-color: var(--flat-accent)` | `.flat-filter-check input[type="checkbox"]` `styles/flat-design.css:1000-1002` |
| Primary border on edit | `border-color: var(--orange-500)` | `.flat-ecell-input`, `.flat-otskp-input:focus` `styles/flat-design.css:1052, 577` |
| Primary resize hover | `background: var(--orange-500); opacity: 0.3` | `.sb__resize:hover` `styles/flat-design.css:212-213` |
| RFI status icon fill | `color: 'var(--orange-500)'` (inline JSX style) | `components/flat/FlatPositionsTable.tsx:805` |
| Výpočet > Katalog (перерасход) | `color: 'var(--red-500)'` (JSX inline) | `components/flat/FlatPositionsTable.tsx:489-491` |
| **Danger hover** (icon button) | `color: var(--red-500)` | `.sb__icon-btn--danger:hover` `styles/flat-design.css:233` |
| Validation shake border | `border-color: #dc2626 !important` (магия: не через переменную) | `.flat-ecell--shake` `styles/flat-design.css:1033-1036` |
| **Success status text** | `color: 'var(--green-500)'` (inline JSX, не фон) | `components/flat/FlatPositionsTable.tsx:811` + катализатор "OK" 11 px/600 weight |
| Success metric (Katalog cena) | `color: 'var(--green-500)'` (inline JSX) | `components/flat/FlatPositionsTable.tsx:527`, `:540` |
| Warning (yellow) | **не используется** в потоке таблицы; `--yellow-100/-500` определены в палитре, но вызовов в `components/flat/` и `styles/flat-design.css` нет | — |

Кроме orange/red/green в ячейках встречаются **subtype badge bg+fg** — каждый с своей парой из палитры (не акценты UI, а категориальные маркеры):

| Badge | Background | Color | Источник |
|-------|-----------|-------|----------|
| beton | `var(--stone-200)` | `var(--stone-700)` | `styles/flat-design.css:831-834` |
| bednění | `var(--orange-100)` | `var(--orange-600)` | `styles/flat-design.css:836-839` |
| odbednění | `var(--orange-100)` | `var(--orange-600)` | `styles/flat-design.css:841-844` |
| výztuž | `var(--blue-100)` | `var(--blue-500)` | `styles/flat-design.css:846-849` |
| zrání | `#EEF2FF` (inline, вне палитры) | `#4338CA` | `styles/flat-design.css:851-854` |
| podpěrná konstr. | `#FDF4FF` | `#7E22CE` | `styles/flat-design.css:856-859` |
| předpětí | `#FFF1F2` | `#BE123C` | `styles/flat-design.css:861-864` |
| jiné | `var(--stone-100)` | `var(--stone-500)` | `styles/flat-design.css:866-869` |

#### 2.3.6 Текст

| Роль | Значение | Источник |
|------|----------|----------|
| Primary text | `var(--flat-text)` = `var(--stone-900)` (`#1C1917`) | `styles/flat-design.css:52, 82` |
| Secondary / muted | `var(--flat-text-secondary)` = `var(--stone-400)` (`#A8A29E`) | `styles/flat-design.css:53` |
| Label (meta / column header) | `var(--flat-text-label)` = `var(--stone-600)` (`#57534E`) | `styles/flat-design.css:54, 446, 706` |
| Element INFO metric label | `var(--stone-500)` (`#78716C`) — ещё на полшага светлее label | `styles/flat-design.css:557` |
| Placeholder (OTSKP input) | `var(--stone-400)` | `styles/flat-design.css:580-583` |
| Override marker (wage/shift differs from project default) | `var(--stone-500)` — не красный, не badge, просто приглушённое число | `styles/flat-design.css:1028-1030` |
| Disabled / muted number (`Katalog —` когда пусто) | `var(--stone-400)` | `components/flat/FlatPositionsTable.tsx:527, 542, 554, 565` |

**Наблюдения для переноса в Registry:**

- Палитра — **моно-стоун + один оранжевый + три статусных**. Нет тёплых/холодных нейтральных смешений, нет тинтов типа `gray-blue` / `stone-warm`. Registry сейчас держит двойной стек: свой `--app-bg #D7D8D9` / `--panel-clean #EAEBEC` / `--data-surface #F5F6F7` (`tokens.css:22-40`) плюс отдельный оранжевый `--accent-orange #FF9F1C` (`tokens.css:49`, **другой hex** чем Planner `#F97316`). При миграции либо принять Planner-oranж, либо оставить Registry-oranж — смешивать нельзя (два разных "официальных" акцента путают глаз).
- **Hover `#F5F3F0`** — теплее stone-100. Это сознательный подбор, не случайный: эффект "тёплый шум" на тотально-холодной шкале стоуна. Registry hover сейчас `var(--data-surface-alt)` = `#ECEDEF` (`tokens.css:40`, `index.css:131-133`) — холоднее, рядом с основным фоном, менее заметен.
- **Alternating rows не используются**. Каждая строка читается по своему background (4 уровня) и hover. Перенос в Registry потребует **отключения** `.table tbody tr:nth-child(even)` (`index.css:135-137`).
- Границы всегда `--flat-border` (stone-200) и почти всегда 1 px. Два исключения — 2 px завершитель элемента и 3 px RFI-left-bar. В Registry сейчас вся вертикальная разметка висит на `--edge-light: rgba(255, 255, 255, 0.5)` (`tokens.css:91`) — полупрозрачный белый, что в плоском стиле на белом же фоне исчезает.
- Тени на строках **нет**. Тень есть только у обёртки таблицы косвенно (через radius+border) и у dropdown'ов (`0 8px 24px rgba(0,0,0,0.12)` — `styles/flat-design.css:596-597`). Это самый заметный контраст с текущей неоморф-картой Registry: `--shadow-panel` — четырёхслойная тень с `rgba(80, 83, 87, 0.50)` + inset highlights (`tokens.css:74-77`), даёт объёмный "pillow" эффект на `.card`.
- Уровень муированности текста в Registry и Planner близок численно, но разный семантически. Planner: stone-900 (body) / stone-600 (label) / stone-400 (muted) — **три уровня**. Registry: `text-primary #1A1C1E` / `text-secondary #4A4D50` / `text-muted #7A7D80` / `text-code #5A5D61` (`tokens.css:43-46`) — **четыре уровня**. Лишний `text-code` — артефакт старого неоморф-дизайна, в плоской таблице он не нужен: код (OTSKP/ÚRS) должен рендериться `mono font + primary text`, а не цветом-специализацией.

---

*Подсекции 2.4 (Иконки), 2.5 (Как Planner решает проблему множества действий в строке), разделы 3 (Conflicts), 4 (Proposals), 5 (Recommendation) будут добавлены в следующих коммитах.*
