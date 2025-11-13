/**
 * Authentication routes
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login user
 * GET /api/auth/me - Get current user info
 */

import express from 'express';
import bcrypt from 'bcrypt';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

const SALT_ROUNDS = 10;

// POST /api/auth/register - Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const result = await db.prepare(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (?, ?, ?, 'user')
    `).run(email, passwordHash, name);

    // For SQLite, lastID is directly available
    // For PostgreSQL, we need to get the inserted row
    let userId;
    if (db.isSqlite) {
      userId = result.lastID;
    } else {
      const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      userId = user.id;
    }

    // Generate JWT token
    const token = generateToken({
      userId,
      email,
      name,
      role: 'user'
    });

    logger.info(`User registered: ${email} (ID: ${userId})`);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        name,
        role: 'user'
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    logger.info(`User logged in: ${email} (ID: ${user.id})`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me - Get current user info (requires authentication)
router.get('/me', requireAuth, async (req, res) => {
  try {
    // req.user is set by requireAuth middleware
    const user = await db.prepare(`
      SELECT id, email, name, role, created_at
      FROM users
      WHERE id = ?
    `).get(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout - Logout (client-side only, token invalidation)
router.post('/logout', requireAuth, (req, res) => {
  // JWT is stateless, so logout is handled client-side by removing token
  logger.info(`User logged out: ${req.user.email}`);
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
