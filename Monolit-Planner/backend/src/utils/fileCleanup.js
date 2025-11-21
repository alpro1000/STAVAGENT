/**
 * File Cleanup Utilities
 * Manages cleanup of old export files and uploaded files
 */

import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

const EXPORTS_DIR = './exports';
const UPLOADS_DIR = './uploads';

/**
 * Clean up old export files (older than 30 days)
 * Should be called on server startup and periodically
 */
export function cleanOldExports() {
  try {
    if (!fs.existsSync(EXPORTS_DIR)) {
      return;
    }

    const files = fs.readdirSync(EXPORTS_DIR);
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    let cleanedCount = 0;

    files.forEach(file => {
      try {
        const filepath = path.join(EXPORTS_DIR, file);
        const stats = fs.statSync(filepath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAge) {
          fs.unlinkSync(filepath);
          cleanedCount++;
          logger.info(`Cleaned old export file: ${file} (age: ${Math.floor(fileAge / (24 * 60 * 60 * 1000))} days)`);
        }
      } catch (error) {
        logger.warn(`Error cleaning export file ${file}:`, error.message);
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} old export files`);
    }
  } catch (error) {
    logger.warn('Error during export cleanup:', error.message);
  }
}

/**
 * Clean up stale upload files (older than 24 hours)
 * Uploads should be processed and deleted immediately, but this is a safety measure
 */
export function cleanStaledUploads() {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return;
    }

    const files = fs.readdirSync(UPLOADS_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    let cleanedCount = 0;

    files.forEach(file => {
      try {
        const filepath = path.join(UPLOADS_DIR, file);
        const stats = fs.statSync(filepath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAge) {
          fs.unlinkSync(filepath);
          cleanedCount++;
          logger.info(`Cleaned stale upload file: ${file} (age: ${Math.floor(fileAge / (60 * 60 * 1000))} hours)`);
        }
      } catch (error) {
        logger.warn(`Error cleaning upload file ${file}:`, error.message);
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} stale upload files`);
    }
  } catch (error) {
    logger.warn('Error during upload cleanup:', error.message);
  }
}

/**
 * Schedule periodic cleanup
 * Call this once on server startup
 */
export function schedulePeriodicCleanup() {
  // Run cleanup immediately on startup
  logger.info('Running initial file cleanup...');
  cleanOldExports();
  cleanStaledUploads();

  // Schedule daily cleanup at 2 AM
  setInterval(() => {
    logger.info('Running scheduled file cleanup...');
    cleanOldExports();
    cleanStaledUploads();
  }, 24 * 60 * 60 * 1000); // Every 24 hours

  logger.info('File cleanup scheduled (daily at 2:00 AM)');
}
