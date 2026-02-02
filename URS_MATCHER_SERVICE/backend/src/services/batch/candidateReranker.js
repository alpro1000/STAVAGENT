/**
 * Candidate Reranker Service
 * Scores and selects best ÚRS candidates using LLM
 *
 * Purpose:
 * - Use Gemini LLM to score candidates (0-100)
 * - Select top N candidates based on match quality
 * - Add confidence level (high/medium/low)
 * - Add reasoning and evidence for selection
 * - Flag needs_review if uncertain
 *
 * CRITICAL: Only select codes from the candidates list (NO hallucinations!)
 *
 * @module services/batch/candidateReranker
 */

import { logger } from '../../utils/logger.js';
import { callLLM } from '../llmClient.js';
import { getModelForTask, getTaskTypes } from '../../config/llmConfig.js';

// ============================================================================
// MAIN RERANKING FUNCTION
// ============================================================================

/**
 * Rerank and select top candidates
 * @param {Object} subWork - Subwork to match
 * @param {Array<Object>} candidates - Candidates from retrieval
 * @param {number} [topN=4] - Number of top candidates to return
 * @returns {Object} Reranking result
 */
export async function rerank(subWork, candidates, topN = 4) {
  const startTime = Date.now();

  try {
    logger.info(`[CandidateReranker] Subwork: "${subWork.text}"`);
    logger.info(`[CandidateReranker] Candidates: ${candidates.length}`);
    logger.debug(`[CandidateReranker] Top N: ${topN}`);

    // Handle empty candidates
    if (!candidates || candidates.length === 0) {
      logger.warn('[CandidateReranker] No candidates provided');
      return {
        subWork: subWork,
        topCandidates: [],
        reasoning: 'No candidates found in search',
        timing: {
          totalMs: Date.now() - startTime,
          llmMs: 0
        }
      };
    }

    // Build LLM prompt
    const prompt = buildRerankPrompt(subWork, candidates, topN);

    // Get Gemini model config
    const modelConfig = getModelForTask(getTaskTypes().URS_SELECTION);
    logger.info(`[CandidateReranker] Using model: ${modelConfig.provider}/${modelConfig.model}`);

    // Call LLM
    const llmStartTime = Date.now();
    const llmResponse = await callLLM({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      maxTokens: 2000,
      temperature: 0.1  // Very low temperature for consistency
    }, modelConfig);
    const llmElapsed = Date.now() - llmStartTime;

    logger.debug(`[CandidateReranker] LLM response: ${llmResponse.content}`);
    logger.info(`[CandidateReranker] LLM timing: ${llmElapsed}ms`);

    // Parse LLM response
    const parsedResult = parseLLMResponse(llmResponse.content, candidates);

    // Validate: ensure all returned codes exist in candidates
    const validatedCandidates = validateCandidates(parsedResult.topCandidates, candidates);

    const elapsed = Date.now() - startTime;

    const result = {
      subWork: subWork,
      topCandidates: validatedCandidates,
      reasoning: parsedResult.reasoning || 'No reasoning provided',
      timing: {
        totalMs: elapsed,
        llmMs: llmElapsed
      }
    };

    logger.info(`[CandidateReranker] Result: ${result.topCandidates.length} candidates selected`);
    result.topCandidates.forEach((c, i) => {
      logger.info(`[CandidateReranker]   ${i + 1}. ${c.code} - ${c.name} (score: ${c.score}, confidence: ${c.confidence})`);
    });
    logger.info(`[CandidateReranker] Reasoning: ${result.reasoning}`);
    logger.info(`[CandidateReranker] Timing: ${elapsed}ms total (LLM: ${llmElapsed}ms)`);

    return result;

  } catch (error) {
    logger.error(`[CandidateReranker] Error: ${error.message}`);
    logger.error(`[CandidateReranker] Stack: ${error.stack}`);

    // Return fallback: unknown + low confidence
    return {
      subWork: subWork,
      topCandidates: [{
        rank: 1,
        code: 'UNKNOWN',
        name: 'No match found',
        unit: '',
        score: 0,
        confidence: 'low',
        reason: `Reranking failed: ${error.message}`,
        evidence: '',
        needsReview: true,
        source: 'error'
      }],
      reasoning: `Error during reranking: ${error.message}`,
      timing: {
        totalMs: Date.now() - startTime,
        llmMs: 0
      },
      error: error.message
    };
  }
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build LLM prompt for candidate reranking
 * @param {Object} subWork - Subwork to match
 * @param {Array<Object>} candidates - Candidates to score
 * @param {number} topN - Number of top candidates
 * @returns {string} Prompt for LLM
 */
function buildRerankPrompt(subWork, candidates, topN) {
  // Format candidates for prompt
  const candidatesList = candidates.map((c, i) => {
    return `${i + 1}. Code: ${c.code} | Name: ${c.name} | Unit: ${c.unit || 'N/A'}${c.snippet ? ` | Snippet: ${c.snippet.substring(0, 80)}` : ''}`;
  }).join('\n');

  return `You are a ÚRS (Czech construction pricing system) expert. Score these candidates for the given work description.

**WORK TO MATCH:**
Text: "${subWork.text}"
Operation: ${subWork.operation || 'unknown'}
Keywords: ${JSON.stringify(subWork.keywords)}

**CANDIDATES FROM SEARCH (${candidates.length} total):**
${candidatesList}

**SCORING RULES:**
1. **CRITICAL:** Only select from the candidates list above. NEVER invent or hallucinate codes.
2. Score 0-100 based on:
   - Operation match: Does the ÚRS item match the work operation? (40 points)
   - Material/object match: Does it match the material/object? (30 points)
   - Unit appropriateness: Is the unit correct for this type of work? (20 points)
   - Keywords overlap: How many keywords match? (10 points)

3. Confidence levels:
   - **high**: score 90-100, exact match, all features align
   - **medium**: score 70-89, good match, minor differences
   - **low**: score < 70, uncertain match, significant differences

4. If NO good match exists (all scores < 50):
   - Return score=0, confidence=low, needsReview=true
   - reason: "No suitable match found in search results"

5. Return top ${topN} candidates, sorted by score (highest first)

**OUTPUT FORMAT (JSON only, no markdown):**
{
  "topCandidates": [
    {
      "rank": 1,
      "code": "CODE FROM LIST ABOVE",
      "name": "NAME FROM LIST ABOVE",
      "unit": "UNIT FROM LIST ABOVE",
      "score": 0-100,
      "confidence": "high" | "medium" | "low",
      "reason": "Short explanation (1 sentence)",
      "evidence": "Key matching words/features",
      "needsReview": false | true
    }
  ],
  "reasoning": "Overall assessment (1-2 sentences)"
}

**EXAMPLES:**

Work: "Výkop stavební jámy kat. 3"
Candidates:
1. 121101101 | Hloubení jam nezapažených v hornině tř. 3 | m3
2. 121101201 | Hloubení jam zapažených v hornině tř. 3 | m3
3. 122101101 | Hloubení rýh v hornině tř. 3 | m3

Output:
{
  "topCandidates": [
    {
      "rank": 1,
      "code": "121101101",
      "name": "Hloubení jam nezapažených v hornině tř. 3",
      "unit": "m3",
      "score": 95,
      "confidence": "high",
      "reason": "Exact match for excavation of pit in category 3 soil",
      "evidence": "výkop + jáma + kategorie 3 + hloubení",
      "needsReview": false
    },
    {
      "rank": 2,
      "code": "121101201",
      "name": "Hloubení jam zapažených v hornině tř. 3",
      "unit": "m3",
      "score": 75,
      "confidence": "medium",
      "reason": "Similar but assumes shoring (zapažení) which is not specified",
      "evidence": "jáma + kategorie 3",
      "needsReview": false
    }
  ],
  "reasoning": "Top candidate is exact match for pit excavation in category 3. Second candidate assumes shoring."
}

Work: "Speciální betonová směs XYZ"
Candidates:
1. 274313811 | Základové pasy z betonu C 25/30 | m3
2. 273326121 | Základová deska z betonu C 25/30 | m3

Output:
{
  "topCandidates": [
    {
      "rank": 1,
      "code": "UNKNOWN",
      "name": "No suitable match",
      "unit": "",
      "score": 0,
      "confidence": "low",
      "reason": "No match found for special concrete mix XYZ in search results",
      "evidence": "",
      "needsReview": true
    }
  ],
  "reasoning": "No suitable candidates found. The specific concrete mix 'XYZ' is not present in search results."
}

Now score the candidates above and respond with JSON only.`;
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Parse LLM JSON response
 * @param {string} content - LLM response text
 * @param {Array<Object>} originalCandidates - Original candidates for validation
 * @returns {Object} Parsed result
 */
function parseLLMResponse(content, originalCandidates) {
  try {
    // Remove markdown code blocks if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }

    // Parse JSON
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.topCandidates || !Array.isArray(parsed.topCandidates)) {
      logger.warn('[CandidateReranker] Missing or invalid topCandidates array');
      return {
        topCandidates: [],
        reasoning: 'Failed to parse LLM response'
      };
    }

    // Validate and normalize each candidate
    parsed.topCandidates = parsed.topCandidates.map((c, i) => ({
      rank: c.rank || (i + 1),
      code: c.code || 'UNKNOWN',
      name: c.name || 'Unknown',
      unit: c.unit || '',
      score: typeof c.score === 'number' ? Math.max(0, Math.min(100, c.score)) : 0,
      confidence: ['high', 'medium', 'low'].includes(c.confidence) ? c.confidence : 'low',
      reason: c.reason || 'No reason provided',
      evidence: c.evidence || '',
      needsReview: Boolean(c.needsReview),
      source: 'llm_rerank'
    }));

    // Auto-flag needs_review if confidence is low or score < 50
    parsed.topCandidates.forEach(c => {
      if (c.confidence === 'low' || c.score < 50) {
        c.needsReview = true;
      }
    });

    return parsed;

  } catch (error) {
    logger.error(`[CandidateReranker] JSON parse error: ${error.message}`);
    logger.error(`[CandidateReranker] Raw content: ${content}`);

    // Return fallback
    return {
      topCandidates: [{
        rank: 1,
        code: 'UNKNOWN',
        name: 'Parse error',
        unit: '',
        score: 0,
        confidence: 'low',
        reason: `Failed to parse LLM response: ${error.message}`,
        evidence: '',
        needsReview: true,
        source: 'error'
      }],
      reasoning: `Parse error: ${error.message}`
    };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that all returned codes exist in original candidates
 * @param {Array<Object>} topCandidates - LLM-selected candidates
 * @param {Array<Object>} originalCandidates - Original candidates from search
 * @returns {Array<Object>} Validated candidates
 */
function validateCandidates(topCandidates, originalCandidates) {
  const validCodes = new Set(originalCandidates.map(c => c.code));
  const validated = [];

  for (const candidate of topCandidates) {
    // Allow "UNKNOWN" as special case
    if (candidate.code === 'UNKNOWN') {
      validated.push(candidate);
      continue;
    }

    // Check if code exists in original candidates
    if (validCodes.has(candidate.code)) {
      validated.push(candidate);
    } else {
      logger.warn(`[CandidateReranker] WARNING: LLM returned invalid code: ${candidate.code} (not in search results)`);
      logger.warn('[CandidateReranker] This is a hallucination! Code will be replaced with UNKNOWN.');

      // Replace with UNKNOWN
      validated.push({
        rank: candidate.rank,
        code: 'UNKNOWN',
        name: `Invalid code: ${candidate.code}`,
        unit: '',
        score: 0,
        confidence: 'low',
        reason: `LLM hallucinated code ${candidate.code} which does not exist in search results`,
        evidence: '',
        needsReview: true,
        source: 'hallucination_detected'
      });
    }
  }

  return validated;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  rerank
};
