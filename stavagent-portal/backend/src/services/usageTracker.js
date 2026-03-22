/**
 * Usage Tracker Service
 * Records all pipeline/API usage events and enforces quotas
 */

import db from '../db/index.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Free tier limits
const FREE_TIER = {
  pipeline_runs: 3,           // 3 free pipeline runs total
  max_storage_bytes: 100 * 1024 * 1024, // 100 MB
  max_projects: 5,
};

/**
 * Record a usage event
 */
export async function trackUsage({
  userId,
  orgId = null,
  eventType,
  service,
  modelName = null,
  tokensInput = 0,
  tokensOutput = 0,
  costUsd = 0,
  fileSizeBytes = 0,
  metadata = {},
  ipAddress = null,
}) {
  try {
    const tokensTotal = tokensInput + tokensOutput;

    await db.prepare(`
      INSERT INTO usage_events (id, user_id, org_id, event_type, service, model_name,
        tokens_input, tokens_output, tokens_total, cost_usd, file_size_bytes,
        metadata, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), userId, orgId, eventType, service, modelName,
      tokensInput, tokensOutput, tokensTotal, costUsd, fileSizeBytes,
      JSON.stringify(metadata), ipAddress, new Date().toISOString()
    );

    // Update free pipeline runs counter if applicable
    if (eventType === 'pipeline_run') {
      await db.prepare(`
        UPDATE users SET free_pipeline_runs_used = COALESCE(free_pipeline_runs_used, 0) + 1
        WHERE id = ?
      `).run(userId);
    }

    logger.debug(`[USAGE] Tracked: ${eventType}/${service} for user ${userId}`);
  } catch (error) {
    logger.error('[USAGE] Error tracking usage:', error);
    // Don't throw — usage tracking shouldn't break the main operation
  }
}

/**
 * Check if user can perform a pipeline run (quota check)
 * Returns { allowed: boolean, reason?: string, usage: object }
 */
export async function checkQuota(userId) {
  try {
    const user = await db.prepare(
      'SELECT id, plan, free_pipeline_runs_used, role FROM users WHERE id = ?'
    ).get(userId);

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Admins bypass quotas
    if (user.role === 'admin') {
      return { allowed: true, usage: { plan: 'admin', unlimited: true } };
    }

    const plan = user.plan || 'free';
    const usedRuns = user.free_pipeline_runs_used || 0;

    // Check org-level plan
    const orgMember = await db.prepare(`
      SELECT o.plan, o.max_projects, o.max_storage_gb
      FROM org_members om
      JOIN organizations o ON om.org_id = o.id
      WHERE om.user_id = ? AND o.is_active = true
      LIMIT 1
    `).get(userId);

    const effectivePlan = orgMember?.plan || plan;

    // Free tier: limited pipeline runs
    if (effectivePlan === 'free') {
      if (usedRuns >= FREE_TIER.pipeline_runs) {
        return {
          allowed: false,
          reason: `Dosáhli jste limitu ${FREE_TIER.pipeline_runs} bezplatných spuštění. Upgradujte na placený plán.`,
          usage: {
            plan: 'free',
            pipeline_runs_used: usedRuns,
            pipeline_runs_limit: FREE_TIER.pipeline_runs,
          }
        };
      }
    }

    // Get total storage used
    const storage = await db.prepare(`
      SELECT COALESCE(SUM(file_size), 0) as total_bytes
      FROM portal_files WHERE uploaded_by = ?
    `).get(userId);

    const maxStorage = effectivePlan === 'free'
      ? FREE_TIER.max_storage_bytes
      : (orgMember?.max_storage_gb || 10) * 1024 * 1024 * 1024;

    return {
      allowed: true,
      usage: {
        plan: effectivePlan,
        pipeline_runs_used: usedRuns,
        pipeline_runs_limit: effectivePlan === 'free' ? FREE_TIER.pipeline_runs : null,
        storage_used_bytes: storage.total_bytes,
        storage_limit_bytes: maxStorage,
      }
    };
  } catch (error) {
    logger.error('[USAGE] Error checking quota:', error);
    // On error, allow the operation (fail-open)
    return { allowed: true, usage: { error: true } };
  }
}

/**
 * Get usage statistics for admin dashboard
 */
export async function getUsageStats({ days = 30, userId = null, groupBy = 'service' } = {}) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const params = [cutoffStr];
    let userFilter = '';
    if (userId) {
      userFilter = 'AND user_id = ?';
      params.push(userId);
    }

    // Total events & tokens
    const totals = await db.prepare(`
      SELECT
        COUNT(*) as total_events,
        COALESCE(SUM(tokens_total), 0) as total_tokens,
        COALESCE(SUM(tokens_input), 0) as total_input_tokens,
        COALESCE(SUM(tokens_output), 0) as total_output_tokens,
        COALESCE(SUM(cost_usd), 0) as total_cost_usd,
        COUNT(DISTINCT user_id) as unique_users
      FROM usage_events
      WHERE created_at > ? ${userFilter}
    `).get(...params);

    // By service
    const byService = await db.prepare(`
      SELECT
        service,
        COUNT(*) as count,
        COALESCE(SUM(tokens_total), 0) as tokens,
        COALESCE(SUM(cost_usd), 0) as cost_usd
      FROM usage_events
      WHERE created_at > ? ${userFilter}
      GROUP BY service
      ORDER BY count DESC
    `).all(...params);

    // By model
    const byModel = await db.prepare(`
      SELECT
        COALESCE(model_name, 'unknown') as model_name,
        COUNT(*) as count,
        COALESCE(SUM(tokens_input), 0) as tokens_input,
        COALESCE(SUM(tokens_output), 0) as tokens_output,
        COALESCE(SUM(tokens_total), 0) as tokens_total,
        COALESCE(SUM(cost_usd), 0) as cost_usd
      FROM usage_events
      WHERE created_at > ? ${userFilter} AND model_name IS NOT NULL
      GROUP BY model_name
      ORDER BY tokens_total DESC
    `).all(...params);

    // By event type
    const byEventType = await db.prepare(`
      SELECT
        event_type,
        COUNT(*) as count
      FROM usage_events
      WHERE created_at > ? ${userFilter}
      GROUP BY event_type
      ORDER BY count DESC
    `).all(...params);

    // Top users
    const topUsers = await db.prepare(`
      SELECT
        ue.user_id,
        u.email,
        u.name,
        COUNT(*) as total_events,
        COALESCE(SUM(ue.tokens_total), 0) as total_tokens,
        COALESCE(SUM(ue.cost_usd), 0) as total_cost_usd
      FROM usage_events ue
      JOIN users u ON ue.user_id = u.id
      WHERE ue.created_at > ?
      GROUP BY ue.user_id, u.email, u.name
      ORDER BY total_events DESC
      LIMIT 20
    `).all(cutoffStr);

    // Daily breakdown (last N days)
    const daily = await db.prepare(`
      SELECT
        DATE(created_at) as day,
        COUNT(*) as events,
        COALESCE(SUM(tokens_total), 0) as tokens,
        COUNT(DISTINCT user_id) as users
      FROM usage_events
      WHERE created_at > ? ${userFilter}
      GROUP BY DATE(created_at)
      ORDER BY day DESC
    `).all(...params);

    return {
      period_days: days,
      totals,
      by_service: byService,
      by_model: byModel,
      by_event_type: byEventType,
      top_users: topUsers,
      daily,
    };
  } catch (error) {
    logger.error('[USAGE] Error getting usage stats:', error);
    throw error;
  }
}

/**
 * Get usage for a specific user (for their cabinet page)
 */
export async function getUserUsage(userId) {
  try {
    const user = await db.prepare(
      'SELECT plan, free_pipeline_runs_used, role FROM users WHERE id = ?'
    ).get(userId);

    if (!user) return null;

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await db.prepare(`
      SELECT
        COUNT(*) as events,
        COALESCE(SUM(tokens_total), 0) as tokens,
        COALESCE(SUM(cost_usd), 0) as cost_usd
      FROM usage_events
      WHERE user_id = ? AND created_at > ?
    `).get(userId, thisMonth.toISOString());

    const storage = await db.prepare(`
      SELECT COALESCE(SUM(file_size), 0) as total_bytes
      FROM portal_files WHERE uploaded_by = ?
    `).get(userId);

    const recentEvents = await db.prepare(`
      SELECT event_type, service, model_name, tokens_total, created_at
      FROM usage_events
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId);

    return {
      plan: user.plan || 'free',
      is_admin: user.role === 'admin',
      pipeline_runs_used: user.free_pipeline_runs_used || 0,
      pipeline_runs_limit: (user.plan || 'free') === 'free' ? FREE_TIER.pipeline_runs : null,
      storage_used_bytes: storage.total_bytes,
      storage_limit_bytes: (user.plan || 'free') === 'free' ? FREE_TIER.max_storage_bytes : null,
      monthly: monthlyUsage,
      recent_events: recentEvents,
    };
  } catch (error) {
    logger.error('[USAGE] Error getting user usage:', error);
    throw error;
  }
}
