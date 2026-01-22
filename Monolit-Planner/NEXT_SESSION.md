# Next Session Starter Commands

**Branch:** `claude/portal-audit-improvements-8F2Co`
**Previous Session:** 2026-01-22 (Excel Formula Links)
**Status:** ✅ Commits pushed, ready for merge or further work

---

## 🚀 START COMMAND FOR NEXT SESSION

```bash
# Check current status
git status
git log --oneline -5

# Verify branch
git branch --show-current
# Expected: claude/portal-audit-improvements-8F2Co

# Read session summaries (most recent first)
cat Monolit-Planner/SESSION_2026-01-22_EXCEL_FORMULA_LINKS.md

# Check uncommitted changes
git diff --stat
```

---

## 📋 SESSION 2026-01-22 SUMMARY

### ✅ Completed:

| Task | Commit | Description |
|------|--------|-------------|
| useBridges fix | `efa5855` | Fixed stale data blocking - DB shows saved files now |
| Excel formulas | `d3761b3` | Cross-sheet formula links (+398/-165 lines) |

### Key Changes:

1. **useBridges.ts** - Removed broken logic that prevented UI updates
2. **exporter.js** - All sheets now linked with formulas:
   - Detaily → SUM formulas in totals
   - KPI → References Detaily!L, N, I, G
   - Materiály → SUMIF formulas from Detaily
   - Grafy → References Materiály!F
   - Harmonogram → PLACEHOLDER (⚠️ warning banner)

---

## 🎯 POTENTIAL NEXT TASKS

### Priority 1: Test Excel Export
```bash
# Start backend
cd Monolit-Planner/backend && npm run dev

# Start frontend
cd Monolit-Planner/frontend && npm run dev

# Test: Export XLSX, change Detaily values, verify other sheets update
```

### Priority 2: Harmonogram Implementation
User said Harmonogram is placeholder - may want to implement real logic:
- Calculate phases from position days
- Link with Detaily sheet
- Add Gantt-like visualization

### Priority 3: Merge to Main
```bash
# Create PR
gh pr create --title "FEAT: Excel cross-sheet formula links" \
  --body "$(cat Monolit-Planner/SESSION_2026-01-22_EXCEL_FORMULA_LINKS.md)"
```

### Priority 4: AI Suggestion (Pending from 2026-01-21)
- Still waiting for user to execute SQL in Render Dashboard
- Check: `curl -s https://monolit-planner-api.onrender.com/api/config | jq`

---

## 🔧 TECHNICAL CONTEXT

### Excel Formula Architecture:
```
┌─────────────┐
│   Detaily   │ ← Source of truth (positions)
│   (Sheet 1) │
└──────┬──────┘
       │
       ├──────────────────────────────────────┐
       │                                      │
       ▼                                      ▼
┌─────────────┐                      ┌─────────────┐
│     KPI     │                      │  Materiály  │
│   (Sheet 2) │                      │  (Sheet 3)  │
│             │                      │             │
│ Detaily!L$  │ ← Concrete m³        │ SUMIF(A,C)  │ ← Qty by type
│ Detaily!N$  │ ← KROS total         │ SUMIF(A,N)  │ ← Cost by type
│ Detaily!I$  │ ← Labor hours        │ F/C         │ ← Unit price
│ Detaily!G$  │ ← Work days          │             │
└─────────────┘                      └──────┬──────┘
                                            │
                                            ▼
                                    ┌─────────────┐
                                    │    Grafy    │
                                    │  (Sheet 5)  │
                                    │             │
                                    │ Materiály!F │ ← Costs
                                    │ B/Total*100 │ ← Percentages
                                    └─────────────┘

┌─────────────┐
│ Harmonogram │ ← PLACEHOLDER (not linked)
│  (Sheet 4)  │
│ ⚠️ Static   │
└─────────────┘
```

### Key Variables in exporter.js:
```javascript
// Row tracking for formulas
let detailTotalsRow = null;      // Totals row number in Detaily
let firstDataRow = null;         // First position row
let lastDataRow = null;          // Last position row
let matTotalsRowNumber = null;   // Materials totals row
const materialRowMap = new Map(); // type → row number mapping
```

---

## 📂 KEY FILES

```
Monolit-Planner/
├── SESSION_2026-01-22_EXCEL_FORMULA_LINKS.md  ← Today's session
├── SESSION_2026-01-21_PORTAL_INTEGRATION.md   ← Previous session
├── NEXT_SESSION.md                             ← This file
├── backend/
│   └── src/services/
│       └── exporter.js          ← Excel export with formulas (1,295 lines)
└── frontend/
    └── src/hooks/
        └── useBridges.ts        ← Fixed stale data issue
```

---

## 🗣️ SUGGESTED OPENING MESSAGE

```
Привет! Продолжаю работу с предыдущей сессии.

Вчера (2026-01-22) сделали:
✅ Исправлен баг с отображением данных из БД
✅ Excel экспорт теперь связан формулами:
   - Detaily → KPI, Materiály, Grafy обновляются автоматически
   - Harmonogram пока заглушка с предупреждением

2 коммита запушены в ветку claude/portal-audit-improvements-8F2Co

Что делаем дальше?
1. Тестируем Excel экспорт?
2. Реализуем Harmonogram?
3. Мерджим в main?
4. Другие задачи?
```

---

## ⚡ QUICK COMMANDS

```bash
# Git status
git status && git log --oneline -3

# Read today's session
cat Monolit-Planner/SESSION_2026-01-22_EXCEL_FORMULA_LINKS.md

# Check Excel export changes
git show d3761b3 --stat

# Run backend
cd Monolit-Planner/backend && npm run dev

# Run frontend
cd Monolit-Planner/frontend && npm run dev

# Create PR
gh pr create --title "FEAT: Excel cross-sheet formula links" \
  --body-file Monolit-Planner/SESSION_2026-01-22_EXCEL_FORMULA_LINKS.md
```

---

## 📊 BRANCH STATUS

| Branch | Status | Last Commit |
|--------|--------|-------------|
| `claude/portal-audit-improvements-8F2Co` | ✅ Active | `d3761b3` |
| `main` | Stable | - |

**Recent Commits on Current Branch:**
```
d3761b3 FEAT: Add cross-sheet formula links in Excel export
efa5855 FIX: Remove stale data blocking logic in useBridges hook
d74846a FEAT: Add Price Request workflow for supplier quotations
```

---

## 🔍 VERIFICATION

### Test Excel Formulas:
1. Export XLSX from Monolit Planner
2. Open in Excel/Calc
3. Change value in Detaily column C (qty)
4. Verify Materiály column C updates (SUMIF)
5. Verify Grafy percentages update

### Expected Formula Examples:
- KPI B3: `=Detaily!L45` (concrete volume)
- Materiály C7: `=SUMIF(Detaily!A5:A40,"Betonování",Detaily!C5:C40)`
- Grafy C5: `=IF(Materiály!F12>0,B5/Materiály!F12*100,0)`

---

**End of Next Session Guide**
**Ready for next session!** 🚀
