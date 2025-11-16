# 🚀 INTEGRATION QUICKSTART

> 5-day plan to integrate Concrete-Agent with Monolit-Planner

**Status:** Ready to Start
**Duration:** 3-5 days
**Effort:** Medium

---

## 📋 DAY-BY-DAY PLAN

### DAY 1: Docker Setup (2-3 hours)

```bash
# 1. Copy Docker files
cp Dockerfile .
cp docs/docker-compose.yml .

# 2. Create .env file
cp .env.example .env
# Edit: ANTHROPIC_API_KEY, DATABASE_URL, etc.

# 3. Build and run
docker-compose build
docker-compose up -d

# 4. Verify services
docker-compose ps
curl http://localhost:8000/health

# ✅ Done: All services running (concrete-agent, postgres, redis)
```

**Reference:** See `docs/DOCKER_SETUP.md`

---

### DAY 2: Authentication & API Key Setup (1-2 hours)

```bash
# 1. Generate JWT secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 2. Update .env
echo "JWT_SECRET_KEY=<generated_key>" >> .env

# 3. Create service token for Monolit-Planner
docker-compose exec concrete-agent python -c "
from app.core.auth import create_service_token
token = create_service_token('monolit-planner', ['enrich:positions'])
print(f'SERVICE_TOKEN={token}')
"

# 4. Copy token to Monolit-Planner .env
CONCRETE_AGENT_TOKEN=<generated_token>
CONCRETE_AGENT_URL=http://concrete-agent:8000

# ✅ Done: Authentication configured
```

**Reference:** See `docs/INTEGRATION_CHECKLIST.md` Phase 2

---

### DAY 3: Adapter Integration (2-3 hours)

```bash
# 1. Python adapter already created
# Location: app/integrations/monolit_adapter.py

# 2. Add to main.py
from app.integrations.monolit_adapter import router as monolit_router
app.include_router(monolit_router)

# 3. Test adapter endpoint
curl -X POST http://localhost:8000/api/monolit/enrich \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "positions": [{
      "position_id": "test_1",
      "code": "121151113",
      "description": "Beton C30/37",
      "quantity": 100,
      "unit": "m3"
    }]
  }'

# ✅ Done: API adapter working
```

**Reference:** See `docs/INTEGRATION_CHECKLIST.md` Phase 3

---

### DAY 4: Knowledge Base Training (1-2 hours)

```bash
# 1. Export data from Monolit-Planner
cd Monolit-Planner
npm run export:kros-codes > /tmp/monolit_kros.json
npm run export:projects > /tmp/monolit_projects.json

# 2. Load into Concrete-Agent KB
docker-compose exec concrete-agent python scripts/load_kb_from_monolit.py \
  --kros /tmp/monolit_kros.json \
  --projects /tmp/monolit_projects.json

# 3. Verify KB loaded
docker-compose exec concrete-agent python -c "
from app.kb_loader import kb_loader
print(f'✅ KB loaded: {kb_loader.total_codes()} codes')
"

# ✅ Done: Knowledge base trained with your data
```

**Reference:** See `docs/KB_TRAINING_GUIDE.md`

---

### DAY 5: Testing & Deployment (2-3 hours)

```bash
# 1. Run integration tests
docker-compose exec concrete-agent pytest tests/test_monolit_integration.py -v

# 2. Test enrichment accuracy
docker-compose exec concrete-agent python scripts/test_kb_enrichment.py

# 3. Load test
docker-compose exec concrete-agent locust -f tests/locustfile.py

# 4. Check metrics
# - Accuracy: >90%
# - Latency: <500ms
# - Throughput: 10+ positions/sec

# 5. Deploy (optional: to staging first)
git push origin feature/monolit-integration
# Create PR, review, merge

# ✅ Done: Ready for production
```

**Reference:** See `docs/INTEGRATION_CHECKLIST.md` Phase 5

---

## 📝 CHECKLIST

### Infrastructure
- [ ] Docker images built
- [ ] Services running (api, db, cache, queue)
- [ ] Health checks passing
- [ ] Database migrations applied

### Authentication
- [ ] JWT keys generated
- [ ] Service account created
- [ ] Token working
- [ ] Rate limiting configured

### API Adapter
- [ ] Adapter code in place
- [ ] Routes registered
- [ ] Endpoints tested
- [ ] Error handling working

### Knowledge Base
- [ ] Data exported from Monolit
- [ ] KB loaded and verified
- [ ] Enrichment accuracy >90%
- [ ] Cache working

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance targets met

---

## 🔗 KEY FILES

| File | Purpose | Time |
|------|---------|------|
| `INTEGRATION_CHECKLIST.md` | Detailed 6-phase guide | 10 min read |
| `DOCKER_SETUP.md` | Docker configuration | Reference |
| `KB_TRAINING_GUIDE.md` | Knowledge base setup | Reference |
| `MONOLIT_TS_CLIENT.md` | TypeScript client | Reference |
| `app/integrations/monolit_adapter.py` | API adapter code | Reference |

---

## ⚡ QUICK COMMANDS

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f concrete-agent

# Test enrichment
curl -X POST http://localhost:8000/api/monolit/enrich \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"positions": [...]}'

# Run tests
docker-compose exec concrete-agent pytest

# Scale workers
docker-compose up -d --scale celery-worker=3

# Stop all
docker-compose down
```

---

## 📞 SUPPORT

- **API Documentation:** http://localhost:8000/docs
- **Database Issues:** Check PostgreSQL logs
- **Cache Issues:** Check Redis connection
- **Task Issues:** Check Celery logs

---

**Ready to start? Begin with [INTEGRATION_CHECKLIST.md](docs/INTEGRATION_CHECKLIST.md)**

Version: 1.0.0
Created: 2025-11-16
