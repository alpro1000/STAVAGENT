/**
 * Concrete Work Extractor
 * Automatically extracts concrete-related positions from Excel data
 */

import { logger } from '../utils/logger.js';

const PART_KEYWORDS = [
  { name: 'ZÁKLADY', keywords: ['zaklad'] },
  { name: 'ŘÍMSY', keywords: ['rimsy', 'rims'] },
  { name: 'MOSTNÍ OPĚRY A KŘÍDLA', keywords: ['opery', 'kridl'] },
  { name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', keywords: ['c40/50', 'c4050'] },
  { name: 'MOSTNÍ PILÍŘE A STATIVA', keywords: ['pilir', 'stativ'] },
  { name: 'PŘECHODOVÉ DESKY', keywords: ['prechodov'] },
  { name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', keywords: ['nosn', 'deskov', 'monolitick', 'monoliticka deska'] },
  { name: 'SCHODIŠŤ KONSTRUKCE', keywords: ['schod', 'schodist'] },
  { name: 'PODKLADNÍ VRSTVY', keywords: ['podkladn', 'vyplnov'] },
  { name: 'PATKY', keywords: ['patk'] }
];

/**
 * Extract concrete positions from raw Excel rows for a specific bridge
 * @param {Array} rawRows - All rows from Excel file
 * @param {string} bridgeId - Bridge ID (e.g., "SO 241")
 * @returns {Array} Array of position objects
 */
export function extractConcretePositions(rawRows, bridgeId) {
  const positions = [];
  const normalizedBridgeId = normalizeBridgeCode(bridgeId);
  let foundBridge = false;
  let bridgeRows = [];

  // Find all rows belonging to this bridge
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowText = Object.values(row).join(' ');
    const soMatch = rowText.match(/SO\s*\d+/i);

    if (soMatch && normalizeBridgeCode(soMatch[0]) === normalizedBridgeId) {
      foundBridge = true;
      bridgeRows = [];
      continue;
    }

    if (foundBridge) {
      // Stop when hitting another bridge
      const hasAnotherSO = Object.values(row).some(val => {
        if (val && typeof val === 'string') {
          const match = val.match(/SO\s*\d+/i);
          if (match && normalizeBridgeCode(match[0]) !== normalizedBridgeId) {
            return true;
          }
        }
        return false;
      });

      if (hasAnotherSO) break;

      const hasData = Object.values(row).some(val => val !== null && val !== '');
      if (hasData) bridgeRows.push(row);
    }
  }

  logger.info(`[ConcreteExtractor] Found ${bridgeRows.length} data rows for bridge ${bridgeId}`);

  // Process each row to extract concrete-related positions
  for (const row of bridgeRows) {
    try {
      const position = parseConcreteRow(row);
      if (position) {
        positions.push(position);
        logger.info(`[ConcreteExtractor] Extracted: ${position.item_name} (${position.qty} ${position.unit})`);
      }
    } catch (error) {
      logger.error('[ConcreteExtractor] Error parsing row:', error.message);
    }
  }

  return positions;
}

/**
 * Parse a single row and return a position object if it's concrete-related
 * Expected columns: PČ | Typ | Kód | Popis | MJ | Množství | J.cena | Cena celkem | Cenová soustava
 */
function parseConcreteRow(row) {
  const kod = getColumnValue(row, ['Kód', 'kod', 'Code']);
  const popis = getColumnValue(row, ['Popis', 'popis', 'Description', 'Item']);
  const mj = getColumnValue(row, ['MJ', 'mj', 'Unit', 'Jednotka']);
  const mnozstvi = getColumnValue(row, ['Množství', 'Mnozstvi', 'mnozstvi', 'Quantity', 'Qty']);

  if (!popis || !mnozstvi) {
    return null;
  }

  const qty = parseNumber(mnozstvi);
  if (qty === 0) {
    return null;
  }

  // Check if row is concrete-related
  const isConcreteRelated = isConcreteWork(popis, mj);
  if (!isConcreteRelated) {
    return null;
  }

  // Extract OTSKP code (5-6 digits)
  let otskpCode = null;
  if (kod) {
    const match = String(kod).match(/\d{5,6}/);
    if (match) {
      otskpCode = match[0];
    }
  }

  // Determine work subtype
  const subtype = determineSubtype(popis, mj);

  const position = {
    part_name: extractPartName(popis),
    item_name: popis.trim(),
    subtype: subtype,
    unit: mj ? mj.trim() : (subtype === 'beton' ? 'M3' : 'm2'),
    qty: qty,
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: 0,
    otskp_code: otskpCode
  };

  return position;
}

/**
 * Check if a work description is concrete-related
 */
function isConcreteWork(popis, mj) {
  if (!popis) return false;

  const normalizedText = normalizeText(popis);
  const normalizedUnit = normalizeText(mj || '');
  const compactUnit = normalizedUnit.replace(/\s+/g, '');

  const concreteKeywords = [
    'beton', 'betonaz', 'zelezobeton', 'zb', 'zlb', 'armobeton',
    'monolit', 'monolitick', 'konstrukc', 'nosn', 'nosnik', 'deska',
    'most', 'mostni', 'opery', 'kridl', 'pilir', 'pilota', 'stativ',
    'patk', 'zaver', 'zaverne', 'deskov', 'rimsy', 'schod', 'podkladn', 'vyplnov'
  ];
  const mixDesignKeywords = ['c20/25', 'c25/30', 'c30/37', 'c35/45', 'c40/50', 'c45/55', 'c50/60'];
  const reinforcementKeywords = ['vyztuz', 'ocel', 'armat', 'kari'];

  const hasConcreteText =
    containsAny(normalizedText, concreteKeywords) ||
    containsAny(normalizedText, mixDesignKeywords) ||
    containsAny(normalizedText, reinforcementKeywords);

  const concreteUnits = ['m3', 'm^3', 'm2', 'm^2', 't', 'kg'];
  const hasConcreteUnit = concreteUnits.some(unit => compactUnit.includes(unit.replace('^', '')));

  const isPrefab = containsAny(normalizedText, ['prefa', 'prefabrik', 'prefabrikat']);

  return (hasConcreteText || hasConcreteUnit) && !isPrefab;
}

/**
 * Determine work subtype
 */
function determineSubtype(popis, mj) {
  const normalizedText = normalizeText(popis || '');
  const normalizedUnit = normalizeText(mj || '');
  const compactUnit = normalizedUnit.replace(/\s+/g, '');

  if (['m3', 'm^3'].includes(compactUnit)) {
    return 'beton';
  }
  if (['m2', 'm^2'].includes(compactUnit)) {
    return 'bednění';
  }
  if (compactUnit === 't' || compactUnit === 'kg') {
    return 'výztuž';
  }

  if (containsAny(normalizedText, ['vyztuz', 'ocel', 'armat', 'kari'])) {
    return 'výztuž';
  }
  if (containsAny(normalizedText, ['bedn'])) {
    return 'bednění';
  }

  return 'beton';
}

/**
 * Extract part name from description
 */
function extractPartName(popis) {
  if (!popis) return 'Neznámá část';
  const normalized = normalizeText(popis);

  for (const part of PART_KEYWORDS) {
    if (containsAny(normalized, part.keywords)) {
      return part.name;
    }
  }

  const segments = popis.split(/[-–—:]/);
  const candidate = segments[0]?.trim();
  return candidate && candidate.length > 0 ? candidate : 'Neznámá část';
}

function normalizeText(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function containsAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * Get column value by trying multiple possible names
 */
function getColumnValue(row, possibleNames) {
  const keys = Object.keys(row);

  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }

    const key = keys.find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (key && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }

  return null;
}

/**
 * Parse number from string
 */
function parseNumber(value) {
  if (!value) return 0;
  const str = String(value).trim();
  if (str === '') return 0;
  const normalized = str.replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize bridge code
 */
function normalizeBridgeCode(code) {
  return code.trim().replace(/\s+/g, ' ').toUpperCase();
}

export { parseNumber };
