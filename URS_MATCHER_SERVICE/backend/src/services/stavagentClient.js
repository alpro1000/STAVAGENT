/**
 * STAVAGENT Client - Integration with concrete-agent core
 * Фаза 2: Document Parsing & Context Extraction
 *
 * Provides access to STAVAGENT's SmartParser and Document Q&A Flow
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to STAVAGENT concrete-agent Python scripts
const STAVAGENT_PYTHON_PATH = path.join(__dirname, '../../../../concrete-agent/packages/core-backend');

/**
 * Call STAVAGENT SmartParser via Python subprocess
 *
 * @param {string} filePath - Path to document file
 * @returns {Promise<Object>} Parsed document data
 */
export async function parseDocumentWithStavagent(filePath) {
  return new Promise((resolve, reject) => {
    logger.info(`[STAVAGENT] Parsing document: ${filePath}`);

    // Python script to call SmartParser
    const pythonScript = `
import sys
import json
from pathlib import Path
sys.path.insert(0, '${STAVAGENT_PYTHON_PATH}')

from app.parsers.smart_parser import SmartParser

file_path = Path('${filePath}')
parser = SmartParser()

try:
    result = parser.parse(file_path)
    print(json.dumps(result, ensure_ascii=False, default=str))
except Exception as e:
    print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
    sys.exit(1)
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error(`[STAVAGENT] Parser failed: ${stderr}`);
        return reject(new Error(`SmartParser failed: ${stderr}`));
      }

      try {
        const result = JSON.parse(stdout);
        logger.info('[STAVAGENT] Parsing completed successfully');
        resolve(result);
      } catch (err) {
        logger.error(`[STAVAGENT] Failed to parse JSON response: ${err.message}`);
        reject(new Error(`Invalid JSON response from SmartParser: ${err.message}`));
      }
    });

    pythonProcess.on('error', (err) => {
      logger.error(`[STAVAGENT] Failed to spawn Python process: ${err.message}`);
      reject(new Error(`Failed to call SmartParser: ${err.message}`));
    });
  });
}

/**
 * Extract project context from technical specification document
 * Uses Document Q&A Flow logic to extract key parameters
 *
 * @param {string} filePath - Path to TechSpec document (PDF/Word)
 * @returns {Promise<Object>} Extracted project context
 */
export async function extractProjectContext(filePath) {
  logger.info(`[STAVAGENT] Extracting project context from: ${filePath}`);

  try {
    // Parse document first
    const parsedDoc = await parseDocumentWithStavagent(filePath);

    // Extract context using simple heuristics for MVP
    // TODO: Replace with full Document Q&A Flow in Phase 3
    const context = {
      building_type: extractBuildingType(parsedDoc),
      storeys: extractStoreys(parsedDoc),
      main_system: extractMainSystems(parsedDoc),
      notes: [],
      source_document: path.basename(filePath),
      extraction_confidence: 0.7 // MVP heuristics = medium confidence
    };

    logger.info(`[STAVAGENT] Context extracted: ${JSON.stringify(context)}`);
    return context;

  } catch (error) {
    logger.error(`[STAVAGENT] Context extraction failed: ${error.message}`);
    throw error;
  }
}

/**
 * Extract building type from parsed document (MVP heuristics)
 */
function extractBuildingType(parsedDoc) {
  const text = (parsedDoc.full_text || '').toLowerCase();

  if (text.includes('bytový dům') || text.includes('bytový') || text.includes('residential')) {
    return 'bytový dům';
  }
  if (text.includes('most') || text.includes('bridge') || text.includes('propustek')) {
    return 'most';
  }
  if (text.includes('garáž') || text.includes('parking') || text.includes('podzemní')) {
    return 'podzemní garáž';
  }
  if (text.includes('rodinný dům') || text.includes('family house')) {
    return 'rodinný dům';
  }
  if (text.includes('průmyslová') || text.includes('industrial')) {
    return 'průmyslová budova';
  }

  return 'neurčeno';
}

/**
 * Extract number of storeys from parsed document (MVP heuristics)
 */
function extractStoreys(parsedDoc) {
  const text = parsedDoc.full_text || '';

  // Look for patterns like "4NP", "5 nadzemních podlaží", "3-storey"
  const patterns = [
    /(\d+)\s*np/i,
    /(\d+)\s*nadzemní/i,
    /(\d+)\s*storey/i,
    /(\d+)\s*podlaží/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return 0; // Unknown
}

/**
 * Extract main structural systems from parsed document (MVP heuristics)
 */
function extractMainSystems(parsedDoc) {
  const text = (parsedDoc.full_text || '').toLowerCase();
  const systems = [];

  // Wall systems
  if (text.includes('porotherm')) {systems.push('keramické zdivo Porotherm');}
  else if (text.includes('ytong')) {systems.push('keramické zdivo Ytong');}
  else if (text.includes('zdivo')) {systems.push('keramické zdivo');}

  // Concrete systems
  if (text.includes('železobeton') || text.includes('žb')) {
    if (text.includes('stěny')) {systems.push('ŽB stěny');}
    if (text.includes('sloupy')) {systems.push('ŽB sloupy');}
    if (!systems.some(s => s.includes('ŽB'))) {systems.push('železobeton');}
  }

  // Steel
  if (text.includes('ocelová') || text.includes('steel')) {systems.push('ocelová konstrukce');}

  // Wood
  if (text.includes('dřevo') || text.includes('timber')) {systems.push('dřevěná konstrukce');}

  return systems;
}

/**
 * Check if STAVAGENT SmartParser is available
 *
 * @returns {Promise<boolean>} True if available
 */
export async function checkStavagentAvailability() {
  try {
    const pythonScript = `
import sys
sys.path.insert(0, '${STAVAGENT_PYTHON_PATH}')

try:
    from app.parsers.smart_parser import SmartParser
    print("available")
except Exception as e:
    print(f"error: {e}")
    sys.exit(1)
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript]);

    return new Promise((resolve) => {
      let stdout = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.on('close', (code) => {
        resolve(code === 0 && stdout.trim() === 'available');
      });

      pythonProcess.on('error', () => {
        resolve(false);
      });
    });

  } catch (error) {
    return false;
  }
}
