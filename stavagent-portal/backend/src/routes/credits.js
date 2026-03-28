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
// TOPUP PACKAGES — predefined credit packages for purchase
// ============================================================================

const TOPUP_PACKAGES = [
  { id: 'starter',    credits: 50,   price_czk: 99,   price_eur: 4,   label: 'Starter',      description: '~5 AI analýz' },
  { id: 'standard',   credits: 200,  price_czk: 349,  price_eur: 14,  label: 'Standard',     description: '~20 AI analýz', popular: true },
  { id: 'pro',        credits: 500,  price_czk: 749,  price_eur: 30,  label: 'Professional', description: '~50 AI analýz' },
  { id: 'enterprise', credits: 2000, price_czk: 2490, price_eur: 99,  label: 'Enterprise',   description: '~200 AI analýz' },
];

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
 * GET /api/credits/packages — available topup packages
 */
router.get('/packages', (req, res) => {
  res.json({ success: true, packages: TOPUP_PACKAGES });
});

/**
 * POST /api/credits/checkout — create Stripe Checkout Session
 * Body: { package_id: 'starter' | 'standard' | 'pro' | 'enterprise' }
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

    const { package_id } = req.body;
    const pkg = TOPUP_PACKAGES.find(p => p.id === package_id);
    if (!pkg) {
      return res.status(400).json({ error: 'Neplatný balíček', available: TOPUP_PACKAGES.map(p => p.id) });
    }

    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Determine portal URL for redirects
    const portalUrl = process.env.PORTAL_FRONTEND_URL || process.env.CORS_ORIGIN || 'https://www.stavagent.cz';

    // Create Stripe Checkout Session via API (no SDK needed)
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('currency', 'czk');
    params.append('line_items[0][price_data][currency]', 'czk');
    params.append('line_items[0][price_data][unit_amount]', String(pkg.price_czk * 100)); // Stripe uses smallest unit (haléře)
    params.append('line_items[0][price_data][product_data][name]', `STAVAGENT: ${pkg.credits} kreditů`);
    params.append('line_items[0][price_data][product_data][description]', pkg.description);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${portalUrl}/cabinet?topup=success&credits=${pkg.credits}`);
    params.append('cancel_url', `${portalUrl}/cabinet?topup=cancelled`);
    params.append('customer_email', userEmail);
    params.append('metadata[user_id]', String(userId));
    params.append('metadata[package_id]', pkg.id);
    params.append('metadata[credits]', String(pkg.credits));

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

    logger.info(`[STRIPE] Checkout session created: ${session.id} for user ${userId}, ${pkg.credits} credits`);

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
      const packageId = session.metadata?.package_id;

      if (!userId || !credits) {
        logger.warn('[STRIPE] Webhook missing metadata:', session.metadata);
        return res.json({ received: true, warning: 'Missing metadata' });
      }

      // Add credits to user
      await addCredits(userId, credits, {
        description: `Stripe dobití: ${packageId} (${credits} kreditů)`,
        referenceId: session.payment_intent || session.id,
      });

      logger.info(`[STRIPE] Credits added: user=${userId}, credits=${credits}, payment=${session.payment_intent}`);
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
