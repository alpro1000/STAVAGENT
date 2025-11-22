# URS Matcher Service - Deployment Guide

## Local Development

### Quick Start (Docker)

```bash
# Clone/navigate to project
cd URS_MATCHER_SERVICE

# Start services
docker-compose up

# Access
http://localhost:3001
```

### Manual Development Setup

**Requirements:** Node.js 18+, SQLite3

```bash
# Backend
cd backend
npm install
npm run init-db
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm start
```

---

## Docker Deployment (Production)

### Build Images

```bash
docker-compose build
```

### Run Services

```bash
docker-compose up -d
```

### Check Status

```bash
docker-compose ps
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services

```bash
docker-compose down
```

---

## Cloud Deployment

### Option 1: Render.com

1. **Create services on Render:**
   - Backend: Web Service (Node.js)
   - Frontend: Static Site
   - PostgreSQL: Database (optional)

2. **Backend Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=<your_postgres_url>
   LOG_LEVEL=info
   CORS_ORIGIN=https://<your-frontend-url>
   ```

3. **Deploy:**
   ```bash
   git push origin main
   ```

### Option 2: DigitalOcean App Platform

1. **Create app spec (app.yaml):**
   ```yaml
   name: urs-matcher-service
   services:
     - name: backend
       github:
         branch: main
         repo: your-repo
       build_command: "npm install"
       run_command: "npm start"
       envs:
         - key: NODE_ENV
           value: production
         - key: DATABASE_URL
           scope: RUN_TIME
   ```

2. **Deploy:**
   ```bash
   doctl apps create --spec app.yaml
   ```

### Option 3: Docker Swarm / Kubernetes

**For large-scale deployment with orchestration:**

```bash
# Docker Swarm
docker swarm init
docker stack deploy -c docker-compose.yml urs-matcher

# Kubernetes (requires helm chart - create separately)
helm install urs-matcher ./helm
```

---

## Configuration

### Environment Variables

Create `.env` file:

```bash
# Backend
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/urs_matcher
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.com

# LLM (MVP-2)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Perplexity (MVP-3)
PERPLEXITY_API_KEY=pplx-...

# UI
UPLOAD_MAX_SIZE=50mb
CACHE_ENABLED=true
```

### Database Configuration

**SQLite (Development):**
```
DATABASE_URL=file:./data/urs_matcher.db
```

**PostgreSQL (Production):**
```
DATABASE_URL=postgresql://user:password@localhost:5432/urs_matcher
```

---

## Reverse Proxy Setup (Nginx)

```nginx
upstream urs_backend {
    server backend:3001;
}

server {
    listen 80;
    server_name urs-matcher.example.com;

    location / {
        proxy_pass http://urs_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## SSL/HTTPS Configuration

### Using Let's Encrypt with Certbot

```bash
certbot certonly --standalone -d urs-matcher.example.com

# Update Nginx config
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/urs-matcher.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/urs-matcher.example.com/privkey.pem;
    # ... rest of config
}
```

---

## Monitoring & Logging

### Logs

```bash
# Docker
docker-compose logs -f backend
docker-compose logs -f frontend

# System logs
journalctl -u docker -n 100

# Application logs
tail -f /var/log/urs-matcher/app.log
```

### Health Check

```bash
curl http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "service": "URS Matcher Service",
  "timestamp": "2025-11-22T10:00:00Z",
  "database": "connected"
}
```

### Monitoring Tools

- **Uptime Monitoring:** UptimeRobot, Pingdom
- **Error Tracking:** Sentry, LogRocket
- **Performance:** NewRelic, Datadog

---

## Backup & Recovery

### Database Backup (SQLite)

```bash
# Manual backup
cp data/urs_matcher.db data/urs_matcher.db.backup.$(date +%Y%m%d)

# Automated backup (cron)
0 2 * * * cp /app/data/urs_matcher.db /backups/urs_matcher.db.$(date +\%Y\%m\%d)
```

### Database Backup (PostgreSQL)

```bash
# Backup
pg_dump urs_matcher > backup_$(date +%Y%m%d).sql

# Restore
psql urs_matcher < backup_20251122.sql
```

---

## Scaling

### Horizontal Scaling (Multiple Instances)

```bash
docker-compose up -d --scale backend=3
```

### Load Balancing

Use HAProxy or Nginx as load balancer:

```
http://lb:80 -> backend1:3001
              -> backend2:3001
              -> backend3:3001
```

---

## Troubleshooting

### "Connection refused" on startup

```bash
# Ensure database is ready
docker-compose logs postgres

# Restart services in order
docker-compose restart backend
docker-compose restart frontend
```

### Out of memory

```bash
# Increase container limits
docker-compose down
# Edit docker-compose.yml, add:
# mem_limit: 1g
docker-compose up -d
```

### SSL certificate errors

```bash
# Renew certificate
certbot renew

# Restart Nginx
systemctl restart nginx
```

---

## CI/CD Setup (GitHub Actions)

**.github/workflows/deploy.yml:**

```yaml
name: Deploy URS Matcher

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          ssh user@server 'cd /app && git pull && docker-compose up -d'
```

---

## Performance Optimization

### Caching

```bash
# Redis (optional)
docker run -d -p 6379:6379 redis:latest
```

### Database Indexing

```sql
CREATE INDEX idx_urs_code ON urs_items(urs_code);
CREATE INDEX idx_job_created ON jobs(created_at);
```

### Frontend Optimization

- Enable gzip compression
- Minify CSS/JS
- Cache static assets (1 hour)
- Use CDN for static files

---

## Support

- **Logs:** `docker-compose logs -f`
- **Health:** `curl http://localhost:3001/health`
- **Documentation:** See main README.md
- **Issues:** Report via GitHub Issues

---

**Version:** 1.0
**Last Updated:** November 2025
