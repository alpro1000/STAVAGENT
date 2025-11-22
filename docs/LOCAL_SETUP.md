# Local Development Setup

**How to run the StavAgent monorepo locally**

---

## Overview

The STAVAGENT monorepo contains three services that need to run together:

1. **concrete-agent** (Python, port 8000)
2. **stavagent-portal** (Node.js, port 3001)
3. **Monolit-Planner** (Node.js, port 3002)

This guide walks you through setting up all three services for local development.

---

## Prerequisites

### System Requirements

- **OS**: macOS, Linux, or Windows (with WSL2)
- **Disk Space**: ~5GB free

### Required Software

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Python** >= 3.10
- **PostgreSQL** 14+ OR SQLite (for simple local dev)
- **Redis** 5.0+ (optional but recommended for concrete-agent)
- **Git**

### Optional

- **Postman** or **Insomnia** - for API testing
- **DBeaver** or **pgAdmin** - for database inspection

---

## Installation Steps

### 1. Clone the Monorepo

```bash
git clone https://github.com/alpro1000/STAVAGENT.git
cd STAVAGENT
```

### 2. Set Up concrete-agent (Python Backend)

```bash
# Navigate to concrete-agent
cd concrete-agent/packages/core-backend

# Create Python virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# Install Python dependencies
pip install -r requirements.txt

# Create .env file from template
cp .env.example .env

# Edit .env with your settings (minimal):
# ANTHROPIC_API_KEY=sk-ant-...
# DATABASE_URL=sqlite:///./test.db  (or postgresql://...)
# REDIS_URL=redis://localhost:6379/0
```

### 3. Set Up stavagent-portal (Node.js Portal)

```bash
# Navigate to stavagent-portal (from STAVAGENT root)
cd stavagent-portal

# Install dependencies
npm install

# Create environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env:
# DATABASE_URL=sqlite:///stavagent_portal.db
# JWT_SECRET=your-secret-key-here
# CORE_API_URL=http://localhost:8000
# KIOSK_MONOLIT_URL=http://localhost:3002

# Edit frontend/.env:
# VITE_API_URL=http://localhost:3001
```

### 4. Set Up Monolit-Planner (Node.js Kiosk)

```bash
# Navigate to Monolit-Planner (from STAVAGENT root)
cd Monolit-Planner

# Install dependencies
npm install

# Create environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env:
# DATABASE_URL=sqlite:///monolit.db
# PORTAL_API_URL=http://localhost:3001

# Edit frontend/.env:
# VITE_API_URL=http://localhost:3002
```

---

## Running All Services

### Option A: Run All in One Terminal (Sequential)

**Terminal 1: concrete-agent**
```bash
cd STAVAGENT/concrete-agent/packages/core-backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2: stavagent-portal**
```bash
cd STAVAGENT/stavagent-portal
npm run dev
```

**Terminal 3: Monolit-Planner**
```bash
cd STAVAGENT/Monolit-Planner
npm run dev
```

### Option B: Run Each in Separate Terminal (Recommended)

**Terminal 1**:
```bash
cd STAVAGENT/concrete-agent/packages/core-backend
source venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

Wait for message: `Uvicorn running on http://0.0.0.0:8000`

**Terminal 2**:
```bash
cd STAVAGENT/stavagent-portal
npm run dev:backend
```

Wait for message: `Backend running on http://localhost:3001`

**Terminal 3**:
```bash
cd STAVAGENT/stavagent-portal
npm run dev:frontend
```

Wait for message: `VITE v5.x.x ready in XXX ms`

**Terminal 4**:
```bash
cd STAVAGENT/Monolit-Planner
npm run dev
```

---

## Access the System

Once all services are running:

### Frontend (User Interface)
- **StavAgent Portal**: http://localhost:5173
- **Login**: Use credentials from portal's auth system

### APIs (for Testing)
- **concrete-agent Swagger**: http://localhost:8000/docs
- **concrete-agent ReDoc**: http://localhost:8000/redoc
- **StavAgent Portal API**: http://localhost:3001 (no public docs yet)
- **Monolit-Planner API**: http://localhost:3002 (no public docs yet)

### Databases (if using SQLite)
- **Portal DB**: `stavagent-portal/portal.db`
- **Monolit DB**: `Monolit-Planner/monolit.db`

### Test API Calls

```bash
# Check concrete-agent health
curl http://localhost:8000/health

# Check portal health
curl http://localhost:3001/health

# Test concrete-agent API
curl -X GET http://localhost:8000/docs
```

---

## Common Workflows

### Register a User

1. Open http://localhost:5173
2. Click "Sign Up"
3. Enter email and password
4. (Email verification might be skipped in development)
5. Create first project

### Upload a Document

1. Login to portal
2. Create a project
3. Click "Upload File"
4. Select an Excel or PDF file
5. System sends to concrete-agent for processing
6. View audit results
7. Route to Monolit-Planner for calculation

### Test Direct API Call

```bash
# Create a test file
echo "Sample estimate data" > test.txt

# Upload to concrete-agent
curl -X POST http://localhost:8000/workflow/a/import \
  -F "files=@test.txt" \
  -F "project_id=test-123"

# Response will include parsing results
```

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8000 (macOS/Linux)
lsof -i :8000

# Kill the process
kill -9 <PID>
```

### Database Connection Error

**If getting "psql: command not found"**:
```bash
# Install PostgreSQL (macOS)
brew install postgresql

# Or use SQLite instead (no installation needed):
# Update DATABASE_URL=sqlite:///./test.db
```

### Python Module Not Found

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Node Dependencies Error

```bash
# Clear npm cache and reinstall
npm cache clean --force
npm install
```

### Redis Connection Error

```bash
# Start Redis locally (if available)
redis-server

# Or disable Celery in .env:
CELERY_ENABLED=false
```

---

## Development Workflow

### Making Changes

1. **Backend Changes**:
   - Edit Python files in `concrete-agent/packages/core-backend/`
   - Server auto-reloads with `--reload` flag
   - Check terminal for errors

2. **Frontend Changes**:
   - Edit React/TypeScript files
   - Vite auto-refreshes browser
   - Check browser console for errors

3. **Database Changes**:
   - Edit model files
   - Create migration (if using Alembic)
   - Restart the service

### Running Tests

```bash
# concrete-agent tests
cd concrete-agent/packages/core-backend
pytest

# Portal tests
cd stavagent-portal
npm test

# Monolit tests
cd Monolit-Planner
npm test
```

### Linting & Formatting

```bash
# Python (concrete-agent)
cd concrete-agent/packages/core-backend
ruff check .
black .

# TypeScript (portal, monolit)
cd stavagent-portal
npm run lint
npm run format
```

---

## Data Persistence

### SQLite (Easiest, Default)

```bash
# Database file is created automatically:
stavagent-portal/portal.db
Monolit-Planner/monolit.db
```

**Pros**: No setup needed, file-based
**Cons**: Not suitable for multi-user development

### PostgreSQL (Recommended for Teams)

```bash
# Create local PostgreSQL database
createdb stavagent_portal
createdb stavagent_monolit

# Update .env files:
# DATABASE_URL=postgresql://localhost/stavagent_portal
# DATABASE_URL=postgresql://localhost/stavagent_monolit
```

**Pros**: Multi-user support, production-like
**Cons**: Requires PostgreSQL installation

---

## Environment Variables Reference

### concrete-agent (`.env`)

```env
# API Configuration
FASTAPI_ENV=development

# Database
DATABASE_URL=sqlite:///./test.db
# or: DATABASE_URL=postgresql+asyncpg://user:pass@localhost/stavagent

# Redis (optional, for caching)
REDIS_URL=redis://localhost:6379/0

# API Keys (required)
ANTHROPIC_API_KEY=sk-ant-...

# Optional AI providers
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=...

# Feature flags
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=true
ENABLE_KROS_MATCHING=true
```

### stavagent-portal backend (`.env`)

```env
# Database
DATABASE_URL=sqlite:///./portal.db

# JWT
JWT_SECRET=super-secret-key-change-in-production
JWT_EXPIRE_HOURS=24

# External Services
CORE_API_URL=http://localhost:8000
KIOSK_MONOLIT_URL=http://localhost:3002

# SMTP (optional, for email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### stavagent-portal frontend (`.env`)

```env
VITE_API_URL=http://localhost:3001
```

### Monolit-Planner backend (`.env`)

```env
# Database
DATABASE_URL=sqlite:///./monolit.db

# External Services
PORTAL_API_URL=http://localhost:3001
CORE_API_URL=http://localhost:8000
```

### Monolit-Planner frontend (`.env`)

```env
VITE_API_URL=http://localhost:3002
```

---

## Next Steps

1. **Read Documentation**:
   - [`/docs/ARCHITECTURE.md`](ARCHITECTURE.md) - System overview
   - [`/docs/STAVAGENT_CONTRACT.md`](STAVAGENT_CONTRACT.md) - API contracts
   - [`/concrete-agent/README.md`](../concrete-agent/README.md) - Backend details

2. **Explore the Code**:
   - Start with `concrete-agent/packages/core-backend/app/main.py`
   - Check `stavagent-portal/backend/src/server.js`
   - Review `Monolit-Planner/backend/src/server.js`

3. **Make Your First API Call**:
   - Visit http://localhost:8000/docs
   - Try uploading a sample file

4. **Test the Flow**:
   - Create a project in portal
   - Upload a document
   - View audit results
   - Route to Monolit-Planner
   - See calculations

---

## Support

- **Issues**: [GitHub Issues](https://github.com/alpro1000/STAVAGENT/issues)
- **Documentation**: See `/docs` directory
- **API Docs**: http://localhost:8000/docs (concrete-agent)

---

**Created**: November 2025
**Last Updated**: November 2025
