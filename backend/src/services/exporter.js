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

    // Set column widths for KPI sheet
    kpiSheet.getColumn(1).width = 40;
    kpiSheet.getColumn(2).width = 25;
    kpiSheet.getColumn(3).width = 15;

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

    const positionHeaders = [
      'Podtyp',
      'MJ',
      'Množství',
      'Lidi',
      'Kč/hod',
      'Hod/den',
      'Den',
      'Hod celkem',
      'Kč celkem',
      'Kč/m³ ⭐',
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
      partPositions.forEach((pos, posIndex) => {
        const rowNumber = detailSheet.lastRow.number + 1;
        const rowData = [
          pos.subtype,
          pos.unit,
          pos.qty,  // Column C: Quantity (raw value, not formatted)
          pos.crew_size,  // Column D: Crew size
          pos.wage_czk_ph,  // Column E: Wage per hour
          pos.shift_hours,  // Column F: Shift hours
          pos.days,  // Column G: Days
          null,  // Column H: Labor hours (will be formula)
          null,  // Column I: Cost CZK (will be formula)
          pos.unit_cost_on_m3,  // Column J: Unit cost on m3
          pos.kros_unit_czk,  // Column K: KROS unit
          null,  // Column L: KROS total (will be formula)
          pos.has_rfi ? (pos.rfi_message || '⚠️ RFI') : ''  // Column M: RFI
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
            // Quantity column - format as number with 2 decimals
            cell.numFmt = '0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 4) {
            // Crew size - integer
            cell.numFmt = '0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 5 || colNumber === 10 || colNumber === 11) {
            // Wage, unit cost, KROS unit - currency format
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
            // Hours, days, labor hours, cost - number format
            cell.numFmt = '0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 12) {
            // KROS total - currency format
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else {
            // Text columns
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });

        // Add formulas for calculated columns
        // H: Labor hours = D * F * G (crew_size * shift_hours * days)
        dataRow.getCell(8).value = {
          formula: `D${rowNumber}*F${rowNumber}*G${rowNumber}`,
          result: pos.crew_size * pos.shift_hours * pos.days
        };

        // I: Cost CZK = E * H (wage_czk_ph * labor_hours)
        dataRow.getCell(9).value = {
          formula: `E${rowNumber}*H${rowNumber}`,
          result: pos.wage_czk_ph * (pos.crew_size * pos.shift_hours * pos.days)
        };

        // L: KROS total = K * C (kros_unit_czk * qty)
        dataRow.getCell(12).value = {
          formula: `K${rowNumber}*C${rowNumber}`,
          result: pos.kros_unit_czk * pos.qty
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
    if (firstDataRow !== null && lastDataRow !== null) {
      detailSheet.addRow([]); // Empty row before totals

      const totalsRow = detailSheet.addRow([
        'CELKEM / TOTAL', // Column A
        '', // Column B
        null, // Column C: Sum qty (if needed)
        '', // Column D
        '', // Column E
        '', // Column F
        '', // Column G
        null, // Column H: Sum labor hours
        null, // Column I: Sum cost CZK
        '', // Column J
        '', // Column K
        null, // Column L: Sum KROS total
        ''  // Column M
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

        if (colNumber >= 3 && colNumber <= 12) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      // Add SUM formulas for totals row
      // H: Sum of labor hours
      totalsRow.getCell(8).value = {
        formula: `SUM(H${firstDataRow}:H${lastDataRow})`
      };
      totalsRow.getCell(8).numFmt = '0.00';

      // I: Sum of cost CZK
      totalsRow.getCell(9).value = {
        formula: `SUM(I${firstDataRow}:I${lastDataRow})`
      };
      totalsRow.getCell(9).numFmt = '#,##0.00';

      // L: Sum of KROS total
      totalsRow.getCell(12).value = {
        formula: `SUM(L${firstDataRow}:L${lastDataRow})`
      };
      totalsRow.getCell(12).numFmt = '#,##0.00';
    }

    // Auto-fit columns based on content
    detailSheet.columns.forEach((column, index) => {
      let maxLength = (positionHeaders[index]?.length || 10) + 2;

      column.eachCell({ includeEmpty: false }, (cell) => {
        let cellLength = 0;
        const value = cell.value;

        if (value === null || value === undefined) {
          cellLength = 0;
        } else if (typeof value === 'object' && value.formula) {
          // For formulas, estimate based on the header
          cellLength = (positionHeaders[index]?.length || 10);
        } else {
          cellLength = String(value).length;
        }

        maxLength = Math.max(maxLength, cellLength);
      });

      column.width = Math.min(maxLength + 2, 50); // Add padding, max 50
    });

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
