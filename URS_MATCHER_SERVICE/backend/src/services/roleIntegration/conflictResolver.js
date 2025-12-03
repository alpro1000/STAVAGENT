/**
 * Conflict Resolution Engine
 * Phase 3 Advanced: Resolve disagreements between specialist roles
 *
 * Hierarchy: Safety > Code > Durability > Practicality > Cost
 */

import { logger } from '../../utils/logger.js';

export class ConflictResolver {
  constructor() {
    this.hierarchy = [
      { level: 1, name: 'SAFETY', priority: 'non-negotiable' },
      { level: 2, name: 'CODE_COMPLIANCE', priority: 'mandatory' },
      { level: 3, name: 'DURABILITY', priority: 'essential' },
      { level: 4, name: 'PRACTICALITY', priority: 'important' },
      { level: 5, name: 'COST', priority: 'optimized within above' }
    ];

    this.concreteClassOrder = ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C50/60'];
    this.exposureClassOrder = ['XC1', 'XC2', 'XC3', 'XC4', 'XD1', 'XD2', 'XD3', 'XS1', 'XS2', 'XS3', 'XF1', 'XF2', 'XF3', 'XF4', 'XA1', 'XA2', 'XA3'];
  }

  /**
   * Resolve all conflicts in a single operation
   * @param {Array} conflicts - Array of detected conflicts
   * @param {Object} roleOutputs - All role outputs
   * @param {Object} projectContext - Project context information
   * @returns {Array} Array of conflict resolutions
   */
  async resolveAllConflicts(conflicts, roleOutputs, projectContext) {
    const resolutions = [];

    logger.info(`[CONFLICT-RESOLVER] Resolving ${conflicts.length} conflicts`);

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(conflict, roleOutputs, projectContext);
        resolutions.push(resolution);
        logger.info(`[CONFLICT-RESOLVER] Resolved: ${conflict.type} → ${resolution.decision}`);
      } catch (error) {
        logger.error(`[CONFLICT-RESOLVER] Failed to resolve ${conflict.type}: ${error.message}`);
        resolutions.push({
          conflict_id: conflict.id,
          conflict_type: conflict.type,
          status: 'unresolved',
          error: error.message,
          requires_manual_review: true
        });
      }
    }

    return resolutions;
  }

  /**
   * Resolve a single conflict
   */
  async resolveConflict(conflict, roleOutputs, projectContext) {
    logger.info(`[CONFLICT-RESOLVER] Resolving: ${conflict.type}`);

    switch (conflict.type) {
      case 'CONCRETE_CLASS_MISMATCH':
        return this.resolveConcreteClassMismatch(conflict, roleOutputs);

      case 'EXPOSURE_CLASS_MISMATCH':
        return this.resolveExposureClassMismatch(conflict, roleOutputs);

      case 'DURABILITY_CONFLICT':
        return this.resolveDurabilityConflict(conflict, roleOutputs);

      case 'COST_BUDGET_CONFLICT':
        return this.resolveCostConflict(conflict, roleOutputs);

      case 'STANDARDS_VIOLATION':
        return this.resolveStandardsViolation(conflict, roleOutputs);

      case 'MISSING_MANDATORY_WORKS':
        return this.resolveMissingWorks(conflict, roleOutputs);

      default:
        return {
          conflict_id: conflict.id,
          conflict_type: conflict.type,
          status: 'unknown_conflict_type',
          requires_manual_review: true
        };
    }
  }

  /**
   * Resolve: Structural Engineer says C25/30, Concrete Specialist says C30/37
   *
   * Rule: "Stricter Requirement Wins"
   * - Load requirement: C25/30 (from structural calculation)
   * - Durability requirement: C30/37 (from environment)
   * - Decision: C30/37 (higher class satisfies both)
   *
   * Authority: Both are correct in their domains
   * - Structural Engineer: correct on load capacity
   * - Concrete Specialist: correct on durability needs
   * - Resolution: max(load_requirement, durability_requirement)
   */
  resolveConcreteClassMismatch(conflict, roleOutputs) {
    const idx1 = this.concreteClassOrder.indexOf(conflict.structural_says);
    const idx2 = this.concreteClassOrder.indexOf(conflict.concrete_says);

    if (idx1 === -1 || idx2 === -1) {
      logger.warn(`[CONFLICT-RESOLVER] Invalid concrete class: ${conflict.structural_says} or ${conflict.concrete_says}`);
      return {
        conflict_id: conflict.id,
        conflict_type: 'CONCRETE_CLASS_MISMATCH',
        status: 'unresolved',
        error: 'Invalid concrete class values',
        requires_manual_review: true
      };
    }

    const selectedIndex = Math.max(idx1, idx2);
    const selectedClass = this.concreteClassOrder[selectedIndex];

    return {
      conflict_id: conflict.id,
      conflict_type: 'CONCRETE_CLASS_MISMATCH',
      status: 'resolved',
      decision: selectedClass,
      reasoning: `Both load (${conflict.structural_says}) and durability (${conflict.concrete_says}) requirements must be met. Higher class ${selectedClass} satisfies both requirements per hierarchy: SAFETY > CODE > DURABILITY.`,
      authority_applied: ['structural_engineer', 'concrete_specialist'],
      hierarchy_level: 3,  // DURABILITY
      confidence: 0.99,
      human_review_required: false
    };
  }

  /**
   * Resolve: Structural Engineer says XC3, Concrete Specialist says XD2
   *
   * Rule: "More Aggressive Exposure Wins"
   * - XD2 (chloride penetration) is more aggressive than XC3 (carbonation)
   * - Decision: Use XD2 + apply its stricter requirements
   */
  resolveExposureClassMismatch(conflict, roleOutputs) {
    const idx1 = this.exposureClassOrder.indexOf(conflict.structural_exposure);
    const idx2 = this.exposureClassOrder.indexOf(conflict.concrete_exposure);

    if (idx1 === -1 || idx2 === -1) {
      logger.warn(`[CONFLICT-RESOLVER] Invalid exposure class`);
      return {
        conflict_id: conflict.id,
        conflict_type: 'EXPOSURE_CLASS_MISMATCH',
        status: 'unresolved',
        error: 'Invalid exposure class values',
        requires_manual_review: true
      };
    }

    const selectedIndex = Math.max(idx1, idx2);
    const selectedExposure = this.exposureClassOrder[selectedIndex];

    return {
      conflict_id: conflict.id,
      conflict_type: 'EXPOSURE_CLASS_MISMATCH',
      status: 'resolved',
      decision: selectedExposure,
      reasoning: `Concrete Specialist is the durability authority. More aggressive exposure class ${selectedExposure} selected (vs ${conflict.structural_exposure}) to ensure long-term performance. Stricter durability requirements apply.`,
      authority_applied: ['concrete_specialist'],
      hierarchy_level: 3,  // DURABILITY
      confidence: 0.90,
      human_review_required: false
    };
  }

  /**
   * Resolve: Concrete Specialist says adequate, Standards Checker says violations
   *
   * Rule: "Standards Checker Has Final Authority on Compliance"
   * - Standards Checker detects code deviations
   * - Decision: Request remediation, update specifications per code
   */
  resolveDurabilityConflict(conflict, roleOutputs) {
    const standardsDeviations = roleOutputs.standards_checker?.deviations || [];

    return {
      conflict_id: conflict.id,
      conflict_type: 'DURABILITY_CONFLICT',
      status: 'resolved',
      decision: 'defer_to_standards_checker',
      reasoning: `Standards Checker is the final authority on code compliance. Their deviations report (${standardsDeviations.length} issues) takes precedence. Concrete Specialist should update specifications to meet all code requirements.`,
      authority_applied: ['standards_checker'],
      action_required: 'Update specifications per Standards Checker deviations',
      hierarchy_level: 2,  // CODE_COMPLIANCE
      confidence: 0.95,
      human_review_required: false
    };
  }

  /**
   * Resolve: Cost Estimator says too expensive, Structural Engineer says required for safety
   *
   * Rule: "Safety Overrides Cost"
   * - Priority: SAFETY > COST
   * - Decision: Maintain safety requirements, explore cost optimization elsewhere
   */
  resolveCostConflict(conflict, roleOutputs) {
    const safetyFactor = roleOutputs.structural_engineer?.safety_factor;
    const costOverage = conflict.cost_overage_percent;

    return {
      conflict_id: conflict.id,
      conflict_type: 'COST_BUDGET_CONFLICT',
      status: 'resolved',
      decision: 'maintain_safety_requirements',
      reasoning: `Safety is non-negotiable (hierarchy level 1). Structural requirements are mandatory regardless of cost. Estimated cost overages of ${costOverage}% must be accepted to ensure safety (factor: ${safetyFactor}).`,
      authority_applied: ['structural_engineer', 'cost_estimator'],
      recommendations: [
        'Explore alternative structural systems within safety constraints',
        'Consider material substitutions per cost optimization',
        'Investigate value engineering opportunities',
        'Review design for unnecessary complexity'
      ],
      hierarchy_level: 1,  // SAFETY
      confidence: 1.0,
      human_review_required: false
    };
  }

  /**
   * Resolve: Standards Checker reports code violations
   *
   * Rule: "Code Violations Must Be Corrected"
   * - Standards Checker is final authority
   * - Decision: Remediate all deviations
   */
  resolveStandardsViolation(conflict, roleOutputs) {
    const deviations = conflict.deviations || [];

    const remediationPlan = deviations.map((deviation, idx) => ({
      deviation_id: idx + 1,
      issue: deviation,
      responsible_role: this.determineResponsibleRole(deviation),
      action: `Correct per ČSN/EN standards`
    }));

    return {
      conflict_id: conflict.id,
      conflict_type: 'STANDARDS_VIOLATION',
      status: 'resolved',
      decision: 'remediate_violations',
      reasoning: `Standards violations are non-negotiable (hierarchy level 2: CODE_COMPLIANCE). All deviations must be corrected before design can be approved.`,
      authority_applied: ['standards_checker'],
      deviations_count: deviations.length,
      remediation_plan: remediationPlan,
      hierarchy_level: 2,  // CODE_COMPLIANCE
      confidence: 0.99,
      human_review_required: true,  // Requires specialist review to implement fixes
      next_step: 'Return to appropriate specialists (Structural Engineer, Concrete Specialist) to correct deviations'
    };
  }

  /**
   * Resolve: Tech Rules Engine reports missing mandatory works
   *
   * Rule: "Mandatory Works Must Be Included"
   * - Tech rules are based on construction best practices
   * - Decision: Add missing items to BOQ
   */
  resolveMissingWorks(conflict, roleOutputs) {
    const missingItems = conflict.missing_items || [];

    return {
      conflict_id: conflict.id,
      conflict_type: 'MISSING_MANDATORY_WORKS',
      status: 'resolved',
      decision: 'add_missing_items',
      reasoning: `Tech rules identify mandatory work items based on construction best practices and standards compliance. Missing ${missingItems.length} item(s) should be added to BOQ to ensure complete and buildable project.`,
      authority_applied: ['tech_rules_engine'],
      missing_items: missingItems,
      action_required: `Add ${missingItems.length} missing work item(s) to BOQ`,
      hierarchy_level: 3,  // DURABILITY (completeness)
      confidence: conflict.confidence || 0.85,
      human_review_required: false,
      next_step: 'Update BOQ with missing items and re-run analysis'
    };
  }

  /**
   * Determine which specialist role should handle a specific deviation
   */
  determineResponsibleRole(deviation) {
    const deviationText = deviation.toLowerCase();

    if (deviationText.includes('concrete') || deviationText.includes('class')) {
      return 'structural_engineer';
    } else if (deviationText.includes('material') || deviationText.includes('cement')) {
      return 'concrete_specialist';
    } else if (deviationText.includes('load') || deviationText.includes('safety')) {
      return 'structural_engineer';
    } else if (deviationText.includes('exposure') || deviationText.includes('durability')) {
      return 'concrete_specialist';
    } else {
      return 'standards_checker';
    }
  }

  /**
   * Generate human-readable conflict resolution report
   */
  generateResolutionReport(conflicts, resolutions) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_conflicts: conflicts.length,
        resolved: resolutions.filter(r => r.status === 'resolved').length,
        unresolved: resolutions.filter(r => r.status === 'unresolved').length,
        require_review: resolutions.filter(r => r.human_review_required).length
      },
      resolution_details: resolutions,
      recommendations: this.generateRecommendations(resolutions),
      next_steps: this.generateNextSteps(resolutions)
    };

    return report;
  }

  /**
   * Generate recommendations based on resolutions
   */
  generateRecommendations(resolutions) {
    const recommendations = [];

    for (const resolution of resolutions) {
      if (resolution.recommendations) {
        recommendations.push(...resolution.recommendations);
      }
    }

    return [...new Set(recommendations)];  // Remove duplicates
  }

  /**
   * Generate next steps for user
   */
  generateNextSteps(resolutions) {
    const steps = [];
    const unresolved = resolutions.filter(r => r.status === 'unresolved');
    const needsReview = resolutions.filter(r => r.human_review_required);

    if (unresolved.length > 0) {
      steps.push({
        priority: 1,
        action: `Manual review required for ${unresolved.length} unresolved conflict(s)`,
        details: unresolved.map(u => u.conflict_type)
      });
    }

    if (needsReview.length > 0) {
      steps.push({
        priority: 2,
        action: `Specialist review required for ${needsReview.length} resolution(s)`,
        details: needsReview.map(r => ({
          conflict: r.conflict_type,
          responsible: r.authority_applied
        }))
      });
    }

    if (resolutions.some(r => r.conflict_type === 'MISSING_MANDATORY_WORKS')) {
      steps.push({
        priority: 3,
        action: 'Update BOQ with missing mandatory work items',
        details: 'Re-run analysis after BOQ update'
      });
    }

    return steps;
  }
}
