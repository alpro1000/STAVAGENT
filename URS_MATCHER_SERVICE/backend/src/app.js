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

// Middleware
import { errorHandler } from './api/middleware/errorHandler.js';
import { requestLogger } from './api/middleware/requestLogger.js';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS configuration
app.use(cors({
  origin: (process.env.CORS_ORIGIN || '*').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files (frontend)
// __dirname = backend/src, so we need to go up 2 levels to reach URS_MATCHER_SERVICE, then into frontend/public
app.use(express.static(path.join(__dirname, '../../frontend/public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging
app.use(requestLogger);

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.use('/health', healthRouter);
app.use('/api/health', healthRouter);

// API routes
app.use('/api/jobs', jobsRouter);
app.use('/api/urs-catalog', catalogRouter);

// Serve frontend (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
    if (err) {
      res.status(404).json({ error: 'Not Found' });
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

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 URS Matcher Service listening on port ${PORT}`);
      logger.info(`📍 Frontend: http://localhost:${PORT}`);
      logger.info(`📍 API: http://localhost:${PORT}/api`);
      logger.info(`📍 Health: http://localhost:${PORT}/health`);
      logger.info(`🏗️ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at:`, promise, `reason:`, reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception:`, error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;
