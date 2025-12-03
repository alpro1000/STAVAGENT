/**
 * Performance Monitoring Middleware
 * Фаза 4: Track all incoming requests and measure response times
 *
 * Attaches timing information to all requests and logs performance metrics
 */

import { logger } from '../utils/logger.js';
import {
  startRequestTimer,
  endRequestTimer,
  addTimerMarker
} from '../services/performanceOptimizer.js';

/**
 * Performance monitoring middleware
 * Wraps all requests with timing and performance tracking
 *
 * Usage: app.use(performanceMonitoringMiddleware);
 */
export function performanceMonitoringMiddleware(req, res, next) {
  // Generate unique request ID
  const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Start timer
  const timer = startRequestTimer(requestId, req.path);

  // Attach timer to request for later use
  req.perfTimer = timer;

  // Add marker for request start
  addTimerMarker(timer, 'request_received');

  // Intercept response.end to capture completion time
  const originalSend = res.send;
  res.send = function (data) {
    // Add marker for response sent
    addTimerMarker(timer, 'response_sent');

    // End timer and record metrics
    const perfMetric = endRequestTimer(timer, {
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      user_id: req.user?.id || 'anonymous'
    });

    // Log performance metric
    if (perfMetric.slow) {
      logger.warn(
        `[PERF] Slow request detected: ${req.method} ${req.path} ` +
        `(${perfMetric.duration_ms}ms, status: ${res.statusCode})`
      );
    } else {
      logger.debug(
        `[PERF] Request completed: ${req.method} ${req.path} ` +
        `(${perfMetric.duration_ms}ms, status: ${res.statusCode})`
      );
    }

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * API endpoint for clearing performance metrics (admin only)
 * POST /api/system/metrics/reset
 */
export function metricsResetHandler(req, res) {
  try {
    // In production, verify admin status
    // const isAdmin = req.user?.role === 'admin';
    // if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // Reset metrics
    const { resetMetrics } = require('../services/performanceOptimizer.js');
    resetMetrics();

    logger.info('[PERF] Performance metrics reset by admin');

    res.status(200).json({
      success: true,
      message: 'Performance metrics have been reset',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[PERF] Metrics reset error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to reset metrics',
      details: error.message
    });
  }
}

export default performanceMonitoringMiddleware;
