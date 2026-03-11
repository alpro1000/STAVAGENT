/**
 * Tests for TOV Profession Mapper
 */

import { mapSubtypeToProfession, getDefaultRate, createLaborResource, batchMapPositions } from './services/tovProfessionMapper.js';

// Test mapSubtypeToProfession
console.log('Testing mapSubtypeToProfession...');
console.assert(mapSubtypeToProfession('Betonování') === 'Betonář', 'Betonování → Betonář');
console.assert(mapSubtypeToProfession('BETONOVÁNÍ') === 'Betonář', 'Case insensitive');
console.assert(mapSubtypeToProfession('Bednění') === 'Tesař / Bednář', 'Bednění → Tesař / Bednář');
console.assert(mapSubtypeToProfession('Výztuž') === 'Železář / Armovač', 'Výztuž → Železář / Armovač');
console.assert(mapSubtypeToProfession('Jiné práce') === null, 'Unknown → null');
console.log('✅ mapSubtypeToProfession tests passed');

// Test getDefaultRate
console.log('\nTesting getDefaultRate...');
console.assert(getDefaultRate('Betonář') === 398, 'Betonář rate');
console.assert(getDefaultRate('Železář / Armovač') === 420, 'Železář rate');
console.assert(getDefaultRate('Tesař / Bednář') === 385, 'Tesař rate');
console.assert(getDefaultRate('Unknown') === 350, 'Default rate');
console.log('✅ getDefaultRate tests passed');

// Test createLaborResource
console.log('\nTesting createLaborResource...');
const position1 = {
  subtype: 'Betonování',
  crew_size: 4,
  shift_hours: 10
};
const labor1 = createLaborResource(position1);
console.assert(labor1.profession === 'Betonář', 'Profession mapped');
console.assert(labor1.count === 4, 'Crew size');
console.assert(labor1.hours === 10, 'Shift hours');
console.assert(labor1.normHours === 40, 'Norm hours = 4 * 10');
console.assert(labor1.hourlyRate === 398, 'Hourly rate');
console.assert(labor1.totalCost === 15920, 'Total cost = 40 * 398');

const position2 = { subtype: 'Jiné práce' };
const labor2 = createLaborResource(position2);
console.assert(labor2 === null, 'Unknown subtype → null');
console.log('✅ createLaborResource tests passed');

// Test batchMapPositions
console.log('\nTesting batchMapPositions...');
const positions = [
  { subtype: 'Betonování', crew_size: 4, shift_hours: 10 },
  { subtype: 'Bednění', crew_size: 3, shift_hours: 8 },
  { subtype: 'Jiné práce', crew_size: 2, shift_hours: 8 },
  { subtype: 'Výztuž', crew_size: 5, shift_hours: 9 }
];
const laborResources = batchMapPositions(positions);
console.assert(laborResources.length === 3, 'Only mapped positions (3/4)');
console.assert(laborResources[0].profession === 'Betonář', 'First: Betonář');
console.assert(laborResources[1].profession === 'Tesař / Bednář', 'Second: Tesař');
console.assert(laborResources[2].profession === 'Železář / Armovač', 'Third: Železář');
console.log('✅ batchMapPositions tests passed');

console.log('\n✅ All tests passed!');
