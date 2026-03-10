# 🚀 Concrete Agent CI/CD Workflows

This directory contains GitHub Actions workflows for the Concrete Agent project.

## 📋 Available Workflows

### 1. `deploy.yml` - Main CI/CD Pipeline
**Purpose:** Comprehensive deployment workflow that builds, tests, and deploys the Concrete Agent backend.

**Triggers:**
- Push to `main` branch (with path filters)
- Pull requests to `main` branch
- Manual trigger via `workflow_dispatch`

**Path Filters:**
- `project/backend/**`
- `app/**`
- `requirements.txt`
- `Dockerfile`
- `.github/workflows/deploy.yml`

**Manual Run Options:**
- `skip_tests`: Skip agent tests (default: false)
- `deploy_environment`: Choose deployment environment (production/staging)

**Jobs:**

#### 🏗️ Setup & Build Backend
Creates the complete project structure and prepares the environment:
- Creates directories: `data/`, `logs/`, `knowledge_base/`, `uploads/`, `temp/`
- Generates `.env` file with CI configuration
- Initializes knowledge base with documentation structure
- Creates `test.xlsx` file with sample data
- Installs Python dependencies from `requirements.txt`
- Validates backend imports

**Outputs:**
- `backend_ready`: Boolean indicating if backend is ready

#### 🧪 Test Backend & Agents
Starts the backend server and runs comprehensive tests:
- Starts uvicorn server on port 8000
- Health check via `/health` endpoint
- **Agent Tests:**
  - `GET /api/agents/agents` - Verifies presence of `tzd_reader` and `boq_parser` agents
  - `POST /api/agents/execute` - Tests `tzd_reader` agent execution
- Generates JSON test results artifact
- Stops server and captures logs

**Outputs:**
- `test_results`: JSON string with complete test results
- `agents_ok`: Boolean indicating if all agent tests passed

**Artifacts:**
- `agent-test-results`: JSON files with detailed test results (30-day retention)

#### 🚀 Deploy to Render
Triggers deployment to Render (only on main branch after successful tests):
- Triggers Render deployment via API
- Waits for deployment to start
- Verifies production health endpoint

**Required Secrets:**
- `RENDER_API_KEY`: Render API authentication key
- `RENDER_BACKEND_SERVICE_ID`: Render service ID
- `RENDER_SERVICE_URL` (optional): Production URL for health checks

#### 💬 Comment on PR
Posts test results as a comment on pull requests:
- Downloads test results artifact
- Formats results with ✅/❌ indicators
- Shows agent test details
- Displays deployment status
- Links to workflow run

**Permissions Required:**
- `contents: read`
- `pull-requests: write`

#### 📋 Summary
Generates workflow summary on GitHub Actions page:
- Overall status of all jobs
- Agent test results
- Workflow metadata (event, branch, commit, actor)

## 🔧 Configuration

### Environment Variables
The workflow uses the following environment variables:
```yaml
PYTHON_VERSION: '3.11'
BACKEND_DIR: project/backend
SERVER_PORT: 8000
```

### Required Secrets
Configure these secrets in your repository settings (`Settings > Secrets and variables > Actions`):

| Secret | Description | Required For |
|--------|-------------|--------------|
| `RENDER_API_KEY` | Render API authentication key | Deployment |
| `RENDER_BACKEND_SERVICE_ID` | Render service ID for backend | Deployment |
| `RENDER_SERVICE_URL` | Production URL (e.g., https://concrete-agent-3uxelthc4q-ey.a.run.app) | Health checks |
| `OPENAI_API_KEY` | OpenAI API key (optional for CI) | Agent testing |

### Generated Files
The workflow creates the following structure in `project/backend/`:
```
project/backend/
├── .env                    # Environment configuration
├── data/
│   └── test.xlsx          # Sample Excel file
├── logs/                  # Application logs
├── knowledge_base/        # Knowledge base
│   ├── README.md
│   ├── docs/
│   ├── examples/
│   └── schemas/
├── uploads/               # File uploads
└── temp/                  # Temporary files
```

## 🚦 Usage Examples

### Automatic Deployment
Push to main branch:
```bash
git push origin main
```
This will automatically:
1. Build and test the backend
2. Run agent tests
3. Deploy to Render (if tests pass)

### Manual Run
1. Go to "Actions" tab in GitHub
2. Select "🚀 Deploy Concrete Agent"
3. Click "Run workflow"
4. Choose options:
   - Skip tests: Yes/No
   - Environment: production/staging
5. Click "Run workflow"

### Testing Pull Requests
Create a PR:
```bash
git checkout -b feature/my-feature
git push origin feature/my-feature
# Create PR on GitHub
```
The workflow will:
1. Run all tests
2. Post results as a comment on the PR
3. Skip deployment (PRs don't deploy)

## 📊 Test Results

### Agent Test Results Artifact
Download from the workflow run page:
- Navigate to workflow run
- Scroll to "Artifacts" section
- Download `agent-test-results`

**Contents:**
- `agent_test_results.json` - Complete test results
- `test1.json` - GET /api/agents/agents results
- `test2.json` - POST /api/agents/execute results

### Example Test Result
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "tests": [
    {
      "test": "GET /api/agents/agents",
      "status": "200",
      "tzd_reader_found": true,
      "boq_parser_found": true,
      "response": "..."
    },
    {
      "test": "POST /api/agents/execute",
      "agent": "tzd_reader",
      "status": "200",
      "success": true,
      "response": "..."
    }
  ]
}
```

## 🎨 Output Format

The workflow uses emoji and colors for better readability:
- ✅ Success indicators
- ❌ Failure indicators
- ⚠️ Warning indicators
- ⏭️ Skipped indicators
- 🔧 Setup actions
- 📦 Package management
- 🚀 Deployment actions
- 🧪 Testing actions
- 💬 Communication actions

## 🔍 Debugging

### View Server Logs
Server logs are automatically displayed if tests fail. To manually view:
1. Go to failed workflow run
2. Click on "Test Backend & Agents" job
3. Expand "Stop backend server" step
4. Review server logs

### Check Test Results
1. Download `agent-test-results` artifact
2. Extract files
3. View JSON files for detailed results

### Common Issues

#### Backend Import Fails
**Error:** `Cannot find app/main.py`
**Solution:** Ensure your backend code is in either:
- `app/main.py` (root level)
- `project/backend/app/main.py`

#### Agent Tests Fail
**Error:** Agents not found or execution fails
**Solution:** 
- Verify agents are registered in your backend
- Check agent names match: `tzd_reader`, `boq_parser`
- Review server logs for errors

#### Deployment Fails
**Error:** `Render credentials not configured`
**Solution:** Add required secrets:
- `RENDER_API_KEY`
- `RENDER_BACKEND_SERVICE_ID`

## 🔗 Related Workflows

- `tests.yml` - Basic pytest runner
- `render_deploy.yml` - Original Render deployment workflow
- `render_purge.yml` - Render cache purge

## 📝 Maintenance

### Updating Python Version
Edit `PYTHON_VERSION` in workflow:
```yaml
env:
  PYTHON_VERSION: '3.12'  # Update here
```

### Changing Backend Directory
Edit `BACKEND_DIR` in workflow:
```yaml
env:
  BACKEND_DIR: backend  # Update here
```

### Adding New Tests
Add test steps in the "Test Backend & Agents" job:
```yaml
- name: 🧪 My custom test
  run: |
    echo "Running custom test..."
    # Your test commands here
```

## 🤝 Contributing

When modifying workflows:
1. Test changes in a feature branch
2. Create a PR to trigger the workflow
3. Review test results in PR comments
4. Merge only after successful tests

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Render API Documentation](https://render.com/docs/api)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Uvicorn Documentation](https://www.uvicorn.org/)
