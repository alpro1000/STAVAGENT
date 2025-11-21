# 🚀 Quick Start - Deploy Workflow

Get started with the Concrete Agent CI/CD workflow in 5 minutes!

## 📋 Prerequisites

- GitHub repository with Concrete Agent backend code
- Render account with backend service created
- Backend code structure in one of these locations:
  - `app/main.py` (root level), OR
  - `project/backend/app/main.py`

## ⚡ Quick Setup (3 Steps)

### 1️⃣ Configure GitHub Secrets

Go to: **Repository Settings → Secrets and variables → Actions**

Add these secrets:

| Secret Name | Where to Find | Required |
|-------------|---------------|----------|
| `RENDER_API_KEY` | Render Dashboard → Account Settings → API Keys | ✅ Yes |
| `RENDER_BACKEND_SERVICE_ID` | Render Service URL: `srv-xxxxx` | ✅ Yes |
| `RENDER_SERVICE_URL` | Full URL: `https://your-app.onrender.com` | ⚠️ Optional |
| `OPENAI_API_KEY` | OpenAI Dashboard | ⚠️ Optional |

**How to find Render Service ID:**
```
URL: https://dashboard.render.com/web/srv-abc123xyz
Service ID: srv-abc123xyz
```

### 2️⃣ Verify Workflow File

The workflow file is already in your repository:
```
.github/workflows/deploy.yml
```

Make sure your backend has these endpoints:
- `GET /health` - Returns health status
- `GET /api/agents/agents` - Lists available agents
- `POST /api/agents/execute` - Executes an agent

### 3️⃣ Trigger the Workflow

**Option A: Automatic (Push to Main)**
```bash
git add .
git commit -m "Your changes"
git push origin main
```

**Option B: Manual Trigger**
1. Go to **Actions** tab
2. Select **🚀 Deploy Concrete Agent**
3. Click **Run workflow**
4. Choose options and click **Run workflow**

**Option C: Pull Request**
```bash
git checkout -b feature/my-feature
git push origin feature/my-feature
# Create PR on GitHub
```

## ✅ Verify It's Working

### Check Workflow Status
1. Go to **Actions** tab
2. Click on the running workflow
3. Watch the jobs execute in real-time

### Expected Output
```
✅ Setup & Build Backend    (2-3 minutes)
✅ Test Backend & Agents     (2-3 minutes)
✅ Deploy to Render          (1-2 minutes)
✅ Comment on PR            (if PR)
✅ Summary                   (< 1 minute)
```

### Download Test Results
1. Scroll to **Artifacts** section at bottom of workflow run
2. Click **agent-test-results** to download
3. Extract and view JSON files

## 🎯 What Gets Tested

### ✅ Agent Tests
```
1. GET /api/agents/agents
   → Checks for tzd_reader ✅
   → Checks for boq_parser ✅

2. POST /api/agents/execute
   → Executes tzd_reader ✅
   → Validates success=true ✅
```

### ✅ Health Checks
```
1. Backend server startup
2. GET /health endpoint
3. Production deployment (if deploying)
```

## 🔧 Troubleshooting

### ❌ "Backend imports failed"
**Problem:** Cannot find app/main.py  
**Solution:** Ensure your code is in `app/main.py` or `project/backend/app/main.py`

### ❌ "Agents not found"
**Problem:** Agent endpoints return 404 or agents missing  
**Solution:** 
1. Verify endpoints exist: `/api/agents/agents` and `/api/agents/execute`
2. Ensure agents are named `tzd_reader` and `boq_parser`
3. Check server logs in workflow output

### ❌ "Render credentials not configured"
**Problem:** Deployment skipped  
**Solution:** Add `RENDER_API_KEY` and `RENDER_BACKEND_SERVICE_ID` secrets

### ❌ "Health check timed out"
**Problem:** Server not responding  
**Solution:**
1. Check server logs in "Stop backend server" step
2. Verify `/health` endpoint exists
3. Check for startup errors in logs

## 📚 Next Steps

### Customize the Workflow
Edit `.github/workflows/deploy.yml`:
```yaml
env:
  PYTHON_VERSION: '3.11'      # Change Python version
  BACKEND_DIR: project/backend # Change backend path
  SERVER_PORT: 8000           # Change port
```

### Add More Tests
Add steps to the `test-backend` job:
```yaml
- name: 🧪 My custom test
  run: |
    curl -s http://localhost:8000/my-endpoint
```

### Change Deployment Environment
Use workflow_dispatch inputs:
```yaml
deploy_environment: staging  # Instead of production
```

## 🎨 Workflow Features

### 🎯 Automatic Features
- ✅ Creates complete directory structure
- ✅ Generates .env file
- ✅ Initializes knowledge base
- ✅ Creates test.xlsx
- ✅ Tests all agents
- ✅ Deploys to Render
- ✅ Comments on PRs
- ✅ Uploads test artifacts

### 💡 Smart Features
- ✅ Caches dependencies for faster runs
- ✅ Skips deployment on PRs
- ✅ Continues on non-critical failures
- ✅ Shows detailed logs with emoji
- ✅ Creates GitHub Actions summary

### 🔒 Security Features
- ✅ Uses GitHub secrets for credentials
- ✅ Minimal permissions for each job
- ✅ No hardcoded credentials
- ✅ Secure Render API integration

## 📊 Expected Timeline

```
Total Time: ~8-12 minutes

Setup & Build:     2-3 min  ████████░░░░░░░░░░░░
Test Backend:      2-3 min  ████████░░░░░░░░░░░░
Deploy to Render:  1-2 min  ████░░░░░░░░░░░░░░░░
Comment on PR:     < 1 min  ██░░░░░░░░░░░░░░░░░░
Summary:           < 1 min  ██░░░░░░░░░░░░░░░░░░
```

## 🔄 Workflow Execution Paths

### Path 1: Push to Main
```
Push → Setup → Test → Deploy → Summary
         ✅      ✅      ✅       ✅
```

### Path 2: Pull Request
```
PR → Setup → Test → Comment → Summary
      ✅      ✅      ✅         ✅
```

### Path 3: Manual Run
```
Manual → Setup → Test → Deploy → Summary
          ✅      ✅      ✅       ✅
```

## 🎉 Success Indicators

Look for these in your workflow run:

```bash
✅ Backend ready
✅ Dependencies installed
✅ Backend server is ready!
✅ Found tzd_reader agent
✅ Found boq_parser agent
✅ Agent execution successful
✅ All agent tests passed!
✅ Deployment triggered successfully!
✅ Production service is healthy!
```

## 📞 Getting Help

### Check Documentation
1. **README.md** - Detailed workflow documentation
2. **WORKFLOW_GUIDE.md** - Visual guides and diagrams
3. **This file** - Quick start guide

### Debug Tips
1. View workflow logs for detailed error messages
2. Download test artifacts for full test results
3. Check server logs in "Stop backend server" step
4. Review PR comments for test summaries

### Common Commands
```bash
# View recent workflow runs
gh run list --workflow=deploy.yml

# View specific run
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

## 🌟 Pro Tips

1. **Test locally first:** Run your backend locally before pushing
2. **Use PR workflow:** Test changes in PRs before merging
3. **Monitor artifacts:** Download test results to track agent performance
4. **Check summaries:** Review GitHub Actions summary for quick status
5. **Read PR comments:** All test results are posted automatically

## 🚦 Status Indicators

| Icon | Meaning |
|------|---------|
| ✅ | Success - Everything worked |
| ❌ | Failure - Something went wrong |
| ⚠️ | Warning - Non-critical issue |
| ⏭️ | Skipped - Step was skipped |
| 🔧 | Setup - Configuration step |
| 🧪 | Testing - Running tests |
| 🚀 | Deploy - Deployment action |
| 💬 | Comment - PR communication |

## 📝 Configuration Checklist

Before your first run:

- [ ] Repository code is in correct location
- [ ] `RENDER_API_KEY` secret added
- [ ] `RENDER_BACKEND_SERVICE_ID` secret added
- [ ] Backend has `/health` endpoint
- [ ] Backend has `/api/agents/agents` endpoint
- [ ] Backend has `/api/agents/execute` endpoint
- [ ] Agents `tzd_reader` and `boq_parser` exist
- [ ] `requirements.txt` file exists

All set? Push to main or create a PR to see it in action! 🚀

---

**Need more details?** Check out:
- [README.md](./README.md) - Full documentation
- [WORKFLOW_GUIDE.md](./WORKFLOW_GUIDE.md) - Visual guides
- [GitHub Actions Docs](https://docs.github.com/en/actions)
