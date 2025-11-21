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
          pos.concrete_m3,  // Column K: Concrete volume m³ (CRITICAL for KROS formula)
          pos.kros_unit_czk,  // Column L: KROS unit
          null,  // Column M: KROS total (will be formula)
          pos.has_rfi ? (pos.rfi_message || '⚠️ RFI') : ''  // Column N: RFI
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
          } else if (colNumber === 5 || colNumber === 10 || colNumber === 12) {
            // Wage, unit cost on m3, KROS unit - currency format
            cell.numFmt = '#,##0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 6 || colNumber === 7 || colNumber === 8 || colNumber === 9 || colNumber === 11) {
            // Hours, days, labor hours, cost, concrete volume - number format
            cell.numFmt = '0.00';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          } else if (colNumber === 13) {
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

        // M: KROS total = L * K (kros_unit_czk * concrete_m3) - CRITICAL FIX!
        // This is the correct formula from calculateKrosTotalCZK in formulas.ts
        dataRow.getCell(13).value = {
          formula: `L${rowNumber}*K${rowNumber}`,
          result: pos.kros_unit_czk * pos.concrete_m3
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
        '', // Column K: (concrete_m3 - not summed)
        '', // Column L
        null, // Column M: Sum KROS total
        ''  // Column N: RFI
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

        if (colNumber >= 3 && colNumber <= 13) {
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

      // M: Sum of KROS total (CRITICAL FIX: using correct column M instead of L)
      totalsRow.getCell(13).value = {
        formula: `SUM(M${firstDataRow}:M${lastDataRow})`
      };
      totalsRow.getCell(13).numFmt = '#,##0.00';
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

    // Set column widths for materials sheet
    materialsSheet.getColumn(1).width = 25;
    materialsSheet.getColumn(2).width = 12;
    materialsSheet.getColumn(3).width = 15;
    materialsSheet.getColumn(4).width = 12;
    materialsSheet.getColumn(5).width = 15;
    materialsSheet.getColumn(6).width = 15;

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

    // Set column widths for schedule sheet
    scheduleSheet.getColumn(1).width = 25;
    scheduleSheet.getColumn(2).width = 15;
    scheduleSheet.getColumn(3).width = 15;
    scheduleSheet.getColumn(4).width = 15;
    scheduleSheet.getColumn(5).width = 12;

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

      // Create pie chart
      const pieChart = {
        type: 'doughnut',
        title: 'Rozpočet podle materiálu',
        series: [{
          title: new ExcelJS.Worksheet.CellReferenceArray('Grafy', 2, 1, 2 + budgetData.length - 1, 1),
          val: new ExcelJS.Worksheet.CellReferenceArray('Grafy', 2, 2, 2 + budgetData.length - 1, 2),
          layout: {
            manualLayout: {
              x: 0.15, y: 0.15, w: 0.7, h: 0.7
            }
          }
        }],
        chartArea: {
          layoutTarget: 'inner'
        }
      };

      chartsSheet.addChart(pieChart);
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

    // Set column widths for charts sheet
    chartsSheet.getColumn(1).width = 25;
    chartsSheet.getColumn(2).width = 20;
    chartsSheet.getColumn(3).width = 12;

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
