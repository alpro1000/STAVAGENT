/**
 * Unified Object Templates
 *
 * Single source of truth for all part templates across object types.
 * Defines default parts (parts) for each object type when a new project is created.
 *
 * Each template defines:
 * - object_type: 'bridge', 'building', 'parking', 'road', or 'custom'
 * - part_name: Human-readable Czech name of the part
 * - display_order: Order in which parts appear in the UI
 * - is_default: Whether this is auto-populated on project creation (always true currently)
 * - description: Optional brief description for reference
 *
 * Design Principles:
 * 1. All templates centralized here (not scattered across migrations, routes, services)
 * 2. Initially populated based on practical construction experience
 * 3. TODO: Refine against OTSKP/ÚRS catalogs and ČSN standards in future iterations
 * 4. Custom type has no pre-populated parts (user adds all manually)
 *
 * TODO: Consider adding default_unit, default_subtype, default_crew_size etc.
 *       when we have more structured position templates
 */

export const OBJECT_TYPE_IDS = ['bridge', 'building', 'parking', 'road', 'custom'];

/**
 * Bridge (most common: most detailed)
 * Based on typical Czech ŽB mosty (железобетонные мосты)
 *
 * TODO: Cross-check against ÚRS (Jednotná souprava razítkopredfachů) for standard bridge structures
 * TODO: Add variants like "high-speed bridge", "railway bridge", "footbridge" with different parts
 */
export const BRIDGE_TEMPLATES = [
  { part_name: 'ZÁKLADY', display_order: 1, is_default: 1, description: 'Hloubkové a plošné založení, patky pod pilíře' },
  { part_name: 'OPĚRY', display_order: 2, is_default: 1, description: 'Koncové/krajní opěry, křídla' },
  { part_name: 'SLOUPY', display_order: 3, is_default: 1, description: 'Sloupy podporující mostovku' },
  { part_name: 'PILÍŘE', display_order: 4, is_default: 1, description: 'Mezipolí/středové pilíře' },
  { part_name: 'LOŽISKA', display_order: 5, is_default: 1, description: 'Elastomerové nebo kluzné ložisko' },
  { part_name: 'NOSNÁ KONSTRUKCE', display_order: 6, is_default: 1, description: 'Nosné prvky: desky, nosníky, příčníky' },
  { part_name: 'MOSTOVKA', display_order: 7, is_default: 1, description: 'Vozovka/jízdní povrch' },
  { part_name: 'IZOLACE', display_order: 8, is_default: 1, description: 'Hydroizolační vrstva' },
  { part_name: 'ŘÍMSY', display_order: 9, is_default: 1, description: 'Římsové profily, ochranné prvky' },
  { part_name: 'ZÁVĚRNÉ ZÍDKY', display_order: 10, is_default: 1, description: 'Koncové zídky, ochrana proti vypadávání' },
  { part_name: 'PŘECHODY', display_order: 11, is_default: 1, description: 'Přechodové desky na opěrách' },
  { part_name: 'SVODIDLA', display_order: 12, is_default: 1, description: 'Bezpečnostní prvky, svodidla' }
];

/**
 * Building (residential, office, industrial)
 * Typical multi-story ŽB construction
 *
 * TODO: Add variants for "high-rise", "industrial hall", "sport facility"
 * TODO: Consider adding "FASÁDNÍ PRVKY", "STŘECHA" for complete building
 */
export const BUILDING_TEMPLATES = [
  { part_name: 'ZÁKLADY', display_order: 1, is_default: 1, description: 'Základové pasy, desky, patky pod sloupy' },
  { part_name: 'SUTERÉN', display_order: 2, is_default: 1, description: 'Suterénní stěny a podlaha' },
  { part_name: 'NOSNÉ ZÍDKY', display_order: 3, is_default: 1, description: 'Svislé nosné ŽB stěny' },
  { part_name: 'SLOUPY', display_order: 4, is_default: 1, description: 'Svislé nosné sloupy' },
  { part_name: 'STROPY', display_order: 5, is_default: 1, description: 'Mezipodlažní ŽB stropní desky' },
  { part_name: 'SCHODIŠTĚ', display_order: 6, is_default: 1, description: 'Schodišťová jádra, ramena, podesty' },
  { part_name: 'ATIKA', display_order: 7, is_default: 1, description: 'Atika/věnec, střešní ztužidlo' },
  { part_name: 'BALKONY', display_order: 8, is_default: 1, description: 'Balkony a lodžie' }
];

/**
 * Parking (dedicated multi-level parking structures)
 * Typical Czech ŽB parkovací objekt
 *
 * TODO: Add variants for "underground parking", "open-air parking"
 */
export const PARKING_TEMPLATES = [
  { part_name: 'ZÁKLADY', display_order: 1, is_default: 1, description: 'Základová deska nebo pasy' },
  { part_name: 'PODKLADNÍ BETON', display_order: 2, is_default: 1, description: 'Podkladní a vyrovnávací vrstva' },
  { part_name: 'RAMPY', display_order: 3, is_default: 1, description: 'Nájezdové a sjezdové rampy' },
  { part_name: 'STROPNÍ DESKY', display_order: 4, is_default: 1, description: 'Mezipodlažní stropní desky' },
  { part_name: 'SLOUPY', display_order: 5, is_default: 1, description: 'Nosné sloupy' },
  { part_name: 'OBVODOVÉ ZÍDKY', display_order: 6, is_default: 1, description: 'Obvodové nosné/nenosné zídky' }
];

/**
 * Road (infrastructure: small bridges, culverts, road reinforcement)
 * Typical Czech stavby (cesty, propustky, ztužidla)
 *
 * TODO: This category is broad - consider splitting into "road", "railway", "utility"
 * TODO: Add templates for "pedestrian bridge", "culvert", "retaining wall"
 */
export const ROAD_TEMPLATES = [
  { part_name: 'ZEMNÍ PRÁCE', display_order: 1, is_default: 1, description: 'Výkopy, zásypy, příprava základů' },
  { part_name: 'PODKLAD', display_order: 2, is_default: 1, description: 'Podkladní vrstvy - štěrk, recykl' },
  { part_name: 'ZÁKLADNÍ VRSTVA', display_order: 3, is_default: 1, description: 'Zpevněná základní vrstva (kamenivo)' },
  { part_name: 'LOŽNÁ VRSTVA', display_order: 4, is_default: 1, description: 'Pojívací vrstva pod asfaltem' },
  { part_name: 'KRYT', display_order: 5, is_default: 1, description: 'Asfaltový kryt vozovky' },
  { part_name: 'KRAJNICE', display_order: 6, is_default: 1, description: 'Krajnice, banket' },
  { part_name: 'OBRUBY', display_order: 7, is_default: 1, description: 'ŽB obruby, prvky oddělující komunikaci' },
  { part_name: 'ODVODNĚNÍ', display_order: 8, is_default: 1, description: 'Odvodnění komunikace: vpusty, propusti, kanálky' }
];

/**
 * Custom (user-defined type)
 * No pre-populated parts - user adds all manually
 *
 * TODO: Consider providing a quick-select menu of common parts from other types
 */
export const CUSTOM_TEMPLATES = [];

/**
 * Master map: object_type → array of templates
 * Used by backend on project creation to populate initial parts
 */
export const TEMPLATE_PARTS_BY_OBJECT_TYPE = {
  'bridge': BRIDGE_TEMPLATES,
  'building': BUILDING_TEMPLATES,
  'parking': PARKING_TEMPLATES,
  'road': ROAD_TEMPLATES,
  'custom': CUSTOM_TEMPLATES
};

/**
 * Get templates for a specific object type
 * @param {string} objectType - One of: 'bridge', 'building', 'parking', 'road', 'custom'
 * @returns {Array} Array of template objects with part_name, display_order, is_default
 */
export function getTemplatesForType(objectType) {
  const templates = TEMPLATE_PARTS_BY_OBJECT_TYPE[objectType] || [];
  if (templates.length === 0 && objectType !== 'custom') {
    console.warn(`[ObjectTemplates] No templates found for object_type: ${objectType}`);
  }
  return templates;
}

/**
 * Convert templates to database insert format
 * Adds template_id and object_type fields
 * @param {string} objectType - Object type
 * @param {Array} templates - Template array
 * @returns {Array} Templates with id and object_type fields
 */
export function templatesToDatabaseFormat(objectType, templates) {
  return templates.map(t => ({
    template_id: `${objectType}_${t.part_name}`,
    object_type: objectType,
    part_name: t.part_name,
    display_order: t.display_order,
    is_default: t.is_default,
    description: t.description || null
  }));
}

/**
 * Get all templates for all object types
 * Used during database initialization
 * @returns {Array} Flattened array of all templates in database format
 */
export function getAllTemplates() {
  const allTemplates = [];

  for (const [objectType, templates] of Object.entries(TEMPLATE_PARTS_BY_OBJECT_TYPE)) {
    if (templates.length > 0) {
      allTemplates.push(...templatesToDatabaseFormat(objectType, templates));
    }
  }

  return allTemplates;
}

/**
 * Get summary of template counts per object type
 * @returns {Object} Summary like { bridge: 12, building: 8, parking: 6, road: 8, custom: 0 }
 */
export function getTemplateSummary() {
  const summary = {};

  for (const [objectType, templates] of Object.entries(TEMPLATE_PARTS_BY_OBJECT_TYPE)) {
    summary[objectType] = templates.length;
  }

  return summary;
}

/**
 * LEGACY: Bridge template positions (for backward compatibility)
 *
 * This was previously in bridgeTemplates.js and used by upload.js
 * Kept here for reference but should be refactored to use new template system
 *
 * TODO: Decide if these detailed positions (with subtype, unit) should be in template system
 *       OR if simple part_name templates are sufficient and upload.js should create default positions
 */
export const BRIDGE_TEMPLATE_POSITIONS = [
  // Part: ZÁKLADY
  { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'beton', unit: 'M3' },
  { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'bednění', unit: 'm2' },

  // Part: RÖMSY
  { part_name: 'RÖMSY', item_name: 'RÖMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
  { part_name: 'RÖMSY', item_name: 'RÖMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

  // Part: MOSTNÍ OPĚRY A KŘÍDLA
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (opěry)', unit: 'm2' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (křídla)', unit: 'm2' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (závěrné zídky)', unit: 'm2' },

  // Part: MOSTNÍ OPĚRY A KŘÍDLA C40/50
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'bednění', unit: 'm2' },

  // Part: MOSTNÍ PILÍŘE A STATIVA
  { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

  // Part: PŘECHODOVÉ DESKY
  { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'beton', unit: 'M3' },
  { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'bednění', unit: 'm2' },

  // Part: MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE
  { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'bednění', unit: 'm2' },

  // Part: SCHODIŠŤ KONSTRUKCE
  { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'beton', unit: 'M3' },
  { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'bednění', unit: 'm2' },

  // Part: PODKLADNÍ VRSTVY C12/15
  { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'beton', unit: 'M3' },
  { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'bednění', unit: 'm2' },

  // Part: PODKLADNÍ VRSTVY C20/25
  { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'beton', unit: 'M3' },
  { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'bednění', unit: 'm2' },

  // Part: PATKY
  { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'beton', unit: 'M3' },
  { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'bednění', unit: 'm2' }
];

export default {
  OBJECT_TYPE_IDS,
  BRIDGE_TEMPLATES,
  BUILDING_TEMPLATES,
  PARKING_TEMPLATES,
  ROAD_TEMPLATES,
  CUSTOM_TEMPLATES,
  TEMPLATE_PARTS_BY_OBJECT_TYPE,
  getTemplatesForType,
  templatesToDatabaseFormat,
  getAllTemplates,
  getTemplateSummary,
  BRIDGE_TEMPLATE_POSITIONS
};
