/**
 * R0 Deterministic Core - API Routes
 *
 * Endpoints:
 *   /api/r0/projects      - R0 Projects CRUD
 *   /api/r0/elements      - Elements CRUD
 *   /api/r0/normsets      - Normsets CRUD
 *   /api/r0/captures      - Captures CRUD + auto-generate
 *   /api/r0/tasks         - Tasks (auto-generated from captures)
 *   /api/r0/schedule      - Schedule calculation
 *   /api/r0/calculate     - Run calculators directly
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { logger } from '../utils/logger.js';

// Import calculators and scheduler from shared package
import {
  calculateRebar,
  calculateFormwork,
  calculateConcreting,
  scheduleProject,
  findCriticalPath,
  getScheduleSummary
} from '@stavagent/monolit-shared';

const router = express.Router();

// ============================================
// PROJECTS
// ============================================

/**
 * GET /api/r0/projects - List all R0 projects
 */
router.get('/projects', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM elements WHERE project_id = p.id) AS elements_count,
        (SELECT COUNT(*) FROM captures c
         JOIN elements e ON c.element_id = e.id
         WHERE e.project_id = p.id) AS captures_count
      FROM r0_projects p
      WHERE p.status = 'active'
      ORDER BY p.updated_at DESC
    `).all();

    res.json({ projects: rows });
  } catch (error) {
    logger.error('Error listing R0 projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/r0/projects/:id - Get single project with elements
 */
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await db.prepare(`
      SELECT * FROM r0_projects WHERE id = ?
    `).get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const elements = await db.prepare(`
      SELECT * FROM elements WHERE project_id = ? ORDER BY name
    `).all(id);

    res.json({ project, elements });
  } catch (error) {
    logger.error('Error getting R0 project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/r0/projects - Create new R0 project
 */
router.post('/projects', async (req, res) => {
  try {
    const {
      name,
      shift_hours = 10,
      time_utilization_k = 0.8,
      days_per_month = 30,
      oh_rate = 0.13,
      profit_rate = 0.08,
      reserve_rate = 0.05,
      wage_rebar_czk_h = 398,
      wage_formwork_czk_h = 398,
      wage_concreting_czk_h = 398,
      pump_rate_czk_h = 1500,
      formwork_rental_czk_day = 300,
      crew_rebar_count = 1,
      crew_formwork_count = 1,
      crew_concreting_count = 1,
      formwork_kits_count = 1,
      pumps_count = 1
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const id = `r0_proj_${uuidv4().slice(0, 8)}`;

    await db.prepare(`
      INSERT INTO r0_projects (
        id, name, shift_hours, time_utilization_k, days_per_month,
        oh_rate, profit_rate, reserve_rate,
        wage_rebar_czk_h, wage_formwork_czk_h, wage_concreting_czk_h,
        pump_rate_czk_h, formwork_rental_czk_day,
        crew_rebar_count, crew_formwork_count, crew_concreting_count,
        formwork_kits_count, pumps_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, shift_hours, time_utilization_k, days_per_month,
      oh_rate, profit_rate, reserve_rate,
      wage_rebar_czk_h, wage_formwork_czk_h, wage_concreting_czk_h,
      pump_rate_czk_h, formwork_rental_czk_day,
      crew_rebar_count, crew_formwork_count, crew_concreting_count,
      formwork_kits_count, pumps_count
    );

    const project = await db.prepare('SELECT * FROM r0_projects WHERE id = ?').get(id);
    res.status(201).json({ project });
  } catch (error) {
    logger.error('Error creating R0 project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/r0/projects/:id - Update project
 */
router.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic UPDATE query
    const allowedFields = [
      'name', 'shift_hours', 'time_utilization_k', 'days_per_month',
      'oh_rate', 'profit_rate', 'reserve_rate',
      'wage_rebar_czk_h', 'wage_formwork_czk_h', 'wage_concreting_czk_h',
      'pump_rate_czk_h', 'formwork_rental_czk_day',
      'crew_rebar_count', 'crew_formwork_count', 'crew_concreting_count',
      'formwork_kits_count', 'pumps_count', 'status'
    ];

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.prepare(`
      UPDATE r0_projects SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);

    const project = await db.prepare('SELECT * FROM r0_projects WHERE id = ?').get(id);
    res.json({ project });
  } catch (error) {
    logger.error('Error updating R0 project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/r0/projects/:id - Delete project (cascade)
 */
router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.prepare('DELETE FROM r0_projects WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, deleted: id });
  } catch (error) {
    logger.error('Error deleting R0 project:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ELEMENTS
// ============================================

/**
 * GET /api/r0/elements?project_id=... - List elements for project
 */
router.get('/elements', async (req, res) => {
  try {
    const { project_id } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const elements = await db.prepare(`
      SELECT
        e.*,
        (SELECT COUNT(*) FROM captures WHERE element_id = e.id) AS captures_count
      FROM elements e
      WHERE e.project_id = ?
      ORDER BY e.name
    `).all(project_id);

    res.json({ elements });
  } catch (error) {
    logger.error('Error listing elements:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/r0/elements - Create element
 */
router.post('/elements', async (req, res) => {
  try {
    const {
      project_id,
      type,
      name,
      description,
      length_m,
      width_m,
      height_m,
      thickness_m,
      concrete_volume_m3,
      formwork_area_m2,
      rebar_mass_t,
      max_continuous_pour_hours = 12,
      layer_thickness_m,
      source_tag = 'USER',
      confidence = 1.0,
      assumptions_log
    } = req.body;

    // Validation
    if (!project_id || !type || !name) {
      return res.status(400).json({ error: 'project_id, type, and name are required' });
    }

    if (concrete_volume_m3 === undefined || formwork_area_m2 === undefined || rebar_mass_t === undefined) {
      return res.status(400).json({ error: 'concrete_volume_m3, formwork_area_m2, and rebar_mass_t are required' });
    }

    const validTypes = ['slab', 'wall', 'beam', 'footing', 'column'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const id = `elem_${uuidv4().slice(0, 8)}`;

    await db.prepare(`
      INSERT INTO elements (
        id, project_id, type, name, description,
        length_m, width_m, height_m, thickness_m,
        concrete_volume_m3, formwork_area_m2, rebar_mass_t,
        max_continuous_pour_hours, layer_thickness_m,
        source_tag, confidence, assumptions_log
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, type, name, description,
      length_m, width_m, height_m, thickness_m,
      concrete_volume_m3, formwork_area_m2, rebar_mass_t,
      max_continuous_pour_hours, layer_thickness_m,
      source_tag, confidence, assumptions_log ? JSON.stringify(assumptions_log) : null
    );

    const element = await db.prepare('SELECT * FROM elements WHERE id = ?').get(id);
    res.status(201).json({ element });
  } catch (error) {
    logger.error('Error creating element:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/r0/elements/:id - Update element
 */
router.put('/elements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'type', 'name', 'description',
      'length_m', 'width_m', 'height_m', 'thickness_m',
      'concrete_volume_m3', 'formwork_area_m2', 'rebar_mass_t',
      'max_continuous_pour_hours', 'layer_thickness_m',
      'source_tag', 'confidence', 'assumptions_log'
    ];

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(key === 'assumptions_log' ? JSON.stringify(value) : value);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.prepare(`
      UPDATE elements SET ${setClauses.join(', ')} WHERE id = ?
    `).run(...values);

    const element = await db.prepare('SELECT * FROM elements WHERE id = ?').get(id);
    res.json({ element });
  } catch (error) {
    logger.error('Error updating element:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/r0/elements/:id - Delete element (cascade)
 */
router.delete('/elements/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.prepare('DELETE FROM elements WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Element not found' });
    }

    res.json({ success: true, deleted: id });
  } catch (error) {
    logger.error('Error deleting element:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NORMSETS
// ============================================

/**
 * GET /api/r0/normsets - List all normsets
 */
router.get('/normsets', async (req, res) => {
  try {
    const normsets = await db.prepare(`
      SELECT * FROM normsets WHERE is_active = 1 ORDER BY is_default DESC, name
    `).all();

    res.json({ normsets });
  } catch (error) {
    logger.error('Error listing normsets:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/r0/normsets/:id - Get single normset
 */
router.get('/normsets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const normset = await db.prepare('SELECT * FROM normsets WHERE id = ?').get(id);

    if (!normset) {
      return res.status(404).json({ error: 'Normset not found' });
    }

    res.json({ normset });
  } catch (error) {
    logger.error('Error getting normset:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CAPTURES
// ============================================

/**
 * GET /api/r0/captures?element_id=... - List captures for element
 */
router.get('/captures', async (req, res) => {
  try {
    const { element_id, project_id } = req.query;

    let captures;
    if (element_id) {
      captures = await db.prepare(`
        SELECT * FROM captures WHERE element_id = ? ORDER BY sequence_index
      `).all(element_id);
    } else if (project_id) {
      captures = await db.prepare(`
        SELECT c.* FROM captures c
        JOIN elements e ON c.element_id = e.id
        WHERE e.project_id = ?
        ORDER BY e.name, c.sequence_index
      `).all(project_id);
    } else {
      return res.status(400).json({ error: 'element_id or project_id required' });
    }

    res.json({ captures });
  } catch (error) {
    logger.error('Error listing captures:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/r0/captures/auto-generate - Auto-generate captures for element
 */
router.post('/captures/auto-generate', async (req, res) => {
  try {
    const { element_id, captures_count = 1 } = req.body;

    if (!element_id) {
      return res.status(400).json({ error: 'element_id is required' });
    }

    const element = await db.prepare('SELECT * FROM elements WHERE id = ?').get(element_id);

    if (!element) {
      return res.status(404).json({ error: 'Element not found' });
    }

    // Delete existing captures
    await db.prepare('DELETE FROM captures WHERE element_id = ?').run(element_id);

    // Calculate quantities per capture
    const volume_per_capture = element.concrete_volume_m3 / captures_count;
    const area_per_capture = element.formwork_area_m2 / captures_count;
    const mass_per_capture = element.rebar_mass_t / captures_count;

    const created = [];
    let prevCaptureId = null;

    for (let i = 0; i < captures_count; i++) {
      const id = `capt_${uuidv4().slice(0, 8)}`;
      const dependencies = prevCaptureId ? JSON.stringify([prevCaptureId]) : '[]';
      const joint_type = i > 0 ? 'construction_joint' : 'none';

      await db.prepare(`
        INSERT INTO captures (
          id, element_id, sequence_index, name,
          volume_m3, area_m2, mass_t,
          joint_type, dependencies,
          source_tag, confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, element_id, i + 1, `Takt ${i + 1}`,
        volume_per_capture, area_per_capture, mass_per_capture,
        joint_type, dependencies,
        'SYSTEM', 1.0
      );

      const capture = await db.prepare('SELECT * FROM captures WHERE id = ?').get(id);
      created.push(capture);
      prevCaptureId = id;
    }

    res.status(201).json({
      captures: created,
      message: `Generated ${captures_count} captures for element ${element.name}`
    });
  } catch (error) {
    logger.error('Error auto-generating captures:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CALCULATE (Direct calculator access)
// ============================================

/**
 * POST /api/r0/calculate/rebar - Calculate rebar work
 */
router.post('/calculate/rebar', (req, res) => {
  try {
    const result = calculateRebar(req.body);
    res.json({ result });
  } catch (error) {
    logger.error('Error calculating rebar:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/r0/calculate/formwork - Calculate formwork work
 */
router.post('/calculate/formwork', (req, res) => {
  try {
    const result = calculateFormwork(req.body);
    res.json({ result });
  } catch (error) {
    logger.error('Error calculating formwork:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/r0/calculate/concreting - Calculate concreting work
 */
router.post('/calculate/concreting', (req, res) => {
  try {
    const result = calculateConcreting(req.body);
    res.json({ result });
  } catch (error) {
    logger.error('Error calculating concreting:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// TASKS (Auto-generated from captures)
// ============================================

/**
 * POST /api/r0/tasks/generate - Generate tasks for project
 */
router.post('/tasks/generate', async (req, res) => {
  try {
    const { project_id, normset_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    // Get project
    const project = await db.prepare('SELECT * FROM r0_projects WHERE id = ?').get(project_id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get normset (use default if not specified)
    let normset;
    if (normset_id) {
      normset = await db.prepare('SELECT * FROM normsets WHERE id = ?').get(normset_id);
    } else {
      normset = await db.prepare('SELECT * FROM normsets WHERE is_default = 1').get();
    }

    if (!normset) {
      return res.status(400).json({ error: 'No normset found. Please create one first.' });
    }

    // Get all captures for project
    const captures = await db.prepare(`
      SELECT c.*, e.name as element_name, e.max_continuous_pour_hours
      FROM captures c
      JOIN elements e ON c.element_id = e.id
      WHERE e.project_id = ?
      ORDER BY e.name, c.sequence_index
    `).all(project_id);

    if (captures.length === 0) {
      return res.status(400).json({ error: 'No captures found. Generate captures first.' });
    }

    // Delete existing tasks for project
    await db.prepare(`
      DELETE FROM tasks WHERE capture_id IN (
        SELECT c.id FROM captures c
        JOIN elements e ON c.element_id = e.id
        WHERE e.project_id = ?
      )
    `).run(project_id);

    const tasks = [];

    for (const capture of captures) {
      // 1. Rebar task
      const rebarResult = calculateRebar({
        mass_t: capture.mass_t,
        norm_h_per_t: normset.rebar_h_per_t,
        crew_size: 4, // Default crew size
        shift_h: project.shift_hours,
        k: project.time_utilization_k,
        wage_czk_h: project.wage_rebar_czk_h,
        source_tag: normset.source_tag,
        confidence: 0.95
      });

      const rebarTaskId = `task_${uuidv4().slice(0, 8)}`;
      tasks.push({
        id: rebarTaskId,
        capture_id: capture.id,
        normset_id: normset.id,
        type: 'rebar',
        sequence: 1,
        description: `Armování ${capture.name}`,
        duration_hours: rebarResult.labor_hours,
        duration_days: rebarResult.duration_days,
        labor_hours: rebarResult.labor_hours,
        cost_labor: rebarResult.cost_labor,
        cost_machine: 0,
        cost_rental: 0,
        crew_size: 4,
        resources_required: JSON.stringify({ crew_rebar: 1 }),
        source_tag: rebarResult.source_tag,
        norm_used: `${normset.rebar_h_per_t} h/t`,
        assumptions_log: rebarResult.assumptions_log,
        confidence: rebarResult.confidence,
        predecessors: '[]'
      });

      // 2. Formwork assembly task
      const formworkResult = calculateFormwork({
        area_m2: capture.area_m2,
        norm_assembly_h_m2: normset.formwork_assembly_h_per_m2,
        norm_disassembly_h_m2: normset.formwork_disassembly_h_per_m2,
        crew_size: 4,
        shift_h: project.shift_hours,
        k: project.time_utilization_k,
        wage_czk_h: project.wage_formwork_czk_h,
        strip_wait_hours: normset.strip_wait_hours,
        move_clean_hours: normset.move_clean_hours,
        source_tag: normset.source_tag,
        confidence: 0.95
      });

      const formworkInTaskId = `task_${uuidv4().slice(0, 8)}`;
      tasks.push({
        id: formworkInTaskId,
        capture_id: capture.id,
        normset_id: normset.id,
        type: 'formwork_in',
        sequence: 2,
        description: `Montáž bednění ${capture.name}`,
        duration_hours: formworkResult.assembly_hours,
        duration_days: formworkResult.assembly_days,
        labor_hours: formworkResult.assembly_hours,
        cost_labor: formworkResult.assembly_hours * project.wage_formwork_czk_h,
        cost_machine: 0,
        cost_rental: 0,
        crew_size: 4,
        resources_required: JSON.stringify({ crew_formwork: 1, formwork_kit: 1 }),
        source_tag: formworkResult.source_tag,
        norm_used: `${normset.formwork_assembly_h_per_m2} h/m²`,
        assumptions_log: formworkResult.assumptions_log,
        confidence: formworkResult.confidence,
        predecessors: JSON.stringify([rebarTaskId])
      });

      // 3. Concreting task
      const concretingResult = calculateConcreting({
        volume_m3: capture.volume_m3,
        q_eff_m3_h: 15, // Default pump capacity
        setup_hours: normset.pour_setup_hours,
        washout_hours: normset.washout_hours,
        crew_size: normset.pour_team_required,
        shift_h: project.shift_hours,
        wage_czk_h: project.wage_concreting_czk_h,
        pump_rate_czk_h: project.pump_rate_czk_h,
        max_continuous_hours: capture.max_continuous_pour_hours || 12,
        source_tag: normset.source_tag,
        confidence: 0.95
      });

      const pourTaskId = `task_${uuidv4().slice(0, 8)}`;
      tasks.push({
        id: pourTaskId,
        capture_id: capture.id,
        normset_id: normset.id,
        type: 'pour',
        sequence: 3,
        description: `Betonáž ${capture.name}`,
        duration_hours: concretingResult.pour_hours,
        duration_days: concretingResult.pour_days,
        labor_hours: concretingResult.pour_hours * normset.pour_team_required,
        cost_labor: concretingResult.cost_labor,
        cost_machine: concretingResult.cost_pump,
        cost_rental: 0,
        crew_size: normset.pour_team_required,
        resources_required: JSON.stringify({ crew_concreting: 1, pump: 1 }),
        source_tag: concretingResult.source_tag,
        norm_used: `Q_eff=15 m³/h`,
        assumptions_log: concretingResult.assumptions_log,
        confidence: concretingResult.confidence,
        predecessors: JSON.stringify([formworkInTaskId])
      });

      // 4. Wait for stripping
      const waitTaskId = `task_${uuidv4().slice(0, 8)}`;
      tasks.push({
        id: waitTaskId,
        capture_id: capture.id,
        normset_id: normset.id,
        type: 'wait_strip',
        sequence: 4,
        description: `Vytvrzování ${capture.name}`,
        duration_hours: normset.strip_wait_hours,
        duration_days: formworkResult.wait_days,
        labor_hours: 0,
        cost_labor: 0,
        cost_machine: 0,
        cost_rental: formworkResult.wait_days * project.formwork_rental_czk_day,
        crew_size: 0,
        resources_required: JSON.stringify({ formwork_kit: 1 }),
        source_tag: normset.source_tag,
        norm_used: `strip_wait=${normset.strip_wait_hours}h`,
        assumptions_log: `Technological wait: ${normset.strip_wait_hours}h`,
        confidence: 1.0,
        predecessors: JSON.stringify([pourTaskId])
      });

      // 5. Formwork disassembly
      const formworkOutTaskId = `task_${uuidv4().slice(0, 8)}`;
      tasks.push({
        id: formworkOutTaskId,
        capture_id: capture.id,
        normset_id: normset.id,
        type: 'formwork_out',
        sequence: 5,
        description: `Demontáž bednění ${capture.name}`,
        duration_hours: formworkResult.disassembly_hours,
        duration_days: formworkResult.disassembly_days,
        labor_hours: formworkResult.disassembly_hours,
        cost_labor: formworkResult.disassembly_hours * project.wage_formwork_czk_h,
        cost_machine: 0,
        cost_rental: 0,
        crew_size: 4,
        resources_required: JSON.stringify({ crew_formwork: 1, formwork_kit: 1 }),
        source_tag: formworkResult.source_tag,
        norm_used: `${normset.formwork_disassembly_h_per_m2} h/m²`,
        assumptions_log: formworkResult.assumptions_log,
        confidence: formworkResult.confidence,
        predecessors: JSON.stringify([waitTaskId])
      });

      // 6. Move & clean
      const moveCleanTaskId = `task_${uuidv4().slice(0, 8)}`;
      tasks.push({
        id: moveCleanTaskId,
        capture_id: capture.id,
        normset_id: normset.id,
        type: 'move_clean',
        sequence: 6,
        description: `Přemístění bednění ${capture.name}`,
        duration_hours: normset.move_clean_hours,
        duration_days: formworkResult.move_clean_days,
        labor_hours: normset.move_clean_hours,
        cost_labor: normset.move_clean_hours * project.wage_formwork_czk_h,
        cost_machine: 0,
        cost_rental: 0,
        crew_size: 2,
        resources_required: JSON.stringify({ crew_formwork: 1, formwork_kit: 1 }),
        source_tag: normset.source_tag,
        norm_used: `move_clean=${normset.move_clean_hours}h`,
        assumptions_log: `Move & clean: ${normset.move_clean_hours}h`,
        confidence: 1.0,
        predecessors: JSON.stringify([formworkOutTaskId])
      });
    }

    // Insert all tasks
    for (const task of tasks) {
      await db.prepare(`
        INSERT INTO tasks (
          id, capture_id, normset_id, type, sequence, description,
          duration_hours, duration_days, labor_hours,
          cost_labor, cost_machine, cost_rental,
          crew_size, resources_required,
          source_tag, norm_used, assumptions_log, confidence, predecessors
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.id, task.capture_id, task.normset_id, task.type, task.sequence, task.description,
        task.duration_hours, task.duration_days, task.labor_hours,
        task.cost_labor, task.cost_machine, task.cost_rental,
        task.crew_size, task.resources_required,
        task.source_tag, task.norm_used, task.assumptions_log, task.confidence, task.predecessors
      );
    }

    res.status(201).json({
      tasks_count: tasks.length,
      captures_count: captures.length,
      message: `Generated ${tasks.length} tasks for ${captures.length} captures`
    });
  } catch (error) {
    logger.error('Error generating tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/r0/tasks?project_id=... - Get all tasks for project
 */
router.get('/tasks', async (req, res) => {
  try {
    const { project_id } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const tasks = await db.prepare(`
      SELECT t.*, c.name as capture_name, c.sequence_index as capture_sequence,
             e.name as element_name
      FROM tasks t
      JOIN captures c ON t.capture_id = c.id
      JOIN elements e ON c.element_id = e.id
      WHERE e.project_id = ?
      ORDER BY e.name, c.sequence_index, t.sequence
    `).all(project_id);

    res.json({ tasks });
  } catch (error) {
    logger.error('Error listing tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SCHEDULE
// ============================================

/**
 * POST /api/r0/schedule/calculate - Calculate schedule for project
 */
router.post('/schedule/calculate', async (req, res) => {
  try {
    const { project_id } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    // Get project
    const project = await db.prepare('SELECT * FROM r0_projects WHERE id = ?').get(project_id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get tasks
    const tasksRaw = await db.prepare(`
      SELECT t.* FROM tasks t
      JOIN captures c ON t.capture_id = c.id
      JOIN elements e ON c.element_id = e.id
      WHERE e.project_id = ?
    `).all(project_id);

    if (tasksRaw.length === 0) {
      return res.status(400).json({ error: 'No tasks found. Generate tasks first.' });
    }

    // Convert to scheduler format
    const tasks = tasksRaw.map(t => ({
      ...t,
      predecessors: JSON.parse(t.predecessors || '[]'),
      resources_required: JSON.parse(t.resources_required || '{}')
    }));

    // Build resources object
    const resources = {
      crew_rebar_count: project.crew_rebar_count,
      crew_formwork_count: project.crew_formwork_count,
      crew_concreting_count: project.crew_concreting_count,
      formwork_kits_count: project.formwork_kits_count,
      pumps_count: project.pumps_count,
      shift_hours: project.shift_hours,
      days_per_month: project.days_per_month
    };

    // Calculate schedule
    const schedule = scheduleProject(tasks, resources);
    const criticalPath = findCriticalPath(schedule, tasks);
    const summary = getScheduleSummary(schedule, tasks, resources);

    // Mark critical path tasks
    for (const entry of schedule) {
      entry.is_critical = criticalPath.includes(entry.task_id);
    }

    res.json({
      schedule,
      summary: {
        total_duration_days: summary.total_duration_days,
        total_labor_hours: summary.total_labor_hours,
        total_cost: summary.total_cost,
        critical_path_length: criticalPath.length
      },
      critical_path: criticalPath
    });
  } catch (error) {
    logger.error('Error calculating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
