/**
 * Excel Structure Auto-Detection Service
 *
 * Phase 4+: Fuzzy header detection with normalized matching.
 * Scans first 20 rows, finds header row by ≥3 keyword hits,
 * assigns columns, skips numeric sub-header rows, computes % shoda.
 */

import * as XLSX from 'xlsx';
import type { ImportTemplate } from '../../types/template';
import type { ImportConfig, ColumnMapping } from '../../types/config';
import { PREDEFINED_TEMPLATES } from '../../config/templates';

/**
 * Detection result with match score
 */
export interface DetectionResult {
  template: ImportTemplate;
  matchScore: number;        // 0-100
  confidence: 'high' | 'medium' | 'low';
  detectedColumns: Partial<ColumnMapping>;
  detectedStartRow: number;
  reasoning: string[];       // Explanation of detection
}

/**
 * Per-sheet detection result (for multi-sheet imports)
 */
export interface SheetDetectionResult {
  sheetName: string;
  matchScore: number;
  fieldsFound: number;
  fieldsTotal: 6;
  detectedColumns: Partial<ColumnMapping>;
  detectedStartRow: number;
  headerRow: number;
  reasoning: string[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Multi-sheet detection summary
 */
export interface MultiSheetDetectionResult {
  sheets: SheetDetectionResult[];
  allSameStructure: boolean;
  summary: string;
}

// ─── Fuzzy keyword patterns (case-insensitive, matched via includes) ────────

type FieldKey = keyof ColumnMapping;

const FIELD_PATTERNS: Record<FieldKey, string[]> = {
  kod: [
    'kód', 'kod', 'kód pol', 'kod pol', 'číslo pol', 'cislo pol',
    'položky', 'polozky', 'item', 'code', 'č. pol', 'poř. číslo',
    'por. cislo', 'poř.číslo', 'pč',
  ],
  popis: [
    'popis', 'název', 'nazev', 'name', 'označení', 'oznaceni',
    'description', 'text polož', 'název polož',
  ],
  mj: [
    'mj', 'j.m', 'jedn.m', 'unit', 'jednotka', 'měrná', 'merna',
    'měr.j', 'mer.j',
  ],
  mnozstvi: [
    'množství', 'mnozstvi', 'quantity', 'počet', 'pocet', 'qty',
    'výměra', 'vymera',
  ],
  cenaJednotkova: [
    'j.cena', 'jedn.cena', 'jednotková', 'jednotkova', 'unit price',
    'cena/mj', 'kč/mj', 'kc/mj', 'jednotková cena',
  ],
  cenaCelkem: [
    'celkem', 'cena cel', 'total', 'celková', 'celkova',
    'cena celkem', 'total price',
  ],
};

const FIELD_LABELS: Record<FieldKey, string> = {
  kod: 'kód',
  popis: 'popis',
  mj: 'měrná jednotka',
  mnozstvi: 'množství',
  cenaJednotkova: 'jednotková cena',
  cenaCelkem: 'celková cena',
};

const ALL_FIELDS: FieldKey[] = ['kod', 'popis', 'mj', 'mnozstvi', 'cenaJednotkova', 'cenaCelkem'];

/**
 * Normalize cell text for matching: lowercase, strip brackets, [CZK], extra spaces
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[.*?\]/g, '')   // remove [CZK], [Kč], etc.
    .replace(/\(.*?\)/g, '')   // remove parentheses content
    .replace(/[_\-\/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a normalized cell text matches any pattern for a given field.
 * Returns number of matching patterns (0 = no match).
 */
function matchField(normalizedText: string, field: FieldKey): number {
  if (!normalizedText) return 0;
  let hits = 0;
  for (const pattern of FIELD_PATTERNS[field]) {
    if (normalizedText.includes(pattern)) hits++;
  }
  return hits;
}

/**
 * Check if a row is a numeric sub-header (cells contain only single digits 1-9)
 */
function isNumericSubHeader(row: Record<string, string>): boolean {
  const values = Object.values(row).filter(v => v.trim() !== '');
  if (values.length < 3) return false;
  return values.every(v => /^\d{1,2}$/.test(v.trim()));
}

// ─── Core detection ─────────────────────────────────────────────────────────

interface HeaderDetection {
  headerRow: number;           // 0-based row index
  columns: Partial<ColumnMapping>;
  fieldsFound: number;
  dataStartRow: number;        // 1-based
  reasoning: string[];
}

/**
 * Scan sheet to find header row and map columns via fuzzy matching.
 */
function detectHeaderAndColumns(sheet: XLSX.WorkSheet): HeaderDetection | null {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const maxRow = Math.min(range.e.r, 25); // scan first 25 rows
  const maxCol = Math.min(range.e.c, 25); // scan first 25 columns

  let bestRow = -1;
  let bestScore = 0;
  let bestMapping: Record<FieldKey, { col: string; hits: number; header: string }> = {} as any;

  for (let row = 0; row <= maxRow; row++) {
    // Read all cells in this row
    const rowData: Record<string, string> = {};
    for (let col = 0; col <= maxCol; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddr];
      const value = cell?.v?.toString().trim() || '';
      if (value) {
        const colLetter = XLSX.utils.encode_col(col);
        rowData[colLetter] = value;
      }
    }

    if (Object.keys(rowData).length < 3) continue;

    // For each field, find best column in this row
    const mapping: Record<string, { col: string; hits: number; header: string }> = {};
    const usedCols = new Set<string>();

    for (const field of ALL_FIELDS) {
      let bestCol = '';
      let bestHits = 0;
      let bestHeader = '';

      for (const [colLetter, rawText] of Object.entries(rowData)) {
        if (usedCols.has(colLetter)) continue;
        const norm = normalize(rawText);
        const hits = matchField(norm, field);
        if (hits > bestHits) {
          bestHits = hits;
          bestCol = colLetter;
          bestHeader = rawText;
        }
      }

      if (bestCol && bestHits > 0) {
        mapping[field] = { col: bestCol, hits: bestHits, header: bestHeader };
        usedCols.add(bestCol);
      }
    }

    // Resolve conflicts: if cenaJednotkova and cenaCelkem both want the same column,
    // check for "celkem" specifically in cenaCelkem patterns
    if (mapping.cenaJednotkova && mapping.cenaCelkem &&
        mapping.cenaJednotkova.col === mapping.cenaCelkem.col) {
      // Re-scan: find separate columns for each
      const jedCol = mapping.cenaJednotkova.col;
      // Try to find another column for cenaCelkem
      for (const [colLetter, rawText] of Object.entries(rowData)) {
        if (colLetter === jedCol) continue;
        const norm = normalize(rawText);
        if (norm.includes('celkem') || norm.includes('total')) {
          mapping.cenaCelkem = { col: colLetter, hits: 1, header: rawText };
          break;
        }
      }
      // If still same, try finding another for cenaJednotkova
      if (mapping.cenaJednotkova.col === mapping.cenaCelkem?.col) {
        for (const [colLetter, rawText] of Object.entries(rowData)) {
          if (colLetter === mapping.cenaCelkem.col) continue;
          const norm = normalize(rawText);
          if (norm.includes('jedn') || norm.includes('j.cena') || norm.includes('unit price')) {
            mapping.cenaJednotkova = { col: colLetter, hits: 1, header: rawText };
            break;
          }
        }
      }
    }

    const fieldsFound = Object.keys(mapping).length;
    if (fieldsFound >= 3 && fieldsFound > bestScore) {
      bestScore = fieldsFound;
      bestRow = row;
      bestMapping = mapping as any;
    }
  }

  if (bestRow < 0) return null;

  // Determine dataStartRow: skip numeric sub-header row if present
  let dataStartRow = bestRow + 2; // 1-based (bestRow is 0-based, +1 for next row, +1 for 1-based)

  // Check if the row right after header is a numeric sub-header
  const nextRowData: Record<string, string> = {};
  for (let col = 0; col <= maxCol; col++) {
    const cellAddr = XLSX.utils.encode_cell({ r: bestRow + 1, c: col });
    const cell = sheet[cellAddr];
    const value = cell?.v?.toString().trim() || '';
    if (value) {
      nextRowData[XLSX.utils.encode_col(col)] = value;
    }
  }
  if (isNumericSubHeader(nextRowData)) {
    dataStartRow = bestRow + 3; // skip the sub-header too
  }

  // Build result
  const columns: Partial<ColumnMapping> = {};
  const reasoning: string[] = [];

  for (const field of ALL_FIELDS) {
    const m = bestMapping[field];
    if (m) {
      columns[field] = m.col;
      reasoning.push(`✓ ${FIELD_LABELS[field]}: sloupec ${m.col} ("${m.header}")`);
    } else {
      reasoning.push(`✗ ${FIELD_LABELS[field]}: nenalezeno`);
    }
  }

  return {
    headerRow: bestRow,
    columns,
    fieldsFound: Object.keys(columns).length,
    dataStartRow,
    reasoning,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect Excel structure and suggest best template.
 * Returns results sorted by match score (highest first).
 */
export async function detectExcelStructure(
  workbook: XLSX.WorkBook,
  sheetName?: string
): Promise<DetectionResult[]> {
  const name = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];

  if (!sheet) {
    throw new Error('Sheet not found');
  }

  const detection = detectHeaderAndColumns(sheet);

  if (!detection) {
    // Fallback: return predefined templates with 0% score
    return PREDEFINED_TEMPLATES.map(t => ({
      template: t,
      matchScore: 0,
      confidence: 'low' as const,
      detectedColumns: {},
      detectedStartRow: 2,
      reasoning: ['✗ Nebyl nalezen řádek s hlavičkami'],
    }));
  }

  const matchScore = Math.round((detection.fieldsFound / 6) * 100);
  const confidence: 'high' | 'medium' | 'low' =
    matchScore >= 67 ? 'high' : matchScore >= 50 ? 'medium' : 'low';

  // Create a "detected" result for each predefined template,
  // but use the actually detected columns/startRow
  const results: DetectionResult[] = PREDEFINED_TEMPLATES.map(template => {
    // Give a small bonus if template type matches code pattern in detected data
    let bonus = 0;
    const templateType = template.metadata.type;
    if (templateType === 'flexible') bonus = -5; // flexible is fallback

    return {
      template: {
        ...template,
        config: {
          ...template.config,
          columns: {
            ...template.config.columns,
            ...detection.columns,
          } as ColumnMapping,
          dataStartRow: detection.dataStartRow,
        },
      },
      matchScore: Math.min(100, matchScore + bonus),
      confidence,
      detectedColumns: detection.columns,
      detectedStartRow: detection.dataStartRow,
      reasoning: detection.reasoning,
    };
  });

  // Sort by score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results;
}

/**
 * Detect structure for all sheets in a workbook.
 */
export async function detectAllSheets(
  workbook: XLSX.WorkBook
): Promise<MultiSheetDetectionResult> {
  const sheets: SheetDetectionResult[] = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    const detection = detectHeaderAndColumns(sheet);

    if (detection) {
      const matchScore = Math.round((detection.fieldsFound / 6) * 100);
      sheets.push({
        sheetName: name,
        matchScore,
        fieldsFound: detection.fieldsFound,
        fieldsTotal: 6,
        detectedColumns: detection.columns,
        detectedStartRow: detection.dataStartRow,
        headerRow: detection.headerRow,
        reasoning: detection.reasoning,
        confidence: matchScore >= 67 ? 'high' : matchScore >= 50 ? 'medium' : 'low',
      });
    } else {
      sheets.push({
        sheetName: name,
        matchScore: 0,
        fieldsFound: 0,
        fieldsTotal: 6,
        detectedColumns: {},
        detectedStartRow: 2,
        headerRow: -1,
        reasoning: ['✗ Nebyl nalezen řádek s hlavičkami'],
        confidence: 'low',
      });
    }
  }

  // Check if all sheets have same structure
  const allSameStructure = sheets.length > 1 && sheets.every(s => {
    const first = sheets[0];
    return s.fieldsFound === first.fieldsFound &&
      JSON.stringify(s.detectedColumns) === JSON.stringify(first.detectedColumns) &&
      s.detectedStartRow === first.detectedStartRow;
  });

  // Build summary
  let summary: string;
  if (sheets.length === 0) {
    summary = 'Žádné listy k analýze';
  } else if (sheets.length === 1) {
    const s = sheets[0];
    summary = `${s.sheetName}: ${s.fieldsFound}/6 polí`;
  } else if (allSameStructure) {
    summary = `Všechny listy mají stejnou strukturu ✓ (${sheets[0].fieldsFound}/6)`;
  } else {
    summary = sheets.map(s =>
      `${s.sheetName}: ${s.confidence === 'high' ? '✓' : s.confidence === 'medium' ? '⚠' : '✗'} (${s.fieldsFound}/6${s.fieldsFound < 4 ? ', nutná ruční konfigurace' : ''})`
    ).join(' | ');
  }

  return { sheets, allSameStructure, summary };
}

/**
 * Apply detected config to custom config
 */
export function applyDetectedConfig(
  result: DetectionResult,
  baseConfig: Partial<ImportConfig>
): Partial<ImportConfig> {
  return {
    ...baseConfig,
    dataStartRow: result.detectedStartRow,
    columns: {
      ...baseConfig.columns,
      ...result.detectedColumns,
    } as ColumnMapping,
  };
}

// ─── Legacy compat ──────────────────────────────────────────────────────────

/**
 * Code pattern detection (used by RawExcelViewer)
 */
const CODE_PATTERNS = {
  urs: /^\d{5,6}$/,
  ursDots: /^\d{2,3}\.\d{2,3}\.\d{2,3}$/,
  otskp: /^[A-Z]\d{5,}$/,
  rts: /^\d{3,4}-\d{3,4}$/,
};

export function detectCodePattern(value: string): 'urs' | 'otskp' | 'rts' | 'unknown' {
  if (!value) return 'unknown';
  const trimmed = value.trim();
  if (CODE_PATTERNS.otskp.test(trimmed)) return 'otskp';
  if (CODE_PATTERNS.rts.test(trimmed)) return 'rts';
  if (CODE_PATTERNS.urs.test(trimmed) || CODE_PATTERNS.ursDots.test(trimmed)) return 'urs';
  return 'unknown';
}
