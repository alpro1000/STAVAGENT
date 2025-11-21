# TYPOGRAPHY QUICK REFERENCE GUIDE
## Monolit Planner v4.7.0

---

## FONT SCALE VISUALIZATION

```
60px ████████████████████████████ Empty State Icons
28px ████████░░░░░░░░░░░░░░░░░░░░░ Snapshot Icon

24px ████████░░░░░░░░░░░░░░░░░░░░░ Global h1
20px ████░░░░░░░░░░░░░░░░░░░░░░░░░░ Global h2

18px ███░░░░░░░░░░░░░░░░░░░░░░░░░░░ Headers, Modal Titles
16px ███░░░░░░░░░░░░░░░░░░░░░░░░░░░ KPI Title, Secondary Headings

14px ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Body, Buttons, Values (STANDARD)
15px ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Part Name Input (ANOMALY!)

13px █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Form Inputs, Table Cells
12px █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Form Labels, Dates

11px █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Badges, Headers, Metadata
10px █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Small Labels, Units

9px  █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ KPI Units
```

---

## FONT-WEIGHT SCALE

```
700 BOLD         █████████░░░░░░░░░░░░░░░░ Badges, Important Values (7x)
600 SEMI-BOLD    ███████████████████░░░░░░ Headers, Labels, Main Text (15+x)
500 MEDIUM       ██████░░░░░░░░░░░░░░░░░░░ Buttons, Interactive (6x)
400 REGULAR      ██░░░░░░░░░░░░░░░░░░░░░░░ Placeholders, Helper Text (2x)
```

---

## COMPONENT TYPOGRAPHY MATRIX

### SIZE CONSISTENCY ACROSS COMPONENTS

```
┌─────────────────────────────────────────────────────────────┐
│ CONSISTENT SIZES                                             │
├─────────────────────────────────────────────────────────────┤
│ 11px   │ Badges         │ bridge-badge           │ ✓        │
│        │ Metadata       │ kpi-metadata           │ ✓        │
│        │ Table Headers  │ positions-table th     │ ✓        │
│        │ RFI Badge      │ rfi-badge              │ ✓        │
│        │ IDs            │ bridge-id              │ ✓        │
├─────────────────────────────────────────────────────────────┤
│ 13px   │ Form Inputs    │ positions-table input  │ ✓        │
│        │ Table Cells    │ cell-computed          │ ✓        │
│        │ Selectors      │ bridge-selector        │ ✓        │
│        │ Bridge Name    │ bridge-name            │ ✓        │
├─────────────────────────────────────────────────────────────┤
│ 14px   │ Body Text      │ body, button           │ ✓        │
│        │ Values         │ concrete-value         │ ✓        │
│        │ KPI Value      │ kpi-card-value         │ ✓        │
│        │ Snapshots      │ snapshot-title         │ ✓        │
├─────────────────────────────────────────────────────────────┤
│ 18px   │ Titles         │ header-logo h1         │ ✓        │
│        │ Modals         │ modal-title            │ ✓        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ INCONSISTENT SIZES - ISSUES                                  │
├─────────────────────────────────────────────────────────────┤
│ Part Name Input     │ 15px       │ UNIQUE!   │ Should: 14px │
│ Duration Toggle     │ 12px       │ Different │ Should: 14px │
│ Snapshot Date       │ 12px       │ Metadata  │ Should: 11px │
│ Snapshot Badge      │ 10px       │ Badge     │ Should: 11px │
│ Icon Button (theme) │ 18px       │ Icon      │ Should: 14px │
└─────────────────────────────────────────────────────────────┘
```

---

## FONT FAMILY DISTRIBUTION

```
INTER (Primary Font - 85%)
├── All headings (h1-h4)
├── Body text & paragraphs
├── Buttons & interactive elements
├── Form labels & placeholders
├── KPI labels & units
├── Badges & tags
└── UI text

ROBOTO MONO (Technical Font - 15%)
├── Bridge IDs & technical IDs
├── Position data & quantities
├── KPI values & calculations
├── Table numeric cells
├── Snapshot dates & times
├── Formula text
└── Timeline data
```

---

## LINE-HEIGHT COMPARISON

```
1.5  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ Body text (READABLE) ✓
     Most readable for paragraph text

1.3  ░░░░░░░░░░░░░░░░ Headings (TIGHT) ✓
     Appropriate for titles and headers

1.2  ░░░░░░░░░░ KPI Values (COMPACT) ✓
     Good for numeric data
```

---

## TYPOGRAPHY HIERARCHY MAP

```
PRIMARY LEVEL (24px - Main Titles)
    ↓
SECONDARY LEVEL (20px - Section Titles)
    ↓
TERTIARY LEVEL (18px - Component Headers)
    ↓
BODY LEVEL (14px - Standard Text)
    ↓
LABEL LEVEL (12px - Form Labels)
    ↓
METADATA LEVEL (11px - Secondary Info)
    ↓
UTILITY LEVEL (10px - Units, Small Labels)
    ↓
MINIMAL LEVEL (9px - Micro Text)
```

---

## CRITICAL ISSUES AT A GLANCE

### Issue #1: THE 15px ANOMALY
```
FOUND: .part-name-input { font-size: 15px; }
UNIQUE: This size exists nowhere else
IMPACT: Visual inconsistency with all other form inputs (13px)
FIX: Change to 14px
TIME: 2 minutes
```

### Issue #2: FORM INPUT SIZES ALL OVER THE PLACE
```
Bridge Selector:        13px
Part Name Input:        15px  ← WRONG
Duration Toggle:        12px
CreateBridgeForm:       1rem (16px)
Table Inputs:           13px

STANDARDIZE TO: 14px
TIME: 10 minutes
```

### Issue #3: METADATA INCONSISTENCY
```
KPI Metadata:           11px ✓ CORRECT
Snapshot Date:          12px ✗ INCONSISTENT
Timeline Date:          12px ✗ INCONSISTENT

STANDARDIZE TO: 11px
TIME: 5 minutes
```

### Issue #4: BADGE SIZE VARIATION
```
Collapsed Badge:        11px ✓
Bridge Badge:           11px ✓
RFI Badge:              11px ✓
Snapshot Locked Badge:  10px ✗ ODD ONE OUT

STANDARDIZE TO: 11px
TIME: 2 minutes
```

### Issue #5: INLINE STYLES VS VARIABLES
```
Header.tsx:                 fontSize: '32px'    → Should use variable
DaysPerMonthToggle.tsx:     fontSize: '16px'    → Should use variable
CreateBridgeForm.tsx:       font-size: 1rem     → Should use variable

FIX: Replace with CSS variables
TIME: 15 minutes
```

---

## COMPONENT TYPOGRAPHY PROFILES

### HEADER COMPONENT
```
Logo Title:    18px / 600 / Inter
Button Text:   14px / 500 / Inter
Icon Size:     32px (inline)

STATUS: ✓ Mostly good | ⚠️ Use CSS variables for icon size
```

### SIDEBAR COMPONENT
```
Section Heading:    12px / 600 / Inter / UPPERCASE / Letter-spacing 0.5px
Bridge Name:        13px / 600 / Inter / Letter-spacing -0.3px
Bridge ID:          11px / - / Roboto Mono
Badge:              11px / 700 / Inter

STATUS: ✓ Good hierarchy | ⚠️ Explain negative letter-spacing
```

### KPI PANEL COMPONENT
```
Title:              16px / 600 / Inter
Card Label:         10px / 600 / Inter / Letter-spacing 0.2px
Card Value:         14px / 700 / Roboto Mono / Line-height 1.2
Card Unit:          9px / 500 / Inter
Metadata:           11px / - / Roboto Mono
Formula:            10px / - / Roboto Mono / Line-height 1.3

STATUS: ✓ Excellent hierarchy | ✓ Clear semantic sizes
```

### POSITIONS TABLE COMPONENT
```
Body:               13px / - / Inter
Header:             11px / 600 / Inter / UPPERCASE / Letter-spacing 0.5px
Input:              13px / - / Roboto Mono
Computed Value:     13px / 500 / Roboto Mono
KROS Value:         13px / 700 / Roboto Mono
RFI Badge:          11px / 600 / Inter

STATUS: ✓ Very consistent | ✓ Good semantic distinction
```

### PART HEADER COMPONENT
```
Header:             14px / 600 / Inter
Label:              11px / 600 / Inter / UPPERCASE / Letter-spacing 0.5px
Input:              15px / 600 / Inter ✗ ANOMALY
Concrete Value:     14px / 700 / Roboto Mono

STATUS: ✗ Input size is wrong | Must fix 15px → 14px
```

### MODAL COMPONENTS
```
Title:              18px / 600 / Inter
Close Button:       18px / - / Icon
Body:               14px / 400 / Inter
Footer Text:        13px / - / Roboto Mono

STATUS: ✓ Consistent with headers | Consider 1.4 line-height for body
```

### SNAPSHOT COMPONENTS
```
Title:              14px / 600 / Inter
Date:               12px / - / Roboto Mono ⚠️ Should be 11px
Button:             13px / 600 / Inter
Badge:              10px / 700 / Inter ⚠️ Should be 11px
Stat Value:         13px / 700 / Roboto Mono
Stat Label:         10px / 600 / Inter / UPPERCASE / Letter-spacing 0.5px

STATUS: ⚠️ Minor inconsistencies in badge and date size
```

---

## QUICK FIX CHECKLIST

### 5-MINUTE FIXES (Do First)
- [ ] Change `.part-name-input` from 15px to 14px
- [ ] Change `.snapshot-locked-badge` from 10px to 11px
- [ ] Change `.snapshot-date` from 12px to 11px

### 15-MINUTE FIXES (Do Second)
- [ ] Replace inline font-sizes in Header.tsx
- [ ] Replace inline font-sizes in DaysPerMonthToggle.tsx
- [ ] Replace inline font-sizes in CreateBridgeForm.tsx

### 30-MINUTE FIXES (Do Third)
- [ ] Standardize all form input sizes to 14px
- [ ] Define CSS variables for icon sizes (32px, 40px, 60px)
- [ ] Document heading hierarchy

### 1-HOUR FIXES (Long-term)
- [ ] Create typography CSS variables for all scales
- [ ] Create style guide document
- [ ] Document letter-spacing decisions
- [ ] Add line-height variables

---

## TYPOGRAPHY SCALE CHEAT SHEET

```
FOR TEXT ELEMENTS:
9px   = Component units, tiny labels
10px  = KPI labels, stat labels
11px  = Badges, metadata, secondary headers
12px  = Form labels, dates, descriptions
13px  = Form inputs, table cells, code
14px  = BODY TEXT, BUTTONS, VALUES (STANDARD)
16px  = Secondary headings
18px  = Component titles (header, modals)
20px  = Page sections (h2)
24px  = Page title (h1)

FOR ICONS/VISUAL ELEMENTS:
32px  = Icon buttons
40px  = Large action buttons
60px  = Empty state icons

FOR FONT WEIGHTS:
400   = Placeholders, helper text
500   = Buttons, interactive elements
600   = Headings, labels, main text
700   = Badges, emphasized values

FOR LINE-HEIGHT:
1.2   = Numeric/compact data
1.3   = Headings/titles
1.5   = Body/paragraph text (default)

FOR LETTER-SPACING:
-0.3px = Tight text (bridge-name only)
 0.0px = Default
 0.2px = Subtle spacing (KPI labels)
 0.5px = UPPERCASE labels (semantic)
```

---

## FONT-FAMILY RULES

```
USE INTER FOR:
├── Any text that's not technical
├── All headings
├── Buttons and interactive text
├── Form labels
├── UI text in general
└── Badges and tags

USE ROBOTO MONO FOR:
├── Bridge IDs and technical IDs
├── Position data and quantities
├── KPI values and calculations
├── Table numeric values
├── Snapshot dates and times
├── Formula and math expressions
└── Any code or technical data
```

---

## BEFORE & AFTER COMPARISON

### BEFORE (Current)
```
Part Name Input:        15px (unique, wrong size)
Form Inputs:            13px, 14px, 15px, 16px (scattered)
Badges:                 10px, 11px (inconsistent)
Metadata:               11px, 12px (varies)
Icon Sizes:             32px, 40px, 60px (not in CSS vars)
Inline Styles:          Multiple instances (not using variables)

PROBLEMS: Inconsistent scale, hard to maintain, visual noise
```

### AFTER (Recommended)
```
Form Inputs:            All 14px (consistent)
Badges:                 All 11px (consistent)
Metadata:               All 11px (consistent)
Icon Sizes:             CSS variables (maintainable)
Inline Styles:          Replaced with variables (consistent)
Font Sizes:             10, 11, 12, 13, 14, 16, 18, 20, 24 (clean scale)

BENEFITS: Professional, maintainable, consistent visual language
```

---

## IMPLEMENTATION PRIORITY

```
PHASE 1 - CRITICAL (30 min) - FIX NOW
├─ .part-name-input: 15px → 14px
├─ .snapshot-locked-badge: 10px → 11px
├─ .snapshot-date: 12px → 11px
└─ Define icon size variables

PHASE 2 - HIGH (1 hour) - FIX THIS WEEK
├─ Replace inline font-sizes
├─ Standardize form input sizes
├─ Document heading hierarchy
└─ Create typography variables

PHASE 3 - MEDIUM (1 hour) - FIX NEXT WEEK
├─ Line-height variables
├─ Letter-spacing documentation
├─ Component style guide
└─ Typography documentation

PHASE 4 - LOW (as needed) - ONGOING
├─ Monitor new components
├─ Review consistency
├─ Update style guide
└─ Training for team
```

---

## QUICK STATS

- **Total font-size values used**: 13 different sizes (9px - 60px)
- **Ideal scale sizes**: 8-10 sizes (currently have 13)
- **Font families**: 2 (Inter, Roboto Mono)
- **Font weights**: 4 (400, 500, 600, 700)
- **Line-height values**: 3 (1.2, 1.3, 1.5)
- **Letter-spacing values**: 3 (-0.3px, 0.2px, 0.5px)
- **Critical inconsistencies**: 1 (15px anomaly)
- **Moderate inconsistencies**: 4 (form sizes, badge sizes, metadata)
- **Estimated fix time**: 2-3 hours
- **Potential refactor benefit**: High (better maintainability, consistency)

---

## FINAL VERDICT

**Current State**: Good foundation with minor maintenance issues
**Maintainability**: 6/10 (needs variables and standardization)
**Consistency**: 7/10 (good semantic usage, minor size variations)
**Scalability**: 5/10 (inline styles hurt flexibility)
**Readability**: 8/10 (good font choices and hierarchy)

**Overall Grade**: B+ (Good, but needs Polish)

**Recommendation**: Implement Phase 1 & 2 fixes (1-2 hours) for immediate improvement.

