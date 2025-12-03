import { logger } from '../../utils/logger.js';

/**
 * Input Validation Middleware
 * Prevents DoS and injection attacks by validating input parameters
 */

export const validateUniversalMatch = (req, res, next) => {
  const { text, quantity, unit } = req.body;

  // Text validation (required)
  if (!text || typeof text !== 'string') {
    logger.warn(`[VALIDATION] Invalid text field in universal-match request`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'Text field is required and must be a string'
    });
  }

  if (text.trim().length < 3) {
    logger.warn(`[VALIDATION] Text too short: ${text.length} chars`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'Text must be at least 3 characters'
    });
  }

  if (text.length > 500) {
    logger.warn(`[VALIDATION] Text too long: ${text.length} chars (max 500)`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'Text cannot exceed 500 characters'
    });
  }

  // Quantity validation (optional)
  if (quantity !== undefined && quantity !== null) {
    const num = Number(quantity);
    if (isNaN(num) || !Number.isInteger(num)) {
      logger.warn(`[VALIDATION] Invalid quantity: ${quantity}`);
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: 'Quantity must be an integer'
      });
    }
    if (num < 0 || num > 100000) {
      logger.warn(`[VALIDATION] Quantity out of range: ${num}`);
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: 'Quantity must be between 0 and 100,000'
      });
    }
  }

  // Unit validation (optional)
  if (unit && typeof unit !== 'string') {
    logger.warn(`[VALIDATION] Invalid unit type: ${typeof unit}`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'Unit must be a string'
    });
  }

  const validUnits = ['m2', 'm3', 'ks', 'kg', 't', 'm', 'h', 'cm', 'cm2', 'cm3', 'l', 'ml'];
  if (unit && !validUnits.includes(unit.toLowerCase())) {
    logger.warn(`[VALIDATION] Invalid unit value: ${unit}`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: `Unit must be one of: ${validUnits.join(', ')}`
    });
  }

  // Optional fields validation
  if (req.body.projectType && typeof req.body.projectType !== 'string') {
    logger.warn(`[VALIDATION] Invalid projectType type`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'projectType must be a string'
    });
  }

  if (req.body.buildingSystem && typeof req.body.buildingSystem !== 'string') {
    logger.warn(`[VALIDATION] Invalid buildingSystem type`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'buildingSystem must be a string'
    });
  }

  if (req.body.candidateItems && !Array.isArray(req.body.candidateItems)) {
    logger.warn(`[VALIDATION] Invalid candidateItems type`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'candidateItems must be an array'
    });
  }

  logger.debug(`[VALIDATION] Input validation passed: text=${text.length} chars, quantity=${quantity}, unit=${unit}`);
  next();
};

export const validateFeedback = (req, res, next) => {
  const {
    urs_code,
    urs_name,
    unit,
    normalized_text_cs,
    is_correct
  } = req.body;

  // Required fields validation
  if (!urs_code || typeof urs_code !== 'string') {
    logger.warn(`[VALIDATION] Invalid urs_code in feedback`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'urs_code is required and must be a string'
    });
  }

  if (!normalized_text_cs || typeof normalized_text_cs !== 'string') {
    logger.warn(`[VALIDATION] Invalid normalized_text_cs in feedback`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'normalized_text_cs is required and must be a string'
    });
  }

  if (normalized_text_cs.length < 3 || normalized_text_cs.length > 200) {
    logger.warn(`[VALIDATION] normalized_text_cs invalid length: ${normalized_text_cs.length}`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'normalized_text_cs must be between 3 and 200 characters'
    });
  }

  if (typeof is_correct !== 'boolean') {
    logger.warn(`[VALIDATION] Invalid is_correct type: ${typeof is_correct}`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'is_correct must be a boolean'
    });
  }

  // Optional fields validation
  if (urs_name && typeof urs_name !== 'string') {
    logger.warn(`[VALIDATION] Invalid urs_name type`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'urs_name must be a string'
    });
  }

  if (unit && typeof unit !== 'string') {
    logger.warn(`[VALIDATION] Invalid unit type`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'unit must be a string'
    });
  }

  if (req.body.user_comment && typeof req.body.user_comment !== 'string') {
    logger.warn(`[VALIDATION] Invalid user_comment type`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'user_comment must be a string'
    });
  }

  if (req.body.user_comment && req.body.user_comment.length > 500) {
    logger.warn(`[VALIDATION] user_comment too long: ${req.body.user_comment.length}`);
    return res.status(400).json({
      error: 'Invalid request parameters',
      details: 'user_comment cannot exceed 500 characters'
    });
  }

  logger.debug(`[VALIDATION] Feedback validation passed: urs_code=${urs_code}, is_correct=${is_correct}`);
  next();
};
