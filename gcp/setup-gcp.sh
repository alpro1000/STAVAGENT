#!/usr/bin/env bash
###############################################################
# STAVAGENT — Complete GCP Setup Script
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated
#   2. GitHub repo connected to Cloud Build
#   3. Cloud SQL instance "stavagent-db" already running
#
# Usage:
#   chmod +x gcp/setup-gcp.sh
#   ./gcp/setup-gcp.sh
#
# This script:
#   1. Creates Artifact Registry repository
#   2. Creates Secret Manager secrets (DATABASE_URL per service)
#   3. Creates Cloud Build triggers (GitHub → auto-deploy)
#   4. Grants Cloud Build → Cloud Run deploy permissions
#   5. Grants Cloud Run → Cloud SQL connect permissions
###############################################################

set -euo pipefail

# ============================================================
# Configuration — edit these values
# ============================================================
PROJECT_ID="project-947a512a-481d-49b5-81c"
REGION="europe-west3"
AR_REPO="stavagent"
CLOUD_SQL_INSTANCE="stavagent-db"
GITHUB_OWNER="alpro1000"
GITHUB_REPO="STAVAGENT"
GITHUB_BRANCH="main"

# Database credentials (Cloud SQL)
# Format: postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE
DB_USER="stavagent_portal"
DB_PASS="REPLACE_WITH_YOUR_PASSWORD"  # ← SET THIS!
CLOUD_SQL_CONNECTION="${PROJECT_ID}:${REGION}:${CLOUD_SQL_INSTANCE}"

# ============================================================
# Color output
# ============================================================
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

# ============================================================
# 0. Set project
# ============================================================
echo ""
echo "=========================================="
echo "  STAVAGENT — GCP Setup"
echo "=========================================="
echo ""

gcloud config set project "${PROJECT_ID}" 2>/dev/null
log "Project: ${PROJECT_ID}"
log "Region: ${REGION}"

# ============================================================
# 1. Enable required APIs
# ============================================================
echo ""
echo "--- Enabling APIs ---"
APIS=(
  "cloudbuild.googleapis.com"
  "run.googleapis.com"
  "artifactregistry.googleapis.com"
  "secretmanager.googleapis.com"
  "sqladmin.googleapis.com"
)
for api in "${APIS[@]}"; do
  gcloud services enable "$api" --quiet 2>/dev/null && log "API: $api" || warn "API $api (may already be enabled)"
done

# ============================================================
# 2. Create Artifact Registry repository
# ============================================================
echo ""
echo "--- Artifact Registry ---"
if gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" >/dev/null 2>&1; then
  log "AR repo '${AR_REPO}' already exists"
else
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="STAVAGENT Docker images" \
    --quiet
  log "Created AR repo: ${AR_REPO}"
fi

# ============================================================
# 3. Create Secret Manager secrets
# ============================================================
echo ""
echo "--- Secret Manager ---"

# Helper function: create or update a secret
create_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --quiet
    log "Updated secret: $name"
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic --quiet
    log "Created secret: $name"
  fi
}

# DATABASE_URL per service (Cloud SQL socket connection)
# When using --add-cloudsql-instances, connect via Unix socket
PORTAL_DB_URL="postgresql://${DB_USER}:${DB_PASS}@/${DB_USER}?host=/cloudsql/${CLOUD_SQL_CONNECTION}"
MONOLIT_DB_URL="postgresql://${DB_USER}:${DB_PASS}@/monolit_planner?host=/cloudsql/${CLOUD_SQL_CONNECTION}"
REGISTRY_DB_URL="postgresql://${DB_USER}:${DB_PASS}@/rozpocet_registry?host=/cloudsql/${CLOUD_SQL_CONNECTION}"

create_secret "PORTAL_DATABASE_URL"   "$PORTAL_DB_URL"
create_secret "MONOLIT_DATABASE_URL"  "$MONOLIT_DB_URL"
create_secret "REGISTRY_DATABASE_URL" "$REGISTRY_DB_URL"

# JWT Secret for Portal
create_secret "JWT_SECRET" "stavagent-jwt-secret-$(openssl rand -hex 16)"

# Placeholder secrets for API keys (set actual values in GCP Console)
warn "The following API key secrets need real values — set them in GCP Console → Secret Manager:"
for secret_name in GOOGLE_API_KEY ANTHROPIC_API_KEY GOOGLE_AI_KEY OPENAI_API_KEY PPLX_API_KEY; do
  if ! gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
    echo -n "PLACEHOLDER" | gcloud secrets create "$secret_name" --data-file=- --replication-policy=automatic --quiet
    warn "  Created placeholder: $secret_name ← SET REAL VALUE!"
  else
    log "  Secret exists: $secret_name"
  fi
done

# ============================================================
# 4. IAM permissions
# ============================================================
echo ""
echo "--- IAM Permissions ---"

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Cloud Build needs to deploy to Cloud Run
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" \
  --quiet >/dev/null 2>&1
log "Cloud Build → Cloud Run admin"

# Cloud Build needs to act as compute SA (for Cloud Run deployment)
gcloud iam service-accounts add-iam-policy-binding "${COMPUTE_SA}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null 2>&1
log "Cloud Build → Service Account User"

# Cloud Build needs to push to Artifact Registry
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet >/dev/null 2>&1
log "Cloud Build → AR writer"

# Cloud Build needs Secret Manager access
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null 2>&1
log "Cloud Build → Secret Manager accessor"

# Cloud Run (compute SA) needs Cloud SQL client
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/cloudsql.client" \
  --quiet >/dev/null 2>&1
log "Cloud Run → Cloud SQL client"

# Cloud Run needs Secret Manager access
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null 2>&1
log "Cloud Run → Secret Manager accessor"

# ============================================================
# 5. Cloud Build Triggers
# ============================================================
echo ""
echo "--- Cloud Build Triggers ---"
echo ""
warn "Cloud Build triggers must be created via GCP Console (requires GitHub App connection)."
echo ""
echo "Go to: https://console.cloud.google.com/cloud-build/triggers?project=${PROJECT_ID}"
echo ""
echo "Create these 6 triggers:"
echo ""
echo "┌──────────────────────────────┬────────────────────────────────┬─────────────────────┐"
echo "│ Trigger Name                 │ Cloud Build Config             │ Included Files      │"
echo "├──────────────────────────────┼────────────────────────────────┼─────────────────────┤"
echo "│ deploy-all                   │ cloudbuild.yaml                │ (all files)         │"
echo "│ deploy-portal                │ cloudbuild-portal.yaml         │ stavagent-portal/** │"
echo "│ deploy-concrete-agent        │ cloudbuild-concrete.yaml       │ concrete-agent/**   │"
echo "│ deploy-monolit               │ cloudbuild-monolit.yaml        │ Monolit-Planner/**  │"
echo "│ deploy-urs-matcher           │ cloudbuild-urs.yaml            │ URS_MATCHER_SERVICE/**│"
echo "│ deploy-registry-backend      │ cloudbuild-registry.yaml       │ rozpocet-registry-backend/**│"
echo "└──────────────────────────────┴────────────────────────────────┴─────────────────────┘"
echo ""
echo "For each trigger:"
echo "  - Source: GitHub → ${GITHUB_OWNER}/${GITHUB_REPO}"
echo "  - Branch: ^${GITHUB_BRANCH}$"
echo "  - Type: Cloud Build configuration file"
echo "  - deploy-all: Use MANUAL trigger only (for full rebuilds)"
echo "  - Individual triggers: Use PUSH trigger with included files filter"
echo ""

# ============================================================
# 6. Summary
# ============================================================
echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. SET REAL API KEY VALUES in Secret Manager:"
echo "     https://console.cloud.google.com/security/secret-manager?project=${PROJECT_ID}"
echo ""
echo "     Required secrets:"
echo "     - GOOGLE_API_KEY        (Gemini API key)"
echo "     - ANTHROPIC_API_KEY     (Claude API key)"
echo "     - GOOGLE_AI_KEY         (Google AI for URS Matcher)"
echo "     - OPENAI_API_KEY        (OpenAI for URS Matcher)"
echo "     - PPLX_API_KEY          (Perplexity for URS Matcher)"
echo ""
echo "  2. SET DATABASE PASSWORD in secret values:"
echo "     Update PORTAL_DATABASE_URL, MONOLIT_DATABASE_URL, REGISTRY_DATABASE_URL"
echo "     with your actual Cloud SQL password (replace REPLACE_WITH_YOUR_PASSWORD)"
echo ""
echo "  3. RUN SQL MIGRATIONS in Cloud SQL Studio:"
echo "     https://console.cloud.google.com/sql/instances/stavagent-db?project=${PROJECT_ID}"
echo ""
echo "     Database: stavagent_portal → run gcp/sql/01-init-stavagent-portal.sql"
echo "     Database: monolit_planner  → run gcp/sql/02-init-monolit-planner.sql"
echo "     Database: rozpocet_registry → run gcp/sql/03-init-rozpocet-registry.sql"
echo ""
echo "  4. CREATE CLOUD BUILD TRIGGERS (see table above)"
echo ""
echo "  5. RESTRICT DB ACCESS:"
echo "     Remove 0.0.0.0/0 from authorized networks."
echo "     Cloud Run uses --add-cloudsql-instances (no public IP needed)."
echo ""
log "Done!"
