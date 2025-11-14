# 🚀 Quick Reference - Estimate Automation Platform

> **Быстрая справка для разработчика**
>
> Где что находится, как что работает, какие endpoints использовать

---

## 📍 Системы (Locations)

| Система | URL | Папка | Язык | Порт |
|---------|-----|-------|------|------|
| **Monolit-Planner Frontend** | https://monolit-planner-frontend.onrender.com | `/home/user/Monolit-Planner/frontend` | React/TypeScript | 5173 (dev) |
| **Monolit-Planner Backend** | https://monolit-planner-api.onrender.com | `/home/user/Monolit-Planner/backend` | Node.js/Express | 3001 |
| **Concrete-Agent (CORE)** | https://concrete-agent.onrender.com | `git clone https://github.com/alpro1000/concrete-agent.git` | Python/FastAPI | 8000 |

---

## 🔄 Data Flow Paths

### 1. User uploads document
```
Frontend: DocumentUploadPage
    ↓
Backend: POST /api/documents/upload
    ↓
CORE: POST /workflow-a/start (парсинг)
    ↓
Backend: Saves to documents table
    ↓
Frontend: Shows AnalysisPreview
```

### 2. User confirms analysis
```
Frontend: [Confirm button]
    ↓
Backend: POST /api/documents/:id/confirm
    ↓
Creates: work_list + positions
    ↓
Frontend: Shows WorkListEditor
```

### 3. User calculates volumes
```
Frontend: BridgeCalculator (или др.)
    ↓
Backend: POST /api/calculators/bridge
    ↓
CORE: /calculate/bridge (или локально)
    ↓
Returns: { volume, hours, materials }
    ↓
Frontend: Shows results
```

### 4. User generates estimate
```
Frontend: [Generate Estimate]
    ↓
Backend: POST /api/estimates/generate
    ↓
Collects: work_list + calculator results + OTSKP codes
    ↓
Creates: estimate (слепая смета)
    ↓
Frontend: EstimatePreview
    ↓
User: [Export PDF/Excel]
```

---

## 📚 Key Database Tables

### Monolit-Planner (PostgreSQL)

**Already exist:**
- `users` - пользователи
- `monolith_projects` - проекты (мосты, здания и т.д.)
- `positions` - позиции в проекте
- `parts` - части объекта
- `otskp_codes` - каталог кодов (17,904)
- `snapshots` - версии
- `audit_logs` - аудит админ-действий

**Need to add (Phase 4+):**
- `documents` - загруженные файлы
- `document_analyses` - результаты анализа CORE
- `work_lists` - списки работ
- `calculator_results` - результаты калькуляторов
- `estimates` - готовые сметы

---

## 🔌 API Endpoints Reference

### Monolit-Planner Backend (`https://monolit-planner-api.onrender.com`)

**Auth (DONE):**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify (email verification)
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/me
```

**Projects (DONE):**
```
GET    /api/monolith-projects
POST   /api/monolith-projects
GET    /api/monolith-projects/:id
PUT    /api/monolith-projects/:id
DELETE /api/monolith-projects/:id
```

**Positions (DONE):**
```
GET    /api/positions?project_id=X
POST   /api/positions
PUT    /api/positions/:id
DELETE /api/positions/:id
```

**OTSKP (DONE):**
```
GET    /api/otskp/search?q=фундамент
GET    /api/otskp/:code
GET    /api/otskp/stats/summary
```

**Admin (DONE):**
```
GET    /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
GET    /api/admin/audit-logs
GET    /api/admin/stats
```

**Documents (TO DO - Phase 4):**
```
POST   /api/documents/upload
GET    /api/documents/:id
GET    /api/documents/:id/analysis
POST   /api/documents/:id/confirm
DELETE /api/documents/:id
```

**Calculators (TO DO - Phase 6):**
```
POST   /api/calculators/bridge
POST   /api/calculators/building
POST   /api/calculators/parking
POST   /api/calculators/road
POST   /api/calculators/delivery
```

**Estimates (TO DO - Phase 7):**
```
POST   /api/estimates/generate
GET    /api/estimates/:id
PUT    /api/estimates/:id
POST   /api/estimates/:id/export
```

---

### Concrete-Agent Backend (`https://concrete-agent.onrender.com`)

**Workflow A (Import & Audit):**
```
POST   /workflow-a/start           # Upload KROS/Excel
POST   /workflow-a/audit           # Multi-role validation
POST   /workflow-a/enrich          # AI enrichment
GET    /workflow-a/positions       # Get parsed results
POST   /workflow-a/tech-card       # Technical card
POST   /workflow-a/resource-sheet  # Resource planning
```

**Workflow B (Generate from Drawings):**
```
POST   /workflow-b/start           # Upload PDF/images
POST   /workflow-b/analyze         # OCR + AI analysis
GET    /workflow-b/results         # Generated positions
```

**Chat:**
```
POST   /chat/message               # Chat with system
POST   /chat/analyze-drawing       # Analyze document
```

**Knowledge Base:**
```
GET    /kb/search?query=...        # Search KB (B1-B9)
POST   /kb/enrich                  # Enrich position
```

**Calculators:**
```
POST   /calculate/bridge           # Bridge calculation
POST   /calculate/building         # Building calculation
POST   /calculate/parking          # Parking calculation
POST   /calculate/road             # Road calculation
POST   /calculate/delivery         # Delivery calculation
```

---

## 🛠️ Development Commands

### Frontend
```bash
cd /home/user/Monolit-Planner/frontend

# Development
npm install
npm run dev           # Runs on http://localhost:5173

# Build
npm run build
npm run preview

# Test
npm test
```

### Backend
```bash
cd /home/user/Monolit-Planner/backend

# Installation
npm install

# Development
npm run dev           # Runs on http://localhost:3001

# Production
npm start

# Test
npm test
```

### CORE Engine (Concrete-Agent)
```bash
git clone https://github.com/alpro1000/concrete-agent.git
cd concrete-agent

# Setup
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with API keys

# Run
uvicorn app.main:app --reload     # Development
gunicorn app.main:app -w 4        # Production

# Access docs
http://localhost:8000/docs
```

---

## 🗂️ File Structure

### Frontend
```
frontend/
├─ src/
│  ├─ pages/
│  │  ├─ LoginPage.tsx
│  │  ├─ DashboardPage.tsx
│  │  ├─ AdminDashboard.tsx
│  │  ├─ DocumentUploadPage.tsx (NEW - Phase 4)
│  │  └─ EstimateBuilderPage.tsx (NEW - Phase 7)
│  ├─ components/
│  │  ├─ admin/
│  │  │  ├─ UserManagement.tsx
│  │  │  ├─ AuditLogs.tsx
│  │  │  └─ AdminStats.tsx
│  │  ├─ DocumentUpload.tsx (NEW)
│  │  ├─ AnalysisPreview.tsx (NEW)
│  │  ├─ WorkListEditor.tsx (NEW)
│  │  ├─ BridgeCalculator.tsx (NEW - Phase 6)
│  │  ├─ EstimatePreview.tsx (NEW)
│  │  └─ ...others
│  ├─ context/
│  │  ├─ AuthContext.tsx
│  │  ├─ AppContext.tsx
│  │  └─ EstimateContext.tsx (NEW)
│  └─ services/
│     ├─ api.ts (has adminAPI)
│     └─ concreteAgentApi.ts (NEW)
└─ ...
```

### Backend
```
backend/
├─ src/
│  ├─ routes/
│  │  ├─ auth.js (DONE)
│  │  ├─ admin.js (DONE)
│  │  ├─ monolith-projects.js (DONE)
│  │  ├─ positions.js (DONE)
│  │  ├─ documents.js (NEW - Phase 4)
│  │  ├─ calculators.js (NEW - Phase 6)
│  │  ├─ estimates.js (NEW - Phase 7)
│  │  └─ ...others
│  ├─ services/
│  │  ├─ concreteAgentClient.js (NEW - HTTP wrapper)
│  │  ├─ documentParser.js (NEW - Phase 4)
│  │  ├─ workListGenerator.js (NEW - Phase 5)
│  │  └─ estimateGenerator.js (NEW - Phase 7)
│  ├─ db/
│  │  ├─ init.js
│  │  ├─ migrations.js (UPDATE - add new tables)
│  │  └─ schema-postgres.sql (UPDATE)
│  └─ middleware/
│     ├─ auth.js
│     ├─ adminOnly.js
│     └─ ...
└─ server.js
```

---

## 🔑 Environment Variables

### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://...  # Production
# or SQLite in dev

# Auth
JWT_SECRET=your-secret-key
RESEND_API_KEY=re_...

# CORE Engine integration
CONCRETE_AGENT_URL=https://concrete-agent.onrender.com
CONCRETE_AGENT_TIMEOUT=60000

# Optional for local development
CONCRETE_AGENT_LOCAL=false
CONCRETE_AGENT_LOCAL_PORT=8000
```

### Frontend (.env)
```env
VITE_API_URL=https://monolit-planner-api.onrender.com
VITE_CORE_API_URL=https://concrete-agent.onrender.com
```

---

## 📊 Typical Workflow (User's POV)

```
1. User logs in → AuthContext handles JWT
2. User creates project → /api/monolith-projects POST
3. User uploads document → /api/documents/upload POST
4. CORE analyzes → /workflow-a/start (background)
5. User sees preview → AnalysisPreview component
6. User confirms → /api/documents/:id/confirm POST
7. System creates work list → work_lists table
8. User edits works → WorkListEditor component
9. User calculates → /api/calculators/bridge POST
10. CORE/calc returns results → display on UI
11. User generates estimate → /api/estimates/generate POST
12. User exports → PDF generation
13. File ready for download
```

---

## 🐛 Debugging Tips

### Check if CORE is up
```bash
curl https://concrete-agent.onrender.com/docs
# Should show Swagger UI
```

### Test CORE workflow directly
```bash
# Workflow A with file
curl -X POST https://concrete-agent.onrender.com/workflow-a/start \
  -F "file=@test.xlsx"

# Chat
curl -X POST https://concrete-agent.onrender.com/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message": "Помоги с расчетом моста"}'
```

### Check backend logs
```bash
# In production (Render)
# Go to https://dashboard.render.com → select service → Logs

# In development
npm run dev  # Terminal shows logs
```

### Check database
```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# View tables
\dt

# Query data
SELECT * FROM users LIMIT 5;
```

---

## 🎯 Next Immediate Steps (Action Items)

### For Phase 4 (Document Upload)
1. ✅ Create `SYSTEMS_INTEGRATION.md` (this file!)
2. 🔲 Create `backend/src/routes/documents.js`
3. 🔲 Create `backend/src/services/concreteAgentClient.js`
4. 🔲 Update `backend/src/db/migrations.js` (add documents table)
5. 🔲 Create `frontend/src/pages/DocumentUploadPage.tsx`
6. 🔲 Create `frontend/src/components/DocumentUpload.tsx`
7. 🔲 Create `frontend/src/components/AnalysisPreview.tsx`
8. 🔲 Add route to `frontend/src/App.tsx`
9. 🔲 Test end-to-end

---

## 📞 Quick Links

- **Local Monolit:** `cd /home/user/Monolit-Planner`
- **CORE repo:** `git clone https://github.com/alpro1000/concrete-agent.git`
- **This doc:** `SYSTEMS_INTEGRATION.md` (in Monolit-Planner)
- **Status:** Check `claude.md` for latest progress
- **Architecture:** See `ARCHITECTURE.md` for details

---

**Last Updated:** 2025-11-14 00:00
**Next Review:** After Phase 4 implementation
