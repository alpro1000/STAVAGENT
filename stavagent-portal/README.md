# stavagent-portal: Project Portal & Dispatcher

**Status**: ✅ Production-Ready

**Role in StavAgent**: User-facing portal for project lifecycle management and routing to specialized kiosks. This is the primary frontend for end-users.

**Part of**: [STAVAGENT Monorepo](../../docs/ARCHITECTURE.md)

---

## What is stavagent-portal?

stavagent-portal is a **Node.js + React full-stack application** that serves as the central hub for construction project management:

- 🔐 **User authentication**: Email verification, JWT tokens, password reset
- 📁 **Project management**: Create, list, view, update projects
- 📄 **File upload**: Accept construction documents (specs, budgets, drawings)
- 🔗 **Kiosk routing**: Dispatch projects to specialized calculators (Monolit, Pump, Formwork, etc.)
- 🤖 **Core integration**: Send files to concrete-agent for analysis and audit
- 💬 **Chat assistant**: Project-specific assistance (future)
- 👥 **Admin features**: User management, audit logging
- 🏗️ **OTSKP catalog**: Search Czech construction codes

**Technologies**:
- **Backend**: Node.js, Express.js, PostgreSQL (or SQLite)
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **State Management**: React Context API, TanStack React Query
- **Authentication**: JWT tokens, bcrypt password hashing

## Directory Structure

```
stavagent-portal/
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Auth, rate limiting
│   │   └── db/          # Database and migrations
│   └── server.js
│
├── frontend/            # React + TypeScript UI
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable UI components
│   │   ├── context/    # State management
│   │   ├── services/   # API client
│   │   └── hooks/      # Custom React hooks
│   └── vite.config.ts
│
├── shared/              # Shared types and utilities
│   └── src/
│
├── docs/                # Service documentation
│   ├── FEATURES.md      # User-facing features (TODO)
│   ├── ARCHITECTURE.md  # Backend + frontend architecture (TODO)
│   ├── API_REFERENCE.md # API endpoints (TODO)
│   └── INTEGRATION.md   # Portal integrations (TODO)
```

## Quick Start (Local Development)

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL (production) or SQLite (development)

### Installation

```bash
# 1. Clone the monorepo
git clone https://github.com/alpro1000/STAVAGENT.git
cd STAVAGENT/stavagent-portal

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit the .env files with your settings

# 4. Run in development mode
npm run dev
```

### Access

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Docs** (if available): http://localhost:3001/api-docs

## Key Features

### 1. User Management
- Registration with email verification
- Login with JWT tokens (24-hour expiry)
- Password reset functionality
- Admin user management

### 2. Project Management
- Create projects (bridge, building, road, parking, custom types)
- List and view projects
- Update/delete projects
- Project status tracking

### 3. File Management
- Upload construction documents (TZ, budgets, drawings, SMETA)
- File type classification
- File storage and retrieval
- File deletion

### 4. Kiosk Integration
- Link projects to kiosks (Monolit, Pump, Formwork, etc.)
- Route projects to calculators
- Track kiosk processing status
- Retrieve results from kiosks

### 5. Core Integration
- Send documents to concrete-agent for analysis
- Receive audit results (GREEN/AMBER/RED)
- Store processing IDs for tracking
- Accept results into kiosks

### 6. Admin Panel
- View system statistics
- Manage users (create, delete, change roles)
- Audit logging and activity tracking
- System health monitoring

---

## Main API Endpoints

**Authentication**:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token

**Projects**:
- `POST /api/portal-projects` - Create project
- `GET /api/portal-projects` - List user's projects
- `GET /api/portal-projects/:id` - Get project details
- `PUT /api/portal-projects/:id` - Update project
- `DELETE /api/portal-projects/:id` - Delete project

**Files**:
- `POST /api/portal-files` - Upload file
- `GET /api/portal-files/:projectId` - List project files
- `GET /api/portal-files/:fileId/download` - Download file
- `DELETE /api/portal-files/:fileId` - Delete file

**Kiosk Integration**:
- `GET /api/kiosk-links/available` - List available kiosks
- `POST /api/kiosk-links` - Link project to kiosk
- `GET /api/kiosk-links/:projectId` - Get kiosk links

**Admin**:
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/audit-logs` - Get audit logs
- `GET /api/admin/stats` - System statistics

See `docs/API_REFERENCE.md` (TODO) for complete endpoint documentation.

## Integration with Other Services

### Kiosk Integration
Portal can route projects to specialized kiosks:
- **Monolit-Planner** - Monolithic concrete structure calculator (implemented)
- **Pump Kiosk** - Concrete pumping calculator (planned)
- **Formwork Kiosk** - Scaffolding calculator (planned)
- **Custom Kiosks** - Extensible architecture for new calculators

See [STAVAGENT_CONTRACT.md](../../docs/STAVAGENT_CONTRACT.md) for kiosk integration specifications.

### Core Integration
Portal sends documents to concrete-agent for:
- Intelligent document parsing
- Multi-role audit and validation
- Position enrichment with KROS codes
- Drawing analysis for quantity estimation

See [STAVAGENT_CONTRACT.md](../../docs/STAVAGENT_CONTRACT.md) for core integration specifications.

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Run backend + frontend (all packages)
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Building
npm run build            # Build all packages
npm run build:backend    # Build backend
npm run build:frontend   # Build frontend
npm run build:shared     # Build shared types

# Testing & Quality
npm test                 # Run tests
npm run lint             # Run linter
```

### Tech Stack

**Backend**:
- Framework: Express.js 4.x
- Database: PostgreSQL (or SQLite for dev)
- Auth: JWT, bcrypt
- File Upload: Multer
- HTTP Client: Axios
- Logging: Winston

**Frontend**:
- Framework: React 18 + TypeScript
- Build: Vite 5
- Routing: React Router 7
- State: React Context API + React Query
- Styling: TailwindCSS
- Icons: Lucide React

**Shared**:
- Types: TypeScript interfaces
- Formulas: Calculation utilities
- Constants: System constants

---

## Documentation Map

**System-Level** (at STAVAGENT root):
- [`/docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) - System overview (3 services)
- [`/docs/STAVAGENT_CONTRACT.md`](../../docs/STAVAGENT_CONTRACT.md) - Service API contracts
- [`/docs/LOCAL_SETUP.md`](../../docs/LOCAL_SETUP.md) - Local development setup
- [`/docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) - deployment guide

**stavagent-portal Specific** (this service):
- `docs/FEATURES.md` - User-facing features (TODO)
- `docs/ARCHITECTURE.md` - Backend + frontend architecture (TODO)
- `docs/API_REFERENCE.md` - REST API endpoints (TODO)
- `docs/INTEGRATION.md` - Portal integrations (TODO)

---

## What's Next?

1. **Read system overview**: [`/docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
2. **Understand the contract**: [`/docs/STAVAGENT_CONTRACT.md`](../../docs/STAVAGENT_CONTRACT.md)
3. **Run locally**: Follow "Quick Start" above
4. **Explore code**: Start in `backend/src/server.js` or `frontend/src/main.tsx`
5. **Read service docs**: See `docs/` (TODO) for detailed documentation

---

## Support

- **System Issues**: Report to [GitHub Issues](https://github.com/alpro1000/STAVAGENT/issues)
- **Documentation**: See [`/docs`](../../docs) for comprehensive guides

---

**Part of the StavAgent construction management system**
- PostgreSQL / SQLite
- JWT authentication
- Multer (file uploads)

**Frontend:**
- React 18
- TypeScript
- Vite
- React Router
- Context API

## 🔐 Безопасность

- JWT токены для аутентификации
- Rate limiting на API endpoints
- Helmet.js для безопасности headers
- CORS настроен для production
- Валидация всех входящих данных

## 📝 Лицензия

Proprietary — contact info@stavagent.cz.

## 👥 Авторы

StavAgent Team

---

**Последнее обновление:** 2025-11-17
**Статус:** 🚀 Initial release
