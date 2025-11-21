# 🏗️ ESTIMATE AUTOMATION PLATFORM - Systems Integration Map

> **Генеральный документ интеграции двух систем: Monolit-Planner (Frontend) + Concrete-Agent (CORE Engine)**
>
> **Версия:** 1.0
> **Дата:** 2025-11-14
> **Статус:** 🚀 IN DEVELOPMENT

---

## 📍 Где находятся системы

### Frontend / Управление проектами
- **Репозиторий:** `/home/user/Monolit-Planner` (локально)
- **GitHub:** https://github.com/alpro1000/Monolit-Planner
- **Deployment:** https://monolit-planner-frontend.onrender.com (React SPA)
- **Backend:** https://monolit-planner-api.onrender.com (Express 3001)
- **Стек:** React 18 + TypeScript, Express.js, PostgreSQL/SQLite, Vite

### CORE Engine / AI Анализ
- **Репозиторий:** `git clone https://github.com/alpro1000/concrete-agent.git`
- **Deployment:** https://concrete-agent.onrender.com (FastAPI 8000)
- **Стек:** Python 3.10+, FastAPI, Knowledge Base (B1-B9), Claude AI
- **Основное:** Парсинг документов, анализ проектов, генерация смет

---

## 🔄 Архитектура системы

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   ESTIMATE AUTOMATION PLATFORM                          │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │           TIER 1: FRONTEND (React + Express)                     │   │
│  │           https://monolit-planner-frontend.onrender.com          │   │
│  │           Backend: https://monolit-planner-api.onrender.com      │   │
│  │                                                                   │   │
│  │  ✅ DONE:                                                        │   │
│  │  ├─ Auth (email verification, 2FA)                             │   │
│  │  ├─ Project Management (create, view, edit, delete)            │   │
│  │  ├─ User Management (profiles, dashboard)                      │   │
│  │  ├─ Admin Panel (user control, audit logs)                     │   │
│  │  ├─ OTSKP Code Search (17,904 codes)                          │   │
│  │  └─ Snapshots/Versioning                                       │   │
│  │                                                                   │   │
│  │  🔲 TO DO:                                                      │   │
│  │  ├─ Document Upload UI                                         │   │
│  │  ├─ Project Analysis Display                                   │   │
│  │  ├─ Work List Builder                                          │   │
│  │  ├─ Calculator Integration (Kioski)                            │   │
│  │  └─ Estimate Preview & Export                                  │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                  ↕ REST API                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │         TIER 2: BACKEND API (Express 3001)                     │   │
│  │         Already implemented routes:                             │   │
│  │                                                                   │   │
│  │  GET/POST  /api/auth/* .............. Authentication           │   │
│  │  GET/POST  /api/monolith-projects/* . Project management       │   │
│  │  GET/POST  /api/positions/* ......... Positions/works          │   │
│  │  GET       /api/otskp/* ............ OTSKP code search        │   │
│  │  GET/POST  /api/admin/* ............ Admin panel               │   │
│  │                                                                   │   │
│  │  🔲 NEW routes (to implement):                                 │   │
│  │  POST      /api/documents/upload ... Document ingestion        │   │
│  │  GET       /api/core/analyze/:id ... Call CORE Engine          │   │
│  │  GET       /api/estimates/... ...... Estimate management       │   │
│  │  POST      /api/calculators/* ...... Kiosk calculator calls    │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                  ↕ HTTP                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │      TIER 3: CORE ENGINE (Python FastAPI 8000)                 │   │
│  │      https://concrete-agent.onrender.com                        │   │
│  │                                                                   │   │
│  │  ✅ WORKFLOWS ALREADY IMPLEMENTED:                             │   │
│  │                                                                   │   │
│  │  Workflow A: Import & Audit                                   │   │
│  │  ├─ POST /workflow-a/start ......... Upload KROS/Excel       │   │
│  │  ├─ POST /workflow-a/audit ........ Multi-role validation    │   │
│  │  ├─ POST /workflow-a/enrich ....... AI enrichment            │   │
│  │  └─ GET  /workflow-a/positions .... Get parsed positions     │   │
│  │                                                                   │   │
│  │  Workflow B: Generate from Drawings                           │   │
│  │  ├─ POST /workflow-b/start ........ Upload PDFs/images       │   │
│  │  ├─ POST /workflow-b/analyze ...... OCR + AI analysis        │   │
│  │  └─ GET  /workflow-b/results ...... Generated positions      │   │
│  │                                                                   │   │
│  │  Chat/Conversational:                                          │   │
│  │  ├─ POST /chat/message ............ Chat with system         │   │
│  │  └─ POST /chat/analyze-drawing .... Ask about document       │   │
│  │                                                                   │   │
│  │  Knowledge Base:                                               │   │
│  │  ├─ GET  /kb/search .............. Search (B1-B9)           │   │
│  │  └─ POST /kb/enrich .............. Live KB enrichment        │   │
│  │                                                                   │   │
│  │  Resource Calculation:                                         │   │
│  │  ├─ POST /resources/tech-card ...... Technical card gen      │   │
│  │  ├─ POST /resources/materials ...... Material list gen        │   │
│  │  └─ POST /resources/labor ......... Labor hours calc         │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                  ↕ HTTP                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │     TIER 4: SPECIALIZED CALCULATORS (Kioski)                  │   │
│  │     Optional microservices (could run on 9001-9006)           │   │
│  │                                                                   │   │
│  │  POST /calculate/bridge ........... Bridge kiोsk (9001)        │   │
│  │  POST /calculate/building ......... Building kiosk (9002)     │   │
│  │  POST /calculate/parking .......... Parking kiosk (9003)      │   │
│  │  POST /calculate/road ............ Road kiosk (9004)          │   │
│  │  POST /calculate/delivery ........ Delivery kiosk (9005)      │   │
│  │  POST /calculate/labor ........... Labor kiosk (9006)         │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │         TIER 5: DATA LAYER (PostgreSQL)                        │   │
│  │         Single source of truth                                 │   │
│  │                                                                   │   │
│  │  DB Tables (Monolit-Planner):                                 │   │
│  │  ├─ users, monolith_projects, positions, parts              │   │
│  │  ├─ otskp_codes (17,904 codes), snapshots                   │   │
│  │  ├─ estimates, estimate_lines (NEW)                         │   │
│  │  ├─ work_catalog, work_templates (NEW)                      │   │
│  │  └─ chat_sessions, chat_messages (NEW)                      │   │
│  │                                                                   │   │
│  │  Knowledge Base (Concrete-Agent):                             │   │
│  │  ├─ B1_Normy_Standardy (Standards)                          │   │
│  │  ├─ B2_Tech_Cards (Technical cards)                         │   │
│  │  ├─ B3_Pricing (Price lists)                                │   │
│  │  ├─ B4_Historical (Historical projects)                     │   │
│  │  ├─ B5_URS_KROS4 (Catalog codes)                            │   │
│  │  ├─ B6_RTS (Regional standards)                             │   │
│  │  ├─ B7_Company_Rules (Custom rules)                         │   │
│  │  └─ B8_Templates (Work templates)                           │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 Integration Points

### 1. Document Upload & Analysis

**Flow:**
```
User uploads PDF/Excel in Monolit-Planner
    ↓
POST /api/documents/upload (Express backend)
    ↓
Express forwards to Concrete-Agent:
POST https://concrete-agent.onrender.com/workflow-a/start
    ↓
CORE Engine parses document (OCR, tables, text extraction)
    ↓
Response: {
  "positions": [...],
  "materials": {...},
  "concrete_volume": 350,
  "analysis": {...}
}
    ↓
Express saves to DB, returns to frontend
    ↓
Frontend displays preview for user confirmation
```

**Endpoints to implement in Express:**
```javascript
// backend/src/routes/documents.js
POST /api/documents/upload
  - Validate file (PDF, Excel, JPG, PNG)
  - Store temporarily
  - Call CORE Engine
  - Save analysis results
  - Return analysis to frontend

GET /api/documents/:id/analysis
  - Get stored analysis results

POST /api/documents/:id/confirm
  - User confirms analysis
  - Save as project positions
```

---

### 2. Project Analysis

**CORE Engine does:**
- 🔍 Document scanning (OCR for drawings)
- 🏗️ Project type detection (bridge/building/parking/road)
- 📐 Dimension extraction (lengths, widths, heights, areas)
- 🔨 Work list generation (what works needed)
- ♻️ Knowledge Base matching (similar projects)
- 📊 Resource calculation (materials, labor hours)

**Frontend displays:**
- Project summary (type, size, phases)
- Proposed work list (with AI confidence)
- Material requirements (concrete, rebar, etc.)
- Estimated man-hours

---

### 3. Calculator Integration (Kioski)

**Example: Bridge Calculator**

```
Frontend shows: "Calculate concrete volume for foundation"
    ↓
POST /api/calculators/bridge {
  "volume_type": "foundation",
  "length": 45,
  "width": 12,
  "depth": 2.5,
  "concrete_class": "C30/37"
}
    ↓
Express calls Concrete-Agent (or separate calculator service):
POST https://concrete-agent.onrender.com/calculate/bridge
    ↓
Returns: {
  "volume_m3": 1350,
  "hours_pouring": 136,
  "machine_hours": 68,
  "materials": {
    "cement": 405000,  // kg
    "sand": 810000,    // kg
    "gravel": 1350000  // kg
  }
}
    ↓
Frontend displays results, user confirms
    ↓
Adds position to estimate
```

---

### 4. Catalog Matching (OTSKP + URS codes)

**Current flow:**
```
User has work description: "Устройство фундамента из бетона C30/37"
    ↓
Search OTSKP codes in Monolit-Planner DB
    ↓
Returns: [SO0101, SO0102, SO0105, ...]
    ↓
User selects matching codes
```

**Enhanced flow (with CORE):**
```
CORE Engine can also help:
1. Semantic search (find similar works in KB)
2. Suggest alternative codes (URS, KROS)
3. Check if position matches standards
4. Validate materials against standards
```

---

### 5. Estimate Generation

**Flow:**
```
User clicks "Generate Estimate"
    ↓
Express collects all data:
- Project type & dimensions
- Analyzed works (from CORE)
- Calculator results (material volumes, hours)
- Selected OTSKP codes
- Materials list
    ↓
POST /api/estimates/generate
    ↓
Express orchestrates:
1. Validate all data
2. Call CORE for final enrichment
3. Assemble positions
4. Save to DB
5. Generate PDF (blind estimate - без цен)
    ↓
Frontend displays preview
User can:
- Edit individual lines
- Add/remove positions
- Export to PDF/Excel
```

---

## 🚀 Implementation Roadmap

### Phase 4: Document Upload & Analysis (2-3 дні)
**Backend (Express):**
```
✅ DONE: Auth, projects, admin
🔲 TODO: documents.js routes
         ├─ POST /api/documents/upload
         ├─ GET /api/documents/:id
         └─ POST /api/documents/:id/analyze (call CORE)

Files to create:
- backend/src/routes/documents.js
- backend/src/services/concreteAgentClient.js (HTTP wrapper)
- backend/src/db/migrations.js (add document/analysis tables)
```

**Frontend (React):**
```
🔲 TODO: Document upload UI
         ├─ DocumentUpload.tsx (drag-drop, file select)
         ├─ AnalysisPreview.tsx (show CORE results)
         └─ AnalysisConfirm.tsx (approve before saving)

Files to create:
- frontend/src/pages/DocumentUploadPage.tsx
- frontend/src/components/DocumentUpload.tsx
- frontend/src/components/AnalysisPreview.tsx
```

---

### Phase 5: Work List Generation & Enrichment (2-3 дні)
**Backend:**
```
🔲 TODO: workList.js routes
         ├─ POST /api/work-lists/generate
         ├─ GET /api/work-lists/:id
         └─ PUT /api/work-lists/:id (approve)

Services:
- workListGenerator.js (orchestrate CORE calls)
- workTemplateMatchers.js (match similar projects)
```

**Frontend:**
```
🔲 TODO: Work list UI
         ├─ WorkListGenerator.tsx
         ├─ WorkListEditor.tsx
         └─ WorkListPreview.tsx
```

---

### Phase 6: Calculator Integration (3-4 дні)
**Backend:**
```
🔲 TODO: calculators.js routes
         ├─ POST /api/calculators/bridge
         ├─ POST /api/calculators/building
         ├─ POST /api/calculators/parking
         ├─ POST /api/calculators/road
         └─ POST /api/calculators/delivery

Integration with CORE:
- Call Concrete-Agent /calculate/* endpoints
- Cache results
- Save to DB
```

**Frontend:**
```
🔲 TODO: Calculator UI
         ├─ BridgeCalculator.tsx
         ├─ BuildingCalculator.tsx
         ├─ ParkingCalculator.tsx
         ├─ RoadCalculator.tsx
         └─ DeliveryCalculator.tsx
```

---

### Phase 7: Estimate Assembly & Export (2-3 дні)
**Backend:**
```
🔲 TODO: estimates.js routes (UPDATE existing!)
         ├─ POST /api/estimates/generate
         ├─ GET /api/estimates/:id
         ├─ PUT /api/estimates/:id (edit)
         ├─ POST /api/estimates/:id/export (PDF)
         └─ POST /api/estimates/:id/finalize

Services:
- estimateGenerator.js (assemble all data)
- estimateExporter.js (PDF generation)
```

**Frontend:**
```
🔲 TODO: Estimate UI
         ├─ EstimateBuilder.tsx
         ├─ EstimatePreview.tsx
         ├─ EstimateExport.tsx
         └─ EstimateHistory.tsx
```

---

## 🔗 API Endpoints Reference

### Concrete-Agent (CORE) Endpoints

All endpoints at: `https://concrete-agent.onrender.com`

**Workflow A (Import & Audit):**
```
POST /workflow-a/start
  Input: KROS/Excel file
  Returns: parsed positions

POST /workflow-a/audit
  Input: positions
  Returns: audit results (GREEN/AMBER/RED)

POST /workflow-a/enrich
  Input: positions
  Returns: enriched with materials, labor

POST /workflow-a/tech-card
  Input: position
  Returns: technical card (detailed breakdown)

GET /workflow-a/positions
  Returns: all parsed positions
```

**Workflow B (Generate from Drawings):**
```
POST /workflow-b/start
  Input: PDF/images of drawings
  Returns: analysis

POST /workflow-b/analyze
  Input: project type, drawing
  Returns: extracted dimensions, work list

GET /workflow-b/results
  Returns: generated positions
```

**Chat:**
```
POST /chat/message
  Input: user message, context
  Returns: assistant response

POST /chat/analyze-drawing
  Input: drawing image
  Returns: analysis of what's in drawing
```

**Knowledge Base:**
```
GET /kb/search?query=фундамент&category=B5_URS_KROS4
  Returns: matching codes from KB

POST /kb/enrich
  Input: position
  Returns: enriched with KB data
```

**Resources:**
```
POST /resources/tech-card
  Input: position
  Returns: technical breakdown

POST /resources/materials
  Input: position
  Returns: materials list

POST /resources/labor
  Input: position, crew size
  Returns: labor hours
```

---

## 🗄️ New Database Tables (PostgreSQL)

```sql
-- Documents uploaded for analysis
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  user_id INTEGER,
  file_name TEXT,
  file_type TEXT,  -- 'pdf', 'excel', 'image'
  file_path TEXT,
  analysis_status TEXT,  -- 'pending', 'processing', 'done', 'error'
  analysis_data JSON,
  core_response JSON,
  created_at TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Analysis results from CORE Engine
CREATE TABLE document_analyses (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  project_type TEXT,  -- 'bridge', 'building', etc
  dimensions JSON,    -- { length, width, height, area, etc }
  work_list JSON,     -- proposed list of works
  materials JSON,     -- material requirements
  confidence REAL,    -- 0-1
  created_at TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Work lists (generated or manual)
CREATE TABLE work_lists (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  analysis_id TEXT,
  status TEXT,  -- 'draft', 'approved', 'finalized'
  work_items JSON,  -- array of { name, description, volume, unit, hours }
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id),
  FOREIGN KEY (analysis_id) REFERENCES document_analyses(id)
);

-- Calculator results
CREATE TABLE calculator_results (
  id TEXT PRIMARY KEY,
  estimate_id TEXT,
  calculator_type TEXT,  -- 'bridge', 'building', 'delivery', etc
  input_params JSON,
  results JSON,  -- { volume, hours, materials, costs }
  created_at TIMESTAMP
);

-- Generated estimates (final smetы)
CREATE TABLE estimates (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  work_list_id TEXT,
  status TEXT,  -- 'draft', 'ready', 'exported'
  estimate_lines JSON,  -- array of estimate lines
  total_volume REAL,
  total_hours REAL,
  materials_summary JSON,
  exported_at TIMESTAMP,
  exported_format TEXT,  -- 'pdf', 'excel'
  created_at TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id),
  FOREIGN KEY (work_list_id) REFERENCES work_lists(id)
);
```

---

## 🔐 Environment Variables

### Monolit-Planner Backend (.env)
```env
# Concrete-Agent integration
CONCRETE_AGENT_URL=https://concrete-agent.onrender.com
CONCRETE_AGENT_TIMEOUT=60000  # ms

# Optional: if running locally
CONCRETE_AGENT_LOCAL=false
CONCRETE_AGENT_LOCAL_PORT=8000
```

### Concrete-Agent (.env) - already configured
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # Optional
PERPLEXITY_API_KEY=pplx-...  # Optional
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=true
```

---

## 📝 Testing Integration

### 1. Test CORE Engine directly
```bash
# Check if CORE is running
curl https://concrete-agent.onrender.com/docs

# Test Workflow A
curl -X POST https://concrete-agent.onrender.com/workflow-a/start \
  -F "file=@test.xlsx"

# Test chat
curl -X POST https://concrete-agent.onrender.com/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Help me analyze a bridge project"}'
```

### 2. Test Express integration
```bash
# Upload document to Monolit-Planner
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@project.pdf" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check analysis
curl http://localhost:3001/api/documents/abc123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. End-to-end test
```
1. Open Monolit-Planner frontend
2. Create new project
3. Upload PDF document
4. View analysis preview
5. Approve work list
6. Run calculators
7. Generate estimate
8. Export as PDF
```

---

## 📊 System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ USER: Сметчик получил проектную документацию                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Upload PDF/Excel in Monolit-Planner                  │
│ └─ DocumentUploadPage (drag-drop UI)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND Express: POST /api/documents/upload                     │
│ └─ Validate file, save temporarily                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CORE Engine: POST /workflow-a/start                            │
│ ├─ OCR (если PDF)                                              │
│ ├─ Table extraction (если Excel)                               │
│ ├─ Text parsing                                                │
│ └─ Return parsed positions                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND Express: Save analysis to DB                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: AnalysisPreview                                       │
│ ├─ Show detected project type                                  │
│ ├─ Show extracted dimensions                                   │
│ ├─ Show proposed work list                                     │
│ ├─ Show material requirements                                  │
│ └─ [Confirm] [Reject] [Edit]                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         [User confirms]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: Create work list, save positions                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: WorkListEditor                                        │
│ ├─ Display work items                                          │
│ ├─ [+ Add work]                                               │
│ ├─ [Edit] [Delete] for each item                              │
│ ├─ [Calculate volumes]                                        │
│ └─ [Generate estimate]                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    [User clicks Calculate]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Show calculator UI (e.g., BridgeCalculator)          │
│ ├─ Input: length=45m, width=12m, depth=2.5m, concrete=C30/37  │
│ └─ [Calculate]                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: POST /api/calculators/bridge                          │
│ └─ Validate inputs, call CORE or local service                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ CORE/Calculator: Calculate concrete volume, labor hours, etc    │
│ Return: { volume: 1350 m³, hours: 136 h, materials: {...} }   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Display results                                       │
│ ├─ Volume: 1,350 m³                                            │
│ ├─ Labor: 136 man-hours                                        │
│ ├─ Materials: cement, sand, gravel, rebar                      │
│ └─ [Add to estimate]                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                  [Repeat for each work item]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: [Generate Estimate]                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: POST /api/estimates/generate                           │
│ ├─ Collect all work items + calculator results                │
│ ├─ Match OTSKP codes                                           │
│ ├─ Build estimate lines                                        │
│ └─ Save to DB                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: EstimatePreview                                       │
│ ├─ Display all lines (code, name, volume, unit, hours)        │
│ ├─ Show totals (materials, labor)                              │
│ ├─ NO PRICES (blind estimate / слепая смета)                  │
│ └─ [Export PDF] [Export Excel]                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         [User exports]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: Generate PDF/Excel export                             │
│ └─ Save file, return download link                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   📄 Ready to send to customer!
```

---

## 🎯 Success Criteria

### Phase 4: Document Upload
- ✅ User can upload PDF/Excel
- ✅ CORE Engine analyzes document
- ✅ Frontend shows analysis preview
- ✅ User can confirm or reject
- ✅ Analysis saved to database

### Phase 5: Work List Generation
- ✅ System proposes work list from analysis
- ✅ User can edit work list
- ✅ System validates against standards
- ✅ Work list saved as draft

### Phase 6: Calculators
- ✅ Each calculator computes volumes/hours correctly
- ✅ Materials breakdown shown
- ✅ Results saved for estimate

### Phase 7: Estimate Generation
- ✅ Estimate assembles all data
- ✅ OTSKP codes matched correctly
- ✅ Export to PDF (blind estimate)
- ✅ Export to Excel

---

## 🚨 Important Notes

1. **CORE Engine is separate** - If Concrete-Agent goes down, basic functionality still works (manual entry)
2. **Graceful degradation** - System can work without CORE for simple projects
3. **Cache results** - Don't call CORE for same document twice
4. **Rate limiting** - CORE has API limits, implement queuing if needed
5. **Error handling** - If CORE fails, show friendly message, suggest manual entry

---

## 📚 Related Documentation

- **Monolit-Planner:** `/home/user/Monolit-Planner/claude.md`
- **Concrete-Agent:** `https://github.com/alpro1000/concrete-agent/ARCHITECTURE.md`
- **User Management:** `/home/user/Monolit-Planner/USER_MANAGEMENT_ARCHITECTURE.md`
- **Monolith Spec:** `/home/user/Monolit-Planner/MONOLITH_SPEC.md`

---

## 📞 Contact & Support

- **Monolit-Planner Frontend:** https://monolit-planner-frontend.onrender.com
- **Monolit-Planner Backend:** https://monolit-planner-api.onrender.com
- **Concrete-Agent:** https://concrete-agent.onrender.com
- **GitHub Monolit:** https://github.com/alpro1000/Monolit-Planner
- **GitHub Concrete-Agent:** https://github.com/alpro1000/concrete-agent

---

**Last Updated:** 2025-11-14
**Status:** 🚀 Ready for Phase 4 implementation
