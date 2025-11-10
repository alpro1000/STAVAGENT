/**
 * OTSKP codes API routes
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db } from '../db/init.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse OTSKP XML file using regex
 */
function parseOtskpXml(xmlContent) {
  const items = [];
  const errors = [];
  let validCount = 0;
  let invalidCount = 0;

  xmlContent = xmlContent.replace(/^\uFEFF/, '');
  const polozkaRegex = /<Polozka>([\s\S]*?)<\/Polozka>/g;
  const matches = xmlContent.matchAll(polozkaRegex);

  for (const match of matches) {
    const polozkaContent = match[1];
    const codeMatch = polozkaContent.match(/<znacka>(.*?)<\/znacka>/);
    const nameMatch = polozkaContent.match(/<nazev>(.*?)<\/nazev>/);
    const unitMatch = polozkaContent.match(/<MJ>(.*?)<\/MJ>/);
    const priceMatch = polozkaContent.match(/<jedn_cena>(.*?)<\/jedn_cena>/);
    const specMatch = polozkaContent.match(/<technicka_specifikace>([\s\S]*?)<\/technicka_specifikace>/);

    if (!codeMatch || !codeMatch[1].trim()) {
      invalidCount++;
      errors.push(`Missing or empty code`);
      continue;
    }
    if (!nameMatch || !nameMatch[1].trim()) {
      invalidCount++;
      errors.push(`Missing name for code: ${codeMatch[1]}`);
      continue;
    }
    if (!unitMatch || !unitMatch[1].trim()) {
      invalidCount++;
      errors.push(`Missing unit for code: ${codeMatch[1]}`);
      continue;
    }
    if (!priceMatch || isNaN(parseFloat(priceMatch[1].trim()))) {
      invalidCount++;
      errors.push(`Invalid price for code: ${codeMatch[1]}`);
      continue;
    }

    items.push({
      code: codeMatch[1].trim(),
      name: nameMatch[1].trim(),
      unit: unitMatch[1].trim(),
      unit_price: parseFloat(priceMatch[1].trim()),
      specification: specMatch ? specMatch[1].trim() : null
    });
    validCount++;
  }

  return { items, validCount, invalidCount, errors };
}

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
 * GET /api/otskp/count
 * Get total count of OTSKP codes in database
 * Must be before /:code route to avoid being caught by catch-all pattern
 */
router.get('/count', (req, res) => {
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();
    res.json({
      count: result.count,
      message: result.count === 0 ? 'No OTSKP codes loaded. Use POST /api/otskp/import to load them.' : 'OTSKP codes available'
    });
  } catch (error) {
    console.error('Error getting OTSKP count:', error);
    res.status(500).json({ error: 'Failed to get OTSKP count' });
  }
});

/**
 * GET /api/otskp/stats
 * Get OTSKP database statistics
 * Must be before /:code route to avoid being caught by catch-all pattern
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

/**
 * GET /api/otskp/:code
 * Get specific OTSKP code by exact code
 * Must be last to avoid catching other routes
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
 * POST /api/otskp/import
 * Import OTSKP codes from XML file
 * Authorization required via OTSKP_IMPORT_TOKEN env variable
 */
router.post('/import', (req, res) => {
  try {
    // Check authorization token - fail closed if env var not set
    const expectedToken = process.env.OTSKP_IMPORT_TOKEN;

    if (!expectedToken) {
      console.error('[OTSKP Import] Missing OTSKP_IMPORT_TOKEN environment variable');
      return res.status(401).json({ error: 'OTSKP import endpoint not configured. Set OTSKP_IMPORT_TOKEN environment variable.' });
    }

    const token = req.headers['x-import-token'];

    if (!token || token !== expectedToken) {
      console.log('[OTSKP Import] Unauthorized import attempt with token:', token ? 'provided but invalid' : 'missing');
      return res.status(401).json({ error: 'Unauthorized - invalid or missing X-Import-Token header' });
    }

    console.log('[OTSKP Import] Starting import...');

    // Find OTSKP XML file
    const possiblePaths = [
      path.join(__dirname, '../../2025_03 OTSKP.xml'),  // Local dev
      path.join(__dirname, '../../../2025_03 OTSKP.xml'), // Production
      '/app/2025_03 OTSKP.xml', // Render absolute
      process.cwd() + '/2025_03 OTSKP.xml' // Current working directory
    ];

    let xmlPath = null;
    let xmlContent = null;

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        xmlPath = p;
        console.log('[OTSKP Import] Found OTSKP XML at:', p);
        try {
          xmlContent = fs.readFileSync(p, 'utf-8');
          console.log('[OTSKP Import] Read file size:', (xmlContent.length / 1024 / 1024).toFixed(2), 'MB');
          break;
        } catch (err) {
          console.log('[OTSKP Import] Error reading file:', err.message);
        }
      }
    }

    if (!xmlContent) {
      console.error('[OTSKP Import] OTSKP XML file not found in any location');
      return res.status(404).json({
        error: 'OTSKP XML file not found',
        tried: possiblePaths
      });
    }

    // Parse XML
    console.log('[OTSKP Import] Parsing XML...');
    const { items, validCount, invalidCount, errors } = parseOtskpXml(xmlContent);
    console.log('[OTSKP Import] Parsed:', { validCount, invalidCount, total: items.length });

    // Clear existing codes
    console.log('[OTSKP Import] Clearing existing codes...');
    db.prepare('DELETE FROM otskp_codes').run();

    // Insert new codes
    console.log('[OTSKP Import] Inserting', items.length, 'codes...');
    const insertStmt = db.prepare(`
      INSERT INTO otskp_codes (code, name, unit, unit_price, specification)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertStmt.run(
          item.code,
          item.name,
          item.unit,
          item.unit_price,
          item.specification
        );
      }
    });

    insertMany(items);

    // Verify import
    const verifyStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT unit) as unique_units,
        MIN(unit_price) as min_price,
        MAX(unit_price) as max_price,
        AVG(unit_price) as avg_price
      FROM otskp_codes
    `).get();

    console.log('[OTSKP Import] Verification:', verifyStats);

    res.json({
      success: true,
      message: 'OTSKP codes imported successfully',
      stats: {
        imported: items.length,
        valid: validCount,
        invalid: invalidCount,
        totalInDB: verifyStats.total,
        uniqueUnits: verifyStats.unique_units,
        priceRange: {
          min: verifyStats.min_price,
          max: verifyStats.max_price,
          avg: verifyStats.avg_price
        }
      }
    });

  } catch (error) {
    console.error('[OTSKP Import] Error:', error);
    res.status(500).json({ error: 'Failed to import OTSKP codes', details: error.message });
  }
});

export default router;
