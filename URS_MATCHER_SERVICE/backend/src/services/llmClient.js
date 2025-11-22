/**
 * LLM Client (OpenAI / Claude)
 * Placeholder for MVP-1
 * Will be implemented in MVP-2
 */

import { logger } from '../utils/logger.js';

export async function matchUrsItemWithAI(text, candidates) {
  // TODO: MVP-2 - Integrate OpenAI or Claude
  logger.info('[LLMClient] LLM matching will be added in MVP-2');
  return candidates;
}

export async function explainMapping(input, chosen) {
  // TODO: MVP-2 - Generate explanation using LLM
  return {
    reason: 'LLM explanations will be added in MVP-2',
    confidence: 0.5
  };
}
