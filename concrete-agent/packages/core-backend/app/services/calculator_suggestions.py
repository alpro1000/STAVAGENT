"""
Calculator Suggestions Service — maps extracted document facts to Monolit Planner parameters.

Given a portal_project_id and optional building_object (SO-xxx), returns:
  - suggestions: list of parameter suggestions with source/confidence
  - warnings: blocking/recommended/info warnings
  - conflicts: parameters found in multiple sources with different values

Uses the Section Extraction Engine results + NKB exposure class rules.

Author: STAVAGENT Team
Version: 1.0.0
Date: 2026-04-01
"""

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ─── Models ──────────────────────────────────────────────────────────────────

class FactSource(BaseModel):
    """Where a value was found."""
    document: str = ""
    page: Optional[int] = None
    confidence: float = 0.0
    source_type: str = ""  # regex | ai | human


class ParameterSuggestion(BaseModel):
    """Single suggestion: one extracted fact → one calculator parameter."""
    param: str                       # calculator param name: concrete_class, volume_m3, etc.
    value: Any                       # suggested value
    label: str = ""                  # human label in Czech
    source: FactSource
    accepted: bool = False           # user hasn't accepted yet


class ConflictEntry(BaseModel):
    """Two sources disagree on the same parameter."""
    param: str
    values: List[Dict[str, Any]]     # [{value, source: FactSource}, ...]
    recommended_value: Any = None
    recommendation_reason: str = ""


class Warning(BaseModel):
    """Warning/recommendation based on extracted facts."""
    severity: str = "info"           # blocking | recommended | info
    message: str = ""
    param: Optional[str] = None      # related calculator param, if any
    rule: str = ""                   # rule ID or reference


class CalculatorSuggestionsResponse(BaseModel):
    """Full response for calculator suggestions endpoint."""
    project_id: str = ""
    building_object: str = ""        # SO-xxx filter applied
    suggestions: List[ParameterSuggestion] = Field(default_factory=list)
    warnings: List[Warning] = Field(default_factory=list)
    conflicts: List[ConflictEntry] = Field(default_factory=list)
    facts_count: int = 0
    documents_used: List[str] = Field(default_factory=list)


# ─── Exposure class → minimum concrete class (ČSN EN 206, TKP 17) ────────

EXPOSURE_MIN_CONCRETE: Dict[str, str] = {
    "X0":  "C12/15",
    "XC1": "C16/20",
    "XC2": "C20/25",
    "XC3": "C25/30",
    "XC4": "C25/30",
    "XD1": "C25/30",
    "XD2": "C30/37",
    "XD3": "C30/37",
    "XS1": "C30/37",
    "XS2": "C30/37",
    "XS3": "C35/45",
    "XF1": "C25/30",
    "XF2": "C25/30",
    "XF3": "C30/37",
    "XF4": "C25/30",
    "XA1": "C25/30",
    "XA2": "C30/37",
    "XA3": "C30/37",
}

# Numeric ordering for concrete classes
CONCRETE_CLASS_ORDER = [
    "C12/15", "C16/20", "C20/25", "C25/30", "C30/37",
    "C35/45", "C40/50", "C45/55", "C50/60",
]


def _concrete_class_rank(cls: str) -> int:
    """Return numeric rank (higher = stronger). -1 if unknown."""
    try:
        return CONCRETE_CLASS_ORDER.index(cls)
    except ValueError:
        return -1


# ─── Document priority ───────────────────────────────────────────────────────

DOC_PRIORITY = {
    "TZ Statika": 1,
    "TZ D.1.2": 1,
    "D.1.2": 1,
    "TZ": 2,
    "výkaz výměr": 3,
    "rozpočet": 3,
    "harmonogram": 4,
    "výkres": 5,
}


def _doc_priority(doc_name: str) -> int:
    """Lower = higher priority."""
    lower = doc_name.lower()
    for pattern, prio in DOC_PRIORITY.items():
        if pattern.lower() in lower:
            return prio
    return 10  # unknown docs = lowest priority


# ─── Fact extraction from stored data ────────────────────────────────────────

def _normalize_number(text: str) -> Optional[float]:
    """Parse Czech-format numbers: '1 386,7' → 1386.7"""
    if not text:
        return None
    cleaned = re.sub(r'\s+', '', str(text))
    cleaned = cleaned.replace(',', '.')
    try:
        return float(cleaned)
    except ValueError:
        return None


def _extract_concrete_class(text: str) -> Optional[str]:
    """Extract concrete class like C30/37 from text."""
    m = re.search(r'C(\d{2,3})/(\d{2,3})', text, re.IGNORECASE)
    if m:
        return f"C{m.group(1)}/{m.group(2)}"
    return None


def _extract_exposure_classes(text: str) -> List[str]:
    """Extract exposure classes like XC1, XD2, XF4 from text."""
    return list(set(re.findall(r'X[CDFASM]\d', text, re.IGNORECASE)))


def _extract_volume(text: str) -> Optional[float]:
    """Extract volume in m³ from text."""
    # Pattern: number followed by m³ or m3
    m = re.search(r'([\d\s]+[,.]?\d*)\s*m[³3]', text)
    if m:
        return _normalize_number(m.group(1))
    return None


def _extract_consistency(text: str) -> Optional[str]:
    """Extract consistency class like S3, S4, SF2."""
    m = re.search(r'\b(S[F]?\d)\b', text)
    if m:
        return m.group(1)
    return None


def _is_scc(text: str) -> bool:
    """Detect self-compacting concrete mention."""
    lower = text.lower()
    return any(kw in lower for kw in [
        'samozhutnit', 'scc', 'self-compact', 'samozhutnitel',
    ])


def _is_prestressed(text: str) -> bool:
    """Detect prestressed concrete mention."""
    lower = text.lower()
    return any(kw in lower for kw in [
        'předpjat', 'předpět', 'prestress', 'predpjat',
    ])


def _is_winter_concreting(text: str) -> bool:
    """Detect winter concreting requirements."""
    lower = text.lower()
    return any(kw in lower for kw in [
        'zimní betonáž', 'zimního betonov', 'winter concret',
        'prohřív', 'prohřev', 'vyhříván',
    ])


def _is_massive_concrete(text: str) -> bool:
    """Detect massive concrete requirements."""
    lower = text.lower()
    return any(kw in lower for kw in [
        'masivní beton', 'massive concret', 'nízké hydratační teplo',
        'low heat', 'kontrola teploty',
    ])


def _is_architectural_concrete(text: str) -> bool:
    """Detect architectural/exposed concrete requirements."""
    lower = text.lower()
    return any(kw in lower for kw in [
        'pohledový beton', 'pohledového bet', 'architectural concret',
        'pohledov', 'viditelný beton',
    ])


def _extract_so_number(text: str) -> Optional[str]:
    """Extract building object number like SO-203."""
    m = re.search(r'SO[-\s]?(\d{3})', text, re.IGNORECASE)
    if m:
        return f"SO-{m.group(1)}"
    return None


# ─── Main mapping logic ─────────────────────────────────────────────────────

def map_facts_to_suggestions(
    extraction_results: List[Dict[str, Any]],
    building_object: Optional[str] = None,
) -> CalculatorSuggestionsResponse:
    """
    Map extracted document facts to calculator parameter suggestions.

    Args:
        extraction_results: list of extraction result dicts, each from a document.
            Expected shape: {
                "document_name": str,
                "building_object": str | None,  # SO-xxx
                "extractions": {domain: {field: value}},
                "raw_text": str (optional, for regex fallback),
                "source_type": "regex" | "ai",
                "pages": {fact_key: page_number}
            }
        building_object: filter to show only facts for this SO (or project-global).

    Returns:
        CalculatorSuggestionsResponse
    """
    # Collect all suggestions (may have duplicates/conflicts)
    raw_suggestions: Dict[str, List[ParameterSuggestion]] = {}
    documents_used = set()
    total_facts = 0

    for doc in extraction_results:
        doc_name = doc.get("document_name", "Neznámý dokument")
        doc_so = doc.get("building_object")
        extractions = doc.get("extractions", {})
        raw_text = doc.get("raw_text", "")
        pages = doc.get("pages", {})
        source_type = doc.get("source_type", "regex")

        # Filter by building object
        if building_object:
            if doc_so and doc_so != building_object:
                continue  # skip facts for other SOs

        documents_used.add(doc_name)

        # ── Extract from base_construction domain ──
        base = extractions.get("base_construction", {})

        if base.get("concrete_class"):
            cc = _extract_concrete_class(str(base["concrete_class"]))
            if cc:
                _add_suggestion(raw_suggestions, "concrete_class", cc, "Třída betonu",
                                doc_name, pages.get("concrete_class"), source_type)
                total_facts += 1

        if base.get("exposure_classes"):
            exp = base["exposure_classes"]
            if isinstance(exp, str):
                exp = _extract_exposure_classes(exp)
            if exp:
                _add_suggestion(raw_suggestions, "exposure_class", exp, "Stupeň prostředí",
                                doc_name, pages.get("exposure_classes"), source_type)
                total_facts += 1

        if base.get("steel_grade"):
            _add_suggestion(raw_suggestions, "steel_grade", base["steel_grade"], "Třída oceli",
                            doc_name, pages.get("steel_grade"), source_type)
            total_facts += 1

        # ── Extract from raw_text (regex on full document text) ──
        if raw_text:
            # Concrete class
            if "concrete_class" not in raw_suggestions:
                cc = _extract_concrete_class(raw_text)
                if cc:
                    _add_suggestion(raw_suggestions, "concrete_class", cc, "Třída betonu",
                                    doc_name, None, "regex")
                    total_facts += 1

            # Exposure classes
            if "exposure_class" not in raw_suggestions:
                exp_list = _extract_exposure_classes(raw_text)
                if exp_list:
                    _add_suggestion(raw_suggestions, "exposure_class", exp_list, "Stupeň prostředí",
                                    doc_name, None, "regex")
                    total_facts += 1

            # Volume
            vol = _extract_volume(raw_text)
            if vol and vol > 0:
                _add_suggestion(raw_suggestions, "volume_m3", vol, "Objem betonu (m³)",
                                doc_name, None, "regex")
                total_facts += 1

            # Consistency
            cons = _extract_consistency(raw_text)
            if cons:
                _add_suggestion(raw_suggestions, "consistency", cons, "Konzistence",
                                doc_name, None, "regex")
                total_facts += 1

            # Special concrete types (boolean flags)
            if _is_scc(raw_text):
                _add_suggestion(raw_suggestions, "is_scc", True,
                                "Samozhutnitelný beton (SCC)",
                                doc_name, None, "regex")
                total_facts += 1

            if _is_prestressed(raw_text):
                _add_suggestion(raw_suggestions, "is_prestressed", True,
                                "Předpjatý beton",
                                doc_name, None, "regex")
                total_facts += 1

            if _is_winter_concreting(raw_text):
                _add_suggestion(raw_suggestions, "is_winter", True,
                                "Zimní betonáž",
                                doc_name, None, "regex")
                total_facts += 1

            if _is_massive_concrete(raw_text):
                _add_suggestion(raw_suggestions, "is_massive", True,
                                "Masivní beton",
                                doc_name, None, "regex")
                total_facts += 1

            if _is_architectural_concrete(raw_text):
                _add_suggestion(raw_suggestions, "is_architectural", True,
                                "Pohledový beton",
                                doc_name, None, "regex")
                total_facts += 1

    # ── Resolve conflicts & build final suggestions ──
    suggestions, conflicts = _resolve_conflicts(raw_suggestions)

    # ── Generate warnings ──
    warnings = _generate_warnings(suggestions, conflicts)

    return CalculatorSuggestionsResponse(
        suggestions=suggestions,
        warnings=warnings,
        conflicts=conflicts,
        facts_count=total_facts,
        documents_used=sorted(documents_used),
    )


def _add_suggestion(
    collector: Dict[str, List[ParameterSuggestion]],
    param: str,
    value: Any,
    label: str,
    doc_name: str,
    page: Optional[int],
    source_type: str,
):
    """Add a suggestion to the collector, grouping by param name."""
    confidence = 1.0 if source_type == "regex" else (0.85 if source_type == "perplexity" else 0.7)
    suggestion = ParameterSuggestion(
        param=param,
        value=value,
        label=label,
        source=FactSource(
            document=doc_name,
            page=page,
            confidence=confidence,
            source_type=source_type,
        ),
    )
    collector.setdefault(param, []).append(suggestion)


def _resolve_conflicts(
    raw: Dict[str, List[ParameterSuggestion]],
) -> Tuple[List[ParameterSuggestion], List[ConflictEntry]]:
    """
    For each param, if multiple sources agree → take best confidence.
    If they disagree → create conflict entry + pick recommended value.
    """
    suggestions: List[ParameterSuggestion] = []
    conflicts: List[ConflictEntry] = []

    for param, entries in raw.items():
        if len(entries) == 1:
            suggestions.append(entries[0])
            continue

        # Group by value
        by_value: Dict[str, List[ParameterSuggestion]] = {}
        for e in entries:
            key = str(e.value)
            by_value.setdefault(key, []).append(e)

        if len(by_value) == 1:
            # All sources agree — take highest confidence
            best = max(entries, key=lambda e: e.source.confidence)
            suggestions.append(best)
        else:
            # Conflict — multiple different values
            conflict_values = []
            for val_str, val_entries in by_value.items():
                best_entry = max(val_entries, key=lambda e: e.source.confidence)
                conflict_values.append({
                    "value": best_entry.value,
                    "source": best_entry.source.model_dump(),
                })

            # Recommend based on document priority, then confidence
            all_entries = sorted(entries, key=lambda e: (
                _doc_priority(e.source.document),
                -e.source.confidence,
            ))
            recommended = all_entries[0]
            suggestions.append(recommended)

            conflicts.append(ConflictEntry(
                param=param,
                values=conflict_values,
                recommended_value=recommended.value,
                recommendation_reason=f"Hodnota z {recommended.source.document} (vyšší priorita dokumentu)",
            ))

    return suggestions, conflicts


# ─── Warning generation ──────────────────────────────────────────────────────

def _generate_warnings(
    suggestions: List[ParameterSuggestion],
    conflicts: List[ConflictEntry],
) -> List[Warning]:
    """Generate warnings based on suggestions and known domain rules."""
    warnings: List[Warning] = []

    # Index suggestions by param
    by_param = {s.param: s for s in suggestions}

    concrete_class = by_param.get("concrete_class")
    exposure = by_param.get("exposure_class")
    is_prestressed = by_param.get("is_prestressed")
    is_scc = by_param.get("is_scc")
    is_winter = by_param.get("is_winter")
    is_massive = by_param.get("is_massive")
    is_architectural = by_param.get("is_architectural")

    # ── Check concrete class vs exposure class minimum ──
    if concrete_class and exposure:
        cc_val = str(concrete_class.value)
        exp_vals = exposure.value if isinstance(exposure.value, list) else [exposure.value]
        cc_rank = _concrete_class_rank(cc_val)

        for exp in exp_vals:
            exp_upper = str(exp).upper()
            min_class = EXPOSURE_MIN_CONCRETE.get(exp_upper)
            if min_class:
                min_rank = _concrete_class_rank(min_class)
                if cc_rank >= 0 and min_rank >= 0 and cc_rank < min_rank:
                    warnings.append(Warning(
                        severity="blocking",
                        message=f"Třída betonu {cc_val} je nižší než minimum {min_class} "
                                f"pro stupeň prostředí {exp_upper} (ČSN EN 206)",
                        param="concrete_class",
                        rule="CSN_EN_206_T2",
                    ))

    # ── Prestressed concrete → no construction joints ──
    if is_prestressed and is_prestressed.value:
        warnings.append(Warning(
            severity="blocking",
            message="Předpjatý beton — vyžaduje nepřerušenou betonáž bez pracovních spár. "
                    "Celý záběr musí být proveden v jednom cyklu.",
            param="has_dilatacni_spary",
            rule="CSN_EN_13670_prestressed",
        ))

    # ── SCC → no vibration needed ──
    if is_scc and is_scc.value:
        warnings.append(Warning(
            severity="recommended",
            message="Samozhutnitelný beton (SCC) — vibrování není třeba. "
                    "Upravte složení čety (bez vibračního zvena).",
            param="crew_size",
            rule="CSN_EN_206_SCC",
        ))

    # ── Winter concreting ──
    if is_winter and is_winter.value:
        warnings.append(Warning(
            severity="recommended",
            message="V TZ je zmíněna zimní betonáž — zajistěte prohřev, uteplení "
                    "a min. teplotu povrchu 5°C po dobu 72 hodin.",
            param="temperature_c",
            rule="TKP_17_winter",
        ))

    # ── Massive concrete ──
    if is_massive and is_massive.value:
        warnings.append(Warning(
            severity="recommended",
            message="Masivní beton (sečení > 80 cm) — požadován kontrolní "
                    "monitoring teploty při tvrdnutí (max 70°C). Použijte cement s nízký hydratační teplem.",
            param="cement_type",
            rule="TKP_17_massive",
        ))

    # ── Architectural concrete ──
    if is_architectural and is_architectural.value:
        warnings.append(Warning(
            severity="recommended",
            message="Pohledový beton — požadována opalubka vyšší třídy povrchu. "
                    "Zkontrolujte výběr opalubkového systému.",
            param="formwork_system_name",
            rule="CSN_EN_13670_architectural",
        ))

    # ── Conflicts ──
    for c in conflicts:
        warnings.append(Warning(
            severity="recommended",
            message=f"Konflikt hodnot pro parametr '{c.param}': nalezeno {len(c.values)} "
                    f"různých hodnot z různých dokumentů. Doporučená: {c.recommended_value}.",
            param=c.param,
            rule="conflict",
        ))

    # ── Info: facts count ──
    if suggestions:
        warnings.append(Warning(
            severity="info",
            message=f"Z dokumentů projektu bylo extrahováno {len(suggestions)} doporučení.",
        ))

    return warnings


# ─── In-memory project facts store (seed data + runtime) ─────────────────────

_PROJECT_FACTS: Dict[str, List[Dict[str, Any]]] = {}


def store_project_facts(portal_project_id: str, facts: List[Dict[str, Any]]):
    """Store extraction results for a project (for seed data or after document processing)."""
    _PROJECT_FACTS[portal_project_id] = facts
    logger.info(f"Stored {len(facts)} extraction results for project {portal_project_id}")


def get_project_facts(portal_project_id: str) -> List[Dict[str, Any]]:
    """Retrieve stored extraction results for a project."""
    return _PROJECT_FACTS.get(portal_project_id, [])


def get_calculator_suggestions(
    portal_project_id: str,
    building_object: Optional[str] = None,
    element_description: Optional[str] = None,
) -> CalculatorSuggestionsResponse:
    """
    Main entry point: get calculator suggestions for a project.

    Args:
        portal_project_id: portal project ID linking Core ↔ Monolit
        building_object: optional SO-xxx filter
        element_description: optional element name for context-aware filtering
    """
    facts = get_project_facts(portal_project_id)
    if not facts:
        return CalculatorSuggestionsResponse(
            project_id=portal_project_id,
            building_object=building_object or "",
        )

    response = map_facts_to_suggestions(facts, building_object)
    response.project_id = portal_project_id
    response.building_object = building_object or ""
    return response
