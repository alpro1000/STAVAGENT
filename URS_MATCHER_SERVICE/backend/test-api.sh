#!/bin/bash

echo "════════════════════════════════════════════════════════════"
echo "  URS Matcher Service - API Testing"
echo "════════════════════════════════════════════════════════════"
echo ""

BASE_URL="http://localhost:3001/api"

# Test 1: Health Check
echo "📋 TEST 1: Health Check"
echo "GET /health"
curl -s http://localhost:3001/health | jq '.' 
echo ""

# Test 2: Get URS Catalog (search)
echo "📋 TEST 2: Search URS Catalog"
echo "GET /urs-catalog?search=beton&limit=5"
curl -s "$BASE_URL/urs-catalog?search=beton&limit=5" | jq '.'
echo ""

# Test 3: Get specific URS item
echo "📋 TEST 3: Get Specific URS Item"
echo "GET /urs-catalog/801321111"
curl -s "$BASE_URL/urs-catalog/801321111" | jq '.'
echo ""

# Test 4: Text match
echo "📋 TEST 4: Text Match"
echo "POST /jobs/text-match"
curl -s -X POST "$BASE_URL/jobs/text-match" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Podkladní beton C25/30 tl. 100 mm",
    "quantity": 25,
    "unit": "m3"
  }' | jq '.'
echo ""

# Test 5: List Jobs
echo "📋 TEST 5: List Jobs"
echo "GET /jobs"
curl -s "$BASE_URL/jobs" | jq '.'
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ API Testing Complete"
echo "════════════════════════════════════════════════════════════"
