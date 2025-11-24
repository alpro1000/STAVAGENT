#!/bin/bash
# Test script for Document Q&A Flow
# Tests complete workflow: parse → Q&A → confirm → block-match

echo "🧪 Testing Document Q&A Flow"
echo "=========================================="
echo ""

# Create test TechSpec document
TEST_FILE="/tmp/test_techspec_qa.txt"
cat > "$TEST_FILE" << 'EOF'
TECHNICKÁ ZPRÁVA - NOVOSTAVBA BYTOVÉHO DOMU

Projekt: Bytový dům U Lesa, Praha 5

1. ZÁKLADNÍ ÚDAJE:
   - Počet nadzemních podlaží: 5NP
   - Typ konstrukce: Zděná konstrukce z keramických bloků
   - Základy: Základové pasy z betonu C25/30

2. KONSTRUKČNÍ SYSTÉM:
   - Svislé nosné konstrukce: Porotherm 40 Profi
   - Vodorovné konstrukce: ŽB stropní desky tl. 200mm
   - Střešní konstrukce: Plochá střecha, hydroizolace SBS modifikované asfaltové pásy

3. TEPELNÉ IZOLACE:
   - Obvodový plášť: EPS polystyren 150mm
   - Podlaha na terénu: XPS 100mm
   - Střecha: Spádové klíny EPS 40-200mm

4. DOKONČOVACÍ PRÁCE:
   - Venkovní omítky: Baumit silikonová omítka
   - Vnitřní omítky: Vápenné štukové omítky
EOF

echo "📄 Created test file: $TEST_FILE"
echo ""

# Test 1: Parse document with Q&A Flow
echo "Test 1: Parse document with Q&A Flow"
echo "------------------------------------------------"

RESPONSE=$(curl -s -X POST http://localhost:3000/api/jobs/parse-document \
  -F "file=@$TEST_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Test 1 PASSED: Document parsed with Q&A Flow"
  echo ""

  JOB_ID=$(echo "$BODY" | jq -r '.job_id')
  echo "Job ID: $JOB_ID"
  echo ""

  # Check Q&A results
  QA_FLOW=$(echo "$BODY" | jq '.qa_flow')
  ANSWERED_COUNT=$(echo "$QA_FLOW" | jq -r '.answered_count')
  UNANSWERED_COUNT=$(echo "$QA_FLOW" | jq -r '.unanswered_count')
  REQUIRES_INPUT=$(echo "$QA_FLOW" | jq -r '.requires_user_input')

  echo "Q&A Results:"
  echo "  - Answered: $ANSWERED_COUNT questions"
  echo "  - Unanswered: $UNANSWERED_COUNT questions"
  echo "  - Requires user input: $REQUIRES_INPUT"
  echo ""

  # Show questions
  echo "Questions:"
  echo "$QA_FLOW" | jq -r '.questions[] | "  [\(.id)] \(.question) (\(.priority) priority)\n    Found: \(.found), Confidence: \(.confidence), Answer: \(.answer // "null")"'
  echo ""

  # Test 2: Confirm Q&A answers
  if [ "$UNANSWERED_COUNT" -gt "0" ]; then
    echo ""
    echo "Test 2: Confirm Q&A answers with user input"
    echo "------------------------------------------------"

    # Build confirmed answers (fill in missing ones)
    CONFIRMED_ANSWERS='{
      "q_building_type": {"value": "bytový dům", "user_edited": false},
      "q_storeys": {"value": "5", "user_edited": false},
      "q_foundation_concrete": {"value": "C25/30", "user_edited": false},
      "q_wall_material": {"value": "Porotherm 40 Profi", "user_edited": false},
      "q_insulation": {"value": "EPS polystyren", "user_edited": false},
      "q_roofing": {"value": "asfaltové pásy SBS", "user_edited": true, "note": "User specified SBS modified"}
    }'

    CONFIRM_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/jobs/${JOB_ID}/confirm-qa" \
      -H "Content-Type: application/json" \
      -d "{\"confirmed_answers\": $CONFIRMED_ANSWERS}" \
      -w "\n%{http_code}")

    CONFIRM_HTTP_CODE=$(echo "$CONFIRM_RESPONSE" | tail -n1)
    CONFIRM_BODY=$(echo "$CONFIRM_RESPONSE" | head -n-1)

    echo "HTTP Status: $CONFIRM_HTTP_CODE"
    echo ""

    if [ "$CONFIRM_HTTP_CODE" = "200" ]; then
      echo "✅ Test 2 PASSED: Q&A answers confirmed"
      echo ""

      FINAL_CONTEXT=$(echo "$CONFIRM_BODY" | jq '.final_context')
      echo "Final Context:"
      echo "$FINAL_CONTEXT" | jq '.'
      echo ""

      echo "Next step:"
      echo "$CONFIRM_BODY" | jq -r '.next_step | "  \(.action)\n  Endpoint: \(.endpoint)"'
      echo ""

    else
      echo "❌ Test 2 FAILED: HTTP $CONFIRM_HTTP_CODE"
      echo "$CONFIRM_BODY" | jq '.'
    fi
  fi

elif [ "$HTTP_CODE" = "503" ]; then
  echo "⚠️  Tests SKIPPED: STAVAGENT SmartParser not available"
  echo "This is expected if Python dependencies are not installed."
else
  echo "❌ Test 1 FAILED: HTTP $HTTP_CODE"
  echo "$BODY" | jq '.'
fi

echo ""
echo "=========================================="
echo "🏁 Q&A Flow test completed"
echo ""

# Cleanup
rm -f "$TEST_FILE"
