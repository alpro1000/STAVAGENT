/**
 * Project Analysis API Routes
 * API для анализа проекта с использованием 6 специализированных ролей
 *
 * Endpoints:
 * - POST /api/project-analysis/full - Полный анализ проекта
 * - POST /api/project-analysis/task/:taskType - Анализ по типу задачи
 * - POST /api/project-analysis/ask/:roleId - Вопрос конкретной роли
 * - GET /api/project-analysis/roles - Список доступных ролей
 * - GET /api/project-analysis/tasks - Список типов задач
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import { analyzeProject, analyzeWithRoles, askRole } from '../../services/projectAnalysis/orchestrator.js';
import { getAllRoles, getRolesForTask, ROLES } from '../../services/projectAnalysis/roles.js';

const router = express.Router();

// ============================================================================
// GET /api/project-analysis/roles - Список доступных ролей
// ============================================================================

router.get('/roles', (req, res) => {
  try {
    const roles = getAllRoles().map(role => ({
      id: role.id,
      name: role.name,
      nameCs: role.nameCs,
      description: role.description,
      expertise: role.expertise
    }));

    res.json({
      success: true,
      roles,
      count: roles.length
    });
  } catch (error) {
    logger.error(`[ProjectAnalysis API] Error listing roles: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/project-analysis/tasks - Список типов задач
// ============================================================================

router.get('/tasks', (req, res) => {
  try {
    const tasks = [
      {
        id: 'concrete_phases',
        name: 'Этапы бетонирования',
        nameCs: 'Etapy betonáže',
        roles: ['konstruktor', 'betonar', 'technolog']
      },
      {
        id: 'formwork',
        name: 'Опалубка',
        nameCs: 'Bednění',
        roles: ['technolog', 'konstruktor']
      },
      {
        id: 'reinforcement',
        name: 'Армирование',
        nameCs: 'Výztuž',
        roles: ['konstruktor', 'normokontrolor']
      },
      {
        id: 'cost_estimate',
        name: 'Смета',
        nameCs: 'Rozpočet',
        roles: ['rozpoctar', 'normokontrolor']
      },
      {
        id: 'schedule',
        name: 'Календарный план',
        nameCs: 'Harmonogram',
        roles: ['koordinator', 'technolog']
      },
      {
        id: 'compliance',
        name: 'Проверка норм',
        nameCs: 'Kontrola norem',
        roles: ['normokontrolor', 'konstruktor']
      },
      {
        id: 'full_analysis',
        name: 'Полный анализ',
        nameCs: 'Kompletní analýza',
        roles: Object.keys(ROLES).map(k => ROLES[k].id)
      }
    ];

    res.json({
      success: true,
      tasks,
      count: tasks.length
    });
  } catch (error) {
    logger.error(`[ProjectAnalysis API] Error listing tasks: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/project-analysis/full - Полный анализ проекта
// ============================================================================

router.post('/full', async (req, res) => {
  const startTime = Date.now();

  try {
    const { projectName, buildingType, storeys, mainSystems, positions, documentText } = req.body;

    if (!positions && !documentText) {
      return res.status(400).json({
        success: false,
        error: 'Either positions or documentText is required'
      });
    }

    logger.info(`[ProjectAnalysis API] Full analysis requested for: ${projectName || 'Unknown'}`);

    const result = await analyzeProject({
      projectName,
      buildingType,
      storeys,
      mainSystems,
      positions,
      documentText
    });

    const duration = Date.now() - startTime;
    logger.info(`[ProjectAnalysis API] Full analysis completed in ${duration}ms`);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error(`[ProjectAnalysis API] Full analysis error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// POST /api/project-analysis/task/:taskType - Анализ по типу задачи
// ============================================================================

router.post('/task/:taskType', async (req, res) => {
  const startTime = Date.now();
  const { taskType } = req.params;

  try {
    const { projectName, buildingType, storeys, mainSystems, positions, documentText } = req.body;

    // Validate task type
    const roles = getRolesForTask(taskType);
    if (roles.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Unknown task type: ${taskType}`,
        availableTasks: ['concrete_phases', 'formwork', 'reinforcement', 'cost_estimate', 'schedule', 'compliance', 'full_analysis']
      });
    }

    logger.info(`[ProjectAnalysis API] Task analysis requested: ${taskType}`);

    const result = await analyzeWithRoles(taskType, {
      projectName,
      buildingType,
      storeys,
      mainSystems,
      positions,
      documentText
    });

    const duration = Date.now() - startTime;
    logger.info(`[ProjectAnalysis API] Task analysis completed in ${duration}ms`);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error(`[ProjectAnalysis API] Task analysis error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// POST /api/project-analysis/ask/:roleId - Вопрос конкретной роли
// ============================================================================

router.post('/ask/:roleId', async (req, res) => {
  const startTime = Date.now();
  const { roleId } = req.params;

  try {
    const { question, context } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    logger.info(`[ProjectAnalysis API] Question to role ${roleId}: ${question.substring(0, 50)}...`);

    const result = await askRole(roleId, question, context || {});

    const duration = Date.now() - startTime;
    logger.info(`[ProjectAnalysis API] Role response in ${duration}ms`);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error(`[ProjectAnalysis API] Ask role error: ${error.message}`);

    const status = error.message.includes('Unknown role') ? 400 : 500;
    res.status(status).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// GET /api/project-analysis/health - Health check
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'project-analysis',
    rolesCount: Object.keys(ROLES).length,
    timestamp: new Date().toISOString()
  });
});

export default router;
