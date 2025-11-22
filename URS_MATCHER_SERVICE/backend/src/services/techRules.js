/**
 * Technology Rules Service
 * Manages generation of related/complementary work items (tech-rules engine)
 * MVP-2: Core implementation with Czech construction vocabulary
 */

import { logger } from '../utils/logger.js';

/**
 * Technology rules for construction work items
 * Each rule triggers on certain keywords and generates related/required work items
 */
export const TECH_RULES = [
  // ============================================================================
  // FOUNDATIONS & EXCAVATION
  // ============================================================================
  {
    id: 'tech_rule_foundation_excavation',
    name: 'Výkopy pro základy',
    description: 'Výkopy pro základové pásy, patky, desky',
    trigger: /výkop|kopání|hloubení|rýha|základy/i,
    generates: [
      {
        code: '801171321',
        name: 'Bednění základů',
        unit: 'm2',
        reason: 'Bednění je technologicky nezbytné pro formování základových pasů a patek'
      },
      {
        code: '801191210',
        name: 'Železování základů',
        unit: 't',
        reason: 'Výztužování základů je povinné pro nosné základové prvky'
      }
    ]
  },

  {
    id: 'tech_rule_foundation_backfill',
    name: 'Zásypy základů',
    description: 'Zásypy pod základy a kolem základů',
    trigger: /zásyp|zasypávání|zátlak|obepínání|zemina pod|lože/i,
    generates: [
      {
        code: '801151111',
        name: 'Hutnění zeminy',
        unit: 'm3',
        reason: 'Hutnění je technologicky nezbytné pro dosažení požadované únosnosti'
      }
    ]
  },

  // ============================================================================
  // CONCRETE SLABS & BEAMS
  // ============================================================================
  {
    id: 'tech_rule_concrete_slab_formwork',
    name: 'Bednění pro betonové desky',
    description: 'Bednění vodorovných betonových konstrukcí',
    trigger: /betonová desk|stropní desk|deska|beton.*desk/i,
    generates: [
      {
        code: '801171321',
        name: 'Bednění vodorovných konstrukcí',
        unit: 'm2',
        reason: 'Bednění je nezbytné pro vytvoření půdorysu a spádu betonové desky'
      }
    ]
  },

  {
    id: 'tech_rule_rb_reinforcement',
    name: 'Výztuž pro železobeton',
    description: 'Výztuž pro ŽB prvky (desky, pásy, patky, sloupky)',
    trigger: /železobeton|ŽB|výztuž|armovacie|ocel.*beton/i,
    generates: [
      {
        code: '801191210',
        name: 'Železování ŽB konstrukcí',
        unit: 't',
        reason: 'Železování je nezbytné pro nosnost ŽB prvků'
      }
    ]
  },

  {
    id: 'tech_rule_concrete_placement',
    name: 'Přesun betonové hmoty',
    description: 'Přesun betonové hmoty při betonáži vyšších pater',
    trigger: /beton|betonáž|betoning/i,
    generates: [
      {
        code: '801321111',
        name: 'Přesun betonové hmoty',
        unit: 'm3',
        reason: 'Přesun betonové hmoty je nutný pro betonáž ve výšce (přesun čerpadlem, cisternou)'
      }
    ]
  },

  // ============================================================================
  // MASONRY & WALLS
  // ============================================================================
  {
    id: 'tech_rule_masonry_bed',
    name: 'Lože pro zdivo',
    description: 'Přípravná vrstva pod zdivo',
    trigger: /zdivo|cihly|zdění|zděnina|muřování/i,
    generates: [
      {
        code: '801171321',
        name: 'Maltovací lože',
        unit: 'm3',
        reason: 'Maltovací lože je nezbytné pro vyrovnání podkladu pod zdivo'
      }
    ]
  },

  // ============================================================================
  // UTILITIES & PROSTUPY (PENETRATIONS)
  // ============================================================================
  {
    id: 'tech_rule_pipe_bedding',
    name: 'Lože pro potrubí v zemi',
    description: 'Lože a zásyp pro pokládku potrubí',
    trigger: /potrubí.*zem|kanalizace|vodovod|zemina|výkop rýh/i,
    generates: [
      {
        code: '801151111',
        name: 'Hutnění zeminy pod potrubím',
        unit: 'm3',
        reason: 'Hutnění je nutné pro stabilizaci podkladu pod potrubím'
      },
      {
        code: '801151121',
        name: 'Zásyp nad potrubím',
        unit: 'm3',
        reason: 'Zásyp a hutnění je nezbytné pro ochranu potrubí'
      }
    ]
  },

  {
    id: 'tech_rule_penetration_sealing',
    name: 'Utěsnění prostupů',
    description: 'Utěsnění prostupů potrubí skrz stavební prvky',
    trigger: /prostup|vrtání.*jádra|průchodka|chráničk|manžeta/i,
    generates: [
      {
        code: '801171321',
        name: 'Manžeta/chráničk. prostupu',
        unit: 'ks',
        reason: 'Manžeta/chráničk. je nezbytná pro izolaci prostupu od vody a vlhkosti'
      }
    ]
  },

  // ============================================================================
  // WATERPROOFING & ISOLATION
  // ============================================================================
  {
    id: 'tech_rule_hydroisol_foundation',
    name: 'Hydroizolace základů',
    description: 'Izolace základů od vody',
    trigger: /hydroizolace|izolace.*vlhkost|DPH|vlhkostní|podzemní|zapískování/i,
    generates: [
      {
        code: '801191210',
        name: 'Izolační pásy',
        unit: 'm2',
        reason: 'Izolační pásy chrání základy od stékající vody a půdní vlhkosti'
      }
    ]
  },

  // ============================================================================
  // FLOORING & GROUND PREPARATION
  // ============================================================================
  {
    id: 'tech_rule_ground_preparation',
    name: 'Příprava podloží',
    description: 'Příprava podloží pro finální povrch',
    trigger: /podlaha|dlážk|nášlapy|podíl|stěrka|vyrovnávací|podsyp/i,
    generates: [
      {
        code: '801321111',
        name: 'Vyrovnávací vrstva',
        unit: 'm3',
        reason: 'Vyrovnávací vrstva je nezbytná pro zajištění rovnosti podkladu'
      }
    ]
  }
];

/**
 * Apply technology rules to matched items
 * Generates related work items based on triggers
 *
 * @param {Array} items - Already matched URS items
 * @param {Array} allCandidates - All available URS items from catalog (for validation)
 * @returns {Array} Related/complementary items generated by tech-rules
 */
export function applyTechRules(items, allCandidates = []) {
  try {
    const generated = [];
    const processedCodes = new Set(items.map(item => item.code));

    // TODO: MVP-2 Phase 2 - Implement LLM-based rule application
    // For now, using pattern matching (pattern-based MVP-2 Phase 1)

    for (const item of items) {
      const itemText = `${item.name || ''} ${item.description || ''}`.toLowerCase();

      // Find matching rules
      for (const rule of TECH_RULES) {
        if (rule.trigger.test(itemText)) {
          logger.debug(`[TechRules] Triggered rule: ${rule.id} for item: ${item.code}`);

          // Add generated items
          for (const generated_item of rule.generates) {
            // Skip if already in processed items
            if (processedCodes.has(generated_item.code)) {
              logger.debug(`[TechRules] Skipping duplicate: ${generated_item.code}`);
              continue;
            }

            // Validate that generated code exists in candidates
            const exists = allCandidates.length === 0 ||
                          allCandidates.some(c => c.urs_code === generated_item.code);

            if (!exists && allCandidates.length > 0) {
              logger.warn(`[TechRules] Generated code not found in catalog: ${generated_item.code}`);
              continue;
            }

            generated.push({
              related_to_code: item.code,
              code: generated_item.code,
              name: generated_item.name,
              unit: generated_item.unit,
              reason: generated_item.reason,
              rule_id: rule.id,
              source: 'tech_rule'
            });

            processedCodes.add(generated_item.code);
          }
        }
      }
    }

    logger.info(`[TechRules] Generated ${generated.length} related items from ${items.length} input items`);
    return generated;

  } catch (error) {
    logger.error(`[TechRules] Error applying rules: ${error.message}`);
    return [];
  }
}
