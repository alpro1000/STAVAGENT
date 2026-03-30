/**
 * Příloha Downloader + Parser
 *
 * Downloads xlsx/ods/csv attachments from Hlídač státu přílohy URLs,
 * parses them using the existing fileParser, and returns structured positions.
 *
 * Reuses: fileParser.js (parseExcelFile), smlouvyParser.js (detectCodeSystem, classifyWorkType)
 *
 * Storage: downloaded files go to data/prilohy/ (not git, gitignored via *.xlsx)
 * Parsed data goes to rozpocet_polozky (SQLite).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { parseExcelFile } from './fileParser.js';
import { detectCodeSystem, classifyWorkType, normalizeMJ } from './smlouvyParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRILOHY_DIR = path.join(__dirname, '../../data/prilohy');
const DOWNLOAD_TIMEOUT_MS = 30_000;

// Supported file extensions for download
const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xls', '.ods', '.csv']);

/**
 * Check if a příloha filename looks like a parseable spreadsheet.
 */
export function isParseable(filename) {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Check if a příloha filename looks like a BOQ / rozpočet.
 * Filters out contracts, invoices, etc.
 */
export function looksLikeRozpocet(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  // Positive: rozpočet, soupis, krycí list, výkaz, BOQ keywords
  const positive = /rozpo[čc]et|soupis|kryc[ií]|v[ýy]kaz|polo[žz]k|komplet|rtsrozp|budget|boq/i;
  // Negative: smlouva, faktura, zápis, protokol, plná moc
  const negative = /smlouva|faktur|z[áa]pis|protokol|pln[áa]\s*moc|dodatek|objedn[áa]vk/i;

  if (negative.test(lower)) return false;
  if (positive.test(lower)) return true;
  // If just an xlsx without keywords — try it anyway
  return isParseable(filename);
}

/**
 * Download a file from URL to local storage.
 *
 * @param {string} url - Download URL
 * @param {string} filename - Original filename
 * @returns {Promise<string|null>} Local file path or null on failure
 */
export async function downloadPriloha(url, filename) {
  if (!url) return null;

  // Ensure directory exists
  if (!fs.existsSync(PRILOHY_DIR)) {
    fs.mkdirSync(PRILOHY_DIR, { recursive: true });
  }

  // Sanitize filename
  const safeName = path.basename(filename || 'priloha.xlsx').replace(/[^a-zA-Z0-9._-]/g, '_');
  const localPath = path.join(PRILOHY_DIR, `${Date.now()}_${safeName}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    logger.debug(`[DOWNLOADER] Downloading ${url.substring(0, 100)} → ${safeName}`);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'StavAgent/1.0' },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      logger.warn(`[DOWNLOADER] HTTP ${resp.status} for ${url.substring(0, 80)}`);
      return null;
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    logger.debug(`[DOWNLOADER] Saved ${buffer.length} bytes → ${localPath}`);
    return localPath;
  } catch (err) {
    clearTimeout(timeout);
    logger.warn(`[DOWNLOADER] Download failed: ${err.message}`);
    return null;
  }
}

/**
 * Download and parse a příloha xlsx/ods/csv file.
 * Returns positions in the same format as smlouvyParser.
 *
 * @param {string} url - Download URL
 * @param {string} filename - Original filename
 * @returns {Promise<Array|null>} Parsed positions or null
 */
export async function downloadAndParse(url, filename) {
  const localPath = await downloadPriloha(url, filename);
  if (!localPath) return null;

  try {
    // Use existing fileParser
    const rows = await parseExcelFile(localPath);
    if (!rows || rows.length === 0) return null;

    // Enrich each row with code detection + work type classification
    const positions = rows.map((row, i) => {
      // Try to extract code from description
      const codeMatch = row.description?.match(/^(\d{6,9})\s/);
      const code = codeMatch ? codeMatch[1] : null;
      const { system: codeSystem, confidence: codeConf } = code
        ? detectCodeSystem(code)
        : { system: 'unknown', confidence: 0 };

      return {
        code_raw: code,
        code: code,
        code_system: codeSystem,
        code_confidence: codeConf,
        description: row.description || '',
        mj: normalizeMJ(row.unit) || row.unit,
        quantity: row.quantity || null,
        unit_price: null,
        work_type: classifyWorkType(row.description),
        source_file: filename,
        parseMethod: 'xlsx_download',
      };
    }).filter(p => p.description.length > 3);

    logger.info(`[DOWNLOADER] Parsed ${positions.length} positions from ${filename}`);
    return positions;
  } catch (err) {
    logger.warn(`[DOWNLOADER] Parse failed for ${filename}: ${err.message}`);
    return null;
  } finally {
    // Clean up downloaded file
    try { fs.unlinkSync(localPath); } catch {}
  }
}

/**
 * Process all přílohy of a smlouva — try xlsx download for those without good PlainTextContent.
 *
 * @param {Array} prilohy - Array of příloha objects from Hlídač státu API
 * @param {number} maxDownloads - Max files to download per smlouva (default: 3)
 * @returns {Promise<Array>} All parsed positions
 */
export async function processPrilohyXlsx(prilohy, maxDownloads = 3) {
  const allPositions = [];
  let downloaded = 0;

  for (const p of prilohy) {
    if (downloaded >= maxDownloads) break;

    const filename = p.nazevSouboru || p.NazevSouboru || '';
    const url = p.odkaz || p.Odkaz || '';

    // Skip if not a parseable spreadsheet or not a rozpočet
    if (!isParseable(filename) || !looksLikeRozpocet(filename)) continue;
    if (!url) continue;

    downloaded++;
    const positions = await downloadAndParse(url, filename);
    if (positions && positions.length > 0) {
      allPositions.push(...positions);
    }
  }

  return allPositions;
}
