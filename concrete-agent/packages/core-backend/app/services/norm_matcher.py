"""
NKB Matcher — Deterministic rule matching engine.

Given a project context (construction type, phase, materials, objects),
finds all applicable norms and rules from the NKB registry.

Also performs compliance checking against extracted document data.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-03-27
"""

import logging
import re
from typing import Any, Dict, List, Optional, Set

from app.models.norm_schemas import (
    ComplianceFinding,
    ComplianceReport,
    ComplianceStatus,
    NormativeDocument,
    NormativeRule,
    NormSearchQuery,
    RuleSearchQuery,
)
from app.services.norm_storage import get_norm_store

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Material / object keyword normalization
# ---------------------------------------------------------------------------
_MATERIAL_ALIASES: Dict[str, List[str]] = {
    "beton": ["beton", "betonáž", "betonování", "betonový", "betonová"],
    "výztuž": ["výztuž", "armatura", "ocel", "betonářská_ocel", "železo"],
    "bednění": ["bednění", "šalování", "formwork"],
    "most": ["most", "mosty", "mostní", "lávka"],
    "vozovka": ["vozovka", "komunikace", "silnice", "dálnice"],
    "izolace": ["izolace", "hydroizolace", "tepelná_izolace"],
    "spodek": ["spodek", "zemní_pláň", "podloží", "násyp"],
    "svršek": ["svršek", "kolej", "kolejnice", "pražce", "štěrkové_lože"],
    "krycí_vrstva": ["krycí_vrstva", "krytí"],
}


def _normalize_keyword(word: str) -> Set[str]:
    """Expand a keyword to its aliases."""
    w = word.lower().strip()
    matched = {w}
    for canonical, aliases in _MATERIAL_ALIASES.items():
        if w in aliases or w == canonical:
            matched.add(canonical)
            matched.update(aliases)
    return matched


def _text_contains_any(text: str, keywords: Set[str]) -> bool:
    """Check if text contains any of the keywords."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in keywords)


# ---------------------------------------------------------------------------
# Match norms for a project context
# ---------------------------------------------------------------------------
def match_norms(
    construction_type: Optional[str] = None,
    phase: Optional[str] = None,
    objects: Optional[List[str]] = None,
    materials: Optional[List[str]] = None,
    standards_mentioned: Optional[List[str]] = None,
) -> List[NormativeDocument]:
    """
    Find all relevant norms for a given project context.
    Returns norms sorted by priority (highest first).
    """
    store = get_norm_store()
    all_norms = store.list_norms()
    matched = []

    # Expand material/object keywords
    search_keywords: Set[str] = set()
    for obj in (objects or []):
        search_keywords.update(_normalize_keyword(obj))
    for mat in (materials or []):
        search_keywords.update(_normalize_keyword(mat))

    for norm in all_norms:
        if not norm.is_valid:
            continue

        score = 0

        # Construction type match
        if construction_type:
            ct = construction_type.lower()
            if ct in [x.lower() for x in norm.scope.construction_types]:
                score += 30
            elif not norm.scope.construction_types:
                score += 5  # Universal norm

        # Phase match
        if phase:
            ph = phase.lower()
            if ph in [x.lower() for x in norm.scope.phases]:
                score += 20
            elif not norm.scope.phases:
                score += 5

        # Object/material match
        if search_keywords and norm.scope.objects:
            norm_objects = set(o.lower() for o in norm.scope.objects)
            overlap = search_keywords & norm_objects
            if overlap:
                score += 25 * len(overlap)

        # Direct mention in document
        if standards_mentioned:
            for std in standards_mentioned:
                if std.lower() in norm.designation.lower() or norm.designation.lower() in std.lower():
                    score += 50

        if score > 0:
            matched.append((score, norm))

    matched.sort(key=lambda x: (x[0], x[1].priority), reverse=True)
    return [n for _, n in matched]


# ---------------------------------------------------------------------------
# Match rules for a project context
# ---------------------------------------------------------------------------
def match_rules(
    construction_type: Optional[str] = None,
    phase: Optional[str] = None,
    objects: Optional[List[str]] = None,
    materials: Optional[List[str]] = None,
    norm_ids: Optional[List[str]] = None,
) -> List[NormativeRule]:
    """
    Find all applicable rules for a given context.
    If norm_ids provided, only return rules from those norms.
    """
    store = get_norm_store()
    all_rules = store.list_rules()
    matched = []

    search_keywords: Set[str] = set()
    for obj in (objects or []):
        search_keywords.update(_normalize_keyword(obj))
    for mat in (materials or []):
        search_keywords.update(_normalize_keyword(mat))

    for rule in all_rules:
        if norm_ids and rule.norm_id not in norm_ids:
            continue

        score = 0

        # applies_to match
        if search_keywords and rule.applies_to:
            rule_applies = set(a.lower() for a in rule.applies_to)
            overlap = search_keywords & rule_applies
            if overlap:
                score += 30 * len(overlap)

        # construction_type match
        if construction_type and rule.construction_type:
            if construction_type.lower() in rule.construction_type.lower():
                score += 20

        # phase match
        if phase and rule.phase:
            if phase.lower() in rule.phase.lower():
                score += 15

        # If no specific filters, include rules from matched norms
        if norm_ids and rule.norm_id in norm_ids:
            score += 10

        if score > 0:
            matched.append((score, rule))

    matched.sort(key=lambda x: (x[0], x[1].priority), reverse=True)
    return [r for _, r in matched]


# ---------------------------------------------------------------------------
# Compliance checking — compare document data against rules
# ---------------------------------------------------------------------------
def check_compliance(
    project_id: str,
    document_data: Dict[str, Any],
    construction_type: Optional[str] = None,
    phase: Optional[str] = None,
) -> ComplianceReport:
    """
    Check a project's document data against matching NKB rules.

    document_data should contain keys like:
      - materials: list of material entries
      - standards: list of standard references
      - objects: list of object types
      - searchable_text: full text for keyword matching
    """
    # Extract context from document data
    materials = []
    objects = []
    standards = []
    text = document_data.get("searchable_text", "")

    for mat in document_data.get("materials", []):
        name = mat.get("name", "") if isinstance(mat, dict) else str(mat)
        materials.append(name)
    for std in document_data.get("standards", []):
        standards.append(std if isinstance(std, str) else str(std))
    for obj in document_data.get("objects", []):
        objects.append(obj if isinstance(obj, str) else str(obj))

    # Auto-detect objects from text
    if text:
        for canonical, aliases in _MATERIAL_ALIASES.items():
            if any(a in text.lower() for a in aliases):
                if canonical not in objects:
                    objects.append(canonical)

    # Find matching norms and rules
    matched_norms = match_norms(
        construction_type=construction_type,
        phase=phase,
        objects=objects,
        materials=materials,
        standards_mentioned=standards,
    )
    norm_ids = [n.norm_id for n in matched_norms]

    matched_rules = match_rules(
        construction_type=construction_type,
        phase=phase,
        objects=objects,
        materials=materials,
        norm_ids=norm_ids,
    )

    # Check each rule
    findings: List[ComplianceFinding] = []
    store = get_norm_store()

    for rule in matched_rules:
        norm = store.get_norm(rule.norm_id)
        designation = norm.designation if norm else rule.norm_id

        finding = _check_single_rule(rule, designation, document_data, text)
        findings.append(finding)

    # Calculate stats
    passed = sum(1 for f in findings if f.status == ComplianceStatus.PASS)
    warnings = sum(1 for f in findings if f.status == ComplianceStatus.WARNING)
    violations = sum(1 for f in findings if f.status == ComplianceStatus.VIOLATION)
    total = len(findings)

    score = passed / total if total > 0 else 1.0

    return ComplianceReport(
        project_id=project_id,
        total_rules_checked=total,
        passed=passed,
        warnings=warnings,
        violations=violations,
        findings=findings,
        norms_referenced=[n.designation for n in matched_norms],
        score=score,
    )


def _check_single_rule(
    rule: NormativeRule,
    designation: str,
    doc_data: Dict[str, Any],
    text: str,
) -> ComplianceFinding:
    """Check a single rule against document data."""
    # For most rules, we check if the document mentions the relevant topic
    # Detailed numeric checks only for tolerance/limit rules with extractable values

    rule_keywords = set()
    for a in rule.applies_to:
        rule_keywords.update(_normalize_keyword(a))
    if rule.parameter:
        rule_keywords.add(rule.parameter.lower())

    topic_mentioned = _text_contains_any(text, rule_keywords) if text else False

    if not topic_mentioned:
        return ComplianceFinding(
            rule_id=rule.rule_id,
            norm_designation=designation,
            rule_title=rule.title,
            status=ComplianceStatus.NOT_CHECKED,
            message=f"Téma '{', '.join(rule.applies_to)}' nebylo nalezeno v dokumentu",
            severity=rule.severity,
        )

    # Check standards mentioned
    standards = doc_data.get("standards", [])
    norm_mentioned = any(
        designation.lower() in str(s).lower()
        for s in standards
    )

    if rule.is_mandatory and not norm_mentioned:
        return ComplianceFinding(
            rule_id=rule.rule_id,
            norm_designation=designation,
            rule_title=rule.title,
            status=ComplianceStatus.WARNING,
            message=f"Dokument se zabývá tématem '{', '.join(rule.applies_to)}', "
                    f"ale neodkazuje na {designation}",
            expected_value=f"Odkaz na {designation}",
            severity=rule.severity,
            recommendation=f"Doplnit odkaz na {designation}: {rule.title}",
        )

    return ComplianceFinding(
        rule_id=rule.rule_id,
        norm_designation=designation,
        rule_title=rule.title,
        status=ComplianceStatus.PASS,
        message=f"Dokument odkazuje na {designation} a obsahuje relevantní obsah",
        severity=rule.severity,
    )
