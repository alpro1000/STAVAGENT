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
      kod: /^(kód|kod|code|č\.p\.|čp|číslo položky|číslo|č\.|part number|item code|poloţka)$/i,
      popis: /^(popis|description|název|name|item|popis práce|popis položky|text|text položky|poloţka)$/i,
      jednotka: /^(jednotka|mj|unit|измерение|j\.m\.|měrná jednotka)$/i,
      mnozstvi: /^(množství|mnozstvi|qty|quantity|počet|počet ks|počet kusů|počet m3|počet m2|počet m)$/i,
      cena: /^(cena|price|jednotková cena|jednotková|cena za jednotku|cena/jednotku|cena za m3|jednotková cena za m3)$/i,
      stavba: /^(stavba|stavby|project|projekt|stavby/projekty)$/i
    };

    const detectedColumns = {};
    const allHeaders = new Set();

    // Collect all headers from first few rows
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      for (const key of Object.keys(row)) {
        allHeaders.add(key);
      }
    }

    // Log all headers for debugging
    if (allHeaders.size > 0) {
      const headerList = Array.from(allHeaders).join(' | ');
      logger.info(`[Preprocessor] Found ${allHeaders.size} column headers: ${headerList.substring(0, 150)}${headerList.length > 150 ? '...' : ''}`);
    }

    // Scan first few rows for column headers with strict pattern matching
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      for (const [column, pattern] of Object.entries(columnPatterns)) {
        if (detectedColumns[column]) continue;  // Already found

        for (const [key, value] of Object.entries(row)) {
          if (pattern.test(key)) {
            detectedColumns[column] = key;
            logger.info(`[Preprocessor] ✅ Detected column: ${column} → "${key}"`);
            break;
          }
        }
      }
    }

    // Fuzzy fallback: if no exact match, try partial matching
    if (Object.keys(detectedColumns).length === 0 && allHeaders.size > 0) {
      logger.warn(`[Preprocessor] ⚠️ No exact column matches found, attempting fuzzy matching...`);

      for (const header of allHeaders) {
        const headerLower = header.toLowerCase();

        // Try partial matching for each column type
        if (!detectedColumns.kod && (headerLower.includes('kod') || headerLower.includes('číslo') || headerLower.includes('item') || headerLower.includes('č.p'))) {
          detectedColumns.kod = header;
          logger.info(`[Preprocessor] 🔍 Fuzzy matched kod: "${header}"`);
        }
        if (!detectedColumns.popis && (headerLower.includes('popis') || headerLower.includes('description') || headerLower.includes('název') || headerLower.includes('text'))) {
          detectedColumns.popis = header;
          logger.info(`[Preprocessor] 🔍 Fuzzy matched popis: "${header}"`);
        }
        if (!detectedColumns.jednotka && (headerLower.includes('jednotka') || headerLower.includes('mj') || headerLower.includes('unit') || headerLower.includes('j.m'))) {
          detectedColumns.jednotka = header;
          logger.info(`[Preprocessor] 🔍 Fuzzy matched jednotka: "${header}"`);
        }
        if (!detectedColumns.mnozstvi && (headerLower.includes('množství') || headerLower.includes('qty') || headerLower.includes('počet') || headerLower.includes('m3') || headerLower.includes('m2') || headerLower.includes('quantity'))) {
          detectedColumns.mnozstvi = header;
          logger.info(`[Preprocessor] 🔍 Fuzzy matched mnozstvi: "${header}"`);
        }
        if (!detectedColumns.cena && (headerLower.includes('cena') || headerLower.includes('price') || headerLower.includes('jednotková') || headerLower.includes('jednotková cena'))) {
          detectedColumns.cena = header;
          logger.info(`[Preprocessor] 🔍 Fuzzy matched cena: "${header}"`);
        }
        if (!detectedColumns.stavba && (headerLower.includes('stavba') || headerLower.includes('projekt'))) {
          detectedColumns.stavba = header;
          logger.info(`[Preprocessor] 🔍 Fuzzy matched stavba: "${header}"`);
        }
      }
    }

    const finalCount = Object.keys(detectedColumns).length;
    if (finalCount > 0) {
      logger.info(`[Preprocessor] ✅ Column detection successful: ${finalCount} columns detected`);
      logger.info(`[Preprocessor]   Mapping: ${JSON.stringify(detectedColumns)}`);
    } else if (allHeaders.size > 0) {
      logger.warn(`[Preprocessor] ❌ Could not detect any known columns from ${allHeaders.size} available headers`);
      logger.warn(`[Preprocessor]   Sample headers: ${Array.from(allHeaders).slice(0, 5).join(', ')}`);
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
      // Create signature from important columns - check all possible column names
      const signature = [
        row.popis,
        row.Popis,
        row.description,
        row.Description,
        row._popis,
        row.název,
        row.Název,
        row.name,
        row.Name,
        row._název,
        // Look for any column that might contain description
        Object.values(row).find(v => typeof v === 'string' && v && v.length > 10)
      ]
        .filter(v => v && typeof v === 'string')
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
