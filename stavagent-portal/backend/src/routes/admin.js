/**
 * Admin Routes
 * Provides user management, audit logging, and admin panel functionality
 * All routes require authentication + admin role
 */

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminOnly.js';
import { logger } from '../utils/logger.js';
import { logAdminAction } from '../utils/auditLogger.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function resolveModelAuditReportPath() {
  const explicitPath = process.env.MODEL_AUDIT_REPORT_PATH;
  const candidates = [
    explicitPath,
    resolve(process.cwd(), 'MODEL_CONNECTION_REPORT.md'),
    resolve(process.cwd(), '..', 'MODEL_CONNECTION_REPORT.md'),
    resolve(process.cwd(), '..', '..', 'MODEL_CONNECTION_REPORT.md'),
    resolve(__dirname, '../../../../MODEL_CONNECTION_REPORT.md'),
  ].filter(Boolean);

  return candidates.find(p => fs.existsSync(p));
}

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
        phone,
        phone_verified,
        plan,
        free_pipeline_runs_used,
        registration_ip,
        banned,
        banned_at,
        banned_reason,
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
    const { role, email_verified, banned, banned_reason } = req.body;

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

    if (banned !== undefined) {
      updates.push('banned = ?');
      values.push(banned ? true : false);
      if (banned) {
        updates.push('banned_at = ?');
        values.push(new Date().toISOString());
        if (banned_reason) {
          updates.push('banned_reason = ?');
          values.push(banned_reason);
        }
      } else {
        updates.push('banned_at = NULL');
        updates.push('banned_reason = NULL');
      }
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
    if (banned !== undefined) changes.banned = banned;
    if (banned_reason) changes.banned_reason = banned_reason;

    await logAdminAction(req.user.userId, 'UPDATE_USER', {
      target_user_id: userId,
      changes
    });

    // Fetch updated user
    const updatedUser = await db.prepare(`
      SELECT id, email, name, role, email_verified, email_verified_at, banned, banned_at, banned_reason, created_at, updated_at
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
    let totalLogs = { count: 0 };
    let actionStats = [];
    let adminStats = [];
    let last24h = { count: 0 };

    try {
      totalLogs = await db.prepare('SELECT COUNT(*) as count FROM audit_logs').get();
      actionStats = await db.prepare(`
        SELECT action, COUNT(*) as count
        FROM audit_logs
        GROUP BY action
        ORDER BY count DESC
      `).all();
      adminStats = await db.prepare(`
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
      // Use $1 parameter with JS-computed timestamp (works on both PostgreSQL and SQLite)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      last24h = await db.prepare(
        'SELECT COUNT(*) as count FROM audit_logs WHERE created_at > $1'
      ).get(oneDayAgo);
    } catch (tableErr) {
      // audit_logs table may not exist yet — return empty stats
      logger.warn(`[ADMIN] audit_logs query failed (table may not exist): ${tableErr.message}`);
    }

    res.json({
      success: true,
      data: {
        total_logs: totalLogs?.count || 0,
        actions_breakdown: actionStats || [],
        admin_activity: adminStats || [],
        last_24h_count: last24h?.count || 0
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
    const adminUsers = await db.prepare('SELECT COUNT(*) as count FROM users WHERE role = \'admin\'').get();
    const verifiedUsers = await db.prepare('SELECT COUNT(*) as count FROM users WHERE email_verified = 1 OR email_verified = true').get();

    // Get project statistics (portal_projects, not monolith_projects)
    let totalProjects = { count: 0 };
    let projectsByStatus = [];
    try {
      totalProjects = await db.prepare('SELECT COUNT(*) as count FROM portal_projects').get();
      projectsByStatus = await db.prepare(`
        SELECT status, COUNT(*) as count
        FROM portal_projects
        GROUP BY status
      `).all();
    } catch { /* table may not exist yet */ }

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
          total: totalProjects.count,
          by_status: projectsByStatus
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

/**
 * GET /api/admin/model-audit-report
 * Returns generated model connectivity audit report
 */
router.get('/model-audit-report', requireAuth, adminOnly, async (req, res) => {
  try {
    const reportPath = resolveModelAuditReportPath();

    if (!reportPath) {
      return res.status(404).json({
        success: false,
        error: 'MODEL_CONNECTION_REPORT.md not found',
        message: 'Audit report was not found on server. Run ./scripts/check_model_connections.sh first.',
      });
    }

    const content = fs.readFileSync(reportPath, 'utf8');
    const stats = fs.statSync(reportPath);

    await logAdminAction(req.user.userId, 'VIEW_MODEL_AUDIT_REPORT', {
      report_path: reportPath,
      report_size_bytes: stats.size,
      report_updated_at: stats.mtime.toISOString(),
    });

    res.json({
      success: true,
      data: {
        path: reportPath,
        updated_at: stats.mtime.toISOString(),
        size_bytes: stats.size,
        content,
      },
    });
  } catch (error) {
    logger.error('[ADMIN] Error loading model audit report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load model audit report',
      message: 'Chyba při načítání reportu modelového auditu',
    });
  }
});

// ============================================================================
// USAGE STATS (SaaS Phase 1)
// ============================================================================

/**
 * GET /api/admin/usage-stats
 * Get usage statistics (tokens, models, services, top users)
 */
router.get('/usage-stats', requireAuth, adminOnly, async (req, res) => {
  try {
    const { days = 30, user_id } = req.query;
    const { getUsageStats } = await import('../services/usageTracker.js');

    const stats = await getUsageStats({
      days: parseInt(days),
      userId: user_id ? parseInt(user_id) : null,
    });

    await logAdminAction(req.user.userId, 'VIEW_USAGE_STATS', { days });

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[ADMIN] Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

/**
 * GET /api/admin/user-usage/:id
 * Get detailed usage for a specific user
 */
router.get('/user-usage/:id', requireAuth, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { getUserUsage } = await import('../services/usageTracker.js');

    const usage = await getUserUsage(userId);
    if (!usage) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, data: usage });
  } catch (error) {
    logger.error('[ADMIN] Error fetching user usage:', error);
    res.status(500).json({ error: 'Failed to fetch user usage' });
  }
});

// ============================================================================
// FEATURE FLAGS (Granular toggles)
// ============================================================================

/**
 * GET /api/admin/feature-flags
 * List all feature flags with overrides
 */
router.get('/feature-flags', requireAuth, adminOnly, async (req, res) => {
  try {
    const { getAllFlagsAdmin } = await import('../services/featureFlags.js');
    const flags = await getAllFlagsAdmin();

    res.json({ success: true, data: flags });
  } catch (error) {
    logger.error('[ADMIN] Error fetching feature flags:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

/**
 * PUT /api/admin/feature-flags/:flagKey/default
 * Update default enabled state of a flag
 */
router.put('/feature-flags/:flagKey/default', requireAuth, adminOnly, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const { updateFlagDefault } = await import('../services/featureFlags.js');
    await updateFlagDefault(flagKey, enabled);

    await logAdminAction(req.user.userId, 'UPDATE_FEATURE_FLAG', {
      flag_key: flagKey,
      default_enabled: enabled,
    });

    res.json({ success: true, message: `Flag '${flagKey}' default set to ${enabled}` });
  } catch (error) {
    logger.error('[ADMIN] Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

/**
 * POST /api/admin/feature-flags/:flagKey/override
 * Set an override for a specific scope (plan/org/user)
 */
router.post('/feature-flags/:flagKey/override', requireAuth, adminOnly, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const { scope_type, scope_value, enabled } = req.body;

    if (!['plan', 'org', 'user'].includes(scope_type)) {
      return res.status(400).json({ error: 'scope_type must be plan, org, or user' });
    }
    if (!scope_value) {
      return res.status(400).json({ error: 'scope_value is required' });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const { setFlagOverride } = await import('../services/featureFlags.js');
    await setFlagOverride(flagKey, scope_type, scope_value, enabled, req.user.userId);

    await logAdminAction(req.user.userId, 'SET_FEATURE_FLAG_OVERRIDE', {
      flag_key: flagKey,
      scope_type,
      scope_value,
      enabled,
    });

    res.json({ success: true, message: 'Override set' });
  } catch (error) {
    logger.error('[ADMIN] Error setting flag override:', error);
    res.status(500).json({ error: error.message || 'Failed to set override' });
  }
});

/**
 * DELETE /api/admin/feature-flags/:flagKey/override
 * Remove an override
 */
router.delete('/feature-flags/:flagKey/override', requireAuth, adminOnly, async (req, res) => {
  try {
    const { flagKey } = req.params;
    const { scope_type, scope_value } = req.body;

    const { removeFlagOverride } = await import('../services/featureFlags.js');
    await removeFlagOverride(flagKey, scope_type, scope_value);

    await logAdminAction(req.user.userId, 'REMOVE_FEATURE_FLAG_OVERRIDE', {
      flag_key: flagKey,
      scope_type,
      scope_value,
    });

    res.json({ success: true, message: 'Override removed' });
  } catch (error) {
    logger.error('[ADMIN] Error removing flag override:', error);
    res.status(500).json({ error: 'Failed to remove override' });
  }
});

/**
 * POST /api/admin/feature-flags
 * Create a new feature flag
 */
router.post('/feature-flags', requireAuth, adminOnly, async (req, res) => {
  try {
    const { flag_key, display_name, description, category, default_enabled } = req.body;

    if (!flag_key || !display_name) {
      return res.status(400).json({ error: 'flag_key and display_name are required' });
    }

    const { createFlag } = await import('../services/featureFlags.js');
    await createFlag({
      flagKey: flag_key,
      displayName: display_name,
      description,
      category,
      defaultEnabled: default_enabled,
    });

    await logAdminAction(req.user.userId, 'CREATE_FEATURE_FLAG', { flag_key });

    res.status(201).json({ success: true, message: `Flag '${flag_key}' created` });
  } catch (error) {
    logger.error('[ADMIN] Error creating feature flag:', error);
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
});

// ============================================================================
// IP ANTI-FRAUD STATS
// ============================================================================

/**
 * GET /api/admin/registration-ips
 * Get registration IP statistics for anti-fraud monitoring
 */
router.get('/registration-ips', requireAuth, adminOnly, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const { getRegistrationIPStats } = await import('../middleware/ipAntifraud.js');

    const stats = await getRegistrationIPStats(parseInt(days));

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[ADMIN] Error fetching IP stats:', error);
    res.status(500).json({ error: 'Failed to fetch IP statistics' });
  }
});

/**
 * PUT /api/admin/users/:id/plan
 * Change user's plan (free/starter/professional/enterprise)
 */
router.put('/users/:id/plan', requireAuth, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { plan } = req.body;

    const validPlans = ['free', 'starter', 'professional', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: `Plan must be one of: ${validPlans.join(', ')}` });
    }

    await db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, userId);

    await logAdminAction(req.user.userId, 'CHANGE_USER_PLAN', {
      target_user_id: userId,
      plan,
    });

    res.json({ success: true, message: `User ${userId} plan changed to ${plan}` });
  } catch (error) {
    logger.error('[ADMIN] Error changing user plan:', error);
    res.status(500).json({ error: 'Failed to change user plan' });
  }
});

/**
 * PUT /api/admin/users/:id/quota-reset
 * Reset a user's free pipeline runs counter
 */
router.put('/users/:id/quota-reset', requireAuth, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    await db.prepare(
      'UPDATE users SET free_pipeline_runs_used = 0 WHERE id = ?'
    ).run(userId);

    await logAdminAction(req.user.userId, 'RESET_USER_QUOTA', {
      target_user_id: userId,
    });

    res.json({ success: true, message: `Quota reset for user ${userId}` });
  } catch (error) {
    logger.error('[ADMIN] Error resetting quota:', error);
    res.status(500).json({ error: 'Failed to reset quota' });
  }
});

// ── Banned Email Domains ──────────────────────────────────────────────────────

/**
 * GET /api/admin/banned-domains — list all banned email domains
 */
router.get('/banned-domains', requireAuth, adminOnly, async (req, res) => {
  try {
    const domains = await db.prepare(
      'SELECT domain, created_at FROM banned_email_domains ORDER BY domain'
    ).all();
    res.json({ success: true, data: domains });
  } catch (error) {
    // Table may not exist yet
    res.json({ success: true, data: [] });
  }
});

/**
 * POST /api/admin/banned-domains — add domain to blacklist
 */
router.post('/banned-domains', requireAuth, adminOnly, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain || !domain.includes('.')) {
      return res.status(400).json({ error: 'Invalid domain' });
    }
    const clean = domain.toLowerCase().trim();
    await db.prepare(
      'INSERT INTO banned_email_domains (domain, added_by) VALUES (?, ?) ON CONFLICT (domain) DO NOTHING'
    ).run(clean, req.user.userId);
    await logAdminAction(req.user.userId, 'ADD_BANNED_DOMAIN', { domain: clean });
    res.json({ success: true, domain: clean });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add domain' });
  }
});

/**
 * DELETE /api/admin/banned-domains/:domain — remove domain from blacklist
 */
router.delete('/banned-domains/:domain', requireAuth, adminOnly, async (req, res) => {
  try {
    await db.prepare('DELETE FROM banned_email_domains WHERE domain = ?').run(req.params.domain);
    await logAdminAction(req.user.userId, 'REMOVE_BANNED_DOMAIN', { domain: req.params.domain });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove domain' });
  }
});

// ============================================================================
// DATA PIPELINE — Proxy to URS Matcher Service (admin only)
// ============================================================================

const URS_PIPELINE_URL = process.env.URS_MATCHER_API_URL || 'https://urs-matcher-service-1086027517695.europe-west3.run.app';

/**
 * Generic pipeline proxy — forwards request to URS Matcher, returns response.
 */
async function pipelineProxy(req, res, method, ursPath) {
  const targetUrl = `${URS_PIPELINE_URL}${ursPath}`;
  logger.info(`[Pipeline] ${method} ${ursPath} → ${targetUrl}`);

  try {
    const fetchOpts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(300000), // 5 min (collection can be long)
    };
    if (method === 'POST' && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const resp = await fetch(targetUrl, fetchOpts);
    const data = await resp.text();
    res.set('Content-Type', resp.headers.get('content-type') || 'application/json');
    res.status(resp.status).send(data);
  } catch (err) {
    logger.error(`[Pipeline] Error: ${err.message}`);
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'URS Matcher timeout (5 min)' });
    }
    res.status(502).json({ error: `URS Matcher unavailable: ${err.message}` });
  }
}

// Smlouvy collection
router.post('/pipeline/smlouvy/collect', requireAuth, adminOnly, (req, res) => {
  pipelineProxy(req, res, 'POST', '/api/smlouvy/collect');
});
router.get('/pipeline/smlouvy/collect/status', requireAuth, adminOnly, (req, res) => {
  pipelineProxy(req, res, 'GET', '/api/smlouvy/collect/status');
});
router.get('/pipeline/smlouvy/stats', requireAuth, adminOnly, (req, res) => {
  pipelineProxy(req, res, 'GET', '/api/smlouvy/stats');
});

// VZ enrichment
router.post('/pipeline/vz/collect', requireAuth, adminOnly, (req, res) => {
  pipelineProxy(req, res, 'POST', '/api/smlouvy/vz/collect');
});
router.get('/pipeline/vz/status', requireAuth, adminOnly, (req, res) => {
  pipelineProxy(req, res, 'GET', '/api/smlouvy/vz/status');
});
router.get('/pipeline/vz/stats', requireAuth, adminOnly, (req, res) => {
  pipelineProxy(req, res, 'GET', '/api/smlouvy/vz/stats');
});

// Work Packages build
router.post('/pipeline/work-packages/build', requireAuth, adminOnly, (req, res) => {
  pipelineProxy(req, res, 'POST', '/api/v1/work-packages/build');
});

export default router;
