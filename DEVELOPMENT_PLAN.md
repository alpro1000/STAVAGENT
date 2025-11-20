# 🚀 MONOLIT PLANNER — STRATEGIC DEVELOPMENT PLAN

**Version:** 2.0
**Date:** November 12, 2025
**Status:** 🎯 Active Development

---

## 📐 CURRENT ARCHITECTURE

### Existing Stack
```
[Frontend React/TypeScript]
       ↓
[Backend Node.js/Express] ← Monolit-Planner
       ↓
[SQLite Database]
```

### Services on Render
- **monolit-planner-backend** (Node.js) - Main orchestrator
- **monolit-planner-frontend** (Static) - React UI
- **concrete-agent** (Python/FastAPI) - AI/Parser service (separate project)

---

## 🎯 TARGET ARCHITECTURE

### Microservices Design
```
                    [Frontend React/TypeScript]
                              ↓
                    [BFF - Node.js Backend]  ← Main Orchestrator
                         ↓           ↓
            ┌────────────┴────────────┴────────────┐
            ↓                                      ↓
[AI/Parser Service - Python]          [Database PostgreSQL]
   (concrete-agent on Render)              (Render 500MB free)
            ↓
    [Prompts + ML Models]
```

**Service Roles:**

1. **Frontend (React/TS)** - UI/UX, forms, tables, real-time updates, client validation
2. **BFF Backend (Node.js/TS)** - Orchestrator, CRUD, auth, WebSocket, caching, routing
3. **AI/Parser Service (Python/FastAPI)** - Document parsing, AI processing, ML calculations, OCR/Vision
4. **Database (PostgreSQL)** - Persistent storage, shared between services

**Communication:**
- Frontend ↔ BFF: REST API + WebSocket
- BFF ↔ AI Service: Internal HTTP (private network)
- BFF ↔ Database: Direct connection
- AI Service ↔ Database: Direct connection (for KB enrichment)

---

## 📋 PHASE 1: Parser Integration (2-3 weeks)

### 1.1 Prepare concrete-agent as Microservice

**Deploy Setup:**
- Deploy concrete-agent on Render as separate service
- Configure internal URL for communication
- Create API endpoints for Monolit-Planner

**Required Endpoints:**
```
POST /api/parse/excel       - Parse Excel with smart detection
POST /api/parse/xml         - Parse KROS XML (UNIXML/Tabular/XC4)
POST /api/parse/pdf         - Parse PDF tables
POST /api/validate/position - Validate position data
POST /api/suggest/otskp     - Suggest OTSKP codes
POST /api/enrich/position   - Enrich position with KB data
```

**Render Configuration:**
```yaml
# Service 1: monolit-planner-backend (Node.js)
- name: monolit-planner-backend
  type: web
  env: node
  buildCommand: npm install && npm run build
  startCommand: npm start

# Service 2: monolit-ai-service (Python)
- name: monolit-ai-service
  type: web
  env: python
  buildCommand: pip install -r requirements.txt
  startCommand: uvicorn app.main:app --host 0.0.0.0 --port 8000

# Both in same Private Network
privateNetworks:
  - monolit-private-net
```

### 1.2 Node.js Backend Adapter

**Create HTTP Client:**
```javascript
// backend/src/services/ai-service-client.js
class AIServiceClient {
  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.timeout = 60000; // 60s for heavy parsing
    this.retries = 3;
  }

  async parseExcel(filePath, options = {}) {
    // Upload file to AI service
    // Get normalized positions
    // Handle errors with fallback
  }

  async parseXML(filePath, format = 'auto') {
    // Parse KROS XML formats
  }

  async validatePosition(position) {
    // AI validation with confidence score
  }
}
```

**Fallback Strategy:**
```javascript
// Import flow with fallback
async function importExcel(filePath) {
  try {
    // Try AI service first
    if (isAIServiceAvailable()) {
      return await aiService.parseExcel(filePath);
    }
  } catch (error) {
    logger.warn('AI service failed, using local parser', error);
  }

  // Fallback to local parser
  return await localExcelParser.parse(filePath);
}
```

**Caching:**
- Cache parsed results by file hash
- TTL: 24 hours
- Storage: Redis or in-memory

### 1.3 Port Essential Parsers to Node.js

**Priority Parsers (port to Node.js):**

1. **Position Normalizer** (NO AI)
   - Header alias detection (50+ variants)
   - Czech diacritics normalization
   - Number parsing with various separators
   - Field validation

2. **KROS XML Parser** (NO AI)
   - UNIXML format
   - Tabular format
   - AspeEsticon XC4

**Keep in Python (AI-powered):**
- Smart Excel Parser (complex files)
- PDF Table Extraction
- Drawing Analysis (Vision)
- Text Builder (generation)

**Benefits:**
- Simple cases: free + fast (Node.js)
- Complex cases: accurate + smart (Python + AI)
- Reduced API costs

---

## 🏗️ PHASE 2: Universal Objects (1-2 weeks)

### 2.1 Data Model Refactoring

**Rename Entities:**
```typescript
// OLD
interface Bridge {
  bridge_id: string;
  project_name?: string;
  object_name: string;
  // ...
}

// NEW
interface MonolithProject {
  project_id: string;        // Changed from bridge_id
  project_name?: string;     // Parent project name
  object_name: string;       // Specific object name
  object_type: ObjectType;   // NEW!
  element_count: number;
  concrete_m3: number;
  sum_kros_czk: number;
  span_length_m?: number;
  deck_width_m?: number;
  pd_weeks?: number;
  status?: ProjectStatus;
  created_at?: string;
  updated_at?: string;
}

enum ObjectType {
  BRIDGE = 'bridge',
  BUILDING = 'building',
  PARKING = 'parking',
  TUNNEL = 'tunnel',
  DAM = 'dam',
  OTHER = 'other'
}

enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}
```

**New Tables:**
```sql
-- Main project table (renamed from bridges)
CREATE TABLE monolith_projects (
  project_id TEXT PRIMARY KEY,
  project_name TEXT,
  object_name TEXT NOT NULL,
  object_type TEXT DEFAULT 'bridge',
  element_count INTEGER DEFAULT 0,
  concrete_m3 REAL DEFAULT 0,
  sum_kros_czk REAL DEFAULT 0,
  span_length_m REAL,
  deck_width_m REAL,
  pd_weeks INTEGER,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dynamic parts (instead of hardcoded part_name)
CREATE TABLE project_parts (
  part_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  part_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_predefined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE
);

-- Positions reference parts
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  part_id TEXT NOT NULL,  -- Reference to project_parts
  subtype TEXT NOT NULL,
  -- ... existing fields ...
  FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES project_parts(part_id) ON DELETE CASCADE
);
```

**Migration Script:**
```sql
-- Migrate existing bridges to monolith_projects
INSERT INTO monolith_projects
  SELECT bridge_id as project_id, project_name, object_name,
         'bridge' as object_type, element_count, concrete_m3,
         sum_kros_czk, span_length_m, deck_width_m, pd_weeks,
         status, created_at, updated_at
  FROM bridges;

-- Create parts from existing positions
INSERT INTO project_parts (part_id, project_id, part_name, display_order)
  SELECT DISTINCT
    project_id || '_' || part_name as part_id,
    bridge_id as project_id,
    part_name,
    ROW_NUMBER() OVER (PARTITION BY bridge_id ORDER BY part_name) as display_order
  FROM positions;

-- Update positions to reference parts
UPDATE positions
SET part_id = project_id || '_' || part_name;
```

### 2.2 Object Type Templates

**Predefined Templates:**

```typescript
const OBJECT_TEMPLATES: Record<ObjectType, Template> = {
  bridge: {
    name: 'Most',
    icon: '🌉',
    parts: [
      { name: 'ZÁKLADY', order: 1, required: true },
      { name: 'OPĚRY', order: 2, required: true },
      { name: 'PILÍŘE', order: 3, required: false },
      { name: 'KLENBY', order: 4, required: false },
      { name: 'ŘÍMSY', order: 5, required: false }
    ],
    subtypes: ['beton', 'výztuž', 'bednění']
  },

  building: {
    name: 'Budova',
    icon: '🏢',
    parts: [
      { name: 'ZÁKLADY', order: 1, required: true },
      { name: 'SLOUPY', order: 2, required: true },
      { name: 'STĚNY', order: 3, required: true },
      { name: 'STROPY', order: 4, required: true },
      { name: 'SCHODIŠTĚ', order: 5, required: false }
    ],
    subtypes: ['beton', 'výztuž', 'bednění']
  },

  parking: {
    name: 'Podzemní garáž',
    icon: '🅿️',
    parts: [
      { name: 'ZÁKLADY', order: 1, required: true },
      { name: 'SLOUPY', order: 2, required: true },
      { name: 'STĚNY', order: 3, required: true },
      { name: 'STROPY', order: 4, required: true },
      { name: 'RAMPY', order: 5, required: false }
    ],
    subtypes: ['beton', 'výztuž', 'bednění']
  },

  tunnel: {
    name: 'Tunel',
    icon: '🚇',
    parts: [
      { name: 'ZÁKLADY', order: 1, required: true },
      { name: 'PORTÁLY', order: 2, required: true },
      { name: 'STĚNY', order: 3, required: true },
      { name: 'KLENBA', order: 4, required: true }
    ],
    subtypes: ['beton', 'výztuž', 'bednění', 'ostění']
  },

  other: {
    name: 'Vlastní',
    icon: '🏗️',
    parts: [],  // User defines own parts
    subtypes: ['beton', 'výztuž', 'bednění', 'jiné']
  }
};
```

### 2.3 UI for Object Type Selection

**Project Creation Wizard:**

```
┌─────────────────────────────────────────────┐
│ 🏗️ Vytvořit nový projekt                   │
├─────────────────────────────────────────────┤
│                                             │
│ Základní informace:                         │
│ ┌─────────────────────────────────────────┐│
│ │ ID projektu: [SO201____________]        ││
│ │ Název stavby: [D6 Žalmanov_____]        ││
│ │ Objekt: [Most na D6___________]         ││
│ └─────────────────────────────────────────┘│
│                                             │
│ Typ konstrukce:                             │
│ ┌────┬────┬────┬────┬────┐                │
│ │ 🌉 │ 🏢 │ 🅿️ │ 🚇 │ 🏗️│                │
│ │Most│Bud.│Gar.│Tun.│Vlas│                │
│ └────┴────┴────┴────┴────┘                │
│   [✓]                                       │
│                                             │
│ Části mostu (můžete upravit):              │
│ ┌─────────────────────────────────────────┐│
│ │ ☑️ ZÁKLADY                              ││
│ │ ☑️ OPĚRY                                ││
│ │ ☑️ PILÍŘE                               ││
│ │ ☑️ KLENBY                               ││
│ │ ☑️ ŘÍMSY                                ││
│ │ [+ Přidat vlastní část]                 ││
│ └─────────────────────────────────────────┘│
│                                             │
│ [◀ Zpět] [Vytvořit ▶]                     │
└─────────────────────────────────────────────┘
```

**Benefits:**
- Clear visual selection
- Predefined templates save time
- Flexibility with custom parts
- Users not confused by "Bridge" terminology

---

## 🤖 PHASE 3: Auto-Generate Tables from Import (2-3 weeks)

### 3.1 Smart Detection Algorithm (NO AI)

**Step 1: Filter Concrete Positions**

```typescript
function isConcretaPosition(position: RawPosition): boolean {
  const desc = normalize(position.description);

  // Check keywords
  const keywords = [
    'beton', 'železobeton', 'betonáž',
    'concrete', 'reinforced'
  ];

  if (keywords.some(kw => desc.includes(kw))) {
    return true;
  }

  // Check OTSKP code range
  const code = position.code?.trim();
  if (code && /^27[14]\d{3}/.test(code)) {
    return true; // 271xxx or 274xxx = concrete works
  }

  // Check unit and quantity
  if (position.unit === 'm³' && position.quantity > 1) {
    return true; // Likely concrete
  }

  return false;
}
```

**Step 2: Determine Subtype**

```typescript
function determineSubtype(position: RawPosition): Subtype {
  const desc = normalize(position.description);

  // Beton keywords
  if (/beton|concrete/.test(desc)) {
    return 'beton';
  }

  // Výztuž keywords
  if (/výztuž|ocel|steel|reinforcement|armatur/.test(desc) ||
      position.unit === 'kg' || position.unit === 't') {
    return 'výztuž';
  }

  // Bednění keywords
  if (/bednění|bedění|formwork|shoring/.test(desc) ||
      position.unit === 'm²') {
    return 'bednění';
  }

  return 'jiné';
}
```

**Step 3: Extract Part Name**

```typescript
const PART_KEYWORDS: Record<string, string[]> = {
  'ZÁKLADY': ['zaklad', 'patka', 'pata', 'foundation', 'footing', 'fundament'],
  'SLOUPY': ['sloup', 'pilir', 'column', 'pier', 'stlp'],
  'STĚNY': ['stena', 'zed', 'wall', 'mur'],
  'STROPY': ['strop', 'deska', 'slab', 'deck', 'floor', 'plateau'],
  'OPĚRY': ['opera', 'abutment', 'opor'],
  'KLENBY': ['klenba', 'oblouk', 'arch', 'vault', 'obluk'],
  'ŘÍMSY': ['rimsa', 'cornice', 'rims'],
  'SCHODIŠTĚ': ['schod', 'stair', 'step', 'schody'],
  'RAMPY': ['rampa', 'ramp'],
  'PORTÁLY': ['portal', 'vstup', 'entrance']
};

function extractPartName(description: string): string {
  const normalized = normalize(description);

  // Check each part's keywords
  for (const [partName, keywords] of Object.entries(PART_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return partName;
      }
    }
  }

  return 'OSTATNÍ'; // Unclassified
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim();
}
```

### 3.2 Import Preview UI

**Scenario 1: Upload Excel with Estimate**

```
┌────────────────────────────────────────────────────────┐
│ 📄 Nahrán soubor: smeta_SO201.xlsx                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 📊 Celkem nalezeno: 125 pozic                         │
│ ✅ Betonové práce: 42 pozic (156 m³)                  │
│ ⚠️  Ostatní práce: 83 pozic (nebudou importovány)     │
│                                                        │
│ ┌────────────────────────────────────────────────────┐│
│ │ Automatické rozdělení podle částí:                ││
│ │                                                    ││
│ │ ┌───────────────────────────────────────┐        ││
│ │ │ ✅ ZÁKLADY (12 pozic, 45 m³)           │        ││
│ │ │    • Betonáž základových patek [beton] │        ││
│ │ │    • Výztuž základů [výztuž]          │        ││
│ │ │    • Bednění základů [bednění]        │        ││
│ │ │    ... dalších 9 pozic                │        ││
│ │ │    [Zobrazit vše ▼]                   │        ││
│ │ └───────────────────────────────────────┘        ││
│ │                                                    ││
│ │ ┌───────────────────────────────────────┐        ││
│ │ │ ✅ SLOUPY (8 pozic, 30 m³)             │        ││
│ │ │    • Železobeton sloupů [beton]       │        ││
│ │ │    • Bednění sloupů [bednění]         │        ││
│ │ │    ... dalších 6 pozic                │        ││
│ │ │    [Zobrazit vše ▼]                   │        ││
│ │ └───────────────────────────────────────┘        ││
│ │                                                    ││
│ │ ┌───────────────────────────────────────┐        ││
│ │ │ ✅ STĚNY (15 pozic, 60 m³)             │        ││
│ │ │    ... [Zobrazit vše ▼]               │        ││
│ │ └───────────────────────────────────────┘        ││
│ │                                                    ││
│ │ ┌───────────────────────────────────────┐        ││
│ │ │ ⚠️  OSTATNÍ (7 pozic)                  │        ││
│ │ │    Vyžaduje ruční přiřazení            │        ││
│ │ │    • Úprava terénu [?]                │        ││
│ │ │    • Izolace [?]                      │        ││
│ │ │    [Přiřadit části ▶]                 │        ││
│ │ └───────────────────────────────────────┘        ││
│ │                                                    ││
│ └────────────────────────────────────────────────────┘│
│                                                        │
│ Možnosti:                                              │
│ • [Přesunout pozice mezi částmi] (drag & drop)        │
│ • [Upravit názvy částí]                                │
│ • [Změnit subtype pozice]                              │
│ • [Přidat novou část]                                  │
│                                                        │
│ [◀ Zrušit] [Upravit] [✓ Potvrdit a importovat]       │
└────────────────────────────────────────────────────────┘
```

**Interactive Features:**
- Expand/collapse each part
- Drag & drop positions between parts
- Edit part names inline
- Change position subtype (dropdown)
- Add new custom part
- Remove positions from import

**Scenario 2: Empty Project (No Estimate)**

```
┌─────────────────────────────────────────────┐
│ 🏗️ Nový prázdný projekt                    │
├─────────────────────────────────────────────┤
│                                             │
│ Typ: 🌉 Most                                │
│                                             │
│ Přednastavené části mostu:                  │
│ ┌─────────────────────────────────────────┐│
│ │ ☑️ ZÁKLADY                              ││
│ │ ☑️ OPĚRY                                ││
│ │ ☑️ PILÍŘE                               ││
│ │ ☑️ KLENBY                               ││
│ │ ☑️ ŘÍMSY                                ││
│ └─────────────────────────────────────────┘│
│                                             │
│ [+ Přidat vlastní část]                     │
│ [- Odebrat označené]                        │
│                                             │
│ [◀ Zpět] [Vytvořit prázdný projekt ▶]     │
└─────────────────────────────────────────────┘
```

### 3.3 Import Flow

**Complete Process:**

```
1. User uploads XLSX file
   ↓
2. Server receives file
   ↓
3. Parser extracts raw positions
   ↓
4. Smart Detection Algorithm:
   ├─ Filter concrete positions
   ├─ Determine subtype (beton/výztuž/bednění)
   ├─ Extract part_name from description
   └─ Group by part_name
   ↓
5. Generate preview data
   ↓
6. Frontend displays preview UI
   ↓
7. User reviews and adjusts:
   ├─ Move positions between parts
   ├─ Edit part names
   ├─ Change subtypes
   └─ Add/remove parts
   ↓
8. User confirms
   ↓
9. Backend creates:
   ├─ monolith_projects record
   ├─ project_parts records
   └─ positions records
   ↓
10. Redirect to project view
```

**API Endpoints:**

```typescript
POST /api/import/preview
  Request: { file: File }
  Response: {
    total_positions: 125,
    concrete_positions: 42,
    parts: [
      {
        part_name: 'ZÁKLADY',
        positions: [...],
        total_m3: 45,
        count: 12
      },
      // ...
    ],
    unclassified: [...]
  }

POST /api/import/confirm
  Request: {
    project_id: 'SO201',
    project_name: 'D6 Žalmanov',
    object_name: 'Most na D6',
    object_type: 'bridge',
    parts: [
      { part_name: 'ZÁKLADY', positions: [...] },
      // ...
    ]
  }
  Response: { project_id: 'SO201', success: true }
```

---

## 📊 PHASE 4: Additional Modules B0-B8 (3-4 months)

### Module Architecture

**Single Application, Multiple Views**

```
MonolithProject (main entity)
  ├─ Positions (main concrete table) ✅ DONE
  ├─ PumpSchedule (B0) - concrete delivery & pumping
  ├─ FormworkDetails (B1) - formwork breakdown
  ├─ ReinforcementDetails (B2) - reinforcement details
  ├─ SteelWorks (B3) - small steel items
  ├─ ConcreteComparison (B4) - concrete types comparison
  ├─ SupplierRFQs (B5) - supplier requests
  ├─ ProjectSummary (B6) - project overview
  ├─ PriceComparison (B7) - price analysis
  └─ TextBuilder (B8) - text generation (AI)
```

**NOT Separate Apps, BUT:**
- Tabs/pages within project
- Shared data (positions, parts, KPI)
- Cross-references between modules
- Unified project context

### Module Priority Tiers

**Tier 1 - Foundation (implement first):**
- ✅ **Positions** (main table) - DONE
- ✅ **Sheathing Calculator** (NEW - Nov 20, 2025) - formwork scheduling
- **B6: Project Summary** - project dashboard
- **B4: Concrete Compare** - concrete types comparison

**Tier 2 - Planning (after Tier 1):**
- **B0: Pump & Doprava** - concrete logistics
- **B1: Formwork Details** - formwork breakdown
- **B2: Reinforcement Details** - reinforcement breakdown

**Tier 3 - Commerce (optional):**
- **B5: Supplier RFQ Board** - supplier management
- **B7: Price Compare** - price comparison
- **B3: Steel Small Works** - steel items catalog

**Tier 4 - Automation (with AI):**
- **B8: Text Builder** - text generation (requires AI)

---

## 🏗️ SHEATHING CALCULATOR MODULE (NEW - Nov 20, 2025)

**Status:** ✅ **Days 1-5 Complete** - Ready for testing and parser integration

**Purpose:** Calculate formwork/sheathing construction schedules using the **checkerboard method** (шахматный метод) to optimize project duration and costs.

### Key Features:

1. **Checkerboard Scheduling** - Multiple kits work simultaneously with time offset
   - Sequential duration: (assembly + curing + disassembly) × num_kits
   - Staggered duration: (num_kits - 1) × shift_days + single_cycle_days
   - Time savings: 30-60% reduction possible

2. **Real-time Calculations** - Pure formula functions for:
   - Assembly days based on area, norm, crew size
   - Curing days based on concrete class and temperature
   - Disassembly days (typically 50% of assembly)
   - Optimal shift days between captures
   - Labor hours and rental costs

3. **Frontend Components:**
   - `SheathingCapturesTable.tsx` - Main table with project statistics
   - `SheathingCaptureRow.tsx` - Inline editing for each capture
   - Real-time recalculation on input changes

4. **Backend API:**
   - CRUD operations for captures
   - Project configuration management
   - Ownership validation and authorization

5. **Database:**
   - `sheathing_captures` table - Dimension, work, rental data
   - `sheathing_project_configs` table - Project-level defaults
   - Proper indexes for performance

### Data Structure:

```typescript
interface SheathingCapture {
  capture_id: string;              // CAP-SO201-01
  project_id: string;              // Bridge ID
  part_name: string;               // ZÁKLADY, PILÍŘE...

  // Dimensions
  length_m: number;                // Length (m)
  width_m: number;                 // Width (m)
  height_m?: number;               // Height (m)
  area_m2: number;                 // Sheathing area (L × W)

  // Work parameters
  assembly_norm_ph_m2: number;     // Assembly norm (man-hours/m²)
  concrete_curing_days: number;    // Curing time (3-7 days)
  num_kits: number;                // Number of kits (2-4)
  work_method: 'sequential' | 'staggered';

  // Optional
  concrete_class?: string;         // C25/30, C30/37...
  daily_rental_cost_czk?: number;
  kit_type?: string;               // DOKA, PERI...
}
```

### API Endpoints:

```
GET    /api/sheathing/:project_id              Get all captures
POST   /api/sheathing                          Create capture
PUT    /api/sheathing/:capture_id              Update capture
DELETE /api/sheathing/:capture_id              Delete capture
GET    /api/sheathing/:project_id/config       Get project config
POST   /api/sheathing/:project_id/config       Update project config
```

### Implementation Progress:

- [x] Day 1: Type definitions (SheathingCapture, SheathingProjectConfig)
- [x] Day 2: Calculation formulas (pure functions, no AI)
- [x] Day 3: Frontend components (table, row, inline editing)
- [x] Day 4: Backend API routes (CRUD + config)
- [x] Day 5: Database schema (tables, indexes, migrations)
- [ ] Day 6: Testing & edge cases
- [ ] Day 7: Parser integration (extract dims from Excel), exports

### Commits:

- `ee3a91e` - Add sheathing capture types and formulas
- `dd7a3a3` - Add SheathingCapturesTable component
- `bd544e5` - Add SheathingCaptureRow component
- `e9e1d00` - Add sheathing API routes
- `12ebcbc` - Add database tables and indexes

### Documentation:

See `SHEATHING_CALCULATOR.md` for detailed specifications, formulas, testing scenarios, and integration planning with concrete-agent parsers.

---

## 📦 MODULE SPECIFICATIONS

### B0: Pump & Doprava Betonu

**Purpose:** Calculate quantities, deliveries, costs, and work speed for concrete pumping and delivery

**Features:**
1. **Quantity Planning**
   - Extract concrete volumes from Positions (subtype='beton')
   - Group by part and pour date
   - Calculate delivery schedule

2. **Delivery Logistics**
   - Supplier selection
   - Truck mixer capacity (6m³, 8m³, 10m³)
   - Number of deliveries needed
   - Time intervals between deliveries

3. **Pump Selection**
   - Stationary pump vs truck-mounted pump
   - Pump reach calculation
   - Pumping rate (m³/h)
   - Setup and teardown time

4. **Cost Calculation**
   ```
   Total Cost =
     (Concrete Cost) +
     (Delivery Cost per m³ × Volume) +
     (Pump Rental per day × Days) +
     (Labor Cost per hour × Hours)
   ```

5. **Work Speed Analysis**
   ```
   Pour Rate = Volume / Pour Time
   Crew Efficiency = Actual Rate / Standard Rate
   Recommended Crew Size = Volume / (8h × efficiency)
   ```

**Data Model:**
```typescript
interface PumpSchedule {
  id: string;
  project_id: string;
  part_id: string;
  pour_date: Date;
  concrete_type: string;  // C30/37, C25/30, etc.
  volume_m3: number;

  // Supplier
  supplier_name: string;
  supplier_price_per_m3: number;

  // Delivery
  truck_capacity_m3: number;
  number_of_trucks: number;
  delivery_interval_min: number;

  // Pump
  pump_type: 'stationary' | 'truck_mounted';
  pump_reach_m: number;
  pump_rate_m3_per_h: number;
  pump_rental_per_day: number;

  // Labor
  crew_size: number;
  shift_hours: number;
  estimated_duration_h: number;

  // Costs
  concrete_cost: number;
  delivery_cost: number;
  pump_cost: number;
  labor_cost: number;
  total_cost: number;

  // Status
  status: 'planned' | 'ordered' | 'delivered' | 'poured' | 'cancelled';
  notes?: string;
}
```

**UI Table:**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🚚 Pump & Doprava Betonu - SO 201                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ Harmonogram betonáže:                                                   │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ Datum  │ Část    │ m³  │ Dodavatel   │ Nasос   │ Četa│ Status      ││
│ ├──────────────────────────────────────────────────────────────────────┤│
│ │ 15.05  │ ZÁKLADY │ 45  │ ČMB         │ ABČ 42m │ 6   │ ✅ Hotovo   ││
│ │ 18.05  │ SLOUPY  │ 30  │ ČMB         │ ABČ 42m │ 4   │ 📅 Plánuje ││
│ │ 22.05  │ STROPY  │ 60  │ Strabag     │ Putzm.  │ 8   │ ⏳ Čeká    ││
│ │ 25.05  │ ŘÍMSY   │ 12  │ ČMB         │ ABČ 42m │ 3   │ ⏳ Čeká    ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ Detail betonáže: 18.05 - SLOUPY                                         │
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ Beton: C30/37 XC4 XD2, 30 m³                                         ││
│ │ Dodavatel: Českomoravský beton (2450 Kč/m³)                          ││
│ │                                                                      ││
│ │ Doprava:                                                             ││
│ │ • Autodomíchávač: 8 m³                                               ││
│ │ • Počet aut: 4                                                       ││
│ │ • Interval: 30 min                                                   ││
│ │ • Doprava: 150 Kč/m³                                                 ││
│ │                                                                      ││
│ │ Čerpání:                                                             ││
│ │ • Nasос: Autobetonové čerpadlo ABČ 42m                               ││
│ │ • Výkon: 120 m³/h                                                    ││
│ │ • Pronájem: 8500 Kč/den                                              ││
│ │ • Doba čerpání: ≈ 2.5h (včetně přestávek)                            ││
│ │                                                                      ││
│ │ Parta:                                                               ││
│ │ • Velikost: 4 lidé                                                   ││
│ │ • Mzda: 180 Kč/h/osobu                                               ││
│ │ • Směna: 8h                                                          ││
│ │ • Práce: 5760 Kč                                                     ││
│ │                                                                      ││
│ │ NÁKLADY CELKEM:                                                      ││
│ │ • Beton: 73 500 Kč (30×2450)                                         ││
│ │ • Doprava: 4 500 Kč (30×150)                                         ││
│ │ • Nasос: 8 500 Kč                                                    ││
│ │ • Práce: 5 760 Kč                                                    ││
│ │ ═══════════════════════════════                                      ││
│ │ CELKEM: 92 260 Kč                                                    ││
│ │ (3075 Kč/m³)                                                         ││
│ └──────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│ [+ Nová betonáž] [Upravit] [Tisknout] [Export]                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Calculations:**
```typescript
// Number of truck deliveries
const numberOfTrucks = Math.ceil(volume_m3 / truck_capacity_m3);

// Delivery time span
const totalDeliveryTime = numberOfTrucks × delivery_interval_min;

// Pumping time (with breaks)
const pumpingTime = (volume_m3 / pump_rate_m3_h) × 1.2; // +20% for breaks

// Total duration
const totalDuration = Math.max(totalDeliveryTime / 60, pumpingTime);

// Labor cost
const laborCost = crew_size × wage_per_hour × totalDuration;

// Total cost per m³
const costPerM3 = (concrete_cost + delivery_cost + pump_cost + labor_cost) / volume_m3;
```

**Benefits:**
- Accurate cost forecasting
- Optimized logistics planning
- Crew size recommendations
- Equipment rental planning
- Supplier comparison

---

### B1: Formwork Details

**Purpose:** Detailed breakdown of formwork by type and area

**Data Model:**
```typescript
interface FormworkDetail {
  id: string;
  project_id: string;
  part_id: string;
  formwork_type: 'oboustranné' | 'jednostranné' | 'stropní' | 'zakřivené';
  area_m2: number;
  reuses: number;  // Number of reuses
  loss_factor: number;  // 5-10%
  unit_cost_per_m2: number;
  total_cost: number;
}
```

**Calculation:**
```typescript
// Effective area (accounting for losses)
const effectiveArea = area_m2 × (1 + loss_factor);

// Cost per use
const costPerUse = unit_cost_per_m2 / reuses;

// Total cost
const totalCost = effectiveArea × costPerUse;
```

---

### B2: Výztuž Details

**Purpose:** Reinforcement steel breakdown by diameter and length

**Data Model:**
```typescript
interface ReinforcementDetail {
  id: string;
  project_id: string;
  part_id: string;
  diameter: string;  // ø8, ø12, ø16, ø20, ø25, ø32
  length_m: number;
  weight_kg_per_m: number;
  overlap_factor: number;  // 1.05 = 5% overlap
  loss_factor: number;  // 1.03 = 3% waste
  total_weight_kg: number;
  unit_price_per_kg: number;
  total_cost: number;
}
```

**Standard Weights:**
```typescript
const REBAR_WEIGHTS: Record<string, number> = {
  'ø6': 0.222,
  'ø8': 0.395,
  'ø10': 0.617,
  'ø12': 0.888,
  'ø14': 1.208,
  'ø16': 1.578,
  'ø20': 2.466,
  'ø25': 3.853,
  'ø32': 6.313
};
```

---

### B3: Steel Small Works

**Purpose:** Catalog of small steel items (railings, anchors, etc.) with price links

**Data Model:**
```typescript
interface SteelItem {
  id: string;
  project_id: string;
  item_type: 'zábradlí' | 'ukotva' | 'okapnice' | 'lišta' | 'jiné';
  description: string;
  quantity: number;
  unit: 'ks' | 'bm' | 'kg';
  weight_kg?: number;
  supplier: string;
  supplier_link?: string;
  unit_price: number;
  total_price: number;
}
```

---

### B4: Concrete Compare ⭐

**Purpose:** Compare different concrete types with auto-generated full names

**Data Model:**
```typescript
interface ConcreteType {
  id: string;
  project_id: string;
  type: string;  // C30/37, C25/30, etc.
  exposure_class: string[];  // XC4, XD2, XF3
  chloride_class: string;  // Cl 0.4, Cl 0.2
  dmax: number;  // 22, 16, 32
  consistency: string;  // S3, S4, F4
  volume_m3: number;
  supplier: string;
  price_per_m3: number;
  total_price: number;
  full_name: string;  // Auto-generated
}
```

**Auto-Generate Full Name:**
```typescript
function generateConcreteName(concrete: ConcreteType): string {
  const parts = [
    `Beton ${concrete.type}`,
    ...concrete.exposure_class.sort(),
    `Cl ${concrete.chloride_class}`,
    `Dmax ${concrete.dmax}`,
    concrete.consistency
  ];

  return parts.join(' ');
}

// Example:
// "Beton C30/37 XC4 XD2 Cl 0.4 Dmax 22 S3"
```

**UI Table:**
```
┌────────────────────────────────────────────────────────────────┐
│ 🧱 Porovnání betonů - SO 201                                  │
├────────────────────────────────────────────────────────────────┤
│ Typ      │ Objem │ Dodavatel  │ Cena/m³ │ Celkem    │ Použití│
├────────────────────────────────────────────────────────────────┤
│ C30/37   │ 120m³ │ ČMB        │ 2450 Kč │ 294 000 Kč│ 76%    │
│ XC4 XD2  │       │            │         │           │        │
│ Cl0.4    │       │            │         │           │        │
│ Dmax22 S3│       │            │         │           │        │
├────────────────────────────────────────────────────────────────┤
│ C25/30   │ 30m³  │ Strabag    │ 2100 Kč │ 63 000 Kč │ 19%    │
│ XC2      │       │            │         │           │        │
│ Cl0.4    │       │            │         │           │        │
│ Dmax22 S3│       │            │         │           │        │
├────────────────────────────────────────────────────────────────┤
│ C20/25   │ 8m³   │ Cemex      │ 1900 Kč │ 15 200 Kč │ 5%     │
│ XC1      │       │            │         │           │        │
│ Dmax16 S4│       │            │         │           │        │
└────────────────────────────────────────────────────────────────┘

📊 Celkem betonu: 158 m³
💰 Celkové náklady: 372 200 Kč
📈 Průměrná cena: 2355 Kč/m³
```

---

### B5: Supplier RFQ Board

**Purpose:** Manage supplier requests with Kanban board

**UI - Kanban:**
```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ 📝 Nová  │ 📤 Odesla│ 📥 Nabíd.│ 🔍 Vyhod.│ ✅ Vybra.│
│   RFQ    │   no     │          │   noceno │   no     │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│          │          │          │          │          │
│ [Beton]  │ [Výztuž] │ [Bednění]│ [Nasос]  │ [ČMB]    │
│ C30/37   │ ø12      │ 500m²    │ ABČ 42m  │ Výztuž   │
│ 120m³    │ 20t      │          │          │ 20t      │
│          │          │          │          │ ✓ Objedn.│
│          │          │ [Putzm.] │          │          │
│          │          │ Nasос    │          │          │
│          │          │ 15k/den  │          │          │
│          │          │          │          │          │
│ [+Nová]  │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

### B6: Project Summary ⭐⭐

**Purpose:** Complete project overview dashboard

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🏗️ SO 201 - Most na D6 přes biokoridor                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────┬─────────────────┬─────────────────┐    │
│ │ 📏 Rozměry      │ 🧱 Materiály    │ 💰 Náklady      │    │
│ ├─────────────────┼─────────────────┼─────────────────┤    │
│ │ Typ: Most       │ Beton: 158 m³   │ KROS: 5.2M Kč   │    │
│ │ Délka: 45m      │ Výztuž: 28 t    │ Beton: 372K     │    │
│ │ Šířka: 12m      │ Bednění: 890m²  │ Doprava: 45K    │    │
│ │ Výška: 8m       │ Ocel: 2.5 t     │ Nasос: 34K      │    │
│ └─────────────────┴─────────────────┴─────────────────┘    │
│                                                             │
│ ⏱️ Časový plán:                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ Start: 15.05.2025   │   Konec: 28.06.2025   │ 6 týd.  │  │
│ │ ███████████████░░░░░░ 75% dokončeno                   │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ 📊 Stav částí:                                              │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ ✅ ZÁKLADY    │ ████████████████████ 100% │ 45m³      │  │
│ │ ✅ OPĚRY      │ ████████████████████ 100% │ 38m³      │  │
│ │ 🔄 PILÍŘE     │ ██████████░░░░░░░░░░  50% │ 30m³      │  │
│ │ ⏳ KLENBY     │ ░░░░░░░░░░░░░░░░░░░░   0% │ 35m³      │  │
│ │ ⏳ ŘÍMSY      │ ░░░░░░░░░░░░░░░░░░░░   0% │ 10m³      │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ 🎯 KPI:                                                     │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ • Cena projektu: 3291 Kč/m³ betonu                    │  │
│ │ • Výztuž/beton: 177 kg/m³                              │  │
│ │ • Bednění/beton: 5.6 m²/m³                             │  │
│ │ • Měsíce práce: 1.8 měsíce                             │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ 📋 Poslední změny:                                          │
│ • 12.11 15:30 - Přidána pozice výztuže PILÍŘE              │
│ • 12.11 14:15 - Upravena cena betonu C30/37                │
│ • 11.11 16:45 - Dokončena betonáž OPĚRY                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### B7: Price Comparison

**Purpose:** Compare supplier quotes side-by-side

**UI Table:**
```
┌──────────────────────────────────────────────────────────┐
│ 💰 Porovnání nabídek - SO 201                           │
├──────────────────────────────────────────────────────────┤
│ Položka      │ ČMB        │ Strabag    │ Cemex     │ Δ  │
├──────────────────────────────────────────────────────────┤
│ Beton C30/37 │ 2450 Kč/m³ │ 2380 Kč/m³ │ 2550 Kč/m³│-3% │
│ Beton C25/30 │ 2100 Kč/m³ │ 2050 Kč/m³ │ 2200 Kč/m³│-2% │
│ Výztuž ø12   │ 24 Kč/kg   │ 25 Kč/kg   │ 23 Kč/kg  │+4% │
│ Bednění      │ 180 Kč/m²  │ 175 Kč/m²  │ 190 Kč/m² │-3% │
│ Nasос/den    │ 8500 Kč    │ 9200 Kč    │ 8000 Kč   │+6% │
├──────────────────────────────────────────────────────────┤
│ CELKEM (odhad)│ 2.05M Kč  │ 2.02M Kč   │ 2.15M Kč  │-1%│
└──────────────────────────────────────────────────────────┘

🏆 Nejlepší nabídka: Strabag (-1.5% oproti průměru)
⚠️  Varování: Cemex má nejdražší beton (+4%)
```

---

### B8: Text Builder (AI)

**Purpose:** Generate technical descriptions for KROS/ÚRS items

**Features:**
1. Generate procedure descriptions (předpis postupu)
2. Create full item names for KROS
3. Technical specifications according to ČSN

**Example:**

**Input:**
```
Část: SLOUPY
Typ: Železobeton
Rozměr: 400×400mm
Výška: 6m
Beton: C30/37
```

**Output (AI Generated):**
```
"Sloupy železobetonové obdélníkového průřezu 400×400mm
z betonu C30/37 XC4 XD2 Cl 0.4, výška 6,0m, včetně
bednění oboustranného systémového, výztuže betonářské
dle projektové dokumentace, povrch hlazený."
```

**Requires:** Python AI service (Claude API)

---

## 🔄 MODULE INTEGRATION

### Shared Data Flow

```
MonolithProject (root)
  ↓
Parts (ZÁKLADY, OPĚRY, etc.)
  ↓
Positions (main table) ← Source of truth
  ↓ ↓ ↓ (filters & aggregations)
  ↓
  ├─ B0: PumpSchedule ← filters subtype='beton'
  ├─ B1: FormworkDetails ← filters subtype='bednění'
  ├─ B2: ReinforcementDetails ← filters subtype='výztuž'
  ├─ B3: SteelWorks ← separate catalog
  ├─ B4: ConcreteComparison ← groups by concrete type
  ├─ B5: SupplierRFQs ← manages orders
  ├─ B6: ProjectSummary ← aggregates all KPIs
  ├─ B7: PriceComparison ← compares quotes
  └─ B8: TextBuilder ← generates texts (AI)
```

### Navigation UI

**Sidebar Menu:**
```
┌────────────────────────────────┐
│ 🏗️ SO 201 - Most na D6        │
├────────────────────────────────┤
│ 📊 Dashboard (B6)             │ ← Default view
│ 📋 Pozice (hlavní tabulka)    │
│                                │
│ MATERIÁLY:                     │
│ • 🚚 Doprava a čerpání (B0)   │
│ • 🧱 Porovnání betonů (B4)    │
│ • 🏗️ Bednění detail (B1)     │
│ • ⚙️ Výztuž detail (B2)       │
│ • 🔩 Drobné ocel (B3)         │
│                                │
│ OBCHOD:                        │
│ • 📝 Poptávky (B5)            │
│ • 💰 Porovnání cen (B7)       │
│                                │
│ NÁSTROJE:                      │
│ • ✍️ Generátor textů (B8)     │
│ • 📤 Export                   │
│ • ⚙️ Nastavení                │
└────────────────────────────────┘
```

**Benefits:**
- Single unified interface
- Shared context and data
- Easy navigation between views
- Consistent UX across modules

---

## 🚀 IMPLEMENTATION TIMELINE

### Sprint 1-2 (2 weeks): Foundation
- ✅ Current state (bridge management done)
- Rename Bridge → MonolithProject
- Add object_type field
- Create object templates
- Migration script

### Sprint 3-4 (2 weeks): Parsers
- Deploy concrete-agent on Render
- Create API adapter in Node.js
- Port Position Normalizer
- Test KROS XML parser

### Sprint 5-6 (2 weeks): Auto-Tables
- Algorithm for concrete position detection
- Part name extraction
- Preview UI before import
- Test with real files

### Sprint 7-8 (2 weeks): B6 Project Summary
- Dashboard layout
- KPI aggregation
- Status tracking
- Mini visualization

### Sprint 9-10 (2 weeks): B4 Concrete Compare
- Comparison table
- Auto-name generation
- Cost calculation

### Sprint 11-12 (2 weeks): B0 Pump & Doprava
- Schedule planning
- Logistics calculation
- Cost breakdown
- Speed analysis

### Sprint 13+ (as needed): Remaining Modules
- B1: Formwork Details
- B2: Reinforcement Details
- B3-B8: phased implementation

---

## 💡 KEY DECISIONS

### 1. Microservices vs Monolith?
**→ Hybrid**: Node.js main orchestrator, Python for AI/parsing

### 2. Separate apps for B0-B8?
**→ NO!** Single application, different modules/tabs

### 3. AI everywhere or selective?
**→ Selective**: simple tasks locally, complex via AI

### 4. PostgreSQL or SQLite?
**→ Migrate to PostgreSQL** (Render offers 500MB free)

### 5. Which modules first?
**→ B6 (Dashboard) + B4 (Concrete Compare)** - immediately useful

### 6. How to handle complex Excel files?
**→ Fallback chain**: Local parser → Smart parser → AI parser

### 7. Cost optimization?
**→ Cache results, use AI selectively, implement rate limiting**

---

## 📊 SUCCESS METRICS

### Technical Metrics
- [ ] Parser success rate > 95%
- [ ] API response time < 500ms
- [ ] Import preview generation < 3s
- [ ] Zero data loss during migration
- [ ] Test coverage > 80%

### User Metrics
- [ ] Import time reduced by 50%
- [ ] Manual corrections reduced by 70%
- [ ] User satisfaction > 4.5/5
- [ ] Time to create project < 5 min

### Business Metrics
- [ ] Support more object types (not just bridges)
- [ ] Reduce onboarding time for new users
- [ ] Enable self-service for common tasks
- [ ] Scale to handle 100+ concurrent projects

---

## 🎯 NEXT IMMEDIATE STEPS

1. **Finalize current PR** (bridge status system)
2. **Start Sprint 1-2** (MonolithProject refactoring)
3. **Deploy concrete-agent** as microservice
4. **Implement auto-table generation** (killer feature!)
5. **Create B6 dashboard** (immediate value)

---

## 📚 REFERENCES

### Documentation
- [concrete-agent](https://github.com/alpro1000/concrete-agent)
- [concrete-agent deployed](https://concrete-agent.onrender.com)
- [CLAUDE.MD](./CLAUDE.MD) - AI context document
- [README.md](./README.md) - Project overview

### Key Files
- `shared/src/types.ts` - Type definitions
- `backend/src/routes/bridges.js` - API routes
- `frontend/src/components/Sidebar.tsx` - Main navigation
- `frontend/src/hooks/useBridges.ts` - Data management

---

**Last Updated:** November 12, 2025
**Status:** 🟢 Ready for implementation
**Next Review:** After Sprint 2

