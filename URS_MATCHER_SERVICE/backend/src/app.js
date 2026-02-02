/**
 * URS Matcher Service - Main Application
 * Express.js backend for ÚRS position matching kiosk
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/init.js';
import { logger } from './utils/logger.js';

// Routes
import jobsRouter from './api/routes/jobs.js';
import catalogRouter from './api/routes/catalog.js';
import healthRouter from './api/routes/health.js';
import tridnikRouter from './api/routes/tridnik.js';
import batchRouter from './api/routes/batch.js';

// Middleware
import { errorHandler } from './api/middleware/errorHandler.js';
import { requestLogger } from './api/middleware/requestLogger.js';
import { performanceMonitoringMiddleware } from './api/middleware/performanceMonitoring.js';

// Services
import { startCacheCleanupScheduler, stopCacheCleanupScheduler } from './services/cacheCleanupScheduler.js';
import { initCache, closeCache } from './services/cacheService.js';
import { initializeScheduledJobs } from './services/scheduledImportService.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Log startup info
logger.info('[APP] Initializing URS Matcher Service');
logger.info(`[APP] Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`[APP] __dirname: ${__dirname}`);
logger.info(`[APP] Static files path: ${path.join(__dirname, '../../frontend/public')}`);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS configuration
const corsOrigins = (process.env.CORS_ORIGIN || '*').split(',');
logger.info(`[APP] CORS origins: ${corsOrigins.join(', ')}`);

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files (frontend)
// __dirname = backend/src, so we need to go up 2 levels to reach URS_MATCHER_SERVICE, then into frontend/public
const staticPath = path.join(__dirname, '../../frontend/public');
logger.info(`[APP] Serving static files from: ${staticPath}`);
app.use(express.static(staticPath));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Log all incoming requests
app.use((req, res, next) => {
  logger.info(`[HTTP] ${req.method} ${req.path} - ${req.ip}`);
  if (Object.keys(req.body).length > 0) {
    logger.debug(`[HTTP] Request body keys: ${Object.keys(req.body).join(', ')}`);
  }
  next();
});

// Request logging
app.use(requestLogger);

// Performance monitoring (Phase 4)
app.use(performanceMonitoringMiddleware);

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.use('/health', healthRouter);
app.use('/api/health', healthRouter);

// API routes
app.use('/api/jobs', jobsRouter);
app.use('/api/urs-catalog', catalogRouter);
app.use('/api/tridnik', tridnikRouter);
app.use('/api/batch', batchRouter);

// Serve frontend (SPA fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../../frontend/public/index.html');
  logger.info(`[SPA] Fallback route triggered for: ${req.path}`);
  logger.debug(`[SPA] Sending index.html from: ${indexPath}`);

  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error(`[SPA] Error sending index.html: ${err.message}`);
      res.status(404).json({ error: 'Not Found', details: err.message });
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use(errorHandler);

// ============================================================================
// INITIALIZATION & STARTUP
// ============================================================================

async function startServer() {
  try {
    // Initialize database
    logger.info('[DB] 🔄 Initializing database...');
    await initializeDatabase();
    logger.info('[DB] ✅ Database initialized and ready');
    logger.info('[DB] Status: Database connection established and all tables created');

    // Initialize cache (Redis or in-memory fallback)
    logger.info('[CACHE] 🔄 Initializing cache service...');
    await initCache();
    logger.info('[CACHE] ✅ Cache service initialized successfully');

    // Start cache cleanup scheduler (Phase 4)
    logger.info('[SCHEDULER] 🔄 Starting cache cleanup scheduler...');
    startCacheCleanupScheduler();
    logger.info('[SCHEDULER] ✅ Cache cleanup scheduler started');

    // Initialize scheduled catalog import jobs (auto-approval, cleanup, health checks)
    logger.info('[SCHEDULED-JOBS] 🔄 Initializing scheduled catalog import jobs...');
    let scheduledJobs;
    try {
      scheduledJobs = initializeScheduledJobs();
      logger.info('[SCHEDULED-JOBS] ✅ All scheduled jobs initialized and running');
    } catch (jobsError) {
      logger.error(`[SCHEDULED-JOBS] ⚠️  Failed to initialize scheduled jobs: ${jobsError.message}`);
      logger.warn('[SCHEDULED-JOBS] Service will continue without scheduled jobs. Manual approvals required.');
      scheduledJobs = null;
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`\n${'='.repeat(70)}`);
      logger.info(`🚀 URS Matcher Service is RUNNING`);
      logger.info(`${'='.repeat(70)}`);
      logger.info(`📍 Frontend:       http://localhost:${PORT}`);
      logger.info(`📍 API:            http://localhost:${PORT}/api`);
      logger.info(`📍 Health:         http://localhost:${PORT}/health`);
      logger.info(`📊 Metrics:        http://localhost:${PORT}/api/jobs/admin/metrics`);
      logger.info(`📦 Catalog Import: http://localhost:${PORT}/api/catalog/status`);
      logger.info(`🏗️  Environment:    ${process.env.NODE_ENV || 'development'}`);
      logger.info(`${'='.repeat(70)}\n`);
    });

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      logger.info('\n[SHUTDOWN] SIGTERM received, shutting down gracefully...');

      // Stop scheduled jobs
      if (scheduledJobs) {
        logger.info('[SHUTDOWN] Stopping scheduled import jobs...');
        scheduledJobs.stop();
        logger.info('[SHUTDOWN] ✅ Scheduled jobs stopped');
      }

      // Stop cache cleanup scheduler
      logger.info('[SHUTDOWN] Stopping cache cleanup scheduler...');
      stopCacheCleanupScheduler();
      logger.info('[SHUTDOWN] ✅ Cache cleanup scheduler stopped');

      // Close cache
      logger.info('[SHUTDOWN] Closing cache connections...');
      await closeCache();
      logger.info('[SHUTDOWN] ✅ Cache closed');

      // Close server
      logger.info('[SHUTDOWN] Closing HTTP server...');
      server.close(() => {
        logger.info('[SHUTDOWN] ✅ Server closed');
        logger.info('Goodbye! 👋\n');
        process.exit(0);
      });

      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        logger.error('[SHUTDOWN] ❌ Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, 10000);
    });

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    stopCacheCleanupScheduler();
    await closeCache();
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();

export default app;
