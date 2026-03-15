# Keep-Alive System Setup Guide

## Overview

This Keep-Alive system prevents Google Cloud Run services from going cold. It uses GitHub Actions to ping services every 14 minutes with a secure authentication mechanism.

**Platform:** Google Cloud Run (europe-west3)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Actions (Cron)                      │
│               Runs every 14 minutes (*/14)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┬─────────────────┐
        │                           │                 │
        ▼                           ▼                 ▼
┌───────────────┐          ┌───────────────┐  ┌──────────────┐
│ concrete-agent│          │monolit-planner│  │urs-matcher   │
│ (Cloud Run)   │          │ (Cloud Run)   │  │ (Cloud Run)  │
│               │          │               │  │              │
│ GET /healthcheck         │ GET /healthcheck │ GET /health  │
│ + X-Keep-Alive-Key       │ + X-Keep-Alive-Key + X-Keep-Alive-Key
│ Returns 200 OK│          │ Returns 200 OK│  │ Returns 200 OK
└───────────────┘          └───────────────┘  └──────────────┘
```

## Features

### 1. Secure Authentication
- Uses secret header `X-Keep-Alive-Key` to prevent unauthorized access
- Returns 404 (not 403) to hide endpoint existence from attackers
- Key stored in GitHub Secrets and Cloud Run environment

### 2. Intelligent Retry Logic
- 3 retry attempts with 10-second delays
- Handles cold-start (first wake-up can take 10-30 seconds on Cloud Run)

### 3. Clean Logs
- `/healthcheck` requests excluded from server access logs
- GitHub Actions uses `-s` (silent) flag for curl

### 4. Multi-Service Support
- Single workflow manages all 3 services
- Parallel execution with matrix strategy

## Setup Instructions

### Step 1: Generate Secret Key

```bash
openssl rand -base64 32
```

Save this key for both GitHub and GCP.

### Step 2: Add Secret to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add: `KEEP_ALIVE_KEY` = your generated key

### Step 3: Add Secret to GCP Secret Manager

```bash
# Create the secret
echo -n "YOUR_SECRET_KEY" | gcloud secrets create KEEP_ALIVE_KEY --data-file=-

# Grant access to Cloud Run services
gcloud secrets add-iam-policy-binding KEEP_ALIVE_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Or add as environment variable directly to each Cloud Run service:

```bash
gcloud run services update concrete-agent \
  --update-env-vars KEEP_ALIVE_KEY=YOUR_SECRET_KEY \
  --region europe-west3

gcloud run services update monolit-planner-api \
  --update-env-vars KEEP_ALIVE_KEY=YOUR_SECRET_KEY \
  --region europe-west3

gcloud run services update urs-matcher-service \
  --update-env-vars KEEP_ALIVE_KEY=YOUR_SECRET_KEY \
  --region europe-west3
```

### Step 4: Verify Setup

```bash
# Test concrete-agent
curl -H "X-Keep-Alive-Key: YOUR_SECRET_KEY" \
  https://concrete-agent-1086027517695.europe-west3.run.app/healthcheck

# Test monolit-planner
curl -H "X-Keep-Alive-Key: YOUR_SECRET_KEY" \
  https://monolit-planner-api-1086027517695.europe-west3.run.app/healthcheck

# Test urs-matcher
curl -H "X-Keep-Alive-Key: YOUR_SECRET_KEY" \
  https://urs-matcher-service-1086027517695.europe-west3.run.app/health

# Without key (should return 404)
curl -i https://concrete-agent-1086027517695.europe-west3.run.app/healthcheck
```

### Step 5: Enable GitHub Actions Workflow

The workflow file: `.github/workflows/keep-alive.yml`

1. Go to **Actions** tab in your repository
2. Find **"Keep-Alive Services"** workflow
3. Click **"Enable workflow"** if disabled
4. Click **"Run workflow"** to test manually

## Configuration

### Adjust Ping Frequency

Edit `.github/workflows/keep-alive.yml`:

```yaml
on:
  schedule:
    - cron: '*/14 * * * *'    # Every 14 minutes (current)
    # - cron: '*/10 * * * *'  # Every 10 minutes (more aggressive)
```

**GitHub Actions Free Tier:**
- 2,000 minutes/month
- Current usage: ~1,440 minutes/month (3 services x 14-min interval)

## Troubleshooting

### "404 Not Found" with correct key
1. Verify KEEP_ALIVE_KEY is set in Cloud Run env
2. Key mismatch between GitHub and Cloud Run
3. Redeploy the service after adding the env var

### Workflow fails with timeout
1. Cloud Run cold-start takes longer than 30 seconds
2. Increase timeout: `-m 60` in curl command
3. Increase retry count: `MAX_RETRIES=5`

## Endpoints

| Service | Endpoint | Method | Auth |
|---------|----------|--------|------|
| concrete-agent | `/healthcheck` | GET/HEAD | X-Keep-Alive-Key |
| monolit-planner | `/healthcheck` | GET | X-Keep-Alive-Key |
| urs-matcher | `/health` | GET | X-Keep-Alive-Key |

## Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `KEEP_ALIVE_KEY` | GitHub Secrets | Your random secret key |
| `KEEP_ALIVE_KEY` | Cloud Run (concrete-agent) | Same key as GitHub |
| `KEEP_ALIVE_KEY` | Cloud Run (monolit-planner) | Same key as GitHub |
| `KEEP_ALIVE_KEY` | Cloud Run (urs-matcher) | Same key as GitHub |

---

**Last Updated:** 2026-03-14
**Version:** 2.0.0
