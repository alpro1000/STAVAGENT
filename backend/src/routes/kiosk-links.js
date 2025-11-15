/**
 * Kiosk Links API Routes
 *
 * Manages the handshake protocol between Portal and Kiosk services.
 * Kiosks are specialized calculators (Monolit, Pump, Formwork, etc.)
 *
 * Routes:
 * - POST   /api/kiosk-links                    - Create kiosk link (handshake)
 * - GET    /api/kiosk-links/:linkId           - Get kiosk link details
 * - PUT    /api/kiosk-links/:linkId           - Update kiosk link
 * - DELETE /api/kiosk-links/:linkId           - Remove kiosk link
 * - POST   /api/kiosk-links/:linkId/sync      - Sync data with kiosk
 * - GET    /api/kiosk-links/by-kiosk/:kioskType/:kioskProjectId  - Get link by kiosk project ID
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/kiosk-links
 * Create kiosk link (handshake between Portal and Kiosk)
 *
 * Body:
 * - portal_project_id: string (required)
 * - kiosk_type: 'monolit' | 'pump' | 'formwork' | etc. (required)
 * - kiosk_project_id: string (required) - ID in the kiosk service
 * - handshake_data: object - Additional data from kiosk
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { portal_project_id, kiosk_type, kiosk_project_id, handshake_data } = req.body;

    // Validation
    if (!portal_project_id || !kiosk_type || !kiosk_project_id) {
      return res.status(400).json({
        success: false,
        error: 'portal_project_id, kiosk_type, and kiosk_project_id are required'
      });
    }

    // Check project ownership
    const projectCheck = await client.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1 AND owner_id = $2',
      [portal_project_id, userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Portal project not found'
      });
    }

    // Check if link already exists
    const existingLink = await client.query(
      `SELECT link_id FROM kiosk_links
       WHERE portal_project_id = $1 AND kiosk_type = $2 AND kiosk_project_id = $3`,
      [portal_project_id, kiosk_type, kiosk_project_id]
    );

    if (existingLink.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Kiosk link already exists'
      });
    }

    const link_id = `link_${uuidv4()}`;

    await client.query('BEGIN');

    // Create kiosk link
    const result = await client.query(
      `INSERT INTO kiosk_links (
        link_id,
        portal_project_id,
        kiosk_type,
        kiosk_project_id,
        status,
        handshake_data,
        created_at,
        last_sync
      ) VALUES ($1, $2, $3, $4, 'active', $5, NOW(), NOW())
      RETURNING *`,
      [
        link_id,
        portal_project_id,
        kiosk_type,
        kiosk_project_id,
        handshake_data ? JSON.stringify(handshake_data) : null
      ]
    );

    await client.query('COMMIT');

    console.log(`[KioskLinks] Created link: ${link_id} (Portal: ${portal_project_id} ↔ ${kiosk_type}: ${kiosk_project_id})`);

    res.status(201).json({
      success: true,
      link: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[KioskLinks] Error creating link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create kiosk link'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/kiosk-links/:linkId
 * Get kiosk link details
 */
router.get('/:linkId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { linkId } = req.params;

    const result = await pool.query(
      `SELECT kl.*
       FROM kiosk_links kl
       JOIN portal_projects pp ON kl.portal_project_id = pp.portal_project_id
       WHERE kl.link_id = $1 AND pp.owner_id = $2`,
      [linkId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kiosk link not found'
      });
    }

    res.json({
      success: true,
      link: result.rows[0]
    });

  } catch (error) {
    console.error('[KioskLinks] Error fetching link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch kiosk link'
    });
  }
});

/**
 * PUT /api/kiosk-links/:linkId
 * Update kiosk link
 *
 * Body:
 * - status: 'active' | 'inactive' | 'error'
 * - handshake_data: object
 */
router.put('/:linkId', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { linkId } = req.params;
    const { status, handshake_data } = req.body;

    // Check ownership
    const checkResult = await client.query(
      `SELECT kl.link_id
       FROM kiosk_links kl
       JOIN portal_projects pp ON kl.portal_project_id = pp.portal_project_id
       WHERE kl.link_id = $1 AND pp.owner_id = $2`,
      [linkId, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kiosk link not found'
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${valueIndex++}`);
      values.push(status);
    }
    if (handshake_data !== undefined) {
      updates.push(`handshake_data = $${valueIndex++}`);
      values.push(JSON.stringify(handshake_data));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push(`last_sync = NOW()`);
    values.push(linkId);

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE kiosk_links
       SET ${updates.join(', ')}
       WHERE link_id = $${valueIndex++}
       RETURNING *`,
      values
    );

    await client.query('COMMIT');

    console.log(`[KioskLinks] Updated link: ${linkId}`);

    res.json({
      success: true,
      link: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[KioskLinks] Error updating link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update kiosk link'
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/kiosk-links/:linkId
 * Remove kiosk link
 */
router.delete('/:linkId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { linkId } = req.params;

    const result = await pool.query(
      `DELETE FROM kiosk_links
       USING portal_projects pp
       WHERE kiosk_links.link_id = $1
         AND kiosk_links.portal_project_id = pp.portal_project_id
         AND pp.owner_id = $2
       RETURNING kiosk_links.link_id`,
      [linkId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kiosk link not found'
      });
    }

    console.log(`[KioskLinks] Deleted link: ${linkId}`);

    res.json({
      success: true,
      message: 'Kiosk link deleted successfully'
    });

  } catch (error) {
    console.error('[KioskLinks] Error deleting link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete kiosk link'
    });
  }
});

/**
 * POST /api/kiosk-links/:linkId/sync
 * Sync data with kiosk
 *
 * This endpoint can be called by either Portal or Kiosk to trigger
 * a data synchronization.
 *
 * Body:
 * - data: object - Data to sync
 */
router.post('/:linkId/sync', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { linkId } = req.params;
    const { data } = req.body;

    // Get link details
    const linkResult = await client.query(
      `SELECT kl.*, pp.owner_id
       FROM kiosk_links kl
       JOIN portal_projects pp ON kl.portal_project_id = pp.portal_project_id
       WHERE kl.link_id = $1`,
      [linkId]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kiosk link not found'
      });
    }

    const link = linkResult.rows[0];

    // Check ownership
    if (link.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await client.query('BEGIN');

    // Update sync timestamp and data
    const result = await client.query(
      `UPDATE kiosk_links
       SET handshake_data = $1,
           last_sync = NOW()
       WHERE link_id = $2
       RETURNING *`,
      [data ? JSON.stringify(data) : link.handshake_data, linkId]
    );

    await client.query('COMMIT');

    console.log(`[KioskLinks] Synced link: ${linkId}`);

    res.json({
      success: true,
      link: result.rows[0],
      message: 'Sync completed'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[KioskLinks] Error syncing link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync kiosk link'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/kiosk-links/by-kiosk/:kioskType/:kioskProjectId
 * Get kiosk link by kiosk project ID
 *
 * This allows kiosks to look up their portal_project_id
 * when they only have their own kiosk_project_id.
 */
router.get('/by-kiosk/:kioskType/:kioskProjectId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { kioskType, kioskProjectId } = req.params;

    const result = await pool.query(
      `SELECT kl.*, pp.project_name, pp.project_type
       FROM kiosk_links kl
       JOIN portal_projects pp ON kl.portal_project_id = pp.portal_project_id
       WHERE kl.kiosk_type = $1
         AND kl.kiosk_project_id = $2
         AND pp.owner_id = $3`,
      [kioskType, kioskProjectId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Kiosk link not found'
      });
    }

    res.json({
      success: true,
      link: result.rows[0]
    });

  } catch (error) {
    console.error('[KioskLinks] Error finding link by kiosk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find kiosk link'
    });
  }
});

export default router;
