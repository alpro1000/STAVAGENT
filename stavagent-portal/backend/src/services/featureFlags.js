/**
 * Feature Flags Service
 * Granular control over services, modules, and actions per plan/org/user
 */

import db from '../db/index.js';
import { logger } from '../utils/logger.js';

// In-memory cache (refreshed every 60s)
let flagsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Load all flags + overrides into memory
 */
async function loadFlags() {
  const now = Date.now();
  if (flagsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return flagsCache;
  }

  try {
    const flags = await db.prepare(`
      SELECT id, flag_key, display_name, description, category, default_enabled
      FROM feature_flags
      ORDER BY category, flag_key
    `).all();

    const overrides = await db.prepare(`
      SELECT ffo.flag_id, ffo.scope_type, ffo.scope_value, ffo.enabled, ff.flag_key
      FROM feature_flag_overrides ffo
      JOIN feature_flags ff ON ffo.flag_id = ff.id
    `).all();

    flagsCache = { flags, overrides };
    cacheTimestamp = now;
    return flagsCache;
  } catch (error) {
    logger.error('[FEATURE_FLAGS] Error loading flags:', error);
    // Return empty defaults on error
    return { flags: [], overrides: [] };
  }
}

/**
 * Invalidate cache (call after admin makes changes)
 */
export function invalidateFlagCache() {
  flagsCache = null;
  cacheTimestamp = 0;
}

/**
 * Check if a feature is enabled for a given context
 * Priority: user override > org override > plan override > default
 */
export async function isFeatureEnabled(flagKey, { userId = null, orgId = null, plan = 'free' } = {}) {
  const { flags, overrides } = await loadFlags();

  const flag = flags.find(f => f.flag_key === flagKey);
  if (!flag) {
    // Unknown flag — allow by default
    return true;
  }

  // Check user-level override (highest priority)
  if (userId) {
    const userOverride = overrides.find(
      o => o.flag_key === flagKey && o.scope_type === 'user' && o.scope_value === String(userId)
    );
    if (userOverride) return userOverride.enabled;
  }

  // Check org-level override
  if (orgId) {
    const orgOverride = overrides.find(
      o => o.flag_key === flagKey && o.scope_type === 'org' && o.scope_value === String(orgId)
    );
    if (orgOverride) return orgOverride.enabled;
  }

  // Check plan-level override
  if (plan) {
    const planOverride = overrides.find(
      o => o.flag_key === flagKey && o.scope_type === 'plan' && o.scope_value === plan
    );
    if (planOverride) return planOverride.enabled;
  }

  return flag.default_enabled;
}

/**
 * Get all flags with their effective state for a given context
 */
export async function getAllFlagsForContext({ userId = null, orgId = null, plan = 'free' } = {}) {
  const { flags } = await loadFlags();

  const result = [];
  for (const flag of flags) {
    const enabled = await isFeatureEnabled(flag.flag_key, { userId, orgId, plan });
    result.push({
      ...flag,
      effective_enabled: enabled,
    });
  }
  return result;
}

/**
 * Get all flags with all overrides (admin view)
 */
export async function getAllFlagsAdmin() {
  const { flags, overrides } = await loadFlags();

  return flags.map(flag => ({
    ...flag,
    overrides: overrides.filter(o => o.flag_key === flag.flag_key),
  }));
}

/**
 * Set an override for a flag
 */
export async function setFlagOverride(flagKey, scopeType, scopeValue, enabled, setBy) {
  const { v4: uuidv4 } = await import('uuid');
  const flag = await db.prepare(
    'SELECT id FROM feature_flags WHERE flag_key = ?'
  ).get(flagKey);

  if (!flag) {
    throw new Error(`Feature flag '${flagKey}' not found`);
  }

  // Upsert
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO feature_flag_overrides (id, flag_id, scope_type, scope_value, enabled, set_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (flag_id, scope_type, scope_value)
    DO UPDATE SET enabled = ?, set_by = ?, created_at = ?
  `).run(
    uuidv4(), flag.id, scopeType, String(scopeValue), enabled, setBy, now,
    enabled, setBy, now
  );

  invalidateFlagCache();
  logger.info(`[FEATURE_FLAGS] Override set: ${flagKey} → ${enabled} for ${scopeType}=${scopeValue}`);
}

/**
 * Remove an override
 */
export async function removeFlagOverride(flagKey, scopeType, scopeValue) {
  const flag = await db.prepare(
    'SELECT id FROM feature_flags WHERE flag_key = ?'
  ).get(flagKey);

  if (!flag) return;

  await db.prepare(`
    DELETE FROM feature_flag_overrides
    WHERE flag_id = ? AND scope_type = ? AND scope_value = ?
  `).run(flag.id, scopeType, String(scopeValue));

  invalidateFlagCache();
}

/**
 * Create a new feature flag
 */
export async function createFlag({ flagKey, displayName, description, category, defaultEnabled }) {
  const { v4: uuidv4 } = await import('uuid');
  await db.prepare(`
    INSERT INTO feature_flags (id, flag_key, display_name, description, category, default_enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(), flagKey, displayName, description || '', category || 'service',
    defaultEnabled !== false, new Date().toISOString(), new Date().toISOString()
  );

  invalidateFlagCache();
}

/**
 * Update a feature flag's default
 */
export async function updateFlagDefault(flagKey, defaultEnabled) {
  await db.prepare(`
    UPDATE feature_flags SET default_enabled = ?, updated_at = ? WHERE flag_key = ?
  `).run(defaultEnabled, new Date().toISOString(), flagKey);

  invalidateFlagCache();
}
