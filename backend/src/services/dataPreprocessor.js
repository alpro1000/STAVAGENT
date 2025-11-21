/**
 * Data Preprocessor for CORE
 * Normalizes Czech Excel data before sending to CORE parser
 * Improves CORE's ability to identify positions
 */

import { logger } from '../utils/logger.js';

class DataPreprocessor {
  /**
   * Normalize Czech text encoding and characters
   * @param {string} text - Input text
   * @returns {string} Normalized text
   */
  static normalizeText(text) {
    if (!text || typeof text !== 'string') return '';

    return text
      // Fix common encoding issues
      .replace(/\u0308/g, '')  // Remove diacritical marks artifacts
      .trim()
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
  }

  /**
   * Clean and normalize Excel raw rows for CORE
   * @param {Array} rawRows - Raw rows from Excel
   * @returns {Array} Cleaned rows
   */
  static cleanRawRows(rawRows) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return [];
    }

    const cleaned = [];

    for (const row of rawRows) {
      try {
        const cleanedRow = {};

        // Process each cell
        for (const [key, value] of Object.entries(row)) {
          if (value === null || value === undefined || value === '') {
            continue;  // Skip empty cells
          }

          // Normalize key
          const cleanKey = this.normalizeText(String(key));

          // Normalize value
          let cleanValue = value;
          if (typeof value === 'string') {
            cleanValue = this.normalizeText(value);
          } else if (typeof value === 'number') {
            cleanValue = value;
          } else {
            cleanValue = String(value);
          }

          cleanedRow[cleanKey] = cleanValue;
        }

        // Only include rows with content
        if (Object.keys(cleanedRow).length > 0) {
          cleaned.push(cleanedRow);
        }
      } catch (error) {
        logger.warn(`[Preprocessor] Error cleaning row: ${error.message}`);
        // Continue with next row
      }
    }

    logger.info(`[Preprocessor] Cleaned ${rawRows.length} rows → ${cleaned.length} rows with content`);
    return cleaned;
  }

  /**
   * Detect and normalize Czech column names
   * @param {Array} rows - Excel rows
   * @returns {Object} Mapping of detected columns
   */
  static detectColumns(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return {};
    }

    const columnPatterns = {
      kod: /^(kód|kod|code|č\.p\.|čp|číslo položky)$/i,
      popis: /^(popis|description|název|name|item)$/i,
      jednotka: /^(jednotka|mj|unit|измерение)$/i,
      mnozstvi: /^(množství|mnozstvi|qty|quantity|počet)$/i,
      cena: /^(cena|price|jednotková cena)$/i,
      stavba: /^(stavba|stavby|project|projekt)$/i
    };

    const detectedColumns = {};

    // Scan first few rows for column headers
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      for (const [column, pattern] of Object.entries(columnPatterns)) {
        if (detectedColumns[column]) continue;  // Already found

        for (const [key, value] of Object.entries(row)) {
          if (pattern.test(key)) {
            detectedColumns[column] = key;
            logger.info(`[Preprocessor] Detected column: ${column} → "${key}"`);
            break;
          }
        }
      }
    }

    return detectedColumns;
  }

  /**
   * Enhance rows with detected column information
   * @param {Array} rows - Excel rows
   * @param {Object} columnMapping - Detected column mapping
   * @returns {Array} Enhanced rows
   */
  static enhanceWithColumns(rows, columnMapping) {
    if (!Array.isArray(rows) || Object.keys(columnMapping).length === 0) {
      return rows;
    }

    const enhanced = [];

    for (const row of rows) {
      const enhancedRow = { ...row };

      // Add standardized column names
      for (const [standard, actual] of Object.entries(columnMapping)) {
        if (actual && row[actual] !== undefined) {
          enhancedRow[`_${standard}`] = row[actual];
        }
      }

      enhanced.push(enhancedRow);
    }

    logger.info(`[Preprocessor] Enhanced ${rows.length} rows with column mapping`);
    return enhanced;
  }

  /**
   * Remove duplicate rows (by key columns)
   * @param {Array} rows - Excel rows
   * @returns {Array} De-duplicated rows
   */
  static deduplicateRows(rows) {
    if (!Array.isArray(rows)) return rows;

    const seen = new Set();
    const deduplicated = [];

    for (const row of rows) {
      // Create signature from important columns
      const signature = [
        row.popis,
        row.Popis,
        row.description,
        row._popis
      ]
        .filter(v => v)
        .join('|');

      if (signature && seen.has(signature)) {
        logger.debug(`[Preprocessor] Removed duplicate: ${signature.substring(0, 50)}`);
        continue;
      }

      if (signature) seen.add(signature);
      deduplicated.push(row);
    }

    if (deduplicated.length < rows.length) {
      logger.info(`[Preprocessor] Removed ${rows.length - deduplicated.length} duplicate rows`);
    }

    return deduplicated;
  }

  /**
   * Full preprocessing pipeline for CORE
   * @param {Array} rawRows - Raw Excel rows
   * @returns {Object} { rows, columnMapping, stats }
   */
  static preprocess(rawRows) {
    logger.info(`[Preprocessor] Starting preprocessing pipeline...`);

    const stats = {
      inputRows: rawRows.length,
      afterCleaning: 0,
      afterDedup: 0,
      columnsDetected: 0
    };

    // Step 1: Clean rows
    let processed = this.cleanRawRows(rawRows);
    stats.afterCleaning = processed.length;
    logger.info(`[Preprocessor] After cleaning: ${stats.afterCleaning} rows`);

    // Step 2: Detect columns
    const columnMapping = this.detectColumns(processed);
    stats.columnsDetected = Object.keys(columnMapping).length;
    logger.info(`[Preprocessor] Detected ${stats.columnsDetected} column types`);

    // Step 3: Enhance with columns
    processed = this.enhanceWithColumns(processed, columnMapping);

    // Step 4: Remove duplicates
    processed = this.deduplicateRows(processed);
    stats.afterDedup = processed.length;
    logger.info(`[Preprocessor] After deduplication: ${stats.afterDedup} rows`);

    // Step 5: Log summary
    logger.info(`[Preprocessor] ✅ Preprocessing complete:`);
    logger.info(`  Input: ${stats.inputRows} rows`);
    logger.info(`  Output: ${stats.afterDedup} rows`);
    logger.info(`  Removed: ${stats.inputRows - stats.afterDedup} rows`);
    logger.info(`  Columns detected: ${stats.columnsDetected}`);

    return {
      rows: processed,
      columnMapping,
      stats
    };
  }
}

export default DataPreprocessor;
