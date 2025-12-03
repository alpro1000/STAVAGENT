/**
 * Performance Optimizer Service
 * Фаза 4: Monitor and optimize system performance
 *
 * Features:
 * - Track request execution times
 * - Identify bottlenecks
 * - Optimize slow queries
 * - Monitor memory usage
 * - Generate performance reports
 */

import { logger } from '../utils/logger.js';

/**
 * Performance metrics storage
 */
const metrics = {
  requests: [],
  roleExecutions: [],
  cacheOperations: [],
  databaseOperations: []
};

/**
 * Performance thresholds (in milliseconds)
 */
const THRESHOLDS = {
  SLOW_REQUEST: 5000,      // > 5 seconds
  SLOW_ROLE_EXECUTION: 3000, // > 3 seconds per role
  SLOW_DB_QUERY: 1000      // > 1 second
};

/**
 * Start tracking a request
 * @param {string} requestId - Unique request identifier
 * @param {string} endpoint - API endpoint
 * @returns {Object} Timer object
 */
export function startRequestTimer(requestId, endpoint) {
  const timer = {
    requestId,
    endpoint,
    startTime: Date.now(),
    markers: {}
  };

  return timer;
}

/**
 * Add a timing marker within a request
 * @param {Object} timer - Timer object from startRequestTimer
 * @param {string} markerName - Name of the marker
 */
export function addTimerMarker(timer, markerName) {
  if (timer && timer.markers) {
    timer.markers[markerName] = Date.now();
  }
}

/**
 * End request tracking and record metrics
 * @param {Object} timer - Timer object
 * @param {Object} options - Additional options
 */
export function endRequestTimer(timer, options = {}) {
  if (!timer) return null;

  const endTime = Date.now();
  const duration = endTime - timer.startTime;

  const metric = {
    requestId: timer.requestId,
    endpoint: timer.endpoint,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    slow: duration > THRESHOLDS.SLOW_REQUEST,
    markers: timer.markers,
    ...options
  };

  metrics.requests.push(metric);
  recordMetricIfNeeded(metric);

  // Keep only last 1000 metrics
  if (metrics.requests.length > 1000) {
    metrics.requests.shift();
  }

  if (metric.slow) {
    logger.warn(`[PERF] Slow request detected: ${timer.endpoint} took ${duration}ms`);
  }

  return metric;
}

/**
 * Track role execution performance
 * @param {string} role - Role name
 * @param {number} duration - Execution time in ms
 * @param {Object} context - Additional context
 */
export function recordRoleExecution(role, duration, context = {}) {
  const metric = {
    role,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    slow: duration > THRESHOLDS.SLOW_ROLE_EXECUTION,
    ...context
  };

  metrics.roleExecutions.push(metric);

  // Keep only last 500 metrics
  if (metrics.roleExecutions.length > 500) {
    metrics.roleExecutions.shift();
  }

  if (metric.slow) {
    logger.warn(`[PERF] Slow role execution: ${role} took ${duration}ms`);
  }

  return metric;
}

/**
 * Track cache operation performance
 * @param {string} operation - 'get', 'set', 'delete'
 * @param {number} duration - Operation time in ms
 * @param {Object} context - Additional context
 */
export function recordCacheOperation(operation, duration, context = {}) {
  const metric = {
    operation,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    ...context
  };

  metrics.cacheOperations.push(metric);

  // Keep only last 1000 metrics
  if (metrics.cacheOperations.length > 1000) {
    metrics.cacheOperations.shift();
  }

  return metric;
}

/**
 * Track database operation performance
 * @param {string} operation - Operation name
 * @param {number} duration - Operation time in ms
 * @param {Object} context - Additional context
 */
export function recordDatabaseOperation(operation, duration, context = {}) {
  const metric = {
    operation,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    slow: duration > THRESHOLDS.SLOW_DB_QUERY,
    ...context
  };

  metrics.databaseOperations.push(metric);

  // Keep only last 500 metrics
  if (metrics.databaseOperations.length > 500) {
    metrics.databaseOperations.shift();
  }

  if (metric.slow) {
    logger.warn(`[PERF] Slow DB operation: ${operation} took ${duration}ms`);
  }

  return metric;
}

/**
 * Record metric only if it's slow
 * @private
 */
function recordMetricIfNeeded(metric) {
  if (metric.slow) {
    logger.warn(
      `[PERF-SLOW] Endpoint: ${metric.endpoint}, Duration: ${metric.duration_ms}ms`
    );
  }
}

/**
 * Get performance summary
 * @param {Object} options - Filter options
 * @returns {Object} Performance summary
 */
export function getPerformanceSummary(options = {}) {
  const summary = {
    requests: calculateStats(metrics.requests, options),
    role_executions: calculateStats(metrics.roleExecutions, options),
    cache_operations: calculateStats(metrics.cacheOperations, options),
    database_operations: calculateStats(metrics.databaseOperations, options),
    slow_requests: metrics.requests.filter(m => m.slow).length,
    slow_role_executions: metrics.roleExecutions.filter(m => m.slow).length,
    slow_db_operations: metrics.databaseOperations.filter(m => m.slow).length,
    generated_at: new Date().toISOString()
  };

  return summary;
}

/**
 * Get detailed performance report
 * @returns {Object} Detailed report with recommendations
 */
export function getDetailedPerformanceReport() {
  const summary = getPerformanceSummary();

  // Analyze bottlenecks
  const bottlenecks = [];

  // Find slowest endpoints
  const slowestEndpoints = metrics.requests
    .filter(m => m.slow)
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 5);

  if (slowestEndpoints.length > 0) {
    bottlenecks.push({
      type: 'Slow Endpoints',
      items: slowestEndpoints.map(m => ({
        endpoint: m.endpoint,
        duration_ms: m.duration_ms
      }))
    });
  }

  // Find slowest roles
  const slowestRoles = metrics.roleExecutions
    .filter(m => m.slow)
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 5);

  if (slowestRoles.length > 0) {
    bottlenecks.push({
      type: 'Slow Role Executions',
      items: slowestRoles.map(m => ({
        role: m.role,
        duration_ms: m.duration_ms
      }))
    });
  }

  // Find slowest DB operations
  const slowestDB = metrics.databaseOperations
    .filter(m => m.slow)
    .sort((a, b) => b.duration_ms - a.duration_ms)
    .slice(0, 5);

  if (slowestDB.length > 0) {
    bottlenecks.push({
      type: 'Slow Database Operations',
      items: slowestDB.map(m => ({
        operation: m.operation,
        duration_ms: m.duration_ms
      }))
    });
  }

  // Generate recommendations
  const recommendations = [];

  if (summary.slow_role_executions > summary.role_executions.total * 0.2) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Slow role executions detected',
      recommendation: 'Consider parallelizing role execution where possible'
    });
  }

  if (summary.slow_db_operations > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Slow database operations',
      recommendation: 'Add database indexes or optimize queries'
    });
  }

  if (metrics.cacheOperations.length > 0) {
    const cacheStats = calculateStats(metrics.cacheOperations);
    const hitRate = (cacheStats.total > 0)
      ? ((metrics.cacheOperations.filter(m => m.hit).length / cacheStats.total) * 100).toFixed(2)
      : 0;

    if (hitRate < 30) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: `Low cache hit rate: ${hitRate}%`,
        recommendation: 'Cache is not being effectively utilized; consider caching more results'
      });
    }
  }

  return {
    summary,
    bottlenecks,
    recommendations,
    timestamp: new Date().toISOString()
  };
}

/**
 * Calculate statistics for a metric array
 * @private
 */
function calculateStats(metricArray, options = {}) {
  if (metricArray.length === 0) {
    return {
      total: 0,
      average_ms: 0,
      min_ms: 0,
      max_ms: 0,
      p95_ms: 0
    };
  }

  const durations = metricArray
    .map(m => m.duration_ms)
    .sort((a, b) => a - b);

  const total = durations.length;
  const sum = durations.reduce((a, b) => a + b, 0);
  const average = sum / total;
  const min = durations[0];
  const max = durations[total - 1];
  const p95Index = Math.floor(total * 0.95);
  const p95 = durations[p95Index] || max;

  return {
    total,
    average_ms: Math.round(average),
    min_ms: min,
    max_ms: max,
    p95_ms: p95
  };
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics() {
  metrics.requests = [];
  metrics.roleExecutions = [];
  metrics.cacheOperations = [];
  metrics.databaseOperations = [];
  logger.info('[PERF] All metrics reset');
}

/**
 * Get performance metrics for specific endpoint
 * @param {string} endpoint - Endpoint name
 * @returns {Object} Endpoint metrics
 */
export function getEndpointMetrics(endpoint) {
  const endpointMetrics = metrics.requests.filter(m => m.endpoint === endpoint);

  if (endpointMetrics.length === 0) {
    return { endpoint, requests: 0 };
  }

  const stats = calculateStats(endpointMetrics);

  return {
    endpoint,
    ...stats,
    slow_requests: endpointMetrics.filter(m => m.slow).length
  };
}

/**
 * Get metrics for a specific role
 * @param {string} role - Role name
 * @returns {Object} Role metrics
 */
export function getRoleMetrics(role) {
  const roleMetrics = metrics.roleExecutions.filter(m => m.role === role);

  if (roleMetrics.length === 0) {
    return { role, executions: 0 };
  }

  const stats = calculateStats(roleMetrics);

  return {
    role,
    ...stats,
    slow_executions: roleMetrics.filter(m => m.slow).length
  };
}
