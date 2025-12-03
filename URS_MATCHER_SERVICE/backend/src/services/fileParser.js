/**
 * File Parser Service
 * Supports Excel, ODS, CSV file parsing
 * Two modes:
 *   1. Structured: Files with column headers (popis, množství, MJ)
 *   2. Unstructured: Free-text lines with embedded numbers and units
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

    if (data.length === 0) {
      throw new Error('File is empty');
    }

    // Detect parsing mode
    const mode = detectParsingMode(data);
    logger.info(`[FileParser] Detected mode: ${mode}`);

    if (mode === 'structured') {
      return parseStructuredFile(data);
    } else {
      return parseUnstructuredFile(data);
    }

  } catch (error) {
    logger.error(`[FileParser] Error: ${error.message}`);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

/**
 * Detect if file is structured (has column headers) or unstructured (free text)
 */
function detectParsingMode(data) {
  const headers = data[0] || [];

  // Check if first row looks like headers
  const hasDescriptionHeader = findColumn(headers, ['popis', 'description', 'název', 'položka', 'text', 'práce', 'polozka']) !== -1;
  const hasQuantityHeader = findColumn(headers, ['množství', 'quantity', 'mnozstvi', 'qty', 'pocet']) !== -1;

  if (hasDescriptionHeader || hasQuantityHeader) {
    return 'structured';
  }

  // Check if first row contains mostly text (not numbers)
  const textCells = headers.filter(h => h && isNaN(parseFloat(h.toString()))).length;
  if (textCells > headers.length / 2) {
    return 'structured'; // Likely has headers
  }

  return 'unstructured';
}

/**
 * Parse structured file with column headers
 */
function parseStructuredFile(data) {
  const rows = [];
  const headers = data[0] || [];

  logger.info(`[FileParser] Structured mode - Found ${headers.length} columns:`, headers.map(h => h?.toString().trim()).join(', '));

  // Find columns
  const descCol = findColumn(headers, ['popis', 'description', 'název', 'položka', 'text', 'práce', 'polozka']);
  const qtyCol = findColumn(headers, ['množství', 'quantity', 'mnozstvi', 'qty', 'pocet']);
  const unitCol = findColumn(headers, ['mj', 'unit', 'jednotka']);

  logger.info(`[FileParser] Column mapping: description=${descCol}, quantity=${qtyCol}, unit=${unitCol}`);

  if (descCol === -1) {
    // Fallback: use first non-empty column
    const firstNonEmpty = headers.findIndex(h => h && h.toString().trim().length > 0);
    if (firstNonEmpty !== -1) {
      logger.warn(`[FileParser] Description column not found by keywords, using first column (${firstNonEmpty}): "${headers[firstNonEmpty]}"`);
      const descColFallback = firstNonEmpty;

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

  logger.info(`[FileParser] Successfully parsed ${rows.length} rows (structured mode)`);
  return rows;
}

/**
 * Parse unstructured file (free-text lines with embedded numbers/units)
 */
function parseUnstructuredFile(data) {
  const rows = [];

  logger.info(`[FileParser] Unstructured mode - Parsing ${data.length} lines with regex`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Concatenate all cells in the row into one string
    const line = row.map(cell => cell?.toString().trim()).filter(Boolean).join(' ');
    if (!line) continue;

    const parsed = parseLineWithRegex(line);
    if (parsed) {
      logger.debug(`[FileParser] Row ${i + 1}: "${line}" → ${JSON.stringify(parsed)}`);
      rows.push(parsed);
    }
  }

  logger.info(`[FileParser] Successfully parsed ${rows.length} rows (unstructured mode)`);
  return rows;
}

/**
 * Parse a single line of text to extract description, quantity, and unit
 * Examples:
 *   "Odvětrání radonu DN 100  44,8  m" → {description: "Odvětrání radonu DN 100", quantity: 44.8, unit: "m"}
 *   "Betonové schody 15 m2" → {description: "Betonové schody", quantity: 15, unit: "m2"}
 *   "Lešení fasádní" → {description: "Lešení fasádní", quantity: 0, unit: "ks"}
 */
function parseLineWithRegex(line) {
  // Normalize Unicode superscripts to regular characters
  // m² → m2, m³ → m3
  const normalizedLine = line
    .replace(/m²/g, 'm2')
    .replace(/m³/g, 'm3')
    .replace(/²/g, '2')
    .replace(/³/g, '3');

  // Common Czech construction units (case-insensitive)
  const unitPattern = '(m3|m2|m|ks|kus|kusy|t|kg|g|l|ml|hod|h|den|dny)';

  // Pattern: (text) (number) (optional unit)
  // Examples: "text 44,8 m" or "text 15m2" or "text 44.8"
  const pattern = new RegExp(
    `^(.+?)\\s*([0-9]+[,.]?[0-9]*)\\s*${unitPattern}?\\s*$`,
    'i'
  );

  const match = normalizedLine.match(pattern);

  if (match) {
    const description = match[1].trim();
    const quantity = parseNumber(match[2]);
    const unit = match[3] ? match[3].toLowerCase() : 'ks';

    return { description, quantity, unit };
  }

  // Fallback: if no number found, treat entire line as description
  return {
    description: normalizedLine.trim(),
    quantity: 0,
    unit: 'ks'
  };
}

function findColumn(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.toString().toLowerCase().trim();
    // Ensure header is a valid string before calling .includes()
    if (header && typeof header === 'string' && keywords.some(kw => header.includes(kw))) {
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
