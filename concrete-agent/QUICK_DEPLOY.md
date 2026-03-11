# Quick Deploy Instructions - Render Port Binding Fix

## 🎯 Changes Made

### 1. Suppress pdfminer Warnings
- **File:** `concrete-agent/packages/core-backend/app/main.py`
- **Change:** Added `logging.getLogger("pdfminer").setLevel(logging.ERROR)`
- **Impact:** Cleaner logs (removes 100+ warnings)

### 2. Enhanced Port Logging
- **File:** `concrete-agent/packages/core-backend/app/main.py`
- **Change:** Log PORT env var at startup and ready state
- **Impact:** Better diagnostics for Render deployment

### 3. Robust KB Loading
- **File:** `concrete-agent/packages/core-backend/app/core/kb_loader.py`
- **Changes:**
  - Try-catch around each category loading
  - Detailed logging for each file
  - PDF size limit (50MB) and page limit (50 pages)
  - Skip problematic PDFs instead of crashing
- **Impact:** Prevents KB loading from blocking server startup

### 4. Removed Redundant PDF Files
- **Folders:** `B3_current_prices/` and `B4_production_benchmarks/`
- **Removed:** 10 PDF files (already processed to JSON)
- **Impact:** Faster KB loading, no PDF parsing needed

---

## 🚀 Deploy Steps

### Step 1: Commit Changes
```bash
cd c:\Users\prokopovo\Documents\beton_agent\PROJEKT\STAVAGENT

git add concrete-agent/packages/core-backend/app/main.py
git add concrete-agent/packages/core-backend/app/core/kb_loader.py
git add concrete-agent/packages/core-backend/app/knowledge_base/B3_current_prices/
git add concrete-agent/packages/core-backend/app/knowledge_base/B4_production_benchmarks/
git add concrete-agent/RENDER_DEPLOYMENT_FIX.md
git add concrete-agent/QUICK_DEPLOY.md

git commit -m "FIX: Render deployment - robust KB loading + remove redundant PDFs

- Suppress pdfminer warnings (100+ lines)
- Add PORT env var logging for diagnostics
- Add error handling for KB category loading
- Add PDF size/page limits to prevent hanging
- Skip problematic files instead of crashing
- Remove 10 redundant PDF files (already in JSON)

Fixes: Port binding timeout on Render
Impact: Server starts successfully, faster KB loading"
```

### Step 2: Push to GitHub
```bash
git push origin main
```

### Step 3: Monitor Render Deployment
1. Go to: https://dashboard.render.com/web/srv-d38odtemcj7s738gp30g
2. Wait for auto-deploy to trigger (1-2 minutes)
3. Watch logs for:
   ```
   🚀 Czech Building Audit System Starting...
   🌐 Port: 10000 (Render: $PORT env var)
   📂 Processing category: B1_otkskp_codes
   ✅ Loaded: B1_otkskp_codes
   ...
   ✨ Knowledge Base loaded in X.XXs
   ✅ System ready! Listening on 0.0.0.0:10000
   ```

### Step 4: Verify Deployment
```bash
# Test health endpoint
curl https://concrete-agent-3uxelthc4q-ey.a.run.app/health

# Expected: {"status": "healthy"}
```

---

## 🔍 What to Look For in Logs

### ✅ Success Indicators
```
✅ Loaded: B1_otkskp_codes
✅ Loaded: B1_rts_codes
✅ Loaded: B1_urs_codes
✅ Loaded: B2_csn_standards
✅ Loaded: B3_current_prices
✅ Loaded: B4_production_benchmarks
✅ Loaded: B5_tech_cards
✅ Loaded: B6_research_papers
✅ Loaded: B7_regulations
✅ Loaded: B8_company_specific
✅ Loaded: B9_Equipment_Specs
✨ Knowledge Base loaded in 15.23s
✅ System ready! Listening on 0.0.0.0:10000
```

### ⚠️ Warning Indicators (Non-Critical)
```
⚠️  Skipping large PDF (52.3MB): huge_document.pdf
❌ Failed to load problematic.pdf: PDF parsing failed
```
These are OK - server continues loading other files.

### ❌ Failure Indicators
```
❌ Failed to load category B4_production_benchmarks: [exception]
==&gt; No open ports detected, continuing to scan...
```
If you see this, check the exception details.

---

## 🆘 If Deployment Still Fails

### Option 1: Temporarily Disable Problematic Category
Edit `kb_loader.py`:
```python
CATEGORIES = [
    "B1_otkskp_codes",
    "B1_rts_codes",
    "B1_urs_codes",
    "B2_csn_standards",
    "B3_current_prices",
    # "B4_production_benchmarks",  # Temporarily disabled
    "B5_tech_cards",
    ...
]
```

### Option 2: Skip All PDFs Temporarily
Edit `kb_loader.py` → `_load_file()`:
```python
elif suffix == ".pdf":
    logger.info(f"Skipping PDF (temporary): {file_path.name}")
    return None  # Skip all PDFs
```

### Option 3: Rollback
```bash
git revert HEAD
git push origin main
```

---

## 📊 Expected Performance

| Metric | Before | After |
|--------|--------|-------|
| KB Load Time | TIMEOUT | 10-20s |
| Server Start | FAIL | SUCCESS |
| Log Cleanliness | 100+ warnings | Clean |
| Port Binding | FAIL | SUCCESS |

---

## ✅ Post-Deployment Checklist

- [ ] Server starts successfully
- [ ] `/health` endpoint responds
- [ ] `/docs` endpoint loads
- [ ] No pdfminer warnings in logs
- [ ] All KB categories loaded (or skipped gracefully)
- [ ] Port binding successful

---

**Ready to deploy?** Run Step 1 above! 🚀
