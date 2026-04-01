#!/usr/bin/env bash
# ================================================================
# STAVAGENT — Cloud Shell Setup (все 8 сервисов)
# ================================================================
# Как использовать:
#   1. Установи LLM_CHOICE ниже (gemini / claude / openai / auto)
#   2. Заполни API ключи своего провайдера (остальные оставь "")
#   3. Запусти:
#        bash CLOUD_SHELL_COMMANDS.sh          # все Cloud Run
#        bash CLOUD_SHELL_COMMANDS.sh concrete-agent
#        bash CLOUD_SHELL_COMMANDS.sh portal-backend
#        bash CLOUD_SHELL_COMMANDS.sh monolit-api
#        bash CLOUD_SHELL_COMMANDS.sh urs-matcher
#        bash CLOUD_SHELL_COMMANDS.sh registry-backend
#        bash CLOUD_SHELL_COMMANDS.sh vercel
#
# Как добавить реальные ключи позже:
#   nano CLOUD_SHELL_COMMANDS.sh   → заполни "" значения → запусти снова
#   Или через Vercel Dashboard / GCP Console → Cloud Run → Edit & Deploy
#
# ⚠️  --set-env-vars ЗАМЕНЯЕТ ВСЕ переменные сервиса целиком.
#     Список ниже полный — ничего лишнего не потеряется.
# ================================================================
set -euo pipefail

# ================================================================
# 🌍 РЕГИОН
# ================================================================
REGION="europe-west3"
# Узнать свой регион: gcloud run services list

# ================================================================
# 🤖 ВЫБОР ПРОВАЙДЕРА (одна переменная управляет всеми сервисами)
# ================================================================
#
#  Почему в разных сервисах разные переменные для LLM:
#  ┌──────────────────────────┬──────────────────┬────────────────────────────────────────────┐
#  │ Сервис                   │ Переменная       │ Причина                                    │
#  ├──────────────────────────┼──────────────────┼────────────────────────────────────────────┤
#  │ concrete-agent (Python)  │ MULTI_ROLE_LLM   │ Разработан первым, своя архитектура роутинга│
#  │ urs-matcher (Node.js)    │ LLM_PROVIDER     │ Разработан независимо, свой llmConfig.js   │
#  │ monolit-planner (Node.js)│ нет селектора    │ Fallback по ключам: Gemini→OpenAI→CORE     │
#  │ rozpocet-registry (Vercel│ нет селектора    │ Только Gemini (Vercel serverless functions) │
#  └──────────────────────────┴──────────────────┴────────────────────────────────────────────┘
#  Этот скрипт синхронизирует выбор через LLM_CHOICE → обе переменные.
#
# ┌─────────────────────────────────────────────────────────────────────┐
# │ 💰 ЦЕНЫ (за 1M токенов: input / output)                            │
# │                                                                     │
# │  GEMINI (Google)                                                    │
# │   gemini-2.5-flash-lite   FREE до 1500 req/день  / $0.075 / $0.30  │
# │   gemini-2.5-flash        $0.15 / $0.60                            │
# │   gemini-2.5-pro          $1.25 / $5.00                            │
# │                                                                     │
# │  CLAUDE (Anthropic)                                                 │
# │   claude-haiku-4-5        $0.80 / $4.00   быстрый, дёшево          │
# │   claude-sonnet-4-6       $3.00 / $15.00  баланс качество/цена     │
# │   claude-opus-4-6         $15.00 / $75.00 максимальное качество     │
# │                                                                     │
# │  OPENAI                                                             │
# │   gpt-5-mini              $0.15 / $0.60   быстрый, дёшево          │
# │   gpt-4o                  $2.50 / $10.00  стандарт                 │
# │   gpt-4.1                 $15.00 / $60.00 тяжёлый                  │
# │                                                                     │
# │  PERPLEXITY (поиск в сети)                                          │
# │   sonar                   $1.00 / $1.00   базовый поиск            │
# │   sonar-pro               $3.00 / $15.00  продвинутый поиск        │
# │                                                                     │
# │  AWS Bedrock                                                        │
# │   amazon.nova-micro-v1:0  $0.035 / $0.14  самый дешёвый            │
# │   amazon.nova-lite-v1:0   $0.06 / $0.24   лёгкий                   │
# │   amazon.nova-pro-v1:0    $0.80 / $3.20   профессиональный         │
# └─────────────────────────────────────────────────────────────────────┘
#
# 👉 РЕКОМЕНДАЦИЯ: Начни с "gemini" — бесплатно / очень дёшево.
#    "auto" = Gemini → Claude fallback (надёжнее, немного дороже).
#    "claude" или "openai" — если нужно максимальное качество.

LLM_CHOICE="gemini"   # "gemini" | "claude" | "openai" | "auto"

# ================================================================
# 📦 МОДЕЛИ (light=быстро/дёшево, std=баланс, heavy=качество/дорого)
# ================================================================

# --- Gemini ---
GEMINI_LIGHT="gemini-2.5-flash-lite"   # 💚 FREE tier / $0.075 input
GEMINI_STD="gemini-2.5-flash"          # 💛 $0.15 input
GEMINI_HEAVY="gemini-2.5-pro"          # 🔴 $1.25 input

# --- Claude ---
CLAUDE_LIGHT="claude-haiku-4-5-20251001"  # 💚 $0.80 input
CLAUDE_STD="claude-sonnet-4-6"            # 💛 $3.00 input
CLAUDE_HEAVY="claude-opus-4-6"            # 🔴 $15.00 input

# --- OpenAI ---
OPENAI_LIGHT="gpt-5-mini"   # 💚 $0.15 input
OPENAI_STD="gpt-4o"         # 💛 $2.50 input
OPENAI_HEAVY="gpt-4.1"      # 🔴 $15.00 input

# --- Perplexity ---
PPLX_LIGHT="sonar"          # 💚 $1.00 input
PPLX_HEAVY="sonar-pro"      # 💛 $3.00 input

# --- AWS Bedrock ---
AWS_LIGHT="amazon.nova-micro-v1:0"   # 💚 $0.035 input
AWS_STD="amazon.nova-lite-v1:0"      # 💛 $0.06 input
AWS_HEAVY="amazon.nova-pro-v1:0"     # 🔴 $0.80 input

# ================================================================
# 🔑 API КЛЮЧИ — ЗАПОЛНИ СВОИ (пустые "" оставь если не используешь)
# ================================================================

# --- БД (используй GCP Secret Manager, НЕ хардкодь пароли!) ---
DB_PG_ASYNC='postgresql+asyncpg://stavagent_portal:<PASSWORD_FROM_SECRET_MANAGER>@<CLOUD_SQL_IP>/stavagent_portal'
DB_PG='postgresql://stavagent_portal:<PASSWORD_FROM_SECRET_MANAGER>@<CLOUD_SQL_IP>/stavagent_portal'

# --- Google / Gemini ---         https://aistudio.google.com/app/apikey
GOOGLE_API_KEY=""

# --- Anthropic / Claude ---      https://console.anthropic.com/keys
ANTHROPIC_API_KEY=""

# --- OpenAI ---                  https://platform.openai.com/api-keys
OPENAI_API_KEY=""

# --- Perplexity (поиск) ---      https://www.perplexity.ai/api
PPLX_API_KEY=""

# --- Brave Search ---            https://api.search.brave.com/register
BRAVE_API_KEY=""

# --- AWS Bedrock ---             https://console.aws.amazon.com/iam
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""

# --- Google OAuth2 (Google Drive в concrete-agent) ---
GOOGLE_CLIENT_ID=""                    # https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_SECRET=""
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=""   # сгенерируй: openssl rand -base64 32
GOOGLE_WEBHOOK_SECRET_KEY=""           # сгенерируй: openssl rand -hex 32

# --- Безопасность ---
JWT_SECRET=""                          # сгенерируй: openssl rand -base64 32
KEEP_ALIVE_KEY=""                      # сгенерируй: openssl rand -base64 32

# ================================================================
# ⚙️  АВТОМАТИЧЕСКОЕ ВЫЧИСЛЕНИЕ (не трогай эту секцию)
# ================================================================
# Маппинг LLM_CHOICE → переменные каждого сервиса:
#   concrete-agent читает MULTI_ROLE_LLM ("gemini"|"claude"|"auto")
#   urs-matcher    читает LLM_PROVIDER   ("gemini"|"claude"|"openai")
#   monolit        нет селектора — fallback по наличию ключей
#   vercel         только Gemini (GEMINI_API_KEY)

case "$LLM_CHOICE" in
  gemini)
    MULTI_ROLE_LLM="gemini"
    LLM_PROVIDER="gemini"
    PRIMARY_GEMINI="$GEMINI_LIGHT"
    PRIMARY_CLAUDE="$CLAUDE_LIGHT"
    PRIMARY_OPENAI="$OPENAI_LIGHT"
    echo "🤖 LLM: Gemini (основной) → Claude (fallback)"
    ;;
  claude)
    MULTI_ROLE_LLM="claude"
    LLM_PROVIDER="claude"
    PRIMARY_GEMINI="$GEMINI_LIGHT"
    PRIMARY_CLAUDE="$CLAUDE_STD"
    PRIMARY_OPENAI="$OPENAI_LIGHT"
    echo "🤖 LLM: Claude (основной)"
    echo "   ⚠️  ВНИМАНИЕ: Claude ~$3-15 за 1M токенов!"
    ;;
  openai)
    MULTI_ROLE_LLM="gemini"   # concrete-agent не поддерживает openai в multi-role → gemini fallback
    LLM_PROVIDER="openai"
    PRIMARY_GEMINI="$GEMINI_LIGHT"
    PRIMARY_CLAUDE="$CLAUDE_LIGHT"
    PRIMARY_OPENAI="$OPENAI_STD"
    echo "🤖 LLM: OpenAI (основной для urs-matcher)"
    echo "   ℹ️  concrete-agent использует Gemini (openai не поддерживается в multi-role)"
    echo "   ⚠️  ВНИМАНИЕ: GPT-4o ~$2.50 за 1M токенов!"
    ;;
  auto)
    MULTI_ROLE_LLM="auto"
    LLM_PROVIDER="gemini"
    PRIMARY_GEMINI="$GEMINI_LIGHT"
    PRIMARY_CLAUDE="$CLAUDE_STD"
    PRIMARY_OPENAI="$OPENAI_LIGHT"
    echo "🤖 LLM: AUTO (Gemini → Claude → OpenAI fallback)"
    echo "   ℹ️  Рекомендуется: надёжно, умеренная стоимость"
    ;;
  *)
    echo "❌ Неверный LLM_CHOICE: '$LLM_CHOICE'. Допустимые: gemini|claude|openai|auto"
    exit 1
    ;;
esac

echo ""

# ================================================================
# ФУНКЦИИ
# ================================================================

# ----------------------------------------------------------------
# 1. concrete-agent (Cloud Run | Python FastAPI | CORE / ЯДРО)
# ----------------------------------------------------------------
# Переменная провайдера: MULTI_ROLE_LLM ("gemini"|"claude"|"auto")
# Логика в: packages/core-backend/app/services/multi_role.py
# ----------------------------------------------------------------
setup_concrete_agent() {
  echo "==> [1/5] concrete-agent..."
  gcloud run services update concrete-agent \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG_ASYNC|\
ENVIRONMENT=production|\
MULTI_ROLE_LLM=$MULTI_ROLE_LLM|\
GOOGLE_API_KEY=$GOOGLE_API_KEY|\
GEMINI_MODEL=$PRIMARY_GEMINI|\
GEMINI_MODEL_STD=$GEMINI_STD|\
GEMINI_MODEL_PRO=$GEMINI_HEAVY|\
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|\
CLAUDE_MODEL=$PRIMARY_CLAUDE|\
CLAUDE_MODEL_STD=$CLAUDE_STD|\
CLAUDE_MODEL_HEAVY=$CLAUDE_HEAVY|\
OPENAI_API_KEY=$OPENAI_API_KEY|\
OPENAI_MODEL=$PRIMARY_OPENAI|\
OPENAI_MODEL_STD=$OPENAI_STD|\
OPENAI_MODEL_HEAVY=$OPENAI_HEAVY|\
PPLX_API_KEY=$PPLX_API_KEY|\
PPLX_MODEL=$PPLX_LIGHT|\
PPLX_MODEL_HEAVY=$PPLX_HEAVY|\
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID|\
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY|\
AWS_DEFAULT_REGION=eu-central-1|\
AWS_BEDROCK_MODEL=$AWS_STD|\
AWS_BEDROCK_MODEL_HEAVY=$AWS_HEAVY|\
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID|\
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET|\
GOOGLE_OAUTH_REDIRECT_URI=https://concrete-agent-1086027517695.europe-west3.run.app/api/v1/google/callback|\
GOOGLE_CREDENTIALS_ENCRYPTION_KEY=$GOOGLE_CREDENTIALS_ENCRYPTION_KEY|\
GOOGLE_WEBHOOK_SECRET_KEY=$GOOGLE_WEBHOOK_SECRET_KEY|\
PUBLIC_URL=https://concrete-agent-1086027517695.europe-west3.run.app|\
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
  echo "✅ concrete-agent [MULTI_ROLE_LLM=$MULTI_ROLE_LLM, model=$PRIMARY_GEMINI/$PRIMARY_CLAUDE]"
}

# ----------------------------------------------------------------
# 2. stavagent-portal-backend (Cloud Run | Node.js/Express)
# ----------------------------------------------------------------
# Нет LLM — только роутинг, JWT, файлы, БД.
# AI делегируется в concrete-agent через CORE_API_URL.
# ----------------------------------------------------------------
setup_portal_backend() {
  echo "==> [2/5] stavagent-portal-backend..."
  gcloud run services update stavagent-portal-backend \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
DISABLE_AUTH=true|\
JWT_SECRET=$JWT_SECRET|\
JWT_EXPIRY=24h|\
CORE_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app|\
CORS_ORIGIN=https://www.stavagent.cz|\
UPLOAD_DIR=./uploads|\
EXPORT_DIR=./exports|\
MAX_FILE_SIZE=10485760"
  echo "✅ stavagent-portal-backend [нет LLM — делегирует в concrete-agent]"
}

# ----------------------------------------------------------------
# 3. monolit-planner-api (Cloud Run | Node.js/Express)
# ----------------------------------------------------------------
# Нет единого LLM_PROVIDER — fallback по ключам:
#   1. GOOGLE_API_KEY (Gemini) → прямые AI подсказки (FF_AI_DAYS_SUGGEST)
#   2. OPENAI_API_KEY (GPT)   → запасной вариант
#   3. CORE_API_URL           → сложные задачи через concrete-agent Multi-Role
# Логика в: backend/src/services/timeNormsService.js
# ----------------------------------------------------------------
setup_monolit_api() {
  echo "==> [3/5] monolit-planner-api..."
  gcloud run services update monolit-planner-api \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
CORS_ORIGIN=https://monolit-planner-frontend.vercel.app|\
CORE_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app|\
CORE_TIMEOUT=90000|\
ENABLE_CORE_FALLBACK=true|\
GOOGLE_API_KEY=$GOOGLE_API_KEY|\
GEMINI_MODEL=$PRIMARY_GEMINI|\
GEMINI_MODEL_HEAVY=$GEMINI_HEAVY|\
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|\
CLAUDE_MODEL=$PRIMARY_CLAUDE|\
CLAUDE_MODEL_HEAVY=$CLAUDE_HEAVY|\
OPENAI_API_KEY=$OPENAI_API_KEY|\
OPENAI_MODEL=$PRIMARY_OPENAI|\
OPENAI_MODEL_HEAVY=$OPENAI_HEAVY|\
FF_AI_DAYS_SUGGEST=true|\
UPLOAD_DIR=./uploads|\
EXPORT_DIR=./exports|\
MAX_FILE_SIZE=10485760"
  echo "✅ monolit-planner-api [fallback: Gemini→OpenAI→CORE, активный=$LLM_CHOICE]"
}

# ----------------------------------------------------------------
# 4. urs-matcher-service (Cloud Run | Node.js)
# ----------------------------------------------------------------
# Переменная провайдера: LLM_PROVIDER ("gemini"|"claude"|"openai")
# Fallback chain в llmClient.js: primary → claude → gemini → openai → fuzzy
# Логика в: backend/src/config/llmConfig.js
# ----------------------------------------------------------------
setup_urs_matcher() {
  echo "==> [4/5] urs-matcher-service..."
  gcloud run services update urs-matcher-service \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
LLM_PROVIDER=$LLM_PROVIDER|\
LLM_TIMEOUT_MS=90000|\
MULTI_ROLE_TIMEOUT_MS=90000|\
MULTI_ROLE_HEALTH_TIMEOUT_MS=30000|\
GOOGLE_API_KEY=$GOOGLE_API_KEY|\
GEMINI_MODEL=$PRIMARY_GEMINI|\
GEMINI_MODEL_HEAVY=$GEMINI_HEAVY|\
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY|\
CLAUDE_MODEL=$PRIMARY_CLAUDE|\
CLAUDE_MODEL_HEAVY=$CLAUDE_HEAVY|\
OPENAI_API_KEY=$OPENAI_API_KEY|\
OPENAI_MODEL=$PRIMARY_OPENAI|\
OPENAI_MODEL_HEAVY=$OPENAI_HEAVY|\
PPLX_API_KEY=$PPLX_API_KEY|\
PPLX_MODEL=$PPLX_LIGHT|\
PPLX_MODEL_HEAVY=$PPLX_HEAVY|\
PPLX_TIMEOUT_MS=60000|\
BRAVE_API_KEY=$BRAVE_API_KEY|\
STAVAGENT_API_URL=https://concrete-agent-1086027517695.europe-west3.run.app"
  echo "✅ urs-matcher-service [LLM_PROVIDER=$LLM_PROVIDER, model=$PRIMARY_GEMINI/$PRIMARY_CLAUDE]"
}

# ----------------------------------------------------------------
# 5. rozpocet-registry-backend (Cloud Run | Node.js)
# ----------------------------------------------------------------
# Нет LLM на бэкенде — только БД и CORS.
# AI классификация через Vercel Functions (GEMINI_API_KEY там).
# ----------------------------------------------------------------
setup_registry_backend() {
  echo "==> [5/5] rozpocet-registry-backend..."
  gcloud run services update rozpocet-registry-backend \
    --region "$REGION" \
    --set-env-vars "^|^\
DATABASE_URL=$DB_PG|\
NODE_ENV=production|\
CORS_ORIGIN=https://stavagent-backend-ktwx.vercel.app"
  echo "✅ rozpocet-registry-backend [нет LLM — только БД]"
}

# ----------------------------------------------------------------
# Vercel frontends (3 сервиса)
# ----------------------------------------------------------------
# ⚠️  ТОЛЬКО GEMINI доступен в Vercel Functions — браузерный контекст.
#     Claude/OpenAI ключи не ставь как VITE_* — они публичны!
#     GEMINI_API_KEY (без VITE_) → только на сервере (Vercel Functions).
# ----------------------------------------------------------------
setup_vercel() {
  echo ""
  echo "==> Vercel frontends (требует: npm i -g vercel && vercel login)"
  echo ""

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

  echo "--- [V1] stavagent-portal (www.stavagent.cz) ---"
  cd "$SCRIPT_DIR/stavagent-portal/frontend"
  vercel link --yes 2>/dev/null || true
  echo "true" | vercel env add VITE_DISABLE_AUTH production --force
  echo "https://stavagent-portal-backend-1086027517695.europe-west3.run.app" \
    | vercel env add VITE_API_URL production --force
  echo "https://concrete-agent-1086027517695.europe-west3.run.app" \
    | vercel env add VITE_CONCRETE_AGENT_URL production --force
  cd "$SCRIPT_DIR"

  echo "--- [V2] monolit-planner-frontend ---"
  cd "$SCRIPT_DIR/Monolit-Planner/frontend"
  vercel link --yes 2>/dev/null || true
  echo "https://monolit-planner-api-1086027517695.europe-west3.run.app" \
    | vercel env add VITE_API_URL production --force
  cd "$SCRIPT_DIR"

  echo "--- [V3] rozpocet-registry (frontend + Vercel Functions) ---"
  cd "$SCRIPT_DIR/rozpocet-registry"
  vercel link --yes 2>/dev/null || true
  echo "https://rozpocet-registry-backend-1086027517695.europe-west3.run.app" \
    | vercel env add VITE_API_URL production --force
  # GEMINI_API_KEY без VITE_ — только для Vercel Functions (server-side)
  echo "$GOOGLE_API_KEY" | vercel env add GEMINI_API_KEY production --force
  echo "$GEMINI_LIGHT"   | vercel env add GEMINI_MODEL production --force
  cd "$SCRIPT_DIR"

  echo ""
  echo "✅ Vercel env vars обновлены"
  echo ""
  echo "Если Vercel CLI недоступен — добавь вручную в Vercel Dashboard:"
  echo "  stavagent-portal:"
  echo "    VITE_DISABLE_AUTH             = true"
  echo "    VITE_API_URL                  = https://stavagent-portal-backend-1086027517695.europe-west3.run.app"
  echo "    VITE_CONCRETE_AGENT_URL       = https://concrete-agent-1086027517695.europe-west3.run.app"
  echo "  monolit-planner-frontend:"
  echo "    VITE_API_URL                  = https://monolit-planner-api-1086027517695.europe-west3.run.app"
  echo "  rozpocet-registry:"
  echo "    VITE_API_URL                  = https://rozpocet-registry-backend-1086027517695.europe-west3.run.app"
  echo "    GEMINI_API_KEY                = <твой Google API ключ>  ← НЕ добавляй VITE_ prefix!"
  echo "    GEMINI_MODEL                  = $GEMINI_LIGHT"
}

# ================================================================
# MAIN
# ================================================================

TARGET="${1:-all}"

case "$TARGET" in
  concrete-agent)   setup_concrete_agent ;;
  portal-backend)   setup_portal_backend ;;
  monolit-api)      setup_monolit_api ;;
  urs-matcher)      setup_urs_matcher ;;
  registry-backend) setup_registry_backend ;;
  vercel)           setup_vercel ;;
  all)
    setup_concrete_agent
    setup_portal_backend
    setup_monolit_api
    setup_urs_matcher
    setup_registry_backend
    echo ""
    echo "================================================================"
    echo "✅ Все 5 Cloud Run сервисов обновлены!"
    echo "   LLM_CHOICE    = $LLM_CHOICE"
    echo "   Gemini model  = $PRIMARY_GEMINI"
    echo "   Claude model  = $PRIMARY_CLAUDE"
    echo "   OpenAI model  = $PRIMARY_OPENAI"
    echo ""
    echo "Vercel frontends — запусти отдельно:"
    echo "  bash CLOUD_SHELL_COMMANDS.sh vercel"
    echo ""
    echo "Как поменять ключи позже:"
    echo "  nano CLOUD_SHELL_COMMANDS.sh   # заполни \"\" значения"
    echo "  bash CLOUD_SHELL_COMMANDS.sh   # запусти снова"
    echo "================================================================"
    ;;
  *)
    echo "Использование:"
    echo "  bash CLOUD_SHELL_COMMANDS.sh [TARGET]"
    echo ""
    echo "TARGET:"
    echo "  all              все Cloud Run (по умолчанию)"
    echo "  concrete-agent   CORE / ЯДРО (Python, MULTI_ROLE_LLM)"
    echo "  portal-backend   Портал бэкенд (Node.js, нет LLM)"
    echo "  monolit-api      Монолит API (Node.js, fallback по ключам)"
    echo "  urs-matcher      URS Matcher (Node.js, LLM_PROVIDER)"
    echo "  registry-backend Реестр бэкенд (Node.js, нет LLM)"
    echo "  vercel           3 Vercel фронтенда"
    exit 1
    ;;
esac
