/**
 * Logging Helper Utilities
 * Provides functions to redact PII and sensitive data from logs
 * Prevents accidental exposure of user data in logs
 */

/**
 * Redact user input text while preserving length information
 * Useful for logging searches/queries without exposing actual content
 *
 * @param {string} text - The text to redact
 * @param {number} maxChars - Show length up to this many characters
 * @returns {string} Redacted version like "[123 chars]"
 */
export function redactText(text, maxChars = 50) {
  if (!text) {
    return '[empty]';
  }

  if (typeof text !== 'string') {
    return `[non-string: ${typeof text}]`;
  }

  const length = text.length;

  // If text is short enough, could optionally show it (but we don't for safety)
  // For now, always redact and just show length
  if (length <= maxChars) {
    return `[${length} chars]`;
  }

  return `[${length} chars]`;
}

/**
 * Redact user feedback/comments
 * Shows that data was received but not the actual content
 *
 * @param {string} comment - User comment/feedback
 * @returns {string} Redacted version
 */
export function redactUserComment(comment) {
  if (!comment) {
    return '[no comment]';
  }

  if (typeof comment !== 'string') {
    return '[invalid comment type]';
  }

  return `[${comment.length} char comment]`;
}

/**
 * Redact array of items (e.g., candidate items)
 * Shows count but not contents
 *
 * @param {array} items - Array to redact
 * @returns {string} Redacted version like "[5 items]"
 */
export function redactArray(items) {
  if (!Array.isArray(items)) {
    return '[not an array]';
  }

  return `[${items.length} items]`;
}

/**
 * Redact project-specific context that might contain sensitive information
 * Shows keys but not values
 *
 * @param {object} context - Project context object
 * @returns {string} Redacted version
 */
export function redactContext(context) {
  if (!context || typeof context !== 'object') {
    return '[invalid context]';
  }

  const keys = Object.keys(context).length;
  return `[context with ${keys} fields]`;
}

/**
 * Create a safe log entry for universal match requests
 * Redacts sensitive parts while preserving useful debugging info
 *
 * @param {object} params - Request parameters
 * @returns {object} Safe log object
 */
export function createSafeUniversalMatchLog(params) {
  return {
    text: redactText(params.text),
    quantity: params.quantity || null,
    unit: params.unit || null,
    projectType: params.projectType ? '[redacted]' : null,
    buildingSystem: params.buildingSystem ? '[redacted]' : null,
    candidateItems: redactArray(params.candidateItems)
  };
}

/**
 * Create a safe log entry for feedback requests
 * Redacts user input while preserving validation info
 *
 * @param {object} feedback - Feedback parameters
 * @returns {object} Safe log object
 */
export function createSafeFeedbackLog(feedback) {
  return {
    urs_code: feedback.urs_code,
    is_correct: feedback.is_correct,
    normalized_text_cs: redactText(feedback.normalized_text_cs),
    user_comment: redactUserComment(feedback.user_comment),
    detected_language: feedback.detected_language
  };
}

/**
 * Log with optional redaction
 * Only logs sensitive data if log level is DEBUG
 *
 * @param {object} logger - Logger instance
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Log message
 * @param {string} sensitiveData - Data to conditionally log
 * @param {string} redactedVersion - Redacted version
 */
export function logWithRedaction(logger, level, message, sensitiveData, redactedVersion) {
  const env = process.env.NODE_ENV || 'production';
  const logLevel = process.env.LOG_LEVEL || 'info';

  // Always log to production logging systems (with redacted data)
  logger[level](`${message} ${redactedVersion}`);

  // Only log full data in development or at DEBUG level
  if (env === 'development' || logLevel === 'debug') {
    logger.debug(`[FULL] ${message} ${sensitiveData}`);
  }
}

/**
 * Create structured audit log entry with context
 * SECURITY: Tracks user actions for compliance and audit trails
 *
 * @param {object} options - Audit log options
 * @returns {object} Structured audit log entry
 */
export function createAuditLog(options) {
  const {
    userId = 'anonymous',
    jobId = null,
    action = 'unknown',
    resource = null,
    status = 'success',
    details = null,
    ipAddress = null,
    timestamp = new Date().toISOString(),
    severity = 'info' // info, warning, critical
  } = options;

  return {
    timestamp,
    audit: {
      user_id: userId,
      job_id: jobId,
      action,
      resource,
      status,
      severity
    },
    context: {
      ip_address: ipAddress,
      environment: process.env.NODE_ENV || 'development'
    },
    details
  };
}

/**
 * Create structured log with user context
 * Includes userId and jobId for request tracking
 *
 * @param {object} options - Log options
 * @returns {string} Formatted log message with context
 */
export function createContextualLogMessage(options) {
  const {
    userId = 'default',
    jobId = null,
    action = '',
    message = '',
    metadata = {}
  } = options;

  const context = jobId ? `[${userId}:${jobId}]` : `[${userId}]`;
  const metaStr = Object.keys(metadata).length > 0
    ? ` | ${JSON.stringify(metadata)}`
    : '';

  return `${context} ${action}: ${message}${metaStr}`;
}

/**
 * Track file operation with context
 * Logs file uploads/downloads with user and job context
 *
 * @param {object} options - File operation options
 * @returns {object} Structured file operation log
 */
export function createFileOperationLog(options) {
  const {
    userId = 'default',
    jobId = null,
    operation = 'upload', // upload, download, delete, validate
    filename = null,
    fileSize = null,
    fileType = null,
    status = 'success',
    reason = null
  } = options;

  return {
    timestamp: new Date().toISOString(),
    file_operation: {
      user_id: userId,
      job_id: jobId,
      operation,
      filename,
      file_size: fileSize,
      file_type: fileType,
      status,
      failure_reason: reason
    }
  };
}

/**
 * Track cache operation with context
 * Logs cache hits/misses/invalidations for performance monitoring
 *
 * @param {object} options - Cache operation options
 * @returns {object} Structured cache operation log
 */
export function createCacheOperationLog(options) {
  const {
    userId = 'default',
    jobId = null,
    operation = 'get', // get, set, del, clear
    cacheType = 'document_parsing', // document_parsing, block_analysis, qa_flow, llm_response
    result = 'miss', // hit, miss, success, failure
    keyHash = null,
    ttl = null,
    duration_ms = null,
    reason = null
  } = options;

  return {
    timestamp: new Date().toISOString(),
    cache_operation: {
      user_id: userId,
      job_id: jobId,
      operation,
      cache_type: cacheType,
      result,
      key_hash: keyHash,
      ttl,
      duration_ms,
      failure_reason: reason
    }
  };
}

/**
 * Track API request with full context
 * SECURITY: Records all API requests for audit trail
 *
 * @param {object} options - Request options
 * @returns {object} Structured request log
 */
export function createRequestLog(options) {
  const {
    userId = 'anonymous',
    method = 'GET',
    endpoint = '',
    statusCode = 200,
    duration_ms = 0,
    userAgent = null,
    ipAddress = null,
    error = null
  } = options;

  return {
    timestamp: new Date().toISOString(),
    request: {
      user_id: userId,
      method,
      endpoint,
      status_code: statusCode,
      duration_ms,
      ip_address: ipAddress,
      user_agent: userAgent
    },
    error: error || null
  };
}

/**
 * Track security event
 * SECURITY: Critical events that may indicate attacks or misuse
 *
 * @param {object} options - Security event options
 * @returns {object} Structured security event log
 */
export function createSecurityEventLog(options) {
  const {
    userId = 'unknown',
    eventType = 'unknown', // invalid_file, invalid_request, unauthorized_access, rate_limit
    severity = 'warning', // info, warning, critical
    description = '',
    ipAddress = null,
    details = null
  } = options;

  return {
    timestamp: new Date().toISOString(),
    security_event: {
      user_id: userId,
      event_type: eventType,
      severity,
      description,
      ip_address: ipAddress
    },
    details
  };
}

/**
 * Sanitize data for logging to prevent log injection
 * SECURITY: Removes newlines and control characters from user-controlled strings
 *
 * @param {string} data - Data to sanitize
 * @returns {string} Sanitized data safe for logging
 */
export function sanitizeForLogging(data) {
  if (typeof data !== 'string') {
    return String(data);
  }
  // Remove newlines, carriage returns, and other control characters
  return data
    .replace(/[\r\n\t\x00-\x1F\x7F]/g, '') // Control characters
    .replace(/"/g, '\\"') // Escape quotes
    .substring(0, 256); // Limit length to prevent log spam
}

/**
 * Log audit event - convenience function combining create + log
 * SECURITY: Centralizes audit logging with data sanitization
 *
 * @param {object} options - Audit log options (same as createAuditLog)
 * @param {object} logger - Logger instance
 * @param {string} level - Log level (default: 'info')
 */
export function logAuditEvent(options, logger, level = 'info') {
  // Sanitize potentially user-controlled fields
  const sanitizedOptions = {
    ...options,
    userId: sanitizeForLogging(options.userId),
    jobId: sanitizeForLogging(options.jobId),
    details: options.details ? sanitizeDetailsObject(options.details) : null
  };

  const auditLog = createAuditLog(sanitizedOptions);
  logger[level](JSON.stringify(auditLog));
  return auditLog;
}

/**
 * Recursively sanitize object details for logging
 *
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
function sanitizeDetailsObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeForLogging(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetailsObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
