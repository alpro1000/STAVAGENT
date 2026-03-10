/**
 * Concrete-Agent HTTP Client
 * Wrapper for calling the CORE Engine at concrete-agent-3uxelthc4q-ey.a.run.app
 *
 * Endpoints:
 * - Workflow C: File upload + parse + audit (all-in-one pipeline)
 * - Workflow A: Enrich parsed positions (tech-card, resource-sheet, materials)
 * - Workflow B: Enrich drawing-generated positions
 * - Multi-Role: AI specialist validation (6 roles)
 * - Knowledge base search
 * - Resource calculations
 */

import FormData from 'form-data';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const CORE_URL = process.env.CONCRETE_AGENT_URL || 'https://concrete-agent-3uxelthc4q-ey.a.run.app';
const CORE_TIMEOUT = parseInt(process.env.CONCRETE_AGENT_TIMEOUT || '120000');

// ── Workflow C: Upload + Parse + Audit ──────────────────────────────────

/**
 * Upload file and execute full pipeline (parse → validate → enrich → audit)
 * This is the primary entry point for document analysis.
 * Replaces old workflowAStart (which called non-existent /workflow-a/start).
 */
export async function workflowCUpload(filePath, metadata = {}) {
  console.log(`[ConcreteAgent] Workflow C: Uploading ${filePath}`);

  const form = new FormData();
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  form.append('file', fs.createReadStream(filePath));
  if (metadata.projectId) form.append('project_id', metadata.projectId);
  if (metadata.projectName) form.append('project_name', metadata.projectName);
  form.append('generate_summary', String(metadata.generateSummary ?? true));
  form.append('use_parallel', String(metadata.useParallel ?? true));
  form.append('language', metadata.language || 'cs');

  const response = await fetch(`${CORE_URL}/api/v1/workflow/c/upload`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Workflow C upload failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log(`[ConcreteAgent] Workflow C: Pipeline complete`);
  return result;
}

/**
 * Legacy alias — maps old workflowAStart to Workflow C upload.
 */
export async function workflowAStart(filePath, metadata = {}) {
  return workflowCUpload(filePath, metadata);
}

// ── Multi-Role Audit ────────────────────────────────────────────────────

/**
 * Validate positions using Multi-Role AI specialists.
 * 6 roles: Document Validator, Structural Engineer, Concrete Specialist,
 *          Cost Estimator, Standards Checker, Project Manager
 *
 * @param {string} role - Role name (e.g. 'concrete_specialist', 'cost_estimator')
 * @param {string} question - Question to ask the specialist
 * @param {object} context - Context data (positions, project info)
 * @returns {object} { answer, confidence, recommendations }
 */
export async function performAudit(role, question, context = {}) {
  console.log(`[ConcreteAgent] Multi-Role Audit: role=${role}`);

  const response = await fetch(`${CORE_URL}/api/v1/multi-role/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, question, context }),
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Multi-Role audit failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Run full audit across all specialist roles for a set of positions.
 * @param {Array} positions - Parsed positions to audit
 * @param {string} projectName - Project name for context
 * @returns {object} { results: [{role, answer, classification}], summary }
 */
export async function auditPositions(positions, projectName = '') {
  const roles = ['document_validator', 'structural_engineer', 'concrete_specialist',
                 'cost_estimator', 'standards_checker', 'project_manager'];
  const results = [];

  for (const role of roles) {
    try {
      const result = await performAudit(role, `Zvaliduj pozice projektu "${projectName}"`, {
        positions,
        project_name: projectName,
      });
      results.push({ role, ...result });
    } catch (err) {
      results.push({ role, error: err.message });
    }
  }

  return { results, total_roles: roles.length, completed: results.filter(r => !r.error).length };
}

// ── Workflow A: Position Enrichment ─────────────────────────────────────

/**
 * Enrich a single position with full technical info.
 * @param {string} projectId - Project ID
 * @param {string} positionId - Position ID to enrich
 * @returns {object} Enriched position data
 */
export async function enrichPosition(projectId, positionId) {
  const response = await fetch(`${CORE_URL}/api/workflow/a/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, position_id: positionId }),
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) throw new Error(`Enrich failed: ${response.status}`);
  return response.json();
}

/**
 * Generate tech card for a position.
 */
export async function generateTechCard(projectId, positionId) {
  const response = await fetch(`${CORE_URL}/api/workflow/a/tech-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, position_id: positionId }),
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) throw new Error(`Tech card generation failed: ${response.status}`);
  return response.json();
}

// ── Workflow B: Drawing Analysis ────────────────────────────────────────

/**
 * Upload a drawing file for analysis via Workflow C pipeline.
 * Workflow B positions are then available at /api/workflow/b/positions.
 */
export async function workflowBStart(filePath, metadata = {}) {
  console.log(`[ConcreteAgent] Workflow B: Analyzing drawings from ${filePath}`);
  return workflowCUpload(filePath, {
    ...metadata,
    objectType: metadata.objectType || 'drawing',
  });
}

/**
 * Get positions generated from drawing analysis (Workflow B).
 */
export async function getWorkflowBPositions(projectId) {
  const response = await fetch(`${CORE_URL}/api/workflow/b/positions?project_id=${projectId}`, {
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) throw new Error(`Failed to get WF-B positions: ${response.status}`);
  return response.json();
}

// ── Knowledge Base ──────────────────────────────────────────────────────

export async function searchKnowledgeBase(query, category = null) {
  const url = new URL(`${CORE_URL}/kb/search`);
  url.searchParams.append('query', query);
  if (category) url.searchParams.append('category', category);

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) throw new Error(`KB search failed: ${response.status}`);
  const result = await response.json();
  return { status: 'success', results: result.results || [], total: result.total || 0 };
}

// ── Calculations ────────────────────────────────────────────────────────

export async function calculateBridge(params = {}) {
  const response = await fetch(`${CORE_URL}/calculate/bridge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) throw new Error(`Bridge calculation failed: ${response.status}`);
  return { status: 'success', calculation: await response.json() };
}

export async function calculateBuilding(params = {}) {
  const response = await fetch(`${CORE_URL}/calculate/building`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(CORE_TIMEOUT),
  });

  if (!response.ok) throw new Error(`Building calculation failed: ${response.status}`);
  return { status: 'success', calculation: await response.json() };
}

// ── Health ───────────────────────────────────────────────────────────────

export async function healthCheck() {
  try {
    const response = await fetch(`${CORE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch { return false; }
}

export async function getServiceInfo() {
  try {
    const response = await fetch(`${CORE_URL}/info`, { signal: AbortSignal.timeout(CORE_TIMEOUT) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  } catch { return null; }
}

export default {
  workflowCUpload,
  workflowAStart,
  workflowBStart,
  performAudit,
  auditPositions,
  enrichPosition,
  generateTechCard,
  getWorkflowBPositions,
  searchKnowledgeBase,
  calculateBridge,
  calculateBuilding,
  healthCheck,
  getServiceInfo,
};
