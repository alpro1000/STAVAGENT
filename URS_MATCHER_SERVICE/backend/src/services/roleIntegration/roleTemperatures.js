/**
 * Role Temperature Configuration
 * Фаза 3: Define temperature (creativity/determinism) settings for each AI role
 *
 * Temperature ranges:
 * - 0.0: Fully deterministic (facts only, no interpretation)
 * - 0.1-0.3: Factual with minimal interpretation
 * - 0.3-0.5: Balanced between facts and interpretation
 * - 0.5+: Creative thinking and reasoning
 *
 * Each role has temperature ranges for different task contexts
 */

export const roleTemperatures = {
  /**
   * Structural Engineer: Load calculations, concrete class selection
   * Needs balance between factual safety requirements and creative optimization
   */
  structural_engineer: {
    // Conservative role: safety calculations must be deterministic
    load_calculation: 0.2,
    concrete_class: 0.3,
    safety_assessment: 0.2,
    // More creative for optimizations
    optimization: 0.5,
    // Default temperature
    default: 0.3
  },

  /**
   * Concrete Specialist: Material specifications, durability
   * Mostly factual (standards) with some interpretation (durability context)
   */
  concrete_specialist: {
    // Factual: specs from standards
    mix_design: 0.3,
    cement_type: 0.2,
    // Requires interpretation of exposure conditions
    durability: 0.3,
    // Some creativity for special admixtures
    admixtures: 0.4,
    // Default temperature
    default: 0.3
  },

  /**
   * Standards Checker: Compliance verification
   * Highly deterministic - either complies or doesn't
   */
  standards_checker: {
    // Very low: compliance is fact-based
    compliance_check: 0.1,
    // Slightly higher for interpretation of ambiguous standards
    deviation_assessment: 0.3,
    // Default temperature
    default: 0.2
  },

  /**
   * Cost Estimator: Budget calculations and optimization
   * Factual base with market knowledge (interpretation)
   */
  cost_estimator: {
    // Market data interpretation
    pricing: 0.3,
    // Creative for optimization opportunities
    cost_optimization: 0.5,
    // Default temperature
    default: 0.4
  },

  /**
   * Tech Rules Engine: Mandatory work requirements
   * Deterministic - rules are rules
   */
  tech_rules_engine: {
    // Zero creativity: rules application is deterministic
    rule_application: 0.0,
    // Minimal interpretation of rule context
    conflict_detection: 0.1,
    // Default temperature
    default: 0.0
  },

  /**
   * Document Validator: Completeness and consistency checks
   * Mostly factual with some interpretation
   */
  document_validator: {
    // Factual: items are present or not
    completeness_check: 0.1,
    // Some interpretation of what's "consistent"
    consistency_check: 0.2,
    // Creative for suggestions
    improvement_suggestions: 0.4,
    // Default temperature
    default: 0.2
  }
};

/**
 * Get temperature for a specific role and task context
 * @param {string} role - Role name (e.g., 'structural_engineer')
 * @param {string} taskContext - Task context (e.g., 'load_calculation') or 'default'
 * @returns {number} Temperature value (0.0 - 1.0)
 */
export function getRoleTemperature(role, taskContext = 'default') {
  const roleConfig = roleTemperatures[role];

  if (!roleConfig) {
    // Fallback for unknown roles
    return 0.3;
  }

  if (taskContext && roleConfig[taskContext] !== undefined) {
    return roleConfig[taskContext];
  }

  return roleConfig.default || 0.3;
}

/**
 * Get all temperatures for a specific role
 * @param {string} role - Role name
 * @returns {Object} Temperature configuration for the role
 */
export function getRoleConfig(role) {
  return roleTemperatures[role] || {
    default: 0.3
  };
}

/**
 * Export temperatures as a summary for documentation/reference
 */
export function getTemperatureSummary() {
  const summary = {};

  for (const [role, config] of Object.entries(roleTemperatures)) {
    summary[role] = {
      default: config.default,
      tasks: Object.keys(config).filter(k => k !== 'default')
    };
  }

  return summary;
}
