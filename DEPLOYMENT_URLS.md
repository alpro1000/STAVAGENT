# Deployment URLs - Concrete Agent

**Created:** 2025-11-06
**Status:** Production Deployment on Render.com

---

## 🌐 PRODUCTION URLS

### Backend (API)
- **URL:** https://concrete-agent.onrender.com
- **Platform:** Render.com
- **Tech Stack:** FastAPI (Python 3.10+)
- **Database:** File-based (migrating to PostgreSQL)

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

## 🔧 DEPLOYMENT CONFIGURATION

### Backend (concrete-agent.onrender.com)

**Render Configuration:**
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

### Frontend (stav-agent.onrender.com)

**Render Configuration:**
```yaml
# render.yaml (frontend)
name: stav-agent
type: web
env: node
buildCommand: npm install && npm run build
startCommand: npm start
```

**Environment Variables Required:**
```env
NEXT_PUBLIC_API_URL=https://concrete-agent.onrender.com
NEXT_PUBLIC_ENV=production
```

---

## 🔄 PLANNED MIGRATION

### Phase 4: Backend Infrastructure Upgrade

**Database Migration:**
- Current: File-based storage (data/projects/)
- Target: PostgreSQL on Render.com
- Timeline: Week 1-2 of Phase 4

**Cache Layer:**
- Current: In-memory cache
- Target: Redis (Upstash or Render Redis)
- Timeline: Week 1 of Phase 4

**Queue System:**
- Current: Synchronous processing
- Target: Celery + Redis
- Timeline: Week 1 of Phase 4

---

## 📊 MONITORING & LOGS

### Backend Logs
```bash
# View logs on Render
https://dashboard.render.com/web/[service-id]/logs
```

### Health Checks
- Backend: https://concrete-agent.onrender.com/health
- Frontend: https://stav-agent.onrender.com/

### Expected Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2025-11-06T14:30:00Z"
}
```

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

---

## 📝 DEPLOYMENT CHECKLIST

### Before Deploying Backend:
- [ ] Update environment variables on Render dashboard
- [ ] Run database migrations (when PostgreSQL added)
- [ ] Test /health endpoint
- [ ] Test /docs endpoint
- [ ] Verify CORS settings

### Before Deploying Frontend:
- [ ] Set NEXT_PUBLIC_API_URL to backend URL
- [ ] Test API connectivity
- [ ] Verify authentication flow
- [ ] Check mobile responsiveness

---

## 🚀 QUICK DEPLOYMENT

### Backend (Concrete Agent)
```bash
# Push to main branch triggers auto-deploy
git push origin main

# Or manual deploy via Render dashboard
https://dashboard.render.com/web/concrete-agent
```

### Frontend (Stav Agent)
```bash
# Push to main branch triggers auto-deploy
git push origin main

# Or manual deploy via Render dashboard
https://dashboard.render.com/web/stav-agent
```

---

## 📞 SUPPORT CONTACTS

**Platform:** Render.com
**Support:** https://render.com/support
**Status Page:** https://status.render.com/

**Project Owner:** [Your contact info]
**Technical Lead:** [Your contact info]

---

**Last Updated:** 2025-11-06
**Document Version:** 1.0
