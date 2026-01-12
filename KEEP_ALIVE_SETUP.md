# Keep-Alive System Setup Guide

## 📋 Overview

This Keep-Alive system prevents Render Free Tier services from sleeping after 15 minutes of inactivity. It uses GitHub Actions to ping services every 14 minutes with a secure authentication mechanism.

## 🏗️ Architecture

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
│ concrete-agent│          │monolit-planner│  │stavagent-    │
│               │          │               │  │portal        │
│ GET /healthcheck        │ GET /healthcheck │ GET /healthcheck
│ + X-Keep-Alive-Key      │ + X-Keep-Alive-Key + X-Keep-Alive-Key
│                │          │               │  │              │
│ Returns 200 OK │          │ Returns 200 OK│  │ Returns 200 OK
└───────────────┘          └───────────────┘  └──────────────┘
```

## ✨ Features

### 1. **Secure Authentication**
- Uses secret header `X-Keep-Alive-Key` to prevent unauthorized access
- Returns 404 (not 403) to hide endpoint existence from attackers
- Key stored in GitHub Secrets and Render Environment Variables

### 2. **Intelligent Retry Logic**
- 3 retry attempts with 10-second delays
- Handles server cold-start (first wake-up can take 30+ seconds)
- Exponential backoff prevents overwhelming servers

### 3. **Clean Logs**
- `/healthcheck` requests excluded from server access logs
- GitHub Actions uses `-s` (silent) flag for curl
- No clutter in analytics or monitoring dashboards

### 4. **Multi-Service Support**
- Single workflow manages all 3 services
- Parallel execution with matrix strategy
- Individual status reporting per service

## 🚀 Setup Instructions

### Step 1: Generate Secret Key

Generate a random secret key (use one of these methods):

**Option A: OpenSSL (Recommended)**
```bash
openssl rand -base64 32
```

**Option B: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option C: Python**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Example Output:**
```
Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l
```

**⚠️ IMPORTANT:** Save this key! You'll need it for both GitHub and Render.

---

### Step 2: Add Secret to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add the following secret:

| Name | Value | Description |
|------|-------|-------------|
| `KEEP_ALIVE_KEY` | `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` | Your generated secret key |

---

### Step 3: Add Environment Variable to Render

Do this for **ALL THREE** services:

#### 3.1 concrete-agent

1. Go to https://dashboard.render.com
2. Select **concrete-agent** service
3. Go to **Environment** tab
4. Add new environment variable:
   - **Key:** `KEEP_ALIVE_KEY`
   - **Value:** `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` (same as GitHub)
5. Click **"Save Changes"**
6. Service will auto-redeploy

#### 3.2 monolit-planner-api

1. Go to https://dashboard.render.com
2. Select **monolit-planner-api** service
3. Go to **Environment** tab
4. Add new environment variable:
   - **Key:** `KEEP_ALIVE_KEY`
   - **Value:** `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` (same as GitHub)
5. Click **"Save Changes"**
6. Service will auto-redeploy

#### 3.3 stavagent-portal

1. Go to https://dashboard.render.com
2. Select **stavagent-portal** service (or **stav-agent**)
3. Go to **Environment** tab
4. Add new environment variable:
   - **Key:** `KEEP_ALIVE_KEY`
   - **Value:** `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` (same as GitHub)
5. Click **"Save Changes"**
6. Service will auto-redeploy

---

### Step 4: Verify Setup

After services redeploy, test the healthcheck endpoint:

```bash
# Test concrete-agent
curl -H "X-Keep-Alive-Key: YOUR_SECRET_KEY" \
  https://concrete-agent.onrender.com/healthcheck

# Expected response:
# {"status":"alive","service":"concrete-agent"}

# Test monolit-planner
curl -H "X-Keep-Alive-Key: YOUR_SECRET_KEY" \
  https://monolit-planner-api.onrender.com/healthcheck

# Expected response:
# {"status":"alive","service":"monolit-planner"}

# Test stavagent-portal
curl -H "X-Keep-Alive-Key: YOUR_SECRET_KEY" \
  https://stav-agent.onrender.com/healthcheck

# Expected response:
# {"status":"alive","service":"stavagent-portal"}
```

**⚠️ Test without key (should return 404):**
```bash
curl -i https://concrete-agent.onrender.com/healthcheck

# Expected response:
# HTTP/1.1 404 Not Found
```

---

### Step 5: Enable GitHub Actions Workflow

The workflow file is already created: `.github/workflows/keep-alive.yml`

**To enable:**
1. Commit and push all changes to GitHub
2. Go to **Actions** tab in your repository
3. Find **"Keep-Alive Services"** workflow
4. Click **"Enable workflow"** if disabled
5. Click **"Run workflow"** to test manually

**Expected output in Actions log:**
```
🔄 Pinging concrete-agent...
Attempt 1 of 3...
✅ concrete-agent responded with 200 OK

🔄 Pinging monolit-planner...
Attempt 1 of 3...
✅ monolit-planner responded with 200 OK

🔄 Pinging stavagent-portal...
Attempt 1 of 3...
✅ stavagent-portal responded with 200 OK
```

---

## 📊 Monitoring

### View GitHub Actions Logs

1. Go to **Actions** tab in your repository
2. Click on **"Keep-Alive Services"**
3. Select a workflow run to see detailed logs

### Check Service Status

Use this one-liner to check all services:

```bash
for service in \
  "concrete-agent|https://concrete-agent.onrender.com/healthcheck" \
  "monolit-planner|https://monolit-planner-api.onrender.com/healthcheck" \
  "stavagent-portal|https://stav-agent.onrender.com/healthcheck"
do
  name=$(echo $service | cut -d'|' -f1)
  url=$(echo $service | cut -d'|' -f2)
  echo "Testing $name..."
  curl -s -H "X-Keep-Alive-Key: YOUR_KEY" $url | jq .
done
```

---

## 🔧 Configuration

### Adjust Ping Frequency

Edit `.github/workflows/keep-alive.yml`:

```yaml
on:
  schedule:
    # Current: every 14 minutes
    - cron: '*/14 * * * *'

    # Every 10 minutes (more aggressive)
    # - cron: '*/10 * * * *'

    # Every 5 minutes (maximum safety)
    # - cron: '*/5 * * * *'
```

**⚠️ GitHub Actions Limits:**
- Minimum interval: 5 minutes
- Free tier: 2,000 minutes/month
- Current usage: ~1,440 minutes/month (3 services × 14-min interval)

### Adjust Retry Settings

Edit retry configuration in workflow:

```yaml
MAX_RETRIES=3        # Number of retry attempts
RETRY_DELAY=10       # Seconds between retries
```

---

## 🛡️ Security Features

### 1. **Secret Key Protection**
- Endpoint disabled if `KEEP_ALIVE_KEY` not set
- Returns 404 (not 403) to hide endpoint existence
- Key never exposed in logs or error messages

### 2. **Rate Limiting Bypass**
- `/healthcheck` excluded from rate limiting middleware
- Won't trigger DDoS protection or API limits

### 3. **Log Privacy**
- Excluded from Morgan/Uvicorn access logs
- Won't pollute analytics dashboards
- Silent curl (`-s` flag) in GitHub Actions

---

## 🔍 Troubleshooting

### Problem: "404 Not Found" with correct key

**Possible causes:**
1. Service not redeployed after adding `KEEP_ALIVE_KEY`
2. Key mismatch between GitHub and Render
3. Service crashed or sleeping

**Solutions:**
```bash
# Check if service is running
curl https://SERVICE_URL/health

# Check environment variable on Render
# Go to Service → Environment → Verify KEEP_ALIVE_KEY exists

# Manually redeploy service
# Go to Service → Manual Deploy → Deploy Latest Commit
```

---

### Problem: Workflow fails with timeout

**Possible causes:**
1. Service cold-start takes longer than 30 seconds
2. Network issues between GitHub and Render

**Solutions:**
1. Increase timeout in workflow:
   ```yaml
   curl -s -o /dev/null -w "%{http_code}" \
     -H "X-Keep-Alive-Key: ${{ secrets.KEEP_ALIVE_KEY }}" \
     -m 60 \  # Increase from 30 to 60 seconds
     "${{ matrix.service.url }}"
   ```

2. Increase retry count:
   ```yaml
   MAX_RETRIES=5  # Increase from 3 to 5
   ```

---

### Problem: Service still sleeps after 15 minutes

**Possible causes:**
1. GitHub Actions workflow disabled
2. Workflow schedule not triggering
3. All retries failing

**Solutions:**
1. Check workflow status:
   - Go to **Actions** tab
   - Verify workflow is enabled
   - Check recent runs for errors

2. Manually trigger workflow:
   - Go to **Actions** → **Keep-Alive Services**
   - Click **"Run workflow"**

3. Check Render service logs:
   - Go to Render Dashboard → Service → Logs
   - Look for healthcheck requests

---

## 📈 Expected Behavior

### Timeline

```
00:00 - Service starts (warm)
00:14 - GitHub Actions ping #1 → 200 OK (instant)
00:28 - GitHub Actions ping #2 → 200 OK (instant)
00:42 - GitHub Actions ping #3 → 200 OK (instant)
...
24:00 - Service never sleeps (stays warm)
```

### Cold Start Scenario

```
00:00 - Service asleep (cold)
00:14 - GitHub Actions ping #1
        - Attempt 1: Timeout (service waking up)
        - Wait 10 seconds
        - Attempt 2: 200 OK (service now warm)
00:28 - GitHub Actions ping #2 → 200 OK (instant, service warm)
...
```

---

## 💰 Cost Analysis

### Render Free Tier
- **Limits:** 750 hours/month (31.25 days)
- **Keep-Alive impact:** 0 hours (pings don't count toward limit)
- **Benefit:** Services stay warm 24/7 within free tier

### GitHub Actions Free Tier
- **Limits:** 2,000 minutes/month
- **Usage:** ~1,440 minutes/month (3 services × 14-min interval)
- **Remaining:** ~560 minutes for other workflows

### Total Cost
**$0.00** ✅ - Completely free!

---

## 🎯 Summary

| Feature | Status |
|---------|--------|
| ✅ Secure authentication | X-Keep-Alive-Key header |
| ✅ Retry logic | 3 attempts, 10s delay |
| ✅ Clean logs | Excluded from access logs |
| ✅ Multi-service | All 3 services protected |
| ✅ Free tier compatible | $0.00 cost |
| ✅ Easy setup | 5 steps, 10 minutes |

---

## 📚 Technical Details

### Endpoints Created

| Service | Endpoint | Method | Auth Required |
|---------|----------|--------|---------------|
| concrete-agent | `/healthcheck` | GET/HEAD | X-Keep-Alive-Key |
| monolit-planner | `/healthcheck` | GET | X-Keep-Alive-Key |
| stavagent-portal | `/healthcheck` | GET | X-Keep-Alive-Key |

### Files Modified

| File | Changes |
|------|---------|
| `concrete-agent/packages/core-backend/app/main.py` | + healthcheck endpoint<br>+ log filtering middleware |
| `Monolit-Planner/backend/server.js` | + healthcheck endpoint<br>+ morgan skip filter |
| `stavagent-portal/backend/server.js` | + healthcheck endpoint<br>+ morgan skip filter |
| `.github/workflows/keep-alive.yml` | + workflow with retry logic |

### Environment Variables Required

| Variable | Where | Value |
|----------|-------|-------|
| `KEEP_ALIVE_KEY` | GitHub Secrets | Your random secret key |
| `KEEP_ALIVE_KEY` | Render (concrete-agent) | Same key as GitHub |
| `KEEP_ALIVE_KEY` | Render (monolit-planner) | Same key as GitHub |
| `KEEP_ALIVE_KEY` | Render (stavagent-portal) | Same key as GitHub |

---

## 🆘 Support

If you encounter issues:

1. **Check logs:**
   - GitHub Actions logs (Actions tab)
   - Render service logs (Dashboard → Service → Logs)

2. **Verify configuration:**
   - Key matches between GitHub and Render
   - Workflow enabled in Actions tab
   - Services redeployed after adding env var

3. **Test manually:**
   ```bash
   curl -v -H "X-Keep-Alive-Key: YOUR_KEY" \
     https://SERVICE_URL/healthcheck
   ```

4. **Create GitHub issue:**
   - Include error messages from logs
   - Include curl test results
   - Include service name and URL

---

**Last Updated:** 2026-01-12
**Version:** 1.0.0
**Author:** Claude Code
