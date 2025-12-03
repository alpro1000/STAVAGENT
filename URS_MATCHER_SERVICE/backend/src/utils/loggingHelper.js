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
