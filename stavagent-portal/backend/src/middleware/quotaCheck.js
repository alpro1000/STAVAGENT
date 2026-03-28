/**
 * Quota Check Middleware
 * Enforces credit-based billing + feature flags before processing.
 *
 * Flow:
 *  1. Check feature flag (is service enabled for user/plan?)
 *  2. Check credits (can user afford this operation?)
 *  3. On success response: deduct credits + record usage
 */

import db from '../db/index.js';
import { checkQuota, trackUsage } from '../services/usageTracker.js';
import { isFeatureEnabled } from '../services/featureFlags.js';
import { canAfford, deductCredits, isSessionOnly } from '../services/creditService.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware that checks user's quota AND credits before allowing an operation.
 *
 * @param {string} service - Service identifier (e.g. 'workflow_c', 'price_parser')
 * @param {string} [operationKey] - Credit operation key (e.g. 'document_analyze'). If omitted, uses service as key.
 */
export function requireQuota(service, operationKey = null) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // 1. Check feature flag
      const user = await db.prepare('SELECT plan, org_id, role FROM users WHERE id = ?').get(userId);

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

      // 2. Check credits (if operation key provided)
      const opKey = operationKey || service;
      const creditCheck = await canAfford(userId, opKey);

      if (!creditCheck.allowed) {
        return res.status(402).json({
          error: 'Insufficient credits',
          message: creditCheck.reason,
          balance: creditCheck.balance,
          cost: creditCheck.cost,
          shortfall: creditCheck.shortfall,
          operation: opKey,
        });
      }

      // 3. Check legacy quota (backward compat)
      const quotaResult = await checkQuota(userId);
      if (!quotaResult.allowed) {
        return res.status(429).json({
          error: 'Quota exceeded',
          message: quotaResult.reason,
          usage: quotaResult.usage,
        });
      }

      // Attach info for downstream handlers
      req.quota = quotaResult.usage;
      req.creditCheck = creditCheck;
      req.operationKey = opKey;
      next();
    } catch (error) {
      logger.error('[QUOTA] Error checking quota:', error);
      // Fail-open: allow the request on error
      next();
    }
  };
}

/**
 * Middleware that checks if user can save to DB (has credits).
 * If session-only, sets req.sessionOnly = true (handler decides what to do).
 */
export function checkSessionOnly() {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        req.sessionOnly = true;
        return next();
      }
      req.sessionOnly = await isSessionOnly(userId);
      next();
    } catch (error) {
      logger.error('[QUOTA] Error checking session-only:', error);
      req.sessionOnly = false;
      next();
    }
  };
}

/**
 * Middleware that records usage AND deducts credits AFTER a successful response.
 * Wrap around pipeline endpoints.
 *
 * @param {string} service - Service identifier
 * @param {string} [eventType] - Event type (default: 'pipeline_run')
 */
export function recordUsage(service, eventType = 'pipeline_run') {
  return (req, res, next) => {
    // Hook into response finish to record usage + deduct credits
    const originalEnd = res.end;
    res.end = function (...args) {
      // Only record/charge on success (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.userId;
        if (userId) {
          // Deduct credits (fire-and-forget)
          const opKey = req.operationKey || service;
          deductCredits(userId, opKey).catch(() => {});

          // Track usage event
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
              credits_deducted: req.creditCheck?.cost || 0,
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
