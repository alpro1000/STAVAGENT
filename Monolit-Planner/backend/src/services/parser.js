/**
 * XLSX Parser service
 * Parses uploaded XLSX files and suggests column mapping
 */

import XLSX from 'xlsx';
import { logger } from '../utils/logger.js';

/**
 * Parse XLSX file and extract data
 * Intelligently selects the best sheet containing actual data
 */
export async function parseXLSX(filePath) {
  try {
    // Read workbook with proper encoding
    const workbook = XLSX.readFile(filePath, {
      cellFormula: true,
      cellStyles: true,
      cellDates: true
    });

    // 🔴 FIX: Check if file has any sheets
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets or is empty');
    }

    logger.info(`[Parser] Available sheets: ${workbook.SheetNames.join(', ')}`);

    // 🔍 SMART SHEET SELECTION: Find the best sheet with actual data
    let bestSheet = null;
    let bestData = null;
    let bestRowCount = 0;
    let selectedSheetName = null;

    // Try each sheet to find one with the most data rows
    for (const sheetName of workbook.SheetNames) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: null,
          blankrows: false
        });

        if (!Array.isArray(rawData) || rawData.length === 0) {
          logger.debug(`[Parser] Sheet "${sheetName}" is empty`);
          continue;
        }

        // Count data rows (filter out mostly empty rows)
        const dataRows = rawData.filter(row => {
          const values = Object.values(row).filter(v => v !== null && v !== '');
          return values.length > 0;
        });

        logger.info(`[Parser] Sheet "${sheetName}": ${rawData.length} total rows, ${dataRows.length} data rows`);

        // Prefer sheets with more data, but also prefer sheets with "soupis", "pracovní", "rozpočet" in name (Czech for work list, budget)
        const isPreferredName = /soupis|pracovní|rozpočet|položky|pozice/i.test(sheetName);
        const score = dataRows.length + (isPreferredName ? 1000 : 0);

        if (score > bestRowCount || (bestData === null)) {
          bestSheet = worksheet;
          bestData = rawData;
          bestRowCount = dataRows.length;
          selectedSheetName = sheetName;
          logger.info(`[Parser] Sheet "${sheetName}" selected (score: ${score})`);
        }
      } catch (sheetError) {
        logger.debug(`[Parser] Error parsing sheet "${sheetName}": ${sheetError.message}`);
      }
    }

    // If no suitable sheet found, use first sheet
    if (!bestData) {
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" is empty or invalid`);
      }

      bestData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: null,
        blankrows: false
      });

      selectedSheetName = sheetName;
      logger.warn(`[Parser] No preferred sheet found, using first sheet: "${sheetName}"`);
    }

    // 🔴 FIX: Check if bestData is valid array
    if (!Array.isArray(bestData)) {
      throw new Error('Failed to parse Excel sheet - no rows found');
    }

    if (bestData.length === 0) {
      throw new Error('Excel sheet contains no data rows');
    }

    // Ensure UTF-8 encoding by re-encoding strings
    const encodedData = bestData.map(row => {
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

    logger.info(`[Parser] ✅ Using sheet "${selectedSheetName}" with ${encodedData.length} rows`);

    // Suggest column mapping based on headers
    const headers = Object.keys(encodedData[0] || {});
    const mapping_suggestions = suggestMapping(headers);

    return {
      raw_rows: encodedData,
      mapping_suggestions,
      headers,
      selected_sheet: selectedSheetName
    };
  } catch (error) {
    logger.error('XLSX parsing error:', error);
    throw new Error(`Failed to parse XLSX: ${error.message}`);
  }
}

/**
 * Extract file metadata (Stavba, Objekt, Soupis)
 * This metadata is used to create project hierarchy
 *
 * Stavba = Project container (from file headers)
 * Objekt = Object name (from file headers or CORE)
 * Soupis = Budget/list name
 *
 * Handles multiple Excel header formats:
 *   Format 1: Label in column N, value in column N+1  ("Stavba" | "D6 Karlovy Vary")
 *   Format 2: "Stavba:" with colon, value in next col  ("Stavba:" | "D6 Karlovy Vary")
 *   Format 3: Label+value in same cell                  ("Stavba: D6 Karlovy Vary")
 *   Format 4: Label row, value in next row below        (row i: "Stavba:", row i+1: "D6 Karlovy Vary")
 */
export function extractFileMetadata(rawData) {
  if (!Array.isArray(rawData)) {
    logger.warn(`[Parser] Invalid input: rawData is not an array`);
    return { stavba: null, objekt: null, soupis: null };
  }

  if (rawData.length === 0) {
    logger.warn(`[Parser] rawData is empty array`);
    return { stavba: null, objekt: null, soupis: null };
  }

  let metadata = { stavba: null, objekt: null, soupis: null };
  const metadataKeys = ['stavba', 'objekt', 'soupis'];

  // Scan first 20 rows for metadata labels
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i];
    const keys = Object.keys(row);

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
      const key = keys[keyIndex];
      const value = row[key];

      if (!value || typeof value !== 'string') continue;

      const trimmed = value.trim();
      const normalized = trimmed.toLowerCase();

      for (const metaKey of metadataKeys) {
        if (metadata[metaKey]) continue; // already found

        // Format 1/2: Label is exact match (with or without colon), value in next column
        if ((normalized === metaKey || normalized === metaKey + ':') && keyIndex + 1 < keys.length) {
          const nextValue = row[keys[keyIndex + 1]];
          if (nextValue && String(nextValue).trim()) {
            metadata[metaKey] = String(nextValue).trim();
            logger.info(`[Parser] Found ${metaKey} (next-col): "${metadata[metaKey]}"`);
            break;
          }
        }

        // Format 3: "Stavba: D6 Karlovy Vary" in a single cell
        const colonPattern = new RegExp(`^${metaKey}\\s*:\\s*(.+)$`, 'i');
        const colonMatch = trimmed.match(colonPattern);
        if (colonMatch && colonMatch[1].trim()) {
          metadata[metaKey] = colonMatch[1].trim();
          logger.info(`[Parser] Found ${metaKey} (inline): "${metadata[metaKey]}"`);
          break;
        }

        // Format 4: Label in this row, value in the same column position in next row
        if ((normalized === metaKey || normalized === metaKey + ':') && i + 1 < rawData.length) {
          const nextRow = rawData[i + 1];
          if (nextRow) {
            const nextRowKeys = Object.keys(nextRow);
            // Try same column position
            if (keyIndex < nextRowKeys.length) {
              const belowValue = nextRow[nextRowKeys[keyIndex]];
              if (belowValue && String(belowValue).trim() && !metadataKeys.includes(String(belowValue).trim().toLowerCase().replace(':', ''))) {
                metadata[metaKey] = String(belowValue).trim();
                logger.info(`[Parser] Found ${metaKey} (below-row): "${metadata[metaKey]}"`);
                break;
              }
            }
          }
        }
      }
    }
  }

  return metadata;
}

/**
 * DEPRECATED: detectObjectTypeFromDescription()
 *
 * This function is no longer used in VARIANT 1 (Single Universal Object Type).
 * Users describe their project type in the object_name field instead.
 *
 * Keeping function for backward compatibility, but it's not called from extractProjectsFromCOREResponse.
 */
export function detectObjectTypeFromDescription(description) {
  if (!description) return 'custom';

  const desc = description.toLowerCase();

  if (desc.includes('most')) return 'bridge';
  if (desc.includes('tunel')) return 'tunnel';
  if (desc.includes('budov')) return 'building';
  if (desc.includes('nasypov') || desc.includes('nasyp')) return 'embankment';
  if (desc.includes('retenci') || desc.includes('opěrn')) return 'retaining_wall';
  if (desc.includes('parkov')) return 'parking';
  if (desc.includes('silnic') || desc.includes('cesta')) return 'road';

  return 'custom';
}

/**
 * Detect which columns contain what data
 * Returns mapping of detected columns
 */
function detectHeaderRow(rawData) {
  // 🔴 FIX: Check if rawData is valid array
  if (!Array.isArray(rawData) || rawData.length === 0) {
    logger.warn(`[Parser] detectHeaderRow: Invalid input`);
    return null;
  }

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
 * Normalize string for consistent project_id/object_id
 * Used for creating normalized IDs from project/object names
 */
export function normalizeString(str) {
  return str
    .trim()
    .replace(/\s+/g, '_')      // Replace spaces with underscores
    .replace(/[^\w-]/g, '')    // Remove special characters
    .toLowerCase()
    .substring(0, 100);        // Limit length
}

/**
 * REMOVED: extractBridgesFromSOCodes()
 *
 * This function was WRONG because:
 * - Assumed SO code determines object type (FALSE!)
 * - SO is just an ID (Stavební Objekt), not a type classifier
 * - Type should be determined from DESCRIPTION text
 *
 * Use detectObjectTypeFromDescription() instead!
 */

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
 * Extract projects from CORE parser response
 * Uses intelligent material_type classification to identify concrete positions
 * VARIANT 1: Single universal object type - user describes what they're building in object_name
 *
 * CORE parser returns positions with:
 * - material_type: "concrete" | "reinforcement" | "masonry" | "insulation" | "other"
 * - description: full text describing the work
 * - quantity: volume in units
 * - validation: GREEN | AMBER | RED
 * - confidence_score: 0.0-1.0
 *
 * Returns projects with universal fields only
 */
export function extractProjectsFromCOREResponse(corePositions) {
  if (!Array.isArray(corePositions) || corePositions.length === 0) {
    logger.warn('[Parser] CORE returned empty positions');
    return [];
  }

  const projects = [];
  const processedDescriptions = new Set();

  logger.info(`[Parser] Extracting projects from ${corePositions.length} CORE positions`);

  // Filter for concrete positions only
  // CORE's material_type field is reliable (uses class patterns, exposure classes, not just M3)
  const concretePositions = corePositions.filter(pos => {
    // Match positions where CORE identified as concrete
    const isConcrete = pos.material_type === 'concrete' ||
                      pos.material_type === 'CONCRETE';

    return isConcrete;
  });

  logger.info(`[Parser] CORE identified ${concretePositions.length} concrete positions (out of ${corePositions.length})`);

  // Create projects from concrete positions
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

    // Use full description as project/object name
    const project_id = normalizeString(description);
    const concrete_m3 = quantity;

    // Check for duplicate project_id (from different descriptions)
    if (!projects.find(p => p.project_id === project_id)) {
      projects.push({
        project_id: project_id,
        object_name: description,           // Full description from CORE - user describes type here
        concrete_m3: concrete_m3,           // Quantity from CORE
        // Store CORE metadata for traceability
        core_code: pos.code,
        core_material_type: pos.material_type,
        core_validation: pos.audit,
        core_confidence: pos.enrichment?.confidence_score || 0
      });

      processedDescriptions.add(description);

      logger.info(
        `[Parser] Created project from CORE concrete: ${project_id} ` +
        `(${concrete_m3} m³, ${pos.audit}, conf: ${pos.enrichment?.confidence_score || 'N/A'})`
      );
    }
  });

  if (projects.length === 0) {
    logger.warn('[Parser] No concrete positions found in CORE response');
  } else {
    logger.info(`[Parser] ✅ Successfully created ${projects.length} projects from CORE concrete positions`);
  }

  return projects;
}

/**
 * Parse ALL sheets from Excel file
 * Returns an array of sheets, each with its data and extracted bridge info
 * Used for multi-bridge import where each sheet = one bridge (MOST)
 */
export async function parseAllSheets(filePath) {
  try {
    const workbook = XLSX.readFile(filePath, {
      cellFormula: true,
      cellStyles: true,
      cellDates: true
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets or is empty');
    }

    logger.info(`[Parser] parseAllSheets: Found ${workbook.SheetNames.length} sheets`);

    const sheets = [];

    for (const sheetName of workbook.SheetNames) {
      try {
        // Skip summary/recap sheets
        if (/rekapitul|souhrn|summary|obsah|content/i.test(sheetName)) {
          logger.info(`[Parser] Skipping summary sheet: "${sheetName}"`);
          continue;
        }

        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        const rawData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: null,
          blankrows: false
        });

        if (!Array.isArray(rawData) || rawData.length === 0) {
          logger.debug(`[Parser] Sheet "${sheetName}" is empty`);
          continue;
        }

        // Filter out mostly empty rows
        const dataRows = rawData.filter(row => {
          const values = Object.values(row).filter(v => v !== null && v !== '');
          return values.length > 0;
        });

        if (dataRows.length < 5) {
          logger.debug(`[Parser] Sheet "${sheetName}" has too few data rows (${dataRows.length})`);
          continue;
        }

        // Extract bridge info from sheet name
        // Format: "201 - MOST PŘES BIOKORIDO..." or "SO 201 - MOST..."
        const bridgeInfo = extractBridgeFromSheetName(sheetName);

        // UTF-8 encoding
        const encodedData = dataRows.map(row => {
          const encodedRow = {};
          for (const [key, value] of Object.entries(row)) {
            encodedRow[key] = typeof value === 'string' ? String(value) : value;
          }
          return encodedRow;
        });

        sheets.push({
          sheetName: sheetName,
          bridgeId: bridgeInfo.bridgeId,
          bridgeName: bridgeInfo.bridgeName,
          rawRows: encodedData,
          rowCount: encodedData.length
        });

        logger.info(`[Parser] Sheet "${sheetName}" → Bridge: ${bridgeInfo.bridgeId} "${bridgeInfo.bridgeName}" (${encodedData.length} rows)`);

      } catch (sheetError) {
        logger.warn(`[Parser] Error parsing sheet "${sheetName}": ${sheetError.message}`);
      }
    }

    logger.info(`[Parser] parseAllSheets: Extracted ${sheets.length} bridge sheets`);
    return sheets;

  } catch (error) {
    logger.error('parseAllSheets error:', error);
    throw new Error(`Failed to parse all sheets: ${error.message}`);
  }
}

/**
 * Extract bridge ID and name from sheet name
 * Examples:
 *   "201 - MOST PŘES BIOKORIDO..." → { bridgeId: "SO201", bridgeName: "MOST PŘES BIOKORIDO..." }
 *   "SO 204 - MOST PŘES SILNICI III/1211" → { bridgeId: "SO204", bridgeName: "MOST PŘES SILNICI III/1211" }
 */
export function extractBridgeFromSheetName(sheetName) {
  // PRIORITY 1: Compound IDs like "SO 12-23-01" or "SO 11-30-01.1" (NO name after)
  // These are NOT bridges (mosty), they're generic construction objects
  const compoundMatch = sheetName.match(/^SO\s*(\d+[-–][\d\-–\.]+)\s*$/i);
  if (compoundMatch) {
    const fullId = compoundMatch[1].replace(/\s+/g, '').replace(/–/g, '-');
    return {
      bridgeId: `SO${fullId}`,
      bridgeName: sheetName.trim()
    };
  }

  // PRIORITY 2: Bridge format "SO 201 - MOST..." or "201 - MOST..."
  const bridgePatterns = [
    /^SO\s*(\d+)\s*[-–]\s*(.+)$/i,           // "SO 201 - MOST..."
    /^(\d{3})\s*[-–]\s*(.+)$/i,               // "201 - MOST..."
    /^(\d+)\s*[-–]\s*(.+)$/i,                 // "12 - SOMETHING..."
  ];

  for (const pattern of bridgePatterns) {
    const match = sheetName.match(pattern);
    if (match) {
      const number = match[1];
      const name = match[2] ? match[2].trim() : sheetName;
      // Only use this if the name looks like a real name (has letters)
      if (name && /[a-zA-Zá-žÁ-Ž]/.test(name)) {
        return {
          bridgeId: `SO${number}`,
          bridgeName: name
        };
      }
    }
  }

  // PRIORITY 3: Simple SO + number
  const simpleMatch = sheetName.match(/^SO\s*(\d+)\s*$/i);
  if (simpleMatch) {
    return {
      bridgeId: `SO${simpleMatch[1]}`,
      bridgeName: sheetName.trim()
    };
  }

  // PRIORITY 4: Just a 3-digit number
  const numMatch = sheetName.match(/^(\d{3})$/);
  if (numMatch) {
    return {
      bridgeId: `SO${numMatch[1]}`,
      bridgeName: `Object ${numMatch[1]}`
    };
  }

  // FALLBACK: Use normalized sheet name as ID
  const normalized = sheetName.trim().replace(/\s+/g, '_').replace(/[^\w\-\.]/g, '');
  return {
    bridgeId: normalized.toUpperCase() || `SHEET_${Date.now()}`,
    bridgeName: sheetName.trim()
  };
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
