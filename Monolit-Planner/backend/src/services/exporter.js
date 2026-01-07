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

    // ============= SHEET 1: KPI SUMMARY (Slate Style) =============
    const kpiSheet = workbook.addWorksheet('KPI', {
      views: [{ state: 'frozen', ySplit: 2 }]
    });

    // Set column widths for KPI sheet
    kpiSheet.getColumn('A').width = 30;
    kpiSheet.getColumn('B').width = 15;
    kpiSheet.getColumn('C').width = 12;

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

    // KPI sections with Slate styling
    const kpiSections = [
      { title: 'PARAMETRY OBJEKTU', data: [
        ['Délka nosné konstrukce', formatNumber(header_kpi.span_length_m), 'm'],
        ['Šířka nosné konstrukce', formatNumber(header_kpi.deck_width_m), 'm'],
        ['Předpokládaná doba realizace', formatNumber(header_kpi.pd_weeks), 'týdnů']
      ]},
      { title: 'KLÍČOVÉ METRIKY PROJEKTU', data: [
        ['Σ Objem betonu', formatNumber(header_kpi.sum_concrete_m3), 'm³'],
        ['Σ Cena (KROS)', formatCurrency(header_kpi.sum_kros_total_czk), 'CZK'],
        ['Jednotková cena', formatCurrency(header_kpi.project_unit_cost_czk_per_m3), 'CZK/m³']
      ]},
      { title: 'REŽIM PRÁCE', data: [
        ['Režim', header_kpi.days_per_month === 30 ? '30 dní/měsíc' : '22 dní/měsíc', header_kpi.days_per_month === 30 ? '[spojitá stavba]' : '[pracovní dny]'],
        ['Odhadovaná doba trvání', `${formatNumber(header_kpi.estimated_months)} měsíců`, `${formatNumber(header_kpi.estimated_weeks)} týdnů`]
      ]},
      { title: 'PRŮMĚRNÉ HODNOTY', data: [
        ['Průměrná velikost party', formatNumber(header_kpi.avg_crew_size), 'osob'],
        ['Průměrná hodinová sazba', formatCurrency(header_kpi.avg_wage_czk_ph), 'CZK/hod'],
        ['Průměrný počet hodin za den', formatNumber(header_kpi.avg_shift_hours), 'hod']
      ]}
    ];

    kpiSections.forEach((section, sectionIdx) => {
      // Section header with left accent border
      const sectionRow = kpiSheet.addRow([section.title]);
      applyGroupHeaderStyle(sectionRow.getCell(1));
      kpiSheet.mergeCells(sectionRow.number, 1, sectionRow.number, 3);

      // Section data rows
      section.data.forEach((dataRow, dataIdx) => {
        const row = kpiSheet.addRow(dataRow);
        applyDataRowStyle(row, dataIdx % 2 === 0);

        // First column - left align label
        row.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };
        row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: colors.textSecondary } };

        // Second column - right align value
        row.getCell(2).alignment = { vertical: 'center', horizontal: 'right' };
        row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };

        // Third column - muted unit
        row.getCell(3).alignment = { vertical: 'center', horizontal: 'left' };
        row.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };
      });

      // Empty row between sections (except last)
      if (sectionIdx < kpiSections.length - 1) {
        kpiSheet.addRow([]);
      }
    });

    // ============= SHEET 2: DETAILED POSITIONS =============
    const detailSheet = workbook.addWorksheet('Detaily', {
      views: [{ state: 'frozen', ySplit: 1 }] // Freeze header row
    });

    // Group positions by part_name
    const groupedPositions = {};
    positions.forEach(pos => {
      if (!groupedPositions[pos.part_name]) {
        groupedPositions[pos.part_name] = [];
      }
      groupedPositions[pos.part_name].push(pos);
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
      'MJ/h',        // NEW: Speed column (qty / labor_hours)
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

    detailSheet.addRow([]); // Empty row

    // ============= ADD SINGLE HEADER ROW (before all parts) =============
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

    // Add each part group
    Object.entries(groupedPositions).forEach(([partName, partPositions]) => {
      // Part name header (no column headers - they're above)
      const partHeaderRow = detailSheet.addRow([`=== ${partName} ===`]);
      applyGroupHeaderStyle(partHeaderRow.getCell(1));
      detailSheet.mergeCells(partHeaderRow.number, 1, partHeaderRow.number, positionHeaders.length);

      // Data rows with formulas
      // Column indices (1-based):
      // A=1:Podtyp, B=2:MJ, C=3:Množství, D=4:Lidi, E=5:Kč/hod, F=6:Hod/den, G=7:Dny
      // H=8:MJ/h, I=9:Hod celkem, J=10:Kč celkem, K=11:Kč/m³, L=12:Objem m³
      // M=13:KROS JC, N=14:KROS celkem, O=15:RFI
      partPositions.forEach((pos, posIndex) => {
        const rowNumber = detailSheet.lastRow.number + 1;
        const laborHours = (pos.crew_size || 0) * (pos.shift_hours || 0) * (pos.days || 0);
        const speed = laborHours > 0 ? (pos.qty || 0) / laborHours : 0;

        const rowData = [
          pos.subtype === 'jiné' ? (pos.item_name || 'jiné') : pos.subtype,  // A: Podtyp (custom name for "jiné")
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
    // Column layout: A:Podtyp, B:MJ, C:Množství, D:Lidi, E:Kč/hod, F:Hod/den, G:Dny
    // H:MJ/h, I:Hod celkem, J:Kč celkem, K:Kč/m³, L:Objem m³, M:KROS JC, N:KROS celkem, O:RFI
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
        null,             // C: Sum qty
        '',               // D
        '',               // E
        '',               // F
        '',               // G
        '',               // H: MJ/h
        null,             // I: Sum labor hours
        null,             // J: Sum cost CZK
        '',               // K
        null,             // L: Sum concrete m³
        '',               // M
        null,             // N: Sum KROS total
        ''                // O: RFI
      ]);

      // Apply Slate total row styling (double top border, bold, Slate 50 bg)
      applyTotalRowStyle(totalsRow);

      // Add SUM formulas with CALCULATED result values
      // C: Sum of qty
      totalsRow.getCell(3).value = {
        formula: `SUM(C${firstDataRow}:C${lastDataRow})`,
        result: totals.qty
      };
      totalsRow.getCell(3).numFmt = '0.00';

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

      // L: Sum of concrete m³
      totalsRow.getCell(12).value = {
        formula: `SUM(L${firstDataRow}:L${lastDataRow})`,
        result: totals.concreteM3
      };
      totalsRow.getCell(12).numFmt = '0.00';

      // N: Sum of KROS total
      totalsRow.getCell(14).value = {
        formula: `SUM(N${firstDataRow}:N${lastDataRow})`,
        result: totals.krosTotal
      };
      totalsRow.getCell(14).numFmt = '#,##0.00';
    }

    // Apply precise column widths per specification
    applyPreciseColumnWidths(detailSheet);

    // ============= SHEET 3: MATERIALS AGGREGATION (Slate Style) =============
    const materialsSheet = workbook.addWorksheet('Materiály', {
      views: [{ state: 'frozen', ySplit: 4 }]
    });

    // Set column widths for materials sheet
    materialsSheet.getColumn('A').width = 20;
    materialsSheet.getColumn('B').width = 10;
    materialsSheet.getColumn('C').width = 12;
    materialsSheet.getColumn('D').width = 12;
    materialsSheet.getColumn('E').width = 14;
    materialsSheet.getColumn('F').width = 14;

    // Aggregate materials by type and unit
    const materials = new Map();
    positions.forEach(pos => {
      const materialType = determineMaterialType(pos.subtype, pos.item_name);
      const key = `${materialType}|${pos.unit}`;

      if (!materials.has(key)) {
        materials.set(key, {
          type: materialType,
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

    materials.forEach((mat) => {
      const rowNumber = materialsSheet.lastRow.number + 1;
      if (matFirstDataRow === null) matFirstDataRow = rowNumber;
      matLastDataRow = rowNumber;
      matRowCounter++;

      const unitPrice = mat.quantity > 0 ? mat.totalCost / mat.quantity : 0;
      matTotals.quantity += mat.quantity;
      matTotals.totalCost += mat.totalCost;

      const matRow = materialsSheet.addRow([
        mat.type,
        mat.unit,
        mat.quantity,
        mat.positions.length,
        unitPrice,
        mat.totalCost
      ]);

      // Apply Slate data row style
      applyDataRowStyle(matRow, matRowCounter % 2 === 0);

      // Semantic styling for columns
      matRow.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };
      matRow.getCell(2).alignment = { vertical: 'center', horizontal: 'left' };
      matRow.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: colors.textMuted } };

      matRow.getCell(3).numFmt = '0.00';
      matRow.getCell(3).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };

      matRow.getCell(4).numFmt = '0';
      matRow.getCell(5).numFmt = '#,##0.00';
      matRow.getCell(6).numFmt = '#,##0.00';
      matRow.getCell(6).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    });

    // Add materials totals row with Slate style and CALCULATED values
    if (matFirstDataRow !== null && matLastDataRow !== null) {
      materialsSheet.addRow([]);

      const matTotalsRow = materialsSheet.addRow([
        'CELKEM / TOTAL', '', null, null, '', null
      ]);

      applyTotalRowStyle(matTotalsRow);

      // C: Sum of qty with calculated result
      matTotalsRow.getCell(3).value = {
        formula: `SUM(C${matFirstDataRow}:C${matLastDataRow})`,
        result: matTotals.quantity
      };
      matTotalsRow.getCell(3).numFmt = '0.00';

      // F: Sum of total cost with calculated result
      matTotalsRow.getCell(6).value = {
        formula: `SUM(F${matFirstDataRow}:F${matLastDataRow})`,
        result: matTotals.totalCost
      };
      matTotalsRow.getCell(6).numFmt = '#,##0.00';
    }

    // ============= SHEET 4: SCHEDULE / TIMELINE (Slate Style) =============
    const scheduleSheet = workbook.addWorksheet('Harmonogram', {
      views: [{ state: 'frozen', ySplit: 4 }]
    });

    // Set column widths for schedule sheet
    scheduleSheet.getColumn('A').width = 22;
    scheduleSheet.getColumn('B').width = 12;
    scheduleSheet.getColumn('C').width = 12;
    scheduleSheet.getColumn('D').width = 12;
    scheduleSheet.getColumn('E').width = 10;

    // Title row with Slate style
    const schedTitleRow = scheduleSheet.addRow(['MONOLIT PLANNER — PRACOVNÍ HARMONOGRAM']);
    schedTitleRow.font = { name: 'Calibri', bold: true, size: 14, color: { argb: colors.textPrimary } };
    schedTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.headerBg } };
    scheduleSheet.mergeCells(1, 1, 1, 5);

    const schedSubtitleRow = scheduleSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    schedSubtitleRow.font = { name: 'Calibri', bold: true, size: 11, color: { argb: colors.textSecondary } };
    scheduleSheet.mergeCells(2, 1, 2, 5);

    scheduleSheet.addRow([]); // Empty row

    // Phase colors using Slate palette
    const phases = [
      { name: 'Příprava stavby', duration: 2, color: colors.sectionBg },
      { name: 'Bednění', duration: 5, color: 'FFE2E8F0' },          // Slate 200
      { name: 'Betonáž', duration: 3, color: 'FFD1FAE5' },          // Emerald 100 (positive)
      { name: 'Vyztužování', duration: 4, color: 'FFCBD5E1' },      // Slate 300
      { name: 'Dokončovací práce', duration: 3, color: 'FFFEF3C7' } // Amber 100 (warning)
    ];

    const scheduleHeaders = ['Fáze', 'Trvání (dny)', 'Začátek', 'Konec', 'Osob'];
    const schedHeaderRow = scheduleSheet.addRow(scheduleHeaders);
    schedHeaderRow.eachCell((cell, colNumber) => {
      applyHeaderStyle(cell);
      if (colNumber === 1) {
        cell.alignment = { vertical: 'center', horizontal: 'left' };
      }
    });

    let currentDay = 1;
    let totalDuration = 0;

    // Get average crew size for schedule
    const avgCrewSize = Math.round(
      positions.reduce((sum, p) => sum + (p.crew_size || 0), 0) / Math.max(positions.length, 1) || 4
    );

    phases.forEach((phase, idx) => {
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
    const schedTotalRow = scheduleSheet.addRow(['CELKEM', totalDuration, '', '', '']);
    applyTotalRowStyle(schedTotalRow);
    schedTotalRow.getCell(2).numFmt = '0';

    // ============= SHEET 5: CHARTS & ANALYTICS (Slate Style) =============
    const chartsSheet = workbook.addWorksheet('Grafy', {
      views: [{ state: 'frozen', ySplit: 2 }]
    });

    // Set column widths
    chartsSheet.getColumn('A').width = 20;
    chartsSheet.getColumn('B').width = 14;
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

    // Budget Distribution (by material type)
    const budgetData = Array.from(materials.entries()).map(([_, mat]) => ({
      label: mat.type,
      value: mat.totalCost
    }));

    if (budgetData.length > 0) {
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

      budgetData.forEach(item => {
        budgetRowCounter++;
        const percentage = totalBudget > 0 ? (item.value / totalBudget * 100).toFixed(1) : 0;
        const row = chartsSheet.addRow([item.label, item.value, `${percentage}%`]);

        applyDataRowStyle(row, budgetRowCounter % 2 === 0);
        row.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };
        row.getCell(2).numFmt = '#,##0.00';
        row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
        row.getCell(3).font = { name: 'Calibri', size: 10, color: { argb: colors.positive } };
      });

      // Total row
      const budgetTotalRow = chartsSheet.addRow(['CELKEM', totalBudget, '100%']);
      applyTotalRowStyle(budgetTotalRow);
      budgetTotalRow.getCell(2).numFmt = '#,##0.00';
    }

    chartsSheet.addRow([]);
    chartsSheet.addRow([]);

    // Cost breakdown by subtype
    const costByType = {};
    positions.forEach(pos => {
      const typeName = pos.subtype === 'jiné' ? (pos.item_name || 'jiné') : pos.subtype;
      if (!costByType[typeName]) {
        costByType[typeName] = 0;
      }
      costByType[typeName] += (pos.kros_total_czk || 0);
    });

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

    Object.entries(costByType).forEach(([type, cost]) => {
      costRowCounter++;
      totalCostChart += cost;

      const row = chartsSheet.addRow([type, cost]);
      applyDataRowStyle(row, costRowCounter % 2 === 0);
      row.getCell(1).alignment = { vertical: 'center', horizontal: 'left' };
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: colors.textPrimary } };
    });

    // Total row
    const costTotalRow = chartsSheet.addRow(['CELKEM', totalCostChart]);
    applyTotalRowStyle(costTotalRow);
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
