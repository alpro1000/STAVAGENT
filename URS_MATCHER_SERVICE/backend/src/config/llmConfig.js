/**
 * LLM Configuration
 * Factory for selecting and configuring LLM provider (Claude, OpenAI, Gemini)
 */

import { logger } from '../utils/logger.js';

const LLM_PROVIDERS = {
  CLAUDE: 'claude',
  OPENAI: 'openai',
  GEMINI: 'gemini',
  DEEPSEEK: 'deepseek',    // DeepSeek (Chinese, very cheap)
  GROK: 'grok',            // xAI Grok
  QWEN: 'qwen',            // Alibaba Qwen (free tier available)
  GLM: 'glm'               // Zhipu GLM-4 (Chinese)
};

/**
 * Get LLM configuration from environment
 * Supports multiple providers with fallback mechanism
 * @returns {Object} LLM configuration object
 */
export function getLLMConfig() {
  // CHECK RUNTIME SELECTED MODEL FIRST (from UI selection)
  if (runtimeSelectedModel && runtimeSelectedProvider) {
    const apiKey = getApiKeyForProvider(runtimeSelectedProvider);
    if (apiKey) {
      logger.debug(`[LLMConfig] Using runtime selected model: ${runtimeSelectedModel} (${runtimeSelectedProvider})`);
      return {
        enabled: true,
        provider: runtimeSelectedProvider,
        apiKey: apiKey,
        model: runtimeSelectedModel,
        timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10),
        primaryProvider: runtimeSelectedProvider,
        isRuntimeSelected: true
      };
    }
  }

  // Fall back to environment configuration
  const primaryProvider = process.env.LLM_PROVIDER || 'gemini';

  // Determine API key based on provider
  const provider = primaryProvider.toLowerCase();
  let apiKey;
  let defaultModel;

  switch (provider) {
  case 'claude':
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;
    defaultModel = 'claude-sonnet-4-5-20250929';
    break;
  case 'gemini':
    apiKey = process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
    defaultModel = 'gemini-2.0-flash';
    break;
  case 'deepseek':
    apiKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
    defaultModel = 'deepseek-chat';  // DeepSeek V3 (very cheap!)
    break;
  case 'grok':
    apiKey = process.env.XAI_API_KEY || process.env.LLM_API_KEY;
    defaultModel = 'grok-2';
    break;
  case 'qwen':
    apiKey = process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY;
    defaultModel = 'qwen-plus';  // Alibaba Qwen
    break;
  case 'glm':
    apiKey = process.env.ZHIPU_API_KEY || process.env.LLM_API_KEY;
    defaultModel = 'glm-4-flash';  // Zhipu GLM-4 Flash (free)
    break;
  default:
    apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    defaultModel = 'gpt-4o-mini';
  }

  const model = process.env.LLM_MODEL || defaultModel;
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10);

  if (!apiKey) {
    logger.warn('[LLMConfig] No API key found for primary provider %s. Checked: ANTHROPIC_API_KEY, GOOGLE_API_KEY, LLM_API_KEY, OPENAI_API_KEY. Fallback providers will be used.', primaryProvider);
  }

  // Validate provider
  if (!Object.values(LLM_PROVIDERS).includes(primaryProvider.toLowerCase())) {
    logger.warn(`[LLMConfig] Invalid LLM_PROVIDER: ${primaryProvider}. Using gemini.`);
  }

  return {
    enabled: Boolean(apiKey),
    provider: primaryProvider.toLowerCase(),
    apiKey: apiKey,
    model: model,
    timeoutMs: timeoutMs,
    primaryProvider: primaryProvider.toLowerCase(),
    isRuntimeSelected: false
  };
}

/**
 * Get API key for a specific provider
 */
function getApiKeyForProvider(provider) {
  switch (provider) {
  case 'claude':
    return process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;
  case 'gemini':
    return process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
  case 'deepseek':
    return process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  case 'grok':
    return process.env.XAI_API_KEY || process.env.LLM_API_KEY;
  case 'qwen':
    return process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY;
  case 'glm':
    return process.env.ZHIPU_API_KEY || process.env.LLM_API_KEY;
  case 'openai':
    return process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  default:
    return process.env.LLM_API_KEY;
  }
}

/**
 * Get available LLM providers with their configurations
 * Used for fallback mechanism
 * @returns {Object} All available providers
 */
export function getAvailableProviders() {
  const providers = {};

  // Check Claude
  const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;
  if (claudeKey) {
    providers.claude = {
      enabled: true,
      provider: 'claude',
      apiKey: claudeKey,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10)
    };
  }

  // Check Gemini
  const geminiKey = process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
  if (geminiKey) {
    providers.gemini = {
      enabled: true,
      provider: 'gemini',
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10)
    };
  }

  // Check OpenAI
  const openaiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (openaiKey) {
    providers.openai = {
      enabled: true,
      provider: 'openai',
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',  // 66x cheaper than gpt-4-turbo
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10)
    };
  }

  // Check DeepSeek (OpenAI-compatible API, very cheap!)
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    providers.deepseek = {
      enabled: true,
      provider: 'deepseek',
      apiKey: deepseekKey,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10)
    };
  }

  // Check Grok (xAI)
  const grokKey = process.env.XAI_API_KEY;
  if (grokKey) {
    providers.grok = {
      enabled: true,
      provider: 'grok',
      apiKey: grokKey,
      model: process.env.GROK_MODEL || 'grok-2',
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10)
    };
  }

  // Check Qwen (Alibaba DashScope)
  const qwenKey = process.env.DASHSCOPE_API_KEY;
  if (qwenKey) {
    providers.qwen = {
      enabled: true,
      provider: 'qwen',
      apiKey: qwenKey,
      model: process.env.QWEN_MODEL || 'qwen-plus',
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10)
    };
  }

  // Check GLM (Zhipu AI - Chinese, has free tier)
  const glmKey = process.env.ZHIPU_API_KEY;
  if (glmKey) {
    providers.glm = {
      enabled: true,
      provider: 'glm',
      apiKey: glmKey,
      model: process.env.GLM_MODEL || 'glm-4-flash',  // Free tier available
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '90000', 10)
    };
  }

  logger.info('[LLMConfig] Available providers: %s', Object.keys(providers).join(', '));
  return providers;
}

/**
 * Get fallback provider chain
 * Order of providers to try if primary fails
 * @param {string} primaryProvider - Primary provider to use first
 * @returns {Array} Array of provider names in fallback order
 */
export function getFallbackChain(primaryProvider = null) {
  const primary = primaryProvider || process.env.LLM_PROVIDER || 'gemini';

  // Define fallback chains for each provider
  // Priority: cheapest/free first for fallbacks
  const defaultFallback = ['deepseek', 'glm', 'qwen', 'gemini', 'grok', 'openai', 'claude'];

  const chains = {
    gemini: ['gemini', 'deepseek', 'glm', 'qwen', 'grok', 'openai', 'claude'],
    claude: ['claude', 'deepseek', 'gemini', 'glm', 'qwen', 'grok', 'openai'],
    openai: ['openai', 'deepseek', 'gemini', 'glm', 'qwen', 'grok', 'claude'],
    deepseek: ['deepseek', 'glm', 'qwen', 'gemini', 'grok', 'openai', 'claude'],
    grok: ['grok', 'deepseek', 'gemini', 'glm', 'qwen', 'openai', 'claude'],
    qwen: ['qwen', 'deepseek', 'glm', 'gemini', 'grok', 'openai', 'claude'],
    glm: ['glm', 'deepseek', 'qwen', 'gemini', 'grok', 'openai', 'claude']
  };

  return chains[primary.toLowerCase()] || defaultFallback;
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

  const provider = config.provider;

  // Claude (Anthropic)
  if (provider === LLM_PROVIDERS.CLAUDE) {
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
  }

  // Gemini (Google)
  if (provider === LLM_PROVIDERS.GEMINI) {
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
  }

  // DeepSeek (OpenAI-compatible API)
  if (provider === LLM_PROVIDERS.DEEPSEEK) {
    return {
      provider: 'deepseek',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'authorization': `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      model: config.model,
      timeoutMs: config.timeoutMs,
      isOpenAICompatible: true
    };
  }

  // Grok (xAI - OpenAI-compatible API)
  if (provider === LLM_PROVIDERS.GROK) {
    return {
      provider: 'grok',
      apiUrl: 'https://api.x.ai/v1/chat/completions',
      headers: {
        'authorization': `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      model: config.model,
      timeoutMs: config.timeoutMs,
      isOpenAICompatible: true
    };
  }

  // Qwen (Alibaba DashScope)
  if (provider === LLM_PROVIDERS.QWEN) {
    return {
      provider: 'qwen',
      apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      headers: {
        'authorization': `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      model: config.model,
      timeoutMs: config.timeoutMs,
      isOpenAICompatible: true
    };
  }

  // GLM (Zhipu AI - OpenAI-compatible API)
  if (provider === LLM_PROVIDERS.GLM) {
    return {
      provider: 'glm',
      apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      headers: {
        'authorization': `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      model: config.model,
      timeoutMs: config.timeoutMs,
      isOpenAICompatible: true
    };
  }

  // OpenAI (default)
  return {
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    headers: {
      'authorization': `Bearer ${config.apiKey}`,
      'content-type': 'application/json'
    },
    model: config.model,
    timeoutMs: config.timeoutMs,
    isOpenAICompatible: true
  };
}

/**
 * Validate that API key format is correct (basic check)
 * @param {string} apiKey - API key to validate
 * @param {string} provider - Provider type
 * @returns {boolean}
 */
export function validateAPIKey(apiKey, provider) {
  if (!apiKey) {return false;}

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
  const timeoutMs = parseInt(process.env.PPLX_TIMEOUT_MS || '60000', 10);

  if (!apiKey) {
    logger.warn('[PerplexityConfig] No PPLX_API_KEY set. Perplexity features will be disabled.');
    return {
      enabled: false,
      model: model,
      timeoutMs: timeoutMs
    };
  }

  // Validate API key format
  if (!apiKey.startsWith('pplx-')) {
    logger.warn(`[PerplexityConfig] PPLX_API_KEY does not start with "pplx-" (starts with "${apiKey.substring(0, 4)}..."). This may cause 401 errors.`);
  }

  logger.info(`[PerplexityConfig] Perplexity ENABLED: model=${model}, timeout=${timeoutMs}ms, key=${apiKey.substring(0, 8)}...`);

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
// BRAVE SEARCH CONFIGURATION
// ============================================================================

/**
 * Get Brave Search API configuration
 * Brave Search can supplement or replace Perplexity for URS catalog search
 * @returns {Object} Brave config
 */
export function getBraveSearchConfig() {
  const apiKey = process.env.BRAVE_API_KEY;
  const timeoutMs = parseInt(process.env.BRAVE_TIMEOUT_MS || '15000', 10);

  if (!apiKey) {
    logger.info('[BraveConfig] No BRAVE_API_KEY set. Brave Search fallback will be disabled.');
    return {
      enabled: false,
      timeoutMs: timeoutMs
    };
  }

  logger.info(`[BraveConfig] Brave Search ENABLED: timeout=${timeoutMs}ms, key=${apiKey.substring(0, 8)}...`);

  return {
    enabled: true,
    apiKey: apiKey,
    apiUrl: 'https://api.search.brave.com/res/v1/web/search',
    timeoutMs: timeoutMs
  };
}

export const BRAVE_SEARCH_CONFIG = getBraveSearchConfig();

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
  },
  // DeepSeek models (VERY CHEAP!)
  'deepseek-chat': {
    provider: 'deepseek',
    inputCost: 0.14,      // $0.14 per 1M input tokens (cache hit: $0.014!)
    outputCost: 0.28,     // $0.28 per 1M output tokens
    costPerMinute: 0.001, // Extremely cheap
    speedScore: 9,
    qualityScore: 9       // Very good quality, comparable to GPT-4
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    inputCost: 0.55,
    outputCost: 2.19,
    costPerMinute: 0.01,
    speedScore: 7,
    qualityScore: 10      // Best reasoning
  },
  // Grok models (xAI)
  'grok-2': {
    provider: 'grok',
    inputCost: 2.0,
    outputCost: 10.0,
    costPerMinute: 0.20,
    speedScore: 8,
    qualityScore: 9
  },
  'grok-2-mini': {
    provider: 'grok',
    inputCost: 0.2,
    outputCost: 1.0,
    costPerMinute: 0.02,
    speedScore: 10,
    qualityScore: 7
  },
  // Qwen models (Alibaba)
  'qwen-plus': {
    provider: 'qwen',
    inputCost: 0.8,
    outputCost: 2.0,
    costPerMinute: 0.03,
    speedScore: 9,
    qualityScore: 8
  },
  'qwen-turbo': {
    provider: 'qwen',
    inputCost: 0.3,
    outputCost: 0.6,
    costPerMinute: 0.01,
    speedScore: 10,
    qualityScore: 7
  },
  // GLM models (Zhipu AI - has FREE tier!)
  'glm-4-flash': {
    provider: 'glm',
    inputCost: 0.0,       // FREE for limited usage!
    outputCost: 0.0,
    costPerMinute: 0.0,
    speedScore: 9,
    qualityScore: 7
  },
  'glm-4': {
    provider: 'glm',
    inputCost: 0.7,
    outputCost: 0.7,
    costPerMinute: 0.02,
    speedScore: 8,
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
    }, null);
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
    }, null);
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
    }, null);
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
    }, null);
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

// ============================================================================
// TASK-BASED MODEL ROUTING
// ============================================================================

/**
 * Task types for model routing
 */
const TASK_TYPES = {
  KEYWORD_GENERATION: 'keyword_generation',  // Fast, cheap - extract keywords
  TRANSLATION: 'translation',                 // Fast - translate text
  BLOCK_ANALYSIS: 'block_analysis',           // Quality - analyze work blocks
  URS_SELECTION: 'urs_selection',             // Quality - select URS codes
  VALIDATION: 'validation',                   // Different POV - validate results
  NORMS_INTERPRETATION: 'norms_interpretation' // Quality - interpret standards
};

/**
 * Model recommendations per task type
 * Priority order: [best, fallback1, fallback2]
 */
const TASK_MODEL_ROUTING = {
  [TASK_TYPES.KEYWORD_GENERATION]: {
    priority: ['gemini', 'openai', 'claude'],
    reason: 'Fast and cheap for simple extraction',
    preferModel: 'gemini-2.0-flash'
  },
  [TASK_TYPES.TRANSLATION]: {
    priority: ['gemini', 'claude', 'openai'],
    reason: 'Fast translation with good quality',
    preferModel: 'gemini-2.0-flash'
  },
  [TASK_TYPES.BLOCK_ANALYSIS]: {
    priority: ['claude', 'openai', 'gemini'],
    reason: 'Complex reasoning requires best quality',
    preferModel: 'claude-sonnet-4-5-20250929'
  },
  [TASK_TYPES.URS_SELECTION]: {
    priority: ['claude', 'openai', 'gemini'],
    reason: 'Critical decision - needs expert reasoning',
    preferModel: 'claude-sonnet-4-5-20250929'
  },
  [TASK_TYPES.VALIDATION]: {
    priority: ['openai', 'claude', 'gemini'],
    reason: 'Different POV for validation',
    preferModel: 'gpt-4-turbo'
  },
  [TASK_TYPES.NORMS_INTERPRETATION]: {
    priority: ['claude', 'openai', 'gemini'],
    reason: 'Technical norms require precise understanding',
    preferModel: 'claude-sonnet-4-5-20250929'
  }
};

/**
 * Get best model configuration for a specific task
 * @param {string} taskType - Type of task (from TASK_TYPES)
 * @returns {Object} Model configuration for the task
 */
export function getModelForTask(taskType) {
  const routing = TASK_MODEL_ROUTING[taskType];
  if (!routing) {
    logger.warn(`[ModelRouter] Unknown task type: ${taskType}, using default`);
    return getLLMConfig();
  }

  const availableProviders = getAvailableProviders();

  // Find first available provider from priority list
  for (const provider of routing.priority) {
    if (availableProviders[provider]?.enabled) {
      const config = availableProviders[provider];

      // Override model if preferred model matches provider
      if (routing.preferModel && getModelPricing(routing.preferModel)?.provider === provider) {
        config.model = routing.preferModel;
      }

      logger.info(`[ModelRouter] Task "${taskType}" → ${provider}/${config.model} (${routing.reason})`);
      return config;
    }
  }

  // Fallback to default config
  logger.warn(`[ModelRouter] No provider available for task "${taskType}", using default`);
  return getLLMConfig();
}

/**
 * Get all task types
 */
export function getTaskTypes() {
  return TASK_TYPES;
}

export const TASK_ROUTING = TASK_MODEL_ROUTING;

// ============================================================================
// MODEL SELECTION API
// ============================================================================

/**
 * Get all available models with their details
 * Used by frontend for model selection dropdown
 * @returns {Array} List of models with provider, pricing, and availability
 */
export function getAllModels() {
  const availableProviders = getAvailableProviders();
  const models = [];

  for (const [modelName, info] of Object.entries(MODEL_PRICING)) {
    const providerAvailable = availableProviders[info.provider]?.enabled || false;

    models.push({
      id: modelName,
      name: formatModelName(modelName),
      provider: info.provider,
      providerName: formatProviderName(info.provider),
      available: providerAvailable,
      pricing: {
        inputCost: info.inputCost,
        outputCost: info.outputCost,
        costPerMinute: info.costPerMinute,
        isFree: info.costPerMinute === 0
      },
      scores: {
        speed: info.speedScore,
        quality: info.qualityScore
      },
      recommended: isRecommendedModel(modelName)
    });
  }

  // Sort by: available first, then by cost (cheapest first)
  models.sort((a, b) => {
    if (a.available !== b.available) return b.available ? 1 : -1;
    return a.pricing.costPerMinute - b.pricing.costPerMinute;
  });

  return models;
}

/**
 * Format model name for display
 */
function formatModelName(modelId) {
  const names = {
    'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
    'claude-opus': 'Claude Opus',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-pro': 'Gemini Pro',
    'deepseek-chat': 'DeepSeek V3 Chat',
    'deepseek-reasoner': 'DeepSeek Reasoner',
    'grok-2': 'Grok 2',
    'grok-2-mini': 'Grok 2 Mini',
    'qwen-plus': 'Qwen Plus',
    'qwen-turbo': 'Qwen Turbo',
    'glm-4-flash': 'GLM-4 Flash (Free)',
    'glm-4': 'GLM-4'
  };
  return names[modelId] || modelId;
}

/**
 * Format provider name for display
 */
function formatProviderName(provider) {
  const names = {
    'claude': 'Anthropic',
    'openai': 'OpenAI',
    'gemini': 'Google',
    'deepseek': 'DeepSeek',
    'grok': 'xAI',
    'qwen': 'Alibaba',
    'glm': 'Zhipu AI'
  };
  return names[provider] || provider;
}

/**
 * Check if model is recommended (best value)
 */
function isRecommendedModel(modelId) {
  // Recommended models: cheap + good quality
  const recommended = ['deepseek-chat', 'gemini-2.0-flash', 'glm-4-flash', 'gpt-4o-mini'];
  return recommended.includes(modelId);
}

/**
 * Runtime model selection storage
 * Allows changing model without restart
 */
let runtimeSelectedModel = null;
let runtimeSelectedProvider = null;

/**
 * Set model at runtime (for user selection)
 * @param {string} modelId - Model ID to use
 * @returns {Object} Result with success status
 */
export function setRuntimeModel(modelId) {
  const pricing = getModelPricing(modelId);

  if (!pricing || pricing.provider === 'unknown') {
    logger.warn(`[LLMConfig] Unknown model: ${modelId}`);
    return { success: false, error: `Unknown model: ${modelId}` };
  }

  const availableProviders = getAvailableProviders();
  if (!availableProviders[pricing.provider]?.enabled) {
    logger.warn(`[LLMConfig] Provider ${pricing.provider} not available for model ${modelId}`);
    return {
      success: false,
      error: `Provider ${pricing.provider} not configured. Set ${getEnvKeyForProvider(pricing.provider)} environment variable.`
    };
  }

  runtimeSelectedModel = modelId;
  runtimeSelectedProvider = pricing.provider;

  logger.info(`[LLMConfig] Runtime model set to: ${modelId} (${pricing.provider})`);

  // Notify listeners about model change (so they can reset caches)
  notifyModelChange();

  return {
    success: true,
    model: modelId,
    provider: pricing.provider,
    providerName: formatProviderName(pricing.provider)
  };
}

/**
 * Get runtime selected model (or default)
 * @returns {Object} Current model config
 */
export function getRuntimeModel() {
  if (runtimeSelectedModel) {
    const pricing = getModelPricing(runtimeSelectedModel);
    return {
      model: runtimeSelectedModel,
      provider: runtimeSelectedProvider,
      providerName: formatProviderName(runtimeSelectedProvider),
      isRuntimeSelected: true,
      pricing: {
        inputCost: pricing.inputCost,
        outputCost: pricing.outputCost,
        costPerMinute: pricing.costPerMinute
      }
    };
  }

  // Return default from environment
  const config = getLLMConfig();
  const pricing = getModelPricing(config.model);

  return {
    model: config.model,
    provider: config.provider,
    providerName: formatProviderName(config.provider),
    isRuntimeSelected: false,
    pricing: {
      inputCost: pricing.inputCost,
      outputCost: pricing.outputCost,
      costPerMinute: pricing.costPerMinute
    }
  };
}

/**
 * Get environment variable key for provider
 */
function getEnvKeyForProvider(provider) {
  const keys = {
    'claude': 'ANTHROPIC_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'gemini': 'GOOGLE_API_KEY',
    'deepseek': 'DEEPSEEK_API_KEY',
    'grok': 'XAI_API_KEY',
    'qwen': 'DASHSCOPE_API_KEY',
    'glm': 'ZHIPU_API_KEY'
  };
  return keys[provider] || 'LLM_API_KEY';
}

/**
 * Reset runtime model selection to default
 */
export function resetRuntimeModel() {
  runtimeSelectedModel = null;
  runtimeSelectedProvider = null;
  logger.info('[LLMConfig] Runtime model reset to default');

  // Notify listeners about model change
  notifyModelChange();

  return getRuntimeModel();
}

// ============================================================================
// MODEL CHANGE NOTIFICATION SYSTEM
// ============================================================================

/**
 * Listeners for model changes (used by llmClient to reset cache)
 */
const modelChangeListeners = [];

/**
 * Register a listener for model changes
 * @param {Function} callback - Function to call when model changes
 */
export function onModelChange(callback) {
  if (typeof callback === 'function') {
    modelChangeListeners.push(callback);
  }
}

/**
 * Notify all listeners about model change
 */
function notifyModelChange() {
  const currentModel = getRuntimeModel();
  for (const listener of modelChangeListeners) {
    try {
      listener(currentModel);
    } catch (error) {
      logger.warn(`[LLMConfig] Model change listener error: ${error.message}`);
    }
  }
}
