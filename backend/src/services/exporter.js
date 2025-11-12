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

    // Track header row number for freeze panes
    let firstHeaderRow = null;

    // Add each part group
    Object.entries(groupedPositions).forEach(([partName, partPositions]) => {
      // Part name header
      const partHeaderRow = detailSheet.addRow([`=== ${partName} ===`]);
      applyGroupHeaderStyle(partHeaderRow.getCell(1));
      detailSheet.mergeCells(partHeaderRow.number, 1, partHeaderRow.number, positionHeaders.length);

      // Column headers
      const headerRow = detailSheet.addRow(positionHeaders);
      if (!firstHeaderRow) {
        firstHeaderRow = headerRow.number;
      }
      headerRow.eachCell((cell) => {
        applyHeaderStyle(cell);
      });

      // Data rows
      partPositions.forEach(pos => {
        const dataRow = detailSheet.addRow([
          pos.subtype,
          pos.unit,
          formatNumber(pos.qty),
          pos.crew_size,
          formatCurrency(pos.wage_czk_ph),
          formatNumber(pos.shift_hours),
          formatNumber(pos.days),
          formatNumber(pos.labor_hours),
          formatCurrency(pos.cost_czk),
          formatCurrency(pos.unit_cost_on_m3),
          formatCurrency(pos.kros_unit_czk),
          formatCurrency(pos.kros_total_czk),
          pos.has_rfi ? (pos.rfi_message || '⚠️ RFI') : ''
        ]);

        // Apply borders and alignment to all cells
        dataRow.eachCell((cell, colNumber) => {
          applyBorders(cell);

          // Right align numbers (columns 3-12), left align text
          if (colNumber >= 3 && colNumber <= 12) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });

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

    // Auto-fit columns based on content
    detailSheet.columns.forEach((column, index) => {
      let maxLength = positionHeaders[index]?.length || 10;

      column.eachCell({ includeEmpty: false }, (cell) => {
        const cellLength = cell.value ? String(cell.value).length : 0;
        maxLength = Math.max(maxLength, cellLength);
      });

      column.width = Math.min(maxLength + 3, 50); // Add padding, max 50
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
