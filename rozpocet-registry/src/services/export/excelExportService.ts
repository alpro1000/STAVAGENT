/**
 * Excel Export Service with Hyperlinks and Formatting
 *
 * Phase 7+: Export project to Excel with clickable hyperlinks,
 * styled headers, and multi-sheet project export.
 *
 * Uses xlsx-js-style for cell formatting (header colors, row highlights).
 */

import * as XLSX from 'xlsx-js-style';
import type { SheetStats } from '../../types/project';
import type { ProjectMetadata } from '../../types/project';
import type { ImportConfig } from '../../types/config';
import type { ParsedItem } from '../../types/item';
import type { Project } from '../../types/project';
import { getOriginalFile } from '../originalFileStore';

/**
 * Exportable project (compatibility type for export)
 * This represents either a Sheet or a Project-like object with sheet data
 */
export interface ExportableProject {
  id: string;
  fileName: string;
  projectName?: string;
  filePath: string;
  importedAt: Date;
  items: ParsedItem[];
  stats: SheetStats;
  metadata: ProjectMetadata;
  config: ImportConfig;
}

/**
 * Export options
 */
export interface ExportOptions {
  includeMetadata?: boolean;    // Include project metadata sheet
  includeSummary?: boolean;     // Include summary statistics
  groupBySkupina?: boolean;     // Group items by work group
  addHyperlinks?: boolean;      // Add hyperlinks to items (default true)
}

/* ============================================
   STYLING CONSTANTS
   Matching Price Request Panel (Tailwind slate palette)
   ============================================ */

// Header row: slate-100 background with bold dark text
const HEADER_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'E2E8F0' } },  // slate-200
  font: { bold: true, color: { rgb: '1E293B' }, name: 'Calibri', sz: 11 },  // slate-800
  border: {
    bottom: { style: 'thin', color: { rgb: '94A3B8' } },  // slate-400
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },   // slate-300
  },
  alignment: { vertical: 'center', wrapText: false },
};

// Code row (items with kod): very light slate tint
const CODE_ROW_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'F1F5F9' } },  // slate-100
  font: { name: 'Calibri', sz: 10, color: { rgb: '1E293B' } },
  border: {
    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },  // slate-200
  },
};

// Description row (subordinate/no kod): light gray background with italic text
const DESC_ROW_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'F8FAFC' } },  // slate-50
  font: { name: 'Calibri', sz: 10, color: { rgb: '64748B' }, italic: true },  // slate-500, italic
  border: {
    bottom: { style: 'thin', color: { rgb: 'F1F5F9' } },  // very light
  },
};

// Section row (díl/section header): darker background with bold text
const SECTION_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'CBD5E1' } },  // slate-300
  font: { bold: true, name: 'Calibri', sz: 11, color: { rgb: '1E293B' } },  // slate-800, bold
  border: {
    top: { style: 'thin', color: { rgb: '94A3B8' } },     // slate-400
    bottom: { style: 'thin', color: { rgb: '94A3B8' } },  // slate-400
  },
};

// Numeric cell alignment
const NUM_ALIGN: XLSX.CellStyle['alignment'] = { horizontal: 'right', vertical: 'center' };

/* ============================================
   SINGLE SHEET EXPORT (existing behavior, now with styling)
   ============================================ */

/**
 * Export single sheet to Excel with styling
 */
export function exportProjectToExcel(
  project: ExportableProject,
  options: ExportOptions = {}
): ArrayBuffer {
  const {
    includeMetadata = true,
    includeSummary = true,
    groupBySkupina = true,
    addHyperlinks = true,
  } = options;

  const workbook = XLSX.utils.book_new();

  // Add items sheet
  const itemsSheet = createStyledItemsSheet(project.items, project.id, groupBySkupina, addHyperlinks);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Položky');

  // Add summary sheet
  if (includeSummary) {
    const summarySheet = createSummarySheet(project);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Souhrn');
  }

  // Add metadata sheet
  if (includeMetadata) {
    const metadataSheet = createMetadataSheet(project);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
  }

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

/* ============================================
   FULL PROJECT EXPORT (all sheets)
   ============================================ */

/**
 * Export entire project with all sheets to Excel.
 * Each source sheet becomes a worksheet named after the original.
 */
export function exportFullProjectToExcel(
  project: Project,
  options: ExportOptions = {}
): ArrayBuffer {
  const {
    groupBySkupina = true,
    addHyperlinks = true,
  } = options;

  const workbook = XLSX.utils.book_new();

  for (const sheet of project.sheets) {
    // Sanitize sheet name for Excel (max 31 chars, no special chars)
    const sheetName = sanitizeSheetName(sheet.name, workbook);
    const ws = createStyledItemsSheet(sheet.items, project.id, groupBySkupina, addHyperlinks);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  }

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

/**
 * Sanitize sheet name for Excel compatibility.
 * Excel limits: 31 chars, no []:*?/\ characters, no duplicates.
 */
function sanitizeSheetName(name: string, workbook: XLSX.WorkBook): string {
  // Remove invalid characters
  let safe = name.replace(/[[\]:*?/\\]/g, '-').trim();
  // Truncate to 31 chars
  if (safe.length > 31) safe = safe.substring(0, 31);
  // Ensure no empty name
  if (!safe) safe = 'List';

  // Deduplicate: if name already exists in workbook, add suffix
  const existingNames = new Set((workbook.SheetNames || []).map(n => n.toLowerCase()));
  if (existingNames.has(safe.toLowerCase())) {
    const base = safe.substring(0, 28); // leave room for suffix
    let idx = 2;
    while (existingNames.has(`${base} (${idx})`.toLowerCase())) idx++;
    safe = `${base} (${idx})`;
  }

  return safe;
}

/* ============================================
   STYLED ITEMS SHEET BUILDER
   ============================================ */

/**
 * Create a styled items worksheet with header formatting and row highlights.
 *
 * V2: Items are kept in ORIGINAL ORDER (by source.rowStart), no group separators.
 * Skupina is just a regular column. Users can sort/filter in Excel as needed.
 *
 * V3: Subordinate rows INHERIT skupina from their parent main item.
 * Section headers are preserved with their original names.
 */
function createStyledItemsSheet(
  items: ParsedItem[],
  projectId: string,
  _groupBySkupina: boolean, // DEPRECATED: always keep original order now
  addHyperlinks: boolean
): XLSX.WorkSheet {
  // Sort by source.rowStart to preserve EXACT original file order
  // (boqLineNumber is only assigned to main items, not subordinates)
  const sortedItems = [...items].sort((a, b) => {
    const aRow = a.source?.rowStart ?? 999999;
    const bRow = b.source?.rowStart ?? 999999;
    return aRow - bRow;
  });

  // Build parent skupina map for inheritance
  // Subordinates should inherit skupina from their parent main item
  const parentSkupinaMap = new Map<string, string>();
  for (const item of sortedItems) {
    if (item.rowRole === 'main' || (item.kod && item.kod.trim().length > 0 && item.rowRole !== 'subordinate')) {
      if (item.id && item.skupina) {
        parentSkupinaMap.set(item.id, item.skupina);
      }
    }
  }

  // Build data array
  const data: any[][] = [];
  const headers = [
    'Poř.', // Original row number (from source file)
    'Kód', 'Popis', 'MJ', 'Množství',
    'Cena jednotková', 'Cena celkem', 'Skupina',
    ...(addHyperlinks ? ['Odkaz'] : []),
  ];
  data.push(headers);

  // Track row types for styling: 'header' | 'code' | 'desc' | 'section'
  const rowTypes: string[] = ['header'];

  // Track outline levels for Excel grouping (collapsible rows)
  const outlineLevels: number[] = [0]; // header = level 0 (no grouping)

  for (const item of sortedItems) {
    // Item row - determine if it's a main/section/subordinate row
    // Use rowRole if available, otherwise fallback to old logic (kod presence)
    const rowRole = item.rowRole || (item.kod && item.kod.trim().length > 0 ? 'main' : 'subordinate');
    const isSubordinate = rowRole === 'subordinate';
    const isSection = rowRole === 'section';

    // Add visual indent for subordinate rows in the Popis column
    const popisText = isSubordinate ? `  ↳ ${item.popis}` : item.popis;

    // Determine skupina for this row:
    // - Section rows: show "SEKCE" or empty (they are structural, not work items)
    // - Subordinate rows: INHERIT from parent main item
    // - Main rows: use their own skupina
    let displaySkupina: string;
    if (isSection) {
      displaySkupina = 'SEKCE';
    } else if (isSubordinate && item.parentItemId) {
      // Inherit from parent
      displaySkupina = parentSkupinaMap.get(item.parentItemId) || item.skupina || '';
    } else {
      displaySkupina = item.skupina || '';
    }

    const row: any[] = [
      item.source?.rowStart ?? '', // Original row number from source file
      item.kod,
      popisText,
      item.mj,
      item.mnozstvi,
      item.cenaJednotkova,
      item.cenaCelkem,
      displaySkupina,
    ];

    if (addHyperlinks) {
      const itemUrl = `${window.location.origin}${window.location.pathname}#/project/${projectId}/item/${item.id}`;
      row.push({ f: `HYPERLINK("${itemUrl}", "Otevřít")`, v: 'Otevřít' });
    }

    data.push(row);

    // Set row type for styling
    if (isSection) {
      rowTypes.push('section'); // section = special styling
      outlineLevels.push(0); // sections are not grouped
    } else if (isSubordinate) {
      rowTypes.push('desc'); // subordinate = description style
      outlineLevels.push(2); // subordinate rows = outline level 2 (grouped under main)
    } else {
      rowTypes.push('code'); // main = code style
      outlineLevels.push(1); // main rows = outline level 1
    }
  }

  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Apply column widths (added Poř. column at index 0)
  ws['!cols'] = [
    { wch: 6 },   // Poř. (original row number)
    { wch: 12 },  // Kód
    { wch: 50 },  // Popis
    { wch: 8 },   // MJ
    { wch: 12 },  // Množství
    { wch: 16 },  // Cena jedn.
    { wch: 16 },  // Cena celkem
    { wch: 20 },  // Skupina
    ...(addHyperlinks ? [{ wch: 10 }] : []),
  ];

  // Apply row grouping (Excel outline levels)
  // This creates collapsible groups with +/- buttons on the left
  // NOTE: Do NOT set hidden: true - it hides rows permanently.
  // Using BOTH 'level' and 'outlineLevel' for maximum compatibility
  ws['!rows'] = outlineLevels.map((level) => {
    if (level === 0) {
      // Header or section - no outline
      return {};
    } else if (level === 1) {
      // Main row - no outline level (parent/summary row)
      return {};
    } else {
      // Subordinate row - outline level 1 (grouped under main, collapsible)
      return { level: 1, outlineLevel: 1, hidden: false };
    }
  });

  // Set sheet format with max outline level
  ws['!sheetFormat'] = {
    outlineLevelRow: 1, // Max row outline level used in this sheet
  };

  // CRITICAL: Enable outline/grouping settings for the sheet
  // Without this, Excel won't show +/- buttons for row grouping!
  // above: true = summary rows (main items) are ABOVE detail rows
  // left: true = group symbols (+/-) appear on the LEFT side
  ws['!outline'] = { above: true, left: true };

  // Set sheet views to show outline symbols (+/- buttons)
  ws['!sheetViews'] = [{
    showOutlineSymbols: true,
    showGridLines: true,
    showRowColHeaders: true,
  }];

  // Apply styling to each cell
  const colCount = headers.length;
  for (let r = 0; r < data.length; r++) {
    const rowType = rowTypes[r];
    for (let c = 0; c < colCount; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (!cell) continue;

      // Base style based on row type: 'header' | 'code' | 'desc' | 'section'
      let style: XLSX.CellStyle;
      switch (rowType) {
        case 'header':
          style = { ...HEADER_STYLE };
          break;
        case 'section':
          style = { ...SECTION_STYLE };
          break;
        case 'code':
          style = { ...CODE_ROW_STYLE };
          break;
        case 'desc':
        default:
          style = { ...DESC_ROW_STYLE };
      }

      // Right-align numeric columns (Poř.=0, Množství=4, Cena jedn.=5, Cena celkem=6)
      // Skip for section rows (they usually don't have numeric data)
      if ((c === 0 || (c >= 4 && c <= 6)) && rowType !== 'header' && rowType !== 'section') {
        style.alignment = { ...style.alignment, ...NUM_ALIGN };
      }

      // Number format for price columns
      if ((c === 5 || c === 6) && rowType !== 'header') {
        cell.z = '#,##0.00';
      }

      cell.s = style;
    }
  }

  // Add formulas for "Cena celkem" column (G = E × F)
  // Formula: =IF(F{row}="","",E{row}*F{row})
  // Column indices: Množství=4 (E), Cena jedn.=5 (F), Cena celkem=6 (G)
  for (let r = 1; r < data.length; r++) {
    const excelRow = r + 1; // Excel rows are 1-indexed
    const cellRef = XLSX.utils.encode_cell({ r, c: 6 }); // Column G (Cena celkem)
    const existingCell = ws[cellRef];
    const existingStyle = existingCell?.s;

    // Add formula while preserving existing style
    ws[cellRef] = {
      t: 'n',
      f: `IF(F${excelRow}="","",E${excelRow}*F${excelRow})`,
      s: existingStyle,
      z: '#,##0.00',
    };
  }

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Auto-filter on header
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }) };

  return ws;
}

/* ============================================
   SUMMARY & METADATA SHEETS (unchanged logic, with basic styling)
   ============================================ */

function createSummarySheet(project: ExportableProject): XLSX.WorkSheet {
  const data: any[][] = [];

  data.push(['Projekt', project.fileName]);
  data.push(['Importováno', new Date(project.importedAt).toLocaleString('cs-CZ')]);
  data.push(['']);

  data.push(['Celkem položek', project.stats.totalItems]);
  data.push(['Klasifikováno', project.stats.classifiedItems]);
  data.push(['Neklasifikováno', project.stats.totalItems - project.stats.classifiedItems]);
  data.push(['Celková cena', project.stats.totalCena.toFixed(2) + ' Kč']);
  data.push(['']);

  data.push(['Rozdělení podle skupin', '']);
  data.push(['Skupina', 'Počet položek']);

  const groupCounts: Record<string, number> = {};
  for (const item of project.items) {
    const group = item.skupina || 'Bez skupiny';
    groupCounts[group] = (groupCounts[group] || 0) + 1;
  }

  for (const [group, count] of Object.entries(groupCounts).sort((a, b) => b[1] - a[1])) {
    data.push([group, count]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }];

  // Style summary headers
  const labelStyle: XLSX.CellStyle = {
    font: { bold: true, name: 'Calibri', sz: 10, color: { rgb: '334155' } },
  };
  for (let r = 0; r < data.length; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[cellRef]) ws[cellRef].s = labelStyle;
  }

  return ws;
}

function createMetadataSheet(project: ExportableProject): XLSX.WorkSheet {
  const data: any[][] = [];

  data.push(['Metadata projektu', '']);
  data.push(['']);

  if (project.metadata.projectNumber) {
    data.push(['Číslo projektu', project.metadata.projectNumber]);
  }
  if (project.metadata.projectName) {
    data.push(['Název projektu', project.metadata.projectName]);
  }
  if (project.metadata.oddil) {
    data.push(['Oddíl', project.metadata.oddil]);
  }
  if (project.metadata.stavba) {
    data.push(['Stavba', project.metadata.stavba]);
  }

  data.push(['']);
  data.push(['Konfigurace importu', '']);
  data.push(['Šablona', project.config.templateName]);
  data.push(['List', project.config.sheetName]);
  data.push(['Řádek začátku', project.config.dataStartRow]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }];
  return ws;
}

/* ============================================
   HELPERS
   ============================================ */

/**
 * Download exported file
 */
export function downloadExcel(
  arrayBuffer: ArrayBuffer,
  fileName: string
): void {
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export single sheet and download
 */
export function exportAndDownload(
  project: ExportableProject,
  options?: ExportOptions
): void {
  const arrayBuffer = exportProjectToExcel(project, options);
  const fileName = `${project.fileName.replace(/\.[^.]+$/, '')}_export.xlsx`;
  downloadExcel(arrayBuffer, fileName);
}

/**
 * Export full project (all sheets) and download
 */
export function exportFullProjectAndDownload(
  project: Project,
  options?: ExportOptions
): void {
  const arrayBuffer = exportFullProjectToExcel(project, options);
  const fileName = `${project.fileName.replace(/\.[^.]+$/, '')}_full_export.xlsx`;
  downloadExcel(arrayBuffer, fileName);
}

/* ============================================
   RETURN TO ORIGINAL FILE EXPORT
   Write prices back to original file preserving structure
   ============================================ */

export interface ReturnToOriginalOptions {
  /** Column letter for unit price (e.g. 'F') - if empty, will not update */
  cenaJednotkovaCol?: string;
  /** Column letter for total price (e.g. 'G') - if empty, will not update */
  cenaCelkemCol?: string;
}

export interface ReturnToOriginalResult {
  success: boolean;
  updatedRows: number;
  totalRows: number;
  errors: string[];
}

/**
 * Convert column letter to 0-based index (A=0, B=1, ..., Z=25, AA=26, etc.)
 */
function colLetterToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
}

/**
 * Export prices back to original file.
 * Only updates cenaJednotkova and cenaCelkem columns, preserving all other data.
 *
 * @param project - Project with updated prices
 * @param options - Column mappings for price columns
 * @returns Result with counts and any errors
 */
export async function exportToOriginalFile(
  project: Project,
  options: ReturnToOriginalOptions = {}
): Promise<ReturnToOriginalResult> {
  const result: ReturnToOriginalResult = {
    success: false,
    updatedRows: 0,
    totalRows: 0,
    errors: [],
  };

  // Get original file from IndexedDB
  const originalFile = await getOriginalFile(project.id);
  if (!originalFile) {
    result.errors.push('Originální soubor nebyl nalezen. Soubor musí být importován znovu.');
    return result;
  }

  try {
    // Read original workbook - use cellStyles: true to preserve formatting
    const workbook = XLSX.read(originalFile.fileData, {
      type: 'array',
      cellStyles: true,
      cellNF: true,  // Preserve number formats
      cellFormula: true,  // Preserve formulas
    });

    // Build a map of source.rowStart → prices from all sheets
    // Use source.rowStart instead of boqLineNumber (which is only for main items)
    const priceMap = new Map<string, {
      sheetName: string;
      row: number;
      cenaJed: number | null;
      cenaCel: number | null;
    }>();

    for (const sheet of project.sheets) {
      for (const item of sheet.items) {
        // Use source.rowStart as the row identifier (1-based Excel row number)
        const rowNum = item.source?.rowStart;
        if (rowNum !== undefined && rowNum !== null) {
          const key = `${sheet.name}:${rowNum}`;
          priceMap.set(key, {
            sheetName: sheet.name,
            row: rowNum,
            cenaJed: item.cenaJednotkova,
            cenaCel: item.cenaCelkem,
          });
          result.totalRows++;
        }
      }
    }

    // Get column indices from first sheet's config (or use provided options)
    const firstSheet = project.sheets[0];
    const config = firstSheet?.config;

    const cenaJedCol = options.cenaJednotkovaCol || config?.columns?.cenaJednotkova || '';
    const cenaCelCol = options.cenaCelkemCol || config?.columns?.cenaCelkem || '';

    if (!cenaJedCol && !cenaCelCol) {
      result.errors.push('Nebyly nalezeny sloupce pro ceny. Zkontrolujte konfiguraci importu.');
      return result;
    }

    const cenaJedColIdx = cenaJedCol ? colLetterToIndex(cenaJedCol.toUpperCase()) : -1;
    const cenaCelColIdx = cenaCelCol ? colLetterToIndex(cenaCelCol.toUpperCase()) : -1;

    // Update each sheet in the workbook
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;

      // Get the range of the sheet
      const ref = ws['!ref'];
      if (!ref) continue;
      const range = XLSX.utils.decode_range(ref);

      // Iterate through rows and update prices
      for (let row = 0; row <= range.e.r; row++) {
        const excelRow = row + 1; // 1-based Excel row number
        const key = `${sheetName}:${excelRow}`;
        const priceData = priceMap.get(key);

        if (priceData) {
          // Update cenaJednotkova - preserve existing cell properties
          if (cenaJedColIdx >= 0 && priceData.cenaJed !== null) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: cenaJedColIdx });
            const existingCell = ws[cellRef] || {};
            ws[cellRef] = {
              ...existingCell,  // Preserve existing properties (style, etc.)
              t: 'n',
              v: priceData.cenaJed,
              w: undefined,  // Clear cached formatted value so Excel recalculates
            };
          }

          // Update cenaCelkem - preserve existing cell properties
          if (cenaCelColIdx >= 0 && priceData.cenaCel !== null) {
            const cellRef = XLSX.utils.encode_cell({ r: row, c: cenaCelColIdx });
            const existingCell = ws[cellRef] || {};
            ws[cellRef] = {
              ...existingCell,  // Preserve existing properties (style, etc.)
              t: 'n',
              v: priceData.cenaCel,
              w: undefined,  // Clear cached formatted value so Excel recalculates
            };
          }

          result.updatedRows++;
        }
      }
    }

    // Write and download - preserve styles
    const arrayBuffer = XLSX.write(workbook, {
      type: 'array',
      bookType: 'xlsx',
      cellStyles: true,  // Preserve cell styles
    });
    const fileName = originalFile.fileName.replace(/\.[^.]+$/, '') + '_s_cenami.xlsx';
    downloadExcel(arrayBuffer, fileName);

    result.success = true;
  } catch (err) {
    result.errors.push(`Chyba při zpracování souboru: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * Check if original file is available for export
 */
export async function canExportToOriginal(projectId: string): Promise<boolean> {
  const originalFile = await getOriginalFile(projectId);
  return !!originalFile;
}
