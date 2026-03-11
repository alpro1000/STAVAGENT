"""
Classification Rules Schema

Pydantic models for rule-based work classification system.
Deterministic, transparent, and self-correcting.
"""

from pydantic import BaseModel, Field
from typing import Optional


class WorkGroup(BaseModel):
    """
    Defines a work group with matching rules.

    Example:
        ZEMNI_PRACE:
            include: ["výkop", "hloubení", "rýha"]
            exclude: ["pilot"]
            boost_units: ["m3"]
    """
    name: str = Field(..., description="Group identifier (ZEMNI_PRACE, BETON_MONOLIT)")
    include: list[str] = Field(default_factory=list, description="Words/phrases to match")
    exclude: list[str] = Field(default_factory=list, description="Stop words (penalty)")
    boost_units: list[str] = Field(default_factory=list, description="Unit of measure boost (m3, kg)")
    boost_codes: list[str] = Field(default_factory=list, description="Catalog code boost")
    subtypes: dict[str, list[str]] = Field(default_factory=dict, description="Subtypes with markers")
    priority_over: list[str] = Field(default_factory=list, description="Priority over other groups")


class ClassificationResult(BaseModel):
    """
    Result of classification with evidence trail.

    Attributes:
        work_group: Main work category
        work_type: Specific subtype within group
        confidence: Score 0.0-1.0 (1.0 = exact match, 0.5 = ambiguous)
        evidence: 2-4 matched words from input text
        rule_hit: Which rule triggered the match
    """
    work_group: str = Field(..., description="Main category (ZEMNI_PRACE, BETON_MONOLIT)")
    work_type: str = Field(..., description="Specific type (HLOUBENI, ZELEZOBETON)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Match confidence")
    evidence: list[str] = Field(..., description="Matched keywords from text")
    rule_hit: str = Field(..., description="Rule that triggered match")

    class Config:
        json_schema_extra = {
            "example": {
                "work_group": "ZEMNI_PRACE",
                "work_type": "HLOUBENI",
                "confidence": 0.95,
                "evidence": ["výkop", "hloubení", "jáma"],
                "rule_hit": "ZEMNI_PRACE.include[výkop,hloubení]"
            }
        }


class CorrectionRule(BaseModel):
    """
    User correction for misclassification.

    Used to improve classifier over time by learning from mistakes.
    """
    text: str = Field(..., description="Original text that was misclassified")
    wrong_group: str = Field(..., description="Incorrect classification")
    correct_group: str = Field(..., description="Correct classification")
    scope: str = Field(default="project", description="Scope: 'project' or 'global'")
    keyword: Optional[str] = Field(None, description="Extracted keyword from text")
    created_at: Optional[str] = Field(None, description="ISO timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "text": "KOTVY TRVALÉ TYČOVÉ",
                "wrong_group": "VYZTUŽ",
                "correct_group": "KOTVENI",
                "scope": "global",
                "keyword": "kotvy",
                "created_at": "2026-01-26T12:00:00Z"
            }
        }


class RulesConfig(BaseModel):
    """
    Complete rules configuration.

    Loaded from YAML file, validated with Pydantic.
    """
    version: str = Field(default="1.0.0", description="Rules schema version")
    groups: dict[str, WorkGroup] = Field(..., description="All work groups")

    class Config:
        json_schema_extra = {
            "example": {
                "version": "1.0.0",
                "groups": {
                    "ZEMNI_PRACE": {
                        "name": "ZEMNI_PRACE",
                        "include": ["výkop", "hloubení"],
                        "exclude": ["pilot"],
                        "boost_units": ["m3"],
                        "subtypes": {"HLOUBENI": ["hloubení", "jáma"]}
                    }
                }
            }
        }
