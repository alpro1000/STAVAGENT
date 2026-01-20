# 🚀 Keep-Alive System - Complete Setup Guide

## Why This Guide?

If your website is sleeping after 15 minutes or the Keep-Alive workflow shows errors, follow this guide to set up the system correctly.

**This guide takes 10 minutes to complete.**

---

## 📋 Prerequisites

Before starting, you need:
- ✅ GitHub account with admin access to `alpro1000/STAVAGENT` repository
- ✅ Render.com account with access to these 3 services:
  - `concrete-agent`
  - `monolit-planner-api`
  - `stavagent-portal` (stav-agent)
- ✅ Terminal (Mac/Linux) or Git Bash (Windows) to generate secret key

---

## 🔑 Step 1: Generate Secret Key (1 minute)

Open terminal and run:

```bash
openssl rand -base64 32
```

**Example output:**
```
Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l
```

**❗ IMPORTANT:** Copy this key - you'll use it in Steps 2 and 3!

**Why 32 bytes?** - Provides 256-bit security (same as AES-256 encryption)

---

## 🔐 Step 2: Add Secret to GitHub (2 minutes)

### 2.1 Open GitHub Secrets Page

Go to: https://github.com/alpro1000/STAVAGENT/settings/secrets/actions

**Can't see this page?** - You need admin access to the repository.

### 2.2 Create New Secret

1. Click **"New repository secret"** (green button)
2. Fill in:
   - **Name:** `KEEP_ALIVE_KEY`
   - **Secret:** `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` (your key from Step 1)
3. Click **"Add secret"**

### 2.3 Verify Secret Created

You should see:
```
KEEP_ALIVE_KEY
Updated X minutes ago
```

**❗ CRITICAL:** Make sure the name is exactly `KEEP_ALIVE_KEY` (case-sensitive, no spaces)!

---

## ⚙️ Step 3: Add Environment Variable to Render (5 minutes)

You need to add `KEEP_ALIVE_KEY` to **ALL 3 services** on Render.

### 3.1 Service: concrete-agent

1. Open: https://dashboard.render.com
2. Find service: **concrete-agent**
3. Click on the service name
4. Go to **"Environment"** tab (left sidebar)
5. Scroll to **"Environment Variables"** section
6. Click **"Add Environment Variable"**
7. Fill in:
   - **Key:** `KEEP_ALIVE_KEY`
   - **Value:** `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` (same key from Step 1!)
8. Click **"Save Changes"**

⏳ **Wait 2-3 minutes** - Service will automatically redeploy with new variable.

### 3.2 Service: monolit-planner-api

Repeat the same steps for **monolit-planner-api**:

1. Open: https://dashboard.render.com
2. Find service: **monolit-planner-api** (or monolit-planner)
3. Environment → Add Environment Variable
4. Key: `KEEP_ALIVE_KEY`
5. Value: `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` (same key!)
6. Save Changes

⏳ Wait for redeploy (2-3 minutes)

### 3.3 Service: stavagent-portal (stav-agent)

Repeat the same steps for **stavagent-portal**:

1. Open: https://dashboard.render.com
2. Find service: **stav-agent** (or stavagent-portal)
3. Environment → Add Environment Variable
4. Key: `KEEP_ALIVE_KEY`
5. Value: `Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l` (same key!)
6. Save Changes

⏳ Wait for redeploy (2-3 minutes)

### ✅ Verification Checklist

After adding to all 3 services, verify:

| Service | KEEP_ALIVE_KEY exists? | Service redeployed? |
|---------|----------------------|---------------------|
| concrete-agent | ⬜ | ⬜ |
| monolit-planner-api | ⬜ | ⬜ |
| stavagent-portal | ⬜ | ⬜ |

**All 3 must have the SAME key value!**

---

## 🔄 Step 4: Enable GitHub Actions Workflow (1 minute)

GitHub automatically disables workflows after 60 days of repository inactivity.

### 4.1 Check Workflow Status

1. Open: https://github.com/alpro1000/STAVAGENT/actions
2. Find workflow: **"Keep-Alive Services"**
3. Check status:

| Icon | Status | What to do |
|------|--------|-----------|
| 🟢 Green checkmark | Active | ✅ Skip to Step 5 |
| ⚪ Gray circle | Disabled | ❌ Continue to 4.2 |
| 🔴 Red X | Failing | ⚠️ Continue to 4.2 |

### 4.2 Enable Workflow (if disabled)

1. Click on **"Keep-Alive Services"** workflow
2. You'll see yellow banner: *"This workflow was disabled..."*
3. Click **"Enable workflow"** button
4. Confirm by clicking **"Enable workflow"** again

### 4.3 Trigger First Run (recommended)

1. Click **"Run workflow"** dropdown (right side)
2. Select branch: `main`
3. Click green **"Run workflow"** button

⏳ Wait 1-2 minutes, then refresh page.

**Expected result:** 3 green checkmarks (one for each service)

---

## 🧪 Step 5: Test Manually (1 minute)

Test each service manually with curl to verify the key works:

### Test 1: concrete-agent

```bash
curl -i -H "X-Keep-Alive-Key: Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l" \
  https://concrete-agent.onrender.com/healthcheck
```

**Expected response:**
```
HTTP/2 200
{"status":"alive","service":"concrete-agent"}
```

### Test 2: monolit-planner-api

```bash
curl -i -H "X-Keep-Alive-Key: Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l" \
  https://monolit-planner-api.onrender.com/healthcheck
```

**Expected response:**
```
HTTP/1.1 200 OK
{"status":"alive","service":"monolit-planner"}
```

### Test 3: stavagent-portal

```bash
curl -i -H "X-Keep-Alive-Key: Kx9pL2mN8qR7tY3vZ4wA1bC5dE6fG8hI9jK0l" \
  https://stav-agent.onrender.com/healthcheck
```

**Expected response:**
```
HTTP/1.1 200 OK
{"status":"alive","service":"stavagent-portal"}
```

### ❌ If You Get 404 Errors

**Symptom:**
```
HTTP/1.1 404 Not Found
{"error":"Not found"}
```

**Causes:**
1. KEEP_ALIVE_KEY not set in Render → Go back to Step 3
2. Wrong key value → Check that all keys match Step 1
3. Service not redeployed yet → Wait 2-3 minutes

### ⏳ If You Get Timeouts or 503 Errors

**Symptom:**
```
curl: (28) Connection timed out after 30001 milliseconds
```

**Cause:** Service is sleeping (cold start). This is normal for first request after long inactivity.

**Solution:** Wait 30 seconds and try again. Keep-Alive will prevent this in the future.

---

## 📊 Step 6: Monitor for 1 Hour (passive)

After setup, monitor the workflow for 1 hour:

### 6.1 Check Workflow Runs

1. Open: https://github.com/alpro1000/STAVAGENT/actions/workflows/keep-alive.yml
2. You should see runs every 14 minutes
3. All runs should have 🟢 green checkmarks

### 6.2 Check Logs (if curious)

Click on any run → Expand each service to see logs:

**Good logs:**
```
🔄 Pinging concrete-agent...
Attempt 1 of 3...
✅ concrete-agent responded with 200 OK
📊 Keep-Alive Status for concrete-agent: success
```

**Bad logs (troubleshoot):**
```
⚠️  Received HTTP 404 (expected 200)
❌ Failed to wake concrete-agent after 3 attempts
```

---

## ✅ Success Criteria

After completing all steps, you should have:

| Criteria | Status |
|----------|--------|
| Secret key generated | ⬜ |
| GitHub Secret `KEEP_ALIVE_KEY` created | ⬜ |
| Render env var added to concrete-agent | ⬜ |
| Render env var added to monolit-planner-api | ⬜ |
| Render env var added to stavagent-portal | ⬜ |
| All 3 services redeployed | ⬜ |
| GitHub Actions workflow enabled | ⬜ |
| Manual curl tests pass (200 OK) | ⬜ |
| Workflow runs successfully every 14 minutes | ⬜ |

**All checkboxes must be ✅ for Keep-Alive to work!**

---

## 🎯 Expected Behavior After Setup

### Before Keep-Alive (without this system):

| Time | Event |
|------|-------|
| 00:00 | User opens website |
| 00:15 | Service sleeps after 15 min inactivity |
| 02:00 | User opens website → **30+ second cold start** ❌ |

### After Keep-Alive (with this system):

| Time | Event |
|------|-------|
| 00:00 | User opens website |
| 00:14 | GitHub Actions pings services |
| 00:28 | GitHub Actions pings services |
| 00:42 | GitHub Actions pings services |
| ... | Ping every 14 minutes |
| 02:00 | User opens website → **instant load** ✅ |

**Result:** Services stay warm 24/7 on Render Free Tier!

---

## 🐛 Troubleshooting

### Problem 1: Workflow Shows "Disabled"

**Cause:** GitHub auto-disables workflows after 60 days of repo inactivity.

**Solution:**
1. Go to: https://github.com/alpro1000/STAVAGENT/actions
2. Click "Keep-Alive Services"
3. Click "Enable workflow"

### Problem 2: All Services Return 404

**Cause:** KEEP_ALIVE_KEY not set on Render.

**Solution:**
1. Go to Render Dashboard for each service
2. Environment → Add `KEEP_ALIVE_KEY`
3. Save → Wait for redeploy (2-3 min)

### Problem 3: Secret KEEP_ALIVE_KEY Not Found

**Cause:** Secret not added to GitHub.

**Solution:**
1. Go to: https://github.com/alpro1000/STAVAGENT/settings/secrets/actions
2. Click "New repository secret"
3. Name: `KEEP_ALIVE_KEY`
4. Value: your generated key

### Problem 4: Some Services Work, Others Don't

**Cause:** KEEP_ALIVE_KEY not added to all 3 services on Render.

**Solution:** Check each service individually:
```bash
# Test each service
curl -H "X-Keep-Alive-Key: YOUR_KEY" https://concrete-agent.onrender.com/healthcheck
curl -H "X-Keep-Alive-Key: YOUR_KEY" https://monolit-planner-api.onrender.com/healthcheck
curl -H "X-Keep-Alive-Key: YOUR_KEY" https://stav-agent.onrender.com/healthcheck
```

If any returns 404 → KEEP_ALIVE_KEY missing on that service.

### Problem 5: Workflow Runs But Fails

**Symptom:** Workflow runs every 14 minutes but shows red X.

**Diagnosis:**
1. Click on failed run
2. Expand each service to see error
3. Look for HTTP status code (404, 500, 503)

**Common errors:**

| HTTP Code | Meaning | Solution |
|-----------|---------|----------|
| 404 | Key missing/wrong | Check Step 2 & 3 |
| 500 | Server error | Check Render logs |
| 503 | Service unavailable | Render may be down |
| 000 (timeout) | Cold start | Normal for first ping, retry works |

### Problem 6: Website Still Sleeps

**Symptom:** Website slow after 15+ minutes of inactivity.

**Diagnosis:**
1. Check if workflow is running: https://github.com/alpro1000/STAVAGENT/actions
2. Check last run time: should be within last 14 minutes
3. Check run status: all 3 services should be green

**Solution:**
- If workflow disabled → Enable it (Step 4)
- If workflow failing → Check logs and troubleshoot error
- If workflow not running → Check cron schedule in `.github/workflows/keep-alive.yml`

---

## 📖 Additional Resources

- **Diagnostic Guide:** `/KEEP_ALIVE_DIAGNOSTICS.md` - Detailed troubleshooting
- **Setup Guide:** `/KEEP_ALIVE_SETUP.md` - Technical details for developers
- **Architecture:** `/CLAUDE.md` - System architecture overview

---

## ❓ FAQ

### Q: Why every 14 minutes?

**A:** Render Free Tier sleeps services after 15 minutes of inactivity. Pinging every 14 minutes keeps them awake.

### Q: Will this cost money?

**A:** No! GitHub Actions Free Tier includes 2,000 minutes/month. This workflow uses ~1,440 minutes/month.

### Q: Can I change the ping interval?

**A:** Yes, edit `.github/workflows/keep-alive.yml` and change `cron: '*/14 * * * *'` to your desired interval.

**Warning:** Don't set below 5 minutes (too frequent) or above 14 minutes (services will sleep).

### Q: What if I don't want Keep-Alive?

**A:** You can:
1. Disable the workflow: GitHub Actions → Keep-Alive Services → Disable
2. Remove KEEP_ALIVE_KEY from Render (endpoints will return 404)
3. Keep the code (doesn't run unless configured)

### Q: Is this secure?

**A:** Yes!
- Secret key authentication prevents unauthorized pings
- Returns 404 (not 403) to hide endpoint existence
- Requests not logged (clean logs)
- Uses industry-standard 256-bit key

### Q: Why 404 instead of 403 for wrong key?

**A:** Security best practice: Don't reveal endpoint exists to unauthorized users. 404 = "endpoint not found", 403 = "endpoint exists but you're not allowed".

---

## ✅ Setup Complete!

After completing this guide:
- ✅ Services stay warm 24/7
- ✅ No more 30-second cold starts
- ✅ Website loads instantly
- ✅ Zero cost on Render Free Tier

**Questions?** Check `KEEP_ALIVE_DIAGNOSTICS.md` for troubleshooting.

---

**Last Updated:** 2026-01-20
**Version:** 1.0.0
