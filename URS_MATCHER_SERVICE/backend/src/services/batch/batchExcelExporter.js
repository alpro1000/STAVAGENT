/**
 * Batch Excel Exporter
 * Exports batch URS matching results to Excel file
 *
 * Purpose:
 * - Create Excel workbook with 2 sheets:
 *   1. Matches - All candidates for each position
 *   2. Summary - Statistics and metrics
 * - Professional formatting
 * - Download as .xlsx file
 *
 * @module services/batch/batchExcelExporter
 */

import ExcelJS from 'exceljs';
import { logger } from '../../utils/logger.js';

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Export batch results to Excel
 * @param {Object} batchData - Batch job data with results
 * @returns {Buffer} Excel file buffer
 */
export async function exportToExcel(batchData) {
  const startTime = Date.now();

  try {
    logger.info(`[BatchExcelExporter] Exporting batch: ${batchData.batchId}`);
    logger.info(`[BatchExcelExporter] Total items: ${batchData.totalItems}`);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'STAVAGENT - URS Matcher';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Sheet 1: Matches
    await createMatchesSheet(workbook, batchData);

    // Sheet 2: Summary
    await createSummarySheet(workbook, batchData);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const elapsed = Date.now() - startTime;
    logger.info(`[BatchExcelExporter] Export complete: ${buffer.length} bytes, ${elapsed}ms`);

    return buffer;

  } catch (error) {
    logger.error(`[BatchExcelExporter] Export error: ${error.message}`);
    throw new Error(`Failed to export Excel: ${error.message}`);
  }
}

// ============================================================================
// MATCHES SHEET
// ============================================================================

/**
 * Create Matches sheet with all candidates
 * @param {ExcelJS.Workbook} workbook - Excel workbook
 * @param {Object} batchData - Batch data
 */
async function createMatchesSheet(workbook, batchData) {
  const sheet = workbook.addWorksheet('Matches', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]  // Freeze header row
  });

  // ========================================================================
  // COLUMNS - Czech headers for better readability
  // ========================================================================
  sheet.columns = [
    { header: '№', key: 'lineNo', width: 6 },
    { header: 'Vstupní text', key: 'originalText', width: 55 },
    { header: 'Typ', key: 'detectedType', width: 14 },
    { header: 'Dílčí práce', key: 'subWorkText', width: 45 },
    { header: 'Pořadí', key: 'rank', width: 7 },
    { header: 'Kód ÚRS', key: 'ursCode', width: 14 },
    { header: 'Název ÚRS', key: 'ursName', width: 55 },
    { header: 'MJ', key: 'unit', width: 8 },
    { header: 'Skóre', key: 'score', width: 8 },
    { header: 'Jistota', key: 'confidence', width: 10 },
    { header: 'Ke kontrole', key: 'needsReview', width: 12 },
    { header: 'Odůvodnění', key: 'reason', width: 50 },
    { header: 'TSKP', key: 'tskpSection', width: 12 },
    { header: 'TSKP název', key: 'tskpName', width: 35 },
    { header: 'Zdroj', key: 'source', width: 14 }
  ];

  // ========================================================================
  // HEADER STYLING
  // ========================================================================
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }  // Blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  // ========================================================================
  // DATA ROWS
  // ========================================================================
  let rowIndex = 2;

  for (const item of batchData.results) {
    const lineNo = item.lineNo || '';
    const originalText = item.originalText || '';
    const detectedType = item.detectedType || 'UNKNOWN';

    // Parse subworks and results
    const subWorks = Array.isArray(item.subWorks) ? item.subWorks : [];
    const results = Array.isArray(item.results) ? item.results : [];

    if (results.length === 0) {
      // No results - add one row with error/status
      const tskp0 = (results[0] && results[0].tskpClassification) || null;
      sheet.addRow({
        lineNo: lineNo,
        originalText: originalText,
        detectedType: detectedType,
        subWorkText: '',
        rank: '',
        ursCode: item.status === 'error' ? 'CHYBA' : 'BEZ VÝSLEDKŮ',
        ursName: item.errorMessage || 'Žádní kandidáti',
        unit: '',
        score: 0,
        confidence: 'nízká',
        needsReview: 'ANO',
        reason: item.errorMessage || 'Zpracování selhalo',
        tskpSection: tskp0?.sectionCode || '',
        tskpName: tskp0?.sectionName || '',
        source: ''
      });

      // Color error rows red
      const row = sheet.getRow(rowIndex);
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' }  // Light red
      };
      rowIndex++;

    } else {
      // Add rows for each subwork and candidate
      for (const result of results) {
        const subWork = result.subWork || {};
        const candidates = result.candidates || [];
        const tskp = result.tskpClassification || null;

        for (const candidate of candidates) {
          // Translate confidence levels
          const confLabel = candidate.confidence === 'high' ? 'vysoká'
            : candidate.confidence === 'medium' ? 'střední' : 'nízká';

          sheet.addRow({
            lineNo: lineNo,
            originalText: originalText,
            detectedType: detectedType,
            subWorkText: subWork.text || '',
            rank: candidate.rank || '',
            ursCode: candidate.code || '',
            ursName: candidate.name || '',
            unit: candidate.unit || '',
            score: typeof candidate.score === 'number' ? Math.round(candidate.score * 100) / 100 : 0,
            confidence: confLabel,
            needsReview: candidate.needsReview ? 'ANO' : 'NE',
            reason: candidate.reason || '',
            tskpSection: tskp?.sectionCode || '',
            tskpName: tskp?.sectionName || '',
            source: candidate.source || ''
          });

          const row = sheet.getRow(rowIndex);

          // Color code by confidence
          if (candidate.confidence === 'high') {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFC6EFCE' }  // Light green
            };
          } else if (candidate.confidence === 'low' || candidate.needsReview) {
            row.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEB9C' }  // Light yellow
            };
          }

          rowIndex++;
        }
      }
    }
  }

  // ========================================================================
  // BORDERS + TEXT WRAPPING
  // ========================================================================
  for (let i = 1; i < rowIndex; i++) {
    const row = sheet.getRow(i);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      // Wrap text in description columns
      cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'top' };
    });
  }

  // Auto-filter on header
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length }
  };

  logger.info(`[BatchExcelExporter] Matches sheet: ${rowIndex - 2} rows`);
}

// ============================================================================
// SUMMARY SHEET
// ============================================================================

/**
 * Create Summary sheet with statistics
 * @param {ExcelJS.Workbook} workbook - Excel workbook
 * @param {Object} batchData - Batch data
 */
async function createSummarySheet(workbook, batchData) {
  const sheet = workbook.addWorksheet('Summary');

  // ========================================================================
  // CALCULATE STATISTICS
  // ========================================================================
  const stats = calculateStatistics(batchData);

  // ========================================================================
  // TITLE
  // ========================================================================
  sheet.mergeCells('A1:B1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `URS Matcher - Souhrn výsledků`;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // ========================================================================
  // GENERAL INFO
  // ========================================================================
  let row = 3;

  sheet.getCell(`A${row}`).value = 'Název dávky:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = batchData.name;
  row++;

  sheet.getCell(`A${row}`).value = 'ID dávky:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = batchData.batchId;
  row++;

  sheet.getCell(`A${row}`).value = 'Stav:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = batchData.status === 'completed' ? 'Dokončeno' : batchData.status;
  row++;

  sheet.getCell(`A${row}`).value = 'Celkem pozic:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = stats.totalPositions;
  row++;

  sheet.getCell(`A${row}`).value = 'Datum exportu:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = new Date().toLocaleString('cs-CZ');
  row++;

  row++;  // Blank row

  // ========================================================================
  // DETECTION TYPES
  // ========================================================================
  sheet.getCell(`A${row}`).value = 'Typy pozic:';
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  sheet.getCell(`A${row}`).value = 'Jednoduchá (SINGLE):';
  sheet.getCell(`B${row}`).value = stats.detectionTypes.SINGLE;
  row++;

  sheet.getCell(`A${row}`).value = 'Složená (COMPOSITE):';
  sheet.getCell(`B${row}`).value = stats.detectionTypes.COMPOSITE;
  row++;

  sheet.getCell(`A${row}`).value = 'Neurčeno (UNKNOWN):';
  sheet.getCell(`B${row}`).value = stats.detectionTypes.UNKNOWN;
  row++;

  row++;  // Blank row

  // ========================================================================
  // SUBWORKS DISTRIBUTION
  // ========================================================================
  if (stats.subWorksDistribution && Object.keys(stats.subWorksDistribution).length > 0) {
    sheet.getCell(`A${row}`).value = 'Rozložení dílčích prací (COMPOSITE):';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    for (const [count, freq] of Object.entries(stats.subWorksDistribution)) {
      sheet.getCell(`A${row}`).value = `  ${count} dílčích prací:`;
      sheet.getCell(`B${row}`).value = freq;
      row++;
    }

    row++;  // Blank row
  }

  // ========================================================================
  // CONFIDENCE LEVELS
  // ========================================================================
  sheet.getCell(`A${row}`).value = 'Úrovně jistoty:';
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  sheet.getCell(`A${row}`).value = 'Vysoká:';
  sheet.getCell(`B${row}`).value = stats.confidenceLevels.high;
  sheet.getCell(`B${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC6EFCE' }  // Green
  };
  row++;

  sheet.getCell(`A${row}`).value = 'Střední:';
  sheet.getCell(`B${row}`).value = stats.confidenceLevels.medium;
  row++;

  sheet.getCell(`A${row}`).value = 'Nízká:';
  sheet.getCell(`B${row}`).value = stats.confidenceLevels.low;
  sheet.getCell(`B${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB9C' }  // Yellow
  };
  row++;

  row++;  // Blank row

  // ========================================================================
  // REVIEW STATUS
  // ========================================================================
  sheet.getCell(`A${row}`).value = 'Kontrola:';
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  sheet.getCell(`A${row}`).value = 'Ke kontrole:';
  sheet.getCell(`B${row}`).value = stats.needsReviewCount;
  sheet.getCell(`B${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB9C' }  // Yellow
  };
  row++;

  sheet.getCell(`A${row}`).value = 'Chyby:';
  sheet.getCell(`B${row}`).value = stats.errorCount;
  if (stats.errorCount > 0) {
    sheet.getCell(`B${row}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC7CE' }  // Red
    };
  }
  row++;

  // ========================================================================
  // COLUMN WIDTHS
  // ========================================================================
  sheet.getColumn('A').width = 30;
  sheet.getColumn('B').width = 20;

  logger.info(`[BatchExcelExporter] Summary sheet created`);
}

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

/**
 * Calculate statistics from batch results
 * @param {Object} batchData - Batch data
 * @returns {Object} Statistics
 */
function calculateStatistics(batchData) {
  const stats = {
    totalPositions: batchData.totalItems || 0,
    detectionTypes: {
      SINGLE: 0,
      COMPOSITE: 0,
      UNKNOWN: 0
    },
    subWorksDistribution: {},
    confidenceLevels: {
      high: 0,
      medium: 0,
      low: 0
    },
    needsReviewCount: 0,
    errorCount: 0
  };

  for (const item of batchData.results || []) {
    // Detection type
    const type = item.detectedType || 'UNKNOWN';
    stats.detectionTypes[type] = (stats.detectionTypes[type] || 0) + 1;

    // SubWorks distribution (for COMPOSITE)
    if (type === 'COMPOSITE' && item.subWorks) {
      const count = item.subWorks.length;
      stats.subWorksDistribution[count] = (stats.subWorksDistribution[count] || 0) + 1;
    }

    // Confidence levels
    if (item.results && Array.isArray(item.results)) {
      for (const result of item.results) {
        if (result.candidates && Array.isArray(result.candidates)) {
          for (const candidate of result.candidates) {
            const conf = candidate.confidence || 'low';
            stats.confidenceLevels[conf] = (stats.confidenceLevels[conf] || 0) + 1;

            if (candidate.needsReview) {
              stats.needsReviewCount++;
            }
          }
        }
      }
    }

    // Errors
    if (item.status === 'error') {
      stats.errorCount++;
    }
  }

  return stats;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  exportToExcel
};
