/**
 * Credit Service — Pay-as-you-go billing
 *
 * Users have a credit_balance. Operations deduct credits.
 * Zero balance = session-only mode (no DB saves, results in browser only).
 * Admins bypass credit checks.
 */

import db from '../db/index.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory cache for operation prices (refreshed every 5 min)
let priceCache = null;
let priceCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get all operation prices (cached)
 */
export async function getOperationPrices() {
  const now = Date.now();
  if (priceCache && (now - priceCacheTime) < CACHE_TTL_MS) {
    return priceCache;
  }
  try {
    const rows = await db.prepare(`
      SELECT operation_key, display_name, description, credits_cost, is_ai, is_active, sort_order
      FROM operation_prices
      WHERE is_active = true
      ORDER BY sort_order
    `).all();
    priceCache = rows;
    priceCacheTime = now;
    return rows;
  } catch (error) {
    logger.error('[CREDITS] Error loading operation prices:', error);
    return priceCache || [];
  }
}

/**
 * Get the credit cost for a specific operation
 * Returns 0 if operation not found (free by default)
 */
export async function getOperationCost(operationKey) {
  const prices = await getOperationPrices();
  const op = prices.find(p => p.operation_key === operationKey);
  return op ? op.credits_cost : 0;
}

/**
 * Get user's current credit balance
 */
export async function getBalance(userId) {
  try {
    const row = await db.prepare(
      'SELECT credit_balance FROM users WHERE id = ?'
    ).get(userId);
    return row ? (row.credit_balance || 0) : 0;
  } catch (error) {
    logger.error('[CREDITS] Error getting balance:', error);
    return 0;
  }
}

/**
 * Check if user can afford an operation.
 * Admins always can. Returns { allowed, balance, cost, shortfall }
 */
export async function canAfford(userId, operationKey) {
  try {
    const user = await db.prepare(
      'SELECT credit_balance, role FROM users WHERE id = ?'
    ).get(userId);

    if (!user) return { allowed: false, balance: 0, cost: 0, shortfall: 0, reason: 'User not found' };

    // Admins bypass
    if (user.role === 'admin') {
      return { allowed: true, balance: user.credit_balance || 0, cost: 0, shortfall: 0, admin: true };
    }

    const cost = await getOperationCost(operationKey);
    if (cost === 0) {
      return { allowed: true, balance: user.credit_balance || 0, cost: 0, shortfall: 0 };
    }

    const balance = user.credit_balance || 0;
    const allowed = balance >= cost;

    return {
      allowed,
      balance,
      cost,
      shortfall: allowed ? 0 : cost - balance,
      reason: allowed ? null : `Nedostatek kreditů. Potřeba: ${cost}, váš zůstatek: ${balance}.`,
    };
  } catch (error) {
    logger.error('[CREDITS] Error checking canAfford:', error);
    // Fail-open: allow on error
    return { allowed: true, balance: 0, cost: 0, shortfall: 0, error: true };
  }
}

/**
 * Deduct credits for an operation. Returns the transaction or null on failure.
 * IMPORTANT: Call AFTER the operation succeeds (don't charge for failed ops).
 */
export async function deductCredits(userId, operationKey, description = null) {
  try {
    const user = await db.prepare(
      'SELECT credit_balance, role FROM users WHERE id = ?'
    ).get(userId);

    if (!user) return null;

    // Admins: don't deduct but still log
    if (user.role === 'admin') {
      return { admin: true, cost: 0, balance: user.credit_balance || 0 };
    }

    const cost = await getOperationCost(operationKey);
    if (cost === 0) return { cost: 0, balance: user.credit_balance || 0 };

    const currentBalance = user.credit_balance || 0;
    if (currentBalance < cost) {
      return null; // insufficient funds
    }

    const newBalance = currentBalance - cost;
    const txId = uuidv4();
    const desc = description || `Operace: ${operationKey}`;

    // Atomic update: deduct only if balance still sufficient
    const result = await db.prepare(`
      UPDATE users SET credit_balance = credit_balance - ?, updated_at = NOW()
      WHERE id = ? AND credit_balance >= ?
    `).run(cost, userId, cost);

    // Check if update actually happened (race condition guard)
    if (!result.changes) {
      return null;
    }

    // Record transaction
    await db.prepare(`
      INSERT INTO credit_transactions (id, user_id, amount, balance_after, operation_key, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `).run(txId, userId, -cost, newBalance, operationKey, desc);

    logger.info(`[CREDITS] Deducted ${cost} from user ${userId} for ${operationKey}. Balance: ${newBalance}`);

    return { cost, balance: newBalance, transaction_id: txId };
  } catch (error) {
    logger.error('[CREDITS] Error deducting credits:', error);
    return null;
  }
}

/**
 * Add credits to a user (top-up).
 * Called by /admin/topup. Self-service topup (Stripe webhook) was removed
 * 2026-05-08; will be re-added behind Lemon Squeezy webhook in Q3 2026.
 */
export async function addCredits(userId, amount, { description = null, referenceId = null, adminId = null } = {}) {
  try {
    if (amount <= 0) throw new Error('Amount must be positive');

    // Get current balance
    const user = await db.prepare('SELECT credit_balance FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('User not found');

    const currentBalance = user.credit_balance || 0;
    const newBalance = currentBalance + amount;
    const txId = uuidv4();
    const desc = description || `Dobití: +${amount} kreditů`;

    // Update balance
    await db.prepare(`
      UPDATE users SET credit_balance = credit_balance + ?, updated_at = NOW()
      WHERE id = ?
    `).run(amount, userId);

    // Record transaction
    await db.prepare(`
      INSERT INTO credit_transactions (id, user_id, amount, balance_after, operation_key, description, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `).run(txId, userId, amount, newBalance, null, desc, referenceId);

    // Audit log if admin action
    if (adminId) {
      await db.prepare(`
        INSERT INTO audit_logs (id, admin_id, action, data, created_at)
        VALUES (?, ?, 'credit_topup', ?, NOW())
      `).run(uuidv4(), adminId, JSON.stringify({ userId, amount, newBalance, referenceId }));
    }

    logger.info(`[CREDITS] Added ${amount} to user ${userId}. Balance: ${newBalance}`);

    return { balance: newBalance, transaction_id: txId };
  } catch (error) {
    logger.error('[CREDITS] Error adding credits:', error);
    throw error;
  }
}

/**
 * Get transaction history for a user
 */
export async function getTransactionHistory(userId, { limit = 50, offset = 0 } = {}) {
  try {
    const transactions = await db.prepare(`
      SELECT id, amount, balance_after, operation_key, description, reference_id, created_at
      FROM credit_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);

    const totalRow = await db.prepare(
      'SELECT COUNT(*) as total FROM credit_transactions WHERE user_id = ?'
    ).get(userId);

    return {
      transactions,
      total: parseInt(totalRow?.total || 0, 10),
      limit,
      offset,
    };
  } catch (error) {
    logger.error('[CREDITS] Error getting history:', error);
    return { transactions: [], total: 0, limit, offset };
  }
}

/**
 * Check if user is in session-only mode (no credits, no paid plan)
 * Session-only = results not saved to DB, only available in browser session
 */
export async function isSessionOnly(userId) {
  try {
    const user = await db.prepare(
      'SELECT credit_balance, role, plan FROM users WHERE id = ?'
    ).get(userId);

    if (!user) return true;
    if (user.role === 'admin') return false;

    // Has credits = full access
    if ((user.credit_balance || 0) > 0) return false;

    // No credits = session-only
    return true;
  } catch (error) {
    logger.error('[CREDITS] Error checking session-only:', error);
    return false; // fail-open
  }
}

/**
 * Get all operation prices (admin view, including inactive)
 */
export async function getAllPricesAdmin() {
  try {
    return await db.prepare(`
      SELECT * FROM operation_prices ORDER BY sort_order
    `).all();
  } catch (error) {
    logger.error('[CREDITS] Error getting all prices:', error);
    return [];
  }
}

/**
 * Update operation price (admin)
 */
export async function updateOperationPrice(operationKey, { creditsCost, displayName, description, isActive }) {
  try {
    const sets = [];
    const params = [];

    if (creditsCost !== undefined) { sets.push('credits_cost = ?'); params.push(creditsCost); }
    if (displayName !== undefined) { sets.push('display_name = ?'); params.push(displayName); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive); }

    if (sets.length === 0) return false;

    sets.push('updated_at = NOW()');
    params.push(operationKey);

    await db.prepare(`
      UPDATE operation_prices SET ${sets.join(', ')} WHERE operation_key = ?
    `).run(...params);

    // Invalidate cache
    priceCache = null;

    return true;
  } catch (error) {
    logger.error('[CREDITS] Error updating price:', error);
    throw error;
  }
}

/**
 * Get credit stats for admin dashboard
 */
export async function getCreditStats() {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString();

    const totalBalance = await db.prepare(`
      SELECT COALESCE(SUM(credit_balance), 0) as total, COUNT(*) as users_with_credits
      FROM users WHERE credit_balance > 0
    `).get();

    const recentTopups = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM credit_transactions
      WHERE amount > 0 AND created_at > ?
    `).get(cutoffStr);

    const recentDeductions = await db.prepare(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total, COUNT(*) as count
      FROM credit_transactions
      WHERE amount < 0 AND created_at > ?
    `).get(cutoffStr);

    const topOperations = await db.prepare(`
      SELECT operation_key, COUNT(*) as count, COALESCE(SUM(ABS(amount)), 0) as total_credits
      FROM credit_transactions
      WHERE amount < 0 AND created_at > ?
      GROUP BY operation_key
      ORDER BY total_credits DESC
      LIMIT 10
    `).all(cutoffStr);

    return {
      total_balance_in_system: parseInt(totalBalance?.total || 0, 10),
      users_with_credits: parseInt(totalBalance?.users_with_credits || 0, 10),
      last_30_days: {
        topups: { total: parseInt(recentTopups?.total || 0, 10), count: parseInt(recentTopups?.count || 0, 10) },
        deductions: { total: parseInt(recentDeductions?.total || 0, 10), count: parseInt(recentDeductions?.count || 0, 10) },
      },
      top_operations: topOperations,
    };
  } catch (error) {
    logger.error('[CREDITS] Error getting stats:', error);
    return {};
  }
}

/**
 * Invalidate price cache (called after admin updates)
 */
export function invalidatePriceCache() {
  priceCache = null;
  priceCacheTime = 0;
}
