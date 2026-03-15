# FIX: Render Deployment - Port Binding Issue

## 🐛 Problem

Render deployment fails with:
```
==&gt; No open ports detected, continuing to scan...
==&gt; Port scan timeout reached, no open ports detected.
```

**Root Cause:** KB loading blocks startup event, preventing uvicorn from binding to port.

---

## ✅ Solution Applied

### 1. Suppress pdfminer Warnings
**File:** `app/main.py`
```python
# Suppress pdfminer warnings (invalid PDF patterns)
logging.getLogger("pdfminer").setLevel(logging.ERROR)
```

### 2. Enhanced Port Logging
**File:** `app/main.py`
```python
logger.info(f"🌐 Port: {os.getenv('PORT', '8000')} (Render: $PORT env var)")
logger.info("✅ System ready! Listening on 0.0.0.0:%s", os.getenv('PORT', '8000'))
```

### 3. Robust KB Loading with Error Handling
**File:** `app/core/kb_loader.py`
```python
for category in self.CATEGORIES:
    try:
        logger.info(f"📂 Processing category: {category}")
        # ... load category ...
        logger.info(f"✅ Loaded: {category}")
    except Exception as e:
        logger.error(f"❌ Failed to load category {category}: {e}", exc_info=True)
        continue  # Don't block startup if one category fails
```

---

## 🔍 Diagnostic Steps

### Step 1: Check Render Logs
```
https://dashboard.render.com/web/srv-d38odtemcj7s738gp30g/deploys/dep-XXXXX
```

**Expected logs:**
```
🚀 Czech Building Audit System Starting...
🌐 Port: 10000 (Render: $PORT env var)
📂 Processing category: B1_otkskp_codes
✅ Loaded: B1_otkskp_codes
📂 Processing category: B1_rts_codes
✅ Loaded: B1_rts_codes
...
✨ Knowledge Base loaded in X.XXs
✅ System ready! Listening on 0.0.0.0:10000
```

**If stuck after "✅ Loaded: B3_current_prices":**
- Next category (B4/B5/B6) is hanging
- Check if PDF files in that category are corrupted
- Check if pdfplumber can parse them

### Step 2: Verify render.yaml
```yaml
startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
✅ Already correct - uses `$PORT` env var

### Step 3: Test Locally
```bash
cd concrete-agent/packages/core-backend

# Simulate Render environment
export PORT=10000
export ENVIRONMENT=production

# Start server
uvicorn app.main:app --host 0.0.0.0 --port $PORT

# In another terminal, check port
curl http://localhost:10000/health
```

**Expected:** `{"status": "healthy"}`

---

## 🚨 Common Issues

### Issue 1: KB Loading Hangs on PDF
**Symptom:** Logs stop after "✅ Loaded: B3_current_prices"

**Solution:**
1. Check which category comes next (B4_production_benchmarks)
2. Check if PDF files in that folder are valid
3. Temporarily skip problematic category:
   ```python
   # In kb_loader.py
   CATEGORIES = [
       "B1_otkskp_codes",
       "B1_rts_codes",
       "B1_urs_codes",
       "B2_csn_standards",
       "B3_current_prices",
       # "B4_production_benchmarks",  # Skip if problematic
       "B5_tech_cards",
       ...
   ]
   ```

### Issue 2: Port Already in Use (Local Dev)
**Symptom:** `OSError: [Errno 48] Address already in use`

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>
```

### Issue 3: Missing Environment Variables
**Symptom:** Server starts but API calls fail

**Solution:** Check Render Dashboard → Environment Variables:
- ✅ `GOOGLE_API_KEY` (required for Gemini)
- ✅ `ANTHROPIC_API_KEY` (optional)
- ✅ `OPENAI_API_KEY` (optional)
- ✅ `MULTI_ROLE_LLM=gemini`

---

## 🧪 Testing After Deployment

### Test 1: Health Check
```bash
curl https://concrete-agent-1086027517695.europe-west3.run.app/health
```
**Expected:** `{"status": "healthy"}`

### Test 2: Root Endpoint
```bash
curl https://concrete-agent-1086027517695.europe-west3.run.app/
```
**Expected:** `{"status": "ok", "docs": "/docs"}`

### Test 3: API Docs
```
https://concrete-agent-1086027517695.europe-west3.run.app/docs
```
**Expected:** Swagger UI loads

### Test 4: Multi-Role API
```bash
curl -X POST "https://concrete-agent-1086027517695.europe-west3.run.app/api/v1/multi-role/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "Test Project",
    "description": "Betonáž základové desky 100 m²",
    "enable_kros_matching": true
  }'
```
**Expected:** JSON response with analysis

---

## 📊 Performance Expectations

| Metric | Expected | Actual |
|--------|----------|--------|
| KB Load Time | 5-15s | Check logs |
| Server Start | 20-30s | Check logs |
| First Request | 2-5s | Test /health |
| Port Binding | Immediate | Check "Listening on" log |

---

## 🔧 Emergency Rollback

If deployment fails completely:

### Option 1: Revert to Previous Deploy
```
Render Dashboard → Deploys → Select working deploy → Redeploy
```

### Option 2: Disable KB Loading Temporarily
```python
# In app/main.py startup_event()
# Comment out KB loading:
# try:
#     from app.core.kb_loader import init_kb_loader
#     kb_loader = init_kb_loader()
# except Exception as e:
#     logger.error(f"⚠️  KB loading failed: {str(e)}")
```

### Option 3: Use Minimal KB
```python
# In kb_loader.py
CATEGORIES = [
    "B1_otkskp_codes",  # Only essential categories
    "B3_current_prices",
]
```

---

## 📝 Deployment Checklist

Before deploying:
- [ ] Test locally with `PORT=10000`
- [ ] Check all PDF files are valid
- [ ] Verify environment variables in Render
- [ ] Check render.yaml has correct startCommand
- [ ] Review recent code changes

After deploying:
- [ ] Monitor logs for "✅ System ready!"
- [ ] Test /health endpoint
- [ ] Test /docs endpoint
- [ ] Test Multi-Role API
- [ ] Check response times

---

## 🆘 Support

If issue persists:
1. Check full logs in Render Dashboard
2. Look for Python exceptions after "✅ Loaded: B3_current_prices"
3. Test PDF parsing locally: `python -c "import pdfplumber; pdfplumber.open('file.pdf')"`
4. Contact Render support if infrastructure issue

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** 🟡 Investigating KB loading hang
