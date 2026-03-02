#!/usr/bin/env node
/**
 * Time Norms Automation - Quick Test Script
 * Tests AI-powered days suggestion feature
 * 
 * Usage:
 *   node test-time-norms.js
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

// Test cases
const testCases = [
  {
    name: 'Betonování - 100 m³',
    position: {
      subtype: 'beton',
      qty: 100,
      unit: 'm³',
      crew_size: 4,
      shift_hours: 10,
      part_name: 'ZÁKLADY',
      item_name: 'Betonování'
    },
    expectedDays: { min: 4, max: 8 }
  },
  {
    name: 'Bednění - 150 m²',
    position: {
      subtype: 'bednění',
      qty: 150,
      unit: 'm²',
      crew_size: 3,
      shift_hours: 10,
      part_name: 'OPĚRY',
      item_name: 'Montáž bednění'
    },
    expectedDays: { min: 6, max: 12 }
  },
  {
    name: 'Výztuž - 5000 kg',
    position: {
      subtype: 'výztuž',
      qty: 5000,
      unit: 'kg',
      crew_size: 2,
      shift_hours: 10,
      part_name: 'PILÍŘE',
      item_name: 'Vázání výztuže'
    },
    expectedDays: { min: 2, max: 5 }
  }
];

/**
 * Test AI suggestion for a position
 */
async function testSuggestion(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`   Input: ${testCase.position.qty} ${testCase.position.unit}, ${testCase.position.crew_size} lidí, ${testCase.position.shift_hours}h`);

  try {
    // Create temporary position
    const createResponse = await fetch(`${API_BASE}/api/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bridge_id: 'test-time-norms',
        positions: [testCase.position]
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create position: ${createResponse.status}`);
    }

    const createData = await createResponse.json();
    const positionId = createData.positions[0].id;

    console.log(`   ✓ Position created: ${positionId}`);

    // Request AI suggestion
    console.log('   ⏳ Requesting AI suggestion...');
    const startTime = Date.now();

    const suggestResponse = await fetch(`${API_BASE}/api/positions/${positionId}/suggest-days`, {
      method: 'POST'
    });

    const duration = Date.now() - startTime;

    if (!suggestResponse.ok) {
      throw new Error(`Suggestion failed: ${suggestResponse.status}`);
    }

    const suggestion = await suggestResponse.json();

    // Validate response
    console.log(`   ✓ Response received (${duration}ms)`);
    console.log(`   📊 Suggested days: ${suggestion.suggested_days}`);
    console.log(`   📚 Norm source: ${suggestion.norm_source}`);
    console.log(`   🎯 Confidence: ${Math.round(suggestion.confidence * 100)}%`);
    console.log(`   💬 Reasoning: ${suggestion.reasoning.substring(0, 100)}...`);

    // Check if suggestion is in expected range
    const { min, max } = testCase.expectedDays;
    if (suggestion.suggested_days >= min && suggestion.suggested_days <= max) {
      console.log(`   ✅ PASS - Days in expected range [${min}-${max}]`);
    } else {
      console.log(`   ⚠️  WARNING - Days outside expected range [${min}-${max}]`);
    }

    // Cleanup
    await fetch(`${API_BASE}/api/positions/${positionId}`, { method: 'DELETE' });

    return {
      success: true,
      duration,
      suggestion
    };

  } catch (error) {
    console.log(`   ❌ FAIL - ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Time Norms Automation - Test Suite');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log('=' .repeat(60));

  const results = [];

  for (const testCase of testCases) {
    const result = await testSuggestion(testCase);
    results.push({ testCase: testCase.name, ...result });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results
    .filter(r => r.duration)
    .reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏱️  Avg Response Time: ${Math.round(avgDuration)}ms`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check logs above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
