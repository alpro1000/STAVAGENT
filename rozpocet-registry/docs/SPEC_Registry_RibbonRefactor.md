# Registry Ribbon Refactor — Specification

**Version:** 1.0
**Date:** 2026-04-24
**Status:** PR A shipped (flag-gated, parallel to legacy); PR B removal pending

**Inspiration:** KROS 4 (Czech construction estimating software)

> This is the specification that drove PR A (`feat/ribbon-layout`). The
> agent session that shipped PR A received this content inline; it's
> persisted here so future sessions, reviewers, and the eventual PR B
> (legacy removal) have a single reference doc.

---

## 1. Cíl

Replace the 7-card vertical stack above the table with a compact
ribbon-style layout (KROS-inspired). Goal — grow the visible table
area from ~40 % to ~70 % of the viewport without losing functionality.

**Critical:** preserve the flat-style visual language end-to-end —
colors, typography, spacing tokens. Only the placement changes.

## 2. Before — 7 cards (≈ 485 px above the table on 1080p)

| # | Element                                     | ≈ Height |
|---|---------------------------------------------|----------|
| 1 | App header (brand + search + actions)       | 80 px    |
| 2 | Projekty title + Smazat vše + Přidat        | 40 px    |
| 3 | Project tiles (tabs with 4 nav arrows)      | 60 px    |
| 4 | Listy projektu label                        | 30 px    |
| 5 | Sheet tiles (tabs with 4 nav arrows)        | 60 px    |
| 6 | Title + Portal + Upravit mapování           | 80 px    |
| 7 | AI Klasifikace card (collapsed header)      | 50 px    |
| 8 | Správa skupin card (collapsed header)       | 50 px    |
| 9 | ItemsTable toolbar                          | 50 px    |
|10 | Sticky column header                        | 36 px    |

## 3. After — 5 rows (≈ 244 px above the table on 1080p)

| Row | Height | Purpose |
|-----|--------|---------|
| 1 — AppRibbon           | 48 px | brand + search + Poptávka / Export / Import |
| 2 — ProjectTabsBar      | 40 px | project tabs + Přidat / Smazat vše |
| 3 — SheetTabsBar        | 40 px | sheet tabs for the active project |
| 4 — ContextBar          | 40 px | breadcrumb + 4 chip actions (Portal / Upravit / AI / Skupiny) |
| 5 — ItemsTable toolbar  | 40 px | Undo / Redo / Reclassify / Jen pracovní / Výška S M L |
| Sticky header           | 36 px | column headers |

Remaining ≈ 836 px for the table body on 1080p — **+86 % visible area**.

## 4. Row details

### Row 1 — AppRibbon (48 px, dark navy)

- `background: var(--flat-bg-dark)` (#0F172A).
- Brand left (Building2 icon + "REGISTR ROZPOČTŮ"), hidden label on mobile.
- Center: existing `<SearchBar>` (reused — full parity with legacy search).
- Right: three action buttons — Poptávka cen / Export Excel / Importovat.
  - "Importovat" is the primary call (accent fill).
  - Poptávka / Export disabled when no projects.

### Row 2 — ProjectTabsBar (40 px, white)

- Inline horizontal-scroll project tabs. Each tab: filesheet icon + name
  (truncated to 180 px) + portal badge + `(N)` sheets count + trailing ×.
- Active tab: solid `var(--flat-accent)` fill + white text.
- Right-side actions: Smazat vše (red-tinted) + Přidat (orange pill).
- `aria-selected`, `role="tab"`, Enter/Space keyboard activation.

### Row 3 — SheetTabsBar (40 px, stone-100)

- Same shape as Row 2 for the active project's sheets.
- Active sheet uses `--flat-accent-light` bg + `--flat-accent` text
  (weaker signal than active project) so the two strips read as
  distinct hierarchies at a glance.

### Row 4 — ContextBar (40 px, white)

- Left: breadcrumb `Project · Sheet · N položek`.
- Right: four `ChipButton`s:
  1. **Portal** — `active-green` variant when `project.portalLink` is set; `muted` otherwise.
  2. **Upravit mapování** — opens the re-import flow (`setReimportProject` + ImportModal).
  3. **AI Klasifikace** — chip with `hasDropdown`. Click → `ChipPopover` with `AIPanel variant='popover'`. Badge shows selection count OR `classified/total`.
  4. **Skupiny** — chip with `hasDropdown`. Click → `ChipPopover` with `GroupManager variant='popover'`. Badge shows `groups · items`.
- Only one popover open at a time. Clicking the same chip closes it.

### Row 5 — ItemsTable toolbar (40 px, white)

- Left cluster: Zpět / Znovu / (counter) / `|` / Překlasifikovat / Jen pracovní filter.
- Right cluster: reclassify status / selection count / Výška: S M L presets.
- Vertical 1-px divider separates Undo/Redo group from Reclassify.
- Drag-to-resize handle stays at the card's bottom-right (quick fix #1020).

## 5. Tokens (SPEC §5)

All new `--flat-*` names added in `src/styles/tokens.css`. Aliased to
existing stone / orange palette where the spec's hex matches; genuinely
new values get raw hex:

```
  --flat-bg-dark:        #0F172A            (app ribbon Row 1)
  --flat-surface-2:      var(--stone-100)   (Row 3 sheet-tabs bg)
  --flat-accent-hover:   var(--orange-600)
  --flat-accent-light:   #FED7AA            (active sheet tab)
  --flat-border-muted:   var(--stone-300)   (chip default border)
  --green-50:            var(--green-100)   (chip active-green bg)
  --green-700:           #15803D            (chip active-green text)
  --red-50:              var(--red-100)     (destructive hover)
```

Typography: DM Sans everywhere except the JetBrains Mono numbers /
codes in the table body — unchanged from the existing design.

## 6. Feature flag

Gated on `localStorage.getItem('registry-ribbon-enabled') === 'true'`.

- `isRibbonEnabled()` — sync reader for non-React callers.
- `useRibbonFlag()` — React hook returning `[enabled, setEnabled]`.
  Broadcasts changes across hook instances via a `CustomEvent` bus so
  the whole layout swaps atomically without a page reload.
- `<RibbonFlagToggle />` — hidden dev-only button pinned to the
  bottom-right. Visible when `<html data-registry-dev="true">` or
  `localStorage.registry-dev-mode === 'true'`. Renders nothing for
  regular users.

Default — OFF. Legacy layout renders verbatim until someone flips
the flag.

## 7. Component structure

```
src/layout/
  ├── ribbonFeatureFlag.ts       flag hook + sync reader + tests
  ├── ribbonFeatureFlag.test.ts
  ├── RibbonFlagToggle.tsx       dev-only toggle button
  ├── ChipButton.tsx             28 px pill (3 variants, badge, dropdown caret)
  ├── ChipPopover.tsx            createPortal + position:fixed + auto-flip
  ├── AppRibbon.tsx              Row 1
  ├── ProjectTabsBar.tsx         Row 2
  ├── SheetTabsBar.tsx           Row 3
  ├── ContextBar.tsx             Row 4 (owns popover state, composes AI + Groups)
  └── RibbonLayout.tsx           5-row composition + children slot for the table

src/components/ai/AIPanel.tsx       + `variant?: 'card' | 'popover'`
src/components/groups/GroupManager.tsx  + `variant?: 'card' | 'popover'`
src/components/items/ItemsTable.tsx     + TABLE_HEIGHT_PRESETS + toolbar presets
src/App.tsx                             feature-flagged mount of RibbonLayout
```

## 8. Migration strategy

Two-PR rollout:

- **PR A** (this spec, shipped on branch `feat/ribbon-layout`):
  ribbon layout added in parallel. Legacy untouched. Flag defaults
  to OFF. User validates on a real project before PR B.
- **PR B** (future, ~1 week out): remove legacy layout, flip flag
  default to ON, delete `RibbonFlagToggle`. Small PR — delete-only.

## 9. Acceptance criteria (PR A)

See the inline SPEC §9 in the agent prompt that drove this work for
the full list. Key items verified in this session:

- [x] 121/121 registry vitest pass (117 baseline + 4 new flag tests)
- [x] `tsc -b && vite build` clean on every commit
- [x] Legacy layout renders byte-for-byte when flag off
- [ ] Manual: flip flag, confirm ribbon takes over (dev verification)
- [ ] Manual: AI + Groups popovers render the full existing content
- [ ] Manual: project + sheet tab switching works
- [ ] Manual: responsive 1920 / 1366 / 1024 / 768 / 375 breakpoints

## 10. Out of scope for PR A

- Export dropdown menu (ribbon `onExport` wires directly to `handleExportProject`; full dropdown port is a follow-up).
- Mobile drawer for Rows 2/3 below 768 px (they still scroll horizontally via native overflow).
- New detail panel (PR 3 of §5.3.1 in AUDIT doc).
- Catalog price comparison (out-of-scope task).
- Classifier / parser / merge logic.

## 11. Rollback

Remove `localStorage.registry-ribbon-enabled` → instant fallback to
legacy. Or `git revert` PR A — legacy layout is the only code path
again. No data migration required; both layouts read the same Zustand
store state.
