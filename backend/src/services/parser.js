/**
 * XLSX Parser service
 * Parses uploaded XLSX files and suggests column mapping
 */

import XLSX from 'xlsx';
import { logger } from '../utils/logger.js';

/**
 * Parse XLSX file and extract data
 */
export async function parseXLSX(filePath) {
  try {
    // Read workbook with proper encoding
    const workbook = XLSX.readFile(filePath, {
      cellFormula: true,
      cellStyles: true,
      cellDates: true
    });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with proper string handling
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null,
      blankrows: false
    });

    // Ensure UTF-8 encoding by re-encoding strings
    const encodedData = rawData.map(row => {
      const encodedRow = {};
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string') {
          // Force UTF-8 string handling
          encodedRow[key] = String(value);
        } else {
          encodedRow[key] = value;
        }
      }
      return encodedRow;
    });

    logger.info(`Parsed ${encodedData.length} rows from ${sheetName}`);

    // Extract bridges (SO codes) and their concrete quantities
    const bridges = extractBridgesFromData(encodedData);

    logger.info(`Found ${bridges.length} bridges:`, bridges);

    // Suggest column mapping based on headers
    const headers = Object.keys(encodedData[0] || {});
    const mapping_suggestions = suggestMapping(headers);

    return {
      bridges,
      raw_rows: encodedData,
      mapping_suggestions,
      headers
    };
  } catch (error) {
    logger.error('XLSX parsing error:', error);
    throw new Error(`Failed to parse XLSX: ${error.message}`);
  }
}

/**
 * Extract bridges from raw data - POSITION-FIRST APPROACH
 *
 * NEW STRATEGY (Changed from SO-code-first):
 * 1. Find ALL positions where Unit = "M3"/"m3" (concrete items)
 * 2. Use the position DESCRIPTION as bridge name
 * 3. Extract concrete volume DIRECTLY from that row's quantity column
 * 4. Fall back to SO code detection if no concrete positions found
 */
function extractBridgesFromData(rawData) {
  const bridges = [];

  logger.info('[Parser] Starting position-first bridge extraction');

  // Detect column headers (usually in first 5 rows)
  const headerRow = detectHeaderRow(rawData);
  logger.info('[Parser] Detected columns:', headerRow);

  if (!headerRow) {
    logger.warn('[Parser] Could not detect column headers, falling back to SO code extraction');
    return extractBridgesFromSOCodes(rawData);
  }

  // PRIMARY: Find bridges from concrete positions (M3 rows)
  const concretePositions = findConcretePositions(rawData, headerRow);
  logger.info(`[Parser] Found ${concretePositions.length} concrete positions`);

  if (concretePositions.length > 0) {
    // Create bridges from concrete positions
    concretePositions.forEach(pos => {
      // Use full description as bridge identifier
      const bridge_id = normalizeString(pos.description);

      // Check if bridge already exists in our list
      const existing = bridges.find(b => b.bridge_id === bridge_id);

      if (!existing) {
        bridges.push({
          bridge_id: bridge_id,
          object_name: pos.description, // Full description from source
          concrete_m3: pos.quantity,     // Volume directly from source
          span_length_m: 0,
          deck_width_m: 0,
          pd_weeks: 0
        });
        logger.info(`[Parser] Created bridge from concrete position: ${bridge_id} (${pos.quantity} m³)`);
      }
    });

    if (bridges.length > 0) {
      logger.info(`[Parser] ✅ Successfully created ${bridges.length} bridges from concrete positions`);
      return bridges;
    }
  }

  // SECONDARY FALLBACK: Use SO code detection if no concrete positions found
  logger.warn('[Parser] No concrete positions found, falling back to SO code detection');
  return extractBridgesFromSOCodes(rawData);
}

/**
 * Detect which columns contain what data
 * Returns mapping of detected columns
 */
function detectHeaderRow(rawData) {
  // Check first 5 rows for headers
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i];
    const keys = Object.keys(row);

    // Look for common header patterns
    const hasQuantity = keys.some(k => {
      const lower = k.toLowerCase();
      return lower.includes('počet') || lower.includes('množství') ||
             lower.includes('quantity') || lower.includes('qty') || lower.includes('mnozstvi');
    });

    const hasUnit = keys.some(k => {
      const lower = k.toLowerCase();
      return lower.includes('mj') || lower.includes('jednotka') ||
             lower.includes('unit') || lower.includes('jednotka');
    });

    const hasDescription = keys.some(k => {
      const lower = k.toLowerCase();
      return lower.includes('popis') || lower.includes('název') ||
             lower.includes('description') || lower.includes('item') || lower.includes('nazev');
    });

    if (hasQuantity && hasUnit && hasDescription) {
      // Found header row, extract column mappings
      return {
        description: keys.find(k => {
          const lower = k.toLowerCase();
          return lower.includes('popis') || lower.includes('název') ||
                 lower.includes('description') || lower.includes('item') || lower.includes('nazev');
        }),
        quantity: keys.find(k => {
          const lower = k.toLowerCase();
          return lower.includes('počet') || lower.includes('množství') ||
                 lower.includes('quantity') || lower.includes('qty') || lower.includes('mnozstvi');
        }),
        unit: keys.find(k => {
          const lower = k.toLowerCase();
          return lower.includes('mj') || lower.includes('jednotka') ||
                 lower.includes('unit') || lower.includes('jednotka');
        }),
        headerRowIndex: i
      };
    }
  }

  return null;
}

/**
 * Find all positions where Unit = M3 (concrete work)
 */
function findConcretePositions(rawData, headerRow) {
  const positions = [];
  const { description: descCol, quantity: qtyCol, unit: unitCol, headerRowIndex } = headerRow;

  // Start from row after header
  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    const unitValue = String(row[unitCol] || '').trim();
    const descValue = String(row[descCol] || '').trim();
    const qtyValue = String(row[qtyCol] || '').trim();

    // Check if this is a concrete row (Unit = M3 or m³)
    if ((unitValue === 'M3' || unitValue === 'm3' || unitValue === 'm³' || unitValue === 'M³') &&
        descValue && qtyValue) {

      const qty = parseNumber(qtyValue);

      if (qty > 0 && descValue.length > 3) { // Only if valid description and quantity
        positions.push({
          description: descValue,
          quantity: qty,
          unit: unitValue
        });

        logger.info(`[Parser] Found concrete position: "${descValue}" = ${qty} ${unitValue}`);
      }
    }
  }

  return positions;
}

/**
 * Normalize bridge name for consistent bridge_id
 */
function normalizeString(str) {
  return str
    .trim()
    .replace(/\s+/g, '_')      // Replace spaces with underscores
    .replace(/[^\w-]/g, '')    // Remove special characters
    .toLowerCase()
    .substring(0, 100);        // Limit length
}

/**
 * Fallback: Extract bridges from SO codes
 * Used if no concrete positions found
 */
function extractBridgesFromSOCodes(rawData) {
  const bridges = [];
  const foundSOCodes = new Set();

  // Extract header metadata
  let projectName = '';
  let objectDescription = '';

  // Scan header rows
  for (let i = 0; i < Math.min(15, rawData.length); i++) {
    const row = rawData[i];
    const keys = Object.keys(row);

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex];
      const value = row[key];

      if (value && typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        if (normalized === 'stavba' && keyIndex + 1 < keys.length) {
          projectName = row[keys[keyIndex + 1]] || '';
        }

        if (normalized === 'objekt' && keyIndex + 1 < keys.length) {
          objectDescription = row[keys[keyIndex + 1]] || '';
        }

        if (normalized === 'soupis' && keyIndex + 1 < keys.length) {
          const soupisValue = row[keys[keyIndex + 1]];
          if (soupisValue) {
            projectName = soupisValue;
          }
        }
      }
    }
  }

  logger.info(`[Parser] Fallback to SO codes - Project: "${projectName}", Object: "${objectDescription}"`);

  // Find SO codes
  const soCodeMap = new Map();

  rawData.forEach((row, index) => {
    for (const [key, value] of Object.entries(row)) {
      if (value && typeof value === 'string') {
        const match = value.match(/SO\s*(\d+)/i);
        if (match) {
          const soCode = `SO ${match[1]}`.trim();
          if (!foundSOCodes.has(soCode)) {
            foundSOCodes.add(soCode);
            soCodeMap.set(soCode, index);
            logger.info(`[Parser] Found SO code: ${soCode} at row ${index}`);
          }
          break;
        }
      }
    }
  });

  // Build bridges from SO codes
  foundSOCodes.forEach(soCode => {
    const startRow = soCodeMap.get(soCode);
    let concrete_m3 = 0;
    let objectName = soCode;

    if (objectDescription && objectDescription.includes(soCode)) {
      objectName = objectDescription;
    } else if (projectName) {
      objectName = `${soCode} - ${projectName}`;
    }

    // Try to find concrete in next 20 rows
    for (let i = startRow; i < Math.min(startRow + 20, rawData.length); i++) {
      const row = rawData[i];
      for (const [key, value] of Object.entries(row)) {
        if (value && typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          if (lowerValue.includes('beton') || lowerValue.includes('betón')) {
            const keys = Object.keys(row);
            const currentIndex = keys.indexOf(key);
            if (currentIndex >= 0 && currentIndex < keys.length - 1) {
              const nextValue = row[keys[currentIndex + 1]];
              if (nextValue) {
                concrete_m3 = parseNumber(nextValue);
                if (concrete_m3 > 0) {
                  logger.info(`Found concrete for ${soCode}: ${concrete_m3} m³`);
                  break;
                }
              }
            }
          }
        }
      }
      if (concrete_m3 > 0) break;
    }

    bridges.push({
      bridge_id: soCode,
      object_name: objectName,
      concrete_m3: concrete_m3,
      span_length_m: 0,
      deck_width_m: 0,
      pd_weeks: 0
    });
  });

  return bridges;
}

/**
 * Suggest column mapping based on common patterns
 */
function suggestMapping(headers) {
  const mapping = {};

  const patterns = {
    bridge_id: ['Poř. číslo', 'Por cislo', 'SO', 'Bridge ID', 'Objekt', 'Stavba'],
    part_name: ['Název položky', 'Nazev polozky', 'Part', 'Element', 'Položka', 'Popis'],
    subtype: ['Podtyp', 'Typ práce', 'Type', 'Subtype', 'Druh'],
    unit: ['MJ', 'Jednotka', 'Unit'],
    qty: ['Množství', 'Mnozstvi', 'Quantity', 'Qty', 'Počet'],
    crew_size: ['lidi', 'Lidi', 'Crew', 'People', 'Počet lidí'],
    wage_czk_ph: ['Kč/hod', 'Kc/hod', 'Wage', 'Hourly rate'],
    shift_hours: ['Hod/den', 'Hours', 'Shift'],
    days: ['den (koef 1)', 'den', 'Days', 'Dny']
  };

  headers.forEach(header => {
    const normalized = header.toLowerCase().trim();

    for (const [targetField, possibleNames] of Object.entries(patterns)) {
      for (const pattern of possibleNames) {
        if (normalized.includes(pattern.toLowerCase()) ||
            header === pattern) {
          mapping[header] = targetField;
          break;
        }
      }
    }
  });

  return mapping;
}

/**
 * Extract bridges from CORE parser response
 * Uses intelligent material_type classification instead of simple M3 detection
 *
 * CORE parser returns positions with:
 * - material_type: "concrete" | "reinforcement" | "masonry" | "insulation" | "other"
 * - technical_specs: { concrete_class, exposure_classes, ... }
 * - validation: GREEN | AMBER | RED
 * - confidence_score: 0.0-1.0
 */
export function extractBridgesFromCOREResponse(corePositions) {
  if (!Array.isArray(corePositions) || corePositions.length === 0) {
    logger.warn('[Parser] CORE returned empty positions');
    return [];
  }

  const bridges = [];
  const processedDescriptions = new Set();

  logger.info(`[Parser] Extracting bridges from ${corePositions.length} CORE positions`);

  // Filter for concrete positions only
  // CORE's material_type field is reliable (uses class patterns, exposure classes, not just M3)
  const concretePositions = corePositions.filter(pos => {
    // Match positions where CORE identified as concrete
    const isConcrete = pos.material_type === 'concrete' ||
                      pos.material_type === 'CONCRETE';

    // Optionally prefer high-confidence GREEN positions
    const isValidated = pos.audit === 'GREEN' || pos.audit === 'AMBER';

    return isConcrete;
  });

  logger.info(`[Parser] CORE identified ${concretePositions.length} concrete positions (out of ${corePositions.length})`);

  // Create bridges from concrete positions
  concretePositions.forEach(pos => {
    const description = pos.description || `Position ${pos.code}`;
    const quantity = parseNumber(pos.quantity || 0);

    // Skip if already processed (avoid duplicates)
    if (processedDescriptions.has(description)) {
      return;
    }

    if (quantity <= 0 || description.length < 3) {
      return;
    }

    // Use full description as bridge name
    const bridge_id = normalizeString(description);
    const concrete_m3 = quantity;

    // Check for duplicate bridge_id (from different descriptions)
    if (!bridges.find(b => b.bridge_id === bridge_id)) {
      bridges.push({
        bridge_id: bridge_id,
        object_name: description,       // Full description from CORE
        concrete_m3: concrete_m3,        // Quantity from CORE
        span_length_m: 0,
        deck_width_m: 0,
        pd_weeks: 0,
        // Store CORE metadata
        core_code: pos.code,
        core_material_type: pos.material_type,
        core_validation: pos.audit,
        core_confidence: pos.enrichment?.confidence_score || 0
      });

      processedDescriptions.add(description);

      logger.info(
        `[Parser] Created bridge from CORE concrete: ${bridge_id} ` +
        `(${concrete_m3} m³, ${pos.audit}, conf: ${pos.enrichment?.confidence_score || 'N/A'})`
      );
    }
  });

  if (bridges.length === 0) {
    logger.warn('[Parser] No concrete positions found in CORE response');
  } else {
    logger.info(`[Parser] ✅ Successfully created ${bridges.length} bridges from CORE concrete positions`);
  }

  return bridges;
}

/**
 * Parse number from Czech/EU format (comma as decimal separator)
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  // Convert to string and handle Czech format
  const str = String(value)
    .trim()
    .replace(/\s/g, '') // Remove spaces
    .replace(',', '.'); // Replace comma with dot

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}
