"""
Pydantic models for Audit Result
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class CodeMatch(BaseModel):
    """Výsledek matchingu kódu"""
    found: bool
    code: Optional[str] = None
    name: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    source: Optional[str] = Field(None, description="ÚRS KROS 4, RTS, etc.")
    alternatives: List[dict] = Field(default_factory=list)
    notes: Optional[str] = None


class PriceCheck(BaseModel):
    """Kontrola ceny"""
    given_price: Optional[float] = None
    market_price: Optional[float] = None
    difference_pct: Optional[float] = None
    status: str = Field(..., description="OK/AMBER/RED/UNKNOWN")
    analysis: Optional[str] = None
    breakdown: Optional[dict] = Field(None, description="Rozložení ceny")


class NormValidation(BaseModel):
    """Kontrola norem ČSN"""
    compliant: bool
    standards_checked: List[dict] = Field(default_factory=list)
    issues: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class OverallAssessment(BaseModel):
    """Celkové hodnocení"""
    classification: str = Field(..., description="GREEN/AMBER/RED")
    confidence: float = Field(..., ge=0.0, le=1.0)
    main_issues: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    estimated_savings: Optional[float] = Field(None, description="Odhadované úspory v Kč")


class RFI(BaseModel):
    """Request for Information"""
    to: str = Field(..., description="Komu (Contractor, Architect, Engineer)")
    question: str
    impact: Optional[str] = Field(None, description="Vliv (±X Kč, Y dní)")


class AuditResult(BaseModel):
    """Kompletní výsledek AUDIT pro jednu pozici"""
    
    position_number: str
    status: str = Field(..., description="GREEN/AMBER/RED")
    
    code_match: CodeMatch
    price_check: PriceCheck
    norm_validation: NormValidation
    overall_assessment: OverallAssessment
    
    hitl_required: bool = False
    hitl_reason: Optional[str] = None
    
    rfi: List[RFI] = Field(default_factory=list)
    
    # Original position data
    position: Optional[dict] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "position_number": "1",
                "status": "AMBER",
                "code_match": {
                    "found": True,
                    "code": "121-01-015",
                    "confidence": 0.95
                },
                "price_check": {
                    "given_price": 2850.00,
                    "market_price": 2450.00,
                    "difference_pct": 16.3,
                    "status": "AMBER"
                },
                "norm_validation": {
                    "compliant": True,
                    "standards_checked": [],
                    "issues": []
                },
                "overall_assessment": {
                    "classification": "AMBER",
                    "confidence": 0.75,
                    "main_issues": ["Price 16% above market"]
                },
                "hitl_required": True
            }
        }


class MultiRoleReview(BaseModel):
    """Multi-role expert review (SME/ARCH/ENG/SUP)"""
    
    sme: Optional[dict] = Field(None, description="Smetař (Estimator)")
    arch: Optional[dict] = Field(None, description="Architekt")
    eng: Optional[dict] = Field(None, description="Inženýr-technolog")
    sup: Optional[dict] = Field(None, description="Stavbyvedoucí (Foreman)")
    
    disagreements: List[dict] = Field(default_factory=list)
    consensus: Optional[dict] = None
    
    roles_used: List[str] = Field(default_factory=list)
    depth: str = Field("standard", description="quick/standard/deep")


class AuditResultWithResources(AuditResult):
    """AUDIT + Resource Calculation"""
    
    resources: Optional[dict] = Field(None, description="Calculated resources (TOV)")
    multi_role_review: Optional[MultiRoleReview] = None
