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
 * Extract bridges from raw data
 * Looks for SO codes in any column and tries to find concrete quantities
 * Also extracts project and bridge names from header rows (Stavba, Objekt, Soupis)
 */
function extractBridgesFromData(rawData) {
  const bridges = [];
  const foundSOCodes = new Set();

  // Extract header metadata (Stavba, Objekt, Soupis)
  let projectName = '';      // "I/20 HNĚVKOV - SEDLICE_N_CENA"
  let objectDescription = ''; // "SO 201 - MOST PŘES BIOKORIDOR V KM 1,480"

  // First: scan for header rows (rows 0-15, usually headers are at top)
  for (let i = 0; i < Math.min(15, rawData.length); i++) {
    const row = rawData[i];
    const keys = Object.keys(row);

    // Look for "Stavba" label
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex];
      const value = row[key];

      if (value && typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        // Find "Stavba" (Project name)
        if (normalized === 'stavba' && keyIndex + 1 < keys.length) {
          projectName = row[keys[keyIndex + 1]] || '';
        }

        // Find "Objekt" (Object/Bridge description)
        if (normalized === 'objekt' && keyIndex + 1 < keys.length) {
          objectDescription = row[keys[keyIndex + 1]] || '';
        }

        // Find "Soupis" (Bill of quantities name)
        if (normalized === 'soupis' && keyIndex + 1 < keys.length) {
          const soupisValue = row[keys[keyIndex + 1]];
          if (soupisValue) {
            projectName = soupisValue;
          }
        }
      }
    }
  }

  logger.info(`[Parser] Extracted header metadata:`, {
    projectName,
    objectDescription
  });

  // First pass: find all SO codes
  const soCodeMap = new Map(); // SO code -> row index

  rawData.forEach((row, index) => {
    // Search ALL columns for SO code pattern
    for (const [key, value] of Object.entries(row)) {
      if (value && typeof value === 'string') {
        const match = value.match(/SO\s*(\d+)/i);
        if (match) {
          const soCode = `SO ${match[1]}`.trim();
          if (!foundSOCodes.has(soCode)) {
            foundSOCodes.add(soCode);
            soCodeMap.set(soCode, index);
            logger.info(`Found bridge: ${soCode} at row ${index}`);
          }
          break; // Found SO code in this row, move to next row
        }
      }
    }
  });

  // Second pass: try to find concrete quantities and build names for each bridge
  foundSOCodes.forEach(soCode => {
    const startRow = soCodeMap.get(soCode);
    let concrete_m3 = 0;
    let objectName = soCode; // Default to SO code

    // Try to build descriptive object name
    if (objectDescription && objectDescription.includes(soCode)) {
      // Use full description from XLSX header
      objectName = objectDescription;
    } else if (projectName) {
      // Fallback: combine project name with SO code
      objectName = `${soCode} - ${projectName}`;
    }

    // Look in next 20 rows for concrete quantity
    for (let i = startRow; i < Math.min(startRow + 20, rawData.length); i++) {
      const row = rawData[i];
      for (const [key, value] of Object.entries(row)) {
        if (value && typeof value === 'string') {
          // Look for "beton", "betón", "m3", "m³"
          const lowerValue = value.toLowerCase();
          if (lowerValue.includes('beton') || lowerValue.includes('betón')) {
            // Check next column for quantity
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
