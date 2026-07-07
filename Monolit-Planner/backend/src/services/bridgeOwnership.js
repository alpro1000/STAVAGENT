/**
 * Bridge ownership resolution + access checks (Sprint A, 2026-07).
 *
 * Positions and planner variants have no owner column of their own —
 * ownership is derived through the parent project keyed by bridge_id:
 *   - monolith_projects.portal_user_id (TEXT, migration 012) — preferred
 *   - bridges.owner_id (INTEGER, isolation-hotfix) — fallback
 *
 * Access rules mirror monolith-projects.js (the isolation-model pattern):
 *   - owner NULL (legacy kiosk rows): reads open to anyone; writes allowed
 *     for anonymous callers too (legacy kiosk mode kept alive)
 *   - owner set: caller's JWT userId must match — otherwise 403
 *     (anonymous callers never match an owned row)
 */

import db from '../db/init.js';
import { logger } from '../utils/logger.js';

/**
 * Resolve the effective owner of a bridge/project id.
 * @returns {Promise<{exists: boolean, owner: string|null}>} owner as TEXT
 */
export async function getBridgeOwner(bridgeId) {
  const mp = await db.prepare(
    'SELECT portal_user_id FROM monolith_projects WHERE project_id = ?'
  ).get(bridgeId);
  const br = await db.prepare(
    'SELECT owner_id FROM bridges WHERE bridge_id = ?'
  ).get(bridgeId);

  if (!mp && !br) return { exists: false, owner: null };

  const owner =
    (mp?.portal_user_id != null ? String(mp.portal_user_id) : null) ??
    (br?.owner_id != null ? String(br.owner_id) : null);

  return { exists: true, owner };
}

/**
 * Check whether the request may READ rows under this owner.
 * NULL owner = legacy kiosk row → open. Owned → JWT userId must match.
 */
export function canReadOwned(req, owner) {
  if (owner == null) return true;
  const userId = req.user?.userId != null ? String(req.user.userId) : null;
  return userId === owner;
}

/**
 * Check whether the request may WRITE rows under this owner.
 * Same rule as reads (monolith-projects.js precedent: anonymous writes
 * survive only on legacy NULL-owner rows; owned rows require the owner).
 */
export function canWriteOwned(req, owner) {
  return canReadOwned(req, owner);
}

/**
 * Express helper: resolve bridge owner and enforce access in one call.
 * Sends 403 and returns null when access is denied; otherwise returns
 * { exists, owner }. Missing bridge is NOT an error here — callers
 * decide (GET may 404, POST may auto-create).
 */
export async function assertBridgeAccess(req, res, bridgeId, { write = false } = {}) {
  const info = await getBridgeOwner(bridgeId);
  const allowed = write ? canWriteOwned(req, info.owner) : canReadOwned(req, info.owner);
  if (!allowed) {
    logger.warn(
      `[Ownership] ${write ? 'Write' : 'Read'} denied on bridge ${bridgeId} ` +
      `(owner=${info.owner}, caller=${req.user?.userId ?? 'anonymous'}, ${req.method} ${req.originalUrl})`
    );
    res.status(403).json({ error: 'Forbidden', message: 'Nemáte přístup k tomuto projektu' });
    return null;
  }
  return info;
}
