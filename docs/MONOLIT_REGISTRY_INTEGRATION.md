# Monolit ↔ Registry Integration - Implementation Guide

**Date:** 2026-02-10  
**Status:** Phase 1 Complete (Portal API + Basic Integration)

---

## 📋 Overview

Unified project structure enabling seamless data synchronization between Monolit-Planner and Rozpočet Registry via Portal.

### Key Features:
- ✅ Export from Monolit to Registry with TOV data
- ✅ Automatic mapping: Betonování → Labor (Betonář), Bednění → Labor (Tesař/Bednář)
- ✅ Material extraction: Concrete grade → Materials TOV
- ✅ Portal as single source of truth
- ✅ Auto-sync TOV changes back to Portal

---

## 🏗️ Architecture

```
Monolit-Planner
    ↓ (Export button "→ Registry")
    ↓ POST /api/integration/import-from-monolit
Portal (Unified Storage)
    ├─ portal_objects (SO 202, SO 203, etc.)
    ├─ portal_positions (with TOV data)
    └─ Sync metadata (monolit_id, registry_id)
    ↓ GET /api/integration/for-registry/:id
Rozpočet Registry
    ↓ (User edits TOV)
    ↓ POST /api/integration/sync-tov
Portal (Update)
```

---

## 📁 Files Created/Modified

### Portal Backend

**New Files:**
```
stavagent-portal/backend/src/
├── db/migrations/add-unified-project-structure.sql  (NEW)
└── routes/integration.js                            (NEW)
```

**Modified Files:**
```
stavagent-portal/backend/server.js
  + import integrationRoutes
  + app.use('/api/integration', integrationRoutes)
```

### Monolit-Planner Frontend

**Modified Files:**
```
Monolit-Planner/frontend/src/components/Header.tsx
  - handleExportToRegistry() - Updated to use Portal API
  + mapPositionToLabor() - Helper function
  + mapPositionToMaterials() - Helper function
```

### Rozpočet Registry

**New Files:**
```
rozpocet-registry/src/services/portalSync.ts  (NEW)
```

**Modified Files:**
```
rozpocet-registry/src/App.tsx
  + loadFromPortal() - Load project from Portal
  + URL param: ?portal_project=<id>
```

---

## 🔌 API Endpoints

### Portal Integration API

#### 1. Import from Monolit
```http
POST /api/integration/import-from-monolit
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "portal_project_id": "proj_xxx" (optional),
  "project_name": "Most SO 202",
  "monolit_project_id": "bridge_xxx",
  "objects": [
    {
      "code": "SO 202",
      "name": "Objekt SO 202",
      "positions": [
        {
          "monolit_id": "pos_xxx",
          "kod": "231112",
          "popis": "Betonování",
          "mnozstvi": 100,
          "mj": "m³",
          "tov": {
            "labor": [
              {
                "id": "labor_1",
                "name": "Betonář",
                "count": 4,
                "hours": 10,
                "normHours": 40,
                "hourlyRate": 398,
                "totalCost": 15920
              }
            ],
            "machinery": [],
            "materials": [
              {
                "id": "material_1",
                "name": "Beton C30/37",
                "quantity": 100,
                "unit": "m³",
                "unitPrice": 0,
                "totalCost": 0
              }
            ]
          }
        }
      ]
    }
  ]
}

Response:
{
  "success": true,
  "portal_project_id": "proj_xxx",
  "objects_imported": 1
}
```

#### 2. Get for Registry
```http
GET /api/integration/for-registry/:portal_project_id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "project": {
    "id": "proj_xxx",
    "name": "Most SO 202",
    "sheets": [
      {
        "name": "SO 202",
        "items": [
          {
            "id": "pos_xxx",
            "kod": "231112",
            "popis": "Betonování",
            "mnozstvi": 100,
            "mj": "m³",
            "cenaJednotkova": 0,
            "cenaCelkem": 0,
            "tovData": {
              "labor": [...],
              "machinery": [],
              "materials": [...]
            },
            "source": {
              "project": "Most SO 202",
              "sheet": "SO 202",
              "row": 0
            }
          }
        ]
      }
    ]
  }
}
```

#### 3. Sync TOV
```http
POST /api/integration/sync-tov
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "portal_project_id": "proj_xxx",
  "updates": [
    {
      "position_id": "pos_xxx",
      "tovData": {
        "labor": [...],
        "machinery": [...],
        "materials": [...]
      }
    }
  ]
}

Response:
{
  "success": true,
  "positions_updated": 1
}
```

---

## 🔄 Data Flow

### 1. Export from Monolit

```javascript
// User clicks "→ Registry" button in Monolit
// Header.tsx: handleExportToRegistry()

1. Fetch Monolit project data
   GET /api/monolith-projects/:id

2. Map to Portal format
   - Betonování → Labor (Betonář)
   - Bednění → Labor (Tesař / Bednář)
   - Výztuž → Labor (Železář)
   - Beton C30/37 → Materials

3. Import to Portal
   POST /api/integration/import-from-monolit

4. Open Registry
   window.open(`${REGISTRY_URL}?portal_project=${portal_project_id}`)
```

### 2. Load in Registry

```javascript
// Registry App.tsx: loadFromPortal()

1. Detect URL param: ?portal_project=<id>

2. Fetch from Portal
   GET /api/integration/for-registry/:id

3. Convert to Registry format
   - Create project with sheets
   - Items already have TOV data

4. Display in Registry
   - User can edit TOV
   - User can edit prices
```

### 3. Sync TOV Back

```javascript
// Registry: Auto-sync (debounced 2s)

1. User edits TOV in Registry

2. Collect updates
   getTOVUpdates() → Array<{ position_id, tovData }>

3. Sync to Portal
   POST /api/integration/sync-tov

4. Portal updates positions
   - last_sync_from = 'registry'
   - last_sync_at = NOW()
```

---

## 🗄️ Database Schema

### portal_objects
```sql
CREATE TABLE portal_objects (
  object_id VARCHAR(255) PRIMARY KEY,
  portal_project_id VARCHAR(255) NOT NULL,
  object_code VARCHAR(50) NOT NULL,        -- "SO 202"
  object_name VARCHAR(255) NOT NULL,
  object_type VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(portal_project_id, object_code)
);
```

### portal_positions
```sql
CREATE TABLE portal_positions (
  position_id VARCHAR(255) PRIMARY KEY,
  object_id VARCHAR(255) NOT NULL,
  kod VARCHAR(50) NOT NULL,
  popis TEXT NOT NULL,
  mnozstvi REAL NOT NULL DEFAULT 0,
  mj VARCHAR(20),
  cena_jednotkova REAL,
  cena_celkem REAL,
  
  -- TOV data (JSON)
  tov_labor TEXT,
  tov_machinery TEXT,
  tov_materials TEXT,
  
  -- Sync metadata
  monolit_position_id VARCHAR(255),
  registry_item_id VARCHAR(255),
  last_sync_from VARCHAR(20),
  last_sync_at TIMESTAMP,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🧪 Testing

### Manual Test Flow

1. **Create project in Monolit:**
   ```
   - Open Monolit-Planner
   - Create new project "Test SO 202"
   - Add positions: Betonování, Bednění
   - Fill in: crew_size, hours, wage, concrete_m3
   ```

2. **Export to Registry:**
   ```
   - Click "→ Registry" button
   - Select "Vytvořit nový projekt"
   - Click "Exportovat"
   - Verify: Registry opens with project
   ```

3. **Verify in Registry:**
   ```
   - Check: Project name matches
   - Check: Sheets = object codes (SO 202)
   - Check: Positions have TOV data
   - Check: Labor tab shows Betonář, Tesař
   - Check: Materials tab shows Beton C30/37
   ```

4. **Edit TOV in Registry:**
   ```
   - Open TOV modal for position
   - Edit labor hours or add material
   - Click "Uložit TOV"
   - Verify: Auto-sync to Portal (check console)
   ```

5. **Verify in Portal DB:**
   ```sql
   SELECT * FROM portal_positions 
   WHERE monolit_position_id = '<pos_id>';
   
   -- Check: tov_labor, tov_materials updated
   -- Check: last_sync_from = 'registry'
   ```

---

## 🚀 Deployment

### 1. Run Migration
```bash
cd stavagent-portal/backend

# PostgreSQL (Production)
psql $DATABASE_URL < src/db/migrations/add-unified-project-structure.sql

# SQLite (Dev)
sqlite3 data/portal.db < src/db/migrations/add-unified-project-structure.sql
```

### 2. Deploy Portal Backend
```bash
# Render will auto-deploy on push
git add .
git commit -m "FEAT: Add Monolit-Registry integration via Portal API"
git push origin main
```

### 3. Deploy Monolit Frontend
```bash
cd Monolit-Planner/frontend
npm run build
# Render auto-deploys
```

### 4. Deploy Registry
```bash
cd rozpocet-registry
npm run build
# Vercel auto-deploys
```

---

## 📝 Environment Variables

### Portal Backend
```env
# Already configured
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://www.stavagent.cz
```

### Monolit Frontend
```env
VITE_PORTAL_API_URL=https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app
VITE_REGISTRY_URL=https://stavagent-backend-ktwx.vercel.app
```

### Registry
```env
VITE_PORTAL_API_URL=https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app
```

---

## ✅ Phase 2 Progress (2026-03-01)

### Implemented:

1. **Auto-polling from Registry** ✅
   - `monolithPolling.ts`: 30s polling (active tab) / 120s (background tab)
   - Uses `portalMonolithFetch.ts` → Portal GET `/api/integration/for-registry/:id`
   - Visibility change handler for tab switching
   - Silent fail (best-effort polling)

2. **Comparison / Conflict Detection** ✅
   - `MonolitCompareDrawer.tsx`: Side-by-side price comparison drawer
   - Severity classification: match (<5%), info (5-15%), warning (15-30%), conflict (≥30%)
   - Grouped display: conflicts first → warnings → info → matches
   - "Přijmout cenu" (Accept price) button per item

3. **Conflict Indicators in ItemsTable** ✅
   - HardHat icon colored by severity (green/blue/amber/red)
   - Conflict items pulse with `animate-pulse`
   - Compare button in header with red conflict count badge

4. **Portal Kiosk Links UI** ✅
   - `KioskLinksPanel.tsx`: Shows all linked kiosks per project
   - Kiosk type icons + status badges
   - Open/Unlink actions
   - Integrated into CorePanel

### Remaining (Phase 2):

1. **Bi-directional sync** — Monolit → Registry accept price needs write-back to Portal
2. **Bulk accept** — Accept all Monolit prices at once
3. **Notification badges** — Portal showing kiosk conflict counts
4. **Deep links** — URL params for cross-kiosk navigation to specific position

---

## 🐛 Known Issues

1. **Authentication:** Portal requires JWT token (currently using `credentials: 'include'`)
2. **CORS:** Need to whitelist Registry domain in Portal
3. **Error handling:** Basic error messages, need better UX
4. **Loading states:** No loading indicators during export

---

## 📚 Related Documentation

- [CLAUDE.md](../CLAUDE.md) - System overview
- [NEXT_SESSION.md](../NEXT_SESSION.md) - Current session status
- [Portal API Routes](../stavagent-portal/backend/src/routes/integration.js)
- [Monolit Header](../Monolit-Planner/frontend/src/components/Header.tsx)
- [Registry App](../rozpocet-registry/src/App.tsx)

---

**Version:** 2.0.0
**Last Updated:** 2026-03-01
**Author:** Claude AI Assistant
