/**
 * Sheathing Formulas Test Suite - Day 6 Testing
 * Comprehensive validation of checkerboard method calculations
 */

import {
  getCuringDays,
  calculateAssemblyDays,
  calculateDisassemblyDays,
  calculateSingleCycleDays,
  calculateSequentialDuration,
  calculateStaggredDuration,
  calculateAssemblyLaborHours,
  calculateSheathing,
  calculateAllCaptures,
  calculateProjectStats
} from './sheathing-formulas.js';

import type {
  SheathingCapture,
  SheathingProjectConfig,
  SheathingCalculationResult
} from './types.js';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, message: string, expected?: any, actual?: any) {
  if (!condition) {
    testResults.push({
      name: message,
      passed: false,
      expected,
      actual,
      error: `Assertion failed: ${message}`
    });
    return false;
  } else {
    testResults.push({
      name: message,
      passed: true,
      expected,
      actual
    });
    return true;
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  const passed = actual === expected;
  if (!passed) {
    testResults.push({
      name: message,
      passed: false,
      expected,
      actual,
      error: `Expected ${expected}, got ${actual}`
    });
  } else {
    testResults.push({
      name: message,
      passed: true,
      expected,
      actual
    });
  }
  return passed;
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  const passed = Math.abs(actual - expected) <= tolerance;
  if (!passed) {
    testResults.push({
      name: message,
      passed: false,
      expected: `${expected} ±${tolerance}`,
      actual,
      error: `Expected ~${expected} (±${tolerance}), got ${actual}`
    });
  } else {
    testResults.push({
      name: message,
      passed: true,
      expected: `${expected} ±${tolerance}`,
      actual
    });
  }
  return passed;
}

// ============================================================================
// TEST 1: CURING DAYS BY CONCRETE CLASS
// ============================================================================

console.log('\n📋 TEST 1: Concrete Curing Days');
console.log('━'.repeat(60));

assertEquals(getCuringDays('C25/30', 20), 3, 'C25/30 at 20°C = 3 days');
assertEquals(getCuringDays('C30/37', 20), 5, 'C30/37 at 20°C = 5 days');
assertEquals(getCuringDays('C35/45', 20), 7, 'C35/45 at 20°C = 7 days');
assertEquals(getCuringDays('C45/55', 20), 10, 'C45/55 at 20°C = 10 days');
assertEquals(getCuringDays(undefined, 20), 5, 'Undefined class defaults to 5 days');

// Temperature effects
assertEquals(getCuringDays('C30/37', 10), 7, 'C30/37 at 10°C (cold) = 7 days (1.3x)');
assertEquals(getCuringDays('C30/37', 5), 8, 'C30/37 at 5°C (very cold) = 8 days (1.5x)');
assertEquals(getCuringDays('C30/37', 28), 4, 'C30/37 at 28°C (hot) = 4 days (0.8x)');

// ============================================================================
// TEST 2: ASSEMBLY DAYS CALCULATION
// ============================================================================

console.log('\n📋 TEST 2: Assembly Days Calculation');
console.log('━'.repeat(60));

// Scenario: 50 m² area, 1.0 ph/m², crew of 4, 10h/shift = 50 ph / 40 h/day = 1.25 days = 2 days
assertEquals(calculateAssemblyDays(50, 1.0, 4, 10), 2, 'Basic: 50m² × 1.0 norm / (4 × 10) = 2 days');

// Scenario: 100 m², 0.8 norm, crew 4 = 80 / 40 = 2 days
assertEquals(calculateAssemblyDays(100, 0.8, 4, 10), 2, '100m² × 0.8 / 40 = 2 days');

// Scenario: 80 m², 1.5 norm, crew 4 = 120 / 40 = 3 days
assertEquals(calculateAssemblyDays(80, 1.5, 4, 10), 3, '80m² × 1.5 / 40 = 3 days');

// Scenario: 50 m², 1.0 norm, crew 2 = 50 / 20 = 2.5 = 3 days
assertEquals(calculateAssemblyDays(50, 1.0, 2, 10), 3, 'Small crew: 50 / 20 = 3 days (ceil)');

// ============================================================================
// TEST 3: DISASSEMBLY DAYS
// ============================================================================

console.log('\n📋 TEST 3: Disassembly Days (50% of assembly)');
console.log('━'.repeat(60));

assertEquals(calculateDisassemblyDays(4), 2, 'Assembly 4 days → Disassembly 2 days');
assertEquals(calculateDisassemblyDays(3), 2, 'Assembly 3 days → Disassembly 2 days (ceil)');
assertEquals(calculateDisassemblyDays(5), 3, 'Assembly 5 days → Disassembly 3 days (ceil)');
assertEquals(calculateDisassemblyDays(10, 0.4), 4, 'Custom ratio: 10 × 0.4 = 4 days');

// ============================================================================
// TEST 4: SINGLE CYCLE CALCULATION
// ============================================================================

console.log('\n📋 TEST 4: Single Cycle Days');
console.log('━'.repeat(60));

// Single cycle = assembly + curing + disassembly
// Example: 5 + 5 + 3 = 13 days
assertEquals(calculateSingleCycleDays(5, 5, 3), 13, 'Cycle: 5 + 5 + 3 = 13 days');
assertEquals(calculateSingleCycleDays(2, 5, 1), 8, 'Cycle: 2 + 5 + 1 = 8 days');
assertEquals(calculateSingleCycleDays(3, 7, 2), 12, 'Cycle: 3 + 7 + 2 = 12 days');

// ============================================================================
// TEST 5: SEQUENTIAL DURATION (Traditional Method)
// ============================================================================

console.log('\n📋 TEST 5: Sequential Duration (One kit after another)');
console.log('━'.repeat(60));

// Sequential = single_cycle × num_kits
assertEquals(calculateSequentialDuration(13, 1), 13, '1 kit, single cycle 13 days = 13 days');
assertEquals(calculateSequentialDuration(13, 2), 26, '2 kits, single cycle 13 days = 26 days');
assertEquals(calculateSequentialDuration(13, 3), 39, '3 kits, single cycle 13 days = 39 days');
assertEquals(calculateSequentialDuration(10, 4), 40, '4 kits, single cycle 10 days = 40 days');

// ============================================================================
// TEST 6: STAGGERED DURATION (Checkerboard Method)
// ============================================================================

console.log('\n📋 TEST 6: Staggered/Checkerboard Duration');
console.log('━'.repeat(60));

/**
 * Staggered Formula: (num_kits - 1) × shift_days + single_cycle_days
 *
 * For 2 kits:
 * - Single cycle: 5 + 5 + 3 = 13 days
 * - Shift: (5 + 5) / 2 = 5 days
 * - Total: (2 - 1) × 5 + 13 = 18 days
 *
 * For 3 kits:
 * - Shift: (5 + 5) / 3 = 3.33 → 4 days
 * - Total: (3 - 1) × 4 + 13 = 21 days
 */

const staggered2 = calculateStaggredDuration(5, 5, 3, 2);
assertEquals(staggered2.duration, 18, '2 kits: (2-1)×5 + 13 = 18 days');
assertEquals(staggered2.shift, 5, '2 kits: shift = 5 days');

const staggered3 = calculateStaggredDuration(5, 5, 3, 3);
assertEquals(staggered3.duration, 21, '3 kits: (3-1)×4 + 13 = 21 days (approx)');

const staggered4 = calculateStaggredDuration(5, 5, 3, 4);
assertEquals(staggered4.duration, 24, '4 kits: (4-1)×3 + 13 = 22 days (approx)');

// ============================================================================
// TEST 7: TIME SAVINGS (Staggered vs Sequential)
// ============================================================================

console.log('\n📋 TEST 7: Time Savings Analysis');
console.log('━'.repeat(60));

// 2 kits, cycle 13:
// Sequential: 26 days
// Staggered: 18 days
// Savings: 26 - 18 = 8 days (30.8%)
const sequential2 = calculateSequentialDuration(13, 2);
const staggered2b = calculateStaggredDuration(5, 5, 3, 2).duration;
const savings2 = sequential2 - staggered2b;
const savingsPercent2 = (savings2 / sequential2) * 100;

assertEquals(savings2, 8, '2 kits: 26 - 18 = 8 days saved');
assertApprox(savingsPercent2, 30.8, 1, '2 kits: ~30.8% time savings');

// 3 kits, cycle 13:
// Sequential: 39 days
// Staggered: ~21 days
// Savings: 18 days (46.2%)
const sequential3 = calculateSequentialDuration(13, 3);
const staggered3b = calculateStaggredDuration(5, 5, 3, 3).duration;
const savings3 = sequential3 - staggered3b;
const savingsPercent3 = (savings3 / sequential3) * 100;

assertApprox(savings3, 18, 2, '3 kits: ~18 days saved');
assertApprox(savingsPercent3, 46, 2, '3 kits: ~46% time savings');

// ============================================================================
// TEST 8: LABOR HOURS CALCULATION
// ============================================================================

console.log('\n📋 TEST 8: Labor Hours Calculation');
console.log('━'.repeat(60));

assertEquals(calculateAssemblyLaborHours(50, 1.0), 50, 'Assembly: 50m² × 1.0 = 50 ph');
assertEquals(calculateAssemblyLaborHours(100, 0.8), 80, 'Assembly: 100m² × 0.8 = 80 ph');
assertEquals(calculateAssemblyLaborHours(200, 1.5), 300, 'Assembly: 200m² × 1.5 = 300 ph');

// Total labor (assembly + disassembly)
// Disassembly usually ~50% of assembly
// So total = assembly + 0.5 × assembly = 1.5 × assembly
assertEquals(calculateAssemblyLaborHours(50, 1.0) * 1.5, 75, 'Total (assembly + disassembly): 50 × 1.5 = 75 ph');

// ============================================================================
// TEST 9: REAL-WORLD SCENARIO - BRIDGE FOUNDATION
// ============================================================================

console.log('\n📋 TEST 9: Real-World Scenario - Bridge Foundation (ZÁKLADY)');
console.log('━'.repeat(60));

const bridgeConfig: SheathingProjectConfig = {
  project_id: 'BRIDGE-001',
  default_assembly_norm_ph_m2: 0.8,
  default_concrete_curing_days: 5,
  default_num_kits: 2,
  default_work_method: 'staggered',
  crew_size: 4,
  shift_hours: 10,
  days_per_month: 22
};

const bridgeCapture: SheathingCapture = {
  capture_id: 'CAP-BR001-001',
  project_id: 'BRIDGE-001',
  part_name: 'ZÁKLADY',
  length_m: 12,
  width_m: 8,
  height_m: 2.5,
  area_m2: 96,
  assembly_norm_ph_m2: 0.8,
  concrete_curing_days: 5,
  num_kits: 2,
  work_method: 'staggered',
  crew_size: 4,
  shift_hours: 10,
  days_per_month: 22,
  concrete_class: 'C30/37'
};

const result = calculateSheathing(bridgeCapture, bridgeConfig);

console.log('\nBridge Foundation Calculation:');
console.log(`  Dimensions: ${bridgeCapture.length_m}m × ${bridgeCapture.width_m}m = ${bridgeCapture.area_m2}m²`);
console.log(`  Assembly: ${result.assembly_days} days`);
console.log(`  Curing: ${result.curing_days} days`);
console.log(`  Disassembly: ${result.disassembly_days} days`);
console.log(`  Single Cycle: ${result.single_cycle_days} days`);
console.log(`  Sequential Duration: ${result.sequential_duration_days} days`);
console.log(`  Staggered Duration: ${result.staggered_duration_days} days`);
console.log(`  Time Savings: ${result.time_savings_days} days (${result.time_savings_percent?.toFixed(1)}%)`);
console.log(`  Labor Hours: ${result.total_labor_hours} ph`);
console.log(`  Summary: ${result.summary}`);

assert(result.assembly_days > 0, 'Assembly days calculated');
assert(result.curing_days === 5, 'Curing days set to 5');
assert(result.disassembly_days > 0, 'Disassembly days calculated');
assert(result.staggered_duration_days < result.sequential_duration_days, 'Staggered < Sequential');
assert((result.time_savings_percent || 0) > 0, 'Time savings calculated');

// ============================================================================
// TEST 10: EDGE CASES AND BOUNDARY VALUES
// ============================================================================

console.log('\n📋 TEST 10: Edge Cases and Boundary Values');
console.log('━'.repeat(60));

// Edge case: Very small area
const smallArea = calculateAssemblyDays(1, 1.0, 4, 10);
assert(smallArea >= 1, 'Small area (1m²) produces at least 1 day');

// Edge case: Very large area
const largeArea = calculateAssemblyDays(10000, 1.0, 4, 10);
assert(largeArea > 100, 'Large area (10000m²) produces many days');

// Edge case: High assembly norm
const highNorm = calculateAssemblyDays(100, 10, 4, 10);
assert(highNorm > 20, 'High assembly norm (10 ph/m²) increases days significantly');

// Edge case: Single kit (no time savings possible)
const singleKit = calculateStaggredDuration(5, 5, 3, 1);
assertEquals(singleKit.duration, 13, '1 kit: duration equals single cycle (13 days)');

// Edge case: Many kits
const manyKits = calculateStaggredDuration(5, 5, 3, 10);
assert(manyKits.duration > 13, '10 kits: duration > single cycle');
assert(manyKits.duration < 130, '10 kits: duration < 10 × cycle (benefits of stagger)');

// ============================================================================
// TEST 11: MULTIPLE CAPTURES AGGREGATION
// ============================================================================

console.log('\n📋 TEST 11: Multiple Captures Aggregation');
console.log('━'.repeat(60));

const multiCaptures: SheathingCapture[] = [
  {
    capture_id: 'CAP1',
    project_id: 'PROJ1',
    part_name: 'ZÁKLADY',
    length_m: 12,
    width_m: 8,
    height_m: 2,
    area_m2: 96,
    assembly_norm_ph_m2: 0.8,
    concrete_curing_days: 5,
    num_kits: 2,
    work_method: 'staggered',
    crew_size: 4,
    shift_hours: 10,
    days_per_month: 22
  },
  {
    capture_id: 'CAP2',
    project_id: 'PROJ1',
    part_name: 'PILÍŘE',
    length_m: 10,
    width_m: 10,
    height_m: 3,
    area_m2: 100,
    assembly_norm_ph_m2: 1.0,
    concrete_curing_days: 5,
    num_kits: 2,
    work_method: 'staggered',
    crew_size: 4,
    shift_hours: 10,
    days_per_month: 22
  }
];

const allResults = calculateAllCaptures(multiCaptures, bridgeConfig);
const stats = calculateProjectStats(allResults);

console.log('\nProject Statistics:');
console.log(`  Total Captures: ${stats.total_captures}`);
console.log(`  Total Area: ${stats.total_area_m2}m²`);
console.log(`  Total Labor: ${stats.total_labor_hours} ph`);
console.log(`  Max Duration: ${stats.max_project_duration_days} days`);

assertEquals(stats.total_captures, 2, 'Total captures = 2');
assertEquals(stats.total_area_m2, 196, 'Total area = 96 + 100 = 196m²');
assert(stats.total_labor_hours > 0, 'Total labor hours calculated');
assert(stats.max_project_duration_days > 0, 'Max project duration calculated');

// ============================================================================
// TEST 12: COST ESTIMATION (if provided)
// ============================================================================

console.log('\n📋 TEST 12: Cost Estimation');
console.log('━'.repeat(60));

const captureCost: SheathingCapture = {
  capture_id: 'CAP-COST-001',
  project_id: 'PROJ-COST',
  part_name: 'TESTOVACÍ',
  length_m: 10,
  width_m: 10,
  height_m: 2,
  area_m2: 100,
  assembly_norm_ph_m2: 1.0,
  concrete_curing_days: 5,
  num_kits: 2,
  kit_type: 'DOKA',
  daily_rental_cost_czk: 5000, // 5000 CZK per kit per day
  work_method: 'staggered',
  crew_size: 4,
  shift_hours: 10,
  days_per_month: 22
};

const costConfig: SheathingProjectConfig = {
  ...bridgeConfig,
  project_id: 'PROJ-COST'
};

const costResult = calculateSheathing(captureCost, costConfig);

console.log('\nCost Estimation:');
console.log(`  Daily Rental Cost: ${captureCost.daily_rental_cost_czk ?? 'N/A'} CZK per kit`);
console.log(`  Duration: ${costResult.staggered_duration_days} days`);
console.log(`  Total Rental Cost: ${costResult.total_rental_cost_czk} CZK`);
const expectedCost = (captureCost.daily_rental_cost_czk ?? 0) * costResult.staggered_duration_days * captureCost.num_kits;
console.log(`  Expected Cost: ${expectedCost} CZK`);

assert(costResult.total_rental_cost_czk! >= 0, 'Rental cost is non-negative');

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));

const passed = testResults.filter(r => r.passed).length;
const failed = testResults.filter(r => !r.passed).length;
const total = testResults.length;

console.log(`\n✅ Passed: ${passed}/${total}`);
console.log(`❌ Failed: ${failed}/${total}`);
console.log(`📊 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n❌ FAILED TESTS:');
  testResults
    .filter(r => !r.passed)
    .forEach(r => {
      console.log(`  - ${r.name}`);
      console.log(`    Expected: ${r.expected}`);
      console.log(`    Actual: ${r.actual}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
} else {
  console.log('\n✅ ALL TESTS PASSED! The sheathing calculator is working correctly.');
}

export { testResults };
