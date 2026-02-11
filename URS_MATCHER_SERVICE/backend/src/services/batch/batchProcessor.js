/**
 * Batch Processor Service
 * Main orchestrator for batch URS matching pipeline
 *
 * Purpose:
 * - Coordinate all batch processing stages
 * - Process positions in parallel (controlled concurrency)
 * - Handle pause/resume
 * - Track progress and errors
 * - Update database state
 *
 * Pipeline:
 * 1. Normalize text
 * 2. Split (detect SINGLE/COMPOSITE)
 * 3. Retrieve candidates (Perplexity)
 * 4. Rerank candidates (LLM scoring)
 * 5. Update results
 *
 * @module services/batch/batchProcessor
 */

import { v4 as uuidv4 } from 'uuid';
import pMap from 'p-map';
import { logger } from '../../utils/logger.js';
import { getDatabase } from '../../db/init.js';

import { normalize } from './textNormalizer.js';
import { split } from './workSplitter.js';
import { retrieve } from './candidateRetriever.js';
import { rerank } from './candidateReranker.js';
import * as batchCache from './batchCache.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONCURRENCY = 3;  // Process 3 positions in parallel
const BACKOFF_DELAYS = [2000, 4000, 8000, 16000];  // Exponential backoff for rate limits

// ============================================================================
// BATCH JOB MANAGEMENT
// ============================================================================

/**
 * Create new batch job
 * @param {Object} data - Job data
 * @param {string} data.name - Job name
 * @param {Array<Object>} data.items - Items to process
 * @param {Object} data.settings - Batch settings
 * @param {string} [data.portalProjectId] - Optional portal project ID
 * @returns {Object} Created job
 */
export async function createBatchJob(data) {
  try {
    const db = await getDatabase();
    const batchId = `batch_${uuidv4()}`;

    logger.info(`[BatchProcessor] Creating batch job: ${data.name}`);
    logger.info(`[BatchProcessor] Items: ${data.items.length}`);
    logger.info(`[BatchProcessor] Settings: ${JSON.stringify(data.settings)}`);

    // Create batch job
    await db.run(
      `INSERT INTO batch_jobs (id, name, status, settings, total_items, portal_project_id, created_at, updated_at)
       VALUES (?, ?, 'queued', ?, ?, ?, datetime('now'), datetime('now'))`,
      [batchId, data.name, JSON.stringify(data.settings), data.items.length, data.portalProjectId || null]
    );

    // Create batch items
    for (const item of data.items) {
      const itemId = `item_${uuidv4()}`;
      await db.run(
        `INSERT INTO batch_items (id, batch_id, line_no, original_text, context, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'queued', datetime('now'), datetime('now'))`,
        [itemId, batchId, item.lineNo || null, item.text, JSON.stringify(item.context || {})]
      );
    }

    logger.info(`[BatchProcessor] Created batch job: ${batchId}`);

    return {
      batchId: batchId,
      name: data.name,
      status: 'queued',
      totalItems: data.items.length
    };

  } catch (error) {
    logger.error(`[BatchProcessor] Create job error: ${error.message}`);
    throw new Error(`Failed to create batch job: ${error.message}`);
  }
}

/**
 * Start batch processing
 * @param {string} batchId - Batch job ID
 * @returns {Promise<void>}
 */
export async function startBatchJob(batchId) {
  const db = await getDatabase();

  try {
    logger.info(`[BatchProcessor] Starting batch job: ${batchId}`);

    // Update job status
    await db.run(
      `UPDATE batch_jobs SET status = 'running', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [batchId]
    );

    // Get job settings
    const job = await db.get(`SELECT * FROM batch_jobs WHERE id = ?`, [batchId]);
    const settings = JSON.parse(job.settings);

    // Process batch
    await processBatch(batchId, settings);

    // Update job status to completed
    await db.run(
      `UPDATE batch_jobs SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [batchId]
    );

    logger.info(`[BatchProcessor] Completed batch job: ${batchId}`);

  } catch (error) {
    logger.error(`[BatchProcessor] Batch job error: ${error.message}`);

    // Update job status to failed
    await db.run(
      `UPDATE batch_jobs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      [error.message, batchId]
    );

    throw error;
  }
}

/**
 * Pause batch processing
 * @param {string} batchId - Batch job ID
 * @returns {Promise<void>}
 */
export async function pauseBatchJob(batchId) {
  const db = await getDatabase();

  try {
    logger.info(`[BatchProcessor] Pausing batch job: ${batchId}`);

    await db.run(
      `UPDATE batch_jobs SET status = 'paused', updated_at = datetime('now') WHERE id = ?`,
      [batchId]
    );

    logger.info(`[BatchProcessor] Paused batch job: ${batchId}`);

  } catch (error) {
    logger.error(`[BatchProcessor] Pause error: ${error.message}`);
    throw new Error(`Failed to pause batch job: ${error.message}`);
  }
}

/**
 * Resume batch processing
 * @param {string} batchId - Batch job ID
 * @returns {Promise<void>}
 */
export async function resumeBatchJob(batchId) {
  const db = await getDatabase();

  try {
    logger.info(`[BatchProcessor] Resuming batch job: ${batchId}`);

    // Update job status
    await db.run(
      `UPDATE batch_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?`,
      [batchId]
    );

    // Get job settings
    const job = await db.get(`SELECT * FROM batch_jobs WHERE id = ?`, [batchId]);
    const settings = JSON.parse(job.settings);

    // Process remaining items
    await processBatch(batchId, settings);

    // Update job status to completed
    await db.run(
      `UPDATE batch_jobs SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [batchId]
    );

    logger.info(`[BatchProcessor] Resumed and completed batch job: ${batchId}`);

  } catch (error) {
    logger.error(`[BatchProcessor] Resume error: ${error.message}`);

    // Update job status to failed
    await db.run(
      `UPDATE batch_jobs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      [error.message, batchId]
    );

    throw error;
  }
}

/**
 * Get batch job status
 * @param {string} batchId - Batch job ID
 * @returns {Object} Job status
 */
export async function getBatchJobStatus(batchId) {
  const db = await getDatabase();

  try {
    const job = await db.get(`SELECT * FROM batch_jobs WHERE id = ?`, [batchId]);

    if (!job) {
      throw new Error(`Batch job not found: ${batchId}`);
    }

    // Get counts by status
    const statusCounts = await db.all(
      `SELECT status, COUNT(*) as count FROM batch_items WHERE batch_id = ? GROUP BY status`,
      [batchId]
    );

    const counts = statusCounts.reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    // Calculate progress
    const progress = job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0;

    // Estimate remaining time
    let estimatedTimeRemaining = null;
    if (job.status === 'running' && job.processed_items > 0) {
      const elapsed = new Date() - new Date(job.started_at);
      const avgTimePerItem = elapsed / job.processed_items;
      const remaining = job.total_items - job.processed_items;
      estimatedTimeRemaining = Math.round(avgTimePerItem * remaining / 1000);  // seconds
    }

    return {
      batchId: batchId,
      name: job.name,
      status: job.status,
      totalItems: job.total_items,
      processedItems: job.processed_items,
      errorCount: job.error_count,
      needsReviewCount: job.needs_review_count,
      progress: progress,
      statusCounts: counts,
      estimatedTimeRemaining: estimatedTimeRemaining,
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message
    };

  } catch (error) {
    logger.error(`[BatchProcessor] Get status error: ${error.message}`);
    throw new Error(`Failed to get batch job status: ${error.message}`);
  }
}

/**
 * Get batch job results
 * @param {string} batchId - Batch job ID
 * @returns {Object} Job results
 */
export async function getBatchJobResults(batchId) {
  const db = await getDatabase();

  try {
    const job = await db.get(`SELECT * FROM batch_jobs WHERE id = ?`, [batchId]);

    if (!job) {
      throw new Error(`Batch job not found: ${batchId}`);
    }

    // Get all items with results
    const items = await db.all(
      `SELECT * FROM batch_items WHERE batch_id = ? ORDER BY line_no, id`,
      [batchId]
    );

    const results = items.map(item => ({
      lineNo: item.line_no,
      originalText: item.original_text,
      normalizedText: item.normalized_text,
      detectedType: item.detected_type,
      status: item.status,
      subWorks: item.sub_works ? JSON.parse(item.sub_works) : [],
      results: item.results ? JSON.parse(item.results) : [],
      errorMessage: item.error_message
    }));

    return {
      batchId: batchId,
      name: job.name,
      status: job.status,
      totalItems: job.total_items,
      results: results
    };

  } catch (error) {
    logger.error(`[BatchProcessor] Get results error: ${error.message}`);
    throw new Error(`Failed to get batch job results: ${error.message}`);
  }
}

// ============================================================================
// BATCH PROCESSING (MAIN PIPELINE)
// ============================================================================

/**
 * Process all items in batch
 * @param {string} batchId - Batch job ID
 * @param {Object} settings - Batch settings
 * @returns {Promise<void>}
 */
async function processBatch(batchId, settings) {
  const db = await getDatabase();

  // Get items to process (queued or error status)
  const items = await db.all(
    `SELECT * FROM batch_items WHERE batch_id = ? AND status IN ('queued', 'error') ORDER BY line_no, id`,
    [batchId]
  );

  if (items.length === 0) {
    logger.info(`[BatchProcessor] No items to process for batch: ${batchId}`);
    return;
  }

  logger.info(`[BatchProcessor] Processing ${items.length} items (concurrency: ${DEFAULT_CONCURRENCY})`);

  // Process items in parallel with controlled concurrency
  await pMap(items, async (item) => {
    try {
      // Check if job was paused before processing each item
      const currentJob = await db.get(`SELECT status FROM batch_jobs WHERE id = ?`, [batchId]);
      if (currentJob && currentJob.status === 'paused') {
        logger.info(`[BatchProcessor] Job ${batchId} paused, skipping item ${item.id}`);
        return;
      }

      await processPosition(batchId, item.id, settings);

      // Update processed count
      await db.run(
        `UPDATE batch_jobs SET processed_items = processed_items + 1, updated_at = datetime('now') WHERE id = ?`,
        [batchId]
      );

    } catch (error) {
      logger.error(`[BatchProcessor] Position ${item.id} error: ${error.message}`);

      // Update error count
      await db.run(
        `UPDATE batch_jobs SET error_count = error_count + 1, updated_at = datetime('now') WHERE id = ?`,
        [batchId]
      );

      // Don't throw - continue with other items
    }
  }, { concurrency: DEFAULT_CONCURRENCY });

  // Update needs_review_count
  const needsReview = await db.get(
    `SELECT COUNT(*) as count FROM batch_items WHERE batch_id = ? AND status = 'needs_review'`,
    [batchId]
  );
  await db.run(
    `UPDATE batch_jobs SET needs_review_count = ? WHERE id = ?`,
    [needsReview.count, batchId]
  );

  logger.info(`[BatchProcessor] Batch processing complete: ${batchId}`);
}

/**
 * Process single position through pipeline
 * @param {string} batchId - Batch job ID
 * @param {string} itemId - Item ID
 * @param {Object} settings - Batch settings
 * @returns {Promise<void>}
 */
async function processPosition(batchId, itemId, settings) {
  const db = await getDatabase();
  const startTime = Date.now();

  try {
    // Get item
    const item = await db.get(`SELECT * FROM batch_items WHERE id = ?`, [itemId]);
    const context = JSON.parse(item.context || '{}');

    logger.info(`[BatchProcessor] Item ${itemId}: "${item.original_text}"`);

    // ========================================================================
    // STEP 1: NORMALIZE TEXT
    // ========================================================================
    await updateItemStatus(itemId, 'parsed');

    const normalized = await normalize({
      originalText: item.original_text,
      context: context
    });

    await db.run(
      `UPDATE batch_items SET normalized_text = ?, updated_at = datetime('now') WHERE id = ?`,
      [normalized.normalizedText, itemId]
    );

    logger.debug(`[BatchProcessor] Item ${itemId}: Normalized`);

    // ========================================================================
    // STEP 2: SPLIT (SINGLE/COMPOSITE)
    // ========================================================================
    await updateItemStatus(itemId, 'split');

    // Check cache
    const splitCacheKey = batchCache.splitCacheKey(normalized.normalizedText, settings);
    let splitResult = await batchCache.get(splitCacheKey, 'split');

    if (!splitResult) {
      splitResult = await split(normalized, settings.maxSubWorks || 5);
      await batchCache.set(splitCacheKey, 'split', splitResult);
    } else {
      logger.info(`[BatchProcessor] Item ${itemId}: Split result from cache`);
    }

    await db.run(
      `UPDATE batch_items SET detected_type = ?, sub_works = ?, updated_at = datetime('now') WHERE id = ?`,
      [splitResult.detectedType, JSON.stringify(splitResult.subWorks), itemId]
    );

    logger.info(`[BatchProcessor] Item ${itemId}: ${splitResult.detectedType} (${splitResult.subWorks.length} subwork(s))`);

    // ========================================================================
    // STEP 3: RETRIEVE + RERANK (for each subwork)
    // ========================================================================
    await updateItemStatus(itemId, 'retrieved');

    const results = [];

    for (const subWork of splitResult.subWorks) {
      logger.info(`[BatchProcessor] Item ${itemId}: SubWork ${subWork.index} - "${subWork.text}"`);

      // ========================================================================
      // 3a. RETRIEVE CANDIDATES
      // ========================================================================
      const retrieveCacheKey = batchCache.retrieveCacheKey(subWork, settings.searchDepth || 'normal');
      let retrieveResult = await batchCache.get(retrieveCacheKey, 'retrieve');

      if (!retrieveResult) {
        retrieveResult = await retrieve(subWork, settings.searchDepth || 'normal');
        await batchCache.set(retrieveCacheKey, 'retrieve', retrieveResult);
      } else {
        logger.info(`[BatchProcessor] Item ${itemId}: Retrieve result from cache`);
      }

      logger.info(`[BatchProcessor] Item ${itemId}: SubWork ${subWork.index} - ${retrieveResult.candidates.length} candidates`);

      // ========================================================================
      // 3b. RERANK CANDIDATES
      // ========================================================================
      await updateItemStatus(itemId, 'ranked');

      const rerankCacheKey = batchCache.rerankCacheKey(subWork, retrieveResult.candidates, settings.candidatesPerWork || 4);
      let rerankResult = await batchCache.get(rerankCacheKey, 'rerank');

      if (!rerankResult) {
        rerankResult = await rerank(subWork, retrieveResult.candidates, settings.candidatesPerWork || 4);
        await batchCache.set(rerankCacheKey, 'rerank', rerankResult);
      } else {
        logger.info(`[BatchProcessor] Item ${itemId}: Rerank result from cache`);
      }

      logger.info(`[BatchProcessor] Item ${itemId}: SubWork ${subWork.index} - ${rerankResult.topCandidates.length} candidates ranked`);

      // Store result
      results.push({
        subWork: subWork,
        candidates: rerankResult.topCandidates,
        retrievalFailed: retrieveResult.error ? true : false,
        retrievalError: retrieveResult.error || null
      });
    }

    // ========================================================================
    // STEP 4: UPDATE RESULTS
    // ========================================================================

    // Check if ANY subwork has candidates with needsReview or low confidence
    const hasLowConfidence = results.some(r =>
      r.candidates.some(c => c.needsReview || c.confidence === 'low')
    );

    // CRITICAL: If ALL subworks have 0 candidates, mark as needs_review
    // This catches the case where Perplexity/retrieve fails silently
    const allEmpty = results.every(r => !r.candidates || r.candidates.length === 0);
    const hasRetrievalError = results.some(r => r.retrievalFailed);

    if (allEmpty) {
      logger.warn(`[BatchProcessor] Item ${itemId}: ALL subworks returned 0 candidates - marking needs_review`);
    }
    if (hasRetrievalError) {
      logger.warn(`[BatchProcessor] Item ${itemId}: Retrieval errors detected - marking needs_review`);
    }

    const needsReview = hasLowConfidence || allEmpty || hasRetrievalError;
    const finalStatus = needsReview ? 'needs_review' : 'done';

    await db.run(
      `UPDATE batch_items SET status = ?, results = ?, updated_at = datetime('now') WHERE id = ?`,
      [finalStatus, JSON.stringify(results), itemId]
    );

    const elapsed = Date.now() - startTime;
    logger.info(`[BatchProcessor] Item ${itemId}: ${finalStatus} (${elapsed}ms)`);

  } catch (error) {
    logger.error(`[BatchProcessor] Item ${itemId}: Error: ${error.message}`);
    logger.error(`[BatchProcessor] Item ${itemId}: Stack: ${error.stack}`);

    // Update item status to error
    await db.run(
      `UPDATE batch_items SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      [error.message, itemId]
    );

    throw error;
  }
}

/**
 * Update item status
 * @param {string} itemId - Item ID
 * @param {string} status - New status
 * @returns {Promise<void>}
 */
async function updateItemStatus(itemId, status) {
  const db = await getDatabase();
  await db.run(
    `UPDATE batch_items SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    [status, itemId]
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createBatchJob,
  startBatchJob,
  pauseBatchJob,
  resumeBatchJob,
  getBatchJobStatus,
  getBatchJobResults
};
