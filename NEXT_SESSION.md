# Next Session - Quick Start

**Last Updated:** 2026-02-04
**Current Branch:** `claude/test-excel-modal-fixes-kmKsz`
**Last Session:** Rozpočet Registry - Excel Export Fixes + Import Preview Improvements

---

## Quick Start Commands

```bash
# Current working directory
cd /home/user/STAVAGENT

# Check branch and status
git status
git log --oneline -10

# Pull latest changes
git pull origin main

# Start development (rozpocet-registry)
cd rozpocet-registry && npm run dev     # Vite on :5173

# Other services (if needed)
cd URS_MATCHER_SERVICE/backend && npm run dev        # URS Matcher
cd Monolit-Planner/backend && npm run dev            # Monolit backend
cd concrete-agent && npm run dev:backend             # CORE backend
```

---

## Recent Work (2026-02-04)

### LATEST: Rozpočet Registry Excel Improvements

**Session Focus:** Fixed multiple Excel export issues + Import preview improvements

**Commits (9 total):**
```
8d4bdc6 FIX: Import preview - larger table, auto-scroll to data rows
02d95ce FIX: Export to original file + yellow input cells + price formulas
c23b54b FEAT: Yellow highlight for input cells + price formulas in exports
4c7dbfb STYLE: Added light tint styling for main rows in Poptávka export
a1f282d FIX: Poptávka export now includes subordinate rows for collapsible grouping
928618b FIX: Improved Excel row grouping for collapsible subordinate rows
0d58356 FIX: Excel export - subordinate skupina inheritance + section handling
90e64c7 STYLE: Light theme for AIPanel and PriceRequestPanel
26024e9 STYLE: Light theme for RowActionsCell dropdowns and modals
```

---

## Problems Fixed

### 1. Full Excel Export Issues
- **Subordinate rows wrong skupina** - Now inherit from parent via `parentSkupinaMap`
- **Section names (SEKCE) missing** - Added `SECTION_STYLE` for section rows
- **Sorting broken** - Fixed to use `source.rowStart` instead of `boqLineNumber`

### 2. Poptávka Export Issues
- **Collapsible rows (+/-) not working** - Fixed by:
  - Removing `hidden: true` (was hiding rows permanently)
  - Adding both `level` and `outlineLevel` properties
  - Adding `!sheetFormat` and `!sheetViews` settings
- **Subordinate rows completely missing** - Fixed `handleCreateReport()` in PriceRequestPanel.tsx which was explicitly filtering them out
- **Visual styling** - Added main row tint (light blue #E8F4FD) and sub row tint (light gray #FAFAFA)

### 3. Input Cells Styling
- **Yellow highlight** - Added `INPUT_CELL_STYLE` (#FFFDE7) for "Cena jednotková" column
- **Price formulas** - Added `=Množství×Cena_jednotková` formula in "Cena celkem" column

### 4. Export to Original File
- **File corruption** - Fixed by preserving cell properties when updating:
  ```typescript
  ws[cellRef] = {
    ...existingCell,  // Preserve existing properties
    t: 'n',
    v: newValue,
    w: undefined,     // Clear cached value
  };
  ```
- Added `cellStyles: true` option for read/write operations

### 5. Import Preview
- **Large headers problem** - When file has large header, couldn't see data rows
- **Solutions:**
  - Increased preview rows: 100 → 150
  - Increased table height: 400px → 600px
  - Auto-scroll to data start row when detected
  - Added "Přejít na data" button for manual navigation
  - Enhanced data row highlighting (green + ring)

---

## Key Files Modified

### excelExportService.ts
- `parentSkupinaMap` for subordinate inheritance
- `SECTION_STYLE` for section rows
- Sorting by `source.rowStart`
- Formula for Cena celkem column
- `exportToOriginalFile()` - preserve cell properties

### priceRequestService.ts
- `MAIN_ROW_STYLE` (light blue #E8F4FD)
- `SUB_ROW_STYLE` (light gray #FAFAFA)
- `INPUT_CELL_STYLE` (yellow #FFFDE7)
- Row grouping: `level`, `outlineLevel`, `!sheetFormat`, `!sheetViews`
- Subordinate inheritance via `parentSkupinaMap`

### PriceRequestPanel.tsx
- `handleCreateReport()` - now includes subordinates for main items:
  ```typescript
  const subordinatesForMainItems = allItems.filter(item => {
    if (item.rowRole !== 'subordinate') return false;
    return item.parentItemId && mainItemIds.has(item.parentItemId);
  });
  ```

### RawExcelViewer.tsx
- Preview rows: 100 → 150
- Table height: 400px → 600px
- Auto-scroll to data row
- "Přejít na data" button
- Enhanced row highlighting

---

## Service Status

| Service | Status | Notes |
|---------|--------|-------|
| rozpocet-registry | ✅ Ready | All fixes committed and pushed |
| concrete-agent | ✅ Running | CORE backend |
| URS_MATCHER_SERVICE | ✅ Running | Document extraction ready |
| Monolit-Planner | ✅ Running | Kiosk |

---

## Technical Context for Claude

### Excel Row Grouping (xlsx-js-style)
```typescript
// Required for collapsible rows:
row.level = 1;           // Group level
row.outlineLevel = 1;    // Alternative property
// Do NOT use hidden: true (hides rows permanently)

// Required sheet settings:
ws['!outline'] = { above: false, left: false };
ws['!sheetFormat'] = { outlineLevelRow: 1 };
ws['!sheetViews'] = [{ showOutlineSymbols: true }];
```

### Subordinate Inheritance Pattern
```typescript
// Build parent map
const parentSkupinaMap = new Map<string, string>();
items.filter(i => i.rowRole === 'main').forEach(item => {
  parentSkupinaMap.set(item.id, item.skupina || '');
});

// Inherit for subordinates
const skupina = item.rowRole === 'subordinate' && item.parentItemId
  ? parentSkupinaMap.get(item.parentItemId) || item.skupina
  : item.skupina;
```

### Cell Preservation Pattern
```typescript
// Read with style preservation
const workbook = XLSX.read(data, {
  type: 'array',
  cellStyles: true,
  cellNF: true,
  cellFormula: true,
});

// Update preserving properties
ws[cellRef] = {
  ...existingCell,
  t: 'n',
  v: newValue,
  w: undefined,
};

// Write with style preservation
XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellStyles: true });
```

---

## Next Session Tasks (Potential)

1. **Test all export scenarios**
   - Full Excel export with subordinates
   - Poptávka export with collapsible rows
   - Export to original file

2. **Import preview testing**
   - Files with large headers (10+ rows)
   - Auto-scroll verification

3. **Performance optimization**
   - Large file exports (1000+ items)
   - Memory usage monitoring

4. **UX improvements**
   - Export progress indicator
   - Better error messages

---

**Ready for next session!**
