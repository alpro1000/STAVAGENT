#!/usr/bin/env node

/**
 * Database Initialization Script
 * Run this to manually initialize or reinitialize the database
 * Usage: node scripts/init-database.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from '../src/db/init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[INIT] Starting database initialization...');
console.log('[INIT] Working directory:', process.cwd());

try {
  await initDatabase();
  console.log('[INIT] ✓ Database initialized successfully!');
  process.exit(0);
} catch (error) {
  console.error('[INIT] ✗ Database initialization failed:', error);
  process.exit(1);
}
