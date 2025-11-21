/**
 * Concrete Work Extractor
 * Automatically extracts concrete-related positions from Excel data
 */

import { logger } from '../utils/logger.js';

/**
 * Extract concrete positions from raw Excel rows for a specific bridge
 * @param {Array} rawRows - All rows from Excel file
 * @param {string} bridgeId - Bridge ID (e.g., "SO 241") or "SO_AUTO" to auto-detect
 * @returns {Array} Array of position objects
 */
export function extractConcretePositions(rawRows, bridgeId) {
  // 🔴 FIX: Check if rawRows is valid array
  if (!Array.isArray(rawRows)) {
    logger.warn(`[ConcreteExtractor] Invalid input: rawRows is not an array`);
    return [];
  }

  if (rawRows.length === 0) {
    logger.warn(`[ConcreteExtractor] rawRows is empty`);
    return [];
  }

  const positions = [];
  let normalizedBridgeId = normalizeBridgeCode(bridgeId);
  let foundBridge = false;
  let bridgeRows = [];

  // AUTO-DETECT mode: If bridgeId is SO_AUTO, extract ALL concrete items without filtering by bridge
  const autoDetectMode = bridgeId === 'SO_AUTO' || bridgeId === 'SO_AUTO';

  if (autoDetectMode) {
    logger.info(`[ConcreteExtractor] 🔍 AUTO-DETECT mode: extracting all concrete items without bridge filtering`);
    // In auto-detect mode, process ALL rows as concrete data
    for (const row of rawRows) {
      const hasData = Object.values(row).some(val => val !== null && val !== '');
      if (hasData) {
        bridgeRows.push(row);
      }
    }
  } else {
    // SPECIFIC-BRIDGE mode: Filter by bridge ID
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
  }

  const bridgeLabel = autoDetectMode ? 'auto-detected' : bridgeId;
  logger.info(`[ConcreteExtractor] Found ${bridgeRows.length} data rows for bridge ${bridgeLabel}`);

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

  const text = popis.toLowerCase();
  const unit = (mj || '').toLowerCase();

  const concreteKeywords = [
    // Basic concrete types
    'beton', 'betón', 'betonová', 'betonové',
    'žb', 'žb konstrukce', 'železobetonová', 'železobetonové',
    'monolitická', 'monolitické', 'monolitická deska',

    // Formwork
    'bednění', 'bedná', 'bedna', 'bedny',
    'desková', 'deskové', 'deska',

    // Reinforcement
    'výztuž', 'výztužení', 'ocel', 'ocelová', 'ocelové',
    'drát', 'síť', 'trubka',

    // Foundations
    'základy', 'základu', 'základní', 'základem',
    'základ', 'pase',

    // Piles and pillars
    'piloty', 'pilíř', 'pilota', 'pilíře',
    'sloupek', 'sloupky',

    // Abutments and retaining walls
    'opěr', 'opěry', 'křídla', 'křídlo',
    'zídka',

    // Beams and ribs
    'rimsy', 'románsy', 'rimsa',
    'nosníky', 'nosn', 'nosník', 'nosník',
    'průvlak',

    // Drainage and waterproofing
    'drenáž', 'drénáž', 'drén',
    'izolace', 'izoláci', 'izolací',
    'těsnění',

    // Other concrete work
    'vrty', 'vrt',
    'schod', 'stupně', 'schodiště',
    'podklad', 'podkladní', 'podkladu',
    'podpěra', 'podpěry',
    'most', 'mostní', 'mostovka',
    'koruna', 'korunu',
    'pražec', 'pražce',
    'opoždění',
    'stojina', 'stěna', 'stěny'
  ];

  const hasConcreteText = concreteKeywords.some(keyword => text.includes(keyword));
  const concreteUnits = ['m3', 'm³', 'm 3', 'm2', 'm²', 'm 2', 't', 'kg'];
  const hasConcreteUnit = concreteUnits.some(u => unit.includes(u));

  const isPrefab = text.includes('prefa') || text.includes('díl') || text.includes('prefab');

  return (hasConcreteText || hasConcreteUnit) && !isPrefab;
}

/**
 * Determine work subtype
 */
function determineSubtype(popis, mj) {
  const text = (popis || '').toLowerCase();
  const unit = (mj || '').toLowerCase();

  if (unit === 'm3' || unit === 'm³' || unit === 'm 3') {
    return 'beton';
  }
  if (unit === 'm2' || unit === 'm²' || unit === 'm 2') {
    return 'bednění';
  }
  if (unit === 't' || unit === 'kg') {
    return 'výztuž';
  }

  if (text.includes('výztuž') || text.includes('ocel')) {
    return 'výztuž';
  }
  if (text.includes('bedn')) {
    return 'bednění';
  }

  return 'beton';
}

/**
 * Extract part name from description
 */
function extractPartName(popis) {
  if (!popis) return 'Neznámá část';
  const parts = popis.split('-');
  const partName = parts[0].trim();
  return partName.length > 0 ? partName : 'Neznámá část';
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
