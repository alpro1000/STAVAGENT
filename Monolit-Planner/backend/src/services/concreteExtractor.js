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

      // FIXED QUANTITY DETECTION:
      // 1. First try to find "Množství" column specifically
      // 2. Look for M3 unit cell as hint - quantity should be in ADJACENT column
      // 3. Prefer reasonable volume values (not OTSKP codes or prices)
      let qty = 0;
      let foundM3Cell = false;
      let m3CellKey = null;
      let quantityColumnKey = null;
      let numbersInRow = [];

      // Get column order for position-based detection
      const columnKeys = entries.map(e => e[0]);

      // First pass: identify column types and collect numbers
      for (let colIdx = 0; colIdx < entries.length; colIdx++) {
        const [key, value] = entries[colIdx];
        if (value === null || value === undefined) continue;
        if (key === descriptionKey) continue; // Skip description cell

        const cellStr = String(value).trim().toLowerCase();
        const keyLower = key.toLowerCase();

        // Check if this is the quantity column by header name
        if (keyLower.includes('množství') || keyLower.includes('mnozstvi') ||
            keyLower.includes('qty') || keyLower.includes('quantity') ||
            keyLower.includes('objem') || keyLower.includes('počet')) {
          quantityColumnKey = key;
        }

        // Check if this is the M3 unit cell
        if (cellStr === 'm3' || cellStr === 'm³' || cellStr === 'm 3') {
          foundM3Cell = true;
          m3CellKey = key;
          continue;
        }

        // Collect numbers (excluding likely OTSKP codes)
        const num = parseNumber(value);
        if (num > 0) {
          // Check if this looks like an OTSKP code (5-6 digit integer)
          const isLikelyOTSKPCode = Number.isInteger(num) && num >= 10000 && num <= 999999;
          // Check if this looks like a price - must be large AND round
          // (more conservative check: only flag as price if > 500 AND divisible by 100)
          const isLikelyPrice = num >= 500 && num % 100 === 0;

          numbersInRow.push({
            key,
            value,
            num,
            colIdx,
            isLikelyOTSKPCode,
            isLikelyPrice,
            isQuantityColumn: key === quantityColumnKey
          });
        }
      }

      // Strategy 1: If we found the quantity column, use it
      if (quantityColumnKey) {
        const qtyEntry = numbersInRow.find(item => item.isQuantityColumn);
        if (qtyEntry && qtyEntry.num > 0 && qtyEntry.num <= 50000) {
          qty = qtyEntry.num;
          logger.debug(`[ConcreteExtractor] Strategy 1: Found qty ${qty} in named column "${quantityColumnKey}"`);
        }
      }

      // Strategy 1.5: If M3 cell found, check the column IMMEDIATELY BEFORE it
      // Typical Excel layout: ... | Množství | MJ | J.cena | ...
      //                       ... |   7.838  | M3 | 3500   | ...
      // So quantity is usually in the column BEFORE M3, not after!
      if (qty <= 0 && foundM3Cell && m3CellKey) {
        const m3ColIdx = columnKeys.indexOf(m3CellKey);
        if (m3ColIdx > 0) {
          // Check column BEFORE M3
          const prevColKey = columnKeys[m3ColIdx - 1];
          const prevEntry = numbersInRow.find(item => item.key === prevColKey);
          if (prevEntry && prevEntry.num > 0 && prevEntry.num <= 10000 && !prevEntry.isLikelyOTSKPCode) {
            qty = prevEntry.num;
            logger.debug(`[ConcreteExtractor] Strategy 1.5: Found qty ${qty} in column BEFORE M3 ("${prevColKey}")`);
          }
        }
      }

      // Strategy 2: If M3 cell found, look for reasonable volume using scoring
      if (qty <= 0 && foundM3Cell && numbersInRow.length > 0) {
        // Filter out OTSKP codes
        const candidates = numbersInRow.filter(item =>
          !item.isLikelyOTSKPCode &&
          item.num >= 0.1 &&
          item.num <= 10000 // Reasonable max volume for a single concrete item
        );

        if (candidates.length > 0) {
          // Find M3 column index for position scoring
          const m3ColIdx = m3CellKey ? columnKeys.indexOf(m3CellKey) : -1;

          // Score each candidate - higher score = more likely to be quantity
          candidates.forEach(item => {
            let score = 0;

            // Prefer quantity column
            if (item.isQuantityColumn) score += 100;

            // POSITION BONUS: Prefer columns near M3 (within 2 columns)
            if (m3ColIdx >= 0) {
              const distance = Math.abs(item.colIdx - m3ColIdx);
              if (distance === 1) score += 60;  // Adjacent to M3 - very likely quantity!
              else if (distance === 2) score += 30;
              else if (distance > 4) score -= 20; // Far from M3 - less likely
            }

            // Prefer numbers with decimals (7.838 vs 3.00)
            const decimalPlaces = (String(item.num).split('.')[1] || '').length;
            if (decimalPlaces >= 2) score += 30;  // Reduced from 50
            if (decimalPlaces >= 1) score += 15;  // Reduced from 20

            // Small penalty for round integers (but not too harsh - concrete can be round!)
            if (Number.isInteger(item.num)) score -= 10; // Reduced from -30

            // Prefer numbers in typical volume range (5-500 m³)
            if (item.num >= 5 && item.num <= 500) score += 25;
            if (item.num >= 1 && item.num <= 1000) score += 10;

            // Penalize very small integers (1, 2, 3 - likely row numbers)
            if (item.num < 5 && Number.isInteger(item.num)) score -= 50;

            // Penalize likely prices
            if (item.isLikelyPrice) score -= 40;

            item.score = score;
          });

          // Sort by score descending (highest score first)
          candidates.sort((a, b) => b.score - a.score);
          qty = candidates[0].num;

          // Debug log
          logger.info(`[ConcreteExtractor] Strategy 2 candidates: ${candidates.slice(0, 5).map(c => `${c.num}(s:${c.score},col:${c.key})`).join(', ')}`);
        }
      }

      // Strategy 3: Last fallback - take first reasonable number with decimals
      if (qty <= 0 && numbersInRow.length > 0) {
        // Prefer numbers with decimals
        const withDecimals = numbersInRow.find(item =>
          !item.isLikelyOTSKPCode &&
          !Number.isInteger(item.num) &&
          item.num >= 0.1 &&
          item.num <= 5000
        );
        if (withDecimals) {
          qty = withDecimals.num;
        } else {
          // Last resort - any reasonable number
          const candidate = numbersInRow.find(item =>
            !item.isLikelyOTSKPCode &&
            item.num >= 0.1 &&
            item.num <= 5000
          );
          if (candidate) {
            qty = candidate.num;
          }
        }
      }

      // Skip if no quantity found
      if (qty <= 0) {
        logger.debug(`[ConcreteExtractor] Found grade ${foundGrade} but no quantity in row ${i}`);
        continue;
      }

      // Create position
      // IMPORTANT: part_name should be unique per concrete element to create separate sections
      // Use truncated description as part_name, NOT "Beton C30/37" which groups all same-grade items together
      let partName = descriptionCell;
      if (partName.length > 60) {
        partName = partName.substring(0, 57) + '...';
      }

      const position = {
        part_name: partName,  // Unique per item - creates separate section in UI
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
