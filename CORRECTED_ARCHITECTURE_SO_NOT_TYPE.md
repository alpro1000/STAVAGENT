# 🚨 CORRECTED ARCHITECTURE: SO is NOT bridge identifier, it's ANY object

**Critical Realization:** "SO" = Stavební Objekt (ANY construction object, not just bridges)
**Status:** Architecture understanding corrected
**Date:** November 20, 2025

---

## 🔴 WHAT WAS WRONG IN MY ANALYSIS

### My Mistake 1: SO Code Parsing for Type Detection
```javascript
// I SUGGESTED THIS - WRONG!
if (desc.includes('MOST')) return 'bridge';      // ❌ Wrong
if (desc.includes('TUNEL')) return 'tunnel';    // ❌ Wrong
```

**Why It's Wrong:**
- SO = Standard construction object naming convention
- SO 202, SO 203, SO 204 can ALL be ANY type (mosts, tunels, buildings, etc.)
- Parsing SO code assumes type = object type → FALSE
- SO code is just **ID, not type classifier**

### Your Correction:
> "SO это не кодирование мостов, это стандартное название любого строительного объекта"

**Correct Understanding:**
```
SO 202 - MOST PŘES POTOK           → SO is ID, "MOST" is type descriptor
SO 203 - TUNEL                     → SO is ID, "TUNEL" is type descriptor
SO 204 - BUDOVA SPRÁVY             → SO is ID, "BUDOVA" is type descriptor
SO 205 - NASYPOVÁ ZEMINA           → SO is ID, "NASYPOVÁ" is type descriptor
SO 206 - RETENCI VODY              → SO is ID, "RETENCI" is type descriptor
```

---

## ✅ CORRECT ARCHITECTURE

### 1. CORE Parser Should Handle ALL Formats

**Current Assumption (WRONG):**
- "We need to write parsers for Excel, XML, PDF"

**Correct Approach (YOUR INSIGHT):**
- CORE parser already handles Excel, PDF, XML, XC4
- CORE returns: material_type, technical_specs, quantities
- **Don't write custom parsers - use CORE for everything**

**Why This Makes Sense:**
- CORE is universal parser (handles all formats)
- Eliminates custom parsing logic
- Consistent results across formats
- CORE already handles:
  - Excel (SOUPIS PRACÍ format)
  - PDF (KRYCÍ LIST format)
  - XML/XC4 (structured format)

---

### 2. Remove SO Code Parsing for Type Detection

**What Should Be DELETED:**
```javascript
// REMOVE THIS - WRONG APPROACH
function extractBridgesFromSOCodes(rawData) {
  // Parses SO codes thinking they determine type
  // FALSE - SO is just ID, not type
}

function detectObjectTypeFromSOCode(soDescription) {
  // Trying to determine type from "SO 202"
  // WRONG - SO is just ID
}
```

**Why It's Wrong:**
- SO 202 can be bridge, tunnel, building, embankment
- Can't determine type from SO code alone
- Creates wrong object types

---

### 3. Object Type Detection Must Come From Description, NOT SO Code

**Correct Approach:**
```javascript
function detectObjectTypeFromDescription(description) {
  // Parse the FULL description text, not just SO code

  const desc = description.toLowerCase();

  // Keywords in DESCRIPTION, not SO code
  if (desc.includes('most') || desc.includes('bridge')) return 'bridge';
  if (desc.includes('tunel') || desc.includes('tunnel')) return 'tunnel';
  if (desc.includes('budov') || desc.includes('building')) return 'building';
  if (desc.includes('nasypov') || desc.includes('embankment')) return 'embankment';
  if (desc.includes('retenci') || desc.includes('retaining')) return 'retaining_wall';
  if (desc.includes('parkov') || desc.includes('parking')) return 'parking';

  return 'custom';  // Unknown type
}

// Example:
detectObjectTypeFromDescription("SO 202 - MOST PŘES POTOK V KM 2,710")
  // Parses: "MOST" = bridge ✅

detectObjectTypeFromDescription("SO 203 - TUNEL POD SILNICÍ")
  // Parses: "TUNEL" = tunnel ✅

detectObjectTypeFromDescription("SO 204 - BUDOVA SPRÁVY")
  // Parses: "BUDOVA" = building ✅
```

**Key Difference:**
- ❌ WRONG: Parse SO code ("202" → nothing useful)
- ✅ CORRECT: Parse object DESCRIPTION ("MOST", "TUNEL", "BUDOVA")

---

### 4. File Metadata → Project Hierarchy

**Current Understanding (WRONG):**
- Import file → Create bridges → Done

**Correct Understanding (YOUR MODEL):**
- Import file → Extract Stavba (project) → Extract Objects (SO 202, SO 203, etc.)
- **Hierarchy:** Stavba → Objects → Positions

**Database Structure:**
```sql
-- Project level (from file Stavba header)
INSERT INTO monolith_projects (
  project_id = 'stavba_20_hnevkov_sedlice',
  object_type = 'project',
  stavba = 'I/20 HNĚVKOV - SEDLICE',
  ...
);

-- Object level (each SO code)
INSERT INTO monolith_projects (
  project_id = 'so_202_most',
  parent_project_id = 'stavba_20_hnevkov_sedlice',  -- Links to stavba
  object_type = 'bridge',                            -- From description parsing
  objekt = 'SO 202 - MOST PŘES POTOK',
  stavba = 'I/20 HNĚVKOV - SEDLICE',
  ...
);

INSERT INTO monolith_projects (
  project_id = 'so_203_tunel',
  parent_project_id = 'stavba_20_hnevkov_sedlice',  -- Links to stavba
  object_type = 'tunnel',                            -- From description parsing
  objekt = 'SO 203 - TUNEL',
  stavba = 'I/20 HNĚVKOV - SEDLICE',
  ...
);
```

**Key Point:**
- `stavba` = project container (from file header)
- `objekt` = individual object (from SO row)
- `parent_project_id` = links objects to project
- **This mirrors your manual UI where you create project, then add objects to it**

---

## 🔧 REQUIRED CODE CHANGES

### Change 1: Completely Remove SO-Based Type Detection

**DELETE:**
- `extractBridgesFromSOCodes()` function (lines 233-340 in parser.js)
- All logic that tries to determine type from SO code

**Reason:**
- SO code doesn't determine type
- Creates wrong object classifications
- Causes all objects to be treated as "bridges"

---

### Change 2: Implement Description-Based Type Detection

**ADD:**
```javascript
/**
 * Detect object type from description text
 * Parses full description, NOT SO code
 *
 * Example: "SO 202 - MOST PŘES POTOK" → type='bridge'
 *          "SO 203 - TUNEL" → type='tunnel'
 *          "SO 204 - BUDOVA" → type='building'
 */
function detectObjectTypeFromDescription(description) {
  if (!description) return 'custom';

  const desc = description.toLowerCase();

  // Check for type keywords in description
  if (desc.includes('most')) return 'bridge';
  if (desc.includes('tunel')) return 'tunnel';
  if (desc.includes('budov')) return 'building';
  if (desc.includes('nasypov') || desc.includes('nasyp')) return 'embankment';
  if (desc.includes('retenci') || desc.includes('opěrn')) return 'retaining_wall';
  if (desc.includes('parkov')) return 'parking';
  if (desc.includes('silnic') || desc.includes('cesta')) return 'road';

  return 'custom';
}
```

---

### Change 3: Use CORE Parser as ONLY Source

**Current Flow (MIXED):**
```
Upload → parseXLSX() + CORE parser → extractBridgesFromData() + extractBridgesFromCOREResponse()
         ↓ (sometimes uses M3 detection, sometimes CORE)
         Mixed results ❌
```

**Correct Flow (CORE ONLY):**
```
Upload File (Excel, PDF, XML, XC4)
  ↓
CORE Parser processes it (handles all formats)
  ↓
extractProjectsFromCOREResponse() processes CORE output
  ↓
Determine object_type from description (not SO code)
  ↓
Create hierarchy: Stavba → Objects → Positions ✅
```

---

### Change 4: Extract Stavba Metadata

**ADD:**
```javascript
/**
 * Extract file metadata from CORE response or file headers
 * Returns: { stavba, objekt, soupis }
 */
function extractFileMetadata(coreResponse) {
  // CORE might include metadata about the project
  // If not, need to extract from file headers

  // Check if CORE includes project metadata
  if (coreResponse.project_info) {
    return {
      stavba: coreResponse.project_info.project_name,
      objekt: coreResponse.project_info.object_name,
      soupis: coreResponse.project_info.soupis_name
    };
  }

  // Fallback: return null, will ask user
  return null;
}
```

---

### Change 5: Create Project-Level Record

**ADD Logic in upload.js:**
```javascript
// After CORE parsing, before creating objects:

// 1. Extract metadata
const metadata = extractFileMetadata(coreResponse);

// 2. Create/get project (stavba)
let projectId;
if (metadata && metadata.stavba) {
  projectId = normalizeString(metadata.stavba);

  // Check if project exists
  const existing = await db.prepare(
    'SELECT project_id FROM monolith_projects WHERE project_id = ?'
  ).get(projectId);

  if (!existing) {
    // Create project record
    await db.prepare(`
      INSERT INTO monolith_projects
      (project_id, object_type, stavba, description, owner_id)
      VALUES (?, 'project', ?, ?, ?)
    `).run(projectId, metadata.stavba, metadata.stavba, req.user?.userId);
  }
} else {
  // No stavba metadata - ask user or use file name
  projectId = generateProjectIdFromFile(req.file.originalname);
}

// 3. Create objects (SO codes) linked to project
for (const corePosition of corePositions) {
  if (corePosition.material_type === 'concrete') {
    const objectType = detectObjectTypeFromDescription(corePosition.description);
    const objectId = normalizeString(corePosition.description);

    // Create object record linked to project
    await db.prepare(`
      INSERT INTO monolith_projects
      (project_id, parent_project_id, object_type, stavba, objekt, concrete_m3, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      objectId,
      projectId,           // ← Link to project
      objectType,
      metadata?.stavba,
      corePosition.description,
      corePosition.quantity,
      req.user?.userId
    );
  }
}
```

---

## 📊 Architecture Comparison

### BEFORE (WRONG):
```
File → Extract only data rows
        ↓
     Create "bridges" only (hardcoded)
        ↓
     Lose project context
        ↓
     Try to parse SO codes for type (WRONG)
        ↓
     All objects as bridges ❌
```

### AFTER (CORRECT):
```
File (any format: Excel, PDF, XML) → CORE Parser (universal)
        ↓
    Extract metadata (Stavba = project)
        ↓
    Get positions from CORE (with material_type)
        ↓
    Filter concrete positions
        ↓
    Create project record (stavba)
        ↓
    Create object records (SO codes)
        ├─ Detect type from DESCRIPTION (not SO code)
        ├─ Link to project via parent_project_id
        └─ Load correct part templates
        ↓
    Create position records
        ↓
    Proper hierarchy: Project → Objects → Positions ✅
```

---

## 🎯 Summary of Corrections

| Aspect | WRONG (I suggested) | CORRECT (Your insight) |
|--------|-------------------|----------------------|
| **SO Code Purpose** | Determines type | Just an ID |
| **Type Detection** | From SO code | From DESCRIPTION text |
| **Format Support** | Write custom parsers | Trust CORE parser |
| **Hierarchy** | Flat (all objects same level) | Hierarchical (stavba → objects) |
| **Project Context** | Ignored | Preserved (stavba container) |
| **Object Grouping** | No grouping | Grouped by stavba |

---

## ✅ What Now Needs to Happen

1. **DELETE** `extractBridgesFromSOCodes()` - completely wrong approach
2. **ADD** `detectObjectTypeFromDescription()` - parses text, not SO code
3. **ADD** `extractFileMetadata()` - gets stavba, objekt, soupis
4. **REFACTOR** `extractBridgesFromCOREResponse()`:
   - Rename to `extractProjectsFromCOREResponse()`
   - Include object_type detection
   - Return objects with parent_project_id
5. **UPDATE** `upload.js`:
   - Create project record (stavba)
   - Link objects to project
   - Use correct part templates per object_type
6. **TRUST CORE** for all format parsing

---

## 💡 Key Insight You Provided

Your statement: "SO - это не кодирование мостов, это стандартное название любого строительного объекта"

This is **fundamentally important** because:
- It reveals SO is just a naming convention, not a type classifier
- Type information comes from DESCRIPTION text
- Entire approach of "parse SO for type" was backwards
- CORE parser already returns what we need (material_type, quantities)
- We just needed to extract metadata and build hierarchy correctly

This completely changes how we structure the import pipeline!

---

Should I now rewrite the code with these corrections?
