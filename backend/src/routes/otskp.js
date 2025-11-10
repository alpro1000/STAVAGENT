/**
 * OTSKP codes API routes
 */

import express from 'express';
import { db } from '../db/init.js';

const router = express.Router();

/**
 * GET /api/otskp/search
 * Search OTSKP codes by code or name
 * Query params:
 *   - q: search query (code or name)
 *   - limit: max results (default 20, max 100)
 */
router.get('/search', (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    console.log('[OTSKP Search] Received request:', { q, limit });

    if (!q || q.trim().length < 2) {
      console.log('[OTSKP Search] Query too short:', q);
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchLimit = Math.min(parseInt(limit) || 20, 100);
    const searchQuery = q.trim();
    const searchQueryUpper = searchQuery.toUpperCase();
    console.log('[OTSKP Search] Searching for:', { searchQuery, searchQueryUpper, limit: searchLimit });

    // Search by code (exact or prefix) or name (LIKE)
    // Using UPPER() to make search case-insensitive for UTF-8 characters (Czech diacritics)
    const results = db.prepare(`
      SELECT code, name, unit, unit_price, specification
      FROM otskp_codes
      WHERE UPPER(code) LIKE ? OR UPPER(name) LIKE ?
      ORDER BY
        CASE
          WHEN UPPER(code) = ? THEN 0
          WHEN UPPER(code) LIKE ? THEN 1
          ELSE 2
        END,
        code
      LIMIT ?
    `).all(
      `${searchQueryUpper}%`,           // code prefix (case-insensitive)
      `%${searchQueryUpper}%`,          // name contains (case-insensitive)
      searchQueryUpper,                 // exact code match (case-insensitive)
      `${searchQueryUpper}%`,           // code prefix (for sorting, case-insensitive)
      searchLimit
    );

    console.log('[OTSKP Search] Found results:', results.length);
    res.json({
      query: searchQuery,
      count: results.length,
      results
    });

  } catch (error) {
    console.error('[OTSKP Search] Error:', error);
    res.status(500).json({ error: 'Failed to search OTSKP codes' });
  }
});

/**
 * GET /api/otskp/:code
 * Get specific OTSKP code by exact code
 */
router.get('/:code', (req, res) => {
  try {
    const { code } = req.params;

    const result = db.prepare(`
      SELECT code, name, unit, unit_price, specification
      FROM otskp_codes
      WHERE code = ?
    `).get(code);

    if (!result) {
      return res.status(404).json({ error: 'OTSKP code not found' });
    }

    res.json(result);

  } catch (error) {
    console.error('Error fetching OTSKP code:', error);
    res.status(500).json({ error: 'Failed to fetch OTSKP code' });
  }
});

/**
 * GET /api/otskp/stats
 * Get OTSKP database statistics
 */
router.get('/stats/summary', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_codes,
        COUNT(DISTINCT unit) as unique_units,
        AVG(unit_price) as avg_price,
        MIN(unit_price) as min_price,
        MAX(unit_price) as max_price
      FROM otskp_codes
    `).get();

    const unitStats = db.prepare(`
      SELECT unit, COUNT(*) as count
      FROM otskp_codes
      GROUP BY unit
      ORDER BY count DESC
      LIMIT 10
    `).all();

    res.json({
      summary: stats,
      top_units: unitStats
    });

  } catch (error) {
    console.error('Error fetching OTSKP stats:', error);
    res.status(500).json({ error: 'Failed to fetch OTSKP stats' });
  }
});

export default router;
