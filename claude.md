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

### ✅ Project Status: PRODUCTION READY + ARCHITECTURAL DESIGN

| Компонент | Статус | Примечание |
|-----------|--------|-----------|
| Backend | ✅ Working | Express + PostgreSQL (Render) + SQLite (dev) |
| Frontend | ✅ Working | React + TypeScript + Vite |
| OTSKP Integration | ✅ Working | 17,904 codes, auto-load, search functional |
| PostgreSQL Support | ✅ Fixed | Boolean type mismatch resolved (Phase 1) |
| MonolithProject | ✅ Working | Bridges, buildings, parking, roads unified |
| User Management | 🔲 Design Complete | 4-phase architecture documented |
| Multi-Kiosk Support | 🔲 Design Complete | Distributed architecture documented |
| Email Verification | ❌ Missing | CRITICAL - Phase 1 priority |
| Admin Panel | ❌ Missing | Phase 3 priority |
| Rate Limiting | ✅ Working | Trust proxy properly guarded |
| Security | 🟡 Partially Fixed | /api/config NOW protected, email validation still missing |
| Admin Middleware | ✅ Added | adminOnly.js middleware for role enforcement |
| Documentation | ✅ Complete | ARCHITECTURE.md, MONOLITH_SPEC.md, ROADMAP.md, USER_MANAGEMENT_ARCHITECTURE.md, MULTI_KIOSK_ARCHITECTURE.md |

### 🎯 Current Branch
`claude/read-claude-md-011CV5hwVrSBiNWFD9WgKc1q`

### 📊 Latest Commits (7 commits)
```
e5e3b4e 🔒 CRITICAL: Protect /api/config endpoint with requireAuth and adminOnly middleware
c5db588 🔧 Fix: Sidebar now fetches from monolith-projects endpoint with bridge_id alias
9f6eede 📋 Add: Comprehensive user management and multi-kiosk architecture documentation
8b209ba 📚 Update: Comprehensive claude.md with user management and multi-kiosk architecture documentation
65bf69e 🐛 Fix: PostgreSQL boolean type mismatch in project creation
92c26c0 🔧 Add database initialization script and deployment guide
7d00902 🎨 Fix: Project creation validation, UI improvements, and form control errors
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

### User Management & Admin System
📄 **[USER_MANAGEMENT_ARCHITECTURE.md](USER_MANAGEMENT_ARCHITECTURE.md)** - 520+ lines (NEW)
- Current state analysis (what's working, what's missing)
- 4-phase implementation plan (Days 1-12)
  - Phase 1: Email Verification & Security Fixes (Days 1-3)
  - Phase 2: User Dashboard & Password Reset (Days 4-7)
  - Phase 3: Admin Panel & Audit Logging (Days 8-12)
  - Phase 4: Multi-Kiosk Support (Future)
- Database schema changes for each phase
- Security fixes (CRITICAL: /api/config endpoint protection)
- Implementation checklists and code examples

🎯 **Why read:** To implement user registration email verification, admin panel, and role-based access control

---

### Multi-Kiosk Deployment Architecture
📄 **[MULTI_KIOSK_ARCHITECTURE.md](MULTI_KIOSK_ARCHITECTURE.md)** - 550+ lines (NEW)
- Business requirements (kiosk independence, factory isolation)
- Architecture options (Option B: Distributed with local databases recommended)
- Database schema for kiosks management
- User-kiosk assignment and role inheritance
- Backend implementation (kiosk context middleware, kiosk-aware queries)
- Frontend implementation (KioskSelector component, routing updates)
- Docker Compose multi-kiosk deployment setup
- Health monitoring and sync strategy
- Implementation checklist (Phase 4)

🎯 **Why read:** To understand how to support multiple independent kiosk installations (factories)

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
📄 **DEPLOYMENT_GUIDE.md** - Production deployment steps

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

## 🔐 Security Issues (To Be Fixed)

### 🔴 CRITICAL: Config Endpoint ✅ FIXED

**File:** `backend/src/middleware/adminOnly.js` (NEW), `backend/src/routes/config.js` (UPDATED)
**Issue:** POST /api/config endpoint had NO authentication
**Status:** ✅ FIXED - Added requireAuth and adminOnly middleware
**Implementation:**
- Created `adminOnly.js` middleware for role-based access control
- Protected GET /api/config with `requireAuth` (any authenticated user can read)
- Protected POST /api/config with `requireAuth` + `adminOnly` (only admins can modify)
- Commit: e5e3b4e 🔒 CRITICAL: Protect /api/config endpoint with requireAuth and adminOnly middleware

---

### 🔴 CRITICAL: Email Verification Missing

**Issue:** Users can register with fake/invalid email addresses
**Current:** Anyone with any email can create an account
**Impact:** Fake accounts, spam registrations
**Solution:** Phase 1 implementation in USER_MANAGEMENT_ARCHITECTURE.md
**Required:**
- Email verification tokens system
- sendVerificationEmail() function
- Email verification endpoint: POST /api/auth/verify
- Block login until email verified

---

### 🟡 HIGH: Role-Based Access Control Not Enforced

**Issue:** Role field exists in users table but never checked
**Current:** All authenticated users treated as 'user', 'admin' role ignored
**Impact:** No way to restrict admin-only features
**Solution:** Phase 1-3 in USER_MANAGEMENT_ARCHITECTURE.md
**Required:**
- adminOnly() middleware implementation
- Check role on protected routes
- Admin panel creation (Phase 3)

---

### 🟡 HIGH: No User Dashboard

**Issue:** Users have no profile or settings page
**Current:** After login, no place to see user info or change password
**Impact:** Poor user experience, no password recovery
**Solution:** Phase 2 in USER_MANAGEMENT_ARCHITECTURE.md
**Required:**
- DashboardPage.tsx component
- User profile display
- Change password functionality

---

## 🐛 Known Issues (Phase 1 Fixes)

### ✅ Fixed This Session

- ✅ CRITICAL: /api/config endpoint unprotected (added requireAuth + adminOnly middleware)
- ✅ Sidebar project display (now fetches from /api/monolith-projects)
- ✅ PostgreSQL boolean type mismatch (is_default = 1 → is_default = true)
- ✅ Form control errors (removed hidden select element)
- ✅ Project creation validation (check templates exist)
- ✅ TypeScript syntax in JavaScript files (removed `as any` casts)
- ✅ Database initialization script (backend/scripts/init-database.js)

### ✅ Fixed Previous Sessions
- ✅ PostgreSQL async/await
- ✅ OTSKP code loading
- ✅ Rate limiting validation
- ✅ Security: Trust proxy

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

**Date:** November 13, 2025 (Continuation 2)
**Focus:** CRITICAL security fix, sidebar bug fix, and Phase 1 implementation beginning

**Accomplishments:**

### CRITICAL SECURITY FIX (Just Completed)
0. ✅ **CRITICAL: Protected /api/config endpoint**
   - Created `adminOnly.js` middleware for role-based access control
   - Protected GET /api/config with requireAuth (read allowed)
   - Protected POST /api/config with requireAuth + adminOnly (write restricted to admins only)
   - Prevents unauthorized users from modifying system feature flags
   - File: backend/src/middleware/adminOnly.js (NEW)
   - File: backend/src/routes/config.js (UPDATED)

### Phase 1: Code Review & Bug Fixes
1. ✅ Fixed PostgreSQL boolean type mismatch (is_default = 1 → true)
   - Issue: 500 errors in production preventing project creation
   - Files: monolith-projects.js (line 131, 175), parts.js (line 133)
   - Severity: CRITICAL - blocked production

2. ✅ Fixed form control console errors
   - Issue: "An invalid form control with name='' is not focusable"
   - File: ObjectTypeSelector.tsx - removed hidden select element

3. ✅ Added project creation validation
   - Check: Templates must exist before creating project
   - File: monolith-projects.js (lines 107-144)

4. ✅ Removed TypeScript syntax from JavaScript
   - Issue: `as any` casts cause runtime errors
   - Files: monolith-projects.js (lines 115, 264)

5. ✅ Created database initialization script
   - File: backend/scripts/init-database.js
   - Purpose: Manual OTSKP code loading for production

6. ✅ Created deployment guide
   - File: DEPLOYMENT_GUIDE.md
   - Content: Database initialization, troubleshooting, workflow documentation

7. ✅ Fixed sidebar project display bug
   - Issue: Projects created but not appearing in left sidebar
   - Root Cause: Sidebar querying old /api/bridges instead of /api/monolith-projects
   - Fix: Updated bridgesAPI to use /api/monolith-projects endpoint
   - Added bridge_id alias for backward compatibility
   - Files: frontend/src/services/api.ts, backend/src/routes/monolith-projects.js

### Phase 2: Architectural Design (4 Implementation Phases)
8. ✅ Designed User Management Architecture (520+ lines)
   - **Phase 1 (Days 1-3):** Email verification + /api/config security fix
   - **Phase 2 (Days 4-7):** User dashboard + password reset
   - **Phase 3 (Days 8-12):** Admin panel + audit logging
   - **Phase 4 (Future):** Multi-kiosk support
   - File: USER_MANAGEMENT_ARCHITECTURE.md

9. ✅ Designed Multi-Kiosk Architecture (550+ lines)
   - Business requirement: Kiosk independence (if one fails, others work)
   - Architecture: Distributed with local databases (Option B - recommended)
   - Features: User-kiosk assignment, health monitoring, Docker Compose deployment
   - File: MULTI_KIOSK_ARCHITECTURE.md

### Phase 3: Documentation Updates
10. ✅ Updated claude.md with:
   - New architecture document references
   - Security issues section (4 CRITICAL/HIGH issues)
   - Fixes summary for this session
   - Status update for all components

**Commits:** 7 commits, all production-ready
```
e5e3b4e 🔒 CRITICAL: Protect /api/config endpoint with requireAuth and adminOnly middleware
c5db588 🔧 Fix: Sidebar now fetches from monolith-projects endpoint with bridge_id alias
9f6eede 📋 Add: Comprehensive user management and multi-kiosk architecture documentation
8b209ba 📚 Update: Comprehensive claude.md with user management and multi-kiosk architecture documentation
65bf69e 🐛 Fix: PostgreSQL boolean type mismatch in project creation
92c26c0 🔧 Add database initialization script and deployment guide
7d00902 🎨 Fix: Project creation validation, UI improvements, and form control errors
```

**Status:** ✅ CRITICAL security fix deployed, Sidebar fixed, Ready for Phase 1 Email Verification implementation

---

## 🎓 Next Steps (READY TO IMPLEMENT)

### PHASE 1: Security & Email Verification (Days 1-3)

**CRITICAL FIX (Do First):**
```bash
# 1. Fix /api/config endpoint protection
#    File: backend/src/routes/config.js
#    Add: requireAuth, adminOnly middleware to POST route
#    Time: 30 minutes
```

**Implementation Tasks (in order):**
1. Create emailService.js with Resend API integration (1h)
2. Update users table schema: add email_verified, email_verified_at (30m)
3. Create email_verification_tokens table (30m)
4. Update POST /api/auth/register (send verification email) (1h)
5. Create POST /api/auth/verify endpoint (30m)
6. Update LoginPage.tsx UI (30m)
7. Create VerifyEmail.tsx component (1h)
8. Test full email verification flow (1h)

**See:** USER_MANAGEMENT_ARCHITECTURE.md Phase 1 section for detailed implementation guide

---

### PHASE 2: User Dashboard & Password Reset (Days 4-7)

**Implementation Tasks:**
1. Create DashboardPage.tsx component (2h)
2. Create ChangePasswordPage.tsx component (1h)
3. Add change-password endpoint (1h)
4. Add forgot-password endpoint (1h)
5. Add reset-password endpoint (1h)
6. Create password_reset_tokens table (30m)
7. Full password reset flow testing (1h)

**See:** USER_MANAGEMENT_ARCHITECTURE.md Phase 2 section

---

### PHASE 3: Admin Panel (Days 8-12)

**Implementation Tasks:**
1. Create adminOnly.js middleware (30m)
2. Create admin.js routes with user management (2h)
3. Create AdminPanel.tsx page (2h)
4. Create AdminRoute.tsx component (30m)
5. Create audit_logs table (30m)
6. Add audit logging to key endpoints (1h)
7. Full admin panel testing (1h)

**See:** USER_MANAGEMENT_ARCHITECTURE.md Phase 3 section

---

### PHASE 4: Multi-Kiosk Support (Weeks 3-4, Future)

**See:** MULTI_KIOSK_ARCHITECTURE.md for complete design

---

### Resources for Implementation:
1. **USER_MANAGEMENT_ARCHITECTURE.md** - Detailed phase breakdown with code examples
2. **MULTI_KIOSK_ARCHITECTURE.md** - Complete distributed kiosk design
3. **DEPLOYMENT_GUIDE.md** - Production deployment procedures

### Priority Matrix:
| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Fix /api/config security | 🔴 CRITICAL | 30m | HIGH |
| Email verification | 🔴 CRITICAL | 5h | HIGH |
| Admin panel | 🟡 HIGH | 8h | HIGH |
| User dashboard | 🟡 HIGH | 4h | MEDIUM |
| Multi-kiosk support | 🟢 LOW | 16h | MEDIUM |

---

**Last Updated:** November 13, 2025
**File Size:** Optimized with new architecture docs
**Status:** Ready for Phase 1 Implementation ✅
