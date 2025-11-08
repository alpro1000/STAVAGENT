# COMPREHENSIVE TYPOGRAPHY AUDIT REPORT
## Monolit Planner v4.7.0 - Complete Font Usage Analysis

---

## SECTION 1: FONT FAMILY HIERARCHY

### Imported Fonts (from Google Fonts)
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600&display=swap');
```

### CSS Variables (global.css, lines 77-78)
- **--font-base**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  - Used for: Body text, headings, buttons, general UI
  - Available weights: 400, 500, 600, 700
  
- **--font-mono**: `'Roboto Mono', 'Courier New', monospace`
  - Used for: Code, technical values, IDs, calculations
  - Available weights: 400, 500, 600

---

## SECTION 2: COMPLETE FONT-SIZE SCALE

**9px** (1) → KPI Card Unit
**10px** (4) → KPI Labels, KPI Formula, Stat Labels
**11px** (9) → Badges, IDs, Sidebar Heading, Table Header, RFI Badge, Metadata
**12px** (8) → Form Labels, Dates, Descriptions
**13px** (13) → Form Inputs, Table Cells, Technical Labels
**14px** (9) → Body Text, Buttons, Values
**15px** (1) → Part Name Input **[ANOMALY]**
**16px** (4) → Secondary Headings
**18px** (4) → Component Titles (Header, Modal)
**20px** (2) → Global h2
**24px** (2) → Global h1
**28px** (1) → Snapshot Icon
**60px** (2) → Empty State Icons

---

## SECTION 3: FONT-WEIGHT ANALYSIS

| Weight | Count | Purpose | Components |
|--------|-------|---------|-----------|
| 400 | 2 | Placeholder text | Input placeholders |
| 500 | 6 | Interactive text | Buttons, labels |
| 600 | 15+ | Body & headings | Main content elements |
| 700 | 7 | Bold/accent | Badges, values |

---

## SECTION 4: LINE-HEIGHT VALUES

```
1.2 → KPI numeric values (compact)
1.3 → Headings (tight)
1.5 → Body text (readable) ✓
```

---

## SECTION 5: CRITICAL INCONSISTENCIES FOUND

### 🔴 ISSUE #1: Part Name Input (15px - ANOMALY)
**Location**: components.css, line 716
```css
.part-name-input {
  font-size: 15px;  /* UNIQUE SIZE - NOT USED ELSEWHERE */
  font-weight: 600;
}
```
**Problem**: Only element using 15px
**Impact**: Visual inconsistency with other form inputs (13px)
**Fix**: Change to 14px

### 🟠 ISSUE #2: Form Input Size Inconsistency
```
Bridge selector:           13px (line 1539)
Part name input:          15px (line 716)    
Duration toggle buttons:  12px (line 1561)
CreateBridgeForm inputs: 1rem/16px (inline)
```
**Fix**: Standardize all to 14px

### 🟠 ISSUE #3: Icon Button Sizing Varies
```
Icon button:        14px (line 991)
Theme toggle:      18px (line 192)
```
**Fix**: Standardize icon buttons to 14px

### 🟡 ISSUE #4: Header/Title Sizes Mixed
```
KPI Title:        16px (line 1055)
Modal Title:      18px (line 1302)
Header Logo h1:   18px (line 29)
Global h2:        20px (line 131)
Global h1:        24px (line 130)
```
**Impact**: Unclear heading hierarchy
**Fix**: Document consistent heading sizes

### 🟡 ISSUE #5: Metadata Sizes Vary by 1px
```
KPI metadata:        11px (line 1062)
Snapshot date:      12px (line 1239)
```
**Fix**: Standardize metadata to 11px

### 🟡 ISSUE #6: Badge Size Inconsistency
```
Collapsed badge:       11px (line 281)
Bridge badge:         11px (line 457)
RFI badge:           11px (line 967)
Snapshot locked badge: 10px (line 1437) ← Odd one out
```
**Fix**: All badges should be 11px

### 🟡 ISSUE #7: Letter-Spacing Inconsistency
```
Bridge name:        -0.3px (negative) (line 435)
Uppercase labels:    +0.5px (positive) (lines 361, 704, 816)
```
**Question**: Why negative spacing for bridge-name?

### ℹ️ ISSUE #8: Inline Font-Size Instead of Variables
**Components affected:**
- Header.tsx (line 147): `fontSize: '32px'` → Should use CSS variable
- DaysPerMonthToggle.tsx (line 19): `fontSize: '16px'` → Should use CSS variable
- CreateBridgeForm.tsx (inline): `font-size: 1rem` → Should use CSS variable

---

## SECTION 6: DETAILED COMPONENT BREAKDOWN

### HEADER
```css
.header-logo h1 { font-size: 18px; font-weight: 600; }
```
✓ Consistent with modal titles

### BUTTONS
```css
.btn-primary, .btn-secondary { font-size: 14px; font-weight: 500; }
```
✓ All text buttons consistent

### SIDEBAR
```
Heading:    12px, weight 600, uppercase, letter-spacing 0.5px
Bridge:     13px, weight 600, letter-spacing -0.3px
Bridge ID:  11px, monospace
Badge:      11px, weight 700
```
✓ Good hierarchy

### KPI PANEL
```
Title:      16px, weight 600
Card Label: 10px, weight 600
Card Value: 14px, weight 700, monospace, line-height 1.2
Card Unit:  9px, weight 500
Metadata:   11px, monospace
Formula:    10px, line-height 1.3
```
✓ Clear hierarchy

### POSITIONS TABLE
```
Base:       13px
Header:     11px, weight 600, uppercase, letter-spacing 0.5px
Input:      13px, monospace
Computed:   13px, weight 500, monospace
KROS:       13px, weight 700, monospace
RFI Badge:  11px, weight 600
```
✓ Consistent

### PART HEADER
```
Header:     14px, weight 600
Label:      11px, weight 600, uppercase, letter-spacing 0.5px
Input:      15px, weight 600 ✗ ANOMALY
Concrete:   14px, weight 700, monospace
```
⚠️ Input size is unusual

### MODALS
```
Title:      18px, weight 600
Close:      18px
Footer:     13px, monospace
```
✓ Consistent with headers

### SNAPSHOT COMPONENTS
```
Title:      14px, weight 600
Date:       12px, monospace
Button:     13px, weight 600
Badge:      10px, weight 700, uppercase, letter-spacing 0.5px
Stat Value: 13px, weight 700, monospace
Stat Label: 10px, weight 600, uppercase, letter-spacing 0.5px
```
✓ Good hierarchy

---

## SECTION 7: TYPOGRAPHY SCALE SUMMARY TABLE

| Element | Size | Weight | Line-Height | Font-Family | Status |
|---------|------|--------|------------|------------|--------|
| html | 16px | - | - | - | Base |
| body | 14px | 400 | 1.5 | Inter | ✓ |
| h1 | 24px | 600 | 1.3 | Inter | ✓ |
| h2 | 20px | 600 | 1.3 | Inter | ✓ |
| h3 | 16px | 600 | 1.3 | Inter | ✓ |
| h4 | 14px | 600 | 1.3 | Inter | ✓ |
| button | 14px | 500 | - | Inter | ✓ |
| .header-logo h1 | 18px | 600 | - | Inter | ✓ |
| .btn-theme-toggle | 18px | - | - | - | ✓ |
| .sidebar-heading | 12px | 600 | - | Inter | ✓ |
| .bridge-name | 13px | 600 | - | Inter | ⚠️ Letter-spacing -0.3px |
| .bridge-id | 11px | - | - | Roboto Mono | ✓ |
| .kpi-bridge-title | 16px | 600 | - | Inter | ✓ |
| .kpi-card-label | 10px | 600 | - | Inter | ✓ |
| .kpi-card-value | 14px | 700 | 1.2 | Roboto Mono | ✓ |
| .kpi-card-unit | 9px | 500 | - | - | ✓ |
| .positions-table | 13px | - | - | Inter | ✓ |
| .positions-table th | 11px | 600 | - | Inter | ✓ |
| .part-header | 14px | 600 | - | Inter | ✓ |
| .part-name-input | 15px | 600 | - | Inter | ✗ ANOMALY |
| .part-name-label | 11px | 600 | - | Inter | ✓ |
| .concrete-value | 14px | 700 | - | Roboto Mono | ✓ |
| .modal-title | 18px | 600 | - | Inter | ✓ |
| .snapshot-title | 14px | 600 | - | Inter | ✓ |
| .snapshot-locked-badge | 10px | 700 | - | Inter | ⚠️ Should be 11px |
| .stat-value | 13px | 700 | - | Roboto Mono | ✓ |

---

## SECTION 8: ACTION ITEMS

### Priority 1: CRITICAL (Fix Immediately)
- [ ] Change `.part-name-input` from 15px to 14px
- [ ] Define CSS variables for all icon sizes (32px, 40px, 60px)
- [ ] Replace inline font-size styles with CSS variables

### Priority 2: HIGH (Improve Maintainability)
- [ ] Standardize all form inputs to 14px
- [ ] Document heading hierarchy (h1=24px, h2=20px, h3=16px, h4=14px)
- [ ] Standardize badge sizes to 11px (fix snapshot locked badge)
- [ ] Explain letter-spacing -0.3px on bridge-name

### Priority 3: MEDIUM (Enhancement)
- [ ] Create CSS variables for typography scale
- [ ] Standardize metadata to 11px (fix snapshot-date)
- [ ] Add line-height variable for consistency
- [ ] Create style guide for component typography

### Priority 4: LOW (Polish)
- [ ] Consider 1.4 line-height for modal body text
- [ ] Document empty state icon sizing convention
- [ ] Review all text-transform uppercase usage

---

## SECTION 9: FONT SCALE CONSISTENCY

### Recommended Standardized Scale
```
10px  → Small labels, units
11px  → Metadata, badges, headers
12px  → Form labels, dates
13px  → Table cells, code
14px  → Body, buttons, form inputs (STANDARDIZE HERE)
16px  → Section headers
18px  → Component titles
20px  → Page titles
24px  → Main titles
```

### Current vs Recommended

**Currently Inconsistent:**
- 15px exists (Part Name Input) - should be 14px
- 12px form buttons (Duration) - should be 14px
- 13px bridge selector - should be 14px
- 16px inline in CreateBridgeForm - should use variable

**Metadata Inconsistency:**
- KPI metadata: 11px ✓
- Snapshot date: 12px ✗ (should be 11px)

**Badge Inconsistency:**
- Most badges: 11px ✓
- Snapshot locked badge: 10px ✗ (should be 11px)

---

## SECTION 10: FONT-FAMILY DISTRIBUTION

### Inter (Primary)
- All body text
- All headings
- All buttons and interactive elements
- Form labels
- UI text

### Roboto Mono (Secondary - Technical Content)
- Bridge IDs
- Position IDs
- KPI values and metadata
- Table numeric values
- Computed cells
- Snapshot dates
- Timeline data
- Formula text

**Distribution**: ~85% Inter, ~15% Roboto Mono ✓

---

## SECTION 11: LETTER-SPACING USAGE

```
-0.3px  → Bridge Name (tighten text)
 0.0px  → Most elements (default)
 0.2px  → KPI Card Label (subtle spacing)
 0.5px  → All UPPERCASE labels (consistent convention)
```

All 0.5px usage is for uppercase text:
- Sidebar heading
- Part name label
- Table header
- Snapshot locked badge
- Stat label

**Pattern**: Consistent for semantic usage ✓

---

## SECTION 12: TEXT-TRANSFORM USAGE

Used on exactly 5 components (all with 0.5px letter-spacing):
1. Sidebar Heading (12px)
2. Part Name Label (11px)
3. Table Header (11px)
4. Snapshot Locked Badge (10px)
5. Stat Label (10px)

**Pattern**: Small labels/headers (10-12px) consistently use uppercase ✓

---

## SECTION 13: OVERALL ASSESSMENT

### Strengths ✓
- Clear font family hierarchy (Inter for UI, Roboto Mono for data)
- Good semantic weight distribution (400→600→700)
- Mostly consistent component sizing
- Appropriate line-height values
- Good fallback font stacks

### Weaknesses ✗
- 15px anomaly in part name input
- Inline styles instead of CSS variables
- Minor size variations in metadata (11px vs 12px)
- Unclear heading hierarchy documentation
- Icon sizing not defined in variables

### Estimated Refactor Time
- **Critical fixes**: 30 minutes
- **High priority standardization**: 1 hour
- **Variable definitions + refactor**: 1 hour
- **Total**: 2-2.5 hours

---

## SECTION 14: QUICK REFERENCE - ALL 59 FONT-SIZE INSTANCES

**9px** (1)
- .kpi-card-unit

**10px** (4)
- .kpi-card-label
- .kpi-formula
- .snapshot-locked-badge
- .stat-label

**11px** (9)
- .collapsed-badge
- .bridge-id
- .sidebar-heading
- .positions-table th
- .rfi-badge
- .kpi-metadata
- .tooltip-id
- .sidebar-empty p
- .part-name-label

**12px** (8)
- .sidebar-heading
- .part-name-label (duplicate)
- .concrete-param label
- .snapshot-title
- .snapshot-date
- .modal-footer-text
- .snapshot-description
- .duration-toggle button

**13px** (13)
- .sidebar-toggle
- .tool-button
- .bridge-name
- .checkbox-label
- .tooltip-name
- .positions-table
- .positions-table input
- .cell-computed
- .cell-kros
- .bridge-selector / select
- .form-row label
- .snapshot-unlock-btn
- .stat-value

**14px** (9)
- global body
- global button
- .btn-primary, .btn-secondary
- .part-header
- .concrete-value
- .icon-button
- .kpi-card-value
- .snapshot-title
- .snapshot-action-btn

**15px** (1) **[ANOMALY]**
- .part-name-input

**16px** (4)
- html
- .lock-indicator
- .kpi-card-icon
- .kpi-bridge-title

**18px** (4)
- .header-logo h1
- .btn-theme-toggle
- .modal-title
- .modal-close

**20px** (2)
- .kpi-card-icon
- h2

**24px** (2)
- .sidebar.collapsed .collapsed-icon
- h1

**28px** (1)
- .snapshot-icon

**60px** (2)
- .empty-state-icon
- .history-empty-icon

---

## CONCLUSION

The typography system is **well-structured but has maintenance issues**:

1. **One critical anomaly**: Part name input at 15px
2. **Inline styles**: Should use CSS variables
3. **Minor inconsistencies**: Metadata sizes, badge sizes
4. **Good semantic usage**: Font weights and families are appropriate

**Recommendation**: Implement Priority 1 and 2 fixes immediately (1-2 hours) to establish clear standards for the design system.

