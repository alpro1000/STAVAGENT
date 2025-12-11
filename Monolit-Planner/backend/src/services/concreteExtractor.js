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
  const cena = getColumnValue(row, ['Cena', 'J.cena', 'Jednotková cena', 'Unit Price']);

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

  // Extract concrete mark (C30/37, C25/30, etc.)
  let concreteMark = null;
  const concreteMarkMatch = popis.match(/C\d{2}\/\d{2}/i);
  if (concreteMarkMatch) {
    concreteMark = concreteMarkMatch[0];
  }

  // Determine work subtype
  const subtype = determineSubtype(popis, mj);

  // Build part name - prefer concrete mark if found
  let partName = extractPartName(popis);
  if (concreteMark) {
    partName = `Beton ${concreteMark}`;
  }

  const position = {
    part_name: partName,
    item_name: popis.trim(),
    subtype: subtype,
    unit: mj ? mj.trim() : (subtype === 'beton' ? 'M3' : 'm2'),
    qty: qty,
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: 0,
    otskp_code: otskpCode,
    // Additional extracted fields
    concrete_mark: concreteMark,
    unit_price: cena ? parseNumber(cena) : null,
    source: 'LOCAL_EXTRACTOR'
  };

  // Log concrete mark if found
  if (concreteMark) {
    logger.info(`[ConcreteExtractor] 🎯 Found concrete mark: ${concreteMark} in "${popis.substring(0, 50)}"`);
  }

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
  if (!popis) return 'Beton';

  const text = String(popis).trim();

  // Split by common separators
  const parts = text.split(/[-–,;]/);
  if (parts.length > 0) {
    const firstPart = parts[0].trim();
    if (firstPart.length > 3 && firstPart.length < 50) {
      return firstPart;
    }
  }

  // Truncate if too long
  if (text.length > 50) {
    return text.substring(0, 47) + '...';
  }

  return text || 'Beton';
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

/**
 * Convert raw Excel rows to positions when column detection fails
 * This is a last-resort fallback to ensure we have minimum required fields
 */
export function convertRawRowsToPositions(rawRows) {
  logger.info(`[ConcreteExtractor] Converting ${rawRows.length} raw rows to positions (fallback mode)`);

  const positions = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const values = Object.values(row).filter(v => v !== null && v !== '' && v !== undefined);

    if (values.length === 0) continue; // Skip empty rows

    // Use first value as item_name (description)
    const item_name = String(values[0]).trim();
    if (item_name.length < 2) continue;

    // Try to find a numeric value for quantity
    let qty = 1;
    for (const val of values) {
      const num = parseNumber(val);
      if (num > 0) {
        qty = num;
        break;
      }
    }

    const position = {
      part_name: 'Položka',
      item_name: item_name,
      subtype: 'beton',
      unit: 'm3',
      qty: qty,
      crew_size: 4,
      wage_czk_ph: 398,
      shift_hours: 10,
      days: 0,
      otskp_code: null,
      source: 'FALLBACK_RAW_ROWS'
    };

    positions.push(position);
    logger.info(`[ConcreteExtractor] [FALLBACK] Row ${i}: "${item_name}" = ${qty} m3`);
  }

  logger.info(`[ConcreteExtractor] Created ${positions.length} positions from raw rows`);
  return positions;
}

/**
 * Extract ONLY concrete items by searching for concrete GRADE pattern
 * This is the SIMPLEST and most reliable method
 *
 * Searches for concrete grades in ANY cell:
 * - Ordinary concrete: C8/10, C12/15, C16/20, C20/25, C25/30, C30/37, C35/45...C100/115
 * - Lightweight concrete: LC8/9, LC12/13, LC16/18...LC80/88
 * - UHPC: C110, C120, C130...C170
 *
 * Pattern variations: C30/37, C 30/37, C30 / 37, c30/37
 *
 * @param {Array} rawRows - Raw rows from Excel sheet
 * @returns {Array} Array of concrete positions with volume
 */
export function extractConcreteOnlyM3(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    logger.warn(`[ConcreteExtractor] extractConcreteOnlyM3: Empty input`);
    return [];
  }

  const concreteItems = [];
  let totalConcreteVolume = 0;

  logger.info(`[ConcreteExtractor] 🔍 Searching for concrete grades in ${rawRows.length} rows...`);

  // Regex patterns for concrete grades (handles spaces between numbers)
  // Matches: C30/37, C 30/37, C30 / 37, c30/37, LC25/28, etc.
  const gradePatterns = [
    /[LC]?\s*C\s*(\d{1,3})\s*\/\s*(\d{1,3})/i,  // C30/37, LC25/28, C 30 / 37
    /[LC]?\s*C\s*(1[1-7]0)\b/i,                   // UHPC: C110, C120...C170
  ];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    try {
      // Search ALL cells in row for concrete grade
      let foundGrade = null;
      let descriptionCell = null;
      let descriptionKey = null;

      // Collect all values with their keys for analysis
      const entries = Object.entries(row);

      // Check each cell for concrete grade
      for (const [key, value] of entries) {
        if (value === null || value === undefined) continue;

        const cellText = String(value).trim();
        if (cellText.length < 5) continue; // Grade pattern needs at least 5 chars like "C8/10"

        // Try to match concrete grade
        for (const pattern of gradePatterns) {
          const match = cellText.match(pattern);
          if (match) {
            // Found concrete grade!
            if (match[2]) {
              // Standard grade: C30/37
              foundGrade = `C${match[1]}/${match[2]}`;
            } else {
              // UHPC: C110
              foundGrade = `C${match[1]}`;
            }
            descriptionCell = cellText;
            descriptionKey = key;
            break;
          }
        }
        if (foundGrade) break;
      }

      if (!foundGrade || !descriptionCell) continue;

      // IMPROVED QUANTITY DETECTION:
      // Strategy: Find M3 cell first, then look for number in same row
      let qty = 0;
      let foundM3Cell = false;
      let numbersInRow = [];

      for (const [key, value] of entries) {
        if (value === null || value === undefined) continue;
        if (key === descriptionKey) continue; // Skip description cell

        const cellStr = String(value).trim().toLowerCase();

        // Check if this is the M3 unit cell
        if (cellStr === 'm3' || cellStr === 'm³' || cellStr === 'm 3') {
          foundM3Cell = true;
          continue;
        }

        // Collect all numbers in the row
        const num = parseNumber(value);
        if (num > 0) {
          numbersInRow.push({ key, value, num });
        }
      }

      // If we found M3 cell, look for the quantity
      // Prefer numbers > 5 (to skip row numbers like 1,2,3,4)
      // and < 100000 (reasonable concrete volume)
      if (foundM3Cell && numbersInRow.length > 0) {
        // Sort by number size descending - larger numbers are more likely quantities
        numbersInRow.sort((a, b) => b.num - a.num);

        // Find the best candidate for quantity
        for (const item of numbersInRow) {
          // Skip very small numbers (likely row numbers or codes)
          if (item.num >= 0.1 && item.num <= 50000) {
            qty = item.num;
            break;
          }
        }
      }

      // Fallback: If no M3 cell found but we have numbers, take the largest reasonable one
      if (qty <= 0 && numbersInRow.length > 0) {
        numbersInRow.sort((a, b) => b.num - a.num);
        for (const item of numbersInRow) {
          if (item.num >= 1 && item.num <= 50000) {
            qty = item.num;
            break;
          }
        }
      }

      // Skip if no quantity found
      if (qty <= 0) {
        logger.debug(`[ConcreteExtractor] Found grade ${foundGrade} but no quantity in row ${i}`);
        continue;
      }

      // Create position
      const position = {
        part_name: `Beton ${foundGrade}`,
        item_name: descriptionCell,
        subtype: 'beton',
        unit: 'M3',
        qty: qty,
        concrete_m3: qty,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 0,
        concrete_grade: foundGrade,
        source: 'GRADE_SEARCH'
      };

      concreteItems.push(position);
      totalConcreteVolume += qty;

      logger.info(`[ConcreteExtractor] ✅ Found: ${foundGrade} | ${qty.toFixed(2)} m³ | "${descriptionCell.substring(0, 50)}..."`);

    } catch (error) {
      logger.debug(`[ConcreteExtractor] Error processing row ${i}: ${error.message}`);
    }
  }

  logger.info(`[ConcreteExtractor] 📊 Result: ${concreteItems.length} concrete items, total ${totalConcreteVolume.toFixed(2)} m³`);

  return concreteItems;
}

export { parseNumber };
