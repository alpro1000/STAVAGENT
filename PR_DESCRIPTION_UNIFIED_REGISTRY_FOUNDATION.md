# FEATURE: Unified Registry Foundation (Weeks 1-3)

## 📋 Summary
Implements foundation for cross-kiosk position identity system with file versioning, Monolit integration, and Registry TOV integration. Enables unified project tracking across all STAVAGENT kiosks.

## 🎯 What's Implemented

### Week 1: Database Foundation
- ✅ Migration 010: 8 core tables
  - `registry_projects` - Project registry
  - `registry_objects` - Objects (bridges, buildings, sheets)
  - `registry_source_files` - Source file tracking
  - `registry_file_versions` - Version history (SHA-256 hash)
  - `registry_position_instances` - Position identity system
  - `registry_position_templates` - Template library (future)
  - `registry_apply_logs` - Template application tracking
  - `registry_relink_reports` - File update tracking
- ✅ 7 core API endpoints (CRUD for projects/objects/positions)
- ✅ 7 integration tests
- ✅ Performance indexes

### Week 2: File Upload & Versioning
- ✅ FileVersioningService with SHA-256 hash calculation
- ✅ Automatic version detection (hash comparison)
- ✅ File upload endpoint with multer
- ✅ Batch position import with transactions
- ✅ Idempotent uploads (same hash = same version)

### Week 3: Kiosk Integration
- ✅ MonolitRegistryAdapter - Convert Monolit → Registry
- ✅ RegistryTOVAdapter - Convert Registry TOV → Registry
- ✅ Backward compatible (existing code untouched)
- ✅ Full project import endpoints
- ✅ Position mapping with kiosk-specific data preservation

## 📊 Statistics

- **Files Created:** 10
- **Files Modified:** 3
- **API Endpoints:** 11
- **Database Tables:** 8
- **Tests:** 7
- **Lines of Code:** ~1,100
- **Time:** ~6.5 hours

## 🔗 API Endpoints (11)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/registry/projects` | Create project |
| GET | `/api/v1/registry/projects` | List projects |
| GET | `/api/v1/registry/projects/:id` | Get project |
| POST | `/api/v1/registry/objects` | Create object |
| GET | `/api/v1/registry/projects/:projectId/objects` | List objects |
| POST | `/api/v1/registry/positions` | Create position |
| GET | `/api/v1/registry/objects/:objectId/positions` | List positions |
| POST | `/api/v1/registry/files/upload` | Upload file with versioning |
| POST | `/api/v1/registry/positions/batch` | Batch import positions |
| POST | `/api/v1/registry/monolit/import` | Import Monolit project |
| POST | `/api/v1/registry/registry-tov/import` | Import Registry TOV project |

## 📁 Files Changed

### Added:
- `Monolit-Planner/backend/migrations/010_create_unified_registry.sql` - Database schema
- `Monolit-Planner/backend/src/routes/registry.js` - API routes (11 endpoints)
- `Monolit-Planner/backend/src/services/fileVersioningService.js` - File versioning
- `Monolit-Planner/backend/src/services/monolitRegistryAdapter.js` - Monolit integration
- `Monolit-Planner/backend/src/services/registryTOVAdapter.js` - Registry TOV integration
- `Monolit-Planner/backend/scripts/run-migration-010.js` - Migration runner
- `Monolit-Planner/backend/tests/integration/registry.integration.test.js` - Tests
- `UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md` - 12-week plan
- `docs/UNIFIED_REGISTRY_WEEKS_1-3_SUMMARY.md` - Quick summary
- `docs/WEEK_1_PROGRESS.md` - Week 1 details
- `docs/WEEK_2_PROGRESS.md` - Week 2 details
- `docs/WEEK_3_PROGRESS.md` - Week 3 details

### Modified:
- `Monolit-Planner/backend/server.js` - Mount registry routes
- `README.md` - Update status with Weeks 1-3 completion

## 🧪 Testing

### Run Migration
```bash
cd Monolit-Planner/backend
node scripts/run-migration-010.js
```

### Test API
```bash
# Create project
curl -X POST http://localhost:3001/api/v1/registry/projects \
  -H "Content-Type: application/json" \
  -d '{"project_name": "Test Project"}'

# Import Monolit project
curl -X POST http://localhost:3001/api/v1/registry/monolit/import \
  -H "Content-Type: application/json" \
  -d '{"project_name": "Existing Monolit Project"}'

# Import Registry TOV project
curl -X POST http://localhost:3001/api/v1/registry/registry-tov/import \
  -H "Content-Type: application/json" \
  -d '{"registry_project_id": "reg_abc123"}'
```

### Run Tests
```bash
cd Monolit-Planner/backend
npm run test:integration
```

## 🎯 Key Features

### 1. Position Identity System
- Each position has unique identity across kiosks
- Tracked by `position_code` + `object_id` + `file_version_id`
- Enables cross-kiosk position matching

### 2. File Versioning
- SHA-256 hash-based version detection
- Automatic version increment on file changes
- Idempotent uploads (same file = same version)

### 3. Kiosk Integration
- **Monolit**: Bridges → Objects, Positions → Position Instances
- **Registry TOV**: Sheets → Objects, Items → Position Instances
- **URS Matcher**: Ready for integration (Week 4)

### 4. Backward Compatibility
- ✅ Existing Monolit tables untouched
- ✅ Existing API endpoints unchanged
- ✅ New registry tables separate
- ✅ Adapter pattern for integration

## 📝 Next Steps (Weeks 4-6)

### Week 4: Frontend Integration
- Add Registry tab to Monolit UI
- Show unified position view
- Cross-kiosk navigation

### Week 5: URS Matcher Integration
- Create URSMatcherAdapter
- Import URS positions
- Map URS codes to registry

### Week 6: Testing & Polish
- E2E tests
- Performance optimization
- Documentation

## 🔍 Technical Details

### Database Schema
```sql
-- Core identity: position_code + object_id + file_version_id
CREATE TABLE registry_position_instances (
  id SERIAL PRIMARY KEY,
  object_id INTEGER REFERENCES registry_objects(id),
  position_code TEXT NOT NULL,
  position_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  kiosk_type TEXT NOT NULL, -- 'monolit', 'registry_tov', 'urs'
  kiosk_data JSONB DEFAULT '{}'::jsonb,
  UNIQUE(object_id, position_code, file_version_id)
);
```

### File Versioning Logic
```javascript
Upload file → Calculate SHA-256 hash → Check if exists
  ├─ New file → Create v1
  └─ Existing file → Compare hash
      ├─ Same hash → Return existing version
      └─ Different hash → Create new version (v2, v3, ...)
```

### Adapter Pattern
```javascript
// Monolit
MonolitRegistryAdapter.importFullMonolitProject(projectName)
  → Bridges → Objects
  → Positions → Position Instances (kiosk_type: 'monolit')

// Registry TOV
RegistryTOVAdapter.importRegistryTOVProject(registryProjectId)
  → Sheets → Objects
  → Items → Position Instances (kiosk_type: 'registry_tov')
```

## ✅ Checklist

- [x] Database schema designed and migrated
- [x] Core API endpoints implemented
- [x] File versioning working
- [x] Monolit integration complete
- [x] Registry TOV integration complete
- [x] Integration tests written
- [x] Documentation updated
- [x] Backward compatible
- [x] No breaking changes

## 🔗 Related Issues

Implements: Unified Project Registry (12-week plan)  
See: [UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md](UNIFIED_ARCHITECTURE_IMPLEMENTATION_PLAN.md)

## 👥 Reviewers

@alpro1000

---

**Type:** Feature  
**Priority:** High (Foundation for cross-kiosk system)  
**Impact:** Backend infrastructure  
**Breaking Changes:** None  
**Backward Compatible:** ✅ Yes

**Branch:** `feature/unified-registry-foundation`  
**Commits:** `8068526`, `5687e39`, `PENDING`  
**Status:** ✅ WEEKS 1-3 COMPLETE 🟢
