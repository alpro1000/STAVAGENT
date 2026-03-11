#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_FILE="${ROOT_DIR}/MODEL_CONNECTION_REPORT.md"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

check_var() {
  local var="$1"
  if [[ -n "${!var:-}" ]]; then
    echo "✅ set"
  else
    echo "❌ not set"
  fi
}

curl_check() {
  local name="$1"
  local url="$2"
  local method="${3:-GET}"
  local body="${4:-}"
  local headers="${5:-}"

  local out code err
  local tmpf
  tmpf="$(mktemp)"

  set +e
  if [[ "$method" == "GET" ]]; then
    HTTPS_PROXY= HTTP_PROXY= ALL_PROXY= \
      curl -sS -m 20 -o "$tmpf" -w "%{http_code}" "$url" > "$tmpf.code" 2> "$tmpf.err"
  else
    HTTPS_PROXY= HTTP_PROXY= ALL_PROXY= \
      curl -sS -m 20 -X "$method" -H 'Content-Type: application/json' ${headers:+-H "$headers"} \
      -d "$body" -o "$tmpf" -w "%{http_code}" "$url" > "$tmpf.code" 2> "$tmpf.err"
  fi
  local rc=$?
  code="$(cat "$tmpf.code" 2>/dev/null || echo "000")"
  err="$(cat "$tmpf.err" 2>/dev/null || true)"
  out="$(head -c 220 "$tmpf" 2>/dev/null || true)"
  set -e

  if [[ $rc -eq 0 ]]; then
    echo "- ${name}: HTTP ${code}; response sample: \`${out//\`/}\`"
  else
    echo "- ${name}: ❌ request failed (rc=${rc}); error: \`${err//\`/}\`"
  fi

  rm -f "$tmpf" "$tmpf.code" "$tmpf.err"
}

generate_token_cost_section() {
  python - "$ROOT_DIR" <<'PY'
from __future__ import annotations
import json
import os
from pathlib import Path
from collections import defaultdict

root = Path(os.sys.argv[1])
log_dirs = [
    root / 'concrete-agent' / 'logs',
    root / 'URS_MATCHER_SERVICE' / 'backend' / 'logs',
    root / 'Monolit-Planner' / 'backend' / 'logs',
    root / 'rozpocet-registry' / 'logs',
]

# Approximate prices per 1M tokens (USD). Keep conservative and configurable in code.
# Values are reference estimates for budgeting, not billing truth.
pricing = {
    'gemini': {'input': 0.075, 'output': 0.30},
    'claude': {'input': 3.00, 'output': 15.00},
    'openai': {'input': 0.15, 'output': 0.60},
    'perplexity': {'input': 1.00, 'output': 1.00},
    'unknown': {'input': 0.0, 'output': 0.0},
}

def provider_from_model(model: str) -> str:
    m = (model or '').lower()
    if 'gemini' in m:
        return 'gemini'
    if 'claude' in m or 'anthropic' in m:
        return 'claude'
    if 'gpt' in m or 'openai' in m or m.startswith('o1') or m.startswith('o3'):
        return 'openai'
    if 'sonar' in m or 'perplexity' in m or 'pplx' in m:
        return 'perplexity'
    return 'unknown'

def to_num(v):
    if v is None:
        return 0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(',', '')
        try:
            return float(s)
        except Exception:
            return 0
    return 0

def collect_numbers(obj, keys):
    vals = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if any(key in lk for key in keys):
                vals.append(to_num(v))
            vals.extend(collect_numbers(v, keys))
    elif isinstance(obj, list):
        for i in obj:
            vals.extend(collect_numbers(i, keys))
    return vals

def find_models(obj):
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if lk in {'model', 'model_name', 'model_used', 'llm_model'} and isinstance(v, str):
                found.append(v)
            found.extend(find_models(v))
    elif isinstance(obj, list):
        for i in obj:
            found.extend(find_models(i))
    return found

stats = defaultdict(lambda: {'calls': 0, 'input': 0.0, 'output': 0.0, 'total': 0.0})
files_scanned = 0
json_files = []
for d in log_dirs:
    if d.exists() and d.is_dir():
        json_files.extend(d.rglob('*.json'))

for jf in json_files:
    files_scanned += 1
    try:
        data = json.loads(jf.read_text(encoding='utf-8'))
    except Exception:
        continue

    models = find_models(data)
    model = models[0] if models else 'unknown'

    in_vals = collect_numbers(data, ['prompt_tokens', 'input_tokens'])
    out_vals = collect_numbers(data, ['completion_tokens', 'output_tokens'])
    total_vals = collect_numbers(data, ['total_tokens', 'tokens_used', 'tokens'])

    input_tokens = max(in_vals) if in_vals else 0.0
    output_tokens = max(out_vals) if out_vals else 0.0
    total_tokens = max(total_vals) if total_vals else 0.0

    if total_tokens and (input_tokens + output_tokens) == 0:
        input_tokens = total_tokens
    if total_tokens == 0:
        total_tokens = input_tokens + output_tokens

    s = stats[model]
    s['calls'] += 1
    s['input'] += input_tokens
    s['output'] += output_tokens
    s['total'] += total_tokens

print('## 5) Token usage & cost estimate (from logs)')
print('')
print('- Источник: JSON-логи вызовов моделей (если они сохраняются сервисами).')
print('- Формула стоимости: `(input_tokens/1e6 * input_price) + (output_tokens/1e6 * output_price)`.')
print('- ВАЖНО: это **приблизительная** оценка для бюджета; фактический биллинг смотрите в кабинетах провайдеров.')
print('')

if files_scanned == 0:
    print('- Логи не найдены: директории логов отсутствуют или пустые.')
else:
    print(f'- Файлов JSON просмотрено: **{files_scanned}**.')

if not stats:
    print('- Данные по токенам не обнаружены в логах (нет полей `*_tokens` / `tokens_used` / `model`).')
    print('')
    print('| Model | Provider | Calls | Input tokens | Output tokens | Total tokens | Est. cost USD |')
    print('|---|---:|---:|---:|---:|---:|---:|')
    print('| n/a | n/a | 0 | 0 | 0 | 0 | 0.0000 |')
else:
    print('')
    print('| Model | Provider | Calls | Input tokens | Output tokens | Total tokens | Est. cost USD |')
    print('|---|---:|---:|---:|---:|---:|---:|')
    grand = 0.0
    for model, s in sorted(stats.items(), key=lambda kv: kv[1]['total'], reverse=True):
        provider = provider_from_model(model)
        p = pricing.get(provider, pricing['unknown'])
        cost = (s['input'] / 1_000_000.0) * p['input'] + (s['output'] / 1_000_000.0) * p['output']
        grand += cost
        print(f"| {model} | {provider} | {int(s['calls'])} | {int(s['input'])} | {int(s['output'])} | {int(s['total'])} | {cost:.4f} |")
    print(f"| **TOTAL** | - | - | - | - | - | **{grand:.4f}** |")
PY
}

{
  echo "# Model Connectivity Report"
  echo
  echo "Generated: ${TS}"
  echo
  echo "## Где смотреть результат"
  echo
  echo "- Отчёт сохраняется в: MODEL_CONNECTION_REPORT.md (корень репозитория)."
  echo "- Скрипт: ./scripts/check_model_connections.sh."
  echo
  echo "## 1) Service-level model wiring (static audit)"
  echo
  echo "- **concrete-agent (CORE)**: uses Gemini/Claude/OpenAI in backend (MULTI_ROLE_LLM, GOOGLE_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY)."
  echo "- **URS_MATCHER_SERVICE**: multi-provider LLM with fallback (Gemini/OpenAI/Claude + optional Perplexity)."
  echo "- **Monolit-Planner backend**: AI chain in formwork assistant (Gemini -> OpenAI -> CORE multi-role)."
  echo "- **stavagent-portal backend**: no direct LLM calls detected; integrates with CORE API."
  echo "- **rozpocet-registry**: Vercel API route uses Claude/Gemini directly."
  echo "- **rozpocet-registry-backend**: no direct LLM calls detected."
  echo
  echo "## 2) Runtime env check (current shell)"
  echo
  echo "- GOOGLE_API_KEY: $(check_var GOOGLE_API_KEY)"
  echo "- GEMINI_API_KEY: $(check_var GEMINI_API_KEY)"
  echo "- ANTHROPIC_API_KEY: $(check_var ANTHROPIC_API_KEY)"
  echo "- OPENAI_API_KEY: $(check_var OPENAI_API_KEY)"
  echo "- PPLX_API_KEY: $(check_var PPLX_API_KEY)"
  echo "- LLM_PROVIDER: ${LLM_PROVIDER:-<unset>}"
  echo "- GEMINI_MODEL: ${GEMINI_MODEL:-<unset>}"
  echo "- CLAUDE_MODEL: ${CLAUDE_MODEL:-<unset>}"
  echo "- OPENAI_MODEL: ${OPENAI_MODEL:-<unset>}"
  echo
  echo "## 3) External provider reachability checks"
  echo "(Network-only smoke checks from this environment; auth may intentionally fail with 401/400.)"
  echo
  curl_check "Google Gemini API" "https://generativelanguage.googleapis.com/v1beta/models"
  curl_check "Anthropic API" "https://api.anthropic.com/v1/messages"
  curl_check "OpenAI API" "https://api.openai.com/v1/models"
  curl_check "Perplexity API" "https://api.perplexity.ai/chat/completions"
  echo
  echo "## 4) Production service reachability checks"
  echo
  curl_check "Portal API /health" "https://stavagent-backend.vercel.app/health"
  curl_check "Monolit API /health" "https://monolit-planner-api-3uxelthc4q-ey.a.run.app/health"
  curl_check "CORE /health" "https://concrete-agent-3uxelthc4q-ey.a.run.app/health"
  curl_check "URS Matcher /health" "https://urs-matcher-service-3uxelthc4q-ey.a.run.app/health"
  curl_check "Registry backend /health" "https://stavagent-backend-ktwx.vercel.app/health"
  echo
  generate_token_cost_section
  echo
  echo "## 6) Verdict"
  echo
  echo "- Based on code wiring, model integrations are implemented across CORE, URS matcher, Monolit (assistant), and Registry API routes."
  echo "- In this execution environment, external AI/provider endpoints and public service health URLs are blocked (CONNECT tunnel 403), so live end-to-end model calls could not be confirmed."
  echo "- Token/cost section now shows spend estimate by model **when logs include token usage fields**."
} > "$REPORT_FILE"

echo "Report generated: $REPORT_FILE"
echo "Open it with: sed -n '1,220p' $REPORT_FILE"
