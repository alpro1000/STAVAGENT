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

// Middleware
import { errorHandler } from './api/middleware/errorHandler.js';
import { requestLogger } from './api/middleware/requestLogger.js';
import { performanceMonitoringMiddleware } from './api/middleware/performanceMonitoring.js';

// Services
import { startCacheCleanupScheduler, stopCacheCleanupScheduler } from './services/cacheCleanupScheduler.js';
import { initCache, closeCache } from './services/cacheService.js';

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
    logger.info('Initializing database...');
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Initialize cache (Redis or in-memory fallback)
    logger.info('[CACHE] Initializing cache service...');
    await initCache();
    logger.info('[CACHE] Cache service initialized successfully');

    // Start cache cleanup scheduler (Phase 4)
    logger.info('[SCHEDULER] Starting cache cleanup scheduler...');
    startCacheCleanupScheduler();
    logger.info('[SCHEDULER] Cache cleanup scheduler started');

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 URS Matcher Service listening on port ${PORT}`);
      logger.info(`📍 Frontend: http://localhost:${PORT}`);
      logger.info(`📍 API: http://localhost:${PORT}/api`);
      logger.info(`📍 Health: http://localhost:${PORT}/health`);
      logger.info(`📊 Metrics: http://localhost:${PORT}/api/jobs/admin/metrics`);
      logger.info(`🏗️ Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      stopCacheCleanupScheduler();
      await closeCache();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
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
