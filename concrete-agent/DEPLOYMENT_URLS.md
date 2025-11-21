# Deployment URLs - Concrete Agent

**Created:** 2025-11-06
**Last Updated:** 2025-11-16
**Status:** Production Deployment on Render.com + Phase 4 Infrastructure Ready ✅

---

## 🌐 PRODUCTION URLS

### Backend (API)
- **URL:** https://concrete-agent.onrender.com
- **Platform:** Render.com
- **Tech Stack:** FastAPI (Python 3.10+)
- **Database:** File-based (✅ Ready for PostgreSQL migration)
- **Cache:** ✅ Redis integration complete (ready for Render deployment)
- **Queue:** ✅ Celery system complete (ready for Render deployment)

**API Endpoints:**
- Health: https://concrete-agent.onrender.com/health
- Docs: https://concrete-agent.onrender.com/docs
- API v1: https://concrete-agent.onrender.com/api/v1/

### Frontend (Web App)
- **URL:** https://stav-agent.onrender.com
- **Platform:** Render.com
- **Tech Stack:** Next.js 14 + React
- **UI Library:** Tailwind CSS v4 + Shadcn/ui

---

## 📊 PHASE 4 INFRASTRUCTURE STATUS (Nov 16)

### ✅ COMPLETED (READY FOR DEPLOYMENT)

| Component | Status | Details | Deployment Timeline |
|-----------|--------|---------|-------------------|
| **PostgreSQL Schema** | ✅ Complete | 10 tables, 30+ indexes, Alembic migrations | Week 2 Day 1 |
| **SQLAlchemy Models** | ✅ Complete | 10 ORM models with relationships | Week 2 Day 1 |
| **Redis Integration** | ✅ Complete | CacheManager, SessionManager, KB cache | Week 2 Day 2 |
| **Celery System** | ✅ Complete | 5 task modules, Beat scheduler | Week 2 Day 3 |
| **Docker Setup** | ✅ Complete | Dockerfile, docker-compose.yml | Local/Week 2 |
| **Monolit Integration** | ✅ Complete | Adapter + TypeScript client + 4 guides | Week 2 Day 4 |

---

## 🔧 DEPLOYMENT CONFIGURATION

### Current Backend (File-based, Nov 16)

```yaml
# render.yaml (backend)
name: concrete-agent
type: web
env: python
buildCommand: pip install -r requirements.txt
startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**Environment Variables Required:**
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
ENVIRONMENT=production
```

### Phase 4 Week 2 Configuration (With PostgreSQL, Redis, Celery)

**Updated render.yaml:**
```yaml
# render.yaml (updated for Phase 4 Week 2)
name: concrete-agent
type: web
env: python
buildCommand: pip install -r requirements.txt && alembic upgrade head
startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT

# Environment variables from Render services:
envVars:
  - DATABASE_URL=postgresql://user:pass@host/concrete_agent_prod
  - REDIS_URL=redis://user:pass@host:6379/0
  - CELERY_BROKER_URL=redis://user:pass@host:6379/1
  - CELERY_RESULT_BACKEND=redis://user:pass@host:6379/2
  - ENVIRONMENT=production
  - LOG_LEVEL=INFO
```

### Frontend Configuration

```yaml
# render.yaml (frontend)
name: stav-agent
type: web
env: node
buildCommand: npm install && npm run build
startCommand: npm start

envVars:
  - NEXT_PUBLIC_API_URL=https://concrete-agent.onrender.com
  - NEXT_PUBLIC_ENV=production
```

---

## 📋 WEEK 2 DEPLOYMENT PLAN (Nov 17-21)

### Day 1 (Nov 17): PostgreSQL Migration

**Steps:**
1. Create Render PostgreSQL 16 instance
2. Note connection string
3. Update Render environment: `DATABASE_URL=postgresql://...`
4. Deploy backend (auto-runs Alembic migrations)
5. Verify all 10 tables created

**Verification:**
```bash
curl https://concrete-agent.onrender.com/health
# Expected: {"status": "healthy", "database": "connected"}

# Check tables via Render PostgreSQL dashboard
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
# Expected: 10
```

### Day 2 (Nov 18): Redis Deployment

**Steps:**
1. Create Upstash Redis instance (free tier available)
2. Get connection string
3. Update Render environment variables:
   - `REDIS_URL=redis://...`
   - `CELERY_BROKER_URL=redis://...` (same, db=1)
   - `CELERY_RESULT_BACKEND=redis://...` (same, db=2)
4. Restart backend service
5. Test cache operations

**Verification:**
```bash
curl https://concrete-agent.onrender.com/api/health
# Expected: {"redis": "connected", "cache": "operational"}
```

### Day 3 (Nov 19): Celery Deployment

**Create Celery Worker Service:**
```bash
# Add to render.yaml or create separate service
buildCommand: pip install -r requirements.txt
startCommand: celery -A app.core.celery_app worker --loglevel=info
```

**Create Celery Beat Service:**
```bash
# Add to render.yaml or create separate service
buildCommand: pip install -r requirements.txt
startCommand: celery -A app.core.celery_app beat --loglevel=info
```

**Verification:**
```bash
# Check active tasks
celery -A app.core.celery_app inspect active

# Check scheduled tasks
celery -A app.core.celery_app inspect scheduled
```

### Day 4 (Nov 20): Monolit-Planner Integration

**Test API Adapter:**
```bash
curl -X POST https://concrete-agent.onrender.com/api/monolit/enrich \
  -H "Authorization: Bearer {service_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "positions": [{
      "position_id": "test_1",
      "code": "121151113",
      "description": "Beton C30/37",
      "quantity": 100,
      "unit": "m3"
    }],
    "include_audit": true
  }'

# Expected: 200 OK with enrichment results
```

### Day 5 (Nov 21): Full Testing & Go-Live

**E2E Testing:**
- Test all workflows with production data
- Verify enrichment accuracy >90%
- Check latency <500ms
- Load test: 100+ concurrent requests
- Database integrity checks
- Backup verification

**Go-Live:**
- Deploy to production
- Monitor for 24 hours
- Alert setup verification
- Documentation updates

---

## 🔐 SECURITY NOTES

### CORS Configuration
Backend allows requests from:
- https://stav-agent.onrender.com (production frontend)
- http://localhost:3000 (development frontend)

### API Rate Limiting
- Anonymous: 100 requests/hour
- Authenticated: 1000 requests/hour
- Enterprise: Unlimited

### Database Security (PostgreSQL)
- Use SSL/TLS for connection
- Database password in Render secrets (encrypted)
- Regular automated backups
- Minimum log-in credentials

### Redis Security (Upstash)
- Automatic encryption in transit
- Password in environment variable (encrypted)
- No public endpoint exposure
- Automatic backups

### Celery Security
- Worker authentication via Redis password
- Task serialization: JSON only (safe)
- No sensitive data in task args
- Automatic cleanup of old tasks

---

## 📈 PERFORMANCE TARGETS (Post-Week 2)

| Metric | Current | Target | Expected |
|--------|---------|--------|----------|
| **Database Queries** | N/A | <100ms | <50ms |
| **Cache Hit Rate** | N/A | >80% | >85% |
| **Celery Tasks** | N/A | <2sec | <1sec |
| **Concurrent Users** | 10+ | 100+ | 500+ |
| **API Uptime** | ~99% | >99.9% | 99.95% |
| **Enrichment Throughput** | 1 pos/sec | 10+ pos/sec | 15-20 pos/sec |

---

## 📊 MONITORING & LOGS

### Render Dashboard Monitoring
- **Backend:** https://dashboard.render.com/web/concrete-agent
- **Frontend:** https://dashboard.render.com/web/stav-agent

### Health Checks (Current)
- Backend: https://concrete-agent.onrender.com/health
- Frontend: https://stav-agent.onrender.com/

### Health Checks (Post-Week 2)
```json
{
  "status": "healthy",
  "version": "2.2.0",
  "environment": "production",
  "database": "connected",
  "redis": "connected",
  "celery": "operational",
  "timestamp": "2025-11-20T14:30:00Z"
}
```

### Log Locations
- **Render Backend Logs:** https://dashboard.render.com/web/[service-id]/logs
- **Render PostgreSQL Logs:** Render dashboard
- **Upstash Redis Logs:** Upstash dashboard
- **Application Logs:** `/logs/` directory

---

## 📝 DEPLOYMENT CHECKLIST

### Pre-Deployment (Week 2 Preparation)

- [ ] Read DOCKER_SETUP.md (database migration guide)
- [ ] Read DEVELOPMENT_PLAN.md (Week 2 timeline)
- [ ] Create Render PostgreSQL instance
- [ ] Create Upstash Redis instance
- [ ] Test locally with docker-compose
- [ ] All tests passing: `pytest tests/`

### PostgreSQL Deployment (Day 1)

- [ ] Get PostgreSQL connection string from Render
- [ ] Update DATABASE_URL in Render dashboard
- [ ] Deploy backend (triggers Alembic migrations)
- [ ] Verify 10 tables created in PostgreSQL
- [ ] Test `/health` endpoint returns `"database": "connected"`
- [ ] Test database queries work from app
- [ ] Verify no errors in Render logs

### Redis Deployment (Day 2)

- [ ] Create Upstash Redis instance
- [ ] Get Redis URL from Upstash dashboard
- [ ] Update REDIS_URL in Render environment
- [ ] Update CELERY_BROKER_URL and CELERY_RESULT_BACKEND
- [ ] Restart backend service
- [ ] Test cache operations: `/api/health/cache`
- [ ] Verify Redis connection in app logs

### Celery Deployment (Day 3)

- [ ] Create Celery worker service in Render
- [ ] Create Celery Beat scheduler service in Render
- [ ] Deploy both services
- [ ] Test task submission: POST `/api/tasks/test`
- [ ] Verify tasks execute: `celery inspect active`
- [ ] Check scheduled tasks: `celery inspect scheduled`
- [ ] Monitor worker logs for errors

### Integration Testing (Day 4)

- [ ] Test Monolit-Planner adapter: `/api/monolit/enrich`
- [ ] Verify enrichment accuracy >90%
- [ ] Check latency <500ms
- [ ] Test batch processing (50+ positions)
- [ ] Validate KB training data loaded
- [ ] Test audit functionality

### Go-Live (Day 5)

- [ ] Run full E2E test suite
- [ ] Load test: 100+ concurrent requests
- [ ] Database backup verified
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented
- [ ] Team notified
- [ ] Deploy to production
- [ ] Monitor for 24 hours

---

## 🚀 LOCAL TESTING (Before Production)

### Using Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/alpro1000/concrete-agent.git
cd concrete-agent

# 2. Start all services
docker-compose up -d

# 3. Run database migrations
docker-compose exec concrete-agent alembic upgrade head

# 4. Run tests
docker-compose exec concrete-agent pytest tests/ -v

# 5. Test health checks
curl http://localhost:8000/health
curl http://localhost:8000/api/health/cache

# 6. Stop all services
docker-compose down
```

### Manual Local Testing

```bash
# Create Python environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL, Redis locally
# (or use docker run commands)

# Run migrations
alembic upgrade head

# Run tests
pytest tests/ -v

# Start app
uvicorn app.main:app --reload
```

---

## 🆘 TROUBLESHOOTING

### Database Connection Failed
```
Error: postgresql://... could not connect
Solution:
1. Verify DATABASE_URL in Render environment
2. Check PostgreSQL instance is running
3. Verify firewall allows connection
```

### Redis Connection Failed
```
Error: redis://... could not connect
Solution:
1. Verify REDIS_URL in Render environment
2. Check Upstash instance is running
3. Test: redis-cli -u $REDIS_URL ping
```

### Celery Tasks Not Processing
```
Error: Celery worker not consuming tasks
Solution:
1. Verify CELERY_BROKER_URL correct
2. Check worker service is running
3. Check logs: Render dashboard → service logs
```

---

## 📞 SUPPORT & DOCUMENTATION

**Deployment Guides:**
- [INTEGRATION_QUICKSTART.md](INTEGRATION_QUICKSTART.md) - 5-day integration plan
- [DOCKER_SETUP.md](docs/DOCKER_SETUP.md) - Docker configuration guide
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) - Current sprint priorities

**Platforms:**
- **Render:** https://dashboard.render.com
- **Upstash:** https://console.upstash.com
- **GitHub:** https://github.com/alpro1000/concrete-agent

**Support:**
- **Render Support:** https://render.com/support
- **Upstash Support:** https://upstash.com/support
- **GitHub Issues:** https://github.com/alpro1000/concrete-agent/issues

---

**Last Updated:** 2025-11-16
**Document Version:** 2.0
**Status:** Ready for Week 2 Deployment
**Next Review:** After Week 2 Deployment (Nov 21)
