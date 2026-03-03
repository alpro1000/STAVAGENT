/**
 * Relink API Routes
 * Endpoints for file version relink operations
 */

const express = require('express');
const router = express.Router();
const relinkService = require('../services/relinkService');
const db = require('../db');

/**
 * POST /api/relink/generate
 * Generate relink report for two file versions
 */
router.post('/generate', async (req, res) => {
  try {
    const { old_version_id, new_version_id } = req.body;

    if (!old_version_id || !new_version_id) {
      return res.status(400).json({
        error: 'Missing required fields: old_version_id, new_version_id'
      });
    }

    // Update status to in_progress
    await db.query(`
      UPDATE registry_file_versions
      SET relink_status = 'in_progress'
      WHERE id = $1
    `, [new_version_id]);

    // Generate report
    const report = await relinkService.generateRelinkReport(old_version_id, new_version_id);

    res.json({
      success: true,
      report_id: report.report_id,
      summary: report.summary
    });
  } catch (error) {
    console.error('Error generating relink report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/relink/reports/:id
 * Get relink report details
 */
router.get('/reports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        r.*,
        ov.version_number as old_version_number,
        nv.version_number as new_version_number,
        sf.file_name
      FROM registry_relink_reports r
      JOIN registry_file_versions ov ON r.old_version_id = ov.id
      JOIN registry_file_versions nv ON r.new_version_id = nv.id
      JOIN registry_source_files sf ON ov.source_file_id = sf.id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching relink report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/relink/reports/:id/apply
 * Apply relink - copy calculations from old to new positions
 */
router.post('/reports/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await relinkService.applyRelink(parseInt(id));

    res.json({
      success: true,
      applied: result.applied,
      message: `Successfully applied ${result.applied} matches`
    });
  } catch (error) {
    console.error('Error applying relink:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/relink/reports/:id/manual-match
 * Manual match - user overrides automatic matching
 */
router.post('/reports/:id/manual-match', async (req, res) => {
  try {
    const { id } = req.params;
    const { old_position_id, new_position_id } = req.body;

    if (!old_position_id || !new_position_id) {
      return res.status(400).json({
        error: 'Missing required fields: old_position_id, new_position_id'
      });
    }

    const result = await relinkService.manualMatch(
      parseInt(id),
      parseInt(old_position_id),
      parseInt(new_position_id)
    );

    res.json({
      success: true,
      message: 'Manual match applied successfully'
    });
  } catch (error) {
    console.error('Error applying manual match:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/relink/file-versions/:id/history
 * Get version history for a source file
 */
router.get('/file-versions/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        fv.*,
        COUNT(pi.id) as position_count
      FROM registry_file_versions fv
      LEFT JOIN registry_position_instances pi ON fv.id = pi.file_version_id
      WHERE fv.source_file_id = $1
      GROUP BY fv.id
      ORDER BY fv.version_number DESC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/relink/reports/:id/reject
 * Reject relink report
 */
router.post('/reports/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Get report to find new_version_id
    const reportResult = await db.query(`
      SELECT new_version_id FROM registry_relink_reports WHERE id = $1
    `, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const newVersionId = reportResult.rows[0].new_version_id;

    // Update relink status to failed
    await db.query(`
      UPDATE registry_file_versions
      SET relink_status = 'failed'
      WHERE id = $1
    `, [newVersionId]);

    // Update report
    await db.query(`
      UPDATE registry_relink_reports
      SET reviewed_at = NOW(),
          details = jsonb_set(details, '{rejection_reason}', $1::jsonb)
      WHERE id = $2
    `, [JSON.stringify(reason || 'Rejected by user'), id]);

    res.json({
      success: true,
      message: 'Relink report rejected'
    });
  } catch (error) {
    console.error('Error rejecting relink report:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
