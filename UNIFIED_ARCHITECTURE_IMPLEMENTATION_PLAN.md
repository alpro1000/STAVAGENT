# UNIFIED ARCHITECTURE - Implementation Plan

**Version:** 1.0.0  
**Created:** 2025-03-02  
**Timeline:** 2-3 months (8-12 weeks)  
**Approach:** Full implementation with backward compatibility

---

## 📋 Executive Summary

**Goal:** Create unified Project Registry with position identity, templates, and relink mechanism.

**Key Decisions:**
- ✅ **Scope:** All kiosks (Monolit, Registry, DOV) migrate simultaneously
- ✅ **Priority:** Relink (сохранение при обновлении) > Templates (переиспользование)
- ✅ **Database:** Extend existing Monolit Planner database (SQLite/PostgreSQL)
- ✅ **Compatibility:** Existing code continues working, new layer added on top
- ✅ **Timeline:** 8-12 weeks full-time development

---

## 🎯 Success Criteria

### Must Have (MVP):
1. ✅ Single source of truth for all positions (position_instances table)
2. ✅ Relink algorithm preserves calculations when file updated
3. ✅ All kiosks read/write via position_instance_id
4. ✅ Backward compatibility - old code still works

### Should Have:
1. ✅ Template system for reusing calculations
2. ✅ Confidence scoring (GREEN/AMBER/RED)
3. ✅ Audit trail (who applied what, when)

### Nice to Have:
1. ⏳ Multi-tenant RLS (PostgreSQL only)
2. ⏳ Activity-Role mapping UI
3. ⏳ Advanced fuzzy matching

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ UNIFIED PROJECT REGISTRY (New Layer)                            │
│                                                                  │
│ Tables:                                                          │
│ - projects (project_id UUID)                                    │
│ - objects (object_id UUID, maps to Excel sheets)                │
│ - source_files (file_id UUID, uploaded XLSX)                    │
│ - file_versions (version tracking)                              │
│ - position_instances (THE CORE - every row = UUID)              │
│ - position_templates (reusable calculations)                    │
│ - apply_logs (audit trail)                                      │
│ - relink_reports (file update history)                          │
└─────────────────────────────────────────────────────────────────┘
                          ▲
                          │ Unified API (/api/v1/registry/...)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
   │ Monolit │      │ Registry│      │   DOV   │
   │ (old DB)│      │   TOV   │      │  Kiosk  │
   │ bridges │      │  items  │      │         │
   └─────────┘      └─────────┘      └─────────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
         Gradually migrate to position_instances
```

---

## 🗓️ Implementation Phases

### **Phase 1: Foundation** (Weeks 1-3)

**Goal:** Create database schema + basic API

#### Week 1: Database Schema
- [ ] Create migration: `001_create_unified_registry.sql`
- [ ] Tables: projects, objects, source_files, file_versions
- [ ] Table: position_instances (THE CORE)
- [ ] Indexes for performance
- [ ] Seed data for testing

**Deliverables:**
```sql
-- position_instances table (simplified)
CREATE TABLE position_instances (
  position_instance_id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  object_id UUID NOT NULL,
  sheet_name VARCHAR(255) NOT NULL,
  row_index INTEGER NOT NULL,
  catalog_code VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  qty NUMERIC(15,4) NOT NULL,
  
  -- Payloads (JSONB for flexibility)
  monolith_payload JSONB,
  dov_payload JSONB,
  
  -- Template link
  template_id UUID,
  template_confidence VARCHAR(10), -- GREEN/AMBER/RED
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Week 2: Core API Endpoints
- [ ] POST /api/v1/registry/projects (create project)
- [ ] GET /api/v1/registry/projects (list projects)
- [ ] POST /api/v1/registry/projects/{id}/files (upload XLSX)
- [ ] POST /api/v1/registry/file-versions/{id}/parse (parse → position_instances)
- [ ] GET /api/v1/registry/projects/{id}/positions (list positions with filters)

**Deliverables:**
- `registry-api/` folder with Express.js routes
- Parser integration (reuse existing Monolit parser)
- Unit tests for API endpoints

#### Week 3: Parser Integration
- [ ] Refactor Monolit parser to output position_instances
- [ ] Add position_instance_id generation (UUID v4)
- [ ] Map Excel rows → position_instances
- [ ] Handle multiple sheets → multiple objects
- [ ] Classification (work_category) via regex

**Deliverables:**
- `parseXLSXToPositionInstances()` function
- Integration tests with sample XLSX files

---

### **Phase 2: Kiosk Integration** (Weeks 4-6)

**Goal:** Monolit Planner reads/writes via position_instances

#### Week 4: Monolit Read Integration
- [ ] Add `position_instance_id` column to existing `positions` table
- [ ] Migration: backfill position_instance_id for existing data
- [ ] Update Monolit API to accept position_instance_id
- [ ] Dual-mode: support both bridge_id (old) and position_instance_id (new)

**Deliverables:**
```typescript
// Old way (still works)
GET /api/positions?bridge_id=SO201

// New way (preferred)
GET /api/positions?position_instance_id=550e8400-...
```

#### Week 5: Monolit Write Integration
- [ ] POST /api/v1/registry/positions/{id}/monolith-calc
- [ ] Write monolith_payload to position_instances.monolith_payload
- [ ] Sync back to old positions table (for backward compatibility)
- [ ] Update Monolit UI to use position_instance_id in URLs

**Deliverables:**
- Monolit can save calculations to unified registry
- Old Monolit code still works (reads from positions table)
- New code uses position_instances

#### Week 6: Registry TOV Integration
- [ ] Add position_instance_id to registry_items table
- [ ] Update import flow to create position_instances first
- [ ] Registry reads monolith_payload from position_instances
- [ ] Display Monolit calculations in Registry UI

**Deliverables:**
- Registry shows Monolit calculations without manual transfer
- Deep links: Registry → Monolit via position_instance_id

---

### **Phase 3: Relink Algorithm** (Weeks 7-9)

**Goal:** Preserve calculations when file updated

#### Week 7: FileVersion System
- [ ] file_versions table with version tracking
- [ ] Upload new version → create new file_version record
- [ ] Keep old file_versions for history
- [ ] UI: "Upload new version" button

**Deliverables:**
```typescript
POST /api/v1/registry/projects/{id}/files
Body: { file: File, is_update: true, previous_version_id: UUID }

Response: {
  file_version_id: UUID,
  version_no: 2,
  relink_required: true
}
```

#### Week 8: Relink Algorithm Implementation
- [ ] Step 1: Primary match (sheet_name + position_no + catalog_code)
- [ ] Step 2: Fallback match (sheet_index + row_index + catalog_code)
- [ ] Step 3: Fuzzy match (description similarity > 0.75)
- [ ] Step 4: Classify remainder (new/orphaned)
- [ ] Generate relink_report

**Deliverables:**
```typescript
POST /api/v1/registry/file-versions/{id}/relink
Body: { old_version_id: UUID }

Response: {
  summary: {
    total_old: 150,
    total_new: 155,
    matched_exact: 140,
    matched_fallback: 5,
    new_positions: 10,
    orphaned_positions: 5
  },
  details: [...]
}
```

#### Week 9: Relink UI + Conflict Resolution
- [ ] Relink report modal in UI
- [ ] Show matched/new/orphaned positions
- [ ] Manual relink for AMBER/RED matches
- [ ] Flag stale payloads (qty changed >20%)
- [ ] Approve/reject relink

**Deliverables:**
- User-friendly relink workflow
- Confidence indicators (🟢 GREEN, 🟡 AMBER, 🔴 RED)
- Manual override for edge cases

---

### **Phase 4: Template System** (Weeks 10-11)

**Goal:** Reuse calculations across positions

#### Week 10: Template CRUD
- [ ] position_templates table
- [ ] POST /api/v1/registry/templates (create from position)
- [ ] GET /api/v1/registry/templates (list templates)
- [ ] GET /api/v1/registry/templates/{id}/matches (find matching positions)
- [ ] Template matching engine (trigram similarity)

**Deliverables:**
```typescript
// Create template from a good calculation
POST /api/v1/registry/templates
Body: {
  source_position_id: UUID,
  source_payload: "monolith", // or "dov" or "both"
}

Response: {
  template_id: UUID,
  template_key: "hash_of_code_unit_desc",
  usage_count: 0
}
```

#### Week 11: Template Apply + Scaling
- [ ] POST /api/v1/registry/templates/{id}/apply (batch apply)
- [ ] Scaling rules: linear (materials), fixed (mobilization), manual (crane)
- [ ] Apply log (audit trail)
- [ ] UI: "Apply template to 50 positions" button

**Deliverables:**
```typescript
POST /api/v1/registry/templates/{id}/apply
Body: {
  position_instance_ids: [UUID, UUID, ...],
  scale_by_qty: true,
  overrides: { /* optional */ }
}

Response: {
  applied: 48,
  skipped: 2,
  details: [...]
}
```

---

### **Phase 5: Polish + Production** (Week 12)

**Goal:** Production-ready system

#### Week 12: Final Integration
- [ ] DOV kiosk integration (if exists)
- [ ] Activity-Role mapping table + seed data
- [ ] Performance optimization (indexes, caching)
- [ ] Security audit (SQL injection, XSS)
- [ ] Documentation (API docs, user guide)
- [ ] Deployment scripts
- [ ] Monitoring + logging

**Deliverables:**
- Production deployment
- User training materials
- API documentation (Swagger/OpenAPI)
- Performance benchmarks

---

## 🗄️ Database Schema (Simplified)

### Core Tables

```sql
-- 1. Projects (top level)
CREATE TABLE projects (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  client VARCHAR(255),
  location VARCHAR(255),
  status VARCHAR(20) DEFAULT 'draft', -- draft/active/archived
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Objects (Excel sheets)
CREATE TABLE objects (
  object_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- "Most 101"
  sheet_name VARCHAR(255) NOT NULL, -- Original Excel sheet name
  sheet_index INTEGER NOT NULL,
  object_type VARCHAR(100), -- bridge/wall/culvert
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Source Files
CREATE TABLE source_files (
  file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  content_hash VARCHAR(64) NOT NULL, -- SHA-256 for dedup
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. File Versions
CREATE TABLE file_versions (
  file_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES source_files(file_id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL DEFAULT 1,
  content_hash VARCHAR(64) NOT NULL,
  position_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Position Instances (THE CORE)
CREATE TABLE position_instances (
  position_instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
  object_id UUID REFERENCES objects(object_id) ON DELETE CASCADE,
  file_version_id UUID REFERENCES file_versions(file_version_id),
  
  -- Identity
  sheet_name VARCHAR(255) NOT NULL,
  sheet_index INTEGER NOT NULL,
  position_no VARCHAR(50), -- Position number if present
  row_index INTEGER NOT NULL, -- Excel row (fallback anchor)
  
  -- Data
  catalog_code VARCHAR(100) NOT NULL, -- URS/OTSKP code
  description TEXT NOT NULL,
  description_normalized TEXT, -- Cleaned for matching
  unit VARCHAR(20) NOT NULL, -- m3, m2, t, ks
  qty NUMERIC(15,4) NOT NULL,
  unit_price NUMERIC(15,2),
  total_price NUMERIC(18,2),
  work_category VARCHAR(50), -- beton/bedneni/vystuz/...
  
  -- Payloads (JSONB for flexibility)
  monolith_payload JSONB, -- Monolit Planner results
  dov_payload JSONB, -- DOV breakdown
  
  -- Template
  template_id UUID REFERENCES position_templates(template_id),
  template_confidence VARCHAR(10), -- GREEN/AMBER/RED
  overrides JSONB DEFAULT '{}', -- Local deviations from template
  
  -- Status
  status VARCHAR(20) DEFAULT 'parsed', -- parsed/classified/calculated/reviewed
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Position Templates
CREATE TABLE position_templates (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(500) UNIQUE NOT NULL, -- hash(code+unit+desc_norm)
  
  -- Identity
  catalog_code VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  description_normalized TEXT NOT NULL,
  work_category VARCHAR(50) NOT NULL,
  
  -- Payloads
  monolith_template JSONB,
  dov_template JSONB,
  scaling_rules JSONB, -- Per-resource scaling behavior
  
  -- Metadata
  created_by UUID,
  usage_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Apply Logs (Audit Trail)
CREATE TABLE apply_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES position_templates(template_id),
  position_instance_id UUID REFERENCES position_instances(position_instance_id),
  applied_by UUID,
  confidence VARCHAR(10) NOT NULL, -- GREEN/AMBER/RED
  overrides_applied JSONB,
  previous_payload JSONB, -- Snapshot for rollback
  source_kiosk VARCHAR(50), -- monolit/registry/dov
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Relink Reports
CREATE TABLE relink_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(project_id),
  old_file_version UUID REFERENCES file_versions(file_version_id),
  new_file_version UUID REFERENCES file_versions(file_version_id),
  summary JSONB NOT NULL, -- { total_old, total_new, matched_exact, ... }
  details JSONB NOT NULL, -- Array of match details
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes (Performance)

```sql
-- Position Instances
CREATE INDEX idx_positions_project_object ON position_instances(project_id, object_id);
CREATE INDEX idx_positions_project_code ON position_instances(project_id, catalog_code);
CREATE INDEX idx_positions_template ON position_instances(template_id);

-- Relink primary match
CREATE INDEX idx_positions_relink_primary 
  ON position_instances(project_id, sheet_name, position_no, catalog_code);

-- Relink fallback match
CREATE INDEX idx_positions_relink_fallback 
  ON position_instances(project_id, sheet_index, row_index, catalog_code);

-- Templates
CREATE INDEX idx_templates_key ON position_templates(template_key);
CREATE INDEX idx_templates_code_unit ON position_templates(catalog_code, unit);

-- Apply Logs
CREATE INDEX idx_apply_logs_position ON apply_logs(position_instance_id);
CREATE INDEX idx_apply_logs_template ON apply_logs(template_id);
```

---

## 🔌 API Endpoints (Summary)

### Projects
- `POST /api/v1/registry/projects` - Create project
- `GET /api/v1/registry/projects` - List projects
- `GET /api/v1/registry/projects/{id}` - Get project details

### Files
- `POST /api/v1/registry/projects/{id}/files` - Upload XLSX
- `POST /api/v1/registry/file-versions/{id}/parse` - Parse to position_instances
- `POST /api/v1/registry/file-versions/{id}/relink` - Relink after update

### Positions
- `GET /api/v1/registry/projects/{id}/positions` - List positions (with filters)
- `GET /api/v1/registry/positions/{id}` - Get single position
- `POST /api/v1/registry/positions/{id}/monolith-calc` - Write Monolit results
- `GET /api/v1/registry/positions/{id}/monolith-calc` - Read Monolit results
- `POST /api/v1/registry/positions/{id}/dov` - Write DOV results
- `GET /api/v1/registry/positions/{id}/dov` - Read DOV results

### Templates
- `POST /api/v1/registry/templates` - Create template
- `GET /api/v1/registry/templates` - List templates
- `GET /api/v1/registry/templates/{id}/matches` - Find matching positions
- `POST /api/v1/registry/templates/{id}/apply` - Apply to positions (batch)

---

## 🧪 Testing Strategy

### Unit Tests
- Parser: XLSX → position_instances
- Relink algorithm: all 4 steps
- Template matching: confidence scoring
- Scaling rules: linear/fixed/manual

### Integration Tests
- Full workflow: Upload → Parse → Calculate → Relink
- Kiosk integration: Monolit ↔ Registry
- Template workflow: Create → Match → Apply

### Performance Tests
- 1000 positions: parse time < 5s
- Relink 500 positions: < 10s
- Template match 1000 positions: < 3s

---

## 📦 Deliverables

### Code
- [ ] Database migrations (8 tables)
- [ ] Registry API (20+ endpoints)
- [ ] Parser integration
- [ ] Relink algorithm
- [ ] Template system
- [ ] Kiosk adapters (Monolit, Registry, DOV)

### Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] User guide (with screenshots)
- [ ] Developer guide (architecture, patterns)
- [ ] Migration guide (old → new)

### Testing
- [ ] 100+ unit tests
- [ ] 50+ integration tests
- [ ] Performance benchmarks

---

## ⚠️ Risks & Mitigation

### Risk 1: Data Migration Complexity
**Impact:** High  
**Probability:** Medium  
**Mitigation:**
- Dual-mode operation (old + new)
- Gradual migration, not big bang
- Rollback plan

### Risk 2: Performance Degradation
**Impact:** Medium  
**Probability:** Low  
**Mitigation:**
- Proper indexes
- JSONB for flexible payloads
- Caching layer (Redis)

### Risk 3: Breaking Changes
**Impact:** High  
**Probability:** Low  
**Mitigation:**
- Backward compatibility layer
- Old endpoints still work
- Feature flags for gradual rollout

---

## 💰 Resource Requirements

### Development Team
- 1 Senior Backend Developer (full-time, 12 weeks)
- 1 Frontend Developer (part-time, 6 weeks)
- 1 QA Engineer (part-time, 4 weeks)

### Infrastructure
- PostgreSQL database (upgrade from SQLite if needed)
- Redis for caching (optional)
- Monitoring (Sentry, Datadog)

### Timeline
- **Optimistic:** 8 weeks (if no blockers)
- **Realistic:** 10 weeks (with minor issues)
- **Pessimistic:** 12 weeks (with major refactoring)

---

## 🎯 Success Metrics

### Technical
- [ ] 100% backward compatibility
- [ ] <5s parse time for 1000 positions
- [ ] <10s relink time for 500 positions
- [ ] 95%+ test coverage

### Business
- [ ] Smetčik saves 50% time on file updates (relink)
- [ ] 80% of calculations reused via templates
- [ ] Zero data loss during migration
- [ ] User satisfaction >4/5

---

## 📅 Next Steps

### Immediate (This Week)
1. ✅ Review this plan with team
2. ✅ Approve timeline and resources
3. ✅ Create GitHub project board
4. ✅ Set up development environment

### Week 1 (Start Implementation)
1. Create feature branch: `feature/unified-architecture`
2. Write first migration: `001_create_unified_registry.sql`
3. Set up API structure: `registry-api/` folder
4. Write first endpoint: `POST /api/v1/registry/projects`

---

**Questions? Contact:** @alpro1000  
**Document Version:** 1.0.0  
**Last Updated:** 2025-03-02
