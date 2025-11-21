/**
 * Audit Logger Utility
 * Logs all admin actions to audit_logs table
 * Used for compliance, debugging, and security monitoring
 */

import db from '../db/index.js';
import { logger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Log an admin action
 * @param {number} adminId - ID of the admin performing the action
 * @param {string} action - Type of action (e.g., 'UPDATE_USER', 'DELETE_USER', 'VIEW_USERS_LIST')
 * @param {object} data - Additional data about the action (JSON)
 */
export async function logAdminAction(adminId, action, data = {}) {
  try {
    const id = uuidv4();
    const dataJson = JSON.stringify(data);
    const timestamp = new Date().toISOString();

    await db.prepare(`
      INSERT INTO audit_logs (id, admin_id, action, data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, adminId, action, dataJson, timestamp);

    logger.debug(`[AUDIT] Action logged: ${action} by admin ${adminId}`);
  } catch (error) {
    logger.error('[AUDIT] Error logging admin action:', error);
    // Don't throw - audit logging shouldn't break the main operation
  }
}

/**
 * Get audit logs with filtering
 * @param {object} filter - Filter object { action, admin_id, limit, offset }
 * @returns {object} Logs and pagination info
 */
export async function getAuditLogs(filter = {}) {
  try {
    const {
      action = null,
      admin_id = null,
      limit = 100,
      offset = 0
    } = filter;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (admin_id) {
      query += ' AND admin_id = ?';
      params.push(admin_id);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await db.prepare(countQuery).get(...params);
    const total = countResult.count;

    // Get paginated results
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = await db.prepare(query).all(...params);

    // Parse data field
    const parsedLogs = logs.map(log => ({
      ...log,
      data: log.data ? JSON.parse(log.data) : {}
    }));

    return {
      logs: parsedLogs,
      total,
      limit,
      offset,
      pages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('[AUDIT] Error retrieving audit logs:', error);
    throw error;
  }
}

/**
 * Get audit log statistics
 * @returns {object} Statistics about audit logs
 */
export async function getAuditStats() {
  try {
    const totalLogs = await db.prepare('SELECT COUNT(*) as count FROM audit_logs').get();

    const actionStats = await db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `).all();

    const adminStats = await db.prepare(`
      SELECT
        al.admin_id,
        u.email,
        COUNT(*) as action_count
      FROM audit_logs al
      JOIN users u ON al.admin_id = u.id
      GROUP BY al.admin_id, u.email
      ORDER BY action_count DESC
    `).all();

    const last24h = await db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE created_at > datetime('now', '-1 day')
    `).get();

    return {
      total_logs: totalLogs.count,
      actions_breakdown: actionStats,
      admin_activity: adminStats,
      last_24h_count: last24h.count
    };
  } catch (error) {
    logger.error('[AUDIT] Error calculating audit statistics:', error);
    throw error;
  }
}

/**
 * Clear old audit logs (retention policy)
 * @param {number} daysToKeep - Number of days of logs to keep (default: 90)
 */
export async function cleanupOldAuditLogs(daysToKeep = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.prepare(`
      DELETE FROM audit_logs
      WHERE created_at < ?
    `).run(cutoffDate.toISOString());

    logger.info(`[AUDIT] Cleaned up ${result.changes} old audit logs (> ${daysToKeep} days old)`);

    return result.changes;
  } catch (error) {
    logger.error('[AUDIT] Error cleaning up old audit logs:', error);
    throw error;
  }
}
