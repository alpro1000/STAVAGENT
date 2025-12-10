#!/usr/bin/env node

/**
 * Import URS Catalog from CSV/XLSX
 *
 * Usage:
 *   node scripts/import_urs_catalog.mjs --from-csv ./data/urs_export.csv
 *   node scripts/import_urs_catalog.mjs --from-csv ./data/urs_export.xlsx --truncate
 *
 * Expected CSV columns (flexible naming):
 *   - code / kód / urs_code / Code
 *   - name / název / urs_name / Description
 *   - unit / mj / measure_unit / Unit
 *   - section / třídník / section_code (optional, extracted from code if missing)
 *   - description / popis / desc (optional)
 *   - category_path / cesta / path (optional)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// UTILITIES
// ============================================================================

function log(msg, type = 'info') {
  const timestamp = new Date().toISOString().substring(11, 19);
  const prefix = {
    'info': '✓',
    'warn': '⚠',
    'error': '✗',
    'debug': '→'
  }[type] || '•';

  console.log(`[${timestamp}] ${prefix} ${msg}`);
}

function extractSectionCode(code) {
  // Extract first 2-3 digits from code as section code
  // Examples: '274313811' -> '27', '311234' -> '31', '21xyz' -> '21'
  const match = code.match(/^(\d{2,3})/);
  return match ? match[1] : null;
}

// ============================================================================
// PARSE FILE
// ============================================================================

async function parseFile(filePath) {
  log(`Reading file: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv' || ext === '.tsv') {
    return parseCSV(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Auto-detect delimiter
  const delimiter = content.includes('\t') ? '\t' : ',';

  const records = parse(content, {
    columns: true,  // First row = headers
    skip_empty_lines: true,
    relax_column_count: true,
    delimiter: delimiter
  });

  log(`Parsed ${records.length} rows from CSV`);
  return records;
}

async function parseExcel(filePath) {
  // Dynamic import for xlsx (optional dependency)
  try {
    const xlsx = await import('xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const records = xlsx.utils.sheet_to_json(worksheet);

    log(`Parsed ${records.length} rows from Excel (sheet: ${sheetName})`);
    return records;
  } catch (error) {
    throw new Error(`Failed to parse Excel: ${error.message}. Install xlsx: npm install xlsx`);
  }
}

// ============================================================================
// MAP COLUMNS (OPTIMIZED)
// ============================================================================

// Determine header mapping once per import (calculated from first record)
function getHeaderMapping(record) {
  const headerMap = {};
  const recordKeys = Object.keys(record);

  const fieldMap = {
    code: ['code', 'kód', 'urs_code', 'Code', 'ÚRS kód', 'catalog_code'],
    name: ['name', 'název', 'urs_name', 'Description', 'Název', 'Item Name'],
    unit: ['unit', 'mj', 'measure_unit', 'Unit', 'MJ', 'Jednotka'],
    section_code: ['section', 'třídník', 'section_code', 'Section', 'Třída'],
    description: ['description', 'popis', 'desc', 'Description', 'Popis', 'Notes'],
    category_path: ['category_path', 'cesta', 'path', 'Category', 'Category Path']
  };

  // Try to find matching headers (case-insensitive)
  for (const [target, sources] of Object.entries(fieldMap)) {
    for (const source of sources) {
      const key = recordKeys.find(k => k.toLowerCase().trim() === source.toLowerCase());
      if (key) {
        headerMap[target] = key;
        break;
      }
    }
  }

  // Validate required fields
  if (!headerMap.code) {
    throw new Error(`Cannot find 'code' column. Available columns: ${recordKeys.join(', ')}`);
  }
  if (!headerMap.name) {
    throw new Error(`Cannot find 'name' column`);
  }
  if (!headerMap.unit) {
    throw new Error(`Cannot find 'unit' column. Available columns: ${recordKeys.join(', ')}`);
  }

  return headerMap;
}

// Normalize a single record using pre-determined header mapping
function normalizeRecord(record, headerMap) {
  const normalized = {};

  // Map fields using pre-determined header mapping
  for (const [target, sourceKey] of Object.entries(headerMap)) {
    normalized[target] = record[sourceKey];
  }

  // Auto-extract section code if missing
  if (!normalized.section_code) {
    normalized.section_code = extractSectionCode(normalized.code);
  }

  return normalized;
}

// ============================================================================
// IMPORT INTO DATABASE
// ============================================================================

async function importIntoDB(records, options = {}) {
  const { truncate = false, batchSize = 500 } = options;

  const dbPath = path.join(__dirname, '../data/urs_matcher.db');
  log(`Connecting to database: ${dbPath}`);

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // Optionally truncate
    if (truncate) {
      log('Truncating urs_items table...', 'warn');
      await db.run('DELETE FROM urs_items WHERE is_imported = 1');
      log('Truncated');
    }

    // OPTIMIZATION: Determine header mapping once from first record
    if (records.length === 0) {
      throw new Error('No records to import');
    }
    const headerMap = getHeaderMapping(records[0]);
    log(`Detected header mapping: code="${headerMap.code}", name="${headerMap.name}", unit="${headerMap.unit}"`);

    // Statistics
    let successCount = 0;
    let skipCount = 0;
    const sectionStats = {};

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, Math.min(i + batchSize, records.length));

      // Use transaction for batch
      await db.run('BEGIN TRANSACTION');

      try {
        for (const record of batch) {
          try {
            const normalized = normalizeRecord(record, headerMap);

            // Validate code format
            if (!normalized.code || normalized.code.trim().length === 0) {
              skipCount++;
              continue;
            }

            const code = normalized.code.toString().trim();
            const name = normalized.name.toString().trim();
            const unit = normalized.unit.toString().trim();
            const sectionCode = normalized.section_code || extractSectionCode(code);
            const description = normalized.description?.toString().trim() || null;
            const categoryPath = normalized.category_path?.toString().trim() || null;

            // Insert
            await db.run(
              `INSERT OR REPLACE INTO urs_items
               (urs_code, urs_name, unit, section_code, description, category_path, is_imported, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
              [code, name, unit, sectionCode, description, categoryPath]
            );

            successCount++;

            // Track section statistics
            if (sectionCode) {
              sectionStats[sectionCode] = (sectionStats[sectionCode] || 0) + 1;
            }

          } catch (rowError) {
            log(`Skipping row: ${rowError.message}`, 'debug');
            skipCount++;
          }
        }

        await db.run('COMMIT');

        // Progress
        const progressPercent = Math.round((Math.min(i + batchSize, records.length) / records.length) * 100);
        log(`Progress: ${progressPercent}% (${successCount} imported, ${skipCount} skipped)`);

      } catch (batchError) {
        await db.run('ROLLBACK');
        throw batchError;
      }
    }

    // Summary
    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`IMPORT COMPLETE`, 'info');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    log(`Total rows processed: ${records.length}`);
    log(`Successfully imported: ${successCount}`);
    log(`Skipped/failed: ${skipCount}`);

    // Verify in database
    const countResult = await db.get('SELECT COUNT(*) as count FROM urs_items WHERE is_imported = 1');
    log(`Total in database: ${countResult.count}`);

    // Section statistics
    if (Object.keys(sectionStats).length > 0) {
      log('');
      log('Section breakdown:');
      const sortedSections = Object.entries(sectionStats)
        .sort(([a], [b]) => a.localeCompare(b));

      for (const [section, count] of sortedSections) {
        log(`  ${section}: ${count} items`);
      }
    }

    log('');
    log(`Database updated successfully!`);
    return { successCount, skipCount, totalInDB: countResult.count };

  } finally {
    await db.close();
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log(`
Usage: node scripts/import_urs_catalog.mjs [options]

Options:
  --from-csv <path>    CSV/XLSX file with URS catalog
  --truncate          Delete existing imported items before import (optional)
  --help              Show this help

Example:
  node scripts/import_urs_catalog.mjs --from-csv ./data/urs_export.csv
  node scripts/import_urs_catalog.mjs --from-csv ./data/urs_export.xlsx --truncate

Expected columns (flexible):
  - code / kód / urs_code
  - name / název / urs_name
  - unit / mj / measure_unit
  - section / třídník (auto-extracted if missing)
  - description / popis (optional)
  - category_path / cesta (optional)
      `);
      process.exit(0);
    }

    let filePath = null;
    let truncate = false;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--from-csv') {
        filePath = args[i + 1];
        i++;
      } else if (args[i] === '--truncate') {
        truncate = true;
      } else if (args[i] === '--help') {
        console.log('Use --from-csv <path> to import');
        process.exit(0);
      }
    }

    if (!filePath) {
      throw new Error('Missing --from-csv argument');
    }

    // Parse file
    log(`Starting URS Catalog Import`);
    log('');
    const records = await parseFile(filePath);

    if (records.length === 0) {
      throw new Error('No records found in file');
    }

    // Import
    log(`Found ${records.length} records to import`);
    log('');

    const result = await importIntoDB(records, { truncate });

    process.exit(0);

  } catch (error) {
    log(`FATAL ERROR: ${error.message}`, 'error');
    log(error.stack, 'debug');
    process.exit(1);
  }
}

main();
