/**
 * StavAgent Portal - Backend Server
 * Main entry point for StavAgent microservices architecture
 * Express + PostgreSQL/SQLite API
 *
 * Portal handles:
 * - User authentication & authorization
 * - Project management (portal_projects)
 * - File storage (portal_files)
 * - Kiosk coordination (kiosk_links)
 * - CORE integration (concreteAgentClient)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Portal Routes (Kiosk routes moved to kiosk-monolit repo)
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/routes/admin.js';
import portalProjectsRoutes from './src/routes/portal-projects.js';
import portalFilesRoutes from './src/routes/portal-files.js';
import kioskLinksRoutes from './src/routes/kiosk-links.js';
import otskpRoutes from './src/routes/otskp.js';
import debugRoutes from './src/routes/debug.js';

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
// Auth routes (no auth required for login/register)
app.use('/api/auth', authLimiter, authRoutes);

// Admin routes (requires authentication + admin role)
app.use('/api/admin', adminRoutes);

// Portal routes (main entry point for projects, files, and kiosk coordination)
app.use('/api/portal-projects', portalProjectsRoutes);
app.use('/api/portal-files', uploadLimiter, portalFilesRoutes);
app.use('/api/kiosk-links', kioskLinksRoutes);

// OTSKP reference (shared across all kiosks)
app.use('/api/otskp', otskpLimiter, otskpRoutes);

// Debug routes (disable in production)
app.use('/api/debug', debugRoutes);

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
      logger.info(`🚀 StavAgent Portal Backend running on port ${PORT}`);
      logger.info(`📊 CORS enabled for: ${ALLOWED_ORIGINS.join(', ')}`);
      logger.info(`🗄️  Database: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
      logger.info(`🏛️  Portal API: Auth, Admin, Projects, Files, Kiosk Links`);
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
