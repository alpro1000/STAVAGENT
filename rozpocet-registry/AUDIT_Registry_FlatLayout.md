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

*Разделы 2 (Reference), 3 (Conflicts), 4 (Proposals), 5 (Recommendation) будут добавлены в следующих коммитах.*
