/**
 * Logger Utility
 * Simple console-based logging
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const logLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase() || 'INFO'];

function getTimestamp() {
  return new Date().toISOString();
}

export const logger = {
  debug: (message) => {
    if (logLevel <= LOG_LEVELS.DEBUG) {
      console.log(`[${getTimestamp()}] [DEBUG] ${message}`);
    }
  },

  info: (message) => {
    if (logLevel <= LOG_LEVELS.INFO) {
      console.log(`[${getTimestamp()}] [INFO] ${message}`);
    }
  },

  warn: (message) => {
    if (logLevel <= LOG_LEVELS.WARN) {
      console.warn(`[${getTimestamp()}] [WARN] ${message}`);
    }
  },

  error: (message) => {
    if (logLevel <= LOG_LEVELS.ERROR) {
      console.error(`[${getTimestamp()}] [ERROR] ${message}`);
    }
  }
};
