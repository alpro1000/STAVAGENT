# 🔗 INTEGRATION CHECKLIST: Concrete-Agent + Monolit-Planner

> Complete step-by-step guide for integrating Concrete-Agent as the parsing and AI logic core into Monolit-Planner

**Version:** 1.0.0
**Created:** 2025-11-16
**Estimated Duration:** 3-5 days
**Target Status:** Production-Ready

---

## 📋 PRE-INTEGRATION CHECKLIST (Day 1)

### Phase 0: Environment Setup

- [ ] **0.1** Clone both repositories
  ```bash
  git clone https://github.com/alpro1000/concrete-agent.git
  git clone https://github.com/alpro1000/Monolit-Planner.git
  ```

- [ ] **0.2** Verify Python 3.10+ installed
  ```bash
  python3 --version  # Should be 3.10+
  ```

- [ ] **0.3** Verify Node.js 18+ installed
  ```bash
  node --version  # Should be 18+
  ```

- [ ] **0.4** Install concrete-agent dependencies
  ```bash
  cd concrete-agent
  pip install -r requirements.txt
  ```

- [ ] **0.5** Create `.env` file with API keys
  ```bash
  cp .env.example .env
  # Add: ANTHROPIC_API_KEY, OPENAI_API_KEY (optional)
  ```

- [ ] **0.6** Verify database connectivity
  ```bash
  python -c "from app.core.config import settings; print(f'DB: {settings.DATABASE_URL}')"
  ```

---

## 🔧 PHASE 1: INFRASTRUCTURE SETUP (Days 1-2)

### Phase 1.1: Docker Configuration

- [ ] **1.1.1** Review Docker files created (see DOCKER_SETUP.md)
  - [ ] Dockerfile for concrete-agent
  - [ ] docker-compose.yml
  - [ ] .dockerignore

- [ ] **1.1.2** Build Docker images
  ```bash
  docker-compose build
  ```
  **Expected output:** `Successfully tagged concrete-agent:latest`

- [ ] **1.1.3** Test docker-compose up
  ```bash
  docker-compose up -d
  ```
  **Check services:**
  ```bash
  docker-compose ps
  # Should show: concrete-agent, postgres, redis (all running)
  ```

- [ ] **1.1.4** Test health endpoints
  ```bash
  # Should return 200 OK
  curl http://localhost:8000/health
  curl http://localhost:8000/docs  # Swagger UI
  ```

- [ ] **1.1.5** Verify Redis connectivity
  ```bash
  docker-compose exec redis redis-cli ping
  # Expected: PONG
  ```

- [ ] **1.1.6** Verify PostgreSQL connectivity
  ```bash
  docker-compose exec postgres psql -U postgres -c "SELECT 1"
  # Expected: (1 row)
  ```

### Phase 1.2: Database Migrations

- [ ] **1.2.1** Run Alembic migrations in Docker
  ```bash
  docker-compose exec concrete-agent alembic upgrade head
  ```
  **Expected:** Migration output showing 10 tables created

- [ ] **1.2.2** Verify schema created
  ```bash
  docker-compose exec postgres psql -U postgres -d concrete_agent \
    -c "\dt"  # List tables
  # Should show: users, projects, positions, audit_results, etc.
  ```

- [ ] **1.2.3** Create test project in DB
  ```bash
  docker-compose exec concrete-agent python -c \
    "from app.db.models.project import Project; print('DB models ready')"
  ```

### Phase 1.3: API Key Configuration

- [ ] **1.3.1** Configure ANTHROPIC_API_KEY
  ```bash
  # In docker-compose.yml or .env
  ANTHROPIC_API_KEY=sk-ant-...
  ```

- [ ] **1.3.2** Test Claude API connectivity
  ```bash
  curl -X POST http://localhost:8000/api/test-claude \
    -H "Content-Type: application/json" \
    -d '{"message": "test"}'
  ```

- [ ] **1.3.3** (Optional) Configure OPENAI_API_KEY for Workflow B
  ```bash
  OPENAI_API_KEY=sk-...
  ```

---

## 🔐 PHASE 2: AUTHENTICATION & SECURITY (Day 2)

### Phase 2.1: JWT Authentication Setup

- [ ] **2.1.1** Review authentication implementation
  - File: `app/core/auth.py` (create if missing)
  - Should support JWT tokens for inter-service communication

- [ ] **2.1.2** Generate JWT secret key
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  # Copy to .env as: JWT_SECRET_KEY=...
  ```

- [ ] **2.1.3** Create service account for Monolit-Planner
  ```python
  # In admin script
  from app.core.auth import create_service_token

  token = create_service_token(
    service_name="monolit-planner",
    scopes=["enrich:positions", "parse:documents"]
  )
  print(f"SERVICE_TOKEN={token}")
  ```

- [ ] **2.1.4** Add token to Monolit-Planner config
  ```bash
  # In Monolit-Planner .env
  CONCRETE_AGENT_TOKEN=<generated_token>
  CONCRETE_AGENT_URL=http://concrete-agent:8000
  ```

### Phase 2.2: Rate Limiting

- [ ] **2.2.1** Enable rate limiting in config
  ```python
  # app/core/config.py
  RATE_LIMIT_ENABLED: bool = True
  RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
  RATE_LIMIT_BURST: int = 10
  ```

- [ ] **2.2.2** Test rate limiting
  ```bash
  # Should allow ~60 requests/min
  for i in {1..65}; do
    curl http://localhost:8000/health
  done
  # Should eventually return 429 (Too Many Requests)
  ```

### Phase 2.3: CORS Configuration

- [ ] **2.3.1** Update CORS settings
  ```python
  # app/main.py
  app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://monolit-planner:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
  )
  ```

- [ ] **2.3.2** Test CORS headers
  ```bash
  curl -H "Origin: http://monolit-planner:3000" \
       -H "Access-Control-Request-Method: POST" \
       -v http://localhost:8000/api/workflow/a/enrich
  # Check for Access-Control-Allow-Origin header
  ```

---

## 🔌 PHASE 3: API ADAPTER INTEGRATION (Day 3)

### Phase 3.1: Create Adapter Layer

- [ ] **3.1.1** Review adapter code (see MONOLIT_API_ADAPTER.py)
  - File: `app/integrations/monolit_adapter.py`
  - Should provide unified interface to Monolit-Planner

- [ ] **3.1.2** Test adapter locally
  ```python
  from app.integrations.monolit_adapter import MonolitAdapter

  adapter = MonolitAdapter(api_key="test-key")
  result = adapter.enrich_xlsx_data({
    'positions': [
      {'code': '121151113', 'quantity': 10, 'unit': 'm3'}
    ]
  })
  print(result)  # Should contain enrichment data
  ```

- [ ] **3.1.3** Add adapter to API routes
  ```python
  # app/api/routes.py
  from app.integrations.monolit_adapter import router as monolit_router
  app.include_router(monolit_router)
  ```

- [ ] **3.1.4** Test adapter endpoints
  ```bash
  curl -X POST http://localhost:8000/api/monolit/enrich \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d @test_payload.json
  ```

### Phase 3.2: Monolit-Planner Client Integration

- [ ] **3.2.1** Create TypeScript client for concrete-agent
  - File: `Monolit-Planner/src/services/concreteAgentClient.ts`
  - Should wrap API adapter

- [ ] **3.2.2** Install HTTP client if needed
  ```bash
  cd Monolit-Planner
  npm install axios  # or fetch API
  ```

- [ ] **3.2.3** Test client connection
  ```typescript
  import { ConcreteAgentClient } from './services/concreteAgentClient';

  const client = new ConcreteAgentClient({
    baseUrl: 'http://localhost:8000',
    token: process.env.CONCRETE_AGENT_TOKEN
  });

  const result = await client.enrichEstimate({...});
  console.log(result);
  ```

- [ ] **3.2.4** Integrate into Monolit-Planner workflow
  - Add enrichment step after XLSX upload
  - Show enrichment confidence scores
  - Display KROS matching results

---

## 📚 PHASE 4: KNOWLEDGE BASE TRAINING (Day 4)

### Phase 4.1: Prepare Training Data

- [ ] **4.1.1** Review KB structure (see KB_TRAINING_GUIDE.md)
  - Location: `app/knowledge_base/B*_*/`
  - Should contain: codes, standards, prices, tech specs

- [ ] **4.1.2** Export data from Monolit-Planner
  ```bash
  # Export all KROS codes from Node.js backend
  npm run export:kros-codes > /tmp/monolit_kros.json

  # Export all projects/budgets
  npm run export:projects > /tmp/monolit_projects.json
  ```

- [ ] **4.1.3** Convert and load into concrete-agent KB
  ```bash
  python scripts/load_kb_from_monolit.py \
    --kros /tmp/monolit_kros.json \
    --projects /tmp/monolit_projects.json
  ```

- [ ] **4.1.4** Verify KB loaded
  ```bash
  docker-compose exec concrete-agent \
    python -c "from app.services.kb_loader import kb_loader; \
    print(f'Codes loaded: {len(kb_loader.codes)}')"
  ```

### Phase 4.2: Fine-tune Prompts

- [ ] **4.2.1** Create custom prompt for bridge structures
  - File: `app/prompts/bridge_audit_system_v1.md`
  - Include: bridge-specific rules, local standards

- [ ] **4.2.2** Test prompt with sample data
  ```python
  from app.core.claude_client import claude_client

  response = await claude_client.analyze_position(
    position={...},
    prompt_version="bridge_audit_v1"
  )
  ```

- [ ] **4.2.3** Validate prompt quality
  - Test on 10-20 real positions from Monolit-Planner
  - Check accuracy >90%
  - Check hallucination rate <1%

---

## ✅ PHASE 5: TESTING & VALIDATION (Day 5)

### Phase 5.1: Unit Tests

- [ ] **5.1.1** Run existing test suite
  ```bash
  docker-compose exec concrete-agent pytest tests/ -v
  ```
  **Expected:** 87+ tests passing (97%+ pass rate)

- [ ] **5.1.2** Add integration tests for Monolit-Planner
  ```bash
  # File: tests/test_monolit_integration.py
  docker-compose exec concrete-agent \
    pytest tests/test_monolit_integration.py -v
  ```

- [ ] **5.1.3** Test error handling
  - [ ] Invalid XLSX format
  - [ ] Missing required fields
  - [ ] API timeout scenarios
  - [ ] Database connection failures

### Phase 5.2: End-to-End Testing

- [ ] **5.2.1** Test complete workflow
  ```bash
  # 1. Upload XLSX in Monolit-Planner
  # 2. Trigger enrichment in concrete-agent
  # 3. Receive results back
  # 4. Display in Monolit-Planner UI
  ```

- [ ] **5.2.2** Test with real Monolit-Planner data
  - Use 10+ sample projects
  - Verify enrichment quality
  - Check performance (<2 sec per position)

- [ ] **5.2.3** Load testing
  ```bash
  # Simulate 100 concurrent enrichment requests
  docker-compose exec concrete-agent \
    locust -f tests/locustfile.py --headless -u 100
  ```

### Phase 5.3: Performance Validation

- [ ] **5.3.1** Measure latency
  - Expected: <100ms per position (cached)
  - Expected: <500ms per position (new)

- [ ] **5.3.2** Measure throughput
  - Expected: 10+ positions/sec with Celery workers

- [ ] **5.3.3** Monitor resource usage
  ```bash
  docker stats concrete-agent
  # CPU: <50%, Memory: <2GB, Disk: <1GB
  ```

### Phase 5.4: Security Testing

- [ ] **5.4.1** Test authentication
  - [ ] Valid token → 200
  - [ ] Invalid token → 401
  - [ ] Expired token → 401

- [ ] **5.4.2** Test authorization
  - [ ] Service A can't access Service B's data
  - [ ] Rate limiting active

- [ ] **5.4.3** Test input validation
  - [ ] SQL injection attempts → rejected
  - [ ] Path traversal attempts → rejected
  - [ ] Large payloads → rejected

---

## 🚀 PHASE 6: PRODUCTION DEPLOYMENT (Post-Day 5)

### Phase 6.1: Pre-Production Checklist

- [ ] **6.1.1** All tests passing (100%)
- [ ] **6.1.2** Documentation complete
- [ ] **6.1.3** Monitoring configured (logs, metrics)
- [ ] **6.1.4** Backup strategy defined
- [ ] **6.1.5** Rollback plan documented

### Phase 6.2: Deploy to Staging

- [ ] **6.2.1** Deploy both services to staging environment
- [ ] **6.2.2** Run smoke tests against staging
- [ ] **6.2.3** Verify data privacy (no real client data)
- [ ] **6.2.4** Monitor for 24 hours

### Phase 6.3: Deploy to Production

- [ ] **6.3.1** Backup production database
- [ ] **6.3.2** Deploy concrete-agent
- [ ] **6.3.3** Deploy Monolit-Planner integration
- [ ] **6.3.4** Monitor first 24 hours
- [ ] **6.3.5** Have rollback plan ready

---

## 📊 SUCCESS CRITERIA

| Metric | Target | Status |
|--------|--------|--------|
| **API Health** | 99.9% uptime | ⏳ |
| **Enrichment Accuracy** | >90% | ⏳ |
| **Latency** | <500ms p95 | ⏳ |
| **Throughput** | 10+ positions/sec | ⏳ |
| **Test Coverage** | >95% | ⏳ |
| **Documentation** | 100% complete | ⏳ |

---

## 🆘 TROUBLESHOOTING

### Issue: "Connection refused" on localhost:8000

**Solution:**
```bash
# Check if containers are running
docker-compose ps

# Check logs
docker-compose logs concrete-agent

# Restart containers
docker-compose restart concrete-agent
```

### Issue: "Database migration failed"

**Solution:**
```bash
# Check migration status
docker-compose exec concrete-agent alembic current

# Rollback and retry
docker-compose exec concrete-agent alembic downgrade -1
docker-compose exec concrete-agent alembic upgrade head
```

### Issue: "Authentication token invalid"

**Solution:**
```bash
# Regenerate token
docker-compose exec concrete-agent python scripts/generate_token.py

# Update in Monolit-Planner .env
CONCRETE_AGENT_TOKEN=<new_token>

# Restart Monolit-Planner
docker-compose restart monolit-planner
```

### Issue: "Enrichment takes too long"

**Solution:**
```bash
# Scale up Celery workers
docker-compose up -d --scale celery-worker=3

# Check Redis cache
docker-compose exec redis redis-cli INFO stats

# Enable KB caching
# In .env: KB_CACHE_ENABLED=true
```

---

## 📞 SUPPORT & ESCALATION

**For API issues:** Check `app/logs/`
**For DB issues:** Check PostgreSQL logs
**For Cache issues:** Check Redis CLI
**For Task issues:** Check Celery logs

**Emergency contact:** See CONTRIBUTING.md

---

**Last updated:** 2025-11-16
**Status:** Ready for Implementation ✅
