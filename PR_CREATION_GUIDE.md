# PR Creation Guide - COPY & PASTE

## ✅ Browser Opened
GitHub PR page should be open: https://github.com/alpro1000/STAVAGENT/pull/new/feature/unified-registry-foundation

---

## 📋 COPY THIS TITLE:
```
FEATURE: Unified Registry Foundation (Weeks 1-3)
```

---

## 📋 COPY THIS DESCRIPTION:

```markdown
# FEATURE: Unified Registry Foundation (Weeks 1-3)

## 📋 Summary
Implements foundation for cross-kiosk position identity system with file versioning, Monolit integration, and Registry TOV integration. Enables unified project tracking across all STAVAGENT kiosks.

## 🎯 What's Implemented

### Week 1: Database Foundation
- ✅ Migration 010: 8 core tables
- ✅ 7 core API endpoints (CRUD for projects/objects/positions)
- ✅ 7 integration tests
- ✅ Performance indexes

### Week 2: File Upload & Versioning
- ✅ FileVersioningService with SHA-256 hash calculation
- ✅ Automatic version detection (hash comparison)
- ✅ File upload endpoint with multer
- ✅ Batch position import with transactions

### Week 3: Kiosk Integration
- ✅ MonolitRegistryAdapter - Convert Monolit → Registry
- ✅ RegistryTOVAdapter - Convert Registry TOV → Registry
- ✅ Backward compatible (existing code untouched)
- ✅ Full project import endpoints

## 📊 Statistics
- **Files Created:** 13
- **Files Modified:** 4
- **API Endpoints:** 11
- **Database Tables:** 8
- **Tests:** 7
- **Lines of Code:** ~1,100

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
```

## 🎯 Key Features

### 1. Position Identity System
- Each position has unique identity across kiosks
- Tracked by `position_code` + `object_id` + `file_version_id`

### 2. File Versioning
- SHA-256 hash-based version detection
- Automatic version increment on file changes
- Idempotent uploads (same file = same version)

### 3. Kiosk Integration
- **Monolit**: Bridges → Objects, Positions → Position Instances
- **Registry TOV**: Sheets → Objects, Items → Position Instances

### 4. Backward Compatibility
- ✅ Existing Monolit tables untouched
- ✅ Existing API endpoints unchanged
- ✅ New registry tables separate
- ✅ Adapter pattern for integration

## 📝 Next Steps (Weeks 4-6)
- Week 4: Frontend Integration
- Week 5: URS Matcher Integration
- Week 6: Testing & Polish

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

---

**Type:** Feature  
**Priority:** High  
**Breaking Changes:** None  
**Backward Compatible:** ✅ Yes

**Commits:** 4 (8068526, 5687e39, 627059f, 27a1d3b)  
**Status:** ✅ READY FOR REVIEW 🟢
```

---

## 🏷️ Labels to Add:
- `feature`
- `backend`
- `high-priority`

## 👥 Reviewers:
- @alpro1000

---

## ✅ After Creating PR:
1. Click "Create pull request"
2. Add labels: feature, backend, high-priority
3. Request review from @alpro1000
4. Wait for CI/CD checks to pass
