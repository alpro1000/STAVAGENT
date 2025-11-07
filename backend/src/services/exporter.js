/**
 * Export service
 * Generate XLSX and CSV files
 */

import XLSX from 'xlsx';
import { logger } from '../utils/logger.js';

/**
 * Export positions and KPI to XLSX
 */
export async function exportToXLSX(positions, header_kpi, bridge_id) {
  try {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
      ['MONOLIT PLANNER — SUMMARY REPORT'],
      [`Bridge: ${bridge_id} | Date: ${new Date().toISOString().split('T')[0]}`],
      [],
      ['Délka nosné kce:', header_kpi.span_length_m || 'N/A', 'm'],
      ['Šířka nosné kce:', header_kpi.deck_width_m || 'N/A', 'm'],
      ['PD — předpoklad:', header_kpi.pd_weeks || 'N/A', 'týdnů'],
      [],
      ['Σ beton:', formatNumber(header_kpi.sum_concrete_m3), 'm³'],
      ['Kč/celkem (KROS):', formatCurrency(header_kpi.sum_kros_total_czk), 'CZK'],
      ['Kč/m³:', formatCurrency(header_kpi.project_unit_cost_czk_per_m3), 'CZK/m³'],
      ['Kč/t (ρ=2.4):', formatCurrency(header_kpi.project_unit_cost_czk_per_t), 'CZK/t'],
      [],
      ['📅 Režim работы:', header_kpi.days_per_month === 30 ? '30 дней/месяц [непрерывная стройка]' : '22 дня/месяц [рабочие дни]'],
      ['⏱️  Расчётная длительность:', `${formatNumber(header_kpi.estimated_months)} месяца | ${formatNumber(header_kpi.estimated_weeks)} недель`],
      [],
      ['avg crew:', formatNumber(header_kpi.avg_crew_size), 'lidi'],
      ['avg wage:', formatCurrency(header_kpi.avg_wage_czk_ph), 'CZK/hod'],
      ['avg shift:', formatNumber(header_kpi.avg_shift_hours), 'hod/den'],
      ['ρ (density):', header_kpi.rho_t_per_m3, 't/m³'],
      [],
      ['Формула расчёта месяцев:'],
      [`= sum_kros_total_czk / (avg_crew × avg_wage × avg_shift × days_per_month)`],
      [`= ${formatCurrency(header_kpi.sum_kros_total_czk)} / (${formatNumber(header_kpi.avg_crew_size)} × ${formatCurrency(header_kpi.avg_wage_czk_ph)} × ${formatNumber(header_kpi.avg_shift_hours)} × ${header_kpi.days_per_month})`],
      [`= ${formatNumber(header_kpi.estimated_months)} месяца`],
      [],
      ['Формула расчёта недель:'],
      [`= estimated_months × days_per_month / 7`],
      [`= ${formatNumber(header_kpi.estimated_months)} × ${header_kpi.days_per_month} / 7 = ${formatNumber(header_kpi.estimated_weeks)} недель`]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sheet 2: Positions
    const positionHeaders = [
      'Název objektu', 'Název položky', 'Podtyp práce', 'MJ', 'Množství',
      'qty_m3_helper', 'lidi', 'Kč/hod', 'Hod/den', 'den',
      'labor_hours', 'cost_czk', 'unit_cost_native', 'concrete_m3',
      'unit_cost_on_m3', 'kros_unit_czk', 'kros_total_czk', 'RFI'
    ];

    const positionRows = positions.map(p => [
      p.bridge_id,
      p.part_name,
      p.subtype,
      p.unit,
      formatNumber(p.qty),
      formatNumber(p.qty_m3_helper || 0),
      p.crew_size,
      formatCurrency(p.wage_czk_ph),
      formatNumber(p.shift_hours),
      formatNumber(p.days),
      formatNumber(p.labor_hours),
      formatCurrency(p.cost_czk),
      formatCurrency(p.unit_cost_native),
      formatNumber(p.concrete_m3),
      formatCurrency(p.unit_cost_on_m3),
      formatCurrency(p.kros_unit_czk),
      formatCurrency(p.kros_total_czk),
      p.has_rfi ? p.rfi_message : ''
    ]);

    const positionsData = [positionHeaders, ...positionRows];
    const positionsSheet = XLSX.utils.aoa_to_sheet(positionsData);
    XLSX.utils.book_append_sheet(workbook, positionsSheet, 'Positions');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    logger.info(`XLSX export generated for ${bridge_id}: ${positions.length} positions`);

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
