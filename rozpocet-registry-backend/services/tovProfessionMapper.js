/**
 * TOV Profession Mapper
 * Maps Monolit-Planner work types (subtype) to Registry TOV professions
 */

const PROFESSION_MAPPING = {
  'beton': 'Betonář',
  'betonování': 'Betonář',
  'betonáž': 'Betonář',
  'bednění': 'Tesař / Bednář',
  'bedění': 'Tesař / Bednář',
  'výztuž': 'Železář / Armovač',
  'vyztuž': 'Železář / Armovač',
  'armování': 'Železář / Armovač',
};

const DEFAULT_RATES = {
  'Betonář': 398,
  'Železář / Armovač': 420,
  'Tesař / Bednář': 385,
  'Pomocný dělník': 280,
};

export function mapSubtypeToProfession(subtype) {
  if (!subtype) return null;
  const normalized = subtype.toLowerCase().trim();
  for (const [keyword, profession] of Object.entries(PROFESSION_MAPPING)) {
    if (normalized.includes(keyword)) return profession;
  }
  return null;
}

export function getDefaultRate(profession) {
  return DEFAULT_RATES[profession] || 350;
}

export function createLaborResource(position) {
  const profession = mapSubtypeToProfession(position.subtype);
  if (!profession) return null;
  
  const hourlyRate = getDefaultRate(profession);
  const hours = position.shift_hours || 8;
  const count = position.crew_size || 1;
  const normHours = count * hours;
  
  return {
    id: `labor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    profession,
    count,
    hours,
    normHours,
    hourlyRate,
    totalCost: normHours * hourlyRate,
  };
}

export function batchMapPositions(positions) {
  return positions.map(createLaborResource).filter(Boolean);
}
