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
import monolithProjectsRoutes from './src/routes/monolith-projects.js';
import partsRoutes from './src/routes/parts.js';
import exportRoutes from './src/routes/export.js';
import mappingRoutes from './src/routes/mapping.js';
import configRoutes from './src/routes/config.js';
import snapshotsRoutes from './src/routes/snapshots.js';
import otskpRoutes from './src/routes/otskp.js';
import documentsRoutes from './src/routes/documents.js';
import sheathingRoutes from './src/routes/sheathing.js';
import debugRoutes from './src/routes/debug.js';
import suggestionsRoutes from './src/routes/suggestions.js';

// Utils
import { initDatabase } from './src/db/init.js';
import { errorHandler } from './src/utils/errorHandler.js';
import { logger } from './src/utils/logger.js';
import { schedulePeriodicCleanup } from './src/utils/fileCleanup.js';

// Middleware
import { apiLimiter, authLimiter, uploadLimiter, otskpLimiter } from './src/middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;

// CORS configuration - support multiple origins
const ALLOWED_ORIGINS = [
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
  // Monolit-Planner domains
  'https://monolit-planner-frontend.onrender.com', // Production
  'https://monolit-planner-test.onrender.com',    // Test
  // StavaAgent Portal domains (auth & redirect)
  'https://stavagent-portal-frontend.onrender.com',
  'https://stavagent-portal-test.onrender.com',
  // Custom origin from environment
  process.env.CORS_ORIGIN
].filter(Boolean); // Remove undefined/null values

// Initialize Express
const app = express();

// Trust proxy - SECURITY: Only enable behind verified proxy environments
// This prevents IP spoofing attacks in local development
// Enable ONLY:
// 1. On Render (detected by RENDER env var), OR
// 2. Explicitly with TRUST_PROXY=true env var
const shouldTrustProxy = process.env.RENDER === 'true' || process.env.TRUST_PROXY === 'true';
if (shouldTrustProxy) {
  app.set('trust proxy', 1);
  console.log('[Security] Trust proxy enabled (behind verified proxy)');
} else {
  console.log('[Security] Trust proxy disabled (development mode)');
}

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

// Logging (exclude healthcheck requests from logs)
app.use(morgan('combined', {
  skip: (req, res) => req.path === '/healthcheck',
  stream: { write: msg => logger.info(msg.trim()) }
}));

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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Keep-Alive healthcheck (with secret key protection)
app.get('/healthcheck', (req, res) => {
  const keepAliveKey = process.env.KEEP_ALIVE_KEY;

  // If no key configured, disable endpoint
  if (!keepAliveKey) {
    return res.status(404).json({ error: 'Not found' });
  }

  // Validate X-Keep-Alive-Key header
  const providedKey = req.headers['x-keep-alive-key'];

  if (providedKey !== keepAliveKey) {
    // Return 404 to hide endpoint existence
    return res.status(404).json({ error: 'Not found' });
  }

  // Return minimal response (no DB queries)
  res.json({ status: 'alive', service: 'monolit-planner' });
});

// API Routes
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/positions', positionsRoutes);
app.use('/api/bridges', bridgesRoutes);
app.use('/api/monolith-projects', monolithProjectsRoutes);
app.use('/api/parts', partsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/config', configRoutes);
app.use('/api/snapshots', snapshotsRoutes);
app.use('/api/otskp', otskpLimiter, otskpRoutes);
app.use('/api/documents', uploadLimiter, documentsRoutes);
app.use('/api/sheathing', sheathingRoutes);
app.use('/api/suggestions', suggestionsRoutes);

// DEBUG routes - ONLY enabled in development
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
  logger.info('🐛 DEBUG routes enabled (development mode)');
} else {
  logger.info('🔒 DEBUG routes disabled (production mode)');
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use(errorHandler);

// Bootstrap function - initialize database then start server
async function bootstrap() {
  try {
    // Initialize database (await for PostgreSQL migrations)
    await initDatabase();
    logger.info('✅ Database initialized successfully');

    // Schedule periodic file cleanup
    schedulePeriodicCleanup();

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Monolit Planner Backend running on port ${PORT}`);
      logger.info(`📊 CORS enabled for: ${ALLOWED_ORIGINS.join(', ')}`);
      logger.info(`🗄️  Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
    });
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Start application
bootstrap();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
