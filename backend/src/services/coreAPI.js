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

    // 🔍 FULL RESPONSE DIAGNOSTICS
    logger.info(`[CORE] ═══════════════════════════════════════════`);
    logger.info(`[CORE] Raw response keys: ${Object.keys(response.data).join(', ')}`);

    // Log interesting fields from response
    if (response.data.files_uploaded) {
      logger.info(`[CORE] Files uploaded: ${JSON.stringify(response.data.files_uploaded)}`);
    }
    if (response.data.enrichment_enabled) {
      logger.info(`[CORE] Enrichment enabled: ${response.data.enrichment_enabled}`);
    }
    if (response.data.workflow) {
      logger.info(`[CORE] Workflow: ${response.data.workflow}`);
    }

    // Log file structure if present
    if (response.data.files && Array.isArray(response.data.files)) {
      logger.info(`[CORE] Files array length: ${response.data.files.length}`);
      if (response.data.files.length > 0) {
        logger.info(`[CORE] First file keys: ${Object.keys(response.data.files[0]).join(', ')}`);
        // Log full structure of first file
        logger.info(`[CORE] First file structure:`);
        const firstFile = response.data.files[0];
        for (const [key, value] of Object.entries(firstFile)) {
          if (typeof value === 'object' && value !== null) {
            logger.info(`[CORE]   ${key}: [${Array.isArray(value) ? 'Array:' + value.length : 'Object:' + Object.keys(value).join(',')}]`);
          } else if (typeof value === 'string' && value.length > 100) {
            logger.info(`[CORE]   ${key}: "${value.substring(0, 100)}..."`);
          } else {
            logger.info(`[CORE]   ${key}: ${JSON.stringify(value)}`);
          }
        }
      }
    }

    // Log raw response for reference
    logger.debug(`[CORE] Full response: ${JSON.stringify(response.data).substring(0, 2000)}`);

    // Extract positions from response
    // concrete-agent returns: { success: true, project_id: "...", ... }
    const projectId = response.data.project_id;

    // Try multiple possible response formats
    let positions = [];

    if (Array.isArray(response.data.positions)) {
      positions = response.data.positions;
      logger.info(`[CORE] Found positions in response.data.positions: ${positions.length}`);
    } else if (Array.isArray(response.data.files) && response.data.files.length > 0) {
      // If files returned, check if they contain positions
      logger.info(`[CORE] Found ${response.data.files.length} file(s) in response.data.files`);

      // Files might contain parsed content - need to extract positions from them
      const filesArray = response.data.files;
      for (const file of filesArray) {
        logger.debug(`[CORE] Processing file: ${file.filename || file.file_id}`);
        logger.debug(`[CORE] File keys: ${Object.keys(file).join(', ')}`);

        // Try different property names where positions might be
        if (Array.isArray(file.positions)) {
          positions.push(...file.positions);
          logger.info(`[CORE] Found ${file.positions.length} positions in file.positions`);
        } else if (Array.isArray(file.items)) {
          positions.push(...file.items);
          logger.info(`[CORE] Found ${file.items.length} items in file.items`);
        } else if (Array.isArray(file.data)) {
          positions.push(...file.data);
          logger.info(`[CORE] Found ${file.data.length} data items in file.data`);
        } else if (file.parsed_data && Array.isArray(file.parsed_data)) {
          positions.push(...file.parsed_data);
          logger.info(`[CORE] Found ${file.parsed_data.length} parsed_data items`);
        } else if (file.vykaz_vymer && typeof file.vykaz_vymer === 'object') {
          // Sometimes data is nested under the field name
          if (Array.isArray(file.vykaz_vymer.items)) {
            positions.push(...file.vykaz_vymer.items);
            logger.info(`[CORE] Found ${file.vykaz_vymer.items.length} items in file.vykaz_vymer.items`);
          } else if (Array.isArray(file.vykaz_vymer.data)) {
            positions.push(...file.vykaz_vymer.data);
            logger.info(`[CORE] Found ${file.vykaz_vymer.data.length} data items in file.vykaz_vymer.data`);
          }
        } else {
          // Log what's in the file object for debugging
          logger.info(`[CORE] File object structure: ${JSON.stringify(file).substring(0, 500)}`);
          logger.warn(`[CORE] ⚠️ File returned but no positions found in expected locations`);
        }
      }
    } else if (Array.isArray(response.data.items)) {
      positions = response.data.items;
      logger.info(`[CORE] Found positions in response.data.items: ${positions.length}`);
    } else if (response.data.data && Array.isArray(response.data.data.positions)) {
      positions = response.data.data.positions;
      logger.info(`[CORE] Found positions in response.data.data.positions: ${positions.length}`);
    } else {
      // If no positions in expected locations, check what's in the response
      logger.info(`[CORE] Response keys: ${Object.keys(response.data).join(', ')}`);
      logger.warn(`[CORE] ⚠️ Could not find positions in standard locations`);
      logger.info(`[CORE] Full response structure: ${JSON.stringify(response.data, null, 2).substring(0, 1000)}`);
      positions = [];
    }

    logger.info(
      `[CORE] ✅ Successfully parsed Excel file at concrete-agent ` +
      `(project_id: ${projectId}, positions: ${positions.length})`
    );
    logger.info(`[CORE] ═══════════════════════════════════════════`);

    // If no positions found but file was uploaded, CORE might be async or still processing
    // Try to fetch positions using the project_id with multiple retry attempts
    if (positions.length === 0 && projectId) {
      logger.warn(`[CORE] ⚠️ No positions extracted immediately, attempting async fetch with retries...`);
      logger.warn(`[CORE] CORE парсит файл асинхронно, ждем результаты...`);

      // Try multiple endpoints and wait for processing
      const endpoints = [
        `/api/projects/${projectId}/results`,
        `/api/projects/${projectId}/items`,
        `/api/projects/${projectId}/positions`,
        `/api/projects/${projectId}/audit/results`
      ];

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Give CORE more time to process on subsequent attempts
          const waitTime = 500 + (attempt * 1000); // 500ms, 1500ms, 2500ms
          logger.info(`[CORE] Waiting ${waitTime}ms before attempt ${attempt + 1}/3...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          // Try each endpoint
          for (const endpoint of endpoints) {
            try {
              logger.info(`[CORE] 🔍 Trying endpoint: GET ${endpoint}`);
              const resultResponse = await axios.get(
                `${CORE_API_URL}${endpoint}`,
                { timeout: 5000 }
              );

              logger.info(`[CORE] Response keys from ${endpoint}: ${Object.keys(resultResponse.data).join(', ')}`);

              // Check multiple locations in response
              if (resultResponse.data) {
                if (Array.isArray(resultResponse.data.positions)) {
                  positions = resultResponse.data.positions;
                  logger.info(`[CORE] ✅ Fetched ${positions.length} positions from ${endpoint}`);
                  break;
                } else if (Array.isArray(resultResponse.data.items)) {
                  positions = resultResponse.data.items;
                  logger.info(`[CORE] ✅ Fetched ${positions.length} items from ${endpoint}`);
                  break;
                } else if (Array.isArray(resultResponse.data.results)) {
                  positions = resultResponse.data.results;
                  logger.info(`[CORE] ✅ Fetched ${positions.length} results from ${endpoint}`);
                  break;
                } else if (Array.isArray(resultResponse.data.data)) {
                  positions = resultResponse.data.data;
                  logger.info(`[CORE] ✅ Fetched ${positions.length} data items from ${endpoint}`);
                  break;
                } else if (resultResponse.data.processed_at || resultResponse.data.audit_completed_at) {
                  logger.info(`[CORE] 📊 File processing status from ${endpoint}: ${JSON.stringify(resultResponse.data).substring(0, 300)}`);
                }

                // If response has files, try to extract from them
                if (resultResponse.data.files && Array.isArray(resultResponse.data.files)) {
                  logger.info(`[CORE] Found ${resultResponse.data.files.length} files in async response`);
                  for (const file of resultResponse.data.files) {
                    if (Array.isArray(file.positions)) {
                      positions.push(...file.positions);
                      logger.info(`[CORE] ✅ Extracted ${file.positions.length} positions from file.positions`);
                    }
                    if (Array.isArray(file.items)) {
                      positions.push(...file.items);
                      logger.info(`[CORE] ✅ Extracted ${file.items.length} items from file.items`);
                    }
                  }
                }
              }
            } catch (endpointError) {
              logger.debug(`[CORE] Endpoint ${endpoint} not available: ${endpointError.message}`);
            }
          }

          // If we found positions, stop retrying
          if (positions.length > 0) {
            break;
          }
        } catch (asyncError) {
          logger.warn(`[CORE] Async fetch attempt ${attempt + 1} failed: ${asyncError.message}`);
        }
      }

      if (positions.length === 0) {
        logger.warn(`[CORE] ⚠️ After 3 retries, CORE still returned 0 positions. File may not contain structured concrete data.`);
        logger.warn(`[CORE] Возможные причины:`);
        logger.warn(`[CORE]   1. CORE обрабатывает файл (нужно больше времени)`);
        logger.warn(`[CORE]   2. Файл не содержит структурированные данные о бетоне`);
        logger.warn(`[CORE]   3. CORE эндпоинты возвращают данные в другом формате`);
      }
    }

    // If we have positions, log them for diagnostics
    if (positions.length > 0) {
      logger.info(`[CORE] ═══════════════════════════════════════════`);
      logger.info(`[CORE] 🎉 SUCCESS: Extracted ${positions.length} concrete positions`);
      logger.info(`[CORE] Sample positions:`);
      for (let i = 0; i < Math.min(3, positions.length); i++) {
        const pos = positions[i];
        const summary = typeof pos === 'object'
          ? `{${Object.keys(pos).join(', ')}}`
          : `"${String(pos).substring(0, 80)}"`;
        logger.info(`[CORE]   ${i + 1}. ${summary}`);
      }
      logger.info(`[CORE] ═══════════════════════════════════════════`);
    }

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
