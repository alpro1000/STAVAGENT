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
      VALUES (?, ?, ?, 'user', false)
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
    logger.info(`[LOGIN START] Email: ${email}`);

    // Validation
    if (!email || !password) {
      logger.warn(`[LOGIN FAIL] Missing email or password`);
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    logger.info(`[LOGIN] Querying database for user: ${email}`);
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    logger.info(`[LOGIN] Database query returned: ${user ? 'User found' : 'User not found'}`);

    if (!user) {
      logger.warn(`[LOGIN FAIL] User not found: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if email is verified
    logger.info(`[LOGIN] Checking email verification: email_verified=${user.email_verified}`);
    if (!user.email_verified) {
      logger.warn(`[LOGIN FAIL] Email not verified: ${email}`);
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Email not verified. Vaš email není ověřen. Zkontrolujte si poštovní schránku a klikněte na odkaz k ověření.'
      });
    }

    // Verify password
    logger.info(`[LOGIN] Starting bcrypt.compare for password`);
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    logger.info(`[LOGIN] bcrypt.compare completed: ${passwordMatch ? 'Match' : 'No match'}`);

    if (!passwordMatch) {
      logger.warn(`[LOGIN FAIL] Password mismatch for: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    logger.info(`[LOGIN] Generating JWT token`);
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
    logger.info(`[LOGIN] JWT token generated`);

    logger.info(`[LOGIN SUCCESS] User logged in: ${email} (ID: ${user.id})`);

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
    logger.error('[LOGIN ERROR] Exception caught:', error);
    logger.error('[LOGIN ERROR] Stack:', error.stack);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me - Get current user info (requires authentication)
router.get('/me', requireAuth, async (req, res) => {
  try {
    // req.user is set by requireAuth middleware
    const user = await db.prepare(`
      SELECT id, email, name, role, email_verified, created_at
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
      SET email_verified = true, email_verified_at = ?, updated_at = ?
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

// POST /api/auth/change-password - Change current user's password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get user from database
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password in database
    await db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, userId);

    logger.info(`Password changed for user: ${user.email} (ID: ${userId})`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Server error during password change' });
  }
});

// POST /api/auth/forgot-password - Request password reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      // Don't reveal if email exists for security
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Generate reset token
    const tokenString = randomUUID();
    const tokenHash = createHash('sha256').update(tokenString).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Delete any existing reset tokens for this user
    await db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    // Store new reset token
    await db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(randomUUID(), user.id, tokenHash, expiresAt);

    // Send password reset email
    const { sendPasswordResetEmail } = await import('../services/emailService.js');
    const emailResult = await sendPasswordResetEmail(email, tokenString);

    if (!emailResult.success) {
      logger.warn(`Failed to send password reset email to ${email}: ${emailResult.error}`);
      // Don't fail the request if email fails in dev/test mode
    }

    logger.info(`Password reset token generated for user: ${email} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent'
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error during password reset request' });
  }
});

// POST /api/auth/reset-password - Reset password using token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Find reset token
    const resetToken = await db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token_hash = ?
    `).get(tokenHash);

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    // Check if token has expired
    if (new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Password reset token has expired' });
    }

    // Get user
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(resetToken.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPasswordHash, user.id);

    // Delete used token
    await db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(resetToken.id);

    logger.info(`Password reset for user: ${user.email} (ID: ${user.id})`);

    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error during password reset' });
  }
});

// POST /api/auth/create-admin-if-first - Create first admin user
// This endpoint allows creating the first admin user without authentication
// Once an admin exists, this endpoint becomes unavailable for security
router.post('/create-admin-if-first', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if any admins already exist
    const adminExists = await db.prepare('SELECT id FROM users WHERE role = ?').get('admin');

    if (adminExists) {
      return res.status(403).json({
        error: 'Admin user already exists',
        message: 'The first admin has already been created. Contact existing admin for access.'
      });
    }

    // Validate input
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

    // Create admin user (email_verified = true for admin, skip email verification)
    const result = await db.prepare(`
      INSERT INTO users (email, password_hash, name, role, email_verified, email_verified_at)
      VALUES (?, ?, ?, 'admin', true, ?)
    `).run(email, passwordHash, name, new Date().toISOString());

    let userId;
    if (db.isSqlite) {
      userId = result.lastID;
    } else {
      const user = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      userId = user.id;
    }

    logger.warn(`⚠️ FIRST ADMIN CREATED: ${email} (ID: ${userId}) - This endpoint is now disabled`);

    res.status(201).json({
      success: true,
      message: 'First admin user created successfully!',
      user: {
        id: userId,
        email,
        name,
        role: 'admin',
        email_verified: true
      }
    });
  } catch (error) {
    logger.error('Create first admin error:', error);
    res.status(500).json({ error: 'Server error during admin creation' });
  }
});

export default router;
