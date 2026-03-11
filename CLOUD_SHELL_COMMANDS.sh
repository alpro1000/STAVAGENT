#!/usr/bin/env bash
# ================================================================
# STAVAGENT — Cloud Shell Setup (все сервисы)
#
# Как использовать:
#   1. Заполни секцию "КЛЮЧИ" ниже (пустые "")
#   2. Запусти всё:   bash CLOUD_SHELL_COMMANDS.sh
#      Или только один сервис:
#                     bash CLOUD_SHELL_COMMANDS.sh concrete-agent
#                     bash CLOUD_SHELL_COMMANDS.sh portal-backend
#                     bash CLOUD_SHELL_COMMANDS.sh monolit-api
#                     bash CLOUD_SHELL_COMMANDS.sh urs-matcher
#                     bash CLOUD_SHELL_COMMANDS.sh registry-backend
#                     bash CLOUD_SHELL_COMMANDS.sh vercel
#
# Примечание: --set-env-vars ЗАМЕНЯЕТ все переменные сервиса.
#             Список ниже — полный, всё прописано.
# ================================================================
set -euo pipefail

# ----------------------------------------------------------------
# КОНФИГУРАЦИЯ
# ----------------------------------------------------------------

REGION="europe-west4"
# Проверь свой регион: gcloud run services list

# ----------------------------------------------------------------
# ЗАПОЛНИ КЛЮЧИ (пустые значения)
# ----------------------------------------------------------------

# --- БД (уже заполнены, не меняй если не менял пароль) ---
DB_PG_ASYNC='postgresql+asyncpg://stavagent_portal:StavagentPortal2026!@34.185.183.36/stavagent_portal'
DB_PG='postgresql://stavagent_portal:StavagentPortal2026!@34.185.183.36/stavagent_portal'

# --- AI ключи ---
GOOGLE_API_KEY=""              # https://aistudio.google.com/app/apikey
ANTHROPIC_API_KEY=""           # https://console.anthropic.com/keys
OPENAI_API_KEY=""              # https://platform.openai.com/api-keys
PPLX_API_KEY=""                # https://www.perplexity.ai/api
BRAVE_API_KEY=""               # https://api.search.brave.com/register

# --- AWS Bedrock ---
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""

# --- Google OAuth2 (Google Drive в concrete-agent) ---
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=""   # openssl rand -base64 32
GOOGLE_WEBHOOK_SECRET_KEY=""           # openssl rand -hex 32

# --- Безопасность ---
JWT_SECRET=""                  # openssl rand -base64 32
KEEP_ALIVE_KEY=""              # openssl rand -base64 32

# ================================================================
# ФУНКЦИИ
# ================================================================

setup_concrete_agent() {
  echo ""
  echo "==> [1/5] concrete-agent (Cloud Run)..."
  gcloud run services update concrete-agent \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG_ASYNC|\
ENVIRONMENT=production|\
GOOGLE_API_KEY=$GOOGLE_API_KEY|\
GEMINI_MODEL=gemini-2.5-flash-lite|\
GEMINI_MODEL_PRO=gemini-2.5-pro|\
MULTI_ROLE_LLM=gemini|\
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|\
CLAUDE_MODEL=claude-3-5-haiku-latest|\
CLAUDE_MODEL_HEAVY=claude-sonnet-4-20250514|\
OPENAI_API_KEY=$OPENAI_API_KEY|\
OPENAI_MODEL=gpt-5-mini|\
OPENAI_MODEL_HEAVY=gpt-4.1|\
PPLX_API_KEY=$PPLX_API_KEY|\
PPLX_MODEL=sonar|\
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID|\
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY|\
AWS_DEFAULT_REGION=eu-central-1|\
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID|\
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET|\
GOOGLE_OAUTH_REDIRECT_URI=https://concrete-agent-3uxelthc4q-ey.a.run.app/api/v1/google/callback|\
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=$GOOGLE_CREDENTIALS_ENCRYPTION_KEY|\
GOOGLE_WEBHOOK_SECRET_KEY=$GOOGLE_WEBHOOK_SECRET_KEY|\
PUBLIC_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app|\
ENABLE_WORKFLOW_A=true|\
ENABLE_WORKFLOW_B=true|\
USE_MINERU=true|\
USE_CLAUDE_VISION=true|\
ENABLE_KROS_MATCHING=true|\
ENABLE_RTS_MATCHING=true|\
ENABLE_RESOURCE_CALCULATION=true|\
LOG_LEVEL=INFO|\
LOG_CLAUDE_CALLS=true|\
LOG_GPT4_CALLS=true|\
KEEP_ALIVE_KEY=$KEEP_ALIVE_KEY"
  echo "✅ concrete-agent обновлён"
}

setup_portal_backend() {
  echo ""
  echo "==> [2/5] stavagent-portal-backend (Cloud Run)..."
  gcloud run services update stavagent-portal-backend \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
PORT=8080|\
JWT_SECRET=$JWT_SECRET|\
JWT_EXPIRY=24h|\
CORE_API_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app|\
CORS_ORIGIN=https://www.stavagent.cz|\
UPLOAD_DIR=./uploads|\
EXPORT_DIR=./exports|\
MAX_FILE_SIZE=10485760"
  echo "✅ stavagent-portal-backend обновлён"
}

setup_monolit_api() {
  echo ""
  echo "==> [3/5] monolit-planner-api (Cloud Run)..."
  gcloud run services update monolit-planner-api \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
PORT=8080|\
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app|\
CORE_API_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app|\
CORE_TIMEOUT=90000|\
ENABLE_CORE_FALLBACK=true|\
GOOGLE_AI_KEY=$GOOGLE_API_KEY|\
GEMINI_MODEL=gemini-2.5-flash-lite|\
OPENAI_API_KEY=$OPENAI_API_KEY|\
OPENAI_MODEL=gpt-5-mini|\
FF_AI_DAYS_SUGGEST=true|\
UPLOAD_DIR=./uploads|\
EXPORT_DIR=./exports|\
MAX_FILE_SIZE=10485760"
  echo "✅ monolit-planner-api обновлён"
}

setup_urs_matcher() {
  echo ""
  echo "==> [4/5] urs-matcher-service (Cloud Run)..."
  gcloud run services update urs-matcher-service \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
PORT=8080|\
LLM_PROVIDER=gemini|\
LLM_TIMEOUT_MS=90000|\
MULTI_ROLE_TIMEOUT_MS=90000|\
MULTI_ROLE_HEALTH_TIMEOUT_MS=30000|\
GOOGLE_API_KEY=$GOOGLE_API_KEY|\
GEMINI_MODEL=gemini-2.5-flash-lite|\
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|\
CLAUDE_MODEL=claude-3-5-haiku-latest|\
OPENAI_API_KEY=$OPENAI_API_KEY|\
OPENAI_MODEL=gpt-5-mini|\
PPLX_API_KEY=$PPLX_API_KEY|\
PPLX_MODEL=sonar|\
PPLX_TIMEOUT_MS=60000|\
BRAVE_API_KEY=$BRAVE_API_KEY|\
STAVAGENT_API_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app"
  echo "✅ urs-matcher-service обновлён"
}

setup_registry_backend() {
  echo ""
  echo "==> [5/5] rozpocet-registry-backend (Cloud Run)..."
  gcloud run services update rozpocet-registry-backend \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
PORT=8080|\
CORS_ORIGIN=https://stavagent-backend-ktwx.vercel.app"
  echo "✅ rozpocet-registry-backend обновлён"
}

setup_vercel() {
  echo ""
  echo "==> Vercel frontends (требует: npm i -g vercel && vercel login)"
  echo ""

  # --- stavagent-portal (www.stavagent.cz) ---
  echo "--- stavagent-portal ---"
  cd "$(dirname "$0")/stavagent-portal/frontend"
  vercel link --yes 2>/dev/null || true
  echo "true" | vercel env add VITE_DISABLE_AUTH production --force
  echo "https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app" | vercel env add VITE_API_URL production --force
  echo "https://concrete-agent-3uxelthc4q-ey.a.run.app" | vercel env add VITE_CONCRETE_AGENT_URL production --force
  cd "$(dirname "$0")"

  # --- monolit-planner-frontend ---
  echo "--- monolit-planner-frontend ---"
  cd "$(dirname "$0")/Monolit-Planner/frontend"
  vercel link --yes 2>/dev/null || true
  echo "https://monolit-planner-api-3uxelthc4q-ey.a.run.app" | vercel env add VITE_API_URL production --force
  cd "$(dirname "$0")"

  # --- rozpocet-registry (frontend) ---
  echo "--- rozpocet-registry ---"
  cd "$(dirname "$0")/rozpocet-registry"
  vercel link --yes 2>/dev/null || true
  echo "https://rozpocet-registry-backend-3uxelthc4q-ey.a.run.app" | vercel env add VITE_API_URL production --force
  echo "$GOOGLE_API_KEY" | vercel env add GEMINI_API_KEY production --force
  echo "gemini-2.5-flash-lite" | vercel env add GEMINI_MODEL production --force
  cd "$(dirname "$0")"

  echo "✅ Vercel env vars обновлены"
}

# ================================================================
# MAIN
# ================================================================

TARGET="${1:-all}"

case "$TARGET" in
  concrete-agent)    setup_concrete_agent ;;
  portal-backend)    setup_portal_backend ;;
  monolit-api)       setup_monolit_api ;;
  urs-matcher)       setup_urs_matcher ;;
  registry-backend)  setup_registry_backend ;;
  vercel)            setup_vercel ;;
  all)
    setup_concrete_agent
    setup_portal_backend
    setup_monolit_api
    setup_urs_matcher
    setup_registry_backend
    echo ""
    echo "================================================================"
    echo "✅ Все Cloud Run сервисы обновлены!"
    echo ""
    echo "Vercel frontends — запусти отдельно (нужен vercel login):"
    echo "  bash CLOUD_SHELL_COMMANDS.sh vercel"
    echo ""
    echo "Vercel Dashboard (если нет CLI):"
    echo "  stavagent-portal:         VITE_DISABLE_AUTH=true"
    echo "                            VITE_API_URL=https://stavagent-portal-backend-3uxelthc4q-ey.a.run.app"
    echo "                            VITE_CONCRETE_AGENT_URL=https://concrete-agent-3uxelthc4q-ey.a.run.app"
    echo "  monolit-planner-frontend: VITE_API_URL=https://monolit-planner-api-3uxelthc4q-ey.a.run.app"
    echo "  rozpocet-registry:        VITE_API_URL=https://rozpocet-registry-backend-3uxelthc4q-ey.a.run.app"
    echo "                            GEMINI_API_KEY=<ключ>"
    echo "                            GEMINI_MODEL=gemini-2.5-flash-lite"
    echo "================================================================"
    ;;
  *)
    echo "Использование: bash CLOUD_SHELL_COMMANDS.sh [concrete-agent|portal-backend|monolit-api|urs-matcher|registry-backend|vercel|all]"
    exit 1
    ;;
esac
