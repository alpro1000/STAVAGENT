# 🚨 CRITICAL: Import Architecture is Fundamentally Incomplete

**Status:** Major architectural flaw identified
**Severity:** 🔴 CRITICAL - Multiple missing features
**Date:** November 20, 2025

---

## 📊 Real File Examples Analysis

### Example 1: SOUPIS PRACÍ (Excel/PDF Format)

**File Header Contains Metadata:**
```
Stavba:   "Sběrný dvůr Úněšovská, Plzeň"
Objekt:   "TOR05-04 - SO 04 Opěrné zdi v areálu sběrného dvora"
Сoupis:   "TOR05-04-1 - D.1.4.1 Stavebně technické řešení..."
```

**Current Code Problem:**
- ❌ Doesn't read headers for Stavba/Objekt metadata
- ❌ Doesn't extract project context from file
- ❌ Only looks at data rows, ignores structural information

---

### Example 2: KRYCÍ LIST SOUPISU PRACÍ

**File Header Structure:**
```
Stavba:      "I/20 HNĚVKOV - SEDLICE_N_CENA"
Objekt:      "SO 202 - MOST PŘES POTOK V KM 2,710"
Сoupis:      "202 - MOST PŘES POTOK V KM 2,710"
```

**Key Insight - SO Codes Determine Object Type!**
```
SO 202 - "MOST" (Bridge)                  → object_type = 'bridge'
SO 203 - "TUNEL" (Tunnel)                 → object_type = 'tunnel'
SO 204 - "BUDOVA" (Building)              → object_type = 'building'
SO 205 - "NÁSYP" (Embankment)             → object_type = 'embankment'
SO 206 - "RETENCI" (Retaining Wall)       → object_type = 'retaining_wall'
```

**Current Code Problem:**
- ❌ Ignores SO code structure
- ❌ Doesn't parse object type from SO description
- ❌ Doesn't use Stavba/Objekt for project context

---

### Example 3: XML/XC4 Format

**Structured Format:**
```xml
<stavba>
  <id_stavba>24047_DOD4</id_stavba>
  <nazev>I/20 HNĚVKOV - SEDLICE</nazev>
</stavba>

<objekt>
  <id_objekt>~SO 203</id_objekt>
  <znacka>SO 203</znacka>
  <nazev>MOST PŘES BIOKORIDOR V KM 3,360</nazev>
  <skupinaObjektu>SO</skupinaObjektu>
  <stavDily>
    <polozka>
      <znacka>272325</znacka>
      <nazev>ZÁKLADY ZE ŽELEZOBETONU DO C30/37</nazev>
      <id_mj>M3</id_mj>
      <mnozstvi>43.800000</mnozstvi>
    </polozka>
  </stavDily>
</objekt>
```

**Current Code Problem:**
- ❌ Only supports Excel format
- ❌ Doesn't support XML/XC4 formats
- ❌ No parsing of structured object/project metadata
- ❌ Can't extract object hierarchy

---

## 🔴 Critical Missing Features

### 1. Header Extraction (Stavba, Objekt, Сoupis)

**What Should Happen:**
```javascript
function extractFileMetadata(filePath) {
  // Read first few rows
  // Find: Stavba (project name)
  // Find: Objekt (object description with SO codes)
  // Find: Сoupis (budget/list name)
  // Return: { stavba, objekt, soupis }
}

Example result:
{
  stavba: "I/20 HNĚVKOV - SEDLICE_N_CENA",
  objekt: "SO 202 - MOST PŘES POTOK V KM 2,710",
  soupis: "202 - MOST PŘES POTOK V KM 2,710"
}
```

**Current Implementation:**
- ❌ Does NOT extract this information
- ❌ Loses project context
- ❌ Can't group positions by project

---

### 2. Object Type Detection from SO Codes

**What Should Happen:**
```javascript
function detectObjectTypeFromSOCode(soDescription) {
  const desc = soDescription.toLowerCase();

  if (desc.includes('most')) return 'bridge';
  if (desc.includes('tunel')) return 'tunnel';
  if (desc.includes('budov')) return 'building';
  if (desc.includes('násyp') || desc.includes('embankment')) return 'embankment';
  if (desc.includes('retenci') || desc.includes('opěrn')) return 'retaining_wall';

  return 'custom';
}

Example:
"SO 202 - MOST PŘES POTOK V KM 2,710"
→ Contains "MOST" (bridge)
→ object_type = 'bridge' ✅
```

**Current Implementation:**
- ❌ Uses unreliable keyword detection
- ❌ Doesn't leverage SO code structure
- ❌ Treats all concrete as "bridges"

---

### 3. Multi-Format Support

**What Should Be Supported:**
```
1. Excel (SOUPIS PRACÍ format)
   - Headers: Stavba, Objekt, Сoupis
   - Data rows: descriptions, quantities, units

2. PDF (KRYCÍ LIST format)
   - Same structure as Excel
   - Need OCR or text extraction

3. XML/XC4 format
   - Structured <stavba>, <objekt>, <polozka>
   - Direct field mapping
   - Hierachical relationships preserved
```

**Current Implementation:**
- ✅ Excel: supported
- ❌ PDF: NOT supported
- ❌ XML/XC4: NOT supported

---

### 4. Project-Level Aggregation

**What Should Happen:**

File contains:
```
Stavba:  "I/20 HNĚVKOV - SEDLICE_N_CENA"

Objekt 1: "SO 202 - MOST PŘES POTOK"
  - Concrete: 150 m3
  - Reinforcement: 50 t

Objekt 2: "SO 203 - TUNEL"
  - Concrete: 200 m3
  - Reinforcement: 60 t
```

**Should Create:**
```sql
INSERT INTO monolith_projects VALUES
  (project_id='stavba_20_hnevkov_sedlice',
   stavba='I/20 HNĚVKOV - SEDLICE_N_CENA',
   object_type='project',
   ...);

INSERT INTO monolith_projects VALUES
  (project_id='so_202_most',
   parent_project_id='stavba_20_hnevkov_sedlice',
   stavba='I/20 HNĚVKOV - SEDLICE_N_CENA',
   objekt='SO 202 - MOST PŘES POTOK',
   object_type='bridge',
   concrete_m3=150,
   ...);

INSERT INTO monolith_projects VALUES
  (project_id='so_203_tunel',
   parent_project_id='stavba_20_hnevkov_sedlice',
   stavba='I/20 HNĚVKOV - SEDLICE_N_CENA',
   objekt='SO 203 - TUNEL',
   object_type='tunnel',
   concrete_m3=200,
   ...);
```

**Current Implementation:**
- ❌ No project-level grouping
- ❌ No parent-child relationships
- ❌ No stavba context preserved

---

## 📋 Architecture Deficiencies

### Current Flow (BROKEN):
```
Upload Excel
  ↓
parseXLSX() → reads only data rows
  ↓
extractBridgesFromCOREResponse() → creates objects from CORE
  ↓
Insert into bridges table (HARDCODED!)
  ↓
Result: All objects as "bridges", no project context ❌
```

### Required Flow:

```
Upload File (Excel/XML/PDF)
  ↓
1. Extract Metadata (Stavba, Objekt, Сoupis)
  ↓
2. Detect File Format (Excel, XML, PDF)
  ↓
3. Create Project Record (from Stavba)
  ↓
4. Parse Concrete Positions (from CORE or file)
  ↓
5. Detect Object Type (from SO codes or CORE)
  ↓
6. Create Object Records (linked to Project)
  ↓
7. Create Position Records (linked to Objects)
  ↓
Result: Proper hierarchy with correct types ✅
```

---

## 🔧 Required Code Changes

### Change 1: Add Metadata Extraction

**New function needed:**
```javascript
async function extractFileMetadata(filePath) {
  // For Excel: scan first 20 rows for "Stavba:", "Objekt:", "Сoupis:"
  // For XML: parse <stavba>, <objekt> elements
  // Return: { stavba, objekt, soupis, format }
}
```

**Location:** `backend/src/services/parser.js`

---

### Change 2: Improve Object Type Detection

**Enhanced function needed:**
```javascript
function detectObjectType(soDescription, concreteDescription) {
  // First: parse SO code
  const soMatch = soDescription.match(/SO\s*(\d+)\s*-\s*([^-]+)/i);
  if (soMatch) {
    const soType = soMatch[2].toLowerCase();

    if (soType.includes('most')) return 'bridge';
    if (soType.includes('tunel')) return 'tunnel';
    if (soType.includes('budov')) return 'building';
    // ... etc
  }

  // Fallback: parse concrete description
  const desc = concreteDescription.toLowerCase();
  if (desc.includes('pilíř') || desc.includes('opěr')) return 'bridge';
  if (desc.includes('sloupy')) return 'building';
  // ... etc

  return 'custom';
}
```

**Location:** `backend/src/services/parser.js`

---

### Change 3: Support Multiple Formats

**New routing needed:**
```javascript
async function parseUploadedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.xlsx' || ext === '.xls') {
    return parseExcelFile(filePath);
  } else if (ext === '.xml' || ext === '.xc4') {
    return parseXMLFile(filePath);
  } else if (ext === '.pdf') {
    return parsePDFFile(filePath);  // NEW
  } else {
    throw new Error('Unsupported file format');
  }
}
```

**Location:** `backend/src/routes/upload.js`

---

### Change 4: Project-Level Aggregation

**Database schema change needed:**
```sql
ALTER TABLE monolith_projects ADD COLUMN (
  stavba VARCHAR(255),        -- Project name from file header
  objekt VARCHAR(255),        -- Object name from file header
  soupis VARCHAR(255),        -- Budget/list name
  parent_project_id VARCHAR(255),  -- Link to parent project
  file_source VARCHAR(255),   -- Which file this came from
  import_id VARCHAR(255)      -- Which import this came from
);

CREATE INDEX idx_stavba ON monolith_projects(stavba);
CREATE INDEX idx_parent ON monolith_projects(parent_project_id);
CREATE INDEX idx_import ON monolith_projects(import_id);
```

---

## 📊 Real File Structure Examples

### Excel Header Rows (First 20 rows)
```
Row 1:  Empty
Row 2:  "Stavba:" | "Sběrný dvůr Úněšovská, Plzeň"
Row 3:  "Objekt:" | "TOR05-04 - SO 04 Opěrné zdi"
Row 4:  "Сoupis:" | "TOR05-04-1 - D.1.4.1..."
Row 5:  Empty
Row 6:  "Popis" | "MJ" | "Množství" | "Cena"  ← HEADER ROW
Row 7+: Data rows
```

**Extraction Strategy:**
```javascript
// Scan first 15 rows for labels
for (let i = 0; i < 15; i++) {
  const row = rows[i];
  const firstCol = row[0];

  if (firstCol.includes('Stavba')) {
    metadata.stavba = row[1];
  }
  if (firstCol.includes('Objekt')) {
    metadata.objekt = row[1];
  }
  if (firstCol.includes('Сoupis')) {
    metadata.soupis = row[1];
  }
}
```

### XML Structure
```xml
<stavby>
  <stavba>
    <nazev>I/20 HNĚVKOV - SEDLICE</nazev>
    <objekty>
      <objekt>
        <znacka>SO 202</znacka>
        <nazev>MOST PŘES POTOK</nazev>
        <stavDily>
          <polozka>
            <nazev>Beton C30/37</nazev>
            <id_mj>M3</id_mj>
            <mnozstvi>150</mnozstvi>
          </polozka>
        </stavDily>
      </objekt>
    </objekty>
  </stavba>
</stavby>
```

**Extraction Strategy:**
```javascript
const stavba = xmlDoc.querySelector('stavba > nazev').textContent;
const objekty = xmlDoc.querySelectorAll('objekt');

objekty.forEach(obj => {
  const znacka = obj.querySelector('znacka').textContent;
  const nazev = obj.querySelector('nazev').textContent;
  const polozky = obj.querySelectorAll('polozka');
  // Process positions...
});
```

---

## 🎯 Summary of Required Fixes

| Feature | Current | Required |
|---------|---------|----------|
| **Extract Stavba/Objekt** | ❌ No | ✅ Must have |
| **Detect Object Type** | ❌ Hardcoded as "bridge" | ✅ From SO codes + CORE |
| **Support Multiple Formats** | ❌ Excel only | ✅ Excel, XML, PDF |
| **Project-Level Context** | ❌ No parent-child | ✅ Stavba → Objects hierarchy |
| **Preserve File Metadata** | ❌ Lost | ✅ Stored in DB |
| **Group by Project** | ❌ No | ✅ All objects linked to stavba |

---

## 🚀 Implementation Priority

1. **HIGH:** Extract Stavba/Objekt from file headers
   - Without this, we lose project context
   - ~1-2 hours work

2. **HIGH:** Improve object type detection using SO codes
   - Current approach is too simplistic
   - ~1-2 hours work

3. **MEDIUM:** Support XML/XC4 format
   - Many files are in this format
   - ~3-4 hours work

4. **MEDIUM:** Add project-level aggregation
   - Database schema changes
   - ~2-3 hours work

5. **LOW:** Support PDF format
   - Requires OCR
   - ~2-3 hours work

---

## ✅ Next Action

Should I now:
1. ✅ Add metadata extraction (Stavba, Objekt, Сoupis)
2. ✅ Improve SO code parsing for object type detection
3. ✅ Update database schema to support project hierarchy
4. ✅ Refactor import flow to use this information
5. ✅ Add XML/XC4 format support

**Or do you have other priorities first?**
