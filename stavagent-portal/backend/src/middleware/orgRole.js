/**
 * Organization Role Middleware
 * Checks that the authenticated user has one of the required org roles.
 * Must be used AFTER requireAuth middleware.
 *
 * @example
 * router.delete('/:id', requireAuth, requireOrgRole('admin'), handler)
 * router.post('/:id/invite', requireAuth, requireOrgRole('admin', 'manager'), handler)
 */

import { logger } from '../utils/logger.js';
import { getPool } from '../db/postgres.js';
import { USE_POSTGRES } from '../db/index.js';
import db from '../db/index.js';

/**
 * Require the caller to be an active org member with one of the allowed roles.
 * Sets req.orgRole to the member's current role.
 *
 * orgId is resolved from (in order):
 *   1. req.params.id
 *   2. req.body.org_id
 *   3. req.query.org_id
 */
export function requireOrgRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Chybí autentizace' });
      }

      const orgId = req.params.id || req.body.org_id || req.query.org_id;
      if (!orgId) {
        return res.status(400).json({ error: 'org_id is required' });
      }

      const member = await db.prepare(`
        SELECT role FROM org_members
        WHERE org_id = ? AND user_id = ? AND joined_at IS NOT NULL
      `).get(orgId, req.user.userId);

      if (!member) {
        logger.warn(`User ${req.user.userId} is not a member of org ${orgId}`);
        return res.status(403).json({ error: 'Not a member of this organization' });
      }

      if (!allowedRoles.includes(member.role)) {
        logger.warn(`User ${req.user.userId} has role '${member.role}' but needs one of [${allowedRoles.join(', ')}] for ${req.method} ${req.path}`);
        return res.status(403).json({
          error: 'Insufficient role',
          required: allowedRoles,
          actual: member.role
        });
      }

      req.orgRole = member.role;
      next();
    } catch (error) {
      logger.error('orgRole middleware error:', error);
      return res.status(500).json({ error: 'Internal Server Error', message: 'Chyba při kontrole práv' });
    }
  };
}
