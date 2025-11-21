# 🚀 Deploy Workflow - Visual Guide

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRIGGER CONDITIONS                            │
├─────────────────────────────────────────────────────────────────┤
│  • Push to main (paths: project/backend/**, app/**)             │
│  • Pull Request to main                                          │
│  • Manual workflow_dispatch                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  JOB 1: 🏗️ Setup & Build Backend                                │
├─────────────────────────────────────────────────────────────────┤
│  1. 📥 Checkout repository                                       │
│  2. 🐍 Setup Python 3.11                                         │
│  3. 📦 Cache pip dependencies                                    │
│  4. 📂 Create directories (data, logs, knowledge_base, etc.)    │
│  5. 📝 Create .env file                                          │
│  6. 📚 Initialize knowledge base                                 │
│  7. 📊 Create test.xlsx file                                     │
│  8. 📦 Install dependencies                                      │
│  9. 🔍 Validate backend imports                                  │
│                                                                   │
│  Output: backend_ready = true/false                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  JOB 2: 🧪 Test Backend & Agents                                │
├─────────────────────────────────────────────────────────────────┤
│  Depends on: setup-and-build                                     │
│  Skips if: skip_tests = true                                     │
│                                                                   │
│  1. 📥 Checkout repository                                       │
│  2. 🐍 Setup Python 3.11                                         │
│  3. 📦 Install dependencies                                      │
│  4. 🚀 Start uvicorn server (port 8000)                         │
│     ├─ app.main:app                                              │
│     └─ Background process                                        │
│  5. 🏥 Health check                                              │
│     └─ GET /health                                               │
│  6. 🤖 Test agent endpoints                                      │
│     ├─ GET /api/agents/agents                                    │
│     │  ├─ ✅ Check tzd_reader exists                            │
│     │  └─ ✅ Check boq_parser exists                            │
│     └─ POST /api/agents/execute                                  │
│        ├─ Agent: tzd_reader                                      │
│        └─ ✅ Check success = true                               │
│  7. 📊 Save test results to JSON                                 │
│  8. 📤 Upload artifact (agent-test-results)                     │
│  9. 🛑 Stop server & show logs                                   │
│                                                                   │
│  Output: agents_ok = true/false, test_results = JSON            │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
    ┌───────────────────────┐  ┌───────────────────────┐
    │  JOB 3: 🚀 Deploy     │  │  JOB 4: 💬 Comment    │
    │  to Render            │  │  on PR                │
    ├───────────────────────┤  ├───────────────────────┤
    │  Depends on:          │  │  Depends on:          │
    │  - setup-and-build    │  │  - test-backend       │
    │  - test-backend       │  │  - deploy-to-render   │
    │                       │  │                       │
    │  Only if:             │  │  Only if:             │
    │  - Push to main       │  │  - Pull Request       │
    │  - Tests passed       │  │  - Always runs        │
    │                       │  │                       │
    │  1. 📥 Checkout       │  │  1. 📥 Download       │
    │  2. 🚀 Trigger        │  │     artifacts         │
    │     Render API        │  │  2. 💬 Post comment   │
    │  3. ⏳ Wait 60s       │  │     with results      │
    │  4. 🏥 Verify         │  │     ├─ Test status    │
    │     production        │  │     ├─ Agent results  │
    │                       │  │     └─ Deploy status  │
    │  Requires:            │  │                       │
    │  - RENDER_API_KEY     │  │  Requires:            │
    │  - SERVICE_ID         │  │  - PR write perms     │
    └───────────────────────┘  └───────────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
            ┌─────────────────────────────────────┐
            │  JOB 5: 📋 Summary                  │
            ├─────────────────────────────────────┤
            │  Depends on: All previous jobs      │
            │  Always runs                         │
            │                                      │
            │  1. 📋 Generate workflow summary     │
            │     ├─ Setup status                  │
            │     ├─ Test status                   │
            │     ├─ Deploy status                 │
            │     └─ Agent test results            │
            │                                      │
            │  Output: GitHub Actions Summary Page │
            └─────────────────────────────────────┘
```

## 📊 Test Flow Detail

```
🧪 Agent Testing
├── Start Server
│   └── uvicorn app.main:app --host 0.0.0.0 --port 8000
│
├── Test 1: List Agents
│   ├── Request: GET /api/agents/agents
│   ├── Expected: HTTP 200
│   └── Validate:
│       ├── ✅ tzd_reader in response
│       └── ✅ boq_parser in response
│
├── Test 2: Execute Agent
│   ├── Request: POST /api/agents/execute
│   ├── Body: {"agent_name": "tzd_reader", "input": "test"}
│   ├── Expected: HTTP 200/201
│   └── Validate:
│       └── ✅ success = true in response
│
└── Results
    ├── Save to test-results/agent_test_results.json
    ├── Upload as artifact (30-day retention)
    └── Use in PR comment and summary
```

## 🔄 Workflow Execution Paths

### Path 1: Push to Main (Full Deployment)
```
Push to main
  → Setup & Build
    → Test Backend & Agents
      → Deploy to Render
        → Summary
```

### Path 2: Pull Request (Testing Only)
```
Create PR
  → Setup & Build
    → Test Backend & Agents
      → Comment on PR
        → Summary
```

### Path 3: Manual Run (Configurable)
```
Manual Trigger
  → Setup & Build
    → Test Backend & Agents (optional: skip_tests)
      → Deploy to Render (optional: environment choice)
        → Summary
```

## 🎯 Success Criteria

| Job | Success Condition |
|-----|-------------------|
| **Setup & Build** | • All directories created<br>• Dependencies installed<br>• Backend imports successfully |
| **Test Backend** | • Server starts within 60s<br>• Health check passes<br>• Both agents found<br>• Agent execution succeeds |
| **Deploy** | • Render API accepts deploy<br>• Production health check passes (optional) |
| **Comment PR** | • Test results posted<br>• Comment contains status indicators |
| **Summary** | • All job statuses displayed<br>• Workflow metadata shown |

## 🔐 Required Secrets

| Secret | Usage | Required For |
|--------|-------|--------------|
| `RENDER_API_KEY` | Authenticate with Render API | Deployment |
| `RENDER_BACKEND_SERVICE_ID` | Identify service to deploy | Deployment |
| `RENDER_SERVICE_URL` | Verify production health | Health checks |
| `OPENAI_API_KEY` | Agent testing (optional) | CI tests |

## 📦 Artifacts Generated

```
agent-test-results/
├── agent_test_results.json    # Complete test results
├── test1.json                 # GET /api/agents/agents
└── test2.json                 # POST /api/agents/execute
```

**Retention:** 30 days  
**Size:** ~10-50 KB  
**Format:** JSON

## 🎨 Console Output Examples

```bash
✅ Backend ready
✅ Dependencies installed from requirements.txt
✅ Backend server is ready!
✅ Backend is healthy!
✅ Found tzd_reader agent
✅ Found boq_parser agent
✅ Agent execution successful
✅ All agent tests passed!
✅ Deployment triggered successfully!
```

```bash
❌ Health check failed
⚠️ Some agent tests failed or were skipped
⚠️ Tests skipped (missing dependencies)
⏭️ Backend Tests: Skipped
```

## 🔧 Configuration Variables

```yaml
env:
  PYTHON_VERSION: '3.11'      # Python version
  BACKEND_DIR: project/backend # Backend directory
  SERVER_PORT: 8000           # Development server port
```

## 📝 Workflow Dispatch Inputs

```yaml
skip_tests:
  Description: Skip agent tests
  Type: boolean
  Default: false

deploy_environment:
  Description: Deployment environment
  Type: choice
  Options: [production, staging]
  Default: production
```

## 🔍 Debugging Tips

1. **Check Setup Job Logs**: Review directory creation and dependency installation
2. **View Server Logs**: Automatically shown if tests fail
3. **Download Artifacts**: Get detailed test results JSON files
4. **Read PR Comments**: See formatted test results
5. **Check Summary Page**: View overall workflow status

## 📚 Related Documentation

- Main README: `README.md`
- Workflow Details: [GitHub Actions Docs](https://docs.github.com/en/actions)
- Render API: [Render API Docs](https://render.com/docs/api)
