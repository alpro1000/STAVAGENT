# Gemini Integration for Multi-Role API

## 💰 Cost Savings

**Before (Claude Sonnet):**
- Input: $3 per 1M tokens
- Output: $15 per 1M tokens
- Multi-Role request (30k tokens): **$0.10-0.50 per request**

**After (Gemini 2.5 Flash via Vertex AI):**
- Vertex AI: billed through GCP project credits (ADC, no API key on Cloud Run)
- Paid tier: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- Multi-Role request: **~$0.005 per request**

## 🚀 Quick Setup

### 1. Get Google AI API Key (FREE)

1. Go to https://aistudio.google.com/
2. Click "Get API Key"
3. Create new project or use existing
4. Copy API key

### 2. Install Dependencies

```bash
cd concrete-agent/packages/core-backend
pip install google-generativeai==0.8.3
```

Or install all requirements:
```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Add to `.env` or Render environment variables:

```bash
# Required: Google AI API key
GOOGLE_API_KEY=your-google-api-key-here

# Optional: Choose Gemini model (default: gemini-2.5-flash)
GEMINI_MODEL=gemini-2.5-flash

# Optional: Choose LLM for Multi-Role (default: vertex-ai-gemini)
# Options: "vertex-ai-gemini" (Cloud Run ADC), "gemini" (API key), "claude", "bedrock", "auto"
MULTI_ROLE_LLM=vertex-ai-gemini
```

### 4. Test Gemini Client

```bash
cd concrete-agent/packages/core-backend
python scripts/test_gemini_client.py
```

Expected output:
```
✅ Gemini client initialized with model: gemini-2.5-flash
✅ TEST PASSED: Gemini returned valid JSON!
✅ TEST PASSED: Gemini handled Multi-Role prompt!
🎉 ALL TESTS PASSED!
```

## Available Models (updated 2026-03-23)

| Model | Status (europe-west3) | Cost (input/output) | Speed | Quality |
|-------|----------------------|---------------------|-------|---------|
| **gemini-2.5-flash** | **GA, verified working** | $0.15/$0.60 per MTok | Fast | High |
| gemini-2.5-pro | GA, available | $1.25/$10.00 per MTok | Slow | Highest |
| gemini-2.5-flash-lite | **404 in practice** | N/A | N/A | N/A |
| claude-sonnet-4-6 | Via Anthropic API | $3/$15 per MTok | Medium | Highest |
| claude-haiku-4-5 | Via AWS Bedrock | ~$0.80/$4 per MTok | Fast | High |

**Recommendation**: Use `gemini-2.5-flash` via Vertex AI (ADC on Cloud Run, GCP credits)

**Warning**: `gemini-2.5-flash-lite` is listed in Google docs but returns 404 in europe-west3 (as of 2026-03-23). The `VertexGeminiClient` probe call will auto-skip it.

## ⚙️ Multi-Role LLM Modes

### Mode 1: Gemini Only (Default)
```bash
MULTI_ROLE_LLM=gemini
```
- All Multi-Role requests use Gemini
- Falls back to Claude if Gemini unavailable
- **Cheapest option** (FREE or 40x cheaper)

### Mode 2: Claude Only
```bash
MULTI_ROLE_LLM=claude
```
- All Multi-Role requests use Claude Sonnet
- Highest quality but most expensive
- Use if Gemini quality insufficient

### Mode 3: Auto (Gemini + Claude Fallback)
```bash
MULTI_ROLE_LLM=auto
```
- Tries Gemini first
- Falls back to Claude on error
- Best for production reliability

## 🧪 Testing Multi-Role with Gemini

### Test via API:

```bash
curl -X POST http://localhost:8000/api/v1/multi-role/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the minimum concrete class for outdoor foundations in Czech Republic?",
    "enable_kb": true
  }'
```

Expected response:
```json
{
  "answer": "C30/37 minimum for XC4 exposure...",
  "complexity": "simple",
  "roles_consulted": ["concrete_specialist"],
  "confidence": 0.95,
  "total_tokens": 1234,
  ...
}
```

### Check logs:

```
✅ Using Gemini for Multi-Role (gemini-2.5-flash)
🎯 Executing 3 roles for complexity: COMPLEX
   Roles: ['document_validator', 'concrete_specialist', 'standards_checker']
[1/3] Invoking document_validator...
   ✅ Success
```

## 🐛 Troubleshooting

### Error: "GOOGLE_API_KEY not set"
**Solution**: Add `GOOGLE_API_KEY` to `.env` or environment variables

### Error: "google-generativeai not installed"
**Solution**: `pip install google-generativeai==0.8.3`

### Error: "Gemini API call failed: 400"
**Possible causes:**
1. Invalid API key - regenerate at https://aistudio.google.com/
2. Rate limit exceeded (1500 req/day on free tier)
3. Prompt too large (>1M tokens)

**Solution**: Check Gemini quota in Google AI Studio

### Gemini returns raw_text instead of JSON
**Cause**: Role prompts now specify JSON format (updated in latest commits)

**Solution**: Pull latest changes with JSON prompt updates:
```bash
git pull origin claude/read-documentation-files-01Vo44KnWy6z62npLLLTPg1C
```

## 📈 Production Deployment

### Render Environment Variables:

```bash
GOOGLE_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash
MULTI_ROLE_LLM=auto
```

### Monitor Usage:

Check Google AI Studio → Quotas:
- Free tier: 1,500 requests/day
- If exceeded, upgrade to paid tier ($0.075/MTok)

### Cost Estimate:

**With 100 Multi-Role requests/day:**
- Gemini FREE tier: $0/month ✅
- Gemini paid tier: $0.60/month
- Claude Sonnet: $30-150/month 💸

**Savings: 50-250x cheaper with Gemini!**

## 🔄 Rollback to Claude

If Gemini quality is insufficient:

```bash
# In Render environment or .env:
MULTI_ROLE_LLM=claude
```

Redeploy. System will use Claude for all Multi-Role requests.

## 📝 Notes

- Gemini 2.5 Flash is GA and the default model (verified in europe-west3)
- On Cloud Run: use `vertex-ai-gemini` mode (ADC auth, no API key needed)
- Local dev: use `gemini` mode with `GOOGLE_API_KEY` from AI Studio
- Large prompts (~30k tokens) work fine with Gemini 1M context
- Gemini supports JSON mode natively (good for structured output)
- `gemini-2.5-flash-lite` returns 404 in europe-west3 despite being listed in docs (2026-03-23)

## ✅ Checklist

- [ ] Get Google AI API key from https://aistudio.google.com/
- [ ] Install `google-generativeai==0.8.3`
- [ ] Set `GOOGLE_API_KEY` in environment
- [ ] Run `python scripts/test_gemini_client.py`
- [ ] Test Multi-Role API with Gemini
- [ ] Monitor logs for "Using Gemini for Multi-Role"
- [ ] Deploy to Render with Gemini config
- [ ] Monitor costs (should be FREE or near-zero)

---

**Last Updated**: 2026-03-23
**Related Commits**:
- Gemini client implementation
- Multi-Role orchestrator Gemini support
- JSON prompt format updates for all roles
