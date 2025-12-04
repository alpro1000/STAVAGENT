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
  insertRelatedItem,
  searchLocalCatalog,
  extractCzechKeywords
} from './knowledgeBase.js';
import { matchUrsItemWithAI } from './llmClient.js';
import { createUniversalMatchPrompt, validateCodesAgainstCandidates } from '../prompts/universalMatcher.prompt.js';
import { searchUrsSite, searchNormsAndStandards } from './perplexityClient.js';

/**
 * Detect language of input text
 * Simple heuristic detection (can be upgraded to ML model)
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') {return 'other';}

  const lower = text.toLowerCase();

  // Czech patterns - check diacritics and common words
  // Czech has unique characters: ř, ů, ě and combinations with háček/čárka
  if (/[řůě]/.test(lower) || /\b(je|jsou|má|mají|byl|byla|bylo|budou|dům|byt|práce|stavba|deska|betonová|přehlaz|zdivo|stěna|podlaha)\b/.test(lower)) {
    return 'cs';
  }

  // Ukrainian patterns - check BEFORE Russian because they share Cyrillic
  // Ukrainian has unique: є, і, ї, ґ and word patterns
  // Note: \b doesn't work with Cyrillic, use space/boundary matching
  if (/[єіїґ]/.test(text) || /(^|\s)(з|та|що|це|як|від|для|цегли)(\s|$)/i.test(text)) {
    return 'uk';
  }

  // Russian patterns - Cyrillic WITHOUT Ukrainian-specific chars
  // Exclude texts containing Ukrainian unique characters to prevent misclassification
  if (/[а-яА-ЯёЁ]/.test(text) && !/[єіїґ]/.test(text)) {
    return 'ru';
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

    // Optimized cache hit detection (using find instead of index check)
    const kbHit = kbHits?.find(hit => hit.confidence >= 0.85);
    if (kbHit) {
      logger.info(
        `[UniversalMatcher] KB HIT: confidence=${kbHit.confidence} (skipping LLM)`
      );

      return formatResultFromKB(
        input,
        detectedLanguage,
        normalizedCzech,
        kbHit,
        startTime
      );
    }

    // 3. Get candidates for LLM matching
    let candidates = input.candidateItems || [];
    let candidateSource = 'provided';

    // AUTO-SEARCH: If no candidates provided, search automatically
    if (candidates.length === 0) {
      logger.info('[UniversalMatcher] No candidates provided, searching automatically...');

      // Step 3a: Search local catalog first (fast)
      candidates = await searchLocalCatalog(normalizedCzech, input.text, 20);
      candidateSource = 'local_catalog';

      // Step 3b: If still empty, try Perplexity (slower, but searches urs.cz)
      if (candidates.length === 0) {
        logger.info('[UniversalMatcher] Local search empty, trying Perplexity...');
        try {
          candidates = await searchUrsSite(normalizedCzech || input.text);
          candidateSource = 'perplexity_urs_cz';
        } catch (perplexityError) {
          logger.warn(`[UniversalMatcher] Perplexity search failed: ${perplexityError.message}`);
        }
      }

      logger.info(`[UniversalMatcher] Auto-search found ${candidates.length} candidates from ${candidateSource}`);
    }

    // If still no candidates after auto-search, return ambiguous
    if (candidates.length === 0) {
      logger.warn('[UniversalMatcher] No candidates found even after auto-search');

      return {
        query: {
          detected_language: detectedLanguage,
          normalized_text_cs: normalizedCzech,
          original_text: input.text,
          quantity: input.quantity || null,
          unit: input.unit || null
        },
        matches: [],
        related_items: [],
        explanation_cs:
          'Bohužel se nepodařilo najít odpovídající ÚRS pozice v katalogu. ' +
          'Zkuste upřesnit popis práce nebo použít technické termíny v češtině.',
        knowledge_suggestions: [],
        status: 'ambiguous',
        notes_cs: 'Automatické vyhledávání nenašlo vhodné kandidáty. Zkuste jiné klíčové slovo.',
        searched_keywords: extractCzechKeywords(normalizedCzech + ' ' + input.text),
        execution_time_ms: Date.now() - startTime
      };
    }

    // 4. Search for relevant norms and technical conditions (parallel with LLM prep)
    let normsData = { norms: [], technical_conditions: [], methodology_notes: null };
    try {
      normsData = await searchNormsAndStandards(normalizedCzech || input.text);
      if (normsData.norms.length > 0 || normsData.technical_conditions.length > 0) {
        logger.info(`[UniversalMatcher] Found ${normsData.norms.length} norms, ${normsData.technical_conditions.length} tech conditions`);
      }
    } catch (normsError) {
      logger.warn(`[UniversalMatcher] Norms search failed: ${normsError.message}`);
    }

    // 5. Call LLM with universal match prompt (including norms!)
    const llmPrompt = createUniversalMatchPrompt({
      originalText: input.text,
      quantity: input.quantity,
      unit: input.unit,
      detectedLanguage,
      projectType: input.projectType,
      buildingSystem: input.buildingSystem,
      candidateItems: candidates,
      knowledgeBaseHits: kbHits,
      // NEW: Pass norms and technical conditions to LLM
      relevantNorms: normsData.norms,
      technicalConditions: normsData.technical_conditions,
      methodologyNotes: normsData.methodology_notes
    });

    const llmResponse = await callUniversalLLM(llmPrompt);

    // Add norms to response for transparency
    llmResponse.referenced_norms = normsData.norms;
    llmResponse.technical_conditions = normsData.technical_conditions;

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
    llmResponse.candidate_source = candidateSource;
    llmResponse.candidates_count = candidates.length;

    logger.info(
      `[UniversalMatcher] Complete: ${llmResponse.matches.length} matches found from ${candidateSource} (${llmResponse.execution_time_ms}ms)`
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
 * Includes execution time and optimized cache hit detection
 */
async function formatResultFromKB(input, detectedLanguage, normalizedCzech, kbHit, startTime) {
  const relatedItems = await getRelatedItems(kbHit.id);
  const executionTime = Date.now() - startTime;

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
    explanation_cs: 'Tato položka byla identifikována z naší databáze potvrzených mapování ' +
      `(${kbHit.usage_count}x použito, spolehlivost ${(kbHit.confidence * 100).toFixed(0)}%).`,
    knowledge_suggestions: [],
    status: 'ok',
    notes_cs: 'Odpověď pochází ze znalostní báze bez nutnosti LLM.',
    source: 'knowledge_base',
    execution_time_ms: executionTime
  };
}

/**
 * Call LLM with universal match prompt
 * Handles both Claude and OpenAI
 *
 * Security: Validates response size, schema, and content to prevent:
 * - Resource exhaustion attacks (huge responses)
 * - LLM hallucination (invalid data structures)
 * - Unbounded result sets
 */
async function callUniversalLLM(prompt) {
  try {
    // Constants for safety limits
    const MAX_RESPONSE_SIZE = 50 * 1024;  // 50KB max response
    const MAX_MATCHES = 10;  // Max number of matches to return
    const MAX_MATCH_TEXT_LENGTH = 500;  // Max length for urs_name, reason, etc.

    // For now, use existing matchUrsItemWithAI which supports Claude
    // In future could add dedicated universal-match LLM call
    let response = await matchUrsItemWithAI(prompt, [], []);

    // Handle string responses
    if (typeof response === 'string') {
      // Validate response size before parsing
      if (response.length > MAX_RESPONSE_SIZE) {
        logger.error(`[UniversalMatcher] Response too large: ${response.length} bytes (max: ${MAX_RESPONSE_SIZE})`);
        throw new Error('LLM response exceeded maximum allowed size');
      }

      // Parse JSON
      try {
        response = JSON.parse(response);
      } catch (parseError) {
        logger.error(`[UniversalMatcher] Invalid JSON from LLM: ${parseError.message}`);
        throw new Error('LLM returned invalid JSON');
      }
    }

    // Validate response schema
    if (!response || typeof response !== 'object') {
      logger.error(`[UniversalMatcher] Invalid response type: ${typeof response}`);
      throw new Error('Invalid LLM response type');
    }

    // Validate matches array
    if (!Array.isArray(response.matches)) {
      logger.error('[UniversalMatcher] Missing or invalid matches array');
      throw new Error('LLM response missing matches array');
    }

    // Limit number of matches
    if (response.matches.length > MAX_MATCHES) {
      logger.warn(`[UniversalMatcher] LLM returned ${response.matches.length} matches, limiting to ${MAX_MATCHES}`);
      response.matches = response.matches.slice(0, MAX_MATCHES);
    }

    // Validate each match object
    response.matches = response.matches.filter(match => {
      // Validate required fields
      if (!match.urs_code || typeof match.urs_code !== 'string') {
        logger.warn('[UniversalMatcher] Invalid match: missing or invalid urs_code');
        return false;
      }

      // Limit text field lengths
      if (match.urs_name && match.urs_name.length > MAX_MATCH_TEXT_LENGTH) {
        match.urs_name = match.urs_name.substring(0, MAX_MATCH_TEXT_LENGTH);
      }

      // Validate confidence is a number between 0 and 1
      if (typeof match.confidence !== 'number' || match.confidence < 0 || match.confidence > 1) {
        match.confidence = 0.5; // Default to medium confidence if invalid
      }

      return true;
    });

    // Validate related_items if present
    if (Array.isArray(response.related_items)) {
      if (response.related_items.length > MAX_MATCHES) {
        response.related_items = response.related_items.slice(0, MAX_MATCHES);
      }

      response.related_items = response.related_items.filter(item => {
        if (item.reason_cs && item.reason_cs.length > MAX_MATCH_TEXT_LENGTH) {
          item.reason_cs = item.reason_cs.substring(0, MAX_MATCH_TEXT_LENGTH);
        }
        return true;
      });
    }

    // Validate and truncate explanation
    if (response.explanation_cs && typeof response.explanation_cs === 'string') {
      if (response.explanation_cs.length > MAX_MATCH_TEXT_LENGTH * 2) {
        response.explanation_cs = response.explanation_cs.substring(0, MAX_MATCH_TEXT_LENGTH * 2) + '...';
      }
    }

    logger.debug(`[UniversalMatcher] LLM response validated: ${response.matches.length} matches, ${(JSON.stringify(response).length)} bytes`);

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
