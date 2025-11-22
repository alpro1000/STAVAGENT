# StavAgent System Architecture

**Status**: Complete monorepo with 3 core services (as of November 2025)

---

## Overview

StavAgent is a distributed system for construction cost estimation, audit, and calculation in the Czech market. The system consists of three main services working together in a single monorepo:

```
┌─────────────────────────────────────────────────────────────────┐
│                      STAVAGENT MONOREPO                         │
│                    (github.com/alpro1000/STAVAGENT)             │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  concrete-agent  │  │ stavagent-portal │  │  Monolit-    │  │
│  │   (Python Core)  │  │   (Node.js)      │  │  Planner     │  │
│  │                  │  │                  │  │   (Node.js)  │  │
│  │ Parsers, AI,     │  │ Authentication,  │  │ Calculator   │  │
│  │ Workflows,       │  │ Project Mgmt,    │  │ for concrete │  │
│  │ Audit, KB        │  │ Kiosk routing    │  │ structures   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│         ↑                      ↑ ↔ ↓                    ↑        │
│         └──────────────────────────────────────────────┘        │
│              Internal API calls + data flows                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Three Core Services

### 1. **concrete-agent** (Backend Core System)

**Technology**: Python (FastAPI)

**Location**: `/concrete-agent`

**Purpose**: The backend core of the entire system. Handles document parsing, AI-powered analysis, audit workflows, and construction knowledge base management.

**Key Responsibilities**:
- **Document parsing**: PDF, Excel, XML, drawings (with AI fallbacks)
- **AI integration**: Claude, GPT-4 Vision, Perplexity for document analysis
- **Workflow orchestration**: Two main workflows (Import & Audit, Drawing Analysis)
- **Multi-role audit**: Consensus-based validation using 4 expert roles
- **Knowledge base management**: 9 categories of construction codes, prices, standards
- **Task queuing**: Async job processing via Celery + Redis
- **Position enrichment**: Match items to KROS/RTS codes with confidence scoring

**Tech Stack**:
- Framework: FastAPI
- Database: PostgreSQL (SQLAlchemy 2.0, async)
- Cache/Queue: Redis, Celery
- PDF Processing: MinerU, pdfplumber, Claude Vision
- Data: pandas, openpyxl, xlsxwriter
- AI: Anthropic Claude, OpenAI GPT-4, Perplexity API

**API Endpoints**: `/docs` (Swagger UI available at runtime)

**Note**: This service includes a legacy frontend that is NOT used in production. The actual frontend is in `stavagent-portal`.

---

### 2. **stavagent-portal** (Project Portal & Dispatcher)

**Technology**: Node.js (Express + React/TypeScript)

**Location**: `/stavagent-portal`

**Purpose**: The user-facing portal for project lifecycle management and routing to specialized kiosks. This is the primary frontend for end-users.

**Key Responsibilities**:
- **User authentication**: Email verification, JWT tokens, password reset
- **Project management**: Create, list, view, update projects
- **File upload**: Accept construction documents (specs, budgets, drawings)
- **Kiosk routing**: Dispatch projects to specialized calculators (Monolit, Pump, Formwork, etc.)
- **Core integration**: Send files to concrete-agent for analysis and audit
- **Admin features**: User management, audit logging
- **OTSKP catalog**: Search Czech construction codes

**Backend Tech Stack**:
- Framework: Express.js
- Database: PostgreSQL (or SQLite for dev)
- Authentication: JWT, bcrypt
- File Upload: Multer
- HTTP Client: Axios

**Frontend Tech Stack**:
- Framework: React 18 + TypeScript
- Build: Vite
- State Management: React Context API, TanStack React Query
- Routing: React Router
- Styling: TailwindCSS (inherited from service-specific styles)

**API Endpoints**:
- `/api/auth/` - Authentication
- `/api/portal-projects/` - Project CRUD
- `/api/portal-files/` - File management
- `/api/kiosk-links/` - Kiosk integration
- `/api/otskp/` - Code catalog search
- `/api/admin/` - Admin panel

---

### 3. **Monolit-Planner** (Kiosk Calculator)

**Technology**: Node.js (Express + React/TypeScript)

**Location**: `/Monolit-Planner`

**Purpose**: A specialized kiosk for calculating monolithic concrete structure costs. Takes construction specifications and converts diverse cost units into a unified metric (CZK/m³ of concrete).

**Key Responsibilities**:
- **Excel import**: Parse construction cost estimates from uploaded files
- **OTSKP integration**: 17,904 Czech construction codes with accent-insensitive search
- **Cost normalization**: Convert m², kg, ks → CZK/m³ of concrete element
- **KROS calculation**: Proper rounding (step 50 CZK)
- **Duration estimation**: Calculate project timeline in months/weeks
- **Data export**: Excel and CSV export with formulas

**Backend Tech Stack**:
- Framework: Express.js
- Database: PostgreSQL (or SQLite for dev)
- Excel Processing: exceljs, xlsx
- HTTP Client: Axios
- OTSKP Data: 17,904 codes with local search

**Frontend Tech Stack**:
- Framework: React 18 + TypeScript
- Build: Vite
- State: React Context, TanStack React Query
- Styling: TailwindCSS

**Key Formula**:
```
Labor Hours = crew_size × shift_hours × days
Position Cost = labor_hours × wage
Unit Cost (CZK/m³) = position_cost / concrete_volume
KROS Unit = ceil(unit_cost / 50) × 50
```

---

## Data Flow Architecture

### Flow 1: Upload & Audit

```
User (Portal)
    ↓
[Upload file]
    ↓
concrete-agent: parse_upload (FastAPI)
    ├─ Try multiple parsers (PDF, Excel, XML, etc.)
    ├─ Use Claude/GPT-4 for intelligent extraction
    └─ Return normalized positions
    ↓
concrete-agent: audit_workflow (Workflow A)
    ├─ Validate against knowledge base
    ├─ Multi-role audit (SME, ARCH, ENG, SUP)
    └─ Return GREEN/AMBER/RED classification
    ↓
Portal: Display audit results
    ↓
User: Accept/reject or route to kiosk
```

### Flow 2: Route to Kiosk

```
Portal
    ↓
[User selects kiosk, e.g., "Monolit"]
    ↓
Portal: Send project_id to Monolit-Planner
    ↓
Monolit-Planner
    ├─ Import project data
    ├─ Calculate costs
    └─ Store results
    ↓
Portal: Retrieve results from Monolit
    ↓
User: View/export results
```

### Flow 3: Drawing Analysis

```
User (Portal)
    ↓
[Upload drawing (PDF/JPG)]
    ↓
concrete-agent: analyze_drawing (Workflow B)
    ├─ GPT-4 Vision: Extract structural specs
    ├─ Claude: Calculate concrete quantities
    └─ Return position estimates
    ↓
Portal: Display results → Route to Monolit
    ↓
Monolit-Planner: Auto-import positions
    ↓
Calculations complete
```

---

## Extensibility Design: Future Kiosks

The architecture is designed to support additional specialized kiosks beyond the current three services:

**Future Kiosks** (not yet implemented):
- **Pump Kiosk**: Concrete pumping cost estimation
- **Formwork Kiosk**: Scaffolding and formwork calculations
- **Soil Kiosk**: Earthworks and soil analysis
- **Others**: Custom calculators for specific building elements

**Kiosk Integration Pattern**:

1. Each kiosk is a self-contained service (Node.js recommended)
2. Kiosks register themselves with the portal via a discovery mechanism
3. Portal routes projects to kiosks based on type/user selection
4. Kiosks expose standard endpoints:
   - `POST /import` - Accept project/data from portal
   - `GET /status/:projectId` - Get current calculation status
   - `GET /results/:projectId` - Retrieve calculation results
   - `POST /export/:projectId` - Export results in standard format

**Standard Data Format** (between portal and kiosks):
```json
{
  "projectId": "uuid",
  "projectName": "string",
  "projectType": "monolith|pump|formwork|...",
  "positions": [
    {
      "id": "uuid",
      "description": "string",
      "quantity": "number",
      "unit": "m³|m²|kg|ks",
      "otskpCode": "string (optional)"
    }
  ],
  "metadata": {}
}
```

---

## Service Communication

### Portal ↔ concrete-agent

**How Portal calls Core**:
```
POST /api/upload → concrete-agent: POST /workflow/a/import
GET /api/audit-results → concrete-agent: GET /workflow/a/results/:project_id
```

**Authentication**: Environment-based (API keys or internal network trust in deployment)

**Error Handling**: Portal has fallback UI if core is unavailable

### Portal ↔ Kiosks

**How Portal routes to Kiosks**:
1. Portal maintains kiosk registry (database or config)
2. User selects kiosk from list
3. Portal sends project data via HTTP
4. Kiosk returns results when ready
5. Portal fetches and displays results

**Status Tracking**: Poll-based (check results every N seconds) or webhook-based

---

## Technology Choices

### Why Python for concrete-agent?
- Excellent document parsing libraries (pandas, openpyxl, MinerU)
- Strong AI/ML ecosystem (Anthropic, OpenAI client libraries)
- Async support for I/O-heavy operations
- Well-suited for complex business logic (workflows, audit)

### Why Node.js for portal and kiosks?
- Unified tech stack for frontend + backend
- Fast iteration on UI/business logic
- Strong ecosystem for web applications
- Easy deployment on Render and similar platforms
- Good support for real-time features (WebSocket ready)

---

## Development Environment

**Local Setup**:
1. Each service runs independently
2. Services communicate via HTTP (localhost URLs in dev)
3. Each service has its own database (PostgreSQL or SQLite)
4. See `/docs/LOCAL_SETUP.md` for detailed instructions

**Git Structure**:
- Single monorepo: `github.com/alpro1000/STAVAGENT`
- Three directories at root level
- Shared `/docs/` for system-level documentation
- Each service has its own `/docs/` subdirectory

---

## Deployment Overview

**Current Deployment**: Render.com (see `/docs/DEPLOYMENT.md`)

**Services Deployed**:
- `concrete-agent`: Python FastAPI service
- `stavagent-portal`: Node.js Express + React SPA
- `Monolit-Planner`: Node.js Express + React SPA

**Database**:
- PostgreSQL (shared or per-service, configurable)
- Each service has schema migration scripts

---

## Documentation Map

- **System-Level** (`/docs/`):
  - `ARCHITECTURE.md` - This file (system overview)
  - `STAVAGENT_CONTRACT.md` - API contracts between services
  - `LOCAL_SETUP.md` - Local development setup
  - `DEPLOYMENT.md` - Render deployment guide

- **concrete-agent** (`/concrete-agent/docs/`):
  - `README.md` - Service overview
  - `ARCHITECTURE.md` - Detailed backend architecture
  - `MODULES.md` - Core module breakdown (TODO)
  - `PARSERS.md` - Document parsers (TODO)
  - `AI_INTEGRATION.md` - AI model integration (TODO)
  - `WORKFLOWS.md` - Processing workflows (TODO)
  - `KNOWLEDGE_BASE.md` - KB structure (TODO)
  - `API_REFERENCE.md` - REST API endpoints (TODO)

- **stavagent-portal** (`/stavagent-portal/docs/`):
  - `README.md` - Service overview
  - `FEATURES.md` - User-facing features (TODO)
  - `ARCHITECTURE.md` - Backend + frontend architecture (TODO)
  - `API_REFERENCE.md` - REST API endpoints (TODO)
  - `INTEGRATION.md` - Portal integrations (TODO)

- **Monolit-Planner** (`/Monolit-Planner/docs/`):
  - `README.md` - Service overview
  - `CALCULATOR.md` - Calculator logic and formulas (TODO)
  - `DATA_FLOW.md` - Data flow from input to output (TODO)
  - `INTEGRATION.md` - Kiosk integration pattern (TODO)

---

## Next Steps

1. **Read STAVAGENT_CONTRACT.md** for detailed service APIs and contracts
2. **Read service-level README.md** for quick orientation
3. **Read service-level ARCHITECTURE.md** for detailed implementation details
4. **Run LOCAL_SETUP.md** to set up development environment

---

**Created**: November 2025
**Last Updated**: November 2025
**Maintainer**: StavAgent Development Team
