/**
 * Technology Rules Service
 * Manages generation of related/complementary work items
 * Will be expanded in MVP-2
 */

export const TECH_RULES = [
  {
    id: 'tech_rule_bedneni_for_slab',
    name: 'Bednění for concrete slab',
    trigger: /beton.*desk|betonová desk/i,
    generates: [
      { urs_code: '801171321', reason: 'Scaffolding/formwork required for slab' }
    ]
  },
  {
    id: 'tech_rule_vyztuž_for_concrete',
    name: 'Reinforcement for concrete',
    trigger: /beton|ŽB|železobeton/i,
    generates: [
      { urs_code: '801161111', reason: 'Reinforcement required for concrete work' }
    ]
  }
  // More rules to be added in MVP-2
];

export function applyTechRules(items) {
  // TODO: MVP-2 - Implement rule application logic
  return [];
}
