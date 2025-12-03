# Phase 3 Advanced Specification - Full Multi-Role System Integration

**Date:** 2025-12-03
**Status:** In Development
**Version:** 1.0 (Advanced)

---

## Executive Summary

Phase 3 Advanced extends the current Phase 3 MVP (50% complete) to implement comprehensive Multi-Role System integration for URS Matcher Service. This phase transforms URS block analysis from basic LLM classification into an intelligent, conflict-resolving, standards-verifying expert system using 6 specialized AI roles.

### Key Capabilities

- ✅ **Structural Engineer Integration** - Load analysis, concrete class determination, safety verification
- ✅ **Concrete Specialist Integration** - Mix design requirements, durability assessment, material compatibility
- ✅ **Standards Checker Integration** - Comprehensive ČSN/EN compliance verification
- ✅ **Advanced Conflict Resolution** - Automatic detection and resolution of expert disagreements
- ✅ **Tech Rules Integration** - Automatic mandatory work detection and validation
- ✅ **Orchestrator Routing** - Intelligent role sequencing based on task complexity

---

## 1. Current Phase 3 MVP Status

### What's Already Implemented

**File:** `backend/src/services/multiRoleClient.js`

```javascript
✅ askMultiRole() - Generic Multi-Role API client
✅ validateBoqBlock() - Document Validator role integration
✅ verifyUrsCode() - URS code verification with multi-role
✅ resolveUrsConflict() - Conflict resolution between URS candidates
✅ checkMultiRoleAvailability() - Health check
```

**Integration Points:**
- `/api/jobs/block-match` endpoint calls multiRoleClient functions
- Results include `roles_consulted`, `warnings`, `critical_issues`, `confidence`
- Cache mechanism for multi-role responses

### Gaps in Current Implementation

1. **No Structural Engineer Direct Integration** - Cannot ask engineer-specific questions
2. **No Concrete Specialist Direct Integration** - Material specs handled generically
3. **No Standards Checker Direct Integration** - No dedicated compliance verification
4. **No Advanced Conflict Resolution** - Uses simple ranking, no consensus protocol
5. **No Tech Rules Integration** - Missing mandatory work detection
6. **No Orchestrator Pattern** - No intelligent role sequencing
7. **No Specialized Role Prompts** - Using generic multi-role API

---

## 2. Architecture - Phase 3 Advanced

### 2.1 High-Level Flow

```
USER INPUT (BOQ Block Analysis)
  ↓
ORCHESTRATOR (Role Router)
  ├─ Classify complexity (SIMPLE/STANDARD/COMPLEX/CREATIVE)
  ├─ Determine required roles
  └─ Plan execution sequence
  ↓
ROLE EXECUTION (Sequential/Parallel)
  ├─ Document Validator (Data quality check) [FIRST if validation needed]
  │   ↓
  ├─ Structural Engineer (Safety & class determination)
  │   ├─ Load analysis
  │   ├─ Concrete class calculation
  │   └─ Output: Required concrete class, exposure class
  │   ↓
  ├─ Concrete Specialist (Material compatibility)
  │   ├─ Mix design requirements
  │   ├─ Durability assessment
  │   └─ Output: w/c ratio, cement type, special requirements
  │   ↓
  ├─ Standards Checker (Compliance verification) [PARALLEL with above]
  │   ├─ Check ČSN EN 206 requirements
  │   ├─ Verify code compliance
  │   └─ Output: Compliance status, deviations if any
  │   ↓
  ├─ Tech Rules Engine (Mandatory work detection) [PARALLEL]
  │   ├─ Check tech_rules.js rules
  │   ├─ Detect mandatory related items
  │   └─ Output: Required complementary works
  │   ↓
  └─ Cost Estimator (Pricing) [LAST if budget asked]

CONFLICT DETECTION & RESOLUTION
  ├─ Detect disagreements between roles
  ├─ Apply hierarchy (Safety > Code > Durability > Practicality > Cost)
  └─ Output: Resolved decision with rationale

FINAL AGGREGATION
  └─ Unified response with all role inputs, conflicts resolved
```

### 2.2 File Structure - New/Modified

```
backend/src/
├── services/
│   ├── multiRoleClient.js (EXISTING - enhance with direct role calls)
│   ├── roleIntegration/
│   │   ├── orchestrator.js (NEW - role router and sequencer)
│   │   ├── structuralEngineer.js (NEW - direct Structural Engineer integration)
│   │   ├── concreteSpecialist.js (NEW - direct Concrete Specialist integration)
│   │   ├── standardsChecker.js (NEW - direct Standards Checker integration)
│   │   ├── techRulesEngine.js (NEW - mandatory work detection)
│   │   └── conflictResolver.js (NEW - consensus protocol)
│   └── knowledgeBase.js (EXISTING - already has tech_rules references)
│
├── prompts/
│   ├── roles/
│   │   ├── orchestrator.json (NEW - role definition payload)
│   │   ├── structuralEngineer.json (NEW)
│   │   ├── concreteSpecialist.json (NEW)
│   │   ├── standardsChecker.json (NEW)
│   │   ├── costEstimator.json (NEW)
│   │   └── documentValidator.json (NEW)
│   └── universal Matcher.prompt.js (EXISTING)
│
├── utils/
│   └── conflictDetection.js (NEW - identify disagreements)
│
├── api/routes/
│   └── jobs.js (MODIFY - enhance /block-match with Phase 3 Advanced)
│
└── tests/
    ├── roleIntegration.test.js (NEW - 50+ tests)
    ├── orchestrator.test.js (NEW)
    ├── conflictResolver.test.js (NEW)
    └── techRulesEngine.test.js (NEW)
```

---

## 3. Detailed Implementation Plan

### Phase 3A: Infrastructure (Week 1)

#### 3A.1 Create Orchestrator Module

**File:** `backend/src/services/roleIntegration/orchestrator.js`

```javascript
// Orchestrator responsibilities:
// 1. Classify task complexity (based on question keywords, data completeness)
// 2. Select required roles (using decision matrix)
// 3. Determine execution sequence (consider dependencies)
// 4. Invoke roles in sequence/parallel
// 5. Monitor for conflicts
// 6. Aggregate final response

export class Orchestrator {
  async analyzeBlock(boqBlock, projectContext) {
    // 1. Classify task
    const complexity = this.classifyComplexity(boqBlock, projectContext);

    // 2. Select roles
    const requiredRoles = this.selectRoles(complexity, boqBlock);

    // 3. Plan sequence
    const executionPlan = this.planSequence(requiredRoles);

    // 4-5. Execute with conflict monitoring
    const roleOutputs = await this.executeWorkflow(executionPlan, boqBlock, projectContext);

    // 6. Aggregate
    return this.aggregateResults(roleOutputs, complexity);
  }

  classifyComplexity(boqBlock, projectContext) {
    // SIMPLE: Single row, straightforward work
    // STANDARD: Multi-row block, standard works
    // COMPLEX: Multi-row with dependencies, unclear requirements
    // CREATIVE: Optimization needed, unusual requirements
  }

  selectRoles(complexity, boqBlock) {
    // Based on complexity and task type, select roles
    // Example: COMPLEX block analysis needs:
    //   - Document Validator (quality check)
    //   - Structural Engineer (class determination)
    //   - Concrete Specialist (durability)
    //   - Standards Checker (compliance)
  }

  planSequence(roles) {
    // Build dependency graph
    // Return: sequential and parallel execution plan
  }

  async executeWorkflow(plan, boqBlock, projectContext) {
    // Execute roles according to plan
    // Pass context between roles
    // Monitor for conflicts
  }

  aggregateResults(roleOutputs, complexity) {
    // Combine all role outputs
    // Resolve conflicts using hierarchy
    // Return: unified response
  }
}
```

#### 3A.2 Create Role Integration Modules

**File:** `backend/src/services/roleIntegration/structuralEngineer.js`

```javascript
export class StructuralEngineerRole {
  async analyzeBlock(boqBlock, projectContext) {
    const question = `
    Analyze this BOQ block for structural requirements:
    - Block: ${boqBlock.title}
    - Items: ${boqBlock.rows.length}
    - Building: ${projectContext.building_type}
    - Storeys: ${projectContext.storeys}

    Determine:
    1. Loads acting on this block
    2. Required concrete class
    3. Exposure class
    4. Safety concerns

    Output: JSON with required_concrete_class, safety_factor, warnings
    `;

    return await multiRoleClient.askMultiRole(question, {
      roleHint: 'structural_engineer',
      temperature: 0.3,  // Deterministic calculations
      context: {
        boq_block: boqBlock,
        project_context: projectContext
      }
    });
  }
}
```

#### 3A.3 Create Conflict Detection Module

**File:** `backend/src/utils/conflictDetection.js`

```javascript
export function detectConflicts(roleOutputs) {
  // Compare outputs from different roles
  // Identify disagreements on:
  // - Concrete class (Structural vs Concrete Specialist)
  // - Durability (Concrete Specialist vs Standards Checker)
  // - Cost viability (Cost Estimator vs Structural Engineer)

  // Return: Array of conflicts with severity levels

  const conflicts = [];

  // Example: Check if Structural and Concrete specialists agree on class
  if (roleOutputs.structural && roleOutputs.concrete) {
    if (roleOutputs.structural.required_class !== roleOutputs.concrete.recommended_class) {
      conflicts.push({
        type: 'CONCRETE_CLASS_MISMATCH',
        roles: ['structural_engineer', 'concrete_specialist'],
        severity: 'HIGH',
        structural_says: roleOutputs.structural.required_class,
        concrete_says: roleOutputs.concrete.recommended_class
      });
    }
  }

  return conflicts;
}
```

#### 3A.4 Create Conflict Resolution Module

**File:** `backend/src/services/roleIntegration/conflictResolver.js`

```javascript
export class ConflictResolver {
  async resolveConflict(conflict, roleOutputs, projectContext) {
    // Apply hierarchy: Safety > Code > Durability > Practicality > Cost

    if (conflict.type === 'CONCRETE_CLASS_MISMATCH') {
      // Select higher/stricter requirement
      const selected = this.selectStricterClass(
        conflict.structural_says,
        conflict.concrete_says
      );

      return {
        decision: selected,
        reasoning: `Both load (${conflict.structural_says}) and durability (${conflict.concrete_says}) requirements must be met. Higher class ${selected} satisfies both.`,
        authority: 'hierarchy_application',
        confidence: 0.99
      };
    }

    // ... other conflict types
  }

  selectStricterClass(class1, class2) {
    // C25/30 < C30/37 < C35/45 < C40/50 < C50/60
    const order = ['C20/25', 'C25/30', 'C30/37', 'C35/45', 'C40/50', 'C50/60'];
    const idx1 = order.indexOf(class1);
    const idx2 = order.indexOf(class2);
    return order[Math.max(idx1, idx2)];
  }
}
```

---

### Phase 3B: Role Integration (Week 2)

#### 3B.1 Structural Engineer Integration

**Responsibilities:**
- Load analysis
- Concrete class determination (based on structural requirements)
- Safety factor verification
- Exposure class assessment

**Integration Points:**
- `/api/jobs/block-match` → calls `structuralEngineer.analyzeBlock()`
- Input: BOQ block + project context
- Output: `{required_concrete_class, exposure_class, safety_factor, loads_analysis, warnings}`

#### 3B.2 Concrete Specialist Integration

**Responsibilities:**
- Mix design requirements
- Durability assessment (based on exposure)
- Material compatibility
- Special requirements (air content, frost resistance, etc.)

**Integration Points:**
- Receives output from Structural Engineer
- Input: Concrete class + exposure class
- Output: `{w_c_ratio, cement_type, aggregates, admixtures, durability_assessment, recommendations}`

#### 3B.3 Standards Checker Integration

**Responsibilities:**
- Comprehensive ČSN/EN compliance verification
- Identify code deviations
- Verify minimum requirements per standards
- Cross-standard compatibility

**Integration Points:**
- Parallel execution with above roles
- Input: All decisions made so far
- Output: `{compliance_status, deviations, standards_applied, warnings}`

---

### Phase 3C: Tech Rules Engine (Week 2)

**File:** `backend/src/services/roleIntegration/techRulesEngine.js`

```javascript
export class TechRulesEngine {
  constructor() {
    this.rules = this.loadTechRules();
  }

  async validateBlock(boqBlock, matchedUrsCodes, projectContext) {
    // For each matched URS code, check mandatory related items
    const mandatoryItems = [];

    for (const ursCode of matchedUrsCodes) {
      const relatedRules = this.rules.filter(r => r.trigger_code === ursCode);

      for (const rule of relatedRules) {
        if (this.shouldApply(rule, projectContext)) {
          mandatoryItems.push({
            urs_code: rule.required_code,
            reason: rule.reason_cs,
            type: rule.type,  // 'MANDATORY' | 'CONDITIONAL' | 'RECOMMENDED'
            condition: rule.condition,
            source: 'tech_rules'
          });
        }
      }
    }

    return {
      mandatory_items: mandatoryItems,
      completeness_assessment: this.assessCompleteness(boqBlock, mandatoryItems),
      warnings: this.generateWarnings(boqBlock, mandatoryItems)
    };
  }

  loadTechRules() {
    // Load from tech_rules.js or database
    // Format:
    // {
    //   trigger_code: "01.02.03",  // If this is matched
    //   required_code: "01.02.04", // Must also have this
    //   type: "MANDATORY",
    //   condition: {building_type: "residential"}, // Only if condition met
    //   reason_cs: "Formwork required for all concrete elements"
    // }

    return [
      {
        trigger_code: '272325',  // Concrete pouring
        required_code: '271305',  // Formwork
        type: 'MANDATORY',
        reason_cs: 'Beton vyžaduje bednění'
      },
      // ... many more rules
    ];
  }

  shouldApply(rule, projectContext) {
    if (!rule.condition) return true;

    // Check all conditions
    for (const [key, value] of Object.entries(rule.condition)) {
      if (projectContext[key] !== value) return false;
    }

    return true;
  }

  assessCompleteness(boqBlock, mandatoryItems) {
    // Calculate completeness score based on tech_rules
    const foundItems = new Set(boqBlock.rows.map(r => r.urs_code));
    const requiredItems = new Set(mandatoryItems.map(m => m.urs_code));

    const missing = [...requiredItems].filter(code => !foundItems.has(code));
    const coverage = (requiredItems.size - missing.size) / requiredItems.size * 100;

    return {
      score: Math.round(coverage),
      missing_items: missing,
      required_count: requiredItems.size
    };
  }
}
```

---

### Phase 3D: Advanced Orchestration Features (Week 3)

#### 3D.1 Temperature Settings Per Role & Task

```javascript
const temperatureSettings = {
  'structural_engineer': {
    'load_calculation': 0.2,      // Deterministic
    'concrete_class': 0.3,         // Standard application
    'safety_assessment': 0.2,      // Critical - low variance
    'optimization': 0.5            // Suggesting alternatives
  },
  'concrete_specialist': {
    'mix_design': 0.3,
    'durability': 0.3,
    'compatibility': 0.2,
    'troubleshooting': 0.5
  },
  'standards_checker': {
    'compliance_check': 0.1,       // Very low - factual
    'interpretation': 0.3,
    'conflicts': 0.5               // Resolving disagreements
  }
};
```

#### 3D.2 Context Passing Between Roles

```javascript
// After Structural Engineer provides output:
const seOutput = await structuralEngineer.analyzeBlock(...);

// Pass to Concrete Specialist with context:
const csOutput = await concreteSpecialist.analyzeBlock(boqBlock, {
  ...projectContext,
  required_concrete_class: seOutput.required_class,
  exposure_class: seOutput.exposure_class,
  loads: seOutput.loads_analysis,
  safety_factor: seOutput.safety_factor
});
```

#### 3D.3 Parallel Execution Strategy

```javascript
// Some roles can run in parallel (no dependencies):
const [seOutput, scOutput] = await Promise.all([
  structuralEngineer.analyzeBlock(boqBlock, projectContext),
  standardsChecker.checkCompliance(boqBlock, projectContext)
]);

// Then pass both to Tech Rules:
const trOutput = await techRulesEngine.validateBlock(
  boqBlock,
  seOutput.urs_codes,
  projectContext
);
```

---

## 4. Implementation Schedule

### Week 1: Infrastructure
- [ ] Create orchestrator.js with classification and sequencing
- [ ] Create role integration module templates
- [ ] Create conflict detection utilities
- [ ] Create conflict resolution logic
- [ ] Unit tests for each module

### Week 2: Role Integration
- [ ] Implement Structural Engineer integration
- [ ] Implement Concrete Specialist integration
- [ ] Implement Standards Checker integration
- [ ] Create Tech Rules Engine
- [ ] Integration tests (50+ test cases)

### Week 3: Advanced Features
- [ ] Implement advanced conflict resolution scenarios
- [ ] Add temperature optimization per role
- [ ] Implement context passing between roles
- [ ] Add parallel execution strategy
- [ ] Edge case handling (circular deps, missing data)

### Week 4: Testing & Hardening
- [ ] End-to-end tests (10+ complex scenarios)
- [ ] Performance benchmarking
- [ ] Load testing
- [ ] Security validation
- [ ] Production deployment

---

## 5. Success Criteria

### Functional Requirements
- ✅ All 6 specialist roles can be invoked with proper context
- ✅ Conflicts detected and resolved automatically
- ✅ Tech rules validation works with >90% accuracy
- ✅ Orchestrator selects optimal role sequence
- ✅ Context properly passed between roles
- ✅ Temperature settings per role/task

### Quality Metrics
- ✅ 50+ unit tests, >95% pass rate
- ✅ 100+ integration tests
- ✅ Test coverage: >85% for roleIntegration/*
- ✅ Error handling for all edge cases
- ✅ Graceful degradation if Multi-Role API unavailable

### Performance Targets
- ✅ Block analysis: < 30 seconds (5 roles + conflict resolution)
- ✅ Single role invocation: < 6 seconds
- ✅ Parallel role execution: 2-3x speedup

### Production Readiness
- ✅ All Qodo compliance checks pass
- ✅ Security audit completed
- ✅ Load testing (100+ concurrent requests)
- ✅ Staging deployment successful
- ✅ Documentation complete

---

## 6. Risk Mitigation

### Risk: Multi-Role API Unavailability
**Mitigation:** Graceful fallback to Phase 3 MVP (multiRoleClient functions) with reduced capability

### Risk: Role Conflicts Not Resolved
**Mitigation:** Log unresolved conflicts, alert user, provide conservative recommendation

### Risk: Tech Rules Incomplete
**Mitigation:** Start with 20-30 high-priority rules, expand iteratively based on feedback

### Risk: Performance Degradation
**Mitigation:** Implement aggressive caching, parallel execution, response size limits

---

## 7. Deliverables

1. **Code:** All Phase 3 Advanced modules (900+ lines)
2. **Tests:** 150+ test cases covering all scenarios
3. **Documentation:** Architecture guide, role specifications, integration examples
4. **Migration Guide:** How to upgrade from Phase 3 MVP
5. **Production Deployment:** Staged rollout with feature flags

---

**Next Step:** Begin Week 1 implementation with orchestrator.js
