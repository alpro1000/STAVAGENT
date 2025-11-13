# 🏪 Multi-Kiosk Architecture Design

**Status:** 📋 Design Phase (Not yet implemented)
**Priority:** 🟡 MEDIUM (Phase 4 - After admin panel)
**Complexity:** HIGH
**Estimated Effort:** 2-3 weeks

---

## 🎯 BUSINESS REQUIREMENT

### Current State
```
Single Instance = Single Kiosk (Factory/Plant)
┌────────────────────────────────┐
│   Monolit-Planner Instance     │
│  (e.g., "Factory A")           │
│                                │
│  ├─ Frontend                   │
│  ├─ Backend                    │
│  └─ Database (SQLite/PG)       │
└────────────────────────────────┘
```

### Desired State
```
Multiple Instances = Multiple Kiosks (Different Factories/Plants)

Deployment Option 1: Separate Containers
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Kiosk 1      │  │ Kiosk 2      │  │ Kiosk 3      │
│ (Factory A)  │  │ (Factory B)  │  │ (Factory C)  │
│              │  │              │  │              │
│ Frontend:    │  │ Frontend:    │  │ Frontend:    │
│ :3000        │  │ :3001        │  │ :3002        │
│              │  │              │  │              │
│ Backend:     │  │ Backend:     │  │ Backend:     │
│ :3001        │  │ :3002        │  │ :3003        │
│              │  │              │  │              │
│ DB: SQLite   │  │ DB: SQLite   │  │ DB: SQLite   │
│ (local.db)   │  │ (local.db)   │  │ (local.db)   │
└──────────────┘  └──────────────┘  └──────────────┘

Deployment Option 2: Shared API Gateway
┌──────────────────────────────────────────┐
│        API Gateway / Load Balancer       │
│        (nginx, HAProxy, or custom)       │
│  Distributes requests to kiosks          │
└──────────────────────────────────────────┘
         ↓              ↓              ↓
    Kiosk 1         Kiosk 2         Kiosk 3
    (Port 3001)    (Port 3002)    (Port 3003)
```

### Key Business Goals

1. **Independence:** If Kiosk 1 crashes → Kiosk 2 & 3 keep working
2. **Isolation:** Kiosk 1's users ≠ Kiosk 2's users
3. **Configuration:** Each kiosk can have different settings
4. **Centralized Monitoring:** Central admin can see all kiosks
5. **User Assignment:** Users can belong to multiple kiosks

---

## 🏗️ ARCHITECTURE DESIGN

### Option A: Stateless with Shared Central Database

```
         Central Admin
         Server
            ↓
    ┌───────┴───────┐
    ↓               ↓
  Kiosk 1        Kiosk 2
    ↓               ↓
    └───────┬───────┘
            ↓
    PostgreSQL (Central)

    Pros:
    + Single source of truth for all data
    + Easy to implement

    Cons:
    - Central DB fails = all kiosks fail
    - Not truly independent
```

### Option B: Distributed with Local Databases (Recommended)

```
┌─────────────────────────────────────────────────┐
│        Central Admin Console (Optional)          │
│        (Aggregates data from all kiosks)        │
└─────────────────────────────────────────────────┘
         ↓              ↓              ↓
    ┌────────┐    ┌────────┐    ┌────────┐
    │ Kiosk 1│    │ Kiosk 2│    │ Kiosk 3│
    │        │    │        │    │        │
    │ PG     │    │ PG     │    │ PG     │
    │(Local) │    │(Local) │    │(Local) │
    └────────┘    └────────┘    └────────┘

    Pros:
    + Kiosks are truly independent
    + If one fails, others work
    + Can work offline (sync later)

    Cons:
    - Data sync between kiosks is complex
    - Need central dashboard for aggregation
```

### Chosen Architecture: Option B (Distributed)

**Rationale:**
- Maximum resilience (key requirement: "если какото киоск падал то не ружишл остальные")
- Each kiosk can operate independently
- Better for factory floors with intermittent connectivity

---

## 📊 DATABASE SCHEMA CHANGES

### New Tables

#### 1. Kiosks Registry

```sql
CREATE TABLE kiosks (
  id VARCHAR(255) PRIMARY KEY,        -- UUID
  name VARCHAR(255) NOT NULL,         -- "Factory A - Floor 1"
  location VARCHAR(255),              -- "Building 3, Room 402"
  type VARCHAR(50),                   -- 'production', 'training', 'archive'

  -- Configuration
  config_id INTEGER UNIQUE REFERENCES project_config(id),

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'maintenance'

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP             -- Last heartbeat from this kiosk
);

CREATE INDEX idx_kiosks_status ON kiosks(status);
CREATE INDEX idx_kiosks_created_at ON kiosks(created_at);
```

#### 2. User-Kiosk Assignment

```sql
CREATE TABLE user_kiosk_assignment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kiosk_id VARCHAR(255) NOT NULL REFERENCES kiosks(id) ON DELETE CASCADE,

  -- Per-kiosk role (can differ from global role)
  role VARCHAR(50) NOT NULL DEFAULT 'user',  -- 'user', 'admin', 'manager'

  -- Timestamps
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Permission level
  can_export BOOLEAN DEFAULT true,
  can_import BOOLEAN DEFAULT true,
  can_delete BOOLEAN DEFAULT false,

  UNIQUE(user_id, kiosk_id)
);

CREATE INDEX idx_user_kiosk_user ON user_kiosk_assignment(user_id);
CREATE INDEX idx_user_kiosk_kiosk ON user_kiosk_assignment(kiosk_id);
```

#### 3. Kiosk Heartbeat/Health

```sql
CREATE TABLE kiosk_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kiosk_id VARCHAR(255) NOT NULL REFERENCES kiosks(id) ON DELETE CASCADE,

  -- Health metrics
  status VARCHAR(20),                 -- 'healthy', 'degraded', 'offline'
  cpu_usage FLOAT,
  memory_usage FLOAT,
  disk_usage FLOAT,

  -- Last check
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kiosk_health_kiosk ON kiosk_health(kiosk_id);
CREATE INDEX idx_kiosk_health_checked ON kiosk_health(checked_at);
```

#### 4. Kiosk Audit Logs (Per-Kiosk)

```sql
-- Extend existing audit_logs table with kiosk_id
ALTER TABLE audit_logs ADD COLUMN kiosk_id VARCHAR(255);
ALTER TABLE audit_logs ADD FOREIGN KEY (kiosk_id) REFERENCES kiosks(id);

CREATE INDEX idx_audit_kiosk ON audit_logs(kiosk_id);
```

#### 5. Per-Kiosk Configuration

```sql
-- Modify project_config to support per-kiosk config
ALTER TABLE project_config ADD COLUMN kiosk_id VARCHAR(255) UNIQUE;
ALTER TABLE project_config ADD FOREIGN KEY (kiosk_id) REFERENCES kiosks(id);

-- Allow NULL kiosk_id for global/default config
UPDATE project_config SET kiosk_id = NULL WHERE id = 1;  -- Global config
```

---

## 🔄 USER AUTHENTICATION & KIOSK CONTEXT

### Login Flow with Kiosk Selection

```
1. User visits /login
   ↓
2. User enters email + password
   ↓
3. Backend validates credentials
   ↓
4. Backend returns JWT + assigned_kiosks list
   {
     token: "jwt...",
     user: {
       id: 42,
       email: "ivan@factory.cz",
       name: "Ivan"
     },
     assigned_kiosks: [
       { id: "kiosk-1", name: "Factory A - Floor 1" },
       { id: "kiosk-2", name: "Factory A - Floor 2" },
       { id: "kiosk-3", name: "Factory B - All" }
     ]
   }
   ↓
5. Frontend shows Kiosk Selector (if multiple kiosks)
   ┌─────────────────────────────┐
   │ Select Your Kiosk           │
   ├─────────────────────────────┤
   │ ○ Factory A - Floor 1       │
   │ ● Factory A - Floor 2       │
   │ ○ Factory B - All           │
   │                             │
   │ [Continue]                  │
   └─────────────────────────────┘
   ↓
6. User selects kiosk
   ↓
7. Frontend stores JWT + selected_kiosk in localStorage
   {
     token: "jwt...",
     selected_kiosk: "kiosk-2",
     kiosk_name: "Factory A - Floor 2"
   }
   ↓
8. All API requests include kiosk_id in headers
   Authorization: Bearer jwt...
   X-Kiosk-ID: kiosk-2
   ↓
9. User accesses dashboard (data filtered for kiosk-2)
```

---

## 🛠️ BACKEND IMPLEMENTATION

### Kiosk Context Middleware

```javascript
// backend/src/middleware/kioskContext.js

export function extractKioskContext(req, res, next) {
  // Get kiosk_id from header or default
  const kioskId = req.headers['x-kiosk-id'] || req.query.kiosk_id;

  if (!kioskId) {
    return res.status(400).json({ error: 'Kiosk ID required' });
  }

  // Store in request object
  req.kioskId = kioskId;

  // Optional: Verify user has access to this kiosk
  // const hasAccess = await db.prepare(`
  //   SELECT 1 FROM user_kiosk_assignment
  //   WHERE user_id = ? AND kiosk_id = ?
  // `).get(req.user.userId, kioskId);
  //
  // if (!hasAccess) {
  //   return res.status(403).json({ error: 'Access denied to this kiosk' });
  // }

  next();
}
```

### Kiosk-Aware Queries

```javascript
// Example: GET /api/monolith-projects (kiosk-aware)

router.get('/', requireAuth, extractKioskContext, async (req, res) => {
  const { kioskId } = req;
  const ownerId = req.user.userId;

  // Filter by both owner AND kiosk
  const projects = await db.prepare(`
    SELECT * FROM monolith_projects
    WHERE owner_id = ? AND kiosk_id = ?
    ORDER BY created_at DESC
  `).all(ownerId, kioskId);

  res.json(projects);
});
```

### New Kiosk Management Routes

```javascript
// backend/src/routes/kiosks.js (NEW)

// List kiosks user has access to
GET /api/kiosks
  Query response:
  [
    {
      id: "kiosk-1",
      name: "Factory A - Floor 1",
      location: "Building 3, Room 402",
      status: "active",
      role: "user",
      can_export: true,
      can_import: true
    },
    ...
  ]

// Get kiosk details
GET /api/kiosks/:id
  ├─ Basic info (name, location, status)
  ├─ User count
  ├─ Project count
  ├─ Health status
  └─ Last activity

// (Admin only) Create new kiosk
POST /api/admin/kiosks
  Body: { name, location, type }
  Response: { id, name, ... }

// (Admin only) List all kiosks
GET /api/admin/kiosks

// (Admin only) Assign user to kiosk
POST /api/admin/kiosks/:kioskId/users/:userId
  Body: { role, can_export, can_import, can_delete }

// (Admin only) Get kiosk health
GET /api/admin/kiosks/:id/health
  Response: {
    status: "healthy|degraded|offline",
    cpu_usage: 45.2,
    memory_usage: 78.5,
    disk_usage: 12.3,
    last_check: "2025-11-13T12:30:00Z"
  }

// (Kiosk itself) Heartbeat endpoint
POST /api/kiosks/:id/heartbeat
  Body: { cpu_usage, memory_usage, disk_usage }
  (Called every minute by kiosk)
```

---

## 💻 FRONTEND IMPLEMENTATION

### New Pages & Components

#### KioskSelector Component
```typescript
// frontend/src/components/KioskSelector.tsx

interface Props {
  kiosks: Kiosk[];
  selectedKiosk: Kiosk;
  onSelect: (kiosk: Kiosk) => void;
}

// Displays as:
// [Factory A - Floor 1] [Factory A - Floor 2] [Factory B - All]
//                       ↑ Selected (highlighted)
```

#### Dashboard Update
```typescript
// frontend/src/pages/DashboardPage.tsx (updated)

Shows:
├─ Kiosk Name: "Factory A - Floor 2" (with switcher)
├─ Kiosk Status: "Healthy" (green indicator)
├─ My Projects (for this kiosk only)
├─ Recent Activity (for this kiosk only)
└─ Kiosk Health (CPU, Memory, Disk)
```

#### Admin Dashboard - Kiosks Tab
```typescript
// frontend/src/pages/AdminPanel.tsx (extended)

New Tab: "Kiosks"
├─ Table of all kiosks
│  ├─ Columns: Name, Location, Status, Users, Projects, Last Seen
│  └─ Actions: View, Edit, Health, Users, Deactivate
├─ Health Monitoring
│  ├─ CPU, Memory, Disk usage graphs
│  └─ Offline alerts
└─ User Assignment
   └─ Drag-drop users to kiosks
```

### Updated Routes

```typescript
// frontend/src/App.tsx routing (updated)

<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/select-kiosk" element={<KioskSelector />} />
    <Route path="/" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
  </Routes>
</BrowserRouter>

// Updated ProtectedRoute
<ProtectedRoute>
  // Checks:
  // 1. JWT token valid
  // 2. User has access to selected kiosk
  // 3. Kiosk is active
</ProtectedRoute>
```

---

## 🔌 DEPLOYMENT: DOCKER COMPOSE

### docker-compose.yml (Multi-Kiosk)

```yaml
version: '3.8'

services:
  # Kiosk 1
  kiosk1-backend:
    image: monolit-planner-backend:latest
    container_name: kiosk1-backend
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@localhost:5432/kiosk1
      KIOSK_ID: kiosk-1
    networks:
      - monolit-network

  kiosk1-frontend:
    image: monolit-planner-frontend:latest
    container_name: kiosk1-frontend
    ports:
      - "8001:3000"
    environment:
      VITE_API_URL: http://localhost:3001
      VITE_KIOSK_ID: kiosk-1
    depends_on:
      - kiosk1-backend
    networks:
      - monolit-network

  # Kiosk 2
  kiosk2-backend:
    image: monolit-planner-backend:latest
    container_name: kiosk2-backend
    ports:
      - "3002:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@localhost:5432/kiosk2
      KIOSK_ID: kiosk-2
    networks:
      - monolit-network

  kiosk2-frontend:
    image: monolit-planner-frontend:latest
    container_name: kiosk2-frontend
    ports:
      - "8002:3000"
    environment:
      VITE_API_URL: http://localhost:3002
      VITE_KIOSK_ID: kiosk-2
    depends_on:
      - kiosk2-backend
    networks:
      - monolit-network

  # Load Balancer (Optional)
  nginx:
    image: nginx:alpine
    container_name: monolit-lb
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - kiosk1-frontend
      - kiosk2-frontend
    networks:
      - monolit-network

networks:
  monolit-network:
    driver: bridge
```

### nginx.conf (Load Balancing)

```nginx
upstream kiosk_frontends {
    server kiosk1-frontend:3000;
    server kiosk2-frontend:3000;
    server kiosk3-frontend:3000;
}

upstream kiosk_backends {
    server kiosk1-backend:3001;
    server kiosk2-backend:3001;
    server kiosk3-backend:3001;
}

server {
    listen 80;

    location /api {
        # Route to backend
        proxy_pass http://kiosk_backends;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        # Route to frontend
        proxy_pass http://kiosk_frontends;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🔄 DATA SYNC STRATEGY (Optional)

### Scenario: Syncing Data Between Kiosks

If kiosks need to share some data (e.g., centralized OTSKP codes):

```javascript
// Central Server (optional)
POST /api/sync/pull
  Kiosk A requests latest OTSKP codes

GET /api/sync/push
  Kiosk A sends local projects to central server
  (For backup or aggregation)
```

**Note:** For MVP, keep kiosks completely isolated (KISS principle)

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Design database schema (kiosks, user_kiosk_assignment tables)
- [ ] Add kiosk_id column to relevant tables
- [ ] Create kioskContext middleware
- [ ] Create Kiosks backend routes (/api/kiosks)
- [ ] Update all existing routes to filter by kiosk_id
- [ ] Create KioskSelector frontend component
- [ ] Create /select-kiosk page
- [ ] Update LoginPage to handle multiple kiosks
- [ ] Update AuthContext to store selected_kiosk
- [ ] Create Kiosk management endpoints (admin)
- [ ] Add Kiosks tab to AdminPanel
- [ ] Create heartbeat monitoring
- [ ] Set up Docker Compose for multi-kiosk deployment
- [ ] Test kiosk independence (shutdown one, others work)
- [ ] Test user-kiosk assignment
- [ ] Test data isolation between kiosks

---

## ✅ COMPLETION CRITERIA

### Must Have
- [x] Each kiosk runs independently
- [x] If kiosk A fails, kiosk B/C work
- [x] Users assigned to specific kiosks
- [x] Data isolated by kiosk
- [x] Admin can manage all kiosks from central panel

### Nice to Have
- [ ] Health monitoring dashboard
- [ ] Automatic kiosk registration
- [ ] Data sync between kiosks (with conflicts)
- [ ] Automated failover to backup kiosk
- [ ] Multi-kiosk project sharing

---

## 🚀 NEXT STEPS

1. **After Phase 3 complete:** Start Phase 4
2. **Week 1:** Database schema + backend routes
3. **Week 2:** Frontend kiosk selector + context
4. **Week 3:** Admin management + Docker deployment
5. **Week 4:** Testing + documentation

