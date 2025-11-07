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
    // Read workbook
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null
    });

    logger.info(`Parsed ${rawData.length} rows from ${sheetName}`);

    // Extract unique bridge IDs
    const bridges = new Set();
    rawData.forEach(row => {
      // Try to find bridge_id in various column names
      const possibleBridgeFields = [
        'Poř. číslo', 'Por cislo', 'bridge_id', 'Bridge ID',
        'SO', 'Název objektu', 'Objekt'
      ];

      for (const field of possibleBridgeFields) {
        if (row[field]) {
          const value = String(row[field]).trim();
          if (value.match(/SO\d+/i)) {
            bridges.add(value);
            break;
          }
        }
      }
    });

    // Suggest column mapping based on headers
    const headers = Object.keys(rawData[0] || {});
    const mapping_suggestions = suggestMapping(headers);

    return {
      bridges: Array.from(bridges),
      raw_rows: rawData,
      mapping_suggestions,
      headers
    };
  } catch (error) {
    logger.error('XLSX parsing error:', error);
    throw new Error(`Failed to parse XLSX: ${error.message}`);
  }
}

/**
 * Suggest column mapping based on common patterns
 */
function suggestMapping(headers) {
  const mapping = {};

  const patterns = {
    bridge_id: ['Poř. číslo', 'Por cislo', 'SO', 'Bridge ID', 'Objekt'],
    part_name: ['Název položky', 'Nazev polozky', 'Part', 'Element', 'Položka'],
    subtype: ['Podtyp', 'Typ práce', 'Type', 'Subtype'],
    unit: ['MJ', 'Jednotka', 'Unit'],
    qty: ['Množství', 'Mnozstvi', 'Quantity', 'Qty'],
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
