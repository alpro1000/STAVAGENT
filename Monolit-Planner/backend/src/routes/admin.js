/**
 * Admin Routes
 * Provides user management, audit logging, and admin panel functionality
 * All routes require authentication + admin role
 */

import express from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { logger } from '../utils/logger.js';
import { logAdminAction } from '../utils/auditLogger.js';

const router = express.Router();

/**
 * GET /api/admin/users
 * List all users with basic info
 */
router.get('/users', requireAuth, adminOnly, async (req, res) => {
  try {
    logger.info(`[ADMIN] User list requested by admin ${req.user.userId}`);

    const users = await db.prepare(`
      SELECT
        id,
        email,
        name,
        role,
        email_verified,
        email_verified_at,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    // Log the action
    await logAdminAction(req.user.userId, 'VIEW_USERS_LIST', {
      user_count: users.length
    });

    res.json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error) {
    logger.error('[ADMIN] Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: 'Chyba při načítání seznamu uživatelů'
    });
  }
});

/**
 * GET /api/admin/users/:id
 * Get specific user details
 */
router.get('/users/:id', requireAuth, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'ID uživatele musí být číslo'
      });
    }

    const user = await db.prepare(`
      SELECT
        id,
        email,
        name,
        role,
        email_verified,
        email_verified_at,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Uživatel nebyl nalezen'
      });
    }

    // Log the action
    await logAdminAction(req.user.userId, 'VIEW_USER_DETAILS', {
      target_user_id: userId
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('[ADMIN] Error fetching user details:', error);
    res.status(500).json({
      error: 'Failed to fetch user',
      message: 'Chyba při načítání detailů uživatele'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user role or other admin-controlled properties
 */
router.put('/users/:id', requireAuth, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role, email_verified } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'ID uživatele musí být číslo'
      });
    }

    // Prevent admin from modifying their own role
    if (userId === req.user.userId && role !== undefined) {
      return res.status(403).json({
        error: 'Cannot modify own role',
        message: 'Nemůžete měnit svou vlastní roli'
      });
    }

    // Validate role if provided
    const validRoles = ['user', 'admin'];
    if (role !== undefined && !validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role musí být "user" nebo "admin"'
      });
    }

    // Get current user data
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Uživatel nebyl nalezen'
      });
    }

    // Prepare updates
    const updates = [];
    const values = [];

    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }

    if (email_verified !== undefined) {
      updates.push('email_verified = ?');
      values.push(email_verified ? true : false);

      if (email_verified && !user.email_verified) {
        updates.push('email_verified_at = ?');
        values.push(new Date().toISOString());
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Musíte poskytnout alespoň jednu změnu'
      });
    }

    values.push(userId);
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    await db.prepare(updateQuery).run(...values);

    // Log the action
    const changes = {};
    if (role !== undefined) changes.role = role;
    if (email_verified !== undefined) changes.email_verified = email_verified;

    await logAdminAction(req.user.userId, 'UPDATE_USER', {
      target_user_id: userId,
      changes
    });

    // Fetch updated user
    const updatedUser = await db.prepare(`
      SELECT id, email, name, role, email_verified, email_verified_at, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(userId);

    logger.info(`[ADMIN] User ${userId} updated by admin ${req.user.userId}:`, changes);

    res.json({
      success: true,
      message: 'Uživatel byl úspěšně aktualizován',
      data: updatedUser
    });
  } catch (error) {
    logger.error('[ADMIN] Error updating user:', error);
    res.status(500).json({
      error: 'Failed to update user',
      message: 'Chyba při aktualizaci uživatele'
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user (cascade delete all related data)
 */
router.delete('/users/:id', requireAuth, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'ID uživatele musí být číslo'
      });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.userId) {
      return res.status(403).json({
        error: 'Cannot delete own account',
        message: 'Nemůžete odstranit svůj vlastní účet'
      });
    }

    // Check if user exists
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Uživatel nebyl nalezen'
      });
    }

    // Delete user (cascade delete via foreign keys)
    await db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // Log the action
    await logAdminAction(req.user.userId, 'DELETE_USER', {
      target_user_id: userId,
      target_user_email: user.email,
      target_user_name: user.name
    });

    logger.info(`[ADMIN] User ${userId} (${user.email}) deleted by admin ${req.user.userId}`);

    res.json({
      success: true,
      message: 'Uživatel byl úspěšně odstraněn'
    });
  } catch (error) {
    logger.error('[ADMIN] Error deleting user:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: 'Chyba při odstranění uživatele'
    });
  }
});

/**
 * GET /api/admin/audit-logs
 * Get audit logs with optional filtering
 */
router.get('/audit-logs', requireAuth, adminOnly, async (req, res) => {
  try {
    const { action, admin_id, limit = 100, offset = 0 } = req.query;

    logger.info(`[ADMIN] Audit logs requested by admin ${req.user.userId}`, {
      action,
      admin_id,
      limit,
      offset
    });

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    // Filter by action if provided
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    // Filter by admin_id if provided
    if (admin_id) {
      query += ' AND admin_id = ?';
      params.push(parseInt(admin_id));
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await db.prepare(countQuery).get(...params);
    const total = countResult.count;

    // Add order, limit, and offset
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = await db.prepare(query).all(...params);

    // Parse JSON data field
    const parsedLogs = logs.map(log => ({
      ...log,
      data: log.data ? JSON.parse(log.data) : {}
    }));

    res.json({
      success: true,
      data: parsedLogs,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('[ADMIN] Error fetching audit logs:', error);
    res.status(500).json({
      error: 'Failed to fetch audit logs',
      message: 'Chyba při načítání auditních záznamů'
    });
  }
});

/**
 * GET /api/admin/audit-logs/stats
 * Get audit log statistics
 */
router.get('/audit-logs/stats', requireAuth, adminOnly, async (req, res) => {
  try {
    // Get total logs count
    const totalLogs = await db.prepare('SELECT COUNT(*) as count FROM audit_logs').get();

    // Get actions breakdown
    const actionStats = await db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `).all();

    // Get admin activity
    const adminStats = await db.prepare(`
      SELECT
        al.admin_id,
        u.email,
        u.name,
        COUNT(*) as action_count
      FROM audit_logs al
      JOIN users u ON al.admin_id = u.id
      GROUP BY al.admin_id, u.email, u.name
      ORDER BY action_count DESC
    `).all();

    // Get logs from last 24 hours
    const last24h = await db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE created_at > datetime('now', '-1 day')
    `).get();

    logger.info(`[ADMIN] Audit log statistics requested by admin ${req.user.userId}`);

    res.json({
      success: true,
      data: {
        total_logs: totalLogs.count,
        actions_breakdown: actionStats,
        admin_activity: adminStats,
        last_24h_count: last24h.count
      }
    });
  } catch (error) {
    logger.error('[ADMIN] Error fetching audit log stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'Chyba při načítání statistik'
    });
  }
});

/**
 * GET /api/admin/stats
 * Get overall admin statistics
 */
router.get('/stats', requireAuth, adminOnly, async (req, res) => {
  try {
    // Get user statistics
    const totalUsers = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const adminUsers = await db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "admin"').get();
    const verifiedUsers = await db.prepare('SELECT COUNT(*) as count FROM users WHERE email_verified = 1 OR email_verified = true').get();

    // Get project statistics
    const totalProjects = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();

    // Get recent activity
    const recentUsers = await db.prepare(`
      SELECT id, email, name, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    logger.info(`[ADMIN] Admin statistics requested by admin ${req.user.userId}`);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers.count,
          admins: adminUsers.count,
          verified: verifiedUsers.count
        },
        projects: {
          total: totalProjects.count
        },
        recent_users: recentUsers
      }
    });
  } catch (error) {
    logger.error('[ADMIN] Error fetching statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'Chyba při načítání statistik'
    });
  }
});

export default router;
