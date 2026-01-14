/**
 * Excel Structure Auto-Detection Service
 *
 * Phase 4: Automatically detect Excel structure and suggest best template
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
 * Keywords for each column type (Czech and English)
 */
const COLUMN_KEYWORDS = {
  kod: ['kód', 'kod', 'code', 'položka', 'polozka', 'item', 'č.', 'číslo'],
  popis: ['popis', 'description', 'název', 'nazev', 'name', 'text'],
  mj: ['mj', 'merne', 'jednotka', 'unit', 'měrná', 'merna'],
  mnozstvi: ['množství', 'mnozstvi', 'quantity', 'qty', 'počet', 'pocet', 'ks'],
  cenaJednotkova: ['cena', 'price', 'jednotková', 'jednotkova', 'unit price', 'kč/mj', 'kc/mj'],
  cenaCelkem: ['celkem', 'total', 'celková', 'celkova', 'cena celkem', 'total price'],
};

/**
 * Code pattern detection
 */
const CODE_PATTERNS = {
  urs: /^\d{5,6}$/,              // 231112, 23111 - pure digits 5-6 chars
  ursDots: /^\d{2,3}\.\d{2,3}\.\d{2,3}$/, // 23.11.12
  otskp: /^[A-Z]\d{5,}$/,        // A12345 - letter + digits
  rts: /^\d{3,4}-\d{3,4}$/,      // 123-456
};

/**
 * Detect Excel structure and suggest best template
 */
export async function detectExcelStructure(
  workbook: XLSX.WorkBook,
  sheetName?: string
): Promise<DetectionResult[]> {
  const sheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error('Sheet not found');
  }

  // Analyze first 20 rows to find headers and data
  const analysis = analyzeSheet(sheet);

  // Match against all predefined templates
  const results: DetectionResult[] = [];

  for (const template of PREDEFINED_TEMPLATES) {
    const result = matchTemplate(template, analysis);
    results.push(result);
  }

  // Sort by match score (highest first)
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results;
}

/**
 * Sheet analysis result
 */
interface SheetAnalysis {
  headers: Map<string, string>;  // column letter -> header text
  dataStartRow: number;
  codePattern: 'urs' | 'otskp' | 'rts' | 'unknown';
  sampleData: Record<string, any>[];
}

/**
 * Analyze sheet structure
 */
function analyzeSheet(sheet: XLSX.WorkSheet): SheetAnalysis {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const headers = new Map<string, string>();
  let dataStartRow = 1;
  let codePattern: 'urs' | 'otskp' | 'rts' | 'unknown' = 'unknown';

  // Scan first 20 rows to find headers
  for (let row = 0; row <= Math.min(range.e.r, 20); row++) {
    const rowData: Record<string, any> = {};
    let hasData = false;

    // Read all columns in this row
    for (let col = 0; col <= Math.min(range.e.c, 20); col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[cellAddr];
      const value = cell?.v?.toString().trim() || '';

      if (value) {
        const colLetter = XLSX.utils.encode_col(col);
        rowData[colLetter] = value;
        hasData = true;
      }
    }

    if (!hasData) continue;

    // Check if this row contains headers (keywords match)
    const headerScore = calculateHeaderScore(rowData);

    if (headerScore > 2) {
      // This looks like a header row
      for (const [col, value] of Object.entries(rowData)) {
        headers.set(col, value.toLowerCase());
      }
      dataStartRow = row + 2; // Data starts next row (1-based)
    } else if (headers.size > 0) {
      // We already found headers, this must be data
      // Detect code pattern from first data row
      const firstColValue = rowData['A'] || rowData['B'] || '';
      codePattern = detectCodePattern(firstColValue);
      break;
    }
  }

  return {
    headers,
    dataStartRow: dataStartRow || 2,
    codePattern,
    sampleData: [],
  };
}

/**
 * Calculate header score (how many keywords match)
 */
function calculateHeaderScore(row: Record<string, any>): number {
  let score = 0;
  const values = Object.values(row).map(v => v.toString().toLowerCase());

  for (const keywords of Object.values(COLUMN_KEYWORDS)) {
    const hasMatch = values.some(val =>
      keywords.some(keyword => val.includes(keyword))
    );
    if (hasMatch) score++;
  }

  return score;
}

/**
 * Detect code pattern from sample value
 */
function detectCodePattern(value: string): 'urs' | 'otskp' | 'rts' | 'unknown' {
  if (!value) return 'unknown';

  const trimmed = value.trim();

  if (CODE_PATTERNS.otskp.test(trimmed)) return 'otskp';
  if (CODE_PATTERNS.rts.test(trimmed)) return 'rts';
  if (CODE_PATTERNS.urs.test(trimmed) || CODE_PATTERNS.ursDots.test(trimmed)) return 'urs';

  return 'unknown';
}

/**
 * Match template against sheet analysis
 */
function matchTemplate(
  template: ImportTemplate,
  analysis: SheetAnalysis
): DetectionResult {
  const detectedColumns: Partial<ColumnMapping> = {};
  const reasoning: string[] = [];
  let matchScore = 0;

  // Match each required column
  for (const [field, keywords] of Object.entries(COLUMN_KEYWORDS)) {
    const columnLetter = findColumnByKeywords(analysis.headers, keywords);

    if (columnLetter) {
      detectedColumns[field as keyof ColumnMapping] = columnLetter;
      matchScore += 15; // Each matched column = 15 points
      reasoning.push(`✓ ${field}: sloupec ${columnLetter} (${analysis.headers.get(columnLetter)})`);
    } else {
      reasoning.push(`✗ ${field}: nenalezen`);
    }
  }

  // Bonus points for code pattern match
  if (analysis.codePattern !== 'unknown') {
    if (template.metadata.type === analysis.codePattern + '-standard') {
      matchScore += 10;
      reasoning.push(`✓ Typ kódu: ${analysis.codePattern.toUpperCase()}`);
    }
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (matchScore >= 75) confidence = 'high';
  else if (matchScore >= 50) confidence = 'medium';
  else confidence = 'low';

  return {
    template,
    matchScore: Math.min(matchScore, 100),
    confidence,
    detectedColumns,
    detectedStartRow: analysis.dataStartRow,
    reasoning,
  };
}

/**
 * Find column by keywords
 */
function findColumnByKeywords(
  headers: Map<string, string>,
  keywords: string[]
): string | null {
  for (const [col, header] of headers.entries()) {
    const lowerHeader = header.toLowerCase();

    for (const keyword of keywords) {
      if (lowerHeader.includes(keyword.toLowerCase())) {
        return col;
      }
    }
  }

  return null;
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
