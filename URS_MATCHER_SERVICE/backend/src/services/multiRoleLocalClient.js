/**
 * Local Multi-Role AI Client
 * Uses LLM directly instead of external STAVAGENT API
 *
 * Provides access to specialist AI roles via local LLM:
 * - Document Validator
 * - Structural Engineer
 * - Concrete Specialist
 * - Cost Estimator
 * - Standards Checker
 */

import { logger } from '../utils/logger.js';
import { callLLMForTask, TASKS } from './llmClient.js';

/**
 * Check if local Multi-Role is available (always true if LLM is configured)
 * @returns {Promise<boolean>}
 */
export async function checkMultiRoleAvailability() {
  try {
    // Check if any LLM provider is available by importing config
    const { getAvailableProviders } = await import('../config/llmConfig.js');
    const providers = getAvailableProviders();
    const available = Object.keys(providers).length > 0;

    if (available) {
      logger.info('[MULTI-ROLE-LOCAL] Available via LLM');
    }

    return available;
  } catch (error) {
    logger.warn(`[MULTI-ROLE-LOCAL] Not available: ${error.message}`);
    return false;
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
  logger.info(`[MULTI-ROLE-LOCAL] Validating BOQ block: ${boqBlock.title}`);

  const systemPrompt = `You are a Senior Document Validator specializing in Czech construction BOQ (Bill of Quantities) analysis.
Your expertise includes:
- ČSN standards (especially ČSN 73 1201, ČSN EN 206)
- URS classification system
- Construction project requirements
- Safety and compliance verification

Always respond in JSON format.`;

  const userPrompt = `
Analyze this BOQ block for completeness and accuracy:

Block: ${boqBlock.title}
Number of items: ${boqBlock.rows?.length || 0}

Project Context:
- Building Type: ${projectContext.building_type || 'not specified'}
- Storeys: ${projectContext.storeys || 'not specified'}
- Main Systems: ${projectContext.main_system?.join(', ') || 'not specified'}

BOQ Items:
${(boqBlock.rows || []).slice(0, 15).map((row, i) =>
    `${i + 1}. ${row.raw_text || row.text} (${row.quantity || ''} ${row.unit || 'ks'})`
  ).join('\n')}
${(boqBlock.rows?.length || 0) > 15 ? `\n... and ${boqBlock.rows.length - 15} more items` : ''}

Check for:
1. Missing critical items (formwork, scaffolding, waterproofing, reinforcement)
2. Inconsistent specifications
3. Compliance with building type requirements
4. Potential safety issues

Respond in JSON:
{
  "completeness_score": 85,
  "missing_items": ["Bednění základových pasů", "Hydroizolace pod základovou desku"],
  "warnings": ["Chybí specifikace krytí výztuže"],
  "critical_issues": [],
  "confidence": 0.85,
  "roles_consulted": ["document_validator"]
}
`;

  try {
    const response = await callLLMForTask(
      TASKS.BLOCK_ANALYSIS,
      systemPrompt,
      userPrompt
    );

    const parsed = parseJsonResponse(response);

    return {
      completeness_score: parsed.completeness_score || 70,
      missing_items: parsed.missing_items || [],
      warnings: parsed.warnings || [],
      critical_issues: parsed.critical_issues || [],
      confidence: parsed.confidence || 0.75,
      roles_consulted: ['document_validator']
    };

  } catch (error) {
    logger.error(`[MULTI-ROLE-LOCAL] validateBoqBlock failed: ${error.message}`);
    return {
      completeness_score: null,
      missing_items: [],
      warnings: [`Validation failed: ${error.message}`],
      critical_issues: [],
      confidence: 0,
      roles_consulted: []
    };
  }
}

/**
 * Ask question to Multi-Role AI System (local implementation)
 *
 * @param {string} question - The question to ask
 * @param {Object} options - Options for execution
 * @returns {Promise<Object>} Multi-role answer
 */
export async function askMultiRole(question, options = {}) {
  const { context = null, temperature = 0.3 } = options;

  logger.info(`[MULTI-ROLE-LOCAL] Question: ${question.substring(0, 80)}...`);

  const systemPrompt = `You are a panel of construction experts with the following specializations:
- Structural Engineer (load analysis, concrete classes, safety factors)
- Concrete Specialist (mix design, durability, ČSN EN 206)
- Standards Checker (ČSN compliance, Eurocode verification)
- Cost Estimator (Czech construction pricing)

Analyze the question from multiple expert perspectives and provide a unified response.
Include any conflicts between expert opinions and how they were resolved.

Always respond in JSON format.`;

  const contextStr = context ? `\n\nContext:\n${JSON.stringify(context, null, 2)}` : '';

  const userPrompt = `${question}${contextStr}

Respond in JSON:
{
  "answer": "Your unified expert response here",
  "complexity": "SIMPLE|STANDARD|COMPLEX",
  "roles_consulted": ["structural_engineer", "concrete_specialist"],
  "warnings": ["Any warnings from experts"],
  "critical_issues": [],
  "conflicts": [],
  "confidence": 0.85
}`;

  try {
    const response = await callLLMForTask(
      TASKS.BLOCK_ANALYSIS,
      systemPrompt,
      userPrompt
    );

    const parsed = parseJsonResponse(response);

    return {
      answer: parsed.answer || response,
      complexity: parsed.complexity || 'STANDARD',
      roles_consulted: parsed.roles_consulted || ['structural_engineer'],
      warnings: parsed.warnings || [],
      critical_issues: parsed.critical_issues || [],
      conflicts: parsed.conflicts || [],
      confidence: parsed.confidence || 0.75
    };

  } catch (error) {
    logger.error(`[MULTI-ROLE-LOCAL] askMultiRole failed: ${error.message}`);
    throw error;
  }
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
  logger.info(`[MULTI-ROLE-LOCAL] Verifying URS code ${selectedUrsCode}`);

  const systemPrompt = `You are a Senior Czech Construction Standards Expert specializing in URS (Unified Classification System) code verification.
Your role is to verify if a selected URS code correctly matches the work description.

Always respond in JSON format.`;

  const userPrompt = `
Verify if URS code ${selectedUrsCode} is appropriate for this work:

Work Description: "${workDescription}"

Project Context:
- Building Type: ${projectContext.building_type || 'not specified'}
- Main Systems: ${projectContext.main_system?.join(', ') || 'not specified'}

Questions:
1. Is ${selectedUrsCode} the correct code for this work?
2. Are there any conflicts or inconsistencies?
3. What related items should be included (tech-rules)?

Respond in JSON:
{
  "is_correct": true,
  "is_questionable": false,
  "reason": "Explanation of verification result",
  "alternatives": ["Alternative URS codes if incorrect"],
  "related_items": ["Related mandatory items"],
  "warnings": [],
  "confidence": 0.90
}`;

  try {
    const response = await callLLMForTask(
      TASKS.URS_SELECTION,
      systemPrompt,
      userPrompt
    );

    const parsed = parseJsonResponse(response);

    return {
      is_correct: parsed.is_correct !== false,
      is_questionable: parsed.is_questionable || false,
      reason: parsed.reason || 'Verification completed',
      alternatives: parsed.alternatives || [],
      related_items: parsed.related_items || [],
      warnings: parsed.warnings || [],
      confidence: parsed.confidence || 0.75,
      roles_consulted: ['standards_checker', 'structural_engineer']
    };

  } catch (error) {
    logger.error(`[MULTI-ROLE-LOCAL] verifyUrsCode failed: ${error.message}`);
    return {
      is_correct: true,
      is_questionable: true,
      reason: `Verification failed: ${error.message}`,
      alternatives: [],
      related_items: [],
      warnings: ['Could not verify due to error'],
      confidence: 0,
      roles_consulted: []
    };
  }
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
  logger.info(`[MULTI-ROLE-LOCAL] Resolving conflict for "${workDescription.substring(0, 50)}..." (${ursCandidates.length} candidates)`);

  const systemPrompt = `You are a panel of construction experts resolving URS code conflicts.
Apply this priority hierarchy:
1. Safety requirements (highest priority)
2. Code compliance (ČSN, Eurocode)
3. Durability requirements
4. Practicality
5. Cost (lowest priority)

Always respond in JSON format.`;

  const userPrompt = `
Multiple URS codes are candidates for this work. Select the best one:

Work Description: "${workDescription}"

Candidates:
${ursCandidates.slice(0, 5).map((c, i) =>
    `${i + 1}. ${c.urs_code} - ${c.urs_name || 'N/A'} (confidence: ${c.confidence || 0.5})`
  ).join('\n')}

Project Context:
- Building Type: ${projectContext.building_type || 'not specified'}
- Main Systems: ${projectContext.main_system?.join(', ') || 'not specified'}

Select the most appropriate code considering:
1. Exact match to work description
2. Building type compatibility
3. Completeness of scope
4. Industry best practices

Respond in JSON:
{
  "selected_code": "1234567",
  "selected_name": "Name of selected item",
  "reasoning": "Why this code was selected",
  "rejected_codes": [{"code": "...", "reason": "..."}],
  "confidence": 0.90
}`;

  try {
    const response = await callLLMForTask(
      TASKS.URS_SELECTION,
      systemPrompt,
      userPrompt
    );

    const parsed = parseJsonResponse(response);

    // Find the selected candidate
    let selectedCandidate = ursCandidates.find(c => c.urs_code === parsed.selected_code);

    // Fallback to highest confidence if no match
    if (!selectedCandidate) {
      selectedCandidate = ursCandidates.reduce((best, curr) =>
        (curr.confidence || 0) > (best.confidence || 0) ? curr : best
      , ursCandidates[0]);
    }

    return {
      selected_code: selectedCandidate,
      reasoning: parsed.reasoning || 'Selected based on best match',
      confidence: parsed.confidence || 0.75,
      conflicts_resolved: ursCandidates.length - 1,
      roles_consulted: ['structural_engineer', 'standards_checker']
    };

  } catch (error) {
    logger.error(`[MULTI-ROLE-LOCAL] resolveUrsConflict failed: ${error.message}`);

    // Fallback: return highest confidence candidate
    const bestCandidate = ursCandidates.reduce((best, curr) =>
      (curr.confidence || 0) > (best.confidence || 0) ? curr : best
    , ursCandidates[0]);

    return {
      selected_code: bestCandidate,
      reasoning: 'Fallback to highest confidence candidate',
      confidence: 0.5,
      conflicts_resolved: 0,
      roles_consulted: []
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
function parseJsonResponse(response) {
  try {
    // Try direct parse first
    return JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue to next method
      }
    }

    // Try to find JSON object in response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        // Clean up common issues
        let cleaned = objectMatch[0]
          .replace(/,\s*([}\]])/g, '$1')  // Remove trailing commas
          .replace(/'/g, '"');            // Replace single quotes
        return JSON.parse(cleaned);
      } catch {
        // Continue to fallback
      }
    }

    // Return response as answer field
    return { answer: response };
  }
}

// Default export for compatibility
export default {
  checkMultiRoleAvailability,
  validateBoqBlock,
  askMultiRole,
  verifyUrsCode,
  resolveUrsConflict
};
