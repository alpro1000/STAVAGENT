/**
 * Project Analysis Orchestrator
 * Координирует работу 6 специализированных ролей для анализа проекта
 *
 * Использование:
 * - analyzeProject() - полный анализ проекта всеми 6 ролями
 * - analyzeWithRoles() - анализ выбранными ролями
 * - askRole() - вопрос конкретной роли
 */

import { logger } from '../../utils/logger.js';
import { ROLES, getRole, getRolesForTask, formatRoleResponse } from './roles.js';
import { callLLMForTask, TASKS } from '../llmClient.js';
import { getRuntimeModel } from '../../config/llmConfig.js';

// ============================================================================
// ORCHESTRATOR CONFIGURATION
// ============================================================================

const ORCHESTRATOR_CONFIG = {
  maxParallelCalls: 3, // Ограничение параллельных вызовов LLM
  defaultTimeout: 60000, // 60 секунд на роль
  consolidationEnabled: true // Объединять результаты ролей
};

// ============================================================================
// MAIN ORCHESTRATOR FUNCTIONS
// ============================================================================

/**
 * Full project analysis with all 6 roles
 * Используется для комплексного анализа проекта
 *
 * @param {Object} projectContext - Контекст проекта
 * @param {string} projectContext.projectName - Название проекта
 * @param {string} projectContext.buildingType - Тип здания (мост, здание, тоннель)
 * @param {number} projectContext.storeys - Количество этажей
 * @param {Array<string>} projectContext.mainSystems - Конструктивные системы
 * @param {Array<Object>} projectContext.positions - Позиции из сметы
 * @param {string} projectContext.documentText - Текст проектной документации
 * @returns {Promise<Object>} Результаты анализа всеми ролями
 */
export async function analyzeProject(projectContext) {
  const startTime = Date.now();
  logger.info(`[Orchestrator] Starting full project analysis: ${projectContext.projectName || 'Unknown'}`);

  const roles = getRolesForTask('full_analysis');
  const results = await executeRolesInBatches(roles, projectContext);

  // Consolidate results
  const consolidated = consolidateResults(results, projectContext);

  const duration = Date.now() - startTime;
  logger.info(`[Orchestrator] Full analysis completed in ${duration}ms`);

  return {
    projectName: projectContext.projectName,
    analysisType: 'full_project_analysis',
    results: results,
    consolidated: consolidated,
    metadata: {
      rolesUsed: roles.map(r => r.id),
      totalDurationMs: duration,
      model: getRuntimeModel(),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Analyze project with specific roles
 *
 * @param {string} taskType - Тип задачи (concrete_phases, formwork, schedule, etc.)
 * @param {Object} projectContext - Контекст проекта
 * @returns {Promise<Object>} Результаты анализа выбранными ролями
 */
export async function analyzeWithRoles(taskType, projectContext) {
  const startTime = Date.now();
  logger.info(`[Orchestrator] Starting ${taskType} analysis`);

  const roles = getRolesForTask(taskType);
  if (roles.length === 0) {
    throw new Error(`Unknown task type: ${taskType}`);
  }

  const results = await executeRolesInBatches(roles, projectContext);

  // Task-specific consolidation
  const consolidated = consolidateForTask(taskType, results, projectContext);

  const duration = Date.now() - startTime;
  logger.info(`[Orchestrator] ${taskType} analysis completed in ${duration}ms`);

  return {
    taskType,
    results,
    consolidated,
    metadata: {
      rolesUsed: roles.map(r => r.id),
      totalDurationMs: duration,
      model: getRuntimeModel(),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Ask a specific role a question
 *
 * @param {string} roleId - ID роли
 * @param {string} question - Вопрос
 * @param {Object} context - Контекст (опционально)
 * @returns {Promise<Object>} Ответ роли
 */
export async function askRole(roleId, question, context = {}) {
  const startTime = Date.now();
  const role = getRole(roleId);

  if (!role) {
    throw new Error(`Unknown role: ${roleId}`);
  }

  logger.info(`[Orchestrator] Asking ${role.name}: ${question.substring(0, 50)}...`);

  const response = await callRoleWithLLM(role, question, context);

  const duration = Date.now() - startTime;
  return formatRoleResponse(role, response, duration);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Execute roles in batches (respecting maxParallelCalls)
 */
async function executeRolesInBatches(roles, projectContext) {
  const results = [];
  const batchSize = ORCHESTRATOR_CONFIG.maxParallelCalls;

  for (let i = 0; i < roles.length; i += batchSize) {
    const batch = roles.slice(i, i + batchSize);

    logger.debug(`[Orchestrator] Executing batch ${Math.floor(i / batchSize) + 1}: ${batch.map(r => r.id).join(', ')}`);

    const batchPromises = batch.map(role =>
      executeRole(role, projectContext).catch(error => ({
        role: role.id,
        error: error.message,
        success: false
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Execute single role analysis
 */
async function executeRole(role, projectContext) {
  const startTime = Date.now();

  try {
    const prompt = buildRolePrompt(role, projectContext);
    const response = await callRoleWithLLM(role, prompt, projectContext);

    const duration = Date.now() - startTime;
    logger.debug(`[Orchestrator] ${role.id} completed in ${duration}ms`);

    return {
      role: role.id,
      roleName: role.name,
      roleNameCs: role.nameCs,
      response: response,
      success: true,
      durationMs: duration
    };

  } catch (error) {
    logger.error(`[Orchestrator] ${role.id} failed: ${error.message}`);
    return {
      role: role.id,
      roleName: role.name,
      error: error.message,
      success: false,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Build prompt for role based on project context
 */
function buildRolePrompt(role, projectContext) {
  const sections = [];

  // Project header
  sections.push(`# Проект: ${projectContext.projectName || 'Без названия'}`);

  // Building info
  if (projectContext.buildingType) {
    sections.push(`## Тип объекта: ${projectContext.buildingType}`);
  }
  if (projectContext.storeys) {
    sections.push(`Этажность: ${projectContext.storeys}`);
  }
  if (projectContext.mainSystems?.length > 0) {
    sections.push(`Конструктивные системы: ${projectContext.mainSystems.join(', ')}`);
  }

  // Positions summary
  if (projectContext.positions?.length > 0) {
    sections.push(`\n## Позиции сметы (${projectContext.positions.length} шт.)`);

    // Group by TSKP category if available
    const groups = groupPositionsByCategory(projectContext.positions);
    for (const [category, items] of Object.entries(groups)) {
      sections.push(`\n### ${category}`);
      items.slice(0, 10).forEach(item => {
        sections.push(`- ${item.description || item.raw_text} (${item.quantity} ${item.unit || 'ks'})`);
      });
      if (items.length > 10) {
        sections.push(`... и ещё ${items.length - 10} позиций`);
      }
    }
  }

  // Document text (if provided)
  if (projectContext.documentText) {
    const truncated = projectContext.documentText.substring(0, 3000);
    sections.push(`\n## Проектная документация\n${truncated}`);
    if (projectContext.documentText.length > 3000) {
      sections.push(`... (текст сокращён)`);
    }
  }

  // Role-specific question
  sections.push(`\n## Задача для роли "${role.name}"`);
  sections.push(getRoleSpecificTask(role, projectContext));

  return sections.join('\n');
}

/**
 * Get role-specific task description
 */
function getRoleSpecificTask(role, projectContext) {
  const tasks = {
    'konstruktor': `Проанализируй проект и определи:
1. Оптимальную разбивку на этапы бетонирования
2. Расположение рабочих швов
3. Последовательность возведения конструкций
4. Критические узлы, требующие особого внимания`,

    'betonar': `Проанализируй проект и определи:
1. Рекомендуемые марки бетона для каждого типа конструкций
2. Требования к технологии укладки
3. Особенности ухода за бетоном
4. Риски и меры предосторожности`,

    'rozpoctar': `Проанализируй позиции сметы и определи:
1. Полноту охвата работ
2. Возможные пропущенные позиции
3. Корректность единиц измерения
4. Рекомендации по agregovaným položkám`,

    'normokontrolor': `Проверь соответствие нормам:
1. ČSN EN 13670 - требования к выполнению работ
2. ČSN EN 1992-1-1 - конструктивные требования
3. ČSN EN 206 - требования к бетону
4. Выяви потенциальные несоответствия`,

    'technolog': `Разработай технологические решения:
1. Схему опалубки и её оборачиваемость
2. Разбивку на захватки (záběry)
3. График производства работ
4. Потребность в ресурсах`,

    'koordinator': `Составь план координации:
1. Календарный график основных этапов
2. Критический путь
3. Потребность в ресурсах по периодам
4. Риски и резервы времени`
  };

  return tasks[role.id] || `Проанализируй проект с точки зрения твоей экспертизы: ${role.expertise.join(', ')}`;
}

/**
 * Call LLM with role configuration
 */
async function callRoleWithLLM(role, prompt, context) {
  const systemPrompt = role.systemPrompt;

  // Use the centralized LLM client with task-based routing
  const response = await callLLMForTask(
    TASKS.COMPLEX_REASONING, // Use complex reasoning for role analysis
    systemPrompt,
    prompt,
    ORCHESTRATOR_CONFIG.defaultTimeout
  );

  return response;
}

/**
 * Group positions by TSKP category
 */
function groupPositionsByCategory(positions) {
  const groups = {};

  for (const pos of positions) {
    const category = pos.tskp_category || pos.work_type || 'Ostatní';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(pos);
  }

  return groups;
}

/**
 * Consolidate results from all roles
 */
function consolidateResults(results, projectContext) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Extract key recommendations from each role
  const recommendations = [];
  const warnings = [];
  const actions = [];

  for (const result of successful) {
    // Parse response for structured data (if JSON)
    try {
      const parsed = extractStructuredData(result.response);
      if (parsed.recommendations) recommendations.push(...parsed.recommendations);
      if (parsed.warnings) warnings.push(...parsed.warnings);
      if (parsed.actions) actions.push(...parsed.actions);
    } catch (e) {
      // If not JSON, use raw response
      recommendations.push({
        role: result.role,
        text: result.response.substring(0, 500)
      });
    }
  }

  return {
    summary: {
      successfulRoles: successful.length,
      failedRoles: failed.length,
      totalRoles: results.length
    },
    recommendations: deduplicateByContent(recommendations),
    warnings: deduplicateByContent(warnings),
    suggestedActions: actions,
    failedAnalyses: failed.map(f => ({
      role: f.role,
      error: f.error
    }))
  };
}

/**
 * Task-specific consolidation
 */
function consolidateForTask(taskType, results, projectContext) {
  const base = consolidateResults(results, projectContext);

  // Add task-specific structure
  switch (taskType) {
  case 'concrete_phases':
  case 'betonování':
    return {
      ...base,
      phases: extractPhases(results),
      joints: extractJoints(results),
      sequence: extractSequence(results)
    };

  case 'formwork':
  case 'bednění':
    return {
      ...base,
      formworkSystems: extractFormworkSystems(results),
      turnoverSchedule: extractTurnover(results)
    };

  case 'schedule':
  case 'harmonogram':
    return {
      ...base,
      milestones: extractMilestones(results),
      criticalPath: extractCriticalPath(results)
    };

  default:
    return base;
  }
}

/**
 * Extract structured data from response
 */
function extractStructuredData(response) {
  // Try to find JSON in response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                    response.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    } catch (e) {
      // Not valid JSON
    }
  }

  return { raw: response };
}

/**
 * Deduplicate items by content similarity
 */
function deduplicateByContent(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = (item.text || JSON.stringify(item)).substring(0, 100).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Task-specific extractors (simplified implementations)
function extractPhases(results) {
  const konstruktor = results.find(r => r.role === 'konstruktor');
  if (!konstruktor?.response) return [];
  // Extract phase information from response
  return [];
}

function extractJoints(results) {
  return [];
}

function extractSequence(results) {
  return [];
}

function extractFormworkSystems(results) {
  return [];
}

function extractTurnover(results) {
  return [];
}

function extractMilestones(results) {
  return [];
}

function extractCriticalPath(results) {
  return [];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  analyzeProject,
  analyzeWithRoles,
  askRole,
  ORCHESTRATOR_CONFIG
};
