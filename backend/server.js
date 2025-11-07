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

// Utils
import { initDatabase } from './src/db/init.js';
import { errorHandler } from './src/utils/errorHandler.js';
import { logger } from './src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Initialize Express
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

// Logging
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

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
app.use('/api/upload', uploadRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/bridges', bridgesRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/config', configRoutes);

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
  logger.info(`📊 CORS enabled for: ${CORS_ORIGIN}`);
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
