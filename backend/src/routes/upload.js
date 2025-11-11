/**
 * Upload routes
 * POST /api/upload - Upload XLSX file
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseXLSX, parseNumber } from '../services/parser.js';
import { logger } from '../utils/logger.js';
import db from '../db/init.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Check file extension
    const allowedExt = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExt.includes(ext)) {
      return cb(new Error('Pouze .xlsx a .xls soubory jsou povoleny'));
    }

    // Check MIME type
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/x-excel', // Alternative .xls MIME type
      'application/x-msexcel' // Another alternative
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      logger.warn(`Rejected file with invalid MIME type: ${file.mimetype} (${file.originalname})`);
      return cb(new Error(`Neplatný typ souboru: ${file.mimetype}. Očekáváno: Excel soubor (.xlsx nebo .xls)`));
    }

    cb(null, true);
  }
});

/**
 * Normalize bridge code for comparison (e.g., "SO  200" -> "SO 200")
 */
function normalizeBridgeCode(code) {
  return code.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Find OTSKP code by searching for similar work name in catalog
 * Returns best matching code or null if not found
 */
function findOtskpCodeByName(itemName, subtype) {
  if (!itemName) return null;

  try {
    const searchTermsUpper = itemName.toUpperCase();

    // Extract keywords for matching
    const keywords = itemName.split(/[\s\-\/]+/).filter(k => k.length > 3);

    // Build WHERE clause with subtype filter
    let whereConditions = [];
    let queryParams = [];

    // Subtype-specific filtering
    if (subtype === 'beton') {
      whereConditions.push("(UPPER(name) LIKE ? OR UPPER(name) LIKE ?)");
      queryParams.push('%BETON%', '%BETONOVÁNÍ%');
    } else if (subtype === 'bednění') {
      whereConditions.push("UPPER(name) LIKE ?");
      queryParams.push('%BEDN%');
    } else if (subtype === 'výztuž') {
      whereConditions.push("(UPPER(name) LIKE ? OR UPPER(name) LIKE ?)");
      queryParams.push('%VÝZTUŽ%', '%OCEL%');
    }

    // Add keyword matching (all keywords must be in name)
    for (const keyword of keywords) {
      whereConditions.push("UPPER(name) LIKE ?");
      queryParams.push(`%${keyword}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `SELECT code, name FROM otskp_codes ${whereClause} LIMIT 1`;

    const result = db.prepare(query).all(...queryParams)[0] || null;
    if (result) {
      logger.info(`[OTSKP Match] "${itemName}" -> ${result.code}`);
      return result.code;
    }

    return null;
  } catch (error) {
    logger.warn(`Error finding OTSKP code for "${itemName}":`, error.message);
    return null;
  }
}

/**
 * Convert raw Excel rows to position objects for a specific bridge
 * Extracts real data from Excel instead of using templates
 */
function convertRawRowsToPositions(rawRows, bridgeId) {
  const positions = [];
  let currentBridgeRows = [];
  let foundBridge = false;
  const normalizedBridgeId = normalizeBridgeCode(bridgeId);

  // First pass: find all rows for this bridge
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Check if this row contains the bridge ID (exact match)
    const rowText = Object.values(row).join(' ');
    const soMatch = rowText.match(/SO\s*\d+/i);
    if (soMatch && normalizeBridgeCode(soMatch[0]) === normalizedBridgeId) {
      foundBridge = true;
      currentBridgeRows = [];
      continue;
    }

    // If we found the bridge, collect rows until we hit the next bridge or end
    if (foundBridge) {
      // Check if we hit another SO code (next bridge) - EXACT comparison, not substring
      const hasAnotherSO = Object.values(row).some(val => {
        if (val && typeof val === 'string') {
          const match = val.match(/SO\s*\d+/i);
          if (match) {
            const foundSO = normalizeBridgeCode(match[0]);
            // Return true if this is a DIFFERENT bridge (exact comparison)
            return foundSO !== normalizedBridgeId;
          }
        }
        return false;
      });

      if (hasAnotherSO) {
        // Hit next bridge, stop collecting
        break;
      }

      // Check if this row has actual data (not empty)
      const hasData = Object.values(row).some(val => val !== null && val !== '');
      if (hasData) {
        currentBridgeRows.push(row);
      }
    }
  }

  logger.info(`[Upload Parse] Found ${currentBridgeRows.length} rows for bridge ${bridgeId}`);
  if (currentBridgeRows.length === 0) {
    logger.warn(`[Upload Parse] No rows found for bridge ${bridgeId}. Bridge code search might have failed.`);
  }

  // Second pass: extract positions from collected rows
  for (const row of currentBridgeRows) {
    try {
      // Find column values (handle different possible column names)
      const partName = findColumnValue(row, ['Název části konstrukce', 'Part', 'Část', 'Element']);
      const itemName = findColumnValue(row, ['Název položky', 'Nazev polozky', 'Item', 'Položka', 'Popis']);
      const subtypeRaw = findColumnValue(row, ['Podtyp', 'Typ práce', 'Subtype', 'Type']);
      const unit = findColumnValue(row, ['MJ', 'Jednotka', 'Unit']);
      const qtyRaw = findColumnValue(row, ['Množství', 'Mnozstvi', 'Quantity', 'Qty']);
      const otskpRaw = findColumnValue(row, ['OTSKP', 'Kód', 'Code']);
      const crewSizeRaw = findColumnValue(row, ['lidi', 'Lidi', 'Crew', 'Počet lidí']);
      const wageRaw = findColumnValue(row, ['Kč/hod', 'Kc/hod', 'Wage']);
      const hoursRaw = findColumnValue(row, ['Hod/den', 'Hours', 'Shift']);
      const daysRaw = findColumnValue(row, ['den (koef 1)', 'den', 'Days', 'Dny']);

      // Check if row has ANY useful data (name, qty, price, or crew info)
      const hasUsefulData = partName || itemName || qtyRaw || wageRaw || crewSizeRaw;
      if (!hasUsefulData) {
        logger.debug(`[Upload Parse] Skipping empty row with no useful data`);
        continue;
      }

      // If no names but has data, generate generic names
      if (!partName && !itemName) {
        logger.warn(`[Upload Parse] Row has data (qty=${qtyRaw}, wage=${wageRaw}) but no names - generating defaults`);
        // Will be set to defaults below
      }

      // Log the row being processed for debugging
      logger.info(`[Upload Parse] Processing row: part="${partName}", item="${itemName}", unit="${unit}", qty=${qtyRaw}, wage=${wageRaw}, otskp=${otskpRaw}`);

      // Filter: Only concrete-related work
      const fullText = `${partName || ''} ${itemName || ''} ${subtypeRaw || ''}`.toLowerCase();

      // Check unit type (M3, m2, t = concrete-related)
      const unitLower = unit ? unit.toLowerCase() : '';
      const isConcreteUnit = unitLower === 'm3' || unitLower === 'm²' || unitLower === 'm2' || unitLower === 't';

      // Check text for concrete keywords (more comprehensive list)
      const isConcrete = fullText.includes('beton') ||
                        fullText.includes('betón') ||
                        fullText.includes('bednění') ||
                        fullText.includes('výztuž') ||
                        fullText.includes('ocel') ||
                        fullText.includes('základy') ||
                        fullText.includes('základu') ||
                        fullText.includes('римsy') ||
                        fullText.includes('opěr') ||
                        fullText.includes('pilíř') ||
                        fullText.includes('nosn') ||
                        fullText.includes('most') ||
                        fullText.includes('desk') ||
                        fullText.includes('pažen') ||
                        fullText.includes('vrty') ||
                        fullText.includes('drenáž') ||
                        fullText.includes('drénáž');

      // Also accept if OTSKP code exists (will be checked later in code)
      const hasOtskpCode = !!otskpRaw;

      // Accept if: has concrete text OR concrete unit OR OTSKP code, AND has qty/price
      const hasPrice = qtyRaw || wageRaw || crewSizeRaw;
      const acceptRow = (isConcrete || isConcreteUnit || hasOtskpCode) && hasPrice;

      if (!acceptRow) {
        logger.info(`[Upload Parse] ❌ Skipping row (not concrete, no unit, no price): "${fullText.slice(0, 50)}", unit="${unit}", qty=${qtyRaw}, wage=${wageRaw}, otskp=${otskpRaw}`);
        continue;
      }

      logger.info(`[Upload Parse] ✅ Row ACCEPTED: concrete=${isConcrete}, unit=${isConcreteUnit}, otskp=${hasOtskpCode}, price=${hasPrice}`);

      // EXCLUDE: Prefabricated elements (prefa dilce)
      const isPrefab = fullText.includes('prefa') ||
                       fullText.includes('prefabricated') ||
                       fullText.includes('dilce') ||
                       fullText.includes('díl') ||
                       fullText.includes('hotov') ||
                       fullText.includes('prefab');

      if (isPrefab) {
        logger.info(`Skipping prefab item: ${itemName || partName}`);
        continue;
      }

      // Determine subtype
      let subtype = 'beton'; // default
      if (subtypeRaw) {
        const subtypeLower = subtypeRaw.toLowerCase();
        if (subtypeLower.includes('bedn') || subtypeLower.includes('formwork')) {
          subtype = 'bednění';
        } else if (subtypeLower.includes('výztuž') || subtypeLower.includes('reinforcement') || subtypeLower.includes('ocel')) {
          subtype = 'výztuž';
        } else if (subtypeLower.includes('oboustran')) {
          subtype = 'oboustranné';
        }
      } else if (unit) {
        // Infer from unit
        const unitLower = unit.toLowerCase();
        if (unitLower === 'm3' || unitLower === 'M3') {
          subtype = 'beton';
        } else if (unitLower === 'm2' || unitLower === 'm²') {
          subtype = 'bednění';
        } else if (unitLower === 't' || unitLower === 'kg') {
          subtype = 'výztuž';
        }
      }

      // Extract OTSKP code (5-6 digits from Excel)
      let otskpCode = null;
      if (otskpRaw) {
        const otskpMatch = String(otskpRaw).match(/\d{5,6}/);
        if (otskpMatch) {
          otskpCode = otskpMatch[0];
          logger.info(`[OTSKP] Found code in Excel: ${otskpCode} for "${itemName}"`);
        }
      }

      // If code not found in Excel, try to find it by work name
      if (!otskpCode && itemName) {
        const autoFoundCode = findOtskpCodeByName(itemName, subtype);
        if (autoFoundCode) {
          otskpCode = autoFoundCode;
          logger.info(`[OTSKP Auto] Found code by name match: ${otskpCode} for "${itemName}"`);
        }
      }

      // Parse numeric values
      const qty = parseNumber(qtyRaw);
      const crewSize = parseNumber(crewSizeRaw) || 4; // default 4
      const wage = parseNumber(wageRaw) || 398; // default 398
      const hours = parseNumber(hoursRaw) || 10; // default 10
      const days = parseNumber(daysRaw) || 0;

      // Create position object
      const position = {
        part_name: partName || itemName || 'Neznámá část',
        item_name: itemName || partName || 'Neznámá položka',
        subtype: subtype,
        unit: unit || (subtype === 'beton' ? 'M3' : 'm2'),
        qty: qty,
        crew_size: crewSize,
        wage_czk_ph: wage,
        shift_hours: hours,
        days: days,
        otskp_code: otskpCode
      };

      positions.push(position);
      logger.info(`Extracted position: ${position.part_name} - ${position.subtype} (${position.qty} ${position.unit}, OTSKP: ${otskpCode || 'N/A'})`);
    } catch (error) {
      logger.error('Error extracting position from row:', error);
    }
  }

  return positions;
}

/**
 * Find value in row by trying multiple possible column names
 */
function findColumnValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
    // Try case-insensitive match
    const keys = Object.keys(row);
    for (const key of keys) {
      if (key.toLowerCase().includes(name.toLowerCase())) {
        if (row[key] !== null && row[key] !== '') {
          return row[key];
        }
      }
    }
  }
  return null;
}

// POST upload XLSX
router.post('/', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = req.file.path;
    const import_id = uuidv4();

    logger.info(`Processing upload: ${req.file.originalname} (${import_id})`);

    // Parse XLSX
    const parseResult = await parseXLSX(filePath);

    // Auto-create bridges in database
    const createdBridges = [];

    // Template positions (11 default parts)
    const templatePositions = [
      // 1. ZÁKLADY ZE ŽELEZOBETONU DO C30/37
      { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'bednění', unit: 'm2' },

      // 2. ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)
      { part_name: 'ŘÍMSY', item_name: 'ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
      { part_name: 'ŘÍMSY', item_name: 'ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

      // 3. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (opěry)', unit: 'm2' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (křídla)', unit: 'm2' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (závěrné zídky)', unit: 'm2' },

      // 4. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'bednění', unit: 'm2' },

      // 5. MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)
      { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

      // 6. PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30
      { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'beton', unit: 'M3' },
      { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'bednění', unit: 'm2' },

      // 7. MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37
      { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'bednění', unit: 'm2' },

      // 8. SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25
      { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'beton', unit: 'M3' },
      { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'bednění', unit: 'm2' },

      // 9. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15
      { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'beton', unit: 'M3' },
      { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'bednění', unit: 'm2' },

      // 10. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25
      { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'beton', unit: 'M3' },
      { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'bednění', unit: 'm2' },

      // 11. PATKY Z PROSTÉHO BETONU C25/30
      { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'beton', unit: 'M3' },
      { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'bednění', unit: 'm2' }
    ];

    const insertPosition = db.prepare(`
      INSERT INTO positions (
        id, bridge_id, part_name, item_name, subtype, unit,
        qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const bridge of parseResult.bridges) {
      try {
        // Check if bridge already exists
        const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge.bridge_id);

        if (!existing) {
          db.prepare(`
            INSERT INTO bridges (bridge_id, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            bridge.bridge_id,
            bridge.object_name,
            bridge.span_length_m || 0,
            bridge.deck_width_m || 0,
            bridge.pd_weeks || 0,
            bridge.concrete_m3 || 0
          );

          logger.info(`Created bridge: ${bridge.bridge_id}`);

          // Extract positions from Excel data for this bridge
          const extractedPositions = convertRawRowsToPositions(parseResult.raw_rows, bridge.bridge_id);

          // Insert extracted positions (or use templates if nothing extracted)
          let positionsToInsert = extractedPositions;

          // Fallback to templates if no positions were extracted
          if (extractedPositions.length === 0) {
            logger.warn(`No positions extracted from Excel for ${bridge.bridge_id}, using templates`);
            positionsToInsert = templatePositions;
          }

          positionsToInsert.forEach((pos, index) => {
            const id = `${bridge.bridge_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;

            // Try to find OTSKP code if not present
            let otskpCode = pos.otskp_code;
            if (!otskpCode && pos.item_name) {
              otskpCode = findOtskpCodeByName(pos.item_name, pos.subtype);
              if (otskpCode) {
                logger.info(`[OTSKP Auto Template] Found code for template: ${otskpCode} - ${pos.item_name}`);
              }
            }

            insertPosition.run(
              id,
              bridge.bridge_id,
              pos.part_name,
              pos.item_name,
              pos.subtype,
              pos.unit,
              pos.qty || 0,
              pos.crew_size || 4,
              pos.wage_czk_ph || 398,
              pos.shift_hours || 10,
              pos.days || 0,
              otskpCode || null
            );
          });

          logger.info(`Created ${positionsToInsert.length} positions for bridge ${bridge.bridge_id} (${extractedPositions.length} from Excel, ${positionsToInsert.length - extractedPositions.length} from templates)`);

          createdBridges.push({
            bridge_id: bridge.bridge_id,
            object_name: bridge.object_name,
            concrete_m3: bridge.concrete_m3 || 0,
            positions_created: positionsToInsert.length,
            positions_from_excel: extractedPositions.length
          });
        } else {
          logger.info(`Bridge already exists: ${bridge.bridge_id}`);
          createdBridges.push({
            bridge_id: bridge.bridge_id,
            object_name: bridge.object_name,
            concrete_m3: bridge.concrete_m3 || 0,
            note: 'Existing bridge - check if concrete quantity needs update'
          });
        }
      } catch (error) {
        logger.error(`Error creating bridge ${bridge.bridge_id}:`, error);
      }
    }

    // Count total positions created
    const totalPositions = createdBridges.reduce((sum, b) => sum + (b.positions_created || 0), 0);
    const totalFromExcel = createdBridges.reduce((sum, b) => sum + (b.positions_from_excel || 0), 0);

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json({
      import_id,
      filename: req.file.originalname,
      bridges: createdBridges,
      mapping_suggestions: parseResult.mapping_suggestions,
      raw_rows: parseResult.raw_rows,
      row_count: parseResult.raw_rows.length,
      status: 'success',
      message: `Created ${createdBridges.length} bridges with ${totalPositions} positions (${totalFromExcel} from Excel, ${totalPositions - totalFromExcel} from templates)`
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up uploaded file after processing (success or failure)
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up uploaded file: ${filePath}`);
      } catch (cleanupError) {
        logger.warn(`Failed to clean up file ${filePath}:`, cleanupError.message);
      }
    }
  }
});

export default router;
