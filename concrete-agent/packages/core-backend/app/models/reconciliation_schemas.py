"""
UEP Reconciliation engine — Phase 3 schemas (PR2).

Pydantic v2 contracts for the reconciliation layer. Reconciliation runs
*after* Phase 1 (extraction) and compares facts produced by different
extractors against each other through YAML-declared rules.

Rule shape (matches `reconciliation_rules.yaml`, loaded by
`services/uep/reconciliation_engine.py`):

```yaml
rules:
  - id: geometry_room_area_agreement
    description: "DXF room polygon area vs XLSX tabulka místností"
    left_source: dxf
    right_source: xlsx_soupis
    join_on: room_code
    compare_field: area_m2
    tolerance: { type: percentage, value: 2.0 }
    on_match: confirm_and_boost_confidence
    on_mismatch: flag_conflict
    severity: critical
```

Engine output (one `ReconciliationReport` per project) is consumed by:
  - the Phase 3 gate (critical conflicts → VYJASNĚNÍ items),
  - downstream derivation (confirmed quantities can be reused),
  - the REST + MCP surface (`/api/v1/projects/.../uep/reconciliation-report`).

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.3, §4.3
Reference: docs/tasks/TASK_UEP_PR2.md §3.1
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums — keep small and explicit per task §3.3.
# ---------------------------------------------------------------------------


class ToleranceType(str, Enum):
    """How `compare_field` values are compared."""

    PERCENTAGE = "percentage"
    ABSOLUTE = "absolute"
    EXACT = "exact"


class OnMatch(str, Enum):
    """Behaviour when both sides match within tolerance."""

    CONFIRM = "confirm"
    CONFIRM_AND_BOOST_CONFIDENCE = "confirm_and_boost_confidence"


class OnMismatch(str, Enum):
    """Resolution when values disagree.

    Engine emits the resolution choice into the report; the actual
    consumer (downstream derivation, UI) decides which side wins.
    """

    FLAG_CONFLICT = "flag_conflict"
    DRAWING_WINS = "drawing_wins"
    TZ_WINS = "tz_wins"
    REGEX_WINS = "regex_wins"
    PASSPORT_WINS = "passport_wins"


class Severity(str, Enum):
    """Severity of a reconciliation outcome.

    `critical` conflicts open the Phase 3 gate (a VYJASNĚNÍ entry is
    auto-generated). `important` + `informational` are recorded but do
    not block.
    """

    CRITICAL = "critical"
    IMPORTANT = "important"
    INFORMATIONAL = "informational"


class MatchStatus(str, Enum):
    """Outcome status per match attempt."""

    CONFIRMED = "confirmed"
    CONFLICT = "conflict"
    LEFT_ONLY = "left_only"
    RIGHT_ONLY = "right_only"


# ---------------------------------------------------------------------------
# Rule definition (loaded from YAML).
# ---------------------------------------------------------------------------


class Tolerance(BaseModel):
    """Numeric tolerance band used by the rule comparator."""

    type: ToleranceType
    value: float = Field(
        default=0.0,
        ge=0.0,
        description=(
            "For `percentage`: 2.0 means ±2 %. For `absolute`: value in the "
            "compare_field's own unit (m, m², m³, t, ks). Ignored for `exact`."
        ),
    )


class ReconciliationRule(BaseModel):
    """One rule loaded from `reconciliation_rules_<project_type>.yaml`.

    The rule tells the engine which two fact streams to compare, on
    which key to join them, which numeric field to diff, and what to do
    with the outcome.

    `left_source` and `right_source` are simple strings — they may be:
      - a `SourceFormat` enum value (e.g. `"dxf"`, `"pdf_tz"`), OR
      - a passport-style sentinel (`"passport_schema"`), OR
      - a wildcard `"*"` meaning "any source emits this fact".

    The engine does not coerce them into the SourceFormat enum so that
    rule authors can target the upcoming sources (gbXML in PR4, etc.)
    before the enum gains the value.
    """

    id: str = Field(..., description="Stable rule identifier (no spaces).")
    description: str
    left_source: str
    right_source: str
    join_on: str = Field(
        ...,
        description=(
            "Fact attribute used as join key. Common values: `field` (the "
            "ExtractedFact.field), `category` (when each side has only one "
            "fact per category), `evidence.element_type`, or a custom key "
            "that the rule's `key_extractor` will compute. PR2 only "
            "supports plain field names — `key_extractor` lambdas are PR3."
        ),
    )
    compare_field: str = Field(
        ...,
        description=(
            "Path inside ExtractedFact to the value being diffed. Plain "
            "attribute names (`value`) for scalars; dotted paths "
            "(`value.sum_m2`) for nested dicts."
        ),
    )
    tolerance: Tolerance
    on_match: OnMatch = OnMatch.CONFIRM
    on_mismatch: OnMismatch = OnMismatch.FLAG_CONFLICT
    severity: Severity = Severity.IMPORTANT
    notes: Optional[str] = None


class ReconciliationRuleSet(BaseModel):
    """YAML root container."""

    version: int = 1
    project_type: str
    description: str = ""
    rules: list[ReconciliationRule] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Per-match outcome.
# ---------------------------------------------------------------------------


class FactRef(BaseModel):
    """Reference to a Phase-1 fact participating in a match.

    Pointers — not copies — so the report stays compact. Consumers
    re-hydrate by reading the per-source phase1 JSON when they need the
    full fact payload.
    """

    source_file: str
    source_format: str
    extractor: str
    category: str
    field: str
    value: Any = None
    confidence: float


class ReconciliationMatch(BaseModel):
    """One row in the per-rule comparison output.

    Status semantics:
      - `confirmed`  — both sides found, agreement within tolerance.
      - `conflict`   — both sides found, disagreement beyond tolerance.
      - `left_only`  — only left side present (right missing or filtered).
      - `right_only` — symmetric.
    """

    rule_id: str
    join_value: Any
    status: MatchStatus
    left_evidence: Optional[FactRef] = None
    right_evidence: Optional[FactRef] = None
    delta: Optional[float] = Field(
        default=None,
        description=(
            "Signed numeric difference `right - left` for confirmed/conflict "
            "matches against scalar fields. `None` for non-numeric or "
            "one-sided matches."
        ),
    )
    delta_pct: Optional[float] = Field(
        default=None,
        description="Percentage delta when both sides are numeric and left != 0.",
    )
    resolution: Optional[str] = Field(
        default=None,
        description=(
            "Free-text record of which side won (per rule.on_mismatch) and "
            "why. Empty when status == confirmed."
        ),
    )
    severity: Severity = Severity.INFORMATIONAL


# ---------------------------------------------------------------------------
# Aggregate report.
# ---------------------------------------------------------------------------


class ReconciliationReport(BaseModel):
    """Per-project summary emitted by `evaluate_reconciliation()`."""

    project_id: Optional[str] = None
    project_type: str
    rules_file: str
    rules_evaluated: int = 0
    matches: list[ReconciliationMatch] = Field(default_factory=list)

    # Aggregates — computed once and exposed to consumers + UI.
    confirmed_count: int = 0
    conflict_count: int = 0
    left_only_count: int = 0
    right_only_count: int = 0

    critical_conflicts: list[str] = Field(
        default_factory=list,
        description=(
            "Rule IDs whose status==conflict AND severity==critical. The "
            "Phase 3 gate uses this list to decide whether to auto-create "
            "VYJASNĚNÍ entries."
        ),
    )

    def gate_passed(self) -> bool:
        """True when no critical conflict is present."""

        return len(self.critical_conflicts) == 0
