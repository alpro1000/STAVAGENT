/**
 * CORE API Client
 * Integration with concrete-agent CORE parser
 */

import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import { logger } from '../utils/logger.js';

const CORE_API_URL = process.env.CORE_API_URL || 'https://concrete-agent.onrender.com';
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

    // Create form data with correct concrete-agent parameters
    const form = new FormData();
    form.append('vykaz_vymer', fs.createReadStream(filePath)); // ← Field name is 'vykaz_vymer'
    form.append('project_name', `Import_${Date.now()}`); // ← Required parameter
    form.append('workflow', 'A'); // ← Workflow A for Excel import
    form.append('auto_start_audit', 'false'); // ← Don't auto-start audit

    // Call CORE API using CORRECT /api/upload endpoint
    // This is the concrete-agent.onrender.com API for parsing Excel documents
    logger.info(`[CORE] POST ${CORE_API_URL}/api/upload`);

    const response = await axios.post(
      `${CORE_API_URL}/api/upload`,
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
      throw new Error(`CORE returned invalid response: ${JSON.stringify(response.data)}`);
    }

    // Extract positions from response
    // concrete-agent creates a project and returns project_id
    // Positions will be in the response.data.files or need to be fetched separately
    const projectId = response.data.project_id;
    const positions = response.data.positions || response.data.files || [];

    logger.info(
      `[CORE] ✅ Successfully parsed Excel file at concrete-agent ` +
      `(project_id: ${projectId}, files: ${Array.isArray(positions) ? positions.length : 'N/A'})`
    );

    // Return positions if available, otherwise return empty array for fallback
    return Array.isArray(positions) ? positions : [];

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
    // Try health check endpoint
    const response = await axios.get(`${CORE_API_URL}/health`, {
      timeout: 5000
    });
    return response.status === 200;
  } catch (error) {
    // If health endpoint fails, try root endpoint
    try {
      const response = await axios.get(`${CORE_API_URL}/`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      logger.warn(`[CORE] Health check failed: ${error.message}`);
      return false;
    }
  }
}

/**
 * Get CORE service info
 * @returns {Promise<Object>} Service info
 */
export async function getCOREInfo() {
  try {
    // Test connectivity
    const response = await axios.get(`${CORE_API_URL}/health`, {
      timeout: 5000
    });
    return {
      available: true,
      url: CORE_API_URL,
      endpoint: '/api/upload',
      version: 'concrete-agent v2.0',
      status: 'connected',
      details: response.data
    };
  } catch (error) {
    return {
      available: false,
      url: CORE_API_URL,
      endpoint: '/api/upload',
      error: error.message,
      status: 'disconnected'
    };
  }
}
