#!/usr/bin/env node
/**
 * Perplexity-based URS Code Harvester
 *
 * Systematically queries Perplexity API to collect URS codes from podminky.urs.cz
 * by TSKP category. Uses the $5,000 Perplexity credit budget.
 *
 * Strategy:
 * 1. Load TSKP categories from XML
 * 2. For each category, ask Perplexity to list URS codes from podminky.urs.cz
 * 3. Parse responses and save to SQLite
 * 4. Track progress to resume interrupted runs
 *
 * Usage:
 *   PPLX_API_KEY=pplx-xxx node scripts/harvest_urs_perplexity.mjs
 *   PPLX_API_KEY=pplx-xxx node scripts/harvest_urs_perplexity.mjs --resume
 *   PPLX_API_KEY=pplx-xxx node scripts/harvest_urs_perplexity.mjs --category 27
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { parseStringPromise } from 'xml2js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '../../..');

// Config
const PPLX_API_KEY = process.env.PPLX_API_KEY || process.env.PERPLEXITY_API_KEY;
const PPLX_MODEL = process.env.PPLX_MODEL || 'sonar';
const DB_PATH = path.join(__dirname, '../data/urs_matcher.db');
const TSKP_PATH = path.join(__dirname, '../data/tridnik.xml');
const DELAY_MS = 3000; // 3s between requests to avoid rate limiting
const RESUME = process.argv.includes('--resume');
const SINGLE_CATEGORY = process.argv.find(a => a.startsWith('--category'))
  ? process.argv[process.argv.indexOf('--category') + 1]
  : null;

if (!PPLX_API_KEY) {
  console.error('ERROR: Set PPLX_API_KEY environment variable');
  console.error('Usage: PPLX_API_KEY=pplx-xxx node scripts/harvest_urs_perplexity.mjs');
  process.exit(1);
}

// TSKP categories to harvest — main HSV + PSV sections
const HARVEST_CATEGORIES = [
  // HSV
  { code: '1', name: 'Zemní práce', queries: ['výkopy', 'zásypy', 'přemístění zemin', 'hloubení rýh', 'svahování'] },
  { code: '2', name: 'Zakládání', queries: ['základy beton', 'základové pasy', 'základové patky', 'piloty', 'štětové stěny', 'injektáž'] },
  { code: '3', name: 'Svislé konstrukce', queries: ['zdivo', 'příčky', 'překlady', 'monolitické stěny', 'obezdívky'] },
  { code: '4', name: 'Vodorovné konstrukce', queries: ['stropy', 'překlady', 'schodiště', 'monolitické desky', 'nosníky', 'věnce'] },
  { code: '5', name: 'Komunikace', queries: ['vozovky', 'chodníky', 'dlažba', 'obrubníky', 'asfalt', 'kolejový svršek'] },
  { code: '6', name: 'Úpravy povrchů', queries: ['omítky', 'obklady', 'nátěry', 'malby', 'stěrky', 'spárování'] },
  { code: '8', name: 'Trubní vedení', queries: ['kanalizace', 'vodovod', 'plynovod', 'potrubí PE', 'šachty', 'armatury'] },
  { code: '9', name: 'Ostatní konstrukce', queries: ['lešení', 'bourání', 'demolice', 'přesun hmot', 'čerpání vody', 'staveništní'] },
  // PSV
  { code: '711', name: 'Izolace proti vodě', queries: ['hydroizolace', 'asfaltové pásy', 'fólie PVC', 'nátěry izolační', 'pronikání vlhkosti'] },
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

const SYSTEM_PROMPT = `Jsi databázový specialista na české cenové soustavy ve stavebnictví (ÚRS, OTSKP, TSKP).
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

function buildUserPrompt(categoryName, queries) {
  return `Vyhledej na podminky.urs.cz všechny položky ÚRS pro kategorii: "${categoryName}"

Hledej tyto typy prací: ${queries.join(', ')}

Vrať kódy, názvy, jednotky a URL. Maximum 30 položek. Pouze JSON.`;
}

async function callPerplexity(userPrompt) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PPLX_API_KEY}`,
    },
    body: JSON.stringify({
      model: PPLX_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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

function parseResponse(text) {
  // Extract JSON from markdown code blocks or raw text
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch {
    // Try to fix common JSON issues
    try {
      const fixed = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function validateCode(code) {
  if (!code || typeof code !== 'string') return false;
  const clean = code.replace(/\s/g, '');
  return /^\d{6,9}$/.test(clean);
}

async function main() {
  console.log('=== Perplexity URS Harvester ===');
  console.log(`Model: ${PPLX_MODEL}`);
  console.log(`DB: ${DB_PATH}`);
  console.log(`Delay: ${DELAY_MS}ms between requests`);
  console.log(`Categories: ${SINGLE_CATEGORY || 'all'}`);
  console.log();

  // Open DB
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  // Create harvest tracking table
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
    CREATE INDEX IF NOT EXISTS idx_harvest_category ON harvest_log(category_code);
    CREATE INDEX IF NOT EXISTS idx_harvest_status ON harvest_log(status);
  `);

  // Add price/source columns if missing
  try { await db.exec('ALTER TABLE urs_items ADD COLUMN price REAL'); } catch {}
  try { await db.exec('ALTER TABLE urs_items ADD COLUMN source TEXT DEFAULT "otskp"'); } catch {}

  // Filter categories
  let categories = HARVEST_CATEGORIES;
  if (SINGLE_CATEGORY) {
    categories = categories.filter(c => c.code === SINGLE_CATEGORY || c.code.startsWith(SINGLE_CATEGORY));
  }

  if (RESUME) {
    const completed = await db.all("SELECT DISTINCT category_code FROM harvest_log WHERE status = 'completed'");
    const completedSet = new Set(completed.map(r => r.category_code));
    categories = categories.filter(c => !completedSet.has(c.code));
    console.log(`Resuming: ${completedSet.size} categories already done, ${categories.length} remaining`);
  }

  let totalSaved = 0;
  let totalFound = 0;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    console.log(`\n[${i + 1}/${categories.length}] Category ${cat.code}: ${cat.name}`);
    console.log(`  Queries: ${cat.queries.join(', ')}`);

    const prompt = buildUserPrompt(cat.name, cat.queries);

    try {
      const rawResponse = await callPerplexity(prompt);
      const parsed = parseResponse(rawResponse);

      if (!parsed || !parsed.items) {
        console.log(`  WARNING: Could not parse response`);
        await db.run(
          'INSERT INTO harvest_log (category_code, category_name, query, status, error) VALUES (?, ?, ?, ?, ?)',
          [cat.code, cat.name, cat.queries.join(', '), 'error', 'Parse failed']
        );
        continue;
      }

      const validItems = parsed.items.filter(item => validateCode(item.code));
      console.log(`  Found: ${parsed.items.length} items, Valid: ${validItems.length}`);

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
            [code, name, unit, cat.code, `${cat.code} > ${cat.name}`, ]
          );
          saved++;
        } catch (err) {
          console.log(`    Error saving ${code}: ${err.message}`);
        }
      }

      totalSaved += saved;
      totalFound += validItems.length;

      await db.run(
        'INSERT INTO harvest_log (category_code, category_name, query, items_found, items_saved, status) VALUES (?, ?, ?, ?, ?, ?)',
        [cat.code, cat.name, cat.queries.join(', '), validItems.length, saved, 'completed']
      );

      console.log(`  Saved: ${saved} items`);

    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      await db.run(
        'INSERT INTO harvest_log (category_code, category_name, query, status, error) VALUES (?, ?, ?, ?, ?)',
        [cat.code, cat.name, cat.queries.join(', '), 'error', err.message]
      );
    }

    // Rate limiting delay
    if (i < categories.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  // Final stats
  const total = await db.get('SELECT COUNT(*) as count FROM urs_items');
  const bySource = await db.all('SELECT source, COUNT(*) as count FROM urs_items GROUP BY source ORDER BY count DESC');

  console.log('\n=== Harvest Complete ===');
  console.log(`  New URS codes found:  ${totalFound}`);
  console.log(`  New URS codes saved:  ${totalSaved}`);
  console.log(`  Total DB items:       ${total.count}`);
  console.log('\n  By source:');
  for (const row of bySource) {
    console.log(`    ${(row.source || 'unknown').padEnd(20)} ${row.count}`);
  }

  await db.close();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
