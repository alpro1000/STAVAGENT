/**
 * Export service - Czech language
 * Generate beautiful XLSX files with formatting
 * SAVE to disk for history/archive
 */

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORTS_DIR = path.join(__dirname, '../../exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  logger.info(`Created exports directory: ${EXPORTS_DIR}`);
}

// ============================================
// SLATE COLOR PALETTE (Excel ARGB format)
// ============================================
const colors = {
  // Backgrounds
  headerBg: 'FFF8FAFC',      // Slate 50
  sectionBg: 'FFF1F5F9',     // Slate 100
  rowEvenBg: 'FFFFFFFF',     // White
  rowOddBg: 'FFFAFAFA',      // Near white
  totalBg: 'FFF8FAFC',       // Slate 50

  // Borders
  borderLight: 'FFE2E8F0',   // Slate 200
  borderMedium: 'FFCBD5E1',  // Slate 300
  sectionAccent: 'FF94A3B8', // Slate 400 (left border)

  // Text
  textPrimary: 'FF0F172A',   // Slate 900
  textSecondary: 'FF475569', // Slate 600
  textMuted: 'FF94A3B8',     // Slate 400

  // Accents
  positive: 'FF059669',      // Emerald - days, KPI
  warning: 'FFD97706',       // Amber - warnings
};

// ============================================
// PRECISE COLUMN WIDTHS (Detaily sheet)
// ============================================
const columnWidths = {
  A: 14,   // Podtyp (was 28, reduced to match CSS max-width ~100px)
  B: 6,    // MJ
  C: 12,   // Množství
  D: 6,    // Lidí
  E: 10,   // Kč/hod
  F: 9,    // Hod/den
  G: 7,    // Dny
  H: 10,   // MJ/h
  I: 10,   // Hod celkem
  J: 12,   // Kč celkem
  K: 11,   // Kč/m³
  L: 11,   // Objem m³
  M: 10,   // KROS JC
  N: 13,   // KROS celkem
  O: 8,    // RFI
};

// Format helpers
const formatNumber = (num, decimals = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return parseFloat(num).toFixed(decimals).replace('.', ',');
};

const formatCurrency = (num, decimals = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return parseFloat(num).toFixed(decimals).replace('.', ',');
};

/**
 * Subtype labels - same as frontend (from shared/constants.ts)
 */
const SUBTYPE_LABELS = {
  'beton': 'Betonování',
  'bednění': 'Bednění',
  'oboustranné (opěry)': 'Oboustranné (opěry)',
  'oboustranné (křídla)': 'Oboustranné (křídla)',
  'oboustranné (závěrné zídky)': 'Oboustranné (závěrné zídky)',
  'výztuž': 'Výztuž',
  'jiné': 'Jiné'
};

/**
 * Get work name for display in Excel (same logic as frontend)
 * For 'beton': always use default label (ignore item_name from Excel import)
 * For other subtypes: use custom name if set, otherwise show default
 */
function getWorkName(position) {
  const defaultLabel = SUBTYPE_LABELS[position.subtype] || position.subtype;

  // For 'beton' always use default label (ignore item_name with Excel description)
  if (position.subtype === 'beton') {
    return defaultLabel;
  }

  // For others, use custom name if set, otherwise default
  return position.item_name || defaultLabel;
}

/**
 * Determine material type from position subtype and item name
 */
function determineMaterialType(subtype, itemName = '') {
  const text = (itemName || '').toLowerCase();

  // Check subtype first
  if (subtype === 'beton' || text.includes('beton')) {
    return 'Beton (m³)';
  }
  if (subtype === 'bednění' || text.includes('bedn')) {
    return 'Bednění (m²)';
  }
  if (subtype === 'výztuž' || text.includes('výztuž') || text.includes('ocel')) {
    return 'Výztuž (t)';
  }

  // Default
  return 'Ostatní';
}

/**
 * Calculate optimal column width based on content
 * @param {Array} cells - Cells in the column
 * @param {number} minWidth - Minimum width
 * @param {number} maxWidth - Maximum width
 * @returns {number} Optimal width
 */
function calculateColumnWidth(cells, minWidth = 10, maxWidth = 60) {
  let maxLength = minWidth;

  if (!Array.isArray(cells)) {
    return minWidth;
  }

  cells.forEach(cell => {
    if (!cell) return;

    let length = 0;
    const value = cell.value;

    if (value === null || value === undefined) {
      length = 0;
    } else if (typeof value === 'object') {
      // Formula objects, rich text, etc.
      if (value.formula) {
        // Estimate based on formula length, but cap it
        length = Math.min(value.formula.length, 20);
      } else if (value.text) {
        length = String(value.text).length;
      } else if (value.richText && value.richText.length > 0) {
        length = value.richText.map(rt => String(rt.text || '').length).reduce((a, b) => a + b, 0);
      }
    } else {
      // Simple value (number, string, boolean, date)
      length = String(value).length;
    }

    maxLength = Math.max(maxLength, length);
  });

  // Add padding for better readability
  const paddedWidth = maxLength + 2;

  // Ensure we stay within bounds
  return Math.min(Math.max(paddedWidth, minWidth), maxWidth);
}

/**
 * Auto-fit all columns in a worksheet
 * @param {ExcelJS.Worksheet} sheet - The worksheet to auto-fit
 * @param {number} minWidth - Minimum column width (default: 10)
 * @param {number} maxWidth - Maximum column width (default: 60)
 */
function autoFitColumns(sheet, minWidth = 10, maxWidth = 60) {
  if (!sheet || !sheet.columns) {
    return;
  }

  sheet.columns.forEach((column, colIndex) => {
    if (!column) return;

    const cells = [];
    column.eachCell({ includeEmpty: false }, (cell) => {
      cells.push(cell);
    });

    // For header row, also check column header if exists
    if (sheet.getRow(1)) {
      const headerCell = sheet.getRow(1).getCell(colIndex + 1);
      if (headerCell && headerCell.value) {
        cells.unshift(headerCell);
      }
    }

    const optimalWidth = calculateColumnWidth(cells, minWidth, maxWidth);
    column.width = optimalWidth;
  });
}

/**
 * Apply borders to a cell - Slate minimal style
 */
const applyBorders = (cell) => {
  cell.border = {
    bottom: { style: 'thin', color: { argb: colors.borderLight } }
  };
};

/**
 * Apply Slate header style (Slate 50 bg, Slate 600 text, medium bottom border)
 */
const applyHeaderStyle = (cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colors.headerBg }
  };
  cell.font = {
    name: 'Calibri',
    size: 9,
    bold: true,
    color: { argb: colors.textSecondary }
  };
  cell.alignment = { vertical: 'center', horizontal: 'right' };
  cell.border = {
    bottom: { style: 'medium', color: { argb: colors.borderMedium } }
  };
};

/**
 * Apply section row style (Slate 100 bg, left accent border)
 */
const applyGroupHeaderStyle = (cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: colors.sectionBg }
  };
  cell.font = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: colors.textPrimary }
  };
  cell.alignment = { vertical: 'center', horizontal: 'left' };
  cell.border = {
    left: { style: 'thick', color: { argb: colors.sectionAccent } },
    bottom: { style: 'thin', color: { argb: colors.borderLight } }
  };
};

/**
 * Apply precise column widths from specification
 */
const applyPreciseColumnWidths = (sheet) => {
  Object.entries(columnWidths).forEach(([col, width]) => {
    sheet.getColumn(col).width = width;
  });
};

/**
 * Apply data row style (Slate 600 text, minimal borders)
 */
const applyDataRowStyle = (row, isEven = false) => {
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    // Background - alternating rows
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? colors.rowEvenBg : colors.rowOddBg }
    };

    // Font and alignment
    cell.font = {
      name: 'Calibri',
      size: 10,
      color: { argb: colors.textSecondary }
    };
    cell.alignment = { vertical: 'center', horizontal: 'right' };

    // Border
    applyBorders(cell);
  });

  // First column (Podtyp) - left align, primary text
  row.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };
  row.getCell(1).font = {
    name: 'Calibri',
    size: 10,
    bold: true,
    color: { argb: colors.textPrimary }
  };
};

/**
 * Apply total row style (double top border, bold)
 */
const applyTotalRowStyle = (row) => {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colors.totalBg }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: colors.textPrimary }
    };
    cell.alignment = { vertical: 'center', horizontal: 'right' };
    cell.border = {
      top: { style: 'double', color: { argb: colors.borderMedium } }
    };
  });

  // First column - left align, extra bold
  row.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };
};

/**
 * Export positions and KPI to XLSX with beautiful formatting
 * Returns: { buffer, filename, filepath }
 */
export async function exportToXLSX(positions, header_kpi, bridge_id, saveToServer = false) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Monolit Planner';
    workbook.created = new Date();

    // CRITICAL: Enable formula calculation on file open
    workbook.calcProperties.fullCalcOnLoad = true;

    // ============================================
    // TRACK ROW NUMBERS FOR CROSS-SHEET FORMULAS
    // ============================================
    // Detaily sheet structure:
    // Row 1: Title
    // Row 2: Subtitle
    // Row 3: Empty
    // Row 4: Headers
    // Row 5+: Data rows (with part headers between groups)
    // Last row: Totals
    let detailDataStartRow = 5; // First data row after headers
    let detailTotalsRow = null; // Will be set after adding all data

    // ============= SHEET 1: DETAILY (Main data sheet - created FIRST for formulas) =============
    const detailSheet = workbook.addWorksheet('Detaily', {
      views: [{ state: 'frozen', ySplit: 4 }] // Freeze title + subtitle + empty + header rows
    });

    // Group positions by part_name
    const groupedPositions = {};
    positions.forEach(pos => {
      if (!groupedPositions[pos.part_name]) {
        groupedPositions[pos.part_name] = [];
      }
      groupedPositions[pos.part_name].push(pos);
    });

    // ⭐ Sort positions within each group: Betonování FIRST, then others
    Object.keys(groupedPositions).forEach(partName => {
      groupedPositions[partName].sort((a, b) => {
        // Betonování (subtype = "beton") always first
        if (a.subtype === 'beton' && b.subtype !== 'beton') return -1;
        if (a.subtype !== 'beton' && b.subtype === 'beton') return 1;
        // Others keep original order
        return 0;
      });
    });

    // Column layout:
    // A: Podtyp, B: MJ, C: Množství, D: Lidi, E: Kč/hod, F: Hod/den, G: Dny
    // H: MJ/h (speed formula), I: Hod celkem (formula), J: Kč celkem (formula)
    // K: Kč/m³, L: Objem m³, M: KROS JC, N: KROS celkem (formula), O: RFI
    const positionHeaders = [
      'Podtyp',
      'MJ',
      'Množství',
      'Lidi',
      'Kč/hod',
      'Hod/den',
      'Dny',
      'MJ/h',        // Speed column (qty / labor_hours)
      'Hod celkem',
      'Kč celkem',
      'Kč/m³ ⭐',
      'Objem m³',
      'KROS JC',
      'KROS celkem',
      'RFI'
    ];

    // Add title rows
    const titleRow = detailSheet.addRow(['MONOLIT PLANNER — DETAILNÍ PŘEHLED POZIC']);
    titleRow.font = { bold: true, size: 14 };
    titleRow.alignment = { vertical: 'middle', horizontal: 'left' };

    const subtitleRow = detailSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    subtitleRow.font = { bold: true, size: 12 };

    detailSheet.addRow([]); // Empty row (row 3)

    // ============= ADD SINGLE HEADER ROW (row 4) =============
    const headerRow = detailSheet.addRow(positionHeaders);
    headerRow.eachCell((cell, colNumber) => {
      applyHeaderStyle(cell);
      // First column (Podtyp) - left align
      if (colNumber === 1) {
        cell.alignment = { vertical: 'center', horizontal: 'left' };
      }
    });

    // Track data row ranges for totals row
    let firstDataRow = null;
    let lastDataRow = null;
    let rowCounter = 0;

    // Track which rows are actual data rows (not part headers)
    const dataRowNumbers = [];

    // Add each part group
    Object.entries(groupedPositions).forEach(([partName, partPositions]) => {
      // Part name header (no column headers - they're above)
      const partHeaderRow = detailSheet.addRow([`=== ${partName} ===`]);
      applyGroupHeaderStyle(partHeaderRow.getCell(1));
      detailSheet.mergeCells(partHeaderRow.number, 1, partHeaderRow.number, positionHeaders.length);

      // Data rows with formulas
      partPositions.forEach((pos, posIndex) => {
        const rowNumber = detailSheet.lastRow.number + 1;
        const laborHours = (pos.crew_size || 0) * (pos.shift_hours || 0) * (pos.days || 0);
        const speed = laborHours > 0 ? (pos.qty || 0) / laborHours : 0;

        const rowData = [
          getWorkName(pos),  // A: Podtyp (custom name or default label)
          pos.unit,              // B: MJ
          pos.qty,               // C: Množství
          pos.crew_size,         // D: Lidi
          pos.wage_czk_ph,       // E: Kč/hod
          pos.shift_hours,       // F: Hod/den
          pos.days,              // G: Dny
          null,                  // H: MJ/h (formula)
          null,                  // I: Hod celkem (formula)
          null,                  // J: Kč celkem (formula)
          null,                  // K: Kč/m³ (formula: J/L)
          pos.concrete_m3,       // L: Objem m³
          null,                  // M: KROS JC (formula: CEILING)
          null,                  // N: KROS celkem (formula)
          pos.has_rfi ? (pos.rfi_message || '⚠️ RFI') : ''  // O: RFI
        ];

        const dataRow = detailSheet.addRow(rowData);
        dataRowNumbers.push(rowNumber);

        // Track first and last data rows
        if (firstDataRow === null) {
          firstDataRow = rowNumber;
        }
        lastDataRow = rowNumber;
        rowCounter++;

        // Apply Slate data row style (alternating backgrounds)
        applyDataRowStyle(dataRow, rowCounter % 2 === 0);

        // Apply number formats to cells
        dataRow.getCell(3).numFmt = '0.00';    // C: Množství
        dataRow.getCell(4).numFmt = '0';       // D: Lidi
        dataRow.getCell(5).numFmt = '#,##0.00'; // E: Kč/hod
        dataRow.getCell(6).numFmt = '0.00';    // F: Hod/den
        dataRow.getCell(7).numFmt = '0.00';    // G: Dny
        dataRow.getCell(8).numFmt = '0.000';   // H: MJ/h
        dataRow.getCell(9).numFmt = '0.00';    // I: Hod celkem
        dataRow.getCell(10).numFmt = '0.00';   // J: Kč celkem
        dataRow.getCell(11).numFmt = '#,##0.00'; // K: Kč/m³
        dataRow.getCell(12).numFmt = '0.00';   // L: Objem m³
        dataRow.getCell(13).numFmt = '#,##0.00'; // M: KROS JC
        dataRow.getCell(14).numFmt = '#,##0.00'; // N: KROS celkem

        // Apply semantic colors (after base styling)
        // C: Množství - bold primary
        dataRow.getCell(3).font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: colors.textPrimary }
        };

        // G: Dny - green bold (positive)
        dataRow.getCell(7).font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: colors.positive }
        };

        // K: Kč/m³ - green medium (positive KPI)
        dataRow.getCell(11).font = {
          name: 'Calibri',
          size: 10,
          color: { argb: colors.positive }
        };

        // M: KROS JC - muted
        dataRow.getCell(13).font = {
          name: 'Calibri',
          size: 10,
          color: { argb: colors.textMuted }
        };

        // N: KROS celkem - bold primary
        dataRow.getCell(14).font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: colors.textPrimary }
        };

        // Add formulas for calculated columns
        // H: MJ/h (speed) = C / I (qty / labor_hours), with error handling for div/0
        dataRow.getCell(8).value = {
          formula: `IF(I${rowNumber}>0,C${rowNumber}/I${rowNumber},0)`,
          result: speed
        };

        // I: Hod celkem = D * F * G (crew_size * shift_hours * days)
        dataRow.getCell(9).value = {
          formula: `D${rowNumber}*F${rowNumber}*G${rowNumber}`,
          result: laborHours
        };

        // J: Kč celkem = E * I (wage_czk_ph * labor_hours)
        dataRow.getCell(10).value = {
          formula: `E${rowNumber}*I${rowNumber}`,
          result: (pos.wage_czk_ph || 0) * laborHours
        };

        // K: Kč/m³ ⭐ = J / L (cost_czk / concrete_m3), with error handling for div/0
        const unitCostPerM3 = (pos.concrete_m3 || 0) > 0 ? ((pos.wage_czk_ph || 0) * laborHours) / (pos.concrete_m3 || 0) : 0;
        dataRow.getCell(11).value = {
          formula: `IF(L${rowNumber}>0,J${rowNumber}/L${rowNumber},0)`,
          result: unitCostPerM3
        };

        // M: KROS JC = CEILING(Kč/m³, 50) - round up to nearest 50 CZK
        const krosUnitCzk = unitCostPerM3 > 0 ? Math.ceil(unitCostPerM3 / 50) * 50 : 0;
        dataRow.getCell(13).value = {
          formula: `CEILING(K${rowNumber},50)`,
          result: krosUnitCzk
        };

        // N: KROS celkem = M * L (kros_unit_czk * concrete_m3)
        dataRow.getCell(14).value = {
          formula: `M${rowNumber}*L${rowNumber}`,
          result: krosUnitCzk * (pos.concrete_m3 || 0)
        };

        // Highlight RFI rows
        if (pos.has_rfi) {
          dataRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF8DC' } // Light yellow
            };
          });
        }
      });

      // Empty row between groups
      detailSheet.addRow([]);
    });

    // Add totals row with CALCULATED result values
    if (firstDataRow !== null && lastDataRow !== null) {
      detailSheet.addRow([]); // Empty row before totals

      // Calculate totals from positions data
      const totals = {
        qty: positions.reduce((sum, p) => sum + (p.qty || 0), 0),
        laborHours: positions.reduce((sum, p) => sum + ((p.crew_size || 0) * (p.shift_hours || 0) * (p.days || 0)), 0),
        costCzk: positions.reduce((sum, p) => {
          const hours = (p.crew_size || 0) * (p.shift_hours || 0) * (p.days || 0);
          return sum + ((p.wage_czk_ph || 0) * hours);
        }, 0),
        concreteM3: positions.reduce((sum, p) => sum + (p.concrete_m3 || 0), 0),
        krosTotal: positions.reduce((sum, p) => {
          const hours = (p.crew_size || 0) * (p.shift_hours || 0) * (p.days || 0);
          const costCzk = (p.wage_czk_ph || 0) * hours;
          const unitCost = (p.concrete_m3 || 0) > 0 ? costCzk / (p.concrete_m3 || 0) : 0;
          const krosUnit = unitCost > 0 ? Math.ceil(unitCost / 50) * 50 : 0;
          return sum + (krosUnit * (p.concrete_m3 || 0));
        }, 0)
      };

      const totalsRow = detailSheet.addRow([
        'CELKEM / TOTAL', // A
        '',               // B
        '',               // C: ❌ NO SUM (different units - m², m³, etc.)
        '',               // D
        '',               // E
        '',               // F
        null,             // G: Sum days (formula)
        '',               // H: MJ/h
        null,             // I: Sum labor hours (formula)
        null,             // J: Sum cost CZK (formula)
        '',               // K
        '',               // L: ❌ NO SUM (repeated concrete_m3 for all works)
        '',               // M
        null,             // N: Sum KROS total (formula)
        ''                // O: RFI
      ]);

      detailTotalsRow = totalsRow.number;

      // Apply Slate total row styling (double top border, bold, Slate 50 bg)
      applyTotalRowStyle(totalsRow);

      // ❌ C: No sum (different units - m², m³, kg, etc.)
      // Removed SUM formula for column C

      // G: Sum of days
      totalsRow.getCell(7).value = {
        formula: `SUM(G${firstDataRow}:G${lastDataRow})`,
        result: positions.reduce((sum, p) => sum + (p.days || 0), 0)
      };
      totalsRow.getCell(7).numFmt = '0.00';

      // I: Sum of labor hours
      totalsRow.getCell(9).value = {
        formula: `SUM(I${firstDataRow}:I${lastDataRow})`,
        result: totals.laborHours
      };
      totalsRow.getCell(9).numFmt = '0.00';

      // J: Sum of cost CZK
      totalsRow.getCell(10).value = {
        formula: `SUM(J${firstDataRow}:J${lastDataRow})`,
        result: totals.costCzk
      };
      totalsRow.getCell(10).numFmt = '#,##0.00';

      // ❌ L: No sum (repeated concrete_m3 for KROS calculation convenience)
      // Removed SUM formula for column L

      // N: Sum of KROS total
      totalsRow.getCell(14).value = {
        formula: `SUM(N${firstDataRow}:N${lastDataRow})`,
        result: totals.krosTotal
      };
      totalsRow.getCell(14).numFmt = '#,##0.00';
    }

    // Apply precise column widths per specification
    applyPreciseColumnWidths(detailSheet);

    // ============= SHEET 2: KPI SUMMARY (with formulas referencing Detaily) =============
    const kpiSheet = workbook.addWorksheet('KPI', {
      views: [{ state: 'frozen', ySplit: 2 }]
    });

    // Set column widths for KPI sheet
    kpiSheet.getColumn('A').width = 32;
    kpiSheet.getColumn('B').width = 18;
    kpiSheet.getColumn('C').width = 14;

    // Title row
    const kpiTitleRow = kpiSheet.addRow(['MONOLIT PLANNER — ZPRÁVA O PROJEKTU']);
    kpiTitleRow.font = { name: 'Calibri', bold: true, size: 14, color: { argb: colors.textPrimary } };
    kpiTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    kpiSheet.mergeCells(1, 1, 1, 3);

    // Subtitle row
    const kpiSubRow = kpiSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    kpiSubRow.font = { name: 'Calibri', bold: true, size: 11, color: { argb: colors.textSecondary } };
    kpiSheet.mergeCells(2, 1, 2, 3);

    kpiSheet.addRow([]); // Empty row

    // Info: All values linked to Detaily sheet
    const kpiInfoRow = kpiSheet.addRow(['⚡ Všechny hodnoty jsou propojeny s listem "Detaily" - při změně se automaticky aktualizují']);
    kpiInfoRow.font = { name: 'Calibri', italic: true, size: 9, color: { argb: colors.textMuted } };
    kpiSheet.mergeCells(kpiInfoRow.number, 1, kpiInfoRow.number, 3);
    kpiSheet.addRow([]);

    // Section 1: PARAMETRY OBJEKTU (static values from header_kpi)
    const paramSectionRow = kpiSheet.addRow(['PARAMETRY OBJEKTU']);
    applyGroupHeaderStyle(paramSectionRow.getCell(1));
    kpiSheet.mergeCells(paramSectionRow.number, 1, paramSectionRow.number, 3);

    const paramData = [
      ['Délka nosné konstrukce', formatNumber(header_kpi.span_length_m), 'm'],
      ['Šířka nosné konstrukce', formatNumber(header_kpi.deck_width_m), 'm'],
      ['Předpokládaná doba realizace', formatNumber(header_kpi.pd_weeks), 'týdnů']
    ];
    paramData.forEach((dataRow, idx) => {
      const row = kpiSheet.addRow(dataRow);
      applyDataRowStyle(row, idx % 2 === 0);
      row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
      row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };
    });
    kpiSheet.addRow([]);

    // Section 2: KLÍČOVÉ METRIKY PROJEKTU (formulas linked to Detaily)
    const metricsSectionRow = kpiSheet.addRow(['KLÍČOVÉ METRIKY PROJEKTU']);
    applyGroupHeaderStyle(metricsSectionRow.getCell(1));
    kpiSheet.mergeCells(metricsSectionRow.number, 1, metricsSectionRow.number, 3);

    // Σ Objem betonu - SUMIF formula to sum only Betonování positions from column L
    const concreteVolumeRow = kpiSheet.addRow(['Σ Objem betonu', null, 'm³']);
    applyDataRowStyle(concreteVolumeRow, true);
    concreteVolumeRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    concreteVolumeRow.getCell(2).value = (firstDataRow && lastDataRow) ? {
      formula: `SUMIF(Detaily!A${firstDataRow}:A${lastDataRow},"Betonování",Detaily!L${firstDataRow}:L${lastDataRow})`,
      result: header_kpi.sum_concrete_m3 || 0
    } : (header_kpi.sum_concrete_m3 || 0);
    concreteVolumeRow.getCell(2).numFmt = '0.00';
    concreteVolumeRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.positive } };
    concreteVolumeRow.getCell(2).alignment = { horizontal: 'right' };
    concreteVolumeRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    // Σ Cena (KROS) - formula referencing Detaily totals row, column N
    const krosTotalRow = kpiSheet.addRow(['Σ Cena (KROS)', null, 'CZK']);
    applyDataRowStyle(krosTotalRow, false);
    krosTotalRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    krosTotalRow.getCell(2).value = detailTotalsRow ? {
      formula: `Detaily!N${detailTotalsRow}`,
      result: header_kpi.sum_kros_total_czk || 0
    } : (header_kpi.sum_kros_total_czk || 0);
    krosTotalRow.getCell(2).numFmt = '#,##0.00';
    krosTotalRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    krosTotalRow.getCell(2).alignment = { horizontal: 'right' };
    krosTotalRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    // Jednotková cena - formula: KROS / objem
    const unitCostRowNumber = kpiSheet.lastRow.number + 1;
    const unitCostRow = kpiSheet.addRow(['Jednotková cena', null, 'CZK/m³']);
    applyDataRowStyle(unitCostRow, true);
    unitCostRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    unitCostRow.getCell(2).value = detailTotalsRow ? {
      formula: `IF(Detaily!L${detailTotalsRow}>0,Detaily!N${detailTotalsRow}/Detaily!L${detailTotalsRow},0)`,
      result: header_kpi.project_unit_cost_czk_per_m3 || 0
    } : (header_kpi.project_unit_cost_czk_per_m3 || 0);
    unitCostRow.getCell(2).numFmt = '#,##0.00';
    unitCostRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.positive } };
    unitCostRow.getCell(2).alignment = { horizontal: 'right' };
    unitCostRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    // Σ Pracovní hodiny - formula referencing Detaily totals row, column I
    const laborHoursRow = kpiSheet.addRow(['Σ Pracovní hodiny', null, 'hod']);
    applyDataRowStyle(laborHoursRow, false);
    laborHoursRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    laborHoursRow.getCell(2).value = detailTotalsRow ? {
      formula: `Detaily!I${detailTotalsRow}`,
      result: header_kpi.sum_labor_hours || 0
    } : (header_kpi.sum_labor_hours || 0);
    laborHoursRow.getCell(2).numFmt = '0.00';
    laborHoursRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    laborHoursRow.getCell(2).alignment = { horizontal: 'right' };
    laborHoursRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    // Σ Pracovní dny - formula referencing Detaily totals row, column G
    const workDaysRow = kpiSheet.addRow(['Σ Pracovní dny', null, 'dny']);
    applyDataRowStyle(workDaysRow, true);
    workDaysRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    workDaysRow.getCell(2).value = detailTotalsRow ? {
      formula: `Detaily!G${detailTotalsRow}`,
      result: positions.reduce((sum, p) => sum + (p.days || 0), 0)
    } : positions.reduce((sum, p) => sum + (p.days || 0), 0);
    workDaysRow.getCell(2).numFmt = '0.00';
    workDaysRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    workDaysRow.getCell(2).alignment = { horizontal: 'right' };
    workDaysRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    kpiSheet.addRow([]);

    // Section 3: PRŮMĚRNÉ HODNOTY (average values with formulas)
    const avgSectionRow = kpiSheet.addRow(['PRŮMĚRNÉ HODNOTY']);
    applyGroupHeaderStyle(avgSectionRow.getCell(1));
    kpiSheet.mergeCells(avgSectionRow.number, 1, avgSectionRow.number, 3);

    // Průměrná velikost party - AVERAGE of column D (Lidi)
    const avgCrewSizeRow = kpiSheet.addRow(['Průměrná velikost party', null, 'lidí']);
    applyDataRowStyle(avgCrewSizeRow, true);
    avgCrewSizeRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    avgCrewSizeRow.getCell(2).value = (firstDataRow && lastDataRow) ? {
      formula: `AVERAGE(Detaily!D${firstDataRow}:D${lastDataRow})`,
      result: positions.length > 0 ? positions.reduce((sum, p) => sum + (p.crew_size || 0), 0) / positions.length : 0
    } : 0;
    avgCrewSizeRow.getCell(2).numFmt = '0.00';
    avgCrewSizeRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    avgCrewSizeRow.getCell(2).alignment = { horizontal: 'right' };
    avgCrewSizeRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    // Průměrná hodinová sazba - AVERAGE of column E (Kč/hod)
    const avgWageRow = kpiSheet.addRow(['Průměrná hodinová sazba', null, 'Kč/hod']);
    applyDataRowStyle(avgWageRow, false);
    avgWageRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    avgWageRow.getCell(2).value = (firstDataRow && lastDataRow) ? {
      formula: `AVERAGE(Detaily!E${firstDataRow}:E${lastDataRow})`,
      result: positions.length > 0 ? positions.reduce((sum, p) => sum + (p.wage_czk_ph || 0), 0) / positions.length : 0
    } : 0;
    avgWageRow.getCell(2).numFmt = '#,##0.00';
    avgWageRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    avgWageRow.getCell(2).alignment = { horizontal: 'right' };
    avgWageRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    // Průměrný počet hodin za den - AVERAGE of column F (Hod/den)
    const avgShiftHoursRow = kpiSheet.addRow(['Průměrný počet hodin za den', null, 'hod/den']);
    applyDataRowStyle(avgShiftHoursRow, true);
    avgShiftHoursRow.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
    avgShiftHoursRow.getCell(2).value = (firstDataRow && lastDataRow) ? {
      formula: `AVERAGE(Detaily!F${firstDataRow}:F${lastDataRow})`,
      result: positions.length > 0 ? positions.reduce((sum, p) => sum + (p.shift_hours || 0), 0) / positions.length : 0
    } : 0;
    avgShiftHoursRow.getCell(2).numFmt = '0.00';
    avgShiftHoursRow.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    avgShiftHoursRow.getCell(2).alignment = { horizontal: 'right' };
    avgShiftHoursRow.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

    kpiSheet.addRow([]);

    // Section 4: REŽIM PRÁCE (static)
    const workSectionRow = kpiSheet.addRow(['REŽIM PRÁCE']);
    applyGroupHeaderStyle(workSectionRow.getCell(1));
    kpiSheet.mergeCells(workSectionRow.number, 1, workSectionRow.number, 3);

    const workData = [
      ['Režim', header_kpi.days_per_month === 30 ? '30 dní/měsíc' : '22 dní/měsíc', header_kpi.days_per_month === 30 ? '[spojitá stavba]' : '[pracovní dny]'],
      ['Odhadovaná doba trvání', `${formatNumber(header_kpi.estimated_months)} měsíců`, `${formatNumber(header_kpi.estimated_weeks)} týdnů`]
    ];
    workData.forEach((dataRow, idx) => {
      const row = kpiSheet.addRow(dataRow);
      applyDataRowStyle(row, idx % 2 === 0);
      row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };
      row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
      row.getCell(2).alignment = { horizontal: 'right' };
      row.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };
    });
    kpiSheet.addRow([]);

    // ============= SHEET 3: MATERIALS AGGREGATION (with formulas referencing Detaily) =============
    const materialsSheet = workbook.addWorksheet('Materiály', {
      views: [{ state: 'frozen', ySplit: 5 }]
    });

    // Set column widths for materials sheet
    materialsSheet.getColumn('A').width = 20;
    materialsSheet.getColumn('B').width = 10;
    materialsSheet.getColumn('C').width = 14;
    materialsSheet.getColumn('D').width = 12;
    materialsSheet.getColumn('E').width = 14;
    materialsSheet.getColumn('F').width = 16;

    // Aggregate materials by work name (for static data backup)
    const materials = new Map();
    positions.forEach(pos => {
      const workName = getWorkName(pos);
      const key = `${workName}|${pos.unit}`;

      if (!materials.has(key)) {
        materials.set(key, {
          type: workName,
          unit: pos.unit,
          quantity: 0,
          positions: [],
          totalCost: 0
        });
      }

      const mat = materials.get(key);
      mat.quantity += pos.qty || 0;
      mat.positions.push(pos);
      mat.totalCost += (pos.kros_total_czk || 0);
    });

    // Title row with Slate style
    const matTitleRow = materialsSheet.addRow(['MONOLIT PLANNER — AGREGACE MATERIÁLŮ']);
    matTitleRow.font = { name: 'Calibri', bold: true, size: 14, color: { argb: colors.textPrimary } };
    matTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    materialsSheet.mergeCells(1, 1, 1, 6);

    const matSubtitleRow = materialsSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    matSubtitleRow.font = { name: 'Calibri', bold: true, size: 11, color: { argb: colors.textSecondary } };
    materialsSheet.mergeCells(2, 1, 2, 6);

    materialsSheet.addRow([]); // Empty row

    // Info: All values linked to Detaily sheet
    const matInfoRow = materialsSheet.addRow(['⚡ Všechny hodnoty jsou propojeny s listem "Detaily" - při změně se automaticky aktualizují']);
    matInfoRow.font = { name: 'Calibri', italic: true, size: 9, color: { argb: colors.textMuted } };
    materialsSheet.mergeCells(matInfoRow.number, 1, matInfoRow.number, 6);

    // Headers with Slate style
    const materialsHeaders = ['Typ Materiálu', 'Jednotka', 'Množství', 'Počet pozic', 'Jedn. cena', 'Cena celkem'];
    const matHeaderRow = materialsSheet.addRow(materialsHeaders);
    matHeaderRow.eachCell((cell, colNumber) => {
      applyHeaderStyle(cell);
      if (colNumber === 1 || colNumber === 2) {
        cell.alignment = { vertical: 'center', horizontal: 'left' };
      }
    });

    let matRowCounter = 0;
    let matFirstDataRow = null;
    let matLastDataRow = null;

    // Calculate totals while iterating
    let matTotals = { quantity: 0, totalCost: 0 };

    // Track material row numbers for Charts sheet formulas
    const materialRowMap = new Map(); // type -> row number

    materials.forEach((mat) => {
      const rowNumber = materialsSheet.lastRow.number + 1;
      if (matFirstDataRow === null) matFirstDataRow = rowNumber;
      matLastDataRow = rowNumber;
      matRowCounter++;

      materialRowMap.set(mat.type, rowNumber);

      const unitPrice = mat.quantity > 0 ? mat.totalCost / mat.quantity : 0;
      matTotals.quantity += mat.quantity;
      matTotals.totalCost += mat.totalCost;

      // Build SUMIF formula to sum quantities from Detaily where column A matches material type
      // Detaily column A = work name, column C = quantity, column N = KROS total
      const qtyFormula = firstDataRow && lastDataRow
        ? `SUMIF(Detaily!A${firstDataRow}:A${lastDataRow},"${mat.type}",Detaily!C${firstDataRow}:C${lastDataRow})`
        : null;

      const costFormula = firstDataRow && lastDataRow
        ? `SUMIF(Detaily!A${firstDataRow}:A${lastDataRow},"${mat.type}",Detaily!N${firstDataRow}:N${lastDataRow})`
        : null;

      const matRow = materialsSheet.addRow([
        mat.type,
        mat.unit,
        null, // C: Množství (formula)
        mat.positions.length,
        null, // E: Jedn. cena (formula)
        null  // F: Cena celkem (formula)
      ]);

      // Apply Slate data row style
      applyDataRowStyle(matRow, matRowCounter % 2 === 0);

      // Semantic styling for columns
      matRow.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };
      matRow.getCell(2).alignment = { vertical: 'center', horizontal: 'left' };
      matRow.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

      // C: Množství - SUMIF formula referencing Detaily
      matRow.getCell(3).value = qtyFormula ? {
        formula: qtyFormula,
        result: mat.quantity
      } : mat.quantity;
      matRow.getCell(3).numFmt = '0.00';
      matRow.getCell(3).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };

      matRow.getCell(4).numFmt = '0';

      // E: Jedn. cena = F / C (cost / quantity)
      matRow.getCell(5).value = {
        formula: `IF(C${rowNumber}>0,F${rowNumber}/C${rowNumber},0)`,
        result: unitPrice
      };
      matRow.getCell(5).numFmt = '#,##0.00';

      // F: Cena celkem - SUMIF formula referencing Detaily KROS total
      matRow.getCell(6).value = costFormula ? {
        formula: costFormula,
        result: mat.totalCost
      } : mat.totalCost;
      matRow.getCell(6).numFmt = '#,##0.00';
      matRow.getCell(6).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    });

    // Track materials totals row for Charts sheet
    let matTotalsRowNumber = null;

    // Add materials totals row with formulas
    if (matFirstDataRow !== null && matLastDataRow !== null) {
      materialsSheet.addRow([]);

      const matTotalsRow = materialsSheet.addRow([
        'CELKEM / TOTAL', '', null, null, '', null
      ]);

      matTotalsRowNumber = matTotalsRow.number;

      applyTotalRowStyle(matTotalsRow);

      // C: Sum of qty formula
      matTotalsRow.getCell(3).value = {
        formula: `SUM(C${matFirstDataRow}:C${matLastDataRow})`,
        result: matTotals.quantity
      };
      matTotalsRow.getCell(3).numFmt = '0.00';

      // F: Sum of total cost formula
      matTotalsRow.getCell(6).value = {
        formula: `SUM(F${matFirstDataRow}:F${matLastDataRow})`,
        result: matTotals.totalCost
      };
      matTotalsRow.getCell(6).numFmt = '#,##0.00';
    }

    // ============= SHEET 4: SCHEDULE / TIMELINE (PLACEHOLDER - not yet calculated) =============
    const scheduleSheet = workbook.addWorksheet('Harmonogram', {
      views: [{ state: 'frozen', ySplit: 4 }]
    });

    // Set column widths for schedule sheet
    scheduleSheet.getColumn('A').width = 30;
    scheduleSheet.getColumn('B').width = 15;
    scheduleSheet.getColumn('C').width = 15;
    scheduleSheet.getColumn('D').width = 15;
    scheduleSheet.getColumn('E').width = 12;

    // Title row with Slate style
    const schedTitleRow = scheduleSheet.addRow(['MONOLIT PLANNER — PRACOVNÍ HARMONOGRAM']);
    schedTitleRow.font = { name: 'Calibri', bold: true, size: 14, color: { argb: colors.textPrimary } };
    schedTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    scheduleSheet.mergeCells(1, 1, 1, 5);

    const schedSubtitleRow = scheduleSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    schedSubtitleRow.font = { name: 'Calibri', bold: true, size: 11, color: { argb: colors.textSecondary } };
    scheduleSheet.mergeCells(2, 1, 2, 5);

    scheduleSheet.addRow([]); // Empty row

    // PLACEHOLDER WARNING - This sheet is not yet fully calculated
    const placeholderRow1 = scheduleSheet.addRow(['⚠️ UPOZORNĚNÍ: Tento harmonogram je prozatím ZÁSTUPNÝ (placeholder)']);
    placeholderRow1.font = { name: 'Calibri', bold: true, size: 11, color: { argb: colors.warning } };
    placeholderRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    scheduleSheet.mergeCells(placeholderRow1.number, 1, placeholderRow1.number, 5);

    const placeholderRow2 = scheduleSheet.addRow(['Logika výpočtu a reálná data budou doplněny v budoucí verzi.']);
    placeholderRow2.font = { name: 'Calibri', italic: true, size: 10, color: { argb: colors.textMuted } };
    scheduleSheet.mergeCells(placeholderRow2.number, 1, placeholderRow2.number, 5);

    scheduleSheet.addRow([]); // Empty row

    // Headers with Slate style
    const scheduleHeaders = ['Fáze', 'Trvání (dny)', 'Začátek', 'Konec', 'Osob'];
    const schedHeaderRow = scheduleSheet.addRow(scheduleHeaders);
    schedHeaderRow.eachCell((cell, colNumber) => {
      applyHeaderStyle(cell);
      if (colNumber === 1) {
        cell.alignment = { vertical: 'center', horizontal: 'left' };
      }
    });

    // Placeholder phases (example data - not calculated from actual positions)
    const phases = [
      { name: 'Příprava stavby', duration: 2, color: colors.sectionBg },
      { name: 'Bednění', duration: 5, color: 'FFE2E8F0' },
      { name: 'Betonáž', duration: 3, color: 'FFD1FAE5' },
      { name: 'Vyztužování', duration: 4, color: 'FFCBD5E1' },
      { name: 'Dokončovací práce', duration: 3, color: 'FFFEF3C7' }
    ];

    let currentDay = 1;
    let totalDuration = 0;

    // Get average crew size for schedule (placeholder value)
    const avgCrewSize = Math.round(
      positions.reduce((sum, p) => sum + (p.crew_size || 0), 0) / Math.max(positions.length, 1) || 4
    );

    phases.forEach((phase) => {
      const startDay = currentDay;
      const endDay = currentDay + phase.duration - 1;
      currentDay = endDay + 1;
      totalDuration += phase.duration;

      const schedRow = scheduleSheet.addRow([
        phase.name,
        phase.duration,
        `Den ${startDay}`,
        `Den ${endDay}`,
        avgCrewSize
      ]);

      schedRow.eachCell((cell, colNumber) => {
        applyBorders(cell);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: phase.color } };
        cell.font = { name: 'Calibri', size: 10, color: { argb: colors.textPrimary } };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'center', horizontal: 'left' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
        } else {
          cell.alignment = { vertical: 'center', horizontal: 'right' };
        }
      });
    });

    // Total row
    scheduleSheet.addRow([]);
    const schedTotalRow = scheduleSheet.addRow(['CELKEM (zástupné)', totalDuration, '', '', '']);
    applyTotalRowStyle(schedTotalRow);
    schedTotalRow.getCell(2).numFmt = '0';

    // Note about future functionality
    scheduleSheet.addRow([]);
    const noteRow = scheduleSheet.addRow(['Poznámka: V budoucnu bude harmonogram propojen s listem Detaily pomocí vzorců.']);
    noteRow.font = { name: 'Calibri', italic: true, size: 9, color: { argb: colors.textMuted } };
    scheduleSheet.mergeCells(noteRow.number, 1, noteRow.number, 5);

    // ============= SHEET 5: CHARTS & ANALYTICS (with formulas referencing Materials) =============
    const chartsSheet = workbook.addWorksheet('Grafy', {
      views: [{ state: 'frozen', ySplit: 3 }]
    });

    // Set column widths
    chartsSheet.getColumn('A').width = 20;
    chartsSheet.getColumn('B').width = 16;
    chartsSheet.getColumn('C').width = 12;

    // Title row with Slate style
    const chartsTitleRow = chartsSheet.addRow(['MONOLIT PLANNER — ANALÝZA A GRAFY']);
    chartsTitleRow.font = { name: 'Calibri', bold: true, size: 14, color: { argb: colors.textPrimary } };
    chartsTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    chartsSheet.mergeCells(1, 1, 1, 3);

    const chartsSubRow = chartsSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    chartsSubRow.font = { name: 'Calibri', bold: true, size: 11, color: { argb: colors.textSecondary } };
    chartsSheet.mergeCells(2, 1, 2, 3);

    chartsSheet.addRow([]);

    // Info: All values linked to Materials sheet
    const chartsInfoRow = chartsSheet.addRow(['⚡ Všechny hodnoty jsou propojeny s listem "Materiály" - při změně se automaticky aktualizují']);
    chartsInfoRow.font = { name: 'Calibri', italic: true, size: 9, color: { argb: colors.textMuted } };
    chartsSheet.mergeCells(chartsInfoRow.number, 1, chartsInfoRow.number, 3);

    chartsSheet.addRow([]);

    // Budget Distribution (by material type) - with formulas referencing Materials sheet
    const budgetData = Array.from(materials.entries()).map(([_, mat]) => ({
      label: mat.type,
      value: mat.totalCost,
      matRowNumber: materialRowMap.get(mat.type)
    }));

    if (budgetData.length > 0 && matFirstDataRow !== null) {
      // Section header
      const budgetSectionRow = chartsSheet.addRow(['ROZPOČET PODLE MATERIÁLU']);
      applyGroupHeaderStyle(budgetSectionRow.getCell(1));
      chartsSheet.mergeCells(budgetSectionRow.number, 1, budgetSectionRow.number, 3);

      // Table headers
      const budgetChartHeaders = ['Materiál', 'Cena (CZK)', '% Podíl'];
      const budgetChartHeaderRow = chartsSheet.addRow(budgetChartHeaders);
      budgetChartHeaderRow.eachCell((cell, colNumber) => {
        applyHeaderStyle(cell);
        if (colNumber === 1) cell.alignment = { vertical: 'center', horizontal: 'left' };
      });

      const totalBudget = budgetData.reduce((sum, item) => sum + item.value, 0);
      let budgetRowCounter = 0;
      let chartFirstDataRow = null;
      let chartLastDataRow = null;

      budgetData.forEach(item => {
        budgetRowCounter++;
        const rowNumber = chartsSheet.lastRow.number + 1;
        if (chartFirstDataRow === null) chartFirstDataRow = rowNumber;
        chartLastDataRow = rowNumber;

        const percentage = totalBudget > 0 ? (item.value / totalBudget * 100).toFixed(1) : 0;

        const row = chartsSheet.addRow([
          item.label,
          null, // B: Formula referencing Materials
          null  // C: % formula
        ]);

        applyDataRowStyle(row, budgetRowCounter % 2 === 0);
        row.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };

        // B: Cena - formula referencing Materials sheet column F (total cost)
        if (item.matRowNumber) {
          row.getCell(2).value = {
            formula: `Materiály!F${item.matRowNumber}`,
            result: item.value
          };
        } else {
          row.getCell(2).value = item.value;
        }
        row.getCell(2).numFmt = '#,##0.00';
        row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };

        // C: % Podíl - formula: B / total * 100
        if (matTotalsRowNumber) {
          row.getCell(3).value = {
            formula: `IF(Materiály!F${matTotalsRowNumber}>0,B${rowNumber}/Materiály!F${matTotalsRowNumber}*100,0)`,
            result: parseFloat(percentage)
          };
          row.getCell(3).numFmt = '0.0"%"';
        } else {
          row.getCell(3).value = `${percentage}%`;
        }
        row.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.positive } };
      });

      // Total row with formulas
      const budgetTotalRow = chartsSheet.addRow(['CELKEM', null, null]);
      applyTotalRowStyle(budgetTotalRow);

      // B: Sum formula
      if (chartFirstDataRow && chartLastDataRow) {
        budgetTotalRow.getCell(2).value = {
          formula: `SUM(B${chartFirstDataRow}:B${chartLastDataRow})`,
          result: totalBudget
        };
      } else {
        budgetTotalRow.getCell(2).value = totalBudget;
      }
      budgetTotalRow.getCell(2).numFmt = '#,##0.00';

      // C: 100%
      budgetTotalRow.getCell(3).value = '100%';
    }

    chartsSheet.addRow([]);
    chartsSheet.addRow([]);

    // Cost breakdown by subtype - with formulas referencing Materials sheet
    // Section header
    const costSectionRow = chartsSheet.addRow(['NÁKLADY PODLE TYPU PRACÍ']);
    applyGroupHeaderStyle(costSectionRow.getCell(1));
    chartsSheet.mergeCells(costSectionRow.number, 1, costSectionRow.number, 2);

    // Table headers
    const costChartHeaders = ['Typ práce', 'Náklady (CZK)'];
    const costChartHeaderRow = chartsSheet.addRow(costChartHeaders);
    costChartHeaderRow.eachCell((cell, colNumber) => {
      applyHeaderStyle(cell);
      if (colNumber === 1) cell.alignment = { vertical: 'center', horizontal: 'left' };
    });

    let totalCostChart = 0;
    let costRowCounter = 0;
    let costChartFirstRow = null;
    let costChartLastRow = null;

    // Use same data as budget section (materials map)
    budgetData.forEach(item => {
      costRowCounter++;
      const rowNumber = chartsSheet.lastRow.number + 1;
      if (costChartFirstRow === null) costChartFirstRow = rowNumber;
      costChartLastRow = rowNumber;
      totalCostChart += item.value;

      const row = chartsSheet.addRow([item.label, null]);
      applyDataRowStyle(row, costRowCounter % 2 === 0);
      row.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };

      // B: Náklady - formula referencing Materials sheet column F
      if (item.matRowNumber) {
        row.getCell(2).value = {
          formula: `Materiály!F${item.matRowNumber}`,
          result: item.value
        };
      } else {
        row.getCell(2).value = item.value;
      }
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    });

    // Total row with formula
    const costTotalRow = chartsSheet.addRow(['CELKEM', null]);
    applyTotalRowStyle(costTotalRow);

    if (costChartFirstRow && costChartLastRow) {
      costTotalRow.getCell(2).value = {
        formula: `SUM(B${costChartFirstRow}:B${costChartLastRow})`,
        result: totalCostChart
      };
    } else {
      costTotalRow.getCell(2).value = totalCostChart;
    }
    costTotalRow.getCell(2).numFmt = '#,##0.00';

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Save to server if requested
    let filename = null;
    let filepath = null;
    if (saveToServer) {
      const timestamp = Date.now();
      filename = `monolit_${bridge_id}_${timestamp}.xlsx`;
      filepath = path.join(EXPORTS_DIR, filename);
      await fs.promises.writeFile(filepath, buffer);
      logger.info(`XLSX export saved to disk: ${filepath}`);
    }

    logger.info(`XLSX export generated for ${bridge_id}: ${positions.length} positions`);

    return { buffer, filename, filepath };
  } catch (error) {
    logger.error('XLSX export error:', error);
    throw new Error(`Failed to export XLSX: ${error.message}`);
  }
}

/**
 * Get list of saved exports
 */
export function getExportsList() {
  try {
    if (!fs.existsSync(EXPORTS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(EXPORTS_DIR);
    const exports = files
      .filter(f => f.endsWith('.xlsx'))
      .map(filename => {
        const filepath = path.join(EXPORTS_DIR, filename);
        const stats = fs.statSync(filepath);
        const [_, bridge_id, timestamp] = filename.match(/monolit_(.+?)_(\d+)\.xlsx/) || [];

        return {
          filename,
          bridge_id: bridge_id || 'unknown',
          timestamp: parseInt(timestamp) || stats.mtimeMs,
          created_at: new Date(parseInt(timestamp) || stats.mtimeMs).toLocaleString('cs-CZ'),
          size: Math.round(stats.size / 1024) // KB
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first

    return exports;
  } catch (error) {
    logger.error('Error listing exports:', error);
    return [];
  }
}

/**
 * Download export file
 */
export function getExportFile(filename) {
  try {
    // Security: prevent directory traversal
    // Use path.basename to strip any directory components
    const safeName = path.basename(filename);

    // Double-check: reject if original filename differs from basename
    // This catches encoded slashes (%2F), double dots, etc.
    if (safeName !== filename || filename.includes('..')) {
      throw new Error('Invalid filename');
    }

    const filepath = path.join(EXPORTS_DIR, safeName);

    // Verify file exists and is within EXPORTS_DIR
    const realPath = fs.realpathSync(filepath);
    if (!realPath.startsWith(path.resolve(EXPORTS_DIR))) {
      throw new Error('Invalid file path');
    }

    return fs.readFileSync(filepath);
  } catch (error) {
    logger.error('Error reading export:', error);
    throw new Error(`Failed to read export: ${error.message}`);
  }
}

/**
 * Delete export file
 */
export function deleteExportFile(filename) {
  try {
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid filename');
    }

    const filepath = path.join(EXPORTS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error('File not found');
    }

    fs.unlinkSync(filepath);
    logger.info(`Export deleted: ${filename}`);
    return true;
  } catch (error) {
    logger.error('Error deleting export:', error);
    throw new Error(`Failed to delete export: ${error.message}`);
  }
}

/**
 * Export positions to CSV
 */
export function exportToCSV(positions, delimiter = ';') {
  try {
    const headers = [
      'bridge_id', 'part_name', 'subtype', 'unit', 'qty',
      'crew_size', 'wage_czk_ph', 'shift_hours', 'days',
      'labor_hours', 'cost_czk', 'unit_cost_native', 'concrete_m3',
      'unit_cost_on_m3', 'kros_unit_czk', 'kros_total_czk'
    ];

    const rows = positions.map(p =>
      headers.map(h => {
        const value = p[h];
        if (value === null || value === undefined) return '';
        if (typeof value === 'number') return formatNumberCSV(value);
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(delimiter)
    );

    const csv = [
      headers.join(delimiter),
      ...rows
    ].join('\n');

    logger.info(`CSV export generated: ${positions.length} positions`);

    return csv;
  } catch (error) {
    logger.error('CSV export error:', error);
    throw new Error(`Failed to export CSV: ${error.message}`);
  }
}

/**
 * Format number for CSV (use comma as decimal)
 */
function formatNumberCSV(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return String(num).replace('.', ',');
}
