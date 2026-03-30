/**
 * Catalog Routes
 * Access to URS items catalog + Perplexity URS harvester + detail fetching
 */

import express from 'express';
import { getDatabase } from '../../db/init.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

// URS detail page URL pattern
const URS_DETAIL_URL = 'https://podminky.urs.cz/item/CS_URS_2025_02';

/**
 * Fetch full description from podminky.urs.cz for a given URS code.
 * Parses the HTML page to extract the full description (PP).
 * Caches result in SQLite to avoid repeated fetches.
 */
async function fetchUrsDetail(code) {
  const url = `${URS_DETAIL_URL}/${code}`;
  logger.info(`[CATALOG] Fetching URS detail from ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StavAgent/1.0 (construction cost estimator)',
        'Accept': 'text/html',
        'Accept-Language': 'cs'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn(`[CATALOG] podminky.urs.cz returned ${response.status} for ${code}`);
      return null;
    }

    const html = await response.text();

    // Extract item name from <h1> or <title>
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;

    // Extract full description (PP) — usually in a <div> or <p> with class containing "description" or "detail"
    // Pattern 1: look for "Popis" section
    const descMatch = html.match(/(?:Popis|Podmínky)[^<]*<\/[^>]+>\s*(?:<[^>]+>)*([\s\S]*?)(?:<\/(?:div|section|p)>)/i);
    // Pattern 2: look for long text blocks that look like descriptions
    const longTextMatch = html.match(/<(?:p|div)[^>]*class="[^"]*(?:desc|detail|content)[^"]*"[^>]*>([\s\S]*?)<\/(?:p|div)>/i);
    // Pattern 3: any paragraph with substantial text
    const paraMatch = html.match(/<p[^>]*>([\s\S]{50,500}?)<\/p>/i);

    let fullDescription = null;
    for (const match of [descMatch, longTextMatch, paraMatch]) {
      if (match) {
        const text = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (text.length > 20) {
          fullDescription = text;
          break;
        }
      }
    }

    // Extract unit (MJ)
    const unitMatch = html.match(/(?:Měrná jednotka|MJ)[^<]*<\/[^>]+>\s*(?:<[^>]+>)*\s*([^<]{1,10})/i);
    const unit = unitMatch ? unitMatch[1].trim() : null;

    return {
      title: title || null,
      full_description: fullDescription || null,
      unit: unit || null,
      url,
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      logger.warn(`[CATALOG] Timeout fetching ${url}`);
    } else {
      logger.error(`[CATALOG] Error fetching ${url}: ${error.message}`);
    }
    return null;
  }
}

// ============================================================================
// PERPLEXITY URS HARVESTER (runs on Cloud Run where PPLX_API_KEY is available)
// ============================================================================

const HARVEST_CATEGORIES = [
  { code: '1', name: 'Zemní práce', queries: ['výkopy', 'zásypy', 'přemístění zemin', 'hloubení rýh', 'svahování'] },
  { code: '2', name: 'Zakládání', queries: ['základy beton', 'základové pasy', 'základové patky', 'piloty', 'štětové stěny', 'injektáž'] },
  { code: '3', name: 'Svislé konstrukce', queries: ['zdivo', 'příčky', 'překlady', 'monolitické stěny', 'obezdívky'] },
  { code: '4', name: 'Vodorovné konstrukce', queries: ['stropy', 'překlady', 'schodiště', 'monolitické desky', 'nosníky', 'věnce'] },
  { code: '5', name: 'Komunikace', queries: ['vozovky', 'chodníky', 'dlažba', 'obrubníky', 'asfalt', 'kolejový svršek'] },
  { code: '6', name: 'Úpravy povrchů', queries: ['omítky', 'obklady', 'nátěry', 'malby', 'stěrky', 'spárování'] },
  { code: '8', name: 'Trubní vedení', queries: ['kanalizace', 'vodovod', 'plynovod', 'potrubí PE', 'šachty', 'armatury'] },
  { code: '9', name: 'Ostatní konstrukce', queries: ['lešení', 'bourání', 'demolice', 'přesun hmot', 'čerpání vody', 'staveništní'] },
  { code: '711', name: 'Izolace proti vodě', queries: ['hydroizolace', 'asfaltové pásy', 'fólie PVC', 'nátěry izolační'] },
  { code: '712', name: 'Povlakové krytiny', queries: ['střešní krytina', 'asfaltové pásy střecha', 'fólie střešní', 'oplechování'] },
  { code: '713', name: 'Izolace tepelné', queries: ['tepelná izolace', 'polystyren EPS', 'minerální vata', 'XPS', 'PIR desky'] },
  { code: '721', name: 'Vnitřní kanalizace', queries: ['odpady', 'odpadní potrubí', 'zápachové uzávěrky', 'svislé odpady HT'] },
  { code: '722', name: 'Vnitřní vodovod', queries: ['rozvody vody', 'potrubí PPR', 'vodoměr', 'přípojky vody'] },
  { code: '725', name: 'Zařizovací předměty', queries: ['umyvadlo', 'WC', 'vana', 'sprchový kout', 'dřez', 'baterie'] },
  { code: '731', name: 'Ústřední vytápění - kotelny', queries: ['kotel', 'plynový kotel', 'tepelné čerpadlo', 'kotelna'] },
  { code: '733', name: 'Ústřední vytápění - potrubí', queries: ['otopné potrubí', 'měděné potrubí', 'podlahové topení'] },
  { code: '735', name: 'Ústřední vytápění - otopná tělesa', queries: ['radiátor', 'deskové těleso', 'konvektor'] },
  { code: '741', name: 'Silnoproud - rozvody', queries: ['elektroinstalace', 'kabelové rozvody', 'rozvaděč', 'jistič'] },
  { code: '762', name: 'Konstrukce tesařské', queries: ['krov', 'vaznice', 'krokve', 'bednění střech'] },
  { code: '763', name: 'Sádrokarton', queries: ['SDK příčky', 'SDK podhledy', 'sádrokartonové konstrukce'] },
  { code: '764', name: 'Klempířské konstrukce', queries: ['okapy', 'svody', 'oplechování parapetů', 'lemování'] },
  { code: '766', name: 'Truhlářské konstrukce', queries: ['dveře', 'okna', 'zárubně', 'parapetní desky'] },
  { code: '767', name: 'Zámečnické konstrukce', queries: ['zábradlí', 'ocelové konstrukce', 'žebříky'] },
  { code: '771', name: 'Podlahy keramické', queries: ['dlažba keramická', 'obklady', 'sokl'] },
  { code: '775', name: 'Podlahy vlysové', queries: ['parkety', 'dřevěné podlahy', 'plovoucí podlaha'] },
  { code: '776', name: 'Podlahy povlakové', queries: ['PVC podlaha', 'linoleum', 'marmoleum'] },
  { code: '781', name: 'Obklady keramické', queries: ['obklady stěn', 'obklady koupelna'] },
  { code: '782', name: 'Malby a tapety', queries: ['malba', 'nátěr', 'tapetování'] },
  { code: '783', name: 'Nátěry', queries: ['nátěry dřeva', 'nátěry kovů', 'antikorozní'] },
];

const HARVEST_SYSTEM_PROMPT = `Jsi databázový specialista na české cenové soustavy ve stavebnictví (ÚRS, OTSKP, TSKP).
Tvůj úkol: vyhledat SKUTEČNÉ kódy položek ÚRS z webu podminky.urs.cz pro danou kategorii prací.

PRAVIDLA:
1. Hledej VÝHRADNĚ na podminky.urs.cz
2. Každý kód musí být 6-9 ciferný (např. 274313811, 631311135)
3. Uveď přesný název položky, měrnou jednotku (m3, m2, m, kg, ks, t, kpl) a URL
4. NIKDY nevymýšlej kódy — pouze kódy které jsi skutečně našel na webu
5. Vrať MAXIMÁLNĚ 30 položek na dotaz
6. Odpověz POUZE v JSON formátu

Formát odpovědi:
{
  "category": "název kategorie",
  "items": [
    {"code": "274313811", "name": "Základové pasy z betonu tř. C 25/30", "unit": "m3", "url": "https://podminky.urs.cz/..."},
    ...
  ],
  "total_found": 30,
  "note": "poznámka"
}`;

// Active harvest state (only one harvest at a time)
let harvestState = null;

async function callPerplexity(userPrompt, apiKey, model) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || 'sonar',
      messages: [
        { role: 'system', content: HARVEST_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Perplexity API ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parsePerplexityResponse(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
    } catch {
      return null;
    }
  }
}

function validateUrsCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^\d{6,9}$/.test(code.replace(/\s/g, ''));
}

async function runHarvest(categories, apiKey, model, delayMs) {
  const db = await getDatabase();

  // Ensure harvest_log table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS harvest_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_code TEXT NOT NULL,
      category_name TEXT,
      query TEXT,
      items_found INTEGER DEFAULT 0,
      items_saved INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add columns if missing
  try { await db.exec('ALTER TABLE urs_items ADD COLUMN price REAL'); } catch {}
  try { await db.exec('ALTER TABLE urs_items ADD COLUMN source TEXT DEFAULT "otskp"'); } catch {}

  harvestState.total_categories = categories.length;
  harvestState.total_saved = 0;
  harvestState.total_found = 0;

  for (let i = 0; i < categories.length; i++) {
    if (harvestState.cancelled) {
      harvestState.status = 'cancelled';
      break;
    }

    const cat = categories[i];
    harvestState.current_category = `${cat.code}: ${cat.name}`;
    harvestState.current_index = i + 1;

    const prompt = `Vyhledej na podminky.urs.cz všechny položky ÚRS pro kategorii: "${cat.name}"\n\nHledej tyto typy prací: ${cat.queries.join(', ')}\n\nVrať kódy, názvy, jednotky a URL. Maximum 30 položek. Pouze JSON.`;

    try {
      const rawResponse = await callPerplexity(prompt, apiKey, model);
      const parsed = parsePerplexityResponse(rawResponse);

      if (!parsed || !parsed.items) {
        harvestState.errors.push({ category: cat.code, error: 'Parse failed' });
        await db.run(
          'INSERT INTO harvest_log (category_code, category_name, query, status, error) VALUES (?, ?, ?, ?, ?)',
          [cat.code, cat.name, cat.queries.join(', '), 'error', 'Parse failed']
        );
        continue;
      }

      const validItems = parsed.items.filter(item => validateUrsCode(item.code));
      harvestState.total_found += validItems.length;

      let saved = 0;
      for (const item of validItems) {
        const code = item.code.replace(/\s/g, '');
        const name = String(item.name || '').trim();
        const unit = String(item.unit || '').trim();
        if (!name) continue;

        try {
          await db.run(
            `INSERT INTO urs_items (urs_code, urs_name, unit, section_code, category_path, is_imported, source, updated_at)
             VALUES (?, ?, ?, ?, ?, 1, 'urs_perplexity', datetime('now'))
             ON CONFLICT(urs_code) DO UPDATE SET
               urs_name = CASE WHEN excluded.urs_name != '' THEN excluded.urs_name ELSE urs_items.urs_name END,
               unit = CASE WHEN excluded.unit != '' THEN excluded.unit ELSE urs_items.unit END,
               source = CASE WHEN urs_items.source = 'otskp' THEN 'otskp+urs' ELSE excluded.source END,
               updated_at = datetime('now')`,
            [code, name, unit, cat.code, `${cat.code} > ${cat.name}`]
          );
          saved++;
        } catch (err) {
          logger.warn(`[HARVEST] Error saving ${code}: ${err.message}`);
        }
      }

      harvestState.total_saved += saved;
      harvestState.completed_categories.push({
        code: cat.code, name: cat.name, found: validItems.length, saved
      });

      await db.run(
        'INSERT INTO harvest_log (category_code, category_name, query, items_found, items_saved, status) VALUES (?, ?, ?, ?, ?, ?)',
        [cat.code, cat.name, cat.queries.join(', '), validItems.length, saved, 'completed']
      );

      logger.info(`[HARVEST] [${i + 1}/${categories.length}] ${cat.code} ${cat.name}: found=${validItems.length}, saved=${saved}`);

    } catch (err) {
      harvestState.errors.push({ category: cat.code, error: err.message });
      await db.run(
        'INSERT INTO harvest_log (category_code, category_name, query, status, error) VALUES (?, ?, ?, ?, ?)',
        [cat.code, cat.name, cat.queries.join(', '), 'error', err.message]
      );
      logger.error(`[HARVEST] ${cat.code} error: ${err.message}`);
    }

    // Rate limiting
    if (i < categories.length - 1 && !harvestState.cancelled) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Final stats
  const total = await db.get('SELECT COUNT(*) as count FROM urs_items');
  const bySource = await db.all('SELECT source, COUNT(*) as count FROM urs_items GROUP BY source ORDER BY count DESC');

  harvestState.status = harvestState.cancelled ? 'cancelled' : 'completed';
  harvestState.finished_at = new Date().toISOString();
  harvestState.db_total = total.count;
  harvestState.by_source = bySource;

  logger.info(`[HARVEST] Complete: found=${harvestState.total_found}, saved=${harvestState.total_saved}, db_total=${total.count}`);
}

// POST /api/urs-catalog/harvest — Start Perplexity URS harvest
router.post('/harvest', async (req, res) => {
  const apiKey = process.env.PPLX_API_KEY || process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'PPLX_API_KEY not configured', hint: 'Available on Cloud Run via Secret Manager' });
  }

  if (harvestState && harvestState.status === 'running') {
    return res.status(409).json({ error: 'Harvest already running', state: harvestState });
  }

  const { category, resume } = req.body || {};
  const model = req.body?.model || process.env.PPLX_MODEL || 'sonar';
  const delayMs = req.body?.delay_ms || 3000;

  let categories = [...HARVEST_CATEGORIES];

  // Filter by category if specified
  if (category) {
    categories = categories.filter(c => c.code === category || c.code.startsWith(category));
    if (categories.length === 0) {
      return res.status(400).json({ error: `Category '${category}' not found` });
    }
  }

  // Resume: skip already completed categories
  if (resume) {
    try {
      const db = await getDatabase();
      const completed = await db.all("SELECT DISTINCT category_code FROM harvest_log WHERE status = 'completed'");
      const completedSet = new Set(completed.map(r => r.category_code));
      categories = categories.filter(c => !completedSet.has(c.code));
    } catch {}
  }

  harvestState = {
    status: 'running',
    started_at: new Date().toISOString(),
    finished_at: null,
    model,
    delay_ms: delayMs,
    total_categories: categories.length,
    current_index: 0,
    current_category: null,
    total_found: 0,
    total_saved: 0,
    completed_categories: [],
    errors: [],
    cancelled: false,
  };

  // Run in background (don't await)
  runHarvest(categories, apiKey, model, delayMs).catch(err => {
    harvestState.status = 'error';
    harvestState.errors.push({ category: 'global', error: err.message });
    logger.error(`[HARVEST] Fatal: ${err.message}`);
  });

  res.json({
    message: `Harvest started for ${categories.length} categories`,
    state: harvestState,
  });
});

// GET /api/urs-catalog/harvest/status — Check harvest progress
router.get('/harvest/status', (req, res) => {
  if (!harvestState) {
    return res.json({ status: 'idle', message: 'No harvest has been started' });
  }
  res.json(harvestState);
});

// POST /api/urs-catalog/harvest/cancel — Cancel running harvest
router.post('/harvest/cancel', (req, res) => {
  if (!harvestState || harvestState.status !== 'running') {
    return res.json({ message: 'No harvest running' });
  }
  harvestState.cancelled = true;
  res.json({ message: 'Cancellation requested', state: harvestState });
});

// GET /api/urs-catalog - Get all URS items or search
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    const db = await getDatabase();

    let query = 'SELECT * FROM urs_items';
    let params = [];

    if (search && search.trim().length > 0) {
      query += ' WHERE urs_name LIKE ? OR urs_code LIKE ?';
      const searchPattern = `%${search}%`;
      params = [searchPattern, searchPattern];
    }

    query += ' LIMIT ?';
    params.push(parseInt(limit) || 100);

    const items = await db.all(query, params);

    res.json({
      total: items.length,
      items: items.map(item => ({
        urs_code: item.urs_code,
        urs_name: item.urs_name,
        unit: item.unit,
        description: item.description
      }))
    });

  } catch (error) {
    logger.error(`[CATALOG] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/urs-catalog/:code/detail - Get full URS item detail (fetches from podminky.urs.cz if needed)
router.get('/:code/detail', async (req, res) => {
  try {
    const { code } = req.params;
    if (!/^\d{6,9}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid URS code format' });
    }

    const db = await getDatabase();

    // Check if we already have the full description cached
    const item = await db.get(
      'SELECT * FROM urs_items WHERE urs_code = ?',
      [code]
    );

    // If description is already long enough (>50 chars), return cached
    if (item && item.description && item.description.length > 50) {
      return res.json({
        urs_code: item.urs_code,
        urs_name: item.urs_name,
        unit: item.unit,
        description: item.description,
        url: `${URS_DETAIL_URL}/${code}`,
        source: 'cache'
      });
    }

    // Fetch from podminky.urs.cz
    const detail = await fetchUrsDetail(code);

    if (detail) {
      // Update database with fetched data
      const newName = detail.title && detail.title.length > (item?.urs_name?.length || 0)
        ? detail.title : (item?.urs_name || '');
      const newDesc = detail.full_description || item?.description || '';
      const newUnit = detail.unit || item?.unit || '';

      if (item) {
        await db.run(
          `UPDATE urs_items SET
            urs_name = CASE WHEN length(?) > length(urs_name) THEN ? ELSE urs_name END,
            description = CASE WHEN length(?) > length(COALESCE(description, '')) THEN ? ELSE description END,
            unit = CASE WHEN ? != '' AND unit = '' THEN ? ELSE unit END,
            updated_at = datetime('now')
          WHERE urs_code = ?`,
          [newName, newName, newDesc, newDesc, newUnit, newUnit, code]
        );
      } else {
        await db.run(
          `INSERT INTO urs_items (urs_code, urs_name, unit, description, is_imported, source, updated_at)
           VALUES (?, ?, ?, ?, 1, 'podminky_urs_cz', datetime('now'))`,
          [code, newName, newUnit, newDesc]
        );
      }

      return res.json({
        urs_code: code,
        urs_name: newName || detail.title,
        unit: newUnit || detail.unit,
        description: newDesc || detail.full_description,
        url: detail.url,
        source: 'podminky.urs.cz'
      });
    }

    // Fallback: return what we have (or 404)
    if (item) {
      return res.json({
        urs_code: item.urs_code,
        urs_name: item.urs_name,
        unit: item.unit,
        description: item.description,
        url: `${URS_DETAIL_URL}/${code}`,
        source: 'local'
      });
    }

    return res.status(404).json({
      error: 'URS item not found',
      url: `${URS_DETAIL_URL}/${code}`
    });

  } catch (error) {
    logger.error(`[CATALOG] Detail error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/urs-catalog/:code - Get specific URS item (local DB only)
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const db = await getDatabase();

    const item = await db.get(
      'SELECT * FROM urs_items WHERE urs_code = ?',
      [code]
    );

    if (!item) {
      return res.status(404).json({ error: 'URS item not found' });
    }

    res.json({
      urs_code: item.urs_code,
      urs_name: item.urs_name,
      unit: item.unit,
      description: item.description,
      url: `${URS_DETAIL_URL}/${code}`
    });

  } catch (error) {
    logger.error(`[CATALOG] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
