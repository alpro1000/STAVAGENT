/**
 * Bridge Template Positions
 * Default positions for new bridges (11 standard construction parts)
 * Extracted to avoid duplication across multiple routes
 */

export const BRIDGE_TEMPLATE_POSITIONS = [
  // 1. ZÁKLADY ZE ŽELEZOBETONU DO C30/37
  { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'beton', unit: 'M3' },
  { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'bednění', unit: 'm2' },

  // 2. RÖMSY ZE ŽELEZOBETONU DO C30/37 (B37)
  { part_name: 'RÖMSY', item_name: 'RÖMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
  { part_name: 'RÖMSY', item_name: 'RÖMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

  // 3. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (opěry)', unit: 'm2' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (křídla)', unit: 'm2' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (závěrné zídky)', unit: 'm2' },

  // 4. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'bednění', unit: 'm2' },

  // 5. MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)
  { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

  // 6. PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30
  { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'beton', unit: 'M3' },
  { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'bednění', unit: 'm2' },

  // 7. MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37
  { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'beton', unit: 'M3' },
  { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'bednění', unit: 'm2' },

  // 8. SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25
  { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'beton', unit: 'M3' },
  { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'bednění', unit: 'm2' },

  // 9. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15
  { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'beton', unit: 'M3' },
  { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'bednění', unit: 'm2' },

  // 10. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25
  { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'beton', unit: 'M3' },
  { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'bednění', unit: 'm2' },

  // 11. PATKY Z PROSTÉHO BETONU C25/30
  { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'beton', unit: 'M3' },
  { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'bednění', unit: 'm2' }
];
