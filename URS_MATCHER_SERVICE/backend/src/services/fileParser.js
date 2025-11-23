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

    // Log found headers for debugging
    logger.info(`[FileParser] Found ${headers.length} columns:`, headers.map(h => h?.toString().trim()).join(', '));

    // Find columns
    const descCol = findColumn(headers, ['popis', 'description', 'název', 'položka', 'text', 'práce', 'polozka']);
    const qtyCol = findColumn(headers, ['množství', 'quantity', 'mnozstvi', 'qty', 'pocet']);
    const unitCol = findColumn(headers, ['mj', 'unit', 'jednotka']);

    logger.info(`[FileParser] Column mapping: description=${descCol}, quantity=${qtyCol}, unit=${unitCol}`);

    if (descCol === -1) {
      // If no description column found, try to use first non-empty column
      const firstNonEmpty = headers.findIndex(h => h && h.toString().trim().length > 0);
      if (firstNonEmpty !== -1) {
        logger.warn(`[FileParser] Description column not found by keywords, using first column (${firstNonEmpty}): "${headers[firstNonEmpty]}"`);
        const descColFallback = firstNonEmpty;

        // Parse data rows with fallback
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          const description = row[descColFallback]?.toString().trim();
          if (!description) continue;

          rows.push({
            description,
            quantity: parseNumber(row[qtyCol]) || 0,
            unit: row[unitCol]?.toString().trim() || 'ks'
          });
        }

        logger.info(`[FileParser] Successfully parsed ${rows.length} rows (using fallback column)`);
        return rows;
      }

      // If still no column found, throw detailed error
      throw new Error(
        `Could not find description column. ` +
        `Expected one of: popis, description, název, položka, text, práce. ` +
        `Found columns: ${headers.map(h => `"${h}"`).join(', ')}`
      );
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
