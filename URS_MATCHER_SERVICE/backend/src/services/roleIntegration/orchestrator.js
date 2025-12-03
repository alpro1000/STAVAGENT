/**
 * Multi-Role Orchestrator
 * Фаза 3 Advanced: Intelligent role routing and workflow sequencing
 *
 * Responsibilities:
 * 1. Classify task complexity (SIMPLE/STANDARD/COMPLEX/CREATIVE)
 * 2. Select required specialist roles based on task type
 * 3. Plan optimal execution sequence (sequential/parallel)
 * 4. Manage context passing between roles
 * 5. Monitor for expert disagreements
 * 6. Aggregate final response from all roles
 */

import { logger } from '../../utils/logger.js';
import { getRoleTemperature } from './roleTemperatures.js';

export class Orchestrator {
  constructor(multiRoleClient) {
    this.multiRoleClient = multiRoleClient;
    this.complexityThresholds = {
      SIMPLE: { rowCount: 1, dataCompleteness: 0.8 },
      STANDARD: { rowCount: 5, dataCompleteness: 0.7 },
      COMPLEX: { rowCount: 20, dataCompleteness: 0.5 },
      CREATIVE: { rowCount: 999, dataCompleteness: 0.3 }
    };
  }

  /**
   * Main entry point: Orchestrate analysis of a BOQ block
   */
  async analyzeBlock(boqBlock, projectContext) {
    const startTime = Date.now();
    const analysisId = this.generateAnalysisId();

    logger.info(`[ORCHESTRATOR] Starting analysis: ${analysisId}`);

    try {
      // 1. Classify task complexity
      const complexity = this.classifyComplexity(boqBlock, projectContext);
      logger.info(`[ORCHESTRATOR] Complexity: ${complexity}`);

      // 2. Select required roles
      const requiredRoles = this.selectRoles(complexity, boqBlock, projectContext);
      logger.info(`[ORCHESTRATOR] Required roles: ${requiredRoles.join(', ')}`);

      // 3. Plan execution sequence
      const executionPlan = this.planSequence(requiredRoles);
      logger.info(`[ORCHESTRATOR] Execution plan: ${JSON.stringify(executionPlan)}`);

      // 4. Execute workflow
      const roleOutputs = await this.executeWorkflow(
        executionPlan,
        boqBlock,
        projectContext,
        analysisId
      );

      // 5. Detect conflicts
      const conflicts = this.detectConflicts(roleOutputs);
      if (conflicts.length > 0) {
        logger.warn(`[ORCHESTRATOR] Detected ${conflicts.length} conflicts`);
      }

      // 6. Aggregate and return
      const result = this.aggregateResults(
        roleOutputs,
        conflicts,
        complexity,
        startTime
      );

      logger.info(`[ORCHESTRATOR] Analysis complete: ${analysisId} (${result.execution_time_ms}ms)`);
      return result;

    } catch (error) {
      logger.error(`[ORCHESTRATOR] Analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Classify task complexity based on BOQ characteristics
   * Returns: SIMPLE | STANDARD | COMPLEX | CREATIVE
   */
  classifyComplexity(boqBlock, projectContext) {
    let score = 0;

    // Factor 1: Number of rows (weight: 0-3)
    const rowCount = boqBlock.rows?.length || 0;
    if (rowCount === 1) score += 0;
    else if (rowCount <= 5) score += 1;
    else if (rowCount <= 15) score += 2;
    else if (rowCount <= 30) score += 3;
    else score += 4;

    // Factor 2: Data completeness (weight: 0-2)
    const completeness = this.assessDataCompleteness(boqBlock, projectContext);
    if (completeness >= 0.8) score += 0;
    else if (completeness >= 0.6) score += 1;
    else score += 2;

    // Factor 3: Block type indicators (weight: 0-2)
    const blockTitle = boqBlock.title?.toLowerCase() || '';
    const complexKeywords = [
      'optimization', 'alternative', 'special', 'unusual',
      'experimental', 'custom', 'innovative'
    ];
    const hasComplexKeywords = complexKeywords.some(kw => blockTitle.includes(kw));
    if (hasComplexKeywords) score += 2;

    // Factor 4: Project context richness (weight: 0-1)
    const contextFields = Object.keys(projectContext || {}).length;
    if (contextFields >= 3) score += 0;  // Rich context = simpler task
    else score += 1;

    // Determine complexity level with more reasonable thresholds
    // Total score range: 0-9
    if (score <= 1) return 'SIMPLE';
    if (score <= 3) return 'STANDARD';
    if (score <= 6) return 'COMPLEX';
    return 'CREATIVE';
  }

  /**
   * Assess data completeness (0.0 - 1.0)
   */
  assessDataCompleteness(boqBlock, projectContext) {
    const boqFields = ['title', 'rows', 'context'];
    const contextFields = projectContext ? Object.keys(projectContext).length : 0;

    const boqCompleteness = boqFields.filter(f => boqBlock[f] != null).length / boqFields.length;
    const contextCompleteness = Math.min(contextFields / 5, 1.0);  // 5 fields = 100%

    return (boqCompleteness + contextCompleteness) / 2;
  }

  /**
   * Select required specialist roles based on complexity and task type
   * Returns: Array of role names
   */
  selectRoles(complexity, boqBlock, projectContext) {
    const roles = [];

    // Always include Document Validator for COMPLEX/CREATIVE
    if (complexity === 'COMPLEX' || complexity === 'CREATIVE') {
      roles.push('document_validator');
    }

    // Structural Engineer needed for most tasks (unless simple lookup)
    if (complexity !== 'SIMPLE') {
      roles.push('structural_engineer');
    }

    // Concrete Specialist needed for durability/material decisions
    if (complexity === 'STANDARD' || complexity === 'COMPLEX' || complexity === 'CREATIVE') {
      roles.push('concrete_specialist');
    }

    // Standards Checker essential for COMPLEX/CREATIVE (compliance verification)
    if (complexity === 'COMPLEX' || complexity === 'CREATIVE') {
      roles.push('standards_checker');
    }

    // Tech Rules Engine always included for mandatory work detection
    roles.push('tech_rules_engine');

    // Cost Estimator only if project context mentions budget
    if (projectContext?.budget_constraint) {
      roles.push('cost_estimator');
    }

    return roles;
  }

  /**
   * Plan execution sequence with dependencies
   * Returns: { sequential: [...], parallel: [[...], [...]] }
   */
  planSequence(roles) {
    // Define dependencies between roles
    const dependencies = {
      'document_validator': [],
      'structural_engineer': ['document_validator'],  // Needs clean data first
      'concrete_specialist': ['structural_engineer'],  // Needs concrete class from SE
      'standards_checker': [],  // Can run independently
      'tech_rules_engine': [],  // Can run independently
      'cost_estimator': ['structural_engineer', 'concrete_specialist']  // Needs specs
    };

    // Build execution plan
    const sequential = [];
    const parallel = [];
    const processed = new Set();

    // Phase 1: Document validation (if needed)
    if (roles.includes('document_validator') && !processed.has('document_validator')) {
      sequential.push(['document_validator']);
      processed.add('document_validator');
    }

    // Phase 2: Parallel specialists (can run together)
    const parallelPhase = [];
    if (roles.includes('structural_engineer') && !processed.has('structural_engineer')) {
      parallelPhase.push('structural_engineer');
      processed.add('structural_engineer');
    }
    if (roles.includes('standards_checker') && !processed.has('standards_checker')) {
      parallelPhase.push('standards_checker');
      processed.add('standards_checker');
    }
    if (roles.includes('tech_rules_engine') && !processed.has('tech_rules_engine')) {
      parallelPhase.push('tech_rules_engine');
      processed.add('tech_rules_engine');
    }
    if (parallelPhase.length > 0) {
      parallel.push(parallelPhase);
    }

    // Phase 3: Sequential roles with dependencies
    if (roles.includes('concrete_specialist') && !processed.has('concrete_specialist')) {
      sequential.push(['concrete_specialist']);
      processed.add('concrete_specialist');
    }

    if (roles.includes('cost_estimator') && !processed.has('cost_estimator')) {
      sequential.push(['cost_estimator']);
      processed.add('cost_estimator');
    }

    return {
      sequential,
      parallel,
      all: roles
    };
  }

  /**
   * Execute workflow according to plan
   * Manage context passing and error handling
   */
  async executeWorkflow(executionPlan, boqBlock, projectContext, analysisId) {
    const roleOutputs = {};
    const contextChain = {
      boq_block: boqBlock,
      project_context: projectContext,
      analysis_id: analysisId
    };

    logger.info(`[ORCHESTRATOR] Executing sequential phases: ${executionPlan.sequential.length}`);

    // Execute sequential phases
    for (const phase of executionPlan.sequential) {
      for (const role of phase) {
        try {
          logger.info(`[ORCHESTRATOR] Invoking role: ${role}`);

          const output = await this.invokeRole(
            role,
            boqBlock,
            projectContext,
            contextChain
          );

          roleOutputs[role] = output;

          // Update context chain with this role's output
          contextChain[`${role}_output`] = output;

        } catch (error) {
          logger.error(`[ORCHESTRATOR] Role failed: ${role} - ${error.message}`);
          roleOutputs[role] = { error: error.message, status: 'failed' };
        }
      }
    }

    logger.info(`[ORCHESTRATOR] Executing parallel phases: ${executionPlan.parallel.length}`);

    // Execute parallel phases
    for (const phase of executionPlan.parallel) {
      const parallelPromises = phase.map(role =>
        this.invokeRole(role, boqBlock, projectContext, contextChain)
          .then(output => {
            roleOutputs[role] = output;
            contextChain[`${role}_output`] = output;
            return { role, output };
          })
          .catch(error => {
            logger.error(`[ORCHESTRATOR] Role failed: ${role} - ${error.message}`);
            roleOutputs[role] = { error: error.message, status: 'failed' };
            return { role, error };
          })
      );

      await Promise.all(parallelPromises);
    }

    return roleOutputs;
  }

  /**
   * Invoke a specific specialist role
   * Handles role-specific invocation logic
   */
  async invokeRole(role, boqBlock, projectContext, contextChain) {
    logger.info(`[ORCHESTRATOR:${role}] Processing...`);

    // Role-specific invocation
    switch (role) {
      case 'document_validator':
        return await this.multiRoleClient.validateBoqBlock(boqBlock, projectContext);

      case 'structural_engineer':
        return await this.invokeStructuralEngineer(boqBlock, projectContext);

      case 'concrete_specialist':
        return await this.invokeConcreteSpecialist(
          boqBlock,
          projectContext,
          contextChain.structural_engineer_output
        );

      case 'standards_checker':
        return await this.invokeStandardsChecker(boqBlock, projectContext);

      case 'tech_rules_engine':
        return await this.invokeTechRulesEngine(
          boqBlock,
          projectContext,
          contextChain.structural_engineer_output
        );

      case 'cost_estimator':
        return await this.invokeCostEstimator(
          boqBlock,
          projectContext,
          contextChain
        );

      default:
        throw new Error(`Unknown role: ${role}`);
    }
  }

  /**
   * Invoke Structural Engineer via Multi-Role API
   */
  async invokeStructuralEngineer(boqBlock, projectContext) {
    const question = `
As a Senior Structural Engineer, analyze this BOQ block:

Block: ${boqBlock.title}
Items: ${boqBlock.rows?.length || 0}
Building: ${projectContext.building_type || 'unknown'}
Storeys: ${projectContext.storeys || 'unknown'}

Determine:
1. Load analysis (dead load, live load, environmental)
2. Required concrete class per EN 1992 and ČSN 73 1201
3. Exposure class (XC/XD/XF/XA/XS)
4. Safety factor assessment
5. Any structural concerns or warnings

Respond in JSON:
{
  "loads_analysis": {"dead_load": ..., "live_load": ..., "total": ...},
  "required_concrete_class": "C30/37",
  "exposure_class": "XC3",
  "safety_factor": 1.65,
  "warnings": [...],
  "confidence": 0.95
}
`;

    const temperature = getRoleTemperature('structural_engineer', 'load_calculation');

    const response = await this.multiRoleClient.askMultiRole(question, {
      context: { boq_block: boqBlock, project_context: projectContext },
      temperature
    });

    return this.parseStructuralEngineerResponse(response);
  }

  /**
   * Invoke Concrete Specialist via Multi-Role API
   */
  async invokeConcreteSpecialist(boqBlock, projectContext, structuralOutput) {
    const question = `
As a Senior Concrete Technology Specialist, specify concrete requirements:

Required Class: ${structuralOutput?.required_concrete_class || 'unknown'}
Exposure Class: ${structuralOutput?.exposure_class || 'unknown'}
Building: ${projectContext.building_type}

Determine:
1. Water-cement ratio per ČSN EN 206
2. Cement type (CEM I, CEM II, CEM III, etc.)
3. Aggregate specifications
4. Special admixtures (if needed)
5. Durability assessment

Respond in JSON:
{
  "concrete_class": "...",
  "w_c_ratio": 0.55,
  "cement_type": "CEM II/B-S 42.5 R",
  "min_cement_kg_m3": 300,
  "aggregate": {...},
  "admixtures": [...],
  "durability_assessment": "...",
  "confidence": 0.90
}
`;

    const temperature = getRoleTemperature('concrete_specialist', 'mix_design');

    const response = await this.multiRoleClient.askMultiRole(question, {
      context: {
        boq_block: boqBlock,
        project_context: projectContext,
        structural_output: structuralOutput
      },
      temperature
    });

    return this.parseConcreteSpecialistResponse(response);
  }

  /**
   * Invoke Standards Checker via Multi-Role API
   */
  async invokeStandardsChecker(boqBlock, projectContext) {
    const question = `
As a Senior Standards & Compliance Officer, verify this BOQ block for compliance:

Block: ${boqBlock.title}
Items: ${boqBlock.rows?.length || 0}

Check for compliance with:
1. ČSN 73 1201 (Design of concrete structures)
2. ČSN EN 206+A2 (Concrete specification)
3. EN 1990-1998 (Eurocode suite)
4. Czech building regulations

Respond in JSON:
{
  "compliance_status": "COMPLIANT" | "DEVIATIONS" | "NON-COMPLIANT",
  "standards_applied": [...],
  "deviations": [...],
  "warnings": [...],
  "confidence": 0.95
}
`;

    const temperature = getRoleTemperature('standards_checker', 'compliance_check');

    const response = await this.multiRoleClient.askMultiRole(question, {
      context: { boq_block: boqBlock, project_context: projectContext },
      temperature
    });

    return this.parseStandardsCheckerResponse(response);
  }

  /**
   * Invoke Tech Rules Engine (local implementation)
   */
  async invokeTechRulesEngine(boqBlock, projectContext, structuralOutput) {
    // This could call the TechRulesEngine class directly
    // For now, return a placeholder
    return {
      mandatory_items: [],
      completeness_score: 85,
      missing_items: [],
      warnings: [],
      confidence: 0.80
    };
  }

  /**
   * Invoke Cost Estimator via Multi-Role API
   */
  async invokeCostEstimator(boqBlock, projectContext, contextChain) {
    // Cost estimation based on specifications from other roles
    // Implementation deferred to later phase
    return {
      total_cost_czk: 0,
      cost_breakdown: [],
      currency: 'CZK',
      confidence: 0.70
    };
  }

  /**
   * Detect conflicts between specialist opinions
   */
  detectConflicts(roleOutputs) {
    const conflicts = [];

    // Check for concrete class disagreements
    const seClass = roleOutputs.structural_engineer?.required_concrete_class;
    const csClass = roleOutputs.concrete_specialist?.concrete_class;

    if (seClass && csClass && seClass !== csClass) {
      conflicts.push({
        type: 'CONCRETE_CLASS_MISMATCH',
        roles: ['structural_engineer', 'concrete_specialist'],
        structural_says: seClass,
        concrete_says: csClass,
        severity: 'HIGH'
      });
    }

    // Check for standards compliance warnings
    if (roleOutputs.standards_checker?.compliance_status === 'DEVIATIONS') {
      conflicts.push({
        type: 'STANDARDS_DEVIATION',
        deviations: roleOutputs.standards_checker.deviations,
        severity: 'MEDIUM'
      });
    }

    return conflicts;
  }

  /**
   * Aggregate results from all roles into unified response
   */
  aggregateResults(roleOutputs, conflicts, complexity, startTime) {
    const executionTime = Date.now() - startTime;

    return {
      analysis_type: 'phase3_advanced',
      complexity,
      execution_time_ms: executionTime,

      // Role outputs
      structural_analysis: roleOutputs.structural_engineer || {},
      material_specification: roleOutputs.concrete_specialist || {},
      standards_compliance: roleOutputs.standards_checker || {},
      tech_rules_validation: roleOutputs.tech_rules_engine || {},
      cost_estimate: roleOutputs.cost_estimator || {},

      // Conflicts
      conflicts,
      conflict_resolutions: conflicts.length > 0 ? this.resolveConflicts(conflicts, roleOutputs) : [],

      // Metadata
      roles_consulted: Object.keys(roleOutputs).filter(role => roleOutputs[role].status !== 'failed'),
      status: conflicts.some(c => c.severity === 'HIGH') ? 'needs_review' : 'complete',
      overall_confidence: this.calculateOverallConfidence(roleOutputs)
    };
  }

  /**
   * Resolve conflicts using established hierarchy
   * Safety > Code > Durability > Practicality > Cost
   */
  resolveConflicts(conflicts, roleOutputs) {
    const resolutions = [];

    for (const conflict of conflicts) {
      if (conflict.type === 'CONCRETE_CLASS_MISMATCH') {
        // Apply "stricter requirement wins" rule
        const classes = ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C50/60'];
        const idx1 = classes.indexOf(conflict.structural_says);
        const idx2 = classes.indexOf(conflict.concrete_says);
        const selectedClass = classes[Math.max(idx1, idx2)];

        resolutions.push({
          conflict_type: 'CONCRETE_CLASS_MISMATCH',
          decision: selectedClass,
          reasoning: `Both load (${conflict.structural_says}) and durability (${conflict.concrete_says}) requirements must be satisfied. Higher class ${selectedClass} meets both.`,
          confidence: 0.99
        });
      }
    }

    return resolutions;
  }

  /**
   * Calculate overall confidence from all role confidences
   */
  calculateOverallConfidence(roleOutputs) {
    const confidences = Object.values(roleOutputs)
      .filter(output => typeof output.confidence === 'number')
      .map(output => output.confidence);

    if (confidences.length === 0) return 0.70;

    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  /**
   * Parse structural engineer response
   */
  parseStructuralEngineerResponse(response) {
    try {
      if (typeof response === 'string') {
        return JSON.parse(response);
      }
      return response;
    } catch (error) {
      logger.error(`[ORCHESTRATOR] Failed to parse structural engineer response: ${error.message}`);
      return { error: 'Parse error', status: 'failed' };
    }
  }

  /**
   * Parse concrete specialist response
   */
  parseConcreteSpecialistResponse(response) {
    try {
      if (typeof response === 'string') {
        return JSON.parse(response);
      }
      return response;
    } catch (error) {
      logger.error(`[ORCHESTRATOR] Failed to parse concrete specialist response: ${error.message}`);
      return { error: 'Parse error', status: 'failed' };
    }
  }

  /**
   * Parse standards checker response
   */
  parseStandardsCheckerResponse(response) {
    try {
      if (typeof response === 'string') {
        return JSON.parse(response);
      }
      return response;
    } catch (error) {
      logger.error(`[ORCHESTRATOR] Failed to parse standards checker response: ${error.message}`);
      return { error: 'Parse error', status: 'failed' };
    }
  }

  /**
   * Generate unique analysis ID
   */
  generateAnalysisId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
