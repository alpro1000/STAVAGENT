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
 * Apply borders to a cell
 */
const applyBorders = (cell) => {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };
};

/**
 * Apply header style (dark blue background, white bold text)
 */
const applyHeaderStyle = (cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' } // Dark blue
  };
  cell.font = {
    bold: true,
    color: { argb: 'FFFFFFFF' }, // White
    size: 11
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  applyBorders(cell);
};

/**
 * Apply group header style (light gray background, bold text)
 */
const applyGroupHeaderStyle = (cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE7E6E6' } // Light gray
  };
  cell.font = {
    bold: true,
    size: 11
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  applyBorders(cell);
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

    // ============= SHEET 1: KPI SUMMARY =============
    const kpiSheet = workbook.addWorksheet('KPI', {
      views: [{ state: 'frozen', ySplit: 2 }] // Freeze first 2 rows
    });

    const kpiData = [
      ['MONOLIT PLANNER — ZPRÁVA O PROJEKTU'],
      [`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`],
      [],
      ['=== PARAMETRY OBJEKTU ==='],
      ['Délka nosné konstrukce:', formatNumber(header_kpi.span_length_m), 'm'],
      ['Šířka nosné konstrukce:', formatNumber(header_kpi.deck_width_m), 'm'],
      ['Předpokládaná doba realizace:', formatNumber(header_kpi.pd_weeks), 'týdnů'],
      [],
      ['=== KLÍČOVÉ METRIKY PROJEKTU ==='],
      ['Σ Objem betonu:', formatNumber(header_kpi.sum_concrete_m3), 'm³'],
      ['Σ Cena (KROS):', formatCurrency(header_kpi.sum_kros_total_czk), 'CZK'],
      ['Jednotková cena:', formatCurrency(header_kpi.project_unit_cost_czk_per_m3), 'CZK/m³'],
      [],
      ['=== REŽIM PRÁCE ==='],
      ['Režim:', header_kpi.days_per_month === 30 ? '30 dní/měsíc [spojitá stavba]' : '22 dní/měsíc [pracovní dny]'],
      ['Odhadovaná doba trvání:', `${formatNumber(header_kpi.estimated_months)} měsíců | ${formatNumber(header_kpi.estimated_weeks)} týdnů`],
      [],
      ['=== PRŮMĚRNÉ HODNOTY ==='],
      ['Průměrná velikost party:', formatNumber(header_kpi.avg_crew_size), 'osob'],
      ['Průměrná hodinová sazba:', formatCurrency(header_kpi.avg_wage_czk_ph), 'CZK/hod'],
      ['Průměrný počet hodin za den:', formatNumber(header_kpi.avg_shift_hours), 'hod']
    ];

    // Add KPI data to sheet
    kpiData.forEach((row, rowIndex) => {
      const excelRow = kpiSheet.addRow(row);

      // Style first two rows (title)
      if (rowIndex === 0 || rowIndex === 1) {
        excelRow.font = { bold: true, size: 14 };
        excelRow.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Apply borders to all cells with content
      excelRow.eachCell((cell) => {
        if (cell.value) {
          applyBorders(cell);
        }
      });
    });

    // Auto-fit KPI sheet columns
    autoFitColumns(kpiSheet, 10, 50);

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

    // Track data row ranges for totals row
    let firstDataRow = null;
    let lastDataRow = null;
    let rowCounter = 0;

    // Add each part group
    Object.entries(groupedPositions).forEach(([partName, partPositions]) => {
      // Part name header
      const partHeaderRow = detailSheet.addRow([`=== ${partName} ===`]);
      applyGroupHeaderStyle(partHeaderRow.getCell(1));
      detailSheet.mergeCells(partHeaderRow.number, 1, partHeaderRow.number, positionHeaders.length);

      // Column headers
      const headerRow = detailSheet.addRow(positionHeaders);
      headerRow.eachCell((cell) => {
        applyHeaderStyle(cell);
      });

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
          pos.unit_cost_on_m3,   // K: Kč/m³
          pos.concrete_m3,       // L: Objem m³
          pos.kros_unit_czk,     // M: KROS JC
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

        // Apply borders and alignment to all cells
        dataRow.eachCell((cell, colNumber) => {
          applyBorders(cell);

          // Apply zebra striping (alternate background colors for data rows)
          if (rowCounter % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF9F9F9' } // Very light gray
            };
          }

          // Format numbers with proper alignment and number format
          if (colNumber === 3) {
            // C: Množství - 2 decimals
            cell.numFmt = '0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 4) {
            // D: Lidi - integer
            cell.numFmt = '0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 5 || colNumber === 11 || colNumber === 13) {
            // E: Kč/hod, K: Kč/m³, M: KROS JC - currency format
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 6 || colNumber === 7 || colNumber === 12) {
            // F: Hod/den, G: Dny, L: Objem m³ - 2 decimals
            cell.numFmt = '0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 8) {
            // H: MJ/h (speed) - 3 decimals for precision
            cell.numFmt = '0.000';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 9 || colNumber === 10) {
            // I: Hod celkem, J: Kč celkem - 2 decimals
            cell.numFmt = '0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 14) {
            // N: KROS celkem - currency format
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else {
            // Text columns (A, B, O)
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });

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

        // N: KROS celkem = M * L (kros_unit_czk * concrete_m3)
        dataRow.getCell(14).value = {
          formula: `M${rowNumber}*L${rowNumber}`,
          result: (pos.kros_unit_czk || 0) * (pos.concrete_m3 || 0)
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

    // Add totals row
    // Column layout: A:Podtyp, B:MJ, C:Množství, D:Lidi, E:Kč/hod, F:Hod/den, G:Dny
    // H:MJ/h, I:Hod celkem, J:Kč celkem, K:Kč/m³, L:Objem m³, M:KROS JC, N:KROS celkem, O:RFI
    if (firstDataRow !== null && lastDataRow !== null) {
      detailSheet.addRow([]); // Empty row before totals

      const totalsRow = detailSheet.addRow([
        'CELKEM / TOTAL', // A
        '',               // B
        null,             // C: Sum qty
        '',               // D
        '',               // E
        '',               // F
        '',               // G
        '',               // H: MJ/h (average would need special formula)
        null,             // I: Sum labor hours
        null,             // J: Sum cost CZK
        '',               // K
        null,             // L: Sum concrete m³
        '',               // M
        null,             // N: Sum KROS total
        ''                // O: RFI
      ]);

      const totalRowNumber = totalsRow.number;

      // Apply totals row styling
      totalsRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE7E6E6' } // Light gray
        };
        applyBorders(cell);

        if (colNumber >= 3 && colNumber <= 14) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      // Add SUM formulas for totals row
      // C: Sum of qty
      totalsRow.getCell(3).value = {
        formula: `SUM(C${firstDataRow}:C${lastDataRow})`
      };
      totalsRow.getCell(3).numFmt = '0.00';

      // I: Sum of labor hours
      totalsRow.getCell(9).value = {
        formula: `SUM(I${firstDataRow}:I${lastDataRow})`
      };
      totalsRow.getCell(9).numFmt = '0.00';

      // J: Sum of cost CZK
      totalsRow.getCell(10).value = {
        formula: `SUM(J${firstDataRow}:J${lastDataRow})`
      };
      totalsRow.getCell(10).numFmt = '#,##0.00';

      // L: Sum of concrete m³
      totalsRow.getCell(12).value = {
        formula: `SUM(L${firstDataRow}:L${lastDataRow})`
      };
      totalsRow.getCell(12).numFmt = '0.00';

      // N: Sum of KROS total
      totalsRow.getCell(14).value = {
        formula: `SUM(N${firstDataRow}:N${lastDataRow})`
      };
      totalsRow.getCell(14).numFmt = '#,##0.00';
    }

    // Auto-fit columns based on content (using smart algorithm)
    autoFitColumns(detailSheet, 12, 50);

    // ============= SHEET 3: MATERIALS AGGREGATION =============
    const materialsSheet = workbook.addWorksheet('Materiály', {
      views: [{ state: 'frozen', ySplit: 3 }]
    });

    // Aggregate materials by type and unit
    const materials = new Map();
    positions.forEach(pos => {
      // Determine material type from position
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

    // Add title rows
    const matTitleRow = materialsSheet.addRow(['MONOLIT PLANNER — AGREGACE MATERIÁLŮ']);
    matTitleRow.font = { bold: true, size: 14 };
    matTitleRow.alignment = { vertical: 'middle', horizontal: 'left' };

    const matSubtitleRow = materialsSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    matSubtitleRow.font = { bold: true, size: 12 };

    materialsSheet.addRow([]); // Empty row

    // Add materials data
    const materialsHeaders = ['Typ Materiálu', 'Jednotka', 'Množství', 'Počet pozic', 'Jednotková cena', 'Cena celkem'];
    const matHeaderRow = materialsSheet.addRow(materialsHeaders);
    matHeaderRow.eachCell((cell) => applyHeaderStyle(cell));

    let matRowCounter = 0;
    let matFirstDataRow = null;
    let matLastDataRow = null;

    materials.forEach((mat, key) => {
      const rowNumber = materialsSheet.lastRow.number + 1;
      if (matFirstDataRow === null) matFirstDataRow = rowNumber;
      matLastDataRow = rowNumber;
      matRowCounter++;

      const unitPrice = mat.positions.length > 0 ? mat.totalCost / mat.quantity : 0;

      const matRow = materialsSheet.addRow([
        mat.type,
        mat.unit,
        mat.quantity,
        mat.positions.length,
        unitPrice,
        mat.totalCost
      ]);

      matRow.eachCell((cell, colNumber) => {
        applyBorders(cell);

        if (matRowCounter % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        }

        if (colNumber === 3 || colNumber === 4) {
          cell.numFmt = '0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber === 5 || colNumber === 6) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    // Add materials totals row
    if (matFirstDataRow !== null && matLastDataRow !== null) {
      materialsSheet.addRow([]);

      const matTotalsRow = materialsSheet.addRow([
        'CELKEM / TOTAL',
        '',
        null,
        null,
        '',
        null
      ]);

      matTotalsRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 11 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE7E6E6' }
        };
        applyBorders(cell);

        if (colNumber >= 3 && colNumber <= 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      // Add SUM formulas
      matTotalsRow.getCell(3).value = {
        formula: `SUM(C${matFirstDataRow}:C${matLastDataRow})`
      };
      matTotalsRow.getCell(3).numFmt = '0.00';

      matTotalsRow.getCell(6).value = {
        formula: `SUM(F${matFirstDataRow}:F${matLastDataRow})`
      };
      matTotalsRow.getCell(6).numFmt = '#,##0.00';
    }

    // Auto-fit materials sheet columns
    autoFitColumns(materialsSheet, 12, 50);

    // ============= SHEET 4: SCHEDULE / TIMELINE =============
    const scheduleSheet = workbook.addWorksheet('Harmonogram', {
      views: [{ state: 'frozen', ySplit: 3 }]
    });

    // Add title rows
    const schedTitleRow = scheduleSheet.addRow(['MONOLIT PLANNER — PRACOVNÍ HARMONOGRAM']);
    schedTitleRow.font = { bold: true, size: 14 };
    schedTitleRow.alignment = { vertical: 'middle', horizontal: 'left' };

    const schedSubtitleRow = scheduleSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    schedSubtitleRow.font = { bold: true, size: 12 };

    scheduleSheet.addRow([]); // Empty row

    // Create schedule with work phases
    const phases = [
      { name: 'Příprava stavby', duration: 2, color: 'FFE7E6E6' },
      { name: 'Bednění', duration: 5, color: 'FF4472C4' },
      { name: 'Betonáž', duration: 3, color: 'FFB4C7E7' },
      { name: 'Vyztužování', duration: 4, color: 'FFDAE8FC' },
      { name: 'Dokončovací práce', duration: 3, color: 'FFFFEB9C' }
    ];

    const scheduleHeaders = ['Fáze', 'Trvání (dny)', 'Začátek', 'Konec', 'Osob'];
    const schedHeaderRow = scheduleSheet.addRow(scheduleHeaders);
    schedHeaderRow.eachCell((cell) => applyHeaderStyle(cell));

    let currentDay = 1;
    let schedFirstDataRow = null;
    let schedLastDataRow = null;

    // Get average crew size for schedule
    const avgCrewSize = Math.round(
      positions.reduce((sum, p) => sum + (p.crew_size || 0), 0) / positions.length || 4
    );

    phases.forEach((phase, idx) => {
      const rowNumber = scheduleSheet.lastRow.number + 1;
      if (schedFirstDataRow === null) schedFirstDataRow = rowNumber;
      schedLastDataRow = rowNumber;

      const startDay = currentDay;
      const endDay = currentDay + phase.duration - 1;
      currentDay = endDay + 1;

      const schedRow = scheduleSheet.addRow([
        phase.name,
        phase.duration,
        `Den ${startDay}`,
        `Den ${endDay}`,
        avgCrewSize
      ]);

      schedRow.eachCell((cell, colNumber) => {
        applyBorders(cell);

        // Apply phase color to all cells
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: phase.color }
        };

        if (colNumber === 2 || colNumber === 5) {
          cell.numFmt = '0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    // Auto-fit schedule sheet columns
    autoFitColumns(scheduleSheet, 12, 50);

    // ============= SHEET 5: CHARTS & ANALYTICS =============
    const chartsSheet = workbook.addWorksheet('Grafy', {
      views: [{ state: 'frozen', ySplit: 0 }]
    });

    // Add title
    const chartsTitleRow = chartsSheet.addRow(['MONOLIT PLANNER — ANALÝZA A GRAFY']);
    chartsTitleRow.font = { bold: true, size: 14 };
    chartsSheet.addRow([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    chartsSheet.addRow([]);

    // Budget Distribution (by material type)
    const budgetData = Array.from(materials.entries()).map(([_, mat]) => ({
      label: mat.type,
      value: mat.totalCost
    }));

    if (budgetData.length > 0) {
      chartsSheet.addRow(['ROZPOČET PODLE MATERIÁLU']);
      const budgetHeaderRow = chartsSheet.lastRow;
      budgetHeaderRow.font = { bold: true, size: 12 };

      // Add budget data table for chart
      const budgetChartHeaders = ['Materiál', 'Cena (CZK)', '% Podíl'];
      const budgetChartHeaderRow = chartsSheet.addRow(budgetChartHeaders);
      budgetChartHeaderRow.eachCell((cell) => applyHeaderStyle(cell));

      const totalBudget = budgetData.reduce((sum, item) => sum + item.value, 0);
      let budgetDataStartRow = chartsSheet.lastRow.number + 1;

      budgetData.forEach(item => {
        const percentage = totalBudget > 0 ? (item.value / totalBudget * 100).toFixed(1) : 0;
        const row = chartsSheet.addRow([item.label, item.value, `${percentage}%`]);

        row.eachCell((cell, colNumber) => {
          applyBorders(cell);
          if (colNumber === 2) {
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      });

      chartsSheet.addRow(['CELKEM', totalBudget]).font = { bold: true };

      // TODO: ExcelJS chart API is complex and needs proper implementation
      // For now, we skip chart creation and provide data tables instead
      // Charts can be added manually in Excel using the data provided

      // NOTE: ExcelJS.Worksheet.CellReferenceArray doesn't exist in current API
      // Users can create charts manually in Excel from the data tables provided
    }

    // Add spacing
    chartsSheet.addRow([]);
    chartsSheet.addRow([]);

    // Cost breakdown by subtype
    const costByType = {};
    positions.forEach(pos => {
      if (!costByType[pos.subtype]) {
        costByType[pos.subtype] = 0;
      }
      costByType[pos.subtype] += (pos.kros_total_czk || 0);
    });

    chartsSheet.addRow(['NÁKLADY PODLE TYPU PRACÍ']);
    const costHeaderRow = chartsSheet.lastRow;
    costHeaderRow.font = { bold: true, size: 12 };

    const costChartHeaders = ['Typ práce', 'Náklady (CZK)'];
    const costChartHeaderRow = chartsSheet.addRow(costChartHeaders);
    costChartHeaderRow.eachCell((cell) => applyHeaderStyle(cell));

    let costDataStartRow = chartsSheet.lastRow.number + 1;
    let totalCost = 0;

    Object.entries(costByType).forEach(([type, cost]) => {
      chartsSheet.addRow([type, cost]);
      totalCost += cost;

      const row = chartsSheet.lastRow;
      row.eachCell((cell, colNumber) => {
        applyBorders(cell);
        if (colNumber === 2) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    chartsSheet.addRow(['CELKEM', totalCost]).font = { bold: true };

    // Auto-fit charts sheet columns
    autoFitColumns(chartsSheet, 10, 50);

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
    if (filename.includes('..') || filename.includes('/')) {
      throw new Error('Invalid filename');
    }

    const filepath = path.join(EXPORTS_DIR, filename);

    // Verify file exists
    if (!fs.existsSync(filepath)) {
      throw new Error('File not found');
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
