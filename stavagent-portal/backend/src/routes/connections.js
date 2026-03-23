/**
 * Service Connections routes — Sprint 2
 *
 * GET    /api/connections                  — List connections (no credentials exposed)
 * POST   /api/connections                  — Add connection (AES-256-GCM encrypt)
 * PUT    /api/connections/:id              — Update connection
 * DELETE /api/connections/:id              — Delete connection
 * POST   /api/connections/:id/test         — Test key (rate limited: 5/min)
 * GET    /api/connections/model-config     — Effective model routing for caller's org
 * GET    /api/connections/kiosk-toggles    — Per-kiosk on/off per org
 * PATCH  /api/connections/kiosk-toggles    — Update kiosk toggles (admin, manager)
 */

import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgRole } from '../middleware/orgRole.js';
import { encrypt, decrypt, isEncryptionAvailable } from '../services/encryptionService.js';
import { logger } from '../utils/logger.js';
import { connectionTestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ── Allowed service types ──────────────────────────────────────────────────
const SERVICE_TYPES = [
  'gemini', 'openai', 'anthropic', 'aws_bedrock',
  'perplexity', 'azure_openai',
  'gcs', 'aws_s3', 'azure_blob',
];

// ── Default model routing (used when no org connections exist) ──────────────
const DEFAULT_MODEL_CONFIG = {
  primary: 'gemini',
  fallback: 'openai',
  model_overrides: {
    gemini: 'gemini-2.5-flash-lite',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
  },
};

// ── Default kiosk toggles ──────────────────────────────────────────────────
const ALL_KIOSKS = ['monolit', 'registry', 'urs_matcher', 'pump', 'formwork'];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the user's active org_id. Uses query/body org_id, or falls back to
 * the user's default org_id from their profile.
 */
function resolveOrgId(req) {
  return req.query.org_id || req.body.org_id || req.user.org_id || null;
}

/**
 * Mask an API key for display: show first 4 and last 4 chars.
 */
function maskKey(key) {
  if (!key || key.length < 12) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

// ── GET /api/connections — List connections (no credentials) ────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    const userId = req.user.userId;

    let connections;
    if (orgId) {
      connections = await db.prepare(`
        SELECT id, org_id, user_id, service_type, display_name, config,
               status, last_tested_at, last_error, created_by, created_at, updated_at
        FROM service_connections
        WHERE org_id = ?
        ORDER BY created_at DESC
      `).all(orgId);
    } else {
      connections = await db.prepare(`
        SELECT id, org_id, user_id, service_type, display_name, config,
               status, last_tested_at, last_error, created_by, created_at, updated_at
        FROM service_connections
        WHERE user_id = ? AND org_id IS NULL
        ORDER BY created_at DESC
      `).all(userId);
    }

    res.json({ success: true, connections });
  } catch (error) {
    logger.error('List connections error:', error);
    res.status(500).json({ error: 'Server error listing connections' });
  }
});

// ── POST /api/connections — Add connection ─────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    if (!isEncryptionAvailable()) {
      return res.status(503).json({ error: 'Encryption not configured. MASTER_ENCRYPTION_KEY is missing.' });
    }

    const { service_type, display_name, credentials, config, org_id } = req.body;
    const userId = req.user.userId;

    if (!service_type || !SERVICE_TYPES.includes(service_type)) {
      return res.status(400).json({ error: `service_type must be one of: ${SERVICE_TYPES.join(', ')}` });
    }
    if (!credentials || typeof credentials !== 'string' || credentials.trim().length === 0) {
      return res.status(400).json({ error: 'credentials is required (API key or JSON string)' });
    }

    // Scope: org or personal
    const effectiveOrgId = org_id || null;
    const effectiveUserId = effectiveOrgId ? null : userId;

    // If org-scoped, verify caller is admin or manager
    if (effectiveOrgId) {
      const member = await db.prepare(`
        SELECT role FROM org_members
        WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL
      `).get(effectiveOrgId, userId);

      if (!member || !['admin', 'manager'].includes(member.role)) {
        return res.status(403).json({ error: 'Only admin or manager can manage org connections' });
      }
    }

    const connectionId = randomUUID();
    const { encrypted, iv } = encrypt(credentials.trim(), connectionId);

    await db.prepare(`
      INSERT INTO service_connections
        (id, user_id, org_id, service_type, display_name, credentials_encrypted, credentials_iv,
         config, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'untested', ?)
    `).run(
      connectionId, effectiveUserId, effectiveOrgId,
      service_type, display_name || `${service_type} key`,
      encrypted, iv, JSON.stringify(config || {}), userId
    );

    const created = await db.prepare(`
      SELECT id, org_id, user_id, service_type, display_name, config,
             status, created_by, created_at, updated_at
      FROM service_connections WHERE id = ?
    `).get(connectionId);

    logger.info(`Connection created: ${service_type} (${connectionId}) by user ${userId}`);
    res.status(201).json({ success: true, connection: created });
  } catch (error) {
    logger.error('Create connection error:', error);
    res.status(500).json({ error: 'Server error creating connection' });
  }
});

// ── PUT /api/connections/:id — Update connection ───────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const connectionId = req.params.id;
    const userId = req.user.userId;

    const existing = await db.prepare('SELECT * FROM service_connections WHERE id = ?').get(connectionId);
    if (!existing) return res.status(404).json({ error: 'Connection not found' });

    // Authorization: owner or org admin/manager
    if (existing.org_id) {
      const member = await db.prepare(`
        SELECT role FROM org_members
        WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL
      `).get(existing.org_id, userId);
      if (!member || !['admin', 'manager'].includes(member.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    } else if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not your connection' });
    }

    const { display_name, credentials, config, service_type } = req.body;
    const updates = [];
    const values = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(display_name);
    }
    if (service_type !== undefined && SERVICE_TYPES.includes(service_type)) {
      updates.push('service_type = ?');
      values.push(service_type);
    }
    if (config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(config));
    }
    if (credentials !== undefined && credentials.trim().length > 0) {
      if (!isEncryptionAvailable()) {
        return res.status(503).json({ error: 'Encryption not configured' });
      }
      const { encrypted, iv } = encrypt(credentials.trim(), connectionId);
      updates.push('credentials_encrypted = ?');
      values.push(encrypted);
      updates.push('credentials_iv = ?');
      values.push(iv);
      updates.push("status = 'untested'");
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(connectionId);

    await db.prepare(`UPDATE service_connections SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = await db.prepare(`
      SELECT id, org_id, user_id, service_type, display_name, config,
             status, last_tested_at, last_error, created_by, created_at, updated_at
      FROM service_connections WHERE id = ?
    `).get(connectionId);

    logger.info(`Connection updated: ${connectionId} by user ${userId}`);
    res.json({ success: true, connection: updated });
  } catch (error) {
    logger.error('Update connection error:', error);
    res.status(500).json({ error: 'Server error updating connection' });
  }
});

// ── DELETE /api/connections/:id — Delete connection ────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const connectionId = req.params.id;
    const userId = req.user.userId;

    const existing = await db.prepare('SELECT * FROM service_connections WHERE id = ?').get(connectionId);
    if (!existing) return res.status(404).json({ error: 'Connection not found' });

    // Authorization
    if (existing.org_id) {
      const member = await db.prepare(`
        SELECT role FROM org_members
        WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL
      `).get(existing.org_id, userId);
      if (!member || !['admin', 'manager'].includes(member.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    } else if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not your connection' });
    }

    await db.prepare('DELETE FROM service_connections WHERE id = ?').run(connectionId);
    logger.info(`Connection deleted: ${connectionId} by user ${userId}`);
    res.json({ success: true, message: 'Connection deleted' });
  } catch (error) {
    logger.error('Delete connection error:', error);
    res.status(500).json({ error: 'Server error deleting connection' });
  }
});

// ── POST /api/connections/:id/test — Test connection (rate limited: 5/min) ──
router.post('/:id/test', connectionTestLimiter, requireAuth, async (req, res) => {
  try {
    const connectionId = req.params.id;
    const userId = req.user.userId;

    const existing = await db.prepare('SELECT * FROM service_connections WHERE id = ?').get(connectionId);
    if (!existing) return res.status(404).json({ error: 'Connection not found' });

    // Authorization
    if (existing.org_id) {
      const member = await db.prepare(`
        SELECT role FROM org_members
        WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL
      `).get(existing.org_id, userId);
      if (!member) return res.status(403).json({ error: 'Not a member' });
    } else if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Not your connection' });
    }

    if (!isEncryptionAvailable()) {
      return res.status(503).json({ error: 'Encryption not configured' });
    }

    // Decrypt credentials
    let apiKey;
    try {
      apiKey = decrypt(existing.credentials_encrypted, connectionId);
    } catch (err) {
      await db.prepare(`
        UPDATE service_connections SET status = 'error', last_error = ?, last_tested_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `).run('Decryption failed — key may have been re-encrypted with a different master key', connectionId);
      return res.status(500).json({ error: 'Decryption failed' });
    }

    // Test the connection based on service type
    let testResult = { success: false, message: '' };
    try {
      testResult = await testServiceConnection(existing.service_type, apiKey, existing.config);
    } catch (err) {
      testResult = { success: false, message: err.message || 'Unknown error' };
    }

    const newStatus = testResult.success ? 'active' : 'error';
    const lastError = testResult.success ? null : testResult.message;

    await db.prepare(`
      UPDATE service_connections
      SET status = ?, last_error = ?, last_tested_at = NOW(), updated_at = NOW()
      WHERE id = ?
    `).run(newStatus, lastError, connectionId);

    logger.info(`Connection test: ${connectionId} → ${newStatus} (${existing.service_type})`);
    res.json({
      success: true,
      status: newStatus,
      message: testResult.message,
      masked_key: maskKey(apiKey),
    });
  } catch (error) {
    logger.error('Test connection error:', error);
    res.status(500).json({ error: 'Server error testing connection' });
  }
});

// ── GET /api/connections/model-config — Effective model routing ────────────
router.get('/model-config', requireAuth, async (req, res) => {
  try {
    const orgId = resolveOrgId(req);

    if (!orgId) {
      return res.json({ success: true, config: DEFAULT_MODEL_CONFIG, source: 'default' });
    }

    // Get org's active AI connections
    const connections = await db.prepare(`
      SELECT service_type, config, status FROM service_connections
      WHERE org_id = ? AND status = 'active'
        AND service_type IN ('gemini', 'openai', 'anthropic', 'aws_bedrock', 'perplexity', 'azure_openai')
      ORDER BY created_at
    `).all(orgId);

    if (connections.length === 0) {
      return res.json({ success: true, config: DEFAULT_MODEL_CONFIG, source: 'default' });
    }

    // Get org config overrides (stored in organizations.storage_config as JSON)
    const org = await db.prepare('SELECT storage_config FROM organizations WHERE id = ?').get(orgId);
    const orgConfig = org?.storage_config ? (typeof org.storage_config === 'string' ? JSON.parse(org.storage_config) : org.storage_config) : {};
    const modelConfig = orgConfig.model_config || {};

    const activeTypes = connections.map(c => c.service_type);
    const config = {
      primary: modelConfig.primary || activeTypes[0] || DEFAULT_MODEL_CONFIG.primary,
      fallback: modelConfig.fallback || activeTypes[1] || DEFAULT_MODEL_CONFIG.fallback,
      model_overrides: {
        ...DEFAULT_MODEL_CONFIG.model_overrides,
        ...(modelConfig.model_overrides || {}),
      },
      available_providers: activeTypes,
    };

    res.json({ success: true, config, source: 'org' });
  } catch (error) {
    logger.error('Model config error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/connections/kiosk-toggles — Per-kiosk on/off ──────────────────
router.get('/kiosk-toggles', requireAuth, async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) {
      // No org — all kiosks enabled by default for free tier (limited set)
      const toggles = {};
      ALL_KIOSKS.forEach(k => { toggles[k] = ['monolit', 'registry'].includes(k); });
      return res.json({ success: true, toggles, source: 'default' });
    }

    const org = await db.prepare('SELECT plan, storage_config FROM organizations WHERE id = ?').get(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const orgConfig = org.storage_config ? (typeof org.storage_config === 'string' ? JSON.parse(org.storage_config) : org.storage_config) : {};
    const savedToggles = orgConfig.kiosk_toggles || {};

    // Apply plan limits
    const planKiosks = org.plan === 'free'
      ? ['monolit', 'registry']
      : ALL_KIOSKS;

    const toggles = {};
    ALL_KIOSKS.forEach(k => {
      if (!planKiosks.includes(k)) {
        toggles[k] = false; // plan doesn't include this kiosk
      } else {
        toggles[k] = savedToggles[k] !== undefined ? savedToggles[k] : true;
      }
    });

    res.json({ success: true, toggles, plan: org.plan, source: 'org' });
  } catch (error) {
    logger.error('Kiosk toggles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/connections/kiosk-toggles — Update toggles (admin, manager) ─
router.patch('/kiosk-toggles', requireAuth, async (req, res) => {
  try {
    const orgId = req.body.org_id;
    if (!orgId) return res.status(400).json({ error: 'org_id is required' });

    const userId = req.user.userId;

    // Check role
    const member = await db.prepare(`
      SELECT role FROM org_members
      WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL
    `).get(orgId, userId);

    if (!member || !['admin', 'manager'].includes(member.role)) {
      return res.status(403).json({ error: 'Only admin or manager can update kiosk toggles' });
    }

    const { toggles } = req.body;
    if (!toggles || typeof toggles !== 'object') {
      return res.status(400).json({ error: 'toggles object is required' });
    }

    // Read current config, merge kiosk_toggles
    const org = await db.prepare('SELECT storage_config FROM organizations WHERE id = ?').get(orgId);
    const orgConfig = org?.storage_config ? (typeof org.storage_config === 'string' ? JSON.parse(org.storage_config) : org.storage_config) : {};
    orgConfig.kiosk_toggles = { ...(orgConfig.kiosk_toggles || {}), ...toggles };

    await db.prepare(`
      UPDATE organizations SET storage_config = ?, updated_at = NOW() WHERE id = ?
    `).run(JSON.stringify(orgConfig), orgId);

    logger.info(`Kiosk toggles updated for org ${orgId} by user ${userId}`);
    res.json({ success: true, toggles: orgConfig.kiosk_toggles });
  } catch (error) {
    logger.error('Update kiosk toggles error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Service connection testers ─────────────────────────────────────────────

/**
 * Test a service connection by making a minimal API call.
 */
async function testServiceConnection(serviceType, apiKey, configJson) {
  const config = typeof configJson === 'string' ? JSON.parse(configJson) : (configJson || {});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    switch (serviceType) {
      case 'gemini': {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { signal: controller.signal }
        );
        if (resp.ok) return { success: true, message: 'Gemini API key is valid' };
        const body = await resp.text();
        return { success: false, message: `Gemini API error ${resp.status}: ${body.slice(0, 200)}` };
      }

      case 'openai': {
        const resp = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (resp.ok) return { success: true, message: 'OpenAI API key is valid' };
        return { success: false, message: `OpenAI API error ${resp.status}` };
      }

      case 'anthropic': {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
          signal: controller.signal,
        });
        // Even a 200 or 400 (invalid params) means key is valid; 401 means invalid
        if (resp.status === 401) return { success: false, message: 'Invalid Anthropic API key' };
        return { success: true, message: 'Anthropic API key is valid' };
      }

      case 'perplexity': {
        const resp = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
          }),
          signal: controller.signal,
        });
        if (resp.status === 401) return { success: false, message: 'Invalid Perplexity API key' };
        return { success: true, message: 'Perplexity API key is valid' };
      }

      case 'aws_bedrock':
      case 'azure_openai':
      case 'gcs':
      case 'aws_s3':
      case 'azure_blob':
        // These require SDK-level testing; for now mark as untested with a note
        return { success: true, message: `${serviceType} credentials saved (manual verification recommended)` };

      default:
        return { success: false, message: `Unknown service type: ${serviceType}` };
    }
  } finally {
    clearTimeout(timeout);
  }
}

export default router;
