# 🤖 Claude Development Session - Navigation Index

## 📌 Quick Start for Claude AI

**Если вы новая сессия Claude, прочитайте в этом порядке:**

1. **Текущий статус** → [⬇️ Current Status](#current-status)
2. **Архитектура** → `ARCHITECTURE.md`
3. **План реализации** → `ROADMAP.md`
4. **История сессий** → `SESSION_HISTORY.md`
5. **Спецификация** → `MONOLITH_SPEC.md`

---

## Current Status

### ✅ Project Status: PRODUCTION READY

| Компонент | Статус | Примечание |
|-----------|--------|-----------|
| Backend | ✅ Working | Express + PostgreSQL (Render) + SQLite (dev) |
| Frontend | ✅ Working | React + TypeScript + Vite |
| OTSKP Integration | ✅ Working | 17,904 codes, auto-load, search functional |
| PostgreSQL Support | ✅ Working | All async/await issues fixed |
| Rate Limiting | ✅ Working | Trust proxy properly guarded |
| Security | ✅ Fixed | P1 issue resolved (trust proxy) |
| Documentation | ✅ Complete | ARCHITECTURE.md, MONOLITH_SPEC.md, ROADMAP.md |

### 🎯 Current Branch
`claude/review-previous-session-011CV5UjfnsrTsbV42b46UrS`

### 📊 Latest Commits (3 commits)
```
77fc4e4 🔒 Fix P1 security issue: Guard trust proxy behind environment check
b5a6e1c 🔧 Fix rate limiting and OTSKP search for PostgreSQL
dca6bad 🔧 Add PostgreSQL OTSKP auto-load on startup
```

---

## 📚 Documentation Files

### Architecture & Design
📄 **[ARCHITECTURE.md](ARCHITECTURE.md)** - 450+ lines
- Microservices architecture (Zavoд-Kiosk model)
- Concrete-Agent integration
- System layers and interactions
- Error handling and deployment

🎯 **Why read:** Understand how Monolit-Planner and Concrete-Agent work together

---

### Implementation Plan
📄 **[ROADMAP.md](ROADMAP.md)** - 600+ lines
- 4-phase implementation plan (Weeks 1-4)
- Detailed tasks with acceptance criteria
- Testing strategies
- Success metrics

🎯 **Why read:** To understand what needs to be built next

---

### Universal Object Specification
📄 **[MONOLITH_SPEC.md](MONOLITH_SPEC.md)** - 500+ lines
- Complete database schema (monolith_projects, parts, part_templates)
- Part Detection dictionary
- Position grouping algorithm
- REST API endpoints
- TypeScript models

🎯 **Why read:** To understand how to store and manage universal objects (bridges, buildings, parking, roads)

---

### Session History
📄 **[SESSION_HISTORY.md](SESSION_HISTORY.md)** - 300+ lines
- All previous sessions (1-4)
- Current session summary
- Key metrics and commits
- Outstanding issues

🎯 **Why read:** To understand the development history and context

---

### Security & Code Quality
📄 **SECURITY.md** - Security audit findings
📄 **CLEANUP.md** - Code cleanup tasks
📄 **FIXES.md** - Summary of applied fixes

---

## 🏗️ Architecture Summary

### Zavoд-Kiosk Model (Microservices)

```
┌─────────────────────────────────────┐
│  MONOLIT-PLANNER (КИОСК)            │
│  ├─ Frontend (React)                │
│  ├─ Backend (Express 3001)          │
│  └─ DB: SQLite/PostgreSQL           │
│                                     │
│  Управляет проектами                │
│  Хранит OTSKP коды                  │
│  Рассчитывает KROS                  │
└────────────┬────────────────────────┘
             │ HTTP API
             ↓
┌─────────────────────────────────────┐
│  CONCRETE-AGENT (ЗАВОД)             │
│  ├─ FastAPI (Python)                │
│  ├─ Парсеры (Excel/PDF/XML)        │
│  ├─ LLM modules (Claude AI)         │
│  └─ DB: PostgreSQL (своя)           │
│                                     │
│  Парсит документы                   │
│  Обогащает AI                       │
│  Извлекает бетон                   │
└─────────────────────────────────────┘
```

**Ключевой момент:** Это НЕ клонирование concrete-agent как dependency. Это два **отдельных микросервиса** через REST API.

---

## 🚀 Key Features

### Current (Production)
- ✅ XLSX import and parsing
- ✅ OTSKP code search (17,904 codes)
- ✅ KROS calculation
- ✅ Project management (create, view, edit, delete)
- ✅ Snapshots/versioning
- ✅ User authentication (JWT)
- ✅ Rate limiting
- ✅ Multi-database support (SQLite + PostgreSQL)

### Planned (Phase 1-4, Next 4 weeks)
- 🔲 Universal MonolithProject object (bridges, buildings, parking, roads)
- 🔲 Automatic part detection from Excel
- 🔲 Part grouping and preview
- 🔲 Concrete-Agent integration for smart parsing
- 🔲 Object type selector UI
- 🔲 New upload workflow with preview

---

## 🔧 Tech Stack

### Backend
```
Express.js (REST API)
├─ SQLite3 / PostgreSQL (data)
├─ JWT (auth)
├─ express-rate-limit (rate limiting)
├─ Helmet (security headers)
├─ Multer (file uploads)
├─ XLSX (Excel parsing)
└─ Winston (logging)
```

### Frontend
```
React 18 + TypeScript
├─ Vite (bundler)
├─ React Query (data fetching)
├─ Context API (state)
├─ CSS (styling, responsive)
└─ Fetch API (HTTP client)
```

### Deployment
```
Render (managed hosting)
├─ Frontend: Static SPA
├─ Backend: Node.js with PostgreSQL
└─ Concrete-Agent: FastAPI (when integrated)
```

---

## 📊 Database Schema

### Main Tables
```
monolith_projects
├─ project_id (PK)
├─ object_type: 'bridge' | 'building' | 'parking' | 'road' | 'custom'
├─ owner_id → users
└─ metadata (name, description, metrics)

parts (new)
├─ part_id (PK)
├─ project_id → monolith_projects
├─ part_name: 'ZÁKLADY', 'OPĚRY', 'SLOUPY', ...
└─ is_predefined: true/false

positions
├─ id (PK)
├─ project_id → monolith_projects
├─ part_id → parts
├─ otskp_code → otskp_codes
└─ work details (qty, unit, cost, KROS, ...)

otskp_codes
├─ code (PK)
├─ name, unit, unit_price
├─ specification
└─ search_name (normalized for searching)

users
├─ id (PK)
├─ email, password_hash
├─ name, role
└─ timestamps

part_templates (reference)
├─ template_id (PK)
├─ object_type: 'bridge' | 'building' | 'parking' | 'road'
├─ part_name: predefined parts
└─ is_default
```

---

## 🎯 API Endpoints (Current)

### Auth
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
```

### Projects
```
GET    /api/monolith-projects          # List user projects
POST   /api/monolith-projects          # Create new project
GET    /api/monolith-projects/:id      # Get project details
PUT    /api/monolith-projects/:id      # Update project
DELETE /api/monolith-projects/:id      # Delete project
```

### Positions
```
GET    /api/positions?project_id=X     # List positions
POST   /api/positions                  # Create position
PUT    /api/positions/:id              # Update position
DELETE /api/positions/:id              # Delete position
```

### OTSKP Codes
```
GET    /api/otskp/search?q=query       # Search codes
GET    /api/otskp/count                # Total codes
GET    /api/otskp/:code                # Get specific code
GET    /api/otskp/stats/summary        # Statistics
```

### Import/Export
```
POST   /api/upload                     # Upload XLSX estimate
GET    /api/export/list                # List exports
POST   /api/export                     # Export project to XLSX/CSV
```

---

## 🔒 Security

### Trust Proxy (FIXED)
```javascript
// Only enabled on Render (prevents IP spoofing)
const shouldTrustProxy = process.env.RENDER === 'true' || process.env.TRUST_PROXY === 'true';
if (shouldTrustProxy) {
  app.set('trust proxy', 1);
}
```

### Rate Limiting
- Auth: 5 attempts / 15 minutes
- Upload: 10 uploads / hour
- OTSKP search: 50 searches / 15 minutes
- General API: 100 requests / 15 minutes

### Authentication
- JWT tokens with secret
- requireAuth() middleware on protected routes
- Password hashing with bcrypt

---

## 🧪 Testing

### Current Test Coverage
- Unit tests: concreteExtractor, calculator, text normalization
- Integration tests: upload workflow, OTSKP search
- E2E: Basic project CRUD operations

### How to Run
```bash
# Run all tests
npm test

# Run specific test file
npm test -- partDetector.test.js

# Run with coverage
npm test -- --coverage
```

---

## 🐛 Known Issues

### None Critical ✅

All critical issues have been fixed:
- ✅ PostgreSQL async/await (fixed in previous sessions)
- ✅ OTSKP code loading (fixed this session)
- ✅ Rate limiting validation (fixed this session)
- ✅ Security: Trust proxy (fixed this session)

### Nice-to-haves
- [ ] Performance profiling for large imports (100k+ rows)
- [ ] Additional language support
- [ ] Mobile-responsive design
- [ ] Offline mode

---

## 📋 Getting Started (For Next Session)

### 1. Understand the Current State
```bash
# Read architecture
cat ARCHITECTURE.md  # (quick overview)

# Check branch
git status
git log --oneline -5
```

### 2. If Working on Phase 1
```bash
# Read ROADMAP Phase 1 section
# Read MONOLITH_SPEC.md

# Database migration needed:
# - Rename bridges → monolith_projects
# - Create parts table
# - Create part_templates table
# - Migrate old data
```

### 3. If Working on Phase 2
```bash
# Read ROADMAP Phase 2 section
# Check MONOLITH_SPEC.md Part Detection section

# Need to implement:
# - partDetector.js
# - positionGrouper.js
# - concreteAgentClient.js
```

### 4. If Working on Phase 3
```bash
# Read ROADMAP Phase 3 section

# Need to implement:
# - ObjectTypeSelector component
# - CreateProjectPage
# - UploadPage
# - PreviewGroups component
```

---

## 🔗 File Organization

```
Monolit-Planner/
├── claude.md ..................... THIS FILE (navigation index)
├── ARCHITECTURE.md ............... System architecture
├── MONOLITH_SPEC.md .............. Universal object specification
├── ROADMAP.md .................... 4-phase implementation plan
├── SESSION_HISTORY.md ............ Previous sessions summary
│
├── backend/
│   ├── server.js ................. Main Express app
│   ├── src/
│   │   ├── routes/ ............... API endpoints
│   │   ├── services/ ............ Business logic
│   │   ├── db/ .................. Database initialization
│   │   ├── middleware/ .......... Auth, rate limiting
│   │   └── utils/ ............... Helper functions
│   │
│   └── tests/ .................... Test suite
│
├── frontend/
│   ├── src/
│   │   ├── pages/ ............... Page components
│   │   ├── components/ .......... Reusable components
│   │   ├── hooks/ ............... React hooks
│   │   ├── styles/ .............. CSS files
│   │   └── types/ ............... TypeScript definitions
│   │
│   └── index.html ................ Entry point
│
└── README.md ...................... Project overview
```

---

## 💡 Pro Tips

1. **Grep for TODO/FIXME comments**
   ```bash
   grep -r "TODO\|FIXME" src
   ```

2. **Check database schema**
   ```bash
   sqlite3 data/database.db ".schema"
   ```

3. **Monitor logs during development**
   ```bash
   tail -f logs/*.log
   ```

4. **Test specific endpoint**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/monolith-projects
   ```

---

## 📞 Quick Reference

### Environment Variables
```bash
DATABASE_URL=postgresql://...     # PostgreSQL on Render
RENDER=true                       # Render detection
PORT=3001                         # Backend port
JWT_SECRET=...                    # JWT signing key
OTSKP_IMPORT_TOKEN=...           # Import authorization
CORS_ORIGIN=https://...          # Frontend URL
```

### Common Commands
```bash
# Development
npm run dev

# Production build
npm run build

# Run tests
npm test

# Database reset (dev only)
rm -f data/database.db && npm run dev
```

### Useful Links
- Monolit-Planner Frontend: https://monolit-planner-frontend.onrender.com
- Monolit-Planner API: https://monolit-planner-api.onrender.com
- GitHub: https://github.com/alpro1000/Monolit-Planner

---

## ✨ Last Session Summary

**Date:** November 13, 2025

**Accomplishments:**
1. Fixed PostgreSQL OTSKP auto-load (async compatibility)
2. Fixed rate limiting validation (trust proxy guarding)
3. Refactored OTSKP search for PostgreSQL
4. Designed universal MonolithProject specification
5. Created comprehensive documentation (ARCHITECTURE, MONOLITH_SPEC, ROADMAP)

**Commits:** 3 major commits, all production-ready

**Status:** ✅ All systems operational

---

## 🎓 Next Steps

1. **Immediate (if continuing):** Start Phase 1 implementation
   - See ROADMAP.md Phase 1 section
   - See MONOLITH_SPEC.md database schema

2. **For any session:** Always check ARCHITECTURE.md for context

3. **Questions?** Check SESSION_HISTORY.md for background

---

**Last Updated:** November 13, 2025
**File Size:** Optimized (replaced 600+ line history)
**Status:** Navigation-Ready ✅
