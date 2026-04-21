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

### 2.4 Подход к иконкам

#### 2.4.1 Источник

Единственный источник — **`lucide-react`**. Проверено grep'ом `from 'lucide-react'` по `Monolit-Planner/frontend/src/components/flat/`:

| Файл | Импортированные иконки |
|------|------------------------|
| `components/flat/FlatPositionsTable.tsx:20-22` | `Calculator`, `AlertTriangle`, `Lock`, `Plus`, `Zap`, `Trash2`, `ChevronDown`, `ChevronRight`, `AlertCircle`, `ArrowRightLeft`, `Upload` |
| `components/flat/FlatToolbar.tsx:8` | `Upload`, `Download`, `FileSpreadsheet`, `ArrowRightLeft`, `Plus` |
| `components/flat/FlatSnapshots.tsx:9` | `Save`, `RotateCcw`, `Trash2`, `Lock`, `Unlock` |
| `components/flat/FlatProjectSettings.tsx:10` | `Settings` |
| `components/flat/FlatSidebar.tsx:10-13` | `ChevronRight`, `Plus`, `Pencil`, `Trash2`, `FolderOpen`, `PanelLeftClose`, `PanelLeftOpen` |
| `components/flat/FlatHeader.tsx:5` | `PanelLeftOpen`, `LogOut`, `AlertCircle`, `ExternalLink` |
| `components/flat/FlatTOVSection.tsx:16` | `X` |
| `components/flat/ImportRegistryModal.tsx:11` | `FolderOpen`, `Search`, `RefreshCw` |
| `components/flat/InlineOtskpSearch.tsx:10` | `Search` |

**Нет кастомных SVG** и **нет эмодзи** во всех файлах `components/flat/`. Grep на unicode-диапазоны `U+1F300..U+1F9FF` по `components/flat/` даёт 0 совпадений — эмодзи встречаются только в Part B (`components/calculator/`, `PositionRow.tsx`, `UnifiedPositionModal.tsx` и пр.), но это **не** reference target этого аудита.

В Registry тоже уже стоит `lucide-react` как единственный источник (`rozpocet-registry/src/components/items/ItemsTable.tsx:16`, `RowActionsCell.tsx:15`, и т. д.) — миграция семьи иконок не требуется. В `CLAUDE.md` есть соответствующее правило: "Icons: `lucide-react` only, no emojis in JSX (per-service imports, no shared registry)".

#### 2.4.2 Размеры иконок, реально встречающиеся в `components/flat/`

Проверено grep'ом `size={<N>}` по `components/flat/FlatPositionsTable.tsx` и `FlatTOVSection.tsx`:

| Размер | Где | Источник |
|--------|-----|----------|
| **11 px** | Chevron expand/collapse TOV в work-row (Typ práce cell) | `components/flat/FlatPositionsTable.tsx:682-683` |
| **11 px** | `<X>` close в FlatTOV | `components/flat/FlatTOVSection.tsx:224` |
| **13 px** | `<Zap>` в кнопке "Vypočítat / Upřesnit" на INFO row | `components/flat/FlatPositionsTable.tsx:581` |
| **13 px** | `<Trash2>` для delete element на INFO row | `components/flat/FlatPositionsTable.tsx:592` |
| **13 px** | `<Plus>` в кнопке "Přidat práci" (Layer-4 row) | `components/flat/FlatPositionsTable.tsx:640` |
| **14 px** | `<ChevronRight>` / `<ChevronDown>` toggle collapse на INFO row | `components/flat/FlatPositionsTable.tsx:501` |
| **14 px** | `<AlertCircle>` индикатор RFI в ячейке статуса | `components/flat/FlatPositionsTable.tsx:805` |
| 14 px | `<Upload>`, `<Download>`, `<FileSpreadsheet>`, `<ArrowRightLeft>`, `<Plus>` в toolbar (вне строки) | `components/flat/FlatToolbar.tsx:99-123` |
| 16 px | Empty-state action icons (вне потока таблицы) | `components/flat/FlatPositionsTable.tsx:847-849, 864` |
| 32 px | `<AlertTriangle>` empty-state-no-positions (вне потока) | `components/flat/FlatPositionsTable.tsx:858` |
| 48 px | `<Calculator>` empty-state-no-project (вне потока) | `components/flat/FlatPositionsTable.tsx:841` |

**В потоке таблицы используются только три размера: 11 / 13 / 14 px.** 16 px, 32 px и 48 px появляются только в empty-states, которые рендерятся вместо таблицы. Это более узкая шкала, чем в Registry (сейчас 11–20 px, см. `rozpocet-registry/src/components/items/ItemsTable.tsx:572` — `12`, `:619` — `14`, `:695` — `14`, `:733` — `14`, `:775` — `12`, `:1032` — `14`, `:1083` — `16`, `RowActionsCell.tsx:169-176` — `11`, `:203` — `12`, `:259` — `12`, `:310` — `24`).

#### 2.4.3 Stroke-width / outlined vs filled

`lucide-react` рендерит **outlined** SVG с `stroke-width: 2` по умолчанию. Проверено grep'ом `strokeWidth|stroke-width` по `components/flat/`: **0 совпадений** — значит нигде не переопределяют, везде дефолт. Все иконки Planner Part A — outlined 2 px stroke, без filled вариантов, без варьирования толщины обводки между ролями.

Цвет обводки задаётся через CSS `color` (lucide использует `currentColor` для stroke), поэтому смена цвета иконки = смена `color` родителя или inline `style={{ color: 'var(--red-500)' }}` / `className="text-*"`. Ровно это используется: `color: 'var(--orange-500)'` у `<AlertCircle>` в RFI-статусе (`components/flat/FlatPositionsTable.tsx:805`), `color: 'var(--flat-text-secondary)'` у chevron'ов (`:682-683`).

Нет смешения outlined + filled (как, например, "outlined когда неактивна, filled когда выбрана"). Все состояния выражаются **цветом + opacity + фоном контейнера**, не переключением стиля иконки.

#### 2.4.4 Максимум иконок в одной строке Planner

Подсчёт по коду:

**Layer 3 — work row (`components/flat/FlatPositionsTable.tsx:670-814`):**
- В ячейке `Typ práce`: 1 × chevron 11 px (всегда, когда `pos.id` — `:681-683`) + subtype badge (без иконки, только текст)
- В ячейке `ⓘ` (статус, последний столбец): 1 × `<AlertCircle>` 14 px, **условно** — только когда `pos.has_rfi` (`:803-809`). Иначе текст "OK" / пусто.
- Остальные ячейки: только числа + текст + inline input при редактировании

**→ максимум 2 иконки на строку работы, обычно 1 (только chevron). Ни одной "кнопки действия" (delete/edit/reorder/role-switch) — весь функционал реализован через click-cell-to-edit, click-cell-to-expand-TOV и отсутствующий reorder (порядок вычисляется `sortPartsBySequence()`, см. `components/flat/FlatPositionsTable.tsx:178, 185`).**

**Layer 1 — INFO row (element header, `components/flat/FlatPositionsTable.tsx:496-598`):**
- 1 × chevron collapse 14 px (всегда — `:500-502`)
- 1 × `<Zap>` 13 px в "Vypočítat / Upřesnit" (условно: `!isLocked && betonPos`, `:576-583`)
- 1 × `<Trash2>` 13 px delete element (условно: та же рамка, `:584-594`)

**→ максимум 3 иконки на INFO row.** Плюс один inline input (OTSKP search, `<InlineOtskpSearch>` содержит `<Search>` иконку внутри себя, `components/flat/InlineOtskpSearch.tsx:10`) — но это поиск, не action.

**Layer 2 — column header:** 0 иконок.
**Layer 4 — "Přidat práci":** 1 иконка `<Plus>` 13 px.

Итого на весь стек четырёх слоёв одного элемента: **max 3 (INFO) + 0 (colheader) + 2 × N (work rows) + 1 (add) ≈ 3 + 2N + 1**, где N — число работ. На 6 работах стек элемента содержит **≈16 иконок** — но **все, кроме 3 на INFO row, являются индикаторами, а не кнопками**.

Сравнение с Registry: одна только row-level строка `ItemsTable.tsx` уже содержит до **9 взаимодействующих иконок** при полном заполнении состояния (checkbox галочка при select, MoveUp, MoveDown, role-trigger, Link2 если subordinate, BarChart3 в TOVButton, HardHat в Monolit indicator, chevron Poř., Sparkles, Globe — считая chevron в Poř. и не считая input'ы). Planner Part A строго не превышает 3 даже на самом богатом слое.

#### 2.4.5 Паттерн opacity для destructive actions (вместо скрытия)

Единственная destructive-кнопка внутри таблицы — delete element на INFO row — **всегда отрисована, но с пониженной заметностью**. Код дословно:

```
// components/flat/FlatPositionsTable.tsx:585-594
<button
  className="sb__icon-btn sb__icon-btn--danger"
  onClick={onDelete}
  title="Odstranit element"
  style={{ flexShrink: 0, opacity: 0.4 }}
  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
>
  <Trash2 size={13} />
</button>
```

Три свойства этого паттерна:

1. **Всегда в DOM, всегда в одном и том же пикселе** — нет hover-only приёма `opacity: 0 → 1`, нет `display: none → flex`. Layout стабилен, муляжа "элементы прыгают при наведении" нет.
2. **opacity: 0.4 по умолчанию** — иконка визуально "задняя", читается как "вспомогательный путь". Орёл глазом на неё не летит, но видит.
3. **Hover возвращает opacity: 1** и одновременно CSS-класс `sb__icon-btn--danger:hover` перекрашивает иконку в `var(--red-500)` (`styles/flat-design.css:233`). Получается двойной сигнал: "я стала заметнее + я теперь красная".

На touch-устройствах opacity остаётся 0.4 (нет mouseEnter), но кнопка всё ещё кликабельна и видима — `title="Odstranit element"` даёт контекст, долгое нажатие триггерит сам handler.

Других применений этого паттерна в `components/flat/` нет: остальные действия либо **всегда 100 % opacity** (primary action — `Vypočítat`, `Plus`-кнопки), либо **условно рендерятся** (RFI-индикатор — не action, а статус). Иными словами, в Planner Part A паттерн `opacity: 0.4` зарезервирован под **одну семантику: необратимое удаление element'а**. Это UX-контракт: если пользователь видит приглушённую корзину, он знает, что её назначение — стереть всё.

**Наблюдение для переноса в Registry:** этот приём решает проблему "как уместить destructive action в плоский ряд, не пугая и не пряча". Hover-reveal плох, потому что на touch его нет. Overflow-menu плох, потому что destructive за дополнительным кликом воспринимается ленивее ("не я удалил, это меню"). А opacity 0.4 + цвет на hover/focus даёт видимость + трение. В Registry сейчас удаление одной строки вообще невозможно вне bulk-режима (`BulkActionsBar`), а delete-группы в `GroupManager.tsx:232-245` живёт через двухступенчатый confirm — оба паттерна несовместимы с плотной табличной строкой.

---

### 2.5 Overflow множества действий

#### 2.5.1 Прямой ответ

**Planner Part A не решает проблему overflow, потому что в строке максимум 3 действия.** Конкретно — 3 на Layer-1 INFO row (chevron collapse + `Vypočítat` + delete element), 2 на Layer-3 work row (chevron expand TOV + условный RFI-индикатор, последний не action а status), 1 на Layer-4 add-row (`Plus`). Когда действий мало по дизайну, их не нужно прятать.

Проверено grep'ами по `Monolit-Planner/frontend/src/components/flat/` — **0 совпадений** по всем популярным паттернам overflow:

| Паттерн | Grep-запрос | Результат |
|---------|-------------|-----------|
| Иконка "три точки" horizontal | `MoreHorizontal` | 0 |
| Иконка "три точки" vertical | `MoreVertical` | 0 |
| Иконка ellipsis | `Ellipsis` | 0 |
| Radix / Headless dropdown | `DropdownMenu` | 0 |
| Кастомный overflow-контейнер | `overflow-menu` | 0 |
| Tailwind hover-reveal | `hover:opacity` | 0 |
| Tailwind group-hover reveal | `group-hover.*opacity` / `opacity-0.*group-hover` | 0 |
| Stroke-width variance (outlined/filled switch) | `strokeWidth` / `stroke-width` | 0 |

Ни одна из распространённых тактик ("⋯" меню, hover-only кнопки, row-click → detail view со всем набором) в коде Part A не реализована. Единственный сосед по теме — `opacity: 0.4` на delete-кнопке INFO row (`components/flat/FlatPositionsTable.tsx:585-594`) — не прячет действие и не переносит его в меню, а снижает визуальный вес в том же пикселе (разобрано в 2.4.5).

#### 2.5.2 Что Planner делает вместо overflow

Все действия подняты на более крупный уровень иерархии или заменены прямым манипулированием ячейкой:

| Слой в Planner | Действия | Где в коде |
|----------------|----------|------------|
| **Global / toolbar** (над таблицей) | Upload XLSX, Export XLSX, Import Registry, `Plus` Add Position, фильтры `Jen problémy` / `Jen monolity` | `components/flat/FlatToolbar.tsx:75-126` |
| **Project / header** | Settings | `components/flat/FlatProjectSettings.tsx` |
| **Element (Layer 1 INFO row)** | `Vypočítat` / `Upřesnit` (primary, navigation в Part B), `Trash2` delete element (0.4 opacity) | `components/flat/FlatPositionsTable.tsx:574-595` |
| **Work row (Layer 3)** | **Нет** per-row actions. Chevron открывает TOV (expansion, не action). Редактирование полей — click-to-edit прямо в ячейке через `<EditableNum>` | `components/flat/FlatPositionsTable.tsx:670-814` + `:893-963` (`EditableNum`) |
| **Cell-level (внутри work row)** | OTSKP поиск через `<InlineOtskpSearch>`, числовое редактирование через `<EditableNum>`, expand TOV через click на badge-cell | `components/flat/FlatPositionsTable.tsx:677-688, 894-963` + `InlineOtskpSearch.tsx` |

Сортировка записей **не действие пользователя**: порядок вычисляется `sortPartsBySequence()` + `SUBTYPE_ORDER` (`components/flat/FlatPositionsTable.tsx:47-48, 178, 185`). Следствие: moveUp/moveDown в работах Planner Part A не существует в принципе — нет кнопок, потому что нет операции.

Удаление отдельной work-row ("строки работы внутри элемента") тоже отсутствует на уровне row: оно включено в cascading `handleDeleteElement` (`components/flat/FlatPositionsTable.tsx:313-320`), который вызывает `deletePosition(pos.id)` в цикле для всех позиций элемента. То есть мелкая единица удаления в Planner = element, не работа.

#### 2.5.3 Следствие для Registry

Прямого прецедента для overflow-меню / hover-reveal / context-click в Part A **нет**. Если в Registry остаётся требование держать ≥4 row-level действий на одной строке (как сейчас в `ItemsTable.tsx` — MoveUp, MoveDown, role-trigger, Link2 (cond), TOV, Monolit (cond), Sparkles, Globe = до 9 на полном состоянии), то решение придётся проектировать **без прямой ссылки на Part A**. Что можно взять из Planner как материал:

1. **Поднятие действий на более крупный уровень**. Planner буквально выносит всё, что можно, с row на element/toolbar/project. Для Registry аналог — поднять global-apply действия (`Sparkles`, `Globe`) на уровень skupina-row или в `GroupManager`, а reorder (`MoveUp/Down`) — либо в bulk-режим, либо в DnD-handle (который по-прежнему инлайнится, но без двух кнопок).
2. **Замена action-кнопки прямым манипулированием ячейкой**. `<EditableNum>` показывает, что value + input совмещены в одном визуальном элементе без "кнопки редактирования". В Registry `<EditablePriceCell>` (`ItemsTable.tsx:30-76`) уже следует этому паттерну — других кандидатов на "заменить кнопку на click-cell" в row немного, но `Skupina` autocomplete подходит (сейчас так и работает).
3. **Opacity 0.4 для destructive** (`components/flat/FlatPositionsTable.tsx:585-594` + `styles/flat-design.css:226-233`) — прямой применимый приём, если в Registry появится single-delete в row (сейчас его нет, он только через bulk).
4. **Группировка по смысловым секциям через spacing**, не через overflow. Planner использует `.flat-el-info__sep` (1 × 24 px, `styles/flat-design.css:537-540`) как визуальный делимитёр между name+OTSKP-input и группой метрик. Это дешёвый и плоский способ сказать "эти 3 элемента — про одно, а следующие — про другое", без дополнительной иконки-триггера.

Что **нельзя заимствовать из Part A**, потому что там такого нет:

- Паттерна "⋯ overflow-menu" в строке.
- Паттерна "hover показывает скрытые кнопки" (layout-jitter на touch + неоткрываемо на iPad).
- Паттерна "click row → detail drawer со всеми actions" (в Planner click row действий не запускает).

Вывод: если после раздела 3 (Conflicts) решим, что количество row-level действий в Registry избыточно — следует **сокращать**, перенося на уровни document / skupina / toolbar, а не **прятать** их в меню. Единственный импортируемый механизм снижения веса — `opacity: 0.4` для destructive. Всё, что за пределами этих двух стратегий, — дизайн-решение Registry, не цитата из Part A.

---

## 3. Conflicts

### 3.1 Mobile conflicts

Таблица рендерится как горизонтально скроллируемый блок шириной ~1160 px на viewport 375 px. Первый столбец (`select`, 20 px) не закреплён (`position:sticky` на `td:first-child` отсутствует в `ItemsTable.tsx` и `index.css`), поэтому при скролле вправо checkbox исчезает — пользователь теряет контроль над bulk-выделением в середине листа.

Иконки MoveUp/Down в `RowActionsCell.tsx:164-176` имеют размер 11 px и hit-area ~15 px. iOS HIG требует минимум 44 × 44 px. В Planner touch-цели реализованы через `min-height:44px` на контейнере (`flat-el-info__inner`), а не через размер иконки — в Registry аналога нет.

`BulkActionsBar` (`BulkActionsBar.tsx:78`) позиционируется как `fixed bottom-6 left-1/2 -translate-x-1/2`, ширина пилюли ~500 px. На viewport 375 px пилюля выходит за границы экрана влево и вправо без media-query адаптации.

Dropdown "Nastavit skupinu" внутри `BulkActionsBar` (`BulkActionsBar.tsx:127-129`) позиционируется `absolute bottom-full mb-2 min-w-[280px]`. На 375 px вместе с left-overflow пилюли это приводит к тому, что dropdown частично выходит за левый край экрана.

Модальный parent-picker (`RowActionsCell.tsx:278`) задан с `minWidth: 400px` — на 375 px он шире viewport и не имеет `max-width: 100vw` или `margin`.

Табы листов (`App.tsx:1187-1263`) используют `whitespace-nowrap` без `flex-shrink`. Каждый таб содержит счётчик `(N položek)`, что дополнительно увеличивает ширину. На >3 листах горизонтальный скролл таб-стрипа включается, но навигационные кнопки «« « » » занимают место и не показывают активный таб без скролла.

Строки с `rowRole='section'` (`ItemsTable.tsx`) рендерят 10 из 17 ячеек как пустые (null/0/—). На мобильном при скролле видна только часть ячеек; секционная строка визуально неотличима от обычной строки с незаполненными данными.

---

### 3.2 Desktop conflicts

#### 3.2.1 Плотность иконок — разрыв ×3

Из раздела 2.4.4: Planner Part A строго не превышает **3 иконок-кнопок** на строку (INFO row: chevron + Zap + Trash2). Строка Registry при полном заполнении состояния содержит до **9 взаимодействующих иконок** (MoveUp, MoveDown, role-trigger, Link2, BarChart3 TOV, HardHat monolit, ChevronRight Poř., Sparkles, Globe — `ItemsTable.tsx:432-895`, `RowActionsCell.tsx:161-407`). Разрыв — ×3. Это не вопрос вкуса: при 9 иконках на строке с ~1160 px горизонтального контента визуальный вес action-зоны сравним с весом данных.

#### 3.2.2 Дублирующие действия

`Sparkles` (`ItemsTable.tsx:867-874`) и `Globe` (`ItemsTable.tsx:875-882`) — обе кнопки делают одно и то же семантически: "применить выбранную skupinu к другим позициям". Разница (`applyToSimilar` по схожести ≥40% в текущем проекте vs `applyToAllSheets` по точному совпадению `kod` глобально) не выражена в иконках и не читается без tooltip. Пользователь видит два оранжевых огонька рядом без ясной иерархии важности между ними.

`MoveUp` (`RowActionsCell.tsx:164-170`) и `MoveDown` (`RowActionsCell.tsx:171-177`) — два отдельных button для одного концептуального действия "переместить строку". Planner не имеет этого паттерна вообще: порядок вычисляется `sortPartsBySequence()` (`FlatPositionsTable.tsx:178, 185`), пользователь не переупорядочивает строки.

#### 3.2.3 Редко используемые, но всегда видимые

**MoveUp/MoveDown** (`RowActionsCell.tsx:164-177`): рендерятся на каждой строке без исключений — в том числе на `section`-строках (`ItemsTable.tsx:1.3`). Порядок строк определяется источником (файл Excel / XML, порядок импорта). Пользователь редактирует порядок переимпортом или правкой источника — не двойными стрелками. Эти две кнопки присутствуют в layout постоянно, занимают первые ячейки column `actions` (70 px) и визуально якорят зону действий слева.

**Role trigger** (`RowActionsCell.tsx:180-205`): `rowRole` присваивается автоматически парсером при импорте (OTSKP 6-значный → `main`, описательная строка без цены → `section` или `subordinate`). Ручная коррекция роли нужна при ошибке парсера — событие редкое. Тем не менее role-trigger рендерится на каждой строке, включая секционные и subordinate-строки, где смена роли меняет поведение таблицы (expand/collapse, `sectionTotals`, `subordinateCounts`).

**`HardHat` column (28 px, `ItemsTable.tsx:496-552`)**: отображается только при `item.monolith_payload !== null`. Это признак cross-kiosk синхронизации с Monolit-Planner (раздел `CLAUDE.md` v4.17 sync). Функция активна только у пользователей, которые используют оба киоска одновременно. Для остальных колонка `monolit` (28 px) пустая на каждой строке — но colgroup занимает место в layout.

#### 3.2.4 Частые, но не скрытые — инверсия проблемы

В Registry **нет** паттерна "показать при hover" и нет overflow-menu (см. 2.5). Все действия видимы постоянно. Это исключает типичный desktop-конфликт "частое действие скрыто". Однако создаёт инверсную проблему: **самое частое действие** — назначение skupiny через `<SkupinaAutocomplete>` (`ItemsTable.tsx:820-863`) — находится в **последнем** столбце таблицы (200 px, позиция 15 из 17 элементов строки, `ItemsTable.tsx:714-892`). На большинстве экранов при отображении всех столбцов столбец `skupina` требует горизонтального скролла. Редко используемые `MoveUp`/`MoveDown` закреплены слева (column `actions`, всегда видимы без скролла), а ключевое действие — справа (не закреплено, исчезает за viewport).

---

### 3.3 Quantitative gap — Registry vs Planner

Все значения цитируются дословно из разделов 1–2.5 настоящего документа.

| Параметр | Registry | Planner | Источник в аудите |
|---|---|---|---|
| Макс. иконок-кнопок в строке таблицы | **9** | **3** | § 2.4.4 |
| Диапазон размеров иконок в строке | 11–16 px (Sparkles/Globe/BarChart3 = 16 px; MoveUp/Down = 11 px) | 11–14 px (только 11 / 13 / 14 в потоке) | § 2.4.2 |
| Hover цвет строки | `#ECEDEF` (`var(--data-surface-alt)`) | `#F5F3F0` (`var(--flat-hover)`) | § 2.3 (строка о hover), § 2.3.2 |
| Alternating rows (zebra) | **да** (`index.css:135-137`) | **нет** | § 2.3.3 |
| Box-shadow layers на строке | **4** (`--shadow-panel`: 4-layer neomorph, `tokens.css:74-77`) | **0** | § 2.2 (observations) |
| Font-family (body) | `Inter` (`tokens.css:17`) | `DM Sans` (`flat-design.css:60`) | § 2.1 |
| Типографическая шкала в потоке таблицы | 13 px (th) / 14 px (td) (`index.css:112, 120`) | **9 / 11 / 12 / 13 px** | § 2.1 (observations) |
| Горизонтальный padding ячейки | `16 / 16 px` (все `<td>`, `var(--space-md)`, `index.css:120`) | `8 / 16 px` (`<td>` / `td:first-child`, `flat-design.css:468, 657`) | § 2.2 |
| Row height (оценка) | `40 px` (`ROW_HEIGHT = 40`, `ItemsTable.tsx:943`) | **28 / 32 / 36 / 40 px** (4 слоя) | § 2.2 (observations) |
| Sticky первый столбец при горизонтальном скролле | **нет** | **да** (`position:sticky; left:0`, `flat-design.css:1492-1503`) | § 2.2, § 3.1 |
| Акцентный оранжевый | `#FF9F1C` (`--accent-orange`, `tokens.css:49`) | `#F97316` (`--orange-500`, `flat-design.css:31`) | § 2.3.1, § 2.3 (observations) |

Разрыв по числу иконок (9 vs 3), padding (16 vs 8 px) и shadow layers (4 vs 0) — количественный, не стилистический: он переводится напрямую в ширину строки (~1160 vs ~900 px), визуальный вес action-зоны и ощущение "тяжести" интерфейса независимо от цветовой схемы или шрифта.

---

### 3.4 Floating panels conflicts

Из семи компонентов секции 1.6 три позиционированы как `fixed` viewport-relative (BulkActionsBar, role-dropdown portal, attach-to-parent modal), один — `absolute` внутри sticky-контейнера с собственным stacking-context (column filter dropdown), один — `fixed inset-0` полноэкранный (TOVModal), один — static (Undo/Redo toolbar). Остальные (`ImportModal` / `AlertModal` / `MonolitCompareDrawer`) — стандартные `fixed` full-screen оверлеи без специфических конфликтов с row-level UI.

#### 3.4.1 BulkActionsBar (`BulkActionsBar.tsx:78`)

Появляется при `selectedIds.size > 0`. Позиция: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`. Пилюля содержит 4 кнопки с текстовыми лейблами (Eraser/Trash2/Tag/X) + счётчик + разделитель; минимальная ширина ~480 px в зависимости от контента (`BulkActionsBar.tsx:80-156`).

Скроллируемый контейнер таблицы задан как `maxHeight: calc(100vh - 260px)` + `overflow-auto` (`ItemsTable.tsx:1006`). BulkActionsBar позиционирован **вне** этого контейнера — на уровне viewport. Это означает: при появлении пилюли последние ~96 px видимой области таблицы (`bottom-6` = 24 px отступ + ~72 px высота пилюли с padding) перекрываются постоянно. Пользователь, выделивший строки в середине длинного списка и прокрутивший вниз, видит последние 1–2 строки под пилюлей без возможности взаимодействия.

На мобильном (375 px): пилюля шириной ~480 px выходит за оба края экрана без media-query адаптации (§ 3.1). Кнопки Eraser и Trash2 (левый край пилюли) на 375 px недостижимы без горизонтального скролла контейнера, которого нет — пилюля `fixed`, скролл страницы её не двигает.

Dropdown "Nastavit skupinu" внутри пилюли (`BulkActionsBar.tsx:125-144`): `absolute bottom-full left-0 mb-2 min-w-[280px]`. Открывается вверх от пилюли — в сторону таблицы. На 375 px пилюля сама смещена вправо из-за overflow, поэтому `left-0` выравнивает dropdown по смещённому краю пилюли, а не по экрану.

На desktop конфликт геометрического перекрытия остаётся: последние строки таблицы скрыты под пилюлей при активном выделении. Проблема не мобильно-специфична.

#### 3.4.2 Role dropdown portal (`RowActionsCell.tsx:208-249`)

Рендерится через `createPortal(..., document.body)`, `position: fixed`, `zIndex: 9999`. Auto-flip: если места снизу < 130 px (`spaceBelow < 130` at `:188`), dropdown открывается вверх. Триггер — клик на role-icon в любой строке.

`zIndex: 9999` ставит dropdown выше BulkActionsBar (`z-50` = z-index 50) и выше sticky thead (`z-index: 10`). Геометрического конфликта по z-порядку нет. Однако backdrop отсутствует — нет `fixed inset-0` закрывающего слоя. При активном BulkActionsBar (строки выделены) role dropdown и пилюля одновременно присутствуют в DOM без взаимного блокирования. Клик на кнопку в BulkActionsBar не закрывает role dropdown; закрытие происходит только через `mousedown` outside handler (`RowActionsCell.tsx:114-134`) или scroll listener.

На мобильном: auto-flip логика (`flip` по `window.innerHeight - rect.bottom`) работает корректно в вертикальной плоскости. Горизонтального repositioning нет — dropdown `min-w-[120px]` (`RowActionsCell.tsx:211`) может уйти за правый край viewport, если role-trigger находится в крайнем правом столбце.

#### 3.4.3 Attach-to-parent modal (`RowActionsCell.tsx:262-405`)

Центрирован: `fixed, left:50%, top:50%, transform:translate(-50%,-50%)`. Backdrop: `fixed inset-0 z-[99998]`, модал: `z-[99999]`. Ширина по умолчанию 550 px, минимум `minWidth: 400px` (`RowActionsCell.tsx:279`). Высота по умолчанию 500 px, минимум 300 px.

На мобильном (375 px): `minWidth: 400px` без `max-width: 100vw` и без горизонтального `margin` — модал шириной 400 px центрируется, левый/правый край выходит за экран на 12.5 px с каждой стороны (`(400 - 375) / 2 = 12.5 px`). Кнопки внутри модала в зоне overflow нажать невозможно. Backdrop корректно закрывает всё позади модала, но сам модал обрезан.

На desktop конфликтов нет: 550 px модал вписывается в типичный 1280+ px viewport.

#### 3.4.4 Column filter dropdown Skupina (`ItemsTable.tsx:740-807`)

Позиция: `absolute right-0 top-full` — относительно родительского `<div>` в `<thead>`, который имеет `position: sticky; top: 0; z-index: 10` (`ItemsTable.tsx:1009`). Тем самым стекинг-контекст dropdown'а определяется sticky-thead (z-index 10 на уровне страницы). BulkActionsBar с `z-50` (Tailwind = z-index 50) на уровне страницы теоретически перекрывает весь стекинг-контекст thead, включая dropdown (z-50 внутри z-10 родителя). Геометрически оба элемента редко пересекаются — dropdown открывается вниз от header, BulkActionsBar прибит к нижней кромке экрана — но при коротком списке или маленьком экране overlap возможен.

На мобильном: dropdown `min-w-[240px]` (`ItemsTable.tsx:742`) с `right-0` на viewport 375 px выравнивается по правому краю родительского div; если родитель `<div>` внутри горизонтально скроллируемой таблицы сдвинут, dropdown может выйти за левый край экрана.

#### 3.4.5 Undo/Redo toolbar (`ItemsTable.tsx:966-1001`)

Static `border-b` внутри `.card`, всегда видим при рендере таблицы. Высота ~40 px (padding `py-2` + icons 16 px + text 12 px). Не floating — geometric конфликтов нет. Вместе со sticky thead (~40 px) образует фиксированную зону ~80 px в верхней части таблицы. На мобильном с `maxHeight: calc(100vh - 260px)` итоговая высота скроллируемой data-области уменьшается дополнительно. Явного конфликта с другими floating panels нет; undo/redo доступны также через Ctrl+Z / Ctrl+Shift+Z (`ItemsTable.tsx:114-133`).

---

### 3.5 Информационные vs интерактивные — открытая дилемма

#### 3.5.1 Два элемента с неоднозначным статусом

В инвентаре (§ 1.2) зафиксированы два row-level элемента, которые визуально выглядят как индикаторы, но семантически являются триггерами действий:

**`CircleHelp` 12 px — role trigger** (`RowActionsCell.tsx:36-41, 180-205`). Иконка вопросительного знака рендерится как `ROLE_ICONS['unknown']` — она появляется на строках, где `rowRole === 'unknown'`, и означает "роль этой строки не определена". Визуально читается как информационный бейдж ("что-то неизвестно"). По клику открывает portal-dropdown (`RowActionsCell.tsx:208-249`) для выбора роли `main / subordinate / section`. Для строк с определённой ролью тот же button рендерит `ClipboardList` / `FileText` / `↳` — иконки, также визуально напоминающие категориальные маркеры, а не кнопки.

**`BarChart3` 16 px — TOVButton** (`ItemsTable.tsx:473-493`, `components/tov/TOVButton.tsx`). Иконка гистограммы рендерится на всех `rowRole === 'main'` строках. Когда `hasData === true` — фон кнопки тонирован оранжевым (`bg-accent-primary/20`), когда `false` — нейтральный. Tooltip: "Zobrazit rozpis zdrojů" / "Přidat zdroje". По клику открывает `<TOVModal>` (`TOVModal.tsx:196`, `fixed inset-0 z-50`) — полноэкранную панель resource breakdown. Иконка гистограммы и оранжевый тинт могут читаться как "статус: данные есть", а не как "кнопка: открыть панель".

#### 3.5.2 Почему это конфликтует с плоским стилем

Раздел 2.5.1 зафиксировал: grep по `Monolit-Planner/frontend/src/components/flat/` даёт **0 совпадений** по `hover:opacity`, `group-hover.*opacity`, `opacity-0.*group-hover`, `DropdownMenu`, `MoreHorizontal`, `MoreVertical`. В Planner Part A нет паттерна "элемент в строке, который выглядит как индикатор, но по клику или hover открывает что-то дополнительное".

Все иконки в Planner Part A однозначны по роли:
- `ChevronDown/Right` 14 px на INFO row — явная кнопка collapse/expand, стандартная семантика стрелки.
- `Zap` 13 px — явная кнопка действия (Calculate), не похожа на статусный маркер.
- `Trash2` 13 px с `opacity: 0.4` — явная кнопка удаления, притушенная, но семантически однозначная.
- `AlertCircle` 14 px — **чистый индикатор**: не кликабелен, только цвет + tooltip (`components/flat/FlatPositionsTable.tsx:803-809`).

В Part A не существует элемента, который одновременно выглядит как статус и является action-trigger.

#### 3.5.3 Дилемма для Proposals

Для каждого из двух элементов необходимо выбрать один из двух путей. Третьего по стилю Part A не дано.

**Путь A — inline-информация**: данные, которые сейчас за кликом, выносятся в саму строку как всегда видимый текст или бейдж. Клик не нужен — информация читается без взаимодействия. Паттерн из Part A: `AlertCircle` как статусный индикатор, subtype badge как категориальный маркер.

**Путь B — действие уходит с row-level**: trigger остаётся, но перемещается на уровень выше строки — в toolbar, detail panel, или активируется через отдельный клик на саму строку (не на иконку внутри неё). Паттерн из Part A: `Vypočítat` на Layer-1 INFO row (уровень element, не уровень work row), upload/export в FlatToolbar.

Для `CircleHelp` / role trigger вопрос: является ли `rowRole` информацией ("эта строка — секция"), которую достаточно показать как badge, или это редактируемый параметр, который требует action в строке? Раздел 1.2 фиксирует, что `rowRole` присваивается автоматически парсером при импорте — ручная коррекция нужна только при ошибке парсера.

Для `BarChart3` / TOVButton вопрос: является ли наличие TOV-данных статусом ("ресурсы расписаны"), который достаточно показать как текстовый бейдж или число в строке, или это точка входа в отдельную рабочую область, которой место в detail panel / отдельной вкладке?

Раздел 4 (Proposals) должен ответить на оба вопроса с конкретным выбором для каждого варианта.

---

## 4. Proposals

### 4.1 Вступление

#### 4.1.1 Ведущий принцип

Раздел 2.5.3 ("Следствие для Registry") сформулировал принцип, из которого исходят все варианты ниже. Цитата дословно:

> Если после раздела 3 (Conflicts) решим, что количество row-level действий в Registry избыточно — следует **сокращать**, перенося на уровни document / skupina / toolbar, а не **прятать** их в меню. Единственный импортируемый механизм снижения веса — `opacity: 0.4` для destructive. Всё, что за пределами этих двух стратегий, — дизайн-решение Registry, не цитата из Part A.

Раздел 3 зафиксировал, что количество действий избыточно (§ 3.2, § 3.3: 9 vs 3 иконок, ×3 разрыв). Значит принцип "сокращать, а не прятать" применим.

#### 4.1.2 Почему overflow-menu не рассматривается

Раздел 2.5.1 проверил `Monolit-Planner/frontend/src/components/flat/` grep'ами по семи паттернам overflow (`MoreHorizontal`, `MoreVertical`, `Ellipsis`, `DropdownMenu`, `overflow-menu`, `hover:opacity`, `group-hover.*opacity`) — **0 совпадений** по всем. Паттерн "⋯" меню отсутствует в эталоне Part A.

Добавление overflow-меню в Registry было бы отходом от эталона, а не следованием ему. Поскольку цель аудита — привести Registry к стилю Part A, паттерн "⋯" исключается из списка рассматриваемых вариантов. Это решение принято на основании Reference 2.5.1, не дизайн-предпочтения.

#### 4.1.3 Три варианта, которые будут рассмотрены ниже

- **Вариант A — Minimal**: перевод Registry на плоский стиль (spacing, типографика, цвет, padding, shadow из § 2.1–2.3), все row-level действия остаются на месте. Минимальный скоуп визуальной миграции, без изменения информационной архитектуры.

- **Вариант B — Lift**: вариант A + перенос части действий с row-level на слой выше — toolbar, skupina-row, bulk-bar, detail panel. Прямой паттерн Part A из § 2.5.2 (Planner поднимает upload/export/settings в toolbar, `Vypočítat` на element-уровень INFO row, удаление на element-уровень; work-row не имеет per-row actions).

- **Вариант C — Hybrid + Cell-click**: вариант B + замена части оставшихся row-level кнопок на click-cell-to-edit по примеру `<EditableNum>` из Planner (`components/flat/FlatPositionsTable.tsx:893-963`) и уже существующего `<EditablePriceCell>` в Registry (`ItemsTable.tsx:30-76`). Иконка-кнопка убирается полностью, взаимодействие идёт через клик на саму ячейку.

#### 4.1.4 Критерии сравнения

Варианты сравниваются по пяти осям. Каждая ось оценивается в сводной таблице раздела 5 по шкале "хуже / равно / лучше" относительно текущего состояния Registry.

| Критерий | Что меряется |
|---|---|
| **Discoverability** | Видит ли пользователь, что действие существует, без tooltip и без ховера. § 2.5 Part A: да для всех видимых действий. § 3.4: для Registry частично нет (hidden BulkActionsBar при отсутствии selection). |
| **Скорость доступа к частому действию** | Число кликов / расстояние движения курсора до самого частого действия (назначение skupiny). § 3.2.4 зафиксировал: сейчас `<SkupinaAutocomplete>` в последней колонке, требует horizontal scroll. |
| **Визуальный шум** | Число иконок в строке (§ 3.3: 9 vs 3). Количество одновременно видимых floating panels (§ 3.4). Ширина строки в px. |
| **Соответствие Part A** | Прямая цитата паттерна из § 2.1–2.5 или отход. Варианты, использующие паттерн из § 2.5.2, получают +; требующие нового паттерна — −. |
| **Объём работы по реализации** | Число файлов к правке, наличие миграций store/типов, риск регрессии в bulk/undo/filter-логике. Чем меньше, тем лучше. |

Для каждого варианта — ASCII-схема desktop + mobile, список затрагиваемых файлов, перечень действий с указанием куда они переезжают, оценка по пяти осям.

---

### 4.2 Вариант A — Minimal (визуальная миграция без архитектурных изменений)

#### 4.2.1 Описание

Сохранить полный набор row-level действий, зафиксированный в § 1.2 (17 элементов строки, включая 9 иконок-кнопок при полном состоянии). Изменить **только визуальный стиль** под паттерны Part A из § 2.1–2.4:

- Убрать `box-shadow` neomorph-слои (4-слойная тень `--shadow-panel`).
- Убрать alternating rows (`nth-child(even)`).
- Hover color перенести с cold `#ECEDEF` на warm `#F5F3F0`.
- Все иконки — `lucide-react` 2 px outlined (уже так), привести к двум размерам потока таблицы: **11 px** для chevrons/стрелок и **13 px** для всех остальных action-иконок (§ 2.4.2).
- Применить `.flat-el-info__sep` (1 × 24 px, `styles/flat-design.css:537-540`) как spacing-дивайдер между смысловыми группами действий внутри `column actions` (reorder / role / attach), вместо плотного `gap-0`.

Информационная архитектура не трогается: то же число кнопок в тех же ячейках, те же триггеры, те же модалки и dropdowns.

#### 4.2.2 Что меняется

| Токен / паттерн Part A | Источник в Reference | Применение в Registry (file:line) |
|---|---|---|
| `padding: 0 8px` на `<td>`, `padding-left: 16px` на `:first-child` | § 2.2 (`flat-design.css:465-472, 659`) | `rozpocet-registry/src/index.css:120` — заменить `var(--space-md)` на два правила |
| `--flat-row-h: 32px` (data), `--flat-header-h: 36px` | § 2.2 (`flat-design.css:64-65`) | `ItemsTable.tsx:943` `ROW_HEIGHT = 40` → `32`; CSS в `index.css` добавить фиксированный height |
| Hover `#F5F3F0` (`--flat-hover`) | § 2.3.2 (`flat-design.css:56`) | `rozpocet-registry/src/index.css:131-133` — заменить `var(--data-surface-alt)` на warm hex |
| Убрать alternating rows | § 2.3.3 (grep `nth-child` по `components/flat/` = 0) | `rozpocet-registry/src/index.css:135-137` — удалить правило |
| Убрать `box-shadow` на строках и на `.card` обёртке | § 2.2 observations ("нет `box-shadow` на рядах") | `rozpocet-registry/src/styles/tokens.css:74-77` (`--shadow-panel`) — заменить на `border: 1px solid var(--flat-border)` + `border-radius: 8px` |
| Border color `var(--flat-border)` = stone-200 | § 2.3.4 (`flat-design.css:51`) | `tokens.css:91` (`--edge-light: rgba(255,255,255,0.5)`) — заменить на `#E7E5E4` |
| Column header 11 px uppercase letter-spacing 0.05em | § 2.1 (`flat-design.css:442-446`) | `rozpocet-registry/src/index.css:112` (`.table th font-size: 13px`) → 11 px + `text-transform: uppercase; letter-spacing: 0.05em` |
| Data cell 13 px | § 2.1 (`flat-design.css:467`) | `rozpocet-registry/src/index.css:120` `.table td` → 13 px (сейчас 14 px) |
| Icon size 11 px (chevrons) | § 2.4.2 (`flat-design.css:682-683, 224`) | `ItemsTable.tsx:572-573` (ChevronRight/Down в Poř.) — уже 12, → 11 |
| Icon size 13 px (все action) | § 2.4.2 (`flat-design.css:576-592, 640`) | `RowActionsCell.tsx:169, 176` MoveUp/Down 11→оставить (уже ок); `:203` role 12→13; `:259` Link2 12→13; `ItemsTable.tsx:546` HardHat 14→13; `:873` Sparkles 16→13; `:881` Globe 16→13; `TOVButton.tsx:31` BarChart3 16→13; `:733` Filter 14→13 |
| Separator 1 × 24 px между группами действий | § 2.2 (`flat-design.css:537-540`), § 2.5.3 п. 4 | `RowActionsCell.tsx:162` (`<div className="flex items-center gap-0">`) — добавить два `<span class="flat-el-info__sep">` между MoveUp/Down и Role, между Role и Link2 |
| Orange accent — выбрать один hex | § 2.3 observations (оба существуют: `#F97316` Planner vs `#FF9F1C` Registry) | Решение оставить существующий Registry `#FF9F1C` (`tokens.css:49`) — для Minimal не менять, чтобы не трогать bulk orange, filter-active badge и подобное |
| `tabular-nums` глобально для числовых ячеек | § 2.1 observations | `ItemsTable.tsx:587, 646, 691, 700` — уже локально применено; в Minimal добавить `.flat-mono` helper и единый класс |

Всего правок: **9 CSS-токенов** (index.css, tokens.css) + **~8 size-атрибутов иконок** в трёх файлах (`ItemsTable.tsx`, `RowActionsCell.tsx`, `TOVButton.tsx`) + **2 separator-спана** в `RowActionsCell.tsx`.

#### 4.2.3 Что остаётся

Все 17 row-level элементов из § 1.2 — на своих местах, в тех же столбцах, с теми же handler'ами:

- `select` checkbox, `MoveUp`/`MoveDown`, role-trigger, `Link2` (conditional), `TOVButton`, `HardHat` (conditional), `Poř.` chevron+number, `Kód`, `Popis`, `MJ`, `Množství`, `EditablePriceCell`, `Cena celkem`, `SkupinaAutocomplete`, `Sparkles`, `Globe`.

Все floating panels из § 1.6 — без изменения позиции и z-index:

- `BulkActionsBar` (`fixed bottom-6 left-1/2 z-50`) — контент остаётся, только orange pill получает flat-стиль (убирается heavy shadow `0 8px 32px rgba(0,0,0,0.4)` в `BulkActionsBar.tsx:81`, заменяется на 1-px border).
- Role dropdown portal, Attach-to-parent modal, Column filter dropdown, TOVModal, ImportModal, AlertModal — без изменений.

Navigator (sheet-tabs strip в `App.tsx:1187-1263`, project header в `App.tsx:1270-1298`) — без изменений.

Store, типы, undoable actions, backend sync — без изменений.

#### 4.2.4 Схема desktop (ASCII)

Строка с полным состоянием (9 видимых икон: MoveUp + MoveDown + Role + Link2 (если subordinate) + TOV + HardHat + Chevron Poř. + Sparkles + Globe):

```
 column widths     20   70         32   28  50      110       300                50   80      ~140        ~140        ~200
                  ┌──┬──────────┬───┬───┬────┬────────┬─────────────────────────┬───┬──────┬────────────┬────────────┬─────────────────┐
 Part A header    │  │          │   │   │POŘ.│  KÓD   │  POPIS                  │MJ │MNOŽ. │  CENA JEDN.│  CELKEM    │  SKUPINA  [▼]   │
 (11px uppercase) └──┴──────────┴───┴───┴────┴────────┴─────────────────────────┴───┴──────┴────────────┴────────────┴─────────────────┘
                  ┌──┬──┬──┬│┬──┬│┬──┬──┬────┬────────┬─────────────────────────┬───┬──────┬────────────┬────────────┬─────────────────┐
 Data row 32px    │☐ │↑ │↓ │ │● │ │▥ │⛑ │› 001│221.25 │Beton třídy C30/37 XF4   │m³ │ 94,2 │  3 240,00  │ 30 587,40  │ beton ▸ [✦][⊕] │
 padding 0 8px    └──┴──┴──┴│┴──┴│┴──┴──┴────┴────────┴─────────────────────────┴───┴──────┴────────────┴────────────┴─────────────────┘
                           sep  sep
                    (1×24 divider)
 Legend: ↑↓ 11px  ● role 13px  ▥ TOV 13px  ⛑ HardHat 13px  › chevron 11px  ✦ Sparkles 13px  ⊕ Globe 13px
         fg stone-900  hover row #F5F3F0  border bottom 1px stone-200  no shadow  no zebra
```

Итого ширина ≈ 20 + 70 + 32 + 28 + 50 + 110 + 300 + 50 + 80 + 140 + 140 + 200 = **1 220 px** (практически та же что сейчас ~1 160 px; Minimal не переупаковывает столбцы).

#### 4.2.5 Схема mobile (ASCII, viewport 375 px)

```
 375 px viewport
 ├───────────────────────────────────────────────────────────────┤

 видимая область (скролл ещё не был):
 ┌──┬──┬──┬│┬──┬│┬──┬──┬────┬────────┬──────────────────────┐ → → → → →
 │☐ │↑ │↓ │ │● │ │▥ │⛑ │› 001│221.25 │Beton třídy C30/37 X…│    scroll right
 └──┴──┴──┴│┴──┴│┴──┴──┴────┴────────┴──────────────────────┘
                                                              (ещё ~845 px контента справа:
                                                               MJ, Množství, Cena jedn., Celkem,
                                                               Skupina + Sparkles + Globe)

 BulkActionsBar при selectedIds > 0:
                         ┌────────────────────────────────────────────┐
                         │ 3  vybráno │ 🗑 Vymazat │ 🗑 Smazat │ 🏷 Nastavit │ × │
                         └────────────────────────────────────────────┘
                         ↑ ширина ~500 px, overflow с обеих сторон viewport 375 px
                         ↑ fixed bottom-6, перекрывает последние ~96 px таблицы
```

На mobile плоский стиль снижает визуальный шум (нет neomorph-теней, warm hover, уже 1-px border вместо полупрозрачного), но **проблемы § 3.1 сохраняются**: суммарная ширина строки ~1 220 px, первый столбец не sticky, BulkActionsBar overflow, MoveUp/Down по-прежнему 11 px без 44-px контейнера. Визуально "тише", функционально — тот же overflow.

#### 4.2.6 Плюсы

1. **Минимальный риск регрессии** — store, типы, undoable actions, backend sync, BulkActionsBar / TOVModal / Parent-picker handler'ы не трогаются. Ничто не может сломать поведение `applyToSimilar`, `applyToAllSheets`, `updateItemParent`, undo-stack.
2. **Минимальный объём работы** — по оценке § 4.2.2 — ~9 CSS-токенов + ~8 size-атрибутов + 2 separator-спана. Три файла изменений (`index.css`, `tokens.css`, `RowActionsCell.tsx`, `ItemsTable.tsx`, `TOVButton.tsx` — по факту пять, но все правки точечные, ≤ 10 строк каждая).
3. **Discoverability не ухудшается** — всё, что сейчас видно, остаётся видимым. Пользователь, уже знающий Registry, не теряет ни одной точки входа.
4. **Полное сохранение поведения** — клавиатурные shortcuts (Ctrl+Z, Ctrl+Shift+Z), undo/redo stack, bulk operations, scroll positions, локальные настройки (`registry-group-manager-width` в localStorage) работают без изменений.
5. **Inter + JetBrains Mono остаются** — § 2.1 observations зафиксировали, что семейство шрифтов менять не обязательно, достаточно перенести **паттерн** (размеры, вес, uppercase на headers). Minimal так и делает.

#### 4.2.7 Минусы

1. **Gap ×3 по количеству иконок (§ 3.3) не закрывается** — строка по-прежнему содержит до 9 взаимодействующих иконок, Planner Part A — 3. Визуальный шум снижается за счёт уменьшения размеров и убранных теней, но количественный разрыв остаётся.
2. **Mobile-перекрытия § 3.1 смягчаются, но не устраняются**:
   - Horizontal scroll сохраняется (ширина ~1 220 px на viewport 375 px).
   - Checkbox не sticky — исчезает при скролле вправо.
   - Hit-area MoveUp/Down 11 px × 2 < 44 px iOS HIG — flat-стиль не увеличивает контейнер.
   - BulkActionsBar overflow на 375 px остаётся (пилюля ~500 px fixed).
3. **Dilemma § 3.5 не решается** — `CircleHelp` (`?`) и `BarChart3` (график) остаются как есть:
   - `CircleHelp` продолжает выглядеть как информационный знак и открывать dropdown по клику.
   - `BarChart3` продолжает выглядеть как статусный индикатор (с оранжевым тинтом при `hasData`) и открывать полноэкранный TOVModal.
   - Выбор "inline-инфо или action-на-слой-выше" из § 3.5.3 откладывается — Minimal оставляет гибридное поведение, не приводя его к одному из честных вариантов Part A.
4. **Принцип "сокращать, а не прятать" (§ 2.5.3 → § 4.1.1) применён только по стилю, не по архитектуре действий** — Minimal снижает визуальный вес, но не сокращает количество точек взаимодействия. По формальному критерию из § 4.1.4 "соответствие Part A" вариант получает неполный +: визуальные токены = соответствуют, архитектура row-level действий = отходит от § 2.5.2.
5. **Дублирование действий § 3.2.2 сохраняется** — `Sparkles` + `Globe` (две кнопки одного концептуального действия) и `MoveUp` + `MoveDown` (два button для одной операции) остаются в строке. Визуальная тишина без функционального упрощения.

---

### 4.3 Вариант B — Lift (подъём действий на уровни выше по паттерну Part A)

#### 4.3.1 Описание варианта

Применить паттерн § 2.5.2 дословно: действия, которые не нужны в каждой строке индивидуально, поднимаются на логически более высокий слой иерархии. Три слоя подъёма: (1) **toolbar заголовка skupiny** — действия, применяемые ко всей skupinе как единице (переименовать, удалить, "применить к подобным", счётчик позиций, сумма); (2) **bulk actions bar** — уже существующий `BulkActionsBar.tsx` (§ 1.6), расширенный за счёт действий, которые имеют смысл только при множественной выборке (bulk role change, bulk delete); (3) **detail panel** — inline-панель или bottom-sheet, открывающаяся при клике на строку, содержащая контекстные действия одной позиции (role-trigger, parent-picker, TOV breakdown, monolit navigation, delete). Row-level в результате оставляет только то, что нужно при одном быстром визуальном сканировании списка, с жёстким лимитом из § 2.4.4: **не более 3 интерактивных элементов в строке** (эталон Part A — 3 на самом богатом INFO row).

---

#### 4.3.3 Что остаётся в строке

По принципу из § 4.3.1 row-level фильтруется до элементов, которые нужны при одном быстром визуальном сканировании списка. Лимит из § 2.4.4 — не более 3 интерактивных иконок (Part A INFO row: chevron + Zap + Trash2).

**Терминологическое уточнение для этой подсекции и для баланса в § 4.3.6.** Inline-содержимое строки состоит из трёх категорий с разными лимитами:

- **Interactive icons** — кнопки-иконки с explicit action (`<button><Icon/></button>`). Лимит ≤ 3 по § 2.4.4 — строгий, это эталон Part A.
- **Click-cells** — data cell с click-to-edit или click-trigger affordance (паттерн § 2.5.2; примеры в Part A — `<EditableNum>`, в Registry уже — `<EditablePriceCell>` `ItemsTable.tsx:30-76`). Без лимита количества, visual weight несёт data, affordance вторична — не считаются в лимит иконок.
- **Non-interactive display** — бейджи и read-only data cells (текст, числа, subtype-badge без border). Без лимита, не создают action-веса.

В Variant B на row-level остаются **три interactive icons** + 4 click-cells + 4 non-interactive display (детально в балансе § 4.3.6). Ниже — только три interactive:

1. **Chevron expand/collapse** — 11 px (`ItemsTable.tsx:572-573`, условно при `rowRole === 'main' && subCount > 0`; на section-строке по расширению Variant B — для сворачивания всех položek внутри skupiny одним касанием). Остаётся inline, потому что это **структурный scan**: пользователь, пробегая глазами по 2 000-строчному документу, должен видеть, где есть подчинённые позиции и где сгруппированные секции, без открытия detail panel. Прямой аналог в Part A — chevron 14 px на INFO row (`components/flat/FlatPositionsTable.tsx:500-502`), который тоже живёт в row-level именно ради "одного взгляда на иерархию".

2. **BarChart3 (chart icon)** — 13 px (в Variant B — уменьшен с текущих 16 px, `TOVButton.tsx:31`, `ItemsTable.tsx:484`). Остаётся inline как **первичное действие анализа**: согласно Domain rules (CLAUDE.md → "Kiosk: BOQ Registry" + TOV modal workflow) просмотр rozpis zdrojů — ключевая пользовательская задача киоска после присвоения skupiny. Один клик должен вести к полному breakdown ресурсов. Этот выбор резолвит § 3.5 для Variant B по пути B (action остаётся точкой входа), но **статусная роль** (сейчас реализованная через тинт фона при `hasData`) выносится в отдельный inline-текстовый бейдж — см. пункт 3 ниже. Chart-icon становится чистой кнопкой-действием без индикаторного оттенка, однозначной по семантике (паттерн § 3.5.2 — иконки Part A не совмещают status + action).

3. **Inline status badge `▥ 45h · 180kg · 3t`** или `+N` subordinate count — **не интерактивный**, не считается в лимит 3 иконки. Реализует путь A из § 3.5.3 для информационной части TOV (или для subordinate-count, `ItemsTable.tsx:574-575`): данные, которые сейчас скрыты за кликом на TOVButton tinted-bg, становятся всегда видимым текстом. Прямой прецедент в Part A — subtype-badge (`.flat-badge`, `styles/flat-design.css:821-829`, 11 px, без border, только `background + color`) и `AlertCircle` как чистый status-индикатор (§ 3.5.2). Бейдж несёт **информацию без действия**; action живёт в соседнем chart-icon из пункта 2.

Четвёртое row-level состояние — `select` checkbox — отдельный случай: он не считается "иконкой действия", а является form-контролом для bulk-режима. Его судьба и то, всегда ли он виден, или появляется только после включения "режима выделения" — решается в § 4.3.6 вместе с расширением bulk bar. Всё остальное из списка 17 row-level элементов § 1.2 — MoveUp/Down, role-trigger, Link2, HardHat click-to-navigate, Sparkles, Globe, editable cells, skupina-autocomplete — распределяется между toolbar skupiny (§ 4.3.4), detail panel (§ 4.3.5), bulk bar (§ 4.3.6) или остаётся как cell-click-to-edit в data-ячейках (skupina и cena jednotková — уже реализованы как click-cell, не мигрируют).

---

#### 4.3.4 Что добавляется в toolbar заголовка skupiny

Новый компонент — горизонтальный toolbar, привязанный к заголовку текущей skupiny (напр. "SO 202202", "SO 301 — Mostní svršek"), отрисовывается **над блоком položek этой skupiny** и прокручивается вместе с ним. Действует на всю skupinу как единицу, не на отдельную položku. Заменяет собой row с `rowRole === 'section'` в визуальной роли заголовка-раздела (§ 1.3 — сейчас секционные строки содержат 10 пустых ячеек и 7 активных; в Variant B секция становится полноценным блоком `<header>` + toolbar, а не `<tr>` с дырами).

**Предварительная проверка Inventory по каждому кандидату:**

**MoveUp / MoveDown (`RowActionsCell.tsx:164-177`)** — проверено дословно: оба button вызывают `moveItemUp(projectId, sheetId, item.id)` и `moveItemDown(projectId, sheetId, item.id)` (`RowActionsCell.tsx:153-159`) → это **per-item manual reorder внутри листа**, не skupina-level sort. В toolbar skupiny **не переезжают**. Судьба этих двух button'ов решается в § 4.3.6 (bulk bar) — вариант из § 2.5.3 "либо в bulk-режим, либо в DnD-handle". Column-sort по Kód / Popis / Množství / Cena через клик на th уже есть (`ItemsTable.tsx:1015-1030`) и тоже остаётся, но это отдельный механизм.

**CircleHelp / role-trigger (`RowActionsCell.tsx:36-41, 180-205`)** — проверено: это НЕ help-тултип о skupine/каталоге, это trigger смены `rowRole` на текущей строке (`ROLE_ICONS.unknown` = `CircleHelp` только когда `rowRole === 'unknown'`). **Per-item**, не skupina-level. В toolbar skupiny **не переезжает** — отправляется в detail panel (§ 4.3.5).

**Skupina-management в Inventory 1.4** — сейчас размазано по трём местам: column-header Filter dropdown (`ItemsTable.tsx:714-810`), отдельный `<GroupManager>` collapsible card (`src/components/groups/GroupManager.tsx`), inline `<SkupinaAutocomplete>` в каждой строке. Filter и GroupManager остаются на своих местах (out-of-scope per task), но в toolbar skupiny поднимаются **быстрые действия над ТЕКУЩЕЙ skupinой**, чтобы не требовать открытия GroupManager для типового case "применить / переименовать / удалить эту одну группу".

**Что переезжает из row-level § 1.2 в toolbar skupiny:**

| # | Действие | Источник | Роль в toolbar skupiny |
|---|---|---|---|
| 16 | `Sparkles` — applyToSimilar | `ItemsTable.tsx:867-874` + handler `:301-358` | "Aplikovat na podobné" — применить текущую skupinu ко всем položkам с кодом ≥40 % similarity во всех листах проекта. Это skupina-level batch operation: семантика "присвоить THIS skupina-значение другим" живёт логически на уровне самой skupiny, а не отдельной стройки. Перенос одной кнопки вместо отрисовки на каждой строке снимает дублирование § 3.2.2. |
| 17 | `Globe` — applyToAllSheets | `ItemsTable.tsx:875-882` + handler `:361-383` | "Aplikovat globálně" — применить текущую skupinu ко всем položkам с точным `kod` во всех проектах всех листов. Та же семантика batch-operation skupina-уровня; сейчас дублируется на каждой row с одинаковой skupinой. В toolbar — один контрол для всей группы. |

**Что поднимается из существующего `<GroupManager>`** (быстрый доступ к частым skupina-management-действиям, без удаления GroupManager как полной CRUD-панели):

| Действие | Источник | Роль в toolbar skupiny |
|---|---|---|
| Rename skupiny | `GroupManager.tsx` (CRUD) | Inline-редактируемое имя (click → input). Frequent, сейчас за двумя кликами (открыть GroupManager → найти строку → редактировать). |
| Delete skupiny | `GroupManager.tsx:232-245` | Trash2 13 px с паттерном `opacity: 0.4` из § 2.4.5, `:hover → var(--red-500)`. Семантика "удалить ЭТУ группу" чётко скеширована на toolbar ЭТОЙ группы. Двухступенчатый confirm сохраняется. |

**Что добавляется нового** (не переезжает, а появляется как скупиная-уровня UI):

| Действие | Назначение |
|---|---|
| Chevron 11 px expand/collapse всех položek skupiny | Структурный toggle: свернуть skupinу целиком одним кликом. Аналог chevron на INFO row Planner (`components/flat/FlatPositionsTable.tsx:500-502`). Заменяет `rowRole === 'section'` визуальную роль. |
| Счётчик `N položek` + сумма `Σ Kč` | Информационные бейджи (не интерактивные, § 2.3.5 паттерн "bg + color без border"). Сейчас info-счётчик есть только в `groupStats` внутри filter-dropdown (`ItemsTable.tsx:172-185`) и в section total (`sectionTotals` at `:225-240`). В toolbar — всегда видимы без открытия вложенного UI. |

**ASCII-схема desktop:**

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ▼  SO 202202 — Mostní nosná konstrukce    ·    13 položek    ·   850 240,00 Kč          │
│                                                          [ ✦ Podobné ]  [ ⊕ Globálně ]  │
│                                                                           [ ✎ ] [ 🗑 ] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
  │  ↑ name (click to rename)       ↑ info badges       ↑ batch-apply       ↑ rename  delete
  │                                                                                0.4 opacity
  └─ chevron 11 px (expand / collapse all 13 rows below)

 padding 0 8px   font 13 px (name) + 11 px label uppercase letter-spacing 0.05 em (info)
 background var(--stone-50) (= .flat-el-colheader паттерн из § 2.3.3)
 bottom border 2 px stone-200 (= .flat-el-add завершитель элемента из § 2.3.4)
```

На узком desktop / планшете ряд `[Podobné] [Globálně] [✎] [🗑]` схлопывается в один overflow-свободный flex-row с переносом через `flex-wrap: wrap` (паттерн `.flat-toolbar` — `gap: 8px; padding: 8px 0; flex-wrap: wrap`, § 2.2, `styles/flat-design.css:979-984`), не через `⋯`-меню (запрещено § 4.1.2).

**Состояние для filtered/single-group view**: когда пользователь применил Skupina filter к одной группе, toolbar показывает только её; когда фильтр off — toolbar рендерится над КАЖДОЙ skupinой в скроллируемой таблице, не глобально (повторяемая "заголовочная полоса" для каждого блока položek, аналог повторяющихся INFO row на каждый element в Planner).

---

#### 4.3.5 Что добавляется в detail panel

**Что это.** Inline-раскрывающаяся панель под строкой, показывающая контекстные действия и подробности **одной** конкретной položky. Полноценный `<tr>`-блок, добавляемый сразу под активной строкой (паттерн аналогичный `.flat-el-info + .flat-el-colheader + .flat-work-row + .flat-el-add` иерархии в Planner Part A, § 2.3.3 — один element рендерится как стек из 4 слоёв; в Registry detail panel = один дополнительный слой под "главной" строкой položky).

**Когда открывается.** Клик по cell с текстовым телом строки — конкретно `kod` (`ItemsTable.tsx:600-611`) или `popis` (`ItemsTable.tsx:614-625`). Эти две ячейки — естественное "тело" строки: содержат идентифицирующую информацию, сейчас не-кликабельны (только cursor sort при клике на th). Остальные cells либо интерактивны как click-cell-edit (`EditablePriceCell`, `SkupinaAutocomplete`), либо являются данными (MJ, Množství, Cena celkem), либо уже заняты под inline-действия из § 4.3.3 (chevron, BarChart3, checkbox).

**Когда закрывается.** Три пути: (1) повторный клик по той же строке на `kod`/`popis`; (2) клик на кнопку закрытия `<X>` 13 px внутри панели (паттерн § 1.6 — TOVModal `FlatTOVSection.tsx:224` как `X` 11 px, здесь 13 px ради туча-цели); (3) клик по `kod`/`popis` **другой** строки — текущая панель схлопывается, новая разворачивается (single-open семантика: максимум одна detail-панель на таблицу одновременно, чтобы не плодить визуальный шум и не ломать вертикальный ритм).

**Inventory-контроль — полное распределение 17 row-level элементов § 1.2:**

| # | Элемент Inventory § 1.2 | Куда уходит в Variant B | Подсекция |
|---|---|---|---|
| 1 | `select` checkbox | bulk-режим (активируется long-press / Shift-click) | § 4.3.6 |
| 2 | `MoveUp` 11 px | detail panel | **здесь** |
| 3 | `MoveDown` 11 px | detail panel | **здесь** |
| 4 | role-trigger (CircleHelp / ClipboardList / FileText / ↳) | detail panel | **здесь** |
| 5 | `Link2` 12 px (subordinate only) | detail panel | **здесь** |
| 6 | `TOVButton` (BarChart3 16 px) | inline — action (13 px, без tinted-bg статуса) | § 4.3.3 |
| 7 | `HardHat` 14 px (monolit) | inline — как status badge 11 px; **click-navigate to Monolit kalkulátor** → detail panel | **здесь** |
| 8 | Poř. chevron + `+N` badge + line number | inline (chevron + non-interactive badge) | § 4.3.3 |
| 9 | `kod` | inline data cell; **click → открывает detail panel** | **здесь** (trigger) |
| 10 | `popis` | inline data cell; **click → открывает detail panel** | **здесь** (trigger) |
| 11 | `mj` | inline data cell | — |
| 12 | `mnozstvi` | inline data cell | — |
| 13 | `cenaJednotkova` (EditablePriceCell) | inline click-cell-to-edit | — (pattern уже применён) |
| 14 | `cenaCelkem` | inline data cell (secular + section total) | — |
| 15 | `SkupinaAutocomplete` | inline click-cell-to-edit (cell-level) | — (pattern уже применён) |
| 16 | `Sparkles` (applyToSimilar) | toolbar skupiny | § 4.3.4 |
| 17 | `Globe` (applyToAllSheets) | toolbar skupiny | § 4.3.4 |

Каждый из 17 элементов размещён ровно один раз. Ничто не дублируется на двух уровнях. Ничто не потеряно.

**Действия, переезжающие в detail panel (из таблицы выше — 4 per-item действия + 1 navigation):**

| Действие | Источник в Registry | Почему в detail, а не inline / toolbar |
|---|---|---|
| `<MoveUp>` 13 px + `<MoveDown>` 13 px (вертикально или горизонтально — подряд, с `.flat-el-info__sep` разделителем 1×24 px) | `RowActionsCell.tsx:164-177` + handlers `moveItemUp` / `moveItemDown` `:153-159` | Per-item reorder — действие **редкое** (§ 3.2.3 зафиксировал: порядок строк определяется источником Excel/XML, ручная коррекция нужна при ошибке парсера). Две кнопки, всегда видимые в row, не окупают место: ×2 иконки на 2 000 строк = 4 000 visible icons за редкое действие. В detail — два button в стороне "Reorder", доступны когда пользователь явно вызвал контекст позиции. |
| Role-trigger 13 px (портал-dropdown меняет `rowRole` на `main / subordinate / section`) | `RowActionsCell.tsx:36-41, 180-205` + `updateItemRoleUndoable` | Per-item role — **редкое**: `rowRole` присваивается парсером при импорте, ручная коррекция только при ошибке (§ 3.2.3). В detail — в информационном блоке "Role: [Hlavní ▼]" с inline dropdown, рядом с "Parent: …" (для subordinate). Role-change **должен быть виден рядом с полным контекстом** (код, название, родитель), а не в узкой action-зоне строки, где семантика иконки (ClipboardList = main? FileText = section?) не считывается без tooltip. |
| `<Link2>` 13 px "Připojit k nadřazené položce" + resizable parent-picker modal | `RowActionsCell.tsx:252-405` + handler `:148-151` + 550 × 500 модалка | Conditional (только `rowRole === 'subordinate'`). Привязка к родителю — **редкое** конфигурационное действие, ставится один раз при классификации и дальше не меняется. В detail — одна кнопка "Změnit rodiče" рядом с показом текущего родителя (`parentItemId` resolved в `kod` + `popis`). Modal-picker `RowActionsCell.tsx:262-405` остаётся как вторичная подмодалка; мобильный overflow § 3.4.3 резолвится отдельно (detail panel сам по себе full-width / bottom-sheet, ограничитель 400 px становится неактуален). |
| `<HardHat>` click → `window.open(monolit_url)` navigate в Monolit kalkulátor | `ItemsTable.tsx:530-548` | HardHat как **status-индикатор** (цвет = severity из `conflictMap` — match/info/warning/conflict) остаётся inline как 11 px badge с tooltip — чистый паттерн `AlertCircle` из § 3.5.2 ("только цвет + tooltip, не кликабелен"). **Action** же ("открыть в Monolit kalkulátor в новой вкладке") переезжает в detail panel как explicit button `↗ Otevřít v Monolitu` — видим полный контекст `mp.part_name`, `kros_total_czk`, `days`, `crew_size` рядом с кнопкой, и пользователь осознанно нажимает, а не попадает на иконку в тесной группе action'ов. Это прямое применение § 3.5.3 — раздельный путь A (status inline) + путь B (action в detail) для одного элемента, который сейчас совмещает обе роли. |
| Delete положки (сейчас отсутствует single-delete, есть только bulk) | нет в § 1.2 — добавляется в Variant B | § 2.4.5 "opacity 0.4 паттерн для destructive" применим только если single-delete существует. В Registry сейчас удалить одну положку можно ТОЛЬКО через selectedIds → BulkActionsBar "Smazat". В detail panel появляется `<Trash2>` 13 px с `opacity: 0.4` + `:hover → var(--red-500)` + `title="Smazat pozici"` + `confirm()` перед удалением. Одна семантика на паттерн — иконка всегда означает необратимое удаление **текущей** položky. |

**Информационное содержимое detail panel (не действия, а данные, которые сейчас либо обрезаются в ячейке, либо не показываются вообще):**

| Поле | Источник | Почему в detail |
|---|---|---|
| Полный `popis` без horizontal-scroll clip | `ParsedItem.popis` | Сейчас `popis` cell имеет `cell-scrollable` класс (`ItemsTable.tsx:617` + `ItemsTable.css:7-31`) — длинные описания (часто 150+ символов) scrollable в 300 px cell. В detail panel — полный текст без обрезки, `font-size: 13 px, line-height: 1.5`, max-width: none. |
| Полный `kod` + классификация каталога (OTSKP 6-digit / ÚRS 9-digit) | `detectCatalog()` в `src/utils/position-linking.ts` | Мета-бейдж `[OTSKP]` / `[ÚRS]` 11 px с `.flat-badge` паттерном § 2.3.5. Сейчас каталог вычисляется, но в строке не показан (§ 1.1 отмечает: "классификация детерминирована `detectCatalog()`, а не действие пользователя"). В detail — explicit. |
| Полный `rowRole` + parent info (если subordinate) | `ParsedItem.rowRole` + `parentItemId` | Sekce "Role: [Hlavní ▼] · Rodič: 001 — Beton C30/37" с dropdown role + link на parent. Решает проблему § 1.3 "секционные строки визуально читаются как строки с дырами". |
| Subordinate-count `+N` развёрнутый список | `subordinateCounts.get(item.id)` (`ItemsTable.tsx:214-222`) | Сейчас только badge `+3`; в detail — компактный список с kod + popis первых 5 подчинённых, "Zobrazit všech N" link. |
| Monolit payload детализация | `ParsedItem.monolith_payload` (`ItemsTable.tsx:502-527`) | Сейчас всё за HardHat tooltip: `part_name`, `kros_total_czk`, `days`, `crew_size`, severity. В detail — явные строки данных + action-кнопка `↗ Otevřít v Monolitu`. |
| TOV-summary | `getItemTOV(item.id)` + inline chart-icon в § 4.3.3 | Inline бейдж "▥ 45 h · 180 kg · 3 t" из § 4.3.3 дублируется в detail как full-table view + кнопка `[ Celý rozpis → ]` открывающая существующий `<TOVModal>` `TOVModal.tsx:196` (модалка сохраняется без изменений — она уже стандартный fixed-inset-0 pattern, конфликтов в § 3.4 не имеет). |
| BOQ line-number `Poř.` + оригинальные поля импорта | `item.boqLineNumber` + raw-parser поля | Сейчас только цифра в 50 px cell; в detail — explicit "Pořadové číslo: 001 · Import: Stavba_202.xlsx, list 3, řádek 142". Помогает при аудите импорта. |

**Схема desktop (ASCII):**

```
обычная строка (detail закрыта):
┌──┬──┬─────┬────────┬──────────────────────────────┬──┬─────┬──────────┬──────────┬──────────────┐
│☐ │› │ 001 │21341   │DRENÁŽNÍ VRSTVA Z KAMENIVA    │m³│94,2 │ 3 240,00 │30 587,40 │ beton ▼  ▥45h│
└──┴──┴─────┴────────┴──────────────────────────────┴──┴─────┴──────────┴──────────┴──────────────┘
                     ↑ click kod или popis — открывает detail panel

 строка с раскрытой detail (чуть темнее фон — var(--stone-100) как .flat-el-info):
┌──┬──┬─────┬────────┬──────────────────────────────┬──┬─────┬──────────┬──────────┬──────────────┐
│☐ │▾ │ 001 │21341   │DRENÁŽNÍ VRSTVA Z KAMENIVA    │m³│94,2 │ 3 240,00 │30 587,40 │ beton ▼  ▥45h│
├──┴──┴─────┴────────┴──────────────────────────────┴──┴─────┴──────────┴──────────┴──────────────┤
│                                                                                              [×]│
│  DRENÁŽNÍ VRSTVA Z KAMENIVA HRUBÉHO DRCENÉHO FRAKCE 16/32 MM   [OTSKP]   Poř. 001              │
│                                                                                                 │
│  Role:   [● Hlavní ▼]        Rodič:  —              Podřízené: 3  → Zobrazit                   │
│  TOV:    ▥ 45 h · 180 kg · 3 t                            [ Celý rozpis → ]                    │
│  Monolit: ⛑ 142 500 Kč · 3,5 dn · 6 lidí          [ ↗ Otevřít v Monolitu ]                     │
│  Import: Stavba_202.xlsx · list 3 · řádek 142                                                  │
│  ────────────────────────────────────────────────────────────────────────────────────────────  │
│  Reorder: [ ↑ Nahoru ]  [ ↓ Dolů ]                                          [ 🗑 Smazat pozici ]│
│                                                                              ↑ opacity 0.4     │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

 Legend: bg var(--stone-100) (как .flat-el-info)
         borders: top = 2 px stone-300 (как .flat-el-info bottom)
                  bottom = 2 px stone-200 (как .flat-el-add завершитель)
         font 13 px body · 11 px labels uppercase · 11 px badges
         no box-shadow · no zebra · warm hover var(--flat-hover) #F5F3F0 на внутренних action'ах
```

`▾` — тот же chevron из § 4.3.3, но при открытой detail панели он меняется `ChevronRight → ChevronDown` для визуального совпадения с состоянием. Chevron продолжает отвечать **только** за expand/collapse subordinates, открытие detail panel — click на `kod`/`popis`, не на chevron. Две разные interaction-zones, независимые друг от друга (если у main row есть subordinates И открыта detail panel — оба состояния активны одновременно: subordinates видны ниже detail-блока, detail-блок остаётся приклеен к своему main row).

---

#### 4.3.6 Bulk actions bar — расширение существующего компонента

**Что существует сейчас.** `<BulkActionsBar>` уже реализован в `src/components/items/BulkActionsBar.tsx:78-158`. Variant B расширяет состав кнопок, **не** трогает позиционирование (`fixed bottom-6 left-1/2 -translate-x-1/2 z-50`), z-index, или логику появления (`selectedCount === 0 → return null`, `:32-34`). Геометрические конфликты из § 3.4.1 (overflow на 375 px, перекрытие последних 96 px таблицы) — отдельная задача, которая в рамках Variant B решается стилизацией (уплощение orange pill + переход на full-width bar на mobile через media-query), но сам архитектурный паттерн "fixed bottom bar при selection" сохраняется.

**Что в bar уже есть** (из `BulkActionsBar.tsx`):

| # | Кнопка | Icon | Handler | Источник |
|---|---|---|---|---|
| 1 | "Vymazat skupiny" | `Eraser` 16 px | `handleBulkClearSkupiny` → `bulkSetSkupinaUndoable(updates, null)` | `BulkActionsBar.tsx:95-102` + `:49-56` |
| 2 | "Smazat" | `Trash2` 16 px | `handleBulkDelete` → `deleteItem(...)` в цикле с `confirm()` | `BulkActionsBar.tsx:104-112` + `:36-47` |
| 3 | "Nastavit skupinu" + inline dropdown с `<SkupinaAutocomplete>` | `Tag` 16 px | `handleBulkSetSkupina(skupina)` → `bulkSetSkupinaUndoable(updates, skupina)` | `BulkActionsBar.tsx:114-145` + `:58-75` |
| 4 | "Zrušit" (clear selection) | `X` 18 px | `onClearSelection()` callback | `BulkActionsBar.tsx:147-155` |

Эти четыре действия не трогаются в Variant B — только размеры иконок приводятся к шкале § 2.4.2 (16 → 13 px, 18 → 13 px) и убирается heavy shadow `0 8px 32px rgba(0,0,0,0.4)` (`BulkActionsBar.tsx:81`) → заменяется на `1 px solid var(--flat-border)` по паттерну § 2.3.4.

**Что расширяется из row-level § 1.2.**

Сначала механика `select` checkbox (#1 из Inventory § 1.2). Checkbox **остаётся inline** в том же положении (column `select` 20 px, `ItemsTable.tsx:435-455`) — он не мигрирует в другую плоскость, потому что без visible-в-строке контрола пользователь не имеет точки входа в multi-select режим. Семантическая связка: **checkbox — входная точка, BulkActionsBar — следствие**. Variant B не меняет пару (form-control + floating bar). В § 4.3.3 checkbox был явно отложен сюда: finalized — остаётся inline как form-control, не считается "иконкой действия" в лимит 3, активирует `<BulkActionsBar>` при `selectedIds.size > 0`.

**Новое действие, поднятое из row-level** (один пункт, остальные per-item не имеют bulk-смысла — обосновано ниже):

| Новая кнопка | Icon | Источник в row-level | Почему имеет смысл массово |
|---|---|---|---|
| "Změnit roli" + inline dropdown (main / subordinate / section / unknown) | role-icon 13 px (динамический: ClipboardList / ↳ / FileText / CircleHelp) + ChevronDown 11 px | `RowActionsCell.tsx:36-41, 180-205` + `updateItemRoleUndoable` | Частый кейс: парсер при импорте classifier'ом `detectCatalog()` неверно определил `rowRole` у целой группы строк (напр. 20 строк без 6-значного kod маркированы как `unknown`). В row-level (сейчас и в detail panel § 4.3.5) это решается один клик на строку. Bulk-действие сворачивает 20 кликов в 1 + 20 selections. Это прямой перенос паттерна из `BulkActionsBar.tsx:104-112` где Trash2 аналогично сокращает N индивидуальных удалений. |

**Что НЕ переезжает в bulk** (и почему, для полноты inventory-контроля):

- **MoveUp / MoveDown (#2, #3)**. Bulk-reorder "переместить N выбранных на P позиций" семантически мутный — что значит "переместить 7 выделенных на 3 вверх" когда между ними есть невыделенные? Требует гораздо более сложной UI-модели (DnD, "sort by field X among selection"). Не стоит кнопки. Остаются в detail panel § 4.3.5 как per-item explicit reorder.
- **Link2 (#5)**. Bulk-attach "прикрепить N выбранных subordinate к одному parent" теоретически возможен, но реально редкий: subordinate-rows обычно уже корректно привязаны парсером по proximity (`detectCatalog` + heuristics). Если парсер ошибся у 10 subordinate подряд — они обычно принадлежат **разным** parent'ам, не одному. Bulk-pick-parent с единственным целевым kod неудобен. Остаётся в detail panel § 4.3.5 как per-item modal.
- **HardHat click-navigate (#7 action-half)**. Bulk-open в новых вкладках — anti-pattern (20 tabs одновременно). Остаётся в detail panel § 4.3.5 как explicit button.
- **Sparkles / Globe (#16, #17)**. Уже живут в toolbar skupiny § 4.3.4 с семантикой "применить THIS skupina к похожим položkам". В bulk они бы пересеклись с существующим `Tag` "Nastavit skupinu" (#3 в текущем BulkActionsBar). Дублирование § 3.2.2 решаем не тиражированием, а концентрацией: Sparkles/Globe = skupina-уровень, Tag = selection-уровень, непересекающиеся контексты.

**Inventory-контроль — финальный баланс 17 row-level элементов § 1.2:**

| # | Элемент | Основное размещение | Дополнительное (если применимо) |
|---|---|---|---|
| 1 | `select` checkbox | **inline (trigger)** + bulk bar (consequence) | § 4.3.6 |
| 2 | `MoveUp` | detail panel | § 4.3.5 |
| 3 | `MoveDown` | detail panel | § 4.3.5 |
| 4 | role-trigger | detail panel | bulk bar (массовое изменение) — § 4.3.6 |
| 5 | `Link2` (subordinate only) | detail panel | § 4.3.5 |
| 6 | `TOVButton` (BarChart3) | inline — action | § 4.3.3 |
| 7 | `HardHat` | **inline — status badge** + detail panel — action button | § 4.3.3 + § 4.3.5 |
| 8 | Poř. chevron + `+N` + line number | inline — chevron + non-interactive badge | § 4.3.3 |
| 9 | `kod` cell | inline data + click-trigger для detail | § 4.3.5 (trigger) |
| 10 | `popis` cell | inline data + click-trigger для detail | § 4.3.5 (trigger) |
| 11 | `mj` cell | inline data | — |
| 12 | `mnozstvi` cell | inline data | — |
| 13 | `EditablePriceCell` | inline click-cell-to-edit | — (паттерн § 2.5.2 уже применён) |
| 14 | `cenaCelkem` cell | inline data (+ section-total когда row = section) | — |
| 15 | `SkupinaAutocomplete` cell | inline click-cell-to-edit | — (паттерн § 2.5.2 уже применён) |
| 16 | `Sparkles` | toolbar skupiny | § 4.3.4 |
| 17 | `Globe` | toolbar skupiny | § 4.3.4 |

**Суммы по размещениям** (действие может быть двойным как #7, #1, #4 — это легитимные dual-role применения). Inline размещения дополнительно разнесены по трём категориям с разными лимитами:

- **Inline — interactive icons (кнопки-иконки в строке)** · лимит ≤ 3 (§ 2.4.4) · **счёт: 3** — #1 `select` checkbox (form-control), #6 BarChart3 (action), #8 Poř. chevron (toggle). В Variant B ровно этот предел; добавление четвёртой кнопки-иконки в row нарушило бы эталон Part A.
- **Inline — click-cells** (data cell с `click-to-edit` / `click-trigger` affordance, паттерн § 2.5.2) · без лимита количества · **счёт: 4** — #9 `kod` (click-trigger → detail), #10 `popis` (click-trigger → detail), #13 `EditablePriceCell`, #15 `SkupinaAutocomplete`. Считаются частью content-area, не action-toolbar — visual weight несёт data, click-affordance вторичен.
- **Inline — non-interactive display** (badges / read-only cells) · без лимита · **счёт: 4** — #7 HardHat status badge (color + tooltip only), #11 `mj`, #12 `mnozstvi`, #14 `cenaCelkem`. Чистая информация, action-веса в строке не создают.
- **Toolbar skupiny (§ 4.3.4)**: **2 элемента** (#16, #17).
- **Detail panel (§ 4.3.5)**: **5 элементов** (#2, #3, #4, #5, #7 action-half).
- **Bulk bar (§ 4.3.6)**: **2 элемента** — #1 как trigger + #4 как массовое дополнение к per-item detail-handler.
- **Cell-click / уже-паттерн § 2.5.2**: #13, #15 — не мигрируют, уже реализованы (подмножество inline click-cells выше).

Сумма уникальных элементов: **17**. Сумма размещений с учётом dual-role (#1 inline + bulk, #4 detail + bulk, #7 inline-status + detail-action): **20**. Разница 3 = три элемента с осознанной двойной ролью из § 3.5.3 (путь A + путь B для status+action-совмещений) или из mechanic-based separation (checkbox как form-control ≠ bulk-bar как floating panel).

**Вариант B соблюдает лимит § 2.4.4 (≤ 3 интерактивные иконки в строке); click-cells и display-cells не входят в этот лимит, потому что не увеличивают action-вес строки** — они содержат данные, а affordance (click-to-edit / click-trigger) активируется прямо на content-cell без отдельной иконки-кнопки.

**Вне row-level § 1.2**, из § 1.4 (skupina-management, 4 места) и § 1.6 (floating panels, 7 компонентов) — ничего не мигрирует в Variant B, за исключением быстрых rename+delete уже существующих в `<GroupManager>`, которые в toolbar skupiny § 4.3.4 получают **дополнительную** surface (не заменяя GroupManager как полную CRUD-панель). Navigator (§ 1.5 Rozpočet-document) — целиком out-of-scope.

**ASCII-схема desktop:**

```
состояние без selection (selectedCount === 0):
 [bulk bar не отрендерен, return null — BulkActionsBar.tsx:32-34]

состояние с 3 выбранными (selectedCount === 3):
                          ┌─────────────────────────────────────────────────────────────────────┐
                          │  3  vybrány  │  Vymazat skupiny  │  Smazat  │  Nastavit skupinu ▼  │ 
                          │              │  Změnit roli ▼    │  ×  Zrušit                       │
                          └─────────────────────────────────────────────────────────────────────┘
                           fixed bottom-6  left-1/2  -translate-x-1/2  z-50
                           1 px solid stone-200 border  · no shadow  · bg orange-500  · text white
                           icons 13 px  font 13 px (labels)  · padding 8px 16px

состояние с 3 выбранными на mobile 375 px (media-query full-width адаптация):
┌──────────────────────────────────────────────────────────────────────────────┐
│  3 vybrány                                                               ×   │
│  [Vymazat skupiny] [Smazat] [Nastavit ▼] [Role ▼]                            │
└──────────────────────────────────────────────────────────────────────────────┘
 fixed bottom-0 left-0 right-0 w-full · z-50 · padding-bottom safe-area-inset
 кнопки wrap в 2-3 строки через flex-wrap; bar не overflow за края viewport
```

"Změnit roli ▼" открывает dropdown абсолютно-позиционированный `bottom-full` относительно своей кнопки (паттерн из существующего "Nastavit skupinu" в `BulkActionsBar.tsx:125-144`), min-w-280 px на desktop / полная ширина bar'а на mobile. `bulkSetRole(updates)` — новый store-метод по аналогии с `bulkSetSkupinaUndoable` и `updateItemRoleUndoable`, интегрируется в `useUndoableActions` как undo-able операция.

---

#### 4.3.7 Схема desktop (ASCII, четыре состояния)

В каждой схеме три inline-категории из § 4.3.3 / § 4.3.6 визуально размечены: **ICN** (interactive icon, лимит ≤ 3) в `[квадратных]` скобках, **CCL** (click-cell с edit-affordance, паттерн § 2.5.2) в `{фигурных}` скобках с пунктирной линией `········` снизу (сигнал "click here to edit"), **DSP** (non-interactive display) — обычный текст без скобок и без подчёркивания.

---

**Состояние 1 — Заголовок skupiny с toolbar (§ 4.3.4)**

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  [▸]   SO 202202 — Mostní nosná konstrukce          13 položek         850 240,00 Kč                          │
│   ICN    {rename on click}                          DSP                DSP                                    │
│         ·······························                                                                       │
│                                                                       [✦ Podobné] [⊕ Globálně] [✎] [🗑 0.4]  │
│                                                                        ICN         ICN         ICN   ICN      │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 bg var(--stone-50) (.flat-el-colheader paттерн § 2.3.3)  · border-bottom 2px stone-200  · no shadow
 padding 8px 10px  · font 13px body · 11px uppercase info-badges  · chevron 11px  · action icons 13px
```

*Изменилось относительно текущего Registry:* сейчас skupina-заголовки — это `<tr rowRole="section">` строки с 10 пустыми ячейками из 17 (§ 1.3); в Variant B они превращаются в полноценный `<header>`-блок с skupina-уровневым toolbar. Действия `Sparkles` + `Globe`, которые сейчас дублируются на каждой строке внутри skupiny (`ItemsTable.tsx:865-884`), уходят одним экземпляром в этот toolbar. `✎ Rename` и `🗑 Delete` — быстрые surface для действий из `<GroupManager>`, сам GroupManager как полная CRUD-панель остаётся.

---

**Состояние 2 — Обычная строка (selection пустой, detail закрыт)**

```
Layer 2 column header (.flat-el-colheader 28px, 11px uppercase, letter-spacing 0.05em):
┌──┬──┬─────┬──────────┬─────────────────────────────────┬───┬──────┬──────────┬──────────┬────────────┬───┬────┐
│  │  │POŘ. │   KÓD    │  POPIS                          │MJ │MNOŽ. │CENA JEDN.│ CELKEM   │  SKUPINA   │MON│TOV │
└──┴──┴─────┴──────────┴─────────────────────────────────┴───┴──────┴──────────┴──────────┴────────────┴───┴────┘

Layer 3 data row (.flat-work-row 32px, padding 0 8px):
┌──┬──┬─────┬──────────┬─────────────────────────────────┬───┬──────┬──────────┬──────────┬────────────┬───┬────┐
│[☐]│[›]│ 001 │ {21341}  │ {DRENÁŽNÍ VRSTVA Z KAMENIVA}    │m³ │ 94,2 │{3 240,00}│30 587,40 │ {beton ▼}  │ ⛑ │[▥] │
│   │  │ +3  │ ········ │ ··················              │   │      │ ········ │          │ ·········  │   │    │
└──┴──┴─────┴──────────┴─────────────────────────────────┴───┴──────┴──────────┴──────────┴────────────┴───┴────┘
 ICN ICN  DSP    CCL              CCL                      DSP  DSP     CCL        DSP        CCL       DSP  ICN
  #1  #8  #8     #9               #10                     #11  #12      #13        #14        #15       #7   #6

 Inventory-refs: #1 checkbox  #6 BarChart3 13px  #7 HardHat 11px status badge (color-only tooltip)
                 #8 chevron 11px + +N non-interactive badge + line number
                 #9 kod click→detail   #10 popis click→detail   #13 EditablePriceCell   #15 SkupinaAutocomplete
                 #11 mj   #12 množství   #14 cena celkem — все DSP
 Counts: 3 ICN (within § 2.4.4 limit) + 4 CCL + 4 DSP
```

*Изменилось:* строка содержит **3 interactive icons** вместо 9 (gap ×3 из § 3.3 закрыт). Пунктирное подчёркивание под четырьмя click-cells — единый визуальный маркер "click here to edit / open", прямой перенос паттерна `<EditableNum>` из Part A (`components/flat/FlatPositionsTable.tsx:893-963`, где click на ячейку превращает её в input). `MoveUp` + `MoveDown` + role-trigger + `Link2` + `HardHat click-navigate` + `Sparkles` + `Globe` убраны из строки — они живут в detail (§ 4.3.5) / toolbar skupiny (§ 4.3.4) / bulk bar (§ 4.3.6).

---

**Состояние 3 — Строка при selection (3 položky выбраны → bulk bar активен)**

```
Layer 3 data row, selected (bg var(--flat-selected) #EDEBE8, § 2.3.2):
┌──┬──┬─────┬──────────┬─────────────────────────────────┬───┬──────┬──────────┬──────────┬────────────┬───┬────┐
│[▣]│[›]│ 001 │ {21341}  │ {DRENÁŽNÍ VRSTVA Z KAMENIVA}    │m³ │ 94,2 │{3 240,00}│30 587,40 │ {beton ▼}  │ ⛑ │[▥] │
│   │  │ +3  │ ········ │ ··················              │   │      │ ········ │          │ ·········  │   │    │
└──┴──┴─────┴──────────┴─────────────────────────────────┴───┴──────┴──────────┴──────────┴────────────┴───┴────┘
(…ещё 2 selected row с таким же highlightом ниже по списку…)

BulkActionsBar (fixed bottom-6 left-1/2 -translate-x-1/2 z-50 — геометрия из § 4.3.6 сохранена):
                          ┌─────────────────────────────────────────────────────────────────────────┐
                          │  3 vybrány   │  Vymazat skupiny  │  Smazat  │  Nastavit skupinu ▼       │
                          │              │  Změnit roli ▼    │  × Zrušit                            │
                          └─────────────────────────────────────────────────────────────────────────┘
                           icons 13px  · font 13px labels  · bg orange-500  · 1px border stone-200
                           no heavy shadow (заменена с rgba(0,0,0,0.4) на flat-border по § 2.3.4)
```

*Изменилось:* checkbox `▣` (checked-state) остаётся inline в том же 20 px столбце — § 4.3.6 финализировал, что checkbox это form-control, не action-icon, не входит в лимит 3. BulkActionsBar расширен: добавлена `Změnit roli ▼` (новый dropdown — bulk-fix для misclassified parser результатов). Heavy shadow убран. Позиция `fixed bottom-6` и z-index 50 не менялись — § 3.4.1 overlap с последними 96 px таблицы остаётся archit-проблемой, её решение (sticky bottom внутри scroll-container вместо page-fixed) — за пределами Variant B scope.

---

**Состояние 4 — Строка с открытым detail panel (§ 4.3.5)**

```
Main row (chevron флипнулся в ▾ для индикации что detail открыт):
┌──┬──┬─────┬──────────┬─────────────────────────────────┬───┬──────┬──────────┬──────────┬────────────┬───┬────┐
│[☐]│[▾]│ 001 │ {21341}  │ {DRENÁŽNÍ VRSTVA Z KAMENIVA}    │m³ │ 94,2 │{3 240,00}│30 587,40 │ {beton ▼}  │ ⛑ │[▥] │
│   │  │ +3  │ ········ │ ··················              │   │      │ ········ │          │ ·········  │   │    │
├──┴──┴─────┴──────────┴─────────────────────────────────┴───┴──────┴──────────┴──────────┴────────────┴───┴────┤
│                                                                                                           [×] │
│  DRENÁŽNÍ VRSTVA Z KAMENIVA HRUBÉHO DRCENÉHO FRAKCE 16/32 MM          [OTSKP]       Poř. 001                  │
│                                                                                                               │
│  Role:     [● Hlavní ▼]          Rodič:  —             Podřízené: 3  → Zobrazit                              │
│  TOV:      ▥ 45 h · 180 kg · 3 t                                         [ Celý rozpis → ]                   │
│  Monolit:  ⛑ 142 500 Kč · 3,5 dn · 6 lidí                                [ ↗ Otevřít v Monolitu ]            │
│  Import:   Stavba_202.xlsx · list 3 · řádek 142                                                               │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────────────  │
│  Reorder:  [ ↑ Nahoru ]  [ ↓ Dolů ]                                              [ 🗑 Smazat pozici ]         │
│                                                                                     opacity 0.4 § 2.4.5       │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 bg var(--stone-100) (как .flat-el-info § 2.3.3)  · border-top 2px stone-300  · border-bottom 2px stone-200 (завершитель)
 font 13px body · 11px labels uppercase · 11px [OTSKP]/[ÚRS] badge (.flat-badge § 2.3.5)
 [×] 13px top-right  · Esc closes  · click другой row → сворачивается эта, открывается новая (single-open)
```

*Изменилось:* 5 per-item действий (#2 MoveUp, #3 MoveDown, #4 role-trigger, #5 Link2, #7 HardHat action-half) переехали сюда из строки — в строке от них только chevron-флип индикатор. Добавлена новая функция: **single-item delete** с opacity 0.4 (§ 2.4.5) — сейчас в Registry удалить одну položku вне bulk-режима нельзя. Информационное содержимое (полный `popis` без clipping, каталог-бейдж, parent/subordinate info, Monolit payload разбивка, import-trace) сейчас либо обрезается в ячейке, либо скрыто в tooltip — теперь развёрнуто. Click-триггер панели — `kod` или `popis` cell (оба теперь CCL с пунктиром); chevron `[▾]` отвечает только за expand subordinates, не за detail panel (две независимые interaction-zones по § 4.3.5).

---

*Разделы 4.3.2, 4.3.8–4.3.10, 4.4 (Вариант C), 5 (Recommendation) будут добавлены в следующих коммитах.*
