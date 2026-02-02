/**
 * Batch LLM Client
 * Simplified LLM client wrapper for batch processing services
 *
 * Purpose:
 * - Provide simple interface for batch services (workSplitter, candidateReranker)
 * - Use existing llmClient infrastructure
 * - Support messages array format
 *
 * @module services/batch/batchLLMClient
 */

import { logger } from '../../utils/logger.js';
import { callLLMForTask } from '../llmClient.js';
import { getTaskTypes } from '../../config/llmConfig.js';

const TASKS = getTaskTypes();

/**
 * Call LLM for batch processing
 * @param {Object} options - Call options
 * @param {Array<Object>} options.messages - Messages array (role + content)
 * @param {number} [options.maxTokens=2000] - Max tokens to generate
 * @param {number} [options.temperature=0.2] - Temperature (0-1)
 * @param {string} [options.taskType='URS_SELECTION'] - Task type for model routing
 * @returns {Object} LLM response { content, usage }
 */
export async function callLLM(options) {
  const { messages, maxTokens = 2000, temperature = 0.2, taskType = 'URS_SELECTION' } = options;

  try {
    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Missing or invalid messages array');
    }

    // Extract system and user prompts from messages
    let systemPrompt = '';
    let userPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += msg.content + '\n\n';
      } else if (msg.role === 'user') {
        userPrompt += msg.content + '\n\n';
      }
    }

    // If no system prompt, use user prompt as both
    if (!systemPrompt && userPrompt) {
      systemPrompt = 'You are a helpful AI assistant for construction BOQ analysis.';
    }

    systemPrompt = systemPrompt.trim();
    userPrompt = userPrompt.trim();

    logger.debug(`[BatchLLMClient] Task: ${taskType}`);
    logger.debug(`[BatchLLMClient] System prompt length: ${systemPrompt.length} chars`);
    logger.debug(`[BatchLLMClient] User prompt length: ${userPrompt.length} chars`);

    // Call LLM using existing infrastructure
    const response = await callLLMForTask(
      TASKS[taskType] || taskType,
      systemPrompt,
      userPrompt,
      null  // Use default timeout from config
    );

    // Normalize response format
    return {
      content: response,
      usage: {}  // Usage tracking handled by llmClient
    };

  } catch (error) {
    logger.error(`[BatchLLMClient] Error: ${error.message}`);
    throw new Error(`LLM call failed: ${error.message}`);
  }
}

/**
 * Call LLM with model config override (for advanced usage)
 * @param {Object} options - Call options
 * @param {Array<Object>} options.messages - Messages array
 * @param {Object} modelConfig - Model configuration
 * @returns {Object} LLM response
 */
export async function callLLMWithConfig(options, modelConfig) {
  // For now, delegate to callLLM
  // In future, we can add model-specific routing here
  return await callLLM(options);
}

export default {
  callLLM,
  callLLMWithConfig
};
