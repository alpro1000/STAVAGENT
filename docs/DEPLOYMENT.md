# Deployment Guide: Render

**How to deploy StavAgent services to Render.com**

---

## Overview

StavAgent is designed for deployment on Render.com with the following architecture:

```
StavAgent Monorepo (Single GitHub Repository)
    ↓
    ├── concrete-agent (Python FastAPI service)
    ├── stavagent-portal (Node.js Express + React)
    └── Monolit-Planner (Node.js Express + React)
         ↓
    All deployed as separate services on Render
         ↓
    Shared PostgreSQL database
    Shared Redis cache (optional)
```

**Key Points**:
- **Single monorepo** on GitHub
- **Three independent services** deployed separately
- **Each service has its own** root directory, port, and environment
- **Shared database** (one PostgreSQL instance for all services)
- **DNS/Load Balancer** routes requests to appropriate service

---

## Prerequisites

1. **GitHub Account**: Repository must be on GitHub
2. **Render Account**: Free or paid (https://render.com)
3. **PostgreSQL Database**: Create on Render or use external
4. **Environment Variables**: API keys, secrets, database URLs
5. **Domain** (optional): For production use

---

## Deployment Architecture

### Service Configuration

Each service on Render:

```
Service: concrete-agent
├── Type: Web Service (Python)
├── Root Directory: concrete-agent/packages/core-backend/
├── Build Command: pip install -r requirements.txt
├── Start Command: python -m uvicorn app.main:app --host 0.0.0.0 --port 10000
├── Port: 10000 (auto-assigned by Render)
└── Environment: Python 3.10+

Service: stavagent-portal
├── Type: Web Service (Node.js)
├── Root Directory: stavagent-portal/
├── Build Command: npm install && npm run build
├── Start Command: npm run start
├── Port: 10000 (auto-assigned by Render)
└── Environment: Node 18+

Service: Monolit-Planner
├── Type: Web Service (Node.js)
├── Root Directory: Monolit-Planner/
├── Build Command: npm install && npm run build
├── Start Command: npm run start
├── Port: 10000 (auto-assigned by Render)
└── Environment: Node 18+

Database: PostgreSQL
├── Type: PostgreSQL Database
├── Plan: Standard or Premium
└── Used by: All three services
```

---

## Deployment Steps

### Step 1: Prepare the Repository

Ensure your repository has these files in each service root:

**concrete-agent/packages/core-backend/**:
- `requirements.txt` - Python dependencies
- `.env.example` - Example environment variables
- `app/main.py` - FastAPI entry point

**stavagent-portal/**:
- `package.json` - Node dependencies (root)
- `.env.example` - Example environment files
- `backend/server.js` - Backend entry point
- `render.yaml` - (Optional) Render deployment config

**Monolit-Planner/**:
- `package.json` - Node dependencies (root)
- `.env.example` - Example environment files
- `backend/src/server.js` - Backend entry point
- `render.yaml` - (Optional) Render deployment config

### Step 2: Create PostgreSQL Database on Render

1. Log in to Render.com
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `stavagent-postgres`
   - **Region**: Your preferred region
   - **PostgreSQL Version**: 14+
4. Note the **Internal Database URL** (for services) and **Database URL** (for external access)

Example Internal URL:
```
postgresql://user:password@stavagent-postgres.c2hmhk8j8j.postgres.onrender.com:5432/stavagent
```

### Step 3: Create Redis Cache (Optional)

For better performance with caching and task queues:

1. Click "New +" → "Redis"
2. Configure:
   - **Name**: `stavagent-redis`
   - **Region**: Same as PostgreSQL
3. Note the **Internal Redis URL**

### Step 4: Deploy concrete-agent (Python)

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `stavagent-concrete-agent`
   - **GitHub Repo**: Your STAVAGENT repo
   - **Root Directory**: `concrete-agent/packages/core-backend/`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. Set Environment Variables:
```env
PYTHONUNBUFFERED=1
FASTAPI_ENV=production

# Database
DATABASE_URL=postgresql://... (from Step 2)

# Redis (optional)
REDIS_URL=redis://... (from Step 3)

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-... (if using Workflow B)
PERPLEXITY_API_KEY=... (if using KB search)

# Feature Flags
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=true
ENABLE_KROS_MATCHING=true
```

5. Click "Create Web Service"
6. Wait for deployment to complete (5-10 minutes)
7. Note the service URL: `https://stavagent-concrete-agent.onrender.com`

### Step 5: Deploy stavagent-portal (Node.js)

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `stavagent-portal`
   - **GitHub Repo**: Your STAVAGENT repo
   - **Root Directory**: `stavagent-portal/`
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start` (or `node backend/server.js`)

4. Set Environment Variables:
```env
NODE_ENV=production

# Backend Database
DATABASE_URL=postgresql://... (from Step 2)

# JWT
JWT_SECRET=your-secret-key-here (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
JWT_EXPIRE_HOURS=24

# External Services
CORE_API_URL=https://stavagent-concrete-agent.onrender.com (from Step 4)
KIOSK_MONOLIT_URL=https://stavagent-monolit.onrender.com (you'll get this in Step 6)

# Frontend (for build)
VITE_API_URL=https://stavagent-portal.onrender.com

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. Note the service URL: `https://stavagent-portal.onrender.com`

### Step 6: Deploy Monolit-Planner (Node.js Kiosk)

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `stavagent-monolit`
   - **GitHub Repo**: Your STAVAGENT repo
   - **Root Directory**: `Monolit-Planner/`
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start` (or `node backend/src/server.js`)

4. Set Environment Variables:
```env
NODE_ENV=production

# Kiosk Database
DATABASE_URL=postgresql://... (from Step 2)

# External Services
PORTAL_API_URL=https://stavagent-portal.onrender.com (from Step 5)
CORE_API_URL=https://stavagent-concrete-agent.onrender.com (from Step 4)

# Frontend
VITE_API_URL=https://stavagent-monolit.onrender.com
```

5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. Note the service URL: `https://stavagent-monolit.onrender.com`

### Step 7: Update Portal Configuration

Go back to stavagent-portal service and update:

```env
KIOSK_MONOLIT_URL=https://stavagent-monolit.onrender.com
```

Then redeploy.

---

## Service URLs

After deployment, you'll have:

```
Frontend (Portal):       https://stavagent-portal.onrender.com
Backend (Portal):        https://stavagent-portal.onrender.com/api
Core API:                https://stavagent-concrete-agent.onrender.com
Monolit API:             https://stavagent-monolit.onrender.com/api

concrete-agent Docs:     https://stavagent-concrete-agent.onrender.com/docs
concrete-agent ReDoc:    https://stavagent-concrete-agent.onrender.com/redoc
```

---

## Configuration

### Database Initialization

On first deployment, databases are created automatically. If you need to run migrations:

**For Portal or Monolit** (Node.js with migrations):
```bash
# Add to build command:
npm install && npm run migrations:up && npm run build
```

**For concrete-agent** (Python with Alembic):
```bash
# Add to build command:
pip install -r requirements.txt && alembic upgrade head
```

### Environment Variables Checklist

**concrete-agent**:
- [ ] `DATABASE_URL` - PostgreSQL connection
- [ ] `ANTHROPIC_API_KEY` - Claude API key
- [ ] `OPENAI_API_KEY` - GPT-4 API key (if using Workflow B)
- [ ] `FASTAPI_ENV=production`

**stavagent-portal**:
- [ ] `DATABASE_URL` - PostgreSQL connection
- [ ] `JWT_SECRET` - Secure random string
- [ ] `CORE_API_URL` - concrete-agent URL
- [ ] `KIOSK_MONOLIT_URL` - Monolit-Planner URL
- [ ] `NODE_ENV=production`

**Monolit-Planner**:
- [ ] `DATABASE_URL` - PostgreSQL connection
- [ ] `PORTAL_API_URL` - Portal URL
- [ ] `CORE_API_URL` - concrete-agent URL
- [ ] `NODE_ENV=production`

---

## Monitoring & Troubleshooting

### View Logs

In Render dashboard:
1. Click on service
2. Click "Logs"
3. Stream live logs or download history

### Common Issues

**Service Won't Start**:
- Check logs for error messages
- Verify build command is correct
- Ensure start command matches entry point

**Database Connection Error**:
- Verify `DATABASE_URL` environment variable
- Check PostgreSQL database is running
- Ensure firewall rules allow Render → PostgreSQL

**Services Can't Talk to Each Other**:
- Verify environment URLs are correct
- Use internal URLs for inter-service communication
- Check CORS settings

**Performance Issues**:
- Upgrade PostgreSQL plan
- Enable Redis caching
- Check logs for slow queries

### Restart a Service

1. Click on service in Render dashboard
2. Click "Settings"
3. Click "Restart Service"

### View Metrics

1. Click on service
2. Click "Metrics"
3. View CPU, Memory, Network usage

---

## Custom Domain (Optional)

To use your own domain instead of `*.onrender.com`:

1. In Render dashboard, click on service
2. Click "Settings"
3. Scroll to "Custom Domain"
4. Enter your domain (e.g., `app.stavagent.com`)
5. Update DNS records at your domain provider
6. Render will auto-provision SSL certificate

---

## Scaling & Performance

### For Small Load (< 100 users)
- PostgreSQL: Standard instance
- No Redis needed
- Services: Default plan sufficient

### For Medium Load (100-1000 users)
- PostgreSQL: Upgrade to larger instance
- Enable Redis for caching
- Consider upgrading service plans

### For Large Load (> 1000 users)
- PostgreSQL: Premium plan or separate cluster
- Redis: Larger instance
- Services: Upgrade to professional plans
- Consider load balancer

---

## Backup & Recovery

### PostgreSQL Backups

Render automatically creates daily backups. To restore:

1. Click on PostgreSQL in Render dashboard
2. Click "Backups"
3. Select a backup point
4. Click "Restore"

### Manual Database Export

```bash
# Export PostgreSQL data
pg_dump $DATABASE_URL > backup.sql

# Restore from backup
psql $DATABASE_URL < backup.sql
```

---

## Continuous Deployment

Render automatically redeploys when you push to your GitHub repository:

1. Push changes to main branch
2. Render detects the change
3. Runs build command
4. Deploys new version
5. Service is updated with zero downtime

To disable auto-deployment:
1. Service → Settings → Build & Deploy
2. Toggle "Auto-Deploy" off

---

## Security Checklist

- [ ] Use strong JWT_SECRET (32+ random characters)
- [ ] Rotate API keys regularly
- [ ] Enable HTTPS (automatic with Render)
- [ ] Use environment variables for all secrets (not hardcoded)
- [ ] Set proper CORS origins
- [ ] Enable rate limiting on APIs
- [ ] Use strong database passwords
- [ ] Regularly update dependencies
- [ ] Enable database backups
- [ ] Monitor logs for suspicious activity

---

## Cost Estimation

### Typical Monthly Cost (Rough)

| Service | Plan | Cost |
|---------|------|------|
| concrete-agent | Web Service | $7/month |
| stavagent-portal | Web Service | $7/month |
| Monolit-Planner | Web Service | $7/month |
| PostgreSQL | Standard | $15/month |
| **Total** | | **~$36/month** |

Prices vary based on usage. See https://render.com/pricing for current rates.

---

## References

- **Render Docs**: https://render.com/docs
- **GitHub Integration**: https://render.com/docs/github
- **Environment Variables**: https://render.com/docs/configure-environment
- **PostgreSQL on Render**: https://render.com/docs/databases

---

## Support

- **Issues**: [GitHub Issues](https://github.com/alpro1000/STAVAGENT/issues)
- **Render Support**: https://render.com/support
- **Documentation**: See `/docs` directory

---

**Created**: November 2025
**Last Updated**: November 2025
**Status**: Production-ready
