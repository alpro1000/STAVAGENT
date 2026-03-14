# Deployment Guide: Google Cloud Run

**How to deploy StavAgent services to Google Cloud Run**

---

## Overview

StavAgent is deployed on Google Cloud Platform with the following architecture:

```
StavAgent Monorepo (GitHub)
    ↓ push to main
    ├── Cloud Build (per-service triggers)
    │   ├── cloudbuild-concrete.yaml  → concrete-agent
    │   ├── cloudbuild-monolit.yaml   → monolit-planner-api
    │   ├── cloudbuild-portal.yaml    → stavagent-portal-backend
    │   ├── cloudbuild-urs.yaml       → urs-matcher-service
    │   └── cloudbuild-registry.yaml  → rozpocet-registry-backend
    ↓
    ├── Artifact Registry (Docker images)
    │   europe-west3-docker.pkg.dev/$PROJECT_ID/stavagent/
    ↓
    ├── Cloud Run (5 backends, europe-west3)
    ↓
    └── Cloud SQL PostgreSQL 15 (stavagent-db)
         ├── stavagent_portal
         ├── monolit_planner
         └── rozpocet_registry

Frontends: Vercel (auto-deploy from GitHub)
```

**Key Points:**
- **Single monorepo** on GitHub
- **Five independent backends** deployed as Cloud Run services
- **Cloud Build triggers** deploy only changed services (push to main)
- **Cloud SQL PostgreSQL 15** shared database (instance: `stavagent-db`)
- **Secret Manager** for API keys and credentials
- **Frontends** deployed separately on Vercel

---

## Prerequisites

1. **GCP Project** with billing enabled
2. **APIs enabled:**
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
   - Cloud SQL Admin API
   - Secret Manager API
3. **GitHub** connected to Cloud Build
4. **gcloud CLI** installed and authenticated

---

## Production URLs

| Service | Type | URL |
|---------|------|-----|
| concrete-agent (CORE) | Cloud Run | https://concrete-agent-3uxelthc4q-ey.a.run.app |
| stavagent-portal | Cloud Run | https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app |
| stavagent-portal | Vercel | https://www.stavagent.cz |
| Monolit-Planner | Cloud Run | https://monolit-planner-api-3uxelthc4q-ey.a.run.app |
| Monolit-Planner | Vercel | https://monolit-planner-frontend.vercel.app |
| URS_MATCHER_SERVICE | Cloud Run | https://urs-matcher-service-3uxelthc4q-ey.a.run.app |
| rozpocet-registry | Cloud Run | https://rozpocet-registry-backend-3uxelthc4q-ey.a.run.app |
| rozpocet-registry | Vercel | https://stavagent-backend-ktwx.vercel.app |

---

## CI/CD: Cloud Build

### How it works

1. Push changes to `main` branch
2. Cloud Build trigger detects which service changed (via `includedFiles` filter)
3. Guard step verifies files actually changed (`git diff`)
4. Docker image built and pushed to Artifact Registry
5. Cloud Run service updated with new image

### Trigger configuration

Each service has a trigger file in `triggers/`:

```
triggers/
├── concrete-agent.yaml     → watches concrete-agent/**
├── monolit.yaml            → watches Monolit-Planner/**
├── portal.yaml             → watches stavagent-portal/**
├── urs.yaml                → watches URS_MATCHER_SERVICE/**
└── registry.yaml           → watches rozpocet-registry-backend/**
```

### Import triggers

```bash
gcloud builds triggers import --source=triggers/concrete-agent.yaml
gcloud builds triggers import --source=triggers/monolit.yaml
gcloud builds triggers import --source=triggers/portal.yaml
gcloud builds triggers import --source=triggers/urs.yaml
gcloud builds triggers import --source=triggers/registry.yaml
```

### Manual deploy

```bash
# Deploy a specific service manually
gcloud builds submit --config=cloudbuild-concrete.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-monolit.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-portal.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-urs.yaml --region=europe-west3
gcloud builds submit --config=cloudbuild-registry.yaml --region=europe-west3
```

---

## Database: Cloud SQL

**Instance:** `stavagent-db` (PostgreSQL 15, europe-west3)

**Databases:**
- `stavagent_portal` — Portal service
- `monolit_planner` — Monolit Planner service
- `rozpocet_registry` — Registry backend

**Connection:** Cloud SQL Proxy (automatic via `--add-cloudsql-instances` in cloudbuild)

---

## Secrets: Secret Manager

All sensitive values stored in GCP Secret Manager:

| Secret Name | Used By | Description |
|-------------|---------|-------------|
| `PORTAL_DATABASE_URL` | stavagent-portal | PostgreSQL connection string |
| `MONOLIT_DATABASE_URL` | monolit-planner-api | PostgreSQL connection string |
| `REGISTRY_DATABASE_URL` | rozpocet-registry-backend | PostgreSQL connection string |
| `JWT_SECRET` | stavagent-portal | JWT signing key |
| `GOOGLE_API_KEY` | concrete-agent | Gemini API key |
| `ANTHROPIC_API_KEY` | concrete-agent, urs-matcher | Claude API key |
| `GOOGLE_AI_KEY` | urs-matcher | Google AI key |
| `OPENAI_API_KEY` | urs-matcher | OpenAI API key |
| `PPLX_API_KEY` | urs-matcher | Perplexity API key |

### Create a secret

```bash
echo -n "secret-value" | gcloud secrets create SECRET_NAME --data-file=-
```

### Update a secret

```bash
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-
```

---

## Monitoring & Troubleshooting

### View logs

```bash
gcloud run services logs read concrete-agent --region europe-west3 --limit 50
gcloud run services logs read monolit-planner-api --region europe-west3 --limit 50
```

### Check service status

```bash
gcloud run services describe concrete-agent --region europe-west3 --format="value(status.url)"
```

### Health checks

```bash
curl https://concrete-agent-3uxelthc4q-ey.a.run.app/health
curl https://monolit-planner-api-3uxelthc4q-ey.a.run.app/health
curl https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app/health
curl https://urs-matcher-service-3uxelthc4q-ey.a.run.app/health
curl https://rozpocet-registry-backend-3uxelthc4q-ey.a.run.app/health
```

### Common issues

**Service Won't Start:**
- Check Cloud Build logs: `gcloud builds list --limit 5`
- Check Cloud Run logs in GCP Console
- Verify Dockerfile builds locally

**Database Connection Error:**
- Verify `--add-cloudsql-instances` flag in cloudbuild
- Check Cloud SQL instance is running
- Verify secret exists: `gcloud secrets versions access latest --secret=DATABASE_URL_SECRET`

---

## Cost Optimization

- **Cloud Run:** Pay only for requests (min instances = 0 by default)
- **Cloud SQL:** Shared instance for all services
- **Artifact Registry:** Cleanup old images periodically
- **Keep-Alive:** GitHub Actions prevents cold starts (see KEEP_ALIVE_SETUP.md)

---

**Created:** November 2025 (Render)
**Migrated to GCP:** March 2026
**Last Updated:** 2026-03-14
