/**
 * Authentication routes
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login user
 * GET /api/auth/me - Get current user info
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

const SALT_ROUNDS = 10;

// POST /api/auth/register - Register new user (requires email verification)
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

    // Insert user (email_verified = false by default)
    const result = await db.prepare(`
      INSERT INTO users (email, password_hash, name, role, email_verified)
      VALUES (?, ?, ?, 'user', 0)
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

    // Generate verification token (unique per user)
    const tokenString = randomUUID();
    const tokenHash = createHash('sha256').update(tokenString).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    // Store verification token
    await db.prepare(`
      INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(randomUUID(), userId, tokenHash, expiresAt);

    // Send verification email
    const emailResult = await sendVerificationEmail(email, tokenString);
    if (!emailResult.success) {
      logger.warn(`Failed to send verification email to ${email}: ${emailResult.error}`);
      // Don't fail registration if email fails in dev/test mode
    }

    logger.info(`User registered: ${email} (ID: ${userId}) - awaiting email verification`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: userId,
        email,
        name,
        email_verified: false
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

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please verify your email address before logging in. Check your inbox for verification link.'
      });
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
        role: user.role,
        email_verified: user.email_verified
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
        email_verified: user.email_verified,
        created_at: user.created_at
      }
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/verify - Verify email with token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find verification token
    const verificationToken = await db.prepare(`
      SELECT * FROM email_verification_tokens
      WHERE token_hash = ?
    `).get(tokenHash);

    if (!verificationToken) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    if (new Date(verificationToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Get user info
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(verificationToken.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mark email as verified
    const verifiedAt = new Date().toISOString();
    await db.prepare(`
      UPDATE users
      SET email_verified = 1, email_verified_at = ?, updated_at = ?
      WHERE id = ?
    `).run(verifiedAt, verifiedAt, user.id);

    // Delete used token
    await db.prepare('DELETE FROM email_verification_tokens WHERE id = ?').run(verificationToken.id);

    logger.info(`Email verified for user: ${user.email} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified: true
      }
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ error: 'Server error during email verification' });
  }
});

// POST /api/auth/logout - Logout (client-side only, token invalidation)
router.post('/logout', requireAuth, (req, res) => {
  // JWT is stateless, so logout is handled client-side by removing token
  logger.info(`User logged out: ${req.user.email}`);
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
