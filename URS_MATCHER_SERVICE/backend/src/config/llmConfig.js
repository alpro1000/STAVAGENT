/**
 * LLM Configuration
 * Factory for selecting and configuring LLM provider (Claude, OpenAI)
 */

import { logger } from '../utils/logger.js';

const LLM_PROVIDERS = {
  CLAUDE: 'claude',
  OPENAI: 'openai'
};

/**
 * Get LLM configuration from environment
 * @returns {Object} LLM configuration object
 */
export function getLLMConfig() {
  const provider = process.env.LLM_PROVIDER || 'openai';
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.LLM_MODEL || 'gpt-4';
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);

  if (!apiKey) {
    logger.warn('[LLMConfig] No LLM_API_KEY or OPENAI_API_KEY set. LLM features will be disabled.');
    return {
      enabled: false,
      provider: provider,
      model: model,
      timeoutMs: timeoutMs
    };
  }

  // Validate provider
  if (!Object.values(LLM_PROVIDERS).includes(provider.toLowerCase())) {
    logger.warn(`[LLMConfig] Invalid LLM_PROVIDER: ${provider}. Using openai.`);
  }

  return {
    enabled: true,
    provider: provider.toLowerCase(),
    apiKey: apiKey,
    model: model,
    timeoutMs: timeoutMs
  };
}

/**
 * Create API client based on provider
 * @param {Object} config - LLM configuration
 * @returns {Object} API client instance
 */
export function createLLMClient(config) {
  if (!config.enabled) {
    logger.info('[LLMConfig] LLM disabled - using fallback mode');
    return null;
  }

  if (config.provider === LLM_PROVIDERS.CLAUDE) {
    return {
      provider: 'claude',
      apiUrl: 'https://api.anthropic.com/v1/messages',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      model: config.model,
      timeoutMs: config.timeoutMs
    };
  } else {
    // OpenAI
    return {
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'authorization': `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      model: config.model,
      timeoutMs: config.timeoutMs
    };
  }
}

/**
 * Validate that API key format is correct (basic check)
 * @param {string} apiKey - API key to validate
 * @param {string} provider - Provider type
 * @returns {boolean}
 */
export function validateAPIKey(apiKey, provider) {
  if (!apiKey) return false;

  if (provider === LLM_PROVIDERS.CLAUDE) {
    // Claude API keys start with 'sk-ant-'
    return apiKey.startsWith('sk-ant-');
  } else {
    // OpenAI API keys start with 'sk-'
    return apiKey.startsWith('sk-');
  }
}

export const PROVIDERS = LLM_PROVIDERS;
