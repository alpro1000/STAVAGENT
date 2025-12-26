/**
 * Time Norms Service
 * Suggests work duration using concrete-agent Multi-Role API
 *
 * Integrates with Knowledge Base (B1-B9) for official construction norms:
 * - B4_production_benchmarks - Productivity rates (~200 items)
 * - B5_tech_cards - Technical work procedures (~300 cards)
 * - B1_urs_codes - KROS/RTS official catalogs
 *
 * Version: 1.0.0
 * Date: 2025-12-26
 */

import { logger } from '../utils/logger.js';

// Configuration
const CORE_API_URL = process.env.CORE_API_URL || 'https://concrete-agent.onrender.com';
const CORE_TIMEOUT = parseInt(process.env.CORE_TIMEOUT || '90000', 10); // 90s for cold start

/**
 * Suggest days for a position using AI
 *
 * @param {Object} position - Position object with work details
 * @returns {Promise<Object>} Suggestion with days, reasoning, confidence, source
 */
export async function suggestDays(position) {
  // Build context for AI
  const question = buildQuestion(position);
  const context = buildContext(position);

  logger.info(`[Time Norms] Requesting suggestion for ${position.subtype}: ${position.qty} ${position.unit}`);

  // Use AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CORE_TIMEOUT);

  try {
    // Call Multi-Role API
    const response = await fetch(`${CORE_API_URL}/api/v1/multi-role/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question,
        context,
        enable_kb: true,          // Use Knowledge Base (B1-B9)
        enable_perplexity: false, // No external search needed
        use_cache: true           // Cache results for 24h
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Multi-Role API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    logger.info(`[Time Norms] Multi-Role response received (confidence: ${result.confidence})`);

    // Parse AI response
    const suggestion = parseSuggestion(result.answer, position);

    return {
      success: true,
      suggested_days: suggestion.days,
      reasoning: result.answer,
      confidence: result.confidence || 0.8,
      norm_source: suggestion.source, // "KROS", "RTS", "B4_benchmarks", etc.
      crew_size_recommendation: suggestion.crew_size,
      roles_consulted: result.roles_consulted || []
    };

  } catch (error) {
    // Enhanced error logging with timeout info
    if (error.name === 'AbortError') {
      logger.warn(`[Time Norms] API request aborted after ${CORE_TIMEOUT}ms timeout`);
    } else {
      logger.error('[Time Norms] Error:', error.message);
    }

    // Fallback to empirical estimates
    const fallback = calculateFallbackDays(position);

    return {
      success: false,
      suggested_days: fallback.days,
      reasoning: fallback.reasoning,
      confidence: 0.5,
      norm_source: 'Empirical estimate',
      error: error.message
    };
  } finally {
    // Always clear timeout to prevent resource leak
    clearTimeout(timeoutId);
  }
}

/**
 * Build question for AI based on work type
 * Questions are in Czech to match Knowledge Base language
 *
 * @param {Object} position - Position object
 * @returns {string} Question in Czech
 */
function buildQuestion(position) {
  const { subtype, qty, unit, crew_size, shift_hours } = position;

  // Format crew size and shift hours for question
  const crewInfo = crew_size ? `s partou ${crew_size} lidí` : '';
  const shiftInfo = shift_hours ? `, směna ${shift_hours} hodin` : '';

  // Example questions based on subtype
  const questions = {
    'beton': `Kolik dní bude trvat betonování ${qty} ${unit} betonu ${crewInfo}${shiftInfo}? Použij KROS normy.`,
    'bednění': `Kolik dní bude trvat montáž a demontáž bednění ${qty} ${unit} ${crewInfo}${shiftInfo}? Použij RTS normy.`,
    'výztuž': `Kolik dní bude trvat vázání ${qty} ${unit} výztuže ${crewInfo}${shiftInfo}? Použij normativní produktivitu.`,
    'jiné': `Kolik dní bude trvat práce "${position.item_name}" - ${qty} ${unit} ${crewInfo}${shiftInfo}?`
  };

  return questions[subtype] || questions['jiné'];
}

/**
 * Build context for AI
 *
 * @param {Object} position - Position object
 * @returns {Object} Context object
 */
function buildContext(position) {
  return {
    project_type: 'monolithic_concrete_construction',
    work_type: position.subtype,
    quantity: position.qty,
    unit: position.unit,
    crew_size: position.crew_size,
    shift_hours: position.shift_hours,
    part_name: position.part_name,
    item_name: position.item_name,
    // Include existing calculation values for better context
    unit_cost_on_m3: position.unit_cost_on_m3,
    avg_wage_czk_ph: position.avg_wage_czk_ph
  };
}

/**
 * Parse AI response to extract days suggestion
 *
 * AI answer example:
 * "S partou 4 lidí a směnou 10 hodin bude práce trvat **8-10 dní** podle KROS normy 271354111.
 * Průměrná produktivita: 6 m³/den."
 *
 * @param {string} answer - AI response text
 * @param {Object} position - Original position (for fallback)
 * @returns {Object} Parsed suggestion with days, source, crew_size
 */
function parseSuggestion(answer, position) {
  // Extract days using regex - handles various formats:
  // - "8-10 dní" (range)
  // - "8 dní" (single)
  // - "8-10 days" (English)
  const daysMatch = answer.match(/(\d+)[\s-]*(?:až|do|–|-)?\s*(\d+)?\s*d(?:ní|en|ny|ays?)/i);

  let days = 0;
  let source = 'AI estimate';

  if (daysMatch) {
    // Take average if range given (e.g., "8-10 dní" → 9)
    const min = parseInt(daysMatch[1], 10);
    const max = daysMatch[2] ? parseInt(daysMatch[2], 10) : min;
    days = Math.ceil((min + max) / 2);
  }

  // If no days found, try alternative formats
  if (days === 0) {
    // Try "4 až 5 dní" format
    const altMatch = answer.match(/(\d+)\s+až\s+(\d+)/i);
    if (altMatch) {
      const min = parseInt(altMatch[1], 10);
      const max = parseInt(altMatch[2], 10);
      days = Math.ceil((min + max) / 2);
    }
  }

  // Detect source from answer text
  if (answer.includes('KROS')) source = 'KROS';
  else if (answer.includes('RTS')) source = 'RTS';
  else if (answer.includes('ČSN')) source = 'ČSN';
  else if (answer.includes('B4') || answer.includes('benchmark')) source = 'B4_production_benchmarks';
  else if (answer.includes('B5') || answer.includes('technic')) source = 'B5_tech_cards';

  // Extract crew size recommendation (if different from current)
  const crewMatch = answer.match(/doporučen[ýáéí]\s+(?:parta|tým|brigade?)\s+(\d+)\s+lid/i);
  const crew_size = crewMatch ? parseInt(crewMatch[1], 10) : position.crew_size;

  return {
    days: Math.max(1, days), // Minimum 1 day
    source,
    crew_size
  };
}

/**
 * Fallback calculation (when AI unavailable)
 * Uses empirical productivity rates
 *
 * @param {Object} position - Position object
 * @returns {Object} Fallback estimate with days and reasoning
 */
function calculateFallbackDays(position) {
  const { subtype, qty, crew_size, shift_hours } = position;

  // Default crew size and shift hours if not provided
  const effectiveCrewSize = crew_size || 4;
  const effectiveShiftHours = shift_hours || 10;

  // Empirical productivity rates (person-hours per unit)
  // Based on typical construction productivity benchmarks
  const rates = {
    'beton': 1.5,     // 1.5 ph/m³ (6 m³/h with 4 workers = 1.5 ph/m³)
    'bednění': 0.8,   // 0.8 ph/m² (formwork assembly, 1.25 m²/ph)
    'výztuž': 0.005,  // 0.005 ph/kg (200 kg/h with 1 worker)
    'jiné': 1.0       // Default: 1 person-hour per unit
  };

  const rate = rates[subtype] || rates['jiné'];
  const total_ph = qty * rate;
  const days = Math.ceil(total_ph / (effectiveCrewSize * effectiveShiftHours));

  logger.info(`[Time Norms] Fallback calculation: ${qty} × ${rate} ph/unit ÷ (${effectiveCrewSize} × ${effectiveShiftHours}h) = ${days} days`);

  return {
    days: Math.max(1, days), // Minimum 1 day
    reasoning: `Empirický odhad: ${qty} ${position.unit} × ${rate} ph/jedn. ÷ (${effectiveCrewSize} lidí × ${effectiveShiftHours}h) = ${days} dní. (AI nedostupné - použita standardní produktivita)`
  };
}

/**
 * Check if concrete-agent Multi-Role API is available
 *
 * @returns {Promise<boolean>} True if available
 */
export async function checkMultiRoleAvailability() {
  const HEALTH_CHECK_TIMEOUT = 30000; // 30s for cold start
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

  try {
    const response = await fetch(`${CORE_API_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });

    if (response.ok) {
      logger.info(`[Time Norms] Multi-Role API available at ${CORE_API_URL}`);
      return true;
    }

    logger.warn(`[Time Norms] API returned status ${response.status}`);
    return false;
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn(`[Time Norms] API health check timed out (${HEALTH_CHECK_TIMEOUT}ms)`);
    } else {
      logger.warn(`[Time Norms] API not available: ${error.message}`);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Default export for compatibility
export default {
  suggestDays,
  checkMultiRoleAvailability
};
