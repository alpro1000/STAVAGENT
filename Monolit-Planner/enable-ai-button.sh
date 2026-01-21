#!/bin/bash

###############################################################################
# Automatic script to enable AI Suggestion button (✨)
#
# This script will:
# 1. Wake up the Monolit Planner API (if sleeping on Render Free Tier)
# 2. Enable FF_AI_DAYS_SUGGEST feature flag via REST API
# 3. Verify the change
#
# Usage:
#   chmod +x enable-ai-button.sh
#   ./enable-ai-button.sh
#
# No configuration needed - everything is automatic!
###############################################################################

API_URL="https://monolit-planner-api.onrender.com"
MAX_RETRIES=5
RETRY_DELAY=10

echo "🚀 AI Suggestion Button Enabler"
echo "================================"
echo ""

# Function to check if API is awake
check_health() {
  echo "🏥 Checking API health..."

  response=$(curl -s -w "\n%{http_code}" "${API_URL}/health" --max-time 30 2>&1)
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    echo "   ✅ API is awake and healthy"
    return 0
  else
    echo "   ⏳ API is sleeping (HTTP ${http_code})"
    return 1
  fi
}

# Function to enable feature flag
enable_flag() {
  echo ""
  echo "🎯 Enabling FF_AI_DAYS_SUGGEST feature flag..."

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${API_URL}/api/config" \
    -H "Content-Type: application/json" \
    -d '{
      "feature_flags": {
        "FF_AI_DAYS_SUGGEST": true,
        "FF_PUMP_MODULE": false,
        "FF_ADVANCED_METRICS": false,
        "FF_DARK_MODE": false,
        "FF_SPEED_ANALYSIS": false
      }
    }' \
    --max-time 30 2>&1)

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    echo "   ✅ Feature flag enabled successfully!"
    echo ""
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    return 0
  else
    echo "   ❌ Failed to enable feature flag (HTTP ${http_code})"
    echo "   Response: $body"
    return 1
  fi
}

# Function to verify
verify() {
  echo ""
  echo "🔍 Verifying changes..."

  response=$(curl -s -w "\n%{http_code}" \
    -X GET "${API_URL}/api/config" \
    --max-time 30 2>&1)

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" = "200" ]; then
    ai_enabled=$(echo "$body" | jq -r '.feature_flags.FF_AI_DAYS_SUGGEST' 2>/dev/null)

    if [ "$ai_enabled" = "true" ]; then
      echo "   ✅ Verification successful - FF_AI_DAYS_SUGGEST is ENABLED"
      return 0
    else
      echo "   ❌ Verification failed - Feature flag is: $ai_enabled"
      return 1
    fi
  else
    echo "   ❌ Failed to verify (HTTP ${http_code})"
    return 1
  fi
}

# Main execution
attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
  echo ""
  echo "🔄 Attempt $attempt of $MAX_RETRIES"
  echo "-----------------------------------"

  # Check if API is awake
  if check_health; then
    # API is awake, try to enable flag
    if enable_flag; then
      # Successfully enabled, verify
      if verify; then
        echo ""
        echo "🎉 SUCCESS! All done!"
        echo ""
        echo "Next steps:"
        echo "1. Open: https://monolit-planner-frontend.onrender.com"
        echo "2. Press Ctrl+Shift+R (hard reload)"
        echo "3. Open any project with positions"
        echo "4. Look for green ✨ button in 'Dny' column"
        echo ""
        exit 0
      fi
    fi
  else
    # API is sleeping, wake it up by calling health endpoint
    echo "   🔔 Waking up API (Render Free Tier cold start)..."
    curl -s "${API_URL}/health" --max-time 60 > /dev/null 2>&1
  fi

  # Wait before retry
  if [ $attempt -lt $MAX_RETRIES ]; then
    echo ""
    echo "   ⏱️  Waiting ${RETRY_DELAY} seconds before retry..."
    sleep $RETRY_DELAY
  fi

  attempt=$((attempt + 1))
done

echo ""
echo "❌ Failed after $MAX_RETRIES attempts"
echo ""
echo "Manual alternative:"
echo "1. Open browser console on https://monolit-planner-frontend.onrender.com"
echo "2. Paste this code:"
echo ""
echo "fetch('/api/config', {"
echo "  method: 'POST',"
echo "  headers: {'Content-Type': 'application/json'},"
echo "  body: JSON.stringify({feature_flags: {FF_AI_DAYS_SUGGEST: true}})"
echo "}).then(r => r.json()).then(d => {console.log('✅', d); location.reload();})"
echo ""
exit 1
