# 📋 DEVELOPMENT PLAN - Concrete Agent

> **CRITICAL:** This file is read by Claude Code at EVERY session start
> Always check this file first to understand current priorities

**Last Updated:** 2025-11-06 16:20 UTC
**Current Phase:** Phase 4 - Backend Infrastructure
**Current Sprint:** Week 1 (Nov 6-13, 2025)
**Today's Date:** 2025-11-06

---

## 🎯 TODAY'S PRIORITY (2025-11-06)

### COMPLETED TASK: ✅
**Create Technical Specifications** for Phase 4 Backend Infrastructure

**Status:** ✅ COMPLETED

**What was done:**
1. ✅ Created DEPLOYMENT_URLS.md (production URLs documented)
2. ✅ Updated .env.example with deployment URLs
3. ✅ Created docs/TECH_SPECS/ directory
4. ✅ Wrote all 4 detailed technical specifications:
   - backend_infrastructure.md (~12,000 lines) - PostgreSQL, Redis, Celery, WebSocket
   - document_qa_flow.md (~10,000 lines) - Document Intelligence & Multi-step Q&A
   - perplexity_routing.md (~8,000 lines) - SMART routing logic
   - credential_management.md (~9,000 lines) - Proxy service for paid sites

**Next Session:** Begin Day 2-3 implementation (PostgreSQL schema & models)

---

## 🌐 PRODUCTION ENVIRONMENT

### Deployed Applications (Render.com)

**Backend API:**
- URL: https://concrete-agent.onrender.com
- Status: ✅ Live
- Tech: FastAPI + Python 3.10

**Frontend Web:**
- URL: https://stav-agent.onrender.com
- Status: ✅ Live
- Tech: Next.js 14 + React

**Documentation:** See DEPLOYMENT_URLS.md

---

## 📊 PROJECT STATUS OVERVIEW

### ✅ COMPLETED

**Phase 0 (Foundation):**
- Multi-role AI system (6 experts)
- FastAPI backend
- Knowledge Base (B1-B9)
- Perplexity integration
- 78 tests (100% passing)

**Phase 3 (Frontend):**
- Week 1-2: Dashboard & Project Management ✅
- Week 3: Multi-Role Assistant Chat ✅
- Week 4: Artifact Workspace (4 types) ✅
- Week 5: Enhanced Dashboard Analytics ✅
- Week 6: Knowledge Base UI ✅

**Documentation:**
- Competitive analysis (RozpočetPRO) - Part 1 & 2 ✅
- Master Plan ✅
- Architecture docs ✅

### 🟡 IN PROGRESS

**Phase 4 (Backend Infrastructure):**
- Tech specs creation (TODAY)
- PostgreSQL migration (planned)
- Redis integration (planned)
- Queue system (planned)

---

## 🗓️ CURRENT SPRINT (Week 1: Nov 6-13)

### Day 1 (Nov 6) - ✅ COMPLETED:
- [x] Document production URLs
- [x] Update .env configuration
- [x] Create TECH_SPECS directory
- [x] Write backend_infrastructure.md (~12,000 lines)
- [x] Write document_qa_flow.md (~10,000 lines)
- [x] Write perplexity_routing.md (~8,000 lines)
- [x] Write credential_management.md (~9,000 lines)
- [x] Commit and push all tech specs

### Day 2-3 (Nov 7-8):
- [ ] Design PostgreSQL schema
- [ ] Write SQLAlchemy models
- [ ] Create migration script (files → DB)
- [ ] Test with sample projects

### Day 4 (Nov 9):
- [ ] Install and configure Redis
- [ ] Implement caching layer
- [ ] Session management
- [ ] Test performance improvements

### Day 5 (Nov 10):
- [ ] Install Celery
- [ ] Define background jobs
- [ ] Implement workers
- [ ] Test async processing

### Weekend (Nov 11-13):
- [ ] Testing & bug fixes
- [ ] Documentation updates
- [ ] Prepare for Week 2

---

## 📐 TECHNICAL SPECIFICATIONS TO CREATE

### 1. backend_infrastructure.md

**Purpose:** Complete specification for PostgreSQL, Redis, Celery migration

**Contents:**
- Database schema design (all tables, relations, indexes)
- SQLAlchemy models
- Migration strategy (files → PostgreSQL)
- Redis key structure and TTLs
- Celery job definitions
- WebSocket event system
- Rollback plan if issues

**Why important:** This is the foundation for scalable multi-user system

---

### 2. document_qa_flow.md

**Purpose:** Multi-step Q&A flow with document intelligence

**Contents:**
- User uploads documents (TechSpec.pdf, Materials.xlsx, Drawings.pdf)
- System parses with MinerU + pdfplumber
- Claude analyzes and generates clarification questions
- Perplexity searches for answers IN uploaded documents
- UI shows Q&A with confidence scores
- User can edit/confirm answers
- System generates budget with validated context
- Incremental updates when new docs added

**Key Innovation:** Perplexity answers questions BY READING uploaded docs, not asking user

**Why important:** This is killer feature differentiating from RozpočetPRO

---

### 3. perplexity_routing.md

**Purpose:** Smart routing logic for Perplexity usage

**Contents:**
- Current mode: USE_PERPLEXITY_PRIMARY=false (fallback only)
- New mode: PERPLEXITY_MODE=smart (intelligent routing)
- Routing rules by task type:
  - Code lookup (KROS/RTS/ÚRS) → PRIMARY: Perplexity
  - Price lookup → PRIMARY: Perplexity
  - Standards (ČSN) → PRIMARY: Local KB, FALLBACK: Perplexity
  - Technical questions → PRIMARY: Claude, CONTEXT: Perplexity
  - Document Q&A → PRIMARY: Claude + docs, NO Perplexity
- Cost management (daily limits)
- Performance optimization (caching)

**Configuration:**
```env
PERPLEXITY_MODE=smart
PERPLEXITY_PRIMARY_FOR=code_lookup,price_lookup,web_search
PERPLEXITY_FALLBACK_FOR=standards,technical_questions
PERPLEXITY_DISABLED_FOR=document_qa,chat
PERPLEXITY_MAX_COST_PER_DAY_USD=10.00
```

**Why important:** Optimize costs while maximizing accuracy

---

### 4. credential_management.md

**Purpose:** Secure access to paid construction databases

**User's idea:** Buy subscriptions to ÚRS, Cenovamapa, CSN Online, etc. and store credentials in ENV

**Contents:**
- Credential storage (encrypted in ENV)
- Proxy Service architecture:
  - Separate microservice that logs into paid sites
  - Fetches data on behalf of Concrete Agent
  - Caches results to minimize requests
  - Tracks usage and costs
- Security best practices:
  - Never store plain text passwords
  - Use encryption (Fernet)
  - Rotate credentials quarterly
  - Audit logs
  - Separate credentials per environment (dev/staging/prod)
- Integration with Perplexity:
  - Perplexity searches public web
  - Proxy fetches from paid databases
  - Results combined for comprehensive answer
- Pre-fetching strategy:
  - Daily job: Login → fetch common materials prices → save to KB
  - KB always up-to-date
  - Reduces need for real-time login

**Example credentials in ENV:**
```env
# ÚRS Database (Czech pricing database)
URS_USERNAME=encrypted:abc123...
URS_PASSWORD=encrypted:xyz789...
URS_API_KEY=urs_key_if_available

# Cenovamapa (Market prices)
CENOVAMAPA_API_KEY=key_here

# CSN Online (Standards)
CSNONLINE_USERNAME=encrypted:def456...
CSNONLINE_PASSWORD=encrypted:uvw012...
```

**Why important:** Access to authoritative data sources = higher accuracy = competitive advantage

---

## 🎯 STRATEGIC VISION

### What We're Building

**Short-term (Phase 4 - Q1 2025):**
- Scalable backend (PostgreSQL, Redis, Celery)
- Real-time updates (WebSocket)
- Document intelligence (multi-step Q&A)
- Access to paid databases (credential proxy)

**Mid-term (Phase 5 - Q2 2025):**
- Experience Database (self-learning from completed projects)
- Advanced audit features
- Team collaboration
- API for integrations

**Long-term (Q3-Q4 2025):**
- Enterprise features (SSO, SLA)
- White-label option
- BIM software integrations
- Mobile app

### Competitive Positioning

**RozpočetPRO (competitor):**
- Target: SMB (small business)
- Value: "Fast budget generation (5 min)"
- Price: 500-1000 Kč/month
- Tech: Single AI + RAG

**Concrete Agent (us):**
- Target: Mid/Enterprise
- Value: "Risk reduction + compliance + optimization"
- Price: 5000-20000 Kč/month
- Tech: Multi-role (6 experts) + RAG + Vision

**Key Differentiators:**
1. ⭐ Multi-Role AI Audit (6 experts vs 1 AI)
2. ⭐ GPT-4 Vision for drawings
3. ⭐ Document Intelligence (Q&A flow)
4. ⭐ Editable artifacts with live recalc
5. ⭐ Deep standards compliance (KROS, RTS, OTSKP, ČSN, JKSO)

---

## 📝 IMPLEMENTATION GUIDELINES

### For Claude Code: How to Work

**1. START OF EACH SESSION:**
```
Read this file (DEVELOPMENT_PLAN.md)
Check "TODAY'S PRIORITY"
Read relevant TECH_SPECS/*.md (when created)
Understand context
Start working
```

**2. DURING WORK:**
```
Follow specifications exactly
Write clean, documented code
Add tests for new features
Update docs after changes
```

**3. END OF SESSION:**
```
Update "TODAY'S PRIORITY" section
Mark completed tasks with [x]
Add notes about progress
Commit with clear message
Update "Last Updated" timestamp
```

**4. GIT COMMIT MESSAGES:**
```
Format: type(scope): description

Examples:
feat(backend): add PostgreSQL migration script
fix(api): correct CORS configuration for production
docs(specs): add credential management specification
test(db): add tests for SQLAlchemy models
```

---

## 🔗 RELATED DOCUMENTS

**Strategic:**
- MASTER_PLAN.md - Overall project roadmap
- COMPETITIVE_ANALYSIS_RozpocetPRO.md (Part 1 & 2) - Market analysis

**Technical:**
- ARCHITECTURE.md - System architecture
- docs/SYSTEM_DESIGN.md - Detailed technical design
- docs/API.md - API documentation
- docs/WORKFLOWS.md - User workflows

**Deployment:**
- DEPLOYMENT_URLS.md - Production URLs and deployment info
- render.yaml - Render.com configuration
- .env.example - Environment variables template

**Technical Specs (to be created):**
- docs/TECH_SPECS/backend_infrastructure.md
- docs/TECH_SPECS/document_qa_flow.md
- docs/TECH_SPECS/perplexity_routing.md
- docs/TECH_SPECS/credential_management.md

---

## 🚨 IMPORTANT NOTES

### Production Considerations

**Backend:** https://concrete-agent.onrender.com
- Currently file-based storage
- ⚠️ Not suitable for multi-user at scale
- 🎯 MUST migrate to PostgreSQL in Phase 4

**Frontend:** https://stav-agent.onrender.com
- Next.js 14 with App Router
- ✅ Ready for scale
- Uses mock data (needs real API integration)

### Security

**API Keys (DO NOT COMMIT):**
- ANTHROPIC_API_KEY - Claude API
- OPENAI_API_KEY - GPT-4 Vision
- PERPLEXITY_API_KEY - Perplexity search
- Database credentials (PostgreSQL, Redis)
- Paid site credentials (ÚRS, Cenovamapa, etc.)

**All keys stored in:**
- Render.com dashboard (production)
- .env file (local, gitignored)
- NEVER in .env.example (only templates)

### Cost Management

**Current monthly costs (estimate):**
- Render.com: $7 (Starter plan)
- Anthropic Claude: ~$50-100 (usage-based)
- OpenAI GPT-4: ~$30-50 (usage-based)
- Perplexity: ~$20 (if using heavily)

**Planned additions:**
- PostgreSQL (Render): +$7/month
- Redis (Upstash free tier): $0
- Paid databases: +$50-150/month (ÚRS, etc.)

**Total projected:** ~$200-300/month (before revenue)

---

## 📞 CONTACTS & SUPPORT

**Project Owner:** [Your Name]
**Claude Code:** AI Development Assistant

**Platforms:**
- Render.com: https://dashboard.render.com
- GitHub: [Your repo URL]

**Resources:**
- Anthropic Claude: https://console.anthropic.com
- OpenAI: https://platform.openai.com
- Perplexity: https://www.perplexity.ai

---

## ✅ CHECKLIST: Before Starting Work

- [ ] Read DEVELOPMENT_PLAN.md (this file)
- [ ] Check "TODAY'S PRIORITY"
- [ ] Read relevant TECH_SPECS (when available)
- [ ] Understand the context and goal
- [ ] Have necessary API keys in .env
- [ ] Tests are passing (pytest)
- [ ] Ready to code!

---

**Remember:** This is a living document. Update after every significant change!

**Last Updated:** 2025-11-06 14:45 UTC
**Next Review:** 2025-11-07 (tomorrow)
