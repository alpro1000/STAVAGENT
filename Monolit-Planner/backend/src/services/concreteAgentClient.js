/**
 * Concrete-Agent HTTP Client
 * Wrapper for calling the CORE Engine at https://concrete-agent.onrender.com
 *
 * This service provides integration with Concrete-Agent for:
 * - Workflow A: Document parsing and analysis (import & audit)
 * - Workflow B: Analysis from drawings (OCR & AI)
 * - Knowledge base search
 * - Resource calculations
 */

import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// Note: fetch is available natively in Node.js 18+

// Configuration
const CONCRETE_AGENT_URL = process.env.CONCRETE_AGENT_URL || 'https://concrete-agent.onrender.com';
const CONCRETE_AGENT_TIMEOUT = parseInt(process.env.CONCRETE_AGENT_TIMEOUT || '60000');

// Constants for Workflow IDs and Session Management
const WORKFLOW_VERSION = 'v1';

/**
 * Workflow A: Import & Audit existing documents (KROS, Excel, PDF)
 * Used for: Analyzing existing estimates, importing project data
 * Returns: Parsed positions, materials, calculations
 */
export async function workflowAStart(filePath, metadata = {}) {
  try {
    logger.info(`[ConcreteAgent] Workflow A: Starting analysis of file: ${filePath}`);

    const form = new FormData();

    // Add file
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    form.append('file', fs.createReadStream(filePath));

    // Add metadata if provided (VARIANT 1 - no object_type)
    if (metadata.projectId) form.append('project_id', metadata.projectId);
    if (metadata.projectName) form.append('project_name', metadata.projectName);

    const response = await fetch(`${CONCRETE_AGENT_URL}/workflow-a/start`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Workflow A failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    logger.info(`[ConcreteAgent] Workflow A: Successfully parsed document`);

    return {
      status: 'success',
      workflow_id: result.workflow_id || uuidv4(),
      positions: result.positions || [],
      materials: result.materials || [],
      metadata: result.metadata || {}
    };

  } catch (error) {
    logger.error('[ConcreteAgent] Workflow A Error:', error.message);
    throw new Error(`Workflow A failed: ${error.message}`);
  }
}

/**
 * Workflow B: Generate from Drawings
 * Used for: Analyzing PDF drawings, extracting project scope from images
 * Returns: Suggested work items, structure, dimensions
 */
export async function workflowBStart(filePath, metadata = {}) {
  try {
    logger.info(`[ConcreteAgent] Workflow B: Analyzing drawings from file: ${filePath}`);

    const form = new FormData();

    // Add file
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    form.append('file', fs.createReadStream(filePath));

    // Add metadata (VARIANT 1 - no object_type)
    if (metadata.projectId) form.append('project_id', metadata.projectId);
    if (metadata.skipOcr) form.append('skip_ocr', metadata.skipOcr);

    const response = await fetch(`${CONCRETE_AGENT_URL}/workflow-b/start`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Workflow B failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    logger.info(`[ConcreteAgent] Workflow B: Successfully analyzed drawings`);

    return {
      status: 'success',
      workflow_id: result.workflow_id || uuidv4(),
      analysis: result.analysis || {},
      suggested_works: result.suggested_works || [],
      dimensions: result.dimensions || {}
    };

  } catch (error) {
    logger.error('[ConcreteAgent] Workflow B Error:', error.message);
    throw new Error(`Workflow B failed: ${error.message}`);
  }
}

/**
 * Multi-role Audit
 * Used for: Validating analysis from different expert perspectives
 * Roles: Architect, Foreman, Estimator
 * Returns: Validation results and suggestions
 */
export async function performAudit(workflowId, analysisData = {}, roles = ['architect', 'foreman', 'estimator']) {
  try {
    logger.info(`[ConcreteAgent] Performing multi-role audit for workflow: ${workflowId}`);

    const response = await fetch(`${CONCRETE_AGENT_URL}/workflow-a/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: workflowId,
        analysis: analysisData,
        roles: roles
      }),
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Audit failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    logger.info(`[ConcreteAgent] Audit completed successfully`);

    return {
      status: 'success',
      audit_results: result.audit_results || {},
      issues: result.issues || [],
      suggestions: result.suggestions || {}
    };

  } catch (error) {
    logger.error('[ConcreteAgent] Audit Error:', error.message);
    throw new Error(`Audit failed: ${error.message}`);
  }
}

/**
 * AI Enrichment
 * Used for: Enriching analysis with AI insights using Claude, GPT-4, or Perplexity
 * Returns: Enhanced positions with improved descriptions, codes, classifications
 */
export async function enrichWithAI(workflowId, analysisData = {}, provider = 'claude') {
  try {
    logger.info(`[ConcreteAgent] Enriching analysis with ${provider} AI...`);

    const response = await fetch(`${CONCRETE_AGENT_URL}/workflow-a/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: workflowId,
        analysis: analysisData,
        provider: provider
      }),
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Enrichment failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    logger.info(`[ConcreteAgent] AI enrichment completed`);

    return {
      status: 'success',
      enriched_positions: result.enriched_positions || [],
      ai_suggestions: result.ai_suggestions || {}
    };

  } catch (error) {
    logger.error('[ConcreteAgent] Enrichment Error:', error.message);
    // Non-fatal error - continue without enrichment
    return {
      status: 'warning',
      error: error.message,
      enriched_positions: []
    };
  }
}

/**
 * Knowledge Base Search
 * Used for: Finding matching OTSKP codes and technical standards
 * Returns: Matching codes with descriptions and specifications
 */
export async function searchKnowledgeBase(query, category = null) {
  try {
    logger.info(`[ConcreteAgent] Searching KB for: ${query}`);

    const url = new URL(`${CONCRETE_AGENT_URL}/kb/search`);
    url.searchParams.append('query', query);
    if (category) url.searchParams.append('category', category);

    const response = await fetch(url.toString(), {
      method: 'GET',
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`KB search failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return {
      status: 'success',
      results: result.results || [],
      total: result.total || 0
    };

  } catch (error) {
    logger.error('[ConcreteAgent] KB Search Error:', error.message);
    throw new Error(`KB search failed: ${error.message}`);
  }
}

/**
 * Calculate Bridge Resources
 * Used for: Computing volumes, labor hours, materials for bridge construction
 * Input: dimensions, concrete class, reinforcement info
 * Returns: Volume, labor hours, material quantities
 */
export async function calculateBridge(params = {}) {
  try {
    logger.info(`[ConcreteAgent] Calculating bridge resources...`);

    const response = await fetch(`${CONCRETE_AGENT_URL}/calculate/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bridge calculation failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return {
      status: 'success',
      calculation: result
    };

  } catch (error) {
    logger.error('[ConcreteAgent] Bridge Calculation Error:', error.message);
    throw new Error(`Calculation failed: ${error.message}`);
  }
}

/**
 * Calculate Building Resources
 * Used for: Computing areas, volumes, materials for building construction
 */
export async function calculateBuilding(params = {}) {
  try {
    logger.info(`[ConcreteAgent] Calculating building resources...`);

    const response = await fetch(`${CONCRETE_AGENT_URL}/calculate/building`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Building calculation failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return {
      status: 'success',
      calculation: result
    };

  } catch (error) {
    logger.error('[ConcreteAgent] Building Calculation Error:', error.message);
    throw new Error(`Calculation failed: ${error.message}`);
  }
}

/**
 * Health Check
 * Used for: Verifying CORE Engine is available
 * Returns: Service status
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${CONCRETE_AGENT_URL}/health`, {
      method: 'GET',
      timeout: 5000
    });

    return response.ok;
  } catch (error) {
    logger.warn('[ConcreteAgent] Health check failed:', error.message);
    return false;
  }
}

/**
 * Get Service Info
 * Returns: CORE Engine version and available endpoints
 */
export async function getServiceInfo() {
  try {
    const response = await fetch(`${CONCRETE_AGENT_URL}/info`, {
      method: 'GET',
      timeout: CONCRETE_AGENT_TIMEOUT
    });

    if (!response.ok) {
      throw new Error(`Could not get service info: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    logger.warn('[ConcreteAgent] Could not get service info:', error.message);
    return null;
  }
}

export default {
  workflowAStart,
  workflowBStart,
  performAudit,
  enrichWithAI,
  searchKnowledgeBase,
  calculateBridge,
  calculateBuilding,
  healthCheck,
  getServiceInfo
};
