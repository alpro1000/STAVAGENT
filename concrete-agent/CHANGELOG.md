# Changelog

## v2.4.2 - 2025-11-21

**Critical Production Fixes**

- 🔧 **Fixed Event Loop Blocking** - Changed WorkflowA background execution from `BackgroundTasks.add_task()` to `asyncio.create_task()` for proper async handling. Prevents UI freezing on file uploads.
- ⏱️ **Increased Upload Timeout** - Extended axios timeout from 30s to 300s (5 minutes) to accommodate large Excel files (50MB+) and complex parsing operations.
- 📚 **Documentation Cleanup** - Removed 30+ obsolete files (AUDIT_STEP*, IMPLEMENTATION_*, DAY5_*, PHASE1_*, WEEK2_* reports). Consolidated duplicate files (DEPLOYMENT_*, FRONTEND_*, QUICKSTART.md).

**Files Changed:**
- `packages/core-backend/app/api/routes.py`: Added asyncio import, fixed background task execution
- `packages/core-frontend/src/utils/api.js`: Updated timeout configuration
- Root directory: Removed 10 duplicate .md files

**Testing:**
- ✅ Large file uploads no longer hang
- ✅ UI remains responsive during processing
- ✅ Background tasks execute properly in event loop

---

## v2.4.1 - 2025-11-20

**CORE Integration Complete**

- ✅ Endpoint `/api/upload` fully functional with Monolit-Planner fallback chain
- ✅ Smart Excel parser with automatic header detection (20+ column variants)
- ✅ Full API documentation in CORE_INTEGRATION.md with examples
- ✅ Production deployment to Render.com

---

## v2.4.0 - 2025-11-18

**Phase 4 Week 1 Complete**

- Backend Infrastructure: PostgreSQL + Alembic migrations (10 tables, 30+ indexes)
- Cache Layer: Redis integration (sessions, caching, KB cache)
- Queue System: Celery + Redis broker (5 task modules, Beat scheduler)
- Monorepo Refactoring: Transformed to @stavagent/core-* scoped packages
- Type System: Centralized @stavagent/core-shared for TypeScript types

**Major Components:**
- SQLAlchemy 2.0 ORM models with async support
- RedisClient with connection pooling and JSON serialization
- SessionManager for user session tracking
- CacheManager with specialized KnowledgeBaseCache
- Celery task modules: PDF parsing, enrichment, audit, maintenance
- TaskMonitor service for Celery integration

---

## v1.5.0-M1 - 2025-10-19

**Excel Processing & Audit Foundation**

- Added EU locale number normalisation with support for thin and non-breaking space thousand separators across Excel parsing and validation.
- Unified the `audit_results` contract (`totals`, `items`, `preview`, `meta`) for Workflow A caching, API responses and XLSX export.
- Refreshed the Excel exporter to emit populated `Audit_Triage` and `Positions` sheets based on the new contract schema.
