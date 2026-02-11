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
  // COLUMNS
  // ========================================================================
  sheet.columns = [
    { header: 'Line №', key: 'lineNo', width: 10 },
    { header: 'Original Text', key: 'originalText', width: 50 },
    { header: 'Type', key: 'detectedType', width: 12 },
    { header: 'SubWork №', key: 'subWorkNo', width: 12 },
    { header: 'SubWork Text', key: 'subWorkText', width: 40 },
    { header: 'Rank', key: 'rank', width: 8 },
    { header: 'ÚRS Code', key: 'ursCode', width: 12 },
    { header: 'ÚRS Name', key: 'ursName', width: 50 },
    { header: 'Unit', key: 'unit', width: 8 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Confidence', key: 'confidence', width: 12 },
    { header: 'Needs Review', key: 'needsReview', width: 14 },
    { header: 'Reason', key: 'reason', width: 50 },
    { header: 'Evidence', key: 'evidence', width: 40 },
    { header: 'TSKP Section', key: 'tskpSection', width: 20 },
    { header: 'TSKP Name', key: 'tskpName', width: 35 },
    { header: 'Source', key: 'source', width: 12 }
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
        subWorkNo: '',
        subWorkText: '',
        rank: '',
        ursCode: item.status === 'error' ? 'ERROR' : 'NO RESULTS',
        ursName: item.errorMessage || 'No candidates found',
        unit: '',
        score: 0,
        confidence: 'low',
        needsReview: 'YES',
        reason: item.errorMessage || 'Processing failed',
        evidence: '',
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
          sheet.addRow({
            lineNo: lineNo,
            originalText: originalText,
            detectedType: detectedType,
            subWorkNo: subWork.index || '',
            subWorkText: subWork.text || '',
            rank: candidate.rank || '',
            ursCode: candidate.code || '',
            ursName: candidate.name || '',
            unit: candidate.unit || '',
            score: candidate.score || 0,
            confidence: candidate.confidence || 'low',
            needsReview: candidate.needsReview ? 'YES' : 'NO',
            reason: candidate.reason || '',
            evidence: candidate.evidence || '',
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
  // BORDERS
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
    });
  }

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
  titleCell.value = `Batch URS Matcher - Summary Report`;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // ========================================================================
  // GENERAL INFO
  // ========================================================================
  let row = 3;

  sheet.getCell(`A${row}`).value = 'Batch Name:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = batchData.name;
  row++;

  sheet.getCell(`A${row}`).value = 'Batch ID:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = batchData.batchId;
  row++;

  sheet.getCell(`A${row}`).value = 'Status:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = batchData.status;
  row++;

  sheet.getCell(`A${row}`).value = 'Total Positions:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = stats.totalPositions;
  row++;

  sheet.getCell(`A${row}`).value = 'Export Date:';
  sheet.getCell(`A${row}`).font = { bold: true };
  sheet.getCell(`B${row}`).value = new Date().toLocaleString('cs-CZ');
  row++;

  row++;  // Blank row

  // ========================================================================
  // DETECTION TYPES
  // ========================================================================
  sheet.getCell(`A${row}`).value = 'Position Types:';
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  sheet.getCell(`A${row}`).value = 'SINGLE:';
  sheet.getCell(`B${row}`).value = stats.detectionTypes.SINGLE;
  row++;

  sheet.getCell(`A${row}`).value = 'COMPOSITE:';
  sheet.getCell(`B${row}`).value = stats.detectionTypes.COMPOSITE;
  row++;

  sheet.getCell(`A${row}`).value = 'UNKNOWN:';
  sheet.getCell(`B${row}`).value = stats.detectionTypes.UNKNOWN;
  row++;

  row++;  // Blank row

  // ========================================================================
  // SUBWORKS DISTRIBUTION
  // ========================================================================
  if (stats.subWorksDistribution && Object.keys(stats.subWorksDistribution).length > 0) {
    sheet.getCell(`A${row}`).value = 'SubWorks Distribution (COMPOSITE):';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    for (const [count, freq] of Object.entries(stats.subWorksDistribution)) {
      sheet.getCell(`A${row}`).value = `  ${count} subworks:`;
      sheet.getCell(`B${row}`).value = freq;
      row++;
    }

    row++;  // Blank row
  }

  // ========================================================================
  // CONFIDENCE LEVELS
  // ========================================================================
  sheet.getCell(`A${row}`).value = 'Confidence Levels:';
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  sheet.getCell(`A${row}`).value = 'High:';
  sheet.getCell(`B${row}`).value = stats.confidenceLevels.high;
  sheet.getCell(`B${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC6EFCE' }  // Green
  };
  row++;

  sheet.getCell(`A${row}`).value = 'Medium:';
  sheet.getCell(`B${row}`).value = stats.confidenceLevels.medium;
  row++;

  sheet.getCell(`A${row}`).value = 'Low:';
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
  sheet.getCell(`A${row}`).value = 'Review Status:';
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  sheet.getCell(`A${row}`).value = 'Needs Review:';
  sheet.getCell(`B${row}`).value = stats.needsReviewCount;
  sheet.getCell(`B${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFEB9C' }  // Yellow
  };
  row++;

  sheet.getCell(`A${row}`).value = 'Errors:';
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
