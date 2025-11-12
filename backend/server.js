/**
 * Monolit Planner - Backend Server
 * Express + SQLite API
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Routes
import uploadRoutes from './src/routes/upload.js';
import positionsRoutes from './src/routes/positions.js';
import bridgesRoutes from './src/routes/bridges.js';
import exportRoutes from './src/routes/export.js';
import mappingRoutes from './src/routes/mapping.js';
import configRoutes from './src/routes/config.js';
import snapshotsRoutes from './src/routes/snapshots.js';
import otskpRoutes from './src/routes/otskp.js';

// Utils
import { initDatabase } from './src/db/init.js';
import { errorHandler } from './src/utils/errorHandler.js';
import { logger } from './src/utils/logger.js';
import { schedulePeriodicCleanup } from './src/utils/fileCleanup.js';

// Middleware
import { requireAuth } from './src/middleware/auth.js';
import { apiLimiter, authLimiter, uploadLimiter, otskpLimiter } from './src/middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;

// CORS configuration - support multiple origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://monolit-planner-frontend.onrender.com',
  process.env.CORS_ORIGIN // Allow custom origin from env
].filter(Boolean); // Remove undefined/null values

// Initialize Express
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if wildcard is set (for development or multiple frontends)
    if (ALLOWED_ORIGINS.includes('*')) {
      return callback(null, true);
    }

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Logging
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// Rate limiting - apply to all routes by default
app.use(apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create necessary directories
const dirs = ['./data', './uploads', './exports', './logs'];
dirs.forEach(dir => {
  const fullPath = join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Initialize database
try {
  initDatabase();
  logger.info('Database initialized successfully');
} catch (error) {
  logger.error('Database initialization failed:', error);
  process.exit(1);
}

// Schedule periodic file cleanup
schedulePeriodicCleanup();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// API Routes
// Note: Authentication can be applied per-route within route handlers for gradual rollout
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/bridges', bridgesRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/config', configRoutes);
app.use('/api/snapshots', snapshotsRoutes);
app.use('/api/otskp', otskpLimiter, otskpRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Monolit Planner Backend running on port ${PORT}`);
  logger.info(`📊 CORS enabled for: ${ALLOWED_ORIGINS.join(', ')}`);
  logger.info(`🗄️  Database: ${process.env.DB_PATH || './data/monolit.db'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
