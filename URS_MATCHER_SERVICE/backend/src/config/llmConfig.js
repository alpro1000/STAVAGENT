/**
 * LLM Configuration
 * Factory for selecting and configuring LLM provider (Claude, OpenAI, Gemini)
 */

import { logger } from '../utils/logger.js';

const LLM_PROVIDERS = {
  CLAUDE: 'claude',
  OPENAI: 'openai',
  GEMINI: 'gemini'
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
  } else if (provider.toLowerCase() === 'gemini') {
    apiKey = process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
  } else {
    apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  }

  // Set appropriate default model based on provider
  let defaultModel = 'gpt-4-turbo';
  if (provider.toLowerCase() === 'claude') {
    defaultModel = 'claude-sonnet-4-5-20250929';  // Latest Sonnet 4.5
  } else if (provider.toLowerCase() === 'gemini') {
    defaultModel = 'gemini-2.0-flash';  // Latest Gemini 2.0 Flash
  }

  const model = process.env.LLM_MODEL || defaultModel;
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);

  if (!apiKey) {
    logger.warn('[LLMConfig] No API key found for provider %s. Checked: ANTHROPIC_API_KEY, GOOGLE_API_KEY, LLM_API_KEY, OPENAI_API_KEY. LLM features will be disabled.', provider);
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
  } else if (config.provider === LLM_PROVIDERS.GEMINI) {
    return {
      provider: 'gemini',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
      headers: {
        'content-type': 'application/json'
      },
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs
    };
  } else {
    // OpenAI (default)
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
  } else if (provider === LLM_PROVIDERS.GEMINI) {
    // Gemini API keys are typically longer alphanumeric strings
    return apiKey.length > 20;
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

// ============================================================================
// MODEL PRICING & COST COMPARISON
// ============================================================================

/**
 * Model pricing information (USD per 1M tokens)
 * Last updated: December 2024
 */
const MODEL_PRICING = {
  // Claude models
  'claude-sonnet-4-5-20250929': {
    provider: 'claude',
    inputCost: 3.0,      // $3 per 1M input tokens
    outputCost: 15.0,    // $15 per 1M output tokens
    costPerMinute: 0.30, // Estimated for typical usage
    speedScore: 8,       // 1-10 scale (10 = fastest)
    qualityScore: 10     // 1-10 scale (10 = best)
  },
  'claude-opus': {
    provider: 'claude',
    inputCost: 15.0,
    outputCost: 75.0,
    costPerMinute: 1.50,
    speedScore: 6,
    qualityScore: 10
  },
  // OpenAI models
  'gpt-4-turbo': {
    provider: 'openai',
    inputCost: 10.0,
    outputCost: 30.0,
    costPerMinute: 1.00,
    speedScore: 7,
    qualityScore: 9
  },
  'gpt-4o': {
    provider: 'openai',
    inputCost: 5.0,
    outputCost: 15.0,
    costPerMinute: 0.50,
    speedScore: 9,
    qualityScore: 9
  },
  'gpt-4o-mini': {
    provider: 'openai',
    inputCost: 0.15,
    outputCost: 0.60,
    costPerMinute: 0.01,
    speedScore: 10,
    qualityScore: 7
  },
  // Gemini models
  'gemini-2.0-flash': {
    provider: 'gemini',
    inputCost: 0.075,     // $0.075 per 1M input tokens (cheapest!)
    outputCost: 0.30,     // $0.30 per 1M output tokens
    costPerMinute: 0.001, // Extremely cheap
    speedScore: 10,       // Very fast
    qualityScore: 8       // Good quality
  },
  'gemini-pro': {
    provider: 'gemini',
    inputCost: 0.5,
    outputCost: 1.5,
    costPerMinute: 0.05,
    speedScore: 9,
    qualityScore: 8
  }
};

/**
 * Get pricing info for a model
 * @param {string} model - Model name
 * @returns {Object} Pricing information
 */
export function getModelPricing(model) {
  return MODEL_PRICING[model] || {
    provider: 'unknown',
    inputCost: 0,
    outputCost: 0,
    costPerMinute: 0,
    speedScore: 5,
    qualityScore: 5
  };
}

/**
 * Recommend best model based on criteria
 * @param {string} criteria - 'cheapest', 'fastest', 'best_quality', 'balanced'
 * @returns {Object} Recommended model config
 */
export function recommendBestModel(criteria = 'balanced') {
  let bestModelName = null;
  let reason = '';

  switch(criteria) {
    case 'cheapest': {
      const models = Object.entries(MODEL_PRICING);
      bestModelName = models.reduce((best, [name, info]) => {
        if (!best || info.costPerMinute < MODEL_PRICING[best].costPerMinute) {
          return name;
        }
        return best;
      });
      const bestInfo = MODEL_PRICING[bestModelName];
      reason = `Lowest cost ($${bestInfo.costPerMinute}/min) - ideal for high volume`;
      break;
    }

    case 'fastest': {
      const models = Object.entries(MODEL_PRICING);
      bestModelName = models.reduce((best, [name, info]) => {
        if (!best || info.speedScore > MODEL_PRICING[best].speedScore) {
          return name;
        }
        return best;
      });
      const bestInfo = MODEL_PRICING[bestModelName];
      reason = `Fastest speed (${bestInfo.speedScore}/10) with low latency`;
      break;
    }

    case 'best_quality': {
      const models = Object.entries(MODEL_PRICING);
      bestModelName = models.reduce((best, [name, info]) => {
        if (!best || info.qualityScore > MODEL_PRICING[best].qualityScore) {
          return name;
        }
        return best;
      });
      const bestInfo = MODEL_PRICING[bestModelName];
      reason = `Best quality (${bestInfo.qualityScore}/10) with excellent performance`;
      break;
    }

    case 'balanced':
    default: {
      // Balance cost and quality: 50% quality, 30% cost, 20% speed
      const scoreByBalance = (info) =>
        (info.qualityScore * 0.5) +
        ((10 - (info.costPerMinute / 1.5 * 10)) * 0.3) +
        (info.speedScore * 0.2);

      const models = Object.entries(MODEL_PRICING);
      bestModelName = models.reduce((best, [name, info]) => {
        const score = scoreByBalance(info);
        if (!best || score > scoreByBalance(MODEL_PRICING[best])) {
          return name;
        }
        return best;
      });
      const bestInfo = MODEL_PRICING[bestModelName];
      reason = `Optimal balance: fast (${bestInfo.speedScore}/10), cheap ($${bestInfo.costPerMinute}/min), quality (${bestInfo.qualityScore}/10)`;
      break;
    }
  }

  const bestInfo = MODEL_PRICING[bestModelName];
  return {
    model: bestModelName,
    provider: bestInfo.provider,
    reason: reason
  };
}

/**
 * Compare two models
 * @param {string} model1 - First model name
 * @param {string} model2 - Second model name
 * @returns {Object} Comparison results
 */
export function compareModels(model1, model2) {
  const info1 = getModelPricing(model1);
  const info2 = getModelPricing(model2);

  return {
    model1: {
      name: model1,
      costPerMinute: info1.costPerMinute,
      speed: info1.speedScore,
      quality: info1.qualityScore
    },
    model2: {
      name: model2,
      costPerMinute: info2.costPerMinute,
      speed: info2.speedScore,
      quality: info2.qualityScore
    },
    costDifference: {
      cheaper: info1.costPerMinute < info2.costPerMinute ? model1 : model2,
      savingsPercent: Math.abs(info1.costPerMinute - info2.costPerMinute) / Math.max(info1.costPerMinute, info2.costPerMinute) * 100
    }
  };
}
