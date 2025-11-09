/**
 * Export service
 * Generate XLSX and CSV files
 */

import XLSX from 'xlsx';
import { logger } from '../utils/logger.js';

/**
 * Export positions and KPI to XLSX (Czech language with full structure)
 */
export async function exportToXLSX(positions, header_kpi, bridge_id) {
  try {
    const workbook = XLSX.utils.book_new();

    // ============= SHEET 1: KPI SUMMARY =============
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
      ['Cena na tunu:', formatCurrency(header_kpi.project_unit_cost_czk_per_t), 'CZK/t'],
      [],
      ['=== REŽIM PRÁCE ==='],
      ['Režim:', header_kpi.days_per_month === 30 ? '30 dní/měsíc [spojitá stavba]' : '22 dní/měsíc [pracovní dny]'],
      ['Odhadovaná doba trvání:', `${formatNumber(header_kpi.estimated_months)} měsíců | ${formatNumber(header_kpi.estimated_weeks)} týdnů`],
      [],
      ['=== PRŮMĚRNÉ HODNOTY ==='],
      ['Průměrná velikost party:', formatNumber(header_kpi.avg_crew_size), 'osob'],
      ['Průměrná hodinová sazba:', formatCurrency(header_kpi.avg_wage_czk_ph), 'CZK/hod'],
      ['Průměrný počet hodin za den:', formatNumber(header_kpi.avg_shift_hours), 'hod'],
      ['Hustota betonu:', formatNumber(header_kpi.rho_t_per_m3), 't/m³']
    ];

    const kpiSheet = XLSX.utils.aoa_to_sheet(kpiData);
    kpiSheet['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, kpiSheet, 'KPI');

    // ============= SHEET 2: DETAILED POSITIONS =============
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

    const detailedData = [];

    // Add header
    detailedData.push(['MONOLIT PLANNER — DETAILNÍ PŘEHLED POZIC']);
    detailedData.push([`Most: ${bridge_id} | Datum: ${new Date().toLocaleDateString('cs-CZ')}`]);
    detailedData.push([]);

    // Add each part group
    Object.entries(groupedPositions).forEach(([partName, partPositions]) => {
      detailedData.push([`=== ${partName} ===`]);
      detailedData.push(positionHeaders);

      partPositions.forEach(pos => {
        detailedData.push([
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
      });

      detailedData.push([]); // Blank line between parts
    });

    const detailedSheet = XLSX.utils.aoa_to_sheet(detailedData);
    detailedSheet['!cols'] = Array(13).fill({ wch: 15 });
    XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detaily');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    logger.info(`XLSX export generated for ${bridge_id}: ${positions.length} positions in ${Object.keys(groupedPositions).length} parts`);

    return buffer;
  } catch (error) {
    logger.error('XLSX export error:', error);
    throw new Error(`Failed to export XLSX: ${error.message}`);
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
 * Format number for display (EU format with comma)
 */
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return num.toFixed(decimals).replace('.', ',');
}

/**
 * Format currency
 */
function formatCurrency(num) {
  if (num === null || num === undefined || isNaN(num)) return '0,00';
  return num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Format number for CSV (use comma as decimal)
 */
function formatNumberCSV(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return String(num).replace('.', ',');
}
