/**
 * Document Extraction Service
 * Orchestrates: PDF → MinerU → LLM → TSKP → Deduplication → Batch URS Matching
 *
 * Pipeline:
 * 1. Upload to concrete-agent (MinerU parser)
 * 2. Extract work descriptions with LLM
 * 3. Match to TSKP codes
 * 4. Deduplicate (85% similarity threshold)
 * 5. Create batch job for URS matching
 */

import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { calculateSimilarity } from '../utils/similarity.js';
import tskpParserService from './tskpParserService.js';
import { callLLMForTask, TASKS } from './llmClient.js';

const CONCRETE_AGENT_URL = process.env.STAVAGENT_API_URL || 'https://concrete-agent.onrender.com';
const SIMILARITY_THRESHOLD = 0.85; // 85% similarity for deduplication
const PARSE_TIMEOUT_MS = 120000; // 2 minutes (lightweight parse, not full Workflow C)

/**
 * Upload document to concrete-agent for LIGHTWEIGHT parsing.
 *
 * Uses /api/upload with auto_start_audit=false, generate_summary=false
 * to avoid the heavy Multi-Role AI pipeline that crashes 512MB servers.
 *
 * Memory: ~100MB (vs 500-750MB for full Workflow C)
 */
async function parseDocumentWithConcreteAgent(filePath) {
  const startTime = Date.now();
  try {
    logger.info(`[DocExtract] Uploading to concrete-agent (lightweight parse): ${filePath}`);

    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    const formData = new FormData();

    // Use /api/upload with parse-only mode (no audit, no summary)
    formData.append('vykaz_vymer', fileBuffer, {
      filename: fileName,
      contentType: fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
    });
    formData.append('project_name', `doc-extract-${Date.now()}`);
    formData.append('workflow', 'A');
    formData.append('auto_start_audit', 'false');      // Skip Multi-Role AI (saves ~250MB)
    formData.append('generate_summary', 'false');       // Skip summary (saves ~100MB)
    formData.append('enable_enrichment', 'false');      // Skip enrichment (saves ~50MB)

    logger.info(`[DocExtract] Calling /api/upload (parse-only, timeout: ${PARSE_TIMEOUT_MS / 1000}s)...`);

    const response = await axios.post(
      `${CONCRETE_AGENT_URL}/api/upload`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: PARSE_TIMEOUT_MS,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const data = response.data;

    if (!data || !data.project_id) {
      throw new Error(data?.error || 'Neplatná odpověď z concrete-agent');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const posCount = data.positions_total || data.positions_raw || 0;
    logger.info(`[DocExtract] ✓ Parsed in ${duration}s: project_id=${data.project_id}, ${posCount} positions`);

    // Build positions from response
    const positions = [];
    let fullText = '';

    // If response contains parsed positions directly
    if (data.positions && Array.isArray(data.positions)) {
      for (const pos of data.positions) {
        positions.push({
          code: pos.code || pos.urs_code || '',
          description: pos.description || pos.name || pos.text || '',
          quantity: pos.quantity || null,
          unit: pos.unit || '',
          unit_price: pos.unit_price || null,
          total_price: pos.total_price || null
        });
      }
      fullText = positions.map(p =>
        `${p.code} ${p.description} ${p.quantity || ''} ${p.unit}`
      ).join('\n');
    }

    // If the server returned message/status but no positions yet,
    // try to fetch the parsed data from the project endpoint
    if (positions.length === 0 && data.project_id) {
      logger.info(`[DocExtract] No positions in upload response, fetching project data...`);
      try {
        const projectResponse = await axios.get(
          `${CONCRETE_AGENT_URL}/api/project/${data.project_id}`,
          { timeout: 30000 }
        );
        const projectData = projectResponse.data;
        if (projectData?.positions && Array.isArray(projectData.positions)) {
          for (const pos of projectData.positions) {
            positions.push({
              code: pos.code || pos.urs_code || '',
              description: pos.description || pos.name || pos.text || '',
              quantity: pos.quantity || null,
              unit: pos.unit || '',
              unit_price: pos.unit_price || null,
              total_price: pos.total_price || null
            });
          }
          fullText = positions.map(p =>
            `${p.code} ${p.description} ${p.quantity || ''} ${p.unit}`
          ).join('\n');
        }

        // If still no positions, get file text from diagnostics or message
        if (positions.length === 0) {
          fullText = projectData?.message || data?.message || '';
          if (projectData?.diagnostics) {
            fullText += '\n' + JSON.stringify(projectData.diagnostics);
          }
        }
      } catch (fetchError) {
        logger.warn(`[DocExtract] Could not fetch project data: ${fetchError.message}`);
        fullText = data?.message || '';
      }
    }

    logger.info(`[DocExtract] Extracted ${fullText.length} chars of text, ${positions.length} positions`);

    return {
      fullText: fullText,
      positions: positions,
      sections: [],
      metadata: {
        project_id: data.project_id,
        positions_count: posCount,
        duration_seconds: parseFloat(duration),
        parse_mode: 'lightweight'
      }
    };

  } catch (error) {
    logger.error(`[DocExtract] Parsing failed: ${error.message}`);

    if (error.response) {
      logger.error(`[DocExtract] Response status: ${error.response.status}`);
      logger.error(`[DocExtract] Response data: ${JSON.stringify(error.response.data)?.substring(0, 500)}`);
    }

    const err = new Error(`Parsing failed: ${error.message}`);
    err.stage = 'document_parsing';
    if (error.code === 'ECONNABORTED') {
      err.suggestion = 'Server concrete-agent neodpovídá. Možná se spouští (cold start ~30s). Zkuste za minutu znovu.';
    } else if (error.response?.status === 502 || error.response?.status === 503) {
      err.suggestion = 'Server concrete-agent je momentálně nedostupný nebo přetížený (512MB RAM limit). Zkuste za 2 minuty.';
    } else {
      err.suggestion = 'Zkontrolujte, že soubor je platný PDF/DOCX s textovou vrstvou.';
    }
    throw err;
  }
}

/**
 * Extract work descriptions from text using LLM
 */
async function extractWorksWithLLM(fullText, existingPositions = []) {
  try {
    logger.info(`[DocExtract] Extracting works with LLM...`);

    // Build prompts
    const systemPrompt = 'Jsi expert na analýzu stavebních dokumentů a extrakci pracovních položek z technických zadání a výkresové dokumentace.';
    const userPrompt = buildExtractionPrompt(fullText, existingPositions);

    // Try structured JSON first, fallback to free-form
    let extractedWorks;

    try {
      // Attempt structured JSON response
      const jsonUserPrompt = userPrompt + '\n\nVÁŽNO: Odpověz POUZE validním JSON massivem, bez jakéhokoli dalšího textu.';
      const response = await callLLMForTask(
        TASKS.BLOCK_ANALYSIS,
        systemPrompt,
        jsonUserPrompt,
        90000 // 90s timeout
      );
      extractedWorks = parseStructuredResponse(response);

      logger.info(`[DocExtract] ✓ Extracted ${extractedWorks.length} works (structured)`);
    } catch (jsonError) {
      logger.warn(`[DocExtract] JSON parsing failed, trying free-form: ${jsonError.message}`);

      // Fallback to free-form parsing
      const response = await callLLMForTask(
        TASKS.BLOCK_ANALYSIS,
        systemPrompt,
        userPrompt,
        90000 // 90s timeout
      );
      extractedWorks = parseFreeFormResponse(response);

      logger.info(`[DocExtract] ✓ Extracted ${extractedWorks.length} works (free-form)`);
    }

    return extractedWorks;

  } catch (error) {
    logger.error(`[DocExtract] LLM extraction failed: ${error.message}`);
    throw new Error(`Failed to extract works: ${error.message}`);
  }
}

/**
 * Build LLM prompt for work extraction
 */
function buildExtractionPrompt(fullText, existingPositions) {
  const hasPositions = existingPositions.length > 0;

  let prompt = `Analyzuj tento dokument a extrahuj seznam stavebních prací.

DOKUMENT:
${fullText.substring(0, 15000)} ${fullText.length > 15000 ? '...(zkráceno)' : ''}

`;

  if (hasPositions) {
    prompt += `JIŽ NALEZENÉ POZICE (pro kontext):
${existingPositions.slice(0, 20).map((p, i) => `${i + 1}. ${p.description || p.name || ''}`).join('\n')}

`;
  }

  prompt += `ÚKOL:
1. Identifikuj všechny stavební práce v dokumentu
2. Pro každou práci urči:
   - Název práce (stručný, ale popisný)
   - Kategorie podle TSKP (zemní práce, beton, výztuž, atd.)
   - Jednotka (m³, m², kg, m, ks, hod, atd.)
   - Množství (pokud uvedeno, jinak null)

3. Sdružuj související práce do sekcí (např. "Základy", "Nosné konstrukce", "Izolace")

FORMÁT ODPOVĚDI (JSON):
[
  {
    "section": "Název sekce",
    "works": [
      {
        "name": "Název práce",
        "category": "Kategorie TSKP",
        "unit": "m³",
        "quantity": 123.45
      }
    ]
  }
]

PRAVIDLA:
- Ignoruj administrativní položky (doprava dokumentů, koordinace, atd.)
- Sdružuj podobné práce (např. všechny betonáže do jedné sekce)
- Používej standardní jednotky (m³, m², kg, m, ks, hod)
- Pokud množství není uvedeno, dej quantity: null
- Pokud není jasná sekce, dej section: "Obecné práce"
`;

  return prompt;
}

/**
 * Parse structured JSON response
 */
function parseStructuredResponse(response) {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```\n?/g, '');
  }

  const sections = JSON.parse(cleaned);

  if (!Array.isArray(sections)) {
    throw new Error('Response is not an array');
  }

  const works = [];
  for (const section of sections) {
    const sectionName = section.section || 'Obecné práce';
    const sectionWorks = section.works || [];

    for (const work of sectionWorks) {
      works.push({
        name: work.name || '',
        category: work.category || '',
        unit: work.unit || '',
        quantity: work.quantity || null,
        section: sectionName
      });
    }
  }

  return works;
}

/**
 * Parse free-form text response
 */
function parseFreeFormResponse(response) {
  const works = [];
  const lines = response.split('\n');

  let currentSection = 'Obecné práce';

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers (e.g., "## Základy", "SEKCE: Nosné konstrukce")
    if (
      trimmed.startsWith('##') ||
      trimmed.startsWith('SEKCE:') ||
      trimmed.startsWith('Sekce:') ||
      (trimmed.toUpperCase() === trimmed && trimmed.length > 5 && trimmed.length < 50)
    ) {
      currentSection = trimmed.replace(/^##\s*/, '').replace(/^SEKCE:\s*/i, '').trim();
      continue;
    }

    // Detect work items (numbered or bulleted)
    const workMatch = trimmed.match(/^[\d\-\*\.]+\s+(.+?)(?:\s+[-–—]\s+(.+?))?(?:\s+\((.+?)\))?$/);
    if (workMatch) {
      const name = workMatch[1]?.trim() || '';
      const category = workMatch[2]?.trim() || '';
      const unitQuantity = workMatch[3]?.trim() || '';

      // Parse unit and quantity
      let unit = '';
      let quantity = null;

      if (unitQuantity) {
        const unitMatch = unitQuantity.match(/(\d+[\.,]?\d*)\s*([a-zA-Z³²]+)/);
        if (unitMatch) {
          quantity = parseFloat(unitMatch[1].replace(',', '.'));
          unit = unitMatch[2];
        } else {
          unit = unitQuantity;
        }
      }

      if (name) {
        works.push({
          name,
          category,
          unit,
          quantity,
          section: currentSection
        });
      }
    }
  }

  return works;
}

/**
 * Match works to TSKP codes
 */
async function matchToTSKP(works) {
  logger.info(`[DocExtract] Matching ${works.length} works to TSKP codes...`);

  const matched = [];

  for (const work of works) {
    // Search TSKP by work name + category
    const searchText = `${work.name} ${work.category}`.trim();
    const tskpResults = tskpParserService.search(searchText, 3);

    if (tskpResults.length > 0) {
      const bestMatch = tskpResults[0];

      matched.push({
        ...work,
        tskp_code: bestMatch.tskp_code,
        tskp_name: bestMatch.name,
        tskp_confidence: bestMatch.confidence
      });
    } else {
      // No TSKP match found
      matched.push({
        ...work,
        tskp_code: null,
        tskp_name: null,
        tskp_confidence: 0
      });
    }
  }

  const matchedCount = matched.filter(w => w.tskp_code).length;
  logger.info(`[DocExtract] ✓ Matched ${matchedCount}/${matched.length} works to TSKP`);

  return matched;
}

/**
 * Deduplicate works using Levenshtein distance
 * Threshold: 0.85 (85% similarity)
 */
function deduplicateWorks(works, threshold = SIMILARITY_THRESHOLD) {
  logger.info(`[DocExtract] Deduplicating ${works.length} works (threshold: ${threshold})...`);

  const unique = [];
  const seen = new Set();

  for (const work of works) {
    let isDuplicate = false;
    const workKey = `${work.name} ${work.tskp_code || ''}`.toLowerCase();

    // Check against already added works
    for (const existingWork of unique) {
      const existingKey = `${existingWork.name} ${existingWork.tskp_code || ''}`.toLowerCase();
      const similarity = calculateSimilarity(workKey, existingKey);

      if (similarity >= threshold) {
        isDuplicate = true;

        // Merge quantities if both have them
        if (work.quantity && existingWork.quantity) {
          existingWork.quantity += work.quantity;
          existingWork.merged_count = (existingWork.merged_count || 1) + 1;
        }

        break;
      }
    }

    if (!isDuplicate) {
      unique.push({
        ...work,
        merged_count: 1
      });
    }
  }

  logger.info(`[DocExtract] ✓ Deduplicated: ${works.length} → ${unique.length} unique works`);

  return unique;
}

// NOTE: calculateSimilarity and levenshteinDistance moved to utils/similarity.js

/**
 * Main orchestrator: Extract works from document
 */
export async function extractWorksFromDocument(filePath) {
  let pipelineStage = 'init';
  try {
    logger.info(`[DocExtract] Starting extraction pipeline: ${filePath}`);

    // 1. Parse with concrete-agent Workflow C
    pipelineStage = 'mineru_parsing';
    const parsedData = await parseDocumentWithConcreteAgent(filePath);

    let extractedWorks = [];

    // 2. If we have positions directly from Workflow C, use them
    pipelineStage = 'work_extraction';
    if (parsedData.positions && parsedData.positions.length > 0) {
      logger.info(`[DocExtract] Using ${parsedData.positions.length} positions from Workflow C`);

      extractedWorks = parsedData.positions.map(pos => ({
        name: pos.description || '',
        category: '',
        unit: pos.unit || '',
        quantity: pos.quantity || null,
        section: 'Obecné práce'
      }));
    }
    // 3. If we have text but no positions, extract with LLM
    else if (parsedData.fullText && parsedData.fullText.trim().length > 0) {
      pipelineStage = 'llm_extraction';
      logger.info(`[DocExtract] Extracting works from text with LLM...`);
      extractedWorks = await extractWorksWithLLM(
        parsedData.fullText,
        parsedData.positions
      );
    }

    if (extractedWorks.length === 0) {
      const err = new Error('Žádné práce nebyly extrahovány z dokumentu. Zkontrolujte, že dokument obsahuje strukturované položky.');
      err.stage = pipelineStage;
      err.suggestion = 'Zkuste jiný formát souboru (PDF s textovou vrstvou) nebo soubor s jasně strukturovaným seznamem prací.';
      throw err;
    }

    // 4. Match to TSKP codes
    pipelineStage = 'tskp_matching';
    const worksWithTSKP = await matchToTSKP(extractedWorks);

    // 5. Deduplicate (85% threshold)
    pipelineStage = 'deduplication';
    const uniqueWorks = deduplicateWorks(worksWithTSKP, SIMILARITY_THRESHOLD);

    // 6. Group by section
    pipelineStage = 'grouping';
    const sections = groupBySection(uniqueWorks);

    logger.info(`[DocExtract] ✅ Extraction complete: ${uniqueWorks.length} unique works in ${sections.length} sections`);

    return {
      works: uniqueWorks,
      sections: sections,
      stats: {
        total_extracted: extractedWorks.length,
        after_deduplication: uniqueWorks.length,
        tskp_matched: uniqueWorks.filter(w => w.tskp_code).length,
        sections_count: sections.length
      },
      metadata: parsedData.metadata
    };

  } catch (error) {
    logger.error(`[DocExtract] Pipeline failed at stage "${pipelineStage}": ${error.message}`);
    // Attach pipeline stage info to error for frontend
    if (!error.stage) error.stage = pipelineStage;
    throw error;
  }
}

/**
 * Group works by section
 */
function groupBySection(works) {
  const sectionMap = new Map();

  for (const work of works) {
    const section = work.section || 'Obecné práce';

    if (!sectionMap.has(section)) {
      sectionMap.set(section, []);
    }

    sectionMap.get(section).push(work);
  }

  const sections = [];
  for (const [name, items] of sectionMap.entries()) {
    sections.push({
      name,
      works: items,
      count: items.length
    });
  }

  // Sort sections by work count (descending)
  sections.sort((a, b) => b.count - a.count);

  return sections;
}

export default {
  extractWorksFromDocument
};
