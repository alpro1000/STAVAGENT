/**
 * Organizations routes
 *
 * POST   /api/orgs                        — Create org (caller becomes admin)
 * GET    /api/orgs                        — List my orgs
 * GET    /api/orgs/:id                    — Org details + members
 * PATCH  /api/orgs/:id                    — Update name/slug (admin)
 * DELETE /api/orgs/:id                    — Soft-delete (admin)
 * POST   /api/orgs/:id/invite             — Send invite (admin, manager)
 * GET    /api/orgs/:id/members            — List members with roles
 * PATCH  /api/orgs/:id/members/:userId    — Change member role (admin)
 * DELETE /api/orgs/:id/members/:userId    — Remove member (admin)
 * POST   /api/orgs/accept-invite          — Accept invitation by token
 */

import express from 'express';
import { randomUUID, createHash } from 'crypto';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { requireOrgRole } from '../middleware/orgRole.js';
import { sendEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// POST /api/orgs — Create organization
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, slug } = req.body;
    const userId = req.user.userId;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Auto-generate slug if not provided
    const rawSlug = slug
      ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (!rawSlug || rawSlug.length < 2) {
      return res.status(400).json({ error: 'slug must be at least 2 characters (letters, numbers, hyphens)' });
    }

    // Check slug uniqueness
    const existing = await db.prepare('SELECT id FROM organizations WHERE slug = ?').get(rawSlug);
    if (existing) {
      return res.status(409).json({ error: `Slug '${rawSlug}' is already taken` });
    }

    // Create organization
    const orgId = randomUUID();
    await db.prepare(`
      INSERT INTO organizations (id, name, slug, owner_id, plan, max_projects, max_storage_gb, max_team_members)
      VALUES (?, ?, ?, ?, 'free', 5, 1.0, 1)
    `).run(orgId, name.trim(), rawSlug, userId);

    // Add owner as admin member
    const memberId = randomUUID();
    await db.prepare(`
      INSERT INTO org_members (id, org_id, user_id, role, invited_by, joined_at)
      VALUES (?, ?, ?, 'admin', ?, NOW())
    `).run(memberId, orgId, userId, userId);

    const org = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);

    logger.info(`Org created: ${name} (${orgId}) by user ${userId}`);
    res.status(201).json({ success: true, org });
  } catch (error) {
    logger.error('Create org error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists' });
    }
    res.status(500).json({ error: 'Server error creating organization' });
  }
});

// GET /api/orgs — List orgs where the user is an active member
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const orgs = await db.prepare(`
      SELECT o.*, m.role AS my_role, m.joined_at AS my_joined_at
      FROM org_members m
      JOIN organizations o ON o.id = m.org_id
      WHERE m.user_id = ? AND m.joined_at IS NOT NULL AND o.is_active = true
      ORDER BY o.created_at DESC
    `).all(userId);

    res.json({ success: true, orgs });
  } catch (error) {
    logger.error('List orgs error:', error);
    res.status(500).json({ error: 'Server error listing organizations' });
  }
});

// GET /api/orgs/:id — Org details (any member)
router.get('/:id', requireAuth, requireOrgRole('admin', 'manager', 'estimator', 'viewer', 'api_client'), async (req, res) => {
  try {
    const org = await db.prepare('SELECT * FROM organizations WHERE id = ? AND is_active = true').get(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const members = await db.prepare(`
      SELECT m.id, m.user_id, m.role, m.invited_at, m.joined_at,
             u.name, u.email, u.avatar_url
      FROM org_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ? AND m.joined_at IS NOT NULL
      ORDER BY m.joined_at
    `).all(req.params.id);

    res.json({ success: true, org, members });
  } catch (error) {
    logger.error('Get org error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/orgs/:id — Update org name/slug (admin only)
router.patch('/:id', requireAuth, requireOrgRole('admin'), async (req, res) => {
  try {
    const { name, slug } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'name must be non-empty' });
      }
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (slug !== undefined) {
      const rawSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const existing = await db.prepare('SELECT id FROM organizations WHERE slug = ? AND id != ?').get(rawSlug, req.params.id);
      if (existing) return res.status(409).json({ error: `Slug '${rawSlug}' is already taken` });
      updates.push('slug = ?');
      values.push(rawSlug);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    updates.push('updated_at = NOW()');
    values.push(req.params.id);

    await db.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const updated = await db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id);
    res.json({ success: true, org: updated });
  } catch (error) {
    logger.error('Update org error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orgs/:id — Soft-delete (admin only)
router.delete('/:id', requireAuth, requireOrgRole('admin'), async (req, res) => {
  try {
    // Only owner can delete
    const org = await db.prepare('SELECT owner_id FROM organizations WHERE id = ?').get(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (org.owner_id !== req.user.userId) {
      return res.status(403).json({ error: 'Only the org owner can delete the organization' });
    }

    await db.prepare(`UPDATE organizations SET is_active = false, updated_at = NOW() WHERE id = ?`).run(req.params.id);
    logger.info(`Org ${req.params.id} soft-deleted by user ${req.user.userId}`);
    res.json({ success: true, message: 'Organization deleted' });
  } catch (error) {
    logger.error('Delete org error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orgs/:id/invite — Invite user by email (admin, manager)
router.post('/:id/invite', requireAuth, requireOrgRole('admin', 'manager'), async (req, res) => {
  try {
    const { email, role } = req.body;
    const orgId = req.params.id;

    if (!email) return res.status(400).json({ error: 'email is required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    const allowedRoles = ['manager', 'estimator', 'viewer', 'api_client'];
    const memberRole = role && allowedRoles.includes(role) ? role : 'estimator';

    // Managers cannot invite admins
    if (role === 'admin' && req.orgRole === 'manager') {
      return res.status(403).json({ error: 'Managers cannot invite admins' });
    }

    const org = await db.prepare('SELECT name FROM organizations WHERE id = ? AND is_active = true').get(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Find or prepare the invited user
    const invitedUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);

    if (invitedUser) {
      // Check if already a member
      const existing = await db.prepare('SELECT id, joined_at FROM org_members WHERE org_id = ? AND user_id = ?').get(orgId, invitedUser.id);
      if (existing && existing.joined_at) {
        return res.status(409).json({ error: 'User is already a member of this organization' });
      }
    }

    // Generate invite token
    const tokenString = randomUUID();
    const tokenHash = createHash('sha256').update(tokenString).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    if (invitedUser) {
      // Upsert member record with pending invite
      const existingMember = await db.prepare('SELECT id FROM org_members WHERE org_id = ? AND user_id = ?').get(orgId, invitedUser.id);
      if (existingMember) {
        await db.prepare(`
          UPDATE org_members SET role = ?, invited_by = ?, invited_at = NOW(),
            joined_at = NULL, invite_token_hash = ?, invite_expires_at = ?
          WHERE org_id = ? AND user_id = ?
        `).run(memberRole, req.user.userId, tokenHash, expiresAt.toISOString(), orgId, invitedUser.id);
      } else {
        await db.prepare(`
          INSERT INTO org_members (id, org_id, user_id, role, invited_by, invited_at, invite_token_hash, invite_expires_at)
          VALUES (?, ?, ?, ?, ?, NOW(), ?, ?)
        `).run(randomUUID(), orgId, invitedUser.id, memberRole, req.user.userId, tokenHash, expiresAt.toISOString());
      }
    } else {
      // User doesn't exist yet — store email as placeholder in member record
      // We can't reference users table without a valid user_id, so just log it
      // In a real flow, the invite email contains the token, user registers, then accepts
      logger.info(`Invite sent to non-registered email ${email} for org ${orgId}`);
    }

    // Send invite email (best-effort)
    try {
      const inviterUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.userId);
      const inviteUrl = `${process.env.FRONTEND_URL || 'https://www.stavagent.cz'}/org/accept-invite?token=${tokenString}`;
      await sendEmail({
        to: email,
        subject: `Pozvánka do organizace ${org.name} — StavAgent`,
        html: `
          <p>Dobrý den,</p>
          <p><strong>${inviterUser?.name || 'Člen týmu'}</strong> vás zve do organizace <strong>${org.name}</strong> na platformě StavAgent.</p>
          <p>Vaše role: <strong>${memberRole}</strong></p>
          <p><a href="${inviteUrl}" style="background:#FF9F1C;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none">Přijmout pozvánku</a></p>
          <p>Odkaz je platný 7 dní.</p>
          <p style="color:#888;font-size:12px">StavAgent — stavební platforma</p>
        `
      });
    } catch (emailErr) {
      logger.warn(`Failed to send invite email to ${email}:`, emailErr.message);
    }

    logger.info(`Invite sent to ${email} for org ${orgId} by user ${req.user.userId}`);
    res.json({ success: true, message: `Pozvánka odeslána na ${email}`, token: tokenString });
  } catch (error) {
    logger.error('Invite error:', error);
    res.status(500).json({ error: 'Server error sending invite' });
  }
});

// GET /api/orgs/:id/members — List members (any active member)
router.get('/:id/members', requireAuth, requireOrgRole('admin', 'manager', 'estimator', 'viewer', 'api_client'), async (req, res) => {
  try {
    const members = await db.prepare(`
      SELECT m.id, m.user_id, m.role, m.invited_at, m.joined_at,
             u.name, u.email, u.avatar_url
      FROM org_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ?
      ORDER BY m.joined_at NULLS LAST, m.invited_at DESC
    `).all(req.params.id);

    res.json({ success: true, members });
  } catch (error) {
    logger.error('List members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/orgs/:id/members/:userId — Change role (admin only)
router.patch('/:id/members/:userId', requireAuth, requireOrgRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['admin', 'manager', 'estimator', 'viewer', 'api_client'];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(', ')}` });
    }

    const targetUserId = parseInt(req.params.userId, 10);

    // Prevent changing the org owner's role
    const org = await db.prepare('SELECT owner_id FROM organizations WHERE id = ?').get(req.params.id);
    if (org && org.owner_id === targetUserId) {
      return res.status(403).json({ error: 'Cannot change the role of the organization owner' });
    }

    const result = await db.prepare(`
      UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?
    `).run(role, req.params.id, targetUserId);

    if (!result.changes) return res.status(404).json({ error: 'Member not found' });

    logger.info(`Role changed for user ${targetUserId} in org ${req.params.id} to ${role} by ${req.user.userId}`);
    res.json({ success: true, message: 'Role updated' });
  } catch (error) {
    logger.error('Change role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orgs/:id/members/:userId — Remove member (admin only)
router.delete('/:id/members/:userId', requireAuth, requireOrgRole('admin'), async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId, 10);

    // Cannot remove the owner
    const org = await db.prepare('SELECT owner_id FROM organizations WHERE id = ?').get(req.params.id);
    if (org && org.owner_id === targetUserId) {
      return res.status(403).json({ error: 'Cannot remove the organization owner' });
    }

    // Cannot remove self if only admin
    if (targetUserId === req.user.userId) {
      return res.status(403).json({ error: 'Cannot remove yourself from the organization' });
    }

    await db.prepare('DELETE FROM org_members WHERE org_id = ? AND user_id = ?').run(req.params.id, targetUserId);
    logger.info(`Member ${targetUserId} removed from org ${req.params.id} by ${req.user.userId}`);
    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    logger.error('Remove member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orgs/accept-invite — Accept invitation by token
router.post('/accept-invite', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const userId = req.user.userId;

    const member = await db.prepare(`
      SELECT m.id, m.org_id, m.user_id, m.role, m.invite_expires_at
      FROM org_members m
      WHERE m.invite_token_hash = ? AND m.joined_at IS NULL
    `).get(tokenHash);

    if (!member) {
      return res.status(400).json({ error: 'Invalid or expired invite token' });
    }

    if (new Date(member.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invite token has expired' });
    }

    // Only the invited user can accept (by matching user_id set when invite was created)
    if (member.user_id !== userId) {
      return res.status(403).json({ error: 'This invite was sent to a different account' });
    }

    await db.prepare(`
      UPDATE org_members
      SET joined_at = NOW(), invite_token_hash = NULL, invite_expires_at = NULL
      WHERE id = ?
    `).run(member.id);

    const org = await db.prepare('SELECT id, name, slug, plan FROM organizations WHERE id = ?').get(member.org_id);

    logger.info(`User ${userId} accepted invite to org ${member.org_id} with role ${member.role}`);
    res.json({ success: true, message: 'Pozvánka přijata', org, role: member.role });
  } catch (error) {
    logger.error('Accept invite error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
