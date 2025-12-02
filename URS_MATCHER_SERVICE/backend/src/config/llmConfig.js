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

  // Determine API key based on provider
  let apiKey;
  if (provider.toLowerCase() === 'claude') {
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;
  } else {
    apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  }

  // Set appropriate default model based on provider
  let defaultModel = 'gpt-4-turbo';
  if (provider.toLowerCase() === 'claude') {
    defaultModel = 'claude-sonnet-4-5-20250929';  // Latest Sonnet 4.5
  }

  const model = process.env.LLM_MODEL || defaultModel;
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);

  if (!apiKey) {
    logger.warn('[LLMConfig] No API key found for provider %s. Checked: ANTHROPIC_API_KEY, LLM_API_KEY, OPENAI_API_KEY. LLM features will be disabled.', provider);
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

// ============================================================================
// CATALOG MODE CONFIGURATION
// ============================================================================

const CATALOG_MODES = {
  LOCAL: 'local',                    // Use local SQLite database
  PERPLEXITY_ONLY: 'perplexity_only' // Search via Perplexity API only
};

/**
 * Get catalog mode from environment
 * @returns {string} Catalog mode: 'local' or 'perplexity_only'
 */
export function getCatalogMode() {
  const mode = process.env.URS_CATALOG_MODE || CATALOG_MODES.LOCAL;

  if (!Object.values(CATALOG_MODES).includes(mode)) {
    logger.warn(`[CatalogMode] Invalid URS_CATALOG_MODE: ${mode}. Using 'local'.`);
    return CATALOG_MODES.LOCAL;
  }

  logger.info(`[CatalogMode] Using catalog mode: ${mode}`);
  return mode;
}

export const CATALOG_MODE = getCatalogMode();

// ============================================================================
// PERPLEXITY CONFIGURATION
// ============================================================================

/**
 * Get Perplexity API configuration
 * @returns {Object} Perplexity config
 */
export function getPerplexityConfig() {
  const apiKey = process.env.PPLX_API_KEY;
  const model = process.env.PPLX_MODEL || 'sonar';
  const timeoutMs = parseInt(process.env.PPLX_TIMEOUT_MS || '30000', 10);

  if (!apiKey) {
    logger.warn('[PerplexityConfig] No PPLX_API_KEY set. Perplexity features will be disabled.');
    return {
      enabled: false,
      model: model,
      timeoutMs: timeoutMs
    };
  }

  return {
    enabled: true,
    apiKey: apiKey,
    model: model,
    apiUrl: 'https://api.perplexity.ai/chat/completions',
    timeoutMs: timeoutMs
  };
}

export const PERPLEXITY_CONFIG = getPerplexityConfig();
