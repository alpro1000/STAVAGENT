# Session 2026-03-23: Gemini Model Fix (flash-lite 404)

**Date:** 2026-03-23
**Branch:** `claude/document-session-fixes-Yq83C`
**Services affected:** concrete-agent, URS_MATCHER_SERVICE, Monolit-Planner, stavagent-portal
**Commits:** 3 (f39cfc8, 856f20f, 7b7a1f1)

---

## Problem

`gemini-2.5-flash-lite` — documented as available in europe-west3 on Vertex AI — returns HTTP 404 when called via `vertexai.generative_models.GenerativeModel.generate_content()`. This caused the concrete-agent CORE service to fail all LLM calls on Cloud Run.

**Root cause:** Google lists `gemini-2.5-flash-lite` in the model catalog for europe-west3, but the model endpoint is not actually deployed there (as of 2026-03-23). The Vertex AI SDK constructor (`VertexGenerativeModel(model_name)`) succeeds silently — the 404 only surfaces at `generate_content()` time.

---

## Diagnosis

1. Checked Cloud Run logs: `404 Not Found` on every Multi-Role `/ask` call.
2. Verified `config.py` had `GEMINI_MODEL=gemini-2.5-flash-lite` as default.
3. Tested manually: `gemini-2.5-flash` works, `gemini-2.5-flash-lite` does not.
4. Confirmed with Vertex AI model catalog: model is listed but returns 404.

---

## Solution

### 1. Switch default model (commit f39cfc8)
- `config.py`: `GEMINI_MODEL` default `gemini-2.5-flash-lite` → `gemini-2.5-flash`
- Updated across all services: `.env.example`, `cloudbuild*.yaml`, `render.yaml`, `llmConfig.js`
- Total: 17 files changed

### 2. Add probe call with model fallback (commit 856f20f)
- `VertexGeminiClient.__init__()` now sends a tiny probe call (`"Reply with exactly: ok"`) to validate the model actually responds before using it.
- If the configured model fails the probe, it falls through to the next model in `VERTEX_MODELS` list.
- **Class-level cache:** Probe runs once per process; all subsequent instances reuse the validated model — zero extra latency.
- Fallback order: `GEMINI_MODEL` env → `gemini-2.5-flash` → `gemini-2.5-flash-lite` → `gemini-2.5-pro`

### 3. Final default alignment (commit 7b7a1f1)
- Ensured all remaining references use `gemini-2.5-flash` as the default, including `formwork-assistant.js` and `PlannerPage.tsx`.

---

## Files Changed

| File | Change |
|------|--------|
| `concrete-agent/packages/core-backend/app/core/config.py` | Default `gemini-2.5-flash` |
| `concrete-agent/packages/core-backend/app/core/gemini_client.py` | Probe call + class cache + VERTEX_MODELS list |
| `concrete-agent/packages/core-backend/.env.example` | Updated model name |
| `concrete-agent/packages/core-backend/app/api/routes_kb_research.py` | Updated model reference |
| `concrete-agent/packages/core-backend/app/services/passport_enricher.py` | Updated model reference |
| `concrete-agent/packages/core-backend/app/services/price_parser/llm_client.py` | Updated model reference |
| `concrete-agent/render.yaml` | Updated env var |
| `cloudbuild.yaml`, `cloudbuild-concrete.yaml`, `cloudbuild-urs.yaml` | Updated model in deploy args |
| `URS_MATCHER_SERVICE/backend/.env.example` | Updated model |
| `URS_MATCHER_SERVICE/backend/src/config/llmConfig.js` | Updated model |
| `URS_MATCHER_SERVICE/backend/src/services/geminiBlockClassifier.js` | Updated model |
| `Monolit-Planner/backend/src/routes/formwork-assistant.js` | Updated model |
| `stavagent-portal/backend/src/routes/connections.js` | Updated model |
| `CLAUDE.md` | Quick Debugging note about flash-lite 404 |

---

## Takeaways

1. **Never trust model catalog availability** — always validate with a real API call.
2. **Probe call pattern** is now standard in `VertexGeminiClient` — new models can be added to `VERTEX_MODELS` and will auto-fallback.
3. **Class-level cache** prevents probe from running on every request — only once per process lifecycle.
4. `gemini-2.5-flash` is the reliable default for europe-west3 as of 2026-03-23.
