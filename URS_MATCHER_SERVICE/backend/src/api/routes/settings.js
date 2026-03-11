/**
 * Settings Routes
 * API for model selection and LLM configuration
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import {
  getAllModels,
  getRuntimeModel,
  setRuntimeModel,
  resetRuntimeModel,
  getAvailableProviders,
  getLLMConfig
} from '../../config/llmConfig.js';

const router = express.Router();

/**
 * GET /api/settings/models
 * Get all available models with pricing and availability
 */
router.get('/models', (req, res) => {
  try {
    const models = getAllModels();
    const currentModel = getRuntimeModel();

    res.json({
      success: true,
      models: models,
      currentModel: currentModel,
      totalModels: models.length,
      availableModels: models.filter(m => m.available).length
    });
  } catch (error) {
    logger.error(`[Settings] Error getting models: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get models'
    });
  }
});

/**
 * GET /api/settings/model
 * Get current model configuration
 */
router.get('/model', (req, res) => {
  try {
    const currentModel = getRuntimeModel();

    res.json({
      success: true,
      ...currentModel
    });
  } catch (error) {
    logger.error(`[Settings] Error getting current model: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get current model'
    });
  }
});

/**
 * POST /api/settings/model
 * Set model for LLM processing
 *
 * Body: { model: "deepseek-chat" }
 */
router.post('/model', (req, res) => {
  try {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Model ID is required'
      });
    }

    const result = setRuntimeModel(model);

    if (!result.success) {
      return res.status(400).json(result);
    }

    logger.info(`[Settings] Model changed to: ${model}`);

    res.json({
      success: true,
      message: `Model set to ${result.model}`,
      ...result
    });
  } catch (error) {
    logger.error(`[Settings] Error setting model: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to set model'
    });
  }
});

/**
 * POST /api/settings/model/reset
 * Reset model to default (from environment)
 */
router.post('/model/reset', (req, res) => {
  try {
    const result = resetRuntimeModel();

    logger.info(`[Settings] Model reset to default: ${result.model}`);

    res.json({
      success: true,
      message: `Model reset to default: ${result.model}`,
      ...result
    });
  } catch (error) {
    logger.error(`[Settings] Error resetting model: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to reset model'
    });
  }
});

/**
 * GET /api/settings/providers
 * Get all configured providers and their status
 */
router.get('/providers', (req, res) => {
  try {
    const providers = getAvailableProviders();
    const config = getLLMConfig();

    const providerList = Object.entries(providers).map(([name, info]) => ({
      id: name,
      name: formatProviderName(name),
      enabled: info.enabled,
      model: info.model,
      isPrimary: name === config.provider
    }));

    res.json({
      success: true,
      providers: providerList,
      primaryProvider: config.provider,
      totalProviders: providerList.length,
      enabledProviders: providerList.filter(p => p.enabled).length
    });
  } catch (error) {
    logger.error(`[Settings] Error getting providers: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get providers'
    });
  }
});

/**
 * Format provider name for display
 */
function formatProviderName(provider) {
  const names = {
    'claude': 'Anthropic Claude',
    'openai': 'OpenAI',
    'gemini': 'Google Gemini',
    'deepseek': 'DeepSeek',
    'grok': 'xAI Grok',
    'qwen': 'Alibaba Qwen',
    'glm': 'Zhipu GLM'
  };
  return names[provider] || provider;
}

export default router;
