# Model Connectivity Report

Generated: 2026-03-11T18:18:43Z

## Где смотреть результат

- Отчёт сохраняется в: MODEL_CONNECTION_REPORT.md (корень репозитория).
- Скрипт: ./scripts/check_model_connections.sh.

## 1) Service-level model wiring (static audit)

- **concrete-agent (CORE)**: uses Gemini/Claude/OpenAI in backend (MULTI_ROLE_LLM, GOOGLE_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY).
- **URS_MATCHER_SERVICE**: multi-provider LLM with fallback (Gemini/OpenAI/Claude + optional Perplexity).
- **Monolit-Planner backend**: AI chain in formwork assistant (Gemini -> OpenAI -> CORE multi-role).
- **stavagent-portal backend**: no direct LLM calls detected; integrates with CORE API.
- **rozpocet-registry**: Vercel API route uses Claude/Gemini directly.
- **rozpocet-registry-backend**: no direct LLM calls detected.

## 2) Runtime env check (current shell)

- GOOGLE_API_KEY: ❌ not set
- GEMINI_API_KEY: ❌ not set
- ANTHROPIC_API_KEY: ❌ not set
- OPENAI_API_KEY: ❌ not set
- PPLX_API_KEY: ❌ not set
- LLM_PROVIDER: <unset>
- GEMINI_MODEL: <unset>
- CLAUDE_MODEL: <unset>
- OPENAI_MODEL: <unset>

## 3) External provider reachability checks
(Network-only smoke checks from this environment; auth may intentionally fail with 401/400.)

- Google Gemini API: HTTP 403; response sample: `{
  "error": {
    "code": 403,
    "message": "Method doesn't allow unregistered callers (callers without established identity). Please use API Key or other form of API consumer identity to call this API.",
    "status"`
- Anthropic API: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`
- OpenAI API: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`
- Perplexity API: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`

## 4) Production service reachability checks

- Portal API /health: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`
- Monolit API /health: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`
- CORE /health: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`
- URS Matcher /health: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`
- Registry backend /health: ❌ request failed (rc=56); error: `curl: (56) CONNECT tunnel failed, response 403`

## 5) Token usage & cost estimate (from logs)

- Источник: JSON-логи вызовов моделей (если они сохраняются сервисами).
- Формула стоимости: `(input_tokens/1e6 * input_price) + (output_tokens/1e6 * output_price)`.
- ВАЖНО: это **приблизительная** оценка для бюджета; фактический биллинг смотрите в кабинетах провайдеров.

- Логи не найдены: директории логов отсутствуют или пустые.
- Данные по токенам не обнаружены в логах (нет полей `*_tokens` / `tokens_used` / `model`).

| Model | Provider | Calls | Input tokens | Output tokens | Total tokens | Est. cost USD |
|---|---:|---:|---:|---:|---:|---:|
| n/a | n/a | 0 | 0 | 0 | 0 | 0.0000 |

## 6) Verdict

- Based on code wiring, model integrations are implemented across CORE, URS matcher, Monolit (assistant), and Registry API routes.
- In this execution environment, external AI/provider endpoints and public service health URLs are blocked (CONNECT tunnel 403), so live end-to-end model calls could not be confirmed.
- Token/cost section now shows spend estimate by model **when logs include token usage fields**.
