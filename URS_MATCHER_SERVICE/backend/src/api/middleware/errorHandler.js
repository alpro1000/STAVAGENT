import { logger } from '../../utils/logger.js';

/**
 * Safe Error Handler Middleware
 * Prevents information disclosure by sanitizing error responses
 * while logging full details for debugging
 */
export function errorHandler(err, req, res, next) {
  const requestId = req.id || `req_${Date.now()}`;

  // Log full error details for debugging (internal only)
  logger.error(`[ERROR] ${requestId}: ${err.message}`, {
    stack: err.stack,
    status: err.status || 500
  });

  // Determine HTTP status code
  const statusCode = err.status || err.statusCode || 500;

  // Return safe error message to client (no stack traces or implementation details)
  const safeMessage = getSafeMessage(statusCode, err.message);

  res.status(statusCode).json({
    error: safeMessage,
    status: 'error',
    request_id: requestId
  });
}

/**
 * Map HTTP status codes to safe, user-friendly error messages
 * Prevents leaking system internals through error messages
 */
function getSafeMessage(statusCode, originalMessage) {
  const messages = {
    400: 'Invalid request parameters',
    401: 'Authentication required',
    403: 'Access forbidden',
    404: 'Resource not found',
    409: 'Resource conflict',
    422: 'Invalid request parameters',
    429: 'Too many requests. Please try again later.',
    500: 'An error occurred while processing your request',
    502: 'Service temporarily unavailable',
    503: 'Service temporarily unavailable',
    504: 'Request timeout'
  };

  return messages[statusCode] || 'An error occurred';
}
