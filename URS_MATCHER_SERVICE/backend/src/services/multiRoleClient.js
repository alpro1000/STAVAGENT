/**
 * Multi-Role AI Client
 * Фаза 3: Интеграция с STAVAGENT Multi-Role System
 *
 * Provides access to 6 specialist AI roles:
 * - Document Validator
 * - Structural Engineer
 * - Concrete Specialist
 * - Cost Estimator
 * - Standards Checker
 * - Project Manager
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to STAVAGENT concrete-agent Python API
const STAVAGENT_API_BASE = process.env.STAVAGENT_API_URL || 'http://localhost:8000';

/**
 * Ask question to Multi-Role AI System
 *
 * @param {string} question - The question to ask
 * @param {Object} options - Options for multi-role execution
 * @returns {Promise<Object>} Multi-role answer with metadata
 */
export async function askMultiRole(question, options = {}) {
  const {
    context = null,
    projectId = null,
    enableKb = true,
    enablePerplexity = false,
    useCache = true,
    sessionId = null
  } = options;

  logger.info(`[MULTI-ROLE] Asking question: ${question.substring(0, 100)}...`);

  const requestBody = {
    question,
    context,
    project_id: projectId,
    enable_kb: enableKb,
    enable_perplexity: enablePerplexity,
    use_cache: useCache,
    session_id: sessionId
  };

  try {
    // Call STAVAGENT Multi-Role API via HTTP
    const response = await fetch(`${STAVAGENT_API_BASE}/api/v1/multi-role/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Multi-Role API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    logger.info(`[MULTI-ROLE] Response received (${result.complexity} complexity, ${result.roles_consulted.length} roles)`);

    if (result.conflicts && result.conflicts.length > 0) {
      logger.warn(`[MULTI-ROLE] ${result.conflicts.length} conflicts detected and resolved`);
    }

    return result;

  } catch (error) {
    logger.error(`[MULTI-ROLE] Request failed: ${error.message}`);
    throw error;
  }
}

/**
 * Validate BOQ block using Document Validator role
 *
 * @param {Object} boqBlock - BOQ block with rows
 * @param {Object} projectContext - Project context
 * @returns {Promise<Object>} Validation results
 */
export async function validateBoqBlock(boqBlock, projectContext) {
  logger.info(`[MULTI-ROLE] Validating BOQ block: ${boqBlock.title}`);

  const question = `
Validate this BOQ block for completeness and accuracy:

Block: ${boqBlock.title}
Number of items: ${boqBlock.rows.length}

Project Context:
- Building Type: ${projectContext.building_type || 'not specified'}
- Storeys: ${projectContext.storeys || 'not specified'}
- Main Systems: ${projectContext.main_system?.join(', ') || 'not specified'}

BOQ Items:
${boqBlock.rows.slice(0, 10).map((row, i) =>
  `${i + 1}. ${row.raw_text} (${row.quantity} ${row.unit})`
).join('\n')}
${boqBlock.rows.length > 10 ? `\n... and ${boqBlock.rows.length - 10} more items` : ''}

Check for:
1. Missing critical items (e.g., formwork, scaffolding, waterproofing)
2. Inconsistent specifications
3. Compliance with building type requirements
4. Potential safety issues

Provide structured response with:
- Missing items (if any)
- Warnings
- Critical issues
- Overall completeness score (0-100%)
`;

  const result = await askMultiRole(question, {
    context: {
      project_context: projectContext,
      boq_block: boqBlock
    },
    enableKb: true,
    enablePerplexity: false
  });

  return {
    completeness_score: extractCompletenessScore(result.answer),
    missing_items: result.warnings.filter(w => w.toLowerCase().includes('missing')),
    warnings: result.warnings,
    critical_issues: result.critical_issues,
    confidence: result.confidence,
    roles_consulted: result.roles_consulted
  };
}

/**
 * Verify URS code selection using Multi-Role System
 *
 * @param {string} workDescription - Work description from BOQ
 * @param {string} selectedUrsCode - Selected URS code
 * @param {Object} projectContext - Project context
 * @returns {Promise<Object>} Verification results
 */
export async function verifyUrsCode(workDescription, selectedUrsCode, projectContext) {
  logger.info(`[MULTI-ROLE] Verifying URS code ${selectedUrsCode} for: ${workDescription}`);

  const question = `
Verify if URS code ${selectedUrsCode} is appropriate for this work:

Work Description: "${workDescription}"

Project Context:
- Building Type: ${projectContext.building_type || 'not specified'}
- Main Systems: ${projectContext.main_system?.join(', ') || 'not specified'}

Questions:
1. Is ${selectedUrsCode} the correct code for this work?
2. Are there any conflicts or inconsistencies?
3. What related items should be included (tech-rules)?
4. Any warnings or recommendations?

Provide:
- Verification status (✅ correct / ⚠️ questionable / ❌ incorrect)
- Reason for status
- Alternative codes if incorrect
- Related mandatory items (tech-rules)
`;

  const result = await askMultiRole(question, {
    context: {
      work_description: workDescription,
      urs_code: selectedUrsCode,
      project_context: projectContext
    },
    enableKb: true,
    enablePerplexity: false
  });

  return {
    is_correct: !result.answer.includes('❌'),
    is_questionable: result.answer.includes('⚠️'),
    reason: result.answer,
    alternatives: extractAlternatives(result.answer),
    related_items: extractRelatedItems(result.answer),
    warnings: result.warnings,
    confidence: result.confidence,
    roles_consulted: result.roles_consulted
  };
}

/**
 * Resolve conflicts between URS code candidates
 *
 * @param {string} workDescription - Work description
 * @param {Array} ursCandidates - Array of URS candidates
 * @param {Object} projectContext - Project context
 * @returns {Promise<Object>} Best candidate with reasoning
 */
export async function resolveUrsConflict(workDescription, ursCandidates, projectContext) {
  logger.info(`[MULTI-ROLE] Resolving conflict for "${workDescription}" (${ursCandidates.length} candidates)`);

  const question = `
Multiple URS codes are candidates for this work. Select the best one:

Work Description: "${workDescription}"

Candidates:
${ursCandidates.map((c, i) =>
  `${i + 1}. ${c.urs_code} - ${c.urs_name} (confidence: ${c.confidence})`
).join('\n')}

Project Context:
- Building Type: ${projectContext.building_type || 'not specified'}
- Main Systems: ${projectContext.main_system?.join(', ') || 'not specified'}

Which code is most appropriate? Consider:
1. Exact match to work description
2. Building type compatibility
3. Completeness of scope
4. Industry best practices

Provide:
- Selected code with reasoning
- Why other codes were rejected
- Confidence level (0-100%)
`;

  const result = await askMultiRole(question, {
    context: {
      work_description: workDescription,
      candidates: ursCandidates,
      project_context: projectContext
    },
    enableKb: true
  });

  return {
    selected_code: extractSelectedCode(result.answer, ursCandidates),
    reasoning: result.answer,
    confidence: result.confidence,
    conflicts_resolved: result.conflicts.length,
    roles_consulted: result.roles_consulted
  };
}

/**
 * Check if STAVAGENT Multi-Role API is available
 *
 * @returns {Promise<boolean>} True if available
 */
export async function checkMultiRoleAvailability() {
  try {
    const response = await fetch(`${STAVAGENT_API_BASE}/api/v1/health`, {
      method: 'GET',
      timeout: 5000
    });

    return response.ok;
  } catch (error) {
    logger.warn(`[MULTI-ROLE] API not available: ${error.message}`);
    return false;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractCompletenessScore(answer) {
  // Extract percentage from answer like "85% complete" or "completeness: 90%"
  const match = answer.match(/(\d+)%\s*(?:complete|completeness)/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractAlternatives(answer) {
  // Extract alternative URS codes from answer
  const alternatives = [];
  const codePattern = /\b\d{7}\b/g;
  const matches = answer.match(codePattern);

  if (matches) {
    matches.forEach(code => {
      if (!alternatives.includes(code)) {
        alternatives.push(code);
      }
    });
  }

  return alternatives;
}

function extractRelatedItems(answer) {
  // Extract related items from answer
  const related = [];

  // Look for bullet points or numbered lists after "related" or "tech-rules"
  const relatedSection = answer.match(/(?:related|tech.*rules?)[^\n]*\n((?:[-*•]\s*.+\n?|^\d+\.\s*.+\n?)+)/im);

  if (relatedSection) {
    const lines = relatedSection[1].split('\n');
    lines.forEach(line => {
      const cleaned = line.replace(/^[-*•]\s*|\d+\.\s*/, '').trim();
      if (cleaned) related.push(cleaned);
    });
  }

  return related;
}

function extractSelectedCode(answer, candidates) {
  // Extract the selected URS code from answer
  // Look for first 7-digit code in answer
  const match = answer.match(/\b(\d{7})\b/);

  if (match) {
    const code = match[1];
    const candidate = candidates.find(c => c.urs_code === code);
    if (candidate) return candidate;
  }

  // Fallback: return highest confidence candidate
  return candidates.reduce((best, curr) =>
    curr.confidence > best.confidence ? curr : best
  , candidates[0]);
}
