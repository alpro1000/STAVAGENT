/**
 * Quota Check Middleware
 * Enforces free-tier pipeline limits before processing
 */

import { checkQuota, trackUsage } from '../services/usageTracker.js';
import { isFeatureEnabled } from '../services/featureFlags.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware that checks user's quota before allowing a pipeline run.
 * Use on routes that consume pipeline runs (workflow_a, workflow_c, price_parser, etc.)
 *
 * @param {string} service - Service identifier (e.g. 'workflow_c', 'price_parser')
 */
export function requireQuota(service) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check feature flag
      const user = await import('../db/index.js').then(m => m.default)
        .then(db => db.prepare('SELECT plan, org_id FROM users WHERE id = ?').get(userId));

      const flagEnabled = await isFeatureEnabled(service, {
        userId,
        orgId: user?.org_id || null,
        plan: user?.plan || 'free',
      });

      if (!flagEnabled) {
        return res.status(403).json({
          error: 'Feature disabled',
          message: `Služba '${service}' je deaktivována pro váš účet.`,
          feature: service,
        });
      }

      // Check quota
      const quotaResult = await checkQuota(userId);

      if (!quotaResult.allowed) {
        return res.status(429).json({
          error: 'Quota exceeded',
          message: quotaResult.reason,
          usage: quotaResult.usage,
        });
      }

      // Attach quota info for downstream handlers to use
      req.quota = quotaResult.usage;
      next();
    } catch (error) {
      logger.error('[QUOTA] Error checking quota:', error);
      // Fail-open: allow the request on error
      next();
    }
  };
}

/**
 * Middleware that records a usage event AFTER a successful response.
 * Wrap around pipeline endpoints.
 *
 * @param {string} service - Service identifier
 * @param {string} eventType - Event type (default: 'pipeline_run')
 */
export function recordUsage(service, eventType = 'pipeline_run') {
  return (req, res, next) => {
    // Hook into response finish to record usage
    const originalEnd = res.end;
    res.end = function (...args) {
      // Only record on success (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.userId;
        if (userId) {
          trackUsage({
            userId,
            eventType,
            service,
            modelName: req.usageModelName || null,
            tokensInput: req.usageTokensInput || 0,
            tokensOutput: req.usageTokensOutput || 0,
            costUsd: req.usageCostUsd || 0,
            fileSizeBytes: req.file?.size || 0,
            metadata: {
              path: req.originalUrl,
              method: req.method,
              ...(req.usageMetadata || {}),
            },
            ipAddress: req.ip,
          }).catch(() => {}); // fire-and-forget
        }
      }
      originalEnd.apply(this, args);
    };
    next();
  };
}
