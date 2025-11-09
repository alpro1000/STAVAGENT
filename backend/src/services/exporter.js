/**
 * Export service - Czech language
 * Generate XLSX and CSV files with proper structure
 * SAVE to disk for history/archive
 */

import XLSX from 'xlsx';
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
 * Export positions and KPI to XLSX (Czech structure)
 * Returns: { buffer, filename, filepath }
 */
export async function exportToXLSX(positions, header_kpi, bridge_id, saveToServer = false) {
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

    // Save to server if requested
    let filename = null;
    let filepath = null;
    if (saveToServer) {
      const timestamp = Date.now();
      filename = `monolit_${bridge_id}_${timestamp}.xlsx`;
      filepath = path.join(EXPORTS_DIR, filename);
      fs.writeFileSync(filepath, buffer);
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
