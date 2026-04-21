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

*Подсекции 2.3 (Цвета), 2.4 (Иконки), 2.5 (Как Planner решает проблему множества действий в строке), разделы 3 (Conflicts), 4 (Proposals), 5 (Recommendation) будут добавлены в следующих коммитах.*
