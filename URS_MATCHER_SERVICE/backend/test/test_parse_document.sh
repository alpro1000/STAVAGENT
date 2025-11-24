#!/bin/bash
# Test script for /api/jobs/parse-document endpoint
# Tests STAVAGENT SmartParser integration

echo "🧪 Testing /api/jobs/parse-document endpoint"
echo "=========================================="
echo ""

# Create test TechSpec document
TEST_FILE="/tmp/test_techspec.txt"
cat > "$TEST_FILE" << 'EOF'
TECHNICKÁ ZPRÁVA
================

Projekt: Novostavba bytového domu

1. Základní parametry:
- Počet nadzemních podlaží: 4NP
- Konstrukční systém: keramické zdivo Porotherm 40
- Stropní konstrukce: železobetonové desky
- Základy: železobeton C25/30

2. Popis stavby:
Bytový dům s 12 bytovými jednotkami.
Objekt je navržen jako zděný z keramických bloků Porotherm 40 Profi.
Stropy jsou navrženy jako ŽB monolitické desky tl. 200mm.
EOF

echo "📄 Created test file: $TEST_FILE"
echo ""

# Test 1: Parse document
echo "Test 1: Parse document with STAVAGENT SmartParser"
echo "------------------------------------------------"

RESPONSE=$(curl -s -X POST http://localhost:3000/api/jobs/parse-document \
  -F "file=@$TEST_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Test 1 PASSED: Document parsed successfully"

  # Validate response structure
  PROJECT_CONTEXT=$(echo "$BODY" | jq -r '.project_context')

  if [ "$PROJECT_CONTEXT" != "null" ]; then
    echo "✅ project_context extracted:"
    echo "$PROJECT_CONTEXT" | jq '.'

    BUILDING_TYPE=$(echo "$PROJECT_CONTEXT" | jq -r '.building_type')
    STOREYS=$(echo "$PROJECT_CONTEXT" | jq -r '.storeys')

    echo ""
    echo "Extracted values:"
    echo "  - Building type: $BUILDING_TYPE"
    echo "  - Storeys: $STOREYS"

    if [ "$BUILDING_TYPE" = "bytový dům" ] && [ "$STOREYS" = "4" ]; then
      echo "✅ Context extraction CORRECT!"
    else
      echo "⚠️  Context values may be inaccurate"
    fi
  else
    echo "❌ No project_context in response"
  fi

elif [ "$HTTP_CODE" = "503" ]; then
  echo "⚠️  Test 1 SKIPPED: STAVAGENT SmartParser not available"
  echo "This is expected if Python dependencies are not installed."
else
  echo "❌ Test 1 FAILED: HTTP $HTTP_CODE"
fi

echo ""
echo "=========================================="
echo "🏁 Test completed"
echo ""

# Cleanup
rm -f "$TEST_FILE"
