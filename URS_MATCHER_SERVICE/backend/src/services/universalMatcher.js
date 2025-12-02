/**
 * Universal URS Matcher Service
 *
 * Core logic for matching any language construction work description to ÚRS codes
 * - Language detection
 * - Text normalization to Czech
 * - Knowledge Base lookup
 * - LLM matching (with validation)
 * - Learning and feedback
 */

import { logger } from '../utils/logger.js';
import {
  searchKnowledgeBase,
  normalizeTextToCzech,
  computeContextHash,
  insertMapping,
  getRelatedItems,
  insertRelatedItem
} from './knowledgeBase.js';
import { matchUrsItemWithAI } from './llmClient.js';
import { createUniversalMatchPrompt, validateCodesAgainstCandidates } from '../prompts/universalMatcher.prompt.js';

/**
 * Detect language of input text
 * Simple heuristic detection (can be upgraded to ML model)
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'other';

  const lower = text.toLowerCase();

  // Czech patterns
  if (/\b(je|jsou|má|mají|byl|byla|bylo|budou|dům|byt|práce|stavba)\b/.test(lower)) {
    return 'cs';
  }

  // Russian patterns
  if (/[а-яА-ЯёЁ]/.test(text)) {
    return 'ru';
  }

  // Ukrainian patterns
  if (/[єЄиї]/.test(text)) {
    return 'uk';
  }

  // German patterns
  if (/\b(der|die|das|ist|sind|haus|bau|arbeit)\b/.test(lower)) {
    return 'de';
  }

  // English patterns
  if (/\b(the|is|are|building|work|house|construction)\b/.test(lower)) {
    return 'en';
  }

  return 'other';
}

/**
 * Main entry point: Universal URS Matcher
 * Returns structured match result
 */
export async function universalMatch(input) {
  const startTime = Date.now();

  try {
    // 1. Detect language and normalize
    const detectedLanguage = detectLanguage(input.text);
    const normalizedCzech = normalizeTextToCzech(input.text);

    logger.info(
      `[UniversalMatcher] Input: lang=${detectedLanguage}, text="${input.text.substring(0, 60)}..."`
    );

    // 2. Try Knowledge Base first (fast path)
    const kbHits = await searchKnowledgeBase(
      normalizedCzech,
      input.projectType,
      input.buildingSystem
    );

    if (kbHits && kbHits.length > 0 && kbHits[0].confidence >= 0.85) {
      logger.info(
        `[UniversalMatcher] KB HIT: confidence=${kbHits[0].confidence} (skipping LLM)`
      );

      return formatResultFromKB(
        input,
        detectedLanguage,
        normalizedCzech,
        kbHits[0]
      );
    }

    // 3. Get candidates for LLM matching
    const candidates = input.candidateItems || [];
    if (candidates.length === 0) {
      logger.warn(`[UniversalMatcher] No candidates provided, returning ambiguous result`);

      return {
        query: {
          detected_language: detectedLanguage,
          normalized_text_cs: normalizedCzech,
          quantity: input.quantity || null,
          unit: input.unit || null
        },
        matches: [],
        related_items: [],
        explanation_cs:
          'Bez dostupných kandidátů ÚRS kódů není možné identifikovat správnou pozici. ' +
          'Prosím, poskytněte seznam dostupných pozic ÚRS katalogu.',
        knowledge_suggestions: [],
        status: 'ambiguous',
        notes_cs: 'Chybí seznam kandidátních ÚRS položek (candidateItems).',
        execution_time_ms: Date.now() - startTime
      };
    }

    // 4. Call LLM with universal match prompt
    const llmPrompt = createUniversalMatchPrompt({
      originalText: input.text,
      quantity: input.quantity,
      unit: input.unit,
      detectedLanguage,
      projectType: input.projectType,
      buildingSystem: input.buildingSystem,
      candidateItems: candidates,
      knowledgeBaseHits: kbHits
    });

    const llmResponse = await callUniversalLLM(llmPrompt);

    // 5. Validate LLM response (no code invention!)
    const validationIssues = validateCodesAgainstCandidates(llmResponse, candidates);
    if (validationIssues.length > 0) {
      logger.error(`[UniversalMatcher] LLM validation failed: ${validationIssues.join(', ')}`);
      // Return response but mark as suspicious
      llmResponse.validation_warnings = validationIssues;
    }

    // 6. Store in knowledge base (if high confidence)
    if (llmResponse.matches && llmResponse.matches.length > 0) {
      const primaryMatch = llmResponse.matches.find((m) => m.role === 'primary');
      if (primaryMatch && primaryMatch.confidence >= 0.75) {
        await insertMapping(
          llmResponse.query.normalized_text_cs,
          llmResponse.query.detected_language,
          input.projectType,
          input.buildingSystem,
          primaryMatch.urs_code,
          primaryMatch.urs_name,
          primaryMatch.unit,
          primaryMatch.confidence,
          false // auto-learned, not validated yet
        );
      }
    }

    // 7. Add execution metadata
    llmResponse.execution_time_ms = Date.now() - startTime;

    logger.info(
      `[UniversalMatcher] Complete: ${llmResponse.matches.length} matches found (${llmResponse.execution_time_ms}ms)`
    );

    return llmResponse;
  } catch (error) {
    logger.error(`[UniversalMatcher] Failed: ${error.message}`);

    return {
      query: {
        detected_language: 'error',
        normalized_text_cs: input.text,
        quantity: input.quantity || null,
        unit: input.unit || null
      },
      matches: [],
      related_items: [],
      explanation_cs: `Chyba při zpracování požadavku: ${error.message}`,
      knowledge_suggestions: [],
      status: 'error',
      notes_cs: error.message,
      execution_time_ms: Date.now() - startTime
    };
  }
}

/**
 * Format result from Knowledge Base hit (fast path)
 */
async function formatResultFromKB(input, detectedLanguage, normalizedCzech, kbHit) {
  const relatedItems = await getRelatedItems(kbHit.id);

  return {
    query: {
      detected_language: detectedLanguage,
      normalized_text_cs: normalizedCzech,
      quantity: input.quantity || null,
      unit: input.unit || null
    },
    matches: [
      {
        urs_code: kbHit.urs_code,
        urs_name: kbHit.urs_name,
        unit: kbHit.unit,
        confidence: kbHit.confidence,
        role: 'primary',
        source: 'knowledge_base'
      }
    ],
    related_items: relatedItems.map((r) => ({
      urs_code: r.urs_code,
      urs_name: r.urs_name,
      unit: r.unit,
      reason_cs: r.reason_cs
    })),
    explanation_cs: `Tato položka byla identifikována z naší databáze potvrzených mapování ` +
      `(${kbHit.usage_count}x použito, spolehlivost ${(kbHit.confidence * 100).toFixed(0)}%).`,
    knowledge_suggestions: [],
    status: 'ok',
    notes_cs: 'Odpověď pochází ze znalostní báze bez nutnosti LLM.',
    source: 'knowledge_base'
  };
}

/**
 * Call LLM with universal match prompt
 * Handles both Claude and OpenAI
 */
async function callUniversalLLM(prompt) {
  try {
    // For now, use existing matchUrsItemWithAI which supports Claude
    // In future could add dedicated universal-match LLM call
    const response = await matchUrsItemWithAI(prompt, [], []);

    // Parse response (should be JSON already)
    if (typeof response === 'string') {
      return JSON.parse(response);
    }

    return response;
  } catch (error) {
    logger.error(`[UniversalMatcher] LLM call failed: ${error.message}`);
    throw error;
  }
}

/**
 * User validates/corrects a match
 * Use feedback to improve KB and confidence scores
 */
export async function recordUserFeedback(matchResult, userConfirmation) {
  try {
    const {
      urs_code,
      urs_name,
      unit,
      normalized_text_cs,
      detected_language,
      project_type,
      building_system,
      is_correct,
      user_comment
    } = userConfirmation;

    if (is_correct) {
      // User approved this match → store with high confidence
      await insertMapping(
        normalized_text_cs,
        detected_language,
        project_type,
        building_system,
        urs_code,
        urs_name,
        unit,
        0.95, // high confidence
        true // validated by user
      );

      logger.info(
        `[Feedback] User confirmed: "${normalized_text_cs}" → ${urs_code}`
      );
    } else {
      // User rejected → don't store or mark as unreliable
      logger.warn(
        `[Feedback] User rejected: "${normalized_text_cs}" → ${urs_code} (reason: ${user_comment})`
      );
    }

    return { success: true, message: 'Feedback recorded' };
  } catch (error) {
    logger.error(`[Feedback] Failed to record: ${error.message}`);
    throw error;
  }
}

/**
 * Suggest related items for a confirmed match
 * Used to build complementary work suggestions
 */
export async function suggestRelatedWorks(matchedKBMappingId, candidateItems) {
  try {
    // This would be called after user confirms a match
    // Use LLM to suggest which related items make sense
    // Then store in kb_related_items

    logger.debug(
      `[RelatedWorks] Suggesting related items for KB mapping ${matchedKBMappingId}`
    );

    // For now: return empty (would need LLM call to suggest)
    return [];
  } catch (error) {
    logger.error(`[RelatedWorks] Failed: ${error.message}`);
    throw error;
  }
}
