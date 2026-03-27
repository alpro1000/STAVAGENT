"""
Normative Knowledge Base (NKB) — Pydantic schemas.

3-Layer Architecture:
  Layer 1: Registry — NormativeDocument catalog (ČSN, VTP, TKP, zákon, vyhláška...)
  Layer 2: Rules — Extracted parameters, tolerances, deadlines, procedures
  Layer 3: Advisor — AI engine context + recommendations

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# NormCategory — 13 norm types
# ---------------------------------------------------------------------------
class NormCategory(str, Enum):
    ZAKON = "zákon"
    VYHLASKA = "vyhláška"
    NARIZENI_EU = "nařízení_EU"
    CSN = "ČSN"
    CSN_EN = "ČSN_EN"
    TNZ = "TNŽ"
    TKP = "TKP"
    VTP = "VTP"
    ZTP = "ZTP"
    SMERNICE = "směrnice"
    METODICKY_POKYN = "metodický_pokyn"
    PREDPIS = "předpis"
    CENOVA_DATABAZE = "cenová_databáze"


# ---------------------------------------------------------------------------
# NormScope — where / when the norm applies
# ---------------------------------------------------------------------------
class NormScope(BaseModel):
    construction_types: List[str] = Field(
        default_factory=list,
        description="E.g. ['dopravní', 'pozemní', 'železniční', 'mostní']"
    )
    phases: List[str] = Field(
        default_factory=list,
        description="E.g. ['PDPS', 'DSP', 'DUR', 'realizace']"
    )
    objects: List[str] = Field(
        default_factory=list,
        description="E.g. ['beton', 'výztuž', 'izolace', 'vozovka']"
    )
    regions: List[str] = Field(
        default_factory=list,
        description="E.g. ['ČR', 'EU'] — default ČR"
    )


# ---------------------------------------------------------------------------
# NormativeDocument — Layer 1: Registry entry
# ---------------------------------------------------------------------------
class NormativeDocument(BaseModel):
    norm_id: str = Field(..., description="Unique ID, e.g. 'CSN_73_6201'")
    category: NormCategory
    designation: str = Field(..., description="Official designation, e.g. 'ČSN 73 6201'")
    title: str = Field(..., description="Full Czech title")
    title_en: Optional[str] = None
    version: str = ""
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    is_active: bool = True
    replaces: List[str] = Field(default_factory=list, description="Norm IDs this replaces")
    replaced_by: Optional[str] = None
    scope: NormScope = Field(default_factory=NormScope)
    source_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    priority: int = Field(
        default=50,
        description="Priority weight: zákon=100, vyhláška=90, ČSN=70, TKP=60, VTP=50, metodický_pokyn=30"
    )

    @property
    def is_valid(self) -> bool:
        return self.is_active and self.replaced_by is None


# ---------------------------------------------------------------------------
# RuleType — 10 rule types
# ---------------------------------------------------------------------------
class RuleType(str, Enum):
    TOLERANCE = "tolerance"
    FORMULA = "formula"
    DEADLINE = "deadline"
    PROCEDURE = "procedure"
    REQUIREMENT = "requirement"
    RECOMMENDATION = "recommendation"
    LIMIT = "limit"
    CLASSIFICATION = "classification"
    PRICING = "pricing"
    FORMAT = "format"


# ---------------------------------------------------------------------------
# NormativeRule — Layer 2: Extracted rule / parameter
# ---------------------------------------------------------------------------
class NormativeRule(BaseModel):
    rule_id: str = Field(..., description="Unique rule ID, e.g. 'CSN_73_6201_R001'")
    norm_id: str = Field(..., description="Parent norm ID")
    rule_type: RuleType
    title: str
    description: str = ""

    # Context: when does this rule apply?
    applies_to: List[str] = Field(
        default_factory=list,
        description="Objects/materials this applies to, e.g. ['beton_C30/37', 'vozovka']"
    )
    phase: Optional[str] = None
    construction_type: Optional[str] = None

    # The rule value(s)
    parameter: Optional[str] = None
    value: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit: Optional[str] = None
    formula: Optional[str] = None

    # Priority & enforcement
    is_mandatory: bool = True
    priority: int = Field(default=50, description="Inherited from parent norm + rule weight")
    penalty_reference: Optional[str] = None

    # Metadata
    section_reference: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

    @property
    def severity(self) -> str:
        """Return severity level based on priority."""
        if self.priority >= 80:
            return "critical"
        if self.priority >= 60:
            return "high"
        if self.priority >= 40:
            return "medium"
        return "low"


# ---------------------------------------------------------------------------
# Compliance check result
# ---------------------------------------------------------------------------
class ComplianceStatus(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    VIOLATION = "violation"
    NOT_CHECKED = "not_checked"


class ComplianceFinding(BaseModel):
    rule_id: str
    norm_designation: str
    rule_title: str
    status: ComplianceStatus
    message: str = ""
    actual_value: Optional[str] = None
    expected_value: Optional[str] = None
    severity: str = "medium"
    recommendation: Optional[str] = None


class ComplianceReport(BaseModel):
    project_id: str
    checked_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    total_rules_checked: int = 0
    passed: int = 0
    warnings: int = 0
    violations: int = 0
    findings: List[ComplianceFinding] = Field(default_factory=list)
    norms_referenced: List[str] = Field(default_factory=list)
    score: float = Field(default=0.0, description="0.0-1.0 compliance score")

    @property
    def summary_status(self) -> str:
        if self.violations > 0:
            return "non_compliant"
        if self.warnings > 0:
            return "conditionally_compliant"
        return "compliant"


# ---------------------------------------------------------------------------
# Advisor context & response — Layer 3
# ---------------------------------------------------------------------------
class AdvisorContext(BaseModel):
    project_id: Optional[str] = None
    construction_type: Optional[str] = None
    phase: Optional[str] = None
    objects: List[str] = Field(default_factory=list)
    question: Optional[str] = None
    document_text: Optional[str] = None
    materials: List[str] = Field(default_factory=list)
    standards_mentioned: List[str] = Field(default_factory=list)


class AdvisorRecommendation(BaseModel):
    norm_designation: str
    rule_title: str
    recommendation: str
    severity: str = "info"
    applies_to: List[str] = Field(default_factory=list)
    confidence: float = 0.0


class AdvisorResponse(BaseModel):
    context_summary: str = ""
    matched_norms: int = 0
    matched_rules: int = 0
    recommendations: List[AdvisorRecommendation] = Field(default_factory=list)
    ai_analysis: Optional[str] = None
    ai_model_used: Optional[str] = None
    perplexity_supplement: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# NKB search / filter
# ---------------------------------------------------------------------------
class NormSearchQuery(BaseModel):
    query: Optional[str] = None
    category: Optional[NormCategory] = None
    construction_type: Optional[str] = None
    phase: Optional[str] = None
    object_type: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    active_only: bool = True
    limit: int = 50


class RuleSearchQuery(BaseModel):
    norm_id: Optional[str] = None
    rule_type: Optional[RuleType] = None
    applies_to: Optional[str] = None
    construction_type: Optional[str] = None
    phase: Optional[str] = None
    mandatory_only: bool = False
    limit: int = 100
