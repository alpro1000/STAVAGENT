/**
 * Credits Routes — User-facing + Admin + Stripe payments
 *
 * User routes (requireAuth):
 *   GET  /api/credits/balance       — current balance + session-only status
 *   GET  /api/credits/prices        — operation pricing catalog
 *   GET  /api/credits/history       — transaction history
 *   GET  /api/credits/packages      — available topup packages
 *   POST /api/credits/checkout      — create Stripe checkout session
 *
 * Stripe webhook (no auth — verified by signature):
 *   POST /api/credits/webhook       — Stripe payment events
 *
 * Admin routes (adminOnly):
 *   GET  /api/credits/admin/stats         — credit system stats
 *   GET  /api/credits/admin/prices        — all prices (incl. inactive)
 *   PUT  /api/credits/admin/prices/:key   — update operation price
 *   POST /api/credits/admin/topup         — add credits to user
 *   GET  /api/credits/admin/user/:id      — user's balance + history
 */

import express from 'express';
import { createHmac } from 'crypto';
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
// VOLUME DISCOUNT — the more you pay, the cheaper each credit
// Base rate: 1 CZK = 1 credit (for amounts 10-99 CZK)
// ============================================================================

const DISCOUNT_TIERS = [
  { min_czk: 1000, discount: 0.25, label: '25% bonus' },
  { min_czk: 500,  discount: 0.20, label: '20% bonus' },
  { min_czk: 250,  discount: 0.15, label: '15% bonus' },
  { min_czk: 125,  discount: 0,    label: '' },
];

const MIN_TOPUP_CZK = 125;
const MAX_TOPUP_CZK = 50000;

/**
 * Calculate credits for a given CZK amount (with volume discount)
 */
function calculateCredits(amountCzk) {
  const tier = DISCOUNT_TIERS.find(t => amountCzk >= t.min_czk) || { discount: 0, label: '' };
  const bonusMultiplier = 1 + tier.discount;
  const credits = Math.floor(amountCzk * bonusMultiplier);
  return {
    amount_czk: amountCzk,
    credits,
    discount_percent: Math.round(tier.discount * 100),
    discount_label: tier.label,
    rate: (amountCzk / credits).toFixed(2),  // CZK per credit
  };
}

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
// TOPUP PACKAGES & STRIPE CHECKOUT
// ============================================================================

/**
 * GET /api/credits/calculate?amount=500 — preview credits for a given CZK amount
 */
router.get('/calculate', (req, res) => {
  const amount = parseInt(req.query.amount);
  if (!amount || amount < MIN_TOPUP_CZK || amount > MAX_TOPUP_CZK) {
    return res.status(400).json({
      error: `Částka musí být ${MIN_TOPUP_CZK}–${MAX_TOPUP_CZK} Kč`,
    });
  }
  res.json({ success: true, ...calculateCredits(amount) });
});

/**
 * GET /api/credits/tiers — discount tiers info
 */
router.get('/tiers', (req, res) => {
  res.json({
    success: true,
    base_rate: '1 Kč = 1 kredit',
    min_czk: MIN_TOPUP_CZK,
    max_czk: MAX_TOPUP_CZK,
    tiers: DISCOUNT_TIERS.map(t => ({
      min_czk: t.min_czk,
      discount_percent: Math.round(t.discount * 100),
      label: t.label,
      example_credits: calculateCredits(t.min_czk).credits,
    })),
  });
});

/**
 * POST /api/credits/checkout — create Stripe Checkout Session
 * Body: { amount_czk: number (10–50000) }
 *
 * Requires STRIPE_SECRET_KEY env var. Returns checkout URL.
 */
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(503).json({
        error: 'Platební systém není nakonfigurován',
        hint: 'Kontaktujte administrátora pro nastavení Stripe.',
      });
    }

    const amountCzk = parseInt(req.body.amount_czk);
    if (!amountCzk || amountCzk < MIN_TOPUP_CZK || amountCzk > MAX_TOPUP_CZK) {
      return res.status(400).json({
        error: `Částka musí být ${MIN_TOPUP_CZK}–${MAX_TOPUP_CZK} Kč`,
      });
    }

    const calc = calculateCredits(amountCzk);
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Determine portal URL for redirects
    const portalUrl = process.env.PORTAL_FRONTEND_URL || process.env.CORS_ORIGIN || 'https://www.stavagent.cz';

    // Create Stripe Checkout Session via API (no SDK needed)
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('currency', 'czk');
    params.append('line_items[0][price_data][currency]', 'czk');
    params.append('line_items[0][price_data][unit_amount]', String(amountCzk * 100)); // haléře
    params.append('line_items[0][price_data][product_data][name]', `STAVAGENT: ${calc.credits} kreditů`);
    params.append('line_items[0][price_data][product_data][description]',
      calc.discount_percent > 0
        ? `${amountCzk} Kč + ${calc.discount_label} = ${calc.credits} kreditů`
        : `${calc.credits} kreditů`
    );
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${portalUrl}/cabinet?topup=success&credits=${calc.credits}`);
    params.append('cancel_url', `${portalUrl}/cabinet?topup=cancelled`);
    params.append('customer_email', userEmail);
    params.append('metadata[user_id]', String(userId));
    params.append('metadata[amount_czk]', String(amountCzk));
    params.append('metadata[credits]', String(calc.credits));
    params.append('metadata[discount_percent]', String(calc.discount_percent));

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      logger.error('[STRIPE] Checkout error:', session);
      return res.status(502).json({
        error: 'Stripe chyba',
        detail: session.error?.message || 'Unknown error',
      });
    }

    logger.info(`[STRIPE] Checkout: user=${userId}, ${amountCzk} CZK → ${calc.credits} credits (${calc.discount_percent}% bonus)`);

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    logger.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/credits/webhook — Stripe webhook handler
 *
 * IMPORTANT: This endpoint must receive raw body for signature verification.
 * The server.js express.json() middleware runs before this, so we use
 * the parsed body but verify via Stripe signature if STRIPE_WEBHOOK_SECRET is set.
 *
 * Events handled:
 * - checkout.session.completed — credit the user
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Verify signature if webhook secret is configured
    if (webhookSecret) {
      const sig = req.headers['stripe-signature'];
      if (!sig) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      // Parse Stripe signature
      const elements = sig.split(',').reduce((acc, part) => {
        const [key, value] = part.split('=');
        acc[key] = value;
        return acc;
      }, {});

      const timestamp = elements['t'];
      const expectedSig = elements['v1'];

      if (!timestamp || !expectedSig) {
        return res.status(400).json({ error: 'Invalid signature format' });
      }

      // Compute expected signature
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const payload = `${timestamp}.${rawBody}`;
      const computed = createHmac('sha256', webhookSecret).update(payload).digest('hex');

      if (computed !== expectedSig) {
        logger.warn('[STRIPE] Webhook signature verification failed');
        return res.status(400).json({ error: 'Signature verification failed' });
      }

      // Check timestamp (reject events older than 5 min)
      const tolerance = 5 * 60;
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - parseInt(timestamp)) > tolerance) {
        return res.status(400).json({ error: 'Timestamp too old' });
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = parseInt(session.metadata?.user_id);
      const credits = parseInt(session.metadata?.credits);
      const amountCzk = session.metadata?.amount_czk || '?';
      const discountPercent = session.metadata?.discount_percent || '0';

      if (!userId || !credits) {
        logger.warn('[STRIPE] Webhook missing metadata:', session.metadata);
        return res.json({ received: true, warning: 'Missing metadata' });
      }

      // Add credits to user
      await addCredits(userId, credits, {
        description: `Dobití: ${amountCzk} Kč → ${credits} kreditů${discountPercent > 0 ? ` (+${discountPercent}% bonus)` : ''}`,
        referenceId: session.payment_intent || session.id,
      });

      logger.info(`[STRIPE] Credits added: user=${userId}, ${amountCzk} CZK → ${credits} credits, payment=${session.payment_intent}`);
    }

    // Always return 200 to Stripe (even for unhandled events)
    res.json({ received: true });
  } catch (error) {
    logger.error('[STRIPE] Webhook error:', error);
    // Return 200 anyway to prevent Stripe retries for non-recoverable errors
    res.status(200).json({ received: true, error: error.message });
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
