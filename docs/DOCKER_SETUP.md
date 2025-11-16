# 🐳 DOCKER SETUP GUIDE

> Complete Docker configuration for Concrete-Agent with PostgreSQL, Redis, and Celery

**Version:** 1.0.0
**Created:** 2025-11-16
**Status:** Production-Ready

---

## 📋 CONTENTS

1. [Docker Architecture](#docker-architecture)
2. [Docker Compose Configuration](#docker-compose-configuration)
3. [Dockerfile for Concrete-Agent](#dockerfile)
4. [Environment Configuration](#environment-configuration)
5. [Running and Managing Containers](#running-and-managing-containers)
6. [Monitoring and Logs](#monitoring-and-logs)
7. [Common Issues](#common-issues)

---

## 🏗️ DOCKER ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Network                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  concrete-agent  │  │  PostgreSQL  │  │    Redis     │  │
│  │   (FastAPI)      │◄─┤   (DB)       │  │   (Cache)    │  │
│  │   Port: 8000     │  │ Port: 5432   │  │ Port: 6379   │  │
│  └──────────────────┘  └──────────────┘  └──────────────┘  │
│         △                                                     │
│         │                                                     │
│         │ (Network: concrete-network)                        │
│         │                                                     │
│  ┌──────────────────┐  ┌──────────────────────────────────┐  │
│  │   Monolit-Plan   │  │  Celery Worker (optional)        │  │
│  │   (External)     │  │  - Task processing               │  │
│  │                  │  │  - Background jobs               │  │
│  └──────────────────┘  └──────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Services Overview

| Service | Role | Port | Image | Volume |
|---------|------|------|-------|--------|
| **concrete-agent** | API Server | 8000 | Custom | app, data, logs |
| **postgres** | Database | 5432 | postgres:16 | postgres_data |
| **redis** | Cache/Queue | 6379 | redis:7-alpine | redis_data |
| **celery-worker** | Task Queue | - | Custom | app, data, logs |
| **celery-beat** | Scheduler | - | Custom | app, data, logs |

---

## 📝 DOCKER COMPOSE CONFIGURATION

### Create `docker-compose.yml` at Project Root

```yaml
version: '3.8'

services:
  # ==========================================
  # CONCRETE-AGENT API SERVER
  # ==========================================
  concrete-agent:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: concrete-agent
    ports:
      - "8000:8000"
    environment:
      # Application Settings
      ENVIRONMENT: docker
      LOG_LEVEL: INFO

      # Database (PostgreSQL)
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/concrete_agent

      # Cache (Redis)
      REDIS_URL: redis://redis:6379/0
      SESSION_TTL: 3600
      CACHE_TTL: 300

      # Celery Queue
      CELERY_BROKER_URL: redis://redis:6379/1
      CELERY_RESULT_BACKEND: redis://redis:6379/2

      # API Keys (from .env file)
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      PERPLEXITY_API_KEY: ${PERPLEXITY_API_KEY:-}

      # JWT/Auth
      JWT_SECRET_KEY: ${JWT_SECRET_KEY:-your-secret-key-change-in-production}
      JWT_ALGORITHM: HS256

      # Feature Flags
      ENABLE_WORKFLOW_A: "true"
      ENABLE_WORKFLOW_B: "false"
      ENABLE_CELERY: "true"

    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

    volumes:
      # Mount source code for development
      - ./app:/app/app:rw
      - ./tests:/app/tests:ro
      - ./alembic:/app/alembic:rw

      # Mount data and logs
      - ./data:/app/data:rw
      - ./logs:/app/logs:rw

    networks:
      - concrete-network

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    restart: unless-stopped

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G


  # ==========================================
  # POSTGRESQL DATABASE
  # ==========================================
  postgres:
    image: postgres:16-alpine
    container_name: concrete-postgres
    environment:
      POSTGRES_DB: concrete_agent
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C.UTF-8"

    volumes:
      - postgres_data:/var/lib/postgresql/data:rw
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro

    ports:
      - "5432:5432"

    networks:
      - concrete-network

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

    restart: unless-stopped

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M


  # ==========================================
  # REDIS CACHE & MESSAGE BROKER
  # ==========================================
  redis:
    image: redis:7-alpine
    container_name: concrete-redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

    volumes:
      - redis_data:/data:rw

    ports:
      - "6379:6379"

    networks:
      - concrete-network

    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

    restart: unless-stopped

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M


  # ==========================================
  # CELERY WORKER (Optional - for background tasks)
  # ==========================================
  celery-worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: concrete-celery-worker

    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=4

    environment:
      # Same as concrete-agent service
      ENVIRONMENT: docker
      LOG_LEVEL: INFO
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/concrete_agent
      REDIS_URL: redis://redis:6379/0
      CELERY_BROKER_URL: redis://redis:6379/1
      CELERY_RESULT_BACKEND: redis://redis:6379/2
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY:-your-secret-key-change-in-production}

    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      concrete-agent:
        condition: service_healthy

    volumes:
      - ./app:/app/app:ro
      - ./data:/app/data:rw
      - ./logs:/app/logs:rw

    networks:
      - concrete-network

    restart: unless-stopped

    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M


  # ==========================================
  # CELERY BEAT (Optional - for scheduled tasks)
  # ==========================================
  celery-beat:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: concrete-celery-beat

    command: celery -A app.core.celery_app beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler

    environment:
      ENVIRONMENT: docker
      LOG_LEVEL: INFO
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/concrete_agent
      REDIS_URL: redis://redis:6379/0
      CELERY_BROKER_URL: redis://redis:6379/1
      CELERY_RESULT_BACKEND: redis://redis:6379/2
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY:-your-secret-key-change-in-production}

    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      concrete-agent:
        condition: service_healthy

    volumes:
      - ./app:/app/app:ro
      - ./logs:/app/logs:rw

    networks:
      - concrete-network

    restart: unless-stopped

    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M


# ==========================================
# NETWORKS
# ==========================================
networks:
  concrete-network:
    driver: bridge


# ==========================================
# VOLUMES
# ==========================================
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

---

## 🐳 DOCKERFILE

### Create `Dockerfile` at Project Root

```dockerfile
# Multi-stage build: development and production

# ==========================================
# STAGE 1: BASE (Python + Dependencies)
# ==========================================
FROM python:3.10-slim as base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt


# ==========================================
# STAGE 2: DEVELOPMENT
# ==========================================
FROM base as development

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs data

# Expose port
EXPOSE 8000

# Run development server with hot reload
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ==========================================
# STAGE 3: PRODUCTION
# ==========================================
FROM base as production

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV ENVIRONMENT=production

# Create non-root user for security
RUN useradd -m -u 1000 appuser

# Copy application code
COPY --chown=appuser:appuser . .

# Create logs and data directories
RUN mkdir -p logs data && chown -R appuser:appuser logs data

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run production server
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "4"]
```

---

## 📄 .DOCKERIGNORE

### Create `.dockerignore` at Project Root

```
# Python
__pycache__
*.pyc
*.pyo
*.pyd
.Python
venv
env
pip-log.txt
pip-delete-this-directory.txt
.tox
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.py,cover
.hypothesis
.pytest_cache

# IDEs
.vscode
.idea
*.swp
*.swo
*~
.DS_Store
.env.local
.env.*.local

# Git
.git
.gitignore
.gitattributes

# Documentation
docs/
README.md
CHANGELOG.md
LICENSE

# Test data
test_files/
tests/
.pytest_cache

# Large files
data/projects/
logs/
*.db
*.sqlite

# Docker
docker-compose*.yml
Dockerfile*
.dockerignore
```

---

## 🌍 ENVIRONMENT CONFIGURATION

### Create `.env` file for Docker

```env
# ==========================================
# Environment
# ==========================================
ENVIRONMENT=docker
LOG_LEVEL=INFO

# ==========================================
# API Keys
# ==========================================
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here
PERPLEXITY_API_KEY=pplx-your-key-here

# ==========================================
# Database
# ==========================================
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/concrete_agent
DB_ECHO=false  # Set to true for SQL logging

# ==========================================
# Redis
# ==========================================
REDIS_URL=redis://redis:6379/0
SESSION_TTL=3600
CACHE_TTL=300

# ==========================================
# Celery
# ==========================================
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
CELERY_TASK_TRACK_STARTED=true
CELERY_TASK_TIME_LIMIT=1800
CELERY_TASK_SOFT_TIME_LIMIT=1500

# ==========================================
# JWT/Authentication
# ==========================================
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# ==========================================
# Feature Flags
# ==========================================
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=false
ENABLE_CELERY=true
ENABLE_RATE_LIMITING=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# ==========================================
# Paths
# ==========================================
DATA_DIR=/app/data
PROJECT_DIR=/app/data/projects
KB_DIR=/app/app/knowledge_base
PROMPTS_DIR=/app/app/prompts
LOGS_DIR=/app/logs
WEB_DIR=/app/web

# ==========================================
# Monolit-Planner Integration
# ==========================================
MONOLIT_PLANNER_URL=http://monolit-planner:3000
MONOLIT_PLANNER_TOKEN=your-service-token-here
```

---

## 🚀 RUNNING AND MANAGING CONTAINERS

### Build and Start Services

```bash
# Build images
docker-compose build

# Start all services in background
docker-compose up -d

# Start with logs visible
docker-compose up

# Start specific service
docker-compose up -d concrete-agent
```

### Check Service Status

```bash
# List all running containers
docker-compose ps

# Show logs
docker-compose logs -f concrete-agent

# Show logs for specific service
docker-compose logs -f postgres

# Show logs from last 100 lines
docker-compose logs --tail=100 concrete-agent
```

### Execute Commands in Container

```bash
# Run migration
docker-compose exec concrete-agent alembic upgrade head

# Run tests
docker-compose exec concrete-agent pytest tests/

# Python shell
docker-compose exec concrete-agent python

# Access PostgreSQL
docker-compose exec postgres psql -U postgres -d concrete_agent

# Access Redis CLI
docker-compose exec redis redis-cli
```

### Scale Services

```bash
# Scale Celery workers (0-10 instances)
docker-compose up -d --scale celery-worker=3

# Check current scale
docker-compose ps
```

### Stop and Clean Up

```bash
# Stop all services
docker-compose stop

# Stop specific service
docker-compose stop concrete-agent

# Remove stopped containers
docker-compose rm

# Remove everything including volumes (DANGER!)
docker-compose down -v

# Remove images
docker image rm concrete-agent postgres redis
```

---

## 📊 MONITORING AND LOGS

### View Logs

```bash
# All services
docker-compose logs

# Follow logs (like tail -f)
docker-compose logs -f

# Specific service
docker-compose logs -f concrete-agent

# Last N lines
docker-compose logs --tail=50 concrete-agent

# Since/until timestamps
docker-compose logs --since 10m concrete-agent
```

### Monitor Resource Usage

```bash
# Real-time stats
docker stats

# Stats for specific container
docker stats concrete-agent

# Memory usage
docker ps --format "table {{.Names}}\t{{.MemoryUsage}}"
```

### Health Checks

```bash
# Check service health
docker-compose exec concrete-agent curl http://localhost:8000/health

# Check database
docker-compose exec postgres psql -U postgres -c "SELECT 1"

# Check Redis
docker-compose exec redis redis-cli ping
```

### Access Logs Directories

```bash
# API logs
docker-compose exec concrete-agent ls -lah logs/

# PostgreSQL logs
docker volume inspect concrete-agent_postgres_data

# View file in container
docker-compose exec concrete-agent cat logs/app.log
```

---

## 🆘 COMMON ISSUES & SOLUTIONS

### Issue: "Connection refused" PostgreSQL

**Symptoms:**
```
postgresql+asyncpg://... ConnectionRefusedError
```

**Solution:**
```bash
# Check if postgres is healthy
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Restart postgres
docker-compose restart postgres

# Wait for startup
docker-compose exec postgres pg_isready -U postgres
```

### Issue: "Error: ENOENT no such file or directory"

**Symptoms:**
```
FileNotFoundError: [Errno 2] No such file or directory: '/app/logs'
```

**Solution:**
```bash
# Rebuild with fresh volumes
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Issue: "Redis connection timeout"

**Symptoms:**
```
redis.exceptions.ConnectionError: Connection timeout
```

**Solution:**
```bash
# Check Redis service
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test Redis connection
docker-compose exec redis redis-cli ping

# Restart Redis
docker-compose restart redis
```

### Issue: "Out of memory" errors

**Symptoms:**
```
MemoryError or OOMKilled
```

**Solution:**
```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Edit docker-compose.yml: deploy.resources.limits.memory

# Scale down workers
docker-compose up -d --scale celery-worker=1

# Clear Redis memory
docker-compose exec redis redis-cli FLUSHALL
```

### Issue: "Port already in use"

**Symptoms:**
```
bind: address already in use
```

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill process (if safe)
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "8001:8000"
```

---

## 🔐 SECURITY BEST PRACTICES

### 1. Change Default Passwords

```bash
# Generate strong password
openssl rand -base64 32

# Update in .env
POSTGRES_PASSWORD=<generated_password>
JWT_SECRET_KEY=<generated_key>
```

### 2. Use Secrets (Production)

```yaml
# Use Docker secrets instead of .env
secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt

services:
  postgres:
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
```

### 3. Enable HTTPS (Production)

```yaml
# Use reverse proxy (nginx)
nginx:
  image: nginx:alpine
  ports:
    - "443:443"
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
    - ./ssl/:/etc/nginx/ssl:ro
```

### 4. Network Isolation

```yaml
networks:
  concrete-internal:
    internal: true  # No external access
  concrete-external:
    driver: bridge
```

---

## 📖 REFERENCES

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Redis Docker Image](https://hub.docker.com/_/redis)

---

**Last updated:** 2025-11-16
**Status:** Ready for Production ✅
