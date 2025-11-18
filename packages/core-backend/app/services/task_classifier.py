"""
Task Classifier for Multi-Role AI System

Analyzes user questions and determines:
- Task complexity (Simple/Standard/Complex/Creative)
- Required specialist roles
- Temperature settings for each role
- Whether to trigger RFI (Request For Information)
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
import re


class TaskComplexity(str, Enum):
    """Task complexity levels"""
    SIMPLE = "simple"           # Single lookup, straightforward (temp 0.2-0.3)
    STANDARD = "standard"       # Typical engineering task (temp 0.3-0.5)
    COMPLEX = "complex"         # Multi-step with dependencies (temp 0.4-0.6)
    CREATIVE = "creative"       # Novel problem, no standard approach (temp 0.6-0.8)


class Domain(str, Enum):
    """Problem domains"""
    MATERIALS = "materials"             # Concrete, pipes, aggregates
    CALCULATION = "calculation"         # Volumes, costs, structural
    DESIGN = "design"                   # Specifications, drawings
    VALIDATION = "validation"           # Check existing project
    STANDARDS = "standards"             # Compliance, code lookup
    CODES = "codes"                     # OTSKP/ÚRS classification


class Role(str, Enum):
    """Available specialist roles"""
    DOCUMENT_VALIDATOR = "document_validator"
    STRUCTURAL_ENGINEER = "structural_engineer"
    CONCRETE_SPECIALIST = "concrete_specialist"
    COST_ESTIMATOR = "cost_estimator"
    STANDARDS_CHECKER = "standards_checker"


@dataclass
class RoleInvocation:
    """Configuration for invoking a specific role"""
    role: Role
    temperature: float
    priority: int  # Lower = earlier in sequence (0 = first)
    context: Optional[str] = None  # Additional context to pass to role

    def __post_init__(self):
        # Validate temperature
        if not 0.0 <= self.temperature <= 1.0:
            raise ValueError(f"Temperature must be 0.0-1.0, got {self.temperature}")


@dataclass
class TaskClassification:
    """Result of task classification"""
    complexity: TaskComplexity
    domains: List[Domain]
    roles: List[RoleInvocation]
    requires_rfi: bool = False
    missing_data: List[str] = field(default_factory=list)
    confidence: float = 1.0  # 0.0-1.0, how confident in classification

    def get_roles_ordered(self) -> List[RoleInvocation]:
        """Get roles ordered by priority"""
        return sorted(self.roles, key=lambda r: r.priority)


class TaskClassifier:
    """
    Classifies user tasks and determines routing to specialist roles
    """

    # Keywords for domain detection
    DOMAIN_KEYWORDS = {
        Domain.MATERIALS: [
            "concrete", "beton", "pipe", "труба", "sdr", "aggregate", "cement",
            "mix", "material", "materiál", "exposure", "expozice", "xc", "xd", "xf",
        ],
        Domain.CALCULATION: [
            "calculate", "vypočítat", "volume", "objem", "area", "plocha",
            "cost", "cena", "price", "budget", "rozpočet", "quantity", "množství",
            "how much", "kolik", "load", "zatížení", "safety factor",
        ],
        Domain.DESIGN: [
            "design", "návrh", "specify", "specifikace", "dimension", "rozměr",
            "thickness", "tloušťka", "foundation", "základ", "slab", "deska",
        ],
        Domain.VALIDATION: [
            "check", "kontrola", "validate", "validovat", "verify", "ověřit",
            "error", "chyba", "find", "najít", "review", "přehled", "audit",
            "inconsist", "nekonzisten", "missing", "chybějící",
        ],
        Domain.STANDARDS: [
            "standard", "norma", "čsn", "en", "eurocode", "comply", "splňovat",
            "requirement", "požadavek", "code", "předpis", "snip",
        ],
        Domain.CODES: [
            "otskp", "úrs", "rts", "code", "kód", "classification", "třídění",
            "category", "kategorie",
        ],
    }

    # Keywords for complexity detection
    COMPLEXITY_KEYWORDS = {
        TaskComplexity.SIMPLE: [
            "what is", "co je", "find", "najít", "show", "ukázat",
            "lookup", "vyhledat", "code for", "kód pro", "what's", "jaký je",
        ],
        TaskComplexity.COMPLEX: [
            "entire project", "celý projekt", "all errors", "všechny chyby",
            "comprehensive", "komplexní", "full analysis", "úplná analýza",
            "check.*errors", "find.*errors", "validate.*design",
            "multiple", "více", "analyze entire", "analyzovat celý",
        ],
        TaskComplexity.CREATIVE: [
            "optimize", "optimalizovat", "alternative", "alternativa",
            "improve", "zlepšit", "redesign", "přeprojektovat", "innovate",
        ],
    }

    # Keywords for role detection
    ROLE_KEYWORDS = {
        Role.DOCUMENT_VALIDATOR: [
            "error", "chyba", "inconsist", "nekonzisten", "missing", "chybějící",
            "mismatch", "nesoulad", "contradiction", "rozpor", "typo",
        ],
        Role.STRUCTURAL_ENGINEER: [
            "strength", "pevnost", "capacity", "únosnost", "load", "zatížení",
            "safety", "bezpečnost", "adequate", "dostatečný", "c25", "c30", "c35",
            "concrete class", "třída betonu", "foundation", "základ",
        ],
        Role.CONCRETE_SPECIALIST: [
            "mix", "směs", "exposure", "expozice", "durability", "trvanlivost",
            "xc", "xd", "xf", "xa", "xs", "xm", "pipe", "труба", "sdr",
            "wall thickness", "tloušťka stěny", "frost", "mráz",
        ],
        Role.COST_ESTIMATOR: [
            "cost", "cena", "price", "cena", "budget", "rozpočet",
            "otskp", "úrs", "how much", "kolik", "total", "celkem",
        ],
        Role.STANDARDS_CHECKER: [
            "standard", "norma", "čsn", "en", "eurocode", "comply", "splňovat",
            "code", "předpis", "legal", "právní", "required", "požadovaný",
        ],
    }

    # Critical data patterns for RFI detection
    CRITICAL_DATA_PATTERNS = {
        "dimensions": r"(?:length|width|height|thickness|délka|šířka|výška|tloušťka)",
        "concrete_class": r"(?:c\d{2}/\d{2}|concrete class|třída betonu)",
        "loads": r"(?:load|zatížení|stories|podlaží|weight|hmotnost)",
        "exposure": r"(?:exposure|expozice|environment|prostředí|xc|xd|xf)",
    }

    def __init__(self):
        """Initialize task classifier"""
        pass

    def classify(self, user_question: str, context: Optional[Dict[str, Any]] = None) -> TaskClassification:
        """
        Classify user question and determine routing

        Args:
            user_question: The user's question/request
            context: Optional context (e.g., uploaded files, previous conversation)

        Returns:
            TaskClassification with roles, complexity, etc.
        """
        question_lower = user_question.lower()

        # Detect domains
        domains = self._detect_domains(question_lower)

        # Detect complexity
        complexity = self._detect_complexity(question_lower, domains)

        # Detect required roles
        roles = self._detect_roles(question_lower, domains, complexity, context)

        # Check for missing critical data (RFI)
        requires_rfi, missing_data = self._check_missing_data(question_lower, domains, context)

        # Calculate confidence
        confidence = self._calculate_confidence(domains, roles)

        return TaskClassification(
            complexity=complexity,
            domains=domains,
            roles=roles,
            requires_rfi=requires_rfi,
            missing_data=missing_data,
            confidence=confidence,
        )

    def _detect_domains(self, question: str) -> List[Domain]:
        """Detect problem domains from question"""
        detected_domains = []

        for domain, keywords in self.DOMAIN_KEYWORDS.items():
            if any(keyword in question for keyword in keywords):
                detected_domains.append(domain)

        # Default to CALCULATION if nothing detected
        if not detected_domains:
            detected_domains.append(Domain.CALCULATION)

        return detected_domains

    def _detect_complexity(self, question: str, domains: List[Domain]) -> TaskComplexity:
        """Detect task complexity"""

        # Check for creative keywords FIRST (highest priority)
        if any(keyword in question for keyword in self.COMPLEXITY_KEYWORDS.get(TaskComplexity.CREATIVE, [])):
            return TaskComplexity.CREATIVE

        # Check for complex keywords with regex support
        complex_keywords = self.COMPLEXITY_KEYWORDS.get(TaskComplexity.COMPLEX, [])
        for keyword in complex_keywords:
            if re.search(keyword, question, re.IGNORECASE):
                return TaskComplexity.COMPLEX

        # Check for validation patterns (errors, compliance, check design)
        validation_patterns = [
            r"\b(check|validate|verify).*\b(error|compliance|design|project)",
            r"\b(find|najít).*\b(error|chyba)",
            r"\berror.*\b(compliance|standards)",
        ]
        for pattern in validation_patterns:
            if re.search(pattern, question, re.IGNORECASE):
                return TaskComplexity.COMPLEX

        # Check for explicit simple keywords
        if any(keyword in question for keyword in self.COMPLEXITY_KEYWORDS.get(TaskComplexity.SIMPLE, [])):
            # Confirm it's actually simple (not just using "what is" in complex question)
            if len(question.split()) < 15:
                return TaskComplexity.SIMPLE

        # Heuristics based on domains and question structure

        # Very short question (1-3 words) = SIMPLE
        if len(question.split()) <= 3:
            return TaskComplexity.SIMPLE

        # If calculation with all data provided (numbers present), it's STANDARD
        # Do this check BEFORE complex domain check
        if Domain.CALCULATION in domains:
            if re.search(r"\d+\.?\d*\s*(?:m|mm|cm|m³|m²|×)", question):
                # But if it also has validation keywords, it's COMPLEX
                if not Domain.VALIDATION in domains:
                    return TaskComplexity.STANDARD

        # Simple: Single or two domains, short question, lookup pattern
        if len(domains) <= 2 and len(question.split()) < 12:
            if any(word in question for word in ["what", "co", "find", "najít", "code", "kód", "what's", "jaký"]):
                return TaskComplexity.SIMPLE

        # Complex: Multiple domains (4+) or validation domain
        # Changed from 3+ to 4+ to allow standard calculations with materials+calculation+design
        if len(domains) >= 4 or Domain.VALIDATION in domains:
            return TaskComplexity.COMPLEX

        # Creative: Design or optimization words (backup check)
        if any(word in question for word in ["optimize", "optimalizovat", "alternative", "alternativa", "improve", "zlepšit"]):
            return TaskComplexity.CREATIVE

        # Default: STANDARD
        return TaskComplexity.STANDARD

    def _detect_roles(
        self,
        question: str,
        domains: List[Domain],
        complexity: TaskComplexity,
        context: Optional[Dict[str, Any]] = None
    ) -> List[RoleInvocation]:
        """Detect required roles and assign priorities"""

        roles: List[RoleInvocation] = []

        # RULE 1: If validation domain, ALWAYS start with Document Validator
        if Domain.VALIDATION in domains:
            roles.append(RoleInvocation(
                role=Role.DOCUMENT_VALIDATOR,
                temperature=self._get_temperature_for_role(Role.DOCUMENT_VALIDATOR, complexity),
                priority=0,  # FIRST
                context="First line of defense - catch errors before specialists"
            ))

        # RULE 2: Detect roles based on keywords
        role_scores: Dict[Role, int] = {role: 0 for role in Role}

        for role, keywords in self.ROLE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in question:
                    role_scores[role] += 1

        # RULE 3: Domain-based role selection
        if Domain.MATERIALS in domains:
            role_scores[Role.CONCRETE_SPECIALIST] += 2

        if Domain.CALCULATION in domains:
            role_scores[Role.STRUCTURAL_ENGINEER] += 1
            role_scores[Role.COST_ESTIMATOR] += 1

        if Domain.STANDARDS in domains:
            role_scores[Role.STANDARDS_CHECKER] += 2

        if Domain.CODES in domains:
            role_scores[Role.COST_ESTIMATOR] += 3  # OTSKP expert

        # RULE 3b: Adequacy questions need Structural Engineer + Standards Checker
        if any(word in question for word in ["adequate", "dostatečný", "sufficient", "enough"]):
            role_scores[Role.STRUCTURAL_ENGINEER] += 2
            role_scores[Role.STANDARDS_CHECKER] += 1

        # RULE 4: Add roles with scores > 0 (excluding already added Document Validator and Standards Checker)
        # We'll add Standards Checker separately at the end for complex tasks
        current_priority = 1 if Role.DOCUMENT_VALIDATOR in [r.role for r in roles] else 0

        # For complex/creative tasks, reserve Standards Checker for the end
        skip_standards_for_later = complexity in [TaskComplexity.COMPLEX, TaskComplexity.CREATIVE]

        for role, score in sorted(role_scores.items(), key=lambda x: -x[1]):
            if score > 0 and role not in [r.role for r in roles]:
                # Skip Standards Checker if it's a complex task (will add it last)
                if skip_standards_for_later and role == Role.STANDARDS_CHECKER:
                    continue

                roles.append(RoleInvocation(
                    role=role,
                    temperature=self._get_temperature_for_role(role, complexity),
                    priority=current_priority,
                    context=None
                ))
                current_priority += 1

        # RULE 5: If complex task, add Standards Checker at the END (final verification)
        if complexity in [TaskComplexity.COMPLEX, TaskComplexity.CREATIVE]:
            if Role.STANDARDS_CHECKER not in [r.role for r in roles]:
                roles.append(RoleInvocation(
                    role=Role.STANDARDS_CHECKER,
                    temperature=self._get_temperature_for_role(Role.STANDARDS_CHECKER, complexity),
                    priority=current_priority,  # Last priority (highest number)
                    context="Final compliance verification"
                ))

        # RULE 6: Minimum - if no roles detected, use general approach
        if not roles:
            # Default: route to most general role based on question
            if "cost" in question or "price" in question or "budget" in question:
                roles.append(RoleInvocation(
                    role=Role.COST_ESTIMATOR,
                    temperature=0.3,
                    priority=0
                ))
            else:
                roles.append(RoleInvocation(
                    role=Role.STRUCTURAL_ENGINEER,
                    temperature=0.4,
                    priority=0
                ))

        return roles

    def _get_temperature_for_role(self, role: Role, complexity: TaskComplexity) -> float:
        """Get appropriate temperature for role based on complexity"""

        # Base temperatures by role (from prompts)
        base_temps = {
            Role.DOCUMENT_VALIDATOR: 0.2,       # Error detection
            Role.STRUCTURAL_ENGINEER: 0.3,      # Calculations
            Role.CONCRETE_SPECIALIST: 0.3,      # Material specs
            Role.COST_ESTIMATOR: 0.2,           # Deterministic pricing
            Role.STANDARDS_CHECKER: 0.2,        # Code compliance
        }

        # Adjust for complexity
        complexity_adjust = {
            TaskComplexity.SIMPLE: -0.1,
            TaskComplexity.STANDARD: 0.0,
            TaskComplexity.COMPLEX: +0.1,
            TaskComplexity.CREATIVE: +0.3,
        }

        base = base_temps.get(role, 0.3)
        adjust = complexity_adjust.get(complexity, 0.0)

        # Clamp to valid range
        temp = max(0.0, min(0.9, base + adjust))

        return temp

    def _check_missing_data(
        self,
        question: str,
        domains: List[Domain],
        context: Optional[Dict[str, Any]] = None
    ) -> tuple[bool, List[str]]:
        """
        Check if critical data is missing (requires RFI)

        Returns:
            (requires_rfi, missing_data_list)
        """
        missing_data = []

        # If context has files, assume data is provided
        if context and context.get("has_files"):
            return False, []

        # Don't require RFI for simple lookups (OTSKP code, exposure class lookup)
        if any(word in question for word in ["code", "kód", "otskp", "úrs", "what is", "co je", "what's"]):
            # This is a lookup question, not a calculation
            return False, []

        # Check for calculation/design without dimensions
        if Domain.CALCULATION in domains or Domain.DESIGN in domains:
            if not re.search(r"\d+\.?\d*\s*(?:m|mm|cm|метр)", question):
                # No dimensions found
                if any(word in question for word in ["calculate", "volume", "cost", "design", "vypočítat", "objem"]):
                    missing_data.append("dimensions (length, width, height)")

        # Check for structural questions without loads
        if any(word in question for word in ["story", "stories", "floor", "building", "podlaží"]):
            if not re.search(r"\d+\s*(?:story|stories|floor|podlaží)", question):
                missing_data.append("number of stories/floors")

        # Check for material DESIGN questions without exposure (not lookup questions)
        if Domain.MATERIALS in domains and Domain.DESIGN in domains:
            if "exposure" not in question and "xc" not in question and "xd" not in question:
                if any(word in question for word in ["specify", "design", "návrh", "specifikace"]):
                    missing_data.append("exposure conditions (indoor/outdoor, environment)")

        requires_rfi = len(missing_data) > 0

        return requires_rfi, missing_data

    def _calculate_confidence(self, domains: List[Domain], roles: List[RoleInvocation]) -> float:
        """Calculate confidence in classification"""

        # Start at 1.0
        confidence = 1.0

        # Reduce if no clear domain
        if len(domains) == 0 or (len(domains) == 1 and domains[0] == Domain.CALCULATION):
            confidence -= 0.2

        # Reduce if no roles selected
        if len(roles) == 0:
            confidence -= 0.3

        # Reduce if too many roles (might be ambiguous)
        if len(roles) > 4:
            confidence -= 0.1

        return max(0.0, min(1.0, confidence))


# Convenience function for quick classification
def classify_task(user_question: str, context: Optional[Dict[str, Any]] = None) -> TaskClassification:
    """
    Quick classification of a task

    Args:
        user_question: User's question
        context: Optional context

    Returns:
        TaskClassification
    """
    classifier = TaskClassifier()
    return classifier.classify(user_question, context)
