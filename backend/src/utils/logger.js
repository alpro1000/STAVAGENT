/**
 * Simple logger utility
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOG_DIR = join(__dirname, '../../logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);

function writeLog(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');

  const logEntry = `[${timestamp}] [${level}] ${message}\n`;

  // Write to file
  fs.appendFileSync(LOG_FILE, logEntry);

  // Also log to console
  const consoleFn = {
    INFO: console.log,
    WARN: console.warn,
    ERROR: console.error,
    DEBUG: console.debug
  }[level] || console.log;

  consoleFn(`[${level}]`, ...args);
}

export const logger = {
  info: (...args) => writeLog('INFO', ...args),
  warn: (...args) => writeLog('WARN', ...args),
  error: (...args) => writeLog('ERROR', ...args),
  debug: (...args) => writeLog('DEBUG', ...args)
};
