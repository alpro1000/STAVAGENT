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
import tskpParserService from './tskpParserService.js';
import { callLLMForTask, TASKS } from './llmClient.js';

const CONCRETE_AGENT_URL = process.env.STAVAGENT_API_URL || 'https://concrete-agent.onrender.com';
const SIMILARITY_THRESHOLD = 0.85; // 85% similarity for deduplication
const MINERU_TIMEOUT_MS = 300000; // 5 minutes for cold start + large PDF parsing

/**
 * Upload document to concrete-agent for MinerU parsing
 */
async function parseDocumentWithMinerU(filePath) {
  const startTime = Date.now();
  try {
    logger.info(`[DocExtract] Uploading to concrete-agent: ${filePath}`);

    const formData = new FormData();
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: 'application/pdf'
    });

    // Add required form fields for Workflow C
    formData.append('project_id', `doc-extract-${Date.now()}`);
    formData.append('project_name', 'Document Work Extraction');
    formData.append('generate_summary', 'false'); // We don't need LLM summary
    formData.append('use_parallel', 'false');
    formData.append('language', 'cs');

    logger.info(`[DocExtract] Calling concrete-agent (timeout: ${MINERU_TIMEOUT_MS / 1000}s for cold start + parsing)...`);

    const response = await axios.post(
      `${CONCRETE_AGENT_URL}/api/v1/workflow/c/upload`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: MINERU_TIMEOUT_MS, // 5 minutes for cold start + large PDF
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    if (!response.data || !response.data.result) {
      throw new Error('Invalid response from concrete-agent');
    }

    const result = response.data.result;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.info(`[DocExtract] ✓ Parsed by MinerU in ${duration}s: ${result.positions_count || 0} positions found`);

    return {
      fullText: result.full_text || '',
      positions: result.positions || [],
      sections: result.sections || [],
      metadata: result.metadata || {}
    };

  } catch (error) {
    logger.error(`[DocExtract] MinerU parsing failed: ${error.message}`);

    // Log response data for debugging
    if (error.response) {
      logger.error(`[DocExtract] Response status: ${error.response.status}`);
      logger.error(`[DocExtract] Response data: ${JSON.stringify(error.response.data)}`);
    }

    throw new Error(`Failed to parse document: ${error.message}`);
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

/**
 * Calculate similarity using Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) {
    return 1.0;
  }

  return 1.0 - (distance / maxLength);
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Main orchestrator: Extract works from document
 */
export async function extractWorksFromDocument(filePath) {
  try {
    logger.info(`[DocExtract] Starting extraction pipeline: ${filePath}`);

    // 1. Parse with MinerU
    const parsedData = await parseDocumentWithMinerU(filePath);

    // 2. Extract works with LLM
    const extractedWorks = await extractWorksWithLLM(
      parsedData.fullText,
      parsedData.positions
    );

    if (extractedWorks.length === 0) {
      throw new Error('No works extracted from document');
    }

    // 3. Match to TSKP codes
    const worksWithTSKP = await matchToTSKP(extractedWorks);

    // 4. Deduplicate (85% threshold)
    const uniqueWorks = deduplicateWorks(worksWithTSKP, SIMILARITY_THRESHOLD);

    // 5. Group by section
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
    logger.error(`[DocExtract] Pipeline failed: ${error.message}`);
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
