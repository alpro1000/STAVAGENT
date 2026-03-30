/**
 * Smlouvy API Routes
 *
 * Endpoints for Hlídač státu smlouvy collection and analysis.
 * Part of Stage 1-2 of the VZ Scraper / Work Packages pipeline.
 *
 * Attribution: "Zdroj: Hlídač státu (hlidacstatu.cz)" — CC BY 3.0 CZ
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger.js';
import { startCollection, getCollectionStatus, cancelCollection, getCollectionStats, ensureSchema } from '../../services/smlouvyCollector.js';
import { parsePlainTextContent, detectCodeSystem, classifyWorkType, normalizeMJ } from '../../services/smlouvyParser.js';
import { parseExcelFile } from '../../services/fileParser.js';
import HlidacSmlouvyClient from '../../services/hlidacSmlouvyClient.js';
import { getDatabase } from '../../db/init.js';

// Multer for xlsx upload (Task 6: local import)
const upload = multer({
  dest: 'data/uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.ods', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Nepodporovaný formát: ${ext}. Povolené: xlsx, xls, ods, csv.`));
    }
  },
});

const router = express.Router();

// ============================================================================
// Collection management
// ============================================================================

/**
 * POST /api/smlouvy/collect
 * Start a new collection run.
 * Body: { query?: string, maxPages?: number, skipExisting?: boolean }
 */
router.post('/collect', async (req, res) => {
  try {
    const { query, maxPages, skipExisting } = req.body || {};
    const result = await startCollection({ query, maxPages, skipExisting });
    res.json(result);
  } catch (err) {
    logger.error(`[SMLOUVY] /collect error: ${err.message}`);
    if (err.message.includes('already in progress')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message.includes('HLIDAC_API_TOKEN')) {
      return res.status(400).json({ error: 'HLIDAC_API_TOKEN not configured' });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/smlouvy/collect/status
 * Get current collection run status.
 */
router.get('/collect/status', (req, res) => {
  res.json(getCollectionStatus());
});

/**
 * POST /api/smlouvy/collect/cancel
 * Cancel running collection.
 */
router.post('/collect/cancel', (req, res) => {
  const cancelled = cancelCollection();
  res.json({ cancelled });
});

// ============================================================================
// Stats & data access
// ============================================================================

/**
 * GET /api/smlouvy/stats
 * Collection statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCollectionStats();
    res.json(stats);
  } catch (err) {
    logger.error(`[SMLOUVY] /stats error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/smlouvy/positions
 * Query collected positions with filters.
 * Query params: kod_system, typ_prace, kod_prefix, q (keyword search), limit, offset
 */
router.get('/positions', async (req, res) => {
  try {
    await ensureSchema();
    const db = await getDatabase();
    const { kod_system, typ_prace, kod_prefix, q, limit = 50, offset = 0 } = req.query;

    let where = [];
    let params = [];

    if (kod_system) {
      where.push('p.kod_system = ?');
      params.push(kod_system);
    }
    if (typ_prace) {
      where.push('p.typ_prace = ?');
      params.push(typ_prace);
    }
    if (kod_prefix) {
      where.push('p.kod_norm LIKE ?');
      params.push(kod_prefix + '%');
    }
    if (q) {
      where.push('p.popis LIKE ?');
      params.push(`%${q}%`);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    const limitVal = Math.min(parseInt(limit) || 50, 500);
    const offsetVal = parseInt(offset) || 0;

    const [positions, total] = await Promise.all([
      db.all(
        `SELECT p.*, s.predmet as source_predmet, s.rok, s.hodnota_czk
         FROM rozpocet_polozky p
         LEFT JOIN rozpocet_source s ON p.source_id = s.id
         ${whereClause}
         ORDER BY p.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limitVal, offsetVal]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM rozpocet_polozky p ${whereClause}`,
        params
      ),
    ]);

    res.json({
      positions,
      total: total.count,
      limit: limitVal,
      offset: offsetVal,
    });
  } catch (err) {
    logger.error(`[SMLOUVY] /positions error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/smlouvy/sources
 * List collected smlouvy sources.
 * Query params: parse_status, rok, limit, offset
 */
router.get('/sources', async (req, res) => {
  try {
    await ensureSchema();
    const db = await getDatabase();
    const { parse_status, rok, limit = 50, offset = 0 } = req.query;

    let where = [];
    let params = [];

    if (parse_status) {
      where.push('parse_status = ?');
      params.push(parse_status);
    }
    if (rok) {
      where.push('rok = ?');
      params.push(parseInt(rok));
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
    const limitVal = Math.min(parseInt(limit) || 50, 200);
    const offsetVal = parseInt(offset) || 0;

    const [sources, total] = await Promise.all([
      db.all(
        `SELECT * FROM rozpocet_source ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, limitVal, offsetVal]
      ),
      db.get(
        `SELECT COUNT(*) as count FROM rozpocet_source ${whereClause}`,
        params
      ),
    ]);

    res.json({
      sources,
      total: total.count,
      limit: limitVal,
      offset: offsetVal,
    });
  } catch (err) {
    logger.error(`[SMLOUVY] /sources error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Parse test endpoint (parse text directly, no API call)
// ============================================================================

/**
 * POST /api/smlouvy/parse-test
 * Parse a PlainTextContent sample for debugging/testing.
 * Body: { text: string }
 */
router.post('/parse-test', (req, res) => {
  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'text field required' });
  }

  const result = parsePlainTextContent(text);
  if (!result) {
    return res.json({ parsed: false, reason: 'Text too short or no parseable content' });
  }

  res.json({ parsed: true, ...result });
});

// ============================================================================
// Proxy search (for debugging — direct API call)
// ============================================================================

/**
 * GET /api/smlouvy/search
 * Proxy search to Hlídač státu (for testing/debug).
 * Query params: q (required), page (default 1)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'q parameter required' });
    }

    const client = new HlidacSmlouvyClient();
    if (!client.apiToken) {
      return res.status(400).json({ error: 'HLIDAC_API_TOKEN not configured' });
    }

    const result = await client.search(q, parseInt(page));
    res.json({
      total: result.Total,
      page: result.Page,
      results: (result.Results || []).map(s => ({
        id: s.Id || s.id,
        predmet: (s.predmet || s.Predmet || '').substring(0, 200),
        hodnota: s.hodnotaBezDph || s.HodnotaBezDph,
        datum: s.datumUzavreni || s.DatumUzavreni,
        prilohy_count: (s.prilohy || s.Prilohy || []).length,
        prilohy_with_text: (s.prilohy || s.Prilohy || [])
          .filter(p => (p.plainTextContent || p.PlainTextContent || '').length > 100).length,
      })),
      attribution: 'Zdroj: Hlídač státu (hlidacstatu.cz)',
    });
  } catch (err) {
    logger.error(`[SMLOUVY] /search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Local xlsx import (Task 6 — import local BOQ files)
// ============================================================================

/**
 * POST /api/smlouvy/import-xlsx
 * Import a local xlsx/xls/ods/csv file into rozpocet_source + rozpocet_polozky.
 * Multipart form-data: file (required), nazev (optional), rok (optional)
 */
router.post('/import-xlsx', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Soubor (file) je povinný' });
  }

  try {
    await ensureSchema();
    const db = await getDatabase();

    // Parse the uploaded file using existing fileParser
    const rows = await parseExcelFile(req.file.path);
    if (!rows || rows.length === 0) {
      return res.json({ success: false, positions: 0, reason: 'Soubor neobsahuje žádné položky' });
    }

    // Insert source
    const nazev = req.body?.nazev || req.file.originalname;
    const rok = req.body?.rok ? parseInt(req.body.rok) : new Date().getFullYear();

    const sourceResult = await db.run(
      `INSERT INTO rozpocet_source
        (source_type, nazev, predmet, rok, parse_status, polozek_count, format_hints)
       VALUES (?, ?, ?, ?, 'parsed', ?, ?)`,
      ['local', nazev, nazev, rok, rows.length, JSON.stringify(['local_import'])]
    );
    const sourceId = sourceResult.lastID;

    // Insert positions
    for (const row of rows) {
      const codeMatch = row.description?.match(/^(\d{6,9})\s/);
      const code = codeMatch ? codeMatch[1] : null;
      const { system: codeSystem, confidence: codeConf } = code
        ? detectCodeSystem(code) : { system: 'unknown', confidence: 0 };

      await db.run(
        `INSERT INTO rozpocet_polozky
          (source_id, kod_raw, popis, mj, mnozstvi, kod_norm, kod_prefix, kod_system, kod_system_conf, dil_6, typ_prace, source_file)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sourceId, code, row.description,
          normalizeMJ(row.unit) || row.unit, row.quantity,
          code, code?.substring(0, 3) || null,
          codeSystem, codeConf,
          code?.substring(0, 6) || null,
          classifyWorkType(row.description),
          req.file.originalname,
        ]
      );
    }

    res.json({
      success: true,
      source_id: sourceId,
      positions: rows.length,
      filename: req.file.originalname,
    });
  } catch (err) {
    logger.error(`[SMLOUVY] /import-xlsx error: ${err.message}`);
    res.status(500).json({ error: err.message });
  } finally {
    // Clean up uploaded file
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
  }
});

// ============================================================================
// VZ Enrichment (Stage 2.5 — CPV metadata from vvz.nipez.cz)
// ============================================================================

import { startVzCollection, getVzEnrichmentStatus, getVzStats } from '../../services/vzEnrichment.js';
import VvzClient from '../../services/vvzClient.js';

/**
 * POST /api/smlouvy/vz/collect
 * Start VZ metadata collection from vvz.nipez.cz.
 * Body: { cpv?: string, maxPages?: number }
 */
router.post('/vz/collect', async (req, res) => {
  try {
    const { cpv, maxPages } = req.body || {};
    const result = await startVzCollection({ cpv, maxPages });
    res.json(result);
  } catch (err) {
    logger.error(`[SMLOUVY] /vz/collect error: ${err.message}`);
    if (err.message.includes('already in progress')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/smlouvy/vz/status
 * VZ enrichment status.
 */
router.get('/vz/status', (req, res) => {
  res.json(getVzEnrichmentStatus());
});

/**
 * GET /api/smlouvy/vz/stats
 * VZ enrichment statistics.
 */
router.get('/vz/stats', async (req, res) => {
  try {
    const stats = await getVzStats();
    res.json(stats);
  } catch (err) {
    logger.error(`[SMLOUVY] /vz/stats error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/smlouvy/vz/search
 * Proxy search to vvz.nipez.cz for testing.
 * Query: cpv (default: 45), page, limit, formType
 */
router.get('/vz/search', async (req, res) => {
  try {
    const { cpv = '45', page = 1, limit = 20, formType = 'result' } = req.query;
    const client = new VvzClient();
    const result = await client.search({
      cpv,
      formType,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.json(result);
  } catch (err) {
    logger.error(`[SMLOUVY] /vz/search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
