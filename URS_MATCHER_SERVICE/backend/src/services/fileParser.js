/**
 * File Parser Service
 * Supports Excel, ODS, CSV file parsing
 */

import XLSX from 'xlsx';
import fs from 'fs';
import { logger } from '../utils/logger.js';

export async function parseExcelFile(filePath) {
  try {
    logger.info(`[FileParser] Parsing file: ${filePath}`);

    // Read file
    const fileBuffer = fs.readFileSync(filePath);

    // Parse workbook
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Process rows
    const rows = [];
    const headers = data[0] || [];

    // Find columns
    const descCol = findColumn(headers, ['popis', 'description', 'název', 'položka']);
    const qtyCol = findColumn(headers, ['množství', 'quantity', 'mnozstvi', 'qty']);
    const unitCol = findColumn(headers, ['mj', 'unit', 'jednotka']);

    if (descCol === -1) {
      throw new Error('Could not find description column');
    }

    // Parse data rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      if (!row || row.length === 0) continue;

      const description = row[descCol]?.toString().trim();
      if (!description) continue;

      rows.push({
        description,
        quantity: parseNumber(row[qtyCol]) || 0,
        unit: row[unitCol]?.toString().trim() || 'ks'
      });
    }

    logger.info(`[FileParser] Successfully parsed ${rows.length} rows`);
    return rows;

  } catch (error) {
    logger.error(`[FileParser] Error: ${error.message}`);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

function findColumn(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.toString().toLowerCase().trim();
    if (keywords.some(kw => header.includes(kw))) {
      return i;
    }
  }
  return -1;
}

function parseNumber(value) {
  if (!value) return 0;
  const num = parseFloat(value.toString().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}
