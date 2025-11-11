# 🧹 Code Cleanup TODO List

**Date**: November 11, 2025
**Found By**: Comprehensive Code Audit
**Estimated Time**: 3-4 hours

---

## 📝 Console.log & Debug Code (Remove)

### Frontend Components

| File | Lines | Count | Action |
|------|-------|-------|--------|
| `src/components/PartHeader.tsx` | 40, 55-56, 58, 61, 66-67, 71 | 7 | DELETE |
| `src/components/OtskpAutocomplete.tsx` | 46, 49, 57-58, 60-61, 64 | 8 | DELETE |
| `src/components/PositionsTable.tsx` | 59, 74, 86, 100, 125, 144, 196, 207-208, 228, 233, 265, 280, 328, 344 | 16 | DELETE |
| `src/components/Header.tsx` | 45, 47, 54 | 3 | DELETE |
| `src/hooks/usePositions.ts` | 20, 31, 44, 61-63, 66, 72, 80, 91, 96, 100 | 12 | DELETE |

**Total Frontend**: 46 console.log statements

### Backend

| File | Issue | Action |
|------|-------|--------|
| `src/routes/otskp.js` | Multiple console.log | REPLACE with logger.info() |
| Other backend files | Check for console.log | AUDIT |

---

## 🔄 Refactoring: Duplicate Code

### Template Positions Duplication

**Issue**: Same template defined in 2 places

```
File 1: backend/src/routes/bridges.js (lines 106-152)
File 2: backend/src/routes/upload.js (lines 355-401)
```

**Solution**: Create shared constant file

**File to Create**: `backend/src/constants/bridgeTemplates.js`

```javascript
// Export a single BRIDGE_TEMPLATE_POSITIONS
export const BRIDGE_TEMPLATE_POSITIONS = [
  // ... 11 positions
];
```

**Files to Update**:
- `backend/src/routes/bridges.js` - import and use
- `backend/src/routes/upload.js` - import and use

**Estimated Savings**: 46 lines of duplicate code

---

## 📦 Unused Props & Variables

### Header Component Props

**File**: `frontend/src/components/Header.tsx:21`

```typescript
// UNUSED:
interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}
```

**Action**:
- Check where Header is used (likely Main.tsx or App.tsx)
- Remove these props from interface
- Remove from component implementation
- Remove from calling code

---

## 🌍 Mixed Language Issues

### Czech + Russian Mix

**File**: `frontend/src/components/EditBridgeForm.tsx:93`

```typescript
// Current (MIXED):
<small>Název конкретного моста (опционально, по умолчанию = Bridge ID)</small>

// Should be (CZECH ONLY):
<small>Název konkrétního mostu (volitelné, výchozí = Bridge ID)</small>
```

**Same Issue**: `frontend/src/components/CreateBridgeForm.tsx:100`

**Action**: Replace all Russian text with Czech equivalents

---

## 🎨 CSS Duplicates & Cleanup

### Duplicate Class Definitions

| Class | Lines | File | Action |
|-------|-------|------|--------|
| `.btn-primary` | 59-73, 2850-2864 | `src/styles/components.css` | MERGE or DELETE second |
| `.modal-overlay` | 1580-1590, 2629-2642 | `src/styles/components.css` | DELETE duplicate |

### Unused CSS Classes

| Class | Lines | Status | Action |
|-------|-------|--------|--------|
| `.tooltip` | 1899-1918 | Not used in React | DELETE or IMPLEMENT |
| `.badge` | 1920-1929 | Not used in React | DELETE or IMPLEMENT |
| `.popover` | Similar | Need audit | AUDIT |

### !important Overrides (Reduce)

**File**: `frontend/src/styles/global.css:271-274`

```css
/* CURRENT (BAD):
*:not(.upload-spinner):not(.upload-spinner *) {
  animation-duration: 0.1s !important;
}
*/

/* BETTER:
.default-animations:not(.upload-spinner) {
  animation-duration: 0.1s;
}
```

---

## 🔧 Performance Optimizations

### 1. convertRawRowsToPositions O(n²) Algorithm

**File**: `backend/src/routes/upload.js:106-313`

**Current Issue**: Nested loops for each row checking TEMPLATE_POSITIONS

**Optimization**: Use Set/Map

```javascript
// Before: O(n * m) where m = template positions
const templateSet = new Set(TEMPLATE_POSITIONS.map(p => p.item_name));

// After: O(n) lookup
if (templateSet.has(itemName)) { ... } // O(1) instead of O(m)
```

**Estimated Effort**: 1 hour

### 2. Extract Large Excel Files

**File**: `backend/src/services/parser.js:72-203`

**Issue**: Entire file loaded in memory

**Optimization**: Use streaming parser

```javascript
// Consider: js-xlsx with streaming mode or xlstream
```

**Estimated Effort**: 3-4 hours

---

## 📋 Code Quality Checklist

- [ ] Remove all 46 console.log statements
- [ ] Extract BRIDGE_TEMPLATE_POSITIONS to constants file
- [ ] Remove unused Header props
- [ ] Fix Czech language in CreateBridgeForm & EditBridgeForm
- [ ] Remove duplicate CSS classes
- [ ] Delete unused CSS (.tooltip, .badge)
- [ ] Reduce !important usage in global.css
- [ ] Optimize convertRawRowsToPositions (O(n) instead of O(n²))
- [ ] Add file cleanup to upload route
- [ ] Fix useEffect dependencies

---

## 🚀 Implementation Order

### Priority 1 (Quick wins - 1-2 hours)
- [ ] Remove all console.log
- [ ] Fix language mix (Czech only)
- [ ] Remove duplicate CSS
- [ ] Fix Header unused props

### Priority 2 (Medium - 2-3 hours)
- [ ] Extract template constants
- [ ] Add file cleanup
- [ ] Fix useEffect dependencies
- [ ] Optimize convertRawRowsToPositions

### Priority 3 (Nice to have - 3-4 hours)
- [ ] Optimize Excel parsing with streaming
- [ ] Remove unused CSS classes
- [ ] Add production logging system

---

## Git Commands for Cleanup

```bash
# Find all console.log in frontend
grep -r "console\." src/components --include="*.tsx" --include="*.ts"

# Find all TODO comments
grep -r "TODO\|FIXME\|HACK\|XXX" src --include="*.tsx" --include="*.ts"

# Find unused CSS classes
grep -r "tooltip\|badge\|popover" src/components --include="*.tsx"
```

---

## Before/After Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Console statements | 46+ | 0 | 100% |
| Duplicate code | 92 lines | 46 lines | 50% |
| Unused props | 2 | 0 | 100% |
| CSS duplicates | 3 | 0 | 100% |
| Mixed languages | 2 files | 0 | 100% |
