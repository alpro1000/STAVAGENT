/**
 * CORE API Client
 * Integration with concrete-agent CORE parser
 */

import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import { logger } from '../utils/logger.js';

const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:8000';
const CORE_TIMEOUT = parseInt(process.env.CORE_TIMEOUT) || 30000; // 30 seconds
const CORE_ENABLED = process.env.ENABLE_CORE_FALLBACK !== 'false'; // Enabled by default

/**
 * Parse Excel file using CORE's advanced parser
 * @param {string} filePath - Path to Excel file
 * @returns {Promise<Array>} Array of parsed positions
 */
export async function parseExcelByCORE(filePath) {
  if (!CORE_ENABLED) {
    logger.info('[CORE] CORE fallback is disabled (ENABLE_CORE_FALLBACK=false)');
    return [];
  }

  try {
    logger.info(`[CORE] Sending file to CORE parser: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // Call CORE API
    const response = await axios.post(
      `${CORE_API_URL}/api/parse-excel`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        timeout: CORE_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error('CORE returned invalid response');
    }

    const positions = response.data.positions || [];
    const diagnostics = response.data.diagnostics || {};

    logger.info(
      `[CORE] ✅ Parsed ${positions.length} positions ` +
      `(format: ${diagnostics.format || 'unknown'}, ` +
      `raw: ${diagnostics.raw_total || 0}, ` +
      `normalized: ${diagnostics.normalized_total || 0})`
    );

    return positions;

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.warn(
        `[CORE] ⚠️ Cannot connect to CORE at ${CORE_API_URL} - ` +
        'Is CORE service running?'
      );
    } else if (error.code === 'ETIMEDOUT') {
      logger.error(`[CORE] ⏱️ Request timeout after ${CORE_TIMEOUT}ms`);
    } else {
      logger.error(`[CORE] ❌ Parse failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Convert CORE position format to Monolit format
 * @param {Object} corePosition - Position from CORE
 * @param {string} bridgeId - Bridge ID
 * @returns {Object} Position in Monolit format
 */
export function convertCOREToMonolitPosition(corePosition, bridgeId) {
  const description = corePosition.description || '';
  const unit = (corePosition.unit || 'M3').toUpperCase();

  // Extract part name from description (before first dash or full text)
  let partName = 'Neznámá část';
  if (description) {
    const parts = description.split('-');
    partName = parts[0].trim();
    if (partName.length < 3) {
      partName = description.substring(0, 50); // Use first 50 chars if no dash
    }
  }

  // Determine subtype based on unit and description
  const subtype = determineSubtype(description, unit);

  return {
    part_name: partName,
    item_name: description,
    subtype: subtype,
    unit: unit,
    qty: parseFloat(corePosition.quantity) || 0,
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: 0,
    otskp_code: corePosition.code || null
  };
}

/**
 * Determine work subtype based on description and unit
 */
function determineSubtype(description, unit) {
  const text = description.toLowerCase();
  const unitLower = unit.toLowerCase();

  // By unit
  if (unitLower.includes('m3') || unitLower.includes('m³')) return 'beton';
  if (unitLower.includes('m2') || unitLower.includes('m²')) return 'bednění';
  if (unitLower.includes('t') || unitLower.includes('kg')) return 'výztuž';

  // By description keywords
  if (text.includes('beton') || text.includes('betón') || text.includes('žb')) {
    return 'beton';
  }
  if (text.includes('bedn') || text.includes('bednění')) {
    return 'bednění';
  }
  if (text.includes('výztuž') || text.includes('ocel') || text.includes('armatura')) {
    return 'výztuž';
  }

  // Default to beton
  return 'beton';
}

/**
 * Filter CORE positions for a specific bridge
 * @param {Array} allPositions - All positions from CORE
 * @param {string} bridgeId - Target bridge ID (e.g., "SO 241")
 * @returns {Array} Filtered positions
 */
export function filterPositionsForBridge(allPositions, bridgeId) {
  // For now, return all positions
  // In future, can implement smart filtering based on bridge ID in position data
  return allPositions;
}

/**
 * Check if CORE is available
 * @returns {Promise<boolean>} True if CORE is reachable
 */
export async function isCOREAvailable() {
  if (!CORE_ENABLED) {
    return false;
  }

  try {
    const response = await axios.get(`${CORE_API_URL}/api/health`, {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Get CORE service info
 * @returns {Promise<Object>} Service info
 */
export async function getCOREInfo() {
  try {
    const response = await axios.get(`${CORE_API_URL}/api/health`, {
      timeout: 5000
    });
    return {
      available: true,
      version: response.data.version || 'unknown',
      features: response.data.features || {},
      stats: response.data.stats || {}
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}
