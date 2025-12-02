# GitHub Secrets Setup Guide

## Overview

This guide explains how to set up GitHub Secrets for STAVAGENT CI/CD pipeline.

## Required Secrets

All secrets should be added to your GitHub repository under **Settings → Secrets and variables → Actions**.

### 1. LLM API Keys

#### ANTHROPIC_API_KEY ⭐ (Required for Claude integration)
- **Source**: https://console.anthropic.com/account/keys
- **Format**: `sk-ant-...`
- **Usage**: Python (concrete-agent) and JavaScript (URS_MATCHER_SERVICE) for Claude Sonnet 4.5
- **Workflow**: Used in all test and deploy workflows

```bash
# In .env (local development, NEVER commit)
ANTHROPIC_API_KEY=sk-ant-YOUR_ACTUAL_KEY
```

#### OPENAI_API_KEY (Optional for GPT-4)
- **Source**: https://platform.openai.com/account/api-keys
- **Format**: `sk-proj-...`
- **Usage**: Fallback LLM provider
- **Workflow**: Used as fallback in tests if Claude unavailable

#### PERPLEXITY_API_KEY (Optional for live knowledge base)
- **Source**: https://www.perplexity.ai/settings/keys
- **Usage**: Live KB search for construction knowledge
- **Workflow**: Used for knowledge base enrichment

#### GEMINI_API_KEY (Optional)
- **Source**: https://aistudio.google.com/app/apikeys
- **Usage**: Alternative LLM provider (future)

### 2. Render Deployment Secrets

#### RENDER_API_KEY (Required for Render deployment)
- **Source**: https://dashboard.render.com/account/api-tokens
- **Usage**: Deploy backend to Render.com
- **Scope**: Full API token with deploy permissions

#### RENDER_BACKEND_SERVICE_ID
- **Source**: From your Render service URL: `https://dashboard.render.com/services/srv-XXX`
- **Format**: `srv-XXXXXXXXXXXXX`
- **Usage**: Identifies which service to deploy

#### RENDER_SERVICE_URL
- **Source**: Your deployed backend URL
- **Format**: `https://your-service.onrender.com`
- **Usage**: Health checks and verification

## Setup Instructions

### Step 1: Add Secrets to Repository

1. Go to **GitHub Repository → Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Add each secret:

```
Name: ANTHROPIC_API_KEY
Value: sk-ant-YOUR_ACTUAL_KEY_HERE
```

Repeat for all required secrets.

### Step 2: Verify Secrets in Workflows

GitHub Actions will automatically use secrets in workflows via:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Step 3: Test Secrets in Actions

1. Push changes to trigger workflow
2. Go to **Actions → Your Workflow**
3. Check logs for "✅ All required secrets are set"

```bash
# Good sign in logs:
✅ Environment file created with API keys from GitHub Secrets
✅ All imports validated
```

## Security Best Practices

### ✅ DO
- Use GitHub Secrets for all sensitive data
- Rotate API keys regularly
- Use environment-specific secrets if needed
- Audit secret access in Actions logs

### ❌ DON'T
- Commit `.env` files to git
- Use placeholder keys in production
- Share API keys via email or chat
- Log API keys or secrets
- Use same key for dev and production

## Usage in Different Environments

### Local Development
```bash
# Create .env (in .gitignore!)
ANTHROPIC_API_KEY=sk-ant-YOUR_LOCAL_KEY
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-5-20250929
```

### GitHub Actions (CI/CD)
- Secrets loaded automatically from GitHub Settings
- No .env file needed
- Workflow files define which secrets to use

### Render.com Production
1. Go to **Render Dashboard → Your Service → Settings → Environment**
2. Add variables:
   ```
   ANTHROPIC_API_KEY = sk-ant-YOUR_PRODUCTION_KEY
   OPENAI_API_KEY = sk-proj-YOUR_KEY
   LLM_PROVIDER = claude
   LLM_MODEL = claude-sonnet-4-5-20250929
   NODE_ENV = production
   CORS_ORIGIN = https://yourdomain.com
   ```
3. Click "Save" - redeploys with new variables

## Workflow Configuration

### Concrete Agent (Python)
- **Workflow**: `.github/workflows/deploy.yml` and `render_deploy.yml`
- **Tests**: Uses ANTHROPIC_API_KEY for pytest
- **Secrets Passed**:
  - ANTHROPIC_API_KEY
  - OPENAI_API_KEY
  - PERPLEXITY_API_KEY
  - GEMINI_API_KEY

### URS Matcher Service (Node.js)
- **Workflow**: `.github/workflows/test-urs-matcher.yml`
- **Tests**: Uses ANTHROPIC_API_KEY for npm test with Jest
- **Secrets Passed**:
  - ANTHROPIC_API_KEY
  - OPENAI_API_KEY
  - PERPLEXITY_API_KEY
  - GEMINI_API_KEY

## Troubleshooting

### Workflow shows "secrets not set"
```
❌ ANTHROPIC_API_KEY secret is not set
```

**Solution**:
1. Go to Settings → Secrets and variables → Actions
2. Verify secret is created
3. Check secret name matches exactly (case-sensitive)
4. Re-run workflow

### Tests fail with API key errors
```
[LLMConfig] No API key found for provider claude
```

**Solution**:
1. Verify ANTHROPIC_API_KEY is added to Secrets
2. Check workflow file syntax:
   ```yaml
   ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
   ```
3. Ensure no trailing spaces in secret value

### Rate limiting errors during batch tests
```
429 Too Many Requests
```

**Solution**:
1. Rate limiter is automatic in `rate_limiter.py`
2. Check logs for rate limit status
3. Increase timeouts if needed in config:
   ```python
   CLAUDE_TOKENS_PER_MINUTE=25000
   ```

## Advanced Configuration

### Environment-Specific Secrets
If you need different secrets for staging vs production:

```yaml
jobs:
  deploy:
    environment: production  # or staging
    steps:
      - uses: actions/checkout@v4
      - env:
          API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: ./deploy.sh
```

### Secret Rotation
1. Generate new API key from provider
2. Update GitHub Secret with new value
3. Verify in test workflow
4. Old key continues to work until revoked

### Audit Trail
Check **Settings → Secrets and variables → Actions** to see when secrets were last used.

## Related Files

- Workflows: `.github/workflows/*.yml`
- Python Config: `concrete-agent/packages/core-backend/app/core/config.py`
- JavaScript Config: `URS_MATCHER_SERVICE/backend/src/config/llmConfig.js`
- Rate Limiter: `concrete-agent/packages/core-backend/app/core/rate_limiter.py`

## Support

For issues with GitHub Secrets:
1. Check Actions logs for detailed error messages
2. Verify secret format and value
3. Ensure workflow file syntax is correct
4. Check GitHub documentation: https://docs.github.com/en/actions/security-guides/encrypted-secrets
