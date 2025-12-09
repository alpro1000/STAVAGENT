/**
 * Database Initialization
 * SQLite setup with schema creation
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db = null;

export async function initializeDatabase() {
  if (db) {
    return db;
  }

  const dbPath = process.env.DATABASE_URL || 'file:./data/urs_matcher.db';
  const filename = dbPath.replace('file:', '');

  try {
    // Create data directory if it doesn't exist (important for Render deployment)
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`[DB] Created directory: ${dir}`);
    }

    db = await open({
      filename,
      driver: sqlite3.Database
    });

    logger.info(`[DB] Connected to: ${filename}`);

    // Create tables
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await db.exec(schema);

    logger.info('[DB] Schema initialized');

    // Seed sample data if empty
    const count = await db.get('SELECT COUNT(*) as count FROM urs_items');
    if (count.count === 0) {
      await seedSampleData(db);
    }

    return db;

  } catch (error) {
    logger.error(`[DB] Initialization error: ${error.message}`);
    throw error;
  }
}

export async function getDatabase() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

async function seedSampleData(db) {
  try {
    logger.info('[DB] Seeding sample URS data...');

    const sampleData = [
      // Základové konstrukce - Foundation structures
      { code: '274313811', name: 'Základové pasy z betonu tř. C 25/30', unit: 'm3' },
      { code: '274313821', name: 'Základové pasy z betonu tř. C 30/37', unit: 'm3' },
      { code: '273326121', name: 'Základová deska z betonu C 25/30', unit: 'm3' },
      { code: '275313811', name: 'Základové patky z betonu C 25/30', unit: 'm3' },

      // Podkladní betony - Base concrete
      { code: '801321111', name: 'Beton podkladní C 16/20 až C 25/30', unit: 'm3' },
      { code: '801321121', name: 'Beton podkladní C 25/30 až C 30/37', unit: 'm3' },
      { code: '801321212', name: 'Beton podkladní C 30/37 až C 35/45', unit: 'm3' },
      { code: '271542211', name: 'Podsyp pod základové konstrukce', unit: 'm3' },

      // Bednění - Formwork
      { code: '417351115', name: 'Bednění pasů zřízení odstranění', unit: 'm2' },
      { code: '273351122', name: 'Bednění desek zřízení odstranění', unit: 'm2' },
      { code: '275354111', name: 'Bednění patek zřízení odstranění', unit: 'm2' },
      { code: '801171321', name: 'Bednění vodorovných konstrukcí', unit: 'm2' },
      { code: '801171311', name: 'Bednění svislých konstrukcí', unit: 'm2' },
      { code: '801171331', name: 'Bednění průvlaků', unit: 'm2' },

      // Výztuž - Reinforcement
      { code: '274361821', name: 'Výztuž pasů B 500', unit: 'kg' },
      { code: '273366006', name: 'Výztuž desek B 500', unit: 'kg' },
      { code: '273366011', name: 'Výztuž desek KARI sítě', unit: 'm2' },
      { code: '275361821', name: 'Výztuž patek B 500', unit: 'kg' },
      { code: '801161111', name: 'Výztuž z oceli – pruty', unit: 'kg' },
      { code: '801161121', name: 'Výztuž z oceli – sítě', unit: 'm2' },

      // Sloupy a nosné konstrukce - Columns and load-bearing structures
      { code: '801321311', name: 'Beton C 30/37 až C 35/45 do sloupů', unit: 'm3' },
      { code: '801321321', name: 'Beton C 35/45 až C 40/50 do sloupů', unit: 'm3' },

      // Zemní práce - Earthworks
      { code: '801111111', name: 'Výkopy v hlíně', unit: 'm3' },
      { code: '801111121', name: 'Výkopy v jílu', unit: 'm3' },
      { code: '801111211', name: 'Výkopy v pjesčitém gruntu', unit: 'm3' },
      { code: '801211111', name: 'Zásyp trench - hutněná zemina', unit: 'm3' },
      { code: '801211121', name: 'Zásyp trench - písk hutněný', unit: 'm3' },

      // Přesuny - Material transport
      { code: '801311111', name: 'Přesun hmot do 1 km', unit: 't' },
      { code: '801311121', name: 'Přesun hmot 1-5 km', unit: 't' },
      { code: '801311131', name: 'Přesun hmot 5-10 km', unit: 't' },

      // Lože - Bedding
      { code: '801421111', name: 'Lože z betonu C 12/15', unit: 'm3' },
      { code: '801421121', name: 'Lože z betonu C 16/20', unit: 'm3' },

      // Prostupy - Openings
      { code: '410002111', name: 'Prostupy svisle', unit: 'kus' },
      { code: '270001111', name: 'Vytvoření prostupu', unit: 'kus' },

      // Ostatní - Other
      { code: '218111111', name: 'Odvětrání radonu drenážní potrubí', unit: 'm' },
      { code: '218111122', name: 'Odvětrání radonu sběrné potrubí', unit: 'm' },
      { code: '218121111', name: 'Odvětrání radonu svislé potrubí', unit: 'm' },
      { code: '219991113', name: 'Vložení trubek', unit: 'm' },
      { code: '273325912', name: 'Úprava desek přehlazením', unit: 'm2' },
      { code: '631311135', name: 'Ochranná betonová mazanina C 25/30', unit: 'm3' },
      { code: '919131311', name: 'Distanční výztuž – distanční žebříček', unit: 'kus' }
    ];

    for (const item of sampleData) {
      await db.run(
        'INSERT INTO urs_items (urs_code, urs_name, unit) VALUES (?, ?, ?)',
        [item.code, item.name, item.unit]
      );
    }

    logger.info(`[DB] Seeded ${sampleData.length} sample items`);

  } catch (error) {
    logger.error(`[DB] Seed error: ${error.message}`);
    // Don't throw, just log warning
  }
}

// Run initialization when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => {
      logger.info('[DB] Database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`[DB] Fatal error: ${error.message}`);
      process.exit(1);
    });
}
