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

    // ВАЖНО: Используем только валидные коды из официального каталога URS
    // Коды на 801xxx - это старая система кодирования, они НЕВЕРНЫЕ!
    // Правильные коды начинаются с: 27x (ŽB), 41x (bednění), 21x (instalace), 63x (podlahy), 91x (pomocné)
    const sampleData = [
      // ============================================================================
      // ZÁKLADOVÉ KONSTRUKCE - Foundation structures (27x)
      // ============================================================================
      { code: '274313811', name: 'Základové pasy z betonu tř. C 25/30', unit: 'm3' },
      { code: '274313821', name: 'Základové pasy z betonu tř. C 30/37', unit: 'm3' },
      { code: '274313831', name: 'Základové pasy z betonu tř. C 35/45', unit: 'm3' },

      { code: '273326121', name: 'Základová deska z betonu C 25/30', unit: 'm3' },
      { code: '273326131', name: 'Základová deska z betonu C 30/37', unit: 'm3' },

      { code: '275313811', name: 'Základové patky z betonu C 25/30', unit: 'm3' },
      { code: '275313821', name: 'Základové patky z betonu C 30/37', unit: 'm3' },

      // Podkladní vrstvy
      { code: '271542211', name: 'Podsyp pod základové konstrukce', unit: 'm3' },
      { code: '273325121', name: 'Podkladní betonová deska C 16/20', unit: 'm3' },
      { code: '273325131', name: 'Podkladní betonová deska C 25/30', unit: 'm3' },

      // ============================================================================
      // BEDNĚNÍ - Formwork (41x, 27x)
      // ============================================================================
      { code: '417351115', name: 'Bednění pasů zřízení odstranění', unit: 'm2' },
      { code: '273351122', name: 'Bednění desek zřízení odstranění', unit: 'm2' },
      { code: '275354111', name: 'Bednění patek zřízení odstranění', unit: 'm2' },
      { code: '417361115', name: 'Bednění stěn oboustranné', unit: 'm2' },
      { code: '417371115', name: 'Bednění sloupů', unit: 'm2' },

      // ============================================================================
      // VÝZTUŽ - Reinforcement (27x)
      // ============================================================================
      { code: '274361821', name: 'Výztuž pasů B 500', unit: 'kg' },
      { code: '273366006', name: 'Výztuž desek B 500', unit: 'kg' },
      { code: '273366011', name: 'Výztuž desek KARI sítě', unit: 'm2' },
      { code: '275361821', name: 'Výztuž patek B 500', unit: 'kg' },
      { code: '276361821', name: 'Výztuž stěn B 500', unit: 'kg' },
      { code: '277361821', name: 'Výztuž sloupů B 500', unit: 'kg' },

      // ============================================================================
      // SLOUPY A STĚNY - Columns and walls (27x)
      // ============================================================================
      { code: '277313831', name: 'Sloupy z betonu C 30/37', unit: 'm3' },
      { code: '277313841', name: 'Sloupy z betonu C 35/45', unit: 'm3' },
      { code: '276313821', name: 'Stěny z betonu C 25/30', unit: 'm3' },
      { code: '276313831', name: 'Stěny z betonu C 30/37', unit: 'm3' },

      // ============================================================================
      // PROSTUPY - Openings (27x, 41x)
      // ============================================================================
      { code: '410002111', name: 'Prostupy svisle', unit: 'kus' },
      { code: '410002121', name: 'Prostupy vodorovně', unit: 'kus' },
      { code: '270001111', name: 'Vytvoření prostupu', unit: 'kus' },

      // ============================================================================
      // INSTALACE - Radon ventilation (21x)
      // ============================================================================
      { code: '218111111', name: 'Odvětrání radonu drenážní potrubí DN 80-100', unit: 'm' },
      { code: '218111122', name: 'Odvětrání radonu sběrné potrubí DN 100-150', unit: 'm' },
      { code: '218121111', name: 'Odvětrání radonu svislé potrubí DN 100', unit: 'm' },
      { code: '219991113', name: 'Vložení trubek do betonu', unit: 'm' },

      // ============================================================================
      // POVRCHOVÉ ÚPRAVY - Surface finishes (27x, 63x)
      // ============================================================================
      { code: '273325912', name: 'Úprava desek přehlazením', unit: 'm2' },
      { code: '631311135', name: 'Ochranná betonová mazanina C 25/30', unit: 'm3' },

      // ============================================================================
      // POMOCNÉ KONSTRUKCE - Auxiliary structures (91x)
      // ============================================================================
      { code: '919131311', name: 'Distanční výztuž – distanční žebříček v. 150mm', unit: 'kus' },
      { code: '919131321', name: 'Distanční výztuž – distanční žebříček v. 200mm', unit: 'kus' }
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
