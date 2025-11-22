# Monolit-Planner Refactoring Analysis

**Status**: STEP 1 Analysis Complete

## Current State

### Template Definitions (Scattered)

#### 1. `/backend/src/constants/bridgeTemplates.js`
- **Contains**: `BRIDGE_TEMPLATE_POSITIONS` - 11 bridge-specific parts with multiple subtypes (concrete, formwork, reinforcement, etc.)
- **Used by**: `upload.js` for Excel import
- **Scope**: BRIDGE ONLY - not reusable for other object types

#### 2. `/backend/src/db/migrations.js` - `autoLoadPartTemplatesIfNeeded()`
- **Contains**: Simple template definitions for ALL object types (bridge, building, parking, road)
- **Structure**: `{ object_type, part_name, display_order, is_default }`
- **Total**: 34 predefined parts (12 bridge + 8 building + 6 parking + 8 road)
- **Used by**: Project creation in `monolith-projects.js`
- **Problem**: Hardcoded in migrations - not reusable or maintainable

### Project Creation Flow

**File**: `/backend/src/routes/monolith-projects.js` - `POST /api/monolith-projects`

✅ **What Works**:
- Correctly fetches templates from `part_templates` table for the selected `object_type`
- Logs templates that are found (e.g., "Found 12 templates for bridge")
- Creates parts in the database using batch insert (transaction-safe)
- Returns 503 error if no templates exist

❌ **Problems**:
- Templates must be pre-loaded in `part_templates` table (via migrations)
- No validation that templates actually exist before project creation
- Logging shows templates are found, but frontend might not display them
- Need to verify that created parts are returned to frontend

### Excel Import Flow

**File**: `/backend/src/routes/upload.js`

**Current Pipeline**:
1. **Data Preprocessing**: `DataPreprocessor.preprocess()` - normalizes and cleans rows
2. **CORE-First Approach**: Calls `parseExcelByCORE(filePath)` for intelligent parsing
3. **Fallback**: Uses local `extractConcretePositions()` from `concreteExtractor.js` if CORE fails

**Local Concrete Extractor** (`concreteExtractor.js`):
- Attempts to detect concrete rows based on:
  - Concrete marks (C25/30, C30/37, etc.) - **REGEX PATTERN**: `/C\d{2}\/\d{2}/i`
  - Czech text keywords (piloty, pilíř, beton, itd.)
  - Units (M3, m², kg)
- Issues:
  - Duplicates CORE's concrete grade detection logic
  - Simple heuristics not as robust as CORE
  - Part name extraction is basic (just keywords, no semantic understanding)

### Part Creation in Frontend

**Problem Area**: The "NOVÁ ČÁST" ghost group

Currently the frontend might:
- Create a fake group "NOVÁ ČÁST" when there are no positions
- Allow editing the name but not persist anything
- Confuse backend which has actual parts but frontend shows virtual ones

## Key Issues to Fix

### Issue 1: Scattered Template Definitions
- **Symptoms**: Hardcoded in migrations.js and bridgeTemplates.js
- **Impact**: Difficult to maintain, unclear which is the source of truth
- **Solution**: Create single `objectTemplates.js` module

### Issue 2: Manual Mode Parts Not Populated
- **Symptoms**: Logs show templates found, but frontend shows empty parts table
- **Impact**: Users cannot see template parts to edit
- **Likely Cause**: Templates are created in DB but not returned to frontend, OR frontend not fetching them

### Issue 3: Double Part Creation Logic
- **Symptoms**: Both `BRIDGE_TEMPLATE_POSITIONS` and `part_templates` table
- **Impact**: Confusion about which is used when
- **Solution**: Consolidate into single source

### Issue 4: Excel Import Relies on Regex
- **Symptoms**: Duplicate concrete grade patterns with CORE
- **Impact**: Inconsistent detection between CORE and local fallback
- **Solution**: Clearly document that local fallback is simple, prefer CORE

### Issue 5: Frontend "NOVÁ ČÁST" Virtual Group
- **Symptoms**: Users see fake part group that has no positions
- **Impact**: Cannot add positions, creates confusion
- **Solution**: Always populate parts from DB templates, no virtual groups

### Issue 6: Left Sidebar Out of Sync
- **Symptoms**: Sidebar shows parts but they don't match backend data
- **Impact**: Users trust sidebar but calculations don't match
- **Solution**: Sidebar always derives from backend part_names

## Refactoring Steps

### STEP 1: Analysis ✅ COMPLETE
- [x] Identified where templates are defined
- [x] Found where they're used
- [x] Documented problems and root causes

### STEP 2: Create `objectTemplates.js`
- [ ] Create `/backend/src/constants/objectTemplates.js`
- [ ] Export template structure and all definitions
- [ ] Update migrations to use new module
- [ ] Remove hardcoded templates from migrations

### STEP 3: Manual Mode Fix
- [ ] Verify projects are created with parts from templates
- [ ] Check that parts are returned to frontend on project creation
- [ ] Verify frontend displays parts immediately
- [ ] Add debug logging to trace the issue

### STEP 4: Unify Part Creation
- [ ] Ensure only ONE path creates parts (via NewPartModal)
- [ ] Remove any special-case "NOVÁ ČÁST" logic
- [ ] Test adding new parts after import

### STEP 5: Excel Import Pipeline
- [ ] Document that CORE is primary
- [ ] Simplify local extractor (remove grade patterns)
- [ ] Add clear logging for fallback vs CORE
- [ ] Test both CORE and fallback paths

### STEP 6: Frontend Parts Display
- [ ] Fix sidebar to derive from backend parts list
- [ ] Remove any frontend-only part creation
- [ ] Ensure parts are always from templates or import

### STEP 7: Logging & Safety
- [ ] Add structured logging for template loading
- [ ] Add checks that templates exist before project creation
- [ ] Add warnings for fallback use

## Affected Files

### Backend
- [x] `/backend/src/db/migrations.js` - autoLoadPartTemplatesIfNeeded()
- [x] `/backend/src/constants/bridgeTemplates.js` - BRIDGE_TEMPLATE_POSITIONS
- [ ] `/backend/src/constants/objectTemplates.js` - (TO CREATE)
- [ ] `/backend/src/routes/monolith-projects.js` - project creation
- [ ] `/backend/src/routes/upload.js` - Excel import
- [ ] `/backend/src/services/concreteExtractor.js` - local fallback
- [ ] `/backend/src/services/parser.js` - Excel parsing
- [ ] `/backend/src/services/dataPreprocessor.js` - data normalization

### Frontend
- [ ] Sidebar component - derive from backend, not frontend parsing
- [ ] Project creation form - don't create fake "NOVÁ ČÁST"
- [ ] Parts table - always fetch from backend
- [ ] NewPartModal - single canonical way to add parts

## Success Criteria

After refactoring:
1. ✅ Manual mode: Creating a project auto-populates parts from templates
2. ✅ Parts are visible in frontend immediately after creation
3. ✅ Single "Add Part" flow via NewPartModal
4. ✅ No "NOVÁ ČÁST" virtual groups
5. ✅ Excel import uses CORE, has simple local fallback
6. ✅ Left sidebar derives from backend, never shows fake parts
7. ✅ Clear logging throughout the pipeline
8. ✅ Templates are maintainable in single module

---

**Analysis Date**: November 22, 2025
**Analyst**: Claude Code
**Next Step**: Create `/backend/src/constants/objectTemplates.js`
