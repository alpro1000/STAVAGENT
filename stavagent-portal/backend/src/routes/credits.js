/**
 * Credits Routes — User-facing + Admin credit management
 *
 * User routes (requireAuth):
 *   GET  /api/credits/balance       — current balance + session-only status
 *   GET  /api/credits/prices        — operation pricing catalog
 *   GET  /api/credits/history       — transaction history
 *
 * Admin routes (adminOnly):
 *   GET  /api/credits/admin/stats         — credit system stats
 *   GET  /api/credits/admin/prices        — all prices (incl. inactive)
 *   PUT  /api/credits/admin/prices/:key   — update operation price
 *   POST /api/credits/admin/topup         — add credits to user
 *   GET  /api/credits/admin/user/:id      — user's balance + history
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import {
  getBalance,
  getOperationPrices,
  getTransactionHistory,
  isSessionOnly,
  addCredits,
  getAllPricesAdmin,
  updateOperationPrice,
  getCreditStats,
} from '../services/creditService.js';

const router = express.Router();

// ============================================================================
// USER ROUTES
// ============================================================================

/**
 * GET /api/credits/balance — current balance + session-only status
 */
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const balance = await getBalance(userId);
    const sessionOnly = await isSessionOnly(userId);

    res.json({
      success: true,
      balance,
      session_only: sessionOnly,
      currency: 'credits',
    });
  } catch (error) {
    logger.error('Credits balance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/credits/prices — public operation pricing catalog
 */
router.get('/prices', async (req, res) => {
  try {
    const prices = await getOperationPrices();
    res.json({ success: true, prices });
  } catch (error) {
    logger.error('Credits prices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/credits/history — user's transaction history
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const result = await getTransactionHistory(userId, { limit, offset });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Credits history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * Admin-only middleware (inline — reuses pattern from admin.js)
 */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * GET /api/credits/admin/stats — credit system overview
 */
router.get('/admin/stats', requireAuth, adminOnly, async (req, res) => {
  try {
    const stats = await getCreditStats();
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Credits admin stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/credits/admin/prices — all prices including inactive
 */
router.get('/admin/prices', requireAuth, adminOnly, async (req, res) => {
  try {
    const prices = await getAllPricesAdmin();
    res.json({ success: true, prices });
  } catch (error) {
    logger.error('Credits admin prices error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/credits/admin/prices/:key — update operation price
 */
router.put('/admin/prices/:key', requireAuth, adminOnly, async (req, res) => {
  try {
    const { key } = req.params;
    const { credits_cost, display_name, description, is_active } = req.body;

    await updateOperationPrice(key, {
      creditsCost: credits_cost,
      displayName: display_name,
      description,
      isActive: is_active,
    });

    res.json({ success: true, message: `Price updated for ${key}` });
  } catch (error) {
    logger.error('Credits admin update price error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/credits/admin/topup — add credits to a user
 * Body: { user_id, amount, description?, reference_id? }
 */
router.post('/admin/topup', requireAuth, adminOnly, async (req, res) => {
  try {
    const { user_id, amount, description, reference_id } = req.body;

    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'user_id and positive amount required' });
    }

    const result = await addCredits(user_id, amount, {
      description: description || `Admin dobití: +${amount}`,
      referenceId: reference_id,
      adminId: req.user.userId,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Credits admin topup error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * GET /api/credits/admin/user/:id — user's balance + recent history
 */
router.get('/admin/user/:id', requireAuth, adminOnly, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const balance = await getBalance(userId);
    const history = await getTransactionHistory(userId, { limit: 20 });

    res.json({
      success: true,
      user_id: userId,
      balance,
      ...history,
    });
  } catch (error) {
    logger.error('Credits admin user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
