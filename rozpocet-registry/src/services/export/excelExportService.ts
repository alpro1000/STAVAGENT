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
import type { TOVData } from '../../types/unified';
import { generateKrosPopis } from '../../components/tov/FormworkRentalSection';
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
  // TOV breakdown export
  includeTOV?: boolean;         // Add TOV sub-rows (labor/materials/machinery) under each item
  tovDataMap?: Record<string, TOVData>; // Map of itemId → TOVData (from store)
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

// TOV sub-row styles (collapsible subordinate rows)
const TOV_LABOR_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'FEF9C3' } },  // yellow-100
  font: { name: 'Calibri', sz: 9, color: { rgb: '713F12' }, italic: true },
  border: { bottom: { style: 'thin', color: { rgb: 'FDE68A' } } },
};
const TOV_MATERIAL_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'F0FDF4' } },  // green-50
  font: { name: 'Calibri', sz: 9, color: { rgb: '14532D' }, italic: true },
  border: { bottom: { style: 'thin', color: { rgb: 'BBF7D0' } } },
};
const TOV_MACHINERY_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'EFF6FF' } },  // blue-50
  font: { name: 'Calibri', sz: 9, color: { rgb: '1E3A5F' }, italic: true },
  border: { bottom: { style: 'thin', color: { rgb: 'BFDBFE' } } },
};
const TOV_FORMWORK_STYLE: XLSX.CellStyle = {
  fill: { fgColor: { rgb: 'EDE9FE' } },  // violet-100
  font: { name: 'Calibri', sz: 9, color: { rgb: '3B0764' }, italic: true },
  border: { bottom: { style: 'thin', color: { rgb: 'DDD6FE' } } },
};

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
    includeTOV = false,
    tovDataMap = {},
  } = options;

  const workbook = XLSX.utils.book_new();

  // Add items sheet
  const itemsSheet = createStyledItemsSheet(project.items, project.id, groupBySkupina, addHyperlinks, includeTOV, tovDataMap);
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
    includeTOV = false,
    tovDataMap = {},
  } = options;

  const workbook = XLSX.utils.book_new();

  for (const sheet of project.sheets) {
    // Sanitize sheet name for Excel (max 31 chars, no special chars)
    const sheetName = sanitizeSheetName(sheet.name, workbook);
    const ws = createStyledItemsSheet(sheet.items, project.id, groupBySkupina, addHyperlinks, includeTOV, tovDataMap);
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
  addHyperlinks: boolean,
  includeTOV = false,
  tovDataMap: Record<string, TOVData> = {}
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

    // TOV breakdown: add sub-rows for labor, materials, machinery, formwork rental
    if (includeTOV && !isSubordinate && !isSection) {
      const tov = tovDataMap[item.id];
      if (tov) {
        // Labor rows (yellow)
        for (const r of (tov.labor ?? [])) {
          const cost = r.totalCost ?? (r.normHours * (r.hourlyRate ?? 0));
          data.push(['', '', `  👷 ${r.profession} — ${r.count} prac × ${r.hours}h = ${r.normHours.toFixed(1)} Nh`, '', r.normHours, r.hourlyRate ?? '', cost || '', 'TOV:Práce']);
          rowTypes.push('tov_labor');
          outlineLevels.push(3);
        }
        // Machinery rows (blue)
        for (const r of (tov.machinery ?? [])) {
          const cost = r.totalCost ?? (r.machineHours * (r.hourlyRate ?? 0));
          data.push(['', '', `  🏗️ ${r.type} — ${r.count} ks × ${r.hours}h = ${r.machineHours.toFixed(1)} Mh`, '', r.machineHours, r.hourlyRate ?? '', cost || '', 'TOV:Mechanizace']);
          rowTypes.push('tov_machinery');
          outlineLevels.push(3);
        }
        // Material rows (green)
        for (const r of (tov.materials ?? [])) {
          data.push(['', r.code ?? '', `  📦 ${r.name}`, r.unit, r.quantity, r.unitPrice ?? '', r.totalCost ?? '', 'TOV:Materiál']);
          rowTypes.push('tov_material');
          outlineLevels.push(3);
        }
        // Formwork rental rows (violet)
        for (const r of (tov.formworkRental ?? [])) {
          const popis = r.kros_popis || generateKrosPopis(r);
          data.push([r.kros_kod ?? '', '', `  🏛️ ${popis}`, 'kpl', 1, r.konecny_najem, r.konecny_najem, 'TOV:Bednění']);
          rowTypes.push('tov_formwork');
          outlineLevels.push(3);
        }
      }
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

      // Base style based on row type: 'header' | 'code' | 'desc' | 'section' | 'tov_*'
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
        case 'tov_labor':
          style = { ...TOV_LABOR_STYLE };
          break;
        case 'tov_material':
          style = { ...TOV_MATERIAL_STYLE };
          break;
        case 'tov_machinery':
          style = { ...TOV_MACHINERY_STYLE };
          break;
        case 'tov_formwork':
          style = { ...TOV_FORMWORK_STYLE };
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
   Direct ZIP/XML patching — preserves ALL original formatting,
   formulas, charts, images, macros, etc.
   Only writes cenaJednotkova into the original cells.
   Formulas in cenaCelkem recalculate automatically.
   ============================================ */

import JSZip from 'jszip';

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

const SPREADSHEET_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

/**
 * Parse workbook.xml + rels to map sheet names → worksheet file paths
 */
function parseSheetMapping(workbookXml: string, relsXml: string): Map<string, string> {
  const parser = new DOMParser();
  const mapping = new Map<string, string>();

  // Parse workbook.xml to get sheet name → rId
  const wbDoc = parser.parseFromString(workbookXml, 'application/xml');
  const sheets = wbDoc.getElementsByTagNameNS(SPREADSHEET_NS, 'sheet');
  const nameToRid = new Map<string, string>();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getAttribute('name') || '';
    const rId = sheets[i].getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id'
    ) || sheets[i].getAttribute('r:id') || '';
    if (name && rId) {
      nameToRid.set(name, rId);
    }
  }

  // Parse rels to get rId → file path
  const relsDoc = parser.parseFromString(relsXml, 'application/xml');
  const rels = relsDoc.getElementsByTagName('Relationship');
  const ridToPath = new Map<string, string>();
  for (let i = 0; i < rels.length; i++) {
    const id = rels[i].getAttribute('Id') || '';
    const target = rels[i].getAttribute('Target') || '';
    if (id && target) {
      ridToPath.set(id, target);
    }
  }

  // Combine: sheet name → file path
  for (const [name, rId] of nameToRid) {
    const path = ridToPath.get(rId);
    if (path) {
      mapping.set(name, path);
    }
  }

  return mapping;
}

/**
 * Patch a single cell value in sheet XML document.
 * Sets the cell to a numeric value, removing any shared string type.
 * Preserves style (s attribute) and everything else.
 */
function patchCellInDoc(
  doc: Document,
  cellRef: string,
  value: number,
  rowNum: number
): boolean {
  // Find all <c> elements and match by r attribute
  const cells = doc.getElementsByTagNameNS(SPREADSHEET_NS, 'c');
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell.getAttribute('r') === cellRef) {
      // Found existing cell — update value
      // Remove shared string type (t="s") so it becomes number
      if (cell.getAttribute('t') === 's' || cell.getAttribute('t') === 'str') {
        cell.removeAttribute('t');
      }

      // Remove formula <f> element if exists (we're setting a plain value)
      const fElems = cell.getElementsByTagNameNS(SPREADSHEET_NS, 'f');
      while (fElems.length > 0) {
        cell.removeChild(fElems[0]);
      }

      // Find or create <v> element
      let vElem = cell.getElementsByTagNameNS(SPREADSHEET_NS, 'v')[0];
      if (!vElem) {
        vElem = doc.createElementNS(SPREADSHEET_NS, 'v');
        cell.appendChild(vElem);
      }
      vElem.textContent = String(value);
      return true;
    }
  }

  // Cell doesn't exist — find the row and add it
  const rows = doc.getElementsByTagNameNS(SPREADSHEET_NS, 'row');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].getAttribute('r') === String(rowNum)) {
      const newCell = doc.createElementNS(SPREADSHEET_NS, 'c');
      newCell.setAttribute('r', cellRef);
      const vElem = doc.createElementNS(SPREADSHEET_NS, 'v');
      vElem.textContent = String(value);
      newCell.appendChild(vElem);
      rows[i].appendChild(newCell);
      return true;
    }
  }

  return false; // Row not found
}

/**
 * Export prices back to original file using direct ZIP/XML patching.
 *
 * ELEGANT APPROACH:
 * - Opens the .xlsx as a ZIP archive (JSZip)
 * - Patches ONLY the cenaJednotkova cells in the sheet XML
 * - Does NOT touch cenaCelkem — formulas recalculate automatically
 * - Preserves ALL formatting, merged cells, charts, images, macros, etc.
 * - No XLSX.read()/XLSX.write() cycle that would destroy the file
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

  // 1. Get original file from IndexedDB
  const originalFile = await getOriginalFile(project.id);
  if (!originalFile) {
    result.errors.push('Originální soubor nebyl nalezen. Soubor musí být importován znovu.');
    return result;
  }

  try {
    // 2. Open .xlsx as ZIP
    const zip = await JSZip.loadAsync(originalFile.fileData);

    // 3. Read workbook structure
    const workbookFile = zip.file('xl/workbook.xml');
    const relsFile = zip.file('xl/_rels/workbook.xml.rels');
    if (!workbookFile || !relsFile) {
      result.errors.push('Neplatný formát souboru xlsx.');
      return result;
    }
    const workbookXml = await workbookFile.async('string');
    const relsXml = await relsFile.async('string');
    const sheetMap = parseSheetMapping(workbookXml, relsXml);

    // 4. Determine which column to patch
    const firstSheet = project.sheets[0];
    const config = firstSheet?.config;
    const cenaJedCol = options.cenaJednotkovaCol || config?.columns?.cenaJednotkova || '';

    if (!cenaJedCol) {
      result.errors.push('Nebyl nalezen sloupec pro cenu jednotkovou. Zkontrolujte konfiguraci importu.');
      return result;
    }

    const cenaJedColLetter = cenaJedCol.toUpperCase();

    // 5. Build price map: sheetName → [{row, price}]
    const pricesBySheet = new Map<string, Array<{ row: number; price: number }>>();
    for (const sheet of project.sheets) {
      const prices: Array<{ row: number; price: number }> = [];
      for (const item of sheet.items) {
        const rowNum = item.source?.rowStart;
        if (rowNum != null && item.cenaJednotkova != null && item.cenaJednotkova > 0) {
          prices.push({ row: rowNum, price: item.cenaJednotkova });
          result.totalRows++;
        }
      }
      if (prices.length > 0) {
        pricesBySheet.set(sheet.name, prices);
      }
    }

    // 6. Patch each sheet XML
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    for (const [sheetName, prices] of pricesBySheet) {
      const sheetPath = sheetMap.get(sheetName);
      if (!sheetPath) {
        result.errors.push(`List "${sheetName}" nebyl nalezen v souboru.`);
        continue;
      }

      const fullPath = `xl/${sheetPath}`;
      const sheetFile = zip.file(fullPath);
      if (!sheetFile) {
        result.errors.push(`Soubor ${sheetPath} nenalezen v archivu.`);
        continue;
      }

      const sheetXml = await sheetFile.async('string');
      const doc = parser.parseFromString(sheetXml, 'application/xml');

      // Check for parse errors
      const parseError = doc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        result.errors.push(`Chyba parsování XML listu "${sheetName}".`);
        continue;
      }

      // Patch each price cell
      for (const { row, price } of prices) {
        const cellRef = `${cenaJedColLetter}${row}`;
        const patched = patchCellInDoc(doc, cellRef, price, row);
        if (patched) {
          result.updatedRows++;
        }
      }

      // Serialize back and save to ZIP
      const patchedXml = serializer.serializeToString(doc);
      zip.file(fullPath, patchedXml);
    }

    // 7. Generate modified ZIP and download
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const fileName = originalFile.fileName.replace(/\.[^.]+$/, '') + '_s_cenami.xlsx';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

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
