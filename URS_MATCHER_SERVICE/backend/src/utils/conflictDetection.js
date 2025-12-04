/**
 * Conflict Detection Engine
 * Phase 3 Advanced: Identify disagreements between specialist roles
 */

import { logger } from './logger.js';

/**
 * Detect all types of conflicts between role outputs
 * @param {Object} roleOutputs - Outputs from all specialist roles
 * @returns {Array<Object>} Array of detected conflicts with severity levels
 */
export function detectConflicts(roleOutputs) {
  const conflicts = [];

  if (!roleOutputs || typeof roleOutputs !== 'object') {
    return conflicts;
  }

  // 1. Check for concrete class conflicts
  const classConflicts = detectConcreteClassConflicts(roleOutputs);
  conflicts.push(...classConflicts);

  // 2. Check for durability conflicts
  const durabilityConflicts = detectDurabilityConflicts(roleOutputs);
  conflicts.push(...durabilityConflicts);

  // 3. Check for exposure class conflicts
  const exposureConflicts = detectExposureClassConflicts(roleOutputs);
  conflicts.push(...exposureConflicts);

  // 4. Check for cost viability conflicts
  const costConflicts = detectCostConflicts(roleOutputs);
  conflicts.push(...costConflicts);

  // 5. Check for standards compliance conflicts
  const standardsConflicts = detectStandardsConflicts(roleOutputs);
  conflicts.push(...standardsConflicts);

  // 6. Check for tech rules conflicts
  const techRulesConflicts = detectTechRulesConflicts(roleOutputs);
  conflicts.push(...techRulesConflicts);

  logger.info(`[CONFLICT-DETECTION] Found ${conflicts.length} potential conflicts`);

  return conflicts;
}

/**
 * Detect concrete class disagreements
 * Structural Engineer vs Concrete Specialist
 */
function detectConcreteClassConflicts(roleOutputs) {
  const conflicts = [];

  const structuralClass = roleOutputs.structural_engineer?.required_concrete_class;
  const concreteClass = roleOutputs.concrete_specialist?.concrete_class;

  if (!structuralClass || !concreteClass) {
    return conflicts;
  }

  if (structuralClass !== concreteClass) {
    const classes = ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C50/60'];
    const idx1 = classes.indexOf(structuralClass);
    const idx2 = classes.indexOf(concreteClass);

    const severity = Math.abs(idx1 - idx2) > 1 ? 'CRITICAL' : 'HIGH';

    conflicts.push({
      id: 'concrete_class_mismatch',
      type: 'CONCRETE_CLASS_MISMATCH',
      description: `Concrete class disagreement: Structural Engineer says ${structuralClass}, Concrete Specialist says ${concreteClass}`,
      roles_involved: ['structural_engineer', 'concrete_specialist'],
      structural_says: structuralClass,
      concrete_says: concreteClass,
      severity,
      resolution_hint: `Apply stricter requirement: ${classes[Math.max(idx1, idx2)]} (higher class satisfies both)`,
      confidence: 0.95,
      detected_at: new Date().toISOString()
    });
  }

  return conflicts;
}

/**
 * Detect durability assessment conflicts
 * Concrete Specialist vs Standards Checker
 */
function detectDurabilityConflicts(roleOutputs) {
  const conflicts = [];

  const concreteSpecialistAssessment = roleOutputs.concrete_specialist?.durability_assessment;
  const standardsCompliance = roleOutputs.standards_checker?.compliance_status;

  if (!concreteSpecialistAssessment || !standardsCompliance) {
    return conflicts;
  }

  // If concrete specialist says "adequate for 50 years" but standards checker says "deviations"
  if (standardsCompliance === 'DEVIATIONS' || standardsCompliance === 'NON_COMPLIANT') {
    if (concreteSpecialistAssessment && concreteSpecialistAssessment.includes('adequate')) {
      conflicts.push({
        id: 'durability_conflict',
        type: 'DURABILITY_CONFLICT',
        description: 'Durability assessment conflict: Concrete Specialist says adequate, Standards Checker reports deviations',
        roles_involved: ['concrete_specialist', 'standards_checker'],
        concrete_assessment: concreteSpecialistAssessment,
        standards_status: standardsCompliance,
        severity: 'HIGH',
        resolution_hint: 'Standards Checker has final authority on compliance. Update specifications per their requirements.',
        confidence: 0.85,
        detected_at: new Date().toISOString()
      });
    }
  }

  return conflicts;
}

/**
 * Detect exposure class disagreements
 * Structural Engineer vs Concrete Specialist
 */
function detectExposureClassConflicts(roleOutputs) {
  const conflicts = [];

  const structuralExposure = roleOutputs.structural_engineer?.exposure_class;
  const concreteExposure = roleOutputs.concrete_specialist?.exposure_class;

  if (!structuralExposure || !concreteExposure) {
    return conflicts;
  }

  if (structuralExposure !== concreteExposure) {
    const exposureHierarchy = ['XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3', 'XF1', 'XF2', 'XF3', 'XF4', 'XA1', 'XA2', 'XA3'];
    const idx1 = exposureHierarchy.indexOf(structuralExposure);
    const idx2 = exposureHierarchy.indexOf(concreteExposure);

    const severity = Math.abs(idx1 - idx2) > 2 ? 'HIGH' : 'MEDIUM';

    conflicts.push({
      id: 'exposure_class_mismatch',
      type: 'EXPOSURE_CLASS_MISMATCH',
      description: `Exposure class disagreement: Structural Engineer says ${structuralExposure}, Concrete Specialist says ${concreteExposure}`,
      roles_involved: ['structural_engineer', 'concrete_specialist'],
      structural_exposure: structuralExposure,
      concrete_exposure: concreteExposure,
      severity,
      resolution_hint: 'Concrete Specialist is durability authority. Use their assessment unless structural analysis reveals additional environmental factors.',
      confidence: 0.80,
      detected_at: new Date().toISOString()
    });
  }

  return conflicts;
}

/**
 * Detect cost viability conflicts
 * Cost Estimator vs Safety Requirements
 */
function detectCostConflicts(roleOutputs) {
  const conflicts = [];

  const costEstimate = roleOutputs.cost_estimator?.total_cost_czk;
  const budgetConstraint = roleOutputs.project_context?.budget_constraint;
  const safetyFactor = roleOutputs.structural_engineer?.safety_factor;

  if (!costEstimate || !budgetConstraint) {
    return conflicts;
  }

  if (costEstimate > budgetConstraint && safetyFactor && safetyFactor >= 1.5) {
    conflicts.push({
      id: 'cost_budget_conflict',
      type: 'COST_BUDGET_CONFLICT',
      description: `Cost exceeds budget: ${costEstimate.toLocaleString()} CZK > ${budgetConstraint.toLocaleString()} CZK budget`,
      roles_involved: ['cost_estimator', 'structural_engineer'],
      estimated_cost: costEstimate,
      budget_limit: budgetConstraint,
      cost_overage_percent: Math.round(((costEstimate - budgetConstraint) / budgetConstraint) * 100),
      severity: 'MEDIUM',
      resolution_hint: 'Safety requirements are non-negotiable. Explore alternative structural systems or materials within safety constraints.',
      confidence: 0.90,
      detected_at: new Date().toISOString()
    });
  }

  return conflicts;
}

/**
 * Detect standards compliance conflicts
 * Standards Checker reports violations
 */
function detectStandardsConflicts(roleOutputs) {
  const conflicts = [];

  const standardsStatus = roleOutputs.standards_checker?.compliance_status;
  const deviations = roleOutputs.standards_checker?.deviations;

  if (standardsStatus === 'NON_COMPLIANT' && deviations && deviations.length > 0) {
    conflicts.push({
      id: 'standards_violation',
      type: 'STANDARDS_VIOLATION',
      description: 'Standards compliance violation detected by Standards Checker',
      roles_involved: ['standards_checker'],
      compliance_status: standardsStatus,
      deviations_count: deviations.length,
      deviations: deviations,
      severity: 'CRITICAL',
      resolution_hint: 'Standards violations must be corrected. Return to appropriate specialist (Structural Engineer, Concrete Specialist) for remediation.',
      confidence: 0.95,
      detected_at: new Date().toISOString()
    });
  }

  return conflicts;
}

/**
 * Detect tech rules validation conflicts
 * Tech Rules Engine reports missing mandatory items
 */
function detectTechRulesConflicts(roleOutputs) {
  const conflicts = [];

  const techRulesOutput = roleOutputs.tech_rules_engine;

  if (techRulesOutput && techRulesOutput.missing_items && techRulesOutput.missing_items.length > 0) {
    const missingCount = techRulesOutput.missing_items.length;
    const severity = missingCount > 5 ? 'HIGH' : 'MEDIUM';

    conflicts.push({
      id: 'missing_mandatory_works',
      type: 'MISSING_MANDATORY_WORKS',
      description: `Tech Rules: ${missingCount} mandatory work item(s) missing from BOQ`,
      roles_involved: ['tech_rules_engine'],
      missing_items: techRulesOutput.missing_items,
      missing_count: missingCount,
      severity,
      resolution_hint: 'Review mandatory items from tech_rules_engine and add missing works to BOQ.',
      confidence: techRulesOutput.confidence || 0.85,
      detected_at: new Date().toISOString()
    });
  }

  return conflicts;
}

/**
 * Categorize conflicts by severity
 * Returns: { CRITICAL: [...], HIGH: [...], MEDIUM: [...], LOW: [...] }
 */
export function categorizeConflictsBySeverity(conflicts) {
  const categorized = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: []
  };

  for (const conflict of conflicts) {
    const severity = conflict.severity || 'LOW';
    if (categorized[severity]) {
      categorized[severity].push(conflict);
    }
  }

  return categorized;
}

/**
 * Generate conflict summary for user
 */
export function generateConflictSummary(conflicts) {
  if (conflicts.length === 0) {
    return {
      summary: 'No conflicts detected',
      count: 0,
      severity: 'OK',
      action_required: false
    };
  }

  const categorized = categorizeConflictsBySeverity(conflicts);

  let maxSeverity = 'LOW';
  if (categorized.CRITICAL.length > 0) {maxSeverity = 'CRITICAL';}
  else if (categorized.HIGH.length > 0) {maxSeverity = 'HIGH';}
  else if (categorized.MEDIUM.length > 0) {maxSeverity = 'MEDIUM';}

  return {
    summary: `${conflicts.length} conflict(s) detected`,
    count: conflicts.length,
    by_severity: {
      critical: categorized.CRITICAL.length,
      high: categorized.HIGH.length,
      medium: categorized.MEDIUM.length,
      low: categorized.LOW.length
    },
    max_severity: maxSeverity,
    action_required: maxSeverity !== 'LOW',
    conflicts: conflicts
  };
}
