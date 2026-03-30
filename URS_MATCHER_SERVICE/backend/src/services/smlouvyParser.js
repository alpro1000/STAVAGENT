/**
 * Smlouvy PlainTextContent Parser
 *
 * Extracts structured BOQ data (positions, codes, MJ, quantities)
 * from PlainTextContent of Hlídač státu přílohy.
 *
 * Supports formats: KRYCÍ LIST, CS ÚRS, Export Komplet, RTSROZP, OTSKP
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Code patterns
// ============================================================================

/**
 * Normalize a potential 9-digit ÚRS code (remove spaces/dashes).
 * Returns null if not valid.
 */
function normalizeUrsCode(raw) {
  const clean = raw.replace(/[\s\-\.]/g, '');
  // Must be 6-9 digits, first digit 1-9
  if (/^[1-9]\d{5,8}$/.test(clean)) return clean;
  return null;
}

// Measurement units — Czech construction standard
const MJ_SET = new Set([
  'm', 'm2', 'm3', 'km', 'bm', 'mp',
  'ks', 'kus', 'pár',
  'kg', 't',
  'l', 'hl',
  'hod', 'den', 'směna',
  'soubor', 'kpl', 'komplet', 'sada',
  'kmd', // km dopravní
]);

const MJ_NORMALIZE = {
  'm²': 'm2', 'm³': 'm3',
  'kus': 'ks', 'pár': 'ks',
  'komplet': 'kpl', 'sada': 'kpl',
  'směna': 'hod',
};

function normalizeMJ(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim()
    .replace('²', '2').replace('³', '3');
  return MJ_NORMALIZE[lower] || (MJ_SET.has(lower) ? lower : null);
}

// ============================================================================
// Work type classification (30+ categories)
// ============================================================================

const WORK_TYPE_RULES = [
  { pattern: /beton[áůo]|betonáž|beton\b/i, type: 'BETON' },
  { pattern: /výztuž|armatur|ocel.*beton/i, type: 'VYZTUŽ' },
  { pattern: /bedněn/i, type: 'BEDNĚNÍ' },
  { pattern: /zatepl|etics|kzs|kontaktní.*systém/i, type: 'ZATEPLENÍ' },
  { pattern: /omít/i, type: 'OMÍTKY' },
  { pattern: /izolac|hydroizolac|asfalt.*pás/i, type: 'IZOLACE' },
  { pattern: /bourán|demontáž|demolice/i, type: 'BOURÁNÍ' },
  { pattern: /lešen/i, type: 'LEŠENÍ' },
  { pattern: /přesun\s*hmot/i, type: 'PŘESUNY' },
  { pattern: /výkop|hlouben|zemní/i, type: 'ZEMNÍ_PRÁCE' },
  { pattern: /pilot|mikropilot/i, type: 'PILOTY' },
  { pattern: /základ[yů]|základov/i, type: 'ZÁKLADY' },
  { pattern: /zdiv[oa]|zdění|příčk/i, type: 'ZDĚNÍ' },
  { pattern: /sádrokart|suché\s*výstav|sdk/i, type: 'SDK' },
  { pattern: /obklad|dlažb/i, type: 'OBKLADY' },
  { pattern: /malb[ya]|nátěr/i, type: 'MALBY_NÁTĚRY' },
  { pattern: /klempíř|oplech|žlab/i, type: 'KLEMPÍŘSKÉ' },
  { pattern: /zámečn|ocel.*konstr/i, type: 'ZÁMEČNICKÉ' },
  { pattern: /truhlář|okn[oa]|dveř/i, type: 'TRUHLÁŘSKÉ' },
  { pattern: /elektro|kabel|rozvad/i, type: 'ELEKTRO' },
  { pattern: /vodovod|kanalizac|zti/i, type: 'ZTI' },
  { pattern: /vzduchotech|vzt|vzduchotechnick/i, type: 'VZT' },
  { pattern: /vytápěn|kotel|radiát/i, type: 'ÚT' },
  { pattern: /odvoz|skládkovné|suť/i, type: 'LIKVIDACE' },
  { pattern: /střech|krytina|krov/i, type: 'STŘECHA' },
  { pattern: /podlah|nivelac/i, type: 'PODLAHY' },
  { pattern: /komunikac|chodník|obrub|vozovk/i, type: 'KOMUNIKACE' },
  { pattern: /trubní|potrubí|šacht/i, type: 'TRUBNÍ_VEDENÍ' },
  { pattern: /montáž|osaz/i, type: 'MONTÁŽ' },
];

function classifyWorkType(text) {
  if (!text) return null;
  for (const { pattern, type } of WORK_TYPE_RULES) {
    if (pattern.test(text)) return type;
  }
  return null;
}

// ============================================================================
// Code system detection
// ============================================================================

function detectCodeSystem(code) {
  if (!code) return { system: 'unknown', confidence: 0 };

  const clean = code.replace(/[\s\-\.]/g, '');

  // R-codes (custom/company-specific)
  if (/^R\d{0,2}-?\d{2,6}$/i.test(clean)) {
    return { system: 'R', confidence: 0.95 };
  }

  // 9-digit ÚRS
  if (/^[1-9]\d{8}$/.test(clean)) {
    return { system: 'URS', confidence: 0.95 };
  }

  // 6-digit OTSKP — check first digit range
  if (/^[1-9]\d{5}$/.test(clean)) {
    return { system: 'OTSKP', confidence: 0.85 };
  }

  // 7-digit RTS
  if (/^[1-9]\d{6}$/.test(clean)) {
    return { system: 'RTS', confidence: 0.80 };
  }

  return { system: 'unknown', confidence: 0.3 };
}

// ============================================================================
// Main parser: PlainTextContent → structured positions
// ============================================================================

/**
 * Parse PlainTextContent from a Hlídač státu příloha.
 *
 * @param {string} text - Raw PlainTextContent
 * @returns {ParseResult|null}
 *
 * @typedef {Object} ParseResult
 * @property {Position[]} positions
 * @property {Section[]} sections - díly/sections found
 * @property {FormatInfo} format
 * @property {ParseStats} stats
 */
export function parsePlainTextContent(text) {
  if (!text || text.length < 50) return null;

  const result = {
    positions: [],
    sections: [],
    format: detectFormat(text),
    stats: {
      total_lines: 0,
      parsed_lines: 0,
      skipped_lines: 0,
      codes_by_system: {},
    },
  };

  const lines = text.split('\n');
  result.stats.total_lines = lines.length;

  // Extract section headers (Díl: X - Name)
  extractSections(text, result);

  // Parse line by line
  let currentSection = null;
  let currentSectionName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue;

    // Check for section header
    const sectionMatch = line.match(/^(?:Díl|Oddíl|HSV|PSV)[\s:]*(\d{1,3})\s*[-–—]\s*(.+)$/i);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentSectionName = sectionMatch[2].trim();
      continue;
    }

    // Try to parse as position line
    const position = parsePositionLine(line, i + 1);
    if (position) {
      position.section_code = currentSection;
      position.section_name = currentSectionName;
      result.positions.push(position);
      result.stats.parsed_lines++;

      // Track code systems
      const sys = position.code_system || 'unknown';
      result.stats.codes_by_system[sys] = (result.stats.codes_by_system[sys] || 0) + 1;
    } else {
      result.stats.skipped_lines++;
    }
  }

  // Deduplicate positions by code (keep first occurrence, sum quantities)
  deduplicatePositions(result);

  return result;
}

// ============================================================================
// Format detection
// ============================================================================

function detectFormat(text) {
  const hints = [];
  let primary = 'unknown';

  if (/KRYCÍ\s*LIST/i.test(text)) hints.push('KRYCÍ LIST');
  if (/CS\s*ÚRS/i.test(text)) { hints.push('CS ÚRS'); primary = 'CS_URS'; }
  if (/Export\s*Komplet/i.test(text)) { hints.push('Export Komplet'); primary = 'KOMPLET'; }
  if (/#RTSROZP#/i.test(text)) { hints.push('RTSROZP'); primary = 'RTSROZP'; }
  if (/OTSKP/i.test(text)) { hints.push('OTSKP'); primary = 'OTSKP'; }
  if (/Cenová\s*soustava/i.test(text)) hints.push('cenová soustava');
  if (/Rekapitulace/i.test(text)) hints.push('rekapitulace');
  if (/Výkaz\s*výměr/i.test(text)) hints.push('výkaz výměr');

  // Detect if likely structured (tab-separated or fixed-width)
  const tabLines = text.split('\n').filter(l => l.includes('\t')).length;
  const totalLines = text.split('\n').length;
  const isTabular = tabLines > totalLines * 0.2;

  return {
    primary,
    hints,
    isTabular,
    textLength: text.length,
    lineCount: totalLines,
  };
}

// ============================================================================
// Section extraction
// ============================================================================

function extractSections(text, result) {
  const regex = /^(?:Díl|Oddíl)[\s:]*(\d{1,3})\s*[-–—]\s*(.+)$/gmi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    result.sections.push({
      number: match[1],
      name: match[2].trim(),
    });
  }
}

// ============================================================================
// Position line parsing (multiple format strategies)
// ============================================================================

/**
 * Try to parse a single line as a BOQ position.
 * Returns null if line doesn't match any known pattern.
 */
function parsePositionLine(line, lineNo) {
  // Strategy 1: Tab-separated fields
  const tabResult = parseTabSeparated(line);
  if (tabResult) return { ...tabResult, lineNo, parseMethod: 'tab' };

  // Strategy 2: Code + description + MJ + quantity (space-separated)
  const spaceResult = parseSpaceSeparated(line);
  if (spaceResult) return { ...spaceResult, lineNo, parseMethod: 'space' };

  // Strategy 3: Code at start, rest is description (no quantity)
  const codeOnlyResult = parseCodeOnly(line);
  if (codeOnlyResult) return { ...codeOnlyResult, lineNo, parseMethod: 'code_only' };

  return null;
}

/**
 * Parse tab-separated line: code\tdesc\tMJ\tqty[\tprice]
 */
function parseTabSeparated(line) {
  const parts = line.split('\t').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  // First part should be a code
  const code = normalizeUrsCode(parts[0]);
  if (!code) return null;

  const { system, confidence } = detectCodeSystem(code);
  const description = parts[1] || '';
  const mj = parts.length >= 3 ? normalizeMJ(parts[2]) : null;

  let quantity = null;
  if (parts.length >= 4) {
    const qStr = parts[3].replace(/\s/g, '').replace(',', '.');
    const q = parseFloat(qStr);
    if (!isNaN(q)) quantity = q;
  }

  let unitPrice = null;
  if (parts.length >= 5) {
    const pStr = parts[4].replace(/\s/g, '').replace(',', '.');
    const p = parseFloat(pStr);
    if (!isNaN(p)) unitPrice = p;
  }

  return {
    code_raw: parts[0],
    code: code,
    code_system: system,
    code_confidence: confidence,
    description: description.substring(0, 500),
    mj,
    quantity,
    unit_price: unitPrice,
    work_type: classifyWorkType(description),
  };
}

/**
 * Parse space-separated line.
 * Pattern: 631311124 Beton základových desek C 25/30  m3  45.000
 */
function parseSpaceSeparated(line) {
  // Match: code(6-9 digits or R-code) followed by text, then MJ, then number
  const match = line.match(
    /^((?:R\d{0,2}-?\d{2,6})|(?:\d{3}\s?\d{3}\s?\d{0,3}))\s+(.+?)\s+(m[²³23]?|ks|kg|t|km|kus|hod|soubor|kpl|bm|mp|l|den)\s+([\d\s,.]+)\s*(?:([\d\s,.]+)\s*)?$/i
  );
  if (!match) return null;

  const rawCode = match[1];
  const code = normalizeUrsCode(rawCode);
  if (!code) return null;

  const { system, confidence } = detectCodeSystem(code);
  const mj = normalizeMJ(match[3]);
  const qStr = match[4].replace(/\s/g, '').replace(',', '.');
  const quantity = parseFloat(qStr);

  let unitPrice = null;
  if (match[5]) {
    const pStr = match[5].replace(/\s/g, '').replace(',', '.');
    const p = parseFloat(pStr);
    if (!isNaN(p)) unitPrice = p;
  }

  return {
    code_raw: rawCode,
    code,
    code_system: system,
    code_confidence: confidence,
    description: match[2].trim().substring(0, 500),
    mj,
    quantity: isNaN(quantity) ? null : quantity,
    unit_price: unitPrice,
    work_type: classifyWorkType(match[2]),
  };
}

/**
 * Parse line with just a code at the start and a description.
 */
function parseCodeOnly(line) {
  const match = line.match(/^((?:\d{6,9})|(?:R\d{0,2}-?\d{2,6}))\s+(.{10,})$/i);
  if (!match) return null;

  const code = normalizeUrsCode(match[1]);
  if (!code) return null;

  const { system, confidence } = detectCodeSystem(code);

  return {
    code_raw: match[1],
    code,
    code_system: system,
    code_confidence: confidence,
    description: match[2].trim().substring(0, 500),
    mj: null,
    quantity: null,
    unit_price: null,
    work_type: classifyWorkType(match[2]),
  };
}

// ============================================================================
// Deduplication
// ============================================================================

function deduplicatePositions(result) {
  const seen = new Map(); // code → index in positions array
  const deduped = [];

  for (const pos of result.positions) {
    const key = pos.code;
    if (seen.has(key)) {
      // Merge: sum quantities, keep richer description
      const existing = deduped[seen.get(key)];
      if (pos.quantity != null && existing.quantity != null) {
        existing.quantity += pos.quantity;
      } else if (pos.quantity != null) {
        existing.quantity = pos.quantity;
      }
      if (!existing.mj && pos.mj) existing.mj = pos.mj;
      if (!existing.work_type && pos.work_type) existing.work_type = pos.work_type;
      if (pos.description.length > existing.description.length) {
        existing.description = pos.description;
      }
    } else {
      seen.set(key, deduped.length);
      deduped.push({ ...pos });
    }
  }

  result.positions = deduped;
}

// ============================================================================
// Batch: Parse all přílohy of a smlouva
// ============================================================================

/**
 * Parse all přílohy of a smlouva object from Hlídač státu API.
 *
 * @param {Object} smlouva - Full smlouva object from API
 * @returns {SmlouvaParseResult}
 */
export function parseSmlouva(smlouva) {
  const prilohy = smlouva.prilohy || smlouva.Prilohy || [];
  const id = smlouva.Id || smlouva.id || 'unknown';
  const predmet = smlouva.predmet || smlouva.Predmet || '';
  const hodnota = smlouva.hodnotaBezDph || smlouva.HodnotaBezDph || null;
  const datum = smlouva.datumUzavreni || smlouva.DatumUzavreni || null;

  const parsed = {
    smlouva_id: id,
    predmet: predmet.substring(0, 500),
    hodnota_czk: hodnota,
    datum: datum,
    prilohy_count: prilohy.length,
    prilohy_with_text: 0,
    prilohy_parsed: 0,
    all_positions: [],
    all_sections: [],
    format_hints: new Set(),
    total_codes: 0,
    codes_by_system: {},
  };

  for (const p of prilohy) {
    const ptc = p.plainTextContent || p.PlainTextContent || '';
    const name = p.nazevSouboru || p.NazevSouboru || 'unnamed';

    if (ptc.length < 50) continue;
    parsed.prilohy_with_text++;

    const result = parsePlainTextContent(ptc);
    if (!result) continue;

    parsed.prilohy_parsed++;

    // Merge positions
    for (const pos of result.positions) {
      pos.source_file = name;
      parsed.all_positions.push(pos);
    }

    // Merge sections
    for (const sec of result.sections) {
      if (!parsed.all_sections.find(s => s.number === sec.number)) {
        parsed.all_sections.push(sec);
      }
    }

    // Merge format hints
    for (const h of result.format.hints) {
      parsed.format_hints.add(h);
    }

    // Merge code stats
    for (const [sys, count] of Object.entries(result.stats.codes_by_system)) {
      parsed.codes_by_system[sys] = (parsed.codes_by_system[sys] || 0) + count;
    }
  }

  parsed.total_codes = parsed.all_positions.length;
  parsed.format_hints = [...parsed.format_hints];

  return parsed;
}

// ============================================================================
// Exports
// ============================================================================

export { classifyWorkType, detectCodeSystem, normalizeMJ, normalizeUrsCode };
