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
 * Extract ONLY concrete items (m3) from sheet data
 * This is the PRIMARY extraction method for multi-sheet import
 *
 * Looks for:
 * - Unit = m3, m³, M3
 * - Keywords: beton, betonová, C30/37, etc.
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

  logger.info(`[ConcreteExtractor] extractConcreteOnlyM3: Processing ${rawRows.length} rows`);

  // First, detect column structure
  const columnMap = detectConcreteColumns(rawRows);
  logger.info(`[ConcreteExtractor] Detected columns: ${JSON.stringify(columnMap)}`);

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    try {
      // Get values using detected columns or fallback to search
      let popis = getColumnValueSmart(row, columnMap.popis) ||
                  getColumnValue(row, ['Popis', 'popis', 'Description', 'Název', 'Item', 'Text']);
      let mj = getColumnValueSmart(row, columnMap.mj) ||
               getColumnValue(row, ['MJ', 'mj', 'Unit', 'Jednotka', 'j.']);
      let mnozstvi = getColumnValueSmart(row, columnMap.mnozstvi) ||
                     getColumnValue(row, ['Množství', 'Mnozstvi', 'mnozstvi', 'Quantity', 'Qty', 'Počet', 'Celkem']);

      if (!popis || !mj) continue;

      const unit = String(mj).trim().toLowerCase();
      const description = String(popis).trim();

      // STRICT: Only M3 units (concrete volume)
      const isM3Unit = unit === 'm3' || unit === 'm³' || unit === 'm 3' || unit === 'm³';
      if (!isM3Unit) continue;

      // Parse quantity
      const qty = parseNumber(mnozstvi);
      if (qty <= 0) continue;

      // Check if description looks like concrete work
      const isConcreteDescription = isConcreteText(description);
      if (!isConcreteDescription) {
        // Log skipped m3 items for debugging
        logger.debug(`[ConcreteExtractor] Skipping non-concrete m3 item: "${description.substring(0, 50)}"`);
        continue;
      }

      // Extract concrete grade (C30/37, C25/30, etc.)
      let concreteGrade = null;
      const gradeMatch = description.match(/C\s*(\d{2})\/(\d{2})/i);
      if (gradeMatch) {
        concreteGrade = `C${gradeMatch[1]}/${gradeMatch[2]}`;
      }

      // Create position
      const position = {
        part_name: concreteGrade ? `Beton ${concreteGrade}` : extractPartName(description),
        item_name: description,
        subtype: 'beton',
        unit: 'M3',
        qty: qty,
        concrete_m3: qty,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 0,
        concrete_grade: concreteGrade,
        source: 'SHEET_CONCRETE_EXTRACTOR'
      };

      concreteItems.push(position);
      totalConcreteVolume += qty;

      logger.info(`[ConcreteExtractor] ✅ Found concrete: "${description.substring(0, 40)}..." = ${qty} m³ ${concreteGrade || ''}`);

    } catch (error) {
      logger.debug(`[ConcreteExtractor] Error processing row ${i}: ${error.message}`);
    }
  }

  logger.info(`[ConcreteExtractor] extractConcreteOnlyM3: Found ${concreteItems.length} concrete items, total ${totalConcreteVolume.toFixed(2)} m³`);

  return concreteItems;
}

/**
 * Check if text description is concrete-related
 */
function isConcreteText(text) {
  if (!text) return false;

  const lower = text.toLowerCase();

  // Concrete keywords (Czech)
  const concreteKeywords = [
    'beton', 'betón', 'betonová', 'betonové', 'betonový',
    'železobeton', 'žb ', 'žb-', 'železobetonová', 'železobetonové',
    'monolitick', 'monolitická', 'monolitické',
    'c25', 'c30', 'c35', 'c40', 'c45', 'c50',  // Concrete grades
    'xc1', 'xc2', 'xc3', 'xc4', 'xf1', 'xf2', 'xf3', 'xf4', // Exposure classes
    'základová', 'základové', 'základ',
    'pilota', 'piloty', 'pilíř', 'pilíře',
    'deska', 'deskový', 'desková',
    'nosná', 'nosné', 'nosník', 'trám', 'trámu',
    'opěra', 'opěry', 'křídlo', 'křídla',
    'rims', 'římsa', 'rimsy',
    'most', 'mostu', 'mostní', 'mostovka'
  ];

  // Check for any concrete keyword
  for (const keyword of concreteKeywords) {
    if (lower.includes(keyword)) {
      return true;
    }
  }

  // Check for concrete grade pattern
  if (/c\s*\d{2}\/\d{2}/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Detect column positions from first few rows
 */
function detectConcreteColumns(rows) {
  const columnMap = {
    popis: null,
    mj: null,
    mnozstvi: null
  };

  // Look at first 10 rows for header-like patterns
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    const keys = Object.keys(row);

    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      const value = row[key];
      const lowerValue = value ? String(value).toLowerCase() : '';

      // Detect description column
      if (lowerKey.includes('popis') || lowerKey.includes('nazev') ||
          lowerKey.includes('description') || lowerKey.includes('item') ||
          lowerValue === 'popis' || lowerValue === 'název') {
        columnMap.popis = key;
      }

      // Detect unit column
      if (lowerKey.includes('mj') || lowerKey === 'mj' ||
          lowerKey.includes('jednotka') || lowerKey.includes('unit') ||
          lowerValue === 'mj' || lowerValue === 'jednotka') {
        columnMap.mj = key;
      }

      // Detect quantity column
      if (lowerKey.includes('množství') || lowerKey.includes('mnozstvi') ||
          lowerKey.includes('quantity') || lowerKey.includes('qty') ||
          lowerKey.includes('celkem') || lowerKey.includes('počet') ||
          lowerValue === 'množství' || lowerValue === 'počet') {
        columnMap.mnozstvi = key;
      }
    }
  }

  return columnMap;
}

/**
 * Get column value using smart detection
 */
function getColumnValueSmart(row, columnKey) {
  if (!columnKey || !row) return null;
  return row[columnKey] !== undefined && row[columnKey] !== null && row[columnKey] !== ''
    ? row[columnKey]
    : null;
}

export { parseNumber };
