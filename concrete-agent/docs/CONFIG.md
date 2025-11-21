# Configuration Reference

> Complete guide to all environment variables and configuration options for Concrete Agent

## Table of Contents

1. [Overview](#overview)
2. [Required Configuration](#required-configuration)
3. [Recommended Configuration](#recommended-configuration)
4. [Optional Configuration](#optional-configuration)
5. [Complete .env Examples](#complete-env-examples)
6. [Multi-Role Configuration](#multi-role-configuration)
7. [Validation & Warnings](#validation--warnings)

---

## Overview

Concrete Agent uses environment variables for configuration. All settings are defined in `app/core/config.py` and loaded from a `.env` file in the project root.

### Configuration Priority

1. **Environment variables** (highest priority)
2. **.env file** in project root
3. **Default values** in code (lowest priority)

### Configuration File

Create a `.env` file in the project root:

```bash
cp .env.example .env
# Edit .env with your settings
```

---

## Required Configuration

These variables **must be set** for the system to function.

### API Keys

#### `ANTHROPIC_API_KEY`

**Purpose:** Anthropic Claude API key for document parsing, audit, and generation.

**Required for:** Workflow A (import & audit), document parsing, position analysis

**Type:** `string`

**Default:** `""` (empty - will show warning)

**Example:**
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Get your key:** [https://console.anthropic.com/](https://console.anthropic.com/)

**⚠️ Warning:** If not set and `ENABLE_WORKFLOW_A=true`, you'll see:
```
ANTHROPIC_API_KEY not set! Workflow A will not work.
```

---

## Recommended Configuration

These variables are **highly recommended** for full functionality.

### `OPENAI_API_KEY`

**Purpose:** OpenAI GPT-4 Vision API key for drawing analysis.

**Required for:** Workflow B (generate from drawings)

**Type:** `string`

**Default:** `""` (empty)

**Example:**
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Get your key:** [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**When needed:** Only if `ENABLE_WORKFLOW_B=true`

---

### `PERPLEXITY_API_KEY`

**Purpose:** Perplexity API key for live knowledge base search (unknown norms/standards).

**Required for:** Live KB enrichment, runtime norm lookup

**Type:** `string`

**Default:** `""` (empty)

**Example:**
```env
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Get your key:** [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)

**⚠️ Warning:** If not set and `ALLOW_WEB_SEARCH=true`, you'll see:
```
ALLOW_WEB_SEARCH is enabled but PERPLEXITY_API_KEY not set. Will use local KB only.
```

---

## Optional Configuration

### AI Models

#### `CLAUDE_MODEL`

**Purpose:** Claude model version to use.

**Type:** `string`

**Default:** `"claude-sonnet-4-20250514"`

**Options:**
- `claude-sonnet-4-20250514` (latest, recommended)
- `claude-opus-4-20250514` (more powerful, slower)
- `claude-3-5-sonnet-20241022` (previous version)

**Example:**
```env
CLAUDE_MODEL=claude-sonnet-4-20250514
```

---

#### `GPT4_MODEL`

**Purpose:** GPT-4 model version for vision tasks.

**Type:** `string`

**Default:** `"gpt-4-vision-preview"`

**Options:**
- `gpt-4-vision-preview` (GPT-4 with vision)
- `gpt-4-turbo` (faster, newer)

**Example:**
```env
GPT4_MODEL=gpt-4-vision-preview
```

---

#### `CLAUDE_MAX_TOKENS`

**Purpose:** Maximum tokens for Claude API responses.

**Type:** `integer`

**Default:** `4000`

**Range:** `1` to `8192`

**Example:**
```env
CLAUDE_MAX_TOKENS=4000
```

---

#### `GPT4_MAX_TOKENS`

**Purpose:** Maximum tokens for GPT-4 API responses.

**Type:** `integer`

**Default:** `4000`

**Range:** `1` to `8192`

**Example:**
```env
GPT4_MAX_TOKENS=4000
```

---

### Workflow Feature Flags

#### `ENABLE_WORKFLOW_A`

**Purpose:** Enable Workflow A (import & audit existing estimates).

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
ENABLE_WORKFLOW_A=true
```

---

#### `ENABLE_WORKFLOW_B`

**Purpose:** Enable Workflow B (generate from technical drawings).

**Type:** `boolean`

**Default:** `false`

**Example:**
```env
ENABLE_WORKFLOW_B=true
```

**Note:** Requires `OPENAI_API_KEY` to be set.

---

#### `ENABLE_KROS_MATCHING`

**Purpose:** Enable KROS code matching against knowledge base.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
ENABLE_KROS_MATCHING=true
```

---

#### `ENABLE_RTS_MATCHING`

**Purpose:** Enable RTS code matching against knowledge base.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
ENABLE_RTS_MATCHING=true
```

---

#### `ENABLE_RESOURCE_CALCULATION`

**Purpose:** Enable resource (TOV) calculation for positions.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
ENABLE_RESOURCE_CALCULATION=true
```

---

### Knowledge Base Configuration

#### `ALLOW_WEB_SEARCH`

**Purpose:** Allow Perplexity API for live knowledge base search.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
ALLOW_WEB_SEARCH=true
```

**Note:** Requires `PERPLEXITY_API_KEY` to be set.

---

#### `USE_PERPLEXITY_PRIMARY`

**Purpose:** Use Perplexity as primary KB (instead of local KB with fallback).

**Type:** `boolean`

**Default:** `false`

**Example:**
```env
USE_PERPLEXITY_PRIMARY=false
```

**Recommended:** Keep `false` to minimize API costs.

---

#### `PERPLEXITY_CACHE_TTL`

**Purpose:** Cache time-to-live for Perplexity results (seconds).

**Type:** `integer`

**Default:** `86400` (24 hours)

**Example:**
```env
PERPLEXITY_CACHE_TTL=86400
```

---

#### `PERPLEXITY_SEARCH_DOMAINS`

**Purpose:** Allowed domains for Perplexity search (comma-separated).

**Type:** `list[string]`

**Default:** `["podminky.urs.cz", "urs.cz", "cenovamapa.cz"]`

**Example:**
```env
PERPLEXITY_SEARCH_DOMAINS=podminky.urs.cz,urs.cz,cenovamapa.cz
```

---

#### `USE_OFFICIAL_NORMS`

**Purpose:** Prioritize official Czech norms in results.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
USE_OFFICIAL_NORMS=true
```

---

### Audit Configuration

#### `ENRICHMENT_ENABLED`

**Purpose:** Enable lightweight enrichment layer (pre-audit KB matching).

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
ENRICHMENT_ENABLED=true
```

**Benefit:** Reduces audit time and API costs by ~30%.

---

#### `AUDIT_GREEN_THRESHOLD`

**Purpose:** Confidence threshold for GREEN classification (auto-approve).

**Type:** `float`

**Default:** `0.95`

**Range:** `0.0` to `1.0`

**Example:**
```env
AUDIT_GREEN_THRESHOLD=0.95
```

---

#### `AUDIT_AMBER_THRESHOLD`

**Purpose:** Confidence threshold for AMBER classification (review recommended).

**Type:** `float`

**Default:** `0.75`

**Range:** `0.0` to `1.0`

**Example:**
```env
AUDIT_AMBER_THRESHOLD=0.75
```

**Note:** Positions below this threshold are classified as RED (requires review).

---

#### `ENRICH_SCORE_EXACT`

**Purpose:** Score for exact enrichment match.

**Type:** `float`

**Default:** `0.9`

**Range:** `0.0` to `1.0`

**Example:**
```env
ENRICH_SCORE_EXACT=0.9
```

---

#### `ENRICH_SCORE_PARTIAL`

**Purpose:** Score for partial enrichment match.

**Type:** `float`

**Default:** `0.6`

**Range:** `0.0` to `1.0`

**Example:**
```env
ENRICH_SCORE_PARTIAL=0.6
```

---

#### `ENRICH_MAX_EVIDENCE`

**Purpose:** Maximum evidence items per position.

**Type:** `integer`

**Default:** `3`

**Example:**
```env
ENRICH_MAX_EVIDENCE=3
```

---

### Parsing Configuration

#### `PRIMARY_PARSER`

**Purpose:** Primary parser for PDF documents.

**Type:** `string`

**Default:** `"claude"`

**Options:**
- `claude` - Claude Vision (recommended)
- `mineru` - MinerU PDF parser (requires installation)
- `nanonets` - Nanonets Document AI (requires API key)

**Example:**
```env
PRIMARY_PARSER=claude
```

---

#### `FALLBACK_ENABLED`

**Purpose:** Enable fallback to other parsers if primary fails.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
FALLBACK_ENABLED=true
```

**Chain:** Primary → Fallback 1 → Fallback 2 (AI-based)

---

#### `MAX_FILE_SIZE_MB`

**Purpose:** Maximum file size for upload (MB).

**Type:** `integer`

**Default:** `50`

**Example:**
```env
MAX_FILE_SIZE_MB=50
```

---

#### `PARSER_H_ENABLE`

**Purpose:** Enable Task H normalization pipeline (column name unification).

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
PARSER_H_ENABLE=true
```

---

### PDF Text Recovery (Task F2)

#### `PDF_VALID_CHAR_RATIO`

**Purpose:** Minimum ratio of valid characters for primary text extraction.

**Type:** `float`

**Default:** `0.60`

**Range:** `0.0` to `1.0`

**Example:**
```env
PDF_VALID_CHAR_RATIO=0.60
```

**Meaning:** If <60% of characters are valid, try fallback.

---

#### `PDF_FALLBACK_VALID_RATIO`

**Purpose:** Minimum ratio of valid characters for fallback extractor.

**Type:** `float`

**Default:** `0.70`

**Range:** `0.0` to `1.0`

**Example:**
```env
PDF_FALLBACK_VALID_RATIO=0.70
```

---

#### `PDF_PUA_RATIO`

**Purpose:** Ratio of Private Use Area glyphs that marks a page as encoded.

**Type:** `float`

**Default:** `0.50`

**Range:** `0.0` to `1.0`

**Example:**
```env
PDF_PUA_RATIO=0.50
```

**Note:** High PUA ratio indicates encoding issues (use OCR).

---

#### `PDF_MAX_PAGES_FOR_FALLBACK`

**Purpose:** Maximum pages to process with fallback extractors.

**Type:** `integer`

**Default:** `15`

**Example:**
```env
PDF_MAX_PAGES_FOR_FALLBACK=15
```

---

#### `PDF_MAX_PAGES_FOR_OCR`

**Purpose:** Maximum pages to queue for OCR fallback.

**Type:** `integer`

**Default:** `5`

**Example:**
```env
PDF_MAX_PAGES_FOR_OCR=5
```

---

#### `PDF_PAGE_TIMEOUT_SEC`

**Purpose:** Per-page timeout for fallback extraction (seconds).

**Type:** `integer`

**Default:** `2`

**Example:**
```env
PDF_PAGE_TIMEOUT_SEC=2
```

---

#### `PDF_ENABLE_POPPLER`

**Purpose:** Enable Poppler/pdftotext fallback extraction.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
PDF_ENABLE_POPPLER=true
```

---

#### `PDF_ENABLE_OCR`

**Purpose:** Enable OCR queuing for pages without usable text.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
PDF_ENABLE_OCR=true
```

---

#### `PDF_OCR_PAGE_TIMEOUT_SEC`

**Purpose:** Maximum time for OCR on a single page (seconds).

**Type:** `float`

**Default:** `3.0`

**Example:**
```env
PDF_OCR_PAGE_TIMEOUT_SEC=3.0
```

---

#### `PDF_OCR_TOTAL_TIMEOUT_SEC`

**Purpose:** Maximum cumulative OCR time per document (seconds).

**Type:** `float`

**Default:** `20.0`

**Example:**
```env
PDF_OCR_TOTAL_TIMEOUT_SEC=20.0
```

---

### MinerU Configuration

#### `MINERU_OCR_ENGINE`

**Purpose:** OCR engine for MinerU PDF parser.

**Type:** `string`

**Default:** `"paddle"`

**Options:**
- `paddle` - PaddleOCR (recommended)
- `tesseract` - Tesseract OCR

**Example:**
```env
MINERU_OCR_ENGINE=paddle
```

---

### Nanonets Configuration

#### `NANONETS_API_KEY`

**Purpose:** Nanonets API key for document processing.

**Type:** `string`

**Default:** `""` (empty)

**Example:**
```env
NANONETS_API_KEY=xxxxx-xxxxx-xxxxx-xxxxx-xxxxx
```

**Get your key:** [https://nanonets.com/](https://nanonets.com/)

**When needed:** Only if `PRIMARY_PARSER=nanonets`

---

### Rate Limiting

#### `CLAUDE_TOKENS_PER_MINUTE`

**Purpose:** Claude API token limit per minute.

**Type:** `integer`

**Default:** `25000`

**Example:**
```env
CLAUDE_TOKENS_PER_MINUTE=25000
```

**Note:** Safe margin from 30k official limit.

---

#### `GPT4_TOKENS_PER_MINUTE`

**Purpose:** GPT-4 API token limit per minute.

**Type:** `integer`

**Default:** `8000`

**Example:**
```env
GPT4_TOKENS_PER_MINUTE=8000
```

**Note:** Safe margin from 10k official limit.

---

#### `NANONETS_CALLS_PER_MINUTE`

**Purpose:** Nanonets API calls per minute.

**Type:** `integer`

**Default:** `80`

**Example:**
```env
NANONETS_CALLS_PER_MINUTE=80
```

**Note:** Safe margin from 100 official limit.

---

### Logging

#### `LOG_LEVEL`

**Purpose:** Logging level.

**Type:** `string`

**Default:** `"INFO"`

**Options:**
- `DEBUG` - Verbose logging (development)
- `INFO` - Standard logging (production)
- `WARNING` - Warnings only
- `ERROR` - Errors only

**Example:**
```env
LOG_LEVEL=INFO
```

---

#### `LOG_CLAUDE_CALLS`

**Purpose:** Log Claude API calls to `logs/claude_calls/`.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
LOG_CLAUDE_CALLS=true
```

---

#### `LOG_GPT4_CALLS`

**Purpose:** Log GPT-4 API calls to `logs/gpt4_calls/`.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
LOG_GPT4_CALLS=true
```

---

#### `LOG_PERPLEXITY_CALLS`

**Purpose:** Log Perplexity API calls to `logs/perplexity_calls/`.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
LOG_PERPLEXITY_CALLS=true
```

---

### Environment

#### `ENVIRONMENT`

**Purpose:** Runtime environment.

**Type:** `string`

**Default:** `"development"`

**Options:**
- `development` - Development mode
- `production` - Production mode

**Example:**
```env
ENVIRONMENT=production
```

---

### Pricing

#### `AUTO_UPDATE_PRICES`

**Purpose:** Automatically update prices from market data.

**Type:** `boolean`

**Default:** `false`

**Example:**
```env
AUTO_UPDATE_PRICES=false
```

---

#### `PRICE_UPDATE_INTERVAL_DAYS`

**Purpose:** Price update interval (days).

**Type:** `integer`

**Default:** `90`

**Example:**
```env
PRICE_UPDATE_INTERVAL_DAYS=90
```

---

## Complete .env Examples

### Minimal Configuration (Workflow A only)

```env
# ==========================================
# MINIMAL CONFIGURATION
# ==========================================

# Required: Claude API key
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Environment
ENVIRONMENT=development
LOG_LEVEL=INFO

# That's it! All other settings use defaults.
```

### Recommended Configuration (Both Workflows)

```env
# ==========================================
# RECOMMENDED CONFIGURATION
# ==========================================

# Required API Keys
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Workflow Feature Flags
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=true

# Knowledge Base
ALLOW_WEB_SEARCH=true
USE_PERPLEXITY_PRIMARY=false

# Environment
ENVIRONMENT=development
LOG_LEVEL=INFO

# Logging
LOG_CLAUDE_CALLS=true
LOG_GPT4_CALLS=true
LOG_PERPLEXITY_CALLS=true
```

### Full Configuration (All Options)

```env
# ==========================================
# FULL CONFIGURATION - ALL OPTIONS
# ==========================================

# ==========================================
# API KEYS (Required)
# ==========================================
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NANONETS_API_KEY=xxxxx-xxxxx-xxxxx-xxxxx-xxxxx

# ==========================================
# AI MODELS
# ==========================================
CLAUDE_MODEL=claude-sonnet-4-20250514
GPT4_MODEL=gpt-4-vision-preview
CLAUDE_MAX_TOKENS=4000
GPT4_MAX_TOKENS=4000

# ==========================================
# WORKFLOW FEATURE FLAGS
# ==========================================
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=true
ENABLE_KROS_MATCHING=true
ENABLE_RTS_MATCHING=true
ENABLE_RESOURCE_CALCULATION=true

# ==========================================
# KNOWLEDGE BASE
# ==========================================
ALLOW_WEB_SEARCH=true
USE_PERPLEXITY_PRIMARY=false
PERPLEXITY_CACHE_TTL=86400
PERPLEXITY_SEARCH_DOMAINS=podminky.urs.cz,urs.cz,cenovamapa.cz
USE_OFFICIAL_NORMS=true

# ==========================================
# AUDIT CONFIGURATION
# ==========================================
ENRICHMENT_ENABLED=true
AUDIT_GREEN_THRESHOLD=0.95
AUDIT_AMBER_THRESHOLD=0.75
ENRICH_SCORE_EXACT=0.9
ENRICH_SCORE_PARTIAL=0.6
ENRICH_MAX_EVIDENCE=3

# ==========================================
# PARSING CONFIGURATION
# ==========================================
PRIMARY_PARSER=claude
FALLBACK_ENABLED=true
MAX_FILE_SIZE_MB=50
PARSER_H_ENABLE=true

# ==========================================
# PDF TEXT RECOVERY (Task F2)
# ==========================================
PDF_VALID_CHAR_RATIO=0.60
PDF_FALLBACK_VALID_RATIO=0.70
PDF_PUA_RATIO=0.50
PDF_MAX_PAGES_FOR_FALLBACK=15
PDF_MAX_PAGES_FOR_OCR=5
PDF_PAGE_TIMEOUT_SEC=2
PDF_ENABLE_POPPLER=true
PDF_ENABLE_OCR=true
PDF_OCR_PAGE_TIMEOUT_SEC=3.0
PDF_OCR_TOTAL_TIMEOUT_SEC=20.0

# ==========================================
# MINERU CONFIGURATION
# ==========================================
MINERU_OCR_ENGINE=paddle

# ==========================================
# RATE LIMITING
# ==========================================
CLAUDE_TOKENS_PER_MINUTE=25000
GPT4_TOKENS_PER_MINUTE=8000
NANONETS_CALLS_PER_MINUTE=80
PRICE_UPDATE_INTERVAL_DAYS=90

# ==========================================
# LOGGING
# ==========================================
LOG_LEVEL=INFO
LOG_CLAUDE_CALLS=true
LOG_GPT4_CALLS=true
LOG_PERPLEXITY_CALLS=true

# ==========================================
# ENVIRONMENT
# ==========================================
ENVIRONMENT=development

# ==========================================
# PRICING
# ==========================================
AUTO_UPDATE_PRICES=false
PRICE_UPDATE_INTERVAL_DAYS=90
```

### Production Configuration

```env
# ==========================================
# PRODUCTION CONFIGURATION
# ==========================================

# API Keys (REQUIRED - set your production keys!)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Workflow Feature Flags
ENABLE_WORKFLOW_A=true
ENABLE_WORKFLOW_B=true

# Knowledge Base
ALLOW_WEB_SEARCH=true
USE_PERPLEXITY_PRIMARY=false

# Rate Limiting (Production - conservative)
CLAUDE_TOKENS_PER_MINUTE=20000
GPT4_TOKENS_PER_MINUTE=6000

# Logging (Production - reduced verbosity)
LOG_LEVEL=WARNING
LOG_CLAUDE_CALLS=false
LOG_GPT4_CALLS=false
LOG_PERPLEXITY_CALLS=false

# Environment
ENVIRONMENT=production

# Parsing (Production - stricter)
MAX_FILE_SIZE_MB=25
PDF_MAX_PAGES_FOR_OCR=3
```

---

## Multi-Role Configuration

Multi-role expert system can be configured with environment variables prefixed with `MULTI_ROLE_`.

### `MULTI_ROLE_ENABLED`

**Purpose:** Enable/disable multi-role audit system.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
MULTI_ROLE_ENABLED=true
```

---

### `MULTI_ROLE_GREEN_ROLES`

**Purpose:** Roles to use for GREEN positions (high confidence).

**Type:** `list[string]`

**Default:** `["SME", "ARCH_LIGHT", "ENG_LIGHT", "SUP_LIGHT"]`

**Example:**
```env
MULTI_ROLE_GREEN_ROLES=SME,ARCH_LIGHT,ENG_LIGHT,SUP_LIGHT
```

**Roles:**
- `SME` - Subject Matter Expert (always included)
- `ARCH_LIGHT` - Architect (lightweight)
- `ENG_LIGHT` - Engineer (lightweight)
- `SUP_LIGHT` - Supervisor (lightweight)

---

### `MULTI_ROLE_AMBER_ROLES`

**Purpose:** Roles to use for AMBER positions (medium confidence).

**Type:** `list[string]`

**Default:** `["SME", "ARCH", "ENG", "SUP_LIGHT"]`

**Example:**
```env
MULTI_ROLE_AMBER_ROLES=SME,ARCH,ENG,SUP_LIGHT
```

---

### `MULTI_ROLE_RED_ROLES`

**Purpose:** Roles to use for RED positions (low confidence).

**Type:** `list[string]`

**Default:** `["SME", "ARCH", "ENG", "SUP"]`

**Example:**
```env
MULTI_ROLE_RED_ROLES=SME,ARCH,ENG,SUP
```

**Note:** Full roles (not LIGHT) for thorough review.

---

### `MULTI_ROLE_HITL_ON_RED`

**Purpose:** Require human-in-the-loop (HITL) for RED positions.

**Type:** `boolean`

**Default:** `true`

**Example:**
```env
MULTI_ROLE_HITL_ON_RED=true
```

---

### `MULTI_ROLE_HITL_PRICE_THRESHOLD`

**Purpose:** Price deviation threshold for HITL trigger.

**Type:** `float`

**Default:** `0.15` (15%)

**Example:**
```env
MULTI_ROLE_HITL_PRICE_THRESHOLD=0.15
```

**Meaning:** If price differs by >15% from norm, trigger HITL.

---

### `MULTI_ROLE_CONSENSUS_MAX_ITERATIONS`

**Purpose:** Maximum consensus iterations.

**Type:** `integer`

**Default:** `3`

**Example:**
```env
MULTI_ROLE_CONSENSUS_MAX_ITERATIONS=3
```

---

## Validation & Warnings

The system performs automatic validation on startup and shows warnings for common misconfigurations.

### Warning: Missing ANTHROPIC_API_KEY

```
UserWarning: ANTHROPIC_API_KEY not set! Workflow A will not work.
```

**Fix:** Set `ANTHROPIC_API_KEY` in `.env`

---

### Warning: Missing PERPLEXITY_API_KEY

```
UserWarning: ALLOW_WEB_SEARCH is enabled but PERPLEXITY_API_KEY not set.
Will use local KB only.
```

**Fix:** Either:
1. Set `PERPLEXITY_API_KEY` in `.env`
2. Set `ALLOW_WEB_SEARCH=false`

---

## Best Practices

### Security

1. **Never commit .env to git**
   - `.env` is in `.gitignore` by default
   - Use `.env.example` as template

2. **Rotate API keys regularly**
   - Especially in production
   - Use separate keys for dev/staging/production

3. **Use environment-specific configs**
   - `.env.development`
   - `.env.production`
   - `.env.test`

### Performance

1. **Enable enrichment layer**
   ```env
   ENRICHMENT_ENABLED=true
   ```
   - Reduces audit time by ~30%
   - Reduces API costs

2. **Set conservative rate limits in production**
   ```env
   CLAUDE_TOKENS_PER_MINUTE=20000
   GPT4_TOKENS_PER_MINUTE=6000
   ```

3. **Use Perplexity as fallback, not primary**
   ```env
   USE_PERPLEXITY_PRIMARY=false
   ```
   - Minimizes API costs
   - Faster responses

### Debugging

1. **Enable verbose logging in development**
   ```env
   LOG_LEVEL=DEBUG
   LOG_CLAUDE_CALLS=true
   LOG_GPT4_CALLS=true
   ```

2. **Check logs directory**
   - `logs/claude_calls/` - All Claude API interactions
   - `logs/gpt4_calls/` - All GPT-4 API interactions
   - `logs/perplexity_calls/` - All Perplexity API interactions

3. **Reduce logging in production**
   ```env
   LOG_LEVEL=WARNING
   LOG_CLAUDE_CALLS=false
   ```

---

## Troubleshooting

### Issue: "Workflow A not working"

**Check:**
```bash
# Is ANTHROPIC_API_KEY set?
grep ANTHROPIC_API_KEY .env

# Is Workflow A enabled?
grep ENABLE_WORKFLOW_A .env
```

**Fix:**
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
ENABLE_WORKFLOW_A=true
```

---

### Issue: "Workflow B not available"

**Check:**
```bash
# Is OPENAI_API_KEY set?
grep OPENAI_API_KEY .env

# Is Workflow B enabled?
grep ENABLE_WORKFLOW_B .env
```

**Fix:**
```env
OPENAI_API_KEY=sk-xxxxx
ENABLE_WORKFLOW_B=true
```

---

### Issue: "Rate limit exceeded"

**Check:**
```python
from app.core.rate_limiter import get_rate_limiter
stats = get_rate_limiter().get_usage_stats()
print(stats)
```

**Fix:** Lower rate limits:
```env
CLAUDE_TOKENS_PER_MINUTE=15000
GPT4_TOKENS_PER_MINUTE=5000
```

---

### Issue: "No enrichment data"

**Check:**
```bash
# Is enrichment enabled?
grep ENRICHMENT_ENABLED .env
```

**Fix:**
```env
ENRICHMENT_ENABLED=true
```

---

## Related Documentation

- [README.md](../README.md) - Project overview and quickstart
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [docs/SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - Technical specification
- [CLAUDE.md](../CLAUDE.md) - Claude Code integration guide

---

**Document Version:** 1.0
**Last Updated:** 2024-10-26
**Author:** Concrete Agent Team
