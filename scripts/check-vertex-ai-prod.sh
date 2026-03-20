#!/usr/bin/env bash
# check-vertex-ai-prod.sh — Diagnose Vertex AI on Cloud Run production
#
# Usage:
#   ./scripts/check-vertex-ai-prod.sh
#
# Prerequisites:
#   - gcloud CLI authenticated
#   - SERVICE_TOKEN secret in Secret Manager (create if missing):
#       TOKEN=$(openssl rand -hex 32)
#       gcloud secrets create SERVICE_TOKEN --replication-policy=automatic
#       echo -n "$TOKEN" | gcloud secrets versions add SERVICE_TOKEN --data-file=-
#       echo "Save this token: $TOKEN"
#
set -euo pipefail

PROJECT="project-947a512a-481d-49b5-81c"
REGION="europe-west3"
SERVICE="concrete-agent"
BASE_URL="https://concrete-agent-1086027517695.europe-west3.run.app"
SA="1086027517695-compute@developer.gserviceaccount.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }

echo "=========================================="
echo "  Vertex AI Production Diagnostic"
echo "=========================================="
echo ""

# Step 1: Check Cloud Run IAM (allUsers invoker)
echo "--- Step 1: Cloud Run IAM (allow-unauthenticated) ---"
IAM_POLICY=$(gcloud run services get-iam-policy "$SERVICE" \
  --region="$REGION" --project="$PROJECT" \
  --format=json 2>/dev/null || echo "{}")

if echo "$IAM_POLICY" | grep -q "allUsers"; then
  ok "Cloud Run allows unauthenticated access (allUsers has roles/run.invoker)"
else
  fail "Cloud Run does NOT allow unauthenticated access!"
  echo "  Fix: gcloud run services add-iam-policy-binding $SERVICE \\"
  echo "    --region=$REGION --project=$PROJECT \\"
  echo "    --member=allUsers --role=roles/run.invoker"
  echo ""
  echo "  If blocked by Org Policy, ask org admin to allow or use IAP/identity token:"
  echo "  TOKEN=\$(gcloud auth print-identity-token)"
  echo "  curl -H \"Authorization: Bearer \$TOKEN\" $BASE_URL/health"
fi
echo ""

# Step 2: Check SA has Vertex AI role
echo "--- Step 2: Vertex AI IAM (aiplatform.user) ---"
SA_ROLES=$(gcloud projects get-iam-policy "$PROJECT" \
  --flatten="bindings[].members" \
  --filter="bindings.members:$SA" \
  --format="value(bindings.role)" 2>/dev/null || echo "")

if echo "$SA_ROLES" | grep -q "aiplatform"; then
  ok "SA has Vertex AI role: $(echo "$SA_ROLES" | grep aiplatform)"
else
  fail "SA missing Vertex AI role!"
  echo "  Fix: gcloud projects add-iam-policy-binding $PROJECT \\"
  echo "    --member=serviceAccount:$SA \\"
  echo "    --role=roles/aiplatform.user"
fi
echo ""

# Step 3: Check SERVICE_TOKEN secret exists
echo "--- Step 3: SERVICE_TOKEN secret ---"
if gcloud secrets describe SERVICE_TOKEN --project="$PROJECT" >/dev/null 2>&1; then
  ok "SERVICE_TOKEN secret exists in Secret Manager"
  SERVICE_TOKEN=$(gcloud secrets versions access latest --secret=SERVICE_TOKEN --project="$PROJECT" 2>/dev/null || echo "")
  if [ -z "$SERVICE_TOKEN" ]; then
    fail "Could not read SERVICE_TOKEN value (check IAM)"
  fi
else
  fail "SERVICE_TOKEN secret does NOT exist!"
  echo "  Fix:"
  echo "    TOKEN=\$(openssl rand -hex 32)"
  echo "    gcloud secrets create SERVICE_TOKEN --replication-policy=automatic --project=$PROJECT"
  echo "    echo -n \"\$TOKEN\" | gcloud secrets versions add SERVICE_TOKEN --data-file=- --project=$PROJECT"
  echo "    echo \"Save token: \$TOKEN\""
  echo ""
  echo "  Then grant SA access:"
  echo "    gcloud secrets add-iam-policy-binding SERVICE_TOKEN \\"
  echo "      --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor \\"
  echo "      --project=$PROJECT"
fi
echo ""

# Step 4: Health check
echo "--- Step 4: Health check ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  ok "GET /health → 200"
elif [ "$HTTP_CODE" = "403" ]; then
  fail "GET /health → 403 (Cloud Run IAM blocks unauthenticated, see Step 1)"
  echo "  Trying with identity token..."
  ID_TOKEN=$(gcloud auth print-identity-token --audiences="$BASE_URL" 2>/dev/null || echo "")
  if [ -n "$ID_TOKEN" ]; then
    HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ID_TOKEN" "$BASE_URL/health" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE2" = "200" ]; then
      ok "GET /health with identity token → 200 (service is alive, just IAM-restricted)"
    else
      fail "GET /health with identity token → $HTTP_CODE2"
    fi
  fi
else
  fail "GET /health → $HTTP_CODE"
fi
echo ""

# Step 5: LLM Status probe
echo "--- Step 5: LLM Status probe ---"
if [ -z "${SERVICE_TOKEN:-}" ]; then
  warn "SERVICE_TOKEN not available — skipping /api/v1/llm/status probe"
  echo "  Set SERVICE_TOKEN env var or ensure secret exists (see Step 3)"
else
  # Try with identity token if needed
  AUTH_HEADERS=(-H "Authorization: Bearer $SERVICE_TOKEN")
  if [ "$HTTP_CODE" = "403" ]; then
    ID_TOKEN=$(gcloud auth print-identity-token --audiences="$BASE_URL" 2>/dev/null || echo "")
    if [ -n "$ID_TOKEN" ]; then
      AUTH_HEADERS=(-H "X-Api-Key: $SERVICE_TOKEN" -H "Authorization: Bearer $ID_TOKEN")
    fi
  fi

  RESPONSE=$(curl -s -w "\n%{http_code}" "${AUTH_HEADERS[@]}" "$BASE_URL/api/v1/llm/status" 2>/dev/null || echo "000")
  BODY=$(echo "$RESPONSE" | head -n -1)
  STATUS=$(echo "$RESPONSE" | tail -1)

  if [ "$STATUS" = "200" ]; then
    ok "GET /api/v1/llm/status → 200"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

    PROBE_OK=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['probe']['ok'])" 2>/dev/null || echo "")
    if [ "$PROBE_OK" = "True" ]; then
      ok "Vertex AI probe PASSED — LLM is working!"
    else
      PROBE_ERR=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('init_error') or d['probe'].get('error','unknown'))" 2>/dev/null || echo "unknown")
      fail "Vertex AI probe FAILED: $PROBE_ERR"
      if echo "$PROBE_ERR" | grep -qi "401\|403\|permission\|iam"; then
        echo "  → IAM issue detected. Fix SA role (see Step 2)"
      fi
    fi
  else
    fail "GET /api/v1/llm/status → $STATUS"
    echo "$BODY"
  fi
fi
echo ""

echo "=========================================="
echo "  Summary"
echo "=========================================="
echo "If Cloud Run returns 403 on all endpoints:"
echo "  1. Check Org Policy: gcloud org-policies describe constraints/iam.allowedPolicyMemberDomains --project=$PROJECT"
echo "  2. Or use identity-based auth instead of allUsers"
echo ""
echo "If Vertex AI probe fails with 401/403:"
echo "  gcloud projects add-iam-policy-binding $PROJECT \\"
echo "    --member=serviceAccount:$SA \\"
echo "    --role=roles/aiplatform.user"
echo ""
echo "After fixes, redeploy:"
echo "  gcloud builds submit --config=cloudbuild-concrete.yaml \\"
echo "    --substitutions=_FORCE_DEPLOY=true --project=$PROJECT"
