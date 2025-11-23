/**
 * Quick test for smart regex parser
 */

// Simulate the parseLineWithRegex function
function parseNumber(value) {
  if (!value) return 0;
  const num = parseFloat(value.toString().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function parseLineWithRegex(line) {
  const unitPattern = '(m3|m2|m|ks|kus|kusy|t|kg|g|l|ml|hod|h|den|dny)';

  const pattern = new RegExp(
    `^(.+?)\\s*([0-9]+[,.]?[0-9]*)\\s*${unitPattern}?\\s*$`,
    'i'
  );

  const match = line.match(pattern);

  if (match) {
    const description = match[1].trim();
    const quantity = parseNumber(match[2]);
    const unit = match[3] ? match[3].toLowerCase() : 'ks';

    return { description, quantity, unit };
  }

  return {
    description: line.trim(),
    quantity: 0,
    unit: 'ks'
  };
}

// Test cases
const testCases = [
  {
    input: "Odvětrání radonu drenážní potrubí DN 100 44,8 m",
    expected: { description: "Odvětrání radonu drenážní potrubí DN 100", quantity: 44.8, unit: "m" }
  },
  {
    input: "Betonové schody 15 m2",
    expected: { description: "Betonové schody", quantity: 15, unit: "m2" }
  },
  {
    input: "Lešení fasádní 120 m2",
    expected: { description: "Lešení fasádní", quantity: 120, unit: "m2" }
  },
  {
    input: "Vytvoření prostupu DN 315 0,12",
    expected: { description: "Vytvoření prostupu DN 315", quantity: 0.12, unit: "ks" }
  },
  {
    input: "Lešení bez množství",
    expected: { description: "Lešení bez množství", quantity: 0, unit: "ks" }
  },
  {
    input: "Beton C25/30 25 m3",
    expected: { description: "Beton C25/30", quantity: 25, unit: "m3" }
  }
];

console.log('🧪 Testing smart regex parser:\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
  const result = parseLineWithRegex(test.input);
  const isMatch =
    result.description === test.expected.description &&
    Math.abs(result.quantity - test.expected.quantity) < 0.001 &&
    result.unit === test.expected.unit;

  if (isMatch) {
    console.log(`✅ Test ${idx + 1}: PASS`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Result: ${JSON.stringify(result)}\n`);
    passed++;
  } else {
    console.log(`❌ Test ${idx + 1}: FAIL`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: ${JSON.stringify(test.expected)}`);
    console.log(`   Got:      ${JSON.stringify(result)}\n`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
