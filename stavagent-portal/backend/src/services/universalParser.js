/**
 * Universal Parser Service
 *
 * Single entry point for parsing any construction Excel file.
 * Combines the best of:
 * - Registry's autoDetectService (column detection, header scoring)
 * - Monolit's concreteExtractor (concrete grade detection, work type classification)
 * - Monolit's parser (smart sheet selection, metadata extraction)
 *
 * Output: parsed_data JSON with unified format for all kiosks.
 *
 * Usage:
 *   import { parseFile } from './universalParser.js';
 *   const result = await parseFile('/path/to/file.xlsx');
 *   // result = { metadata, sheets: [{ name, items, stats }], summary }
 */

import XLSX from 'xlsx';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { normalizeForSearch } from '../utils/text.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Column detection keywords (merged from Registry + Monolit) */
const COLUMN_KEYWORDS = {
  kod: ['kód', 'kod', 'code', 'položka', 'polozka', 'item', 'číslo', 'cislo', 'č.pol', 'č.pol.', 'č. pol.'],
  popis: ['popis', 'description', 'název', 'nazev', 'name', 'text', 'práce', 'prace'],
  mj: ['mj', 'mj.', 'm.j.', 'měrná', 'merna', 'jednotka', 'unit', 'jedn.'],
  mnozstvi: ['množství', 'mnozstvi', 'quantity', 'qty', 'počet', 'pocet', 'výměra', 'vymera'],
  cenaJednotkova: ['cena', 'price', 'jednotková', 'jednotkova', 'jc', 'j.c.', 'j.cena', 'unit price', 'kč/mj'],
  cenaCelkem: ['celkem', 'total', 'celková', 'celkova', 'cena celkem', 'suma'],
};

/** Header keywords to identify header rows */
const HEADER_KEYWORDS = [
  'kód', 'kod', 'číslo', 'cislo', 'položka', 'polozka',
  'popis', 'název', 'nazev', 'description',
  'množství', 'mnozstvi', 'quantity',
  'cena', 'price', 'kč',
  'mj', 'm.j.', 'jednotka', 'unit',
  'celkem', 'total', 'součet', 'soucet',
];

/** Code pattern detection regexes */
const CODE_PATTERNS = {
  urs: /^\d{5,9}$/,                          // 231112, 231112111
  ursDotted: /^\d{2,3}\.\d{2,3}\.\d{2,3}$/,  // 23.11.12
  otskp: /^[A-Z]\d{5,}$/,                    // A12345
  rts: /^\d{3,4}-\d{3,4}$/,                  // 123-456
  construction: /^\d{3,6}(-R\d{1,2})?$/,     // 231112 or 231112-R01
};

/** Concrete grade detection */
const CONCRETE_GRADE_RE = /[CL]?\s*C\s*(\d{1,3})\s*\/\s*(\d{1,3})/i;

/** Keywords for work type detection */
const WORK_TYPE_KEYWORDS = {
  beton: ['beton', 'betonová', 'betonovaní', 'betonáž', 'žb', 'železobeton', 'monolitická', 'monolitick'],
  bedneni: ['bednění', 'bedněni', 'bedneni', 'formwork', 'systémové bednění'],
  vyztuze: ['výztuž', 'vyztuž', 'armatura', 'kari', 'pruty', 'armování', 'výztuz'],
  zemni: ['výkop', 'vykop', 'hloubení', 'hloubeni', 'zemní', 'zemni', 'pažení', 'pazeni', 'zásyp', 'zasýp', 'násyp'],
  izolace: ['hydroizolace', 'izolace', 'geotextilie', 'těsnění', 'nátěr'],
  komunikace: ['vozovka', 'asfalt', 'chodník', 'dlažba', 'komunikace', 'silnice'],
  piloty: ['piloty', 'mikropiloty', 'vrtané', 'vrtan'],
  kotveni: ['kotvy', 'injektáž', 'kotvení', 'kotven'],
  prefab: ['prefab', 'prefa', 'dílc', 'obrubník', 'obrubníky'],
  doprava: ['doprava', 'přesun', 'odvoz', 'přemístění', 'presun'],
};

/** Unit-based subtype hints */
const UNIT_SUBTYPE_MAP = {
  'm3': 'beton',
  'm³': 'beton',
  'm2': 'bedneni',
  'm²': 'bedneni',
  'kg': 'vyztuze',
  't': 'vyztuze',
};

/** Sheet name scoring keywords */
const PREFERRED_SHEET_KEYWORDS = ['soupis', 'pracovní', 'rozpočet', 'položky', 'budget', 'rekapitulace'];

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Parse an Excel file and return unified parsed_data.
 *
 * @param {string} filePath - Absolute path to the Excel file
 * @param {object} [options] - Parsing options
 * @param {string} [options.fileName] - Original file name (for metadata)
 * @returns {Promise<ParsedData>} Unified parsed data
 */
export async function parseFile(filePath, options = {}) {
  const startTime = Date.now();
  const fileName = options.fileName || path.basename(filePath);

  logger.info(`[UniversalParser] Parsing file: ${fileName}`);

  const workbook = XLSX.readFile(filePath, {
    cellFormula: false,
    cellStyles: false,
    cellDates: true,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel file has no sheets');
  }

  logger.info(`[UniversalParser] Found ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(', ')}`);

  // Parse all sheets
  const sheets = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const parsed = parseSheet(worksheet, sheetName, fileName);
    if (parsed && parsed.items.length > 0) {
      sheets.push(parsed);
    }
  }

  // Extract file-level metadata — try ALL sheets (metadata often lives in rows before data)
  let metadata = { stavba: '', objekt: '', soupis: '' };
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    // Use raw aoa (array-of-arrays) to avoid header key mangling
    const rawAoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    const extracted = extractFileMetadataFromAoa(rawAoa);
    // Merge: first non-empty wins
    if (!metadata.stavba && extracted.stavba) metadata.stavba = extracted.stavba;
    if (!metadata.objekt && extracted.objekt) metadata.objekt = extracted.objekt;
    if (!metadata.soupis && extracted.soupis) metadata.soupis = extracted.soupis;
    if (metadata.stavba && metadata.objekt && metadata.soupis) break; // All found
  }

  const bestSheet = selectBestSheet(sheets, workbook);

  metadata.fileName = fileName;
  metadata.sheetCount = workbook.SheetNames.length;
  metadata.parsedSheetCount = sheets.length;

  // Build summary
  const summary = buildSummary(sheets);

  const duration = Date.now() - startTime;
  logger.info(`[UniversalParser] Parsed ${summary.totalItems} items from ${sheets.length} sheets in ${duration}ms`);

  return {
    version: '1.0.0',
    parsedAt: new Date().toISOString(),
    durationMs: duration,
    metadata,
    sheets: sheets.map(s => ({
      name: s.name,
      bridgeId: s.bridgeId,
      bridgeName: s.bridgeName,
      items: s.items,
      stats: s.stats,
      columnMapping: s.columnMapping,
      dataStartRow: s.dataStartRow,
    })),
    summary,
  };
}

// ============================================================================
// SHEET PARSING
// ============================================================================

/**
 * Parse a single worksheet into items.
 */
function parseSheet(worksheet, sheetName, fileName) {
  // Convert to JSON rows
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: null,
    blankrows: false,
  });

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return null;
  }

  // Detect column mapping
  const columnMapping = detectColumns(rawData);
  if (!columnMapping.popis && !columnMapping.kod) {
    // No recognizable columns — skip this sheet
    logger.debug(`[UniversalParser] Sheet "${sheetName}": no recognizable columns, skipping`);
    return null;
  }

  // Detect header row and data start
  const { headerRow, dataStartRow } = detectDataStartRow(rawData, columnMapping);

  // Extract bridge info from sheet name
  const { bridgeId, bridgeName } = extractBridgeFromSheetName(sheetName);

  // Parse rows into items
  const items = [];
  let currentSection = null;
  let currentItem = null;

  for (let i = dataStartRow; i < rawData.length; i++) {
    const row = rawData[i];
    const kodValue = getColumnValue(row, columnMapping.kod);
    const popisValue = getColumnValue(row, columnMapping.popis);
    const mjValue = getColumnValue(row, columnMapping.mj);
    const mnozstviValue = getColumnValue(row, columnMapping.mnozstvi);
    const cenaJednValue = getColumnValue(row, columnMapping.cenaJednotkova);
    const cenaCelkValue = getColumnValue(row, columnMapping.cenaCelkem);

    // Skip completely empty rows
    if (!kodValue && !popisValue && !mnozstviValue && !cenaCelkValue) continue;

    // Detect row type
    const rowType = detectRowType(kodValue, popisValue, mjValue, mnozstviValue, cenaCelkValue);

    if (rowType === 'section') {
      currentSection = (popisValue || kodValue || '').trim();
      continue;
    }

    if (rowType === 'description' && currentItem) {
      // Append to previous item's description
      if (popisValue) {
        currentItem.popisDetail.push(popisValue.trim());
        currentItem.popisFull = [currentItem.popis, ...currentItem.popisDetail].join(' ');
      }
      continue;
    }

    if (rowType === 'item' || rowType === 'flexible_item') {
      const kod = kodValue ? kodValue.trim() : '';
      const popis = popisValue ? popisValue.trim() : '';
      const mj = mjValue ? mjValue.trim().toUpperCase() : '';
      const mnozstvi = parseNumber(mnozstviValue);
      const cenaJednotkova = parseNumber(cenaJednValue);
      const cenaCelkem = parseNumber(cenaCelkValue);

      // Detect work type
      const detectedType = detectWorkType(popis, mj);

      // Detect code type
      const codeType = detectCodeType(kod);

      // Detect concrete grade from description
      const concreteGrade = detectConcreteGrade(popis);

      currentItem = {
        id: uuidv4(),
        kod,
        popis,
        popisDetail: [],
        popisFull: popis,
        mj,
        mnozstvi,
        cenaJednotkova,
        cenaCelkem: cenaCelkem || (mnozstvi && cenaJednotkova ? mnozstvi * cenaJednotkova : 0),
        section: currentSection,
        detectedType,
        codeType,
        concreteGrade,
        rowType,
        source: {
          fileName,
          sheetName,
          rowNumber: i + 1 + (headerRow >= 0 ? 1 : 0), // 1-indexed, accounting for header
        },
      };

      items.push(currentItem);
    }
  }

  // Calculate stats
  const stats = calculateSheetStats(items);

  return {
    name: sheetName,
    bridgeId,
    bridgeName,
    items,
    stats,
    columnMapping,
    dataStartRow,
    rawData, // Keep for metadata extraction
  };
}

// ============================================================================
// COLUMN DETECTION
// ============================================================================

/**
 * Auto-detect column mapping from raw data.
 * Scans first 10 rows for header keywords.
 */
function detectColumns(rawData) {
  const mapping = {
    kod: null,
    popis: null,
    mj: null,
    mnozstvi: null,
    cenaJednotkova: null,
    cenaCelkem: null,
  };

  // Get all column keys from first few rows
  const allKeys = new Set();
  for (let i = 0; i < Math.min(rawData.length, 10); i++) {
    if (rawData[i]) {
      Object.keys(rawData[i]).forEach(k => allKeys.add(k));
    }
  }

  const keys = Array.from(allKeys);

  // For each target column, find the best matching key
  for (const [target, keywords] of Object.entries(COLUMN_KEYWORDS)) {
    let bestKey = null;
    let bestScore = 0;

    for (const key of keys) {
      const normalizedKey = normalizeText(key);
      for (const keyword of keywords) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalizedKey === normalizedKeyword) {
          // Exact match
          bestKey = key;
          bestScore = 100;
          break;
        } else if (normalizedKey.includes(normalizedKeyword) && normalizedKeyword.length >= 2) {
          const score = normalizedKeyword.length / normalizedKey.length * 80;
          if (score > bestScore) {
            bestKey = key;
            bestScore = score;
          }
        }
      }
      if (bestScore >= 100) break;
    }

    if (bestKey && bestScore >= 30) {
      mapping[target] = bestKey;
    }
  }

  // Fallback: if no popis found, try the widest text column
  if (!mapping.popis) {
    const textColumns = keys.filter(k => {
      const values = rawData.slice(0, 20).map(r => r[k]).filter(Boolean);
      const avgLen = values.reduce((sum, v) => sum + String(v).length, 0) / (values.length || 1);
      return avgLen > 15;
    });
    if (textColumns.length > 0) {
      // Pick the one with longest average text
      mapping.popis = textColumns.sort((a, b) => {
        const avgA = rawData.slice(0, 20).map(r => r[a]).filter(Boolean).reduce((s, v) => s + String(v).length, 0);
        const avgB = rawData.slice(0, 20).map(r => r[b]).filter(Boolean).reduce((s, v) => s + String(v).length, 0);
        return avgB - avgA;
      })[0];
    }
  }

  return mapping;
}

// ============================================================================
// DATA START ROW DETECTION
// ============================================================================

/**
 * Detect header row and data start row.
 */
function detectDataStartRow(rawData, columnMapping) {
  let headerRow = -1;
  let dataStartRow = 0;

  // Scan first 20 rows for header patterns
  for (let i = 0; i < Math.min(rawData.length, 20); i++) {
    const row = rawData[i];
    if (!row) continue;

    let headerScore = 0;
    const values = Object.values(row).filter(Boolean).map(v => String(v).trim().toLowerCase());

    for (const val of values) {
      if (HEADER_KEYWORDS.some(kw => val === kw || val.startsWith(kw))) {
        headerScore++;
      }
    }

    if (headerScore >= 2) {
      headerRow = i;
      dataStartRow = i + 1;
      break;
    }
  }

  // If no header found, try to find first meaningful row
  // Include section headers that precede first code
  if (headerRow < 0) {
    let firstCodeRow = -1;
    for (let i = 0; i < Math.min(rawData.length, 30); i++) {
      const kodValue = getColumnValue(rawData[i], columnMapping.kod);
      if (kodValue && isValidCode(kodValue.trim())) {
        firstCodeRow = i;
        break;
      }
    }

    if (firstCodeRow >= 0) {
      // Look backwards for section headers that should be included
      dataStartRow = firstCodeRow;
      for (let i = firstCodeRow - 1; i >= 0; i--) {
        const popis = getColumnValue(rawData[i], columnMapping.popis);
        if (popis && popis.trim()) {
          dataStartRow = i; // Include this pre-code row (likely section)
        } else {
          break; // Stop at first empty row going backwards
        }
      }
    }
  }

  return { headerRow, dataStartRow };
}

// ============================================================================
// ROW TYPE DETECTION
// ============================================================================

/**
 * Determine if a row is a section header, a work item, a description continuation, or skip.
 */
function detectRowType(kod, popis, mj, mnozstvi, cenaCelkem) {
  const kodTrimmed = kod ? kod.trim() : '';
  const popisTrimmed = popis ? popis.trim() : '';

  // Section: has text but no code, no quantity, no price — and text looks like a section header
  if (!kodTrimmed && popisTrimmed && !mnozstvi && !cenaCelkem) {
    // Check if text is all uppercase or starts with a section pattern
    if (popisTrimmed === popisTrimmed.toUpperCase() && popisTrimmed.length > 3 && popisTrimmed.length < 100) {
      return 'section';
    }
    // "Díl:" or "Oddíl:" pattern
    if (/^(díl|oddíl|část|section|kapitola)\s*[:.\-]/i.test(popisTrimmed)) {
      return 'section';
    }
    // Numbered section: "1 - Zemní práce" or "HSV"
    if (/^\d+\s*[-–]\s*\S/.test(popisTrimmed)) {
      return 'section';
    }
    // Short text without data = description continuation
    if (popisTrimmed.length < 200) {
      return 'description';
    }
  }

  // Item: has a valid code
  if (kodTrimmed && isValidCode(kodTrimmed)) {
    return 'item';
  }

  // Flexible item: no code but has popis + quantity or price
  if (popisTrimmed && (parseNumber(mnozstvi) > 0 || parseNumber(cenaCelkem) > 0)) {
    return 'flexible_item';
  }

  // Description continuation: only has popis
  if (popisTrimmed && !kodTrimmed) {
    return 'description';
  }

  return 'skip';
}

// ============================================================================
// WORK TYPE DETECTION
// ============================================================================

/**
 * Detect work type from description and unit.
 * Returns: 'beton', 'bedneni', 'vyztuze', 'zemni', 'izolace', 'komunikace',
 *          'piloty', 'kotveni', 'prefab', 'doprava', 'jine'
 */
function detectWorkType(popis, mj) {
  if (!popis) return 'jine';

  const normalizedPopis = normalizeText(popis);
  const normalizedMj = (mj || '').toLowerCase().trim();

  // Score each type by keyword matches
  let bestType = 'jine';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(WORK_TYPE_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (normalizedPopis.includes(normalizeText(keyword))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // If no keyword match, fall back to unit-based detection
  if (bestScore === 0 && normalizedMj) {
    const unitType = UNIT_SUBTYPE_MAP[normalizedMj];
    if (unitType) {
      bestType = unitType;
    }
  }

  // Exclude prefab from beton
  if (bestType === 'beton') {
    for (const kw of WORK_TYPE_KEYWORDS.prefab) {
      if (normalizedPopis.includes(normalizeText(kw))) {
        bestType = 'prefab';
        break;
      }
    }
  }

  return bestType;
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

/**
 * Extract file-level metadata from array-of-arrays (raw rows).
 * This avoids the header-key mangling issue of sheet_to_json.
 */
function extractFileMetadataFromAoa(rows) {
  const metadata = { stavba: '', objekt: '', soupis: '' };
  const searchKeys = {
    stavba: ['stavba', 'akce', 'project', 'název stavby', 'nazev stavby'],
    objekt: ['objekt', 'object', 'stavební objekt'],
    soupis: ['soupis', 'rozpočet', 'rozpocet', 'budget', 'čerpání'],
  };

  if (!rows || rows.length === 0) return metadata;

  // Scan first 15 rows
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    for (let j = 0; j < row.length; j++) {
      const cellStr = row[j] ? String(row[j]).trim() : '';
      if (!cellStr) continue;

      const cellLower = cellStr.toLowerCase();
      const cellClean = cellLower.replace(/[:\s]+$/, '').trim();

      for (const [field, keywords] of Object.entries(searchKeys)) {
        if (metadata[field]) continue;

        for (const kw of keywords) {
          // Cell is the keyword label (e.g. "Stavba:" or "Stavba")
          if (cellClean === kw || cellLower === kw + ':') {
            // Value is in the next cell
            if (j + 1 < row.length && row[j + 1]) {
              const val = String(row[j + 1]).trim();
              if (val && val.length > 1) {
                metadata[field] = val;
                break;
              }
            }
            // Or value is in the next row, same column
            if (i + 1 < rows.length && rows[i + 1] && rows[i + 1][j]) {
              const val = String(rows[i + 1][j]).trim();
              if (val && val.length > 1) {
                metadata[field] = val;
                break;
              }
            }
          }

          // Cell contains "keyword: value" inline
          if (cellLower.startsWith(kw + ':') || cellLower.startsWith(kw + ' :')) {
            const extracted = cellStr.replace(/^[^:]+:\s*/, '').trim();
            if (extracted && extracted.length > 1) {
              metadata[field] = extracted;
              break;
            }
          }
        }
      }
    }
  }

  return metadata;
}

/**
 * Extract file-level metadata (Stavba, Objekt, Soupis) from sheet data.
 * Supports 4 formats from Monolit's parser.
 *
 * Also checks column KEYS from sheet_to_json (since first row becomes keys).
 */
function extractFileMetadata(worksheet, rawData) {
  const metadata = { stavba: '', objekt: '', soupis: '' };
  const searchKeys = {
    stavba: ['stavba', 'akce', 'project', 'název stavby', 'nazev stavby'],
    objekt: ['objekt', 'object', 'so', 'stavební objekt'],
    soupis: ['soupis', 'rozpočet', 'rozpocet', 'budget', 'čerpání'],
  };

  if (!rawData || rawData.length === 0) return metadata;

  // Strategy 1: Check JSON column keys (first row becomes keys in sheet_to_json)
  // When row 0 is ["Stavba:", "D6 Karlovy Vary"], the keys are "Stavba:" and "D6 Karlovy Vary"
  if (rawData.length > 0) {
    const allKeys = Object.keys(rawData[0] || {});
    for (let k = 0; k < allKeys.length; k++) {
      const key = allKeys[k];
      const keyLower = key.toLowerCase().replace(/[:\s]+$/, '').trim();

      for (const [field, keywords] of Object.entries(searchKeys)) {
        if (metadata[field]) continue;

        for (const kw of keywords) {
          if (normalizeText(keyLower) === normalizeText(kw) || keyLower.startsWith(kw)) {
            // This key matches a metadata label — the VALUE is in the next column's key name
            if (k + 1 < allKeys.length) {
              const nextKey = allKeys[k + 1];
              // Make sure it's not another keyword
              const isKeyword = Object.values(searchKeys).flat().some(sk =>
                normalizeText(nextKey.replace(/[:\s]+$/, '')) === normalizeText(sk)
              );
              if (!isKeyword && nextKey.length > 2) {
                metadata[field] = nextKey;
                break;
              }
            }
          }
        }
      }
    }
  }

  // Strategy 2: Scan rows for keyword patterns
  for (let i = 0; i < Math.min(rawData.length, 15); i++) {
    const row = rawData[i];
    if (!row) continue;

    const entries = Object.entries(row);
    for (let j = 0; j < entries.length; j++) {
      const [key, value] = entries[j];
      const valStr = value ? String(value).trim() : '';
      if (!valStr) continue;

      const valLower = valStr.toLowerCase();

      for (const [field, keywords] of Object.entries(searchKeys)) {
        if (metadata[field]) continue; // Already found

        for (const kw of keywords) {
          // Format 1: Column header matches keyword
          if (normalizeText(key).includes(normalizeText(kw))) {
            if (valStr && valStr.length > 1 && !keywords.some(k => normalizeText(valStr) === normalizeText(k))) {
              metadata[field] = valStr;
              break;
            }
          }

          // Format 2: Value starts with keyword + colon
          if (valLower.startsWith(kw + ':') || valLower.startsWith(kw + ' :')) {
            const extracted = valStr.replace(/^[^:]+:\s*/, '').trim();
            if (extracted) {
              metadata[field] = extracted;
              break;
            }
          }

          // Format 3: Value IS the keyword → look at next column or next row
          if (valLower === kw || valLower === kw + ':') {
            // Next column in same row
            if (j + 1 < entries.length) {
              const nextVal = entries[j + 1][1];
              if (nextVal && String(nextVal).trim()) {
                metadata[field] = String(nextVal).trim();
                break;
              }
            }
            // Next row, same column
            if (i + 1 < rawData.length && rawData[i + 1]) {
              const nextRowVal = rawData[i + 1][key];
              if (nextRowVal && String(nextRowVal).trim()) {
                metadata[field] = String(nextRowVal).trim();
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

// ============================================================================
// BRIDGE EXTRACTION FROM SHEET NAME
// ============================================================================

/**
 * Extract bridge ID and name from sheet name.
 * Priority: "SO 201 - MOST..." → { bridgeId: "SO201", bridgeName: "MOST..." }
 */
function extractBridgeFromSheetName(sheetName) {
  if (!sheetName) return { bridgeId: null, bridgeName: sheetName };

  const trimmed = sheetName.trim();

  // Compound ID: SO 12-23-01
  const compoundMatch = trimmed.match(/^SO\s*(\d{1,3}[-\/]\d{1,3}[-\/]\d{1,3})/i);
  if (compoundMatch) {
    const id = 'SO' + compoundMatch[1].replace(/\s/g, '');
    return { bridgeId: id, bridgeName: trimmed };
  }

  // Bridge format: SO 201 - MOST...
  const bridgeMatch = trimmed.match(/^SO\s*(\d{1,4})\s*[-–]\s*(.+)/i);
  if (bridgeMatch) {
    return { bridgeId: 'SO' + bridgeMatch[1], bridgeName: bridgeMatch[2].trim() };
  }

  // Simple SO: SO 201
  const simpleSOMatch = trimmed.match(/^SO\s*(\d{1,4})/i);
  if (simpleSOMatch) {
    return { bridgeId: 'SO' + simpleSOMatch[1], bridgeName: trimmed };
  }

  // 3-digit number
  const numberMatch = trimmed.match(/^(\d{3,4})$/);
  if (numberMatch) {
    return { bridgeId: 'SO' + numberMatch[1], bridgeName: `Object ${numberMatch[1]}` };
  }

  return { bridgeId: null, bridgeName: trimmed };
}

// ============================================================================
// BEST SHEET SELECTION
// ============================================================================

/**
 * Select the best sheet for metadata and primary data.
 */
function selectBestSheet(sheets, workbook) {
  if (sheets.length === 0) return null;
  if (sheets.length === 1) return sheets[0];

  let bestSheet = sheets[0];
  let bestScore = 0;

  for (const sheet of sheets) {
    let score = sheet.items.length; // More items = higher score

    // Preferred name bonus
    const nameLower = sheet.name.toLowerCase();
    for (const kw of PREFERRED_SHEET_KEYWORDS) {
      if (nameLower.includes(kw)) {
        score += 1000;
        break;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSheet = sheet;
    }
  }

  return bestSheet;
}

// ============================================================================
// SUMMARY BUILDER
// ============================================================================

/**
 * Build a summary of parsed data for preview.
 */
function buildSummary(sheets) {
  const allItems = sheets.flatMap(s => s.items);

  const byType = {};
  for (const item of allItems) {
    const type = item.detectedType || 'jine';
    if (!byType[type]) {
      byType[type] = { count: 0, totalCena: 0 };
    }
    byType[type].count++;
    byType[type].totalCena += item.cenaCelkem || 0;
  }

  // Kiosk routing suggestions
  const kioskSuggestions = {
    monolit: {
      count: allItems.filter(i => ['beton', 'bedneni', 'vyztuze'].includes(i.detectedType)).length,
      types: ['beton', 'bedneni', 'vyztuze'],
      description: 'Betonové práce, bednění, výztuž',
    },
    registry: {
      count: allItems.length,
      types: Object.keys(byType),
      description: 'Všechny pozice pro klasifikaci a oceňování',
    },
    urs_matcher: {
      count: allItems.filter(i => i.popis && i.popis.length > 5).length,
      types: ['matching'],
      description: 'Popisy prací pro přiřazení ÚRS kódů',
    },
  };

  const withConcreteGrade = allItems.filter(i => i.concreteGrade).length;
  const withCode = allItems.filter(i => i.kod).length;
  const withPrice = allItems.filter(i => i.cenaCelkem > 0).length;

  return {
    totalItems: allItems.length,
    totalSheets: sheets.length,
    totalCena: allItems.reduce((sum, i) => sum + (i.cenaCelkem || 0), 0),
    byType,
    withConcreteGrade,
    withCode,
    withPrice,
    kioskSuggestions,
  };
}

// ============================================================================
// STATS CALCULATOR
// ============================================================================

function calculateSheetStats(items) {
  return {
    totalItems: items.length,
    totalCena: items.reduce((sum, i) => sum + (i.cenaCelkem || 0), 0),
    byType: items.reduce((acc, i) => {
      const t = i.detectedType || 'jine';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {}),
    sections: [...new Set(items.map(i => i.section).filter(Boolean))],
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse a Czech number string (comma as decimal separator).
 */
function parseNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;

  const str = String(value).trim();
  if (!str) return 0;

  // Remove spaces (thousands separator)
  let cleaned = str.replace(/\s/g, '');
  // Replace comma with dot
  cleaned = cleaned.replace(',', '.');
  // Remove non-numeric chars except dot and minus
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize text for comparison (strip diacritics, lowercase).
 */
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Check if a string looks like a valid construction code.
 */
function isValidCode(value) {
  if (!value) return false;
  const trimmed = value.trim();

  // Skip header keywords
  if (HEADER_KEYWORDS.some(kw => normalizeText(trimmed) === normalizeText(kw))) {
    return false;
  }

  // Check against known patterns
  return (
    CODE_PATTERNS.urs.test(trimmed) ||
    CODE_PATTERNS.ursDotted.test(trimmed) ||
    CODE_PATTERNS.otskp.test(trimmed) ||
    CODE_PATTERNS.rts.test(trimmed) ||
    CODE_PATTERNS.construction.test(trimmed) ||
    /^\d{3,}$/.test(trimmed) // Fallback: 3+ digits
  );
}

/**
 * Detect the type of code.
 */
function detectCodeType(kod) {
  if (!kod) return null;
  const trimmed = kod.trim();

  if (CODE_PATTERNS.urs.test(trimmed) || CODE_PATTERNS.ursDotted.test(trimmed)) return 'urs';
  if (CODE_PATTERNS.otskp.test(trimmed)) return 'otskp';
  if (CODE_PATTERNS.rts.test(trimmed)) return 'rts';
  if (CODE_PATTERNS.construction.test(trimmed)) return 'construction';
  return 'unknown';
}

/**
 * Detect concrete grade from description.
 */
function detectConcreteGrade(popis) {
  if (!popis) return null;
  const match = popis.match(CONCRETE_GRADE_RE);
  if (match) return `C${match[1]}/${match[2]}`;
  return null;
}

/**
 * Get value from row using column key (handles dynamic keys).
 */
function getColumnValue(row, columnKey) {
  if (!row || !columnKey) return null;

  // Direct key access
  if (row[columnKey] !== undefined && row[columnKey] !== null) {
    return String(row[columnKey]);
  }

  // Fuzzy key matching (case-insensitive)
  const normalizedKey = normalizeText(columnKey);
  for (const [key, value] of Object.entries(row)) {
    if (normalizeText(key) === normalizedKey && value !== null && value !== undefined) {
      return String(value);
    }
  }

  return null;
}

export default { parseFile };
