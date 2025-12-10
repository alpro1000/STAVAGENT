/**
 * Scheduled Import Service
 *
 * Persistent background jobs for:
 * - Auto-approval of pending catalog versions (every 5 minutes)
 * - Cleanup of old archived versions (weekly)
 * - Health checks and alerts (hourly)
 *
 * Uses node-cron for persistence across application restarts
 */

import cron from 'node-cron';
import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';
import { CatalogVersionManager, CatalogAuditLog } from './catalogImportService.js';

const auditLog = new CatalogAuditLog();
const versionManager = new CatalogVersionManager();

const APPROVAL_TIMEOUT_HOURS = parseInt(process.env.APPROVAL_TIMEOUT_HOURS || '24');
const CLEANUP_VERSIONS_TO_KEEP = 3;

/**
 * Auto-approval job: Check for pending versions that exceeded timeout
 * Runs every 5 minutes to ensure timely auto-approval even after restarts
 */
export function scheduleAutoApprovalJob() {
  return cron.schedule('*/5 * * * *', async () => {
    try {
      const db = await getDatabase();

      // Find pending versions that exceeded timeout
      const pendingVersions = await db.all(
        `SELECT version_id FROM catalog_versions
         WHERE status = 'pending'
         AND created_at < datetime('now', '-' || ? || ' hours')`,
        [APPROVAL_TIMEOUT_HOURS]
      );

      if (pendingVersions.length === 0) {
        return; // No pending versions to process
      }

      logger.info(`[AUTO-APPROVE-JOB] Found ${pendingVersions.length} version(s) ready for auto-approval`);

      for (const version of pendingVersions) {
        try {
          logger.warn(`[AUTO-APPROVE-JOB] Auto-approving version after timeout: ${version.version_id}`);
          await versionManager.approveVersion(
            version.version_id,
            `Auto-approved after ${APPROVAL_TIMEOUT_HOURS} hour timeout`
          );

          await auditLog.log('auto_approval_completed', {
            version_id: version.version_id,
            timeout_hours: APPROVAL_TIMEOUT_HOURS
          });
        } catch (error) {
          logger.error(
            `[AUTO-APPROVE-JOB] Failed to auto-approve ${version.version_id}: ${error.message}`
          );

          await auditLog.log('auto_approval_failed', {
            version_id: version.version_id,
            error: error.message
          });
        }
      }
    } catch (error) {
      logger.error(`[AUTO-APPROVE-JOB] Error: ${error.message}`);
    }
  });
}

/**
 * Cleanup job: Archive old versions and keep only N recent ones
 * Runs weekly on Sunday at 3 AM UTC
 */
export function scheduleCleanupJob() {
  return cron.schedule('0 3 * * 0', async () => {
    try {
      const db = await getDatabase();

      logger.info('[CLEANUP-JOB] Starting cleanup of old catalog versions');

      // Get all inactive versions sorted by activation date (newest first)
      const inactiveVersions = await db.all(
        `SELECT id, version_id FROM catalog_versions
         WHERE status IN ('inactive', 'rejected', 'archived')
         ORDER BY activated_at DESC, created_at DESC`
      );

      if (inactiveVersions.length <= CLEANUP_VERSIONS_TO_KEEP) {
        logger.info('[CLEANUP-JOB] No old versions to clean up');
        return;
      }

      // Archive versions beyond keep threshold
      const versionsToArchive = inactiveVersions.slice(CLEANUP_VERSIONS_TO_KEEP);

      for (const version of versionsToArchive) {
        try {
          // Mark as archived
          await db.run(
            `UPDATE catalog_versions SET status = 'archived' WHERE version_id = ?`,
            [version.version_id]
          );

          logger.info(`[CLEANUP-JOB] Archived version: ${version.version_id}`);

          await auditLog.log('version_archived', {
            version_id: version.version_id,
            reason: 'Automatic cleanup - exceeded retention policy'
          });
        } catch (error) {
          logger.error(
            `[CLEANUP-JOB] Failed to archive ${version.version_id}: ${error.message}`
          );
        }
      }

      logger.info(`[CLEANUP-JOB] Cleanup completed. Archived ${versionsToArchive.length} versions.`);
    } catch (error) {
      logger.error(`[CLEANUP-JOB] Error: ${error.message}`);
    }
  });
}

/**
 * Health check job: Verify catalog integrity and alert on issues
 * Runs hourly at :00
 */
export function scheduleHealthCheckJob() {
  return cron.schedule('0 * * * *', async () => {
    try {
      const db = await getDatabase();

      // Check if catalog has active version
      const activeVersion = await db.get(
        `SELECT version_id, imported_codes_count FROM catalog_versions WHERE status = 'active'`
      );

      if (!activeVersion) {
        logger.warn('[HEALTH-CHECK-JOB] WARNING: No active catalog version');

        await auditLog.log('health_check_warning', {
          issue: 'no_active_version'
        });
        return;
      }

      // Check catalog size is reasonable
      const codeCount = await db.get(
        `SELECT COUNT(*) as count FROM urs_items`
      );

      if (codeCount.count < 100) {
        logger.warn(
          `[HEALTH-CHECK-JOB] WARNING: Low catalog size (${codeCount.count} codes)`
        );

        await auditLog.log('health_check_warning', {
          issue: 'low_catalog_size',
          code_count: codeCount.count
        });
      }

      // Check for stuck pending approvals
      const stuckPending = await db.get(
        `SELECT COUNT(*) as count FROM catalog_versions
         WHERE status = 'pending'
         AND created_at < datetime('now', '-72 hours')`  // Stuck for 72+ hours
      );

      if (stuckPending.count > 0) {
        logger.warn(
          `[HEALTH-CHECK-JOB] WARNING: ${stuckPending.count} pending version(s) stuck for 72+ hours`
        );

        await auditLog.log('health_check_warning', {
          issue: 'stuck_pending_versions',
          count: stuckPending.count
        });
      }

      logger.debug('[HEALTH-CHECK-JOB] Health check passed');
    } catch (error) {
      logger.error(`[HEALTH-CHECK-JOB] Error: ${error.message}`);
    }
  });
}

/**
 * Initialize all scheduled jobs
 * Call this once on application startup
 */
export function initializeScheduledJobs() {
  try {
    logger.info('[SCHEDULED-JOBS] Initializing scheduled import jobs...');

    const autoApprovalJob = scheduleAutoApprovalJob();
    const cleanupJob = scheduleCleanupJob();
    const healthCheckJob = scheduleHealthCheckJob();

    logger.info('[SCHEDULED-JOBS] ✓ Auto-approval job scheduled (every 5 minutes)');
    logger.info('[SCHEDULED-JOBS] ✓ Cleanup job scheduled (weekly Sunday 3 AM)');
    logger.info('[SCHEDULED-JOBS] ✓ Health check job scheduled (hourly)');

    return {
      autoApprovalJob,
      cleanupJob,
      healthCheckJob,
      stop: () => {
        autoApprovalJob.stop();
        cleanupJob.stop();
        healthCheckJob.stop();
        logger.info('[SCHEDULED-JOBS] All jobs stopped');
      }
    };
  } catch (error) {
    logger.error(`[SCHEDULED-JOBS] Failed to initialize: ${error.message}`);
    throw error;
  }
}
