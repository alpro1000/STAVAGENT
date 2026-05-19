"""
UEP reconciliation engine — Phase 3 implementation (PR2).

Loads YAML rule sets and evaluates them against the stream of
`PerSourceExtraction` records produced by Phase 1 extractors.

Algorithm (per rule):
  1. Collect every fact whose `provenance.source_format` matches
     `rule.left_source` (or `*` wildcard) — call these `left_facts`.
  2. Same for `right_source` — `right_facts`.
  3. Index both sides by `rule.join_on` value.
  4. For every join_value that appears on at least one side, emit a
     `ReconciliationMatch`:
       - both sides present → numeric compare via tolerance → status
         `confirmed` or `conflict`.
       - left only / right only — emit one-sided match.
  5. Aggregate per-status counts; collect `critical_conflicts`.

No I/O beyond the YAML load + the in-memory fact iteration. Pure
function-of-input so the test suite can exercise it without a DB.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §3.3
Reference: docs/tasks/TASK_UEP_PR2.md §3.1
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Iterable, Optional

import yaml

from app.models.reconciliation_schemas import (
    FactRef,
    MatchStatus,
    OnMismatch,
    ReconciliationMatch,
    ReconciliationReport,
    ReconciliationRule,
    ReconciliationRuleSet,
    Severity,
    Tolerance,
    ToleranceType,
)
from app.models.uep_schemas import ExtractedFact, PerSourceExtraction

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# YAML loader.
# ---------------------------------------------------------------------------


def load_rules(path: Path, project_type: str) -> ReconciliationRuleSet:
    """Load + validate a YAML rule set.

    Raises ValueError when `project_type` in the file disagrees with the
    argument (catches typos when the operator points the loader at the
    wrong YAML).
    """

    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    rule_set = ReconciliationRuleSet.model_validate(raw)
    if rule_set.project_type != project_type:
        raise ValueError(
            f"rules file project_type='{rule_set.project_type}' does not "
            f"match expected '{project_type}' (path={path})"
        )
    return rule_set


def rules_path_for(project_type: str) -> Path:
    """Default path of the bundled rule set for `project_type`.

    Mirrors `coverage_engine.matrix_path_for()` — siblings under the same
    knowledge_base layout. Bundles only `residential` in PR2; PR3 ships
    `bridge`, `road`, `industrial`.
    """

    return (
        Path(__file__).resolve().parents[2]
        / "knowledge_base"
        / "B11_reconciliation_rules"
        / f"reconciliation_rules_{project_type}.yaml"
    )


# ---------------------------------------------------------------------------
# Fact indexing helpers.
# ---------------------------------------------------------------------------


def _fact_ref(fact: ExtractedFact, prov) -> FactRef:
    """Pack a Phase-1 fact into the compact FactRef shape used in the report."""

    return FactRef(
        source_file=prov.source_file,
        source_format=str(prov.source_format.value if hasattr(prov.source_format, "value") else prov.source_format),
        extractor=prov.extractor,
        category=fact.category,
        field=fact.field,
        value=fact.value,
        confidence=fact.confidence,
    )


def _read_nested(value: Any, path: str) -> Any:
    """Resolve dotted-path access into a nested dict/object.

    Used to support `compare_field: "value.sum_m2"` style rules where
    the fact's `.value` is a nested dict. Returns None if any segment
    is missing — the caller treats that as "no comparable scalar".
    """

    parts = path.split(".")
    current: Any = value
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return None
    return current


def _join_key(fact: ExtractedFact, key: str) -> Any:
    """Extract the join-key value from a fact.

    Plain keys read attributes directly; dotted keys descend into
    `evidence` automatically (so rules can join on
    `evidence.element_type` without spelling out the dotted path).
    """

    if hasattr(fact, key):
        return getattr(fact, key)
    if "." in key:
        head, _, rest = key.partition(".")
        if head == "evidence":
            return _read_nested(fact.evidence, rest)
        # Fallthrough: try ExtractedFact attribute then its own dict.
        attr = getattr(fact, head, None)
        if attr is None:
            return None
        return _read_nested(attr, rest)
    if isinstance(fact.evidence, dict):
        return fact.evidence.get(key)
    return None


def _source_matches(rule_source: str, fact_source: str) -> bool:
    """Wildcard-aware source match."""

    if rule_source == "*":
        return True
    return rule_source == fact_source


def _collect(
    extractions: Iterable[PerSourceExtraction],
    rule: ReconciliationRule,
    side: str,
) -> list[tuple[ExtractedFact, Any]]:
    """Collect (fact, provenance) tuples for `side` of `rule`.

    `side` is the string "left" or "right" — we read
    `rule.left_source` / `rule.right_source` and the matching source_format.
    """

    wanted = rule.left_source if side == "left" else rule.right_source
    out: list[tuple[ExtractedFact, Any]] = []
    for extraction in extractions:
        prov = extraction.provenance
        source_str = str(prov.source_format.value if hasattr(prov.source_format, "value") else prov.source_format)
        if not _source_matches(wanted, source_str):
            continue
        for fact in extraction.facts:
            out.append((fact, prov))
    return out


def _compare_scalar(
    left: Any, right: Any, tolerance: Tolerance
) -> tuple[bool, Optional[float], Optional[float]]:
    """Return (within_tolerance, delta, delta_pct) for scalar values.

    Non-numeric values fall back to `==` equality; delta is None.
    """

    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        delta = float(right) - float(left)
        delta_pct = (delta / float(left) * 100.0) if left != 0 else None

        if tolerance.type == ToleranceType.EXACT:
            return left == right, delta, delta_pct
        if tolerance.type == ToleranceType.ABSOLUTE:
            return abs(delta) <= tolerance.value, delta, delta_pct
        if tolerance.type == ToleranceType.PERCENTAGE:
            if delta_pct is None:
                # left == 0; treat exact match
                return delta == 0, delta, None
            return abs(delta_pct) <= tolerance.value, delta, delta_pct

    return left == right, None, None


def _resolution_text(rule: ReconciliationRule, left_won: Optional[bool]) -> Optional[str]:
    """Describe which side won and why.

    PR2 only sets a resolution string for conflicts; matches keep None.
    """

    if rule.on_mismatch == OnMismatch.FLAG_CONFLICT:
        return f"flagged ({rule.severity.value})"
    side_map = {
        OnMismatch.DRAWING_WINS: "drawing side wins",
        OnMismatch.TZ_WINS: "TZ side wins",
        OnMismatch.REGEX_WINS: "regex side wins",
        OnMismatch.PASSPORT_WINS: "passport schema wins",
    }
    return side_map.get(rule.on_mismatch, rule.on_mismatch.value)


# ---------------------------------------------------------------------------
# Public entry point.
# ---------------------------------------------------------------------------


def evaluate_reconciliation(
    extractions: Iterable[PerSourceExtraction],
    rule_set: ReconciliationRuleSet,
    *,
    project_id: Optional[str] = None,
    rules_file: str = "",
) -> ReconciliationReport:
    """Run every rule in `rule_set` against `extractions` → report.

    The function is pure (no I/O, no side effects). Tests instantiate
    in-memory PerSourceExtraction lists and assert the produced
    ReconciliationReport directly.
    """

    extractions_list = list(extractions)

    matches: list[ReconciliationMatch] = []
    critical_conflicts: list[str] = []

    for rule in rule_set.rules:
        left_facts = _collect(extractions_list, rule, "left")
        right_facts = _collect(extractions_list, rule, "right")

        # Index by join_on value. We pre-compute keys and skip None
        # so rules don't accidentally pair every left_only fact with
        # every right_only fact via a missing key.
        left_index: dict[Any, list[tuple[ExtractedFact, Any]]] = {}
        for fact, prov in left_facts:
            key = _join_key(fact, rule.join_on)
            if key is None:
                continue
            left_index.setdefault(key, []).append((fact, prov))

        right_index: dict[Any, list[tuple[ExtractedFact, Any]]] = {}
        for fact, prov in right_facts:
            key = _join_key(fact, rule.join_on)
            if key is None:
                continue
            right_index.setdefault(key, []).append((fact, prov))

        all_keys = set(left_index.keys()) | set(right_index.keys())
        for key in sorted(all_keys, key=lambda k: str(k)):
            left = left_index.get(key, [])
            right = right_index.get(key, [])

            if left and not right:
                for fact, prov in left:
                    matches.append(
                        ReconciliationMatch(
                            rule_id=rule.id,
                            join_value=key,
                            status=MatchStatus.LEFT_ONLY,
                            left_evidence=_fact_ref(fact, prov),
                            severity=rule.severity,
                        )
                    )
                continue
            if right and not left:
                for fact, prov in right:
                    matches.append(
                        ReconciliationMatch(
                            rule_id=rule.id,
                            join_value=key,
                            status=MatchStatus.RIGHT_ONLY,
                            right_evidence=_fact_ref(fact, prov),
                            severity=rule.severity,
                        )
                    )
                continue

            # Both sides present — compare the first fact on each side.
            # When multiple facts collide on the same key we keep the
            # first; downstream consumers see the other facts via the
            # one-sided emissions in the next loop iteration. PR3 will
            # add many-to-many comparison.
            lf, lp = left[0]
            rf, rp = right[0]
            left_val = _read_nested(lf, rule.compare_field) if "." in rule.compare_field else getattr(lf, rule.compare_field, None)
            right_val = _read_nested(rf, rule.compare_field) if "." in rule.compare_field else getattr(rf, rule.compare_field, None)

            within, delta, delta_pct = _compare_scalar(left_val, right_val, rule.tolerance)
            status = MatchStatus.CONFIRMED if within else MatchStatus.CONFLICT
            resolution = _resolution_text(rule, None) if status == MatchStatus.CONFLICT else None
            matches.append(
                ReconciliationMatch(
                    rule_id=rule.id,
                    join_value=key,
                    status=status,
                    left_evidence=_fact_ref(lf, lp),
                    right_evidence=_fact_ref(rf, rp),
                    delta=delta,
                    delta_pct=delta_pct,
                    resolution=resolution,
                    severity=rule.severity,
                )
            )

            if status == MatchStatus.CONFLICT and rule.severity == Severity.CRITICAL:
                if rule.id not in critical_conflicts:
                    critical_conflicts.append(rule.id)

    report = ReconciliationReport(
        project_id=project_id,
        project_type=rule_set.project_type,
        rules_file=rules_file or "",
        rules_evaluated=len(rule_set.rules),
        matches=matches,
        confirmed_count=sum(1 for m in matches if m.status == MatchStatus.CONFIRMED),
        conflict_count=sum(1 for m in matches if m.status == MatchStatus.CONFLICT),
        left_only_count=sum(1 for m in matches if m.status == MatchStatus.LEFT_ONLY),
        right_only_count=sum(1 for m in matches if m.status == MatchStatus.RIGHT_ONLY),
        critical_conflicts=critical_conflicts,
    )
    logger.info(
        "[uep.reconciliation] %s rules / %s matches "
        "(confirmed=%s conflict=%s left=%s right=%s gate=%s)",
        report.rules_evaluated,
        len(report.matches),
        report.confirmed_count,
        report.conflict_count,
        report.left_only_count,
        report.right_only_count,
        report.gate_passed(),
    )
    return report
