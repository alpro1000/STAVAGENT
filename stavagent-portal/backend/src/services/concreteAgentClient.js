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
    console.log(`[ConcreteAgent] Workflow A: Starting analysis of file: ${filePath}`);

    const form = new FormData();

    // Add file
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    form.append('file', fs.createReadStream(filePath));

    // Add metadata if provided
    if (metadata.projectId) form.append('project_id', metadata.projectId);
    if (metadata.projectName) form.append('project_name', metadata.projectName);
    if (metadata.objectType) form.append('object_type', metadata.objectType);

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
    console.log(`[ConcreteAgent] Workflow A: Successfully parsed document`);

    return {
      status: 'success',
      workflow_id: result.workflow_id || uuidv4(),
      positions: result.positions || [],
      materials: result.materials || [],
      metadata: result.metadata || {}
    };

  } catch (error) {
    console.error('[ConcreteAgent] Workflow A Error:', error.message);
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
    console.log(`[ConcreteAgent] Workflow B: Analyzing drawings from file: ${filePath}`);

    const form = new FormData();

    // Add file
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    form.append('file', fs.createReadStream(filePath));

    // Add metadata
    if (metadata.projectId) form.append('project_id', metadata.projectId);
    if (metadata.objectType) form.append('object_type', metadata.objectType);
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
    console.log(`[ConcreteAgent] Workflow B: Successfully analyzed drawings`);

    return {
      status: 'success',
      workflow_id: result.workflow_id || uuidv4(),
      analysis: result.analysis || {},
      suggested_works: result.suggested_works || [],
      dimensions: result.dimensions || {}
    };

  } catch (error) {
    console.error('[ConcreteAgent] Workflow B Error:', error.message);
    throw new Error(`Workflow B failed: ${error.message}`);
  }
}

/**
 * REMOVED: performAudit() (2025-12-10)
 *
 * Multi-role audit was not used in the file upload workflow and has been removed.
 * If Multi-Role validation is needed in the future, add it as a separate, explicit endpoint
 * with proper opt-in mechanism to avoid unintended calls.
 *
 * See: ANALYSIS_FILE_UPLOAD_LOGIC.md for details
 */

/**
 * REMOVED: enrichWithAI() (2025-12-10)
 *
 * AI enrichment was not used in the file upload workflow and has been removed.
 * If AI enrichment is needed in the future, add it as a separate, explicit endpoint
 * with proper opt-in mechanism to avoid unintended calls.
 *
 * See: ANALYSIS_FILE_UPLOAD_LOGIC.md for details
 */

/**
 * Knowledge Base Search
 * Used for: Finding matching OTSKP codes and technical standards
 * Returns: Matching codes with descriptions and specifications
 */
export async function searchKnowledgeBase(query, category = null) {
  try {
    console.log(`[ConcreteAgent] Searching KB for: ${query}`);

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
    console.error('[ConcreteAgent] KB Search Error:', error.message);
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
    console.log(`[ConcreteAgent] Calculating bridge resources...`);

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
    console.error('[ConcreteAgent] Bridge Calculation Error:', error.message);
    throw new Error(`Calculation failed: ${error.message}`);
  }
}

/**
 * Calculate Building Resources
 * Used for: Computing areas, volumes, materials for building construction
 */
export async function calculateBuilding(params = {}) {
  try {
    console.log(`[ConcreteAgent] Calculating building resources...`);

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
    console.error('[ConcreteAgent] Building Calculation Error:', error.message);
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
    console.warn('[ConcreteAgent] Health check failed:', error.message);
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
    console.warn('[ConcreteAgent] Could not get service info:', error.message);
    return null;
  }
}

export default {
  workflowAStart,
  workflowBStart,
  // performAudit removed 2025-12-10 (Multi-Role not part of file upload workflow)
  // enrichWithAI removed 2025-12-10 (AI enrichment not part of file upload workflow)
  searchKnowledgeBase,
  calculateBridge,
  calculateBuilding,
  healthCheck,
  getServiceInfo
};
